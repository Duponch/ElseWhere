import {isSchema282OrLater} from './schema-compatibility-257.ts';
import {carryShapeBound379} from './carry-quantity-379.ts';
import {animalCore256,isAnimalSpecies256} from './animal-core-v256.ts';
import {animalTrainingDecayPeriodCore282} from './animal-training-282.ts';
import {ANIMAL_TRAINING_STEPS_282,type AnimalTrainingProgress282,type AnimalTrainingState282} from './animal-training-state-282.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {animalServiceIds} from './animal-rest-state.ts';
import {reservedSourcesByPile} from './materials.ts';
import {storageCells,type StorageCell} from './shelf-storage.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import {localWorldGroups} from './world-map-context.ts';
import type {MaterialPile,World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const plain=(v:unknown):v is Record<string,unknown>=>object(v)&&Object.getPrototypeOf(v)===Object.prototype;
const integer=(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const data=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&d.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const own=(v:object,k:string):unknown=>data(v,k)?.value;
const exact=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>!!data(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&!!data(v,k));
const core=(v:unknown,lo:number,hi:number):v is number=>integer(v,lo,hi)&&v%10===0;
const absent=(v:object,k:string)=>!Object.hasOwn(v,k)&&!(k in v);
const ZERO:Readonly<AnimalTrainingProgress282>=Object.freeze({steps:0,learned:false,wanted:false});
const MAX_STACK=Math.max(...Object.values(ITEM_DEFINITIONS).map(i=>i.stackLimit));
export interface AnimalTrainingSaveOptions282 {
 /** TRUE holder frontier, not the selected map's current time. */
 heldAt?:number;
 /** Optional GLOBAL original-human resolver. A local-only resolver is wrong
  * for a master who has genuinely left, died or entered another holder. */
 actualHuman?:(id:number)=>object|undefined;
}
function progress(v:unknown,max:number):v is AnimalTrainingProgress282 {
 return plain(v)&&exact(v,['steps','learned','wanted'])&&integer(v.steps,0,max)&&typeof v.learned==='boolean'&&typeof v.wanted==='boolean'
  &&(v.steps!==0||!v.learned)&&(v.steps!==max||v.learned);
}
function birthObedience(v:object):Readonly<AnimalTrainingProgress282> {
 const pet=own(v,'startingPet'),receipt=object(pet)?own(pet,'obedience'):undefined;
 // The existing starting-pet guard still validates the immutable receipt and
 // its original links. An explicit override always wins, including zero.
 return object(receipt)&&own(receipt,'steps')===3&&own(receipt,'wanted')===true?{steps:3,learned:true,wanted:true}:ZERO;
}

/** Only the prospective field, not another validation of the animal's body,
 * domestic state or World. Absence preserves every historical path. */
export function validAnimalTrainingField282(value:unknown,version:number,tick:number,nextId:number,options:AnimalTrainingSaveOptions282={}):boolean {
 try {
  if(!object(value))return false;
  if(absent(value,'training'))return true;
  if(!isSchema282OrLater(version)||!data(value,'training')||!plain(own(value,'training'))||!integer(tick)||!integer(nextId,1))return false;
  const raw=own(value,'training') as Record<string,unknown>;
  if(!exact(raw,['revision','sinceCore','lastLocalCore','nextDecayCore','tamenessWanted'],['obedience','haul','lastAttemptCore','masterId','lastHaulCheckCore'])||raw.revision!==1||typeof raw.tamenessWanted!=='boolean')return false;
  const held=options.heldAt;if(held!==undefined&&!integer(held,0,tick))return false;
  const ceiling=(held??tick)*10;if(!integer(ceiling))return false;
  if(!core(raw.sinceCore,0,ceiling)||!core(raw.lastLocalCore,raw.sinceCore,ceiling)||!integer(raw.nextDecayCore))return false;
  const species=own(value,'species');if(!isAnimalSpecies256(species)&&species!=='hare')return false;
  const period=animalTrainingDecayPeriodCore282(value as unknown as WildAnimal);
  if(period===undefined||!integer(raw.lastLocalCore+Math.max(period,450000))||raw.nextDecayCore>raw.lastLocalCore+Math.max(period,450000))return false;
  if(Object.hasOwn(raw,'lastAttemptCore')&&!core(raw.lastAttemptCore,0,raw.lastLocalCore))return false;
  if(Object.hasOwn(raw,'lastHaulCheckCore')&&!core(raw.lastHaulCheckCore,raw.sinceCore,raw.lastLocalCore))return false;
  if(Object.hasOwn(raw,'masterId')&&(!integer(raw.masterId,1,nextId-1)||raw.masterId===own(value,'id')||options.actualHuman&&!options.actualHuman(raw.masterId)))return false;
  if(Object.hasOwn(raw,'obedience')&&!progress(raw.obedience,ANIMAL_TRAINING_STEPS_282.obedience)||Object.hasOwn(raw,'haul')&&!progress(raw.haul,ANIMAL_TRAINING_STEPS_282.haul))return false;
  const state=raw as unknown as AnimalTrainingState282,obedience=state.obedience??birthObedience(value),haul=state.haul??ZERO;
  const intelligence=isAnimalSpecies256(species)?animalCore256(species).race.trainability:'None';
  if((obedience.steps>0||obedience.wanted)&&intelligence!=='Intermediate'&&intelligence!=='Advanced'||(haul.steps>0||haul.wanted)&&intelligence!=='Advanced')return false;
  if(obedience.wanted&&!state.tamenessWanted||haul.wanted&&(!obedience.wanted||!state.tamenessWanted))return false;
  // A started dependent protects its prerequisites from the single leaf
  // decay. Tameness itself is NOT reconstructed from the presence of skills:
  // losing faction preserves this original tracker while domestic disappears.
  if(haul.steps>0&&(!obedience.learned||obedience.steps!==ANIMAL_TRAINING_STEPS_282.obedience))return false;
  return true;
 }catch{return false;}
}

const cell=(v:unknown,width:number,height:number)=>plain(v)&&exact(v,['x','z'])&&integer(v.x,0,width-1)&&integer(v.z,0,height-1);
/** Shape of the MAP-LOCAL carry task only. Detached/caravan/casket callers
 * pass local=false: even holding must have been resolved to its true owner
 * before admission, and is never an off-map task. */
export function validAnimalHaulField282(value:unknown,version:number,tick:number,nextId:number,width:number,height:number,local=true):boolean {
 try {
  if(!object(value))return false;
  if(absent(value,'haul'))return true;
  if(!local||!isSchema282OrLater(version)||!data(value,'haul')||!plain(own(value,'haul'))||!integer(tick)||!integer(tick*10)||!integer(nextId,1)||!integer(width,1)||!integer(height,1))return false;
  const raw=own(value,'haul') as Record<string,unknown>,training=own(value,'training');
  if(!plain(training)||!core(training.sinceCore,0,tick*10)||!core(training.lastHaulCheckCore,training.sinceCore,tick*10))return false;
  if(raw.phase==='holding')return exact(raw,['phase','carryPileId','sinceCore'])&&integer(raw.carryPileId,1,nextId-1)&&raw.carryPileId!==own(value,'id')&&core(raw.sinceCore,training.lastHaulCheckCore,tick*10);
  if(!exact(raw,['sourcePileId','quantity','phase','destination','carryPileId','startedAtCore'],['pickupCell'])||!['pickup','deliver'].includes(String(raw.phase))
   ||!integer(raw.sourcePileId,1,nextId-1)||raw.sourcePileId===own(value,'id')||!integer(raw.quantity,1,version>=379?carryShapeBound379(version):MAX_STACK)||!core(raw.startedAtCore,training.sinceCore,tick*10)||raw.startedAtCore!==training.lastHaulCheckCore
   ||!plain(raw.destination)||!exact(raw.destination,['type','stockpileId'])||raw.destination.type!=='stockpile'||!integer(raw.destination.stockpileId,1,nextId-1))return false;
  return raw.phase==='pickup'?raw.carryPileId===null&&!Object.hasOwn(raw,'pickupCell'):
   integer(raw.carryPileId,1,nextId-1)&&raw.carryPileId!==own(value,'id')&&cell(raw.pickupCell,width,height);
 }catch{return false;}
}

interface LocalView282 {
 piles:ReadonlyMap<number,MaterialPile>;
 storage:ReadonlyMap<number,StorageCell>;
 claims:ReadonlySet<number>;
 sourceReservations:ReadonlyMap<number,number>;
}
export interface AnimalTrainingSaveCapture282 {valid(animal:WildAnimal):boolean}
/** One synchronous map-local validation capture, discarded before any write.
 * Ordinary shape/ID/material validators remain authoritative. No pathfinder,
 * anatomy, nutrition, present CarryingCapacity or whole-World validator runs
 * here. The human training job has its own guard in the service module. */
export function captureAnimalTrainingSave282(w:World,actualHuman?:AnimalTrainingSaveOptions282['actualHuman']):AnimalTrainingSaveCapture282 {
 const locals=w.wildlife?.animals??[],originals=new Set(locals);let allShapes=true;
 for(const a of locals)if(!validAnimalTrainingField282(a,w.schemaVersion,w.tick,w.nextId,{actualHuman})||!validAnimalHaulField282(a,w.schemaVersion,w.tick,w.nextId,w.width,w.height))allShapes=false;
 let captured:LocalView282|undefined;
 const view=()=>{
  if(!captured){
   const claims=new Set<number>();for(const p of w.pawns)for(const id of animalServiceIds(p))claims.add(id);
   const groups=new Set([...localWorldGroups(w).map(row=>row.state),...(w.group?[w.group]:[])]);
   for(const g of groups){if('manifest'in g)for(const line of g.animalPreparation?.lines??[])claims.add(line.animalId);else if(g.phase==='unloading')for(const id of g.animalIds??[])claims.add(id);}
   captured={piles:new Map(w.piles.map(p=>[p.id,p])),storage:new Map(storageCells(w).map(c=>[c.id,c])),claims,sourceReservations:reservedSourcesByPile(w)};
  }
  return captured;
 };
 return {valid(a:WildAnimal):boolean {
  try {
   if(!allShapes||!originals.has(a))return false;
   const task=a.haul;if(!task)return true;
   const state=a.training;if(!state||a.shipCryptosleepHeldAt277!==undefined)return false;
   const facts=view(),carried=task.phase==='pickup'?undefined:facts.piles.get(task.carryPileId!);
   if(task.phase==='holding')return !!carried&&carried.owner.type==='inventory'&&carried.owner.pawnId===a.id;
   const obedience=state.obedience??birthObedience(a),haul=state.haul??ZERO;
   if(!a.domestic||a.state==='dead'||!haul.learned||!obedience.learned||facts.claims.has(a.id)||a.meal||a.animalRest||a.eggLay||a.mating||a.predation||a.wander?.job||a.hiveJob)return false;
   if(!facts.storage.has(task.destination.stockpileId))return false;
   const pile=task.phase==='pickup'?facts.piles.get(task.sourcePileId):carried;
   if(!pile||pile.kind==='corpse'||pile.kind==='mech-corpse'||pile.kind==='unfinished'||groupCaravanPileMass256(pile,true,w.schemaVersion)===undefined||task.quantity>ITEM_DEFINITIONS[pile.item].stackLimit)return false;
   if(task.phase==='pickup'){
    const reserved=facts.sourceReservations.get(pile.id)??0;
    return pile.owner.type==='ground'&&pile.quantity>=task.quantity&&reserved>=task.quantity&&reserved<=pile.quantity;
   }
   return pile.owner.type==='inventory'&&pile.owner.pawnId===a.id&&pile.quantity===task.quantity;
  }catch{return false;}
 }};
}

/** Local transport join. Historical detached lanes are separately enumerated
 * by their existing owner guards, using the field functions above. */
export function validAnimalTrainingTransport282(w:World,actualHuman?:AnimalTrainingSaveOptions282['actualHuman']):boolean {
 try {
  const animals=w.wildlife?.animals??[];
  if(!animals.some(a=>'training'in a||'haul'in a))return true;
  const capture=captureAnimalTrainingSave282(w,actualHuman);return animals.every(a=>capture.valid(a));
 }catch{return false;}
}
