import { DataTexture, FloatType, NearestFilter, NoColorSpace, RGBAFormat, type Node, type BufferGeometry, type BufferAttribute, type InterleavedBufferAttribute } from 'three/webgpu';
import { Fn, If, Var, attribute, float, int, ivec2, texture, uint, vec3, uniform,renderGroup,varying } from 'three/tsl';
import type { AnimationDetail, AnimationSampleHandle } from './AnimationDetail';
import { sampleActorRoot, type ActorAnimationCache, type CachedActorPose } from './ActorAnimationCache';
import type { PresentationClock } from './pawn-presentation';

// Pack logical emitter rows in 2D before they exceed the WebGL2-safe edge.
// Capacity stays a power of two, so both row packing and height divide exactly.
const PALETTE_MAX_HEIGHT=2048;

/** A batch owns this palette. Logical rows identify emitters, never particle draw slots
 * or World objects. Only medium-detail publications upload changing values. */
export class FxAnimationCache {
  private capacity=1;
  private values:Float32Array;
  private image:DataTexture;
  private readonly node;
  private readonly emittersPerRow=uniform(1).setGroup(renderGroup);
  private readonly handles:(AnimationSampleHandle|undefined)[]=[];
  private readonly linkedPublications:(number|undefined)[]=[];
  private dirty=false;
  readonly minimumScale=uniform(1).setGroup(renderGroup);
  private readonly slot=varying(uint(attribute('fxSlot','float'))).setInterpolation('flat');
  constructor(readonly cells:number,readonly detail?:AnimationDetail,readonly continuousMiddle=true){
    this.values=new Float32Array(cells*4);this.image=this.makeTexture();this.node=texture(this.image);
  }
  private makeTexture():DataTexture {
    const columns=this.emittersPerRow.value;
    const result=new DataTexture(this.values,this.cells*columns,this.capacity/columns,RGBAFormat,FloatType);
    result.minFilter=result.magFilter=NearestFilter;result.generateMipmaps=false;
    result.colorSpace=NoColorSpace;result.needsUpdate=true;return result;
  }
  ensure(count:number):void {
    if(count<=this.capacity)return;
    this.capacity=2**Math.ceil(Math.log2(count));
    // Only the physical layout changes: linear emitter/cell storage, handles,
    // sampled values and the existing shader/texture node keep their identity.
    this.emittersPerRow.value=Math.max(1,this.capacity/PALETTE_MAX_HEIGHT);
    const values=new Float32Array(this.capacity*this.cells*4);values.set(this.values);this.values=values;
    const old=this.image;this.image=this.makeTexture();this.node.value=this.image;old.dispose();
  }
  invalidate(row:number):void {const handle=this.handles[row];if(handle)this.detail?.invalidate(handle);this.linkedPublications[row]=undefined;}
  reset():void {this.handles.length=0;this.linkedPublications.length=0;}
  /** Classification is cheap every frame. writer is never called for near or
   * far, and a paused unchanged medium emitter never republishes its palette. */
  sample(row:number,x:number,y:number,z:number,writer:()=>void,scale=1):0|1|2 {
    if(this.sampleDue(row,x,y,z,scale))writer();
    return this.commitSample(row);
  }
  /** Split the synchronous publication for batches with an indexed writer,
   * so they do not allocate one callback per emitter on every frame. */
  sampleDue(row:number,x:number,y:number,z:number,scale=1):boolean {
    if(!this.detail)return false;
    this.ensure(row+1);
    const handle=this.handles[row]??(this.handles[row]=this.detail.createHandle());
    const due=this.detail.shouldSample(handle,x,y,z,scale),level=handle.level as 0|1|2;
    return level===1&&due&&!this.continuousMiddle;
  }
  commitSample(row:number):0|1|2 {
    if(!this.detail)return 0;
    const level=this.handles[row]!.level as 0|1|2;
    this.set(row,0,this.continuousMiddle&&level===1?0:level);return level;
  }
  /** A carried effect follows its owner's actual publication, not another
   * distance threshold or a particle instance's unrelated slot. */
  sampleLinked(row:number,level:0|1|2,publication:number,writer:()=>void):0|1|2 {
    if(level===1&&!this.continuousMiddle&&this.linkedPublications[row]!==publication)writer();
    this.linkedPublications[row]=publication;this.set(row,0,this.continuousMiddle&&level===1?0:level);return level;
  }
  set(row:number,cell:number,x:number,y=0,z=0,w=0):void {
    this.ensure(row+1);const at=(row*this.cells+cell)*4;
    const fx=Math.fround(x),fy=Math.fround(y),fz=Math.fround(z),fw=Math.fround(w);
    if(this.values[at]!==fx){this.values[at]=fx;this.dirty=true;}
    if(this.values[at+1]!==fy){this.values[at+1]=fy;this.dirty=true;}
    if(this.values[at+2]!==fz){this.values[at+2]=fz;this.dirty=true;}
    if(this.values[at+3]!==fw){this.values[at+3]=fw;this.dirty=true;}
  }
  get(row:number,cell:number,component=0):number{return this.values[(row*this.cells+cell)*4+component]!;}
  cell(cell:number|Node<'int'>,row:Node<'uint'>=this.slot):Node<'vec4'> {
    const columns=uint(this.emittersPerRow);
    const x=int(row.mod(columns)).mul(this.cells).add(cell),y=int(row.div(columns));
    const read=this.node.load(ivec2(x,y));read.updateMatrix=false;return read;
  }
  /** Whether the shader reads this cache (choose() keeps only the original
   * graph without detail or with continuous middle detail). */
  get reads():boolean {return !!this.detail&&!this.continuousMiddle;}
  choose<T extends 'float'|'vec2'|'vec3'|'vec4'>(original:()=>Node<T>,cached:()=>Node<T>,initial:Node<T>=vec3(0) as unknown as Node<T>,row:Node<'uint'>=this.slot):Node<T> {
    if(!this.detail||this.continuousMiddle)return original();
    // Retain one result in the caller's shader stack. Reusing a bare
    // ShaderCall can otherwise re-emit its zero initializer without its If.
    return Var<T,Node<T>>(Fn(()=>{const result=Var<T,Node<T>>(initial);
      const direct=this.detail!.enabled.lessThan(.5).or(this.detail!.perspective.lessThan(.5).and(this.detail!.projectionScale.mul(this.minimumScale).greaterThanEqual(this.detail!.nearPixels)));
      If(direct,()=>{result.assign(original());}).Else(()=>{
        If(this.cell(0,row).x.equal(1),()=>{result.assign(cached());}).Else(()=>{result.assign(original());});
      });return result;})() as Node<T>);
  }
  /** A varying is always generated at the vertex stage, even when consumed
   * inside a fragment branch. Keep the uniform bypass and palette lookup
   * inside its vertex node; the complete fragment expression stays intact. */
  cachedVarying(cached:()=>Node<'float'>):Node<'float'> {
    return varying(this.choose(()=>float(0),cached,float(0)));
  }
  /** Four cells: basis X/Y/Z and translation. The shader does only static
   * shape algebra in medium detail, without a clock or trigonometry. */
  affine(local:Node<'vec3'>,first:number|Node<'int'>=1,row?:Node<'uint'>):Node<'vec3'> {
    const cell=(offset:number)=>this.cell(typeof first==='number'?first+offset:first.add(offset),row);
    return cell(0).xyz.mul(local.x).add(cell(1).xyz.mul(local.y))
      .add(cell(2).xyz.mul(local.z)).add(cell(3).xyz);
  }
  flush():void {if(this.dirty){this.image.needsUpdate=true;this.dirty=false;}}
  dispose():void {this.image.dispose();this.handles.length=0;}
}

export const fxFract=(value:number):number=>value-Math.floor(value);
export const fxClamp=(value:number):number=>Math.max(0,Math.min(1,value));
export function fxSmoothstep(low:number,high:number,value:number):number {const t=fxClamp((value-low)/(high-low));return t*t*(3-2*t);}
export function fxActorCache(source:BufferGeometry|undefined,clock:PresentationClock):ActorAnimationCache|undefined {
  return source?.userData.animationCache as ActorAnimationCache|undefined??clock.animationCache;
}
export function fxActorPose(source:BufferGeometry,clock:PresentationClock,slot:number):CachedActorPose {
  type Stream=BufferAttribute|InterleavedBufferAttribute;
  const from=source.getAttribute('aFrom') as Stream,to=source.getAttribute('aTo') as Stream,travel=source.getAttribute('aTravel') as Stream;
  return fxActorCache(source,clock)?.presentedRoot(slot,from,to,travel,clock.travelTime.value,clock.blend.value)??sampleActorRoot(from,to,travel,slot,clock.travelTime.value,clock.blend.value);
}

/** Billboard basis sampled with the emitter; camera motion does not restart
 * a medium clock. Classification changes still publish immediately. */
export function fxBillboard(x:number,y:number,z:number,camera:{x:number;y:number;z:number}):{right:[number,number,number];up:[number,number,number]} {
  let dx=camera.x-x,dy=camera.y-y,dz=camera.z-z;const length=Math.hypot(dx,dy,dz);
  if(length>.001){dx/=length;dy/=length;dz/=length;}else{dx=0;dy=1;dz=0;}
  const horizontal=Math.hypot(dz,dx),right:[number,number,number]=horizontal>.001?[dz/horizontal,0,-dx/horizontal]:[1,0,0];
  let ux=dy*right[2],uy=dz*right[0]-dx*right[2],uz=-dy*right[0];const u=Math.hypot(ux,uy,uz)||1;
  ux/=u;uy/=u;uz/=u;return {right,up:[ux,uy,uz]};
}
