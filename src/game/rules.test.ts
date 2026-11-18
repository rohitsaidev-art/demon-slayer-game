import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MUDRAS,
  BASE_COMBO_DURATION_MS,
  MIN_COMBO_DURATION_MS,
  DAANAV_ATTACK_RECOVERY_MS,
  POST_ATTACK_GRACE_BONUS_MS,
  DIFFICULTY_CONFIGS,
  calculateComboDurationMs,
  calculateComboDurationWithGraceMs,
  calculateDaanavAttackRecoveryMs,
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

test('DAANAV_ATTACK_RECOVERY_MS is 2500ms and calculateDaanavAttackRecoveryMs adds randomized delay across Easy, Medium, and Hard difficulties', () => {
  assert.equal(DAANAV_ATTACK_RECOVERY_MS, 2500);

  const minMedium = calculateDaanavAttackRecoveryMs('medium', () => 0);
  const maxMedium = calculateDaanavAttackRecoveryMs('medium', () => 1);
  assert.equal(minMedium, 2500);
  assert.ok(maxMedium > minMedium);

  const minEasy = calculateDaanavAttackRecoveryMs('easy', () => 0);
  assert.ok(minEasy > minMedium);

  assert.ok(
    DIFFICULTY_CONFIGS.easy.baseComboDurationMs > DIFFICULTY_CONFIGS.medium.baseComboDurationMs
  );
  assert.ok(
    DIFFICULTY_CONFIGS.medium.baseComboDurationMs > DIFFICULTY_CONFIGS.hard.baseComboDurationMs
  );
});

test('calculateComboDurationMs starts at 4200ms on Medium and decreases gradually as Daanav loses HP, with post-attack restraint grace bonus', () => {
  assert.equal(calculateComboDurationMs(100, 0), BASE_COMBO_DURATION_MS);
  const midDuration = calculateComboDurationMs(50, 2);
  assert.ok(midDuration < BASE_COMBO_DURATION_MS);
  assert.ok(midDuration > MIN_COMBO_DURATION_MS);
  const lowDuration = calculateComboDurationMs(0, 10);
  assert.equal(lowDuration, MIN_COMBO_DURATION_MS);

  const gracedDuration = calculateComboDurationWithGraceMs(100, 0, 1);
  assert.equal(gracedDuration, BASE_COMBO_DURATION_MS + POST_ATTACK_GRACE_BONUS_MS);
});

test('calculateSpellDamage rewards streak, fast cast speed, and scales with difficulty', () => {
  const baseDmg = calculateSpellDamage(0, 0, 'medium');
  const fastStreakDmg = calculateSpellDamage(4, 0.9, 'medium');
  const easyDmg = calculateSpellDamage(0, 0, 'easy');
  assert.equal(baseDmg, 18);
  assert.ok(fastStreakDmg > baseDmg);
  assert.ok(easyDmg > baseDmg);
});

test('calculateDaanavAttackDamage increases when Daanav is enraged below 40% HP and scales with difficulty', () => {
  assert.equal(calculateDaanavAttackDamage(80, 'medium'), 18);
  assert.equal(calculateDaanavAttackDamage(35, 'medium'), 22);
  assert.ok(calculateDaanavAttackDamage(80, 'easy') < calculateDaanavAttackDamage(80, 'medium'));
  assert.ok(calculateDaanavAttackDamage(80, 'hard') > calculateDaanavAttackDamage(80, 'medium'));
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
