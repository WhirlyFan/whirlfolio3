import { expect, test, type Page } from '@playwright/test';

test('room dialog reading keeps an inset from the viewport edge after loading component styles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#room/projects');
  const dialog = page.getByRole('dialog');
  const heading = dialog.getByRole('heading', { name: 'Projects', exact: true });
  await expect(heading).toBeVisible();
  const frame = (await dialog.boundingBox())!;
  expect((await heading.boundingBox())!.x - frame.x).toBeGreaterThanOrEqual(20);
  expect((await heading.boundingBox())!.y - frame.y).toBeGreaterThanOrEqual(30);
});

// Change only the data module; keep the real React components and navigation.
async function withContent(page: Page, edit: string) {
  await page.route('**/src/content/portfolio.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n${edit}` });
  });
}

test('photo metadata reserves the actual image proportions before loading', async ({ page }) => {
  await page.goto('/#portfolio/photography');
  const images = page.locator('#photography img');
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    const ratios = await image.evaluate(async (element) => {
      const img = element as HTMLImageElement;
      img.loading = 'eager';
      await img.decode();
      return {
        reserved: Number(img.getAttribute('width')) / Number(img.getAttribute('height')),
        actual: img.naturalWidth / img.naturalHeight,
      };
    });
    expect(ratios.reserved).toBeCloseTo(ratios.actual, 3);
  }
});

test('a portfolio without photos still supports reading and section navigation', async ({
  page,
}) => {
  await withContent(page, 'photos.splice(0);');
  await page.goto('/#portfolio');
  await expect(
    page.getByRole('heading', { name: 'Michael Lee', exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Portfolio sections' })
    .getByRole('link', { name: 'Photography' })
    .click();
  await expect(page.locator('#photography h2')).toBeFocused();
  await expect(page.getByText('Photographs will appear here.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Portfolio sections' })
    .getByRole('link', { name: 'Experience' })
    .click();
  await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeVisible();
});

test('identity updates reach the photo credits, footer and room dialog', async ({ page }) => {
  await withContent(page, 'profile.name = "Test Photographer"; profile.handle = "TestHandle";');
  await page.goto('/#portfolio/photography');
  await expect(page.locator('#photography figure').first()).toContainText('Test Photographer');
  await expect(page.locator('footer')).toContainText('Test Photographer · TestHandle');
  await page.goto('/#room/photography');
  await expect(page.getByRole('dialog').locator('figure').first()).toContainText(
    'Test Photographer',
  );
});

test('shared biography and photography copy update both reading presentations', async ({
  page,
}) => {
  await withContent(
    page,
    `
    if (typeof photographyIntro !== 'undefined') photographyIntro.lead = 'Time outside.';
    if (typeof aboutCopy !== 'undefined') aboutCopy.headline = ['A new biography.'];
  `,
  );
  await page.goto('/#portfolio/photography');
  await expect(page.locator('#photography')).toContainText('Time outside.');
  await expect(page.locator('#about')).toContainText('A new biography.');
  await page.goto('/#room/photography');
  await expect(page.getByRole('dialog')).toContainText('Time outside.');
  await page.goto('/#room/about');
  await expect(page.getByRole('dialog')).toContainText('A new biography.');
});

test('long new project content remains readable and expandable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await withContent(
    page,
    `projects.push({ id: 'new-entry', name: 'A newly added project with a longer descriptive name', eyebrow: 'Another chapter', description: 'A new project added through the content file.', details: ['The new project detail is reachable.'], tags: ['TypeScript'], url: null });`,
  );
  await page.goto('/#portfolio/projects');
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', {
      name: 'A newly added project with a longer descriptive name',
    }),
  });
  await card.getByText('Behind the project').click();
  await expect(card.getByText('The new project detail is reachable.')).toBeVisible();
  await expect(card.getByText('≈', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
