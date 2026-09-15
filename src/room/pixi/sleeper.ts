import { Container, MeshPlane, type Texture } from 'pixi.js';
import { seatedRoomOffset } from './sleeper-motion';

/** One transparent painting owns the complete person, cushion, chair and feet. */
export function createSleeper(texture: Texture) {
  const container = new Container({ label: 'seated-room' });
  const body = new MeshPlane({ texture, verticesX: 41, verticesY: 41 });
  body.label = 'sleeping-body';
  body.position.set(890, 396);
  body.scale.set(550 / texture.width, 550 / texture.height);
  const rest = body.geometry.positions.slice();
  container.addChild(body);
  return {
    container,
    body,
    // Artwork loader owns the texture; parent owns display objects.
    dispose() {},
    update(timeSeconds: number, fanSpeed: 0 | 1 | 2) {
      const positions = body.geometry.positions;
      for (let i = 0; i < positions.length; i += 2) {
        const offset = seatedRoomOffset(
          rest[i] * body.scale.x,
          rest[i + 1] * body.scale.y,
          timeSeconds,
          fanSpeed,
        );
        positions[i] = rest[i] + offset.x / body.scale.x;
        positions[i + 1] = rest[i + 1] + offset.y / body.scale.y;
      }
      body.geometry.getAttribute('aPosition').buffer.update();
    },
  };
}
