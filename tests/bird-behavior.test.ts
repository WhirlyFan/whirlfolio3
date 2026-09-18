import { describe, expect, it } from 'vitest';
import { createBirdBehavior } from '../src/room/pixi/bird-behavior';

describe('calm, varied dove behavior', () => {
  it('spends the first 90 seconds on the perch rather than flying every 36 seconds', () => {
    const poseAt = createBirdBehavior(17);
    for (let seconds = 0; seconds < 90; seconds += 0.25) {
      expect(poseAt(seconds)).toMatchObject({ visible: true, flying: false });
      expect(Math.abs(poseAt(seconds).x) + Math.abs(poseAt(seconds).y)).toBe(0);
    }
  });

  it('does not replay the same poses on a 36-second schedule', () => {
    const poseAt = createBirdBehavior(42);
    const first = Array.from({ length: 36 }, (_, seconds) => poseAt(seconds).frame);
    const next = Array.from({ length: 36 }, (_, seconds) => poseAt(seconds + 36).frame);
    expect(next).not.toEqual(first);
  });

  it('visits every idle action without repeating either of the last two actions', () => {
    const poseAt = createBirdBehavior(42);
    const actions: string[] = [];
    let lastStart = -1;
    let restSamples = 0;
    for (let seconds = 0; seconds < 600; seconds += 0.1) {
      const pose = poseAt(seconds);
      if (pose.action === 'rest') restSamples++;
      if (
        ['blink', 'look-up', 'look-around', 'preen', 'fluff', 'stretch'].includes(pose.action) &&
        pose.startedAt !== lastStart
      ) {
        expect(actions.slice(-2)).not.toContain(pose.action);
        actions.push(pose.action);
        lastStart = pose.startedAt;
      }
    }
    expect(new Set(actions)).toEqual(
      new Set(['blink', 'look-up', 'look-around', 'preen', 'fluff', 'stretch']),
    );
    expect(restSamples / 6000).toBeGreaterThan(0.6);
  });

  it('varies by visit but stays reproducible and independent of frame rate', () => {
    const slow = createBirdBehavior(17);
    const fast = createBirdBehavior(17);
    const other = createBirdBehavior(81);
    const samples = [];
    const others = [];
    for (let step = 0; step < 2400; step++) {
      const seconds = step / 4;
      const pose = fast(seconds);
      if (step % 12 === 0) {
        expect(slow(seconds)).toEqual(pose);
        samples.push(pose.frame);
        others.push(other(seconds).frame);
      }
      expect(fast(seconds)).toEqual(pose); // A frozen clock must not consume randomness.
    }
    expect(others).not.toEqual(samples);
    expect(fast(7)).toEqual(createBirdBehavior(17)(7)); // Deterministic replay on rewind.
  });

  it('spaces flights far apart, returns to the perch, and keeps frames and transforms bounded', () => {
    const poseAt = createBirdBehavior(42);
    const departures: number[] = [];
    let lastDeparture = -1;
    let landingAt = 0;
    let previous = poseAt(0);
    for (let seconds = 0; seconds < 1800; seconds += 0.1) {
      const pose = poseAt(seconds);
      if (previous.action === 'return' && pose.action === 'rest') {
        landingAt = pose.startedAt;
        expect(Math.abs(pose.x) + Math.abs(pose.y)).toBe(0);
        expect(pose).toMatchObject({ scale: 1, visible: true, flying: false, frame: 0 });
      }
      if (pose.action === 'depart' && pose.startedAt !== lastDeparture) {
        expect(pose.startedAt - landingAt).toBeGreaterThanOrEqual(120);
        // A selected cooldown can expire during one idle clip + its quiet hold.
        expect(pose.startedAt - landingAt).toBeLessThanOrEqual(227);
        departures.push(pose.startedAt);
        lastDeparture = pose.startedAt;
      }
      expect(Number.isInteger(pose.frame)).toBe(true);
      expect(pose.frame).toBeGreaterThanOrEqual(0);
      expect(pose.frame).toBeLessThan(16);
      // All three garden corridors, including the high climb and rightward exit.
      expect(pose.x).toBeGreaterThanOrEqual(-350);
      expect(pose.x).toBeLessThanOrEqual(145);
      expect(pose.y).toBeGreaterThanOrEqual(-320);
      expect(pose.y).toBeLessThanOrEqual(0);
      expect(pose.alpha).toBeGreaterThanOrEqual(0);
      expect(pose.alpha).toBeLessThanOrEqual(1);
      if (pose.action === 'away') expect(pose.visible).toBe(false);
      previous = pose;
    }
    expect(departures.length).toBeGreaterThan(3);
    expect(departures.length).toBeLessThan(15);
  });
});
