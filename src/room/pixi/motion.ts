import { windowGust } from './window-wind';

export interface MotionClock {
  elapsedSeconds: number;
  fanAngle: number;
}
export function advanceMotion(
  current: MotionClock,
  deltaSeconds: number,
  state: { fanSpeed: 0 | 1 | 2; paused: boolean; reducedMotion: boolean },
): MotionClock {
  if (state.paused || state.reducedMotion) return current;
  const delta = Math.min(0.05, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  return {
    elapsedSeconds: current.elapsedSeconds + delta,
    fanAngle: (current.fanAngle + delta * [0, 5, 11][state.fanSpeed]) % (Math.PI * 2),
  };
}
export function curtainOffset(verticalFraction: number, timeSeconds: number): number {
  const y = Math.max(0, Math.min(1, verticalFraction));
  return y * y * 14 * windowGust(timeSeconds, 0.1 + y * 0.12);
}
