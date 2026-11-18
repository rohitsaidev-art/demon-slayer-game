import React, { useEffect } from 'react';
import { DaanavPose } from '../game/rules';
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
  useEffect(() => {
    preloadGameAssets();
  }, []);

  const isHurt = pose === 'HURT';
  const isAttacking = pose === 'ATTACKING';
  const isEnraged = hp <= 40;

  const containerAnimClass = isAttacking
    ? 'animate-daanav-attack'
    : isHurt
    ? 'animate-daanav-hurt'
    : 'animate-daanav-idle';

  // Pure additive-style radial backlight with zero black color stops so no dark vignette
  // or sharp corners ever appear around Daanav's legs when he leaps forward.
  const auraGradient = isAttacking
    ? 'radial-gradient(circle at 50% 48%, rgba(220, 38, 38, 0.42) 0%, rgba(153, 27, 27, 0.16) 44%, rgba(0, 0, 0, 0) 70%)'
    : isHurt
    ? 'radial-gradient(circle at 50% 45%, rgba(245, 245, 244, 0.55) 0%, rgba(185, 28, 28, 0.28) 46%, rgba(0, 0, 0, 0) 72%)'
    : isEnraged
    ? 'radial-gradient(circle at 50% 48%, rgba(185, 28, 28, 0.24) 0%, rgba(185, 28, 28, 0) 68%)'
    : 'none';

  return (
    <div
      className="relative flex flex-col items-center justify-center pointer-events-none select-none z-10"
      data-testid="daanav-boss"
      data-pose={pose}
    >
      {/* Chiseled Floating Combat Shout Banner ("STOP!", "PAIN!", "AGH!", "ENOUGH!", "BLOOD!", "BURN!", "DIE!") */}
      <div
        className={`h-14 flex items-end justify-center transition-transform duration-150 ${
          isAttacking ? '-translate-y-10 mb-3' : 'mb-1'
        }`}
      >
        {shoutText && (
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
