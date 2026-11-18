export type SpellParticleKind = 'orb' | 'streak' | 'spark' | 'ring';

export interface SpellParticle {
  active: boolean;
  kind: SpellParticleKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  size: number;
  maxSize: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  coreColor: string;
  rotation: number;
  vRot: number;
}

export interface SpellPoolState {
  particles: SpellParticle[];
  flashIntensity: number;
  beamProgress: number;
}

export const SPELL_POOL_CAPACITY = 140;

const SPELL_PALETTE = [
  { color: '#F59E0B', core: '#FEF08A' }, // Sacred Saffron Gold
  { color: '#EF4444', core: '#FECACA' }, // Tantrik Crimson Fire
  { color: '#FBBF24', core: '#FFFFFF' }, // Solar Mantra Gold
  { color: '#FB923C', core: '#FEF3C7' }, // Agni Orange
];

export function createSpellParticlePool(capacity: number = SPELL_POOL_CAPACITY): SpellPoolState {
  const particles: SpellParticle[] = [];
  for (let i = 0; i < capacity; i++) {
    particles.push({
      active: false,
      kind: 'orb',
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      size: 4,
      maxSize: 4,
      alpha: 0,
      life: 0,
      maxLife: 1,
      color: '#FBBF24',
      coreColor: '#FFFFFF',
      rotation: 0,
      vRot: 0,
    });
  }
  return {
    particles,
    flashIntensity: 0,
    beamProgress: 0,
  };
}

function allocateSlot(pool: SpellParticle[]): SpellParticle | null {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      return pool[i];
    }
  }
  // Recycle oldest particle if all slots are active
  let oldest = pool[0];
  for (let i = 1; i < pool.length; i++) {
    if (pool[i].life > oldest.life) {
      oldest = pool[i];
    }
  }
  return oldest ?? null;
}

/**
 * Triggers a magical energy burst emanating from the center of the screen
 * and surging toward the Daanav target coordinates.
 */
export function triggerSpellCastBurst(
  state: SpellPoolState,
  width: number,
  height: number,
  streak: number = 1,
  rng: () => number = Math.random
): number {
  const originX = width * 0.5;
  const originY = height * 0.54; // Screen center focal origin
  const targetX = width * 0.5;
  const targetY = height * 0.41; // Daanav chest/core target

  state.flashIntensity = 1.0;
  state.beamProgress = 1.0;

  let spawnedCount = 0;
  const intensityScale = 1 + Math.min(streak, 6) * 0.08;

  // 1. Expanding Sacred Yantra Shockwave Rings (3 concentric rings moving from center toward Daanav)
  for (let r = 0; r < 3; r++) {
    const slot = allocateSlot(state.particles);
    if (!slot) break;
    const t = r / 2;
    slot.active = true;
    slot.kind = 'ring';
    slot.x = originX + (targetX - originX) * t;
    slot.y = originY + (targetY - originY) * t;
    slot.prevX = slot.x;
    slot.prevY = slot.y;
    slot.vx = 0;
    slot.vy = -1.6 - r * 0.8;
    slot.ax = 0;
    slot.ay = 0;
    slot.size = 14 + r * 12;
    slot.maxSize = (115 + r * 38) * intensityScale;
    slot.alpha = 1;
    slot.life = 0;
    slot.maxLife = 16 + r * 4;
    slot.color = r % 2 === 0 ? '#FBBF24' : '#EF4444';
    slot.coreColor = '#FEF08A';
    slot.rotation = rng() * Math.PI;
    slot.vRot = (r % 2 === 0 ? 1 : -1) * 0.08;
    spawnedCount++;
  }

  // 2. High-Velocity Magical Energy Streaks surging from screen center into Daanav
  const streakCount = 34;
  for (let i = 0; i < streakCount; i++) {
    const slot = allocateSlot(state.particles);
    if (!slot) break;
    const palette = SPELL_PALETTE[i % SPELL_PALETTE.length];
    const angle = (Math.PI * 2 * i) / streakCount + (rng() - 0.5) * 0.25;
    const initialRadius = 6 + rng() * 24;
    const startX = originX + Math.cos(angle) * initialRadius;
    const startY = originY + Math.sin(angle) * initialRadius;

    // Combine radial burst velocity with strong homing acceleration toward Daanav's chest
    const speed = (4.5 + rng() * 9.5) * intensityScale;
    const toTargetX = targetX + (rng() - 0.5) * 90 - startX;
    const toTargetY = targetY + (rng() - 0.5) * 80 - startY;

    slot.active = true;
    slot.kind = 'streak';
    slot.x = startX;
    slot.y = startY;
    slot.prevX = startX;
    slot.prevY = startY;
    slot.vx = Math.cos(angle) * speed * 0.65 + toTargetX * 0.06;
    slot.vy = Math.sin(angle) * speed * 0.55 + toTargetY * 0.09 - 2.5;
    slot.ax = (targetX - startX) * 0.012;
    slot.ay = (targetY - startY) * 0.018;
    slot.size = 2.8 + rng() * 3.8;
    slot.maxSize = slot.size;
    slot.alpha = 1;
    slot.life = 0;
    slot.maxLife = 14 + Math.floor(rng() * 10);
    slot.color = palette.color;
    slot.coreColor = palette.core;
    slot.rotation = angle;
    slot.vRot = 0;
    spawnedCount++;
  }

  // 3. Glowing Mantra Energy Orbs & Explosive Impact Sparks around Daanav
  const orbCount = 42;
  for (let i = 0; i < orbCount; i++) {
    const slot = allocateSlot(state.particles);
    if (!slot) break;
    const palette = SPELL_PALETTE[(i + 1) % SPELL_PALETTE.length];
    const isCoreSpark = i < 20;
    const angle = rng() * Math.PI * 2;
    const speed = (isCoreSpark ? 2.5 + rng() * 7.5 : 5 + rng() * 12) * intensityScale;

    const spawnX = isCoreSpark ? originX + (rng() - 0.5) * 30 : targetX + (rng() - 0.5) * 44;
    const spawnY = isCoreSpark ? originY + (rng() - 0.5) * 30 : targetY + (rng() - 0.5) * 44;

    slot.active = true;
    slot.kind = isCoreSpark ? 'orb' : 'spark';
    slot.x = spawnX;
    slot.y = spawnY;
    slot.prevX = spawnX;
    slot.prevY = spawnY;
    slot.vx = Math.cos(angle) * speed;
    slot.vy = Math.sin(angle) * speed - (isCoreSpark ? 3.2 : 0.8);
    slot.ax = isCoreSpark ? (targetX - spawnX) * 0.015 : 0;
    slot.ay = isCoreSpark ? (targetY - spawnY) * 0.02 : 0.18; // Sparks have slight gravity after impact
    slot.size = isCoreSpark ? 5 + rng() * 6 : 2.2 + rng() * 3.5;
    slot.maxSize = slot.size;
    slot.alpha = 1;
    slot.life = 0;
    slot.maxLife = 16 + Math.floor(rng() * 12);
    slot.color = palette.color;
    slot.coreColor = palette.core;
    slot.rotation = rng() * Math.PI * 2;
    slot.vRot = (rng() - 0.5) * 0.2;
    spawnedCount++;
  }

  return spawnedCount;
}

/**
 * Advances all active spell particles by one simulation step.
 * Returns the number of currently active particles.
 */
export function stepSpellParticles(state: SpellPoolState): number {
  state.flashIntensity = Math.max(0, state.flashIntensity - 0.085);
  state.beamProgress = Math.max(0, state.beamProgress - 0.075);

  let activeCount = 0;
  const pool = state.particles;

  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.active) continue;

    p.life += 1;
    if (p.life >= p.maxLife) {
      p.active = false;
      p.alpha = 0;
      continue;
    }

    const progress = p.life / p.maxLife;
    p.prevX = p.x;
    p.prevY = p.y;

    p.vx = (p.vx + p.ax) * 0.94;
    p.vy = (p.vy + p.ay) * 0.94;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.vRot;

    if (p.kind === 'ring') {
      p.size = p.size + (p.maxSize - p.size) * 0.24;
      p.alpha = Math.max(0, 1 - Math.pow(progress, 1.3));
    } else {
      p.alpha = Math.max(0, 1 - Math.pow(progress, 1.5));
    }

    activeCount++;
  }

  return activeCount;
}
