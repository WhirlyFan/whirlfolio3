import { expect, test } from '@playwright/test';

test('rendered shadow follows a deformation of its source mesh, not an independent phase', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const lightingUrl = '/src/room/pixi/lighting.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve actual room Pixi module');
    const [{ loadArtwork }, { createLighting }, { MeshPlane, WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(lightingUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const curtain = new MeshPlane({
      texture: loaded.textures.curtain,
      verticesX: 8,
      verticesY: 16,
    });
    curtain.position.set(600, 400);
    curtain.scale.set(40 / loaded.textures.curtain.width, 80 / loaded.textures.curtain.height);
    const lighting = createLighting();
    const renderer = new WebGLRenderer();
    await renderer.init({
      width: 1600,
      height: 900,
      resolution: 1,
      backgroundColor: '#606060',
      antialias: false,
    });
    renderer.render({ container: lighting.container });
    const open = new Uint8Array(1600 * 900 * 4);
    renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, open);
    lighting.add(curtain, 'floor', 0.8);
    function shadowCenter() {
      lighting.update();
      renderer.render({ container: lighting.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      let weight = 0;
      let x = 0;
      let y = 0;
      for (let row = 0; row < 900; row++)
        for (let col = 0; col < 1600; col++) {
          const darkness = Math.max(
            0,
            open[(row * 1600 + col) * 4] - pixels[(row * 1600 + col) * 4],
          );
          weight += darkness;
          x += col * darkness;
          y += row * darkness;
        }
      if (weight === 0) throw new Error('No shadow rendered');
      return { x: x / weight, y: y / weight };
    }
    try {
      const before = shadowCenter();
      const positions = curtain.geometry.positions;
      for (let i = 0; i < positions.length; i += 2) positions[i] += 10 / curtain.scale.x;
      curtain.geometry.getAttribute('aPosition').buffer.update();
      const deformed = shadowCenter();
      curtain.x += 6;
      const translated = shadowCenter();
      return { before, deformed, translated };
    } finally {
      curtain.destroy();
      lighting.container.destroy({ children: true });
      lighting.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  // B665 and source y400–480 give projective divisors .8233–.8767.
  // A 10px source shift must magnify to 11.4–12.2px, not use a second phase.
  const deformedShift = result.deformed.x - result.before.x;
  expect(deformedShift).toBeGreaterThan(11.4);
  expect(deformedShift).toBeLessThan(12.2);
  expect(result.deformed.y - result.before.y).toBeCloseTo(0, 0);
  expect((result.translated.x - result.deformed.x) / deformedShift).toBeCloseTo(0.6, 1);
});
