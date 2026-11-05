/** Generated from the canonical Source stroke kernel. Only triangle lookup
 * changes; physical metric/gradients/P512/dry/order/premult/lighting stay Source.
 * CPU inverse f32/FMA must be checked against actual GPU before promotion. */
import type * as THREE from'three/webgpu';
import{Fn,If,Loop,float,int,mix,positionView,varying,vec2,vec3,vec4}from'three/tsl';
import type{FaceStrokeNodeOptions}from'./FaceStrokeTable';
import type{AffineStrokeOwner}from'./AffineStrokeOwner';
export interface AffineStrokeNodeOptions extends Omit<FaceStrokeNodeOptions,'table'|'readRow'|'width'|'irregularity'>{readonly owner:AffineStrokeOwner}
const HEADER_ROWS=2,EDGE_ROWS=9,stripTriangles=[[0,2,3],[0,3,1],[2,4,5],[2,5,3]]as const;
export function queryPreparedAffineCoverage(options:AffineStrokeNodeOptions):THREE.Node<'vec4'> {
 options.owner.assertReady();const face=varying(options.faceId,'v_surfaceStrokeFace').setInterpolation('flat','first'),uv=Reflect.get(options.faceUv,'isVaryingNode')===true?options.faceUv:varying(options.faceUv,'v_surfaceStrokeUv'),read=options.owner.readRow;
 return Fn(()=>{
  const result=vec4(0).toVar();
  // This caller-supplied switch is uniform (texture encoding × line opacity).
  // Pastel/zero ink execute no derivatives, SSBO reads or texture operations.
  If(options.enabled.greaterThan(0).and(options.opacity.greaterThan(0)),()=>{
   const dx=uv.dFdx().toVar(),dy=uv.dFdy().toVar(),px=(options.surfacePosition??positionView).dFdx().toVar(),py=(options.surfacePosition??positionView).dFdy().toVar(),first=int(face).mul(HEADER_ROWS),header=options.headers?.[0]??read(first),info=options.headers?.[1]??read(first.add(1)),distance=float(0).toVar(),span=info.xy.sub(header.zw),relative=uv.sub(header.zw),scale=span.x.add(span.y).max(1e-20);
   // Explicitly dominate both conditional updates and the final gate read.
   distance.assign(uv.x.sub(header.z).min(uv.y.sub(header.w)).min(info.x.sub(uv.x)).min(info.y.sub(uv.y)));
   // Diagonals are admitted only when present in the real Source records.
   // Their L-infinity distance uses the same per-coordinate inset bound.
   // No new storage read, strip query, texture sample or pixel color is added.
   If(info.w.equal(2).or(info.w.equal(4)),()=>{distance.assign(distance.min(relative.x.mul(span.y).sub(relative.y.mul(span.x)).abs().div(scale)));});
   If(info.w.equal(3).or(info.w.equal(4)),()=>{distance.assign(distance.min(relative.x.mul(span.y).add(relative.y.mul(span.x)).sub(span.x.mul(span.y)).abs().div(scale)));});
   If(header.y.greaterThan(0).and(info.w.lessThan(.5).or(distance.lessThanEqual(info.z))),()=>{
   Loop({start:int(0),end:int(header.y),type:'int',condition:'<'},({i})=>{
    const edge=int(header.x).add(i.mul(EDGE_ROWS)),matched=float(0).toVar();
    for(let which=0;which<stripTriangles.length;which++)If(matched.equal(0),()=>{
     const ids=stripTriangles[which]!,row=edge.add(which*2),firstAffine=read(row),secondAffine=read(row.add(1)),a=firstAffine.xy,inv=vec4(firstAffine.zw,secondAffine.xy),p=uv.sub(a),s=vec2(p.x.mul(inv.x).add(p.y.mul(inv.y)),p.x.mul(inv.z).add(p.y.mul(inv.w))).toVar();
     If(secondAffine.z.greaterThan(.5).and(s.x.greaterThanEqual(-1e-6)).and(s.y.greaterThanEqual(-1e-6)).and(s.x.add(s.y).lessThanEqual(1+1e-6)),()=>{
      const bu=(i:number)=>[Math.floor(i/2)*.5,i%2] as const,u0=bu(ids[0]),u1=bu(ids[1]),u2=bu(ids[2]),vx=vec2(u1[0]-u0[0],u1[1]-u0[1]),vy=vec2(u2[0]-u0[0],u2[1]-u0[1]),brush=vec2(u0 as unknown as THREE.Node<'vec2'>).add(vx.mul(s.x)).add(vy.mul(s.y)).toVar(),transform=(d:THREE.Node<'vec2'>)=>vx.mul(d.x.mul(inv.x).add(d.y.mul(inv.y))).add(vy.mul(d.x.mul(inv.z).add(d.y.mul(inv.w)))),gx=transform(dx),gy=transform(dy);
      // The exact Source physical metric, using analytic strip UV gradients.
      // Its singular-angle fallback is important at perspective silhouettes.
      const determinant=gx.x.mul(gy.y).sub(gx.y.mul(gy.x)),threshold=gx.length().mul(gy.length()).mul(1e-7).max(1e-30),safe=determinant.abs().max(threshold).mul(determinant.lessThan(0).select(float(-1),float(1))),tangent=px.mul(gy.y).sub(py.mul(gx.y)).div(safe),bitangent=py.mul(gx.x).sub(px.mul(gy.x)).div(safe),aLength=tangent.length(),unit=tangent.div(aLength.max(1e-10)),cLength=unit.dot(bitangent),dLength=bitangent.sub(unit.mul(cLength)).length(),valid=determinant.abs().greaterThan(threshold).and(aLength.greaterThan(1e-10)).and(dLength.greaterThan(1e-10)),actual=valid.select(vec3(aLength.min(1e6),cLength.clamp(-1e6,1e6),dLength.min(1e6)),vec3(1,0,1)),density=actual.x.mul(actual.z).max(1e-20).sqrt().reciprocal(),metric=(v:THREE.Node<'vec2'>)=>vec2(v.x.mul(actual.x).add(v.y.mul(actual.y)),v.y.mul(actual.z)).mul(density),paint=options.samplePigment(metric(brush),metric(gx),metric(gy)).mul(options.brushColor),dry=options.sampleDry(brush,gx,gy),soft=brush.y.smoothstep(0,.035).mul(float(1).sub(brush.y.smoothstep(.90,1))),alpha=options.opacity.mul(soft).mul(mix(float(1),dry.mul(.65).add(.35),options.owner.irregularity)).toVar();
      If(alpha.lessThan(.012),()=>{alpha.assign(0);});result.rgb.assign(result.rgb.mul(float(1).sub(alpha)).add(paint.mul(alpha)));result.a.assign(result.a.add(float(1).sub(result.a).mul(alpha)));matched.assign(1);
     });
    });
   });
   });
  });
  return result;
 })();
}
export function createPreparedAffineStrokeNode(base:THREE.Node<'vec3'>,options:AffineStrokeNodeOptions):THREE.Node<'vec3'> {const coverage=queryPreparedAffineCoverage(options);return base.mul(float(1).sub(coverage.a)).add(coverage.rgb);}
