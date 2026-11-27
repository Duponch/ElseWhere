import { attribute, float, instanceIndex, uv, varying, vec2 } from 'three/tsl';
import type * as THREE from 'three/webgpu';

// Crop different regions of the same painted map. Staying inside [0, 1]
// avoids a visible wrapping seam on the broad faces of planks and furniture.
export const PATTERN_SPAN = 0.68;
const PHASE_SPAN = 1 - PATTERN_SPAN;

/** UV axes on the six box faces follow X/Z, X/Y or Z/Y. Fit the same painted
 * crop to the longer physical edge and take proportionally less of it along
 * the shorter one. Both coordinates stay inside the original clamp-safe crop. */
export function physicalPatternSpan(sx:number,sy:number,sz:number,nx:number,ny:number):readonly [number,number] {
  const u=Math.abs(nx)*sz+(1-Math.abs(nx))*sx;
  const v=Math.abs(ny)*sz+(1-Math.abs(ny))*sy;
  const longest=Math.max(u,v,1e-6);
  return [PATTERN_SPAN*u/longest,PATTERN_SPAN*v/longest];
}

/** Calculate the shifted UV in the vertex stage and interpolate it, so the
 * fragment shader still performs just one texture lookup and no extra math.
 * The instance index is already available in the existing instanced draw. */
export function instancedPatternUv() {
  const seed = float(instanceIndex);
  return varying(uv().mul(PATTERN_SPAN).add(vec2(
    seed.mul(0.61803398875).fract(),
    seed.mul(0.41421356237).fract(),
  ).mul(PHASE_SPAN)));
}

/** The existing box transform already contains its physical scale. Derive
 * face spans in the vertex stage; no instance attribute or fragment sample is
 * added, and the same untextured pipeline is still selected when disabled. */
export function instancedBoxFaceSpan(normal:THREE.Node<'vec3'>=attribute('normal','vec3')):THREE.Node<'vec2'> {
  const sx=attribute('boxMatrix0','vec4').xyz.length();
  const sy=attribute('boxMatrix1','vec4').xyz.length();
  const sz=attribute('boxMatrix2','vec4').xyz.length();
  const facing=normal.abs();
  const u=sx.mul(facing.x.oneMinus()).add(sz.mul(facing.x));
  const v=sy.mul(facing.y.oneMinus()).add(sz.mul(facing.y));
  // Keep this expression lazy. A global VarNode here is initialized when
  // Three queries a fragment output's type and would pull item vertex storage
  // into a dead fragment load, even though the final UV itself is varying.
  return vec2(u,v);
}
export function instancedBoxPatternUv(physicalSpan:THREE.Node<'vec2'>=instancedBoxFaceSpan()) {
  const seed=float(instanceIndex);
  const longest=physicalSpan.x.max(physicalSpan.y).max(1e-6);
  const span=physicalSpan.div(longest).mul(PATTERN_SPAN);
  const phase=vec2(seed.mul(0.61803398875).fract(),seed.mul(0.41421356237).fract()).mul(PHASE_SPAN);
  return varying(uv().sub(.5).mul(span).add(PATTERN_SPAN*.5).add(phase));
}
