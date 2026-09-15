import { expect, test } from '@playwright/test';

test('the desk shows one half-sized ball with no older crop or pedestal shadow', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      sceneUrl = '/src/room/pixi/scene.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures),
      renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0 });
    scene.update({ elapsedSeconds: 0, fanAngle: 0 }, false, {
      fanSpeed: 0,
      width: 1600,
      quality: 'auto',
    });
    const frame = () => {
      renderer.render(scene.container);
      const p = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, p);
      return p;
    };
    try {
      // Isolate static prop assembly without moving foliage or live illumination.
      // Reintroducing the old crop must fail even if its private label changes.
      for (const child of scene.container.children) {
        if (child.getChildByLabel?.('floor-window-light', true)) child.visible = false;
        if (child.getChildByLabel?.('garden-window', true)) child.visible = false;
      }
      const assembled = frame();
      for (const child of scene.container.children.slice(1)) child.visible = false;
      const base = frame();
      let changed = 0;
      for (let y = 507; y < 556; y++)
        for (let x = 1304; x < 1347; x++) {
          const i = ((899 - y) * 1600 + x) * 4;
          if (Math.max(...[0, 1, 2].map((c) => Math.abs(assembled[i + c] - base[i + c]))) > 3)
            changed++;
        }
      // Measure the largest connected black/blue-gray shape, not brown pot or
      // desktop shadows. This catches the oversized base-painted ball as well
      // as deleting it; the old crop cannot pass the assembly check above.
      const ballBounds = (pixels: Uint8Array | Uint8ClampedArray, flipped: boolean) => {
        const points = new Set<number>();
        for (let y = 503; y < 552; y++)
          for (let x = 1300; x < 1355; x++) {
            const i = ((flipped ? 899 - y : y) * 1600 + x) * 4;
            const [r, g, b] = pixels.slice(i, i + 3);
            if (r < 110 && g < 110 && b < 110 && b > r * 0.8) points.add(y * 1600 + x);
          }
        let largest: number[] = [];
        while (points.size) {
          const group = [points.values().next().value!];
          points.delete(group[0]);
          for (let j = 0; j < group.length; j++)
            for (const p of [group[j] - 1, group[j] + 1, group[j] - 1600, group[j] + 1600])
              if (points.delete(p)) group.push(p);
          if (group.length > largest.length) largest = group;
        }
        const xs = largest.map((p) => p % 1600),
          ys = largest.map((p) => Math.floor(p / 1600));
        const left = Math.min(...xs),
          right = Math.max(...xs),
          top = Math.min(...ys),
          bottom = Math.max(...ys);
        return {
          width: right - left + 1,
          height: bottom - top + 1,
          centerX: (left + right) / 2,
          bottom,
          count: largest.length,
        };
      };
      const old = new Image();
      old.src = '/e2e/fixtures/summer-room-v10.webp';
      await old.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 900;
      const context = canvas.getContext('2d')!;
      context.drawImage(old, 0, 0, 1600, 900);
      return {
        changed,
        ball: ballBounds(base, true),
        before: ballBounds(context.getImageData(0, 0, 1600, 900).data, false),
      };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  console.info('Stress-ball measurement (scene pixels):', JSON.stringify(result));
  // User correction: half the previous diameter, with the same desk contact.
  // Allow two boundary pixels for painterly highlights and texture sampling.
  expect(result.ball.count).toBeGreaterThan(100);
  expect(Math.abs(result.ball.width - result.before.width * 0.5)).toBeLessThanOrEqual(2);
  expect(Math.abs(result.ball.height - result.before.height * 0.5)).toBeLessThanOrEqual(2);
  expect(Math.abs(result.ball.bottom - result.before.bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(result.ball.centerX - result.before.centerX)).toBeLessThanOrEqual(4);
  expect(result.changed).toBe(0);
});
