import { describe, expect, it } from 'vitest';
import { getPixelRatio, shouldAnimate } from '../src/room/policy';

describe('rendering policy', () => {
  it('limits GPU resolution on high-density and narrow displays', () => {
    expect(getPixelRatio(3, 'auto', 1440)).toBe(1.5);
    expect(getPixelRatio(3, 'auto', 390)).toBe(1.25);
    expect(getPixelRatio(2, 'low', 1440)).toBe(1);
    expect(getPixelRatio(1, 'auto', 1440)).toBe(1);
  });
  it('stops continuous drawing when hidden, paused or reduced motion is requested', () => {
    expect(shouldAnimate({ hidden: false, paused: false, reducedMotion: false })).toBe(true);
    for (const key of ['hidden', 'paused', 'reducedMotion'] as const) {
      expect(
        shouldAnimate({ hidden: false, paused: false, reducedMotion: false, [key]: true }),
      ).toBe(false);
    }
  });
});
