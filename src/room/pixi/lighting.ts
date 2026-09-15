import {
  BlurFilter,
  Container,
  Filter,
  GlProgram,
  Graphics,
  MeshPlane,
  Sprite,
  UniformGroup,
  type PlaneGeometry,
  type Texture,
} from 'pixi.js';
import { meshBounds, meshCentroid, projectSunShadow, sunlight } from './lighting-math';
import {
  floorReceiverOrigin,
  floorReceiverOutline,
  foregroundPieces,
  windowAperture,
} from './window-registration';

// Receiver coverage is room geometry, never a second independently painted sun stripe.
const receivers = {
  floor: {
    baselineY: 665,
    outline: floorReceiverOutline,
  },
  desk: {
    baselineY: 505,
    outline: [1048, 514, 1198, 514, 1442, 544, 1600, 598, 1600, 672, 1210, 592, 1114, 558],
  },
};
type Receiver = keyof typeof receivers;

// Outer opening in the original raster. Opaque sashes are subtracted using the
// EXACT same contours that restore visible window wood in front of garden foliage.
function projectWindowPolygon(polygon: number[], baselineY: number) {
  const projected: number[] = [];
  for (let i = 0; i < polygon.length; i += 2) {
    const point = projectSunShadow(
      { x: (polygon[i] * 1600) / 1672, y: (polygon[i + 1] * 900) / 941 },
      baselineY,
    );
    projected.push(point.x, point.y);
  }
  return projected;
}

const filterVertex = `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  out vec2 vFilterCoord;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;
  void main() {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
    vFilterCoord = aPosition;
  }
`;

const leafShadeFragment = `
  in vec2 vTextureCoord;
  in vec2 vFilterCoord;
  out vec4 finalColor;
  uniform sampler2D uTexture;
  uniform sampler2D uShadowTexture;
  uniform vec4 uReceiverBounds;
  uniform vec4 uSourceTransform;
  uniform vec2 uSourceSize;
  uniform vec2 uSun;
  uniform float uDepthScale;
  uniform vec4 uShadowFrame;
  uniform float uOpacity;
  void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    vec2 illustrationPoint = mix(uReceiverBounds.xy, uReceiverBounds.zw, vFilterCoord);
    vec2 sourcePoint = uSun + (illustrationPoint - uSun) / uDepthScale;
    vec2 sourceUv = (sourcePoint - uSourceTransform.xy)
      / (uSourceTransform.zw * uSourceSize);
    float inside = step(0.0, sourceUv.x) * step(sourceUv.x, 1.0)
      * step(0.0, sourceUv.y) * step(sourceUv.y, 1.0);
    vec2 shadowUv = uShadowFrame.xy + clamp(sourceUv, 0.0, 1.0) * uShadowFrame.zw;
    // A small penumbra softens leaf edges without blurring the character artwork.
    vec2 texel = vec2(3.0) * uShadowFrame.zw / uSourceSize;
    float leaf = texture(uShadowTexture, shadowUv).a * 0.4;
    leaf += texture(uShadowTexture, shadowUv + vec2(texel.x, 0.0)).a * 0.15;
    leaf += texture(uShadowTexture, shadowUv - vec2(texel.x, 0.0)).a * 0.15;
    leaf += texture(uShadowTexture, shadowUv + vec2(0.0, texel.y)).a * 0.15;
    leaf += texture(uShadowTexture, shadowUv - vec2(0.0, texel.y)).a * 0.15;
    vec2 frameEdge = min(sourceUv, vec2(1.0) - sourceUv);
    float frameFeather = smoothstep(0.0, 0.08, frameEdge.x)
      * smoothstep(0.0, 0.08, frameEdge.y);
    leaf *= inside * frameFeather;
    // The painting already owns broad body light. Apply only source alpha here:
    // clipping it against a binary aperture or mullion creates a vertical bar.
    color.rgb *= 1.0 - leaf * uOpacity;
    finalColor = color;
  }
`;

function createLeafShadeFilter(source: MeshPlane, opacity: number) {
  const texture = source.texture;
  const sourceWidth = texture.source.width;
  const sourceHeight = texture.source.height;
  const uniforms = new UniformGroup({
    uReceiverBounds: { value: new Float32Array(4), type: 'vec4<f32>' },
    uSourceTransform: {
      value: new Float32Array([source.x, source.y, source.scale.x, source.scale.y]),
      type: 'vec4<f32>',
    },
    uSourceSize: {
      value: new Float32Array([texture.width, texture.height]),
      type: 'vec2<f32>',
    },
    uSun: { value: new Float32Array([sunlight.x, sunlight.y]), type: 'vec2<f32>' },
    uDepthScale: { value: 1.25, type: 'f32' },
    uShadowFrame: {
      value: new Float32Array([
        texture.frame.x / sourceWidth,
        texture.frame.y / sourceHeight,
        texture.frame.width / sourceWidth,
        texture.frame.height / sourceHeight,
      ]),
      type: 'vec4<f32>',
    },
    uOpacity: { value: opacity, type: 'f32' },
  });
  const filter = new Filter({
    glProgram: GlProgram.from({
      name: 'source-linked-leaf-shade',
      vertex: filterVertex,
      fragment: leafShadeFragment,
    }),
    resources: {
      leafShadeUniforms: uniforms,
      uShadowTexture: texture.source,
    },
    resolution: 1,
    clipToViewport: false,
  });
  return { filter, uniforms };
}

/** Re-project the actual deformed cutout; shadows cannot drift onto a separate motion clock. */
export function createLighting(floorReceiverTexture?: Texture) {
  const container = new Container();
  const filters: BlurFilter[] = [];
  const surfaces = Object.fromEntries(
    Object.entries(receivers).map(([name, receiver]) => {
      const surface = new Container();
      surface.label = `${name}-window-light`;
      // This local filter also isolates erasure: occluders remove direct light,
      // never the already-painted room pixels beneath the group.
      const softEdge = new BlurFilter({ strength: 1.6, quality: 1, resolution: 1 });
      surface.filters = [softEdge];
      filters.push(softEdge);
      surface.addChild(
        new Graphics()
          .poly(projectWindowPolygon(windowAperture, receiver.baselineY))
          .fill({ color: 0xffe5ae, alpha: name === 'floor' ? 0.52 : 0.4 }),
      );
      const frame = new Graphics();
      for (const polygon of foregroundPieces)
        frame.poly(projectWindowPolygon(polygon, receiver.baselineY)).fill(0xffffff);
      frame.blendMode = 'erase';
      surface.addChild(frame);
      // The painting's near-camera leaves are baked into its base. A registered
      // offline matte excludes their soft edges as well as vertical furniture;
      // later live objects still occlude light naturally through scene order.
      const mask =
        name === 'floor' && floorReceiverTexture
          ? new Sprite(floorReceiverTexture)
          : new Graphics().poly(receiver.outline).fill(0xffffff);
      if (mask instanceof Sprite) {
        mask.scale.set(1600 / 1672, 900 / 941);
        mask.position.set(
          floorReceiverOrigin.x * mask.scale.x,
          floorReceiverOrigin.y * mask.scale.y,
        );
      }
      // Texture colors are premultiplied by loadArtwork. Read only alpha so
      // soft coverage is not multiplied into both red and alpha (squared).
      if (mask instanceof Sprite) surface.setMask({ mask, channel: 'alpha' });
      else surface.mask = mask;
      container.addChild(surface, mask);
      return [name, surface];
    }),
  ) as Record<Receiver, Container>;
  const casters: { source: MeshPlane; shadow: MeshPlane; receiver: Receiver }[] = [];
  const meshReceivers: {
    receiver: MeshPlane;
    source: MeshPlane;
    filter: Filter;
    uniforms: UniformGroup;
    restCentroid: { x: number; y: number };
    depthScale: number;
  }[] = [];

  return {
    container,
    add(source: MeshPlane, receiver: Receiver, opacity: number) {
      const geometry = source.geometry as PlaneGeometry;
      const shadow = new MeshPlane({
        texture: source.texture,
        verticesX: geometry.verticesX,
        verticesY: geometry.verticesY,
      });
      shadow.tint = 0x000000;
      shadow.alpha = opacity;
      shadow.blendMode = 'erase';
      surfaces[receiver].addChild(shadow);
      casters.push({ source, shadow, receiver });
    },
    /** Already-projected room-coordinate geometry, such as the three-foot tripod proxy. */
    addProjectedShadow(shadow: Container, receiver: Receiver = 'floor') {
      shadow.blendMode = 'erase';
      surfaces[receiver].addChild(shadow);
    },
    /** Shade the receiver's rendered pixels; its deformed texture alpha remains the clip boundary. */
    addMeshReceiver(receiver: MeshPlane, source: MeshPlane, opacity: number, depthScale = 1.25) {
      const { filter, uniforms } = createLeafShadeFilter(source, opacity);
      receiver.filters = [...(receiver.filters ?? []), filter];
      meshReceivers.push({
        receiver,
        source,
        filter,
        uniforms,
        restCentroid: meshCentroid(source.geometry.positions),
        depthScale,
      });
    },
    update() {
      for (const { source, shadow, receiver } of casters) {
        const sourcePoints = source.geometry.positions;
        const shadowPoints = shadow.geometry.positions;
        for (let i = 0; i < sourcePoints.length; i += 2) {
          // Curtain and foliage containers use the shared illustration coordinate space.
          const point = projectSunShadow(
            {
              x: source.x + sourcePoints[i] * source.scale.x,
              y: source.y + sourcePoints[i + 1] * source.scale.y,
            },
            receivers[receiver].baselineY,
          );
          shadowPoints[i] = point.x;
          shadowPoints[i + 1] = point.y;
        }
        shadow.geometry.getAttribute('aPosition').buffer.update();
      }
      for (const { receiver, source, uniforms, restCentroid, depthScale } of meshReceivers) {
        const receiverBounds = meshBounds(receiver.geometry.positions, {
          x: receiver.x,
          y: receiver.y,
          scaleX: receiver.scale.x,
          scaleY: receiver.scale.y,
        });
        const receiverUniform = uniforms.uniforms.uReceiverBounds as Float32Array;
        const sourceUniform = uniforms.uniforms.uSourceTransform as Float32Array;
        const currentCentroid = meshCentroid(source.geometry.positions);
        receiverUniform.set([
          receiverBounds.left,
          receiverBounds.top,
          receiverBounds.right,
          receiverBounds.bottom,
        ]);
        sourceUniform.set([
          source.x + (currentCentroid.x - restCentroid.x) * source.scale.x,
          source.y + (currentCentroid.y - restCentroid.y) * source.scale.y,
          source.scale.x,
          source.scale.y,
        ]);
        uniforms.uniforms.uDepthScale = depthScale;
      }
    },
    dispose() {
      filters.forEach((filter) => filter.destroy());
      meshReceivers.forEach(({ receiver, filter }) => {
        if (!receiver.destroyed)
          receiver.filters = receiver.filters?.filter((item) => item !== filter);
        filter.destroy();
      });
    },
  };
}
