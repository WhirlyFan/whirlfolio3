import { expect, test } from '@playwright/test';

test.describe('high-density phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
  test('rounded backing pixels do not expand the visible canvas beyond the viewport', async ({
    page,
  }) => {
    await page.goto('/#room');
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
    expect(await page.locator('canvas[data-room-canvas]').boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    });
  });
});

test('dragging away and back over an object never counts as a click', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await page.mouse.move(1430, 440);
  await page.mouse.down();
  await page.mouse.move(1300, 440, { steps: 5 });
  await page.mouse.move(1430, 440, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/#room$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('a phone visitor can pan the room without activating an object and still open every collection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const canvas = page.locator('canvas[data-room-canvas]');
  const before = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 80, bounds.y + bounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 350, bounds.y + bounds.height * 0.55, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  await canvas.focus();
  const dragged = await canvas.screenshot();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await canvas.screenshot()).equals(dragged)).toBe(false);
  for (const section of ['projects', 'experience', 'photography', 'about']) {
    await page.locator(`[data-collection="${section}"]`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Back to room' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
