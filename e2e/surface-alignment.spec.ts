import { expect, test, type Page } from '@playwright/test';

type Point = { x: number; y: number };
type Pixel = [number, number, number];

const sourceSize = { width: 1672, height: 941 };
const sceneSize = { width: 1600, height: 900 };

// Native scene size avoids comparing differently resampled one-pixel mat/rim edges.
test.use({ viewport: { width: 1600, height: 900 } });

function sourcePoint(x: number, y: number): Point {
  return {
    x: (x / sourceSize.width) * sceneSize.width,
    y: (y / sourceSize.height) * sceneSize.height,
  };
}

async function sampleRenderedRoom(page: Page, points: Point[]): Promise<Pixel[]> {
  const canvas = page.locator('canvas[data-room-canvas]');
  // Sample the painted surfaces only; discovery.spec separately exercises the HTML invitations.
  const screenshot = await canvas.screenshot({
    style: '.room-hotspot { visibility: hidden !important; }',
  });
  const screenshotDataUrl = `data:image/png;base64,${screenshot.toString('base64')}`;
  return page.evaluate(
    async ({ screenshotDataUrl, points, sceneSize }) => {
      const image = new Image();
      image.src = screenshotDataUrl;
      await image.decode();
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = image.naturalWidth;
      sampleCanvas.height = image.naturalHeight;
      const context = sampleCanvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const scale = Math.min(
        image.naturalWidth / sceneSize.width,
        image.naturalHeight / sceneSize.height,
      );
      const offsetX = (image.naturalWidth - sceneSize.width * scale) / 2;
      const offsetY = (image.naturalHeight - sceneSize.height * scale) / 2;
      return points.map(({ x, y }) => {
        const data = context.getImageData(
          Math.round(offsetX + x * scale),
          Math.round(offsetY + y * scale),
          1,
          1,
        ).data;
        return [data[0], data[1], data[2]] as [number, number, number];
      });
    },
    { screenshotDataUrl, points, sceneSize },
  );
}

async function sampleBackground(page: Page, points: Point[]): Promise<Pixel[]> {
  return page.evaluate(
    async ({ points, sourceSize, sceneSize }) => {
      const image = new Image();
      image.src = '/e2e/fixtures/summer-room-v7.webp';
      await image.decode();
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = sceneSize.width;
      sampleCanvas.height = sceneSize.height;
      const context = sampleCanvas.getContext('2d')!;
      context.drawImage(
        image,
        0,
        0,
        sourceSize.width,
        sourceSize.height,
        0,
        0,
        sceneSize.width,
        sceneSize.height,
      );
      return points.map(({ x, y }) => {
        const data = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return [data[0], data[1], data[2]] as [number, number, number];
      });
    },
    { points, sourceSize, sceneSize },
  );
}

function colorDistance(actual: Pixel, expected: Pixel): number {
  return Math.max(...actual.map((channel, index) => Math.abs(channel - expected[index])));
}

test('photos fill only the registered blank interiors and leave the painted mats untouched', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await page.locator('canvas[data-room-canvas]').screenshot({
    path: testInfo.outputPath('v7-actual-room.png'),
    style: '.room-hotspot { visibility: hidden !important; }',
  });

  // Hand-traced v7 aperture edges. Guard every visible mat, not only the center.
  const apertureEdges = [
    [1523, 208, 1586, 191, 0, -10],
    [1523, 208, 1523, 331, -10, 0],
    [1523, 331, 1586, 322, 0, 10],
    [1586, 191, 1586, 322, 10, 0],
    [1630, 155, 1668, 144, 0, -10],
    [1630, 155, 1630, 275, -10, 0],
    [1630, 275, 1668, 268, 0, 10],
  ];
  const matPoints: Point[] = [];
  const interiorPoints: Point[] = [];
  for (const [x1, y1, x2, y2, dx, dy] of apertureEdges)
    for (let step = 0; step <= 8; step++) {
      const x = x1 + ((x2 - x1) * step) / 8;
      const y = y1 + ((y2 - y1) * step) / 8;
      interiorPoints.push(sourcePoint(x, y));
      matPoints.push(sourcePoint(x + dx, y + dy));
    }
  const points = [...matPoints, ...interiorPoints];
  const [actual, background] = await Promise.all([
    sampleRenderedRoom(page, points),
    sampleBackground(page, points),
  ]);

  actual.slice(0, matPoints.length).forEach((pixel, index) => {
    expect(
      colorDistance(pixel, background[index]),
      `mat ${JSON.stringify(matPoints[index])}`,
    ).toBeLessThanOrEqual(24);
  });
  const filled = actual
    .slice(matPoints.length)
    .filter((pixel, index) => colorDistance(pixel, background[matPoints.length + index]) >= 35);
  expect(filled.length / interiorPoints.length).toBeGreaterThan(0.95);

  // The narrow visible right aperture must show the gull's white head, not just a wing.
  // Measured from the actual photo's head at roughly (230, 200) in its 512x330 raster.
  const [gullHead] = await sampleRenderedRoom(page, [sourcePoint(1649, 224)]);
  expect(gullHead[2]).toBeGreaterThanOrEqual(205);
});

test('the original lamp remains in front of the projected monitor surface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');

  // These source-image points are on the shade where it crosses the inner screen.
  const lampPoints = [sourcePoint(1603, 382), sourcePoint(1614, 394), sourcePoint(1625, 398)];
  const background = await sampleBackground(page, lampPoints);
  await expect
    .poll(async () => {
      const actual = await sampleRenderedRoom(page, lampPoints);
      return Math.max(...actual.map((pixel, index) => colorDistance(pixel, background[index])));
    })
    .toBeLessThanOrEqual(50);
});
