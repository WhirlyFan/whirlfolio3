import { expect, test, type Page } from '@playwright/test';

async function openRoom(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
}

async function projectX(page: Page) {
  return page.locator('[data-action="projects"]').evaluate((node) => parseFloat(node.style.left));
}

async function pull(page: Page, fromX: number, toX: number) {
  await page.mouse.move(fromX, 600);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(fromX + ((toX - fromX) * step) / 6, 600);
    await page.waitForTimeout(16);
  }
}

async function objectPositions(page: Page) {
  return page.locator('.room-hotspot').evaluateAll((nodes) =>
    nodes.map((node) => {
      const element = node as HTMLElement;
      return [parseFloat(element.style.left), parseFloat(element.style.top)];
    }),
  );
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`the uncropped room stays fixed while objects remain clickable (${reducedMotion})`, async ({
    page,
  }) => {
    // Software-rendered CI needs time for both real focus transitions and actionability checks.
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/#room');
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
    const canvas = page.locator('canvas[data-room-canvas]');
    const before = await objectPositions(page);
    await page.mouse.move(400, 730);
    await page.mouse.down();
    await page.mouse.move(650, 790, { steps: 6 });
    await page.waitForTimeout(100);
    expect(await objectPositions(page)).toEqual(before);
    await page.mouse.up();
    await page.waitForTimeout(350);
    expect(await objectPositions(page)).toEqual(before);
    await expect(page.getByText('Drag or swipe to look around', { exact: true })).toHaveCount(0);
    await expect(canvas).toHaveCSS('cursor', 'default');
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(await objectPositions(page)).toEqual(before);
    // A real painted monitor click, not just its overlaid HTML button.
    await page.mouse.click(1430, 440);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Back to room' }).click();
    await page.locator('[data-action="photography"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

test('resizing into an uncropped room stops a fling and resizing back restores panning', async ({
  page,
}) => {
  await openRoom(page);
  const hint = page.getByText('Drag or swipe to look around', { exact: true });
  await expect(hint).toBeVisible();
  await pull(page, 90, 225);
  await page.mouse.up();
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(hint).toHaveCount(0);
  await page.waitForTimeout(100);
  const settled = await objectPositions(page);
  await page.waitForTimeout(350);
  expect(await objectPositions(page)).toEqual(settled);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(hint).toBeVisible();
  const before = await projectX(page);
  await pull(page, 90, 225);
  await expect.poll(() => projectX(page)).toBeGreaterThan(before + 100);
  await page.mouse.up();
});

test.describe('touch exploration', () => {
  test.use({ hasTouch: true, deviceScaleFactor: 3 });
  for (const { viewport, from, to, movesHorizontally } of [
    {
      viewport: { width: 390, height: 844 },
      from: [80, 600],
      to: [224, 600],
      movesHorizontally: true,
    },
    {
      viewport: { width: 390, height: 844 },
      from: [180, 600],
      to: [180, 500],
      movesHorizontally: false,
    },
    {
      viewport: { width: 844, height: 390 },
      from: [440, 300],
      to: [440, 230],
      movesHorizontally: false,
    },
  ]) {
    test(`native touch ${movesHorizontally ? 'pans horizontally' : 'ignores vertical drags'} at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/#room');
      await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
      const before = (await objectPositions(page))[0];
      const session = await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: from[0], y: from[1] }],
      });
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: from[0] + ((to[0] - from[0]) * step) / 6,
              y: from[1] + ((to[1] - from[1]) * step) / 6,
            },
          ],
        });
        await page.waitForTimeout(16);
      }
      if (movesHorizontally) {
        await expect
          .poll(async () => (await objectPositions(page))[0][0] - before[0])
          .toBeGreaterThan(20);
      } else {
        expect((await objectPositions(page))[0]).toEqual(before);
      }
      expect((await objectPositions(page))[0][1]).toBeCloseTo(before[1], 5);
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(350);
      expect((await objectPositions(page))[0][1]).toBeCloseTo(before[1], 5);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await session.detach();
    });
  }
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1600, height: 900 },
]) {
  test(`up and down input never shifts the room at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#room');
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
    const before = await objectPositions(page);
    const canvas = page.locator('canvas[data-room-canvas]');
    const x = Math.min(viewport.width / 2, 440);
    const y = Math.min(viewport.height - 130, 600);
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion });
      for (const dy of [-100, 100]) {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + dy, { steps: 6 });
        await page.waitForTimeout(100);
        expect(await objectPositions(page)).toEqual(before);
        await page.mouse.up();
        await page.waitForTimeout(350);
        expect(await objectPositions(page)).toEqual(before);
      }
      await canvas.focus();
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(200);
      expect(await objectPositions(page)).toEqual(before);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      expect(await objectPositions(page)).toEqual(before);
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (viewport.width === 844) {
      await expect(page.getByText('Drag or swipe to look around', { exact: true })).toHaveCount(0);
    }
  });
}

test('a released room drag glides, and grabbing it again stops that glide', async ({ page }) => {
  await openRoom(page);
  const initial = await projectX(page);
  const session = await page.context().newCDPSession(page);
  const startedAtSeconds = Date.now() / 1000;
  // Timestamp trusted browser input: slow CI command delivery must not turn a flick into a hold.
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 90,
    y: 600,
    button: 'left',
    buttons: 1,
    clickCount: 1,
    timestamp: startedAtSeconds,
  });
  for (let step = 1; step <= 6; step++) {
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 90 + step * 22.5,
      y: 600,
      button: 'left',
      buttons: 1,
      timestamp: startedAtSeconds + step * 0.016,
    });
  }
  await expect.poll(() => projectX(page)).toBeCloseTo(initial + 135, 1);
  const held = await projectX(page);
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 225,
    y: 600,
    button: 'left',
    buttons: 0,
    clickCount: 1,
    timestamp: startedAtSeconds + 0.112,
  });
  await expect.poll(() => projectX(page)).toBeGreaterThan(held + 12);
  await session.detach();
  await page.mouse.move(225, 600);
  await page.mouse.down();
  const grabbed = await projectX(page);
  await page.waitForTimeout(350);
  expect(Math.abs((await projectX(page)) - grabbed)).toBeLessThan(1);
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('pulling past the painting edge resists gently and returns to the same resting edge', async ({
  page,
}) => {
  await openRoom(page);
  const canvas = page.locator('canvas[data-room-canvas]');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await canvas.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft');
  await expect.poll(() => projectX(page)).toBeGreaterThan(1368);
  const edge = await projectX(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const clock = await canvas.getAttribute('data-window-time');
  await expect.poll(() => canvas.getAttribute('data-window-time')).not.toBe(clock);
  await pull(page, 90, 330);
  await page.waitForTimeout(80);
  expect((await projectX(page)) - edge).toBeGreaterThan(4);
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await projectX(page)) - edge)).toBeLessThan(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
]) {
  test(`edge dragging reveals the theme backdrop and springs back without zooming at ${viewport.width}px`, async ({
    page,
  }) => {
    // Keep both actual pixel checks; allow the CI software renderer to capture them.
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#room');
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
    const canvas = page.locator('canvas[data-room-canvas]');
    async function projectedObjects() {
      return page.locator('.room-hotspot').evaluateAll((nodes) => {
        const point = (id: string) => {
          const node = nodes.find(
            (node) => (node as HTMLElement).dataset.action === id,
          ) as HTMLElement;
          return { x: parseFloat(node.style.left), y: parseFloat(node.style.top) };
        };
        const projects = point('projects');
        const photos = point('photography');
        return {
          x: projects.x,
          y: projects.y,
          distance: Math.hypot(projects.x - photos.x, projects.y - photos.y),
        };
      });
    }
    async function exposedPixel() {
      const png = (await canvas.screenshot()).toString('base64');
      return page.evaluate(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const surface = document.createElement('canvas');
        surface.width = image.width;
        surface.height = image.height;
        const context = surface.getContext('2d')!;
        context.drawImage(image, 0, 0);
        return [...context.getImageData(3, Math.floor(image.height / 2), 1, 1).data];
      }, png);
    }
    await canvas.focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft');
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const before = await projectedObjects();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const clock = await canvas.getAttribute('data-window-time');
    await expect.poll(() => canvas.getAttribute('data-window-time')).not.toBe(clock);
    await page.mouse.move(180, viewport.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(240, viewport.height * 0.55 + 100, { steps: 6 });
    await expect.poll(async () => (await projectedObjects()).x).toBeGreaterThan(before.x + 8);
    expect((await projectedObjects()).y).toBeCloseTo(before.y, 5);
    expect((await projectedObjects()).distance).toBeCloseTo(before.distance, 1);
    expect(await exposedPixel()).toEqual([243, 240, 230, 255]);
    await page.mouse.up();
    await expect
      .poll(async () => Math.abs((await projectedObjects()).x - before.x))
      .toBeLessThan(0.1);
    expect((await projectedObjects()).distance).toBeCloseTo(before.distance, 1);
    expect(await exposedPixel()).not.toEqual([243, 240, 230, 255]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('a button ripple starts at the press, expands, and cleans up without delaying navigation', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const button = page.getByRole('link', { name: 'The portfolio', exact: true });
  const bounds = (await button.boundingBox())!;
  await page.mouse.move(bounds.x + 12, bounds.y + 15);
  await page.mouse.down();
  const ripple = button.locator('[data-button-ripple]');
  await expect(ripple).toHaveCount(1);
  const first = (await ripple.boundingBox())!;
  expect(Math.abs(first.x + first.width / 2 - (bounds.x + 12))).toBeLessThan(3);
  expect(Math.abs(first.y + first.height / 2 - (bounds.y + 15))).toBeLessThan(3);
  // Sample our visible effect at a known timeline position, independent of compositor load.
  await ripple.evaluate((node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    animation.currentTime = 150;
  });
  expect((await ripple.boundingBox())!.width).toBeGreaterThan(first.width + 20);
  await page.mouse.up();
  await expect(page).toHaveURL(/#portfolio$/);
  await expect(ripple).toHaveCount(0);
});

test('reduced motion keeps direct panning but disables glide, edge stretch and button scaling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRoom(page);
  const before = await projectX(page);
  await pull(page, 90, 225);
  await page.mouse.up();
  const released = await projectX(page);
  expect(released - before).toBeGreaterThan(120);
  await page.waitForTimeout(350);
  expect(await projectX(page)).toBeCloseTo(released, 1);
  const button = page.getByRole('link', { name: 'The room', exact: true });
  const original = (await button.boundingBox())!;
  await page.mouse.move(original.x + 15, original.y + 15);
  await page.mouse.down();
  await expect(button.locator('[data-button-ripple]')).toHaveCount(0);
  expect((await button.boundingBox())!.width).toBeCloseTo(original.width, 1);
  await page.mouse.up();
});

test('holding a drag still before release does not launch stale momentum', async ({ page }) => {
  await openRoom(page);
  await pull(page, 90, 225);
  await page.waitForTimeout(200);
  const held = await projectX(page);
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await projectX(page)).toBeCloseTo(held, 1);
});

test('changing motion preference during a fling stops it immediately', async ({ page }) => {
  await openRoom(page);
  await pull(page, 90, 225);
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const stopped = await projectX(page);
  await page.waitForTimeout(350);
  expect(await projectX(page)).toBeCloseTo(stopped, 1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(250);
  expect(await projectX(page)).toBeCloseTo(stopped, 1);
});

test('cancelled pointer capture stops a drag without opening an object or leaving momentum', async ({
  page,
}) => {
  await openRoom(page);
  await pull(page, 90, 225);
  await page
    .locator('canvas[data-room-canvas]')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })),
    );
  await page.mouse.up();
  await page.waitForTimeout(100);
  const cancelled = await projectX(page);
  await page.waitForTimeout(350);
  expect(await projectX(page)).toBeCloseTo(cancelled, 1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('keyboard activation has centered feedback and still follows a real link', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const button = page.getByRole('link', { name: 'The portfolio', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  const ripple = button.locator('[data-button-ripple]');
  await expect(ripple).toHaveCount(1);
  const effect = (await ripple.boundingBox())!;
  const target = (await button.boundingBox())!;
  expect(effect.x + effect.width / 2).toBeCloseTo(target.x + target.width / 2, 0);
  expect(effect.y + effect.height / 2).toBeCloseTo(target.y + target.height / 2, 0);
  await expect(button).toBeFocused();
  await expect(ripple).toHaveCount(0);
  await page.getByRole('link', { name: 'The room', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#room$/);
});

test('the actual dialog entrance eases into place instead of falling back to generic CSS easing', async ({
  page,
}) => {
  await openRoom(page);
  await page.locator('[data-collection="projects"]').click();
  const timing = await page.getByRole('dialog').evaluate((node) => {
    const style = getComputedStyle(node);
    return { easing: style.animationTimingFunction, duration: parseFloat(style.animationDuration) };
  });
  expect(timing.easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
  expect(timing.duration).toBeGreaterThan(0.2);
  expect(timing.duration).toBeLessThan(0.3);
});
