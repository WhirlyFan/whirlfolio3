import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('writing test evidence does not rebuild styles or reload the portfolio', async ({ page }) => {
  const evidenceDir = path.join(process.cwd(), '.superpowers');
  await mkdir(evidenceDir, { recursive: true });
  const evidence = path.join(evidenceDir, 'style-scan-probe.json');
  await writeFile(evidence, JSON.stringify({ diagnostic: 'w-[1973px]' }));
  const reloads: string[] = [];
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      if (String(payload).includes('full-reload')) reloads.push(String(payload));
    });
  });
  await page.goto('/#portfolio');
  await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeAttached();
  await page.evaluate(() => Reflect.set(window, 'publicationProbe', 'same-document'));

  await writeFile(evidence, JSON.stringify({ diagnostic: 'w-[1974px]' }));
  // Observe a complete file-watcher cycle; this check specifically forbids a delayed reload.
  await page.waitForTimeout(1500);
  expect(reloads).toEqual([]);
  expect(await page.evaluate(() => Reflect.get(window, 'publicationProbe'))).toBe('same-document');
  await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeAttached();
});
