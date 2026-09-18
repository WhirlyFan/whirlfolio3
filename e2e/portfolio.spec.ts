import { expect, test } from '@playwright/test';

test('the painted fan announces its changed speed without a separate settings button', async ({
  page,
}) => {
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const fan = page.getByRole('button', { name: 'Desk fan', exact: true });
  await fan.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Fan setting' })).toHaveText('Fan speed: high');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Fan setting' })).toHaveText('Fan speed: off');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Fan setting' })).toHaveText('Fan speed: low');
});

test('explores real room actions and returns from project reading', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('canvas[data-room-canvas]')).toBeVisible();
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-collection="projects"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Music', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Desk fan', exact: true }).click();
  await page.locator('[data-collection="photography"]').click();
  await expect(page.getByRole('dialog').getByAltText(/gull gliding/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test('conventional portfolio remains complete and directly linkable', async ({ page }) => {
  await page.goto('/#portfolio/experience');
  await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeVisible();
  await expect(
    page.getByText('Forward Deployed Engineer · Enterprise AI', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Music', exact: true })).toBeAttached();
  await expect(page.getByText('Founding Engineer', { exact: true })).toBeAttached();
  await expect(page.getByText('January–July 2026', { exact: true })).toBeAttached();
  const resume = page.getByRole('banner').getByRole('link', { name: 'Download résumé (PDF)' });
  const pdf = await page.request.get((await resume.getAttribute('href'))!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('system reduced motion holds the actual rendered frame and turning it off resumes motion', async ({
  page,
}) => {
  // Software-rendered CI captures can take over 10 seconds per canvas screenshot.
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const canvas = page.locator('canvas[data-room-canvas]');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Let the final scheduled draw and photo loads finish before comparing pixels.
  await page.waitForTimeout(500);
  // The full-bleed canvas bounds also contain HTML controls. Exclude their hover
  // transitions so this verifies room motion, not navigation hover changes.
  const paintingOnly = {
    style:
      '.layout-header, .layout-room-note, .layout-room-hint, .room-hotspot { opacity: 0 !important; transition: none !important; }',
  };
  const heldTime = await canvas.getAttribute('data-window-time');
  const still = await canvas.screenshot(paintingOnly);
  await page.waitForTimeout(300);
  expect(await canvas.getAttribute('data-window-time')).toBe(heldTime);
  expect((await canvas.screenshot(paintingOnly)).equals(still)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-window-time')))
    .toBeGreaterThan(Number(heldTime));
  await expect
    .poll(async () => (await canvas.screenshot(paintingOnly)).equals(still), { timeout: 20_000 })
    .toBe(false);
});

test('clicking the monitor surface uses the scene hit-test, not a hotspot button', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const bounds = (await page.locator('canvas[data-room-canvas]').boundingBox())!;
  // Click the painted screen itself, independently of the HTML marker's position.
  const scale = Math.min(bounds.width / 1600, bounds.height / 900);
  const x = bounds.x + (bounds.width - 1600 * scale) / 2 + 1422 * scale;
  const y = bounds.y + (bounds.height - 900 * scale) / 2 + 420 * scale;
  expect(
    await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x, y }),
  ).toBe('CANVAS');
  await page.mouse.click(x, y);
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Music', exact: true }),
  ).toBeVisible();
});

test('narrow reduced-motion view exposes readable content without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const canvas = page.locator('canvas[data-room-canvas]');
  const heldTime = await canvas.getAttribute('data-window-time');
  await page.waitForTimeout(180);
  expect(await canvas.getAttribute('data-window-time')).toBe(heldTime);
  await page.locator('[data-collection="experience"]').click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Handshake', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to room', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('WebGL failure leaves an accessible portfolio escape route', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith('webgl')) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByText('The room couldn’t open on this device.')).toBeVisible();
  await page.getByRole('link', { name: 'Read the portfolio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeAttached();
});
