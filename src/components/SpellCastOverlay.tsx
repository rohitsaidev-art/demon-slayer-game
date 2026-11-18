import React, { useEffect, useRef } from 'react';
import {
  createSpellParticlePool,
  SpellPoolState,
  stepSpellParticles,
  triggerSpellCastBurst,
} from '../game/spellParticles';

interface SpellCastOverlayProps {
  spellTrigger: number;
  streak: number;
}

const CANVAS_W = 720;
const CANVAS_H = 450;

export const SpellCastOverlay: React.FC<SpellCastOverlayProps> = ({
  spellTrigger,
  streak,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poolRef = useRef<SpellPoolState | null>(null);
  const lastTriggerRef = useRef<number>(0);
  const loopTimerRef = useRef<number | null>(null);

  if (!poolRef.current) {
    poolRef.current = createSpellParticlePool();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const pool = poolRef.current;
    if (!canvas || !pool) return;

    if (spellTrigger === 0 || spellTrigger === lastTriggerRef.current) return;
    lastTriggerRef.current = spellTrigger;

    triggerSpellCastBurst(pool, CANVAS_W, CANVAS_H, streak);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (loopTimerRef.current !== null) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }

    const originX = CANVAS_W * 0.5;
    const originY = CANVAS_H * 0.54;
    const targetX = CANVAS_W * 0.5;
    const targetY = CANVAS_H * 0.41;

    const renderStep = () => {
      const activeCount = stepSpellParticles(pool);

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // 1. Central Magical Vortex Flash & Twin Hand-to-Center Channeling Beams
      if (pool.beamProgress > 0.02) {
        const bp = pool.beamProgress;

        // Twin arcs from Left Hand (135, 360) and Right Hand (585, 360) to Center Vortex (originX, originY)
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(251, 191, 36, ${bp * 0.65})`;
        ctx.lineWidth = 6 * bp;
        ctx.beginPath();
        ctx.moveTo(135, 365);
        ctx.quadraticCurveTo(230, 270, originX, originY);
        ctx.moveTo(585, 365);
        ctx.quadraticCurveTo(490, 270, originX, originY);
        ctx.stroke();

        // Main Central Energy Beam surging from Screen Center (originX, originY) to Daanav (targetX, targetY)
        const beamGrad = ctx.createLinearGradient(originX, originY, targetX, targetY);
        beamGrad.addColorStop(0, `rgba(254, 240, 138, ${bp * 0.95})`);
        beamGrad.addColorStop(0.5, `rgba(245, 158, 11, ${bp * 0.85})`);
        beamGrad.addColorStop(1, `rgba(239, 68, 68, ${bp * 0.9})`);

        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 22 * bp;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        // White-hot inner core of the beam
        ctx.strokeStyle = `rgba(255, 255, 255, ${bp * 0.95})`;
        ctx.lineWidth = 7 * bp;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        // Radial Nova Glow at Screen Center & Daanav Impact Point
        const impactGlow = ctx.createRadialGradient(
          targetX,
          targetY,
          4,
          targetX,
          targetY,
          95 * (1.2 - bp * 0.3)
        );
        impactGlow.addColorStop(0, `rgba(255, 255, 255, ${bp * 0.9})`);
        impactGlow.addColorStop(0.35, `rgba(251, 191, 36, ${bp * 0.65})`);
        impactGlow.addColorStop(0.7, `rgba(220, 38, 38, ${bp * 0.35})`);
        impactGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = impactGlow;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 95, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Render Active Spell Particles (Rings, Streaks, Orbs, Sparks)
      const particles = pool.particles;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.active || p.alpha <= 0.01) continue;

        ctx.globalAlpha = p.alpha;

        if (p.kind === 'ring') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);

          // Outer Yantra Shockwave Ring
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * p.alpha;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.stroke();

          // Sacred 6-Point Star / Hexagram inscribed inside the expanding ring
          const r = p.size * 0.86;
          ctx.strokeStyle = p.coreColor;
          ctx.lineWidth = 1.6 * p.alpha;
          ctx.beginPath();
          for (let t = 0; t < 2; t++) {
            const offset = t * (Math.PI / 3);
            for (let v = 0; v < 3; v++) {
              const a = offset + (v * Math.PI * 2) / 3;
              const vx = Math.cos(a) * r;
              const vy = Math.sin(a) * r;
              if (v === 0) ctx.moveTo(vx, vy);
              else ctx.lineTo(vx, vy);
            }
            ctx.closePath();
          }
          ctx.stroke();
          ctx.restore();
        } else if (p.kind === 'streak') {
          // High-velocity magical energy bolt with tail
          const tailX = p.x - p.vx * 2.6;
          const tailY = p.y - p.vy * 2.6;

          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 1.35;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();

          ctx.strokeStyle = p.coreColor;
          ctx.lineWidth = p.size * 0.55;
          ctx.beginPath();
          ctx.moveTo(p.prevX, p.prevY);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (p.kind === 'orb') {
          // Glowing Mantra Energy Orb
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = p.coreColor;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Diamond / Star Spark
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.coreColor;
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.8);
          ctx.lineTo(s * 0.6, 0);
          ctx.lineTo(0, s * 1.8);
          ctx.lineTo(-s * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();

      if (activeCount > 0 || pool.beamProgress > 0.01) {
        loopTimerRef.current = window.setTimeout(renderStep, 30);
      } else {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        loopTimerRef.current = null;
      }
    };

    renderStep();

    return () => {
      if (loopTimerRef.current !== null) {
        clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };
  }, [spellTrigger, streak]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      data-testid="spell-cast-canvas"
      className="fixed inset-0 w-full h-full pointer-events-none select-none z-25"
    />
  );
};
