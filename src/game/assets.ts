import { DaanavPose, MudraId } from './rules';

export const CAVE_BACKGROUND_URL = '/assets/aistudio/cave_background__1__0b10090d.png';

export const DAANAV_SPRITE_URLS: Record<DaanavPose, string> = {
  IDLE: '/assets/aistudio/Horned_Demon_King_in_Gold_Ornaments_3d7c9beb.png',
  HURT: '/assets/aistudio/Anguished_Horned_Demon_Recoiling_de6fff3b.png',
  ATTACKING: '/assets/aistudio/Horned_Demon_s_Golden_Rampage_de8702f4.png',
};

export const HAND_SPRITE_URLS: Record<MudraId, string> = {
  Open_Palm: '/assets/aistudio/hand_palm_7f1d28ac.png',
  Closed_Fist: '/assets/aistudio/hand_fist_7b0d9c64.png',
  Victory: '/assets/aistudio/hand_victory_d67a3628.png',
  ILoveYou: '/assets/aistudio/hand_horns_e0c45b28.png',
  Thumb_Up: '/assets/aistudio/hand_thumb_ed359664.png',
  Pointing_Up: '/assets/aistudio/hand_point_bb4bb60c.png',
};

export interface AlphaCheckResult {
  alreadyTransparent: boolean;
  modifiedPixels: number;
}

/**
 * Pure outside-in border flood-fill alpha guard.
 * - If the image's corner pixels already have alpha < 16, returns immediately
 *   with `alreadyTransparent: true` and does not modify any pixels.
 * - If the corners are opaque near-white (R,G,B >= threshold), flood-fills inward
 *   from the perimeter to remove the outer white background while preserving
 *   interior white details (such as Vibhuti ash stripes and teeth/fangs).
 */
export function removeWhiteBorderFloodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  whiteThreshold: number = 238
): AlphaCheckResult {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return { alreadyTransparent: true, modifiedPixels: 0 };
  }

  const cornerIndices = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];

  const cornersTransparent = cornerIndices.every((idx) => data[idx + 3] < 16);
  if (cornersTransparent) {
    return { alreadyTransparent: true, modifiedPixels: 0 };
  }

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;
  let modifiedPixels = 0;

  const isNearWhite = (pixelIndex: number): boolean => {
    const i = pixelIndex * 4;
    const a = data[i + 3];
    if (a < 16) return true;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
  };

  const enqueueIfWhite = (px: number, py: number) => {
    const pIdx = py * width + px;
    if (visited[pIdx]) return;
    if (isNearWhite(pIdx)) {
      visited[pIdx] = 1;
      queue[tail++] = pIdx;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueueIfWhite(x, 0);
    enqueueIfWhite(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueueIfWhite(0, y);
    enqueueIfWhite(width - 1, y);
  }

  while (head < tail) {
    const current = queue[head++];
    const byteIdx = current * 4;
    if (data[byteIdx + 3] !== 0) {
      data[byteIdx + 3] = 0;
      modifiedPixels++;
    }

    const cx = current % width;
    const cy = (current - cx) / width;

    if (cx > 0) enqueueIfWhite(cx - 1, cy);
    if (cx < width - 1) enqueueIfWhite(cx + 1, cy);
    if (cy > 0) enqueueIfWhite(cx, cy - 1);
    if (cy < height - 1) enqueueIfWhite(cx, cy + 1);
  }

  return { alreadyTransparent: false, modifiedPixels };
}

let preloaded = false;

/**
 * Asynchronously preloads and decodes all 10 game images off the main thread
 * without blocking rendering or running redundant full-frame getImageData scans.
 */
export function preloadGameAssets(): void {
  if (preloaded || typeof window === 'undefined' || typeof Image === 'undefined') {
    return;
  }
  preloaded = true;

  const allUrls = [
    CAVE_BACKGROUND_URL,
    ...Object.values(DAANAV_SPRITE_URLS),
    ...Object.values(HAND_SPRITE_URLS),
  ];

  for (const url of allUrls) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img.decode?.().catch(() => {});
  }
}
