import { BlurFilter, Container, Graphics, MeshPlane, type PlaneGeometry } from 'pixi.js';
import { projectSunShadow } from './lighting-math';

const illustrationSize = 550;
const floorDepthY = 860;
const floorClip = [800, 665, 1600, 665, 1600, 900, 800, 900];
const contactColor = 0x3f3024;

const contacts = [
  { label: 'chair-left-caster-contact', x: 94, y: 493, width: 30, height: 4 },
  { label: 'chair-center-contact', x: 236, y: 501, width: 24, height: 3 },
  { label: 'chair-right-caster-contact', x: 357, y: 493, width: 30, height: 4 },
  { label: 'far-sandal-contact', x: 393, y: 449, width: 60, height: 3.5 },
  { label: 'near-sandal-contact', x: 449, y: 484, width: 100, height: 4.5 },
] as const;

function contactShape(width: number, height: number) {
  return new Graphics()
    .moveTo(-width / 2, 0)
    .bezierCurveTo(-width / 3, -height, width / 3, -height, width / 2, 0)
    .bezierCurveTo(width / 3, height, -width / 3, height, -width / 2, 0)
    .closePath()
    .fill({ color: contactColor, alpha: 0.48 });
}

/** Actual joint alpha projected toward the floor, plus feature-registered contact slivers. */
export function createSeatedShadow(source: MeshPlane) {
  const container = new Container({ label: 'seated-floor-shadow' });
  const castGroup = new Container({ label: 'seated-directional-cast' });
  const castBlur = new BlurFilter({ strength: 3.5, quality: 1, resolution: 1 });
  castGroup.filters = [castBlur];
  const geometry = source.geometry as PlaneGeometry;
  const cast = new MeshPlane({
    texture: source.texture,
    verticesX: geometry.verticesX,
    verticesY: geometry.verticesY,
  });
  cast.label = 'seated-source-silhouette';
  cast.tint = contactColor;
  cast.alpha = 0.32;
  const clip = new Graphics().poly(floorClip).fill(0xffffff);
  castGroup.addChild(cast, clip);
  castGroup.mask = clip;

  const contactGroup = new Container({ label: 'seated-floor-contacts' });
  const contactBlur = new BlurFilter({ strength: 1.2, quality: 1, resolution: 1 });
  contactGroup.filters = [contactBlur];
  const contactLayers = contacts.map((contact) => {
    const layer = contactShape(contact.width, contact.height);
    layer.label = contact.label;
    contactGroup.addChild(layer);
    return { contact, layer };
  });
  container.addChild(castGroup, contactGroup);

  return {
    container,
    update() {
      const sourcePoints = source.geometry.positions;
      const castPoints = cast.geometry.positions;
      for (let index = 0; index < sourcePoints.length; index += 2) {
        const point = {
          x: source.x + sourcePoints[index] * source.scale.x,
          y: source.y + sourcePoints[index + 1] * source.scale.y,
        };
        const projected = projectSunShadow(point, floorDepthY);
        castPoints[index] = point.x + (projected.x - point.x) * 1.15;
        castPoints[index + 1] = floorDepthY + (projected.y - floorDepthY) * 0.18;
      }
      cast.geometry.getAttribute('aPosition').buffer.update();
      for (const { contact, layer } of contactLayers) {
        layer.position.set(
          source.x + (contact.x / illustrationSize) * source.texture.width * source.scale.x,
          source.y + (contact.y / illustrationSize) * source.texture.height * source.scale.y,
        );
      }
    },
    dispose() {
      castBlur.destroy();
      contactBlur.destroy();
    },
  };
}
