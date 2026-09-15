import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { sceneSize } from './assets';

// Canonical contours measured on the coherent 1672×941 v7 source painting.
export const windowAperture = [471, 22, 1243, 20, 1240, 458, 468, 458];
// Source-space origin of the cropped 1470x291 floor matte. The crop avoids
// allocating texture memory for transparent upper walls/window.
export const floorReceiverOrigin = { x: 0, y: 650 };
// Broad floor plane for isolated lighting tests. The assembled room uses the
// versioned floorReceiver texture, registered to current static object/leaf edges.
// Live chair/tripod silhouettes are later layers, never stale notches in this plane.
export const floorReceiverOutline = [
  0, 900, 0, 850, 128, 780, 300, 662, 1086, 662, 1410, 749, 1410, 900,
];
export const foregroundPieces = [
  [445, 0, 1260, 0, 1260, 20, 1240, 20, 1148, 39, 1130, 25, 544, 25, 467, 18],
  [446, 459, 1260, 459, 1260, 480, 446, 481],
  [446, 0, 471, 18, 470, 460, 447, 467],
  [467, 17, 544, 24, 544, 37, 527, 37, 472, 27],
  [528, 31, 544, 25, 542, 458, 523, 458],
  [469, 441, 525, 440, 542, 451, 542, 461, 468, 462],
  [1130, 24, 1243, 0, 1244, 20, 1148, 39, 1130, 40],
  [1130, 24, 1148, 36, 1146, 441, 1130, 456],
  [1224, 25, 1243, 19, 1260, 0, 1260, 462, 1242, 462, 1223, 437],
  [1130, 439, 1147, 438, 1225, 424, 1242, 438, 1242, 462, 1130, 458],
];

/** Restore registered original paint above outside foliage, without redrawing the frame. */
export function createWindowForeground(backgroundTexture: Texture) {
  const container = new Container();
  const paint = new Sprite(backgroundTexture);
  paint.width = sceneSize.width;
  paint.height = sceneSize.height;
  const mask = new Graphics();
  for (const polygon of foregroundPieces) {
    mask
      .poly(
        polygon.map(
          (coordinate, index) =>
            coordinate * (index % 2 === 0 ? sceneSize.width / 1672 : sceneSize.height / 941),
        ),
      )
      .fill(0xffffff);
  }
  paint.mask = mask;
  container.addChild(paint, mask);
  return container;
}
