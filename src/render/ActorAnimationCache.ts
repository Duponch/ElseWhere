import { DataTexture,FloatType,NearestFilter,NoColorSpace,RGBAFormat,Vector2,type Node,type BufferAttribute,type InterleavedBufferAttribute,type TextureNode,type UniformNode } from 'three/webgpu';
import { Fn,If,cos,float,instanceIndex,int,ivec2,renderGroup,sin,texture,uniform,vec4 } from 'three/tsl';
import type { AnimationDetail } from './AnimationDetail';
import { TURN_SECONDS } from './turn-presentation';
import {TICKS_PER_SECOND} from '../sim/types';

export type CachedActorPose={x:number;y:number;z:number;yaw:number};
export type CachedActorClock='time'|'travelTime'|'cargoTime'|'blend';
type Entry={id:number;signature:string;handle:ReturnType<AnimationDetail['createHandle']>;publication:number;linkedPublication:number};
type Stream=BufferAttribute|InterleavedBufferAttribute;
const CLOCK_COMPONENT={time:'x',travelTime:'y',cargoTime:'z',blend:'w'} as const;
const CLOCK_OFFSET={time:0,travelTime:1,cargoTime:2,blend:3} as const;
const clampUnit=(x:number)=>Math.max(0,Math.min(1,x));
const interpolate=(a:number,b:number,t:number)=>a+(b-a)*t;

/** One Float32 RGBA row per actor slot. No vertex stream, World or actor is
 * retained here. 0=root, 1=yaw/level/cache flag, 2=sampled presentation clocks;
 * cells 3..62 belong to the rig; 63 stamps travel/cargo clock origins in ticks.
 * Near reads the original graph. */
export class ActorAnimationCache {
  static readonly ROW_TEXELS=64;
  private capacity=1;
  private values=new Float32Array(ActorAnimationCache.ROW_TEXELS*4);
  private image=this.makeTexture();
  private readonly node=texture(this.image);
  private readonly entries:(Entry|undefined)[]=[];
  private dirty=false;
  private publication=0;
  private originalOnly=false;
  private readonly minimumScale=uniform(1).setGroup(renderGroup);
  private readonly origins=uniform(new Vector2()).setGroup(renderGroup);
  /** This cache's own shader reads. A program shared by several caches
   * builds an ActorAnimationCacheNodes over object-bound resources instead. */
  readonly gpu:ActorAnimationCacheNodes;
  constructor(private readonly detail:AnimationDetail){this.gpu=new ActorAnimationCacheNodes(detail,this.node,this.minimumScale,this.origins);}
  /** The current resources read by the shader. */
  get texture():DataTexture {return this.image;}
  get minimumScaleValue():number {return this.minimumScale.value;}
  get originsValue():Vector2 {return this.origins.value;}
  private makeTexture():DataTexture {
    const image=new DataTexture(this.values,ActorAnimationCache.ROW_TEXELS,this.capacity,RGBAFormat,FloatType);
    image.minFilter=image.magFilter=NearestFilter;image.generateMipmaps=false;
    image.colorSpace=NoColorSpace;image.needsUpdate=true;return image;
  }
  ensureCapacity(count:number):void {
    if(count<=this.capacity)return;
    this.capacity=2**Math.ceil(Math.log2(Math.max(1,count)));
    const values=new Float32Array(this.capacity*ActorAnimationCache.ROW_TEXELS*4);values.set(this.values);
    this.values=values;const old=this.image;this.image=this.makeTexture();this.node.value=this.image;old.dispose();
  }
  /** Uniform early bypass is safe only if even the smallest instance in this
   * batch is near. Held children can still share a more detailed carrier. */
  setMinimumScale(scale:number):void {this.minimumScale.value=Math.min(1,Math.max(0,scale));}
  /** Rebase the live clock domain in O(1), preserving every retained pose. */
  setOrigins(travelTick:number,cargoTick=travelTick):void {this.origins.value.set(travelTick,cargoTick);}
  /** Whole-batch near/off path: clear retained flags once, then skip the CPU
   * actor loop. Perspective and small members still classify individually. */
  prepareOriginalOnly():boolean {
    if(this.detail.settings.enabled&&(this.detail.perspective.value>.5||this.detail.projectionScale.value*this.minimumScale.value<this.detail.nearPixels.value)){
      this.originalOnly=false;return false;
    }
    if(!this.originalOnly){
      for(let slot=0;slot<this.entries.length;slot++){const entry=this.entries[slot];if(!entry)continue;
        entry.handle.level=0;entry.linkedPublication=-1;if(this.get(slot,1,3)!==0)this.set(slot,1,1,0,0,0);
      }
      this.originalOnly=true;
    }
    return true;
  }
  /** Called at adoption/structural changes, never from a per-RAF string scan. */
  reconcile(slot:number,id:number,signature:string):void {
    this.ensureCapacity(slot+1);const entry=this.entries[slot];
    if(entry?.id===id&&entry.signature===signature)return;
    const handle=this.detail.createHandle();if(this.originalOnly)handle.level=0;
    this.entries[slot]={id,signature,handle,publication:0,linkedPublication:-1};
    this.set(slot,1,1,0,0,0);
  }
  reset():void {this.entries.length=0;this.values.fill(0);this.dirty=true;this.originalOnly=false;}
  /** Only classification runs on ordinary frames. Expensive pose evaluation
   * lives in writer, and never executes for the original near pipeline. */
  sample(slot:number,x:number,y:number,z:number,scale:number,writer:()=>void):boolean {
    if(!this.shouldCapture(slot,x,y,z,scale))return false;
    writer();this.publish(slot);return true;
  }
  shouldCapture(slot:number,x:number,y:number,z:number,scale=1,continuousMiddle=false):boolean {
    const entry=this.entries[slot];if(!entry)return false;
    const due=this.detail.shouldSample(entry.handle,x,y,z,scale);
    // A dynamic middle rig uses its existing original GPU graph. A held
    // 12Hz pose cannot reconstruct fast work/attack phases by interpolation.
    // Far and genuinely static middle owners retain their original policy.
    if(entry.handle.level===0||entry.handle.level===1&&continuousMiddle){if(this.get(slot,1,3)!==0)this.set(slot,1,1,0,0,0);return false;}
    return due;
  }
  publish(slot:number):void {
    const entry=this.entries[slot];if(!entry)return;entry.publication=++this.publication;
    this.set(slot,1,this.get(slot,1,0),this.get(slot,1,1),entry.handle.level,1);
  }
  /** Stable primitive token for effects attached to this displayed pose. */
  cpuPublication(slot:number):number {return this.entries[slot]?.publication??0;}
  /** Held children use the carrier's publication, including its LOD changes.
   * A child's independent threshold must never detach it from that carrier. */
  sampleLinked(slot:number,parent:ActorAnimationCache,parentSlot:number,writer:()=>void):boolean {
    if(!this.shouldCaptureLinked(slot,parent,parentSlot))return false;
    writer();this.publish(slot);return true;
  }
  shouldCaptureLinked(slot:number,parent:ActorAnimationCache,parentSlot:number):boolean {
    const entry=this.entries[slot],owner=parent.entries[parentSlot];if(!entry||!owner)return false;
    // Original middle carriers must keep their children on the same live
    // graph, even when their retained handle still classifies as level1.
    if(owner.handle.level===0||parent.get(parentSlot,1,3)!==1){entry.handle.level=owner.handle.level;entry.linkedPublication=-1;if(this.get(slot,1,3)!==0)this.set(slot,1,1,0,0,0);return false;}
    if(entry.linkedPublication===owner.publication&&entry.handle.level===owner.handle.level)return false;
    entry.handle.level=owner.handle.level;entry.linkedPublication=owner.publication;return true;
  }
  set(slot:number,cell:number,x:number,y=0,z=0,w=0):void {
    const at=(slot*ActorAnimationCache.ROW_TEXELS+cell)*4;
    const fx=Math.fround(x),fy=Math.fround(y),fz=Math.fround(z),fw=Math.fround(w);
    if(this.values[at]!==fx){this.values[at]=fx;this.dirty=true;}
    if(this.values[at+1]!==fy){this.values[at+1]=fy;this.dirty=true;}
    if(this.values[at+2]!==fz){this.values[at+2]=fz;this.dirty=true;}
    if(this.values[at+3]!==fw){this.values[at+3]=fw;this.dirty=true;}
  }
  get(slot:number,cell:number,component:number):number {return this.values[(slot*ActorAnimationCache.ROW_TEXELS+cell)*4+component]!;}
  setRoot(slot:number,pose:CachedActorPose,time:number,travelTime:number,cargoTime:number,blend:number):void {
    this.set(slot,0,pose.x,pose.y,pose.z,pose.yaw);
    this.set(slot,1,Math.cos(pose.yaw),Math.sin(pose.yaw),0,1);
    this.set(slot,2,time,travelTime,cargoTime,blend);
    this.set(slot,63,this.origins.value.x,this.origins.value.y);
  }
  flush():void {if(this.dirty){this.image.needsUpdate=true;this.dirty=false;}}
  cell(cell:number,index:Node<'uint'>=instanceIndex):Node<'vec4'> {return this.gpu.cell(cell,index);}
  cellAt(cell:Node<'float'>,index:Node<'uint'>=instanceIndex):Node<'vec4'> {return this.gpu.cellAt(cell,index);}
  cached(index:Node<'uint'>=instanceIndex) {return this.gpu.cached(index);}
  poseNode(original:()=>Node<'vec4'>,index:Node<'uint'>=instanceIndex,cached?:Node<'bool'>):Node<'vec4'> {return this.gpu.poseNode(original,index,cached);}
  clockNode(original:Node<'float'>,name:CachedActorClock,index:Node<'uint'>=instanceIndex,cached?:Node<'bool'>):Node<'float'> {return this.gpu.clockNode(original,name,index,cached);}
  yawNode(yaw:Node<'float'>,kind:'cos'|'sin',index:Node<'uint'>=instanceIndex,cached?:Node<'bool'>):Node<'float'> {return this.gpu.yawNode(yaw,kind,index,cached);}
  /** Live translation with the retained rig's heading; no cache means the caller's original path. */
  presentedRoot(slot:number,from:Stream,to:Stream,travel:Stream,time:number,blend:number,result?:CachedActorPose):CachedActorPose|undefined {
    if(this.get(slot,1,3)!==1)return;
    const pose=sampleActorRoot(from,to,travel,slot,time,blend,result);pose.yaw=this.get(slot,0,3);return pose;
  }
  cpuPose(slot:number):CachedActorPose|undefined {
    if(this.get(slot,1,3)!==1)return;
    return {x:this.get(slot,0,0),y:this.get(slot,0,1),z:this.get(slot,0,2),yaw:this.get(slot,0,3)};
  }
  readRoot(slot:number,result:CachedActorPose):boolean {
    if(this.get(slot,1,3)!==1)return false;
    result.x=this.get(slot,0,0);result.y=this.get(slot,0,1);result.z=this.get(slot,0,2);result.yaw=this.get(slot,0,3);return true;
  }
  cpuClock(slot:number,name:CachedActorClock):number|undefined {
    if(this.get(slot,1,3)!==1)return;
    const value=this.get(slot,2,CLOCK_OFFSET[name]);
    return name==='travelTime'?value+(this.get(slot,63,0)-this.origins.value.x)/TICKS_PER_SECOND:
      name==='cargoTime'?value+(this.get(slot,63,1)-this.origins.value.y)/TICKS_PER_SECOND:value;
  }
  dispose():void {this.image.dispose();this.entries.length=0;}
}

/** Shader reads of one animation cache layout over explicit resources: the
 * cache's own texture and uniforms, or object-bound ones in a program shared
 * by several caches. The graphs are the ones the cache always built. */
export class ActorAnimationCacheNodes {
  constructor(private readonly detail:AnimationDetail,private readonly node:TextureNode,private readonly minimumScale:UniformNode<'float',number>,private readonly origins:UniformNode<'vec2',Vector2>){}
  cell(cell:number,index:Node<'uint'>=instanceIndex):Node<'vec4'> {const read=this.node.load(ivec2(cell,int(index)));read.updateMatrix=false;return read;}
  cellAt(cell:Node<'float'>,index:Node<'uint'>=instanceIndex):Node<'vec4'> {const read=this.node.load(ivec2(int(cell),int(index)));read.updateMatrix=false;return read;}
  cached(index:Node<'uint'>=instanceIndex) {
    return Fn(()=>{const active=float(0).toVar();
      If(this.detail.enabled.greaterThan(.5),()=>{
        If(this.detail.perspective.greaterThan(.5),()=>{active.assign(this.cell(1,index).w);})
          .ElseIf(this.detail.projectionScale.mul(this.minimumScale).lessThan(this.detail.nearPixels),()=>{active.assign(this.cell(1,index).w);});
      });return active;
    })().greaterThan(.5).toVar();
  }
  // A conditional ShaderCall must be materialized in its caller's stack.
  // Reusing the call itself can rebuild only its zero initializer in another
  // block while reusing the already-built branches (including the root).
  poseNode(original:()=>Node<'vec4'>,index:Node<'uint'>=instanceIndex,cached:Node<'bool'>=this.cached(index)):Node<'vec4'> {
    return Fn(()=>{const result=vec4(0).toVar();If(cached,()=>{const live=original();result.assign(vec4(live.xyz,this.cell(0,index).w));}).Else(()=>{result.assign(original());});return result;})().toVar();
  }
  clockNode(original:Node<'float'>,name:CachedActorClock,index:Node<'uint'>=instanceIndex,cached:Node<'bool'>=this.cached(index)):Node<'float'> {
    return Fn(()=>{const result=float(0).toVar();If(cached,()=>{
      const value=this.cell(2,index)[CLOCK_COMPONENT[name]];
      if(name==='travelTime')result.assign(value.add(this.cell(63,index).x.sub(this.origins.x).div(TICKS_PER_SECOND)));
      else if(name==='cargoTime')result.assign(value.add(this.cell(63,index).y.sub(this.origins.y).div(TICKS_PER_SECOND)));
      else result.assign(value);
    }).Else(()=>{result.assign(original);});return result;})().toVar();
  }
  yawNode(yaw:Node<'float'>,kind:'cos'|'sin',index:Node<'uint'>=instanceIndex,cached:Node<'bool'>=this.cached(index)):Node<'float'> {
    return Fn(()=>{const result=float(0).toVar();If(cached,()=>{result.assign(this.cell(1,index)[kind==='cos'?'x':'y']);}).Else(()=>{result.assign(kind==='cos'?cos(yaw):sin(yaw));});return result;})().toVar();
  }
}

/** The CPU sampler mirrors the shared edge/turn/furniture presentation node.
 * It reads encoded streams only; the physical timeline is never advanced. */
export function sampleActorRoot(from:Stream,to:Stream,travel:Stream,slot:number,time:number,blend:number,result:CachedActorPose={x:0,y:0,z:0,yaw:0}):CachedActorPose {
  const start=travel.getX(slot),end=travel.getY(slot);
  const alpha=end>start?clampUnit((time-start)/Math.max(.0001,end-start)):blend;
  const stationary=travel.getW(slot)>1;
  const turn=clampUnit((time-(stationary?travel.getZ(slot):start))/TURN_SECONDS);
  const facing=stationary||end>start?turn:blend;
  const distance=interpolate(travel.getZ(slot),travel.getW(slot),alpha);
  const y0=from.getY(slot),y1=to.getY(slot),vertical=y0<y1?clampUnit(distance*3):y0>y1?clampUnit(distance*3-2):distance;
  result.x=interpolate(from.getX(slot),to.getX(slot),alpha);result.y=interpolate(y0,y1,vertical);result.z=interpolate(from.getZ(slot),to.getZ(slot),alpha);result.yaw=interpolate(from.getW(slot),to.getW(slot),facing);return result;
}
