import { describe, expect, it } from 'vitest';
import { seatedRoomOffset } from '../src/room/pixi/sleeper-motion';
import { windowGust } from '../src/room/pixi/window-wind';

describe('supported sleeping pose', () => {
  it('breathes through the shirt without lifting the supported head, folded arms or feet', () => {
    // Shirt center in the new joint painting, registered independently from its renderer.
    const rest = seatedRoomOffset(190, 160, 0, 0);
    const inhale = seatedRoomOffset(190, 160, 2.4, 0);
    expect(rest.y - inhale.y).toBeGreaterThan(3);
    for (const [x, y] of [
      [400, 145],
      [410, 155],
      [480, 505],
    ]) {
      const offset = seatedRoomOffset(x, y, 2.4, 2);
      expect(offset.x).toBeCloseTo(0);
      expect(offset.y).toBeCloseTo(0);
    }
  });

  it('moves only the hair tips with the shared window gust, independent of the local fan', () => {
    const stillFan = seatedRoomOffset(330, 35, 1.3, 0);
    const highFan = seatedRoomOffset(330, 35, 1.3, 2);
    expect(Math.abs(stillFan.x)).toBeGreaterThan(1);
    expect(highFan).toEqual(stillFan);
    expect(Math.sign(stillFan.x)).toBe(Math.sign(windowGust(1.3, 0.18)));
    expect(Math.abs(highFan.x)).toBeLessThan(6);
  });

  it('keeps a visibly legible breath independent of wind strength', () => {
    const calm = seatedRoomOffset(190, 160, 2.4, 0);
    const windy = seatedRoomOffset(190, 160, 2.4, 2);
    expect(calm).toEqual(windy);
    expect(calm.y).toBeLessThan(-5);
  });
});
