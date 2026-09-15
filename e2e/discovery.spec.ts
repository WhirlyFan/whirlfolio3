import { expect, test } from '@playwright/test';

test('room visibly invites bird photography exploration and keeps existing object controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  const room = page.getByTestId('room-stage');
  await expect(room).toHaveAttribute('data-ready', 'true');

  await expect(room.getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await expect(room.getByRole('button', { name: 'Desk fan', exact: true })).toBeVisible();

  const photography = room.getByRole('button', { name: 'Bird photography', exact: true });
  await expect(photography).toBeVisible();
  await expect(photography.locator('.hotspot-label')).toHaveCSS('opacity', '1');
  const canvasBox = (await room.locator('canvas').boundingBox())!;
  const labelBox = (await photography.locator('.hotspot-label').boundingBox())!;
  const illustrationScale = Math.min(canvasBox.width / 1600, canvasBox.height / 900);
  const illustrationTop = canvasBox.y + (canvasBox.height - 900 * illustrationScale) / 2;
  // Keep the persistent cue below the dove's head, not across its subject.
  expect(labelBox.y).toBeGreaterThan(illustrationTop + 270 * illustrationScale);

  await photography.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Photography', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to room' }).click();

  // Existing dialog policy restores the visible origin or its matching collection control.
  await expect(
    page.locator(
      '.room-hotspot[data-action="photography"]:focus, [data-collection="photography"]:focus',
    ),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Photography', exact: true })).toBeVisible();
});

test('clicking an actual framed bird photo opens photography without the HTML marker', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const bounds = (await page.locator('canvas[data-room-canvas]').boundingBox())!;
  const scale = Math.min(bounds.width / 1600, bounds.height / 900);
  const point = {
    // v7 right-frame visible aperture: source x1626..1672, here x1647.
    x: bounds.x + (bounds.width - 1600 * scale) / 2 + 1576 * scale,
    y: bounds.y + (bounds.height - 900 * scale) / 2 + 190 * scale,
  };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe(
    'CANVAS',
  );
  await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Photography', exact: true }),
  ).toBeVisible();
});

test.describe('phone-width room discovery', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('keeps the persistent invitation inside the scene and opens it by tap', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#room');
    const room = page.getByTestId('room-stage');
    await expect(room).toHaveAttribute('data-ready', 'true');

    const photography = room.getByRole('button', {
      name: 'Bird photography',
      exact: true,
    });
    const labelBox = await photography.locator('.hotspot-label').boundingBox();
    const roomBox = await room.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(roomBox).not.toBeNull();
    expect(labelBox!.x).toBeGreaterThanOrEqual(roomBox!.x);
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(roomBox!.x + roomBox!.width);

    // Visitors tap the invitation text, including its left edge outside the photo hit area.
    await page.touchscreen.tap(labelBox!.x + 12, labelBox!.y + labelBox!.height / 2);
    await expect(page.getByRole('heading', { name: 'Photography', exact: true })).toBeVisible();
  });
});
