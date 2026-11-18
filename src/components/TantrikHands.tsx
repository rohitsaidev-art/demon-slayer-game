import React, { useEffect } from 'react';
import { MudraId, MUDRA_BY_ID } from '../game/rules';
import { HAND_SPRITE_URLS, preloadGameAssets } from '../game/assets';

interface TantrikHandSvgProps {
  side: 'left' | 'right';
  handedness?: 'left' | 'right';
  mudra: MudraId;
  isMatched: boolean;
  isActiveInput: boolean;
}

export const TantrikHandSvg: React.FC<TantrikHandSvgProps> = ({
  side,
  mudra,
  isMatched,
}) => {
  useEffect(() => {
    preloadGameAssets();
  }, []);

  // Always orient based on the viewport hand slot (`side`) so that regardless of
  // the camera's raw handedness output orientation:
  // - The left-hand slot (`side === 'left'`) uses `scaleX(1)` and tilts inward (+5deg).
  // - The right-hand slot (`side === 'right'`) applies an explicit CSS `scaleX(-1)`
  //   transform and tilts inward (-5deg) so both Mudra hands always face inward.
  const isRightHand = side === 'right';

  return (
    <div
      className="relative w-full h-full select-none"
      data-matched={isMatched ? 'true' : 'false'}
      data-handedness={side}
      data-mirrored={isRightHand ? 'true' : 'false'}
      data-inward="true"
      style={{
        transform: isRightHand ? 'scaleX(-1)' : 'scaleX(1)',
      }}
    >
      {/* Sacred Golden-Yellow & Agni Orange-Red Aura when Mudra is properly formed */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          opacity: isMatched ? 1 : 0,
          background:
            'radial-gradient(ellipse 42% 38% at 50% 58%, rgba(254, 240, 138, 0.6) 0%, rgba(251, 191, 36, 0.38) 45%, rgba(249, 115, 22, 0.16) 72%, rgba(0, 0, 0, 0) 96%)',
        }}
      />

      {/* Stationary First-Person Tantrik Hand Sprite anchored flush to the bottom border and facing inward */}
      <img
        src={HAND_SPRITE_URLS[mudra]}
        alt={`${side} Tantrik hand showing ${MUDRA_BY_ID[mudra].englishName}`}
        decoding="async"
        referrerPolicy="no-referrer"
        className="relative z-10 w-full h-full object-contain object-bottom"
        style={{
          transformOrigin: '50% 100%',
          transform: 'translate3d(-3%, 11%, 0) rotate(5deg)',
          filter: isMatched
            ? 'drop-shadow(0 0 14px rgba(251, 191, 36, 0.92)) drop-shadow(0 0 28px rgba(249, 115, 22, 0.65)) brightness(1.08)'
            : 'none',
        }}
      />
    </div>
  );
};
