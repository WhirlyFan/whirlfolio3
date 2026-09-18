import { expect, test } from '@playwright/test';

test('painted flights use different garden corridors without painting over the sill or window trim', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve renderer');
    const sceneUrl = '/src/room/pixi/scene.ts';
    const behaviorUrl = '/src/room/pixi/bird-behavior.ts';
    const [{ loadArtwork }, { createPaintedScene }, { createBirdBehavior }, { WebGLRenderer }] =
      await Promise.all([import(assetUrl), import(sceneUrl), import(behaviorUrl), import(pixiUrl)]);
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures, 42);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, antialias: false });
    const bird = scene.container.getChildByLabel('room-bird', true);
    const poseAt = createBirdBehavior(42);
    const legs: { action: string; start: number }[] = [];
    for (let time = 0; time < 900; time += 0.5) {
      const pose = poseAt(time);
      if (pose.flying && legs.at(-1)?.start !== pose.startedAt)
        legs.push({ action: pose.action, start: pose.startedAt });
    }
    const pixels = () => {
      renderer.render({ container: scene.container });
      const data = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, data);
      return data;
    };
    let outsideGarden = 0;
    let maxRotation = 0;
    const centers: number[][] = [];
    const counts: number[] = [];
    try {
      for (const leg of legs) {
        for (const offset of [0.03, 0.13, 0.27, 0.37, 0.8, 1.5, 2.2, 2.63, 2.77, 2.87, 2.97]) {
          scene.update({ elapsedSeconds: leg.start + offset, fanAngle: 0 }, false, {
            fanSpeed: 0,
            width: 1600,
            quality: 'low',
          });
          maxRotation = Math.max(maxRotation, Math.abs(bird.rotation));
          const visible = pixels();
          bird.visible = false;
          const hidden = pixels();
          let count = 0;
          let sumX = 0;
          let sumY = 0;
          for (let y = 15; y < 490; y++) {
            for (let x = 440; x < 1200; x++) {
              const i = ((899 - y) * 1600 + x) * 4;
              if (
                Math.abs(visible[i] - hidden[i]) +
                  Math.abs(visible[i + 1] - hidden[i + 1]) +
                  Math.abs(visible[i + 2] - hidden[i + 2]) <
                18
              )
                continue;
              count++;
              sumX += x;
              sumY += y;
              // Source-measured central garden opening, not a bound computed by the route helper.
              if (x < 519 || x > 1081 || y < 36 || y > 440) outsideGarden++;
            }
          }
          if (offset === 1.5) {
            counts.push(count);
            if (leg.action === 'depart') centers.push([sumX / count, sumY / count]);
          }
        }
      }
      return { outsideGarden, maxRotation, centers, counts };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect(result.outsideGarden).toBe(0);
  expect(result.maxRotation).toBeGreaterThan(0.1);
  expect(result.counts.every((count) => count > 80)).toBe(true);
  const corridors = new Set(
    result.centers.map(([x]) => (x < 800 ? 'left' : x > 940 ? 'right' : 'high')),
  );
  expect(corridors.size).toBe(3);
});
