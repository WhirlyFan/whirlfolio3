import { Container, Filter, GlProgram, Sprite, Texture, UniformGroup } from 'pixi.js';
import { placement } from './assets';
import { fanRotorProjection } from './fan-projection';

const FAN_CANVAS_SIZE = 640;
const FAN_OPAQUE_BOTTOM = 590;

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

const fanFragment = `
  in vec2 vTextureCoord;
  in vec2 vFilterCoord;
  out vec4 finalColor;
  uniform sampler2D uTexture;
  uniform float uAngleRadians;
  uniform vec2 uRotorCenter;
  uniform vec2 uRotorBasisX;
  uniform vec2 uRotorBasisY;
  uniform vec2 uRotorPerspective;
  float ovalDistance(vec2 point, vec2 center, vec2 radii) {
    return length((point - center) / radii);
  }
  void main() {
    vec4 source = texture(uTexture, vTextureCoord);
    float alpha = source.a;
    vec3 original = source.rgb / max(alpha, 0.001);

    // Invert the fan-plane homography before rotating. This keeps the three
    // blades circular around the offset hub in their own plane, then projects
    // them into the logo's wider-right, tilted opening.
    vec2 screenOffset = vFilterCoord - uRotorCenter;
    float determinant = uRotorBasisX.x * uRotorBasisY.y
      - uRotorBasisY.x * uRotorBasisX.y;
    vec2 perspectiveRay = vec2(
      (screenOffset.x * uRotorBasisY.y - uRotorBasisY.x * screenOffset.y) / determinant,
      (uRotorBasisX.x * screenOffset.y - screenOffset.x * uRotorBasisX.y) / determinant
    );
    vec2 planePoint = perspectiveRay
      / max(1.0 - dot(uRotorPerspective, perspectiveRay), 0.001);
    float cosine = cos(uAngleRadians);
    float sine = sin(uAngleRadians);
    vec2 rotorPoint = vec2(
      cosine * planePoint.x + sine * planePoint.y,
      -sine * planePoint.x + cosine * planePoint.y
    );
    float radius = length(rotorPoint);
    float curvedAngle = atan(rotorPoint.y, rotorPoint.x) + radius * 0.72;
    float bladeThreshold = mix(0.62, -0.08, smoothstep(0.24, 0.82, radius));
    float blade = smoothstep(bladeThreshold - 0.08, bladeThreshold + 0.08, cos(curvedAngle * 3.0));
    float rotorDisk = smoothstep(0.21, 0.25, radius) * (1.0 - smoothstep(0.87, 0.91, radius));

    // The fixed grille, face and casing are darker/more saturated than the
    // blade-free ivory backing, so replacement is naturally limited to holes
    // behind them without redrawing any identity feature.
    float ivory = smoothstep(0.82, 0.90, original.r)
      * smoothstep(0.86, 0.93, original.g)
      * smoothstep(0.91, 0.97, original.b)
      * (1.0 - smoothstep(0.16, 0.22, original.b - original.r));
    float hub = 1.0 - smoothstep(
      1.0,
      1.08,
      ovalDistance(vFilterCoord, uRotorCenter, vec2(0.080, 0.085))
    );
    float leftEye = 1.0 - smoothstep(
      1.15,
      1.25,
      ovalDistance(vFilterCoord, vec2(0.251, 0.370), vec2(0.038, 0.038))
    );
    float rightEye = 1.0 - smoothstep(
      1.15,
      1.25,
      ovalDistance(vFilterCoord, vec2(0.681, 0.370), vec2(0.038, 0.038))
    );
    float leftCheek = 1.0 - smoothstep(
      1.0,
      1.08,
      ovalDistance(vFilterCoord, vec2(0.238, 0.439), vec2(0.054, 0.032))
    );
    float rightCheek = 1.0 - smoothstep(
      1.0,
      1.08,
      ovalDistance(vFilterCoord, vec2(0.714, 0.439), vec2(0.054, 0.032))
    );
    float fixedFace = max(max(hub, leftEye), max(rightEye, max(leftCheek, rightCheek)));
    float movingBlade = rotorDisk * blade * ivory * (1.0 - fixedFace);
    vec3 bladeBlue = mix(vec3(0.76, 0.84, 0.97), vec3(0.82, 0.88, 0.98), radius * 0.45);
    vec3 animated = mix(original, bladeBlue, movingBlade * 0.88);
    finalColor = vec4(animated * alpha, alpha);
  }
`;

/** Keep the original WhirlyFan identity fixed; one projected three-blade rotor turns. */
export function createFan(texture: Texture) {
  const uniforms = new UniformGroup({
    uAngleRadians: { value: 0, type: 'f32' },
    uRotorCenter: {
      value: new Float32Array([fanRotorProjection.center.x, fanRotorProjection.center.y]),
      type: 'vec2<f32>',
    },
    uRotorBasisX: {
      value: new Float32Array([fanRotorProjection.basisX.x, fanRotorProjection.basisX.y]),
      type: 'vec2<f32>',
    },
    uRotorBasisY: {
      value: new Float32Array([fanRotorProjection.basisY.x, fanRotorProjection.basisY.y]),
      type: 'vec2<f32>',
    },
    uRotorPerspective: {
      value: new Float32Array([fanRotorProjection.perspective.x, fanRotorProjection.perspective.y]),
      type: 'vec2<f32>',
    },
  });
  const rotorFilter = new Filter({
    glProgram: GlProgram.from({
      name: 'original-whirlyfan-rotor',
      vertex: filterVertex,
      fragment: fanFragment,
    }),
    resources: {
      fanUniforms: uniforms,
    },
    resolution: 1,
    clipToViewport: false,
  });
  const container = new Container({ label: 'room-fan' });
  const fan = new Sprite(texture);
  fan.filters = [rotorFilter];
  container.addChild(fan);
  container.scale.set(placement.fan.width / FAN_CANVAS_SIZE);
  container.position.set(
    placement.fan.x - (FAN_CANVAS_SIZE / 2) * container.scale.x,
    placement.fan.y - FAN_OPAQUE_BOTTOM * container.scale.y,
  );

  return {
    container,
    update(angleRadians: number) {
      uniforms.uniforms.uAngleRadians = angleRadians;
    },
    dispose() {
      rotorFilter.destroy();
    },
  };
}
