import React from 'react';
import {
  DIFFICULTY_CONFIGS,
  DifficultyLevel,
  GameState,
  MUDRAS,
  RitualRank,
} from '../game/rules';
import { HAND_SPRITE_URLS } from '../game/assets';
import { BookOpen, Camera, Keyboard, Play, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';

export interface RunStatsSnapshot {
  outcome: 'victory' | 'defeat';
  clearTimeSec: number;
  bestStreak: number;
  spellsCast: number;
  tantrikHpLeft: number;
  daanavHpLeft: number;
  difficulty?: DifficultyLevel;
  fastestCastSec?: number;
  accuracyPct?: number;
  parriesCount?: number;
  ritualRank?: RitualRank;
}

interface GameModalsProps {
  gameState: GameState;
  cameraStatus: 'idle' | 'requesting' | 'ready' | 'denied';
  difficulty: DifficultyLevel;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onStartGame: () => void;
  onStartPractice?: () => void;
  onResumeGame: () => void;
  onRestartGame: () => void;
  onReturnToTitle: () => void;
  onRequestCamera: () => void;
  runSnapshot: RunStatsSnapshot | null;
}

const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ['easy', 'medium', 'hard'] as const;

const TempleCornerOrnament: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({
  position,
}) => {
  const posClasses =
    position === 'tl'
      ? 'top-1.5 left-1.5'
      : position === 'tr'
      ? 'top-1.5 right-1.5 rotate-90'
      : position === 'bl'
      ? 'bottom-1.5 left-1.5 -rotate-90'
      : 'bottom-1.5 right-1.5 rotate-180';

  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-4 h-4 absolute ${posClasses} pointer-events-none`}
      aria-hidden="true"
    >
      <path
        d="M2,22 L2,2 L22,2"
        fill="none"
        stroke="#D4AF37"
        strokeWidth="2.5"
      />
      <circle cx="5" cy="5" r="2.5" fill="#DC2626" stroke="#FDE68A" strokeWidth="0.8" />
    </svg>
  );
};

export const GameModals: React.FC<GameModalsProps> = ({
  gameState,
  cameraStatus,
  difficulty,
  onSelectDifficulty,
  onStartGame,
  onStartPractice,
  onResumeGame,
  onRestartGame,
  onReturnToTitle,
  onRequestCamera,
  runSnapshot,
}) => {
  if (gameState === 'playing') return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-8 bg-black/82 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-500 animate-fade-in">
      {/* ==================== TITLE SCREEN MODAL ==================== */}
      {gameState === 'title' && (
        <div
          className="relative w-full max-w-4xl rounded-lg border-2 border-[#8C6D32] bg-[#090D0C]/95 p-6 md:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)] text-[#F5EFE6] transition-all duration-500"
          style={{
            boxShadow:
              'inset 0 0 0 1px rgba(212, 175, 55, 0.25), 0 25px 70px rgba(0, 0, 0, 0.95)',
          }}
          role="dialog"
          aria-labelledby="game-title-heading"
        >
          <TempleCornerOrnament position="tl" />
          <TempleCornerOrnament position="tr" />
          <TempleCornerOrnament position="bl" />
          <TempleCornerOrnament position="br" />

          {/* Custom Inline SVG Emblem & Title Lockup */}
          <div className="flex flex-col items-center text-center mb-4">
            <svg
              viewBox="0 0 560 105"
              className="w-full max-w-[500px] h-auto mb-1.5"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="titleGold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="45%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#85581A" />
                </linearGradient>
                <linearGradient id="titleCrimson" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#F87171" />
                  <stop offset="50%" stopColor="#DC2626" />
                  <stop offset="100%" stopColor="#7F1D1D" />
                </linearGradient>
              </defs>
              <path
                d="M40,16 L250,16 L280,4 L310,16 L520,16"
                fill="none"
                stroke="url(#titleGold)"
                strokeWidth="2"
                opacity="0.85"
              />
              <text
                x="280"
                y="56"
                textAnchor="middle"
                fill="url(#titleGold)"
                className="font-display font-black"
                fontSize="36"
                letterSpacing="4"
              >
                TANTRIK VS DAANAV
              </text>
              <text
                x="280"
                y="86"
                textAnchor="middle"
                fill="url(#titleCrimson)"
                className="font-display font-bold"
                fontSize="17"
                letterSpacing="9"
              >
                DEMON SLAYER · MUDRA COMBAT
              </text>
              <path
                d="M90,98 L265,98 L280,104 L295,98 L470,98"
                fill="none"
                stroke="url(#titleCrimson)"
                strokeWidth="1.5"
                opacity="0.75"
              />
            </svg>

            <h1 id="game-title-heading" className="sr-only">
              Tantrik vs Daanav: Demon Slayer
            </h1>
            <p className="text-sm md:text-base text-[#D6C7B2] max-w-xl leading-relaxed">
              Channel the sacred two-handed <span className="text-[#FBBF24] font-semibold">Tantrik Mudras</span> before the temple stone gauge drains to banish the Horned Daanav King.
            </p>
          </div>

          {/* 6 Sacred Mudras Photorealistic Reference Grid */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-[#B5A388] mb-2 px-1">
              <span>Sacred 6-Mudra Temple Codex</span>
              <span>Agni Burn · Prana Heal · Vajra Stun</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {MUDRAS.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col items-center text-center p-2.5 rounded bg-[#101715] border border-[#5E4923] shadow-inner"
                >
                  <div className="relative w-14 h-16 mb-1.5 flex items-center justify-center">
                    <img
                      src={HAND_SPRITE_URLS[m.id]}
                      alt={m.englishName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]"
                    />
                    <span
                      className="absolute -bottom-1 -right-1 text-base"
                      role="img"
                      aria-label={`${m.englishName} icon`}
                    >
                      {m.emoji}
                    </span>
                  </div>
                  <span className="font-display font-bold text-xs text-[#F5EFE6] whitespace-nowrap">
                    {m.sanskritName}
                  </span>
                  <span className="text-[11px] text-[#A89882] mb-1 whitespace-nowrap">
                    {m.englishName}
                  </span>
                  <span className="font-mono-tabular text-[11px] text-[#D4AF37]">
                    L:[{m.leftKey}] · R:[{m.rightKey}]
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ritual Trial Difficulty Selector (Easy / Medium / Hard) */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-[#B5A388] mb-2 px-1">
              <span>Select Ritual Difficulty</span>
              <span className="font-mono-tabular text-[#D4AF37]">
                {(DIFFICULTY_CONFIGS[difficulty].baseComboDurationMs / 1000).toFixed(1)}s Gauge ·{' '}
                {DIFFICULTY_CONFIGS[difficulty].sanskritTitle}
              </span>
            </div>
            <div
              className="grid grid-cols-3 gap-2.5"
              role="radiogroup"
              aria-label="Ritual Difficulty"
              data-testid="difficulty-selector"
            >
              {DIFFICULTY_LEVELS.map((lvl) => {
                const cfg = DIFFICULTY_CONFIGS[lvl];
                const isSelected = difficulty === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`difficulty-${lvl}`}
                    onClick={() => onSelectDifficulty(lvl)}
                    className={`py-2 px-3 rounded border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#7F1D1D]/65 border-[#FBBF24] shadow-[0_0_16px_rgba(251,191,36,0.28)]'
                        : 'bg-[#101715] border-[#4A3B22] hover:border-[#8C6D32]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-display font-bold text-xs uppercase tracking-wider ${
                          isSelected ? 'text-[#FDE68A]' : 'text-[#E5D5BE]'
                        }`}
                      >
                        {cfg.label}
                      </span>
                      <span className="font-mono-tabular text-[10px] text-[#D4AF37]">
                        {(cfg.baseComboDurationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <span className="text-[11px] text-[#A89882] truncate">
                      {cfg.sanskritTitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Webcam Readiness & Primary Start Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#3B2E19]">
            <div className="flex items-center gap-2.5 text-xs text-[#C7B69E]">
              {cameraStatus === 'ready' ? (
                <span className="flex items-center gap-2 text-amber-300 font-medium">
                  <Camera className="w-4 h-4 shrink-0" />
                  Live MediaPipe 2-Hand Vision Active
                </span>
              ) : cameraStatus === 'requesting' ? (
                <span className="flex items-center gap-2 text-amber-200">
                  <Camera className="w-4 h-4 shrink-0" />
                  Initializing MediaPipe Hand Vision...
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRequestCamera}
                  className="px-3.5 py-2 rounded border border-[#785C2A] bg-[#131B18] hover:bg-[#1C2824] text-[#E5D5BE] text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Camera className="w-4 h-4 text-[#D4AF37]" />
                  {cameraStatus === 'denied'
                    ? 'Retry Webcam Permission'
                    : 'Enable Webcam Hand Tracking'}
                </button>
              )}
            </div>

            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
              {onStartPractice && (
                <button
                  type="button"
                  data-testid="start-practice-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onStartPractice();
                  }}
                  className="w-full sm:w-auto px-4 py-3 rounded border border-[#8C6D32] bg-[#131B18] hover:bg-[#1C2824] text-[#FDE68A] font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Practice all 6 Mudras without taking damage"
                >
                  <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                  Sadhana Dojo (Practice)
                </button>
              )}

              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStartGame();
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded bg-[#991B1B] hover:bg-[#B91C1C] text-[#FEF2F2] font-display font-bold text-base tracking-wider uppercase border-2 border-[#D4AF37] shadow-[0_0_24px_rgba(185,28,28,0.6)] flex items-center justify-center gap-2.5 transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-5 h-5 fill-current text-[#FBBF24]" />
                Enter The Cavern
              </button>
            </div>
          </div>

          {/* Single Flat Borderless Control Hint Line */}
          <div className="mt-3.5 text-center text-xs text-[#8C7A65]">
            <Keyboard className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
            Hold Both Hands to Webcam · Keys 1–6 Left · Keys 7–0 / - / = Right · [W] Abhaya Ward · [E] Mahamudra · Space Cast
          </div>
        </div>
      )}

      {/* ==================== PAUSE MODAL ==================== */}
      {gameState === 'paused' && (
        <div
          className="relative w-full max-w-md rounded-lg border-2 border-[#8C6D32] bg-[#090D0C]/95 p-6 shadow-2xl text-center transition-all duration-300"
          role="dialog"
          aria-labelledby="pause-heading"
        >
          <TempleCornerOrnament position="tl" />
          <TempleCornerOrnament position="tr" />
          <TempleCornerOrnament position="bl" />
          <TempleCornerOrnament position="br" />

          <h2
            id="pause-heading"
            className="font-display font-bold text-2xl tracking-wider text-[#D4AF37] mb-2"
          >
            RITUAL PAUSED
          </h2>
          <p className="text-xs text-[#A89882] mb-6">
            The subterranean temple holds its breath. Ready your hands before resuming combat.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResumeGame();
              }}
              className="w-full py-3 px-4 rounded bg-[#991B1B] hover:bg-[#B91C1C] border border-[#D4AF37] text-white font-display font-bold text-sm tracking-wider uppercase cursor-pointer whitespace-nowrap"
            >
              Resume Fight
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartGame();
              }}
              className="w-full py-2.5 px-4 rounded border border-[#5E4923] bg-[#111916] hover:bg-[#1A2622] text-[#E5D5BE] text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              Restart Encounter
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnToTitle();
              }}
              className="w-full py-2.5 px-4 rounded border border-transparent hover:border-[#3E301B] text-[#A89882] hover:text-[#F5EFE6] text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              Return to Title Screen
            </button>
          </div>
        </div>
      )}

      {/* ==================== VICTORY / GAME OVER RITUAL SCROLL SUMMARY MODAL ==================== */}
      {gameState === 'gameover' && runSnapshot && (
        <div
          className="relative w-full max-w-lg rounded-lg border-2 border-[#8C6D32] bg-[#090D0C]/95 p-7 shadow-2xl text-center transition-all duration-500"
          role="dialog"
          aria-labelledby="gameover-heading"
          data-testid="ritual-scroll-summary"
        >
          <TempleCornerOrnament position="tl" />
          <TempleCornerOrnament position="tr" />
          <TempleCornerOrnament position="bl" />
          <TempleCornerOrnament position="br" />

          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#111916] border border-[#785C2A]">
              {runSnapshot.outcome === 'victory' ? (
                <Sparkles className="w-6 h-6 text-[#FBBF24]" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-[#EF4444]" />
              )}
            </div>
            {runSnapshot.ritualRank && (
              <div
                data-testid="ritual-rank-badge"
                className="flex flex-col items-center justify-center px-3.5 py-1 rounded border-2 border-[#D4AF37] bg-[#141E1B] shadow-[0_0_18px_rgba(212,175,55,0.3)]"
              >
                <span className="text-[9px] uppercase tracking-widest text-[#A89882]">
                  Ritual Rank
                </span>
                <span className="font-display font-black text-2xl leading-none text-[#FBBF24]">
                  {runSnapshot.ritualRank}
                </span>
              </div>
            )}
          </div>

          <h2
            id="gameover-heading"
            className={`font-display font-black text-3xl tracking-wider uppercase mb-1.5 ${
              runSnapshot.outcome === 'victory' ? 'text-[#FBBF24]' : 'text-[#EF4444]'
            }`}
          >
            {runSnapshot.outcome === 'victory' ? 'DAANAV BANISHED' : 'TANTRIK FALLEN'}
          </h2>
          <p className="text-sm text-[#C7B69E] mb-5">
            {runSnapshot.outcome === 'victory'
              ? 'Your sacred mudras shattered the Horned Demon King and sealed the temple sanctum.'
              : 'The Horned Daanav overwhelmed your defenses before the ritual could be completed.'}
          </p>

          {/* 6 Tabular-Nums Ritual Scroll Summary Metric Tiles */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <div className="p-2.5 rounded bg-[#101715] border border-[#5E4923]">
              <div className="text-[10px] uppercase tracking-wider text-[#A89882] mb-0.5">
                Best Streak
              </div>
              <div className="font-mono-tabular font-bold text-lg text-[#FBBF24]">
                {runSnapshot.bestStreak}x
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#101715] border border-[#5E4923]">
              <div className="text-[10px] uppercase tracking-wider text-[#A89882] mb-0.5">
                {runSnapshot.outcome === 'victory' ? 'Clear Time' : 'Daanav HP Left'}
              </div>
              <div className="font-mono-tabular font-bold text-lg text-[#F5EFE6]">
                {runSnapshot.outcome === 'victory'
                  ? `${runSnapshot.clearTimeSec}s`
                  : `${runSnapshot.daanavHpLeft}%`}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#101715] border border-[#5E4923]">
              <div className="text-[10px] uppercase tracking-wider text-[#A89882] mb-0.5">
                Spells Cast
              </div>
              <div className="font-mono-tabular font-bold text-lg text-[#D4AF37]">
                {runSnapshot.spellsCast}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#101715] border border-[#5E4923]">
              <div className="text-[10px] uppercase tracking-wider text-[#A89882] mb-0.5">
                Fastest Seal
              </div>
              <div
                className="font-mono-tabular font-bold text-lg text-[#FDE68A]"
                data-testid="summary-fastest-cast"
              >
                {runSnapshot.fastestCastSec ? `${runSnapshot.fastestCastSec.toFixed(2)}s` : '—'}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#101715] border border-[#5E4923]">
              <div className="text-[10px] uppercase tracking-wider text-[#A89882] mb-0.5">
                Seal Accuracy
              </div>
              <div
                className="font-mono-tabular font-bold text-lg text-[#34D399]"
                data-testid="summary-accuracy"
              >
                {runSnapshot.accuracyPct ?? 100}%
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#101715] border border-[#5E4923]">
              <div className="text-[10px] uppercase tracking-wider text-[#A89882] mb-0.5">
                Abhaya Parries
              </div>
              <div className="font-mono-tabular font-bold text-lg text-[#60A5FA]">
                {runSnapshot.parriesCount ?? 0}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartGame();
              }}
              className="w-full sm:w-auto flex-1 py-3 px-6 rounded bg-[#991B1B] hover:bg-[#B91C1C] border border-[#D4AF37] text-white font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Fight
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnToTitle();
              }}
              className="w-full sm:w-auto py-3 px-5 rounded border border-[#5E4923] bg-[#111916] hover:bg-[#1A2622] text-[#D6C7B2] text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              Title Screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

