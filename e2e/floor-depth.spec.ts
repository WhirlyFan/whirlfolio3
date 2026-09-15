import { expect, test } from '@playwright/test';

test('floor receiving matte applies its soft alpha only once', async ({ page }) => {
  await page.goto('/#portfolio');
  const halfMask = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1470;
    canvas.height = 291;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL().split(',')[1];
  });
  await page.route('**/art/floor-receiver-v2.webp', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(halfMask, 'base64'),
    }),
  );
  const coverage = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      lightingUrl = '/src/room/pixi/lighting.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createLighting }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(lightingUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const plain = createLighting(),
      masked = createLighting(loaded.textures.floorReceiver);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundColor: 0x606060 });
    const red = (lighting: typeof plain) => {
      renderer.render(lighting.container);
      const p = new Uint8Array(4);
      renderer.gl.readPixels(550, 899 - 780, 1, 1, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, p);
      return p[0];
    };
    try {
      return (red(masked) - 96) / (red(plain) - 96);
    } finally {
      for (const lighting of [plain, masked]) {
        lighting.container.destroy({ children: true });
        lighting.dispose();
      }
      renderer.destroy();
      loaded.dispose();
    }
  });
  // Actual loader premultiplication + our lighting mask must retain 50% light,
  // not 25% from multiplying the same alpha into red and alpha channels.
  expect(coverage).toBeGreaterThan(0.48);
  expect(coverage).toBeLessThan(0.52);
});

test('floor sunlight stays behind foreground leaves and vertical door surfaces', async ({
  page,
}) => {
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
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0 });
    const floor = scene.container.getChildByLabel('floor-window-light', true);
    const frame = (time: number, visible: boolean) => {
      scene.update({ elapsedSeconds: time, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1600,
        quality: 'auto',
      });
      floor.visible = visible;
      renderer.render(scene.container);
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    try {
      const lit = frame(0, true),
        bare = frame(0, false),
        gust = frame(2.4, true);
      const error = (x: number, y: number) => {
        const i = ((899 - y) * 1600 + x) * 4;
        return Math.max(...[0, 1, 2].map((c) => Math.abs(lit[i + c] - bare[i + c])));
      };
      let leafLeaks = 0,
        leafPixels = 0,
        movingFloor = 0,
        illuminatedFloor = 0;
      for (let y = 805; y < 865; y++)
        for (let x = 0; x < 190; x++) {
          const i = ((899 - y) * 1600 + x) * 4;
          // Hand-validated green interior samples, not the production mask rule.
          if (bare[i + 1] > bare[i] + 5 && bare[i + 1] > bare[i + 2] + 12) {
            leafPixels++;
            if (error(x, y) > 3) leafLeaks++;
          }
        }
      for (let y = 740; y < 835; y++)
        for (let x = 350; x < 900; x++) {
          const i = ((899 - y) * 1600 + x) * 4;
          if (lit[i] - bare[i] > 8) illuminatedFloor++;
          if (Math.abs(lit[i] - gust[i]) > 8) movingFloor++;
        }
      return {
        leafLeaks,
        leafPixels,
        illuminatedFloor,
        movingFloor,
        door: [
          [125, 774],
          [130, 770],
        ].map(([x, y]) => error(x, y)),
      };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect(result.leafPixels).toBeGreaterThan(2000);
  expect(result.leafLeaks).toBe(0);
  result.door.forEach((error) => expect(error).toBeLessThanOrEqual(3));
  expect(result.illuminatedFloor).toBeGreaterThan(5000);
  expect(result.movingFloor).toBeGreaterThan(100);
});

test('the desk end support occupies its full depth up to the wall', async ({ page }) => {
  await page.goto('/#portfolio');
  const warmWoodFraction = await page.evaluate(async () => {
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
      scene = createPaintedScene(loaded.textures),
      renderer = new WebGLRenderer();
    await renderer.init({ width: 1672, height: 941 });
    scene.container.scale.set(1672 / 1600, 941 / 900);
    for (const child of scene.container.children.slice(1)) child.visible = false;
    try {
      renderer.render(scene.container);
      const p = new Uint8Array(1672 * 941 * 4);
      renderer.gl.readPixels(0, 0, 1672, 941, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, p);
      let wood = 0,
        total = 0;
      // The rejected panel ends at x1260, leaving gray wall in these samples.
      // A full-depth wooden end reaches the wall-side corner near x1342.
      for (let y = 652; y < 674; y += 2)
        for (let x = 1278; x < 1320; x += 2) {
          const i = ((940 - y) * 1672 + x) * 4;
          if (p[i] - p[i + 1] > 34 && p[i + 1] - p[i + 2] > 18) wood++;
          total++;
        }
      return wood / total;
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect(warmWoodFraction).toBeGreaterThan(0.9);
});
