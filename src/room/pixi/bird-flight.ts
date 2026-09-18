// Cubic control points relative to the sill. All three corridors stay in the garden.
// Deliberate curves keep the bird away from the window trim and indoor objects.
export const birdFlightRoutes = [
  {
    name: 'sweep-left',
    control: [
      [-70, -165],
      [-220, -100],
      [-350, -210],
    ],
  },
  {
    name: 'high-climb',
    control: [
      [-20, -110],
      [-95, -230],
      [-155, -320],
    ],
  },
  {
    name: 'curve-right',
    control: [
      [55, -100],
      [120, -180],
      [145, -260],
    ],
  },
] as const;

export function sampleBirdFlight(route: number, progress: number, returning: boolean) {
  const t = progress * progress * (3 - 2 * progress);
  const u = 1 - t;
  const [a, b, c] = birdFlightRoutes[route].control;
  const coordinate = (axis: 0 | 1) =>
    3 * u * u * t * a[axis] + 3 * u * t * t * b[axis] + t * t * t * c[axis];
  const tangent = (axis: 0 | 1) =>
    3 * u * u * a[axis] + 6 * u * t * (b[axis] - a[axis]) + 3 * t * t * (c[axis] - b[axis]);
  const dx = tangent(0);
  const direction = (dx < 0 ? 1 : -1) * (returning ? -1 : 1);
  // The illustration faces left. A small pitch follows the curve without rotating it rigidly.
  const rotation =
    Math.max(-0.26, Math.min(0.26, Math.atan(tangent(1) / dx))) * Math.sin(Math.PI * t);
  const fade = Math.max(0, Math.min(1, (progress - 0.7) / 0.3));
  return {
    x: t ? coordinate(0) : 0,
    y: t ? coordinate(1) : 0,
    direction,
    rotation: t ? rotation : 0,
    scale: 1 - 0.8 * t,
    alpha: 1 - fade * fade * (3 - 2 * fade),
  };
}
