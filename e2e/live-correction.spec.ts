import { expect, test } from '@playwright/test';

test('static guitar shade does not add a dark overlay to already shaded floor', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const url = '/src/room/pixi/assets.ts',
      sceneUrl = '/src/room/pixi/scene.ts';
    const code = await fetch(url).then((r) => r.text());
    const pixiUrl = code.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(url),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0 });
    const frame = (container = scene.container) => {
      renderer.render(container);
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    try {
      scene.update({ elapsedSeconds: 0, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1600,
        quality: 'auto',
      });
      const assembled = frame();
      // Keep the original root so the background retains its local scale.
      for (const child of scene.container.children.slice(1)) {
        child.visible = false;
      }
      const paint = frame();
      let darkened = 0;
      // Clear receiving floor below the guitar stand, outside plant/chair/camera
      // silhouettes. Live occlusion may remove sunlight, never darken ambient paint.
      for (let y = 688; y < 725; y++)
        for (let x = 540; x < 715; x++) {
          const i = ((899 - y) * 1600 + x) * 4;
          if (paint[i] - assembled[i] > 5) darkened++;
        }
      return darkened;
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect(result).toBe(0);
});

test('the room entry opens the real animated portfolio, not a frozen room picture', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#room');
  const stage = page.getByTestId('room-stage');
  await expect(stage).toHaveAttribute('data-ready', 'true');
  const canvas = page.locator('canvas[data-room-canvas]');
  const time = Number(await canvas.getAttribute('data-window-time'));
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-window-time')))
    .toBeGreaterThan(time + 0.2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // HTML hover/focus transitions overlap the full-screen canvas bounds.
  const paintingOnly = {
    style:
      '.layout-header, .layout-room-note, .layout-room-hint, .room-hotspot { opacity: 0 !important; transition: none !important; }',
  };
  const held = await canvas.screenshot(paintingOnly);
  await page.waitForTimeout(250);
  expect((await canvas.screenshot(paintingOnly)).equals(held)).toBe(true);
  await page.locator('[data-collection="projects"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the joint sleeper keeps opaque chair and feet fixed while torso and hair move', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const sleeperUrl = '/src/room/pixi/sleeper.ts';
    const code = await fetch(assetUrl).then((r) => r.text());
    const pixiUrl = code.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )![1];
    const [{ loadArtwork }, { createSleeper }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sleeperUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const sleeper = createSleeper(loaded.textures.sleeper ?? loaded.textures.background);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, backgroundAlpha: 0 });
    const frame = (t: number) => {
      sleeper.update(t, 0);
      renderer.render(sleeper.container);
      const p = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, p);
      return p;
    };
    const region = (a: Uint8Array, b: Uint8Array, x: number, y: number, w: number, h: number) => {
      let changed = 0,
        opaque = 0;
      for (let row = y; row < y + h; row++)
        for (let col = x; col < x + w; col++) {
          const i = ((899 - row) * 1600 + col) * 4;
          if (a[i + 3] > 240) opaque++;
          if ([0, 1, 2, 3].some((c) => Math.abs(a[i + c] - b[i + c]) > 12)) changed++;
        }
      return { changed, opaque };
    };
    try {
      const rest = frame(0),
        inhale = frame(2.4);
      return {
        chair: region(rest, inhale, 975, 590, 35, 160),
        feet: region(rest, inhale, 1260, 817, 125, 65),
        arm: region(rest, inhale, 1220, 517, 30, 22),
        torso: region(rest, inhale, 1060, 500, 65, 115),
        hair: region(rest, inhale, 1130, 408, 70, 35),
        outside: region(rest, inhale, 700, 600, 180, 230),
      };
    } finally {
      sleeper.container.destroy({ children: true });
      sleeper.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect(result.chair.opaque).toBeGreaterThan(3000);
  expect(result.feet.opaque).toBeGreaterThan(1500);
  expect(result.chair.changed).toBe(0);
  expect(result.feet.changed).toBe(0);
  expect(result.arm.changed).toBe(0);
  expect(result.torso.changed).toBeGreaterThan(100);
  expect(result.hair.changed).toBeGreaterThan(15);
  expect(result.outside.opaque).toBe(0);
});
