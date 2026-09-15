import { describe, expect, it } from 'vitest';
import {
  birdPose,
  foliageOffset,
  moteCount,
  motePose,
  outdoorBranchOffset,
  trailingFoliageOffset,
} from '../src/room/pixi/ambient-motion';
import { advanceMotion } from '../src/room/pixi/motion';

describe('summer room ambient motion', () => {
  it('gives a perched bird distinct blink and curious head poses without moving its feet', () => {
    const rest = birdPose(0);
    const blink = birdPose(3.12);
    const curious = birdPose(7.5);
    expect(rest.frame).toBe(0);
    expect(blink.frame).toBe(1);
    expect(curious.frame).toBe(2);
    for (const pose of [rest, blink, curious]) {
      expect(pose).toMatchObject({ scale: 1, visible: true, flying: false });
      expect(Math.abs(pose.x) + Math.abs(pose.y)).toBe(0);
    }
  });

  it('flies into the garden, stays away briefly, and lands back on the sill', () => {
    const takeoff = birdPose(20);
    const away = birdPose(22);
    const returning = birdPose(30);
    expect(takeoff).toMatchObject({ scale: 1, flying: true });
    expect(Math.abs(takeoff.x) + Math.abs(takeoff.y)).toBe(0);
    expect(away.x).toBeLessThan(0);
    expect(away.y).toBeLessThan(-100);
    expect(away.scale).toBeLessThan(1);
    expect(away.frame).toBeGreaterThanOrEqual(3);
    expect(away.frame).toBeLessThanOrEqual(5);
    expect(birdPose(25).visible).toBe(false);
    expect(returning).toMatchObject({ visible: true, flying: true, direction: -1 });
    expect(birdPose(32)).toMatchObject({ scale: 1, visible: true, flying: false });
    expect(Math.abs(birdPose(32).x) + Math.abs(birdPose(32).y)).toBe(0);
    expect(birdPose(36)).toEqual(birdPose(0));
    // Position and scale must approach the same perch at either end of a flight.
    expect(Math.abs(birdPose(31.999).x)).toBeLessThan(0.1);
    expect(Math.abs(birdPose(31.999).y)).toBeLessThan(0.1);
  });

  it('pins plant roots while leaves move in the window breeze even with the fan off', () => {
    expect(foliageOffset(1, 3, 0, 0)).toBe(0);
    const leaf = foliageOffset(0, 3, 0, 0);
    expect(leaf).not.toBe(0);
    expect(foliageOffset(0, 4, 0, 0)).not.toBe(leaf);
    expect(foliageOffset(0, 3, 0, 2)).not.toBe(leaf);
    expect(foliageOffset(0, 3, 1, 0)).not.toBe(leaf);
    const phoneCanopyRange = Array.from({ length: 121 }, (_, index) =>
      foliageOffset(0, index * 0.3, 0, 0),
    );
    expect(Math.max(...phoneCanopyRange) - Math.min(...phoneCanopyRange)).toBeGreaterThanOrEqual(
      18,
    );
    phoneCanopyRange.forEach((offset) => expect(Math.abs(offset)).toBeLessThanOrEqual(16));
  });

  it('pins both trailing vines at their pots while their tips move visibly', () => {
    for (const vineIndex of [0, 1]) {
      expect(trailingFoliageOffset(0, 4, vineIndex)).toEqual({ x: 0, y: 0 });
      const tipOffsets = Array.from({ length: 121 }, (_, index) =>
        trailingFoliageOffset(1, index * 0.3, vineIndex),
      );
      const tipX = tipOffsets.map(({ x }) => x);
      expect(Math.max(...tipX) - Math.min(...tipX)).toBeGreaterThanOrEqual(20);
      tipOffsets.forEach(({ x, y }) => {
        expect(Math.abs(x)).toBeLessThanOrEqual(15);
        expect(Math.abs(y)).toBeLessThanOrEqual(4);
      });
    }
  });

  it('keeps the garden branch rooted while exposed leaf tips move', () => {
    expect(outdoorBranchOffset(0, 5)).toEqual({ x: 0, y: 0 });
    const tipOffsets = Array.from({ length: 121 }, (_, index) =>
      outdoorBranchOffset(1, index * 0.3),
    );
    const tipX = tipOffsets.map(({ x }) => x);
    expect(Math.max(...tipX) - Math.min(...tipX)).toBeGreaterThanOrEqual(14);
    tipOffsets.forEach(({ x, y }) => {
      expect(Math.abs(x)).toBeLessThanOrEqual(11);
      expect(Math.abs(y)).toBeLessThanOrEqual(4);
    });
  });

  it('keeps sparse dust bounded and lowers the count on narrow or low-detail views', () => {
    expect(moteCount(390, 'auto')).toBeLessThan(moteCount(1400, 'auto'));
    expect(moteCount(390, 'low')).toBeLessThanOrEqual(moteCount(390, 'auto'));
    expect(moteCount(1400, 'low')).toBeLessThan(moteCount(1400, 'auto'));
    expect(motePose(0, 1)).not.toEqual(motePose(0, 2));
    for (let i = 0; i < 18; i++) {
      for (const time of [0, 3, 31, 93, 3600]) {
        const pose = motePose(i, time);
        expect(pose.x).toBeGreaterThanOrEqual(500);
        expect(pose.x).toBeLessThanOrEqual(1548);
        expect(pose.y).toBeGreaterThanOrEqual(180);
        expect(pose.y).toBeLessThanOrEqual(680);
        expect(pose.alpha).toBeGreaterThanOrEqual(0);
        expect(pose.alpha).toBeLessThanOrEqual(0.58);
      }
    }
  });

  it.each([{ paused: true }, { reducedMotion: true }])(
    'freezes the full ambient scene for %j',
    (policy) => {
      const clock = { elapsedSeconds: 21, fanAngle: 1 };
      const next = advanceMotion(clock, 0.05, {
        fanSpeed: 2,
        paused: false,
        reducedMotion: false,
        ...policy,
      });
      expect(birdPose(next.elapsedSeconds)).toEqual(birdPose(21));
      expect(foliageOffset(0, next.elapsedSeconds, 0, 2)).toBe(foliageOffset(0, 21, 0, 2));
      expect(motePose(3, next.elapsedSeconds)).toEqual(motePose(3, 21));
    },
  );
});
