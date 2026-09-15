import { describe, expect, it } from 'vitest';
import { v5SourceQuadToScene, v5SourceToScene } from '../src/room/pixi/surface-registration';

describe('v5 artwork surface registration', () => {
  it('converts alternating source x/y coordinates with their independent image scales', () => {
    expect(v5SourceToScene([836, 470.5, 1672, 941])).toEqual([800, 450, 1600, 900]);
  });

  it('preserves clockwise corner order while converting the complete source boundary', () => {
    expect(v5SourceQuadToScene([0, 0, 1672, 0, 1672, 941, 0, 941])).toEqual([
      0, 0, 1600, 0, 1600, 900, 0, 900,
    ]);
  });
});
