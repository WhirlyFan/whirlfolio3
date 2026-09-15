import { expect, test } from '@playwright/test';

test('room artwork loader composites translucent edges without white or colored fringes', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  // A controlled raster edge goes through our real fetch/decode/texture pipeline.
  // Changing the loader to decode straight alpha must fail this rendered-pixel check.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgba(200, 100, 50, 0.5)';
    context.fillRect(0, 0, 1, 2);
    return canvas.toDataURL().split(',')[1];
  });
  await page.route('**/art/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(png, 'base64'),
    }),
  );
  const pixels = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve the actual room Pixi module');
    const [{ loadArtwork }, { Sprite, WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const renderer = new WebGLRenderer();
    await renderer.init({
      width: 2,
      height: 2,
      resolution: 1,
      backgroundColor: '#204060',
      antialias: false,
    });
    const sprite = new Sprite(loaded.textures.curtain);
    try {
      renderer.render({ container: sprite });
      const gl = renderer.gl;
      const result = new Uint8Array(8);
      gl.readPixels(0, 0, 2, 1, gl.RGBA, gl.UNSIGNED_BYTE, result);
      return Array.from(result);
    } finally {
      sprite.destroy();
      renderer.destroy();
      loaded.dispose();
    }
  });
  // Half-red-brown edge over #204060; the transparent neighbor stays background.
  const expected = [116, 82, 73, 255, 32, 64, 96, 255];
  pixels.forEach((value, index) =>
    expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(2),
  );
});
