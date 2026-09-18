import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

for (const width of [320, 390, 1440]) {
  test(`landing résumé downloads without changing views at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#room');
    const header = page.getByRole('banner');
    const resume = header.getByRole('link', { name: 'Download résumé (PDF)' });
    await expect(resume).toBeVisible();
    const before = await resume.boundingBox();
    const overflowingLabels = await header.locator('a').evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const box = node.getBoundingClientRect();
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const overflow: string[] = [];
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNode(walker.currentNode);
          const textBox = range.getBoundingClientRect();
          if (textBox.width && (textBox.left < box.left || textBox.right > box.right))
            overflow.push(walker.currentNode.textContent);
        }
        return overflow;
      }),
    );
    expect(overflowingLabels).toEqual([]);
    const links = await header.locator('a').evaluateAll((nodes) =>
      nodes.map((node) => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(width);
      expect(a.height).toBeGreaterThanOrEqual(44);
      for (const b of links.slice(i + 1)) {
        const overlap =
          Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
          Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
        expect(overlap).toBe(false);
      }
    }
    await resume.focus();
    const downloaded = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe('Michael_Lee_Resume.pdf');
    expect(await readFile((await download.path())!)).toEqual(
      await readFile('public/Michael_Lee_Resume.pdf'),
    );
    await expect(page).toHaveURL(/#room$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await header.getByRole('link', { name: 'The portfolio', exact: true }).click();
    await expect(page.locator('#portfolio-heading')).toBeVisible();
    // One stable download location across views, without extra hero/Experience actions.
    await expect(page.getByRole('link', { name: /résumé/i })).toHaveCount(1);
    expect(await resume.boundingBox()).toEqual(before);
    await header.getByRole('link', { name: 'Experience', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeVisible();
    await expect(resume).toBeInViewport();
    const readerDownloaded = page.waitForEvent('download');
    await resume.click();
    expect(await readFile((await (await readerDownloaded).path())!)).toEqual(
      await readFile('public/Michael_Lee_Resume.pdf'),
    );
    await expect(page).toHaveURL(/#portfolio\/experience$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('résumé remains downloadable when room artwork fails', async ({ page }) => {
  await page.route('**/art/**', (route) => route.abort());
  await page.goto('/#room');
  await expect(page.getByText('The room couldn’t open on this device.')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('banner').getByRole('link', { name: 'Download résumé (PDF)' }).click();
  expect((await downloaded).suggestedFilename()).toBe('Michael_Lee_Resume.pdf');
  await expect(page).toHaveURL(/#room$/);
});

test('résumé can download before the room finishes loading', async ({ page }) => {
  let releaseArtwork!: () => void;
  const blocked = new Promise<void>((resolve) => {
    releaseArtwork = resolve;
  });
  await page.route('**/art/**', async (route) => {
    await blocked;
    await route.continue();
  });
  try {
    await page.goto('/#room');
    await expect(page.getByText('Opening the window…')).toBeVisible();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('banner').getByRole('link', { name: 'Download résumé (PDF)' }).click();
    expect((await downloaded).suggestedFilename()).toBe('Michael_Lee_Resume.pdf');
    await expect(page).toHaveURL(/#room$/);
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'false');
  } finally {
    releaseArtwork();
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  }
});
