import React, { useEffect, useRef, useState } from 'react';
import {
  DaanavPose,
  getDaanavTauntTier,
  selectDaanavIdleTaunt,
} from '../game/rules';
import { DAANAV_SPRITE_URLS, preloadGameAssets } from '../game/assets';

interface DaanavBossProps {
  pose: DaanavPose;
  shoutText: string | null;
  shoutKey: number;
  hp: number;
}

export const DaanavBoss: React.FC<DaanavBossProps> = ({
  pose,
  shoutText,
  shoutKey,
  hp,
}) => {
  const [idleTaunt, setIdleTaunt] = useState<string>(() =>
    selectDaanavIdleTaunt(hp, null)
  );
  const [idleTauntKey, setIdleTauntKey] = useState<number>(1);
  const lastTauntRef = useRef<string>(idleTaunt);
  const hpRef = useRef<number>(hp);

  useEffect(() => {
    preloadGameAssets();
  }, []);

  useEffect(() => {
    const prevTier = getDaanavTauntTier(hpRef.current);
    const nextTier = getDaanavTauntTier(hp);
    hpRef.current = hp;

    if (pose === 'IDLE' && prevTier !== nextTier) {
      const next = selectDaanavIdleTaunt(hp, lastTauntRef.current);
      lastTauntRef.current = next;
      setIdleTaunt(next);
      setIdleTauntKey((k) => k + 1);
    }
  }, [hp, pose]);

  useEffect(() => {
    if (pose !== 'IDLE') return;

    const initial = selectDaanavIdleTaunt(hpRef.current, lastTauntRef.current);
    lastTauntRef.current = initial;
    setIdleTaunt(initial);
    setIdleTauntKey((k) => k + 1);

    const intervalId = window.setInterval(() => {
      const next = selectDaanavIdleTaunt(hpRef.current, lastTauntRef.current);
      lastTauntRef.current = next;
      setIdleTaunt(next);
      setIdleTauntKey((k) => k + 1);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, [pose]);

  const isHurt = pose === 'HURT';
  const isAttacking = pose === 'ATTACKING';
  const isIdle = pose === 'IDLE';
  const isEnraged = hp > 0 && hp <= 50;
  const tauntTier = getDaanavTauntTier(hp);

  const containerAnimClass = isAttacking
    ? 'animate-daanav-attack'
    : isHurt
    ? 'animate-daanav-hurt'
    : 'animate-daanav-idle';

  // Pure additive-style radial backlight with zero black color stops so no dark vignette
  // or sharp corners ever appear around Daanav's legs when he leaps forward.
  const auraGradient = isAttacking
    ? 'radial-gradient(circle at 50% 48%, rgba(220, 38, 38, 0.44) 0%, rgba(153, 27, 27, 0.18) 44%, rgba(0, 0, 0, 0) 70%)'
    : isHurt
    ? 'radial-gradient(circle at 50% 45%, rgba(245, 245, 244, 0.55) 0%, rgba(185, 28, 28, 0.28) 46%, rgba(0, 0, 0, 0) 72%)'
    : isEnraged
    ? 'radial-gradient(circle at 50% 48%, rgba(239, 68, 68, 0.34) 0%, rgba(212, 175, 55, 0.15) 42%, rgba(185, 28, 28, 0) 70%)'
    : 'none';

  return (
    <div
      className="relative flex flex-col items-center justify-center pointer-events-none select-none z-10"
      data-testid="daanav-boss"
      data-pose={pose}
      data-phase2={isEnraged ? 'true' : 'false'}
    >
      {/* Chiseled Floating Combat Shout Banner (HURT / ATTACKING) or Dynamic Health-Tiered IDLE Taunt */}
      <div
        className={`h-14 flex items-end justify-center transition-transform duration-150 ${
          isAttacking ? '-translate-y-10 mb-3' : 'mb-1'
        }`}
      >
        {!isIdle && shoutText ? (
          <div
            key={shoutKey}
            className="animate-shout font-display font-black tracking-widest text-3xl md:text-5xl text-[#F87171] uppercase"
            style={{
              textShadow: '0 3px 0 #3B0707, 0 0 22px rgba(239, 35, 35, 0.9)',
              WebkitTextStroke: '1.5px #7F1D1D',
            }}
          >
            {shoutText}
          </div>
        ) : (
          isIdle && (
            <div
              key={idleTauntKey}
              data-testid="daanav-idle-taunt"
              data-taunt-tier={tauntTier}
              className={`animate-idle-taunt px-4 py-1 rounded border bg-[#090D0C]/90 shadow-[0_6px_18px_rgba(0,0,0,0.9)] font-display font-bold text-xs md:text-sm tracking-wider uppercase text-center whitespace-nowrap ${
                tauntTier === 'low'
                  ? 'border-[#EF4444] text-[#FCA5A5]'
                  : tauntTier === 'mid'
                  ? 'border-[#F59E0B] text-[#FDE68A]'
                  : 'border-[#8C6D32] text-[#E5D5BE]'
              }`}
            >
              “{idleTaunt}”
            </div>
          )
        )}
      </div>

      {/* Photorealistic Horned Daanav King Container */}
      <div
        className={`relative w-[320px] h-[320px] sm:w-[385px] sm:h-[385px] md:w-[455px] md:h-[455px] origin-bottom ${containerAnimClass}`}
      >
        {/* Clean Radial Backlight Aura (Zero dark vignette or rectangular clipping) */}
        {auraGradient !== 'none' && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: auraGradient }}
          />
        )}

        {/* Active Pre-Decoded Daanav Sprite — Desaturated Greyscale / Dull Ash-White when HURT */}
        <img
          src={DAANAV_SPRITE_URLS[pose]}
          alt="Daanav Demon Boss"
          decoding="async"
          referrerPolicy="no-referrer"
          className="relative z-10 w-full h-full object-contain select-none"
          style={{
            filter: isHurt
              ? 'grayscale(1) brightness(1.36) contrast(1.14) drop-shadow(0 0 18px rgba(255, 255, 255, 0.45))'
              : 'none',
          }}
        />
      </div>
    </div>
  );
};
