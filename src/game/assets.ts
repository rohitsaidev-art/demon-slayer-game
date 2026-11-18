import { DaanavPose, MudraId } from './rules';

const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
    ? import.meta.env.BASE_URL
    : '/';

const getAssetUrl = (assetPath: string) => {
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return `${cleanBase}${cleanPath}`;
};

export const CAVE_BACKGROUND_URL = getAssetUrl('assets/aistudio/cave_background__1__0b10090d.png');

export const DAANAV_SPRITE_URLS: Record<DaanavPose, string> = {
  IDLE: getAssetUrl('assets/aistudio/Horned_Demon_King_in_Gold_Ornaments_3d7c9beb.png'),
  HURT: getAssetUrl('assets/aistudio/Anguished_Horned_Demon_Recoiling_de6fff3b.png'),
  ATTACKING: getAssetUrl('assets/aistudio/Horned_Demon_s_Golden_Rampage_de8702f4.png'),
};

export const HAND_SPRITE_URLS: Record<MudraId, string> = {
  Open_Palm: getAssetUrl('assets/aistudio/hand_palm_7f1d28ac.png'),
  Closed_Fist: getAssetUrl('assets/aistudio/hand_fist_7b0d9c64.png'),
  Victory: getAssetUrl('assets/aistudio/hand_victory_d67a3628.png'),
  ILoveYou: getAssetUrl('assets/aistudio/hand_horns_e0c45b28.png'),
  Thumb_Up: getAssetUrl('assets/aistudio/hand_thumb_ed359664.png'),
  Pointing_Up: getAssetUrl('assets/aistudio/hand_point_bb4bb60c.png'),
};

export type MusicTrackId = 'tantrik_bell' | 'rakshasa_rite';

export const MUSIC_TRACK_URLS: Record<MusicTrackId, string> = {
  tantrik_bell: '/assets/aistudio/Tantrik_Clean_Edit_7096205e.mp3',
  rakshasa_rite: '/assets/aistudio/Rakshasa_Clean_Edit_757d0aa3.mp3',
};

export type StingerTrackId = 'player_victory' | 'player_defeat';

export const STINGER_TRACK_URLS: Record<StingerTrackId, string> = {
  player_victory:
    '/assets/aistudio/player_Victory_stinger_-The_Last_Temple_Bell_9339477a.mp3',
  player_defeat:
    '/assets/aistudio/player_Defeat_stinger_-Curse_of_the_Mudradhaar_-_Stinger_a0ea1f99.mp3',
};

export type VoiceClipId =
  | 'demon_1st_dialogue'
  | 'demon_first_angry'
  | 'demon_got_attacked'
  | 'demon_defeat'
  | 'demon_victory'
  | 'demon_attacking'
  | 'tantrik_1st_dialogue'
  | 'tantrik_victory'
  | 'tantrik_defeat'
  | 'tantrik_got_attacked';

export const VOICE_CLIP_URLS: Record<VoiceClipId, string> = {
  demon_1st_dialogue: '/assets/aistudio/demon_1st_dialogue_cfd5a1b2.mp3',
  demon_first_angry: '/assets/aistudio/demon_first_angry_364913be.mp3',
  demon_got_attacked: '/assets/aistudio/demon-got_-attacked_f6f5ed98.mp3',
  demon_defeat: '/assets/aistudio/demon-_defeat_a6c97651.mp3',
  demon_victory: '/assets/aistudio/demon_victory_63b1ecd8.mp3',
  demon_attacking: '/assets/aistudio/demon_attacking_8f770306.mp3',
  tantrik_1st_dialogue: '/assets/aistudio/tantric_1st_dialogue_b222685c.mp3',
  tantrik_victory: '/assets/aistudio/tantric_victory_d83419a2.mp3',
  tantrik_defeat: '/assets/aistudio/tantric_defeat_a52a1b82.mp3',
  tantrik_got_attacked: '/assets/aistudio/tantrick_got_attacked_719d4723.mp3',
};

export type SfxClipId =
  | 'mudra_sparkle'
  | 'rakshasa_fireball'
  | 'tantrik_punch_hit'
  | 'ritual_choir_shine'
  | 'rakshasa_grunt_backup';

export const SFX_CLIP_URLS: Record<SfxClipId, string> = {
  mudra_sparkle: '/assets/aistudio/mixkit-magic-sparkle-poof-hit-3082_cb2f7cf7.wav',
  rakshasa_fireball: '/assets/aistudio/mixkit-fireball-spell-1347_7cc57263.wav',
  tantrik_punch_hit: '/assets/aistudio/mixkit-impact-of-a-strong-punch-2155_f89ad165.mp3',
  ritual_choir_shine: '/assets/aistudio/mixkit-choir-magic-shine-658_0cda8e9a.wav',
  rakshasa_grunt_backup: '/assets/aistudio/Rakshasa_Grunt_Cleaned__3__4a64ae8f.mp3',
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
