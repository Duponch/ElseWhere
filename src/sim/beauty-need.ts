import { daylilyBeauty } from './flower-pot.ts';
import { BeautyMap,BeautyMapCache,RoomBeautyCapture,floorBeauty,filthBeauty,groundObjectBeauty,markDefaultPerceptionCells,structureBeauty,type BeautyCell,type BeautyInput,type BeautyStructure } from './room-beauty.ts';
import type { RoomTopology } from './room-topology.ts';
import { TICKS_PER_DAY,type World } from './types.ts';
import { isShelfKind,shelfStorageCells } from './shelf-storage.ts';

export const BEAUTY_NEED_INTERVAL=20;
const RISE_PER_HOUR=32,FALL_PER_HOUR=8;

/** Build the beauty input from physical world entities. Keeping this adapter
 * shared prevents the inspector from drifting away from the need simulation:
 * `beautyMapAt` below reads the same contributions, in the same order, and
 * must change with it. */
export function worldBeautyInput(world:World):BeautyInput {
  const protectedCells=new Set(world.structures.filter(s=>isShelfKind(s.kind)).flatMap(s=>shelfStorageCells(s).map(c=>c.z*world.width+c.x)));
  const objects=[...world.piles.flatMap(p=>p.owner.type==='ground'?[{id:p.id,x:p.owner.x,z:p.owner.z,kind:p.kind,beauty:p.kind==='corpse'?-20:-4,visible:!protectedCells.has(p.owner.z*world.width+p.owner.x)}]:[]),
    ...world.packed.flatMap(p=>p.owner.type==='ground'?[{id:p.building.id,x:p.owner.x,z:p.owner.z,kind:'packed-furniture',beauty:-4}]:[]),
    ...world.structures.flatMap(s=>s.kind==='flower-pot'?[{id:s.id,x:s.x,z:s.z,kind:'flower',beauty:daylilyBeauty(s.flower?.plant)}]:[])];
  // The pot keeps its material/quality contribution; the plant is additional.
  // A baseBeauty override on a furniture kind is ignored by structureBeauty.
  return {width:world.width,height:world.height,tiles:world.tiles,structures:world.structures,filth:world.filth?.items,objects,version:Number(world.schemaVersion)};
}
export function captureWorldBeauty(world:World,topology:RoomTopology,cache=new BeautyMapCache()):RoomBeautyCapture {
  return new RoomBeautyCapture(cache.read(worldBeautyInput(world)),topology);
}

/** The map `captureWorldBeauty` reads (BeautyMapCache.read of worldBeautyInput),
 * computed only at the cells the default perception of `perceivers` reads;
 * every other cell reads 0.
 * Each needed cell receives the same contributions, added in the same order
 * (structures, filth, then ground piles, packed furniture and flower pots),
 * so it holds the same value. */
export function beautyMapAt(world:World,perceivers:readonly BeautyCell[]):BeautyMap {
  const width=world.width,height=world.height,tiles=world.tiles;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||tiles.length!==width*height)throw new RangeError('Invalid beauty map dimensions.');
  const size=width*height,version=Number(world.schemaVersion),needed=new Uint8Array(size);
  for(const cell of perceivers)markDefaultPerceptionCells(width,height,cell,needed);
  const inside=new Float64Array(size),outside=new Float64Array(size),thingsIn=new Float64Array(size),thingsOut=new Float64Array(size);
  for(let i=0;i<size;i++)if(needed[i]){
    const tile=tiles[i]!,value=floorBeauty(tile,false);inside[i]=value;
    outside[i]=!tile.floor&&(tile.terrain==='grass'||tile.terrain==='soil'||tile.terrain==='rich-soil'||tile.terrain==='gravel')?0:value;
  }
  const index=(cell:BeautyCell)=>Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<width&&cell.z<height?cell.z*width+cell.x:-1;
  for(const structure of world.structures as readonly BeautyStructure[]){const i=index(structure.beautyCell??structure);if(i<0||!needed[i])continue;const value=structureBeauty(structure,version);thingsIn[i]+=value;thingsOut[i]+=value;}
  for(const filth of world.filth?.items??[]){const i=index(filth);if(i<0||!needed[i])continue;thingsIn[i]+=filthBeauty(filth,false);thingsOut[i]+=filthBeauty(filth,true);}
  let protectedCells:Set<number>|undefined;
  for(const p of world.piles)if(p.owner.type==='ground'){
    const i=index(p.owner);if(i<0||!needed[i])continue;
    protectedCells??=new Set(world.structures.filter(s=>isShelfKind(s.kind)).flatMap(s=>shelfStorageCells(s).map(c=>c.z*world.width+c.x)));
    const value=groundObjectBeauty({x:p.owner.x,z:p.owner.z,beauty:p.kind==='corpse'?-20:-4,visible:!protectedCells.has(p.owner.z*world.width+p.owner.x)});thingsIn[i]+=value;thingsOut[i]+=value;
  }
  for(const p of world.packed)if(p.owner.type==='ground'){const i=index(p.owner);if(i<0||!needed[i])continue;const value=groundObjectBeauty({x:p.owner.x,z:p.owner.z,beauty:-4});thingsIn[i]+=value;thingsOut[i]+=value;}
  for(const s of world.structures)if(s.kind==='flower-pot'){const i=index(s);if(i<0||!needed[i])continue;const value=groundObjectBeauty({x:s.x,z:s.z,beauty:daylilyBeauty(s.flower?.plant)});thingsIn[i]+=value;thingsOut[i]+=value;}
  return new BeautyMap(width,height,inside,outside,thingsIn,thingsOut);
}

/** Samples the physical surroundings on a fixed simulation cadence. One map is
 * built for the colony and reused by every colonist in this pulse; it holds
 * the cells their perception reads (the full map's values there). */
export function advanceBeautyNeeds(world:World,topology:RoomTopology):void {
  if(world.schemaVersion<90||world.tick%BEAUTY_NEED_INTERVAL)return;
  const pawns=world.pawns.filter(pawn=>!(pawn.state==='dead'||pawn.state==='sleeping'||pawn.medicalSleep));
  const view=new RoomBeautyCapture(beautyMapAt(world,pawns),topology),step=BEAUTY_NEED_INTERVAL*24/TICKS_PER_DAY;
  for(const pawn of pawns){
    const perceived=view.perceived(pawn),target=Math.max(0,Math.min(100,40+perceived*10));
    pawn.beauty=target>pawn.beauty?Math.min(target,pawn.beauty+RISE_PER_HOUR*step):Math.max(target,pawn.beauty-FALL_PER_HOUR*step);
  }
}
