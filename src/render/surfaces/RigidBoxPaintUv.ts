/** Exact affine unit-box domain only. This moves the view-invariant physical
 * Jacobian out of each body fragment; Source pigment/KM and stroke stay intact.
 * Other models and positive effects retain the original fragment expression. */
import type * as THREE from 'three/webgpu';
import {Fn,If,attribute,float,modelWorldMatrix,uv,varying,vec2,vec3,vec4} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';

/** Constructor-only proof against the REAL primitive fields, not its name. */
export function assertUnitBoxPaintGeometry(geometry:THREE.BufferGeometry):void{
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),u=geometry.getAttribute('uv'),index=geometry.index,count=index?.count??p?.count??0;
 if(!p||!n||!u||count!==36)throw Error('Rigid paint requires the complete Source unit box');
 for(let at=0;at<count;at+=3){
  const ids=[0,1,2].map(i=>index?.getX(at+i)??at+i),normal=[n.getX(ids[0]!),n.getY(ids[0]!),n.getZ(ids[0]!)],axis=normal.findIndex(v=>Math.abs(v)===1);
  if(axis<0||normal.some((v,i)=>i!==axis&&v!==0)||ids.some(i=>[0,1,2].some(c=>n.getComponent(i,c)!==normal[c]||Math.abs(p.getComponent(i,c))!==.5)))throw Error('Rigid paint requires exact unit-box faces');
  const a=ids[0]!,b=ids[1]!,c=ids[2]!,du=u.getX(b)-u.getX(a),dv=u.getY(b)-u.getY(a),eu=u.getX(c)-u.getX(a),ev=u.getY(c)-u.getY(a),det=du*ev-dv*eu;
  if(Math.abs(det)<1e-20)throw Error('Rigid unit-box UV is singular');
  const tangent=[0,1,2].map(k=>((p.getComponent(b,k)-p.getComponent(a,k))*ev-(p.getComponent(c,k)-p.getComponent(a,k))*dv)/det),bitangent=[0,1,2].map(k=>((p.getComponent(c,k)-p.getComponent(a,k))*du-(p.getComponent(b,k)-p.getComponent(a,k))*eu)/det),expectedU=axis===0?[0,0,-normal[0]!]:[normal[2]===-1?-1:1,0,0],expectedV=axis===1?[0,0,-normal[1]!]:[0,1,0];
  if(tangent.some((v,k)=>Math.abs(v-expectedU[k]!)>1e-12)||bitangent.some((v,k)=>Math.abs(v-expectedV[k]!)>1e-12))throw Error('Rigid unit-box UV orientation changed');
 }
}

export function rigidBoxPaintInputs(context:GraphicsStyleContext,name:string){
 const raw=varying(uv(),`v_${name}FaceUv`),normal=attribute('normal','vec3'),x=attribute('boxMatrix0','vec4').xyz,y=attribute('boxMatrix1','vec4').xyz,z=attribute('boxMatrix2','vec4').xyz;
 const world=(vector:THREE.Node<'vec3'>)=>modelWorldMatrix.mul(vec4(vector,0)).xyz;
 const mapped=varying(Fn(()=>{
  const result=vec2(0).toVar();
  If(context.surfaceEncoding.greaterThan(0),()=>{
   // Source BoxGeometry's actual U/V directions, checked once above. Include
   // the object transform as well as the existing per-instance transform.
   const tangent=world(normal.x.abs().greaterThan(.5).select(z.mul(normal.x.negate()),x.mul(normal.z.equal(-1).select(-1,1)))),bitangent=world(normal.y.abs().greaterThan(.5).select(z.mul(normal.y.negate()),y)),a=tangent.length(),unit=tangent.div(a.max(1e-10)),c=unit.dot(bitangent),d=bitangent.sub(unit.mul(c)).length(),valid=a.greaterThan(1e-10).and(d.greaterThan(1e-10)),metric=valid.select(vec3(a.min(1e6),c.clamp(-1e6,1e6),d.min(1e6)),vec3(1,0,1)).toVar('rigidBoxVertexMetric'),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal();
   result.assign(vec2(uv().x.mul(metric.x).add(uv().y.mul(metric.y)),uv().y.mul(metric.z)).mul(density));
  });return result;
 })(),`v_${name}PigmentUv`);
 const pigment=Fn(()=>{
  // Keep Source's actual screen-UV singular-angle fallback, including the
  // relative1e-7 threshold. No 3D tangent/bitangent solve remains per pixel.
  const dx=raw.dFdx(),dy=raw.dFdy(),det=dx.x.mul(dy.y).sub(dx.y.mul(dy.x)),threshold=dx.length().mul(dy.length()).mul(1e-7).max(1e-30);
  return det.abs().greaterThan(threshold).select(mapped,raw);
 })();
 return{faceUv:raw,pigmentUv:pigment};
}
