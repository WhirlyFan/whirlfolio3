import { expect, it } from 'vitest';
import { fitScene, constrainCenter, getPanAxes } from '../src/room/pixi/layout';

it.each([
  [1600, 900, { x: false, y: false }],
  [800, 450, { x: false, y: false }],
  [1600, 900.1, { x: false, y: false }],
  [390, 844, { x: true, y: false }],
  [1440, 1000, { x: true, y: false }],
  [844, 390, { x: false, y: false }],
])('only enables horizontal exploration of cropped artwork at %s×%s', (width, height, axes) => {
  expect(getPanAxes(width, height, 1600, 900)).toEqual(axes);
});

it('fills the viewport without distorting or letterboxing the painting', () => {
  const result = fitScene(800, 600, 1600, 900);
  expect(result.scale).toBeCloseTo(2 / 3);
  expect(result.x).toBeCloseTo(-400 / 3);
  expect(result.y).toBe(0);
});
it('keeps portrait height filled while permitting horizontal exploration', () => {
  const result = fitScene(360, 900, 1600, 900);
  expect(result).toEqual({ scale: 1, x: -620, y: 0 });
});
it('stops camera movement at the painting edges without revealing empty canvas', () => {
  expect(constrainCenter({ x: -100, y: -100 }, 360, 900, 1, 1600, 900)).toEqual({ x: 180, y: 450 });
  expect(constrainCenter({ x: 2000, y: 2000 }, 360, 900, 1, 1600, 900)).toEqual({
    x: 1420,
    y: 450,
  });
  expect(constrainCenter({ x: 800, y: 450 }, 360, 900, 1, 1600, 900)).toEqual({ x: 800, y: 450 });
});
