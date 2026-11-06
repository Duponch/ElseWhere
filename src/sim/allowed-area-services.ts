import {isPlayerCasket271,cryptosleepInteraction271} from './cryptosleep-state-271.ts';
import { captureAllowedArea,allowedAreaAllows,type AllowedAreaPolicy } from './allowed-area-state.ts';
import { bedSlotCell } from './bed-slots.ts';
import type { Cell,Pawn,World } from './types.ts';
import type { RecreationTask } from './recreation-rules.ts';
import { structureById } from './structure-navigation.ts';

/** Runtime admissions only. Transport keeps its existing physical guards. */
export function allowedAreaRecreationAllowed(world:World,pawn:Pawn,task:RecreationTask,policy:AllowedAreaPolicy|undefined=captureAllowedArea(world,pawn)):boolean {
  if(!policy)return true;
  if(task.activity==='read'){
    if(task.stage==='pickup'){
      const pile=world.piles.find(p=>p.id===task.bookId);
      return !!pile&&(pile.owner.type==='ground'?allowedAreaAllows(world,pawn,pile.owner,policy):(pile.owner.type==='pawn'||pile.owner.type==='inventory')&&pile.owner.pawnId===pawn.id);
    }
    // Like another admitted work contact, pickup can end just across a border.
    // The deferred seat decision still must choose an allowed real place.
    if(task.stage==='seat'&&task.phase==='active')return true;
    return allowedAreaAllows(world,pawn,task.target,policy);
  }
  if(task.activity==='party'){
    const active=world.party292?.active;
    return !!active&&task.partyStartedAtCore===active.startedAtCore&&allowedAreaAllows(world,pawn,active.site,policy)&&allowedAreaAllows(world,pawn,task.target,policy);
  }
  if(task.activity==='skygaze'||task.activity==='social-relax')return allowedAreaAllows(world,pawn,task.target,policy);
  // The object/patient is the actual target. Its physically valid interaction
  // position may lie across the boundary, like any other work contact.
  if(task.activity==='visit-sick'){
    const patient=world.pawns.find(p=>p.id===task.patientId);return !!patient&&allowedAreaAllows(world,pawn,patient,policy);
  }
  const building=structureById(world,task.buildingId);return !!building&&allowedAreaAllows(world,pawn,building,policy);
}

/** An admitted contact may stand outside. Carried patients/inputs can cross
 * outside cells; only their next real destination remains an admission target.
 * Installed sleep and ingestion retain their existing physical ownership. */
export function allowedAreaServicesAllowed(world:World,pawn:Pawn):boolean {
  const policy=captureAllowedArea(world,pawn);if(!policy)return true;
  const cell=(target:Cell|undefined)=>!!target&&allowedAreaAllows(world,pawn,target,policy);
  const patient=(id:number)=>cell(world.pawns.find(p=>p.id===id));
  const animal=(id:number)=>cell(world.wildlife?.animals.find(a=>a.id===id));
  const building=(id:number)=>cell(structureById(world,id));
  const source=(id:number|null|undefined)=>{
    if(id===undefined||id===null||id===0)return true;
    const pile=world.piles.find(p=>p.id===id);return !!pile&&pile.owner.type==='ground'&&cell(pile.owner);
  };
  const paste=(request:{dispenserId:number;spot:Cell;producedAt?:number}|undefined)=>!request||request.producedAt!==undefined
    ||building(request.dispenserId)&&cell(request.spot);
  const need=pawn.need;
  if(need?.kind==='sleep'&&need.phase==='travel'&&!cell(need.target))return false;
  if(need?.kind==='eat'&&need.phase!=='ingest'){
    if(need.phase==='pickup'&&(!source(need.sourcePileId)||!paste(need.paste)))return false;
    if(need.phase==='travel'&&need.dining&&!cell(need.dining.target))return false;
  }
  if(pawn.recreation.task&&!allowedAreaRecreationAllowed(world,pawn,pawn.recreation.task,policy))return false;
  if(pawn.heatRefuge&&!cell(pawn.heatRefuge.target))return false;
  if(pawn.research&&!building(pawn.research.stationId))return false;
  const tend=pawn.tend;
  if(tend&&(!patient(tend.patientId)||tend.phase==='pickup'&&!source(tend.medicine?.sourcePileId)))return false;
  const feed=pawn.feed;
  if(feed&&(!patient(feed.patientId)||feed.phase==='pickup'&&(!source(feed.sourcePileId)||!paste(feed.paste))))return false;
  const surgery=pawn.surgery;
  if(surgery){
    if(!patient(surgery.patientId))return false;
    if(surgery.phase==='pickup'&&!source(surgery.medicine?.sourcePileId))return false;
    if(surgery.ingredients?.some(i=>!cell(i.cell)||i.stage==='source'&&!source(i.pileId)))return false;
  }
  const cryptosleep=pawn.cryptosleepTask;
  if(cryptosleep){const c=structureById(world,cryptosleep.casketId);if(!c||!isPlayerCasket271(c)||!cell(cryptosleepInteraction271(c))||cryptosleep.action==='carry'&&cryptosleep.phase==='approach'&&!patient(cryptosleep.patientId!))return false;}
  const rescue=pawn.rescue;
  if(rescue&&!rescue.release){
    const bed=structureById(world,rescue.bedId);
    if(bed?.kind==='double-bed'?!cell(rescue.bedSlot===undefined?undefined:bedSlotCell(bed,rescue.bedSlot)):!building(rescue.bedId))return false;
    if(!rescue.arrest&&!rescue.capture&&rescue.phase==='approach'&&pawn.orders.active!=='rescue'&&!patient(rescue.patientId))return false;
  }
  const ward=pawn.ward;
  if(ward&&(!patient(ward.patientId)||ward.kind==='food'&&(!cell(ward.spot)||ward.phase==='pickup'&&!source(ward.sourcePileId))))return false;
  const care=pawn.animalCare;
  if(care&&(!animal(care.animalId)||care.phase==='pickup'&&!source(care.medicine?.sourcePileId)))return false;
  const animalFeed=pawn.animalFeed;
  if(animalFeed&&(!animal(animalFeed.animalId)||animalFeed.phase==='pickup'&&!source(animalFeed.sourcePileId)))return false;
  const animalRescue=pawn.animalRescue;
  if(animalRescue&&(!building(animalRescue.spotId)||animalRescue.phase==='approach'&&!animalRescue.forced&&!animal(animalRescue.animalId)))return false;
  const handling=pawn.animalHandling;
  if(handling){
    if(handling.kind!=='lead'||handling.phase==='approach'){if(!animal(handling.animalId))return false;}
    if(handling.kind==='lead'&&handling.phase==='gather'&&handling.gatherId!==undefined&&!animal(handling.gatherId))return false;
    if(handling.kind!=='lead'&&handling.phase==='pickup'&&!source(handling.sourcePileId))return false;
    if(handling.kind==='lead'&&handling.markerId!==undefined&&!building(handling.markerId))return false;
  }
  const hunt=pawn.hunting;
  if(hunt&&!animal(hunt.animalId)&&!(hunt.phase==='collect'&&source(hunt.animalId)))return false;
  return true;
}
