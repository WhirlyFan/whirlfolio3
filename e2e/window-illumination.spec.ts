import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('window aperture and frame create the light; casters remove only that same direct light', async ({
  page,
}, testInfo) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      lightingUrl = '/src/room/pixi/lighting.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual Pixi');
    const [{ createLighting }, { Container, Graphics, MeshPlane, Texture, WebGLRenderer }] =
      await Promise.all([import(lightingUrl), import(pixiUrl)]);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, backgroundColor: 0x606060 });
    const lighting = createLighting();
    const stage = new Container();
    stage.addChild(new Graphics().rect(0, 0, 1600, 900).fill(0x606060), lighting.container);
    const read = () => {
      renderer.render({ container: stage });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const sample = (pixels: Uint8Array, x: number, y: number) =>
      Array.from(pixels.slice(((899 - y) * 1600 + x) * 4, ((899 - y) * 1600 + x) * 4 + 4));
    try {
      const open = read();
      const caster = new MeshPlane({ texture: Texture.WHITE, verticesX: 2, verticesY: 2 });
      caster.position.set(780, 180);
      caster.width = 40;
      caster.height = 40;
      lighting.add(caster, 'floor', 1);
      lighting.update();
      const blocked = read();
      caster.x += 40;
      lighting.update();
      const moved = read();
      const projected = new Container();
      projected.addChild(
        new Graphics().rect(720, 800, 30, 30).rect(1270, 775, 50, 30).fill(0xffffff),
      );
      lighting.addProjectedShadow(projected);
      const projectedFrame = read();
      let outsideChanged = 0,
        darkenedBelowAmbient = 0;
      for (let y = 650; y < 850; y++)
        for (let x = 0; x < 1300; x++) {
          const i = ((899 - y) * 1600 + x) * 4;
          if (open[i] === 96 && Math.abs(blocked[i] - 96) > 1) outsideChanged++;
          if (blocked[i] < 95) darkenedBelowAmbient++;
        }
      const pixels = {
        floor: sample(open, 584, 784),
        desk: sample(open, 1120, 527),
        frame: sample(open, 166, 784),
        formerChairFloor: sample(open, 950, 720),
        outside: sample(open, 1300, 784),
        blocked: sample(blocked, 584, 784),
        moved: sample(moved, 584, 784),
        projected: sample(projectedFrame, 730, 810),
        projectedOutside: sample(projectedFrame, 1300, 784),
      };
      const image = renderer.canvas.toDataURL();
      caster.destroy();
      return { pixels, outsideChanged, darkenedBelowAmbient, image };
    } finally {
      stage.destroy({ children: true });
      lighting.dispose();
      renderer.destroy();
    }
  });
  await writeFile(
    testInfo.outputPath('window-illumination.png'),
    Buffer.from(result.image.split(',')[1], 'base64'),
  );
  await writeFile(
    testInfo.outputPath('window-illumination.json'),
    JSON.stringify({ ...result, image: undefined }, null, 2),
  );
  expect(result.pixels.floor[0]).toBeGreaterThan(115);
  expect(result.pixels.desk[0]).toBeGreaterThan(110);
  // This isolated stage has no chair. Its old v7 location must not leave a
  // permanent hole in the floor; the real scene draws its current chair later.
  expect(result.pixels.formerChairFloor[0]).toBeGreaterThan(115);
  // The thin projected sash has a shared penumbra; it must exclude most direct light.
  expect(result.pixels.frame[0]).toBeLessThan(108);
  expect(result.pixels.outside[0]).toBe(96);
  expect(result.pixels.blocked[0]).toBeLessThan(100);
  expect(result.pixels.moved[0]).toBeGreaterThan(115);
  expect(result.pixels.projected[0]).toBe(96);
  expect(result.pixels.projectedOutside[0]).toBe(96);
  expect(result.outsideChanged).toBe(0);
  expect(result.darkenedBelowAmbient).toBe(0);
});

test('vertical body proxy keeps the leaf field tall and preserves body alpha', async ({ page }) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      lightingUrl = '/src/room/pixi/lighting.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual Pixi');
    const [{ createLighting }, { Container, MeshPlane, Texture, WebGLRenderer }] =
      await Promise.all([import(lightingUrl), import(pixiUrl)]);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, backgroundAlpha: 0 });
    const body = new MeshPlane({ texture: Texture.WHITE, verticesX: 2, verticesY: 2 });
    body.position.set(1000, 450);
    body.width = 200;
    body.height = 200;
    const leaf = new MeshPlane({ texture: Texture.WHITE, verticesX: 2, verticesY: 2 });
    leaf.position.set(1100, 150);
    leaf.width = 100;
    leaf.height = 100;
    const stage = new Container();
    stage.addChild(body);
    const lighting = createLighting();
    lighting.addMeshReceiver(body, leaf, 0.5);
    lighting.update();
    try {
      renderer.render({ container: stage });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      const shadedRows = [];
      let erasedBody = 0,
        leakedAlpha = 0;
      for (let y = 440; y < 660; y++)
        for (let x = 990; x < 1210; x++) {
          const i = ((899 - y) * 1600 + x) * 4;
          const inside = x >= 1000 && x < 1200 && y >= 450 && y < 650;
          if (inside && pixels[i + 3] !== 255) erasedBody++;
          if (!inside && pixels[i + 3] !== 0) leakedAlpha++;
          if (x === 1100 && pixels[i + 3] === 255 && pixels[i] < 200) shadedRows.push(y);
        }
      return {
        shadedRows,
        erasedBody,
        leakedAlpha,
        // Body light is already painted. The receiver follows source alpha
        // continuously rather than cutting that alpha at a binary jamb edge.
        leafOverFrameRay: pixels[((899 - 500) * 1600 + 1150) * 4],
      };
    } finally {
      stage.destroy({ children: true });
      leaf.destroy();
      lighting.container.destroy({ children: true });
      lighting.dispose();
      renderer.destroy();
    }
  });
  expect(result.shadedRows.length).toBeGreaterThan(100);
  expect(result.shadedRows[0]).toBeGreaterThanOrEqual(458);
  expect(result.shadedRows.at(-1)).toBeLessThanOrEqual(592);
  expect(result.erasedBody).toBe(0);
  expect(result.leakedAlpha).toBe(0);
  expect(result.leafOverFrameRay).toBe(128);
});
