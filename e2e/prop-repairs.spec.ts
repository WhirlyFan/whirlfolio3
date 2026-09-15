import { expect, test } from '@playwright/test';

test('old lens shadow is removed while unrelated paint stays registered', async ({ page }) => {
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
    const assets = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(assets.textures);
    const renderer = new WebGLRenderer();
    // Match the original illustration coordinates, not a browser crop.
    await renderer.init({ width: 1672, height: 941, antialias: false });
    scene.container.scale.set(1672 / 1600, 941 / 900);
    const reference = async (url: string) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return context;
    };
    try {
      scene.update({ elapsedSeconds: 0, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1600,
        quality: 'auto',
      });
      renderer.render({ container: scene.container });
      const pixels = new Uint8Array(1672 * 941 * 4);
      renderer.gl.readPixels(0, 0, 1672, 941, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      const distance = (x: number, y: number, expected: Uint8ClampedArray) => {
        const index = ((940 - y) * 1672 + x) * 4;
        return Math.max(
          ...[0, 1, 2].map((channel) => Math.abs(pixels[index + channel] - expected[channel])),
        );
      };
      const background = await reference('/e2e/fixtures/summer-room-v7.webp');
      // The old black strap and lens must both become warm door wood. Sample
      // their interiors, excluding the retained hook, handle and door trim.
      const woodFraction = (left: number, top: number, width: number, height: number) => {
        let wood = 0;
        let total = 0;
        for (let y = top; y < top + height; y += 3) {
          for (let x = left; x < left + width; x += 3) {
            const i = ((940 - y) * 1672 + x) * 4;
            if (pixels[i] > 130 && pixels[i] > pixels[i + 1] + 20 && pixels[i] > pixels[i + 2] + 45)
              wood++;
            total++;
          }
        }
        return wood / total;
      };
      const lensWood = woodFraction(53, 480, 46, 52);
      // Removing the camera must also remove its baked shadow below the lens.
      const lensShadowRed = [42, 62, 82].map((x) => pixels[((940 - 575) * 1672 + x) * 4]);
      // Door/upper wall are unchanged. The desk and board wall are deliberately
      // repainted now; integrated-background.spec checks their chosen paint.
      const outsideError = [
        [18, 300],
        [170, 350],
        [70, 660],
        [160, 340],
      ].map(([x, y]) => distance(x, y, background.getImageData(x, y, 1, 1).data));
      const camera = scene.container.getChildByLabel('tripod-camera', true);
      let tripodHead = 0;
      let tripodFeet = 0;
      if (camera) {
        camera.visible = false;
        renderer.render({ container: scene.container });
        const without = new Uint8Array(pixels.length);
        renderer.gl.readPixels(
          0,
          0,
          1672,
          941,
          renderer.gl.RGBA,
          renderer.gl.UNSIGNED_BYTE,
          without,
        );
        const changed = (left: number, top: number, width: number, height: number) => {
          let count = 0;
          for (let y = top; y < top + height; y++)
            for (let x = left; x < left + width; x++) {
              const i = ((940 - y) * 1672 + x) * 4;
              if (Math.abs(pixels[i] - without[i]) > 15) count++;
            }
          return count;
        };
        tripodHead = changed(750, 380, 225, 175);
        tripodFeet = changed(740, 675, 220, 100);
      }
      return {
        lensWood,
        lensShadowRed,
        outsideError,
        tripodHead,
        tripodFeet,
      };
    } finally {
      scene.dispose();
      renderer.destroy();
      assets.dispose();
    }
  });
  expect(result.lensWood).toBeGreaterThan(0.95);
  expect(Math.min(...result.lensShadowRed)).toBeGreaterThan(190);
  expect(Math.max(...result.outsideError)).toBeLessThanOrEqual(12);
  // A real camera/lens is by the window, with tripod feet on open floor.
  expect(result.tripodHead).toBeGreaterThan(500);
  expect(result.tripodFeet).toBeGreaterThan(200);
});
