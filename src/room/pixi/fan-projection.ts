export type FanPlanePoint = { x: number; y: number };

/** Project a front-facing unit rotor into the original logo's oblique opening. */
export const fanRotorProjection = {
  center: { x: 0.416, y: 0.375 },
  basisX: { x: 0.267, y: -0.006 },
  basisY: { x: 0.035, y: 0.275 },
  perspective: { x: -0.266, y: -0.027 },
};

export function projectRotorPoint(point: FanPlanePoint): FanPlanePoint {
  const { center, basisX, basisY, perspective } = fanRotorProjection;
  const denominator = 1 + perspective.x * point.x + perspective.y * point.y;
  return {
    x: center.x + (basisX.x * point.x + basisY.x * point.y) / denominator,
    y: center.y + (basisX.y * point.x + basisY.y * point.y) / denominator,
  };
}
