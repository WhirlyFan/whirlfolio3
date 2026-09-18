import { expect, test } from '@playwright/test';

test('repeated unsupported-WebGL mounts after a successful capability check retain no Pixi resources', async ({
  page,
}) => {
  await page.goto('/#portfolio');
  const result = await page.evaluate(async () => {
    const runtimeUrl = '/src/room/pixi/runtime.ts';
    const runtimeSource = await fetch(runtimeUrl).then((response) => response.text());
    const pixiUrl = runtimeSource.match(
      /["'](\/node_modules\/\.vite\/deps\/pixi__js\.js\?v=[^"']+)["']/,
    )?.[1];
    if (!pixiUrl) throw new Error('Could not resolve the Pixi module used by the room runtime');

    const [{ mountRoom }, { Ticker, hasCachedCanvasTexture, isWebGLSupported }] = await Promise.all(
      [import(runtimeUrl), import(pixiUrl)],
    );
    if (!isWebGLSupported()) throw new Error('WebGL must be available before the failure probe');
    const host = document.createElement('div');
    document.body.append(host);
    const createdCanvases: HTMLCanvasElement[] = [];
    const createElement = document.createElement.bind(document);
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      const element = createElement(tagName, options);
      if (element instanceof HTMLCanvasElement) createdCanvases.push(element);
      return element;
    }) as typeof document.createElement;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId,
      options,
    ) {
      if (contextId === 'webgl' || contextId === 'webgl2') return null;
      return Reflect.apply(getContext, this, [contextId, options]);
    } as typeof HTMLCanvasElement.prototype.getContext;

    const tickerListenersBefore = Ticker.system.count;
    let failures = 0;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        await mountRoom(host, {
          signal: new AbortController().signal,
          initialState: {
            fanSpeed: 1,
            reducedMotion: false,
            activeAction: null,
            actionStartedAt: 0,
            paused: false,
            quality: 'auto',
          },
          onAction() {},
          onReady() {},
          onError() {},
        }).catch(() => {
          failures++;
        });
      }
      return {
        failures,
        tickerListenersBefore,
        tickerListenersAfter: Ticker.system.count,
        cachedCanvases: createdCanvases.filter((canvas) => hasCachedCanvasTexture(canvas)).length,
      };
    } finally {
      document.createElement = createElement;
      HTMLCanvasElement.prototype.getContext = getContext;
      host.remove();
    }
  });

  expect(result.failures).toBe(3);
  expect.soft(result.tickerListenersAfter).toBe(result.tickerListenersBefore);
  expect(result.cachedCanvases).toBe(0);
});

test('changing the reduced-motion preference stops animation callbacks, not only pixels', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let count = 0;
    const pending = new Set<number>();
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        pending.delete(id);
        count++;
        callback(time);
      });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      pending.delete(id);
      cancel(id);
    };
    Object.defineProperty(window, '__frameCount', { get: () => count });
    Object.defineProperty(window, '__pendingFrames', { get: () => pending.size });
  });
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Pausing requests one final redraw. Wait for actual quiescence rather
  // than assuming a software-GPU frame finishes inside a fixed200ms window.
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__pendingFrames'))).toBe(0);
  const frames = await page.evaluate(() => Reflect.get(window, '__frameCount'));
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => Reflect.get(window, '__frameCount'))).toBe(frames);
});

test('graphics context loss removes the scene and leaves a working reading route', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#room');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss extension unavailable');
    extension.loseContext();
  });
  await expect(page.getByText('The room couldn’t open on this device.')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Read the portfolio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeAttached();
  expect(errors).toEqual([]);
});

test('uses the painted renderer and keeps fan-off window animation independent', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#room');
  const canvas = page.locator('canvas[data-room-canvas]');
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-renderer', 'pixi');
  await page.getByRole('button', { name: 'Desk fan', exact: true }).click();
  await page.getByRole('button', { name: 'Desk fan', exact: true }).click();
  const fan = await canvas.getAttribute('data-fan-angle');
  const windowTime = Number(await canvas.getAttribute('data-window-time'));
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-window-time')))
    .toBeGreaterThan(windowTime);
  expect(await canvas.getAttribute('data-fan-angle')).toBe(fan);
  expect(errors).toEqual([]);
});

for (const layer of [
  'curtain-v1.webp',
  'dove-atlas-v2.webp',
  'foliage-atlas-v1.webp',
  'trailing-atlas-v1.webp',
  'summer-room-v11.svg',
  'floor-receiver-v2.webp',
  'tripod-reference-v4.webp',
  'sleeper-joint-v1.svg',
  'fan-empty-v2.svg',
]) {
  test(`leaves the full portfolio usable when ${layer} fails`, async ({ page }) => {
    await page.route(`**/art/${layer}`, (route) => route.abort());
    await page.goto('/#room');
    await expect(page.getByText('The room couldn’t open on this device.')).toBeVisible();
    await page.getByRole('link', { name: 'Read the portfolio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Handshake', exact: true })).toBeAttached();
    await expect(page.locator('canvas')).toHaveCount(0);
  });
}

test('cancels pending room initialization when a visitor switches to reading', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/art/summer-room-*', async (route) => {
    requests++;
    if (requests === 1) await pending;
    await route.continue().catch(() => {});
  });
  await page.goto('/#room');
  try {
    await expect.poll(() => requests).toBe(1);
    await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'false');
    await page.getByRole('link', { name: 'The portfolio', exact: true }).click();
  } finally {
    release();
  }
  await page.waitForTimeout(800);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'The room', exact: true }).click();
  await expect(page.getByTestId('room-stage')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
});
