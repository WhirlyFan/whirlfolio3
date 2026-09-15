import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('sill vine grows from the pot opening with a still root behind the foreground lip', async ({
  page,
}, testInfo) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const ambientUrl = '/src/room/pixi/ambient.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual Pixi renderer');
    const [{ loadArtwork }, { createAmbient }, { Container, Sprite, WebGLRenderer }] =
      await Promise.all([import(assetUrl), import(ambientUrl), import(pixiUrl)]);
    const assets = await loadArtwork(new AbortController().signal);
    const ambient = createAmbient(assets.textures);
    const vine = ambient.foliage[4];
    const background = new Sprite(assets.textures.background);
    background.width = 1600;
    background.height = 900;
    const stage = new Container();
    stage.addChild(background, ambient.container);
    stage.scale.set(1672 / 1600, 941 / 900);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1672, height: 941, resolution: 1, antialias: false });
    const read = () => {
      renderer.render({ container: stage });
      const pixels = new Uint8Array(1672 * 941 * 4);
      renderer.gl.readPixels(0, 0, 1672, 941, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    // The painted stem junction is at (260,155) in the 512px foliage cell.
    const root = () => {
      const columns = vine.geometry.verticesX;
      const rows = vine.geometry.verticesY;
      const u = (260 / 512) * (columns - 1),
        v = (155 / 512) * (rows - 1);
      const col = Math.floor(u),
        row = Math.floor(v);
      let x = 0,
        y = 0;
      for (let dy = 0; dy <= 1; dy++)
        for (let dx = 0; dx <= 1; dx++) {
          const weight = (dx ? u - col : 1 - u + col) * (dy ? v - row : 1 - v + row);
          const index = ((row + dy) * columns + col + dx) * 2;
          x += vine.geometry.positions[index] * weight;
          y += vine.geometry.positions[index + 1] * weight;
        }
      return { x: vine.x + x * vine.scale.x, y: vine.y + y * vine.scale.y };
    };
    try {
      ambient.update(0, { fanSpeed: 0, width: 1600, quality: 'low' });
      const rootBefore = root();
      vine.visible = false;
      const bare = read();
      vine.visible = true;
      const planted = read();
      const rest = vine.geometry.positions.slice();
      const crop = document.createElement('canvas');
      crop.width = 200;
      crop.height = 220;
      crop.getContext('2d')!.drawImage(renderer.canvas, 990, 340, 200, 220, 0, 0, 200, 220);
      const screenshot = crop.toDataURL();
      ambient.update(2, { fanSpeed: 0, width: 1600, quality: 'low' });
      const rootAfter = root();
      let tipMotion = 0;
      for (let i = 0; i < rest.length; i += 2)
        tipMotion = Math.max(
          tipMotion,
          Math.abs((vine.geometry.positions[i] - rest[i]) * vine.scale.x),
        );
      const difference = (x: number, y: number) => {
        const offset = ((940 - y) * 1672 + x) * 4;
        return Math.max(
          ...[0, 1, 2].map((channel) =>
            Math.abs(planted[offset + channel] - bare[offset + channel]),
          ),
        );
      };
      let crownPixels = 0,
        overwrittenPot = 0;
      // Actual v7 pot opening source(1104,419), with foliage rising above it.
      for (let y = 383; y < 422; y++)
        for (let x = 1085; x < 1125; x++) if (difference(x, y) > 18) crownPixels++;
      for (let y = 430; y < 451; y++)
        for (let x = 1090; x < 1115; x++) if (difference(x, y) > 5) overwrittenPot++;
      return { rootBefore, rootAfter, tipMotion, crownPixels, overwrittenPot, screenshot };
    } finally {
      stage.destroy({ children: true });
      ambient.dispose();
      renderer.destroy();
      assets.dispose();
    }
  });
  await writeFile(
    testInfo.outputPath('sill-root.png'),
    Buffer.from(result.screenshot.split(',')[1], 'base64'),
  );
  const { screenshot: _screenshot, ...metrics } = result;
  await writeFile(testInfo.outputPath('sill-root.json'), JSON.stringify(metrics, null, 2));
  expect(result.rootBefore.x).toBeCloseTo((1104 / 1672) * 1600, 0);
  expect(result.rootBefore.y).toBeCloseTo((419 / 941) * 900, 0);
  expect(
    Math.hypot(result.rootAfter.x - result.rootBefore.x, result.rootAfter.y - result.rootBefore.y),
  ).toBeLessThan(0.15);
  expect(result.tipMotion).toBeGreaterThan(5);
  expect(result.crownPixels).toBeGreaterThan(300);
  expect(result.overwrittenPot).toBe(0);
});
