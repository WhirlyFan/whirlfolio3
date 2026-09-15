import { expect, test } from '@playwright/test';

test('the complete chair/person painting retains its supported contacts at rest', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      sleeperUrl = '/src/room/pixi/sleeper.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createSleeper }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sleeperUrl),
      import(pixiUrl),
    ]);
    const assets = await loadArtwork(new AbortController().signal);
    const sleeper = createSleeper(assets.textures.sleeper);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0 });
    try {
      sleeper.update(0, 0);
      renderer.render(sleeper.container);
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      const image = new Image();
      image.src = '/art/sleeper-joint-v1.svg';
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 900;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 890, 396, 550, 550);
      const reference = ctx.getImageData(0, 0, 1600, 900).data;
      // Independently selected chair post, connected armrest, supported thigh,
      // calves and sandals. Torso/hair have intentional wind deformation.
      const regions = [
        [982, 600, 22, 110],
        [1130, 637, 85, 12],
        [1160, 690, 35, 30],
        [1250, 735, 25, 65],
        [1270, 825, 25, 15],
        [1330, 858, 28, 10],
      ];
      let checked = 0,
        mismatch = 0;
      for (const [x, y, w, h] of regions)
        for (let row = y; row < y + h; row += 2)
          for (let col = x; col < x + w; col += 2) {
            const a = (row * 1600 + col) * 4,
              b = ((899 - row) * 1600 + col) * 4;
            if (reference[a + 3] < 250) continue;
            checked++;
            if (
              Math.max(...[0, 1, 2, 3].map((c) => Math.abs(reference[a + c] - pixels[b + c]))) > 12
            )
              mismatch++;
          }
      return { checked, mismatch };
    } finally {
      sleeper.container.destroy({ children: true });
      sleeper.dispose();
      renderer.destroy();
      assets.dispose();
    }
  });
  expect(result.checked).toBeGreaterThan(1000);
  expect(result.mismatch).toBe(0);
});

test('the assembled room casts garden-leaf shade onto the sleeping shirt', async ({ page }) => {
  const graphicsErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') graphicsErrors.push(message.text());
  });
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const sceneUrl = '/src/room/pixi/scene.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve room renderer');
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const assets = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(assets.textures);
    const descendants = [scene.container];
    for (let index = 0; index < descendants.length; index++)
      descendants.push(...(descendants[index].children ?? []));
    const body = descendants.find((child: { label?: string }) => child.label === 'sleeping-body');
    if (!body?.filters?.length) throw new Error('Assembled sleeper has no leaf-shadow receiver');
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, antialias: false, backgroundAlpha: 0 });
    const frame = () => {
      renderer.render({ container: scene.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    try {
      scene.update({ elapsedSeconds: 2.4, fanAngle: 0 }, false, {
        fanSpeed: 1,
        width: 1600,
        quality: 'auto',
      });
      // Keep identical filter resolution for both frames; only leaf opacity changes.
      const shadowUniforms = body.filters[0].resources.leafShadeUniforms.uniforms;
      const shadowOpacity = shadowUniforms.uOpacity;
      shadowUniforms.uOpacity = 0;
      const unshaded = frame();
      // Measure the actual posed alpha silhouette; a fixed bounding box becomes
      // stale when the feet move onto the floor and cannot detect gaps in the body.
      const visibility = descendants.map((child: { visible: boolean }) => ({
        child,
        visible: child.visible,
      }));
      const bodyPath = new Set();
      for (let ancestor = body; ancestor; ancestor = ancestor.parent) {
        bodyPath.add(ancestor);
        if (ancestor.mask) bodyPath.add(ancestor.mask);
      }
      descendants.forEach((child: { visible: boolean }) => {
        child.visible = bodyPath.has(child);
      });
      const bodySilhouette = frame();
      visibility.forEach(({ child, visible }) => {
        child.visible = visible;
      });
      shadowUniforms.uOpacity = shadowOpacity;
      const shaded = frame();
      let shadedShirt = 0;
      let creamShirt = 0;
      let retainedShirt = 0;
      let changesOutsideBody = 0;
      for (let y = 0; y < 900; y++)
        for (let x = 0; x < 1600; x++) {
          const offset = ((899 - y) * 1600 + x) * 4;
          const difference = unshaded[offset] - shaded[offset];
          if (x >= 1060 && x < 1180 && y >= 510 && y < 630) {
            if (difference > 5) shadedShirt++;
            if (
              unshaded[offset] > 180 &&
              unshaded[offset + 1] > 170 &&
              unshaded[offset + 2] > 135
            ) {
              creamShirt++;
              if (
                shaded[offset + 1] >= unshaded[offset + 1] * 0.7 &&
                shaded[offset + 2] >= unshaded[offset + 2] * 0.7
              )
                retainedShirt++;
            }
          }
          if (bodySilhouette[offset + 3] < 3 && Math.abs(difference) > 3) changesOutsideBody++;
        }
      return { shadedShirt, changesOutsideBody, creamShirt, retainedShirt };
    } finally {
      scene.dispose();
      renderer.destroy();
      assets.dispose();
    }
  });
  expect(result.shadedShirt).toBeGreaterThan(40);
  expect(result.creamShirt).toBeGreaterThan(500);
  expect(result.retainedShirt / result.creamShirt).toBeGreaterThan(0.9);
  expect(result.changesOutsideBody).toBe(0);
  expect(graphicsErrors).toEqual([]);
});
