import * as THREE from 'three/webgpu';
import type { World } from '../sim/types';
import type { FloorKind } from '../sim/flooring';
import { FilthLayer } from './FilthLayer';
import type { BoxBatches } from './BoxBatches';
import type { Placement } from './primitives';
import { FLOOR_SURFACE_Y } from './surface-height';
import { bridgePartsForCell } from './bridge-parts';
import {isRoadFloor256} from '../sim/road-ground-256';
import {CARPET_FLOORS_355,carpetColor355,type CarpetFloor355} from '../sim/carpet-355';

const floorColors:Record<FloorKind,number>={'ancient-tile':0x8a9d9a,'ancient-concrete':0x99968b,'broken-asphalt':0x606766,'granite-flagstone':0x918c85,'limestone-flagstone':0xb5aa85,'marble-flagstone':0xc4c0b5,'sandstone-flagstone':0xb18a64,'slate-flagstone':0x626970,'wood-planks':0x98714a,'burned-wood':0x302c28,'granite-tile':0x918c85,'limestone-tile':0xb5aa85,'marble-tile':0xc4c0b5,'sandstone-tile':0xb18a64,'slate-tile':0x626970,'steel-tile':0x83989a,'sterile-tile':0xd4e0dc,
  // Schema 355 carpets: the Core Structure ColorDef of each, then the burned carpet.
  ...Object.fromEntries(CARPET_FLOORS_355.map(id=>[id,carpetColor355(id).color])) as Record<CarpetFloor355,number>,'burned-carpet':0x3a2d2b};

/** Every tile owns exactly its cell. The authored plank joints meet rather
 * than exposing the natural terrain through deliberately undersized boxes. */
export function floorPartsForKind(floor:FloorKind,x:number,z:number):Placement[] {
  const color=floorColors[floor];
  // Original inset-colour panels, fully covering the cell in the existing
  // resident floor batch. No texture, material, per-frame owner or new layer.
  if(floor==='ancient-tile')return [-1,1].flatMap(dx=>[-1,1].map(dz=>({x:x+dx*.25,z:z+dz*.25,y:FLOOR_SURFACE_Y-.019,sx:.5,sy:.038,sz:.5,color:dx===dz?color:0x9caaa2})));
  if(floor==='ancient-concrete')return [{x,z,y:FLOOR_SURFACE_Y-.019,sx:1,sy:.038,sz:1,color:(Math.imul(x,17)+Math.imul(z,31))%5===0?0xa39f92:color}];
  if(floor==='wood-planks'||floor==='burned-wood')return Array.from({length:3},(_,plank)=>({x:x+(plank-1)/3,z,y:FLOOR_SURFACE_Y-.038/2,sx:1/3,sy:.038,sz:1,color}));
  if(isRoadFloor256(floor)&&floor!=='broken-asphalt')return [
    {x:x-.25,z:z-.25,y:FLOOR_SURFACE_Y-.019,sx:.48,sy:.038,sz:.48,color},
    {x:x+.25,z:z-.25,y:FLOOR_SURFACE_Y-.019,sx:.48,sy:.038,sz:.48,color},
    {x,z:z+.25,y:FLOOR_SURFACE_Y-.019,sx:.98,sy:.038,sz:.48,color},
  ];
  return [{x,z,y:FLOOR_SURFACE_Y-.038/2,sx:1,sy:.038,sz:1,color}];
}

/** Floors reuse box batches, traces share one transparent instanced mesh. Changes do not rebuild the
 * natural terrain, compile materials, or retain mutable simulation objects. */
export class HygieneLayer {
  readonly group=new THREE.Group();
  private floors=new Map<number,FloorKind|'bridge'>();
  private tiles:World['tiles']|undefined;
  readonly filth:FilthLayer;
  constructor(configure?:(m:THREE.MeshStandardNodeMaterial)=>void){this.filth=new FilthLayer(configure);this.group.add(this.filth.mesh);}
  update(world:World,batches:BoxBatches,reset=false):void {
    let changed=reset;
    if(reset)this.floors.clear();
    // Bridge snapshots retain unchanged tile arrays. A new array triggers a
    // value comparison; no simulation revision or mutable cache is assumed.
    if(reset||this.tiles!==world.tiles)for(let i=0;i<world.tiles.length;i++){
      const tile=world.tiles[i]!,floor=tile.bridge?'bridge':tile.floor,old=this.floors.get(i);
      if(floor!==old){changed=true;if(floor)this.floors.set(i,floor);else this.floors.delete(i);}
    }
    this.tiles=world.tiles;
    if(changed){const parts:Placement[]=[];
      for(const [i,floor] of this.floors)parts.push(...(floor==='bridge'?bridgePartsForCell(i%world.width,Math.floor(i/world.width)):floorPartsForKind(floor,i%world.width,Math.floor(i/world.width))));
      batches.set(this.group,'hygiene-floors',parts,'solid',false);
    }
    this.filth.update(world.filth?.items??[],reset,world);
  }
  dispose():void {this.filth.dispose();}
}
