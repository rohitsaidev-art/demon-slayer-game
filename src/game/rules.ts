export type MudraId =
  | 'Open_Palm'
  | 'Closed_Fist'
  | 'Victory'
  | 'ILoveYou'
  | 'Thumb_Up'
  | 'Pointing_Up';

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
export const BASE_COMBO_DURATION_MS = 2500;
export const MIN_COMBO_DURATION_MS = 1450;
export const HOLD_DEBOUNCE_MS = 200;

export function calculateComboDurationMs(daanavHp: number, streak: number): number {
  const clampedHp = Math.max(0, Math.min(100, daanavHp));
  const missingHpRatio = (100 - clampedHp) / 100;
  // Starts at 2500ms at 100% HP, scales down as Daanav loses HP and streak rises
  const hpReduction = missingHpRatio * 800;
  const streakReduction = Math.min(streak, 8) * 35;
  const rawDuration = BASE_COMBO_DURATION_MS - hpReduction - streakReduction;
  return Math.round(Math.max(MIN_COMBO_DURATION_MS, Math.min(BASE_COMBO_DURATION_MS, rawDuration)));
}

export function calculateSpellDamage(streak: number, remainingTimeRatio: number): number {
  const baseDamage = 18;
  const streakBonus = Math.min(streak, 5) * 1.5;
  const speedBonus = Math.max(0, Math.min(1, remainingTimeRatio)) * 3.5;
  return Math.round(baseDamage + streakBonus + speedBonus);
}

export function calculateDaanavAttackDamage(daanavHp: number): number {
  // Enrages slightly when below 40% HP
  return daanavHp <= 40 ? 22 : 18;
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

  // Ensure the new combo is never identical to the immediately preceding combo
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
    // Left hand keys: 1 - 6
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
    // Right hand keys: 7, 8, 9, 0, -, = (plus Q/W/E/I/O/P conveniences)
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
