import { describe, expect, test } from 'vitest';
import { projectRotorPoint } from '../src/room/pixi/fan-projection';

describe('original fan front-plane projection', () => {
  test.each([
    { name: 'hub', point: { x: 0, y: 0 }, expected: { x: 0.416, y: 0.375 } },
    { name: 'right tip', point: { x: 1, y: 0 }, expected: { x: 0.782, y: 0.367 } },
    { name: 'left tip', point: { x: -1, y: 0 }, expected: { x: 0.206, y: 0.38 } },
    { name: 'top tip', point: { x: 0, y: -1 }, expected: { x: 0.382, y: 0.108 } },
    { name: 'bottom tip', point: { x: 0, y: 1 }, expected: { x: 0.452, y: 0.659 } },
  ])('projects the $name to its hand-measured opening anchor', ({ point, expected }) => {
    const projected = projectRotorPoint(point);

    expect(projected.x).toBeCloseTo(expected.x, 2);
    expect(projected.y).toBeCloseTo(expected.y, 2);
  });

  test('perspective makes the right half wider than the left half', () => {
    const hub = projectRotorPoint({ x: 0, y: 0 });
    const right = projectRotorPoint({ x: 1, y: 0 });
    const left = projectRotorPoint({ x: -1, y: 0 });

    expect(right.x - hub.x).toBeGreaterThan((hub.x - left.x) * 1.6);
  });
});
