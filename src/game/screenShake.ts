export interface ScreenShakeSpringState {
  x: number;
  y: number;
  rotationDeg: number;
  vx: number;
  vy: number;
  vRot: number;
  stiffnessX: number;
  stiffnessY: number;
  stiffnessRot: number;
  damping: number;
  active: boolean;
}

export function createScreenShakeState(): ScreenShakeSpringState {
  return {
    x: 0,
    y: 0,
    rotationDeg: 0,
    vx: 0,
    vy: 0,
    vRot: 0,
    stiffnessX: 720,
    stiffnessY: 580,
    stiffnessRot: 640,
    damping: 13.5,
    active: false,
  };
}

/**
 * Applies a heavy demonic impact impulse to the 2D spring-damper screen shake system.
 * Uses Hooke's law (F = -k*x - c*v) so the viewport jolts sharply on Daanav's attack
 * and rebounds with natural underdamped harmonic oscillation before settling to rest.
 */
export function triggerScreenShakeImpulse(
  state: ScreenShakeSpringState,
  intensity: number = 1.0,
  directionSign: number = 1
): void {
  const dir = directionSign >= 0 ? 1 : -1;
  const clampedIntensity = Math.max(0.2, Math.min(2.5, intensity));

  // Initial displacement kick + high-velocity impulse
  state.x = dir * 16 * clampedIntensity;
  state.y = 12 * clampedIntensity;
  state.rotationDeg = dir * 1.45 * clampedIntensity;

  state.vx = -dir * 420 * clampedIntensity;
  state.vy = -340 * clampedIntensity;
  state.vRot = -dir * 32 * clampedIntensity;
  state.active = true;
}

/**
 * Advances the spring-damper physics simulation by `dtSec` seconds.
 * Uses sub-stepping for numerical stability at any frame rate.
 */
export function stepScreenShake(
  state: ScreenShakeSpringState,
  dtSec: number
): boolean {
  if (!state.active) {
    return false;
  }

  const clampedDt = Math.max(0.001, Math.min(0.05, dtSec));
  const subSteps = 4;
  const h = clampedDt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    const ax = -state.stiffnessX * state.x - state.damping * state.vx;
    const ay = -state.stiffnessY * state.y - state.damping * state.vy;
    const aRot = -state.stiffnessRot * state.rotationDeg - state.damping * state.vRot;

    state.vx += ax * h;
    state.vy += ay * h;
    state.vRot += aRot * h;

    state.x += state.vx * h;
    state.y += state.vy * h;
    state.rotationDeg += state.vRot * h;
  }

  const kinetic =
    Math.abs(state.vx) + Math.abs(state.vy) + Math.abs(state.vRot) * 10;
  const potential =
    Math.abs(state.x) + Math.abs(state.y) + Math.abs(state.rotationDeg) * 10;

  if (kinetic < 0.35 && potential < 0.15) {
    state.x = 0;
    state.y = 0;
    state.rotationDeg = 0;
    state.vx = 0;
    state.vy = 0;
    state.vRot = 0;
    state.active = false;
    return false;
  }

  return true;
}

export function formatScreenShakeTransform(state: ScreenShakeSpringState): string {
  if (!state.active) {
    return 'translate3d(0px, 0px, 0) rotate(0deg)';
  }
  return `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) rotate(${state.rotationDeg.toFixed(2)}deg)`;
}
