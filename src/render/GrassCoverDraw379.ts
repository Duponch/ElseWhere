import {IndirectStorageBufferAttribute,Matrix4,OrthographicCamera,PerspectiveCamera,WebGLCoordinateSystem,WebGPUCoordinateSystem,type Camera,type InstancedBufferGeometry,type Mesh} from 'three/webgpu';
import {markNativeIndirectGeometry} from './source-command-capability';

/** Conservative local box for EVERY version of the existing blade shader:
 * root jitter .48; rotated side/lean <= hypot(.033,.029)*1.21; full sine
 * sway <= .22, and middle RGBA8 sin/cos lookup has |wave| <= 2, so its
 * larger bound is (.07*2+.04)*2 = .36. Total horizontal < .894. The
 * vertical range is .021..(.021+.21+.17). Bounds deliberately leave room
 * for Float32 evaluation and the original blade's authored endpoints. */
export const GRASS_FRUSTUM_RADIUS379=1,GRASS_FRUSTUM_MIN_Y379=-.05,GRASS_FRUSTUM_MAX_Y379=.5;
interface GrassClipPlane379 {readonly coefficients:readonly number[];readonly absoluteProduct:readonly number[]}
const identity379=new Matrix4();
/** Unnormalized native clip inequalities, including WebGPU/reversed-depth
 * near/far. The positive absolute-product envelope accounts separately for
 * projection/view Float32 rounding and cancellation, not just world epsilon.
 * Unusual/nonfinite matrices keep the unculled native mask path. */
export function grassClipPlanes379(projection:Matrix4,view:Matrix4,coordinateSystem:Camera['coordinateSystem'],reversedDepth:boolean):readonly GrassClipPlane379[]|undefined {
  const p=projection.elements,v=view.elements;
  if((coordinateSystem!==WebGLCoordinateSystem&&coordinateSystem!==WebGPUCoordinateSystem)||p.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6))return;
  const actual=new Matrix4().multiplyMatrices(projection,view).elements,absolute=new Float64Array(16);
  for(let column=0;column<4;column++)for(let row=0;row<4;row++){let value=0;for(let k=0;k<4;k++)value+=Math.abs(p[k*4+row]!)*Math.abs(v[column*4+k]!);absolute[column*4+row]=value;}
  const plane=(a:number,b:number,sign:number):GrassClipPlane379=>({coefficients:Array.from({length:4},(_,c)=>actual[c*4+a]!+(b<0?0:sign*actual[c*4+b]!)),absoluteProduct:Array.from({length:4},(_,c)=>absolute[c*4+a]!+(b<0?0:absolute[c*4+b]!))});
  const planes=[plane(3,0,-1),plane(3,0,1),plane(3,1,1),plane(3,1,-1),plane(3,2,-1),reversedDepth||coordinateSystem===WebGPUCoordinateSystem?plane(2,-1,0):plane(3,2,1)];
  return planes.every(row=>[...row.coefficients,...row.absoluteProduct].every(Number.isFinite))?planes:undefined;
}
/** Each row intersects the same convex, expanded frustum inequalities as an
 * exhaustive AABB support test. Solve just two integer endpoints instead of
 * testing every blade: outside cells are guaranteed to be clipped. */
export function grassFrustumRows379(planes:readonly GrassClipPlane379[],bands:readonly number[]):readonly Int32Array[] {
  const result:Int32Array[]=[];
  for(let b=0;b<bands.length;b+=5){const x=bands[b]!,z=bands[b+1]!,columns=bands[b+2]!,rows=bands[b+3]!,ranges=new Int32Array(rows*2),r=GRASS_FRUSTUM_RADIUS379,xAbs=Math.max(Math.abs(x-r),Math.abs(x+columns-1+r));
    for(let row=0;row<rows;row++){
      const cellZ=z+row,zAbs=Math.abs(cellZ)+r;let first=0,last=columns-1;
      for(const plane of planes){const [nx,ny,nz,c]=plane.coefficients as readonly[number,number,number,number],[ex,ey,ez,ec]=plane.absoluteProduct as readonly[number,number,number,number];
        // A 1e-4 relative envelope comfortably exceeds two four-term Float32
        // matrix products, coefficient conversion and clip-coordinate
        // subtraction (unit roundoff 2^-24). It also protects near-plane
        // cancellation at grazing cameras. Entirely inside edges stay intact.
        const error=1e-4*(ex*xAbs+ey*GRASS_FRUSTUM_MAX_Y379+ez*zAbs+ec)+1e-9;
        const rowBase=nx*x+nz*cellZ+c+r*(Math.abs(nx)+Math.abs(nz))+(ny>=0?GRASS_FRUSTUM_MAX_Y379:GRASS_FRUSTUM_MIN_Y379)*ny+error;
        if(nx>0)first=Math.max(first,Math.ceil(-rowBase/nx));else if(nx<0)last=Math.min(last,Math.floor(-rowBase/nx));else if(rowBase<0)last=-1;
        if(first>last)break;
      }
      if(first<=last){ranges[row*2]=first;ranges[row*2+1]=last+1;}
    }
    result.push(ranges);
  }
  return result;
}

/** x, z, width, height and the original blade slots per cell in each of the
 * three consecutive shader bands. The map's RGBA alpha is sampled nearest;
 * the blade root jitter is strictly within its own texel. */
export function grassDrawSpans379(pixels:Uint8Array,width:number,bands:readonly number[],limit=12,visible?:readonly Int32Array[]):{first:number;count:number}[]{
  const gaps:{first:number;end:number}[]=[];
  let offset=0,first=-1,last=0;
  for(let b=0;b<bands.length;b+=5){
    const x=bands[b]!,z=bands[b+1]!,columns=bands[b+2]!,rows=bands[b+3]!,slots=bands[b+4]!;
    if(!slots)continue;
    const view=visible?.[b/5];
    for(let row=0;row<rows;row++){const start=view?.[row*2]??0,end=view?.[row*2+1]??columns;offset+=start*slots;
      for(let col=start;col<end;col++){
        if(pixels[((z+row)*width+x+col)*4+3]!==0){
          if(first<0)first=offset;
          else if(offset>last)gaps.push({first:last,end:offset});
          last=offset+slots;
        }
        offset+=slots;
      }
      offset+=(columns-end)*slots;
    }
  }
  if(first<0)return [];
  // Leading/trailing empty blades are always free. Keep the largest interior
  // holes under a bounded draw count, preserving every original instance ID.
  if(gaps.length>=limit){gaps.sort((a,b)=>(b.end-b.first)-(a.end-a.first));gaps.length=limit-1;gaps.sort((a,b)=>a.first-b.first);}
  const spans:{first:number;count:number}[]=[];
  for(const gap of gaps){spans.push({first,count:gap.first-first});first=gap.end;}
  spans.push({first,count:last-first});return spans;
}

interface Attributes {update(attribute:IndirectStorageBufferAttribute,type:number):void;delete(attribute:IndirectStorageBufferAttribute):unknown}
export class GrassCoverDraw379 {
  private readonly bands:number[]=[];
  private pixels?:Uint8Array;
  private width=0;
  private maskRevision=-1;
  private dirty=true;
  private readonly commands=new IndirectStorageBufferAttribute(new Uint32Array(12*5),5);
  private offsets:number[]|null=null;
  private attributes?:Attributes;
  private uploadedVersion=-1;
  private builtCount=-1;
  private visibleCount=0;
  private readonly projection=new Matrix4();private readonly view=new Matrix4();private planes?:readonly GrassClipPlane379[];
  private coordinates?:Camera['coordinateSystem'];private reversedDepth?:boolean;private frustumActive=false;
  private readonly counts={plans:0,sourceInstances:0,submittedInstances:0,nativeCalls:0,frustumPlans:0};
  private readonly native:Mesh['onBeforeRender'];
  private readonly before:Mesh['onBeforeRender'];
  constructor(private readonly mesh:Mesh<InstancedBufferGeometry>){
    markNativeIndirectGeometry(mesh.geometry);this.native=mesh.onBeforeRender;
    this.before=(...args)=>{this.native.apply(mesh,args);const [renderer,,camera,geometry,material,group]=args;
      const backend=Reflect.get(renderer,'backend'),attributes=Reflect.get(renderer,'_attributes') as Attributes|undefined;
      if(geometry!==mesh.geometry||geometry.indirect!==null&&geometry.indirect!==this.commands)return;
      if(!this.pixels||!backend?.isWebGPUBackend||!backend.device?.features?.has('indirect-first-instance')||typeof attributes?.update!=='function'||typeof attributes.delete!=='function'||group!=null||Reflect.get(material,'wireframe')||geometry.index?.count!==6||geometry.drawRange.start!==0||geometry.drawRange.count<6){if(geometry.indirect===this.commands)geometry.setIndirect(null);return;}
      this.updateFrustum(camera,renderer);
      const count=mesh.geometry.instanceCount;
      if(this.dirty){this.rebuild(count);this.dirty=false;}
      if(count!==this.builtCount||this.offsets===null){geometry.setIndirect(null);return;}
      if(this.attributes!==attributes){this.attributes?.delete(this.commands);this.attributes=attributes;this.uploadedVersion=-1;}
      if(this.uploadedVersion!==this.commands.version){attributes.update(this.commands,4);this.uploadedVersion=this.commands.version;}
      geometry.setIndirect(this.commands,this.offsets);
      this.counts.nativeCalls++;this.counts.sourceInstances+=count;this.counts.submittedInstances+=this.visibleCount;
    };mesh.onBeforeRender=this.before;
  }
  private updateFrustum(camera:Camera,renderer:object):void{
    // This producer is a non-shadow identity-world mesh. Keep any foreign
    // transformed/array/high-precision camera path on the original mask.
    const eligible=!this.mesh.castShadow&&this.mesh.matrixWorld.equals(identity379)&&Reflect.get(renderer,'highPrecision')!==true&&!Reflect.get(camera,'isArrayCamera')&&(camera instanceof PerspectiveCamera||camera instanceof OrthographicCamera);
    if(!eligible){if(this.frustumActive){this.frustumActive=false;this.planes=undefined;this.dirty=true;}return;}
    if(this.frustumActive&&this.coordinates===camera.coordinateSystem&&this.reversedDepth===camera.reversedDepth&&this.projection.equals(camera.projectionMatrix)&&this.view.equals(camera.matrixWorldInverse))return;
    this.frustumActive=true;this.coordinates=camera.coordinateSystem;this.reversedDepth=camera.reversedDepth;this.projection.copy(camera.projectionMatrix);this.view.copy(camera.matrixWorldInverse);
    this.planes=grassClipPlanes379(this.projection,this.view,this.coordinates,this.reversedDepth);this.dirty=true;this.counts.frustumPlans++;
  }
  setMask(pixels:Uint8Array,width:number,revision:number):void {
    if(this.pixels!==pixels||this.width!==width||this.maskRevision!==revision){this.pixels=pixels;this.width=width;this.maskRevision=revision;this.dirty=true;}
  }
  setBand(index:number,x:number,z:number,columns:number,rows:number,slots:number):void {
    if(this.bands[index]===x&&this.bands[index+1]===z&&this.bands[index+2]===columns&&this.bands[index+3]===rows&&this.bands[index+4]===slots)return;
    this.bands[index]=x;this.bands[index+1]=z;this.bands[index+2]=columns;this.bands[index+3]=rows;this.bands[index+4]=slots;this.dirty=true;
  }
  private rebuild(count:number):void {
    this.counts.plans++;this.offsets=null;this.builtCount=-1;
    if(this.bands.length!==15||count!==this.bands[2]!*this.bands[3]!*this.bands[4]!+this.bands[7]!*this.bands[8]!*this.bands[9]!+this.bands[12]!*this.bands[13]!*this.bands[14]!)return;
    this.builtCount=count;
    const spans=grassDrawSpans379(this.pixels!,this.width,this.bands,12,this.planes?grassFrustumRows379(this.planes,this.bands):undefined);
    this.visibleCount=spans.reduce((n,r)=>n+r.count,0);
    if(this.visibleCount>0&&count-this.visibleCount<Math.max(256,count/5))return;
    this.offsets=[];
    for(let i=0;i<spans.length;i++){
      const at=i*5,span=spans[i]!;
      this.commands.array[at]=6;this.commands.array[at+1]=span.count;this.commands.array[at+4]=span.first;
      this.offsets.push(at*4);
    }
    this.commands.needsUpdate=true;
  }
  metrics(){return {...this.counts,source:this.builtCount,submitted:this.visibleCount,commands:this.offsets?.length};}
  dispose():void {
    if(this.mesh.onBeforeRender===this.before)this.mesh.onBeforeRender=this.native;
    if(this.mesh.geometry.indirect===this.commands)this.mesh.geometry.setIndirect(null);
    this.attributes?.delete(this.commands);this.commands.dispose();
  }
}
