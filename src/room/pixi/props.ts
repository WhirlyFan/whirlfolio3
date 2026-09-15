import { Container, Graphics, MeshPlane, Sprite, type Texture } from 'pixi.js';
import { projectSunShadow } from './lighting-math';
/** Approved camera/tripod painting; all three feet sit on the window-side floor. */
export function createTripod(texture: Texture) {
  const container = new Container({ label: 'tripod-camera' });
  const camera = new Sprite(texture);
  camera.position.set(720, 339);
  camera.width = 180;
  camera.height = 398;
  const cast = new Container({ label: 'tripod-cast-shadow' });
  const silhouette = new MeshPlane({ texture, verticesX: 25, verticesY: 37 });
  silhouette.tint = 0x30281f;
  silhouette.alpha = 0.62;
  const positions = silhouette.geometry.positions;
  for (let i = 0; i < positions.length; i += 2) {
    const x = camera.x + positions[i] * camera.scale.x;
    const y = camera.y + positions[i + 1] * camera.scale.y;
    // The back leg lands farther away. Blend its floor depth into the near
    // feet's depth, keeping the actual three contact locations fixed.
    const footSpan = x < 806 ? 74 : 82;
    const nearDepth = x < 806 ? 724 : 720;
    const feetDepth = 670 + (nearDepth - 670) * Math.min(1, Math.abs(x - 806) / footSpan);
    const legWeight = Math.min(1, Math.max(0, (y - 470) / 145));
    const baselineY = 707 * (1 - legWeight) + feetDepth * legWeight;
    const point = projectSunShadow({ x, y }, baselineY);
    positions[i] = point.x;
    positions[i + 1] = point.y;
  }
  silhouette.geometry.getAttribute('aPosition').buffer.update();
  cast.addChild(silhouette);
  const contacts = new Graphics()
    .ellipse(732, 724, 10, 2.5)
    .ellipse(806, 670, 7, 1.5)
    .ellipse(888, 720, 10, 2.5)
    .fill({ color: 0x503d26, alpha: 0.24 });
  container.addChild(cast, contacts, camera);
  return container;
}
