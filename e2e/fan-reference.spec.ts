import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('the production fan backing has no broad painted blades', async ({ page }) => {
  await page.goto('/#portfolio');
  const samples = await page.evaluate(async () => {
    const assetsUrl = '/src/room/pixi/assets.ts';
    const { artwork } = await import(assetsUrl);
    const response = await fetch(artwork.fan);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas unavailable');
    try {
      context.drawImage(image, 0, 0, 640, 640);
      return [
        { x: 414, y: 215 },
        { x: 358, y: 199 },
        { x: 238, y: 143 },
      ].map(({ x, y }) => {
        return Array.from(context.getImageData(x, y, 1, 1).data);
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  });

  for (const sample of samples) {
    expect(sample[0], JSON.stringify(samples)).toBeGreaterThan(225);
    expect(sample[1], JSON.stringify(samples)).toBeGreaterThan(230);
    expect(sample[2], JSON.stringify(samples)).toBeGreaterThan(245);
    expect(sample[3], JSON.stringify(samples)).toBeGreaterThan(245);
  }
});

test('one projected rotor fills the opening while WhirlyFan identity stays fixed', async ({
  page,
}, testInfo) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const assetsUrl = '/src/room/pixi/assets.ts';
    const { artwork } = await import(assetsUrl);
    const assetResponse = await fetch(artwork.fan);
    if (!assetResponse.ok || !assetResponse.headers.get('content-type')?.startsWith('image/')) {
      return {
        assetAvailable: false,
        movingBladePixels: 0,
        invalidChangedPixels: 1,
        changedBounds: { minX: 1600, minY: 900, maxX: 0, maxY: 0 },
        perspectiveSweep: {
          pixelCount: 0,
          bounds: { minX: 1600, minY: 900, maxX: 0, maxY: 0 },
          leftReach: 0,
          rightReach: 0,
          topCentroidX: 0,
          bottomCentroidX: 0,
        },
        invalidSamples: [] as { x: number; y: number; source: number[]; difference: number }[],
        protectedRegions: [] as { name: string; pixels: number; maxDifference: number }[],
        screenshot145: '',
        screenshot: '',
      };
    }

    const fanUrl = '/src/room/pixi/fan.ts';
    const fanSource = await fetch(fanUrl).then((response) => response.text());
    const pixiUrl = fanSource.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Cannot resolve the actual room renderer');
    const [{ createFan }, { ImageSource, Sprite, Texture, WebGLRenderer }] = await Promise.all([
      import(fanUrl),
      import(pixiUrl),
    ]);
    const blob = await assetResponse.blob();
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
    const reference = new Sprite(texture);
    reference.position.copyFrom(fan.container.position);
    reference.scale.copyFrom(fan.container.scale);
    const renderer = new WebGLRenderer();
    await renderer.init({ width: 1600, height: 900, antialias: false, backgroundAlpha: 0 });

    const frame = (angleRadians: number) => {
      fan.update(angleRadians);
      renderer.render({ container: fan.container });
      const pixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(0, 0, 1600, 900, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const differenceAt = (before: Uint8Array, after: Uint8Array, x: number, y: number) => {
      const offset = ((899 - y) * 1600 + x) * 4;
      return Math.max(
        ...[0, 1, 2, 3].map((channel) =>
          Math.abs(before[offset + channel] - after[offset + channel]),
        ),
      );
    };
    const pixelAt = (pixels: Uint8Array, x: number, y: number) => {
      const offset = ((899 - y) * 1600 + x) * 4;
      return Array.from(pixels.slice(offset, offset + 4));
    };
    const isPaleBacking = (source: number[]) =>
      source[3] > 200 &&
      source[0] > 210 &&
      source[1] > 220 &&
      source[2] > 235 &&
      Math.max(source[0], source[1], source[2]) - Math.min(source[0], source[1], source[2]) < 50;

    try {
      renderer.render({ container: reference });
      const sourcePixels = new Uint8Array(1600 * 900 * 4);
      renderer.gl.readPixels(
        0,
        0,
        1600,
        900,
        renderer.gl.RGBA,
        renderer.gl.UNSIGNED_BYTE,
        sourcePixels,
      );
      const still = frame(0.15);
      const turning = frame(1.25);
      const ellipse = (
        x: number,
        y: number,
        centerX: number,
        centerY: number,
        radiusX: number,
        radiusY: number,
      ) => Math.hypot((x - centerX) / radiusX, (y - centerY) / radiusY);
      const fixedRegions = [
        {
          name: 'casing',
          contains: (x: number, y: number) => {
            const radius = ellipse(x, y, 1095, 431, 47, 45);
            return radius >= 0.93 && radius <= 1.08;
          },
        },
        {
          name: 'grille',
          contains: (x: number, y: number, source: number[]) =>
            ellipse(x, y, 1095, 431, 45, 43) < 0.88 &&
            source[2] - source[0] > 24 &&
            source[0] < 210,
        },
        {
          name: 'eyes',
          contains: (x: number, y: number) =>
            ellipse(x, y, 1059, 430, 5, 5) <= 1 || ellipse(x, y, 1121, 430, 5, 5) <= 1,
        },
        {
          name: 'cheeks',
          contains: (x: number, y: number) =>
            ellipse(x, y, 1057, 440, 7, 4) <= 1 || ellipse(x, y, 1126, 440, 7, 4) <= 1,
        },
        {
          name: 'hub',
          contains: (x: number, y: number) => ellipse(x, y, 1083, 431, 11, 11) <= 1,
        },
        {
          name: 'neck',
          contains: (x: number, y: number) => x >= 1077 && x <= 1111 && y >= 470 && y <= 493,
        },
        {
          name: 'pedestal',
          contains: (x: number, y: number) => ellipse(x, y, 1095, 498, 36, 13) <= 1,
        },
      ];
      const protectedRegions = fixedRegions.map(({ name }) => ({
        name,
        pixels: 0,
        maxDifference: 0,
      }));
      // Union real rendered blades over one complete three-blade cycle. These
      // scene-space bounds and centroids are literal observations from the logo,
      // not values calculated through the production projection helper.
      const sweepLeft = 1035;
      const sweepTop = 385;
      const sweepRight = 1145;
      const sweepBottom = 478;
      const sweepWidth = sweepRight - sweepLeft + 1;
      const sweepPixels = new Uint8Array(sweepWidth * (sweepBottom - sweepTop + 1));
      const sweepAngles = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1];
      for (const angleRadians of sweepAngles) {
        const sweptFrame = frame(angleRadians);
        for (let y = sweepTop; y <= sweepBottom; y++) {
          for (let x = sweepLeft; x <= sweepRight; x++) {
            const source = pixelAt(sourcePixels, x, y);
            if (!isPaleBacking(source)) continue;
            if (fixedRegions.some((region) => region.contains(x, y, source))) continue;
            if (differenceAt(sourcePixels, sweptFrame, x, y) <= 8) continue;
            sweepPixels[(y - sweepTop) * sweepWidth + x - sweepLeft] = 1;
          }
        }
      }
      const sweepBounds = { minX: 1600, minY: 900, maxX: 0, maxY: 0 };
      let sweepPixelCount = 0;
      for (let y = sweepTop; y <= sweepBottom; y++) {
        for (let x = sweepLeft; x <= sweepRight; x++) {
          if (!sweepPixels[(y - sweepTop) * sweepWidth + x - sweepLeft]) continue;
          sweepPixelCount++;
          sweepBounds.minX = Math.min(sweepBounds.minX, x);
          sweepBounds.minY = Math.min(sweepBounds.minY, y);
          sweepBounds.maxX = Math.max(sweepBounds.maxX, x);
          sweepBounds.maxY = Math.max(sweepBounds.maxY, y);
        }
      }
      let topXTotal = 0;
      let topPixelCount = 0;
      let bottomXTotal = 0;
      let bottomPixelCount = 0;
      for (let y = sweepTop; y <= sweepBottom; y++) {
        for (let x = sweepLeft; x <= sweepRight; x++) {
          if (!sweepPixels[(y - sweepTop) * sweepWidth + x - sweepLeft]) continue;
          if (y <= sweepBounds.minY + 3) {
            topXTotal += x;
            topPixelCount++;
          }
          if (y >= sweepBounds.maxY - 3) {
            bottomXTotal += x;
            bottomPixelCount++;
          }
        }
      }
      const perspectiveSweep = {
        pixelCount: sweepPixelCount,
        bounds: sweepBounds,
        leftReach: 1083 - sweepBounds.minX,
        rightReach: sweepBounds.maxX - 1083,
        topCentroidX: topXTotal / topPixelCount,
        bottomCentroidX: bottomXTotal / bottomPixelCount,
      };
      let movingBladePixels = 0;
      let invalidChangedPixels = 0;
      const changedBounds = { minX: 1600, minY: 900, maxX: 0, maxY: 0 };
      const invalidSamples: { x: number; y: number; source: number[]; difference: number }[] = [];
      for (let y = 365; y <= 510; y++) {
        for (let x = 1020; x <= 1170; x++) {
          const difference = differenceAt(still, turning, x, y);
          const source = pixelAt(sourcePixels, x, y);
          fixedRegions.forEach((region, index) => {
            if (source[3] > 32 && region.contains(x, y, source)) {
              protectedRegions[index].pixels++;
              protectedRegions[index].maxDifference = Math.max(
                protectedRegions[index].maxDifference,
                difference,
              );
            }
          });
          if (difference <= 8) continue;
          const radius = ellipse(x, y, 1095, 431, 47, 43);
          const paleBladeBackground = isPaleBacking(source);
          const protectedPixel = fixedRegions.some((region) => region.contains(x, y, source));
          if (radius < 0.95 && paleBladeBackground && !protectedPixel) {
            movingBladePixels++;
            changedBounds.minX = Math.min(changedBounds.minX, x);
            changedBounds.minY = Math.min(changedBounds.minY, y);
            changedBounds.maxX = Math.max(changedBounds.maxX, x);
            changedBounds.maxY = Math.max(changedBounds.maxY, y);
          } else {
            invalidChangedPixels++;
            if (invalidSamples.length < 12) invalidSamples.push({ x, y, source, difference });
          }
        }
      }

      renderer.resize(180, 180);
      fan.container.position.set(
        90 - 320 * fan.container.scale.x,
        170 - 590 * fan.container.scale.y,
      );
      fan.update(0.65);
      renderer.render({ container: fan.container });
      const screenshot145 = renderer.canvas.toDataURL('image/png');

      renderer.resize(500, 600);
      fan.container.scale.set(fan.container.scale.x * 4);
      // Re-register the production fan around its scene-space center for reviewer inspection.
      fan.container.position.set(
        250 - 320 * fan.container.scale.x,
        570 - 590 * fan.container.scale.y,
      );
      fan.update(0.65);
      renderer.render({ container: fan.container });
      return {
        assetAvailable: true,
        movingBladePixels,
        invalidChangedPixels,
        changedBounds,
        perspectiveSweep,
        invalidSamples,
        protectedRegions,
        screenshot145,
        screenshot: renderer.canvas.toDataURL('image/png'),
      };
    } finally {
      fan.container.destroy({ children: true });
      fan.dispose();
      reference.destroy();
      renderer.destroy();
      texture.destroy(true);
      bitmap.close();
    }
  });

  await writeFile(
    testInfo.outputPath('fan-original-render.png'),
    Buffer.from(result.screenshot.split(',')[1], 'base64'),
  );
  await writeFile(
    testInfo.outputPath('fan-original-render-145.png'),
    Buffer.from(result.screenshot145.split(',')[1], 'base64'),
  );
  expect(result.assetAvailable).toBe(true);
  expect(result.movingBladePixels).toBeGreaterThan(240);
  expect(result.changedBounds.minX).toBeLessThanOrEqual(1058);
  expect(result.changedBounds.maxX).toBeGreaterThanOrEqual(1128);
  expect(result.changedBounds.minY).toBeLessThanOrEqual(400);
  expect(result.changedBounds.maxY).toBeGreaterThanOrEqual(463);
  expect(
    result.invalidChangedPixels,
    JSON.stringify({ invalidSamples: result.invalidSamples, protected: result.protectedRegions }),
  ).toBe(0);
  for (const region of result.protectedRegions) {
    expect(region.pixels, `${region.name} fixture must cover source artwork`).toBeGreaterThan(8);
    expect(region.maxDifference, `${region.name} must stay fixed`).toBeLessThanOrEqual(2);
  }
  expect(result.perspectiveSweep.pixelCount).toBeGreaterThan(900);
  expect(result.perspectiveSweep.bounds.minX).toBeGreaterThanOrEqual(1052);
  expect(result.perspectiveSweep.bounds.minX).toBeLessThanOrEqual(1058);
  expect(result.perspectiveSweep.bounds.maxX).toBeGreaterThanOrEqual(1127);
  expect(result.perspectiveSweep.bounds.maxX).toBeLessThanOrEqual(1132);
  expect(result.perspectiveSweep.rightReach / result.perspectiveSweep.leftReach).toBeGreaterThan(
    1.4,
  );
  expect(
    result.perspectiveSweep.topCentroidX,
    JSON.stringify(result.perspectiveSweep),
  ).toBeGreaterThanOrEqual(1084);
  expect(result.perspectiveSweep.topCentroidX).toBeLessThanOrEqual(1090);
  expect(result.perspectiveSweep.bottomCentroidX).toBeGreaterThanOrEqual(1092);
  expect(result.perspectiveSweep.bottomCentroidX).toBeLessThanOrEqual(1098);
  expect(
    result.perspectiveSweep.bottomCentroidX - result.perspectiveSweep.topCentroidX,
  ).toBeGreaterThanOrEqual(6);
});

test('the shared UI clock holds the fan angle while paused and off', async ({ page }) => {
  await page.goto('/#room');
  const canvas = page.locator('canvas[data-room-canvas]');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');

  const movingAngle = Number(await canvas.getAttribute('data-fan-angle'));
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-fan-angle')))
    .toBeGreaterThan(movingAngle);

  await page.getByRole('button', { name: 'Pause motion' }).click();
  const pausedAngle = await canvas.getAttribute('data-fan-angle');
  await page.waitForTimeout(180);
  expect(await canvas.getAttribute('data-fan-angle')).toBe(pausedAngle);

  await page.getByRole('button', { name: 'Resume motion' }).click();
  await page.getByRole('button', { name: 'Fan speed: low' }).click();
  await page.getByRole('button', { name: 'Fan speed: high' }).click();
  const offAngle = await canvas.getAttribute('data-fan-angle');
  await page.waitForTimeout(180);
  expect(await canvas.getAttribute('data-fan-angle')).toBe(offAngle);
});

test('reduced motion holds the shared fan angle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  const canvas = page.locator('canvas[data-room-canvas]');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const angle = await canvas.getAttribute('data-fan-angle');
  await page.waitForTimeout(180);
  expect(await canvas.getAttribute('data-fan-angle')).toBe(angle);
});
