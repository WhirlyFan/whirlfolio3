import { Container, MeshPlane, Rectangle, Sprite } from 'pixi.js';
import { placement, sceneSize, type loadArtwork } from './assets';
import { curtainOffset, type MotionClock } from './motion';
import type { RoomAction } from '../types';
import { createAmbient, type AmbientState } from './ambient';
import { createLighting } from './lighting';
import { createDiscovery } from './discovery';
import { createSleeper } from './sleeper';
import { createSeatedShadow } from './seated-shadow';
import { createTripod } from './props';
import { createFan } from './fan';

export interface PaintedTarget {
  id: RoomAction;
  label: string;
  x: number;
  y: number;
  area: Rectangle;
}

/** Assemble independently drawn parts; no clock, DOM or renderer ownership here. */
export function createPaintedScene(textures: Awaited<ReturnType<typeof loadArtwork>>['textures']) {
  const container = new Container();
  // Keyboard/rest, ball, Icarus, guitar and grounded surfaces share one painting.
  const background = new Sprite({ texture: textures.background, label: 'room-static-background' });
  background.width = sceneSize.width;
  background.height = sceneSize.height;
  container.addChild(background);
  const lighting = createLighting(textures.floorReceiver);
  container.addChild(lighting.container);
  const ambient = createAmbient(textures);
  container.addChild(ambient.container);
  const plantReceivers = ['floor', 'desk', 'desk', 'floor', 'desk'] as const;
  ambient.foliage.forEach((plant, index) => lighting.add(plant, plantReceivers[index], 0.7));
  ambient.outdoorFoliage.forEach((branch) => {
    lighting.add(branch, 'floor', 0.85);
    lighting.add(branch, 'desk', 0.85);
  });

  const curtain = new MeshPlane({ texture: textures.curtain, verticesX: 8, verticesY: 16 });
  curtain.position.set(placement.curtain.x, placement.curtain.y);
  curtain.scale.set(
    placement.curtain.width / textures.curtain.width,
    placement.curtain.height / textures.curtain.height,
  );
  const restVertices = curtain.geometry.positions.slice();
  container.addChild(curtain);
  lighting.add(curtain, 'floor', 0.8);
  const tripod = createTripod(textures.tripod);
  const tripodShade = tripod.getChildByLabel('tripod-cast-shadow')!;
  lighting.addProjectedShadow(tripodShade);
  container.addChild(tripod);

  const fan = createFan(textures.fan);
  const sleeper = createSleeper(textures.sleeper);
  ambient.outdoorFoliage.forEach((branch) => lighting.addMeshReceiver(sleeper.body, branch, 0.2));
  const seatedShadow = createSeatedShadow(sleeper.body);
  seatedShadow.update();
  container.addChild(seatedShadow.container, fan.container, sleeper.container);
  const discovery = createDiscovery(textures);
  container.addChild(discovery.container);

  const targets: PaintedTarget[] = [
    ...discovery.targets,
    {
      id: 'fan',
      label: 'Desk fan',
      x: placement.fan.x,
      y: placement.fan.y - 112,
      area: new Rectangle(
        fan.container.x,
        fan.container.y,
        placement.fan.width,
        placement.fan.width,
      ),
    },
  ];
  return {
    container,
    targets,
    update(clock: MotionClock, _projectsOpen: boolean, ambientState: AmbientState) {
      ambient.update(clock.elapsedSeconds, ambientState);
      sleeper.update(clock.elapsedSeconds, ambientState.fanSpeed);
      seatedShadow.update();
      fan.update(clock.fanAngle);
      const positions = curtain.geometry.positions;
      for (let i = 0; i < positions.length; i += 2) {
        const y = restVertices[i + 1] / textures.curtain.height;
        positions[i] = restVertices[i] + curtainOffset(y, clock.elapsedSeconds) / curtain.scale.x;
        positions[i + 1] = restVertices[i + 1];
      }
      curtain.geometry.getAttribute('aPosition').buffer.update();
      lighting.update();
    },
    dispose() {
      container.destroy({ children: true });
      lighting.dispose();
      discovery.dispose();
      ambient.dispose();
      fan.dispose();
      seatedShadow.dispose();
      sleeper.dispose();
    },
  };
}
