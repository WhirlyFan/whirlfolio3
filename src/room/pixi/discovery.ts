import {
  CanvasSource,
  Container,
  Graphics,
  PerspectiveMesh,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js';
import type { PaintedTarget } from './scene';
import { sourceQuadToScene, sourceToScene, type FlatQuad } from './surface-registration';

const monitor = {
  area: new Rectangle(1368, 353, 201, 188),
  // Inner bezel retraced on v7. The lamp hides the inferred top-right corner.
  corners: sourceQuadToScene([1449, 376, 1644, 364, 1619, 559, 1431, 528]),
};

const photoFrames = [
  {
    // Middle frame's blank opening; the surrounding pale mat remains painted.
    corners: sourceQuadToScene([1519, 204, 1590, 185, 1590, 326, 1519, 336]),
    focusX: 0.5,
  },
  {
    // Right frame continues beyond the v7 image; fill only its visible blank opening.
    corners: sourceQuadToScene([1626, 151, 1672, 138, 1672, 272, 1626, 280]),
    focusX: 0.45,
  },
];

// Original lamp-shade silhouette traced on the current v7 source. Repainting these pixels over
// the projected screen keeps the shade in front without introducing a replacement art layer.
const lampShadeOcclusion = sourceToScene([
  1672, 296, 1665, 302, 1659, 311, 1658, 329, 1650, 330, 1645, 340, 1637, 340, 1626, 345, 1617, 353,
  1609, 363, 1603, 373, 1597, 378, 1598, 383, 1603, 389, 1612, 395, 1623, 400, 1638, 405, 1654, 409,
  1672, 412,
]);
// The small painted desk leaf also crosses the display, independently of animated foliage.
const deskLeafOcclusion = sourceToScene([
  1608, 511, 1614, 501, 1619, 499, 1619, 496, 1624, 493, 1633, 493, 1635, 491, 1640, 491, 1643, 493,
  1648, 497, 1650, 512, 1642, 510, 1635, 512, 1627, 508, 1624, 506, 1616, 509,
]);

function cropForFrame(texture: Texture, corners: readonly number[], focusX: number) {
  const width =
    (Math.hypot(corners[2] - corners[0], corners[3] - corners[1]) +
      Math.hypot(corners[4] - corners[6], corners[5] - corners[7])) /
    2;
  const height =
    (Math.hypot(corners[6] - corners[0], corners[7] - corners[1]) +
      Math.hypot(corners[4] - corners[2], corners[5] - corners[3])) /
    2;
  const cropWidth = Math.min(texture.width, texture.height * (width / height));
  const centerX = texture.width * focusX;
  const x = Math.max(0, Math.min(texture.width - cropWidth, centerX - cropWidth / 2));
  return new Texture({
    source: texture.source,
    frame: new Rectangle(x, 0, cropWidth, texture.height),
  });
}

function createPerspectiveSurface(texture: Texture, corners: FlatQuad) {
  const surface = new PerspectiveMesh({ texture, verticesX: 8, verticesY: 8 });
  surface.setCorners(...corners);
  return surface;
}

function createScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 480;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Monitor surface unavailable');
  const wash = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, '#3d594b');
  wash.addColorStop(1, '#263c34');
  context.fillStyle = wash;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff8dc';
  context.font = 'italic 42px Georgia, serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Explore my work →', canvas.width / 2, canvas.height / 2);
  return {
    canvas,
    texture: new Texture({
      source: new CanvasSource({ resource: canvas, label: 'project-monitor-surface' }),
    }),
  };
}

/** Static room cues. The parent owns display objects; this module owns only texture slices. */
export function createDiscovery(textures: {
  background?: Texture;
  gull: Texture;
  dovePhoto: Texture;
}): {
  container: Container;
  targets: PaintedTarget[];
  dispose(): void;
} {
  const container = new Container();

  const screenResource = createScreenTexture();
  container.addChild(createPerspectiveSurface(screenResource.texture, monitor.corners));

  const photoTextures = [
    cropForFrame(textures.dovePhoto, photoFrames[0].corners, photoFrames[0].focusX),
    cropForFrame(textures.gull, photoFrames[1].corners, photoFrames[1].focusX),
  ];
  photoFrames.forEach((frame, index) => {
    container.addChild(createPerspectiveSurface(photoTextures[index], frame.corners));
  });

  if (textures.background) {
    const originalArtOcclusion = new Sprite(textures.background);
    originalArtOcclusion.width = 1600;
    originalArtOcclusion.height = 900;
    const occlusionMask = new Graphics()
      .poly(lampShadeOcclusion)
      .fill(0xffffff)
      .poly(deskLeafOcclusion)
      .fill(0xffffff);
    originalArtOcclusion.mask = occlusionMask;
    container.addChild(originalArtOcclusion, occlusionMask);
  }

  const targets: PaintedTarget[] = [
    {
      id: 'projects',
      label: 'Projects',
      x: 1460,
      y: 494,
      area: monitor.area,
    },
    {
      id: 'photography',
      label: 'Bird photography',
      x: 1510,
      y: 308,
      area: new Rectangle(1445, 124, 155, 205),
    },
  ];

  return {
    container,
    targets,
    dispose() {
      photoTextures.forEach((texture) => texture.destroy(false));
      screenResource.texture.destroy(true);
      screenResource.canvas.width = 0;
      screenResource.canvas.height = 0;
    },
  };
}
