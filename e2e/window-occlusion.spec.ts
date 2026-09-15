import { expect, test } from '@playwright/test';

test('moving garden foliage stays behind the painted sash while remaining visible through it', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const assetSource = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = assetSource.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual room Pixi module');
    const ambientUrl = '/src/room/pixi/ambient.ts';
    const [{ loadArtwork }, { createAmbient }, { Container, Sprite, WebGLRenderer }] =
      await Promise.all([import(assetUrl), import(ambientUrl), import(pixiUrl)]);
    const loaded = await loadArtwork(new AbortController().signal);
    const ambient = createAmbient(loaded.textures);
    const stage = new Container();
    const background = new Sprite(loaded.textures.background);
    background.width = 1600;
    background.height = 900;
    stage.addChild(background, ambient.container);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, antialias: false });
    const read = () => {
      renderer.render({ container: stage });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    // Interior samples of the real vertical sash and adjoining garden opening,
    // measured on the 1672x941 background, away from antialiased paint edges.
    const differentPixels = (
      before: Uint8Array,
      after: Uint8Array,
      left: number,
      right: number,
    ) => {
      let changed = 0;
      for (let sourceY = 100; sourceY < 350; sourceY++) {
        for (let sourceX = left; sourceX < right; sourceX++) {
          const x = Math.round((sourceX * 1600) / 1672);
          const y = Math.round((sourceY * 900) / 941);
          const offset = ((899 - y) * 1600 + x) * 4;
          if (
            Math.max(
              ...[0, 1, 2].map((channel) =>
                Math.abs(before[offset + channel] - after[offset + channel]),
              ),
            ) > 5
          )
            changed++;
        }
      }
      return changed;
    };
    try {
      const phases = [];
      for (const time of [0, 2.1, 6]) {
        ambient.update(time, { fanSpeed: 0, width: 1600, quality: 'low' });
        ambient.outdoorFoliage[0].visible = false;
        const clear = read();
        ambient.outdoorFoliage[0].visible = true;
        const foliage = read();
        phases.push({
          frameChanged: differentPixels(clear, foliage, 1134, 1142),
          openingChanged: differentPixels(clear, foliage, 1080, 1120),
        });
      }
      return phases;
    } finally {
      stage.destroy({ children: true });
      ambient.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  for (const phase of result) {
    expect(phase.frameChanged).toBe(0);
    expect(phase.openingChanged).toBeGreaterThan(1000);
  }
});
