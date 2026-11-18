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

  // Zero-cost GPU radial-gradient aura behind Daanav (replaces expensive per-frame CSS drop-shadow blur)
  const auraGradient = isAttacking
    ? 'radial-gradient(circle, rgba(220, 38, 38, 0.58) 0%, rgba(153, 27, 27, 0.25) 48%, rgba(0, 0, 0, 0) 74%)'
    : isHurt
    ? 'radial-gradient(circle, rgba(251, 191, 36, 0.65) 0%, rgba(239, 68, 68, 0.28) 48%, rgba(0, 0, 0, 0) 74%)'
    : isEnraged
    ? 'radial-gradient(circle, rgba(185, 28, 28, 0.32) 0%, rgba(20, 83, 65, 0.14) 52%, rgba(0, 0, 0, 0) 75%)'
    : 'radial-gradient(circle, rgba(16, 68, 55, 0.28) 0%, rgba(0, 0, 0, 0.45) 55%, rgba(0, 0, 0, 0) 75%)';

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
        {/* Lightweight GPU Radial Backlight Aura */}
        <div
          className="absolute inset-2 rounded-full pointer-events-none"
          style={{ background: auraGradient }}
        />

        {/* Ground Contact Shadow anchoring Daanav to the wet temple stone floor */}
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[78%] h-12 rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 55%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Single Active Pre-Decoded Sprite (Zero CSS filter convolution for locked 60fps) */}
        <img
          src={DAANAV_SPRITE_URLS[pose]}
          alt="Daanav Demon Boss"
          decoding="async"
          referrerPolicy="no-referrer"
          className="relative z-10 w-full h-full object-contain select-none"
        />

        {/* Foreground Subterranean Floor Mist Lapping Over Daanav's Feet */}
        <div
          className="absolute inset-x-0 bottom-0 h-14 z-20 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(6, 14, 12, 0.72) 0%, rgba(12, 28, 24, 0.25) 55%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
};
