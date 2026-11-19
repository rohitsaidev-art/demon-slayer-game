import { MudraId, normalizeMediaPipeCategory } from './rules';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export const HAND_CONFIDENCE_THRESHOLD = 0.65;
export const GESTURE_CONFIDENCE_THRESHOLD = 0.55;

export interface DetectedHandsResult {
  left: MudraId | null;
  right: MudraId | null;
  leftConfidence: number;
  rightConfidence: number;
  leftHandedness: 'left' | 'right';
  rightHandedness: 'left' | 'right';
  leftLandmarks: Landmark[] | null;
  rightLandmarks: Landmark[] | null;
}

interface MediaPipeGestureRecognizer {
  recognizeForVideo(
    videoFrame: HTMLVideoElement,
    timestamp: number
  ): {
    gestures: Array<Array<{ categoryName: string; score: number }>>;
    landmarks: Array<Landmark[]>;
    handednesses: Array<Array<{ categoryName: string; score: number }>>;
  };
  close(): void;
}

const VISION_ESM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
const VISION_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const GESTURE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

let logFilterInstalled = false;

/**
 * MediaPipe's Emscripten WASM binary routes C++ Abseil/TFLite informational logs
 * (such as "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.") to `stderr`,
 * which Emscripten forwards to `console.error`. This filter prevents those benign
 * WASM info/warning lines from triggering false-positive error banners while keeping
 * all real errors intact.
 */
export function installMediaPipeLogFilter(): void {
  if (logFilterInstalled || typeof console === 'undefined') return;
  logFilterInstalled = true;

  const isBenignMediaPipeLog = (args: unknown[]): boolean => {
    if (args.length === 0) return false;
    const text = args.map((a) => (typeof a === 'string' ? a : String(a ?? ''))).join(' ');
    return (
      text.includes('Created TensorFlow Lite XNNPACK delegate') ||
      text.includes('XNNPACK delegate for CPU') ||
      text.includes('TensorFlow Lite') ||
      /^(INFO|I0000|W0000)\b/.test(text.trim()) ||
      text.includes('gl_context_webgl.cc') ||
      text.includes('Graph successfully started running')
    );
  };

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    if (isBenignMediaPipeLog(args)) return;
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    if (isBenignMediaPipeLog(args)) return;
    origWarn(...args);
  };
}

installMediaPipeLogFilter();

function dist2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Fallback geometric landmark classifier that augments MediaPipe's built-in
 * gesture classifier—especially helpful for Rock Horns / Karana Mudra (🤘)
 * when the thumb is tucked in as well as extended.
 */
export function classifyMudraFromLandmarks(
  landmarks: Landmark[],
  mpCategory: string | null
): MudraId | null {
  const normalized = mpCategory ? normalizeMediaPipeCategory(mpCategory) : null;

  if (!landmarks || landmarks.length < 21) {
    return normalized;
  }

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexTip = landmarks[8];

  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleTip = landmarks[12];

  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringTip = landmarks[16];

  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyTip = landmarks[20];

  const thumbCmc = landmarks[1];
  const thumbIp = landmarks[3];
  const thumbTip = landmarks[4];

  const isFingerExtended = (tip: Landmark, pip: Landmark, mcp: Landmark) =>
    dist2D(tip, wrist) > dist2D(pip, wrist) * 1.12 &&
    dist2D(tip, wrist) > dist2D(mcp, wrist) * 1.25;

  const indexExt = isFingerExtended(indexTip, indexPip, indexMcp);
  const middleExt = isFingerExtended(middleTip, middlePip, middleMcp);
  const ringExt = isFingerExtended(ringTip, ringPip, ringMcp);
  const pinkyExt = isFingerExtended(pinkyTip, pinkyPip, pinkyMcp);
  const thumbExt =
    dist2D(thumbTip, indexMcp) > dist2D(thumbIp, indexMcp) * 1.15 &&
    dist2D(thumbTip, pinkyMcp) > dist2D(indexMcp, pinkyMcp) * 0.95;

  // Rock Horns / Karana Mudra (🤘): Index and pinky extended, middle and ring curled
  if (indexExt && pinkyExt && !middleExt && !ringExt) {
    return 'ILoveYou';
  }

  if (normalized) {
    return normalized;
  }

  // Victory (✌️): Index and middle extended, ring and pinky curled
  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    return 'Victory';
  }

  // Pointing_Up (☝️): Only index extended
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'Pointing_Up';
  }

  // Open_Palm (🖐): All 4 fingers extended
  if (indexExt && middleExt && ringExt && pinkyExt) {
    return 'Open_Palm';
  }

  // Thumb_Up (👍): 4 fingers curled, thumb extended upward/outward
  if (!indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt && thumbTip.y < thumbCmc.y) {
    return 'Thumb_Up';
  }

  // Closed_Fist (✊): All 4 fingers curled
  if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'Closed_Fist';
  }

  return null;
}

export async function createMediaPipeRecognizer(): Promise<MediaPipeGestureRecognizer> {
  installMediaPipeLogFilter();
  const visionModule = await import(/* @vite-ignore */ VISION_ESM_URL);
  const { FilesetResolver, GestureRecognizer } = visionModule;

  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);

  try {
    return await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: GESTURE_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: HAND_CONFIDENCE_THRESHOLD,
      minHandPresenceConfidence: HAND_CONFIDENCE_THRESHOLD,
      minTrackingConfidence: HAND_CONFIDENCE_THRESHOLD,
    });
  } catch {
    return await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: GESTURE_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: HAND_CONFIDENCE_THRESHOLD,
      minHandPresenceConfidence: HAND_CONFIDENCE_THRESHOLD,
      minTrackingConfidence: HAND_CONFIDENCE_THRESHOLD,
    });
  }
}

export function extractBothHandsFromResult(
  result: ReturnType<MediaPipeGestureRecognizer['recognizeForVideo']>,
  minHandConfidence: number = HAND_CONFIDENCE_THRESHOLD
): DetectedHandsResult {
  const output: DetectedHandsResult = {
    left: null,
    right: null,
    leftConfidence: 0,
    rightConfidence: 0,
    leftHandedness: 'left',
    rightHandedness: 'right',
    leftLandmarks: null,
    rightLandmarks: null,
  };

  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return output;
  }

  interface CandidateHand {
    mirroredX: number;
    mudra: MudraId | null;
    handConfidence: number;
    handedness: 'left' | 'right';
    landmarks: Landmark[];
  }

  const candidates: CandidateHand[] = [];

  for (let i = 0; i < result.landmarks.length; i++) {
    const lm = result.landmarks[i];
    if (!lm || lm.length === 0) continue;

    const topHandedness = result.handednesses?.[i]?.[0];
    const handConfidence = topHandedness?.score ?? 0.85;

    // Filter out low-confidence hand detections caused by background noise
    if (handConfidence < minHandConfidence) {
      continue;
    }

    const topGesture = result.gestures?.[i]?.[0];
    const mpCategory =
      topGesture && topGesture.score >= GESTURE_CONFIDENCE_THRESHOLD
        ? topGesture.categoryName
        : null;
    const mudra = classifyMudraFromLandmarks(lm, mpCategory);

    // Since the webcam video is mirrored horizontally (scaleX(-1)),
    // raw x = 1.0 is on the left side of the mirrored view, and raw x = 0.0 is on the right.
    const mirroredX = 1 - lm[0].x;
    const handedness: 'left' | 'right' = mirroredX < 0.5 ? 'left' : 'right';

    candidates.push({
      mirroredX,
      mudra,
      handConfidence,
      handedness,
      landmarks: lm,
    });
  }

  if (candidates.length === 1) {
    const single = candidates[0];
    if (single.mirroredX < 0.5) {
      output.left = single.mudra;
      output.leftConfidence = single.handConfidence;
      output.leftHandedness = 'left';
      output.leftLandmarks = single.landmarks;
    } else {
      output.right = single.mudra;
      output.rightConfidence = single.handConfidence;
      output.rightHandedness = 'right';
      output.rightLandmarks = single.landmarks;
    }
  } else if (candidates.length >= 2) {
    candidates.sort((a, b) => a.mirroredX - b.mirroredX);
    const leftCand = candidates[0];
    const rightCand = candidates[candidates.length - 1];

    output.left = leftCand.mudra;
    output.leftConfidence = leftCand.handConfidence;
    output.leftHandedness = 'left';
    output.leftLandmarks = leftCand.landmarks;

    output.right = rightCand.mudra;
    output.rightConfidence = rightCand.handConfidence;
    output.rightHandedness = 'right';
    output.rightLandmarks = rightCand.landmarks;
  }

  return output;
}
