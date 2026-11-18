export type MudraId =
  | 'Open_Palm'
  | 'Closed_Fist'
  | 'Victory'
  | 'ILoveYou'
  | 'Thumb_Up'
  | 'Pointing_Up';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  sanskritTitle: string;
  baseComboDurationMs: number;
  minComboDurationMs: number;
  daanavBaseDamage: number;
  daanavEnragedDamage: number;
  tantrikBaseDamage: number;
  attackRecoveryBonusMs: number;
  randomAttackJitterMaxMs: number;
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    sanskritTitle: 'Shishya · Initiate',
    baseComboDurationMs: 5200,
    minComboDurationMs: 3600,
    daanavBaseDamage: 14,
    daanavEnragedDamage: 17,
    tantrikBaseDamage: 22,
    attackRecoveryBonusMs: 600,
    randomAttackJitterMaxMs: 1100,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    sanskritTitle: 'Sadhaka · Tantrik',
    baseComboDurationMs: 4200,
    minComboDurationMs: 2800,
    daanavBaseDamage: 18,
    daanavEnragedDamage: 22,
    tantrikBaseDamage: 18,
    attackRecoveryBonusMs: 0,
    randomAttackJitterMaxMs: 950,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    sanskritTitle: 'Aghori · Master',
    baseComboDurationMs: 3300,
    minComboDurationMs: 2100,
    daanavBaseDamage: 22,
    daanavEnragedDamage: 27,
    tantrikBaseDamage: 17,
    attackRecoveryBonusMs: 0,
    randomAttackJitterMaxMs: 700,
  },
};

export interface MudraInfo {
  id: MudraId;
  sanskritName: string;
  englishName: string;
  emoji: string;
  leftKey: string;
  rightKey: string;
  description: string;
}

export const MUDRAS: readonly MudraInfo[] = [
  {
    id: 'Open_Palm',
    sanskritName: 'Abhaya Mudra',
    englishName: 'Open Palm',
    emoji: '🖐️',
    leftKey: '1',
    rightKey: '7',
    description: 'Spread all five fingers wide',
  },
  {
    id: 'Closed_Fist',
    sanskritName: 'Mushti Mudra',
    englishName: 'Closed Fist',
    emoji: '✊',
    leftKey: '2',
    rightKey: '8',
    description: 'Clench fingers into a tight fist',
  },
  {
    id: 'Victory',
    sanskritName: 'Prana Mudra',
    englishName: 'Victory Sign',
    emoji: '✌️',
    leftKey: '3',
    rightKey: '9',
    description: 'Raise index and middle fingers in a V',
  },
  {
    id: 'ILoveYou',
    sanskritName: 'Karana Mudra',
    englishName: 'Demon Horns',
    emoji: '🤘',
    leftKey: '4',
    rightKey: '0',
    description: 'Extend index and pinky fingers (horns)',
  },
  {
    id: 'Thumb_Up',
    sanskritName: 'Shikhara Mudra',
    englishName: 'Thumb Up',
    emoji: '👍',
    leftKey: '5',
    rightKey: '-',
    description: 'Extend thumb upward with curled fingers',
  },
  {
    id: 'Pointing_Up',
    sanskritName: 'Tarjani Mudra',
    englishName: 'Pointing Up',
    emoji: '☝️',
    leftKey: '6',
    rightKey: '=',
    description: 'Raise index finger straight toward the sky',
  },
] as const;

export const MUDRA_BY_ID: Record<MudraId, MudraInfo> = {
  Open_Palm: MUDRAS[0],
  Closed_Fist: MUDRAS[1],
  Victory: MUDRAS[2],
  ILoveYou: MUDRAS[3],
  Thumb_Up: MUDRAS[4],
  Pointing_Up: MUDRAS[5],
};

export interface MudraCombo {
  left: MudraId;
  right: MudraId;
}

export type DaanavPose = 'IDLE' | 'HURT' | 'ATTACKING';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export const HURT_SHOUTS = ['STOP!', 'PAIN!', 'AGH!', 'ENOUGH!'] as const;
export const ATTACK_SHOUTS = ['BLOOD!', 'BURN!', 'DIE!', 'ENOUGH!'] as const;

export const INITIAL_TANTRIK_HP = 100;
export const INITIAL_DAANAV_HP = 100;

/**
 * Balanced combat pacing constants:
 * - `DAANAV_ATTACK_RECOVERY_MS` increased to 2500ms (plus randomized jitter) so there is
 *   generous breathing room between Daanav attacks and no predictable machine-gun pattern.
 */
export const BASE_COMBO_DURATION_MS = 4200;
export const MIN_COMBO_DURATION_MS = 2800;
export const HOLD_DEBOUNCE_MS = 220;
export const SPELL_CAST_BREATHING_MS = 1650;
export const DAANAV_ATTACK_RECOVERY_MS = 2500;
export const POST_ATTACK_GRACE_BONUS_MS = 900;
export const OUTCOME_NARRATIVE_TRANSITION_MS = 1350;

export function calculateComboDurationMs(
  daanavHp: number,
  streak: number,
  difficulty: DifficultyLevel = 'medium'
): number {
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  const clampedHp = Math.max(0, Math.min(100, daanavHp));
  const missingHpRatio = (100 - clampedHp) / 100;
  const hpReduction = missingHpRatio * 1050;
  const streakReduction = Math.min(streak, 7) * 50;
  const rawDuration = cfg.baseComboDurationMs - hpReduction - streakReduction;
  return Math.round(
    Math.max(cfg.minComboDurationMs, Math.min(cfg.baseComboDurationMs, rawDuration))
  );
}

export function calculateComboDurationWithGraceMs(
  daanavHp: number,
  streak: number,
  consecutiveDaanavAttacks: number,
  difficulty: DifficultyLevel = 'medium'
): number {
  const base = calculateComboDurationMs(daanavHp, streak, difficulty);
  if (consecutiveDaanavAttacks <= 0) {
    return base;
  }
  const graceBonus = Math.min(consecutiveDaanavAttacks, 2) * POST_ATTACK_GRACE_BONUS_MS;
  return base + graceBonus;
}

/**
 * Calculates the recovery + randomized delay after a Daanav attack (minimum `DAANAV_ATTACK_RECOVERY_MS` = 2500ms)
 * to break predictable attack rhythms and give the player breathing room.
 */
export function calculateDaanavAttackRecoveryMs(
  difficulty: DifficultyLevel = 'medium',
  rng: () => number = Math.random
): number {
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  const clampedRand = Math.max(0, Math.min(1, rng()));
  const randomDelayMs = Math.round(clampedRand * cfg.randomAttackJitterMaxMs);
  return DAANAV_ATTACK_RECOVERY_MS + cfg.attackRecoveryBonusMs + randomDelayMs;
}

export function calculateSpellDamage(
  streak: number,
  remainingTimeRatio: number,
  difficulty: DifficultyLevel = 'medium'
): number {
  const baseDamage = DIFFICULTY_CONFIGS[difficulty].tantrikBaseDamage;
  const streakBonus = Math.min(streak, 5) * 1.5;
  const speedBonus = Math.max(0, Math.min(1, remainingTimeRatio)) * 3.5;
  return Math.round(baseDamage + streakBonus + speedBonus);
}

export function calculateDaanavAttackDamage(
  daanavHp: number,
  difficulty: DifficultyLevel = 'medium'
): number {
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  return daanavHp <= 40 ? cfg.daanavEnragedDamage : cfg.daanavBaseDamage;
}

export function isComboMatched(
  target: MudraCombo,
  detectedLeft: MudraId | null,
  detectedRight: MudraId | null
): boolean {
  return detectedLeft === target.left && detectedRight === target.right;
}

export function isExplicitWrongCombo(
  target: MudraCombo,
  detectedLeft: MudraId | null,
  detectedRight: MudraId | null
): boolean {
  if (!detectedLeft || !detectedRight) return false;
  return detectedLeft !== target.left || detectedRight !== target.right;
}

export function generateNextCombo(
  previousCombo: MudraCombo | null,
  rng: () => number = Math.random
): MudraCombo {
  const ids = MUDRAS.map((m) => m.id);
  let left = ids[Math.floor(rng() * ids.length)] ?? 'ILoveYou';
  let right = ids[Math.floor(rng() * ids.length)] ?? 'Open_Palm';

  if (previousCombo && left === previousCombo.left && right === previousCombo.right) {
    const leftIdx = ids.indexOf(left);
    left = ids[(leftIdx + 1) % ids.length];
    const rightIdx = ids.indexOf(right);
    right = ids[(rightIdx + 2) % ids.length];
  }

  return { left, right };
}

export function mapKeyToHandMudra(
  key: string
): { hand: 'left' | 'right'; mudra: MudraId } | null {
  switch (key) {
    case '1':
      return { hand: 'left', mudra: 'Open_Palm' };
    case '2':
      return { hand: 'left', mudra: 'Closed_Fist' };
    case '3':
      return { hand: 'left', mudra: 'Victory' };
    case '4':
      return { hand: 'left', mudra: 'ILoveYou' };
    case '5':
      return { hand: 'left', mudra: 'Thumb_Up' };
    case '6':
      return { hand: 'left', mudra: 'Pointing_Up' };
    case '7':
      return { hand: 'right', mudra: 'Open_Palm' };
    case '8':
      return { hand: 'right', mudra: 'Closed_Fist' };
    case '9':
      return { hand: 'right', mudra: 'Victory' };
    case '0':
      return { hand: 'right', mudra: 'ILoveYou' };
    case '-':
    case '_':
      return { hand: 'right', mudra: 'Thumb_Up' };
    case '=':
    case '+':
      return { hand: 'right', mudra: 'Pointing_Up' };
    default:
      return null;
  }
}

export function normalizeMediaPipeCategory(categoryName: string): MudraId | null {
  switch (categoryName) {
    case 'Open_Palm':
      return 'Open_Palm';
    case 'Closed_Fist':
      return 'Closed_Fist';
    case 'Victory':
      return 'Victory';
    case 'ILoveYou':
      return 'ILoveYou';
    case 'Thumb_Up':
      return 'Thumb_Up';
    case 'Pointing_Up':
      return 'Pointing_Up';
    default:
      return null;
  }
}

export function evaluateMatchOutcome(
  tantrikHp: number,
  daanavHp: number
): 'ongoing' | 'victory' | 'defeat' {
  if (daanavHp <= 0) return 'victory';
  if (tantrikHp <= 0) return 'defeat';
  return 'ongoing';
}
