import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('actual mirrored vines follow the canopy gust and desk dust survives the assembled phone crop', async ({
  page,
}, testInfo) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve scene renderer');
    const sceneUrl = '/src/room/pixi/scene.ts';
    const ambientUrl = '/src/room/pixi/ambient.ts';
    const [{ loadArtwork }, { createPaintedScene }, { createAmbient }, { WebGLRenderer }] =
      await Promise.all([import(assetUrl), import(sceneUrl), import(ambientUrl), import(pixiUrl)]);
    const loaded = await loadArtwork(new AbortController().signal);
    const ambient = createAmbient(loaded.textures);
    const meshes = [...ambient.foliage, ...ambient.outdoorFoliage];
    const before = meshes.map((mesh) => mesh.geometry.positions.slice());
    ambient.update(2, { fanSpeed: 0, width: 390, quality: 'auto' });
    const worldTips = meshes.map((mesh, index) => {
      const offsets = Array.from(mesh.geometry.positions as Float32Array)
        .filter((_, vertex) => vertex % 2 === 0)
        .map((x, vertex) => (x - before[index][vertex * 2]) * mesh.scale.x);
      return { min: Math.min(...offsets), max: Math.max(...offsets) };
    });
    ambient.container.destroy({ children: true });
    ambient.dispose();

    const scene = createPaintedScene(loaded.textures);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, antialias: false });
    const read = () => {
      renderer.render({ container: scene.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    try {
      scene.update({ elapsedSeconds: 0, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 390,
        quality: 'auto',
      });
      const withDust = read();
      const screenshot = renderer.canvas.toDataURL('image/png');
      // The ambient layer owns the fixed mote pool; hide only those final graphics.
      const ambientLayer = scene.container.children.find(
        (child: { label: string }) => child.label === 'room-ambient',
      );
      if (!ambientLayer) throw new Error('Missing room ambient layer');
      const motes = ambientLayer.children.slice(-18);
      const visibleMotes = motes.filter((mote: { visible: boolean }) => mote.visible).length;
      motes.forEach((mote: { visible: boolean }) => {
        mote.visible = false;
      });
      const withoutDust = read();
      let deskDustPixels = 0;
      for (let y = 180; y < 650; y++) {
        for (let x = 1132; x < 1548; x++) {
          const offset = ((899 - y) * 1600 + x) * 4;
          const change =
            withDust[offset] -
            withoutDust[offset] +
            withDust[offset + 1] -
            withoutDust[offset + 1] +
            withDust[offset + 2] -
            withoutDust[offset + 2];
          if (change > 18) deskDustPixels++;
        }
      }
      return { worldTips, visibleMotes, deskDustPixels, screenshot };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  for (const tip of result.worldTips) {
    expect(tip.min).toBeGreaterThanOrEqual(-0.001);
    expect(tip.max).toBeGreaterThan(5);
  }
  expect(result.visibleMotes).toBeLessThanOrEqual(6);
  expect(result.deskDustPixels).toBeGreaterThan(20);
  console.log(
    JSON.stringify({
      worldTips: result.worldTips,
      visibleMotes: result.visibleMotes,
      deskDustPixels: result.deskDustPixels,
    }),
  );
  await testInfo.attach('phone-dust-scene', {
    body: Buffer.from(result.screenshot.split(',')[1], 'base64'),
    contentType: 'image/png',
  });
  await writeFile(
    testInfo.outputPath('phone-dust-scene.png'),
    Buffer.from(result.screenshot.split(',')[1], 'base64'),
  );
});
