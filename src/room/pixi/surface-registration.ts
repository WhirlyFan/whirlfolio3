export type FlatQuad = readonly [number, number, number, number, number, number, number, number];

// v5–v9 share raster dimensions and registered interactive contours.
const sourceSize = { width: 1672, height: 941 };
const sceneSize = { width: 1600, height: 900 };

/** Convert source-raster measurements into the fixed illustration coordinate space. */
export function sourceToScene(points: readonly number[]): number[] {
  return points.map((coordinate, index) =>
    index % 2 === 0
      ? (coordinate / sourceSize.width) * sceneSize.width
      : (coordinate / sourceSize.height) * sceneSize.height,
  );
}

export function sourceQuadToScene(sourceQuad: FlatQuad): FlatQuad {
  return sourceToScene(sourceQuad) as unknown as FlatQuad;
}

// Existing photo/window traces retain their measured v5 geometry.
export const v5SourceToScene = sourceToScene;
export const v5SourceQuadToScene = sourceQuadToScene;
