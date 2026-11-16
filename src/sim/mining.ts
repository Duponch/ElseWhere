import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import {effectiveMineableYield347} from './game-profile.ts';
import {collapsedRockAt256,excavatedCollapsedRock256} from './collapsed-rocks-256.ts';
import {prepareRemovedFogMineable256,commitRemovedFogBlocker256} from './exploration-runtime-256.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { ORE_DEFINITIONS, minedFloor } from './ore.ts';
import { PICK_DAMAGE, pickDuration, CHUNK_CHANCE, rockMaxHP, chunkItem } from './mining-rules.ts';
import { addMaterial } from './materials.ts';
import { groundCapacity } from './ground-placement.ts';
import type { Job, Pawn, World } from './types.ts';
import { advanceWork, setWorkUnits, WORK_FRACTIONS } from './work-progress.ts';
import { invalidateAnimalPens } from './animal-pens.ts';
import { learnMining, miningWorkSpeed, miningYield } from './mining-skills.ts';
import type { BodyAssessment } from './body-capacities.ts';
import { medicallyStopped } from './health-rules.ts';

/** Returns true after excavation. Rock damage belongs to the tile, pick cadence
 * to the reserved job. Preview the RNG/drop before committing the final hit. */
export function advanceMining(world:World,pawn:Pawn,job:Job,lightFactor:()=>number=()=>1,body?:BodyAssessment):boolean {
  const i=job.z*world.width+job.x,tile=world.tiles[i]!;
  if(tile.terrain!=='rock'||medicallyStopped(pawn)||pawn.motion&&pawn.motion.end>world.tick||Math.max(Math.abs(pawn.x-job.x),Math.abs(pawn.z-job.z))!==1)return false;
  if(miningWorkSpeed(pawn,body)<=0)return false;
  pawn.path=[];pawn.state='working';
  // Core captures the first stroke before Learn. Later strokes capture the
  // current level only after the real tick's learning and successful contact.
  const strokeDuration=()=>pickDuration(miningWorkSpeed(pawn,body,lightFactor()));
  job.pickTicks??=strokeDuration();
  learnMining(pawn);
  advanceWork(job,1);
  const elapsed=job.progress*WORK_FRACTIONS+(job.workRemainder??0),duration=job.pickTicks*WORK_FRACTIONS/10;
  if(elapsed<duration)return false;
  // Carry the sub-tick overshoot instead of rounding every stroke to 10 Hz.
  setWorkUnits(job,elapsed-duration);
  // The successful final hit removes this job: do not rebuild illumination just
  // to capture a stroke that will never happen, after another miner opened rock.
  const nextStroke=()=>{job.pickTicks=strokeDuration();return false;};
  const priorDamage=tile.miningDamage??0,maxHP=rockMaxHP(tile),damage=priorDamage+PICK_DAMAGE;
  const ore=tile.ore?ORE_DEFINITIONS[tile.ore]:undefined;
  // A double-precision local accumulator, normalized to fifteen decimals,
  // adapts Core's float accumulator. The overkilling part of the final 80 damage
  // contributes nothing. An old damaged ore has neutral prior contribution.
  const contribution=ore?Math.min(1.25,Math.round(((tile.miningYield??priorDamage/maxHP)
    +Math.min(PICK_DAMAGE,maxHP-priorDamage)/maxHP*miningYield(pawn,body))*1e15)/1e15):undefined;
  if(damage<maxHP){world.tiles[i]={...tile,miningDamage:damage,...contribution!==undefined?{miningYield:contribution}:{}};markTerrainCellChanged(world.tiles,i);return nextStroke();}
  if(collapsedRockAt256(tile)){const removed=prepareRemovedFogMineable256(world,i);world.tiles[i]=excavatedCollapsedRock256(tile);markTerrainCellChanged(world.tiles,i);invalidateAnimalPens(world);commitRemovedFogBlocker256(world,removed,job.id);return true;}
  let rng=world.rng;rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;
  // Preserve one local global draw per extraction, including integral yields.
  // Core's separate drop and rounding draws are explicitly adapted here.
  const roll=rng/0x100000000;
  // Core EffectiveMineableYield: RoundToInt(yield x mineYieldFactor) (Easy 1.2).
  const rawQuantity=ore?effectiveMineableYield347(world,ore.yield)*contribution!:0;
  const nearest=Math.round(rawQuantity),roundedQuantity=Math.abs(rawQuantity-nearest)<=1e-12?nearest:rawQuantity;
  const baseQuantity=Math.floor(roundedQuantity);
  const quantity=ore?Math.max(1,baseQuantity+(roll<roundedQuantity-baseQuantity?1:0)):roll<CHUNK_CHANCE?1:0;
  const item=ore?.item??chunkItem(tile),kind=ITEM_DEFINITIONS[item].kind;
  // A solid cell cannot contain an item. Validate the future floor in an isolated
  // one-cell view, retaining all live destination/service reservations.
  const floor=minedFloor(tile);
  if(quantity) {
    if(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return nextStroke();
    const tiles=world.tiles.slice();tiles[i]=floor;
    if(groundCapacity({...world,tiles},job,item)<quantity)return nextStroke();
  }
  const removed=prepareRemovedFogMineable256(world,i);
  world.tiles[i]=floor;markTerrainCellChanged(world.tiles,i);world.rng=rng;invalidateAnimalPens(world);
  if(quantity)addMaterial(world,kind,quantity,{type:'ground',x:job.x,z:job.z},item);
  commitRemovedFogBlocker256(world,removed,job.id);
  return true;
}
