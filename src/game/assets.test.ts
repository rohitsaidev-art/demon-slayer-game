import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAVE_BACKGROUND_URL,
  DAANAV_SPRITE_URLS,
  HAND_SPRITE_URLS,
  removeWhiteBorderFloodFill,
} from './assets';
import { MUDRAS } from './rules';

test('All 10 photorealistic asset paths are mapped to local /assets/aistudio/ files', () => {
  assert.ok(CAVE_BACKGROUND_URL.includes('/assets/aistudio/'));
  assert.ok(DAANAV_SPRITE_URLS.IDLE.includes('/assets/aistudio/'));
  assert.ok(DAANAV_SPRITE_URLS.HURT.includes('/assets/aistudio/'));
  assert.ok(DAANAV_SPRITE_URLS.ATTACKING.includes('/assets/aistudio/'));

  for (const m of MUDRAS) {
    assert.ok(
      HAND_SPRITE_URLS[m.id].includes('/assets/aistudio/'),
      `Missing hand sprite for ${m.id}`
    );
  }
});

test('removeWhiteBorderFloodFill preserves already-transparent PNGs untouched', () => {
  // 3x3 image where corners have alpha = 0 and center is white (255,255,255,255)
  const data = new Uint8ClampedArray(3 * 3 * 4);
  const centerIdx = 4 * 4;
  data[centerIdx] = 255;
  data[centerIdx + 1] = 255;
  data[centerIdx + 2] = 255;
  data[centerIdx + 3] = 255;

  const result = removeWhiteBorderFloodFill(data, 3, 3);
  assert.equal(result.alreadyTransparent, true);
  assert.equal(result.modifiedPixels, 0);
  assert.equal(data[centerIdx + 3], 255);
});

test('removeWhiteBorderFloodFill strips outer white border while preserving interior white details (like Vibhuti ash stripes)', () => {
  // 5x5 image:
  // - Outer ring (x=0,4 or y=0,4): Opaque white background (255,255,255,255)
  // - Middle ring (x=1..3, y=1..3 border): Opaque brown/crimson skin barrier (120,40,30,255)
  // - Center pixel (x=2, y=2): Opaque white Vibhuti ash stripe (255,255,255,255)
  const w = 5;
  const h = 5;
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const isOuter = x === 0 || x === w - 1 || y === 0 || y === h - 1;
      const isCenter = x === 2 && y === 2;
      if (isOuter || isCenter) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      } else {
        data[i] = 120;
        data[i + 1] = 40;
        data[i + 2] = 30;
        data[i + 3] = 255;
      }
    }
  }

  const result = removeWhiteBorderFloodFill(data, w, h);
  assert.equal(result.alreadyTransparent, false);
  assert.equal(result.modifiedPixels, 16); // All 16 outer border pixels cleared
  assert.equal(data[0 + 3], 0, 'Outer corner must become transparent');
  const centerAlpha = data[(2 * w + 2) * 4 + 3];
  assert.equal(centerAlpha, 255, 'Interior white Vibhuti stripe must remain 100% opaque');
});
