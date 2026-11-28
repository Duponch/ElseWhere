import {isRoofed} from '../sim/roof-rules';
import { RoomQualityCapture,type RoomQuality } from '../sim/room-quality';
import { floorBeauty,structureBeauty,filthBeauty,type BeautyCell } from '../sim/room-beauty';
import { daylilyBeauty } from '../sim/flower-pot';
import { floorRoomMarketValue,structureRoomMarketValue,structureRoomStandable } from '../sim/room-market-value';
import { footprintCells } from '../sim/definitions';
import { naturalWallBeauty373 } from '../sim/rock-beauty-373';
import { smoothedWallMarketValue367 } from '../sim/smooth-wall-367';
import { isBedKind } from '../sim/bed-kinds';
import { FLOOR_DEFINITIONS } from '../sim/flooring';
import { FILTH_DEFINITIONS } from '../sim/filth-rules';
import { isGrowingTerrain } from '../sim/soil';
import type { RoomTopology } from '../sim/room-topology';
import type { World } from '../sim/types';

const cardinal=[[0,-1],[-1,0],[1,0],[0,1]] as const;
type LocalSignature=(number|string)[];

/** One inspected enclosure only. Compare copied, consumed values even when a
 * public World changes in place at the same tick. No retained capture can read
 * an old World after selection moves to another room. Distant contributors are
 * filtered before calculating their statistics or allocating signature rows. */
export class RoomBeautyInspection {
  private count=0;
  private signature:LocalSignature=[];
  private topology:RoomTopology|undefined;
  private quality:RoomQuality|undefined;
  private cleanBoundary=new Set<number>();
  get rebuilds():number {return this.count;}

  private localSignature(world:World,quality:RoomQuality):LocalSignature {
    const {cells,adjacent}=quality,values:LocalSignature=[];
    const index=(c:BeautyCell)=>c.z*world.width+c.x;
    const contains=(i:number)=>cells.has(i)||adjacent.has(i);
    const containsClean=(i:number)=>cells.has(i)||this.cleanBoundary.has(i);
    // Keep per-contributor ordering: the oracle's floating-point sums must not
    // be replaced by reordered or pre-aggregated totals.
    for(const i of cells){
      const tile=world.tiles[i]!;
      values.push(floorRoomMarketValue(tile),floorBeauty(tile),tile.floor?FLOOR_DEFINITIONS[tile.floor].cleanliness:isGrowingTerrain(tile.terrain)?-1:0,
        tile.terrain==='water'||tile.terrain==='rock'?1:0,isRoofed(world,i)?1:0);
    }
    // Bordering natural walls: smoothing one leaves the topology unchanged.
    values.push('walls');
    for(const i of adjacent){const tile=world.tiles[i]!;values.push(tile.terrain==='rock'?naturalWallBeauty373(tile,world.schemaVersion):0,smoothedWallMarketValue367(tile));}
    values.push('structures');
    for(const s of world.structures){
      const footprint=footprintCells(s),inside=footprint.some(c=>cells.has(index(c)));
      if(!inside&&!footprint.some(c=>adjacent.has(index(c))))continue;
      const dirt=s.kind==='electric-crematorium'?-20:s.kind==='machining-table'?-2:s.kind==='butcher-table'?-15:s.kind==='stonecutter'||s.kind==='art-bench'?-5:0;
      const clean=dirt&&footprint.some(c=>containsClean(index(c))||s.kind==='electric-crematorium'&&cardinal.some(([dx,dz])=>cells.has(index({x:c.x+dx,z:c.z+dz}))));
      values.push('structure',structureRoomMarketValue(s),contains(index(s))?structureBeauty(s)+(s.kind==='flower-pot'?daylilyBeauty(s.flower?.plant):0):0,
        inside&&isBedKind(s.kind)?1:0,clean?dirt:0);
      if(!structureRoomStandable(s.kind))for(const c of footprint)if(cells.has(index(c)))values.push(index(c));
    }
    values.push('trees');
    for(const r of world.resources)if(r.kind==='tree'&&cells.has(index(r)))values.push(index(r));
    values.push('filth');
    for(const f of world.filth?.items??[]){
      const i=index(f);if(!contains(i)&&!containsClean(i))continue;
      values.push(contains(i)?filthBeauty(f):0,containsClean(i)?FILTH_DEFINITIONS[f.kind].cleanliness:0);
    }
    values.push('piles');
    for(const p of world.piles)if(p.owner.type==='ground'){
      const i=index(p.owner);if(!contains(i))continue;
      values.push(p.item==='slag-steel-chunk'?-8:p.kind==='corpse'?-20:-4,p.kind==='chunk'&&cells.has(i)?i:-1);
    }
    values.push('packed');
    for(const pack of world.packed)if(pack.owner.type==='ground'&&contains(index(pack.owner)))values.push(-4);
    values.push('frames');
    for(const job of world.jobs)if(job.construction==='frame'&&job.kind!=='power-conduit'&&job.kind!=='hidden-conduit'&&job.kind!=='lay-floor')
      for(const c of footprintCells(job))if(cells.has(index(c)))values.push(index(c));
    return values;
  }

  read(world:World,topology:RoomTopology,cell:BeautyCell):RoomQuality|null {
    const room=topology.at(cell.x,cell.z);
    if(!room||room.kind!=='space'||room.touchesMapEdge)return null;
    const sameRoom=this.topology===topology&&this.quality?.id===room.id;
    if(sameRoom){
      const signature=this.localSignature(world,this.quality!);
      if(signature.length===this.signature.length&&signature.every((v,i)=>Object.is(v,this.signature[i])))return this.quality!;
    }
    // The synchronous oracle keeps source addition order and all historical
    // geometry/boundary rules. Retain only its immutable result, never World.
    const quality=new RoomQualityCapture(world,topology).room(cell)!;
    this.cleanBoundary=new Set();
    for(const i of quality.cells)for(const [dx,dz] of cardinal){
      const x=i%world.width+dx,z=Math.floor(i/world.width)+dz;
      if(topology.at(x,z)?.kind==='doorway')this.cleanBoundary.add(z*world.width+x);
    }
    this.quality=quality;this.topology=topology;this.signature=this.localSignature(world,quality);this.count++;
    return quality;
  }
}
