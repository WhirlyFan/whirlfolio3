import { Container, Graphics, MeshPlane, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Quality } from '../policy';
import { placement, type loadArtwork } from './assets';
import { createWindowForeground } from './window-registration';
import { sourceToScene } from './surface-registration';
import { createBirdBehavior } from './bird-behavior';
import { birdFrames as birdRegistration, birdFrameWidth } from './bird-frames';
import {
  foliageOffset,
  maxMotes,
  moteCount,
  motePose,
  outdoorBranchOffset,
  trailingFoliageOffset,
} from './ambient-motion';

export interface AmbientState {
  fanSpeed: 0 | 1 | 2;
  width: number;
  quality: Quality;
}

/** Separable scenery only. The parent scene owns children; the loader owns bitmap sources. */
export function createAmbient(
  textures: Awaited<ReturnType<typeof loadArtwork>>['textures'],
  birdSeed?: number,
) {
  const container = new Container({ label: 'room-ambient' });
  // Outside foliage and its opaque window foreground precede every indoor plant.
  const gardenWindow = new Container();
  container.addChild(gardenWindow);
  // Authored atlas bounds are deliberately registered, not assumed to be a perfect grid.
  const foliageFrames = [new Rectangle(0, 0, 560, 512), new Rectangle(560, 0, 464, 512)].map(
    (frame) => new Texture({ source: textures.foliage.source, frame }),
  );
  const plants = placement.plants.map((plant) => {
    const texture = foliageFrames[plant.cell];
    const mesh = new MeshPlane({ texture, verticesX: 8, verticesY: 10 });
    const rootX = plant.cell === 0 ? 276 / 560 : 221 / 464;
    mesh.scale.set(plant.width / texture.width, plant.height / texture.height);
    mesh.position.set(plant.x - plant.width * rootX, plant.y - plant.height * 0.936);
    container.addChild(mesh);
    return { mesh, rest: mesh.geometry.positions.slice() };
  });

  const trailingFrames = [new Rectangle(0, 0, 512, 512), new Rectangle(512, 0, 512, 512)].map(
    (frame) => new Texture({ source: textures.trailing.source, frame }),
  );
  const [sillRootX, sillRootY] = sourceToScene([1104, 419]);
  const trailingPlacements = [
    { x: 1257, y: 5, width: 145, height: 205 },
    { x: sillRootX, y: sillRootY, width: 86, height: 150 },
  ];
  const trailingPlants = trailingPlacements.map((plant, index) => {
    const texture = trailingFrames[0];
    const mesh = new MeshPlane({ texture, verticesX: 8, verticesY: 12 });
    mesh.scale.set(plant.width / texture.width, plant.height / texture.height);
    mesh.position.set(plant.x, plant.y);
    if (index === 1) {
      mesh.scale.x *= -1;
      // Atlas stem junction (260,155), registered inside the actual v6 pot opening.
      mesh.x -= 260 * mesh.scale.x;
      mesh.y -= 155 * mesh.scale.y;
    }
    container.addChild(mesh);
    return { mesh, rest: mesh.geometry.positions.slice(), index };
  });

  // Stems emerge from soil behind the painted front lip; preserve the pot's curved face.
  const sillPot = new Sprite(textures.background);
  sillPot.width = 1600;
  sillPot.height = 900;
  const sillPotMask = new Graphics()
    .poly(
      sourceToScene([
        1078, 423, 1083, 425, 1098, 427, 1115, 425, 1133, 422, 1131, 447, 1125, 458, 1087, 460,
        1080, 447,
      ]),
    )
    .fill(0xffffff);
  sillPot.mask = sillPotMask;
  container.addChild(sillPot, sillPotMask);

  // The visible branch is the physical source of the moving garden dapple.
  const outdoorBranch = new MeshPlane({
    texture: trailingFrames[1],
    verticesX: 10,
    verticesY: 10,
  });
  outdoorBranch.scale.set(430 / 512, 330 / 512);
  outdoorBranch.position.set(838, 35);
  // Outer clip bounds the garden; the original angled frame is restored above it.
  const windowOpening = new Graphics().rect(429, 20, 777, 423).fill(0xffffff);
  outdoorBranch.mask = windowOpening;
  gardenWindow.addChild(outdoorBranch, windowOpening, createWindowForeground(textures.background));
  const outdoorBranchRest = outdoorBranch.geometry.positions.slice();

  const birdPose = createBirdBehavior(birdSeed);
  const birdFrames = birdRegistration.map(
    ({ rect }) =>
      new Texture({
        source: textures.bird.source,
        frame: new Rectangle(...rect),
      }),
  );
  const shadow = new Graphics().ellipse(0, 0, 17, 2.4).fill({ color: '#584d36', alpha: 0.18 });
  shadow.position.set(placement.bird.x + 3, placement.bird.y + 1);
  const bird = new Sprite({ texture: birdFrames[0], label: 'room-bird' });
  // Flight is outside the central opening; low wing tips must pass behind the sill.
  // Perched feet stay on its front edge, so only airborne poses use this clip.
  const birdFlightMask = new Graphics()
    .poly(sourceToScene([544, 39, 1130, 40, 1130, 456, 542, 458]))
    .fill(0xffffff);
  container.addChild(shadow, bird, birdFlightMask);
  birdFlightMask.visible = false;

  // Small geometry, allocated once; no particle engine, filters, or per-frame spawning.
  const motes = Array.from({ length: maxMotes }, (_, index) => {
    const radius = index % 3 === 0 ? 2.1 : 1.45;
    const mote = new Graphics()
      .circle(0, 0, radius * 1.7)
      .fill({ color: '#fff0cd', alpha: 0.16 })
      .circle(0, 0, radius)
      .fill('#fff0cd');
    container.addChild(mote);
    return mote;
  });

  return {
    container,
    foliage: [...plants, ...trailingPlants].map(({ mesh }) => mesh),
    outdoorFoliage: [outdoorBranch],
    update(timeSeconds: number, state: AmbientState) {
      plants.forEach(({ mesh, rest }, index) => {
        const positions = mesh.geometry.positions;
        for (let i = 0; i < positions.length; i += 2) {
          const y = rest[i + 1] / (512 * 0.936);
          positions[i] =
            rest[i] + foliageOffset(y, timeSeconds, index, state.fanSpeed) / mesh.scale.x;
        }
        mesh.geometry.getAttribute('aPosition').buffer.update();
      });
      trailingPlants.forEach(({ mesh, rest, index }) => {
        const positions = mesh.geometry.positions;
        for (let i = 0; i < positions.length; i += 2) {
          const x = rest[i] / 512;
          const y = rest[i + 1] / 512;
          const distanceFromRoot =
            index === 1
              ? Math.max(
                  0,
                  Math.min(1, (Math.hypot((x - 260 / 512) * 1.25, y - 155 / 512) - 0.17) / 0.7),
                )
              : Math.min(1, Math.hypot((x - 0.5) * 1.25, y));
          const offset = trailingFoliageOffset(distanceFromRoot, timeSeconds, index);
          positions[i] = rest[i] + offset.x / mesh.scale.x;
          positions[i + 1] = rest[i + 1] + offset.y / mesh.scale.y;
        }
        mesh.geometry.getAttribute('aPosition').buffer.update();
      });
      {
        const positions = outdoorBranch.geometry.positions;
        for (let i = 0; i < positions.length; i += 2) {
          const x = outdoorBranchRest[i] / 512;
          const y = outdoorBranchRest[i + 1] / 512;
          const distanceFromRoot = Math.min(1, Math.hypot(1 - x, y) / Math.SQRT2);
          const offset = outdoorBranchOffset(distanceFromRoot, timeSeconds);
          positions[i] = outdoorBranchRest[i] + offset.x / outdoorBranch.scale.x;
          positions[i + 1] = outdoorBranchRest[i + 1] + offset.y / outdoorBranch.scale.y;
        }
        outdoorBranch.geometry.getAttribute('aPosition').buffer.update();
      }
      const pose = birdPose(timeSeconds);
      bird.texture = birdFrames[pose.frame];
      bird.pivot.set(...birdRegistration[pose.frame].foot);
      const scale = (placement.bird.width / birdFrameWidth) * pose.scale;
      bird.scale.set(scale * pose.direction, scale * pose.breathScale);
      bird.rotation = pose.rotation;
      const flightMask = pose.flying ? birdFlightMask : null;
      if (bird.mask !== flightMask) bird.mask = flightMask;
      birdFlightMask.visible = pose.flying;
      bird.position.set(placement.bird.x + pose.x, placement.bird.y + pose.y);
      bird.alpha = pose.alpha;
      bird.visible = pose.visible;
      shadow.alpha = pose.visible ? Math.max(0, 1 + pose.y / 35) : 0;
      const count = moteCount(state.width, state.quality);
      motes.forEach((mote, index) => {
        mote.visible = index < count;
        if (!mote.visible) return;
        const pose = motePose(index, timeSeconds);
        mote.position.set(pose.x, pose.y);
        mote.alpha = pose.alpha;
      });
    },
    dispose() {
      // Parent destroys display objects first; these slices never own their shared sources.
      [...foliageFrames, ...trailingFrames, ...birdFrames].forEach((texture) =>
        texture.destroy(false),
      );
    },
  };
}
