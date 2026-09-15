import { expect, test } from '@playwright/test';

test('the relocated guitar stays in front of the sill', async ({ page }) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      sceneUrl = '/src/room/pixi/scene.ts';
    const code = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = code.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal),
      scene = createPaintedScene(loaded.textures);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0 });
    const frame = (container = scene.container) => {
      renderer.render(container);
      const p = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, p);
      return p;
    };
    const index = (x: number, y: number) => ((899 - y) * 1600 + x) * 4;
    try {
      scene.update({ elapsedSeconds: 0, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1600,
        quality: 'auto',
      });
      const assembled = frame();
      // Render through the same root: rendering the background as the root
      // omits its local source-to-scene scaling and samples different pixels.
      for (const child of scene.container.children.slice(1)) {
        child.visible = false;
      }
      const guitar = frame();
      const neckErrors = [
        [621, 432],
        [622, 440],
        [623, 449],
      ].map(([x, y]) => {
        const i = index(x, y);
        return {
          alpha: guitar[i + 3],
          error: Math.max(...[0, 1, 2].map((c) => Math.abs(guitar[i + c] - assembled[i + c]))),
        };
      });
      return { neckErrors };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  for (const point of result.neckErrors) {
    expect(point.alpha).toBeGreaterThan(240);
    expect(point.error).toBeLessThan(5);
  }
});
