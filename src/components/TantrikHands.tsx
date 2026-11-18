import React, { useEffect } from 'react';
import { MudraId, MUDRA_BY_ID } from '../game/rules';
import { HAND_SPRITE_URLS, preloadGameAssets } from '../game/assets';

interface TantrikHandSvgProps {
  side: 'left' | 'right';
  mudra: MudraId;
  isMatched: boolean;
  isActiveInput: boolean;
}

export const TantrikHandSvg: React.FC<TantrikHandSvgProps> = ({
  side,
  mudra,
  isMatched,
  isActiveInput,
}) => {
  useEffect(() => {
    preloadGameAssets();
  }, []);

  // Anatomical orientation:
  // `hand_palm`, `hand_fist`, `hand_victory`, `hand_horns`, and `hand_point` have the thumb/index
  // on the right side (natural Left Hand dorsal view), so we mirror them for the Right Hand (`scaleX(-1)`).
  // `hand_thumb` has the thumb extending to the left, so we mirror it for the Left Hand and keep
  // it un-mirrored for the Right Hand so both thumbs point inward toward the center of the screen!
  const shouldMirror =
    mudra === 'Thumb_Up' ? side === 'left' : side === 'right';

  return (
    <div
      className={`relative w-full h-full select-none transition-transform duration-150 ease-out will-change-transform ${
        isMatched
          ? 'scale-105 -translate-y-3 opacity-100'
          : isActiveInput
          ? 'scale-100 translate-y-0 opacity-95'
          : 'scale-95 translate-y-3 opacity-80'
      }`}
    >
      {/* Zero-cost GPU Radial Aura behind hand (replaces expensive CSS drop-shadow filter) */}
      <div
        className="absolute inset-6 rounded-full pointer-events-none transition-opacity duration-150"
        style={{
          opacity: isMatched ? 1 : 0.45,
          background: isMatched
            ? 'radial-gradient(circle, rgba(251, 191, 36, 0.42) 0%, rgba(220, 38, 38, 0.18) 52%, rgba(0, 0, 0, 0) 74%)'
            : 'radial-gradient(circle, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 70%)',
        }}
      />

      {/* Single Active Pre-Decoded Hand Sprite */}
      <img
        src={HAND_SPRITE_URLS[mudra]}
        alt={`${side} Tantrik hand showing ${MUDRA_BY_ID[mudra].englishName}`}
        decoding="async"
        referrerPolicy="no-referrer"
        className="relative z-10 w-full h-full object-contain object-bottom"
        style={{
          transform: shouldMirror ? 'scaleX(-1)' : 'scaleX(1)',
        }}
      />
    </div>
  );
};
