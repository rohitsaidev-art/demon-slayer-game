import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MUDRAS,
  BASE_COMBO_DURATION_MS,
  MIN_COMBO_DURATION_MS,
  calculateComboDurationMs,
  calculateSpellDamage,
  calculateDaanavAttackDamage,
  isComboMatched,
  isExplicitWrongCombo,
  generateNextCombo,
  mapKeyToHandMudra,
  normalizeMediaPipeCategory,
  evaluateMatchOutcome,
} from './rules';

test('MUDRAS defines all 6 required Tantrik mudras', () => {
  assert.equal(MUDRAS.length, 6);
  const ids = MUDRAS.map((m) => m.id);
  assert.deepEqual(ids, [
    'Open_Palm',
    'Closed_Fist',
    'Victory',
    'ILoveYou',
    'Thumb_Up',
    'Pointing_Up',
  ]);
});

test('calculateComboDurationMs starts at 2500ms and decreases as Daanav loses HP', () => {
  assert.equal(calculateComboDurationMs(100, 0), BASE_COMBO_DURATION_MS);
  const midDuration = calculateComboDurationMs(50, 2);
  assert.ok(midDuration < BASE_COMBO_DURATION_MS);
  assert.ok(midDuration > MIN_COMBO_DURATION_MS);
  const lowDuration = calculateComboDurationMs(0, 10);
  assert.equal(lowDuration, MIN_COMBO_DURATION_MS);
});

test('calculateSpellDamage rewards streak and fast cast speed', () => {
  const baseDmg = calculateSpellDamage(0, 0);
  const fastStreakDmg = calculateSpellDamage(4, 0.9);
  assert.equal(baseDmg, 18);
  assert.ok(fastStreakDmg > baseDmg);
});

test('calculateDaanavAttackDamage increases when Daanav is enraged below 40% HP', () => {
  assert.equal(calculateDaanavAttackDamage(80), 18);
  assert.equal(calculateDaanavAttackDamage(35), 22);
});

test('isComboMatched and isExplicitWrongCombo evaluate hand pairs accurately', () => {
  const target = { left: 'ILoveYou' as const, right: 'Open_Palm' as const };
  assert.equal(isComboMatched(target, 'ILoveYou', 'Open_Palm'), true);
  assert.equal(isComboMatched(target, 'ILoveYou', 'Victory'), false);
  assert.equal(isComboMatched(target, 'ILoveYou', null), false);

  assert.equal(isExplicitWrongCombo(target, 'Closed_Fist', 'Open_Palm'), true);
  assert.equal(isExplicitWrongCombo(target, 'ILoveYou', null), false);
  assert.equal(isExplicitWrongCombo(target, 'ILoveYou', 'Open_Palm'), false);
});

test('generateNextCombo never repeats the exact same combo consecutively', () => {
  const prev = { left: 'Open_Palm' as const, right: 'Open_Palm' as const };
  const next = generateNextCombo(prev, () => 0);
  assert.notDeepEqual(next, prev);
});

test('mapKeyToHandMudra maps keys 1-6 to left hand and 7-0/-/= to right hand', () => {
  assert.deepEqual(mapKeyToHandMudra('1'), { hand: 'left', mudra: 'Open_Palm' });
  assert.deepEqual(mapKeyToHandMudra('4'), { hand: 'left', mudra: 'ILoveYou' });
  assert.deepEqual(mapKeyToHandMudra('6'), { hand: 'left', mudra: 'Pointing_Up' });
  assert.deepEqual(mapKeyToHandMudra('7'), { hand: 'right', mudra: 'Open_Palm' });
  assert.deepEqual(mapKeyToHandMudra('0'), { hand: 'right', mudra: 'ILoveYou' });
  assert.deepEqual(mapKeyToHandMudra('-'), { hand: 'right', mudra: 'Thumb_Up' });
  assert.deepEqual(mapKeyToHandMudra('='), { hand: 'right', mudra: 'Pointing_Up' });
  assert.equal(mapKeyToHandMudra('x'), null);
});

test('normalizeMediaPipeCategory recognizes standard MediaPipe gesture names', () => {
  assert.equal(normalizeMediaPipeCategory('Closed_Fist'), 'Closed_Fist');
  assert.equal(normalizeMediaPipeCategory('ILoveYou'), 'ILoveYou');
  assert.equal(normalizeMediaPipeCategory('None'), null);
});

test('evaluateMatchOutcome detects victory and defeat thresholds', () => {
  assert.equal(evaluateMatchOutcome(80, 50), 'ongoing');
  assert.equal(evaluateMatchOutcome(40, 0), 'victory');
  assert.equal(evaluateMatchOutcome(0, 30), 'defeat');
});
