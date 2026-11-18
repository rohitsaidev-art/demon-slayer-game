import {
  MUSIC_TRACK_URLS,
  MusicTrackId,
  SFX_CLIP_URLS,
  SfxClipId,
  STINGER_TRACK_URLS,
  StingerTrackId,
  VOICE_CLIP_URLS,
  VoiceClipId,
} from './assets';
import { GameState } from './rules';

export interface AudioElementLike {
  src: string;
  volume: number;
  currentTime: number;
  playbackRate?: number;
  paused: boolean;
  loop: boolean;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface AudioManagerOptions {
  createAudio?: (url: string) => AudioElementLike;
  fadeStepMs?: number;
  fadeOutDurationMs?: number;
  fadeInDurationMs?: number;
  pauseFadeDurationMs?: number;
  duckFadeDurationMs?: number;
  stingerFadeInDurationMs?: number;
  loopBreathDelayMs?: number;
  dialogueBreathingGapMs?: number;
  voicePlaybackRate?: number;
  duckingRatio?: number;
  enableWebAudioReverb?: boolean;
}

export interface AudioTrackSnapshot {
  id: string;
  url: string;
  paused: boolean;
  currentTime: number;
  volume: number;
}

export interface AudioManagerSnapshot {
  unlocked: boolean;
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
  dialogueVolume: number;
  voicePlaybackRate: number;
  isMusicDucked: boolean;
  currentGameState: GameState;
  activeTrack: MusicTrackId | null;
  activeVoice: VoiceClipId | null;
  queuedVoices: VoiceClipId[];
  activeStinger: StingerTrackId | null;
  stingerPlayCounts: Record<StingerTrackId, number>;
  activeSfx: SfxClipId[];
  sfxPlayCounts: Record<SfxClipId, number>;
  sfxHistory: SfxClipId[];
  firstMudraAngryPlayed: boolean;
  introSequenceCompleted: boolean;
  outcomeTriggered: 'victory' | 'defeat' | null;
  isTransitioning: boolean;
  simultaneousPlaying: boolean;
  simultaneousDialoguePlaying: boolean;
  voiceHistory: VoiceClipId[];
  tracks: Record<MusicTrackId, AudioTrackSnapshot>;
  stingers: Record<StingerTrackId, AudioTrackSnapshot>;
  sfx: Record<SfxClipId, AudioTrackSnapshot>;
}

interface VoiceClipMetadata {
  speaker: 'rakshasa' | 'tantrik';
  gainScale: number;
  startOffsetSec: number;
}

const VOICE_CLIP_METADATA: Record<VoiceClipId, VoiceClipMetadata> = {
  demon_1st_dialogue: { speaker: 'rakshasa', gainScale: 0.95, startOffsetSec: 0 },
  tantrik_1st_dialogue: { speaker: 'tantrik', gainScale: 0.98, startOffsetSec: 0 },
  demon_first_angry: { speaker: 'rakshasa', gainScale: 0.92, startOffsetSec: 0 },
  demon_got_attacked: { speaker: 'rakshasa', gainScale: 0.86, startOffsetSec: 0 },
  demon_attacking: { speaker: 'rakshasa', gainScale: 0.88, startOffsetSec: 0.06 },
  tantrik_got_attacked: { speaker: 'tantrik', gainScale: 0.90, startOffsetSec: 0 },
  demon_defeat: { speaker: 'rakshasa', gainScale: 0.95, startOffsetSec: 0 },
  tantrik_victory: { speaker: 'tantrik', gainScale: 0.98, startOffsetSec: 0 },
  tantrik_defeat: { speaker: 'tantrik', gainScale: 0.98, startOffsetSec: 0 },
  demon_victory: { speaker: 'rakshasa', gainScale: 0.95, startOffsetSec: 0 },
};

interface SfxClipMetadata {
  gainScale: number;
  minIntervalMs: number;
}

const SFX_CLIP_METADATA: Record<SfxClipId, SfxClipMetadata> = {
  mudra_sparkle: { gainScale: 0.78, minIntervalMs: 260 },
  rakshasa_fireball: { gainScale: 0.82, minIntervalMs: 320 },
  tantrik_punch_hit: { gainScale: 0.74, minIntervalMs: 320 },
  ritual_choir_shine: { gainScale: 0.54, minIntervalMs: 800 },
  rakshasa_grunt_backup: { gainScale: 0.72, minIntervalMs: 450 },
};

type DialoguePriority = 'gameplay' | 'intro' | 'outcome';

interface QueuedDialogueItem {
  clipId: VoiceClipId;
  priority: DialoguePriority;
  onComplete?: () => void;
}

const DEFAULT_MUSIC_VOLUME = 0.72;
const DEFAULT_SFX_VOLUME = 0.85;
const DEFAULT_DIALOGUE_VOLUME = 0.92;
const DEFAULT_DUCKING_RATIO = 0.28;
// Slight voice speed-up (+0.15x, strictly under the +0.25x ceiling) so narrative dialogues feel crisp and responsive
const DEFAULT_VOICE_PLAYBACK_RATE = 1.15;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampVoicePlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_VOICE_PLAYBACK_RATE;
  // Never exceed 1.24x (< +0.25x speed increase as requested)
  return Math.max(1.0, Math.min(1.22, rate));
}

function defaultCreateAudio(url: string): AudioElementLike {
  if (typeof Audio !== 'undefined') {
    const el = new Audio(url);
    el.preload = 'auto';
    el.loop = false;
    return el;
  }
  let paused = true;
  const listeners: Record<string, Set<() => void>> = {};
  return {
    src: url,
    volume: 0,
    currentTime: 0,
    playbackRate: 1,
    get paused() {
      return paused;
    },
    set paused(val: boolean) {
      paused = val;
    },
    loop: false,
    preload: 'auto',
    async play() {
      paused = false;
    },
    pause() {
      paused = true;
    },
    addEventListener(type: string, listener: () => void) {
      if (!listeners[type]) listeners[type] = new Set();
      listeners[type].add(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners[type]?.delete(listener);
    },
  };
}

/**
 * Central, reusable Audio Manager for "The Curse of the Mudradhaar" (Tantrik vs Daanav).
 *
 * Manages:
 * 1. Background music tracks (`tantrik_bell`, `rakshasa_rite`) with smooth fades and zero overlap.
 * 2. Character voiceovers (Rakshasa & Tantrik) with priority queueing, strict non-overlapping
 *    playback, breathing gaps between lines, slight playback speed tuning (< +0.25x),
 *    background music ducking, and subtle cavernous reverb on Rakshasa lines.
 * 3. Outcome musical stingers (`player_victory`, `player_defeat`) that fade in after outcome
 *    dialogue finishes and play strictly once without looping.
 * 4. Gameplay SFX (`mudra_sparkle`, `rakshasa_fireball`, `tantrik_punch_hit`, `ritual_choir_shine`,
 *    `rakshasa_grunt_backup`) with deduplication, separate SFX volume control, and strict vocal
 *    non-overlap for the backup Rakshasa grunt.
 */
export class TantrikAudioManager {
  private readonly createAudioFn: (url: string) => AudioElementLike;
  private readonly fadeStepMs: number;
  private readonly fadeOutDurationMs: number;
  private readonly fadeInDurationMs: number;
  private readonly pauseFadeDurationMs: number;
  private readonly duckFadeDurationMs: number;
  private readonly stingerFadeInDurationMs: number;
  private readonly loopBreathDelayMs: number;
  private readonly dialogueBreathingGapMs: number;
  private readonly voicePlaybackRate: number;
  private readonly duckingRatio: number;
  private readonly enableWebAudioReverb: boolean;

  private tracks: Map<MusicTrackId, AudioElementLike> = new Map();
  private trackEndedHandlers: Map<MusicTrackId, () => void> = new Map();

  private voices: Map<VoiceClipId, AudioElementLike> = new Map();
  private voiceEndedHandlers: Map<VoiceClipId, () => void> = new Map();
  private voiceErrorHandlers: Map<VoiceClipId, () => void> = new Map();

  private stingers: Map<StingerTrackId, AudioElementLike> = new Map();
  private stingerEndedHandlers: Map<StingerTrackId, () => void> = new Map();
  private stingerPlayCounts: Record<StingerTrackId, number> = {
    player_victory: 0,
    player_defeat: 0,
  };

  private sfxElements: Map<SfxClipId, AudioElementLike> = new Map();
  private sfxEndedHandlers: Map<SfxClipId, () => void> = new Map();
  private sfxLastPlayedAt: Map<SfxClipId, number> = new Map();
  private sfxPlayCounts: Record<SfxClipId, number> = {
    mudra_sparkle: 0,
    rakshasa_fireball: 0,
    tantrik_punch_hit: 0,
    ritual_choir_shine: 0,
    rakshasa_grunt_backup: 0,
  };
  private sfxHistory: SfxClipId[] = [];

  // Optional Web Audio cavernous reverb for Rakshasa voice elements
  private audioCtx: AudioContext | null = null;
  private connectedMediaElements: WeakSet<object> = new WeakSet();

  private isUnlocked: boolean = false;
  private isMuted: boolean = false;
  private musicVolume: number = DEFAULT_MUSIC_VOLUME;
  private sfxVolume: number = DEFAULT_SFX_VOLUME;
  private dialogueVolume: number = DEFAULT_DIALOGUE_VOLUME;
  private isMusicDucked: boolean = false;

  private currentGameState: GameState = 'title';
  private activeTrackId: MusicTrackId | null = null;
  private activeVoiceId: VoiceClipId | null = null;
  private activeVoicePriority: DialoguePriority | null = null;
  private activeVoiceOnComplete: (() => void) | undefined = undefined;
  private pausedVoiceByGamePause: boolean = false;
  private voiceQueue: QueuedDialogueItem[] = [];
  private voiceHistory: VoiceClipId[] = [];

  private activeStingerId: StingerTrackId | null = null;
  private firstMudraAngryPlayed: boolean = false;
  private introSequenceCompleted: boolean = false;
  private outcomeTriggered: 'victory' | 'defeat' | null = null;
  private pendingEncounterStartOnUnlock: boolean = false;

  private isTransitioning: boolean = false;
  private transitionToken: number = 0;
  private dialogueToken: number = 0;
  private duckToken: number = 0;

  private activeFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private activeDuckTimer: ReturnType<typeof setTimeout> | null = null;
  private activeStingerFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private activeDialogueGapTimer: ReturnType<typeof setTimeout> | null = null;
  private loopRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private interactionListenersBound: boolean = false;

  constructor(options: AudioManagerOptions = {}) {
    this.createAudioFn = options.createAudio ?? defaultCreateAudio;
    this.fadeStepMs = options.fadeStepMs ?? 25;
    this.fadeOutDurationMs = options.fadeOutDurationMs ?? 380;
    this.fadeInDurationMs = options.fadeInDurationMs ?? 480;
    this.pauseFadeDurationMs = options.pauseFadeDurationMs ?? 180;
    this.duckFadeDurationMs = options.duckFadeDurationMs ?? 180;
    this.stingerFadeInDurationMs = options.stingerFadeInDurationMs ?? 360;
    this.loopBreathDelayMs = options.loopBreathDelayMs ?? 350;
    this.dialogueBreathingGapMs = options.dialogueBreathingGapMs ?? 180;
    this.voicePlaybackRate = clampVoicePlaybackRate(
      options.voicePlaybackRate ?? DEFAULT_VOICE_PLAYBACK_RATE
    );
    this.duckingRatio = options.duckingRatio ?? DEFAULT_DUCKING_RATIO;
    this.enableWebAudioReverb = options.enableWebAudioReverb ?? false;

    this.bindGlobalInteractionUnlock();
  }

  // ==================== ELEMENT FACTORIES & PRELOADING ====================

  private getOrCreateTrack(id: MusicTrackId): AudioElementLike {
    let audio = this.tracks.get(id);
    if (!audio) {
      const url = MUSIC_TRACK_URLS[id];
      audio = this.createAudioFn(url);
      audio.loop = false;
      audio.preload = 'auto';
      audio.volume = 0;

      const onEnded = () => {
        this.handleTrackEndedGracefully(id);
      };
      audio.addEventListener('ended', onEnded);
      this.trackEndedHandlers.set(id, onEnded);
      this.tracks.set(id, audio);
    }
    return audio;
  }

  private getOrCreateVoice(id: VoiceClipId): AudioElementLike {
    let audio = this.voices.get(id);
    if (!audio) {
      const url = VOICE_CLIP_URLS[id];
      audio = this.createAudioFn(url);
      audio.loop = false;
      audio.preload = 'auto';
      audio.volume = 0;
      audio.playbackRate = this.voicePlaybackRate;

      const onEnded = () => {
        if (this.activeVoiceId === id) {
          this.handleActiveVoiceFinished(id);
        }
      };
      const onError = () => {
        if (this.activeVoiceId === id) {
          this.handleActiveVoiceFinished(id);
        }
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      this.voiceEndedHandlers.set(id, onEnded);
      this.voiceErrorHandlers.set(id, onError);
      this.voices.set(id, audio);

      if (this.enableWebAudioReverb && VOICE_CLIP_METADATA[id].speaker === 'rakshasa') {
        this.attachCavernousReverbIfSupported(audio);
      }
    }
    return audio;
  }

  private getOrCreateStinger(id: StingerTrackId): AudioElementLike {
    let audio = this.stingers.get(id);
    if (!audio) {
      const url = STINGER_TRACK_URLS[id];
      audio = this.createAudioFn(url);
      audio.loop = false; // Never loop result stingers
      audio.preload = 'auto';
      audio.volume = 0;

      const onEnded = () => {
        if (this.activeStingerId === id) {
          audio!.pause();
          audio!.currentTime = 0;
          this.activeStingerId = null;
        }
      };
      audio.addEventListener('ended', onEnded);
      this.stingerEndedHandlers.set(id, onEnded);
      this.stingers.set(id, audio);
    }
    return audio;
  }

  private getOrCreateSfx(id: SfxClipId): AudioElementLike {
    let audio = this.sfxElements.get(id);
    if (!audio) {
      const url = SFX_CLIP_URLS[id];
      audio = this.createAudioFn(url);
      audio.loop = false; // Never artificially loop one-shot SFX
      audio.preload = 'auto';
      audio.volume = 0;

      const onEnded = () => {
        audio!.pause();
        audio!.currentTime = 0;
      };
      audio.addEventListener('ended', onEnded);
      this.sfxEndedHandlers.set(id, onEnded);
      this.sfxElements.set(id, audio);
    }
    return audio;
  }

  private attachCavernousReverbIfSupported(audio: AudioElementLike): void {
    if (typeof window === 'undefined' || typeof HTMLAudioElement === 'undefined') return;
    if (!(audio instanceof HTMLAudioElement)) return;
    if (this.connectedMediaElements.has(audio)) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      const ctx = this.audioCtx;
      const source = ctx.createMediaElementSource(audio);
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const delay1 = ctx.createDelay(0.5);
      const delay2 = ctx.createDelay(0.5);
      const feedback = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      dryGain.gain.value = 0.92;
      wetGain.gain.value = 0.22;
      delay1.delayTime.value = 0.085;
      delay2.delayTime.value = 0.17;
      feedback.gain.value = 0.28;
      filter.type = 'lowpass';
      filter.frequency.value = 1800;

      source.connect(dryGain);
      dryGain.connect(ctx.destination);

      source.connect(filter);
      filter.connect(delay1);
      delay1.connect(delay2);
      delay2.connect(feedback);
      feedback.connect(delay1);
      delay1.connect(wetGain);
      delay2.connect(wetGain);
      wetGain.connect(ctx.destination);

      this.connectedMediaElements.add(audio);
    } catch {
      // Fallback cleanly to standard HTMLAudioElement output
    }
  }

  /**
   * Pre-warms background music, voice clips, result stingers, and gameplay SFX without starting playback.
   */
  public preloadTracks(): void {
    this.getOrCreateTrack('tantrik_bell');
    this.getOrCreateTrack('rakshasa_rite');
    (Object.keys(STINGER_TRACK_URLS) as StingerTrackId[]).forEach((id) =>
      this.getOrCreateStinger(id)
    );
    (Object.keys(VOICE_CLIP_URLS) as VoiceClipId[]).forEach((id) =>
      this.getOrCreateVoice(id)
    );
    (Object.keys(SFX_CLIP_URLS) as SfxClipId[]).forEach((id) =>
      this.getOrCreateSfx(id)
    );
  }

  // ==================== VOLUME & DUCKING HELPERS ====================

  private getEffectiveMusicVolume(): number {
    if (this.isMuted) return 0;
    const base = this.musicVolume;
    return this.isMusicDucked ? clampVolume(base * this.duckingRatio) : base;
  }

  private getEffectiveVoiceVolume(clipId: VoiceClipId): number {
    if (this.isMuted) return 0;
    const meta = VOICE_CLIP_METADATA[clipId];
    return clampVolume(this.dialogueVolume * (meta?.gainScale ?? 1));
  }

  private getEffectiveStingerVolume(): number {
    if (this.isMuted) return 0;
    return clampVolume(this.musicVolume);
  }

  private getEffectiveSfxVolume(sfxId: SfxClipId): number {
    if (this.isMuted) return 0;
    const meta = SFX_CLIP_METADATA[sfxId];
    return clampVolume(this.sfxVolume * (meta?.gainScale ?? 1));
  }

  private setMusicDucked(ducked: boolean): void {
    if (this.isMusicDucked === ducked) return;
    this.isMusicDucked = ducked;

    if (this.activeDuckTimer !== null) {
      clearTimeout(this.activeDuckTimer);
      this.activeDuckTimer = null;
    }

    if (
      !this.activeTrackId ||
      this.currentGameState === 'paused' ||
      this.currentGameState === 'gameover'
    ) {
      return;
    }

    const activeAudio = this.tracks.get(this.activeTrackId);
    if (!activeAudio || activeAudio.paused) return;

    const targetVol = this.getEffectiveMusicVolume();
    const token = ++this.duckToken;
    const fromVol = activeAudio.volume;
    const durationMs = this.duckFadeDurationMs;

    if (durationMs <= 0 || Math.abs(targetVol - fromVol) < 0.005) {
      activeAudio.volume = targetVol;
      return;
    }

    const steps = Math.max(1, Math.round(durationMs / Math.max(1, this.fadeStepMs)));
    let step = 0;

    const tickDuck = () => {
      if (token !== this.duckToken) return;
      step += 1;
      const progress = Math.min(1, step / steps);
      const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
      const currentTarget = this.getEffectiveMusicVolume();
      activeAudio.volume = clampVolume(fromVol + (currentTarget - fromVol) * eased);

      if (step < steps) {
        this.activeDuckTimer = setTimeout(tickDuck, this.fadeStepMs);
      } else {
        activeAudio.volume = currentTarget;
        this.activeDuckTimer = null;
      }
    };

    this.activeDuckTimer = setTimeout(tickDuck, this.fadeStepMs);
  }

  private clearActiveTimers(): void {
    if (this.activeFadeTimer !== null) {
      clearTimeout(this.activeFadeTimer);
      this.activeFadeTimer = null;
    }
    if (this.loopRestartTimer !== null) {
      clearTimeout(this.loopRestartTimer);
      this.loopRestartTimer = null;
    }
  }

  private enforceSingleTrackExclusivity(allowedTrackId: MusicTrackId | null): void {
    for (const [id, audio] of this.tracks.entries()) {
      if (id !== allowedTrackId && !audio.paused) {
        audio.pause();
        audio.volume = 0;
        audio.currentTime = 0;
      }
    }
  }

  private enforceSingleVoiceExclusivity(allowedVoiceId: VoiceClipId | null): void {
    for (const [id, audio] of this.voices.entries()) {
      if (id !== allowedVoiceId && !audio.paused) {
        audio.pause();
        audio.volume = 0;
        audio.currentTime = 0;
      }
    }
    // Never allow the backup Rakshasa grunt SFX to play simultaneously with any vocal dialogue
    if (allowedVoiceId !== null) {
      const grunt = this.sfxElements.get('rakshasa_grunt_backup');
      if (grunt && !grunt.paused) {
        grunt.pause();
        grunt.volume = 0;
        grunt.currentTime = 0;
      }
    }
  }

  // ==================== GAMEPLAY SFX ENGINE ====================

  /**
   * Plays a one-shot gameplay sound effect with deduplication and non-overlap protection.
   * - Never loops (`loop = false`).
   * - Prevents duplicate triggers within `minIntervalMs`.
   * - Resets any existing instance of the same effect so identical effects never overlap.
   * - Enforces strict non-overlap between `rakshasa_grunt_backup` and any Rakshasa/Tantrik vocal dialogue.
   */
  public playSfx(sfxId: SfxClipId): boolean {
    if (!this.isUnlocked) return false;
    if (this.currentGameState === 'paused') return false;

    // Backup Rakshasa grunt must NEVER play alongside Rakshasa dialogue
    if (
      sfxId === 'rakshasa_grunt_backup' &&
      (this.activeVoiceId !== null || this.voiceQueue.length > 0)
    ) {
      return false;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastPlayed = this.sfxLastPlayedAt.get(sfxId);
    const meta = SFX_CLIP_METADATA[sfxId];

    if (lastPlayed !== undefined && now - lastPlayed < meta.minIntervalMs) {
      return false;
    }

    const audio = this.getOrCreateSfx(sfxId);
    // Avoid overlapping identical effects
    if (!audio.paused) {
      audio.pause();
    }
    audio.loop = false;
    audio.currentTime = 0;
    audio.volume = this.getEffectiveSfxVolume(sfxId);
    this.sfxLastPlayedAt.set(sfxId, now);

    audio
      .play()
      .then(() => {
        this.sfxPlayCounts[sfxId] += 1;
        this.sfxHistory.push(sfxId);
      })
      .catch(() => {});

    return true;
  }

  /**
   * Plays the backup non-verbal Rakshasa damage grunt ONLY if no Rakshasa/Tantrik dialogue
   * is currently playing or queued.
   */
  public playRakshasaDamageBackupGrunt(): boolean {
    return this.playSfx('rakshasa_grunt_backup');
  }

  /**
   * Stops and resets all active one-shot SFX clips immediately.
   */
  public stopAllSfx(): void {
    this.sfxLastPlayedAt.clear();
    for (const audio of this.sfxElements.values()) {
      if (!audio.paused) {
        audio.pause();
      }
      audio.volume = 0;
      audio.currentTime = 0;
    }
  }

  // ==================== DIALOGUE QUEUE & STINGER ENGINE ====================

  /**
   * Immediately stops all active or queued dialogue clips, any playing result stinger,
   * and any active one-shot SFX.
   * Used when restarting an encounter, returning to the title screen, or preempting with outcome audio.
   */
  public stopAllDialogueAndStingers(stopSfx: boolean = true): void {
    this.dialogueToken += 1;
    this.voiceQueue = [];
    this.activeVoiceId = null;
    this.activeVoicePriority = null;
    this.activeVoiceOnComplete = undefined;
    this.pausedVoiceByGamePause = false;

    if (this.activeDialogueGapTimer !== null) {
      clearTimeout(this.activeDialogueGapTimer);
      this.activeDialogueGapTimer = null;
    }

    for (const audio of this.voices.values()) {
      if (!audio.paused) {
        audio.pause();
      }
      audio.volume = 0;
      audio.currentTime = 0;
    }

    if (this.activeStingerFadeTimer !== null) {
      clearTimeout(this.activeStingerFadeTimer);
      this.activeStingerFadeTimer = null;
    }
    this.activeStingerId = null;
    for (const stinger of this.stingers.values()) {
      if (!stinger.paused) {
        stinger.pause();
      }
      stinger.volume = 0;
      stinger.currentTime = 0;
    }

    if (stopSfx) {
      this.stopAllSfx();
    }

    this.setMusicDucked(false);
  }

  private enqueueDialogueSequence(
    clips: VoiceClipId[],
    priority: DialoguePriority,
    options: { preemptCurrent?: boolean; onSequenceComplete?: () => void } = {}
  ): void {
    if (clips.length === 0) {
      options.onSequenceComplete?.();
      return;
    }

    if (options.preemptCurrent) {
      this.dialogueToken += 1;
      this.voiceQueue = [];
      if (this.activeDialogueGapTimer !== null) {
        clearTimeout(this.activeDialogueGapTimer);
        this.activeDialogueGapTimer = null;
      }
      if (this.activeVoiceId) {
        const active = this.voices.get(this.activeVoiceId);
        if (active && !active.paused) {
          active.pause();
        }
        if (active) {
          active.volume = 0;
          active.currentTime = 0;
        }
        this.activeVoiceId = null;
        this.activeVoicePriority = null;
        this.activeVoiceOnComplete = undefined;
      }
    }

    clips.forEach((clipId, index) => {
      const isLast = index === clips.length - 1;
      this.voiceQueue.push({
        clipId,
        priority,
        onComplete: isLast ? options.onSequenceComplete : undefined,
      });
    });

    if (!this.activeVoiceId && !this.pausedVoiceByGamePause && this.activeDialogueGapTimer === null) {
      this.playNextQueuedVoice();
    }
  }

  private playNextQueuedVoice(): void {
    if (this.pausedVoiceByGamePause) return;

    const nextItem = this.voiceQueue.shift();
    if (!nextItem) {
      this.activeVoiceId = null;
      this.activeVoicePriority = null;
      this.activeVoiceOnComplete = undefined;
      this.setMusicDucked(false);
      return;
    }

    const { clipId, priority, onComplete } = nextItem;
    const token = ++this.dialogueToken;
    const audio = this.getOrCreateVoice(clipId);
    const meta = VOICE_CLIP_METADATA[clipId];

    // Guarantee zero overlap across all voice clips and backup grunt
    this.enforceSingleVoiceExclusivity(clipId);

    this.activeVoiceId = clipId;
    this.activeVoicePriority = priority;
    this.activeVoiceOnComplete = onComplete;

    // Duck background music while dialogue is active
    this.setMusicDucked(true);

    try {
      audio.currentTime = meta.startOffsetSec;
    } catch {
      audio.currentTime = 0;
    }
    audio.playbackRate = this.voicePlaybackRate;
    audio.volume = this.getEffectiveVoiceVolume(clipId);

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    audio
      .play()
      .then(() => {
        if (token !== this.dialogueToken) {
          audio.pause();
          audio.currentTime = 0;
          return;
        }
        this.voiceHistory.push(clipId);
      })
      .catch(() => {
        // If asset fails to load or play is rejected, fail gracefully without hanging the queue
        if (token === this.dialogueToken) {
          this.handleActiveVoiceFinished(clipId);
        }
      });
  }

  private handleActiveVoiceFinished(clipId: VoiceClipId): void {
    if (this.activeVoiceId !== clipId) return;

    const audio = this.voices.get(clipId);
    if (audio) {
      audio.pause();
      audio.volume = 0;
      audio.currentTime = 0;
    }

    const completionCallback = this.activeVoiceOnComplete;
    this.activeVoiceId = null;
    this.activeVoicePriority = null;
    this.activeVoiceOnComplete = undefined;

    completionCallback?.();

    if (this.voiceQueue.length > 0) {
      if (this.dialogueBreathingGapMs > 0) {
        const token = this.dialogueToken;
        this.activeDialogueGapTimer = setTimeout(() => {
          this.activeDialogueGapTimer = null;
          if (token === this.dialogueToken) {
            this.playNextQueuedVoice();
          }
        }, this.dialogueBreathingGapMs);
      } else {
        this.playNextQueuedVoice();
      }
    } else {
      this.setMusicDucked(false);
    }
  }

  /**
   * Triggers a single Rakshasa or Tantrik voice line (`VoiceClipId`) with automatic
   * dialogue priority resolution, non-overlapping queueing, and background music ducking.
   */
  public triggerVoiceLine(
    id: VoiceClipId,
    options: {
      priority?: DialoguePriority;
      preemptCurrent?: boolean;
      onComplete?: () => void;
    } = {}
  ): boolean {
    if (!this.isUnlocked) return false;

    const defaultPriority: DialoguePriority =
      id === 'demon_defeat' ||
      id === 'tantrik_victory' ||
      id === 'tantrik_defeat' ||
      id === 'demon_victory'
        ? 'outcome'
        : id === 'demon_1st_dialogue' || id === 'tantrik_1st_dialogue'
        ? 'intro'
        : 'gameplay';

    const priority = options.priority ?? defaultPriority;

    // Never allow lower-priority gameplay or intro lines to interrupt outcome dialogue
    if (this.activeVoicePriority === 'outcome' && priority !== 'outcome') {
      return false;
    }

    // Never allow ordinary gameplay lines to interrupt the first-Mudra angry line
    if (
      this.activeVoiceId === 'demon_first_angry' &&
      priority === 'gameplay' &&
      id !== 'demon_first_angry'
    ) {
      return false;
    }

    const preemptCurrent =
      options.preemptCurrent ??
      (priority === 'outcome' || id === 'demon_first_angry');

    // If not preempting and an ordinary damage reaction (`demon_got_attacked`) is requested
    // while another voice is already active, skip so lines don't pile up awkwardly
    if (!preemptCurrent && id === 'demon_got_attacked' && (this.activeVoiceId || this.voiceQueue.length > 0)) {
      return false;
    }

    this.enqueueDialogueSequence([id], priority, {
      preemptCurrent,
      onSequenceComplete: options.onComplete,
    });
    return true;
  }

  /**
   * Triggers one-shot playback of the player victory or defeat musical stinger (`player_victory` | `player_defeat`).
   * - Ensures background music fades out properly.
   * - Guarantees `loop = false` and that the stinger plays only once at the end of a match.
   */
  public triggerResultStinger(stingerId: StingerTrackId): boolean {
    if (!this.isUnlocked) return false;
    // Prevent duplicate stinger playback if already active or already played for this match outcome
    if (this.activeStingerId !== null) return false;

    // Ensure background music is faded out when a result stinger plays
    if (this.activeTrackId !== null) {
      void this.fadeOutAndStopAll();
    }

    this.playResultStingerOnce(stingerId);
    return true;
  }

  private playResultStingerOnce(stingerId: StingerTrackId): void {
    const token = this.dialogueToken;
    const stinger = this.getOrCreateStinger(stingerId);

    // Ensure the other stinger is completely stopped
    const otherId: StingerTrackId =
      stingerId === 'player_victory' ? 'player_defeat' : 'player_victory';
    const otherStinger = this.getOrCreateStinger(otherId);
    if (!otherStinger.paused) {
      otherStinger.pause();
    }
    otherStinger.volume = 0;
    otherStinger.currentTime = 0;

    stinger.loop = false;
    stinger.currentTime = 0;
    stinger.volume = 0;
    this.activeStingerId = stingerId;

    stinger
      .play()
      .then(() => {
        if (token !== this.dialogueToken) {
          stinger.pause();
          stinger.currentTime = 0;
          return;
        }
        this.stingerPlayCounts[stingerId] += 1;

        const targetVol = this.getEffectiveStingerVolume();
        const durationMs = this.stingerFadeInDurationMs;
        if (durationMs <= 0) {
          stinger.volume = targetVol;
          return;
        }

        const steps = Math.max(1, Math.round(durationMs / Math.max(1, this.fadeStepMs)));
        let step = 0;
        const stepStingerFade = () => {
          if (token !== this.dialogueToken || this.activeStingerId !== stingerId) return;
          step += 1;
          const progress = Math.min(1, step / steps);
          stinger.volume = clampVolume(this.getEffectiveStingerVolume() * progress);
          if (step < steps) {
            this.activeStingerFadeTimer = setTimeout(stepStingerFade, this.fadeStepMs);
          } else {
            this.activeStingerFadeTimer = null;
          }
        };
        this.activeStingerFadeTimer = setTimeout(stepStingerFade, this.fadeStepMs);
      })
      .catch(() => {
        this.activeStingerId = null;
      });
  }

  // ==================== HIGH-LEVEL GAMEPLAY & STORY AUDIO TRIGGERS ====================

  /**
   * Starts a new encounter:
   * 1. Resets per-encounter flags and clears any residual voices, stingers, and SFX.
   * 2. Transitions background music to "The Rakshasa's Rite" (ducked while intro voices play).
   * 3. Plays `demon_1st_dialogue` ("Another soul comes willingly into my grasp")
   *    followed by `tantrik_1st_dialogue` ("I have come to end your reign of terror").
   * 4. When both opening dialogues finish, marks `introSequenceCompleted = true` and
   *    triggers the subtle `ritual_choir_shine` SFX as the combat ritual seal unlocks.
   */
  public startEncounterAudio(): void {
    this.stopAllDialogueAndStingers(true);
    this.firstMudraAngryPlayed = false;
    this.introSequenceCompleted = false;
    this.outcomeTriggered = null;
    this.currentGameState = 'playing';

    if (!this.isUnlocked) {
      this.pendingEncounterStartOnUnlock = true;
      return;
    }

    this.pendingEncounterStartOnUnlock = false;
    this.isMusicDucked = true;
    void this.transitionToTrack('rakshasa_rite', { resetPositionIfStopped: true });

    this.triggerVoiceLine('demon_1st_dialogue', {
      priority: 'intro',
      preemptCurrent: true,
    });
    this.triggerVoiceLine('tantrik_1st_dialogue', {
      priority: 'intro',
      preemptCurrent: false,
      onComplete: () => {
        this.introSequenceCompleted = true;
        this.playSfx('ritual_choir_shine');
      },
    });
  }

  /**
   * Returns true while the opening encounter dialogue (`demon_1st_dialogue` -> `tantrik_1st_dialogue`)
   * has not yet completed, so hands and combat timers wait until the opening narrative finishes.
   */
  public isInitialEncounterDialoguePlaying(): boolean {
    if (this.introSequenceCompleted) return false;
    return (
      this.activeVoicePriority === 'intro' ||
      this.voiceQueue.some((item) => item.priority === 'intro')
    );
  }

  /**
   * Allows completing the opening narrative prelude cleanly if needed (e.g., when transitioning directly into active combat).
   */
  public completeInitialEncounterDialogue(): void {
    if (this.introSequenceCompleted) return;
    this.introSequenceCompleted = true;
    if (this.activeVoicePriority === 'intro') {
      this.stopAllDialogueAndStingers(false);
    }
  }

  /**
   * Triggered when the player successfully locks a two-handed Mudra combo and casts a spell:
   * - Plays `mudra_sparkle` (`mixkit-magic-sparkle-poof-hit-3082.wav`) once per successful recognition/seal activation.
   * - On the very first successful Mudra of the encounter (`spellsCastCount === 1`),
   *   plays `demon_first_angry` ("You dare disturb me, Tantrik?!") once.
   * - On subsequent successful Mudras, plays `demon_got_attacked` as the main character response
   *   (never layering `Rakshasa_Grunt_Cleaned.mp3` over the vocal dialogue).
   */
  public handlePlayerMudraSuccess(spellsCastCount: number): void {
    if (this.outcomeTriggered !== null || this.currentGameState !== 'playing') return;

    // 1. Play Mudra recognition & ritual seal activation sparkle SFX once
    this.playSfx('mudra_sparkle');

    // 2. Play Rakshasa vocal reaction via triggerVoiceLine
    if (!this.firstMudraAngryPlayed && spellsCastCount >= 1) {
      this.firstMudraAngryPlayed = true;
      this.introSequenceCompleted = true;
      this.triggerVoiceLine('demon_first_angry', {
        priority: 'gameplay',
        preemptCurrent: true,
      });
      return;
    }

    this.triggerVoiceLine('demon_got_attacked', {
      priority: 'gameplay',
      preemptCurrent: false,
    });
  }

  /**
   * Triggered when the Rakshasa launches a major supernatural attack against the Tantrik (non-lethal):
   * - Plays `rakshasa_fireball` (`mixkit-fireball-spell-1347.wav`) synchronized with the attack.
   * - Plays `tantrik_punch_hit` (`mixkit-impact-of-a-strong-punch-2155.mp3`) as the physical hit impact.
   * - Coordinates `demon_attacking` and `tantrik_got_attacked` in sequence without overlapping voices.
   */
  public handleRakshasaMajorAttack(): void {
    if (this.outcomeTriggered !== null || this.currentGameState !== 'playing') return;

    // 1. Supernatural fireball attack + physical impact on Tantrik
    this.playSfx('rakshasa_fireball');
    this.playSfx('tantrik_punch_hit');

    if (this.activeVoicePriority === 'outcome') return;
    if (this.activeVoiceId === 'demon_first_angry') return;

    this.introSequenceCompleted = true;
    this.triggerVoiceLine('demon_attacking', {
      priority: 'gameplay',
      preemptCurrent: true,
    });
    this.triggerVoiceLine('tantrik_got_attacked', {
      priority: 'gameplay',
      preemptCurrent: false,
    });
  }

  /**
   * Triggered when the match ends in Player Victory or Player Defeat:
   * - Plays the final blow SFX (`mudra_sparkle` on victory, `rakshasa_fireball` + `tantrik_punch_hit` on defeat)
   *   while canceling any lingering ordinary gameplay voices.
   * - Immediately fades out the gameplay music (`rakshasa_rite`).
   * - Player Victory (`outcome === 'victory'`):
   *   `demon_defeat` -> `tantrik_victory` -> fades into `player_victory` stinger (once).
   * - Player Defeat (`outcome === 'defeat'`):
   *   `tantrik_defeat` -> `demon_victory` -> fades into `player_defeat` stinger (once).
   */
  public triggerOutcomeSequence(outcome: 'victory' | 'defeat'): void {
    if (this.outcomeTriggered !== null) return;
    this.outcomeTriggered = outcome;
    this.introSequenceCompleted = true;
    this.currentGameState = 'gameover';

    // Cancel any ordinary gameplay/intro dialogue without cutting off the final blow SFX we trigger next
    this.stopAllDialogueAndStingers(true);

    if (this.isUnlocked) {
      if (outcome === 'victory') {
        this.playSfx('mudra_sparkle');
      } else {
        this.playSfx('rakshasa_fireball');
        this.playSfx('tantrik_punch_hit');
      }
    }

    // Fade out gameplay soundtrack
    void this.fadeOutAndStopAll();

    if (!this.isUnlocked) return;

    if (outcome === 'victory') {
      this.triggerVoiceLine('demon_defeat', {
        priority: 'outcome',
        preemptCurrent: true,
      });
      this.triggerVoiceLine('tantrik_victory', {
        priority: 'outcome',
        preemptCurrent: false,
        onComplete: () => {
          if (this.outcomeTriggered === 'victory' && this.currentGameState === 'gameover') {
            this.triggerResultStinger('player_victory');
          }
        },
      });
    } else {
      this.triggerVoiceLine('tantrik_defeat', {
        priority: 'outcome',
        preemptCurrent: true,
      });
      this.triggerVoiceLine('demon_victory', {
        priority: 'outcome',
        preemptCurrent: false,
        onComplete: () => {
          if (this.outcomeTriggered === 'defeat' && this.currentGameState === 'gameover') {
            this.triggerResultStinger('player_defeat');
          }
        },
      });
    }
  }

  // ==================== BACKGROUND MUSIC & STATE SYNC ====================

  private handleTrackEndedGracefully(id: MusicTrackId): void {
    const expectedTrack = this.getExpectedTrackForState(this.currentGameState);
    if (
      !this.isUnlocked ||
      this.currentGameState === 'paused' ||
      this.currentGameState === 'gameover' ||
      expectedTrack !== id
    ) {
      return;
    }

    const token = ++this.transitionToken;
    this.clearActiveTimers();

    this.loopRestartTimer = setTimeout(() => {
      if (token !== this.transitionToken) return;
      const audio = this.getOrCreateTrack(id);
      audio.currentTime = 0;
      audio.volume = 0;
      this.enforceSingleTrackExclusivity(id);
      audio
        .play()
        .then(() => {
          if (token !== this.transitionToken) return;
          this.activeTrackId = id;
          void this.rampVolume(
            audio,
            0,
            this.getEffectiveMusicVolume(),
            this.fadeInDurationMs,
            token
          );
        })
        .catch(() => {});
    }, this.loopBreathDelayMs);
  }

  private getExpectedTrackForState(state: GameState): MusicTrackId | null {
    switch (state) {
      case 'title':
        return 'tantrik_bell';
      case 'playing':
      case 'paused':
        return 'rakshasa_rite';
      case 'gameover':
        return null;
    }
  }

  private rampVolume(
    audio: AudioElementLike,
    fromVol: number,
    toVol: number,
    durationMs: number,
    token: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (token !== this.transitionToken) {
        resolve(false);
        return;
      }

      const clampedFrom = clampVolume(fromVol);
      const clampedTo = clampVolume(toVol);
      audio.volume = clampedFrom;

      if (durationMs <= 0 || Math.abs(clampedTo - clampedFrom) < 0.005) {
        audio.volume = clampedTo;
        resolve(true);
        return;
      }

      const steps = Math.max(1, Math.round(durationMs / Math.max(1, this.fadeStepMs)));
      let currentStep = 0;

      const stepFn = () => {
        if (token !== this.transitionToken) {
          resolve(false);
          return;
        }
        currentStep += 1;
        const progress = Math.min(1, currentStep / steps);
        const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
        const target = clampedTo === 0 ? 0 : this.getEffectiveMusicVolume();
        const nextVol = clampedFrom + (target - clampedFrom) * eased;
        audio.volume = clampVolume(nextVol);

        if (currentStep >= steps) {
          audio.volume = clampVolume(target);
          this.activeFadeTimer = null;
          resolve(true);
        } else {
          this.activeFadeTimer = setTimeout(stepFn, this.fadeStepMs);
        }
      };

      this.activeFadeTimer = setTimeout(stepFn, this.fadeStepMs);
    });
  }

  private bindGlobalInteractionUnlock(): void {
    if (this.interactionListenersBound || typeof window === 'undefined') return;
    this.interactionListenersBound = true;

    const onFirstInteraction = () => {
      this.unlockFromUserGesture();
    };

    window.addEventListener('pointerdown', onFirstInteraction, { passive: true });
    window.addEventListener('keydown', onFirstInteraction, { passive: true });
    window.addEventListener('touchstart', onFirstInteraction, { passive: true });
  }

  public unlockFromUserGesture(): void {
    const wasUnlocked = this.isUnlocked;
    this.isUnlocked = true;
    this.preloadTracks();

    if (this.pendingEncounterStartOnUnlock && this.currentGameState === 'playing') {
      this.startEncounterAudio();
      return;
    }

    if (!wasUnlocked) {
      this.applyGameState(this.currentGameState);
      return;
    }

    const expectedTrack = this.getExpectedTrackForState(this.currentGameState);
    if (
      expectedTrack &&
      this.currentGameState !== 'paused' &&
      !this.isTransitioning
    ) {
      const audio = this.getOrCreateTrack(expectedTrack);
      if (audio.paused) {
        this.applyGameState(this.currentGameState);
      }
    }
  }

  public syncGameState(nextState: GameState): void {
    const prevState = this.currentGameState;
    this.currentGameState = nextState;

    if (nextState === 'title') {
      // Returning to title stops any leftover dialogue, result stingers, or SFX immediately
      this.stopAllDialogueAndStingers(true);
      this.outcomeTriggered = null;
    }

    if (!this.isUnlocked) {
      return;
    }

    if (prevState === 'paused' && nextState === 'playing') {
      void this.resumeGameplayTrack();
      return;
    }

    this.applyGameState(nextState);
  }

  private applyGameState(state: GameState): void {
    switch (state) {
      case 'title':
        void this.transitionToTrack('tantrik_bell', { resetPositionIfStopped: true });
        break;
      case 'playing':
        void this.transitionToTrack('rakshasa_rite', { resetPositionIfStopped: true });
        break;
      case 'paused':
        void this.pauseGameplayTrack();
        break;
      case 'gameover':
        void this.fadeOutAndStopAll();
        break;
    }
  }

  public async transitionToTrack(
    targetTrackId: MusicTrackId,
    options: { resetPositionIfStopped?: boolean; restartFromBeginning?: boolean } = {}
  ): Promise<void> {
    const token = ++this.transitionToken;
    this.clearActiveTimers();
    this.isTransitioning = true;

    const targetAudio = this.getOrCreateTrack(targetTrackId);
    const otherTrackId: MusicTrackId =
      targetTrackId === 'tantrik_bell' ? 'rakshasa_rite' : 'tantrik_bell';
    const otherAudio = this.getOrCreateTrack(otherTrackId);

    if (!otherAudio.paused) {
      if (!targetAudio.paused) {
        targetAudio.pause();
      }
      if (otherAudio.volume > 0.04) {
        const completed = await this.rampVolume(
          otherAudio,
          otherAudio.volume,
          0,
          this.fadeOutDurationMs,
          token
        );
        otherAudio.pause();
        otherAudio.volume = 0;
        otherAudio.currentTime = 0;
        if (!completed || token !== this.transitionToken) {
          return;
        }
      } else {
        otherAudio.pause();
        otherAudio.volume = 0;
        otherAudio.currentTime = 0;
      }
    } else {
      otherAudio.volume = 0;
      otherAudio.currentTime = 0;
    }

    if (!targetAudio.paused && !options.restartFromBeginning) {
      this.activeTrackId = targetTrackId;
      await this.rampVolume(
        targetAudio,
        targetAudio.volume,
        this.getEffectiveMusicVolume(),
        this.fadeInDurationMs,
        token
      );
      if (token === this.transitionToken) {
        this.isTransitioning = false;
      }
      return;
    }

    if (options.restartFromBeginning || (options.resetPositionIfStopped && targetAudio.paused)) {
      targetAudio.currentTime = 0;
    }
    targetAudio.volume = 0;
    this.enforceSingleTrackExclusivity(targetTrackId);

    try {
      await targetAudio.play();
      if (token !== this.transitionToken) {
        this.enforceSingleTrackExclusivity(
          this.getExpectedTrackForState(this.currentGameState)
        );
        return;
      }
      this.activeTrackId = targetTrackId;
      await this.rampVolume(
        targetAudio,
        0,
        this.getEffectiveMusicVolume(),
        this.fadeInDurationMs,
        token
      );
    } catch {
      // Autoplay blocked until user gesture
    } finally {
      if (token === this.transitionToken) {
        this.isTransitioning = false;
      }
    }
  }

  public async pauseGameplayTrack(): Promise<void> {
    const token = ++this.transitionToken;
    this.clearActiveTimers();
    this.isTransitioning = true;

    // Stop any one-shot SFX on pause
    this.stopAllSfx();

    // Pause active dialogue clip at its current position if one is playing
    if (this.activeVoiceId) {
      const voiceAudio = this.voices.get(this.activeVoiceId);
      if (voiceAudio && !voiceAudio.paused) {
        voiceAudio.pause();
        this.pausedVoiceByGamePause = true;
      }
    } else if (this.activeDialogueGapTimer !== null) {
      clearTimeout(this.activeDialogueGapTimer);
      this.activeDialogueGapTimer = null;
      this.pausedVoiceByGamePause = true;
    }

    const titleAudio = this.getOrCreateTrack('tantrik_bell');
    if (!titleAudio.paused) {
      titleAudio.pause();
      titleAudio.volume = 0;
      titleAudio.currentTime = 0;
    }

    const gameplayAudio = this.getOrCreateTrack('rakshasa_rite');
    if (!gameplayAudio.paused) {
      await this.rampVolume(
        gameplayAudio,
        gameplayAudio.volume,
        0,
        this.pauseFadeDurationMs,
        token
      );
      if (token === this.transitionToken) {
        gameplayAudio.pause();
      }
    }

    if (token === this.transitionToken) {
      this.isTransitioning = false;
    }
  }

  public async resumeGameplayTrack(): Promise<void> {
    const token = ++this.transitionToken;
    this.clearActiveTimers();
    this.isTransitioning = true;

    const titleAudio = this.getOrCreateTrack('tantrik_bell');
    if (!titleAudio.paused) {
      titleAudio.pause();
      titleAudio.volume = 0;
      titleAudio.currentTime = 0;
    }

    // Resume paused voice clip if one was mid-playback when paused
    if (this.pausedVoiceByGamePause && this.activeVoiceId) {
      this.pausedVoiceByGamePause = false;
      const voiceAudio = this.voices.get(this.activeVoiceId);
      if (voiceAudio && voiceAudio.paused) {
        voiceAudio.volume = this.getEffectiveVoiceVolume(this.activeVoiceId);
        voiceAudio.play().catch(() => {
          if (this.activeVoiceId) {
            this.handleActiveVoiceFinished(this.activeVoiceId);
          }
        });
      }
    } else if (this.pausedVoiceByGamePause) {
      this.pausedVoiceByGamePause = false;
      this.playNextQueuedVoice();
    }

    const gameplayAudio = this.getOrCreateTrack('rakshasa_rite');
    gameplayAudio.volume = 0;
    this.enforceSingleTrackExclusivity('rakshasa_rite');

    try {
      await gameplayAudio.play();
      if (token !== this.transitionToken) return;
      this.activeTrackId = 'rakshasa_rite';
      await this.rampVolume(
        gameplayAudio,
        0,
        this.getEffectiveMusicVolume(),
        this.pauseFadeDurationMs,
        token
      );
    } catch {
      // Ignore if blocked
    } finally {
      if (token === this.transitionToken) {
        this.isTransitioning = false;
      }
    }
  }

  public async fadeOutAndStopAll(): Promise<void> {
    const token = ++this.transitionToken;
    this.clearActiveTimers();
    this.isTransitioning = true;

    const playingTracks: AudioElementLike[] = [];
    for (const audio of this.tracks.values()) {
      if (!audio.paused) {
        playingTracks.push(audio);
      } else {
        audio.volume = 0;
        audio.currentTime = 0;
      }
    }

    if (playingTracks.length > 0) {
      const active = playingTracks[0];
      for (let i = 1; i < playingTracks.length; i++) {
        playingTracks[i].pause();
        playingTracks[i].volume = 0;
        playingTracks[i].currentTime = 0;
      }
      await this.rampVolume(active, active.volume, 0, this.fadeOutDurationMs, token);
      if (token === this.transitionToken) {
        active.pause();
        active.volume = 0;
        active.currentTime = 0;
      }
    }

    if (token === this.transitionToken) {
      this.activeTrackId = null;
      this.isTransitioning = false;
    }
  }

  // ==================== INDEPENDENT VOLUME & MUTE CONFIGURATION ====================

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    const effectiveMusic = this.getEffectiveMusicVolume();
    for (const [id, audio] of this.tracks.entries()) {
      if (!audio.paused && id === this.activeTrackId) {
        audio.volume = effectiveMusic;
      } else if (muted) {
        audio.volume = 0;
      }
    }

    if (this.activeVoiceId) {
      const activeVoice = this.voices.get(this.activeVoiceId);
      if (activeVoice) {
        activeVoice.volume = this.getEffectiveVoiceVolume(this.activeVoiceId);
      }
    }

    if (this.activeStingerId) {
      const activeStinger = this.stingers.get(this.activeStingerId);
      if (activeStinger) {
        activeStinger.volume = this.getEffectiveStingerVolume();
      }
    }

    for (const [id, sfx] of this.sfxElements.entries()) {
      if (!sfx.paused) {
        sfx.volume = this.getEffectiveSfxVolume(id);
      } else if (muted) {
        sfx.volume = 0;
      }
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = clampVolume(volume);
    if (!this.isMuted && this.activeTrackId) {
      const active = this.tracks.get(this.activeTrackId);
      if (active && !active.paused && !this.isTransitioning) {
        active.volume = this.getEffectiveMusicVolume();
      }
    }
    if (!this.isMuted && this.activeStingerId) {
      const stinger = this.stingers.get(this.activeStingerId);
      if (stinger && !stinger.paused) {
        stinger.volume = this.getEffectiveStingerVolume();
      }
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = clampVolume(volume);
    if (!this.isMuted) {
      for (const [id, sfx] of this.sfxElements.entries()) {
        if (!sfx.paused) {
          sfx.volume = this.getEffectiveSfxVolume(id);
        }
      }
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setDialogueVolume(volume: number): void {
    this.dialogueVolume = clampVolume(volume);
    if (!this.isMuted && this.activeVoiceId) {
      const activeVoice = this.voices.get(this.activeVoiceId);
      if (activeVoice && !activeVoice.paused) {
        activeVoice.volume = this.getEffectiveVoiceVolume(this.activeVoiceId);
      }
    }
  }

  public getDialogueVolume(): number {
    return this.dialogueVolume;
  }

  public getSnapshot(): AudioManagerSnapshot {
    const tantrik = this.getOrCreateTrack('tantrik_bell');
    const rakshasa = this.getOrCreateTrack('rakshasa_rite');
    const victoryStinger = this.getOrCreateStinger('player_victory');
    const defeatStinger = this.getOrCreateStinger('player_defeat');

    let playingVoiceCount = 0;
    for (const v of this.voices.values()) {
      if (!v.paused) playingVoiceCount += 1;
    }

    const activeSfx: SfxClipId[] = [];
    const sfxSnapshots = {} as Record<SfxClipId, AudioTrackSnapshot>;
    for (const id of Object.keys(SFX_CLIP_URLS) as SfxClipId[]) {
      const el = this.getOrCreateSfx(id);
      if (!el.paused) {
        activeSfx.push(id);
      }
      sfxSnapshots[id] = {
        id,
        url: el.src,
        paused: el.paused,
        currentTime: el.currentTime,
        volume: Number(el.volume.toFixed(3)),
      };
    }

    return {
      unlocked: this.isUnlocked,
      muted: this.isMuted,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      dialogueVolume: this.dialogueVolume,
      voicePlaybackRate: this.voicePlaybackRate,
      isMusicDucked: this.isMusicDucked,
      currentGameState: this.currentGameState,
      activeTrack: this.activeTrackId,
      activeVoice: this.activeVoiceId,
      queuedVoices: this.voiceQueue.map((item) => item.clipId),
      activeStinger: this.activeStingerId,
      stingerPlayCounts: { ...this.stingerPlayCounts },
      activeSfx,
      sfxPlayCounts: { ...this.sfxPlayCounts },
      sfxHistory: [...this.sfxHistory],
      firstMudraAngryPlayed: this.firstMudraAngryPlayed,
      introSequenceCompleted: this.introSequenceCompleted,
      outcomeTriggered: this.outcomeTriggered,
      isTransitioning: this.isTransitioning,
      simultaneousPlaying: !tantrik.paused && !rakshasa.paused,
      simultaneousDialoguePlaying: playingVoiceCount > 1,
      voiceHistory: [...this.voiceHistory],
      tracks: {
        tantrik_bell: {
          id: 'tantrik_bell',
          url: tantrik.src,
          paused: tantrik.paused,
          currentTime: tantrik.currentTime,
          volume: Number(tantrik.volume.toFixed(3)),
        },
        rakshasa_rite: {
          id: 'rakshasa_rite',
          url: rakshasa.src,
          paused: rakshasa.paused,
          currentTime: rakshasa.currentTime,
          volume: Number(rakshasa.volume.toFixed(3)),
        },
      },
      stingers: {
        player_victory: {
          id: 'player_victory',
          url: victoryStinger.src,
          paused: victoryStinger.paused,
          currentTime: victoryStinger.currentTime,
          volume: Number(victoryStinger.volume.toFixed(3)),
        },
        player_defeat: {
          id: 'player_defeat',
          url: defeatStinger.src,
          paused: defeatStinger.paused,
          currentTime: defeatStinger.currentTime,
          volume: Number(defeatStinger.volume.toFixed(3)),
        },
      },
      sfx: sfxSnapshots,
    };
  }

  public dispose(): void {
    this.transitionToken += 1;
    this.clearActiveTimers();
    this.stopAllDialogueAndStingers(true);

    for (const [id, audio] of this.tracks.entries()) {
      const handler = this.trackEndedHandlers.get(id);
      if (handler) audio.removeEventListener('ended', handler);
      audio.pause();
      audio.volume = 0;
      audio.currentTime = 0;
    }
    for (const [id, audio] of this.voices.entries()) {
      const ended = this.voiceEndedHandlers.get(id);
      const err = this.voiceErrorHandlers.get(id);
      if (ended) audio.removeEventListener('ended', ended);
      if (err) audio.removeEventListener('error', err);
      audio.pause();
      audio.volume = 0;
      audio.currentTime = 0;
    }
    for (const [id, audio] of this.stingers.entries()) {
      const ended = this.stingerEndedHandlers.get(id);
      if (ended) audio.removeEventListener('ended', ended);
      audio.pause();
      audio.volume = 0;
      audio.currentTime = 0;
    }
    for (const [id, audio] of this.sfxElements.entries()) {
      const ended = this.sfxEndedHandlers.get(id);
      if (ended) audio.removeEventListener('ended', ended);
      audio.pause();
      audio.volume = 0;
      audio.currentTime = 0;
    }

    this.tracks.clear();
    this.trackEndedHandlers.clear();
    this.voices.clear();
    this.voiceEndedHandlers.clear();
    this.voiceErrorHandlers.clear();
    this.stingers.clear();
    this.stingerEndedHandlers.clear();
    this.sfxElements.clear();
    this.sfxEndedHandlers.clear();
    this.activeTrackId = null;
  }
}

export const audioManager = new TantrikAudioManager({ enableWebAudioReverb: true });
export const audioEngine = audioManager;

if (typeof window !== 'undefined') {
  (window as unknown as { __TANTRIK_AUDIO__: TantrikAudioManager }).__TANTRIK_AUDIO__ =
    audioManager;
}
