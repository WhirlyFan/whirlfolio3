import { expect, test } from '@playwright/test';

test('tripod feet connect to a cast shadow and the jacket hangs on the original hook', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      propsUrl = '/src/room/pixi/props.ts';
    const source = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createTripod }, { Container, Sprite, WebGLRenderer }] =
      await Promise.all([import(assetUrl), import(propsUrl), import(pixiUrl)]);
    const assets = await loadArtwork(new AbortController().signal);
    const tripod = createTripod(assets.textures.tripod);
    const room = new Container();
    const background = new Sprite(assets.textures.background);
    background.width = 1600;
    background.height = 900;
    room.addChild(background);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0 });
    const frame = (container: typeof tripod) => {
      renderer.render({ container });
      const p = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, p);
      return p;
    };
    try {
      const camera = frame(tripod);
      // Compare contact paint to independent opaque-foot coordinates measured
      // from the approved v4 sprite, not the shadow projection's own constants.
      const contacts = frame(tripod.children[1]);
      const footContact = [
        [732, 724],
        [806, 670],
        [888, 720],
      ].map(([x, y]) => contacts[((899 - y) * 1600 + x) * 4 + 3]);
      let shadow = 0;
      for (let y = 740; y < 820; y++)
        for (let x = 635; x < 865; x++) if (camera[((899 - y) * 1600 + x) * 4 + 3] > 15) shadow++;
      const repairedRoom = frame(room);
      const color = (pixels: Uint8Array, x: number, y: number) =>
        Array.from(pixels.slice(((899 - y) * 1600 + x) * 4, ((899 - y) * 1600 + x) * 4 + 4));
      return {
        shadow,
        footContact,
        coat: color(repairedRoom, 85, 245),
        repairedHookFastener: color(repairedRoom, 67, 82),
        repairedHookSupport: color(repairedRoom, 94, 103),
      };
    } finally {
      tripod.destroy({ children: true });
      room.destroy({ children: true });
      renderer.destroy();
      assets.dispose();
    }
  });
  expect(result.shadow).toBeGreaterThan(500);
  result.footContact.forEach((alpha) => expect(alpha).toBeGreaterThan(20));
  expect(Math.abs(result.coat[0] - result.coat[1])).toBeLessThan(35);
  expect(result.coat[3]).toBeGreaterThan(250);
  // Hand-measured hook details, independent of the repair's production mask.
  expect(result.repairedHookFastener[0]).toBeLessThan(80);
  expect(result.repairedHookSupport[0]).toBeGreaterThan(160);
});
