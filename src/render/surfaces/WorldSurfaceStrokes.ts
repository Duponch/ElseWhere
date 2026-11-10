/** Contour table of a dynamic world surface (linked walls, roofs), computed
 * directly from its triangle soup.
 *
 * Same result, bit for bit, as compileFaceStrokeTable(..., {mergeCoplanar:
 * false}) for the drawn triangles: the same Source rule finds the edges (a
 * boundary, a fold above 22°, or a change of the discriminant partition), in
 * the same order, with the same seeds, widths and rough offsets, projected in
 * the same Float32 steps. It only skips the intermediate interleaved brush
 * geometry, which is most of the cost, and it stores no record for context
 * triangles: those take part in edge detection only, so a surface split into
 * regions keeps continuous contours across region borders. */
import type {FaceStrokeData} from './FaceStrokeTable';

const HEADER_ROWS=2,EDGE_ROWS=9,EDGE_FLOATS=36;
const THRESHOLD=Math.cos(22*(Math.PI/180)),BASE_WIDTH=.008;
const hash=(n:number)=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const CROSS_SECTIONS=[0,.5,1] as const;
const f32=Math.fround;

export interface WorldSurfaceStrokeInput {
  /** Non-indexed corners, drawn triangles first, then context triangles. */
  readonly position:Float32Array;
  /** Two face coordinates per corner (the stroke UV domain). */
  readonly faceUv:Float32Array;
  /** One discriminant value per corner (read at each triangle's first corner). */
  readonly partition?:Float32Array;
  readonly drawnTriangles:number;
}
export type WorldSurfaceStrokeTable=Pick<FaceStrokeData,'faceCount'|'edgeCount'|'maxEdgesPerFace'|'values'|'assertCurrent'>;

export function compileWorldSurfaceStrokes(input:WorldSurfaceStrokeInput):WorldSurfaceStrokeTable {
  const {position:p,faceUv:uv,partition,drawnTriangles}=input,triangles=p.length/9;
  if(!Number.isInteger(triangles)||uv.length!==triangles*6||partition&&partition.length!==triangles*3||!Number.isInteger(drawnTriangles)||drawnTriangles<0||drawnTriangles>triangles)throw Error('Complete world surface triangle soup required');
  // Vertex identity: positions rounded to micro-units, as the Source brush,
  // numbered in first-occurrence order (open-addressing table, no strings).
  const corners=triangles*3,ids=new Int32Array(corners),rounded=new Float64Array(corners*3);
  let capacity=1;while(capacity<corners*2)capacity*=2;
  const slots=new Int32Array(capacity).fill(-1),first=new Int32Array(corners);let vertexCount=0;
  for(let v=0;v<corners;v++){
    const x=Math.round(p[v*3]!*1e6),y=Math.round(p[v*3+1]!*1e6),z=Math.round(p[v*3+2]!*1e6);
    rounded[v*3]=x;rounded[v*3+1]=y;rounded[v*3+2]=z;
    let slot=(Math.imul(x|0,73856093)^Math.imul(y|0,19349663)^Math.imul(z|0,83492791))&(capacity-1),id=-1;
    for(;;){
      const at=slots[slot]!;if(at<0)break;
      const o=first[at]!*3;if(rounded[o]===x&&rounded[o+1]===y&&rounded[o+2]===z){id=at;break;}
      slot=(slot+1)&(capacity-1);
    }
    if(id<0){id=vertexCount++;slots[slot]=id;first[id]=v;}
    ids[v]=id;
  }
  const partitions=new Map<number,number>();
  // Buckets in first-insertion order, each edge with its face normal and seed.
  const buckets=new Map<number,number[]>(),normals=new Float64Array(triangles*3),valid=new Uint8Array(triangles);
  for(let t=0;t<triangles;t++){
    const a=t*3,ax=p[a*3]!,ay=p[a*3+1]!,az=p[a*3+2]!;
    const ux=p[a*3+3]!-ax,uy=p[a*3+4]!-ay,uz=p[a*3+5]!-az,vx=p[a*3+6]!-ax,vy=p[a*3+7]!-ay,vz=p[a*3+8]!-az;
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nx*nx+ny*ny+nz*nz<1e-20)continue;
    const inverse=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);nx*=inverse;ny*=inverse;nz*=inverse;
    normals[t*3]=nx;normals[t*3+1]=ny;normals[t*3+2]=nz;valid[t]=1;
    const value=partition?partition[a]!:0;let part=partitions.get(value);if(part===undefined){part=partitions.size;partitions.set(value,part);}
    for(let e=0;e<3;e++){
      const i=ids[a+e]!,j=ids[a+(e+1)%3]!,key=(part*vertexCount+Math.min(i,j))*vertexCount+Math.max(i,j);
      let bucket=buckets.get(key);if(!bucket){bucket=[];buckets.set(key,bucket);}bucket.push(t*3+e);
    }
  }
  // Strips per drawn triangle, in Source order.
  const strips:number[][]=Array.from({length:drawnTriangles},()=>[]);
  for(const bucket of buckets.values())for(const edge of bucket){
    const t=Math.floor(edge/3);
    if(bucket.length>1&&!bucket.some(other=>{if(other===edge)return false;const o=Math.floor(other/3);return normals[t*3]!*normals[o*3]!+normals[t*3+1]!*normals[o*3+1]!+normals[t*3+2]!*normals[o*3+2]!<=THRESHOLD;}))continue;
    if(t>=drawnTriangles||!valid[t])continue;
    const e=edge%3,a=t*3+e,b=t*3+(e+1)%3,sx=p[a*3]!-p[b*3]!,sy=p[a*3+1]!-p[b*3+1]!,sz=p[a*3+2]!-p[b*3+2]!;
    if(sx*sx+sy*sy+sz*sz<1e-20)continue;
    if(strips[t]!.length>=3)throw Error('Unmerged Source triangle edge-count admission refused');
    strips[t]!.push(e);
  }
  let edgeCount=0,maxEdges=0;for(const s of strips){edgeCount+=s.length;maxEdges=Math.max(maxEdges,s.length);}
  const values=new Float32Array(drawnTriangles*8+edgeCount*EDGE_FLOATS);let row=drawnTriangles*HEADER_ROWS;
  const base=new Float64Array(18),width=new Float64Array(18),rough=new Float64Array(18);
  for(let t=0;t<drawnTriangles;t++){
    const first=t*3,list=strips[t]!;
    const u0=uv[first*2]!,u1=uv[first*2+2]!,u2=uv[first*2+4]!,v0=uv[first*2+1]!,v1=uv[first*2+3]!,v2=uv[first*2+5]!;
    values[t*8]=row;values[t*8+1]=list.length;values[t*8+2]=Math.min(u0,u1,u2);values[t*8+3]=Math.min(v0,v1,v2);values[t*8+4]=Math.max(u0,u1,u2);values[t*8+5]=Math.max(v0,v1,v2);
    let offset=row*4;row+=list.length*EDGE_ROWS;
    if(!list.length)continue;
    // The triangle's own affine map from its plane to the face coordinates.
    const ax=p[first*3]!,ay=p[first*3+1]!,az=p[first*3+2]!;
    const bx=p[first*3+3]!-ax,by=p[first*3+4]!-ay,bz=p[first*3+5]!-az,cx=p[first*3+6]!-ax,cy=p[first*3+7]!-ay,cz=p[first*3+8]!-az;
    const bb=bx*bx+by*by+bz*bz,bc=bx*cx+by*cy+bz*cz,cc=cx*cx+cy*cy+cz*cz,det=bb*cc-bc*bc;
    if(Math.abs(det)<1e-24)throw Error('Actual unmerged brush triangle degenerate');
    const ux=u1-u0,uy=u2-u0,vx=v1-v0,vy=v2-v0;
    for(const e of list){
      const ia=first+e,ib=first+(e+1)%3,ic=first+(e+2)%3,seed=first*3+e;
      const Ax=p[ia*3]!,Ay=p[ia*3+1]!,Az=p[ia*3+2]!,Bx=p[ib*3]!,By=p[ib*3+1]!,Bz=p[ib*3+2]!,Cx=p[ic*3]!,Cy=p[ic*3+1]!,Cz=p[ic*3+2]!;
      let dx=Bx-Ax,dy=By-Ay,dz=Bz-Az;const length=Math.sqrt(dx*dx+dy*dy+dz*dz),inverse=1/length;dx*=inverse;dy*=inverse;dz*=inverse;
      let n=0;
      for(const s of CROSS_SECTIONS)for(let across=0;across<2;across++){
        const px=Ax+(Bx-Ax)*s,py=Ay+(By-Ay)*s,pz=Az+(Bz-Az)*s,ex=Cx-Ax,ey=Cy-Ay,ez=Cz-Az;
        const qx=ey*dz-ez*dy,qy=ez*dx-ex*dz,qz=ex*dy-ey*dx,altitude=Math.sqrt(qx*qx+qy*qy+qz*qz);
        const span=Math.min(BASE_WIDTH,altitude/7),scale=span/Math.max(altitude,1e-12),ix=(Cx-px)*scale,iy=(Cy-py)*scale,iz=(Cz-pz)*scale;
        const irregular=across?(hash(seed+s*97.13)-.5)*.7:hash(seed+s*97.13+31)*.12;
        base[n]=f32(px);base[n+1]=f32(py);base[n+2]=f32(pz);
        width[n]=f32(ix*across);width[n+1]=f32(iy*across);width[n+2]=f32(iz*across);
        rough[n]=f32(ix*irregular);rough[n+1]=f32(iy*irregular);rough[n+2]=f32(iz*irregular);n+=3;
      }
      for(let vertex=0;vertex<6;vertex++){
        const at=vertex*3;let component=0;
        for(const [source,vector] of [[base,false],[width,true],[rough,true]] as const){
          let qx=source[at]!,qy=source[at+1]!,qz=source[at+2]!;
          if(!vector){qx-=ax;qy-=ay;qz-=az;}
          const pb=qx*bx+qy*by+qz*bz,pc=qx*cx+qy*cy+qz*cz,u=(pb*cc-pc*bc)/det,w=(pc*bb-pb*bc)/det;
          values[offset+vertex*6+component]=(vector?0:u0)+u*ux+w*uy;values[offset+vertex*6+component+1]=(vector?0:v0)+u*vx+w*vy;component+=2;
        }
      }
      offset+=EDGE_FLOATS;
    }
  }
  return {faceCount:drawnTriangles,edgeCount,maxEdgesPerFace:maxEdges,values,assertCurrent(){}};
}
