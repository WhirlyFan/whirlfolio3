import { Container, Ticker, WebGLRenderer } from 'pixi.js';
import { getPixelRatio, shouldAnimate, type Quality } from '../policy';
import type { RoomAction, RoomAnimationState, SectionId } from '../types';
import { loadArtwork, sceneSize } from './assets';
import { createPaintedScene } from './scene';
import { constrainCenter, fitScene, getPanAxes, type PanAxes } from './layout';
import { advanceMotion, type MotionClock } from './motion';
import {
  advanceCamera,
  cameraAt,
  cameraBounds,
  cameraSettled,
  elasticCamera,
  releaseVelocity,
  sampleDrag,
  type CameraMotion,
  type DragSample,
} from './camera';

// This lazy module is the application's only Pixi consumer. Our owned frame loop
// replaces the shared event/maintenance ticker; all scene resources are disposed
// on leaving the room, rather than relying on background garbage collection.
Ticker.system.autoStart = false;
Ticker.system.stop();

export interface RuntimeState extends RoomAnimationState {
  paused: boolean;
  quality: Quality;
}
export interface RoomRuntime {
  setState(state: RuntimeState): void;
  focus(section: SectionId | null): void;
  dispose(): void;
}
interface Options {
  initialState: RuntimeState;
  signal: AbortSignal;
  onAction(action: RoomAction): void;
  onReady(): void;
  onError(message: string): void;
  onPanAxesChange?(axes: PanAxes): void;
}

/** The only owner of rendering, async artwork, input, observer and animation lifetimes. */
export async function mountRoom(host: HTMLElement, options: Options): Promise<RoomRuntime> {
  const renderer = new WebGLRenderer();
  const stage = new Container();
  const controller = new AbortController();
  const cancelLoad = () => controller.abort();
  options.signal.addEventListener('abort', cancelLoad, { once: true });
  if (options.signal.aborted) controller.abort();
  let artwork: Awaited<ReturnType<typeof loadArtwork>> | undefined;
  let scene: ReturnType<typeof createPaintedScene> | undefined;
  let initialized = false;
  let disposed = false;
  let frame = 0;
  let previousMs: number | null = null;
  let state = { ...options.initialState };
  let clock: MotionClock = { elapsedSeconds: 0, fanAngle: 0 };
  let section: SectionId | null = null;
  let resizeObserver: ResizeObserver | undefined;
  const buttons: HTMLButtonElement[] = [];
  const canvas = document.createElement('canvas');
  canvas.dataset.roomCanvas = '';
  canvas.dataset.renderer = 'pixi';
  let view = { width: 1, height: 1 };
  let panAxes: PanAxes = { x: false, y: false };
  let zoom = 1;
  let desiredZoom = 1;
  let center = { x: sceneSize.width / 2, y: sceneSize.height / 2 };
  let desiredCenter = { ...center };
  let overviewCenter = { x: sceneSize.width / 2, y: sceneSize.height / 2 };
  let firstResize = true;
  let cameraMotion: CameraMotion | null = null;
  let pointerStart: {
    x: number;
    y: number;
    id: number;
    center: typeof center;
    dragged: boolean;
    samples: DragSample[];
  } | null = null;

  function canPan() {
    return panAxes.x || panAxes.y;
  }
  function restingCursor() {
    return canPan() ? 'grab' : 'default';
  }

  function bounded(point: typeof center, cameraZoom = desiredZoom) {
    const fit = fitScene(view.width, view.height, sceneSize.width, sceneSize.height);
    return constrainCenter(
      point,
      view.width,
      view.height,
      fit.scale * cameraZoom,
      sceneSize.width,
      sceneSize.height,
    );
  }

  function moving() {
    return shouldAnimate({
      hidden: document.hidden,
      paused: state.paused,
      reducedMotion: state.reducedMotion,
    });
  }
  function invalidate() {
    if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function draw(timestampMs: number) {
    frame = 0;
    if (disposed || document.hidden || !scene) return;
    const animate = moving();
    const delta = animate && previousMs !== null ? (timestampMs - previousMs) / 1000 : 0;
    previousMs = timestampMs;
    clock = advanceMotion(clock, delta, { ...state, paused: !animate });
    if (cameraMotion && !section) {
      if (!pointerStart && animate) {
        cameraMotion = advanceCamera(cameraMotion, cameraBounds(view, sceneSize), delta);
      }
      const elastic = elasticCamera(cameraMotion.position, view, sceneSize);
      center = elastic.center;
      zoom = elastic.zoom;
      overviewCenter = bounded(cameraMotion.position, 1);
      desiredCenter = { ...overviewCenter };
      if (!pointerStart && cameraSettled(cameraMotion)) cameraMotion = null;
    } else {
      const blend = animate ? 1 - Math.exp(-Math.min(delta, 0.05) * 6) : 1;
      zoom += (desiredZoom - zoom) * blend;
      center.x += (desiredCenter.x - center.x) * blend;
      center.y += (desiredCenter.y - center.y) * blend;
      center = bounded(center, zoom);
    }
    const fit = fitScene(view.width, view.height, sceneSize.width, sceneSize.height);
    scene.container.scale.set(fit.scale * zoom);
    scene.container.position.set(
      view.width / 2 - center.x * fit.scale * zoom,
      view.height / 2 - center.y * fit.scale * zoom,
    );
    scene.update(clock, section === 'projects', {
      fanSpeed: state.fanSpeed,
      width: view.width,
      quality: state.quality,
    });
    renderer.render({ container: stage });
    scene.targets.forEach((target, i) => {
      const point = scene!.container.toGlobal(target);
      // A cropped object must not masquerade as an unrelated button on the screen edge.
      buttons[i].hidden =
        section !== null ||
        point.x < 24 ||
        point.x > view.width - 24 ||
        point.y < 24 ||
        point.y > view.height - 24;
      buttons[i].style.left = `${point.x}px`;
      buttons[i].style.top = `${point.y}px`;
    });
    canvas.dataset.fanAngle = clock.fanAngle.toFixed(4);
    canvas.dataset.windowTime = clock.elapsedSeconds.toFixed(4);
    if (animate) frame = requestAnimationFrame(draw);
  }
  function activate(action: RoomAction) {
    cancelCamera();
    options.onAction(action);
    invalidate();
  }
  function hit(event: PointerEvent) {
    if (!scene || section) return null;
    const bounds = canvas.getBoundingClientRect();
    const point = scene.container.toLocal({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    return scene.targets.find((target) => target.area.contains(point.x, point.y))?.id ?? null;
  }
  function pointerDown(event: PointerEvent) {
    if (event.button === 0 && event.isPrimary && !section && !pointerStart) {
      const position = cameraMotion?.position ?? center;
      cameraMotion = canPan() && moving() ? cameraAt(position) : null;
      pointerStart = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        center: { ...position },
        dragged: false,
        samples: [{ position: { ...position }, timeMs: event.timeStamp }],
      };
      canvas.setPointerCapture(event.pointerId);
    }
  }
  function pointerMove(event: PointerEvent) {
    if (pointerStart?.id === event.pointerId && !section) {
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      if (pointerStart.dragged || Math.hypot(dx, dy) > 10) {
        pointerStart.dragged = true;
        // Keep the drag/click distinction even when the complete room is visible.
        if (!canPan()) return;
        const fit = fitScene(view.width, view.height, sceneSize.width, sceneSize.height);
        const position = {
          x: pointerStart.center.x - (panAxes.x ? dx / fit.scale : 0),
          y: pointerStart.center.y - (panAxes.y ? dy / fit.scale : 0),
        };
        pointerStart.samples = sampleDrag(pointerStart.samples, position, event.timeStamp);
        overviewCenter = bounded(position, 1);
        desiredCenter = { ...overviewCenter };
        if (moving()) cameraMotion = cameraAt(position);
        else center = { ...overviewCenter };
        canvas.style.cursor = 'grabbing';
        invalidate();
        return;
      }
    }
    canvas.style.cursor = hit(event) ? 'pointer' : restingCursor();
  }
  function cancelCamera() {
    const pointer = pointerStart;
    pointerStart = null;
    if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
    if (cameraMotion) {
      overviewCenter = bounded(cameraMotion.position, 1);
      desiredCenter = { ...overviewCenter };
      center = { ...overviewCenter };
      zoom = desiredZoom = 1;
      cameraMotion = null;
    }
    canvas.style.cursor = restingCursor();
  }
  function pointerCancel(event: PointerEvent) {
    if (pointerStart?.id !== event.pointerId) return;
    cancelCamera();
    invalidate();
  }
  function pointerUp(event: PointerEvent) {
    const start = pointerStart;
    if (!start || start.id !== event.pointerId) return;
    pointerStart = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = restingCursor();
    if (start.dragged && cameraMotion) {
      const fit = fitScene(view.width, view.height, sceneSize.width, sceneSize.height);
      cameraMotion.velocity = releaseVelocity(start.samples, event.timeStamp, fit.scale);
      invalidate();
    }
    if (
      !start ||
      start.dragged ||
      start.id !== event.pointerId ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
    )
      return;
    const action = hit(event);
    if (action) activate(action);
  }
  function keyDown(event: KeyboardEvent) {
    if (section) return;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-160, 0],
      ArrowRight: [160, 0],
      ArrowUp: [0, -120],
      ArrowDown: [0, 120],
    };
    const direction = directions[event.key];
    if (!direction || (!panAxes.x && direction[0]) || (!panAxes.y && direction[1])) return;
    event.preventDefault();
    cancelCamera();
    overviewCenter = bounded({
      x: overviewCenter.x + direction[0],
      y: overviewCenter.y + direction[1],
    });
    desiredCenter = { ...overviewCenter };
    invalidate();
  }
  function resize() {
    if (disposed) return;
    cancelCamera();
    view = { width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) };
    const nextAxes = getPanAxes(view.width, view.height, sceneSize.width, sceneSize.height);
    if (panAxes.x !== nextAxes.x || panAxes.y !== nextAxes.y) {
      panAxes = nextAxes;
      options.onPanAxesChange?.(panAxes);
    }
    canvas.style.cursor = restingCursor();
    // Let the browser own gestures on axes that do not explore cropped artwork.
    canvas.style.touchAction = panAxes.x
      ? panAxes.y
        ? 'none'
        : 'pan-y'
      : panAxes.y
        ? 'pan-x'
        : 'auto';
    canvas.tabIndex = canPan() ? 0 : -1;
    canvas.setAttribute(
      'aria-label',
      `Painted summer room. ${canPan() ? 'Drag left or right, or use the left and right arrow keys to look around. ' : ''}Use the named object buttons to explore.`,
    );
    if (firstResize) {
      // Start on the desk/portfolio invitation when the wide painting is cropped.
      // Landscape screens wide enough for the whole room clamp back to its center.
      overviewCenter.x = view.width < 640 ? 1340 : 920;
      center = bounded(overviewCenter);
      firstResize = false;
    }
    overviewCenter = bounded(overviewCenter, 1);
    renderer.resize(
      view.width,
      view.height,
      getPixelRatio(devicePixelRatio, state.quality, view.width),
    );
    // autoDensity rounds backing pixels, then writes a fractional CSS size.
    // Keep display/input bounds exact while retaining the capped backing resolution.
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    updateFocus();
    invalidate();
  }
  function updateFocus() {
    const target = scene?.targets.find((item) => item.id === section);
    desiredZoom = target && view.width >= 640 ? 1.17 : 1;
    desiredCenter = bounded(target ? { x: target.x, y: target.y } : overviewCenter);
    // Synchronous visibility makes focus restoration independent of the next render frame.
    buttons.forEach((button) => {
      button.hidden = section !== null;
    });
  }
  function visibilityChanged() {
    cancelCamera();
    cancelAnimationFrame(frame);
    frame = 0;
    previousMs = null;
    invalidate();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    dispose();
    options.onError('The room couldn’t open on this device.');
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    options.signal.removeEventListener('abort', cancelLoad);
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', visibilityChanged);
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerCancel);
    canvas.removeEventListener('lostpointercapture', pointerCancel);
    canvas.removeEventListener('keydown', keyDown);
    canvas.removeEventListener('webglcontextlost', contextLost);
    buttons.forEach((button) => button.remove());
    scene?.dispose();
    stage.destroy();
    artwork?.dispose();
    if (initialized) renderer.destroy({ removeView: true });
    canvas.remove();
  }
  try {
    controller.signal.throwIfAborted();
    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      premultipliedAlpha: true,
      antialias: false,
      stencil: true,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    };
    const context =
      canvas.getContext('webgl2', contextAttributes) ??
      canvas.getContext('webgl', contextAttributes);
    if (!context) throw new Error('This browser does not support WebGL');
    await renderer.init({
      canvas,
      // @ts-expect-error Pixi supports WebGL1 here, but its context type only names WebGL2.
      context,
      width: 1,
      height: 1,
      antialias: false,
      // Edge overpull reveals the same paper color as the surrounding portfolio.
      backgroundColor: getComputedStyle(host).getPropertyValue('--paper').trim(),
      autoDensity: true,
      powerPreference: 'low-power',
      gcActive: false,
    });
    initialized = true;
    // Native hit testing below owns input. Detach Pixi's unused event ticker,
    // including its continuous RAF and inline touch-action override.
    // @ts-expect-error Pixi 8.20.1 documents/implements null; its parameter type omits it.
    renderer.events.setTargetElement(null);
    controller.signal.throwIfAborted();
    artwork = await loadArtwork(controller.signal);
    controller.signal.throwIfAborted();
    scene = createPaintedScene(artwork.textures);
    stage.addChild(scene.container);
    host.append(canvas);
    for (const target of scene.targets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'room-hotspot';
      button.classList.toggle('room-hotspot--persistent', target.id === 'photography');
      button.dataset.action = target.id;
      button.setAttribute('aria-label', target.label);
      const dot = document.createElement('span');
      dot.className = 'hotspot-dot';
      dot.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = target.id === 'photography' ? `${target.label} →` : target.label;
      button.append(dot, label);
      button.addEventListener('click', () => activate(target.id));
      host.append(button);
      buttons.push(button);
    }
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerCancel);
    canvas.addEventListener('lostpointercapture', pointerCancel);
    canvas.addEventListener('keydown', keyDown);
    canvas.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', visibilityChanged);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    cancelAnimationFrame(frame);
    frame = 0;
    draw(performance.now());
    options.onReady();
    return {
      setState(next) {
        const qualityChanged = state.quality !== next.quality;
        state = { ...next };
        if (!moving()) cancelCamera();
        previousMs = null;
        if (qualityChanged) resize();
        invalidate();
      },
      focus(next) {
        cancelCamera();
        section = next;
        updateFocus();
        invalidate();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
