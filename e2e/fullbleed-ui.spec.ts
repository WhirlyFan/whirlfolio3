import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1512, height: 1100 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`the room and its collection controls stay within the ${viewport.width}px viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const room = page.getByTestId('room-stage');
    await expect(room).toHaveAttribute('data-ready', 'true');

    expect(await room.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
    for (const name of ['Projects', 'Experience', 'Photography', 'About']) {
      const control = page
        .getByRole('navigation', { name: 'Portfolio collections' })
        .getByRole('button', { name, exact: true });
      await expect(control).toBeInViewport({ ratio: 1 });
      const bounds = await control.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole('link', { name: 'The portfolio', exact: true })).toBeInViewport({
      ratio: 1,
    });
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(viewport.height);
  });
}

test('the 320px photography reader keeps its title and return control inside the dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  const photos = page.locator('[data-collection="photography"]');
  await photos.click();
  const dialog = page.getByRole('dialog');
  const title = dialog.getByRole('heading', { name: 'Photography', exact: true });
  const back = dialog.getByRole('button', { name: 'Back to room', exact: true });
  await expect(dialog).toHaveCSS('opacity', '1');
  const dialogBounds = (await dialog.boundingBox())!;
  for (const control of [title, back]) {
    const bounds = (await control.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(dialogBounds.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(dialogBounds.x + dialogBounds.width);
    await expect(control).toBeInViewport({ ratio: 1 });
  }
  await back.click();
  await expect(dialog).not.toBeVisible();
  await expect(photos).toBeFocused();
});

test('phone room controls retain motion, quality, and collection return behavior', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: /Pause motion/ }).click();
  await expect(page.getByRole('button', { name: /Resume motion/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('combobox', { name: 'Detail' }).click();
  await page.getByRole('option', { name: 'Low', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Detail' })).toHaveText('Low');
  const photos = page.locator('[data-collection="photography"]');
  await photos.click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Photography', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to room', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(photos).toBeFocused();
  await expect(page.getByRole('button', { name: /Resume motion/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
