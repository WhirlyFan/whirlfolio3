import { expect, test } from '@playwright/test';

test('actual painted bird poses, flight and foliage change independently of the fan and curtain', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetUrl = '/src/room/pixi/assets.ts';
    const source = await fetch(assetUrl).then((response) => response.text());
    const pixiUrl = source.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve scene renderer');
    const sceneUrl = '/src/room/pixi/scene.ts';
    const [{ loadArtwork }, { createPaintedScene }, { WebGLRenderer }] = await Promise.all([
      import(assetUrl),
      import(sceneUrl),
      import(pixiUrl),
    ]);
    const loaded = await loadArtwork(new AbortController().signal);
    const scene = createPaintedScene(loaded.textures, 42);
    const behaviorUrl = '/src/room/pixi/bird-behavior.ts';
    const { createBirdBehavior } = await import(behaviorUrl);
    const poseAt = createBirdBehavior(42);
    const findTime = (predicate: (pose: ReturnType<typeof poseAt>) => boolean) => {
      for (let step = 0; step < 3000; step++) if (predicate(poseAt(step / 10))) return step / 10;
      throw new Error('Expected bird action did not occur');
    };
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, resolution: 1, antialias: false });
    const frame = (time: number, showBird = true) => {
      scene.update({ elapsedSeconds: time, fanAngle: 0 }, false, {
        fanSpeed: 0,
        width: 1400,
        quality: 'low',
      });
      if (!showBird) scene.container.getChildByLabel('room-bird', true).visible = false;
      renderer.render({ container: scene.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const changed = (
      a: Uint8Array,
      b: Uint8Array,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      let count = 0;
      for (let row = y; row < y + height; row++) {
        for (let col = x; col < x + width; col++) {
          const offset = ((899 - row) * 1600 + col) * 4;
          if (
            Math.abs(a[offset] - b[offset]) +
              Math.abs(a[offset + 1] - b[offset + 1]) +
              Math.abs(a[offset + 2] - b[offset + 2]) >
            18
          )
            count++;
        }
      }
      return count;
    };
    try {
      const rest = frame(0);
      const wind = frame(1.5);
      const blink = frame(findTime((pose) => pose.frame === 1));
      const tilt = frame(findTime((pose) => pose.frame === 2));
      const flightTime = findTime((pose) => pose.action === 'depart') + 1.5;
      const flight = frame(flightTime);
      const flightWithoutBird = frame(flightTime, false);
      const absent = frame(findTime((pose) => pose.action === 'away'));
      const returnTime = findTime((pose) => pose.action === 'return');
      // Compare the same breath phase during the guaranteed quiet hold after landing.
      const landed = frame(Math.ceil((poseAt(returnTime).startedAt + 3) / 4) * 4);
      const bird = (image: Uint8Array) => changed(rest, image, 840, 330, 145, 98);
      return {
        idle: changed(rest, wind, 875, 389, 50, 32),
        blink: bird(blink),
        tilt: bird(tilt),
        away: bird(absent),
        // The new garden branch occupies the upper part of the old crop. The lower dove body
        // remains source-isolated, so an exact return still catches perch drift without foliage.
        returned: changed(rest, landed, 840, 367, 145, 61),
        // Same time with/without the bird isolates flight from moving foliage on any route.
        flying: changed(flightWithoutBird, flight, 519, 36, 563, 405),
        leftLeaves: changed(rest, wind, 230, 270, 180, 215),
        deskLeaves: changed(rest, wind, 1110, 275, 160, 160),
        floorShadow: changed(rest, wind, 410, 730, 190, 150),
        // Sample the painted wheel/contact strip below the dynamic sleeper receiver.
        stationaryChair: changed(rest, wind, 1150, 880, 100, 18),
        camera: changed(rest, wind, 25, 280, 100, 275),
      };
    } finally {
      scene.dispose();
      renderer.destroy();
      loaded.dispose();
    }
  });
  expect(result.idle).toBeGreaterThan(5);
  expect(result.blink).toBeGreaterThan(5);
  expect(result.tilt).toBeGreaterThan(80);
  expect(result.away).toBeGreaterThan(300);
  expect(result.flying).toBeGreaterThan(60);
  expect(result.returned).toBe(0);
  expect(result.leftLeaves).toBeGreaterThan(100);
  expect(result.deskLeaves).toBeGreaterThan(100);
  expect(result.floorShadow).toBeGreaterThan(30);
  expect(result.stationaryChair).toBe(0);
  expect(result.camera).toBe(0);
});

test('new scenery stays still with reduced motion and the portfolio remains reachable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  const canvas = page.locator('canvas[data-renderer="pixi"]');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const before = await canvas.screenshot();
  await page.waitForTimeout(400);
  expect(await canvas.screenshot()).toEqual(before);
  await page.locator('[data-collection="photography"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Back to room' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
