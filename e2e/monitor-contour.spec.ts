import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('monitor fills the v7 inner bezel and preserves its lamp and leaf foreground', async ({
  page,
}, testInfo) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual room Pixi module');
    const discoveryUrl = '/src/room/pixi/discovery.ts';
    const [{ loadArtwork }, { createDiscovery }, { Container, Sprite, WebGLRenderer }] =
      await Promise.all([import(assetUrl), import(discoveryUrl), import(pixiUrl)]);
    const loaded = await loadArtwork(new AbortController().signal);
    const stage = new Container();
    const background = new Sprite(loaded.textures.background);
    background.width = 1600;
    background.height = 900;
    stage.addChild(background);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1672, height: 941, resolution: 1, backgroundAlpha: 0 });
    stage.scale.set(1672 / 1600, 941 / 900);
    const read = () => {
      renderer.render({ container: stage });
      const pixels = new Uint8Array(1672 * 941 * 4);
      renderer.gl.readPixels(0, 0, 1672, 941, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const before = read();
    const discovery = createDiscovery(loaded.textures);
    stage.addChild(discovery.container);
    const after = read();
    const difference = (x: number, y: number) => {
      const offset = ((940 - Math.round(y)) * 1672 + Math.round(x)) * 4;
      return Math.max(
        ...[0, 1, 2].map((channel) => Math.abs(after[offset + channel] - before[offset + channel])),
      );
    };
    // Independent v7 measurements: points inside/outside every unobscured edge.
    const edges = [
      [1452, 380, 1596, 371, 0, -9],
      [1452, 380, 1435, 524, -9, 0],
      [1435, 525, 1615, 555, 0, 10],
      [1634, 416, 1625, 484, 10, 0],
    ];
    const missedScreen: number[][] = [];
    const overwrittenBezel: number[][] = [];
    for (const [x1, y1, x2, y2, dx, dy] of edges)
      for (let step = 0; step <= 12; step++) {
        const x = x1 + ((x2 - x1) * step) / 12;
        const y = y1 + ((y2 - y1) * step) / 12;
        if (difference(x, y) < 35) missedScreen.push([x, y]);
        if (difference(x + dx, y + dy) > 8) overwrittenBezel.push([x + dx, y + dy]);
      }
    // Dense hand-traced points inside the lamp rim, plus adjacent screen pixels.
    const lamp = [
      [1600, 380],
      [1606, 389],
      [1614, 394],
      [1624, 399],
      [1636, 404],
    ];
    const lampDamage = lamp.filter(([x, y]) => difference(x, y) > 8);
    const screenBesideLamp = [
      [1596, 387],
      [1604, 395],
      [1613, 402],
      [1623, 407],
    ];
    const blankLampHalo = screenBesideLamp.filter(([x, y]) => difference(x, y) < 35);
    const leafDamage = [
      [1617, 502],
      [1624, 499],
      [1628, 504],
    ].filter(([x, y]) => difference(x, y) > 8);
    const blankLeafHalo = [
      [1610, 498],
      [1616, 513],
      [1620, 516],
    ].filter(([x, y]) => difference(x, y) < 35);
    const crop = document.createElement('canvas');
    crop.width = 320;
    crop.height = 510;
    crop.getContext('2d')!.drawImage(renderer.canvas, 1352, 100, 320, 510, 0, 0, 320, 510);
    try {
      return {
        missedScreen,
        overwrittenBezel,
        lampDamage,
        blankLampHalo,
        leafDamage,
        blankLeafHalo,
        screenshot: crop.toDataURL(),
      };
    } finally {
      stage.destroy({ children: true });
      discovery.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  await writeFile(
    testInfo.outputPath('monitor-v7-contour.png'),
    Buffer.from(result.screenshot.split(',')[1], 'base64'),
  );
  await testInfo.attach('monitor-v7-contour', {
    body: Buffer.from(result.screenshot.split(',')[1], 'base64'),
    contentType: 'image/png',
  });
  expect(result.missedScreen).toEqual([]);
  expect(result.overwrittenBezel).toEqual([]);
  expect(result.lampDamage).toEqual([]);
  expect(result.blankLampHalo).toEqual([]);
  expect(result.leafDamage).toEqual([]);
  expect(result.blankLeafHalo).toEqual([]);
});
