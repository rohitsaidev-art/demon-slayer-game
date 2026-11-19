import React, { useEffect, useRef } from 'react';
import { DaanavPose } from '../game/rules';
import { CAVE_BACKGROUND_URL } from '../game/assets';

interface CavernBackdropProps {
  daanavPose: DaanavPose;
  burstTrigger: number;
  burstType: 'spell' | 'damage' | null;
  isPhase2Unbound?: boolean;
  daanavHp?: number;
}

type AmbientParticleKind = 'dust' | 'firefly' | 'ember' | 'burst';

interface Particle {
  active: boolean;
  kind: AmbientParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  decay: number;
  phase: number;
  phaseSpeed: number;
  color: string;
}

interface MistBand {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  alpha: number;
}

const AMBIENT_DUST_COUNT = 18;
const AMBIENT_FIREFLY_COUNT = 14;
const AMBIENT_EMBER_COUNT = 12;
const AMBIENT_TOTAL = AMBIENT_DUST_COUNT + AMBIENT_FIREFLY_COUNT + AMBIENT_EMBER_COUNT;
const POOL_SIZE = AMBIENT_TOTAL + 26;
const BUF_W = 480;
const BUF_H = 270;

export const CavernBackdrop: React.FC<CavernBackdropProps> = ({
  daanavPose,
  burstTrigger,
  burstType,
  isPhase2Unbound = false,
  daanavHp = 100,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mistRef = useRef<MistBand[]>([]);
  const lastBurstRef = useRef<number>(0);
  const phase2Ref = useRef<boolean>(isPhase2Unbound);

  useEffect(() => {
    phase2Ref.current = isPhase2Unbound;
  }, [isPhase2Unbound]);

  if (particlesRef.current.length === 0) {
    for (let i = 0; i < POOL_SIZE; i++) {
      let kind: AmbientParticleKind = 'burst';
      let color = '#FBBF24';
      let size = 1.4;
      let vx = 0;
      let vy = 0;
      let baseAlpha = 0.35;
      let phaseSpeed = 0.04;

      if (i < AMBIENT_DUST_COUNT) {
        // Subtle subterranean temple dust motes drifting slowly in the torchlight
        kind = 'dust';
        color = i % 2 === 0 ? '#D6C7B2' : '#B5A388';
        size = 0.8 + Math.random() * 1.1;
        vx = (Math.random() - 0.5) * 0.14;
        vy = -0.04 - Math.random() * 0.09;
        baseAlpha = 0.18 + Math.random() * 0.24;
        phaseSpeed = 0.025 + Math.random() * 0.02;
      } else if (i < AMBIENT_DUST_COUNT + AMBIENT_FIREFLY_COUNT) {
        // Bioluminescent cavern fireflies weaving with a soft pulsing halo
        kind = 'firefly';
        color = i % 3 === 0 ? '#34D399' : i % 2 === 0 ? '#FDE047' : '#6EE7B7';
        size = 1.2 + Math.random() * 1.3;
        vx = (Math.random() - 0.5) * 0.26;
        vy = (Math.random() - 0.5) * 0.18;
        baseAlpha = 0.45 + Math.random() * 0.45;
        phaseSpeed = 0.055 + Math.random() * 0.045;
      } else if (i < AMBIENT_TOTAL) {
        // Rising ritual brazier embers
        kind = 'ember';
        color = i % 2 === 0 ? '#FBBF24' : '#EF4444';
        size = 1.1 + Math.random() * 1.5;
        vx = (Math.random() - 0.5) * 0.32;
        vy = -0.24 - Math.random() * 0.38;
        baseAlpha = 0.3 + Math.random() * 0.45;
        phaseSpeed = 0.04 + Math.random() * 0.03;
      }

      particlesRef.current.push({
        active: i < AMBIENT_TOTAL,
        kind,
        x: Math.random() * BUF_W,
        y: Math.random() * BUF_H,
        vx,
        vy,
        size,
        alpha: baseAlpha,
        baseAlpha,
        decay: 0,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed,
        color,
      });
    }

    for (let m = 0; m < 4; m++) {
      mistRef.current.push({
        x: (m * 130) % BUF_W,
        y: 168 + (m % 2) * 32,
        width: 180 + (m % 2) * 60,
        height: 36 + (m % 2) * 14,
        vx: (m % 2 === 0 ? 1 : -1) * (0.16 + m * 0.03),
        alpha: 0.12 + (m % 2) * 0.04,
      });
    }
  }

  useEffect(() => {
    if (burstTrigger === 0 || burstTrigger === lastBurstRef.current) return;
    lastBurstRef.current = burstTrigger;

    const cx = BUF_W * 0.5;
    const cy = BUF_H * 0.45;
    const pool = particlesRef.current;
    let spawned = 0;
    const targetCount = 24;

    for (let i = AMBIENT_TOTAL; i < pool.length && spawned < targetCount; i++) {
      const p = pool[i];
      const angle = (Math.PI * 2 * spawned) / targetCount + (Math.random() - 0.5) * 0.3;
      const speed = 2.2 + Math.random() * 5.8;
      p.active = true;
      p.kind = 'burst';
      p.x = cx + (Math.random() - 0.5) * 30;
      p.y = cy + (Math.random() - 0.5) * 30;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 1.6 + Math.random() * 2.6;
      p.alpha = 1;
      p.baseAlpha = 1;
      p.decay = 0.028 + Math.random() * 0.018;
      p.color =
        burstType === 'spell'
          ? spawned % 2 === 0
            ? '#FBBF24'
            : '#EF4444'
          : '#DC2626';
      spawned++;
    }
  }, [burstTrigger, burstType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = BUF_W;
    canvas.height = BUF_H;

    let timerId = 0;
    let cancelled = false;
    let tickCount = 0;

    const render = () => {
      if (cancelled) return;
      tickCount++;
      ctx.clearRect(0, 0, BUF_W, BUF_H);

      // 1. Dynamic Torchlight Flicker & Subterranean Depth Fog
      const torchFlicker = 0.88 + Math.sin(tickCount * 0.16) * 0.12;
      const torchCoreColor = phase2Ref.current
        ? 'rgba(239, 68, 68, 0.24)'
        : 'rgba(245, 158, 11, 0.16)';

      const leftTorch = ctx.createRadialGradient(75, 130, 4, 75, 130, 110 * torchFlicker);
      leftTorch.addColorStop(0, torchCoreColor);
      leftTorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftTorch;
      ctx.fillRect(0, 20, 190, 220);

      const rightTorch = ctx.createRadialGradient(405, 130, 4, 405, 130, 110 * torchFlicker);
      rightTorch.addColorStop(0, torchCoreColor);
      rightTorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rightTorch;
      ctx.fillRect(290, 20, 190, 220);

      const mists = mistRef.current;
      for (let m = 0; m < mists.length; m++) {
        const band = mists[m];
        band.x += band.vx;
        if (band.x > BUF_W + band.width * 0.5) band.x = -band.width * 0.5;
        if (band.x < -band.width * 0.5) band.x = BUF_W + band.width * 0.5;

        ctx.fillStyle = phase2Ref.current
          ? `rgba(68, 18, 24, ${band.alpha * 1.25})`
          : `rgba(16, 48, 42, ${band.alpha})`;
        ctx.beginPath();
        ctx.ellipse(band.x, band.y, band.width * 0.45, band.height * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Temple Dust, Bioluminescent Fireflies, Embers & Combat Burst Particles
      const pool = particlesRef.current;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.active) continue;

        p.phase += p.phaseSpeed;

        if (p.kind === 'dust') {
          p.x += p.vx + Math.sin(p.phase) * 0.12;
          p.y += p.vy;
          p.alpha = p.baseAlpha * (0.65 + 0.35 * Math.sin(p.phase));
        } else if (p.kind === 'firefly') {
          p.x += p.vx + Math.cos(p.phase * 0.8) * 0.22;
          p.y += p.vy + Math.sin(p.phase * 1.1) * 0.16;
          p.alpha = p.baseAlpha * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.phase)));
        } else if (p.kind === 'ember') {
          p.x += p.vx + Math.sin(p.phase) * 0.08;
          p.y += p.vy;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }

        if (i < AMBIENT_TOTAL) {
          if (p.y < -8) {
            p.y = BUF_H + 8;
            p.x = Math.random() * BUF_W;
          } else if (p.y > BUF_H + 8) {
            p.y = -8;
            p.x = Math.random() * BUF_W;
          }
          if (p.x < -8) p.x = BUF_W + 8;
          if (p.x > BUF_W + 8) p.x = -8;
        } else {
          p.vx *= 0.93;
          p.vy *= 0.93;
          p.alpha -= p.decay;
          if (p.alpha <= 0.02) {
            p.active = false;
            continue;
          }
        }

        const clampedAlpha = Math.max(0, Math.min(1, p.alpha));
        if (p.kind === 'firefly') {
          // Soft outer bioluminescent halo
          ctx.globalAlpha = clampedAlpha * 0.32;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = clampedAlpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      timerId = window.setTimeout(render, 36);
    };

    timerId = window.setTimeout(render, 36);
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, []);

  const isAttacking = daanavPose === 'ATTACKING';
  const isHurt = daanavPose === 'HURT';
  const clampedHp = Math.max(0, Math.min(100, daanavHp));
  const missingHpRatio = (100 - clampedHp) / 100;

  // Select CSS depth-fog animation speed & intensity tier based on Daanav's current HP percentage
  const fogTier =
    clampedHp <= 30 ? 'critical' : clampedHp <= 65 ? 'ominous' : 'calm';
  const fogAnimClass =
    fogTier === 'critical'
      ? 'animate-depth-fog-critical'
      : fogTier === 'ominous'
      ? 'animate-depth-fog-ominous'
      : 'animate-depth-fog-calm';

  const crimsonFogAlpha = (0.12 + missingHpRatio * 0.38).toFixed(3);
  const abyssalFogAlpha = (0.28 + missingHpRatio * 0.34).toFixed(3);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 bg-[#050807]">
      {/* Photorealistic Ancient Subterranean Temple Cave Background */}
      <img
        src={CAVE_BACKGROUND_URL}
        alt="Subterranean Ancient Temple Cavern"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover object-center transition-transform duration-300 ease-out will-change-transform ${
          isAttacking ? 'scale-108' : isHurt ? 'scale-104' : 'scale-100'
        }`}
      />

      {/* Atmospheric Dark Sanctuary Scrim */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(4, 10, 9, 0.22) 0%, rgba(5, 8, 7, 0.58) 62%, rgba(3, 5, 4, 0.9) 100%)',
        }}
      />

      {/* Dynamic CSS Depth-Fog Overlay that pulses and intensifies as Daanav's HP drops */}
      <div
        data-testid="dynamic-depth-fog"
        data-fog-tier={fogTier}
        className={`absolute inset-0 pointer-events-none ${fogAnimClass}`}
        style={{
          background: `radial-gradient(ellipse 85% 48% at 50% 78%, rgba(153, 27, 27, ${crimsonFogAlpha}) 0%, rgba(12, 38, 33, ${abyssalFogAlpha}) 52%, rgba(0, 0, 0, 0) 92%)`,
        }}
      />

      {/* Pooled Torchlight, Temple Dust, Bioluminescent Fireflies & Ember Particle Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="cavern-particle-canvas"
        className="absolute inset-0 w-full h-full"
      />

      {/* Attacking Blood-Moon Crimson Shockwave Vignette */}
      <div
        className={`absolute inset-0 transition-opacity duration-150 ${
          isAttacking ? 'opacity-95' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(185, 28, 28, 0.18) 20%, rgba(153, 27, 27, 0.6) 68%, rgba(85, 10, 10, 0.92) 100%)',
        }}
      />

      {/* Spell Hit Golden-Saffron Sanctuary Flash */}
      <div
        className={`absolute inset-0 transition-opacity duration-150 ${
          isHurt ? 'opacity-85' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 43%, rgba(251, 191, 36, 0.28) 0%, rgba(220, 38, 38, 0.16) 45%, transparent 75%)',
        }}
      />
    </div>
  );
};
