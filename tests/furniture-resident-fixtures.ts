import {expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/index';
import {sowDaylily} from '../src/sim/flower-pot';
import {buildFurniture} from '../src/render/FurnitureLayer';
import type {BoxBatches as ReferenceBatches} from '../src/render/BoxBatches';
import type {FurniturePresentation} from '../src/render/FurnitureLayer';
import {furniturePlacementZone,hiddenFurnitureSlot} from '../src/render/furniture-zones';
import type {BoxBatches} from '../src/render/BoxBatches';
import type {BoxMesh} from '../src/render/BoxMesh';
import type {Placement} from '../src/render/primitives';
import type {Structure,World} from '../src/sim/types';

export function structure(kind:Structure['kind'],id:number,x=4,z=4):Structure {
  return {id,kind,x,z,orientation:(id%4) as Structure['orientation'],footprint:'standard',material:'wood'};
}
export function pot(id:number,x=5,z=5,growth=.24):Structure {
  return {...structure('flower-pot',id,x,z),flower:{allowSow:true,plant:{...sowDaylily(0),growth}}};
}
export function growth(world:World,index:number,value:number,hitPoints?:number):void {
  const s=world.structures[index]!;
  s.flower={allowSow:s.flower!.allowSow,plant:{...s.flower!.plant!,growth:value,...(hitPoints===undefined?{}:{hitPoints})}};
}
export function camp():World {
  const world=createWorld(241,32,32);world.resources=[];world.packed=[];world.structures=[
    structure('table',101,6,7),pot(102,8,8),structure('dining-chair',103,7,7),
    structure('bed',104,12,10),pot(105,10,8),structure('hi-tech-research-bench',106,14,14),
    structure('wall',107,3,3),structure('table-long',108,20,20),pot(109,12,8),
    structure('armchair',110,6,10),structure('grave',111,2,8),structure('standing-lamp',112,4,10),
  ];
  return world;
}

/** This recorder is a placements oracle, not a replacement for a GPU runtime.
 * Rejections occur before writes, like the resident BoxBatches guard. */
export class RecordingBatches {
  items:Placement[]=[];
  group:THREE.Group|undefined;
  private stamp:object|undefined;
  calls:Array<{kind:'set'|'patch';key:string;start?:number;count:number;total?:number}>=[];
  rejectPatch=false;
  set(group:THREE.Group,key:string,items:Placement[]):void {
    if(key==='sandbags')return; // Independent resident geometry; furniture stamp/spans are the oracle here.
    expect(key).toBe('furniture');this.group=group;this.items=items.map(p=>({...p}));this.stamp={};
    this.calls.push({kind:'set',key,count:items.length});
  }
  furnitureStamp():object|undefined {return this.stamp;}
  patchFurniture(group:THREE.Group,key:string,start:number,items:Placement[],total:number,stamp?:object):boolean {
    if(this.rejectPatch||this.group!==group||key!=='furniture'||this.items.length!==total
      ||stamp!==this.stamp||!Number.isSafeInteger(start)||start<0||start+items.length>total)return false;
    this.items.splice(start,items.length,...items.map(p=>({...p})));
    this.calls.push({kind:'patch',key,start,count:items.length,total});return true;
  }
  patchFurnitureBatch(group:THREE.Group,key:string,patches:readonly {start:number;items:Placement[]}[],total:number,stamp:object):boolean {
    if(this.rejectPatch||this.group!==group||key!=='furniture'||this.items.length!==total||stamp!==this.stamp||patches.length===0)return false;
    let last=0;
    for(const patch of patches){
      if(!Number.isSafeInteger(patch.start)||patch.start<last||patch.start+patch.items.length>total)return false;
      last=patch.start+patch.items.length;
    }
    // All refusal guards are checked before touching a resident placement.
    for(const patch of patches)expect(this.patchFurniture(group,key,patch.start,patch.items,total,stamp)).toBe(true);
    return true;
  }
  asNative():BoxBatches {return this as unknown as BoxBatches;}
  asReference():ReferenceBatches {return this as unknown as ReferenceBatches;}
}
export function expected(world:World,cutaway=false):Placement[] {
  const recorder=new RecordingBatches();buildFurniture(world,new THREE.Group(),cutaway,recorder.asReference());return recorder.items;
}
/** The resident batch the zoned owner must hold: the historical placements,
 * zone by zone in the owner's layout, each zone followed by reserved slots. */
export function laidOut(world:World,owner:FurniturePresentation,cutaway=false):Placement[] {
  const layout=owner.layout();if(!layout)throw new Error('Furniture owner has no layout');
  const items=expected(world,cutaway),byId=new Map(world.structures.map(s=>[s.id,s] as const)),out:Placement[]=new Array(layout.total);
  let placed=0;
  for(const segment of layout.segments){
    const zone=items.filter(p=>furniturePlacementZone(p,byId)===segment.key);
    expect(zone.length).toBe(segment.count);placed+=zone.length;
    for(let i=0;i<segment.capacity;i++)out[segment.start+i]=i<zone.length?{...zone[i]!}:hiddenFurnitureSlot(segment.key);
  }
  expect(placed).toBe(items.length);
  return out;
}
export function mesh(group:THREE.Group):BoxMesh {
  expect(group.children.filter(c=>c.name==='furniture')).toHaveLength(1);
  return group.children.find(c=>c.name==='furniture') as BoxMesh;
}
function bytes(array:ArrayBufferView):number[] {
  return Array.from(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
}
export function boxState(group:THREE.Group):unknown {
  const m=mesh(group),attributes=m.geometry.attributes;
  return {children:group.children.map(c=>({name:c.name,visible:c.visible,castShadow:c.castShadow,receiveShadow:c.receiveShadow})),
    count:m.activeCount,capacity:m.instanceMatrix.count,matrix:bytes(m.instanceMatrix.array),color:bytes(m.colorBuffer.array),
    matrixVersion:m.instanceMatrix.version,colorVersion:m.colorBuffer.version,
    matrixUsage:m.instanceMatrix.usage,colorUsage:m.colorBuffer.usage,
    attributes:Object.keys(attributes).map(name=>{const a=attributes[name]!;return {name,itemSize:a.itemSize,normalized:a.normalized,
      count:a.count,array:bytes(a.array),...('offset' in a?{offset:a.offset,stride:a.data.stride}:{} )};}),
    index:m.geometry.index?bytes(m.geometry.index.array):null,
    bounds:{center:m.boundingSphere.center.toArray(),radius:m.boundingSphere.radius},
    materialType:(m.material as THREE.Material).type};
}
export function layout(group:THREE.Group):void {
  const m=mesh(group);
  for(let i=0;i<4;i++){
    const a=m.geometry.getAttribute(`boxMatrix${i}`) as THREE.InterleavedBufferAttribute;
    expect(a.data).toBe(m.instanceMatrix);expect(a.offset).toBe(i*4);expect(a.data.stride).toBe(16);
  }
  expect(m.geometry.getAttribute('boxColor')).toBe(m.colorBuffer);
}
