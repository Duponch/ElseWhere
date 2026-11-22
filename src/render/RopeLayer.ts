import * as THREE from 'three/webgpu';
import { Fn, attribute, float, mix, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import { localTimeSeconds } from '../bridge/clock-rate';
import type { PenRegion } from '../sim/animal-pens';
import { readPenViews } from '../ui/core-animal-alerts';
import { animalBodySize } from '../sim/animal-life';
import { leadRopees } from '../sim/animal-leading';
import type { Cell,Pawn,World } from '../sim/types';
import type { WildAnimal } from '../sim/wildlife-state';
import type { MotionTimeline } from './MotionTimeline';
import type { PawnLayer } from './PawnLayer';
import type { WildlifeLayer } from './WildlifeLayer';

type Pair={pawn:Pawn;animal:WildAnimal;height:number};
const STRIDE=17;
const OFFSETS=[['aRoperFrom',3,0],['aRoperTo',3,3],['aRoperTime',2,6],
  ['aAnimalFrom',3,8],['aAnimalTo',3,11],['aAnimalTime',2,14],['aRopeHeight',1,16]] as const;

function ribbonGeometry(capacity:number):THREE.InstancedBufferGeometry {
  // Two crossed ribbons form a slim 3D cord. Each is bent into two segments
  // so its middle sags; all ropes still share one draw and one vertex stream.
  const vertices:number[]=[];
  for(const crossed of [0,1])for(const [from,to] of [[0,.5],[.5,1]]){
    for(const [t,side] of [[from,-1],[from,1],[to,-1],[to,-1],[from,1],[to,1]])
      vertices.push(t!,side!,crossed);
  }
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const data=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*STRIDE),STRIDE).setUsage(THREE.DynamicDrawUsage);
  for(const [name,size,offset] of OFFSETS)geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(data,size,offset));
  geometry.instanceCount=0;return geometry;
}

function presented(cell:Cell,motion:Pawn['motion']|WildAnimal['motion'],segment:ReturnType<MotionTimeline['segment']>,tick:number){
  const edge=segment??motion;
  const active=!!edge&&tick>=edge.start&&tick<edge.end;
  const fromFraction=edge&&'fromFraction' in edge&&typeof edge.fromFraction==='number'?edge.fromFraction:0;
  const toFraction=edge&&'toFraction' in edge&&typeof edge.toFraction==='number'?edge.toFraction:1;
  const lerp=THREE.MathUtils.lerp;
  if(!active||!edge)return {from:cell,to:cell,start:0,end:0};
  return {
    from:{x:lerp(edge.from.x,edge.to.x,fromFraction),z:lerp(edge.from.z,edge.to.z,fromFraction)},
    to:{x:lerp(edge.from.x,edge.to.x,toFraction),z:lerp(edge.from.z,edge.to.z,toFraction)},
    start:edge.start,end:edge.end,
  };
}

/** One resident GPU ribbon batch for actual, claimed lead pairs. Nothing is
 * drawn before physical contact; no scene object is made per rope. Worker
 * snapshots update membership, and segment changes upload only affected data. */
export class RopeLayer {
  readonly mesh:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshBasicNodeMaterial>;
  readonly time=uniform(0);
  readonly stats={activeRopes:0,uploads:0};
  private capacity=8;
  private pairs:Pair[]=[];
  private keys:string[]=[];
  private world:World|undefined;
  private detailVisible=true;
  constructor(){
    const material=new THREE.MeshBasicNodeMaterial({color:0x9d7951,side:THREE.DoubleSide,depthWrite:false});
    material.positionNode=Fn(()=>{
      const rt=attribute('aRoperTime','vec2'),at=attribute('aAnimalTime','vec2');
      const ra=rt.y.greaterThan(rt.x).select(this.time.sub(rt.x).div(rt.y.sub(rt.x).max(.0001)).clamp(0,1),float(1));
      const aa=at.y.greaterThan(at.x).select(this.time.sub(at.x).div(at.y.sub(at.x).max(.0001)).clamp(0,1),float(1));
      const roper=mix(attribute('aRoperFrom','vec3'),attribute('aRoperTo','vec3'),ra);
      const animal=mix(attribute('aAnimalFrom','vec3'),attribute('aAnimalTo','vec3'),aa);
      const t=positionLocal.x,delta=animal.sub(roper),distance=delta.xz.length().max(.0001);
      const side=positionLocal.y.mul(.018),crossed=positionLocal.z.greaterThan(.5);
      const right=vec3(delta.z.div(distance),0,delta.x.negate().div(distance));
      const sag=sin(t.mul(Math.PI)).mul(.14);
      return roper.add(delta.mul(t)).add(vec3(0,mix(float(1.04),attribute('aRopeHeight','float'),t).sub(sag),0))
        .add(crossed.select(vec3(0,side,0),right.mul(side)));
    })();
    this.mesh=new THREE.Mesh(ribbonGeometry(this.capacity),material);
    this.mesh.name='Animal leading ropes — resident GPU ribbons';
    this.mesh.frustumCulled=false;this.mesh.renderOrder=5;this.mesh.visible=false;
  }
  adopt(world:World,reset=false):void {
    this.world=world;
    const animals=new Map((world.wildlife?.animals??[]).map(a=>[a.id,a]));
    // Pen regions of this World, read through the alerts' reader: each
    // published World is a new object, so the simulation's per-World cache
    // would flood the whole map again at every complete publication. The
    // reader reuses the regions while barriers and blocking terrain stay the
    // same (same regions as penRegion; a marker absent from the map has none).
    let regions:Map<number,PenRegion|undefined>|undefined;
    const next:Pair[]=[];
    for(const pawn of world.pawns){
      const task=pawn.animalHandling;
      if(task?.kind!=='lead'||task.phase==='approach')continue;
      const markerId=task.markerId;
      if(markerId===undefined)continue;
      regions??=new Map(readPenViews(world).map(view=>[view.marker.id,view.region]));
      const region=regions.get(markerId);
      for(const id of leadRopees(task)){
        const animal=animals.get(id);if(!animal||region?.cells.has(animal.z*world.width+animal.x))continue;
        next.push({pawn,animal,height:Math.max(.36,.58*animalBodySize(animal))});
      }
    }
    if(next.length>this.capacity){
      this.capacity=2**Math.ceil(Math.log2(next.length));
      const old=this.mesh.geometry;this.mesh.geometry=ribbonGeometry(this.capacity);old.dispose();
      this.keys=[];
    }
    if(reset||next.length!==this.pairs.length||next.some((pair,i)=>pair.pawn.id!==this.pairs[i]?.pawn.id||pair.animal.id!==this.pairs[i]?.animal.id))this.keys=[];
    this.pairs=next;this.mesh.geometry.instanceCount=next.length;
    this.stats.activeRopes=next.length;this.mesh.visible=this.detailVisible&&next.length>0;
  }
  present(timeline?:MotionTimeline,pawns?:PawnLayer,wildlife?:WildlifeLayer):void {
    const world=this.world;if(!world||!this.pairs.length||!this.detailVisible)return;
    const tick=timeline?.tick??world.tick,origin=Math.floor(tick/1024)*1024;
    this.time.value=localTimeSeconds(tick,origin);
    const stream=(this.mesh.geometry.getAttribute('aRoperFrom') as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer;
    let dirty=false;
    this.pairs.forEach(({pawn,animal,height},i)=>{
      const heldPawn=pawns?.presentedPose(pawn.id),heldAnimal=wildlife?.presentedPose(animal.id);
      const p=heldPawn?{from:heldPawn,to:heldPawn,start:0,end:0}:presented(pawn,pawn.motion,timeline?.segment(pawn.id),tick);
      const a=heldAnimal?{from:heldAnimal,to:heldAnimal,start:0,end:0}:presented(animal,animal.motion,timeline?.segment(animal.id),tick);
      const signature=`${heldPawn&&heldAnimal?0:origin}:${p.start}:${p.end}:${p.from.x}:${p.from.z}:${p.to.x}:${p.to.z}:${heldPawn?.y??0}:${a.start}:${a.end}:${a.from.x}:${a.from.z}:${a.to.x}:${a.to.z}:${heldAnimal?.y??0}:${height}`;
      if(this.keys[i]===signature)return;this.keys[i]=signature;dirty=true;this.stats.uploads++;
      const offset=i*STRIDE,array=stream.array as Float32Array;
      array.set([p.from.x,heldPawn?.y??0,p.from.z,p.to.x,heldPawn?.y??0,p.to.z,localTimeSeconds(p.start,origin),localTimeSeconds(p.end,origin),
        a.from.x,heldAnimal?.y??0,a.from.z,a.to.x,heldAnimal?.y??0,a.to.z,localTimeSeconds(a.start,origin),localTimeSeconds(a.end,origin),height],offset);
    });
    if(dirty)stream.needsUpdate=true;
  }
  setDetailVisible(visible:boolean):void {this.detailVisible=visible;this.mesh.visible=visible&&this.pairs.length>0;}
  prepareForCompile():()=>void {
    const count=this.mesh.geometry.instanceCount,visible=this.mesh.visible;
    this.mesh.geometry.instanceCount=Math.max(1,count);this.mesh.visible=true;
    return ()=>{this.mesh.geometry.instanceCount=count;this.mesh.visible=visible;};
  }
  dispose():void {this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
