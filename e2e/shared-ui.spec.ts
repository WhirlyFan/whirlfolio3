import { expect, test } from '@playwright/test';

test('Escape from a keyboard-opened scene dialog focuses a visible Projects control', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');

  const projectHotspot = page.locator('.room-hotspot[data-action="projects"]');
  await expect(projectHotspot).toBeVisible();
  await projectHotspot.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.locator('.room-hotspot[data-action="projects"]:focus, [data-collection="projects"]:focus'),
  ).toBeVisible();
});

test('directly replacing an open dialog preserves its origin until the replacement closes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');

  const projectHotspot = page.locator('.room-hotspot[data-action="projects"]');
  await projectHotspot.focus();
  await expect(projectHotspot).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.evaluate(() => {
    // Keep the URL at #room while React commits the non-null section replacement.
    window.addEventListener('hashchange', () => window.history.replaceState(null, '', '#room'), {
      once: true,
    });
    location.hash = '#room/experience';
  });
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Handshake', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to room', exact: true })).toBeFocused();
  await page.evaluate(() => window.history.replaceState(null, '', '#room/experience'));

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.locator(
      '.room-hotspot[data-action="projects"]:focus, [data-collection="experience"]:focus',
    ),
  ).toBeVisible();
});

test('closing a directly opened dialog focuses its stable collection fallback', async ({
  page,
}) => {
  await page.goto('/#room/experience');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('[data-collection="experience"]')).toBeFocused();
});

test('keyboard portfolio navigation focuses the selected section heading', async ({ page }) => {
  await page.goto('/#portfolio');

  const experienceLink = page
    .getByRole('navigation', { name: 'Portfolio sections' })
    .getByRole('link', { name: 'Experience' });
  await experienceLink.focus();
  await page.keyboard.press('Enter');

  await expect(
    page.locator('#experience').getByRole('heading', { name: 'Experience' }),
  ).toBeFocused();
});

test('the skip link focuses the default portfolio heading', async ({ page }) => {
  await page.goto('/');

  const skipLink = page.getByRole('link', { name: 'Skip the room — read the portfolio' });
  await skipLink.focus();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { name: /Thoughtful software\. A curious eye\./ }),
  ).toBeFocused();
});

test('continuing from a dialog focuses the matching full-portfolio heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');

  const projectCollection = page.locator('[data-collection="projects"]');
  await projectCollection.focus();
  await page.keyboard.press('Enter');
  const fullPortfolioLink = page.getByRole('link', {
    name: 'Continue in the full portfolio ↗',
  });
  await expect(fullPortfolioLink).toBeVisible();
  await fullPortfolioLink.focus();
  await page.keyboard.press('Enter');

  // CI can take several seconds to leave the software-rendered room and commit the new view.
  await expect(page.locator('#projects').getByRole('heading', { name: 'Projects' })).toBeFocused({
    timeout: 15_000,
  });
});
