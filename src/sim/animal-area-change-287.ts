import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {animalAreaEffective287,animalAreaPolicyFromCells287} from './animal-area-policy-287.ts';
import {animalAreaProtected287} from './animal-area-runtime-287.ts';
import {registeredMapId} from './world-map-context.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {storageCells} from './shelf-storage.ts';
import {removalWritesMutable259,sealRemovalOriginal259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
import type {AnimalAreaChoice287} from './animal-area-state-287.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Cell,World} from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface AnimalAreaChange287 {animal:WildAnimal;choice:AnimalAreaChoice287|null;cells?:readonly number[]}
export type AnimalAreaChangePlan287={ok:false;reason:string}|{
 ok:true;noop:boolean;writes:readonly MapRemovalWrite259[];
 current():boolean;begin():boolean;adoptAdmitted():boolean;commit():boolean;
};
const physical=(w:World,a:WildAnimal)=>a.motion&&a.motion.end>w.tick?a.motion.from:a;
const ownPathJob=(a:WildAnimal)=>!!(a.meal||a.haul&&a.haul.phase!=='holding'||a.animalRest||a.eggLay||a.mating||a.predation||a.exiting||a.hiveJob||a.animalThermalRefuge288);

/** Prospective policy and cargo only. The finite placement view contains real
 * geometry/owners, never runs simulation or invents an actor/clinical World. */
function prepareWrites(w:World,changes:readonly AnimalAreaChange287[],prior:ReadonlyMap<number,Cell>):MapRemovalWrite259[]|undefined {
 const writes:MapRemovalWrite259[]=[],drafts=new Map<WildAnimal,WildAnimal>(),interruptedHauls=new Set<WildAnimal>();
 const put=(object:object,key:string,value:unknown,present=true)=>writes.push({object,key,present,value});
 let zones:ReturnType<typeof storageCells>|undefined;const mapId=registeredMapId(w);
 for(const row of changes){
  const a=row.animal;if(!w.wildlife?.animals.includes(a))return;
  const policy=animalAreaEffective287(w,a)?animalAreaPolicyFromCells287(w,row.choice,row.cells):undefined;
  const draft={...a},inside=(c:Cell)=>!policy||policy.has(c.z*w.width+c.x);
  let interrupted=false;
  if(!animalAreaProtected287(w,a)&&policy){
   if(a.meal){const source=a.meal.kind==='plant'?w.resources.find(p=>p.id===a.meal!.id):w.piles.find(p=>p.id===a.meal!.id)?.owner;
    if(source&&'x'in source&&!inside(source)){delete draft.meal;interrupted=true;}
   }
   if(a.animalRest){const spot=structureById(w,a.animalRest!.spotId);if(spot&&!inside(spot)){delete draft.animalRest;interrupted=true;if(draft.state==='sleeping')draft.state='idle';}}
   if(a.eggLay&&!inside(a.eggLay.target)){delete draft.eggLay;interrupted=true;}
   if(a.haul&&a.haul.phase!=='holding'){
    const task=a.haul,zone=(zones??=storageCells(w)).find(c=>c.id===task.destination.stockpileId),source=task.phase==='pickup'?w.piles.find(p=>p.id===task.sourcePileId):undefined;
    if(zone&&!inside(zone)||source?.owner.type==='ground'&&!inside(source.owner)){delete draft.haul;interruptedHauls.add(a);interrupted=true;}
   }
   if(draft.state==='sleeping'&&!a.sleepUntilCore&&!inside(a)){draft.state='idle';interrupted=true;}
   if(!ownPathJob(a)&&!a.animalAreaReturn287&&a.path.length&&!inside(a.path.at(-1)!)){interrupted=true;if(draft.wander?.job){draft.wander={...draft.wander};delete draft.wander.job;}}
  }
  if(a.animalAreaReturn287&&(!policy||animalAreaProtected287(w,a)||a.animalAreaReturn287.mapId!==mapId||!inside(a.animalAreaReturn287.target))){
   delete draft.animalAreaReturn287;if(!ownPathJob(a))interrupted=true;
  }
  if(a.animalThermalRefuge288&&(a.animalThermalRefuge288.mapId!==mapId||!inside(a.animalThermalRefuge288.target))){
   delete draft.animalThermalRefuge288;
   // A new owner may already have installed its own future route. Retire
   // only the old refuge route; never alter its committed physical edge.
   if(!ownPathJob(draft))interrupted=true;
  }
  if(interrupted){draft.path=[];draft.nextDecision=w.tick;if(draft.state==='moving'&&(a.motion?.end??0)<=w.tick)draft.state='idle';}
  drafts.set(a,draft);
 }
 if(interruptedHauls.size){
 const placement:World={...w,piles:w.piles.map(p=>({...p,owner:{...p.owner}})),packed:w.packed.map(p=>({...p,owner:{...p.owner}})),
  ...w.wildlife?{wildlife:{...w.wildlife,animals:w.wildlife.animals.map(a=>drafts.get(a)??a)}}:{}};
 for(const [id,cell]of prior){
  if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=w.width||cell.z>=w.height)return;
  const pile=placement.piles.find(p=>p.id===id),pack=placement.packed.find(p=>p.building.id===id);
  if(!!pile===!!pack)return;
  if(pile){
   const owner=pile.owner;
   if(owner.type!=='pawn'&&(owner.type!=='job'||!Number.isSafeInteger(owner.jobId)||owner.jobId<1||!w.jobs.some(job=>job.id===owner.jobId)))return;
   pile.owner={type:'ground',...cell};
  }
  else if(pack){if(pack.owner.type!=='pawn')return;pack.owner={type:'ground',...cell};}
 }
 // Every obsolete animal reservation is already absent from this view before
 // the first Near selection. Previous human drops occupy their admitted cells.
 for(const a of interruptedHauls){
  const task=a.haul!,draft=drafts.get(a)!;if(task.phase==='holding')return;
  if(task.carryPileId!==null){
   const original=w.piles.find(p=>p.id===task.carryPileId&&p.owner.type==='inventory'&&p.owner.pawnId===a.id),pile=placement.piles.find(p=>p.id===task.carryPileId&&p.owner.type==='inventory'&&p.owner.pawnId===a.id);
   if(!original||!pile)return;
   if(dropRetainingIdentity(placement,pile,physical(w,a)))put(original,'owner',pile.owner);
   else draft.haul={phase:'holding',carryPileId:original.id,sinceCore:w.tick*10};
  }
 }
 }
 for(const [a,draft]of drafts)for(const key of ['meal','animalRest','eggLay','haul','animalAreaReturn287','animalThermalRefuge288','path','nextDecision','state','wander'] as const){
  const present=Object.hasOwn(draft,key);if(present!==Object.hasOwn(a,key)||!Object.is(a[key],draft[key]))put(a,key,draft[key],present);
 }
 return writes;
}
/** All current/begin calls precede the FIRST composed policy/human/cargo
 * write. adoptAdmitted then applies this one preflighted phase exactly once. */
export function prepareAnimalAreaChange287(w:World,changes:readonly AnimalAreaChange287[],priorHumanDrops:ReadonlyMap<number,Cell>=new Map()):AnimalAreaChangePlan287 {
 if(!isSchema287OrLater(w.schemaVersion)||new Set(changes.map(r=>r.animal)).size!==changes.length)return {ok:false,reason:'Réconciliation des aires animales indisponible.'};
 try{
  const inputs=changes.map(r=>({...r,choice:r.choice?{...r.choice}:null,...r.cells?{cells:[...r.cells]}:{}})),prior=new Map([...priorHumanDrops].map(([id,c])=>[id,{...c}]));
  const writes=prepareWrites(w,inputs,prior);if(!writes||!removalWritesMutable259(writes))return {ok:false,reason:'Les détenteurs concernés ne peuvent pas conserver leur chargement.'};
  for(const write of writes)Object.freeze(write);Object.freeze(writes);
  const at=w.tick,seed=w.seed,rng=w.rng,version=w.schemaVersion,mapId=registeredMapId(w),before={pawns:w.pawns,piles:w.piles,packed:w.packed,structures:w.structures,jobs:w.jobs,resources:w.resources,animals:w.wildlife?.animals,home:w.home,areas:w.allowedAreas};
  const priorEntries=[...priorHumanDrops],seal=sealRemovalOriginal259(before,writes,[]),desiredSeal=sealRemovalOriginal259({inputs,requested:changes,prior:priorEntries,writes},[],[]);
  let admitted=false,used=false;
  const current=()=>!used&&!admitted&&w.schemaVersion===version&&isSchema287OrLater(w.schemaVersion)&&w.tick===at&&w.seed===seed&&w.rng===rng&&registeredMapId(w)===mapId
   &&Object.entries(before).every(([key,value])=>key==='animals'?w.wildlife?.animals===value:key==='areas'?w.allowedAreas===value:Reflect.get(w,key)===value)
   &&priorHumanDrops.size===priorEntries.length&&[...priorHumanDrops].every(([id,c],i)=>id===priorEntries[i]![0]&&c===priorEntries[i]![1])
   &&removalWritesMutable259(writes)&&seal(0)&&desiredSeal(0);
  const begin=()=>{if(!current())return false;admitted=true;return true;};
  const adoptAdmitted=()=>{if(!admitted||used||!removalWritesMutable259(writes))return false;used=true;
   for(const write of writes){if(write.present){if(!Reflect.set(write.object,write.key,write.value))throw Error('Admitted animal area write failed');}
    else if(!Reflect.deleteProperty(write.object,write.key))throw Error('Admitted animal area deletion failed');}
   return true;
  };
  return {ok:true,noop:writes.length===0,writes,current,begin,adoptAdmitted,commit:()=>begin()&&adoptAdmitted()};
 }catch{return {ok:false,reason:'Les propriétaires du changement d’aire ne sont pas représentables.'};}
}
