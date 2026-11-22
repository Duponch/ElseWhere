import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
/** Roof-only damage to the actual Mineable on the existing rock lane.
 * Use only inside the isolated roof transaction. No mining work/skill/yield is
 * credited for Crush; a retained old mining contribution remains literal. */
import {collapsedRockAt256,excavatedCollapsedRock256} from './collapsed-rocks-256.ts';
import {prepareRemovedFogMineable256,commitRemovedFogBlocker256} from './exploration-runtime-256.ts';
import {rockMaxHP,CHUNK_CHANCE,chunkItem} from './mining-rules.ts';
import {minedFloor,ORE_DEFINITIONS} from './ore.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {addGroundMaterial} from './materials.ts';
import {healthRandom} from './health.ts';
import {invalidateAnimalPens} from './animal-pens.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {reconcileRoofSupport} from './roofing.ts';
import {revertEnclosedSmoothedWalls367} from './smooth-wall-367.ts';
import type {World,Tile} from './types.ts';

export function damageRoofMineable256(world:World,index:number,original:Tile,amount:number,thick:boolean):boolean {
 if(world.schemaVersion<256||world.tiles[index]!==original||original.terrain!=='rock'||!Number.isSafeInteger(amount)||amount<=0)return false;
 const marker=collapsedRockAt256(original),ore=original.ore?ORE_DEFINITIONS[original.ore]:undefined;
 const damage=(original.miningDamage??0)+amount,max=rockMaxHP(original);
 if(!thick&&damage<max){
  world.tiles[index]={...original,miningDamage:damage,...ore&&original.miningYield===undefined?{miningYield:0}:{}};markTerrainCellChanged(world.tiles,index);
  return true;
 }
 // DestroyMined is deliberately NOT called: no miner or new contribution.
 // The zero-yield leaving rock restores its own substrate with no drop draw.
 const removed=prepareRemovedFogMineable256(world,index);
 if(marker){world.tiles[index]=excavatedCollapsedRock256(original);markTerrainCellChanged(world.tiles,index);}
 else{
  revertEnclosedSmoothedWalls367(world,index);
  const floor:Tile=original.mineable?minedFloor(original):{...original,...minedFloor(original)};delete floor.ore;delete floor.miningDamage;delete floor.miningYield;delete floor.mineable;delete floor.smoothedWall367;
  world.tiles[index]=floor;markTerrainCellChanged(world.tiles,index);
  const chance=ore?1:CHUNK_CHANCE,roll=healthRandom(world);
  if(roll<=chance){
   let quantity=1;
   if(ore){const raw=Math.fround(ore.yield*Math.fround(original.miningYield??0)),low=Math.floor(raw);quantity=Math.max(1,low+(healthRandom(world)<raw-low?1:0));}
   const item=ore?.item??chunkItem(original);
   addGroundMaterial(world,ITEM_DEFINITIONS[item].kind,quantity,{x:index%world.width,z:Math.floor(index/world.width)},item);
  }
 }
 // Mining designations refer to the destroyed Mineable, not to its future
 // replacement at the same cell. Never silently mine a new leaving rock.
 const jobs=new Set(world.jobs.filter(j=>j.kind==='mine'&&j.z*world.width+j.x===index).map(j=>j.id));
 if(jobs.size){
  world.jobs=world.jobs.filter(j=>!jobs.has(j.id));
  for(const pawn of world.pawns){
   if(pawn.jobId!==null&&jobs.has(pawn.jobId))interruptWork(world,pawn,true);
   pawn.orders.queue=pawn.orders.queue.filter(order=>typeof order!=='number'||!jobs.has(order));
  }
 }
 invalidateAnimalPens(world);
 // The surrounding roof transaction queues this physical support loss.
 reconcileRoofSupport(world,false,{x:index%world.width,z:Math.floor(index/world.width)});
 commitRemovedFogBlocker256(world,removed);
 return true;
}
