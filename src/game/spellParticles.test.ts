import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpellParticlePool,
  triggerSpellCastBurst,
  stepSpellParticles,
  SPELL_POOL_CAPACITY,
} from './spellParticles';

test('createSpellParticlePool initializes fixed-capacity inactive particle pool', () => {
  const pool = createSpellParticlePool();
  assert.equal(pool.particles.length, SPELL_POOL_CAPACITY);
  assert.equal(pool.particles.every((p) => !p.active), true);
  assert.equal(pool.flashIntensity, 0);
});

test('triggerSpellCastBurst spawns rings, streaks, orbs, and sparks emanating from screen center toward Daanav', () => {
  const pool = createSpellParticlePool();
  const spawned = triggerSpellCastBurst(pool, 720, 450, 2, () => 0.5);
  assert.ok(spawned >= 70);
  assert.equal(pool.flashIntensity, 1.0);
  assert.equal(pool.beamProgress, 1.0);

  const active = pool.particles.filter((p) => p.active);
  assert.equal(active.length, spawned);

  const rings = active.filter((p) => p.kind === 'ring');
  const streaks = active.filter((p) => p.kind === 'streak');
  const orbs = active.filter((p) => p.kind === 'orb');
  const sparks = active.filter((p) => p.kind === 'spark');

  assert.equal(rings.length, 3);
  assert.ok(streaks.length > 20);
  assert.ok(orbs.length > 10);
  assert.ok(sparks.length > 10);
});

test('stepSpellParticles advances positions toward Daanav and expires particles cleanly', () => {
  const pool = createSpellParticlePool();
  triggerSpellCastBurst(pool, 720, 450, 1, () => 0.5);

  const firstRing = pool.particles.find((p) => p.active && p.kind === 'ring')!;
  const initialRingSize = firstRing.size;
  const initialY = firstRing.y;

  const activeAfter1 = stepSpellParticles(pool);
  assert.ok(activeAfter1 > 0);
  assert.ok(firstRing.size > initialRingSize, 'Shockwave ring should expand');
  assert.ok(firstRing.y < initialY, 'Shockwave ring should travel upward toward Daanav');

  // Step until all particles complete their lifecycle
  for (let i = 0; i < 40; i++) {
    stepSpellParticles(pool);
  }
  const remaining = stepSpellParticles(pool);
  assert.equal(remaining, 0);
  assert.equal(pool.flashIntensity, 0);
});
