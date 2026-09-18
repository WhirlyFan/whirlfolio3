import { describe, expect, it } from 'vitest';
import { createBirdBehavior } from '../src/room/pixi/bird-behavior';

type Pose = ReturnType<ReturnType<typeof createBirdBehavior>>;
function trips(seed: number) {
  const poseAt = createBirdBehavior(seed);
  const legs: { action: 'depart' | 'return'; start: number }[] = [];
  for (let time = 0; time < 3600; time += 0.5) {
    const pose = poseAt(time);
    if (
      (pose.action === 'depart' || pose.action === 'return') &&
      legs.at(-1)?.start !== pose.startedAt
    )
      legs.push({ action: pose.action, start: pose.startedAt });
  }
  return legs;
}
const location = (pose: Pose) => [Math.round(pose.x), Math.round(pose.y)];

describe('garden flight routes', () => {
  it('uses three spatially different departures without consecutive repeats', () => {
    // A fixed route (or randomized timing alone) cannot satisfy this spatial assertion.
    for (const seed of [17, 42, 81]) {
      const poseAt = createBirdBehavior(seed);
      const centers = trips(seed)
        .filter((leg) => leg.action === 'depart')
        .map((leg) => location(poseAt(leg.start + 1.5)));
      expect(new Set(centers.map(String)).size).toBe(3);
      centers.slice(1).forEach((center, i) => expect(center).not.toEqual(centers[i]));
      expect(centers.some(([x]) => x > 40)).toBe(true);
      expect(centers.some(([x]) => x < -100)).toBe(true);
      expect(centers.some(([, y]) => y < -150)).toBe(true);
    }
  });

  it('returns along a different curve instead of reversing the outbound movie', () => {
    for (const seed of [17, 42, 81]) {
      const poseAt = createBirdBehavior(seed);
      const legs = trips(seed);
      for (let i = 0; i + 1 < legs.length; i += 2) {
        expect(legs[i + 1].action).toBe('return');
        const outbound = poseAt(legs[i].start + 1.5);
        const inbound = poseAt(legs[i + 1].start + 1.5);
        expect(location(inbound)).not.toEqual(location(outbound));
        const absentSeconds = legs[i + 1].start - legs[i].start - 3;
        expect(absentSeconds).toBeGreaterThanOrEqual(8);
        expect(absentSeconds).toBeLessThanOrEqual(16);
      }
    }
  });

  it('faces its direction of travel and keeps that facing on a soft landing', () => {
    const poseAt = createBirdBehavior(42);
    for (const leg of trips(42)) {
      for (const offset of [0.15, 0.7, 1.5, 2.3, 2.85]) {
        const pose = poseAt(leg.start + offset);
        const next = poseAt(leg.start + offset + 0.001);
        expect(pose.direction).toBe(next.x < pose.x ? 1 : -1);
        expect(Number.isFinite(pose.rotation)).toBe(true);
        expect(Math.abs(pose.rotation)).toBeLessThanOrEqual(0.3);
      }
      if (leg.action === 'return') {
        const before = poseAt(leg.start + 2.999);
        const landed = poseAt(leg.start + 3.001);
        expect(Math.hypot(before.x, before.y)).toBeLessThan(0.01);
        expect(landed).toMatchObject({
          x: 0,
          y: 0,
          scale: 1,
          alpha: 1,
          rotation: 0,
          flying: false,
          direction: before.direction,
        });
      }
    }
  });
});
