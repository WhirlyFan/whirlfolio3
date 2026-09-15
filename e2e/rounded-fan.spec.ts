import { expect, test } from '@playwright/test';

test('original fan keeps a transparent footprint and rests on its painted pedestal', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetsUrl = '/src/room/pixi/assets.ts';
    const { artwork } = await import(assetsUrl);
    const fanUrl = '/src/room/pixi/fan.ts';
    const fanSource = await fetch(fanUrl).then((response) => response.text());
    const pixiUrl = fanSource.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve the actual room renderer');
    const [{ createFan }, { ImageSource, Texture, WebGLRenderer }] = await Promise.all([
      import(fanUrl),
      import(pixiUrl),
    ]);
    const blob = await fetch(artwork.fan).then((response) => response.blob());
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const bitmap = await createImageBitmap(image, { premultiplyAlpha: 'premultiply' });
    URL.revokeObjectURL(objectUrl);
    const texture = new Texture({
      source: new ImageSource({ resource: bitmap, alphaMode: 'premultiplied-alpha' }),
    });
    const fan = createFan(texture);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, antialias: false, backgroundAlpha: 0 });
    try {
      fan.update(0.6);
      renderer.render({ container: fan.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      let pedestalContactPixels = 0;
      let opaquePixelsBelowDesk = 0;
      for (let y = 500; y < 900; y++) {
        for (let x = 1000; x <= 1180; x++) {
          const offset = ((899 - y) * 1600 + x) * 4;
          if (pixels[offset + 3] <= 100) continue;
          if (y <= 510) pedestalContactPixels++;
          else opaquePixelsBelowDesk++;
        }
      }
      return { pedestalContactPixels, opaquePixelsBelowDesk };
    } finally {
      fan.container.destroy({ children: true });
      fan.dispose();
      renderer.destroy();
      texture.destroy(true);
      bitmap.close();
    }
  });

  expect(result.pedestalContactPixels).toBeGreaterThan(100);
  expect(result.opaquePixelsBelowDesk).toBe(0);
});
