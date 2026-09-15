import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('actual curtain and garden meshes remove and move the aperture-derived light without staining ambient floor', async ({
  page,
}, testInfo) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      lightingUrl = '/src/room/pixi/lighting.ts',
      ambientUrl = '/src/room/pixi/ambient.ts',
      motionUrl = '/src/room/pixi/motion.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual Pixi');
    const [
      { loadArtwork, placement },
      { createLighting },
      { createAmbient },
      { curtainOffset },
      { MeshPlane, WebGLRenderer },
    ] = await Promise.all([
      import(assetUrl),
      import(lightingUrl),
      import(ambientUrl),
      import(motionUrl),
      import(pixiUrl),
    ]);
    const assets = await loadArtwork(new AbortController().signal),
      ambient = createAmbient(assets.textures);
    const curtain = new MeshPlane({
      texture: assets.textures.curtain,
      verticesX: 8,
      verticesY: 16,
    });
    curtain.position.set(placement.curtain.x, placement.curtain.y);
    curtain.scale.set(
      placement.curtain.width / curtain.texture.width,
      placement.curtain.height / curtain.texture.height,
    );
    const rest = curtain.geometry.positions.slice(),
      lighting = createLighting(),
      renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, backgroundColor: 0x606060 });
    const read = () => {
      renderer.render({ container: lighting.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const update = (time: number) => {
      ambient.update(time, { fanSpeed: 0, width: 1600, quality: 'low' });
      for (let i = 0; i < rest.length; i += 2)
        curtain.geometry.positions[i] =
          rest[i] + curtainOffset(rest[i + 1] / curtain.texture.height, time) / curtain.scale.x;
      curtain.geometry.getAttribute('aPosition').buffer.update();
      lighting.update();
      return read();
    };
    const count = (a: Uint8Array, b: Uint8Array, condition: (a: number, b: number) => boolean) => {
      let pixels = 0;
      for (let y = 690; y < 840; y++)
        for (let x = 0; x < 1140; x++) {
          const i = ((899 - y) * 1600 + x) * 4;
          if (condition(a[i], b[i])) pixels++;
        }
      return pixels;
    };
    try {
      const open = read();
      lighting.add(curtain, 'floor', 0.8);
      const curtainOnly = update(0);
      for (const branch of ambient.outdoorFoliage) {
        lighting.add(branch, 'floor', 0.85);
        lighting.add(branch, 'desk', 0.85);
      }
      const restFrame = update(0),
        gust = update(2.4);
      return {
        curtainPixels: count(open, curtainOnly, (a, b) => a - b > 15),
        leafPixels: count(curtainOnly, restFrame, (a, b) => a - b > 15),
        movingPixels: count(restFrame, gust, (a, b) => Math.abs(a - b) > 8),
        ambientStains: count(open, gust, (a, b) => a === 96 && Math.abs(b - 96) > 1),
        belowAmbient: count(open, gust, (_a, b) => b < 95),
        image: renderer.canvas.toDataURL(),
      };
    } finally {
      curtain.destroy();
      ambient.container.destroy({ children: true });
      ambient.dispose();
      lighting.container.destroy({ children: true });
      lighting.dispose();
      renderer.destroy();
      assets.dispose();
    }
  });
  await writeFile(
    testInfo.outputPath('source-transmission.png'),
    Buffer.from(result.image.split(',')[1], 'base64'),
  );
  await writeFile(
    testInfo.outputPath('source-transmission.json'),
    JSON.stringify({ ...result, image: undefined }, null, 2),
  );
  expect(result.curtainPixels).toBeGreaterThan(1000);
  expect(result.leafPixels).toBeGreaterThan(300);
  expect(result.movingPixels).toBeGreaterThan(100);
  expect(result.ambientStains).toBe(0);
  expect(result.belowAmbient).toBe(0);
});
