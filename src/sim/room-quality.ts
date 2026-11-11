import { roomWithoutStats303 } from './room-region-limit-303.ts';
import { isBedKind } from './bed-kinds.ts';
import { footprintCells } from './definitions.ts';
import { daylilyBeauty } from './flower-pot.ts';
import { floorBeauty,structureBeauty,filthBeauty,weightedBeautySize,beautyBand } from './room-beauty.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { FILTH_DEFINITIONS } from './filth-rules.ts';
import { isGrowingTerrain } from './soil.ts';
import { isRoofed } from './roof-rules.ts';
import { RoomTopologyCache,type RoomTopology } from './room-topology.ts';
import { roomImpressiveness,impressionStage } from './room-impressiveness.ts';
import { structureRoomMarketValue,floorRoomMarketValue,structureRoomStandable } from './room-market-value.ts';
import type { Cell,World } from './types.ts';

export interface RoomQuality {
  readonly id:number;readonly cells:ReadonlySet<number>;readonly adjacent:ReadonlySet<number>;
  readonly wealth:number;readonly space:number;readonly cleanliness:number;readonly beauty:number;
  readonly band:ReturnType<typeof beautyBand>;readonly total:number;readonly impressiveness:number;readonly stage:number;
  readonly beds:number;
}
const around=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;
const cardinal=[[0,-1],[-1,0],[1,0],[0,1]] as const;

/** A synchronous decision capture, never retained across a world mutation.
 * Only the requested enclosure is traversed; no four full-map beauty arrays.
 * Derived scores and geometry are never serialized. */
export class RoomQualityCapture {
  private readonly rooms=new Map<number,RoomQuality>();
  readonly world:World;readonly topology:RoomTopology;
  constructor(world:World,topology:RoomTopology){this.world=world;this.topology=topology;}
  room(cell:Cell):RoomQuality|null {
    const w=this.world,space=this.topology.at(cell.x,cell.z);
    if(space?.kind!=='space'||space.touchesMapEdge||roomWithoutStats303(this.world.schemaVersion,this.topology,space.id))return null;
    const cached=this.rooms.get(space.id);if(cached)return cached;
    const index=(c:Cell)=>c.z*w.width+c.x,cells=new Set<number>([index(cell)]),adjacent=new Set<number>(),queue=[index(cell)];
    for(let head=0;head<queue.length;head++){
      const i=queue[head]!,x=i%w.width,z=Math.floor(i/w.width);
      for(const [dx,dz] of cardinal){const next=this.topology.at(x+dx,z+dz);if(next?.kind==='space'&&next.id===space.id){const n=(z+dz)*w.width+x+dx;if(!cells.has(n)){cells.add(n);queue.push(n);}}}
      for(const [dx,dz] of around){const next=this.topology.at(x+dx,z+dz);if(next&&(next.kind==='solid'||next.kind==='doorway'))adjacent.add((z+dz)*w.width+x+dx);}
    }
    const contains=(i:number)=>cells.has(i)||adjacent.has(i);
    // Cleanliness includes only cardinal doorway objects, matching V89.
    const cleanBoundary=new Set<number>();
    for(const i of cells)for(const [dx,dz] of cardinal){const x=i%w.width+dx,z=Math.floor(i/w.width)+dz;if(this.topology.at(x,z)?.kind==='doorway')cleanBoundary.add(z*w.width+x);}
    const containsClean=(i:number)=>cells.has(i)||cleanBoundary.has(i);
    const cannotStand=new Set<number>();let wealth=0,totalBeauty=0,totalClean=0,beds=0;
    for(const i of cells){const tile=w.tiles[i]!;wealth+=floorRoomMarketValue(tile);totalBeauty+=floorBeauty(tile);totalClean+=tile.floor?FLOOR_DEFINITIONS[tile.floor].cleanliness:isGrowingTerrain(tile.terrain)?-1:0;}
    for(const s of w.structures){
      const footprint=footprintCells(s),inside=footprint.some(c=>cells.has(index(c)));
      if(!inside&&!footprint.some(c=>adjacent.has(index(c))))continue;
      wealth+=structureRoomMarketValue(s);
      if(contains(index(s)))totalBeauty+=structureBeauty(s)+(s.kind==='flower-pot'?daylilyBeauty(s.flower?.plant):0);
      if(inside&&isBedKind(s.kind))beds++;
      if(!structureRoomStandable(s.kind))for(const c of footprint)cannotStand.add(index(c));
      const dirt=s.kind==='electric-crematorium'?-20:s.kind==='fueled-smithy'||s.kind==='electric-smithy'?-3:s.kind==='machining-table'?-2:s.kind==='butcher-table'?-15:s.kind==='stonecutter'||s.kind==='art-bench'?-5:0;
      if(dirt&&footprint.some(c=>containsClean(index(c))||s.kind==='electric-crematorium'&&cardinal.some(([dx,dz])=>cells.has(index({x:c.x+dx,z:c.z+dz})))))totalClean+=dirt;
    }
    // Trees are pass-through, not standable, even though their market value
    // is zero. Wild herbs/crops and minified furniture do not reduce space.
    for(const r of w.resources)if(r.kind==='tree')cannotStand.add(index(r));
    for(const f of w.filth?.items??[]){if(contains(index(f)))totalBeauty+=filthBeauty(f);if(containsClean(index(f)))totalClean+=FILTH_DEFINITIONS[f.kind].cleanliness;}
    for(const p of w.piles)if(p.owner.type==='ground'){const i=index(p.owner);if(contains(i))totalBeauty+=p.item==='slag-steel-chunk'?-8:p.kind==='corpse'?-20:-4;if(p.kind==='chunk')cannotStand.add(i);}
    for(const pack of w.packed)if(pack.owner.type==='ground'&&contains(index(pack.owner)))totalBeauty-=4;
    for(const job of w.jobs)if(job.construction==='frame'&&job.kind!=='power-conduit'&&job.kind!=='lay-floor')for(const c of footprintCells(job))cannotStand.add(index(c));
    let usable=0;for(const i of cells){if(w.tiles[i]!.terrain==='water'||w.tiles[i]!.terrain==='rock')continue;usable+=cannotStand.has(i)?.5:1.4;}
    let unroofed=0;for(const i of cells)if(!isRoofed(w,i))unroofed++;
    const stats={wealth,space:unroofed>=300?350:Math.min(350,usable),cleanliness:totalClean/cells.size,beauty:totalBeauty/weightedBeautySize(cells.size)};
    const impressiveness=roomImpressiveness(stats),result={id:space.id,cells,adjacent,...stats,total:totalBeauty,band:beautyBand(stats.beauty),impressiveness,stage:impressionStage(impressiveness),beds};
    this.rooms.set(space.id,result);return result;
  }
}
const topologies=new WeakMap<World,RoomTopologyCache>();
export function captureRoomQuality(world:World):RoomQualityCapture {
  let cache=topologies.get(world);if(!cache){cache=new RoomTopologyCache();topologies.set(world,cache);}
  return new RoomQualityCapture(world,cache.read(world));
}
