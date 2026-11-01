import type {Node} from 'three/webgpu';
import {Fn,faceDirection,float,normalView,positionView,vec2,vec3} from 'three/tsl';

export type PaintVector2=readonly [number,number];
export type PaintVector3=readonly [number,number,number];
/** Upper-triangular isometry: (u,v) -> (u*A+v*C,v*D). */
export type PaintMetric=readonly [a:number,c:number,d:number];
export const REFERENCE_PAINT_DENSITY=1;
const RELATIVE_UV_EPSILON=1e-7,ABSOLUTE_UV_EPSILON=1e-30,MIN_METRIC=1e-10,MAX_METRIC=1e6;

/** CPU counterpart of the fragment metric. The inputs are derivatives of the
 * actual rendered surface, after instancing, morphology and pose. No texture
 * pixels, canonical UVs or geometry buffers are changed by this mapping. */
export function paintMetricFromDerivatives(dpdx:PaintVector3,dpdy:PaintVector3,duvdx:PaintVector2,duvdy:PaintVector2):PaintMetric {
  const all=[...dpdx,...dpdy,...duvdx,...duvdy];if(!all.every(Number.isFinite))return [1,0,1];
  const det=duvdx[0]*duvdy[1]-duvdx[1]*duvdy[0],threshold=Math.max(ABSOLUTE_UV_EPSILON,Math.hypot(...duvdx)*Math.hypot(...duvdy)*RELATIVE_UV_EPSILON);
  if(Math.abs(det)<=threshold)return [1,0,1];
  const tangent=dpdx.map((value,i)=>(value*duvdy[1]-dpdy[i]!*duvdx[1])/det),bitangent=dpdy.map((value,i)=>(value*duvdx[0]-dpdx[i]!*duvdy[0])/det);
  const a=Math.hypot(...tangent);if(a<=MIN_METRIC||!Number.isFinite(a))return [1,0,1];
  const unit=tangent.map(value=>value/a),c=unit.reduce((sum,value,i)=>sum+value*bitangent[i]!,0),d=Math.hypot(...bitangent.map((value,i)=>value-unit[i]!*c));
  if(d<=MIN_METRIC||!Number.isFinite(c)||!Number.isFinite(d))return [1,0,1];
  return [Math.min(MAX_METRIC,a),Math.max(-MAX_METRIC,Math.min(MAX_METRIC,c)),Math.min(MAX_METRIC,d)];
}

/** Apply equally to a UV coordinate or its first screen derivative. Applying
 * the same metric to dUV avoids derivatives of the derivative-built metric. */
export function applyPaintMetric(uv:PaintVector2,metric:PaintMetric,density=REFERENCE_PAINT_DENSITY):[number,number] {
  return [(uv[0]*metric[0]+uv[1]*metric[1])*density,uv[1]*metric[2]*density];
}

/** Fragment-only: actual view-space lengths are invariant under rigid camera
 * and actor transforms. A triangle's Jacobian is constant, so this corrects
 * rectangular faces, shear, nonuniform instances and posed/morphed triangles
 * while retaining the original UV origin and brush direction. Share its result
 * between RGB and all three explicit bump probes; do not feed it through the
 * stock BumpMapNode's isolated forceUV contexts. */
export function physicalPaintMetric(rawUv:Node<'vec2'>,surfacePosition:Node<'vec3'>=positionView):Node<'vec3'> {
  return Fn(()=>{
    const dx=rawUv.dFdx().toVar(),dy=rawUv.dFdy().toVar(),px=surfacePosition.dFdx().toVar(),py=surfacePosition.dFdy().toVar();
    const determinant=dx.x.mul(dy.y).sub(dx.y.mul(dy.x)).toVar();
    const threshold=dx.length().mul(dy.length()).mul(RELATIVE_UV_EPSILON).max(ABSOLUTE_UV_EPSILON).toVar();
    const divisor=determinant.abs().max(threshold).mul(determinant.lessThan(0).select(float(-1),float(1)));
    const tangent=px.mul(dy.y).sub(py.mul(dx.y)).div(divisor).toVar(),bitangent=py.mul(dx.x).sub(px.mul(dy.x)).div(divisor).toVar();
    const a=tangent.length().toVar(),unit=tangent.div(a.max(MIN_METRIC)),c=unit.dot(bitangent).toVar(),d=bitangent.sub(unit.mul(c)).length().toVar();
    const valid=determinant.abs().greaterThan(threshold).and(a.greaterThan(MIN_METRIC)).and(d.greaterThan(MIN_METRIC));
    return valid.select(vec3(a.min(MAX_METRIC),c.clamp(-MAX_METRIC,MAX_METRIC),d.min(MAX_METRIC)),vec3(1,0,1));
  })();
}

export function applyPhysicalPaintMetric(uv:Node<'vec2'>,metric:Node<'vec3'>,density:number|Node<'float'>=REFERENCE_PAINT_DENSITY):Node<'vec2'> {
  return vec2(uv.x.mul(metric.x).add(uv.y.mul(metric.y)),uv.y.mul(metric.z)).mul(density);
}

/** Pinned Three r186 forward-height response, with explicit samples so the
 * surface metric is shared rather than rebuilt inside isolated UV contexts. */
export function referencePaintBumpNormal(h0:Node<'float'>,hx:Node<'float'>,hy:Node<'float'>,scale:Node<'float'>):Node<'vec3'> {
  return Fn(()=>{
    const dH=vec2(hx.sub(h0),hy.sub(h0)).mul(scale).toVar();
    const sx=positionView.dFdx().normalize(),sy=positionView.dFdy().normalize(),n=normalView;
    const r1=sy.cross(n),r2=n.cross(sx),det=sx.dot(r1).mul(faceDirection);
    const gradient=det.sign().mul(dH.x.mul(r1).add(dH.y.mul(r2)));
    return det.abs().mul(n).sub(gradient).normalize();
  })();
}
