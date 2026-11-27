/** Construction-only physical coordinates for generic square paint patches.
 * Semantic leaf/anatomical illustrations deliberately keep their authored UVs.
 * The existing face seams own coordinates: no vertices, attributes or shader
 * instructions are added. Translation and rigid rotation cancel this metric. */
import type * as THREE from 'three/webgpu';
import {paintMetricFromDerivatives,type PaintVector3} from './origami/paint-metric';

type FaceProjection={origin:PaintVector3;u:PaintVector3;v:PaintVector3;vertices:Set<number>;minU:number;maxU:number;minV:number;maxV:number};

export function physicalSurfaceArtworkUv(geometry:THREE.BufferGeometry,sx=1,sy=1,sz=1):Float32Array {
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),face=geometry.getAttribute('surfaceStrokeFace'),index=geometry.index;
  if(!p||!uv||p.count!==uv.count)throw Error('Physical artwork requires existing position and UV streams');
  const out=new Float32Array(p.count*2),projections=new Map<number,FaceProjection>(),total=index?.count??p.count;
  for(let i=0;i<p.count;i++){out[i*2]=uv.getX(i);out[i*2+1]=uv.getY(i);}
  for(let at=0;at<total;at+=3){
    const a=index?.getX(at)??at,b=index?.getX(at+1)??at+1,c=index?.getX(at+2)??at+2,id=face?.getX(a)??at;
    let projection=projections.get(id);
    if(!projection){
      const e1:PaintVector3=[(p.getX(b)-p.getX(a))*sx,(p.getY(b)-p.getY(a))*sy,(p.getZ(b)-p.getZ(a))*sz],e2:PaintVector3=[(p.getX(c)-p.getX(a))*sx,(p.getY(c)-p.getY(a))*sy,(p.getZ(c)-p.getZ(a))*sz];
      const du1=uv.getX(b)-uv.getX(a),dv1=uv.getY(b)-uv.getY(a),du2=uv.getX(c)-uv.getX(a),dv2=uv.getY(c)-uv.getY(a),det=du1*dv2-dv1*du2;
      if(Math.abs(det)<1e-20)continue;
      const [A,C,D]=paintMetricFromDerivatives(e1,e2,[du1,dv1],[du2,dv2]);
      const u=e1.map((n,k)=>(n*dv2-e2[k]!*dv1)/det/A) as unknown as PaintVector3;
      const v=e2.map((n,k)=>((n*du1-e1[k]!*du2)/det-u[k]!*C)/D) as unknown as PaintVector3;
      projection={origin:[p.getX(a)*sx,p.getY(a)*sy,p.getZ(a)*sz],u,v,vertices:new Set(),minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity};projections.set(id,projection);
    }
    for(const vertex of[a,b,c])projection.vertices.add(vertex);
  }
  for(const f of projections.values()){
    // Project positions, not the other triangles' UVs: a tapered planar quad
    // need not have one affine UV Jacobian. This keeps both triangles exact.
    for(const vertex of f.vertices){const x=p.getX(vertex)*sx-f.origin[0],y=p.getY(vertex)*sy-f.origin[1],z=p.getZ(vertex)*sz-f.origin[2],u=x*f.u[0]+y*f.u[1]+z*f.u[2],v=x*f.v[0]+y*f.v[1]+z*f.v[2];out[vertex*2]=u;out[vertex*2+1]=v;f.minU=Math.min(f.minU,u);f.maxU=Math.max(f.maxU,u);f.minV=Math.min(f.minV,v);f.maxV=Math.max(f.maxV,v);}
    const span=Math.max(f.maxU-f.minU,f.maxV-f.minV,1e-10),cu=(f.minU+f.maxU)*.5,cv=(f.minV+f.maxV)*.5;
    for(const vertex of f.vertices){out[vertex*2]=.5+(out[vertex*2]!-cu)/span;out[vertex*2+1]=.5+(out[vertex*2+1]!-cv)/span;}
  }
  return out;
}
