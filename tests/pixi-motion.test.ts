import { describe, expect, it } from 'vitest';
import { advanceMotion, curtainOffset } from '../src/room/pixi/motion';

const moving = { paused: false, reducedMotion: false, fanSpeed: 1 as const };
describe('painted room motion', () => {
  it('keeps the window breeze running when the fan is switched off', () => {
    const next = advanceMotion({ elapsedSeconds: 2, fanAngle: 1 }, 0.05, {
      ...moving,
      fanSpeed: 0,
    });
    expect(next.fanAngle).toBe(1);
    expect(next.elapsedSeconds).toBe(2.05);
    expect(curtainOffset(1, next.elapsedSeconds)).not.toBe(curtainOffset(1, 2));
  });
  it('advances the rotor faster at high speed without changing window time', () => {
    const clock = { elapsedSeconds: 0, fanAngle: 0 };
    const low = advanceMotion(clock, 0.05, moving);
    const high = advanceMotion(clock, 0.05, { ...moving, fanSpeed: 2 });
    expect(low.fanAngle).toBeGreaterThan(0);
    expect(high.fanAngle).toBeGreaterThan(low.fanAngle);
    expect(high.elapsedSeconds).toBe(low.elapsedSeconds);
  });
  it.each([{ paused: true }, { reducedMotion: true }])('holds all motion for %j', (override) => {
    const clock = { elapsedSeconds: 2, fanAngle: 1 };
    expect(advanceMotion(clock, 0.05, { ...moving, ...override })).toEqual(clock);
  });
  it('pins the curtain top while its hem moves', () => {
    expect(curtainOffset(0, 3)).toBe(0);
    expect(curtainOffset(1, 3)).not.toBe(0);
  });
  it('does not jump after a long suspension or reverse on an invalid delta', () => {
    const clock = { elapsedSeconds: 2, fanAngle: 1 };
    expect(advanceMotion(clock, -1, moving)).toEqual(clock);
    expect(advanceMotion(clock, 50, moving).elapsedSeconds).toBeLessThanOrEqual(2.05);
  });
});
