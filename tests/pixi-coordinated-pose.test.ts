import { describe, expect, it } from 'vitest';
import { seatedRoomOffset } from '../src/room/pixi/sleeper-motion';

describe('coordinated seated painting motion', () => {
  it('breathes in the shirt without deforming the chair, knees, feet or supported arms', () => {
    expect(seatedRoomOffset(215, 165, 2.4, 1).y).toBeLessThan(-1);
    for (const [x, y] of [
      [90, 220],
      [190, 290],
      [305, 330],
      [395, 300],
      [450, 450],
      [480, 505],
      [400, 145],
    ]) {
      expect(Math.hypot(...Object.values(seatedRoomOffset(x, y, 2.4, 1)))).toBe(0);
    }
  });
  it('returns the breathing cloth to rest each cycle and keeps hair on the window wind', () => {
    expect(Math.hypot(...Object.values(seatedRoomOffset(215, 165, 0, 1)))).toBe(0);
    expect(seatedRoomOffset(215, 165, 4.8, 1).y).toBeCloseTo(0);
    expect(seatedRoomOffset(330, 35, 2.4, 1).x).toBeGreaterThan(0);
    expect(seatedRoomOffset(330, 35, 6.8, 1).x).toBeLessThan(0);
  });
});
