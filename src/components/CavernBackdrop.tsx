import React, { useEffect, useRef } from 'react';
import { DaanavPose } from '../game/rules';
import { CAVE_BACKGROUND_URL } from '../game/assets';

interface CavernBackdropProps {
  daanavPose: DaanavPose;
  burstTrigger: number;
  burstType: 'spell' | 'damage' | null;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
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

const POOL_SIZE = 60;
const BUF_W = 480;
const BUF_H = 270;

export const CavernBackdrop: React.FC<CavernBackdropProps> = ({
  daanavPose,
  burstTrigger,
  burstType,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mistRef = useRef<MistBand[]>([]);
  const lastBurstRef = useRef<number>(0);

  if (particlesRef.current.length === 0) {
    for (let i = 0; i < POOL_SIZE; i++) {
      particlesRef.current.push({
        active: i < 22,
        x: Math.random() * BUF_W,
        y: Math.random() * BUF_H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.2 - Math.random() * 0.4,
        size: 1.2 + Math.random() * 1.8,
        alpha: 0.25 + Math.random() * 0.55,
        decay: 0,
        color: i % 3 === 0 ? '#34D399' : i % 2 === 0 ? '#FBBF24' : '#EF4444',
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

    for (let i = 22; i < pool.length && spawned < targetCount; i++) {
      const p = pool[i];
      const angle = (Math.PI * 2 * spawned) / targetCount + (Math.random() - 0.5) * 0.3;
      const speed = 2.2 + Math.random() * 5.8;
      p.active = true;
      p.x = cx + (Math.random() - 0.5) * 30;
      p.y = cy + (Math.random() - 0.5) * 30;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 1.6 + Math.random() * 2.6;
      p.alpha = 1;
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

      const leftTorch = ctx.createRadialGradient(75, 130, 4, 75, 130, 110 * torchFlicker);
      leftTorch.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
      leftTorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftTorch;
      ctx.fillRect(0, 20, 190, 220);

      const rightTorch = ctx.createRadialGradient(405, 130, 4, 405, 130, 110 * torchFlicker);
      rightTorch.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
      rightTorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rightTorch;
      ctx.fillRect(290, 20, 190, 220);

      const mists = mistRef.current;
      for (let m = 0; m < mists.length; m++) {
        const band = mists[m];
        band.x += band.vx;
        if (band.x > BUF_W + band.width * 0.5) band.x = -band.width * 0.5;
        if (band.x < -band.width * 0.5) band.x = BUF_W + band.width * 0.5;

        ctx.fillStyle = `rgba(16, 48, 42, ${band.alpha})`;
        ctx.beginPath();
        ctx.ellipse(band.x, band.y, band.width * 0.45, band.height * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Ambient Embers & Combat Burst Particles
      const pool = particlesRef.current;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.active) continue;

        p.x += p.vx;
        p.y += p.vy;

        if (i < 22) {
          if (p.y < -8) {
            p.y = BUF_H + 8;
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

        ctx.globalAlpha = Math.max(0, p.alpha);
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

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 bg-[#050807]">
      {/* Photorealistic Ancient Subterranean Temple Cave Background (Compositor transform only, zero CSS filter lag) */}
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

      {/* Lightweight Pooled Torchlight, Depth Fog & Ember Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

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
