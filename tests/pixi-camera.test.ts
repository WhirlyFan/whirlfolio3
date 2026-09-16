import { describe, expect, it } from 'vitest';
import {
  advanceCamera,
  cameraAt,
  cameraBounds,
  cameraSettled,
  elasticCamera,
  releaseVelocity,
  sampleDrag,
} from '../src/room/pixi/camera';

const bounds = { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } };

describe('camera momentum', () => {
  it('continues in the release direction and loses speed over elapsed time', () => {
    const motion = cameraAt({ x: 400, y: 400 });
    motion.velocity = { x: 800, y: -200 };
    const next = advanceCamera(motion, bounds, 0.28);
    expect(next.position.x).toBeCloseTo(541.595, 2);
    expect(next.position.y).toBeCloseTo(364.601, 2);
    expect(next.velocity.x).toBeCloseTo(294.304, 2);
  });

  it('coasts into the edge, rebounds and settles exactly without perpetual jitter', () => {
    let motion = cameraAt({ x: 20, y: 500 });
    motion.velocity.x = -800;
    motion = advanceCamera(motion, bounds, 0.08);
    expect(motion.position.x).toBeLessThan(0);
    for (let i = 0; i < 240; i++) motion = advanceCamera(motion, bounds, 1 / 120);
    expect(motion.position).toEqual({ x: 0, y: 500 });
    expect(cameraSettled(motion)).toBe(true);
  });

  it('has the same coast and boundary return at 30, 60 and 120 Hz', () => {
    const result = [30, 60, 120].map((hz) => {
      let motion = cameraAt({ x: 20, y: 500 });
      motion.velocity = { x: -800, y: 200 };
      for (let i = 0; i < hz / 2; i++) motion = advanceCamera(motion, bounds, 1 / hz);
      return motion;
    });
    for (const motion of result.slice(1)) {
      expect(motion.position.x).toBeCloseTo(result[0].position.x, 8);
      expect(motion.position.y).toBeCloseTo(result[0].position.y, 8);
      expect(motion.velocity.x).toBeCloseTo(result[0].velocity.x, 8);
    }
  });

  it('does not replay old movement when the visitor pauses before releasing', () => {
    const samples = sampleDrag([{ position: { x: 0, y: 0 }, timeMs: 0 }], { x: 60, y: 0 }, 60);
    expect(releaseVelocity(samples, 65, 1)).toEqual({ x: 1000, y: 0 });
    expect(releaseVelocity(samples, 160, 1)).toEqual({ x: 0, y: 0 });
    expect(releaseVelocity([], 160, 1)).toEqual({ x: 0, y: 0 });
  });

  it('caps a fast diagonal fling in screen pixels, including high cover scales', () => {
    const velocity = releaseVelocity(
      [
        { position: { x: 0, y: 0 }, timeMs: 0 },
        { position: { x: 500, y: 500 }, timeMs: 10 },
      ],
      10,
      2,
    );
    expect(Math.hypot(velocity.x, velocity.y) * 2).toBeCloseTo(1800);
  });

  it('keeps recent release velocity when sparse input leaves only one sample in the release window', () => {
    const samples = [
      { position: { x: 0, y: 0 }, timeMs: 60 },
      { position: { x: 60, y: 0 }, timeMs: 120 },
    ];
    expect(releaseVelocity(samples, 175, 1)).toEqual({ x: 1000, y: 0 });
  });
});

describe('fixed-scale elastic edges', () => {
  for (const view of [
    { width: 390, height: 844 },
    { width: 1600, height: 900 },
    { width: 844, height: 390 },
  ]) {
    it(`allows a limited gap without enlarging the painting at ${view.width}×${view.height}`, () => {
      const scene = { width: 1600, height: 900 };
      const fit = Math.max(view.width / 1600, view.height / 900);
      for (const x of [-5000, 200, 800, 1400, 5000])
        for (const y of [-5000, 450, 5000]) {
          const camera = elasticCamera({ x, y }, view, scene);
          expect(camera.zoom).toBe(1);
          const scale = fit * camera.zoom;
          const left = view.width / 2 - camera.center.x * scale;
          const top = view.height / 2 - camera.center.y * scale;
          expect(left).toBeLessThanOrEqual(24.000001);
          expect(top).toBeLessThanOrEqual(24.000001);
          expect(left + 1600 * scale).toBeGreaterThanOrEqual(view.width - 24.000001);
          expect(top + 900 * scale).toBeGreaterThanOrEqual(view.height - 24.000001);
          if (x === -5000) expect(left).toBeGreaterThan(20);
          if (y === -5000) expect(top).toBeGreaterThan(20);
        }
      const edge = cameraBounds(view, scene).min;
      expect(elasticCamera(edge, view, scene)).toEqual({ center: edge, zoom: 1 });
    });
  }
});
