import { expect, test } from '@playwright/test';

test('the real bird renders new idle silhouettes with fixed foot contact and transparent margins', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const ambientUrl = '/src/room/pixi/ambient.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve the room renderer');
    const [{ loadArtwork }, { createAmbient }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(ambientUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const ambient = createAmbient(loaded.textures, 42);
    const bird = ambient.container.children.find(
      (child: { texture?: { source: unknown } }) =>
        child.texture?.source === loaded.textures.bird.source,
    );
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, backgroundAlpha: 0 });
    const frames = new Map<
      string,
      {
        count: number;
        bottom: number;
        left: number;
        right: number;
        footBottom: number;
        pixels: number[];
      }
    >();
    try {
      for (let step = 0; step < 1200; step++) {
        ambient.update(step / 10, { fanSpeed: 0, width: 1440, quality: 'low' });
        const key = JSON.stringify(bird.texture.frame);
        if (frames.has(key)) continue;
        renderer.render({ container: bird });
        const pixels = new Uint8Array(1600 * 900 * 4);
        renderer.gl.readPixels(
          0,
          0,
          1600,
          900,
          renderer.gl.RGBA,
          renderer.gl.UNSIGNED_BYTE,
          pixels,
        );
        const occupied: number[] = [];
        let footBottom = 0;
        let bottom = 0,
          left = 1600,
          right = 0;
        for (let y = 300; y < 480; y++)
          for (let x = 820; x < 1000; x++) {
            const offset = ((899 - y) * 1600 + x) * 4;
            if (pixels[offset + 3] > 128) {
              occupied.push(y * 1600 + x);
              bottom = Math.max(bottom, y);
              left = Math.min(left, x);
              right = Math.max(right, x);
              if (
                x >= 885 &&
                x <= 915 &&
                y >= 430 &&
                pixels[offset] > pixels[offset + 1] * 1.25 &&
                pixels[offset] > pixels[offset + 2] * 1.25
              )
                footBottom = Math.max(footBottom, y);
            }
          }
        frames.set(key, {
          count: occupied.length,
          bottom,
          left,
          right,
          footBottom,
          pixels: occupied,
        });
      }
      const poses = [...frames.values()];
      return {
        poses: poses.map(({ count, bottom, left, right, footBottom }) => ({
          count,
          bottom,
          left,
          right,
          footBottom,
        })),
        silhouettes: new Set(poses.map(({ pixels }) => pixels.join(','))).size,
      };
    } finally {
      ambient.container.destroy({ children: true });
      ambient.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect(result.silhouettes).toBeGreaterThanOrEqual(12);
  for (const pose of result.poses) {
    expect(pose.count).toBeGreaterThan(1000);
    expect(pose.count).toBeLessThan(6500); // An opaque sheet/cell must fail.
    expect(pose.left).toBeGreaterThan(845);
    expect(pose.right).toBeLessThan(980);
    expect(pose.bottom).toBeGreaterThanOrEqual(437);
    expect(pose.bottom).toBeLessThanOrEqual(463); // A resting stretched wing may extend below the feet.
    expect(pose.footBottom).toBeGreaterThanOrEqual(437);
    expect(pose.footBottom, JSON.stringify(result.poses)).toBeLessThanOrEqual(441);
  }
});
