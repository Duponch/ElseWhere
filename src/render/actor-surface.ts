import * as THREE from 'three/webgpu';
import { float, mix, positionGeometry, texture, vec2 } from 'three/tsl';

export const PAWN_SURFACE = {
  horizontalScale: 2,
  depthShift: .2,
  verticalScale: 1.5,
  verticalOffset: -.75,
  grayPivot: .86,
  grayGain: 1.6,
  grayBase: .91,
  minShade: .74,
  maxShade: 1.02,
} as const;

/** A broad pigment wash in bind-space. The varying is made from the existing
 * position attribute, so rigging moves each painted vertex without sliding
 * the pattern across the actor or adding a WebGPU vertex attribute. */
export function actorSurfaceShade(map: THREE.Texture) {
  const p = positionGeometry;
  const coordinates = vec2(p.x.add(p.z.mul(.32)).mul(.58).add(.5), p.y.mul(.55).add(.08));
  return mix(float(1), texture(map, coordinates).r, float(.38));
}

/** Cover most of the visible torso with two broad irregular regions. The
 * grayscale wash scales all RGB channels equally, retaining identity hues. */
export function pawnSurfaceUvNode() {
  const p = positionGeometry, settings = PAWN_SURFACE;
  return vec2(
    p.x.add(p.z.mul(settings.depthShift)).mul(settings.horizontalScale).add(.5),
    p.y.mul(settings.verticalScale).add(settings.verticalOffset),
  );
}
export function pawnSurfaceShadeFromSample(sample:THREE.Node<'vec4'>) {
  const settings=PAWN_SURFACE;
  return sample.r.sub(settings.grayPivot).mul(settings.grayGain)
    .add(settings.grayBase).clamp(settings.minShade, settings.maxShade);
}
export function pawnSurfaceShade(map: THREE.Texture) {
  return pawnSurfaceShadeFromSample(texture(map,pawnSurfaceUvNode()));
}
