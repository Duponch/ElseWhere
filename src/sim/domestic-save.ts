import {ROPE_STRETCH_WAIT377,ROPE_WORK_TICKS377,TRAIL_CELLS377} from './animal-leading-377.ts';
import {validReleaseDesignation364,validReleaseWildTask364} from './execute-release-364.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {startingPetFourNoTamenessDecay256} from './starting-pet-four-tameness-256.ts';
import {isAnimalSpecies256} from './animal-core-v256.ts';
import {PEN_ANIMALS_256} from './animal-domestic-v256.ts';
import { handlingFoodAllowed, handlingFoodCollectable, handlingFeedUnits, handlingStepDuration, canTameSpecies } from './animal-handling.ts';
import { leadRopees,leadingClaimIds,livestock,MAX_ROPEES } from './animal-leading.ts';
import { penRegion } from './animal-pens.ts';
import { animalProductDefinition, productKind } from './animal-products.ts';
import { isColonist } from './affiliation.ts';
import { isMedicine, MEDICAL_CARE } from './medicine-rules.ts';
import { reservedSource } from './materials.ts';
import { medicineClaims } from './medicine-logistics.ts';
import { veterinaryCareSpeciesAllowed } from './veterinary-rules.ts';
import { ANIMAL_FEED_TICKS,animalFeedPlaceValid } from './animal-feeding-rules.ts';
import { animalPileFood } from './wildlife-food.ts';
import {validAnimalTrainingService282} from './animal-training-service-282.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { workPriority } from './work-types.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { SLAUGHTER_WORK_TICKS,slaughterContact,slaughterHandlerAvailable } from './animal-slaughter.ts';
import { autoSlaughterTargets,slaughterIntent } from './auto-slaughter.ts';
import type { Pawn,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';

const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const finite=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
/** Schema 377 leading timers and the handler's trail (animal-leading-377):
 * a timer belongs to a rope already held, never longer than its Core wait. */
const validLead377=(w:World,h:Record<string,unknown>):boolean=>{
  const core=w.tick*10+(Number.isSafeInteger(w.phaseCore297)?Number(w.phaseCore297):0),held=Array.isArray(h.ropees)&&h.ropees.length>0;
  return (h.ropeUntil377===undefined||held&&h.phase==='lead'&&int(h.ropeUntil377,0,core+ROPE_WORK_TICKS377))
    &&(h.ropeWait377===undefined||held&&int(h.ropeWait377,0,core+ROPE_STRETCH_WAIT377))
    &&(h.trail377===undefined||Array.isArray(h.trail377)&&h.trail377.length<=TRAIL_CELLS377
      &&h.trail377.every(c=>obj(c)&&keys(c,['x','z'])&&int(c.x,0,w.width-1)&&int(c.z,0,w.height-1)));
};
const productForVersion=(a:WildAnimal,version:number)=>version>=121?productKind(a):a.species==='muffalo'?'shear':a.species==='dromedary'&&a.sex==='female'?'milk':undefined;
const productReadyForVersion=(a:WildAnimal,version:number)=>!!a.domestic&&!!productForVersion(a,version)&&(a.domestic.productFullness??0)>=1;

function validDomesticOwner(w:Pick<World,'tick'|'nextId'>&Partial<Pick<World,'structures'>>,a:WildAnimal,version:number):boolean {
  const d:unknown=a.domestic;
  return (!isAnimalSpecies256(a.species)||version>=256)&&version>=106&&(a.species==='hare'||version>=256&&isAnimalSpecies256(a.species)||version>=119&&livestock(a))&&obj(d)&&keys(d,['since','care','tameness','nextDecay'],version>=120?['lastTraining','penMarkerId','productFullness',...(version>=220?['slaughter']:[]),...(version>=221?['bedId']:[]),...(version>=364?['release364']:[])]:version>=119?['lastTraining','penMarkerId']:['lastTraining'])
    &&int(d.since,0,w.tick)&&typeof d.care==='string'&&Object.hasOwn(MEDICAL_CARE,d.care)&&int(d.tameness,1,5)
    &&int(d.nextDecay,0,w.tick+45000)&&(d.lastTraining===undefined||int(d.lastTraining,d.since,w.tick))
    &&(version>=120?(productForVersion(a,version)?finite(d.productFullness,0,1):d.productFullness===undefined):d.productFullness===undefined)
    &&(!Object.hasOwn(d,'slaughter')||version>=220&&d.slaughter===true)
    &&validReleaseDesignation364(d,version)
    &&(!Object.hasOwn(d,'bedId')||version>=221&&int(d.bedId,1,w.nextId-1)&&!!w.structures?.some(s=>s.id===d.bedId&&s.kind==='animal-sleeping-spot'&&!s.medical))
    &&(d.penMarkerId===undefined||version>=119&&livestock(a)&&int(d.penMarkerId,1,w.nextId-1)&&!!w.structures?.find(s=>s.id===d.penMarkerId&&s.kind==='pen-marker'&&s.pen?.accepted.includes(a.species)));
}

/** New irreversible work shares the file and transport admission. Availability
 * can change before ordinary reconciliation; transient animal danger is not a
 * corruption. The designation, handler and exclusive ownership are durable. */
function validSlaughterTask(w:World,p:Pawn,version:number,targets?:ReadonlySet<number>):boolean {
  const raw:unknown=p.animalHandling;
  if(!obj(raw)||raw.kind!=='slaughter')return true;
  if(version<220||!keys(raw,['animalId','kind','phase','sourcePileId','carryPileId','quantity','step','progress'],version>=378?['forced378']:[])
    ||Object.hasOwn(raw,'forced378')&&(version<378||raw.forced378!==true)
    ||!int(raw.animalId,1,w.nextId-1)||!['approach','interact'].includes(String(raw.phase))
    ||raw.sourcePileId!==0||raw.carryPileId!==null||raw.quantity!==0||raw.step!==0
    ||!int(raw.progress,0,SLAUGHTER_WORK_TICKS-1)||raw.phase==='approach'&&raw.progress!==0)return false;
  const animal=w.wildlife?.animals.find(a=>a.id===raw.animalId);
  if(!animal||!validDomesticOwner(w,animal,version)||!slaughterIntent(w,animal,version,targets)||animal.state==='dead'||animal.health?.death)return false;
  if(!slaughterHandlerAvailable(p)||p.prisoner||p.visitor||p.raid||p.podRescue||p.need||p.haul||p.cooking||p.hunting||p.research
    ||p.ward||p.feed||p.tend||p.surgery||p.rescue||p.animalRescue||p.equipmentTask||p.burial||p.cleaning||p.firefighting||p.jobId!==null
    ||p.melee||p.shooting?.order||p.tactics||p.trade||p.orbitalTrade||p.deepWork||p.recreation.task||p.animalCare||p.animalFeed
    ||p.orders.active!==null||p.orders.queue.length&&!(version>=378&&raw.forced378===true)||p.priorityWork||!['moving','working','idle'].includes(p.state)
    ||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))return false;
  if(w.pawns.some(other=>other!==p&&(other.animalRescue?.animalId===animal.id||other.animalCare?.animalId===animal.id||other.animalFeed?.animalId===animal.id
    ||other.animalHandling&&leadingClaimIds(other.animalHandling).includes(animal.id))))return false;
  return raw.phase!=='interact'||p.state==='working'&&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick
    &&(animal.motion?.end??0)<=w.tick&&!p.path.length&&slaughterContact(w,p,animal);
}

export function validSlaughterTransport(w:World,version:number):boolean {
  try {
    for(const a of w.wildlife?.animals??[])if(a.domestic&&Object.hasOwn(a.domestic,'slaughter')&&!validDomesticOwner(w,a,version))return false;
    const targets=autoSlaughterTargets(w,version);
    return w.pawns.every(p=>validSlaughterTask(w,p,version,targets));
  }catch{return false;}
}

/** Persistent intent may outlive transient patient availability until reconcile.
 * Validate only the care task and its actual owners, without a pen/world scan. */
function validVeterinaryTask(w:World,p:Pawn,version:number):boolean {
  try {
  const c:unknown=p.animalCare;
  if(c===undefined)return true;
  if(!obj(c)||!keys(c,['animalId','spot','phase','progress'],['medicine','duration'])||!int(c.animalId,1,w.nextId-1))return false;
  const a=w.wildlife?.animals.find(a=>a.id===c.animalId);
  if(!a||!veterinaryCareSpeciesAllowed(a.species,version,a)||!validDomesticOwner(w,a,version)
    ||!obj(c.spot)||!keys(c.spot,['x','z'])||!int(c.spot.x,0,w.width-1)||!int(c.spot.z,0,w.height-1)
    ||!['pickup','approach','treat'].includes(String(c.phase))||!finite(c.progress,0)
    ||(c.phase==='treat'?!finite(c.duration,1,6000)||Number(c.progress)>=Number(c.duration):c.duration!==undefined||c.progress!==0))return false;
  if(!isColonist(p)||p.prisoner||p.visitor||p.draft||p.mental?.crisis||p.interruptedCargo||p.need||p.haul||p.cooking||p.hunting||p.research||p.ward||p.feed||p.tend||p.surgery||p.rescue||p.animalRescue||p.equipmentTask||p.burial||p.cleaning||p.firefighting||p.jobId!==null||p.melee||p.flee||p.recreation.task||p.orders.active!==null||p.animalHandling||p.animalFeed||p.priorities.doctor===0||!['moving','working','idle'].includes(p.state))return false;
  if(w.pawns.some(other=>other!==p&&(other.animalRescue?.animalId===a.id||other.animalCare?.animalId===a.id||other.animalFeed?.animalId===a.id||other.animalHandling&&leadingClaimIds(other.animalHandling).includes(a.id))))return false;
  const m=c.medicine;
  const held=w.piles.filter(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
  if(m===undefined)return c.phase!=='pickup'&&!held.length;
  if(!obj(m)||!keys(m,['item','sourcePileId','carryPileId','quantity'])||!isMedicine(m.item as never)||!int(m.sourcePileId,1,w.nextId-1)
    ||!(m.carryPileId===null||int(m.carryPileId,1,w.nextId-1))||!int(m.quantity,1,25))return false;
  const pile=w.piles.find(i=>i.id===(c.phase==='pickup'?m.sourcePileId:m.carryPileId));
  return !!pile&&pile.item===m.item&&(c.phase==='pickup'?m.carryPileId===null&&!held.length&&pile.owner.type==='ground'&&reservedSource(w,pile.id)<=pile.quantity
    &&(version<212||medicineClaims(w,pile.id)<=10):held.length===1&&pile.owner.type==='pawn'&&pile.owner.pawnId===p.id&&pile.quantity===m.quantity);
  }catch{return false;}
}

export function validVeterinaryCareTransport(w:World,version:number):boolean {
  try{return w.pawns.every(p=>validVeterinaryTask(w,p,version));}catch{return false;}
}

/** Validate the acquired food and mandate, not temporary hunger or posture.
 * Damage, waking and danger can occur before the next ordinary reconciliation. */
function validAnimalFeedTask(w:World,p:Pawn,version:number):boolean {
  const raw:unknown=p.animalFeed;
  if(!Object.hasOwn(p,'animalFeed'))return true;
  if(version<214||!obj(raw)||!keys(raw,['animalId','spot','sourcePileId','carryPileId','quantity','phase','progress'])
    ||!int(raw.animalId,1,w.nextId-1)||!int(raw.sourcePileId,1,w.nextId-1)||!int(raw.quantity,1,75)
    ||!obj(raw.spot)||!keys(raw.spot,['x','z'])||!int(raw.spot.x,0,w.width-1)||!int(raw.spot.z,0,w.height-1)
    ||!['pickup','deliver','feed'].includes(String(raw.phase))||!int(raw.progress,0,ANIMAL_FEED_TICKS-1)
    ||raw.phase!=='feed'&&raw.progress!==0||(raw.phase==='pickup'?raw.carryPileId!==null:!int(raw.carryPileId,1,w.nextId-1)))return false;
  const a=w.wildlife?.animals.find(a=>a.id===raw.animalId),task=p.animalFeed!;
  if(!a||!veterinaryCareSpeciesAllowed(a.species,version,a)||!validDomesticOwner(w,a,version)||!animalFeedPlaceValid(w,task,a))return false;
  if(!isColonist(p)||p.prisoner||p.visitor||p.raid||p.podRescue||p.draft||p.mental?.crisis||p.interruptedCargo
    ||p.need||p.haul||p.cooking||p.hunting||p.research||p.ward||p.feed||p.tend||p.surgery||p.rescue||p.animalRescue||p.equipmentTask
    ||p.burial||p.cleaning||p.firefighting||p.jobId!==null||p.melee||p.shooting?.order||p.tactics||p.flee||p.trade
    ||p.recreation.task||p.orders.active!==null||p.orders.queue.length||p.priorityWork||p.animalHandling||p.animalCare
    ||workPriority(p,'doctor')===0||medicalWorkRefusal(p))return false;
  if(w.pawns.some(other=>other!==p&&(other.animalRescue?.animalId===a.id||other.animalCare?.animalId===a.id||other.animalFeed?.animalId===a.id
    ||other.animalHandling&&leadingClaimIds(other.animalHandling).includes(a.id))))return false;
  const food=w.piles.find(i=>i.id===(task.phase==='pickup'?task.sourcePileId:task.carryPileId));
  const held=w.piles.filter(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
  if(!food||!animalPileFood(w,a,food)||food.kind!=='food'||task.quantity>ITEM_DEFINITIONS[food.item].maxIngest
    ||(task.phase==='pickup'?food.owner.type!=='ground'||held.length!==0||reservedSource(w,food.id)>food.quantity:
      held.length!==1||held[0]!==food||food.owner.type!=='pawn'||food.owner.pawnId!==p.id||food.quantity!==task.quantity))return false;
  return task.phase==='feed'?p.state==='working'&&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick&&!p.path.length&&p.x===task.spot.x&&p.z===task.spot.z:p.state==='moving';
}

/** Both clinical animal services share their real patient and cargo claims.
 * No full-world, pen or navigation census is added to snapshot admission. */
export function validDomesticTasksTransport(w:World,version:number):boolean {
  try{return validSlaughterTransport(w,version)&&w.pawns.every(p=>validVeterinaryTask(w,p,version)&&validAnimalFeedTask(w,p,version));}catch{return false;}
}

/** Shape and ownership remain separate from transient availability: an animal
 * can be harmed between accepting an order and its next simulation step. */
export function validateDomesticAnimals(w:World,version:number):string[] {
  const errors:string[]=[],claimed=new Set<number>();
  if(!validSlaughterTransport(w,version))errors.push('Invalid or future animal slaughter ownership.');
  if(w.pawns.some(p=>Object.hasOwn(p,'animalFeed'))&&!validDomesticTasksTransport(w,version))errors.push('Invalid animal medical feeding or care ownership.');
  for(const a of w.wildlife?.animals??[]){
    const d:unknown=a.domestic,t:unknown=a.taming;
    if(d!==undefined&&!validDomesticOwner(w,a,version))errors.push('Invalid domestic animal.');
    if(t!==undefined&&!(version>=106&&(a.species==='hare'||version>=119&&canTameSpecies(a.species))&&obj(t)&&keys(t,['designated'],['lastAttempt'])&&typeof t.designated==='boolean'
      &&(t.lastAttempt===undefined||int(t.lastAttempt,0,w.tick))&&(!a.domestic||!t.designated)))errors.push('Invalid taming designation.');
    if(a.domestic&&w.hunting?.targets.includes(a.id))errors.push('Domestic animal is designated for hunting.');
  }
  for(const p of w.pawns){
    const h:unknown=p.animalHandling,c:unknown=p.animalCare;
    if(version>=106?!int(p.priorities.handle,0,4):p.priorities.handle!==undefined)errors.push('Invalid animal handling priority.');
    if(h===undefined&&c===undefined)continue;
    if(version<106){errors.push('Legacy pawn contains animal work.');continue;}
    const base=(t:Record<string,unknown>)=>int(t.animalId,1,w.nextId-1)&&w.wildlife?.animals.some(a=>a.id===t.animalId&&(a.species==='hare'||version>=119&&canTameSpecies(a.species)));
    const lead=obj(h)&&h.kind==='lead';
    const slaughter=obj(h)&&h.kind==='slaughter';
    const release=obj(h)&&h.kind==='release';
    const product=obj(h)&&(h.kind==='milk'||h.kind==='shear');
    const training=obj(h)&&h.kind==='train';
    if(h!==undefined&&!(training?validAnimalTrainingService282(w,p,version):slaughter?validSlaughterTask(w,p,version):release?validReleaseWildTask364(w,p,version):lead
      ?version>=119&&keys(h,['animalId','kind','markerId','phase','sourcePileId','carryPileId','quantity','step','progress'],version>=135?['ropees','gatherId',...(version>=377?['ropeUntil377','ropeWait377','trail377']:[])]:[])&&base(h)
        &&validLead377(w,h)&&int(h.markerId,1,w.nextId-1)&&['approach','lead',...(version>=135?['gather']:[])].includes(String(h.phase))
        &&h.sourcePileId===0&&h.carryPileId===null&&h.quantity===0&&h.step===0&&h.progress===0
        &&(h.ropees===undefined||version>=135&&Array.isArray(h.ropees)&&h.ropees.length>=1&&h.ropees.length<=MAX_ROPEES
          &&h.ropees.every(id=>int(id,1,w.nextId-1))&&new Set(h.ropees).size===h.ropees.length&&h.ropees.includes(Number(h.animalId))
          &&h.phase!=='approach')
        &&(h.gatherId===undefined?h.phase!=='gather':version>=135&&h.phase==='gather'&&Array.isArray(h.ropees)
          &&h.ropees.length<MAX_ROPEES&&int(h.gatherId,1,w.nextId-1)&&!h.ropees.includes(Number(h.gatherId)))
      :product
      ?version>=120&&keys(h,['animalId','kind','sourcePileId','carryPileId','quantity','phase','step','progress'])&&base(h)
        &&['approach','interact'].includes(String(h.phase))&&h.sourcePileId===0&&h.carryPileId===null&&h.quantity===0&&h.step===0
        &&finite(h.progress,0,(animalProductDefinition(w.wildlife!.animals.find(a=>a.id===h.animalId)!)?.work??0))&&Number(h.progress)<(animalProductDefinition(w.wildlife!.animals.find(a=>a.id===h.animalId)!)?.work??0)
      :obj(h)&&keys(h,['animalId','kind','sourcePileId','carryPileId','quantity','phase','step','progress'],version>=378?['forced378']:[])&&base(h)
      &&(!Object.hasOwn(h,'forced378')||version>=378&&h.forced378===true&&h.kind==='tame')
      &&['tame','maintain'].includes(String(h.kind))&&['pickup','approach','interact'].includes(String(h.phase))
      &&int(h.sourcePileId,1,w.nextId-1)&&(h.carryPileId===null||int(h.carryPileId,1,w.nextId-1))&&int(h.quantity,0,12)
      &&int(h.step,0,5)&&int(h.progress,0,handlingStepDuration(h as unknown as import('./domestic-state.ts').AnimalHandlingTask,w.wildlife!.animals.find(a=>a.id===h.animalId)!.species)-1)
      &&(h.phase==='interact'||h.progress===0&&(h.phase==='approach'||h.step===0)))) {errors.push('Invalid animal handling task.');continue;}
    if(c!==undefined&&!validVeterinaryTask(w,p,version)) {errors.push('Invalid animal care task.');continue;}
    const task=p.animalHandling??p.animalCare!;
    for(const id of p.animalHandling?new Set(leadingClaimIds(p.animalHandling)):[task.animalId]){
      if(claimed.has(id))errors.push('Animal is reserved twice.');claimed.add(id);
    }
    if(!isColonist(p)||p.prisoner||p.visitor||p.draft||p.mental?.crisis||p.interruptedCargo||p.need||p.haul||p.cooking||p.hunting||p.research||p.ward||p.feed||p.tend||p.rescue||p.animalRescue||p.equipmentTask||p.burial||p.cleaning||p.firefighting||p.jobId!==null||p.melee||p.flee||p.recreation.task||p.orders.active!==null||!['moving','working','idle'].includes(p.state)
      ||p.animalFeed||h&&c||h&&p.priorities.handle===0&&!(version>=378&&p.animalHandling?.forced378===true)||c&&p.priorities.doctor===0)errors.push('Animal work conflicts with another activity.');
    const a=w.wildlife!.animals.find(a=>a.id===task.animalId)!;
    if(p.animalHandling){
      const t=p.animalHandling;
      if(t.kind==='train')continue;
      if(t.kind==='slaughter')continue;
      if(t.kind==='release')continue;
      if(t.kind==='lead'){
        const region=t.markerId===undefined?undefined:penRegion(w,t.markerId);
        if(!a.domestic||!livestock(a)||!region||!region.closed||!region.accessible||a.domestic.penMarkerId!==t.markerId
          ||!w.structures.some(s=>s.id===t.markerId&&s.kind==='pen-marker'&&s.pen?.accepted.includes(a.species)))errors.push('Invalid animal leading task.');
        for(const id of [...leadRopees(t),...(t.gatherId===undefined?[]:[t.gatherId])]){
          const member=w.wildlife?.animals.find(item=>item.id===id);
          if(!member?.domestic||!livestock(member)||member.state==='dead'||member.state==='downed'
            ||!w.structures.some(s=>s.id===t.markerId&&s.kind==='pen-marker'&&s.pen?.accepted.includes(member.species))
            ||id!==t.gatherId&&member.domestic.penMarkerId!==t.markerId)errors.push('Invalid animal leading member.');
        }
        continue;
      }
      if(t.kind==='milk'||t.kind==='shear'){
        if(!a.domestic||productForVersion(a,version)!==t.kind||!productReadyForVersion(a,version)||a.state==='dead'||a.state==='downed')errors.push('Invalid animal product task.');
        continue;
      }
      if(t.kind==='tame'?!a.taming?.designated||!!a.domestic:!a.domestic)errors.push('Animal handling has no matching designation.');
      if(t.kind==='maintain'&&(startingPetFourNoTamenessDecay256(a.species)||a.species!=='hare'&&!(version>=256&&isAnimalSpecies256(a.species)&&!PEN_ANIMALS_256.includes(a.species))))errors.push('Roaming livestock or zero-wildness pet has no tameness maintenance.');
      const pile=w.piles.find(i=>i.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
      const units=handlingFeedUnits(a.species,pile?.item);
      if(t.quantity!==(t.step<3?units*2:t.step<5?units:0))errors.push('Animal food does not match interaction stage.');
      if(t.quantity===0?(t.step!==5||t.carryPileId!==null):!pile||!(t.phase==='pickup'?handlingFoodCollectable(w,pile.item,a):handlingFoodAllowed(w,pile.item,a))
        ||(t.phase==='pickup'?t.carryPileId!==null||t.quantity!==units*2||pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity:pile.owner.type!=='pawn'||pile.owner.pawnId!==p.id||pile.quantity!==t.quantity))errors.push('Animal food ownership mismatch.');
    }
  }
  return errors;
}

export function validDetachedDomesticAnimal(a:WildAnimal,tick:number,nextId:number,version=255):boolean {return a.domestic===undefined||validDomesticOwner({tick,nextId},a,version);}

/** Scalar clock with the real local structures, solely for an actual held owner. */
export function validHeldDomesticAnimal277(a:WildAnimal,tick:number,nextId:number,version:number,structures:World['structures']):boolean {return isSchema277OrLater(version)&&(a.domestic===undefined||validDomesticOwner({tick,nextId,structures},a,version));}
