import { expect, it } from 'vitest';
import {
  foliageOffset,
  moteCount,
  motePose,
  outdoorBranchOffset,
  trailingFoliageOffset,
} from '../src/room/pixi/ambient-motion';
import { curtainOffset } from '../src/room/pixi/motion';
import { seatedRoomOffset } from '../src/room/pixi/sleeper-motion';

const responses = (time: number) => [
  ...[0, 1, 2].map((index) => foliageOffset(0, time, index, 0)),
  ...[0, 1].map((index) => trailingFoliageOffset(1, time, index).x),
  outdoorBranchOffset(1, time).x,
  curtainOffset(1, time),
  seatedRoomOffset(330, 35, time, 0).x,
];

it('moves the curtain, every canopy, vines, outdoor branch and hair with the same gust', () => {
  // This was the reported frame: two canopies, curtain and a vine bent against the others.
  responses(2).forEach((offset) => expect(offset).toBeGreaterThan(0));
  const samples = Array.from({ length: 241 }, (_, index) => responses(index / 4));
  for (let part = 1; part < 8; part++) {
    const reference = samples.map((sample) => sample[0]);
    const following = samples.map((sample) => sample[part]);
    const average = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const a = reference.map((value) => value - average(reference));
    const b = following.map((value) => value - average(following));
    const correlation =
      a.reduce((sum, value, i) => sum + value * b[i], 0) /
      Math.sqrt(
        a.reduce((sum, value) => sum + value * value, 0) *
          b.reduce((sum, value) => sum + value * value, 0),
      );
    expect(correlation).toBeGreaterThan(0.98);
  }
});

it('keeps the fan contribution marginal and concentrated beside the desk', () => {
  for (const time of [1, 2, 4, 7, 12]) {
    const additions = [0, 1, 2].map((index) => {
      const window = foliageOffset(0, time, index, 0);
      const highFan = foliageOffset(0, time, index, 2);
      expect(Math.abs(highFan - window)).toBeLessThanOrEqual(Math.abs(window) * 0.16);
      return Math.abs(highFan - window);
    });
    expect(additions[1]).toBeGreaterThan(additions[0] * 3);
    const windowHair = seatedRoomOffset(330, 35, time, 0).x;
    const fanHair = seatedRoomOffset(330, 35, time, 2).x;
    expect(Math.abs(fanHair - windowHair)).toBeLessThanOrEqual(Math.abs(windowHair) * 0.16);
  }
});

it('keeps visible dust in the initial phone desk crop without raising its particle budget', () => {
  for (const quality of ['auto', 'low'] as const) {
    const count = moteCount(390, quality);
    expect(count).toBeLessThanOrEqual(6);
    const visible = Array.from({ length: count }, (_, index) => motePose(index, 0)).filter(
      ({ x, y, alpha }) => x >= 1132 && x <= 1548 && y > 180 && y < 650 && alpha > 0.2,
    );
    expect(visible.length).toBeGreaterThanOrEqual(2);
  }
  expect(moteCount(1512, 'auto')).toBeLessThanOrEqual(18);
});
