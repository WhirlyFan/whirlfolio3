// One calibrated camera/sun for all horizontal receivers. Scene pixels, not source-raster pixels.
// The sun's image vanishing point is high-right; parallel solar rays meet there.
export const sunlight = { x: 1280, y: -1100 } as const;
export const lightCamera = { centerX: 800, horizonY: 400 } as const;

/** Window-parallel vertical receiver at a fixed relative depth, not a horizontal tabletop. */
export function invertVerticalSunShadow(point: { x: number; y: number }, depthScale: number) {
  return {
    x: sunlight.x + (point.x - sunlight.x) / depthScale,
    y: sunlight.y + (point.y - sunlight.y) / depthScale,
  };
}

export function projectSunShadow(point: { x: number; y: number }, baselineY: number) {
  const solarDepth = lightCamera.horizonY - sunlight.y;
  const height = baselineY - point.y;
  const divisor = 1 - height / solarDepth;
  return {
    x:
      lightCamera.centerX +
      (point.x - lightCamera.centerX - (height * (sunlight.x - lightCamera.centerX)) / solarDepth) /
        divisor,
    y: lightCamera.horizonY + (baselineY - lightCamera.horizonY) / divisor,
  };
}

export function invertSunShadow(point: { x: number; y: number }, baselineY: number) {
  const solarDepth = lightCamera.horizonY - sunlight.y;
  const divisor = (baselineY - lightCamera.horizonY) / (point.y - lightCamera.horizonY);
  const height = solarDepth * (1 - divisor);
  return {
    x:
      lightCamera.centerX +
      (point.x - lightCamera.centerX) * divisor +
      (height * (sunlight.x - lightCamera.centerX)) / solarDepth,
    y: baselineY - height,
  };
}

interface MeshTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function meshBounds(positions: ArrayLike<number>, transform: MeshTransform): Bounds {
  const bounds = {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  };
  for (let index = 0; index < positions.length; index += 2) {
    const x = transform.x + positions[index] * transform.scaleX;
    const y = transform.y + positions[index + 1] * transform.scaleY;
    bounds.left = Math.min(bounds.left, x);
    bounds.top = Math.min(bounds.top, y);
    bounds.right = Math.max(bounds.right, x);
    bounds.bottom = Math.max(bounds.bottom, y);
  }
  return bounds;
}

export function meshCentroid(positions: ArrayLike<number>) {
  let x = 0;
  let y = 0;
  for (let index = 0; index < positions.length; index += 2) {
    x += positions[index];
    y += positions[index + 1];
  }
  const vertexCount = positions.length / 2;
  return { x: x / vertexCount, y: y / vertexCount };
}
