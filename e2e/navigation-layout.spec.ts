import { expect, test } from '@playwright/test';

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`switching views preserves navigation position at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#room');
    const view = page.getByRole('navigation', { name: 'View', exact: true });
    const before = (await view.boundingBox())!;
    await view.getByRole('link', { name: 'The portfolio', exact: true }).click();
    await expect(page.locator('#portfolio-heading')).toBeFocused();
    const after = (await view.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
    const sections = page.getByRole('navigation', { name: 'Portfolio sections', exact: true });
    await sections.getByRole('link', { name: 'Experience', exact: true }).click();
    const heading = page.locator('#experience h2');
    await expect(heading).toBeFocused();
    await expect(view).toBeInViewport({ ratio: 1 });
    expect((await heading.boundingBox())!.y).toBeGreaterThan(before.y + before.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await view.getByRole('link', { name: 'The room', exact: true }).click();
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
    expect((await view.boundingBox())!.x).toBe(before.x);
    await sections.getByRole('link', { name: 'Experience', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Handshake', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sections.getByRole('link', { name: 'Experience', exact: true })).toBeFocused();
  });
}

test('returning to the portfolio restores reading without hiding keyboard focus', async ({
  page,
}) => {
  await page.goto('/#portfolio/about');
  await expect(page.locator('#about h2')).toBeFocused();
  const readingY = await page.evaluate(() => scrollY);
  await page.getByRole('link', { name: 'The room', exact: true }).click();
  await page.getByRole('link', { name: 'The portfolio', exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(readingY);
  await expect(page.locator(':focus')).toBeInViewport({ ratio: 1 });
  await page
    .getByRole('navigation', { name: 'Portfolio sections', exact: true })
    .getByRole('link', { name: 'Projects', exact: true })
    .click();
  await expect(page.locator('#projects h2')).toBeFocused();
});
