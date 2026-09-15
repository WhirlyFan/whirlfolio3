import { expect, test } from '@playwright/test';

test('five rooted indoor groups and a visible garden branch move from the shared room time', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual room Pixi module');
    const ambientUrl = '/src/room/pixi/ambient.ts';
    const [{ loadArtwork }, { createAmbient }] = await Promise.all([
      import(assetUrl),
      import(ambientUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const ambient = createAmbient(loaded.textures);
    const sample = (mesh: (typeof ambient.foliage)[number]) =>
      Array.from(mesh.geometry.positions as Float32Array);
    const movement = (samples: number[][], scale: number) => {
      let minimumPixels = Number.POSITIVE_INFINITY;
      let maximumPixels = 0;
      for (let vertex = 0; vertex < samples[0].length; vertex += 2) {
        for (let first = 0; first < samples.length; first++) {
          for (let second = first + 1; second < samples.length; second++) {
            const pixels = Math.hypot(
              (samples[second][vertex] - samples[first][vertex]) * scale,
              (samples[second][vertex + 1] - samples[first][vertex + 1]) * scale,
            );
            minimumPixels = Math.min(minimumPixels, pixels);
            maximumPixels = Math.max(maximumPixels, pixels);
          }
        }
      }
      return { minimumPixels, maximumPixels };
    };
    try {
      const sampleTimes = [0, 2, 4, 6, 8];
      const indoorSamples = ambient.foliage.map(() => [] as number[][]);
      const outdoorSamples = ambient.outdoorFoliage.map(() => [] as number[][]);
      for (const time of sampleTimes) {
        ambient.update(time, { fanSpeed: 0, width: 390, quality: 'auto' });
        ambient.foliage.forEach((mesh: (typeof ambient.foliage)[number], index: number) =>
          indoorSamples[index].push(sample(mesh)),
        );
        ambient.outdoorFoliage.forEach((mesh: (typeof ambient.foliage)[number], index: number) =>
          outdoorSamples[index].push(sample(mesh)),
        );
      }
      return {
        indoorCount: ambient.foliage.length,
        outdoorCount: ambient.outdoorFoliage.length,
        indoorMovement: ambient.foliage.map(
          (mesh: (typeof ambient.foliage)[number], index: number) =>
            movement(indoorSamples[index], Math.abs(mesh.scale.x)),
        ),
        outdoorMovement: ambient.outdoorFoliage.map(
          (mesh: (typeof ambient.foliage)[number], index: number) =>
            movement(outdoorSamples[index], Math.abs(mesh.scale.x)),
        ),
      };
    } finally {
      ambient.container.destroy({ children: true });
      ambient.dispose();
      loaded.dispose();
    }
  });

  expect(result.indoorCount).toBeGreaterThanOrEqual(5);
  expect(result.outdoorCount).toBeGreaterThanOrEqual(1);
  for (const group of [...result.indoorMovement, ...result.outdoorMovement]) {
    expect(group.minimumPixels).toBeLessThan(0.2);
    expect(group.maximumPixels).toBeGreaterThan(3);
  }
});

test('garden leaves cast a visible moving footprint on open sunlit boards and the desk', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual room Pixi module');
    const ambientUrl = '/src/room/pixi/ambient.ts';
    const lightingUrl = '/src/room/pixi/lighting.ts';
    const [{ loadArtwork }, { createAmbient }, { createLighting }, { Container, WebGLRenderer }] =
      await Promise.all([
        import(assetUrl),
        import(ambientUrl),
        import(lightingUrl),
        import(pixiUrl),
      ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const ambient = createAmbient(loaded.textures);
    const lighting = createLighting();
    const stage = new Container();
    stage.addChild(lighting.container);
    const renderer = new WebGLRenderer();
    await renderer.init({
      width: 1600,
      height: 900,
      resolution: 1,
      backgroundColor: '#606060',
      antialias: false,
    });
    const frame = (timeSeconds: number) => {
      ambient.update(timeSeconds, { fanSpeed: 0, width: 1400, quality: 'low' });
      lighting.update();
      renderer.render({ container: stage });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const countDark = (
      pixels: Uint8Array,
      open: Uint8Array,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      let count = 0;
      for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          const offset = ((899 - y) * 1600 + x) * 4;
          if (open[offset] - pixels[offset] > 10) count++;
        }
      }
      return count;
    };
    const changed = (
      before: Uint8Array,
      after: Uint8Array,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      let count = 0;
      for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          const offset = ((899 - y) * 1600 + x) * 4;
          if (
            Math.abs(before[offset] - after[offset]) +
              Math.abs(before[offset + 1] - after[offset + 1]) +
              Math.abs(before[offset + 2] - after[offset + 2]) >
            18
          )
            count++;
        }
      }
      return count;
    };
    try {
      const open = frame(0);
      for (const branch of ambient.outdoorFoliage) {
        lighting.add(branch, 'floor', 0.85);
        lighting.add(branch, 'desk', 0.85);
      }
      const rest = frame(0);
      const wind = frame(2.1);
      // Aperture-derived field spans boards and rug; foreground plant art is never rendered here.
      const floor = { x: 500, y: 710, width: 650, height: 165 };
      const desk = { x: 1050, y: 510, width: 540, height: 160 };
      return {
        floorDark: countDark(rest, open, floor),
        deskDark: countDark(rest, open, desk),
        floorChanged: changed(rest, wind, floor),
        deskChanged: changed(rest, wind, desk),
      };
    } finally {
      stage.destroy({ children: true });
      lighting.dispose();
      ambient.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });

  expect(result.floorDark).toBeGreaterThan(300);
  expect(result.deskDark).toBeGreaterThan(100);
  expect(result.floorChanged).toBeGreaterThan(120);
  expect(result.deskChanged).toBeGreaterThan(10);
});

test('leaf shade on a deformed mesh stays inside its rendered alpha', async ({ page }) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual room Pixi module');
    const ambientUrl = '/src/room/pixi/ambient.ts';
    const lightingUrl = '/src/room/pixi/lighting.ts';
    const [
      { loadArtwork },
      { createAmbient },
      { createLighting },
      { Container, MeshPlane, Rectangle, Texture, WebGLRenderer },
    ] = await Promise.all([
      import(assetUrl),
      import(ambientUrl),
      import(lightingUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const ambient = createAmbient(loaded.textures);
    ambient.update(2.1, { fanSpeed: 0, width: 1400, quality: 'low' });
    const receiverTexture = new Texture({
      source: loaded.textures.trailing.source,
      frame: new Rectangle(0, 0, 512, 512),
    });
    const receiver = new MeshPlane({ texture: receiverTexture, verticesX: 7, verticesY: 8 });
    // Match the real sleeper's illustration-space receiver region.
    receiver.position.set(1000, 460);
    receiver.scale.set(0.55);
    const positions = receiver.geometry.positions;
    for (let index = 0; index < positions.length; index += 2) {
      const fraction = positions[index + 1] / 512;
      positions[index] += Math.sin(fraction * Math.PI) * 24;
    }
    receiver.geometry.getAttribute('aPosition').buffer.update();
    const stage = new Container();
    stage.addChild(receiver);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1200, height: 700, resolution: 1, backgroundAlpha: 0 });
    const read = () => {
      renderer.render({ container: stage });
      const pixels = new Uint8Array(1200 * 700 * 4);
      renderer.gl.readPixels(0, 0, 1200, 700, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    try {
      const lighting = createLighting();
      lighting.addMeshReceiver(receiver, ambient.outdoorFoliage[0], 0.45);
      ambient.update(0, { fanSpeed: 0, width: 1400, quality: 'low' });
      lighting.update();
      const before = read();
      ambient.update(6, { fanSpeed: 0, width: 1400, quality: 'low' });
      lighting.update();
      const shaded = read();
      let changedInside = 0;
      let changedOutside = 0;
      for (let offset = 0; offset < before.length; offset += 4) {
        const difference =
          Math.abs(before[offset] - shaded[offset]) +
          Math.abs(before[offset + 1] - shaded[offset + 1]) +
          Math.abs(before[offset + 2] - shaded[offset + 2]);
        if (difference <= 8) continue;
        if (before[offset + 3] > 8) changedInside++;
        else changedOutside++;
      }
      lighting.dispose();
      return { changedInside, changedOutside };
    } finally {
      stage.destroy({ children: true });
      receiverTexture.destroy(false);
      ambient.container.destroy({ children: true });
      ambient.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });

  expect(result.changedInside).toBeGreaterThan(100);
  expect(result.changedOutside).toBe(0);
});
