import { cameraTuning as tuning } from './camera-constants';
import { constrainCenter, fitScene } from './layout';

export interface Point {
  x: number;
  y: number;
}
export interface CameraMotion {
  position: Point;
  velocity: Point;
  spring: { x: number | null; y: number | null };
}
export interface CameraBounds {
  min: Point;
  max: Point;
}
export interface DragSample {
  position: Point;
  timeMs: number;
}

export function cameraAt(position: Point): CameraMotion {
  return { position: { ...position }, velocity: { x: 0, y: 0 }, spring: { x: null, y: null } };
}

export function cameraBounds(
  view: { width: number; height: number },
  scene: { width: number; height: number },
): CameraBounds {
  const { scale } = fitScene(view.width, view.height, scene.width, scene.height);
  const half = { x: view.width / scale / 2, y: view.height / scale / 2 };
  return { min: half, max: { x: scene.width - half.x, y: scene.height - half.y } };
}

/** Closed-form damped spring. Keeping its target through a crossing avoids a sudden coast. */
function springAxis(position: number, velocity: number, target: number, seconds: number) {
  const decay = tuning.springFrequency * tuning.springDamping;
  const frequency = tuning.springFrequency * Math.sqrt(1 - tuning.springDamping ** 2);
  const displacement = position - target;
  const coefficient = (velocity + decay * displacement) / frequency;
  const cosine = Math.cos(frequency * seconds);
  const sine = Math.sin(frequency * seconds);
  const envelope = Math.exp(-decay * seconds);
  const nextPosition = target + envelope * (displacement * cosine + coefficient * sine);
  const nextVelocity =
    envelope *
    ((coefficient * frequency - decay * displacement) * cosine -
      (displacement * frequency + decay * coefficient) * sine);
  if (
    Math.abs(nextPosition - target) < tuning.restDistance &&
    Math.abs(nextVelocity) < tuning.restSpeed
  ) {
    return { position: target, velocity: 0, spring: null };
  }
  return { position: nextPosition, velocity: nextVelocity, spring: target };
}

function advanceAxis(
  position: number,
  velocity: number,
  spring: number | null,
  min: number,
  max: number,
  seconds: number,
) {
  const target = spring ?? (position < min ? min : position > max ? max : null);
  if (target !== null) return springAxis(position, velocity, target, seconds);
  const decay = Math.exp(-seconds / tuning.coastSeconds);
  const nextPosition = position + velocity * tuning.coastSeconds * (1 - decay);
  if (nextPosition < min || nextPosition > max) {
    const edge = nextPosition < min ? min : max;
    // Integrate to the exact time of impact, then spend the rest of this frame in the spring.
    const impactSeconds =
      -tuning.coastSeconds * Math.log(1 - (edge - position) / (velocity * tuning.coastSeconds));
    return springAxis(
      edge,
      velocity * Math.exp(-impactSeconds / tuning.coastSeconds),
      edge,
      Math.max(0, seconds - impactSeconds),
    );
  }
  return {
    position: nextPosition,
    velocity: Math.abs(velocity * decay) < tuning.restSpeed ? 0 : velocity * decay,
    spring: null,
  };
}

export function advanceCamera(
  current: CameraMotion,
  bounds: CameraBounds,
  seconds: number,
): CameraMotion {
  if (seconds <= 0 || !Number.isFinite(seconds)) return current;
  const x = advanceAxis(
    current.position.x,
    current.velocity.x,
    current.spring.x,
    bounds.min.x,
    bounds.max.x,
    seconds,
  );
  const y = advanceAxis(
    current.position.y,
    current.velocity.y,
    current.spring.y,
    bounds.min.y,
    bounds.max.y,
    seconds,
  );
  return {
    position: { x: x.position, y: y.position },
    velocity: { x: x.velocity, y: y.velocity },
    spring: { x: x.spring, y: y.spring },
  };
}

export function cameraSettled(motion: CameraMotion) {
  return (
    motion.velocity.x === 0 &&
    motion.velocity.y === 0 &&
    motion.spring.x === null &&
    motion.spring.y === null
  );
}

export function sampleDrag(samples: DragSample[], position: Point, timeMs: number) {
  return [
    ...samples.filter((sample) => timeMs - sample.timeMs <= tuning.sampleWindowMs),
    { position: { ...position }, timeMs },
  ];
}

export function releaseVelocity(samples: DragSample[], timeMs: number, scale: number): Point {
  const last = samples.at(-1);
  const first =
    last && samples.find((sample) => last.timeMs - sample.timeMs <= tuning.sampleWindowMs);
  if (!first || !last || timeMs - last.timeMs > tuning.staleSampleMs || last.timeMs <= first.timeMs)
    return { x: 0, y: 0 };
  const seconds = (last.timeMs - first.timeMs) / 1000;
  const velocity = {
    x: (last.position.x - first.position.x) / seconds,
    y: (last.position.y - first.position.y) / seconds,
  };
  const factor = Math.min(
    1,
    tuning.maxReleaseSpeedPx / (Math.hypot(velocity.x, velocity.y) * scale),
  );
  return { x: velocity.x * factor, y: velocity.y * factor };
}

/** Resist edge pulls at a fixed scale; a small exposed backdrop springs away on release. */
export function elasticCamera(
  position: Point,
  view: { width: number; height: number },
  scene: { width: number; height: number },
) {
  const { scale } = fitScene(view.width, view.height, scene.width, scene.height);
  const edge = constrainCenter(position, view.width, view.height, scale, scene.width, scene.height);
  function resist(delta: number) {
    const limit = tuning.maxEdgePullPx / scale;
    return (
      Math.sign(delta) * limit * -Math.expm1((-Math.abs(delta) * tuning.edgeResistance) / limit)
    );
  }
  const center = {
    x: edge.x + resist(position.x - edge.x),
    y: edge.y + resist(position.y - edge.y),
  };
  return { center, zoom: 1 };
}
