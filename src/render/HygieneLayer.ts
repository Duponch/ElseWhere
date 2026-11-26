import * as THREE from 'three/webgpu';
import type { World } from '../sim/types';
import {readSnapshotTileChanges} from '../bridge/snapshot-changes';
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
  ...Object.fromEntries(CARPET_FLOORS_355.map(id=>[id,carpetColor355(id).color])) as Record<CarpetFloor355,number>,'burned-carpet':0x3a2d2b,
  // Schema 365 straw matting (hay colour) and its burned floor.
  'straw-matting':0xc8ae62,'burned-straw-matting':0x3f3326};

/** Every tile owns exactly its cell. The authored plank joints meet rather
 * than exposing the natural terrain through deliberately undersized boxes. */
export function floorPartsForKind(floor:FloorKind,x:number,z:number):Placement[] {
  const color=floorColors[floor];
  // Original inset-colour panels, fully covering the cell in the existing
  // resident floor batch. No texture, material, per-frame owner or new layer.
  if(floor==='ancient-tile')return [-1,1].flatMap(dx=>[-1,1].map(dz=>({x:x+dx*.25,z:z+dz*.25,y:FLOOR_SURFACE_Y-.019,sx:.5,sy:.038,sz:.5,color:dx===dz?color:0x9caaa2})));
  if(floor==='ancient-concrete')return [{x,z,y:FLOOR_SURFACE_Y-.019,sx:1,sy:.038,sz:1,color:(Math.imul(x,17)+Math.imul(z,31))%5===0?0xa39f92:color}];
  if(floor==='wood-planks'||floor==='burned-wood')return Array.from({length:3},(_,plank)=>({x:x+(plank-1)/3,z,y:FLOOR_SURFACE_Y-.038/2,sx:1/3,sy:.038,sz:1,color}));
  // Woven straw: four strips per cell whose light/dark order flips from cell
  // to cell, a checker of hay. The strips meet at the cell edges like planks.
  if(floor==='straw-matting'||floor==='burned-straw-matting'){const shade=floor==='straw-matting'?0xb3974f:0x332a20,flip=(x+z)&1;
    return Array.from({length:4},(_,strip)=>({x:x+(strip-1.5)/4,z,y:FLOOR_SURFACE_Y-.038/2,sx:1/4,sy:.038,sz:1,color:(strip+flip)%2?shade:color}));}
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
  private world:World|undefined;
  readonly filth:FilthLayer;
  constructor(configure?:(m:THREE.MeshStandardNodeMaterial)=>void){this.filth=new FilthLayer(configure);this.group.add(this.filth.mesh);}
  update(world:World,batches:BoxBatches,reset=false):void {
    if(this.world)batches.setSpatialRanges?.(this.group,'hygiene-floors',undefined);
    this.world=undefined;this.apply(world,batches,reset);
  }
  /** Closed renderer application. Keep the endpoint of this producer's own
   * last successful application; an arbitrary changed-array argument cannot
   * certify floor reuse or survive a public read. */
  updateWorld(world:World,batches:BoxBatches,reset=false):void {
    const before=this.world;this.world=undefined;
    const changes=!reset&&before&&before!==world&&before.seed===world.seed&&before.width===world.width&&before.height===world.height
      ?readSnapshotTileChanges(before,world):undefined;
    this.apply(world,batches,reset,changes,true);this.world=world;
  }
  private apply(world:World,batches:BoxBatches,reset:boolean,changedTiles?:readonly number[],confirmed=false):void {
    let changed=reset;
    if(reset)this.floors.clear();
    // Bridge snapshots retain unchanged tile arrays. A new array triggers a
    // value comparison; no simulation revision or mutable cache is assumed.
    const updateFloor=(i:number):void=>{
      const tile=world.tiles[i]!,floor=tile.bridge?'bridge':tile.floor,old=this.floors.get(i);
      if(floor!==old){changed=true;if(floor)this.floors.set(i,floor);else this.floors.delete(i);}
    };
    if(!reset&&changedTiles)for(const i of changedTiles)updateFloor(i);
    else if(reset||confirmed||this.tiles!==world.tiles)for(let i=0;i<world.tiles.length;i++)updateFloor(i);
    this.tiles=world.tiles;
    if(changed){const parts:Placement[]=[],runs:{first:number;count:number;page:number}[]=[];
      const columns=Math.ceil(world.width/32);
      for(const [i,floor] of this.floors){
        const x=i%world.width,z=Math.floor(i/world.width),pieces=floor==='bridge'?bridgePartsForCell(x,z):floorPartsForKind(floor,x,z);
        if(confirmed){
          const page=(x>>>5)+(z>>>5)*columns,last=runs.at(-1);
          if(last?.page===page)last.count+=pieces.length;else runs.push({first:parts.length,count:pieces.length,page});
        }
        parts.push(...pieces);
      }
      batches.set(this.group,'hygiene-floors',parts,'solid',false);
      if(confirmed&&batches.setSpatialRanges){
        const ranges=[];
        if(parts.length>=256)for(const r of runs){
          const bounds=batches.readSpatialBounds(this.group,'hygiene-floors',r.first,r.count);
          if(!bounds){ranges.length=0;break;}
          ranges.push({first:r.first,count:r.count,bounds});
        }
        batches.setSpatialRanges(this.group,'hygiene-floors',ranges);
      }
    }
    if(confirmed)this.filth.updateWorld(world,reset);
    else this.filth.update(world.filth?.items??[],reset,world);
  }
  dispose():void {this.filth.dispose();}
}
