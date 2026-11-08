import { footprintCells } from './definitions.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { FILTH_DEFINITIONS } from './filth-rules.ts';
import { isGrowingTerrain } from './soil.ts';
import { RoomTopologyCache,type RoomTopology } from './room-topology.ts';
import { isRoofed,roofIdentity,sameRoofIdentity,type RoofIdentity } from './roof-rules.ts';
import { terrainWriteCount } from './terrain-mutation-journal.ts';
import type { Cell,World } from './types.ts';
import { filteredStructures } from './structure-navigation.ts';

const caches=new WeakMap<World,RoomTopologyCache>();
const neighbors=(c:Cell):Cell[]=>[{x:c.x-1,z:c.z},{x:c.x+1,z:c.z},{x:c.x,z:c.z-1},{x:c.x,z:c.z+1}];
export interface CleanlinessRoom {id:number;cells:ReadonlySet<number>;adjacent:ReadonlySet<number>;covered:number;cleanliness:number;doorway:boolean}
/** One synchronous read. Rooms are computed only when requested; outdoors is
 * rejected before any flood or object aggregation. Never retain across mutation. */
const CLEANLINESS_SOURCES=new Set<string>(['spike-trap','electric-crematorium','hydroponics-basin','fueled-smithy','electric-smithy','machining-table','butcher-table','stonecutter','art-bench']);
const isCleanlinessSource=(s:World['structures'][number]):boolean=>CLEANLINESS_SOURCES.has(s.kind);
/* Flood of one room: its cells, the adjacent cells, the flood order and the
 * roofed count. It depends only on the immutable topology (labels), the room,
 * the starting cell and the roofs, so it is shared across captures while the
 * roof arrays are unchanged. Tiles are NOT part of it: the floor/soil sum is
 * re-read on every capture, in the same flood order, so the total is the very
 * same sequence of additions as a fresh flood. */
interface RoomShape {roofs:RoofIdentity;width:number;start:number;order:Int32Array;cells:ReadonlySet<number>;adjacent:ReadonlySet<number>;covered:number}
const roomShapes=new WeakMap<RoomTopology,Map<number,RoomShape>>();
function roomShape(w:World,topology:RoomTopology,id:number,index:number):RoomShape {
  const roofs=roofIdentity(w);let shapes=roomShapes.get(topology);
  const cached=shapes?.get(id);
  if(cached&&cached.width===w.width&&cached.start===index&&sameRoofIdentity(cached.roofs,roofs))return cached;
  const cells=new Set<number>([index]),adjacent=new Set<number>(),queue=[index];let covered=0;
  for(let head=0;head<queue.length;head++){
    const i=queue[head]!,c={x:i%w.width,z:Math.floor(i/w.width)};
    if(isRoofed(w,i))covered++;
    for(const next of neighbors(c)){
      const n=next.z*w.width+next.x,r=topology.at(next.x,next.z);if(!r)continue;
      if(r.kind==='space'&&r.id===id){if(!cells.has(n)){cells.add(n);queue.push(n);}}
      else adjacent.add(n);
    }
  }
  const shape:RoomShape={roofs,width:w.width,start:index,order:Int32Array.from(queue),cells,adjacent,covered};
  if(!shapes){shapes=new Map();roomShapes.set(topology,shapes);}shapes.set(id,shape);return shape;
}
/* Where a computed room's total stood after its filth: the room's flood start,
 * its membership test, the running total after the floors and the filth (in
 * this order), and how many filth items it covered. */
interface FilthProgress {start:number;epoch:number;contains:(i:number)=>boolean;afterFilth:number;filth:number}
export class CleanlinessCapture {
  readonly world:World;readonly topology:RoomTopology;
  private rooms=new Map<number,CleanlinessRoom>();
  private progress=new Map<number,FilthProgress>();
  /* extendFilth() starts a new epoch: rooms computed before it are brought up
   * to date on their next request, as a fresh capture would compute them. */
  private epoch=0;
  private readonly items:NonNullable<World['filth']>['items']|undefined;
  private readonly tiles:World['tiles'];private readonly tileWrites:number;private readonly roofs:RoofIdentity;
  constructor(world:World,topology:RoomTopology){
    this.world=world;this.topology=topology;this.items=world.filth?.items;
    this.tiles=world.tiles;this.tileWrites=terrainWriteCount(world.tiles);this.roofs=roofIdentity(world);
  }
  /** After filth was only appended to the same array (deposits push, removals
   * replace the array), lets the rooms already computed resume their filth sum
   * where it stopped. A room resumes only from the same flood start, then
   * re-adds its slag and source terms: the very same sequence of additions as
   * a fresh capture. Refused (false) when the tiles, roofs or filth array
   * changed; the caller then makes a fresh capture. */
  extendFilth():boolean {
    const w=this.world,items=w.filth?.items;
    if(!items||items!==this.items||w.tiles!==this.tiles||terrainWriteCount(w.tiles)!==this.tileWrites||!sameRoofIdentity(this.roofs,roofIdentity(w)))return false;
    this.epoch++;return true;
  }
  room(cell:Cell):CleanlinessRoom|null {
    const w=this.world,space=this.topology.at(cell.x,cell.z);
    // A doorway or exterior may have a Room, but no ProperRoom stat map.
    if(!space||space.kind!=='space'||space.touchesMapEdge)return null;
    const doorway=false,index=cell.z*w.width+cell.x,id=space.id,cached=this.rooms.get(id);
    if(cached){
      const progress=this.progress.get(id)!;
      if(progress.epoch===this.epoch)return cached;
      if(progress.start===index){
        // Only appended filth since: same floors, flood and filth prefix.
        const items=w.filth?.items??[];let total=progress.afterFilth;
        for(let k=progress.filth;k<items.length;k++){const f=items[k]!;if(progress.contains(f.z*w.width+f.x))total+=FILTH_DEFINITIONS[f.kind].cleanliness;}
        progress.afterFilth=total;progress.filth=items.length;progress.epoch=this.epoch;
        const result={...cached,cleanliness:this.sourcesTotal(total,progress.contains,cached.cells)/cached.cells.size};this.rooms.set(id,result);return result;
      }
      // Another flood start: computed afresh, as a fresh capture would.
    }
    const shape=roomShape(w,this.topology,id,index),{cells,adjacent,covered}=shape;let total=0;
    for(let k=0;k<shape.order.length;k++){const tile=w.tiles[shape.order[k]!]!;total+=tile.floor?FLOOR_DEFINITIONS[tile.floor].cleanliness:isGrowingTerrain(tile.terrain)?-1:0;}
    // Region lists include boundary objects, not every object across an open
    // adjacent room. The only nonzero adjacent surface in this slice is a door.
    const contains=(i:number)=>cells.has(i)||adjacent.has(i)&&this.topology.at(i%w.width,Math.floor(i/w.width))?.kind==='doorway';
    const items=w.filth?.items??[];
    for(const f of items)if(contains(f.z*w.width+f.x))total+=FILTH_DEFINITIONS[f.kind].cleanliness;
    this.progress.set(id,{start:index,epoch:this.epoch,contains,afterFilth:total,filth:items.length});
    total=this.sourcesTotal(total,contains,cells);
    const result={id,cells,adjacent,covered,cleanliness:total/cells.size,doorway};this.rooms.set(id,result);return result;
  }
  /** The slag and cleanliness-source terms, added after the filth. */
  private sourcesTotal(total:number,contains:(i:number)=>boolean,cells:ReadonlySet<number>):number {
    const w=this.world;
    for(const p of w.piles)if(p.item==='slag-steel-chunk'&&p.owner.type==='ground'&&contains(p.owner.z*w.width+p.owner.x))total-=2;
    // Only these kinds contribute (value 0 otherwise); same source order.
    for(const s of filteredStructures(w,'room-cleanliness-sources',isCleanlinessSource)){const value=s.kind==='spike-trap'?-5:s.kind==='electric-crematorium'?-20:s.kind==='hydroponics-basin'?-3:s.kind==='fueled-smithy'||s.kind==='electric-smithy'?-3:s.kind==='machining-table'?-2:s.kind==='butcher-table'?-15:s.kind==='stonecutter'||s.kind==='art-bench'?-5:0;if(value&&footprintCells(s).some(c=>contains(c.z*w.width+c.x)||s.kind==='electric-crematorium'&&neighbors(c).some(n=>cells.has(n.z*w.width+n.x))))total+=value;}
    return total;
  }
}
export function captureCleanliness(w:World):CleanlinessCapture {
  let cache=caches.get(w);if(!cache){cache=new RoomTopologyCache();caches.set(w,cache);}return new CleanlinessCapture(w,cache.read(w));
}
export const roomCleanliness=(w:World,c:Cell,capture=captureCleanliness(w)):number|null=>capture.room(c)?.cleanliness??null;
