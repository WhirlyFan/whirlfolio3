export interface PanAxes {
  x: boolean;
  y: boolean;
}

// Ignore subpixel cover-fit rounding, not an actual offscreen portion of the room.
const MIN_PAN_OVERFLOW_PX = 1;

export function getPanAxes(
  width: number,
  height: number,
  sceneWidth: number,
  sceneHeight: number,
): PanAxes {
  const { scale } = fitScene(width, height, sceneWidth, sceneHeight);
  return {
    x: sceneWidth * scale - width > MIN_PAN_OVERFLOW_PX,
    // Exploration is horizontal-only; vertical framing belongs to reading transitions.
    y: false,
  };
}

export function fitScene(
  width: number,
  height: number,
  sceneWidth: number,
  sceneHeight: number,
): { scale: number; x: number; y: number } {
  const scale = Math.max(width / sceneWidth, height / sceneHeight);
  return { scale, x: (width - sceneWidth * scale) / 2, y: (height - sceneHeight * scale) / 2 };
}

/** Keep a cover-fit camera within the painted image at any viewport size/zoom. */
export function constrainCenter(
  point: { x: number; y: number },
  width: number,
  height: number,
  scale: number,
  sceneWidth: number,
  sceneHeight: number,
) {
  const halfWidth = Math.min(sceneWidth / 2, width / scale / 2);
  const halfHeight = Math.min(sceneHeight / 2, height / scale / 2);
  return {
    x: Math.max(halfWidth, Math.min(sceneWidth - halfWidth, point.x)),
    y: Math.max(halfHeight, Math.min(sceneHeight - halfHeight, point.y)),
  };
}
