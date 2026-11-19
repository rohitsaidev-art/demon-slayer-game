import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ABHAYA_WARD_COOLDOWN_MS,
  ATTACK_SHOUTS,
  BASE_COMBO_DURATION_MS,
  calculateComboDurationWithGraceMs,
  calculateDaanavAttackDamage,
  calculateDaanavAttackRecoveryMs,
  calculateParriedDaanavDamage,
  calculatePranaGain,
  calculateRitualRank,
  calculateSpellDamage,
  DaanavPose,
  DIFFICULTY_CONFIGS,
  DifficultyLevel,
  evaluateMatchOutcome,
  evaluateMudraSynergy,
  GameState,
  generateNextCombo,
  HOLD_DEBOUNCE_MS,
  HURT_SHOUTS,
  INITIAL_DAANAV_HP,
  INITIAL_TANTRIK_HP,
  isComboMatched,
  isDaanavPhase2Unbound,
  MAHAMUDRA_BONUS_DAMAGE,
  MAHAMUDRA_HEAL_HP,
  MAHAMUDRA_STUN_MS,
  mapKeyToHandMudra,
  MUDRA_BY_ID,
  MUDRAS,
  MudraCombo,
  MudraId,
  OUTCOME_NARRATIVE_TRANSITION_MS,
  SPELL_CAST_BREATHING_MS,
} from './game/rules';
import { audioManager } from './game/audio';
import { preloadGameAssets, VoiceClipId } from './game/assets';
import {
  createMediaPipeRecognizer,
  extractBothHandsFromResult,
  HAND_CONFIDENCE_THRESHOLD,
} from './game/mediapipe';
import { CavernBackdrop } from './components/CavernBackdrop';
import { DaanavBoss } from './components/DaanavBoss';
import { TantrikHandSvg } from './components/TantrikHands';
import { GameModals, RunStatsSnapshot } from './components/GameModals';
import { SpellCastOverlay } from './components/SpellCastOverlay';
import {
  BookOpen,
  Camera,
  CameraOff,
  Check,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

type PendingRoundAction = 'none' | 'next_round' | 'victory' | 'defeat';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);

  // Core Combat State
  const [tantrikHp, setTantrikHp] = useState<number>(INITIAL_TANTRIK_HP);
  const [tantrikGhostHp, setTantrikGhostHp] = useState<number>(INITIAL_TANTRIK_HP);
  const [daanavHp, setDaanavHp] = useState<number>(INITIAL_DAANAV_HP);
  const [daanavGhostHp, setDaanavGhostHp] = useState<number>(INITIAL_DAANAV_HP);

  // Prana Ultimate Gauge & Abhaya Ward State
  const [pranaGauge, setPranaGauge] = useState<number>(0);
  const [abhayaWardActive, setAbhayaWardActive] = useState<boolean>(false);
  const [abhayaWardCooldownSec, setAbhayaWardCooldownSec] = useState<number>(0);

  // Floating Sanskrit Mantra Callout State
  const [mantraCallout, setMantraCallout] = useState<{
    title: string;
    subtitle: string;
    key: number;
  } | null>(null);

  const [targetCombo, setTargetCombo] = useState<MudraCombo>(() => ({
    left: 'ILoveYou',
    right: 'Open_Palm',
  }));
  const [leftHandMudra, setLeftHandMudra] = useState<MudraId>('Closed_Fist');
  const [rightHandMudra, setRightHandMudra] = useState<MudraId>('Closed_Fist');
  const [activeDetectedLeft, setActiveDetectedLeft] = useState<MudraId | null>(null);
  const [activeDetectedRight, setActiveDetectedRight] = useState<MudraId | null>(null);

  const [daanavPose, setDaanavPose] = useState<DaanavPose>('IDLE');
  const [shoutText, setShoutText] = useState<string | null>(null);
  const [shoutKey, setShoutKey] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [spellsCast, setSpellsCast] = useState<number>(0);

  const [burstTrigger, setBurstTrigger] = useState<number>(0);
  const [burstType, setBurstType] = useState<'spell' | 'damage' | null>(null);
  const [spellTrigger, setSpellTrigger] = useState<number>(0);

  // Narrative Prelude & Screen Transition State
  const [isIntroPrelude, setIsIntroPrelude] = useState<boolean>(false);
  const [activeIntroVoice, setActiveIntroVoice] = useState<VoiceClipId | null>(null);
  const [endingTransitionOutcome, setEndingTransitionOutcome] = useState<'victory' | 'defeat' | null>(
    null
  );
  const [screenVeilActive, setScreenVeilActive] = useState<boolean>(false);

  // Audio & Webcam UI State
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle');
  const [showWebcamPip, setShowWebcamPip] = useState<boolean>(true);
  const [runSnapshot, setRunSnapshot] = useState<RunStatsSnapshot | null>(null);

  // High-frequency refs
  const timerBarRef = useRef<HTMLDivElement | null>(null);
  const holdBarRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<Awaited<ReturnType<typeof createMediaPipeRecognizer>> | null>(null);

  const gameStateRef = useRef<GameState>(gameState);
  const difficultyRef = useRef<DifficultyLevel>(difficulty);
  const isPracticeModeRef = useRef<boolean>(isPracticeMode);
  const cameraStatusRef = useRef(cameraStatus);
  const targetComboRef = useRef<MudraCombo>(targetCombo);
  const detectedLeftRef = useRef<MudraId | null>(null);
  const detectedRightRef = useRef<MudraId | null>(null);
  const candidateLeftMudraRef = useRef<MudraId | null>(null);
  const candidateRightMudraRef = useRef<MudraId | null>(null);
  const tantrikHpRef = useRef<number>(tantrikHp);
  const daanavHpRef = useRef<number>(daanavHp);
  const streakRef = useRef<number>(streak);
  const bestStreakRef = useRef<number>(bestStreak);
  const spellsCastRef = useRef<number>(spellsCast);
  const consecutiveDaanavAttacksRef = useRef<number>(0);

  const pranaGaugeRef = useRef<number>(0);
  const abhayaWardActiveRef = useRef<boolean>(false);
  const abhayaWardCooldownMsRef = useRef<number>(0);
  const pendingStunBonusMsRef = useRef<number>(0);
  const phase2AnnouncedRef = useRef<boolean>(false);

  // Run telemetry refs for Ritual Scroll Summary
  const fastestCastMsRef = useRef<number>(Infinity);
  const parriesCountRef = useRef<number>(0);
  const daanavAttacksCountRef = useRef<number>(0);

  const comboDurationMsRef = useRef<number>(BASE_COMBO_DURATION_MS);
  const comboRemainingMsRef = useRef<number>(BASE_COMBO_DURATION_MS);
  const holdMatchedMsRef = useRef<number>(0);
  const roundCooldownMsRef = useRef<number>(0);
  const lastAttackRecoveryMsRef = useRef<number>(0);
  const pendingRoundActionRef = useRef<PendingRoundAction>('none');
  const wasIntroDialoguePlayingRef = useRef<boolean>(false);
  const runStartTimeRef = useRef<number>(performance.now());
  const lastWarningTickSecRef = useRef<number>(-1);
  const shoutCounterRef = useRef<number>(0);
  const calloutCounterRef = useRef<number>(0);
  const veilTimeoutRef = useRef<number | null>(null);
  const calloutTimeoutRef = useRef<number | null>(null);

  const triggerScreenVeil = useCallback((durationMs: number = 320) => {
    if (veilTimeoutRef.current !== null) {
      window.clearTimeout(veilTimeoutRef.current);
    }
    setScreenVeilActive(true);
    veilTimeoutRef.current = window.setTimeout(() => {
      setScreenVeilActive(false);
      veilTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const showMantraCallout = useCallback((title: string, subtitle: string) => {
    if (calloutTimeoutRef.current !== null) {
      window.clearTimeout(calloutTimeoutRef.current);
    }
    calloutCounterRef.current += 1;
    setMantraCallout({ title, subtitle, key: calloutCounterRef.current });
    calloutTimeoutRef.current = window.setTimeout(() => {
      setMantraCallout(null);
      calloutTimeoutRef.current = null;
    }, 1750);
  }, []);

  useEffect(() => {
    preloadGameAssets();
    audioManager.preloadTracks();
    if (gameStateRef.current === 'playing') {
      audioManager.startEncounterAudio();
    }
    return () => {
      if (veilTimeoutRef.current !== null) {
        window.clearTimeout(veilTimeoutRef.current);
      }
      if (calloutTimeoutRef.current !== null) {
        window.clearTimeout(calloutTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (typeof document !== 'undefined') {
      document.body.dataset.state = gameState;
    }
    if (gameState !== 'gameover') {
      audioManager.syncGameState(gameState);
    }
  }, [gameState]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    isPracticeModeRef.current = isPracticeMode;
  }, [isPracticeMode]);

  useEffect(() => {
    cameraStatusRef.current = cameraStatus;
  }, [cameraStatus]);

  useEffect(() => {
    targetComboRef.current = targetCombo;
  }, [targetCombo]);

  useEffect(() => {
    const t = window.setTimeout(() => setTantrikGhostHp(tantrikHp), 320);
    return () => clearTimeout(t);
  }, [tantrikHp]);

  useEffect(() => {
    const t = window.setTimeout(() => setDaanavGhostHp(daanavHp), 320);
    return () => clearTimeout(t);
  }, [daanavHp]);

  const initWebcamAndMediaPipe = useCallback(async () => {
    audioManager.unlockFromUserGesture();
    if (cameraStatusRef.current === 'requesting' || cameraStatusRef.current === 'ready') return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('denied');
      return;
    }

    setCameraStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      if (!recognizerRef.current) {
        recognizerRef.current = await createMediaPipeRecognizer();
      }
      setCameraStatus('ready');
    } catch {
      setCameraStatus('denied');
    }
  }, []);

  useEffect(() => {
    return () => {
      void audioManager.fadeOutAndStopAll();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (recognizerRef.current) {
        try {
          recognizerRef.current.close();
        } catch {}
        recognizerRef.current = null;
      }
    };
  }, []);

  const activateAbhayaWard = useCallback(() => {
    if (audioManager.isInitialEncounterDialoguePlaying()) return false;
    if (abhayaWardActiveRef.current || abhayaWardCooldownMsRef.current > 0) return false;

    abhayaWardActiveRef.current = true;
    abhayaWardCooldownMsRef.current = ABHAYA_WARD_COOLDOWN_MS;
    setAbhayaWardActive(true);
    setAbhayaWardCooldownSec(Math.ceil(ABHAYA_WARD_COOLDOWN_MS / 1000));
    audioManager.playSfx('stone_avalanche');
    showMantraCallout('ABHAYA RUDRAKSHA WARD!', 'NEXT DAANAV STRIKE PARRIED (-70% DMG)');
    return true;
  }, [showMantraCallout]);

  const triggerNextComboRound = useCallback((nextDaanavHp: number, nextStreak: number) => {
    const nextCombo = generateNextCombo(targetComboRef.current);
    targetComboRef.current = nextCombo;
    setTargetCombo(nextCombo);

    const baseDuration = calculateComboDurationWithGraceMs(
      nextDaanavHp,
      nextStreak,
      consecutiveDaanavAttacksRef.current,
      difficultyRef.current
    );
    const stunBonus = pendingStunBonusMsRef.current;
    pendingStunBonusMsRef.current = 0;

    const nextDuration = baseDuration + stunBonus;
    comboDurationMsRef.current = nextDuration;
    comboRemainingMsRef.current = nextDuration;
    holdMatchedMsRef.current = 0;
    lastWarningTickSecRef.current = -1;
    pendingRoundActionRef.current = 'none';

    detectedLeftRef.current = null;
    detectedRightRef.current = null;
    setActiveDetectedLeft(null);
    setActiveDetectedRight(null);

    if (timerBarRef.current) {
      timerBarRef.current.style.transform = 'scaleX(1)';
      timerBarRef.current.style.backgroundColor = '#D4AF37';
    }
    if (holdBarRef.current) {
      holdBarRef.current.style.transform = 'scaleX(0)';
      holdBarRef.current.style.opacity = '0';
    }
  }, []);

  const finishMatch = useCallback(
    (outcome: 'victory' | 'defeat', finalTantrikHp: number, finalDaanavHp: number) => {
      pendingRoundActionRef.current = 'none';
      roundCooldownMsRef.current = 0;
      setEndingTransitionOutcome(null);
      triggerScreenVeil(340);

      const elapsedSec = Math.max(
        1,
        Math.round((performance.now() - runStartTimeRef.current) / 1000)
      );

      const totalRounds = Math.max(1, spellsCastRef.current + daanavAttacksCountRef.current);
      const accuracyPct = Math.round((spellsCastRef.current / totalRounds) * 100);
      const fastestCastSec = Number.isFinite(fastestCastMsRef.current)
        ? Math.max(0.18, Number((fastestCastMsRef.current / 1000).toFixed(2)))
        : undefined;

      const ritualRank = calculateRitualRank({
        outcome,
        tantrikHpLeft: Math.max(0, finalTantrikHp),
        bestStreak: bestStreakRef.current,
        accuracyPct,
      });

      setRunSnapshot({
        outcome,
        clearTimeSec: elapsedSec,
        bestStreak: bestStreakRef.current,
        spellsCast: spellsCastRef.current,
        tantrikHpLeft: Math.max(0, finalTantrikHp),
        daanavHpLeft: Math.max(0, finalDaanavHp),
        difficulty: difficultyRef.current,
        fastestCastSec,
        accuracyPct,
        parriesCount: parriesCountRef.current,
        ritualRank,
      });

      gameStateRef.current = 'gameover';
      setGameState('gameover');

      audioManager.triggerOutcomeSequence(outcome);
    },
    [triggerScreenVeil]
  );

  const executeSpellSuccess = useCallback(
    (forceMahamudra: boolean = false) => {
      if (audioManager.isInitialEncounterDialoguePlaying()) return;
      if (roundCooldownMsRef.current > 0 || pendingRoundActionRef.current !== 'none') return;

      const elapsedCastMs = Math.max(
        180,
        comboDurationMsRef.current - comboRemainingMsRef.current
      );
      if (elapsedCastMs < fastestCastMsRef.current) {
        fastestCastMsRef.current = elapsedCastMs;
      }

      const ratio = Math.max(
        0,
        Math.min(1, comboRemainingMsRef.current / comboDurationMsRef.current)
      );
      const currentStreak = streakRef.current;
      const baseSpellDamage = calculateSpellDamage(currentStreak, ratio, difficultyRef.current);

      const synergy = evaluateMudraSynergy(targetComboRef.current);
      const isMahamudraUnleashed = forceMahamudra || pranaGaugeRef.current >= 100;

      const totalDamage =
        baseSpellDamage +
        synergy.bonusDamage +
        (isMahamudraUnleashed ? MAHAMUDRA_BONUS_DAMAGE : 0);

      const totalHeal = synergy.healHp + (isMahamudraUnleashed ? MAHAMUDRA_HEAL_HP : 0);
      const nextTantrikHp = Math.min(INITIAL_TANTRIK_HP, tantrikHpRef.current + totalHeal);

      let nextDaanavHp = Math.max(0, daanavHpRef.current - totalDamage);
      // In Sadhana Dojo (Practice Mode), refill Daanav HP to 100 when depleted so the player can practice endlessly
      if (isPracticeModeRef.current && nextDaanavHp <= 0) {
        nextDaanavHp = INITIAL_DAANAV_HP;
        phase2AnnouncedRef.current = false;
      }

      const nextStreak = currentStreak + 1;
      const nextBest = Math.max(bestStreakRef.current, nextStreak);
      const nextSpells = spellsCastRef.current + 1;

      const nextPrana = isMahamudraUnleashed
        ? 0
        : calculatePranaGain(pranaGaugeRef.current, currentStreak);

      pendingStunBonusMsRef.current =
        synergy.stunBonusMs + (isMahamudraUnleashed ? MAHAMUDRA_STUN_MS : 0);

      tantrikHpRef.current = nextTantrikHp;
      daanavHpRef.current = nextDaanavHp;
      streakRef.current = nextStreak;
      bestStreakRef.current = nextBest;
      spellsCastRef.current = nextSpells;
      pranaGaugeRef.current = nextPrana;
      consecutiveDaanavAttacksRef.current = 0;

      setTantrikHp(nextTantrikHp);
      setDaanavHp(nextDaanavHp);
      setStreak(nextStreak);
      setBestStreak(nextBest);
      setSpellsCast(nextSpells);
      setPranaGauge(nextPrana);

      if (isMahamudraUnleashed) {
        audioManager.playSfx('ritual_choir_shine');
        showMantraCallout(
          'MAHAMUDRA BANISHMENT!',
          `${totalDamage} DMG · +${totalHeal} HP · RAKSHASA STUNNED`
        );
      } else if (
        !phase2AnnouncedRef.current &&
        isDaanavPhase2Unbound(nextDaanavHp) &&
        !isPracticeModeRef.current
      ) {
        phase2AnnouncedRef.current = true;
        audioManager.playSfx('ritual_choir_shine');
        showMantraCallout(
          'RAKSHASA UNBOUND · PHASE II!',
          `${synergy.mantraTitle} (${totalDamage} DMG)`
        );
      } else {
        showMantraCallout(synergy.mantraTitle, `${synergy.effectLabel} · ${totalDamage} DMG`);
      }

      const shout = HURT_SHOUTS[shoutCounterRef.current % HURT_SHOUTS.length];
      shoutCounterRef.current += 1;
      setShoutText(shout);
      setShoutKey(shoutCounterRef.current);
      setDaanavPose('HURT');
      setBurstType('spell');
      setBurstTrigger((prev) => prev + 1);
      setSpellTrigger((prev) => prev + 1);

      if (!isPracticeModeRef.current) {
        const outcome = evaluateMatchOutcome(tantrikHpRef.current, nextDaanavHp);
        if (outcome === 'victory') {
          audioManager.triggerOutcomeSequence('victory');
          setEndingTransitionOutcome('victory');
          roundCooldownMsRef.current = OUTCOME_NARRATIVE_TRANSITION_MS;
          pendingRoundActionRef.current = 'victory';
          return;
        }
      }

      audioManager.handlePlayerMudraSuccess(nextSpells);
      roundCooldownMsRef.current = SPELL_CAST_BREATHING_MS;
      pendingRoundActionRef.current = 'next_round';
    },
    [showMantraCallout]
  );

  const executeDaanavAttack = useCallback(() => {
    if (audioManager.isInitialEncounterDialoguePlaying()) return;
    if (isPracticeModeRef.current) return;
    if (roundCooldownMsRef.current > 0 || pendingRoundActionRef.current !== 'none') return;

    const rawDmg = calculateDaanavAttackDamage(daanavHpRef.current, difficultyRef.current);
    const wasParried = abhayaWardActiveRef.current;
    const dmg = wasParried ? calculateParriedDaanavDamage(rawDmg) : rawDmg;
    const nextTantrikHp = Math.max(0, tantrikHpRef.current - dmg);

    tantrikHpRef.current = nextTantrikHp;
    daanavAttacksCountRef.current += 1;

    if (wasParried) {
      abhayaWardActiveRef.current = false;
      setAbhayaWardActive(false);
      parriesCountRef.current += 1;
      audioManager.playSfx('stone_avalanche');
      showMantraCallout(
        'ABHAYA WARD PARRY!',
        `BLOCKED ${rawDmg - dmg} DMG · STREAK PRESERVED`
      );
    } else {
      streakRef.current = 0;
      setStreak(0);
    }

    consecutiveDaanavAttacksRef.current += 1;
    setTantrikHp(nextTantrikHp);

    // Clear active hand lock states so stale poses never trigger consecutive unrestrained attacks
    detectedLeftRef.current = null;
    detectedRightRef.current = null;
    holdMatchedMsRef.current = 0;
    setActiveDetectedLeft(null);
    setActiveDetectedRight(null);

    const shout = ATTACK_SHOUTS[shoutCounterRef.current % ATTACK_SHOUTS.length];
    shoutCounterRef.current += 1;
    setShoutText(shout);
    setShoutKey(shoutCounterRef.current);
    setDaanavPose('ATTACKING');
    setBurstType('damage');
    setBurstTrigger((prev) => prev + 1);

    const outcome = evaluateMatchOutcome(nextTantrikHp, daanavHpRef.current);
    if (outcome === 'defeat') {
      audioManager.triggerOutcomeSequence('defeat');
      setEndingTransitionOutcome('defeat');
      roundCooldownMsRef.current = OUTCOME_NARRATIVE_TRANSITION_MS;
      pendingRoundActionRef.current = 'defeat';
      return;
    }

    audioManager.handleRakshasaMajorAttack();
    // Apply 2500ms base recovery (`DAANAV_ATTACK_RECOVERY_MS`) + randomized jitter delay
    // to break predictable attack patterns and give the player breathing room
    const randomizedRecoveryMs = calculateDaanavAttackRecoveryMs(difficultyRef.current);
    lastAttackRecoveryMsRef.current = randomizedRecoveryMs;
    roundCooldownMsRef.current = randomizedRecoveryMs;
    pendingRoundActionRef.current = 'next_round';
  }, [showMantraCallout]);

  const startNewFight = useCallback(
    (practice: boolean = false) => {
      triggerScreenVeil(360);

      isPracticeModeRef.current = practice;
      setIsPracticeMode(practice);

      const initialCombo: MudraCombo = { left: 'ILoveYou', right: 'Open_Palm' };
      targetComboRef.current = initialCombo;
      setTargetCombo(initialCombo);

      tantrikHpRef.current = INITIAL_TANTRIK_HP;
      daanavHpRef.current = INITIAL_DAANAV_HP;
      streakRef.current = 0;
      bestStreakRef.current = 0;
      spellsCastRef.current = 0;
      consecutiveDaanavAttacksRef.current = 0;
      pranaGaugeRef.current = 0;
      abhayaWardActiveRef.current = false;
      abhayaWardCooldownMsRef.current = 0;
      pendingStunBonusMsRef.current = 0;
      phase2AnnouncedRef.current = false;
      fastestCastMsRef.current = Infinity;
      parriesCountRef.current = 0;
      daanavAttacksCountRef.current = 0;

      setTantrikHp(INITIAL_TANTRIK_HP);
      setTantrikGhostHp(INITIAL_TANTRIK_HP);
      setDaanavHp(INITIAL_DAANAV_HP);
      setDaanavGhostHp(INITIAL_DAANAV_HP);
      setStreak(0);
      setBestStreak(0);
      setSpellsCast(0);
      setPranaGauge(0);
      setAbhayaWardActive(false);
      setAbhayaWardCooldownSec(0);
      setMantraCallout(null);
      setDaanavPose('IDLE');
      setShoutText(null);
      setRunSnapshot(null);
      setEndingTransitionOutcome(null);

      detectedLeftRef.current = null;
      detectedRightRef.current = null;
      candidateLeftMudraRef.current = null;
      candidateRightMudraRef.current = null;
      setActiveDetectedLeft(null);
      setActiveDetectedRight(null);
      setLeftHandMudra('Closed_Fist');
      setRightHandMudra('Closed_Fist');

      const startDurationMs = DIFFICULTY_CONFIGS[difficultyRef.current].baseComboDurationMs;
      comboDurationMsRef.current = startDurationMs;
      comboRemainingMsRef.current = startDurationMs;
      holdMatchedMsRef.current = 0;
      roundCooldownMsRef.current = 0;
      pendingRoundActionRef.current = 'none';
      runStartTimeRef.current = performance.now();

      if (timerBarRef.current) {
        timerBarRef.current.style.transform = 'scaleX(1)';
        timerBarRef.current.style.backgroundColor = '#D4AF37';
      }
      if (holdBarRef.current) {
        holdBarRef.current.style.transform = 'scaleX(0)';
        holdBarRef.current.style.opacity = '0';
      }

      gameStateRef.current = 'playing';
      setGameState('playing');
      audioManager.unlockFromUserGesture();
      if (practice) {
        audioManager.completeInitialEncounterDialogue();
        void audioManager.transitionToTrack('tantrik_bell', { resetPositionIfStopped: true });
        wasIntroDialoguePlayingRef.current = false;
        setIsIntroPrelude(false);
        showMantraCallout('SADHANA DOJO ACTIVE', 'INFINITE GAUGE · TEST ALL 6 MUDRAS');
      } else {
        audioManager.startEncounterAudio();
        wasIntroDialoguePlayingRef.current = audioManager.isInitialEncounterDialoguePlaying();
        setIsIntroPrelude(wasIntroDialoguePlayingRef.current);
      }
    },
    [showMantraCallout, triggerScreenVeil]
  );

  const setHandMudraSelection = useCallback((hand: 'left' | 'right', mudra: MudraId) => {
    if (audioManager.isInitialEncounterDialoguePlaying()) {
      if (hand === 'left') {
        setLeftHandMudra(mudra);
      } else {
        setRightHandMudra(mudra);
      }
      return;
    }

    if (hand === 'left') {
      detectedLeftRef.current = mudra;
      setActiveDetectedLeft(mudra);
      setLeftHandMudra(mudra);
    } else {
      detectedRightRef.current = mudra;
      setActiveDetectedRight(mudra);
      setRightHandMudra(mudra);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const state = gameStateRef.current;

      if (state === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewFight(false);
        }
        return;
      }

      if (state === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewFight(false);
        }
        return;
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (state === 'playing') {
          setGameState('paused');
        } else if (state === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsMuted((prev) => {
          const next = !prev;
          audioManager.setMuted(next);
          return next;
        });
        return;
      }

      if (e.key.toLowerCase() === 'r' && state === 'playing') {
        e.preventDefault();
        startNewFight(isPracticeModeRef.current);
        return;
      }

      if (state !== 'playing') return;

      if (audioManager.isInitialEncounterDialoguePlaying()) {
        return;
      }

      if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        activateAbhayaWard();
        return;
      }

      if (e.key.toLowerCase() === 'e' && pranaGaugeRef.current >= 100) {
        e.preventDefault();
        const combo = targetComboRef.current;
        setHandMudraSelection('left', combo.left);
        setHandMudraSelection('right', combo.right);
        executeSpellSuccess(true);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        const combo = targetComboRef.current;
        setHandMudraSelection('left', combo.left);
        setHandMudraSelection('right', combo.right);
        return;
      }

      const mapped = mapKeyToHandMudra(e.key);
      if (mapped) {
        e.preventDefault();
        setHandMudraSelection(mapped.hand, mapped.mudra);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activateAbhayaWard, executeSpellSuccess, setHandMudraSelection, startNewFight]);

  // High-Frequency Simulation, 30Hz MediaPipe Vision with Confidence Filtering & Round State Machine
  useEffect(() => {
    let timerId = 0;
    let cancelled = false;
    let lastTime = performance.now();
    let lastVisionTime = 0;
    let lastVisionVideoTime = -1;

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const rawDtMs = now - lastTime;
      lastTime = now;
      const dtMs = Math.min(rawDtMs, 50);

      // Update Abhaya Ward cooldown timer
      if (abhayaWardCooldownMsRef.current > 0) {
        const prevSec = Math.ceil(abhayaWardCooldownMsRef.current / 1000);
        abhayaWardCooldownMsRef.current = Math.max(0, abhayaWardCooldownMsRef.current - dtMs);
        const nextSec = Math.ceil(abhayaWardCooldownMsRef.current / 1000);
        if (nextSec !== prevSec) {
          setAbhayaWardCooldownSec(nextSec);
        }
      }

      const isIntroDialogueActive = audioManager.isInitialEncounterDialoguePlaying();
      if (isIntroDialogueActive !== wasIntroDialoguePlayingRef.current) {
        wasIntroDialoguePlayingRef.current = isIntroDialogueActive;
        setIsIntroPrelude(isIntroDialogueActive);
        if (!isIntroDialogueActive) {
          setActiveIntroVoice(null);
          holdMatchedMsRef.current = 0;
          comboRemainingMsRef.current = comboDurationMsRef.current;
        }
      } else if (isIntroDialogueActive) {
        const snap = audioManager.getSnapshot();
        setActiveIntroVoice((prev) => (prev !== snap.activeVoice ? snap.activeVoice : prev));
      }

      // 1. High-Frequency ~30Hz MediaPipe 2-Hand Recognition with Hand-Confidence & Stability Check
      const video = videoRef.current;
      const recognizer = recognizerRef.current;
      if (
        video &&
        recognizer &&
        video.readyState >= 2 &&
        now - lastVisionTime >= 33 &&
        video.currentTime !== lastVisionVideoTime
      ) {
        lastVisionTime = now;
        lastVisionVideoTime = video.currentTime;
        try {
          const mpResult = recognizer.recognizeForVideo(video, now);
          const hands = extractBothHandsFromResult(mpResult, HAND_CONFIDENCE_THRESHOLD);

          const resolvedLeftMudra =
            hands.left && hands.leftConfidence >= HAND_CONFIDENCE_THRESHOLD ? hands.left : null;
          const resolvedRightMudra =
            hands.right && hands.rightConfidence >= HAND_CONFIDENCE_THRESHOLD ? hands.right : null;

          if (resolvedLeftMudra) {
            if (resolvedLeftMudra === candidateLeftMudraRef.current) {
              if (resolvedLeftMudra !== detectedLeftRef.current) {
                setLeftHandMudra(resolvedLeftMudra);
                if (!isIntroDialogueActive) {
                  detectedLeftRef.current = resolvedLeftMudra;
                  setActiveDetectedLeft(resolvedLeftMudra);
                }
              }
            } else {
              candidateLeftMudraRef.current = resolvedLeftMudra;
            }
          }

          if (resolvedRightMudra) {
            if (resolvedRightMudra === candidateRightMudraRef.current) {
              if (resolvedRightMudra !== detectedRightRef.current) {
                setRightHandMudra(resolvedRightMudra);
                if (!isIntroDialogueActive) {
                  detectedRightRef.current = resolvedRightMudra;
                  setActiveDetectedRight(resolvedRightMudra);
                }
              }
            } else {
              candidateRightMudraRef.current = resolvedRightMudra;
            }
          }
        } catch {}
      }

      // 2. Deterministic Combat & Cooldown Resolution
      if (gameStateRef.current === 'playing') {
        if (roundCooldownMsRef.current > 0) {
          roundCooldownMsRef.current = Math.max(0, roundCooldownMsRef.current - dtMs);
          if (roundCooldownMsRef.current === 0) {
            const action = pendingRoundActionRef.current;
            pendingRoundActionRef.current = 'none';
            if (action === 'victory') {
              finishMatch('victory', tantrikHpRef.current, 0);
            } else if (action === 'defeat') {
              finishMatch('defeat', 0, daanavHpRef.current);
            } else if (action === 'next_round') {
              setDaanavPose('IDLE');
              triggerNextComboRound(daanavHpRef.current, streakRef.current);
            }
          }
        } else if (isIntroDialogueActive) {
          holdMatchedMsRef.current = 0;
          if (timerBarRef.current) {
            timerBarRef.current.style.transform = 'scaleX(1)';
            timerBarRef.current.style.backgroundColor = '#D4AF37';
          }
          if (holdBarRef.current) {
            holdBarRef.current.style.transform = 'scaleX(0)';
            holdBarRef.current.style.opacity = '0';
          }
        } else {
          // In Sadhana Dojo (Practice Mode), keep timer bar full so player can practice freely
          if (!isPracticeModeRef.current) {
            comboRemainingMsRef.current = Math.max(0, comboRemainingMsRef.current - dtMs);
          } else {
            comboRemainingMsRef.current = comboDurationMsRef.current;
          }

          const ratio =
            comboDurationMsRef.current > 0
              ? comboRemainingMsRef.current / comboDurationMsRef.current
              : 0;

          if (timerBarRef.current) {
            timerBarRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
            timerBarRef.current.style.backgroundColor = isPracticeModeRef.current
              ? '#34D399'
              : ratio < 0.28
              ? '#EF4444'
              : ratio < 0.52
              ? '#F59E0B'
              : '#D4AF37';
          }

          if (comboRemainingMsRef.current > 0 && comboRemainingMsRef.current < 900) {
            const tenthSec = Math.floor(comboRemainingMsRef.current / 220);
            if (tenthSec !== lastWarningTickSecRef.current) {
              lastWarningTickSecRef.current = tenthSec;
            }
          }

          const target = targetComboRef.current;
          const detL = detectedLeftRef.current;
          const detR = detectedRightRef.current;

          // Automatic Abhaya Ward trigger if player raises both Open Palms during imminent danger (< 30% timer)
          if (
            !isPracticeModeRef.current &&
            ratio < 0.3 &&
            detL === 'Open_Palm' &&
            detR === 'Open_Palm' &&
            !(target.left === 'Open_Palm' && target.right === 'Open_Palm') &&
            !abhayaWardActiveRef.current &&
            abhayaWardCooldownMsRef.current <= 0
          ) {
            activateAbhayaWard();
          }

          if (isComboMatched(target, detL, detR)) {
            holdMatchedMsRef.current += dtMs;

            if (holdBarRef.current) {
              const holdRatio = Math.min(1, holdMatchedMsRef.current / HOLD_DEBOUNCE_MS);
              holdBarRef.current.style.transform = `scaleX(${holdRatio})`;
              holdBarRef.current.style.opacity = '1';
            }

            if (holdMatchedMsRef.current >= HOLD_DEBOUNCE_MS) {
              holdMatchedMsRef.current = 0;
              if (holdBarRef.current) {
                holdBarRef.current.style.transform = 'scaleX(0)';
                holdBarRef.current.style.opacity = '0';
              }
              executeSpellSuccess(false);
            }
          } else {
            holdMatchedMsRef.current = Math.max(0, holdMatchedMsRef.current - dtMs * 1.4);
            if (holdBarRef.current) {
              const holdRatio = Math.min(1, holdMatchedMsRef.current / HOLD_DEBOUNCE_MS);
              holdBarRef.current.style.transform = `scaleX(${holdRatio})`;
              holdBarRef.current.style.opacity = holdRatio > 0.05 ? '1' : '0';
            }
          }

          if (
            !isPracticeModeRef.current &&
            comboRemainingMsRef.current <= 0 &&
            roundCooldownMsRef.current <= 0
          ) {
            executeDaanavAttack();
          }
        }
      }

      timerId = window.setTimeout(tick, 16);
    };

    timerId = window.setTimeout(tick, 16);
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [
    activateAbhayaWard,
    executeDaanavAttack,
    executeSpellSuccess,
    finishMatch,
    triggerNextComboRound,
  ]);

  const leftMatched = !isIntroPrelude && activeDetectedLeft === targetCombo.left;
  const rightMatched = !isIntroPrelude && activeDetectedRight === targetCombo.right;
  const isPhase2Unbound = isDaanavPhase2Unbound(daanavHp);
  const isLowHp = tantrikHp > 0 && tantrikHp <= 35 && !isPracticeMode;
  const activeSynergy = evaluateMudraSynergy(targetCombo);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#050807] select-none">
      {/* Smooth Ceremonial Screen Veil Transition Overlay */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-50 pointer-events-none bg-[#040706] transition-opacity duration-350 ${
          screenVeilActive ? 'opacity-85' : 'opacity-0'
        }`}
      />

      {/* Low-HP Heartbeat Crimson Vignette */}
      {isLowHp && (
        <div
          aria-hidden="true"
          data-testid="low-hp-vignette"
          className="fixed inset-0 z-18 pointer-events-none animate-pulse"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 52%, rgba(185, 28, 28, 0.42) 85%, rgba(127, 29, 29, 0.72) 100%)',
          }}
        />
      )}

      {/* Third Eye Mirrored Webcam Picture-in-Picture (PiP) Frame */}
      <div
        data-testid="third-eye-pip"
        className={`fixed bottom-4 right-4 z-30 rounded-lg border-2 border-[#D4AF37] bg-[#070B09]/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.95)] transition-opacity duration-200 pointer-events-none ${
          cameraStatus === 'ready' && showWebcamPip && gameState === 'playing'
            ? 'opacity-95'
            : 'opacity-0 w-1 h-1 -z-10 overflow-hidden'
        }`}
      >
        <div className="flex items-center justify-between text-[9px] font-display uppercase tracking-widest text-[#FDE68A] px-1 mb-1">
          <span>Third Eye Mirror</span>
          <span className="text-[#34D399]">2-Hand Lock</span>
        </div>
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-36 h-27 rounded border border-[#5E4923] bg-black object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <div className="flex items-center justify-between text-[9px] font-mono-tabular px-1 mt-1">
          <span className={leftMatched ? 'text-[#FBBF24] font-bold' : 'text-[#A89882]'}>
            L: {activeDetectedLeft ? MUDRA_BY_ID[activeDetectedLeft].emoji : '—'}
          </span>
          <span className={rightMatched ? 'text-[#FBBF24] font-bold' : 'text-[#A89882]'}>
            R: {activeDetectedRight ? MUDRA_BY_ID[activeDetectedRight].emoji : '—'}
          </span>
        </div>
      </div>

      {/* 1. Photorealistic Subterranean Temple Cave, Torchlight, Temple Dust/Fireflies & Dynamic Depth Fog */}
      <CavernBackdrop
        daanavPose={daanavPose}
        burstTrigger={burstTrigger}
        burstType={burstType}
        isPhase2Unbound={isPhase2Unbound}
        daanavHp={daanavHp}
      />

      {/* 1b. Foreground Magical Energy Burst & Daanav-Hurt Blood-Mist/Smoke Particle System */}
      <SpellCastOverlay
        spellTrigger={spellTrigger}
        streak={streak}
        daanavPose={daanavPose}
      />

      {/* 2. Carved Temple Stone & Antique Gold HUD Chrome */}
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 md:px-10 md:py-6">
        {/* ==================== TOP HUD ROW: CARVED TEMPLE STONE HEALTH BARS ==================== */}
        <div className="w-full flex items-start justify-between gap-4">
          {/* Top-Left: TANTRIK Carved Stone Health Plinth + Prana Gauge + Abhaya Ward */}
          <div className="flex flex-col gap-1.5">
            <div className="w-62 sm:w-78 md:w-86 rounded bg-[#090E0C]/90 border-2 border-[#8C6D32] px-3.5 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.9)]">
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rotate-45 bg-[#D4AF37]" />
                  <span
                    className="font-display font-bold text-sm md:text-base tracking-widest text-[#FDE68A]"
                    style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
                  >
                    TANTRIK
                  </span>
                  <span
                    className="font-mono-tabular text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#151F1C] border border-[#5E4923] text-[#D4AF37]"
                    data-testid="hud-difficulty-badge"
                  >
                    {isPracticeMode ? 'DOJO' : DIFFICULTY_CONFIGS[difficulty].label}
                  </span>
                </div>
                <span className="font-mono-tabular text-xs font-bold text-[#E5D5BE]">
                  {Math.round(tantrikHp)} HP
                  {streak > 1 ? ` · ${streak}x STREAK` : ''}
                </span>
              </div>
              <div
                className="relative h-3.5 md:h-4 w-full rounded-xs bg-[#050706] border border-[#6E5425] p-0.5 shadow-inner overflow-hidden mb-1.5"
                data-testid="tantrik-hp-bar"
              >
                <div
                  className="absolute inset-y-0.5 left-0.5 bg-[#78350F] transition-all duration-300"
                  style={{ width: `calc(${Math.max(0, Math.min(100, tantrikGhostHp))}% - 4px)` }}
                />
                <div
                  className="relative h-full transition-all duration-150"
                  style={{
                    width: `${Math.max(0, Math.min(100, tantrikHp))}%`,
                    background: 'linear-gradient(90deg, #B45309 0%, #D97706 45%, #FBBF24 100%)',
                  }}
                />
              </div>

              {/* Tantrik Prana / Mahamudra Ultimate Meter */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[10px] uppercase tracking-wider text-[#A89882] whitespace-nowrap">
                  Prana Seal
                </span>
                <div
                  className="relative flex-1 h-2 rounded-xs bg-[#050706] border border-[#4A3B22] overflow-hidden"
                  data-testid="tantrik-prana-bar"
                >
                  <div
                    className="h-full transition-all duration-200"
                    style={{
                      width: `${Math.max(0, Math.min(100, pranaGauge))}%`,
                      background:
                        pranaGauge >= 100
                          ? 'linear-gradient(90deg, #10B981 0%, #FBBF24 50%, #FEF08A 100%)'
                          : 'linear-gradient(90deg, #047857 0%, #10B981 60%, #34D399 100%)',
                    }}
                  />
                </div>
                <span className="font-mono-tabular text-[10px] font-bold text-[#34D399] min-w-[30px] text-right">
                  {Math.round(pranaGauge)}%
                </span>
              </div>
            </div>

            {/* Interactive Abhaya Ward & Mahamudra Action Bar */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                data-testid="abhaya-ward-btn"
                disabled={isIntroPrelude || abhayaWardActive || abhayaWardCooldownSec > 0}
                onClick={(e) => {
                  e.currentTarget.blur();
                  activateAbhayaWard();
                }}
                className={`px-2.5 py-1 rounded border font-display font-bold text-[10px] tracking-wider uppercase flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  abhayaWardActive
                    ? 'bg-[#1E3A8A]/85 border-[#60A5FA] text-[#DBEAFE] shadow-[0_0_12px_rgba(96,165,250,0.5)]'
                    : abhayaWardCooldownSec > 0 || isIntroPrelude
                    ? 'bg-[#090E0C]/80 border-[#3E301B] text-[#8C7A65] cursor-not-allowed'
                    : 'bg-[#0D1614]/90 hover:bg-[#162621] border-[#8C6D32] text-[#E5D5BE] cursor-pointer'
                }`}
                title="Raise Abhaya Rudraksha Ward to block 70% of the next Daanav strike [W] or dual Open Palms"
              >
                <Shield className="w-3 h-3 text-[#60A5FA]" />
                {abhayaWardActive
                  ? 'Abhaya Ward Active'
                  : abhayaWardCooldownSec > 0
                  ? `Ward (${abhayaWardCooldownSec}s)`
                  : 'Abhaya Ward [W]'}
              </button>

              {pranaGauge >= 100 && (
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="mahamudra-btn"
                  disabled={isIntroPrelude}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (audioManager.isInitialEncounterDialoguePlaying()) return;
                    const combo = targetComboRef.current;
                    setHandMudraSelection('left', combo.left);
                    setHandMudraSelection('right', combo.right);
                    executeSpellSuccess(true);
                  }}
                  className="px-2.5 py-1 rounded border-2 border-[#FBBF24] bg-[#78350F]/90 hover:bg-[#92400E] text-[#FEF08A] font-display font-bold text-[10px] tracking-wider uppercase flex items-center gap-1 shadow-[0_0_16px_rgba(251,191,36,0.55)] cursor-pointer animate-pulse whitespace-nowrap"
                  title="Unleash Mahamudra Banishment Beam [E]"
                >
                  <Zap className="w-3 h-3 text-[#FBBF24]" />
                  Mahamudra Ready [E]
                </button>
              )}

              {isPracticeMode && (
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="exit-practice-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    startNewFight(false);
                  }}
                  className="px-2.5 py-1 rounded border border-[#D4AF37] bg-[#991B1B]/90 hover:bg-[#B91C1C] text-[#FEF2F2] font-display font-bold text-[10px] tracking-wider uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Exit Sadhana Dojo and start the real boss encounter"
                >
                  <Play className="w-2.5 h-2.5 fill-current text-[#FBBF24]" />
                  Start Real Battle
                </button>
              )}
            </div>
          </div>

          {/* Top-Right: DAANAV Carved Stone Health Plinth + Phase 2 Badge + Temple Utility Controls */}
          <div className="flex flex-col items-end gap-2">
            <div
              className={`w-60 sm:w-76 md:w-84 rounded bg-[#090E0C]/90 border-2 px-3.5 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.9)] transition-colors ${
                isPhase2Unbound ? 'border-[#EF4444]' : 'border-[#7F1D1D]'
              }`}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rotate-45 bg-[#EF4444]" />
                  <span
                    className="font-display font-bold text-sm md:text-base tracking-widest text-[#FCA5A5]"
                    style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
                  >
                    DAANAV
                  </span>
                  {isPhase2Unbound && (
                    <span
                      data-testid="daanav-phase2-badge"
                      className="font-display font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#7F1D1D] border border-[#FCA5A5] text-[#FEF2F2] flex items-center gap-1"
                    >
                      <Flame className="w-2.5 h-2.5 text-[#FBBF24]" />
                      UNBOUND
                    </span>
                  )}
                </div>
                <span className="font-mono-tabular text-xs font-bold text-[#FECACA]">
                  {Math.round(daanavHp)} HP
                </span>
              </div>
              <div
                className="relative h-3.5 md:h-4 w-full rounded-xs bg-[#050706] border border-[#5C1919] p-0.5 shadow-inner overflow-hidden"
                data-testid="daanav-hp-bar"
              >
                <div
                  className="absolute inset-y-0.5 left-0.5 bg-[#FBBF24]/50 transition-all duration-300"
                  style={{ width: `calc(${Math.max(0, Math.min(100, daanavGhostHp))}% - 4px)` }}
                />
                <div
                  className="relative h-full transition-all duration-150"
                  style={{
                    width: `${Math.max(0, Math.min(100, daanavHp))}%`,
                    background: isPhase2Unbound
                      ? 'linear-gradient(90deg, #991B1B 0%, #DC2626 45%, #F59E0B 100%)'
                      : 'linear-gradient(90deg, #7F1D1D 0%, #B91C1C 50%, #EF4444 100%)',
                  }}
                />
              </div>
            </div>

            {/* Compact Square Carved Stone Utility Buttons */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                data-testid="toggle-practice-hud-btn"
                aria-label={isPracticeMode ? 'Exit practice mode' : 'Enter Sadhana Dojo practice mode'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  startNewFight(!isPracticeMode);
                }}
                className={`w-8 h-8 rounded border flex items-center justify-center cursor-pointer transition-colors shadow-md ${
                  isPracticeMode
                    ? 'bg-[#14332B] border-[#34D399] text-[#34D399]'
                    : 'bg-[#0B110F]/90 hover:bg-[#17221E] border-[#785C2A] text-[#D6C7B2]'
                }`}
                title={isPracticeMode ? 'Exit Sadhana Dojo (Start Real Battle)' : 'Sadhana Dojo (Practice Mode)'}
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={
                  cameraStatus === 'ready'
                    ? showWebcamPip
                      ? 'Hide webcam preview'
                      : 'Show webcam preview'
                    : 'Enable webcam'
                }
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (cameraStatus !== 'ready') {
                    initWebcamAndMediaPipe();
                  } else {
                    setShowWebcamPip((prev) => !prev);
                  }
                }}
                className="w-8 h-8 rounded bg-[#0B110F]/90 hover:bg-[#17221E] border border-[#785C2A] flex items-center justify-center text-[#D6C7B2] cursor-pointer transition-colors shadow-md"
                title="Toggle Third Eye Webcam Mirror"
              >
                {cameraStatus === 'ready' && showWebcamPip ? (
                  <Camera className="w-4 h-4 text-[#D4AF37]" />
                ) : (
                  <CameraOff className="w-4 h-4 text-[#8C7A65]" />
                )}
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setIsMuted((prev) => {
                    const next = !prev;
                    audioManager.setMuted(next);
                    return next;
                  });
                }}
                className="w-8 h-8 rounded bg-[#0B110F]/90 hover:bg-[#17221E] border border-[#785C2A] flex items-center justify-center text-[#D6C7B2] cursor-pointer transition-colors shadow-md"
                title="Mute / Unmute [M]"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-[#EF4444]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#D4AF37]" />
                )}
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause game"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (gameState === 'playing') {
                    setGameState('paused');
                  } else if (gameState === 'paused') {
                    setGameState('playing');
                  }
                }}
                className="w-8 h-8 rounded bg-[#0B110F]/90 hover:bg-[#17221E] border border-[#785C2A] flex items-center justify-center text-[#D6C7B2] cursor-pointer transition-colors shadow-md"
                title="Pause [P]"
              >
                <Pause className="w-4 h-4 text-[#D4AF37]" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart fight"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startNewFight(isPracticeMode);
                }}
                className="w-8 h-8 rounded bg-[#0B110F]/90 hover:bg-[#17221E] border border-[#785C2A] flex items-center justify-center text-[#D6C7B2] cursor-pointer transition-colors shadow-md"
                title="Restart Fight [R]"
              >
                <RotateCcw className="w-4 h-4 text-[#D4AF37]" />
              </button>
            </div>
          </div>
        </div>

        {/* ==================== CENTER ARENA: PHOTOREALISTIC DAANAV BOSS ==================== */}
        <div className="flex-1 flex items-center justify-center -mt-4">
          <DaanavBoss
            pose={daanavPose}
            shoutText={shoutText}
            shoutKey={shoutKey}
            hp={daanavHp}
          />
        </div>

        {/* ==================== BOTTOM HUD: CARVED TEMPLE MUDRA SHRINE & TIMER ==================== */}
        <div className="relative z-30 flex flex-col items-center justify-end pb-1">
          {/* Floating Sanskrit Mantra Callout Banner */}
          {mantraCallout && !isIntroPrelude && !endingTransitionOutcome && (
            <div
              key={mantraCallout.key}
              data-testid="mantra-callout-banner"
              className="mb-2 px-4 py-1.5 rounded bg-[#090E0C]/95 border border-[#FBBF24] shadow-[0_6px_22px_rgba(251,191,36,0.35)] text-center animate-fade-in"
            >
              <div className="font-display font-bold text-xs tracking-widest uppercase text-[#FDE68A]">
                {mantraCallout.title}
              </div>
              <div className="font-mono-tabular text-[10px] text-[#34D399]">
                {mantraCallout.subtitle}
              </div>
            </div>
          )}

          {/* Narrative Dialogue Transition Banner (Before Battle Starts & At Battle End) */}
          {gameState === 'playing' && isIntroPrelude && (
            <div
              data-testid="narrative-prelude-banner"
              className="mb-2.5 px-5 py-2 rounded bg-[#090E0C]/95 border border-[#D4AF37] shadow-[0_8px_24px_rgba(0,0,0,0.95)] flex items-center gap-3 transition-all duration-300"
            >
              <Sparkles className="w-4 h-4 text-[#FBBF24] shrink-0" />
              <div className="text-center sm:text-left">
                <div className="font-display font-bold text-[11px] tracking-widest uppercase text-[#FBBF24]">
                  {activeIntroVoice === 'tantrik_1st_dialogue'
                    ? 'TANTRIK INVOCATION · PREPARING MUDRA SEAL'
                    : 'RAKSHASA AWAKENS · SANCTUM STANDOFF'}
                </div>
                <div className="text-xs text-[#E5D5BE]">
                  {activeIntroVoice === 'tantrik_1st_dialogue'
                    ? '“I have come to end your reign of terror!” — Ready your hands for combat.'
                    : '“Another soul comes willingly into my grasp...” — Combat begins after the invocation.'}
                </div>
              </div>
            </div>
          )}

          {gameState === 'playing' && endingTransitionOutcome && (
            <div
              data-testid="narrative-outro-banner"
              className="mb-2.5 px-5 py-2 rounded bg-[#090E0C]/95 border border-[#D4AF37] shadow-[0_8px_24px_rgba(0,0,0,0.95)] flex items-center gap-3 transition-all duration-300"
            >
              <Sparkles className="w-4 h-4 text-[#FBBF24] shrink-0" />
              <div className="text-center">
                <div className="font-display font-bold text-xs tracking-widest uppercase text-[#FBBF24]">
                  {endingTransitionOutcome === 'victory'
                    ? 'THE RAKSHASA CRUMBLES · SEALING THE SANCTUM'
                    : 'THE SANCTUM FALLS · DARKNESS CONSUMES THE RITE'}
                </div>
              </div>
            </div>
          )}

          {/* Carved Temple Stone Mudra Shrine Box with Per-Hand Lock-In Charge Rings */}
          <div
            className={`pointer-events-auto flex items-center gap-3.5 mb-2 px-5 py-2 rounded bg-[#090E0C]/92 border-2 border-[#8C6D32] shadow-[0_12px_30px_rgba(0,0,0,0.95)] transition-opacity duration-300 ${
              isIntroPrelude ? 'opacity-75' : 'opacity-100'
            }`}
            data-testid="mudra-prompt"
            data-left-target={targetCombo.left}
            data-right-target={targetCombo.right}
          >
            <button
              type="button"
              tabIndex={-1}
              data-testid="target-left-mudra"
              data-mudra={targetCombo.left}
              data-locked={leftMatched ? 'true' : 'false'}
              onClick={(e) => {
                e.currentTarget.blur();
                setHandMudraSelection('left', targetCombo.left);
              }}
              className={`relative flex flex-col items-center justify-center min-w-[92px] h-15 px-2.5 rounded border transition-transform duration-150 cursor-pointer ${
                leftMatched
                  ? 'scale-105 bg-amber-500/20 border-[#FBBF24] shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                  : 'bg-[#101815] border-[#4A3B22] hover:border-[#8C6D32]'
              }`}
              title={`Left Hand Target: ${MUDRA_BY_ID[targetCombo.left].englishName} (Key ${MUDRA_BY_ID[targetCombo.left].leftKey})`}
            >
              {leftMatched && (
                <span
                  data-testid="left-lock-ring"
                  className="absolute top-0.5 right-1 flex items-center gap-0.5 text-[8px] font-display font-bold uppercase text-[#FBBF24]"
                >
                  <Check className="w-3 h-3" />
                </span>
              )}
              <span className="text-3xl leading-none" role="img" aria-label="Left Hand Target Mudra">
                {MUDRA_BY_ID[targetCombo.left].emoji}
              </span>
              <span className="font-display text-[9px] tracking-wider uppercase text-[#D4AF37] mt-1 whitespace-nowrap">
                {MUDRA_BY_ID[targetCombo.left].englishName} [{MUDRA_BY_ID[targetCombo.left].leftKey}]
              </span>
            </button>

            <div className="flex flex-col items-center justify-center select-none px-1">
              <span className="text-[#D4AF37] text-lg font-display leading-none">❖</span>
              <span
                data-testid="active-synergy-tag"
                className="font-mono-tabular text-[9px] uppercase tracking-wider text-[#A89882] mt-0.5 whitespace-nowrap"
              >
                {activeSynergy.type === 'agni'
                  ? 'Agni +5'
                  : activeSynergy.type === 'prana'
                  ? 'Prana +6HP'
                  : 'Vajra Stun'}
              </span>
            </div>

            <button
              type="button"
              tabIndex={-1}
              data-testid="target-right-mudra"
              data-mudra={targetCombo.right}
              data-locked={rightMatched ? 'true' : 'false'}
              onClick={(e) => {
                e.currentTarget.blur();
                setHandMudraSelection('right', targetCombo.right);
              }}
              className={`relative flex flex-col items-center justify-center min-w-[92px] h-15 px-2.5 rounded border transition-transform duration-150 cursor-pointer ${
                rightMatched
                  ? 'scale-105 bg-amber-500/20 border-[#FBBF24] shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                  : 'bg-[#101815] border-[#4A3B22] hover:border-[#8C6D32]'
              }`}
              title={`Right Hand Target: ${MUDRA_BY_ID[targetCombo.right].englishName} (Key ${MUDRA_BY_ID[targetCombo.right].rightKey})`}
            >
              {rightMatched && (
                <span
                  data-testid="right-lock-ring"
                  className="absolute top-0.5 right-1 flex items-center gap-0.5 text-[8px] font-display font-bold uppercase text-[#FBBF24]"
                >
                  <Check className="w-3 h-3" />
                </span>
              )}
              <span className="text-3xl leading-none" role="img" aria-label="Right Hand Target Mudra">
                {MUDRA_BY_ID[targetCombo.right].emoji}
              </span>
              <span className="font-display text-[9px] tracking-wider uppercase text-[#D4AF37] mt-1 whitespace-nowrap">
                {MUDRA_BY_ID[targetCombo.right].englishName} [{MUDRA_BY_ID[targetCombo.right].rightKey}]
              </span>
            </button>
          </div>

          {/* Carved Stone Ritual Countdown Bar */}
          <div className="w-68 sm:w-76 h-3 rounded-xs bg-[#070B09] border-2 border-[#785C2A] p-0.5 overflow-hidden shadow-lg mb-1.5">
            <div
              ref={timerBarRef}
              className="h-full w-full origin-left bg-[#D4AF37] will-change-transform"
              style={{ transform: 'scaleX(1)' }}
            />
          </div>

          {/* Hold Lock Debounce Progress Bar (220ms) */}
          <div className="w-44 h-1 rounded-full bg-transparent overflow-hidden mb-1.5">
            <div
              ref={holdBarRef}
              className="h-full w-full origin-center bg-[#FBBF24] opacity-0 will-change-transform"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>

          {/* Interactive Mudra Quick-Cast Strip (Keyboard & Mouse Fallback Controls) */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 bg-[#080C0B]/92 border border-[#5E4923] rounded px-3 py-1.5 text-[11px] shadow-xl">
            <div className="flex items-center gap-1">
              <span className="text-[#B5A388] font-mono-tabular mr-1">L:</span>
              {MUDRAS.map((m) => (
                <button
                  key={`left-${m.id}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Left Hand ${m.englishName}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setHandMudraSelection('left', m.id);
                  }}
                  className={`px-1.5 py-0.5 rounded border text-xs flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                    !isIntroPrelude && activeDetectedLeft === m.id
                      ? 'bg-[#7F1D1D] border-[#FBBF24] text-white'
                      : 'bg-[#111916] border-[#3E301B] text-[#C7B69E] hover:border-[#8C6D32]'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span className="font-mono-tabular text-[10px] text-[#D4AF37]">{m.leftKey}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Cast Matched Mudra Combo"
              disabled={isIntroPrelude}
              onClick={(e) => {
                e.currentTarget.blur();
                if (audioManager.isInitialEncounterDialoguePlaying()) return;
                const combo = targetComboRef.current;
                setHandMudraSelection('left', combo.left);
                setHandMudraSelection('right', combo.right);
              }}
              className={`px-3 py-1 rounded border font-display font-bold text-[11px] tracking-wider uppercase whitespace-nowrap transition-opacity ${
                isIntroPrelude
                  ? 'bg-[#451A1A] border-[#785C2A]/60 text-[#D6C7B2]/60 cursor-not-allowed'
                  : 'bg-[#991B1B] hover:bg-[#B91C1C] border-[#D4AF37] text-[#FEF2F2] cursor-pointer'
              }`}
              title={
                isIntroPrelude
                  ? 'Await the opening invocation before casting Mudras'
                  : 'Match both hands to current combo [Space]'
              }
            >
              {isIntroPrelude ? 'Invocation...' : 'Cast [Space]'}
            </button>

            <div className="flex items-center gap-1">
              <span className="text-[#B5A388] font-mono-tabular mr-1">R:</span>
              {MUDRAS.map((m) => (
                <button
                  key={`right-${m.id}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Right Hand ${m.englishName}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setHandMudraSelection('right', m.id);
                  }}
                  className={`px-1.5 py-0.5 rounded border text-xs flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                    !isIntroPrelude && activeDetectedRight === m.id
                      ? 'bg-[#7F1D1D] border-[#FBBF24] text-white'
                      : 'bg-[#111916] border-[#3E301B] text-[#C7B69E] hover:border-[#8C6D32]'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span className="font-mono-tabular text-[10px] text-[#D4AF37]">{m.rightKey}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Photorealistic First-Person Tantrik Hands anchored flush to the bottom border */}
      <div className="fixed inset-x-0 bottom-0 z-15 pointer-events-none flex items-end justify-between px-0">
        {/* Left Tantrik Hand */}
        <div
          className="w-[240px] h-[315px] sm:w-[310px] sm:h-[405px] md:w-[380px] md:h-[495px] -mb-2 animate-hand-left"
          data-testid="left-tantrik-hand"
          data-mudra={leftHandMudra}
        >
          <TantrikHandSvg
            side="left"
            handedness="left"
            mudra={leftHandMudra}
            isMatched={leftMatched}
            isActiveInput={!isIntroPrelude && activeDetectedLeft !== null}
          />
        </div>

        {/* Right Tantrik Hand */}
        <div
          className="w-[240px] h-[315px] sm:w-[310px] sm:h-[405px] md:w-[380px] md:h-[495px] -mb-2 animate-hand-right"
          data-testid="right-tantrik-hand"
          data-mudra={rightHandMudra}
        >
          <TantrikHandSvg
            side="right"
            handedness="right"
            mudra={rightHandMudra}
            isMatched={rightMatched}
            isActiveInput={!isIntroPrelude && activeDetectedRight !== null}
          />
        </div>
      </div>

      {/* 4. Carved Temple Stone Game State Modals */}
      <GameModals
        gameState={gameState}
        cameraStatus={cameraStatus}
        difficulty={difficulty}
        onSelectDifficulty={setDifficulty}
        onStartGame={() => startNewFight(false)}
        onStartPractice={() => startNewFight(true)}
        onResumeGame={() => {
          setGameState('playing');
        }}
        onRestartGame={() => startNewFight(false)}
        onReturnToTitle={() => {
          triggerScreenVeil(320);
          setEndingTransitionOutcome(null);
          setGameState('title');
        }}
        onRequestCamera={initWebcamAndMediaPipe}
        runSnapshot={runSnapshot}
      />
    </main>
  );
}
