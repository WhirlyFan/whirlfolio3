import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidenceDir = path.resolve('.superpowers/sdd/pixi-grounded-scene-plan/task-1-evidence');
const evidencePrefix = process.env.SLEEPER_EVIDENCE_PREFIX ?? 'after';

async function saveDataUrl(name: string, dataUrl: string) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

test('the actual foliage receiver keeps leaf shade but has no hard vertical window bar', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const sceneUrl = '/src/room/pixi/scene.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual Pixi renderer');
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0, antialias: false });
    const imageFromPixels = (pixels: Uint8Array) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 900;
      const context = canvas.getContext('2d')!;
      const upright = new Uint8ClampedArray(pixels.length);
      for (let y = 0; y < 900; y++)
        upright.set(pixels.subarray(y * 1600 * 4, (y + 1) * 1600 * 4), (899 - y) * 1600 * 4);
      context.putImageData(new ImageData(upright, 1600, 900), 0, 0);
      return canvas.toDataURL();
    };
    const descendants = [scene.container];
    for (let index = 0; index < descendants.length; index++)
      descendants.push(...(descendants[index].children ?? []));
    const body = descendants.find((child: { label?: string }) => child.label === 'sleeping-body');
    if (!body?.filters?.length) throw new Error('Actual sleeper is missing its foliage receiver');
    const read = () => {
      renderer.render({ container: scene.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return { pixels, image: imageFromPixels(pixels) };
    };
    try {
      scene.update({ elapsedSeconds: 2.4, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1600,
        quality: 'auto',
      });
      const uniforms = body.filters.map(
        (filter: { resources: { leafShadeUniforms: { uniforms: { uOpacity: number } } } }) =>
          filter.resources.leafShadeUniforms.uniforms,
      );
      const opacities = uniforms.map((item: { uOpacity: number }) => item.uOpacity);
      uniforms.forEach((item: { uOpacity: number }) => (item.uOpacity = 0));
      const unshaded = read();

      const visibility = descendants.map((child: { visible: boolean }) => ({
        child,
        visible: child.visible,
      }));
      const bodyPath = new Set();
      for (let ancestor = body; ancestor; ancestor = ancestor.parent) bodyPath.add(ancestor);
      descendants.forEach((child: { visible: boolean }) => (child.visible = bodyPath.has(child)));
      const silhouette = read().pixels;
      visibility.forEach(
        ({ child, visible }: { child: { visible: boolean }; visible: boolean }) =>
          (child.visible = visible),
      );

      uniforms.forEach(
        (item: { uOpacity: number }, index: number) => (item.uOpacity = opacities[index]),
      );
      const shaded = read();
      let shadedPixels = 0;
      let hardVerticalRun = 0;
      let hardVerticalEdge = 0;
      for (let x = 900; x < 1440; x++) {
        let run = 0;
        let edgeRows = 0;
        for (let y = 396; y < 900; y++) {
          const offset = ((899 - y) * 1600 + x) * 4;
          const previousOffset = offset - 4;
          const difference = Math.max(
            unshaded.pixels[offset] - shaded.pixels[offset],
            unshaded.pixels[offset + 1] - shaded.pixels[offset + 1],
            unshaded.pixels[offset + 2] - shaded.pixels[offset + 2],
          );
          const previousDifference = Math.max(
            unshaded.pixels[previousOffset] - shaded.pixels[previousOffset],
            unshaded.pixels[previousOffset + 1] - shaded.pixels[previousOffset + 1],
            unshaded.pixels[previousOffset + 2] - shaded.pixels[previousOffset + 2],
          );
          if (silhouette[offset + 3] > 24 && difference > 5) {
            shadedPixels++;
            run++;
            hardVerticalRun = Math.max(hardVerticalRun, run);
          } else run = 0;
          if (
            silhouette[offset + 3] > 24 &&
            silhouette[previousOffset + 3] > 24 &&
            Math.abs(difference - previousDifference) > 5
          )
            edgeRows++;
        }
        hardVerticalEdge = Math.max(hardVerticalEdge, edgeRows);
      }
      return {
        shadedPixels,
        hardVerticalRun,
        hardVerticalEdge,
        unshaded: unshaded.image,
        shaded: shaded.image,
      };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  await saveDataUrl(`${evidencePrefix}-receiver-off.png`, result.unshaded);
  await saveDataUrl(`${evidencePrefix}-receiver-on.png`, result.shaded);
  await writeFile(
    path.join(evidenceDir, `${evidencePrefix}-receiver-metrics.json`),
    JSON.stringify(
      {
        shadedPixels: result.shadedPixels,
        hardVerticalRun: result.hardVerticalRun,
        hardVerticalEdge: result.hardVerticalEdge,
      },
      null,
      2,
    ),
  );
  expect(result.shadedPixels).toBeGreaterThan(5_000);
  expect(result.hardVerticalEdge).toBeLessThan(60);
});

test('actual sleeper silhouettes show slow breath and shared-gust hair while supports stay fixed', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const sleeperUrl = '/src/room/pixi/sleeper.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual Pixi renderer');
    const [{ loadArtwork }, { createSleeper }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sleeperUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const imageFromPixels = (pixels: Uint8Array) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 900;
      const context = canvas.getContext('2d')!;
      const upright = new Uint8ClampedArray(pixels.length);
      for (let y = 0; y < 900; y++)
        upright.set(pixels.subarray(y * 1600 * 4, (y + 1) * 1600 * 4), (899 - y) * 1600 * 4);
      context.putImageData(new ImageData(upright, 1600, 900), 0, 0);
      return canvas.toDataURL();
    };
    const frame = async (timeSeconds: number) => {
      const sleeper = createSleeper(loaded.textures.sleeper);
      const renderer = new WebGLRenderer();
      await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0, antialias: false });
      try {
        sleeper.update(timeSeconds, 0);
        renderer.render(sleeper.container);
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
        return { pixels, image: imageFromPixels(pixels) };
      } finally {
        sleeper.container.destroy({ children: true });
        sleeper.dispose();
        renderer.destroy();
      }
    };
    const changedAlpha = (
      before: Uint8Array,
      after: Uint8Array,
      region: [number, number, number, number],
    ) => {
      const [x, y, width, height] = region;
      let changed = 0;
      for (let row = y; row < y + height; row++)
        for (let column = x; column < x + width; column++) {
          const offset = ((899 - row) * 1600 + column) * 4;
          if (Math.abs(before[offset + 3] - after[offset + 3]) > 20) changed++;
        }
      return changed;
    };
    const changedBytes = (
      before: Uint8Array,
      after: Uint8Array,
      region: [number, number, number, number],
    ) => {
      const [x, y, width, height] = region;
      let changed = 0;
      for (let row = y; row < y + height; row++)
        for (let column = x; column < x + width; column++) {
          const offset = ((899 - row) * 1600 + column) * 4;
          if ([0, 1, 2, 3].some((channel) => before[offset + channel] !== after[offset + channel]))
            changed++;
        }
      return changed;
    };
    try {
      const rest = await frame(0);
      const inhale = await frame(2.4);
      const laterGust = await frame(6);
      return {
        torsoSilhouette: changedAlpha(rest.pixels, inhale.pixels, [1040, 485, 170, 175]),
        hairSilhouette: changedAlpha(rest.pixels, laterGust.pixels, [1110, 396, 125, 80]),
        fixedSupports:
          changedBytes(rest.pixels, inhale.pixels, [975, 590, 35, 160]) +
          changedBytes(rest.pixels, inhale.pixels, [1260, 817, 125, 65]) +
          changedBytes(rest.pixels, inhale.pixels, [1220, 517, 30, 22]),
        rest: rest.image,
        inhale: inhale.image,
        laterGust: laterGust.image,
      };
    } finally {
      loaded.dispose();
    }
  });
  await Promise.all([
    saveDataUrl(`${evidencePrefix}-actual-0.png`, result.rest),
    saveDataUrl(`${evidencePrefix}-actual-2.4.png`, result.inhale),
    saveDataUrl(`${evidencePrefix}-actual-6.png`, result.laterGust),
  ]);
  await writeFile(
    path.join(evidenceDir, `${evidencePrefix}-motion-metrics.json`),
    JSON.stringify(
      {
        torsoSilhouette: result.torsoSilhouette,
        hairSilhouette: result.hairSilhouette,
        fixedSupports: result.fixedSupports,
      },
      null,
      2,
    ),
  );
  expect(result.torsoSilhouette).toBeGreaterThan(55);
  expect(result.hairSilhouette).toBeGreaterThan(80);
  expect(result.fixedSupports).toBe(0);
});

test('the assembled chair has an alpha-shaped directional floor shadow and exact contacts', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const sceneUrl = '/src/room/pixi/scene.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual Pixi renderer');
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0, antialias: false });
    const imageFromPixels = (pixels: Uint8Array) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 900;
      const context = canvas.getContext('2d')!;
      const upright = new Uint8ClampedArray(pixels.length);
      for (let y = 0; y < 900; y++)
        upright.set(pixels.subarray(y * 1600 * 4, (y + 1) * 1600 * 4), (899 - y) * 1600 * 4);
      context.putImageData(new ImageData(upright, 1600, 900), 0, 0);
      return canvas.toDataURL();
    };
    const read = () => {
      renderer.render(scene.container);
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return { pixels, image: imageFromPixels(pixels) };
    };
    try {
      scene.update({ elapsedSeconds: 2.4, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1600,
        quality: 'auto',
      });
      const withShadow = read();
      const shadow = scene.container.getChildByLabel('seated-floor-shadow', true);
      if (!shadow)
        return {
          present: false,
          changedPixels: 0,
          occupiedPixels: 0,
          boundsArea: 0,
          sourceLinkedPixels: 0,
          contactCounts: [0, 0, 0, 0],
          withShadow: withShadow.image,
          withoutShadow: withShadow.image,
          shadowOnly: withShadow.image,
          shadowAtRest: withShadow.image,
          contactOnly: withShadow.image,
        };
      shadow.visible = false;
      const withoutShadow = read();
      shadow.visible = true;
      const visibility = scene.container.children.map((child: { visible: boolean }) => ({
        child,
        visible: child.visible,
      }));
      scene.container.children.forEach(
        (child: { visible: boolean }) => (child.visible = child === shadow),
      );
      const shadowOnly = read();
      const castLayer = shadow.getChildByLabel('seated-directional-cast', true);
      if (!castLayer) throw new Error('Seated shadow is missing its source-linked cast layer');
      castLayer.visible = false;
      const contactOnly = read();
      castLayer.visible = true;
      visibility.forEach(
        ({ child, visible }: { child: { visible: boolean }; visible: boolean }) =>
          (child.visible = visible),
      );
      scene.update({ elapsedSeconds: 0, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1600,
        quality: 'auto',
      });
      scene.container.children.forEach(
        (child: { visible: boolean }) => (child.visible = child === shadow),
      );
      const shadowAtRest = read();
      visibility.forEach(
        ({ child, visible }: { child: { visible: boolean }; visible: boolean }) =>
          (child.visible = visible),
      );
      let changedPixels = 0;
      let occupiedPixels = 0;
      let sourceLinkedPixels = 0;
      let left = 1600;
      let top = 900;
      let right = 0;
      let bottom = 0;
      const contactCounts = [
        [968, 884, 32, 12],
        [1232, 884, 32, 12],
        [1253, 839, 78, 12],
        [1288, 873, 108, 14],
      ].map(([startX, startY, width, height]) => {
        let pixels = 0;
        for (let y = startY; y < startY + height; y++)
          for (let x = startX; x < startX + width; x++) {
            const offset = ((899 - y) * 1600 + x) * 4;
            if (contactOnly.pixels[offset + 3] > 8) pixels++;
          }
        return pixels;
      });
      for (let y = 650; y < 900; y++)
        for (let x = 800; x < 1450; x++) {
          const offset = ((899 - y) * 1600 + x) * 4;
          if (
            [0, 1, 2].some(
              (channel) =>
                Math.abs(
                  withShadow.pixels[offset + channel] - withoutShadow.pixels[offset + channel],
                ) > 2,
            )
          )
            changedPixels++;
          if (shadowOnly.pixels[offset + 3] > 3) {
            occupiedPixels++;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
          if (
            [0, 1, 2, 3].some(
              (channel) =>
                Math.abs(
                  shadowOnly.pixels[offset + channel] - shadowAtRest.pixels[offset + channel],
                ) > 2,
            )
          )
            sourceLinkedPixels++;
        }
      const boundsArea = occupiedPixels ? (right - left + 1) * (bottom - top + 1) : 0;
      return {
        present: true,
        changedPixels,
        occupiedPixels,
        boundsArea,
        sourceLinkedPixels,
        contactCounts,
        withShadow: withShadow.image,
        withoutShadow: withoutShadow.image,
        shadowOnly: shadowOnly.image,
        shadowAtRest: shadowAtRest.image,
        contactOnly: contactOnly.image,
      };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  await Promise.all([
    saveDataUrl(`${evidencePrefix}-shadow-on.png`, result.withShadow),
    saveDataUrl(`${evidencePrefix}-shadow-off.png`, result.withoutShadow),
    saveDataUrl(`${evidencePrefix}-shadow-only.png`, result.shadowOnly),
    saveDataUrl(`${evidencePrefix}-shadow-source-0.png`, result.shadowAtRest),
    saveDataUrl(`${evidencePrefix}-contacts-only.png`, result.contactOnly),
  ]);
  await writeFile(
    path.join(evidenceDir, `${evidencePrefix}-shadow-metrics.json`),
    JSON.stringify(
      {
        present: result.present,
        changedPixels: result.changedPixels,
        occupiedPixels: result.occupiedPixels,
        boundsArea: result.boundsArea,
        sourceLinkedPixels: result.sourceLinkedPixels,
        contactCounts: result.contactCounts,
      },
      null,
      2,
    ),
  );
  expect(result.present).toBe(true);
  expect(result.changedPixels).toBeGreaterThan(250);
  expect(result.occupiedPixels).toBeGreaterThan(350);
  expect(result.occupiedPixels / result.boundsArea).toBeLessThan(0.65);
  expect(result.sourceLinkedPixels).toBeGreaterThan(20);
  expect(result.contactCounts.every((count) => count > 8)).toBe(true);
});
