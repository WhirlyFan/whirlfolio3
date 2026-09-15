import { expect, it } from 'vitest';
import {
  invertSunShadow,
  invertVerticalSunShadow,
  meshBounds,
  meshCentroid,
  projectSunShadow,
} from '../src/room/pixi/lighting-math';

it('looks up a vertical shirt receiver along the same sunlight without flattening leaves into a horizontal stripe', () => {
  const upper = invertVerticalSunShadow({ x: 1100, y: 500 }, 1.25);
  const lower = invertVerticalSunShadow({ x: 1100, y: 625 }, 1.25);
  expect(upper).toEqual({ x: 1136, y: 180 });
  expect(lower).toEqual({ x: 1136, y: 280 });
  expect(invertVerticalSunShadow({ x: 1100, y: 500 }, 1)).toEqual({ x: 1100, y: 500 });
});

it('projects window points onto floor and tabletop along one high-right solar vanishing point', () => {
  for (const baseline of [650, 665, 505]) {
    for (const source of [
      { x: 550, y: 300 },
      { x: 940, y: 150 },
      { x: 1150, y: 25 },
    ]) {
      const cast = projectSunShadow(source, baseline);
      const cross = (source.x - 1280) * (cast.y + 1100) - (source.y + 1100) * (cast.x - 1280);
      expect(cross).toBeCloseTo(0, 6);
      expect(cast.y).toBeGreaterThan(baseline);
      const inverse = invertSunShadow(cast, baseline);
      expect(inverse.x).toBeCloseTo(source.x);
      expect(inverse.y).toBeCloseTo(source.y);
    }
  }
});

it('widens the projected upper aperture toward the foreground rather than shrinking it to a separate stripe', () => {
  const left = projectSunShadow({ x: 500, y: 25 }, 650);
  const right = projectSunShadow({ x: 1100, y: 25 }, 650);
  expect(right.x - left.x).toBeCloseTo(1028.5714286);
  expect(left.y).toBeCloseTo(828.5714286);
  const lowerLeft = projectSunShadow({ x: 500, y: 420 }, 650);
  const lowerRight = projectSunShadow({ x: 1100, y: 420 }, 650);
  expect(lowerRight.x - lowerLeft.x).toBeLessThan(right.x - left.x);
  expect(lowerLeft.y).toBeLessThan(left.y);
});

it('registers a measured curtain point and leaf through the same projection', () => {
  const curtain = projectSunShadow({ x: 550, y: 300 }, 650);
  expect(curtain.x).toBeCloseTo(327.826087);
  expect(curtain.y).toBeCloseTo(726.086957);
  const leaf = projectSunShadow({ x: 940, y: 150 }, 650);
  expect(leaf.x).toBeCloseTo(770);
  expect(leaf.y).toBeCloseTo(775);
  const desk = projectSunShadow({ x: 1260, y: 150 }, 505);
  expect(desk.x).toBeCloseTo(1253.799127);
  expect(desk.y).toBeCloseTo(537.554585);
});

it('keeps every floor contact fixed and magnifies source motion by receiver depth without another clock', () => {
  for (const contact of [
    { x: 740, y: 660 },
    { x: 895, y: 730 },
    { x: 810, y: 705 },
  ]) {
    const cast = projectSunShadow(contact, contact.y);
    expect(cast.x).toBeCloseTo(contact.x);
    expect(cast.y).toBeCloseTo(contact.y);
  }
  const before = projectSunShadow({ x: 600, y: 400 }, 650);
  const after = projectSunShadow({ x: 607, y: 400 }, 650);
  expect(after.x - before.x).toBeCloseTo(8.4);
  expect(after.y).toBe(before.y);
});

it('derives body bounds and source wind shift from actual current vertices', () => {
  expect(
    meshBounds(new Float32Array([0, 0, 200, 0, 0, 300, 200, 300]), {
      x: 1020,
      y: 460,
      scaleX: 0.7,
      scaleY: 0.7,
    }),
  ).toEqual({ left: 1020, top: 460, right: 1160, bottom: 670 });
  expect(meshCentroid(new Float32Array([0, 0, 112, 0, 0, 100, 112, 100]))).toEqual({
    x: 56,
    y: 50,
  });
});
