import { expect, test } from '@playwright/test';

test('static props and the open desk are painted into one registered background', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts',
      sceneUrl = '/src/room/pixi/scene.ts';
    const code = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = code.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1672, height: 941, backgroundAlpha: 0 });
    try {
      const background = scene.container.children[0];
      background.width = 1672;
      background.height = 941;
      renderer.render(background);
      const actual = new Uint8Array(1672 * 941 * 4);
      renderer.gl.readPixels(0, 0, 1672, 941, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, actual);
      const reference = async (url: string) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 1672;
        canvas.height = 941;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0, 1672, 941);
        return ctx.getImageData(0, 0, 1672, 941).data;
      };
      const paint = await reference('/e2e/fixtures/pixi-structural-background-v2.png');
      const original = await reference('/e2e/fixtures/summer-room-v7.webp');
      const error = (ref: Uint8ClampedArray, rect: number[]) => {
        const [left, top, width, height] = rect;
        let total = 0,
          count = 0;
        for (let y = top; y < top + height; y += 2)
          for (let x = left; x < left + width; x += 2) {
            const a = ((940 - y) * 1672 + x) * 4,
              b = (y * 1672 + x) * 4;
            for (let c = 0; c < 3; c++) {
              total += Math.abs(actual[a + c] - ref[b + c]);
              count++;
            }
          }
        return total / count;
      };
      return {
        // Unbroken painted wall should not gain a one-pixel color step at the
        // native composition boundary. Probes are outside object contours.
        wallSteps: [
          [286, 374],
          [290, 374],
          [294, 374],
          [1290, 350],
          [1300, 350],
          [1310, 350],
        ].map(([x, y]) => {
          const upper = ((941 - y) * 1672 + x) * 4,
            lower = ((940 - y) * 1672 + x) * 4;
          const sourceUpper = ((y - 1) * 1672 + x) * 4,
            sourceLower = (y * 1672 + x) * 4;
          return {
            actual: Math.max(
              ...[0, 1, 2].map((c) => Math.abs(actual[upper + c] - actual[lower + c])),
            ),
            // Retain legitimate source grain; detect a new step introduced by
            // composition rather than demanding flat color from a painting.
            source: Math.max(
              ...[paint, original].flatMap((ref) =>
                [0, 1, 2].map((c) => Math.abs(ref[sourceUpper + c] - ref[sourceLower + c])),
              ),
            ),
          };
        }),
        label: background.label,
        obsolete: [
          'painted-longboard',
          'reference-keyboard',
          'wooden-wrist-rest',
          'room-background-repairs',
          'painted-guitar',
          'decor-cast-shadows',
        ].filter((label) => scene.container.getChildByLabel(label, true)),
        // These include wheel/deck volume and attached shade, key case/rest/mat,
        // and the entire formerly conflicting panel/floor join (chair hidden).
        paintErrors: [
          [134, 450, 22, 310],
          [148, 380, 160, 425],
          [578, 370, 160, 370],
        ].map((rect) => error(paint, rect)),
        // Full-depth wall contact is verified separately in floor-depth.spec;
        // do not revive the old front-edge slope as the geometry specification.
        deskError: error(
          await reference('/e2e/fixtures/pixi-desk-wall-composite.png'),
          [1135, 625, 335, 280],
        ),
        fixedErrors: [
          [1510, 175, 95, 165],
          [1610, 135, 60, 150],
          [1460, 365, 130, 160],
          [25, 490, 75, 140],
        ].map((rect) => error(original, rect)),
        // The accepted integrated keyboard/rest is deliberately retained from
        // v8, not regenerated in the structural master.
        keyboardError: error(
          await reference('/e2e/fixtures/summer-room-v8.webp'),
          [1310, 575, 280, 110],
        ),
      };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect.soft(result.label).toBe('room-static-background');
  result.wallSteps.forEach((step) => expect.soft(step.actual).toBeLessThanOrEqual(step.source + 3));
  expect.soft(result.obsolete).toEqual([]);
  expect.soft(result.deskError).toBeLessThan(3);
  result.paintErrors.forEach((error) => expect.soft(error).toBeLessThan(4));
  result.fixedErrors.forEach((error) => expect.soft(error).toBeLessThan(3));
  expect.soft(result.keyboardError).toBeLessThan(3);
});
