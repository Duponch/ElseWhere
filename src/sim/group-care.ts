import {animalConditionTreatmentBatch256} from './animal-condition-care-256.ts';
import {animalConditionStage256} from './animal-age-condition-data-256.ts';
import {tendAnimalAgeCondition256} from './animal-age-condition-runtime-256.ts';
import type {InitialAnimalRandom256} from './initial-animal-age-256.ts';
import {animalCareTargets} from './animal-care.ts';
import type {WildAnimal} from './wildlife-state.ts';
import {tendInjury,tendMissingPart} from './injury-state.ts';
import {tendInfection,captureInfectionTendRoom} from './infection-state.ts';
import {tendQuality} from './medicine-rules.ts';
import {groupPhysicalPawns256} from './group-mixed-pawns-256.ts';
import {recordCaravanInventoryEffect256} from './group-animal-food-256.ts';
import {groupCaravanUnitMass256} from './group-caravan-mass-256.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import type { GroupState } from './group-state.ts';
import type { Pawn } from './types.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { hasMentalBreak } from './mental-state.ts';
import { treatmentTargets,treatmentBatch,medicalTendQuality } from './care-rules.ts';
import { MEDICINES,isMedicine,medicineAllowed } from './medicine-rules.ts';
import { medicalBleed,medicalStatus } from './injury-state.ts';
import { BLOOD_UNIT } from './injury-rules.ts';
import { commercialItemMassGrams } from './commercial-mass.ts';
import { resolveHumanTendBatch } from './care-resolution.ts';
import type { GroupMassCapture } from './group-capture.ts';

type ActiveGroup=Extract<GroupState,{members:unknown}>;
export interface ConsumedGroupMass {massRemovedGrams:number;removed:{pawnId:number;grams:number}[]}
/** Source-owner deltas replace one capture after actual ingestion/tending.
 * Death changes membership/capacity and requires Root's new owner capture. */
export function applyConsumedGroupMass(mass:GroupMassCapture,results:readonly ConsumedGroupMass[]):GroupMassCapture {
  const byId=new Map(mass.carriers.map(c=>[c.pawnId,{...c}]));
  let removed=0;
  for(const result of results){
    let subtotal=0;
    for(const loss of result.removed){
      const owner=byId.get(loss.pawnId);
      if(!owner||!Number.isSafeInteger(loss.grams)||loss.grams<0||loss.grams>owner.grams)throw Error('Invalid consumed owner mass');
      owner.grams-=loss.grams;subtotal+=loss.grams;
    }
    if(!Number.isSafeInteger(subtotal)||subtotal!==result.massRemovedGrams)throw Error('Invalid consumed group mass');
    removed+=subtotal;
  }
  const carriers=[...byId.values()],grams=mass.grams-removed;
  if(!Number.isSafeInteger(grams)||grams<0||grams!==carriers.reduce((n,c)=>n+c.grams,0))throw Error('Invalid remaining group mass');
  return Object.freeze({grams,capacityGrams:mass.capacityGrams,...mass.ridingFactor!==undefined?{ridingFactor:mass.ridingFactor}:{},carriers:Object.freeze(carriers.map(c=>Object.freeze(c)))});
}
export interface GroupCareContext {
  tick:number;
  core256?:{tick:number;delta:number};
  onlyAnimals256?:true;
  random():number;
  /** World schema (flu tend duration from 317). */
  schemaVersion?:number;
}
/** Delta=10 Core. Local stable ID phase adapts Core's hash offset, without a
 * persisted cadence or tick+ID overflow. One consultation per crossing. */
export const groupDoctorTendDue=(person:Pawn,tick:number):boolean=>((tick%125)*10+person.id%1250)%1250<10;
/** Delivered infection/Flu/immune-disease definitions have lethalSeverity=1. The historical
 * Hediff.IsLethal getter is definition-based, not the extreme-stage threshold;
 * all their currently tendable cases therefore take the lethal priority. */
type Patient256=Pawn|WildAnimal;
const targets256=(person:Patient256)=>'species'in person?animalCareTargets(person):treatmentTargets(person);
const deliveredLethalTendable=(person:Patient256):boolean=>targets256(person).some(t=>{
  if('animalConditionId'in t){const actual=person.health?.animalAgeConditions?.cases.find(c=>c.id===t.animalConditionId);return !!actual&&animalConditionStage256(actual.kind,actual.severity).lifeThreatening===true;}
  return t.infectionId!==undefined||t.flu===true||t.disease!==undefined;
});
export function groupDoctorAllowed(group:ActiveGroup,doctor:Pawn,patient?:Patient256):boolean {
  return group.members.includes(doctor)&&doctor.state!=='dead'&&doctor.state!=='downed'&&
    (!doctor.health||medicalStatus(doctor.health)==='mobile')&&!hasMentalBreak(doctor)&&
    !backgroundWorkRefusal(doctor,'doctor')&&(doctor!==patient||doctor.selfTend===true);
}
export function humanGroupTendPriority(patient:Patient256,lethalTendable:boolean):number {
  const health=patient.health,bleed=health?medicalBleed(health):0;
  // medicalBleed is a full-blood fraction/day; 60000 Core/day. No future healing is guessed.
  const deathCore=bleed>0?(1-health!.bloodLoss/BLOOD_UNIT)/bleed*60000:Infinity;
  if(deathCore<15000)return 5-Math.max(0,deathCore)/15000;
  return lethalTendable?2.5:bleed>=.0001?1.5:.5;
}
/** Every admissible triggering doctor receives the certified hash consultation.
 * The chosen doctor can be someone else. No priorities, chevet or sleep filter. */
export function advanceGroupCare(group:ActiveGroup,c:GroupCareContext):ConsumedGroupMass {
  if(group.lastPersonalTick!==c.tick)throw Error('Care precedes group personal frontier');
  const removed:ConsumedGroupMass['removed']=[];
  for(const trigger of group.members){
    if(!groupDoctorAllowed(group,trigger)||!(c.core256?groupPawnInterval256(trigger.id,c.core256.tick,1250,c.core256.delta):groupDoctorTendDue(trigger,c.tick)))continue;
    const physical=group.animalOwners?groupPhysicalPawns256(group):group.members;
    const patients=(c.core256?physical:group.members).filter(p=>(!c.onlyAnimals256||'species'in p)&&p.state!=='dead'&&targets256(p).length)
      .map(p=>({p,rank:humanGroupTendPriority(p,deliveredLethalTendable(p))})).sort((a,b)=>b.rank-a.rank);
    let patient:Patient256|undefined,doctor:Pawn|undefined;
    for(const candidate of patients){
      let best=-1;
      for(const owner of group.members)if(groupDoctorAllowed(group,owner,candidate.p)){
        const stat=medicalTendQuality(owner);
        if(stat>best){best=stat;doctor=owner;}
      }
      if(doctor){patient=candidate.p;break;}
    }
    if(!patient||!doctor)continue;
    let medicine:ActiveGroup['items'][number]|undefined,bestPotency=-1;
    for(const pile of group.items){const owner=pile.owner;if(owner.type==='inventory'&&physical.some(p=>p.id===owner.pawnId&&p.state!=='dead')&&isMedicine(pile.item)&&('species'in patient?patient.domestic?.care==='best'||patient.domestic?.care==='industrial'&&MEDICINES[pile.item].potency<=1||patient.domestic?.care==='herbal'&&MEDICINES[pile.item].potency<=.6:medicineAllowed(patient,pile.item))){
      if(!Number.isSafeInteger(pile.quantity)||pile.quantity<1)throw Error('Invalid medicine inventory');
      if(MEDICINES[pile.item].potency>bestPotency){medicine=pile;bestPotency=MEDICINES[pile.item].potency;}
    }}
    const item=medicine&&isMedicine(medicine.item)?medicine.item:undefined;
    // Keep the animal condition discriminator through selection and commit.
    const animalBatch='species'in patient?animalConditionTreatmentBatch256(patient.health!,animalCareTargets(patient),!!item):undefined;
    const humanBatch='species'in patient?undefined:treatmentBatch(treatmentTargets(patient),!!item);
    if(!(animalBatch??humanBatch)!.length)continue;
    const sourceIndex=medicine?group.items.indexOf(medicine):-1,sourceOwner=medicine?.owner;
    const grams=item?(group.reorganization?groupCaravanUnitMass256(item,true):commercialItemMassGrams(item)):undefined;
    // Prospective medicinal masses are the resolved Core350g/500g profiles.
    if(medicine&&(sourceIndex<0||sourceOwner?.type!=='inventory'||grams===undefined))throw Error('Invalid medicine ownership/mass profile');
    const medicineUsed=group.ledger.medicineUsed+(item==='medicine'?1:0);
    if(!Number.isSafeInteger(medicineUsed)||medicineUsed<0)throw Error('Invalid medicine consumption counter');
    if(item&&item!=='medicine'&&(!group.reorganization||!Number.isSafeInteger((group.reorganization.inventoryEffects?.[item]??0)-1)))throw Error('Actual medicine effects exhausted');
    const record=structuredClone(patient.health!);
    // Preserve identity for self treatment: doctorDraft must be patientDraft when self.
    if('species'in patient){
      const f=Math.fround,rule=item?MEDICINES[item]:{potency:.3,maxQuality:.7};
      // Supply base quality; the clinical helper owns the actual variation.
      const quality=f(Math.max(0,Math.min(f(rule.maxQuality),f(f(medicalTendQuality(doctor))*f(rule.potency)))));
      const random:InitialAnimalRandom256={value:c.random,integer:(a,b)=>a+Math.floor(c.random()*(b-a)),float:(a,b)=>b<=a?a:f(f(f(c.random())*f(b-a))+a)};
      for(const target of animalBatch!){let applied=false;
        if('animalConditionId'in target)applied=tendAnimalAgeCondition256(record,target.animalConditionId,quality,rule.maxQuality,random);
        else if(target.injuryId!==undefined){applied=tendInjury(record,target.injuryId,tendQuality(medicalTendQuality(doctor),c.random(),false,item));if(record.injuries.some(i=>i.id===target.injuryId&&i.infection))captureInfectionTendRoom(record,target.injuryId,1000);}
        else if(target.infectionId!==undefined)applied=tendInfection(record,target.infectionId,tendQuality(medicalTendQuality(doctor),c.random(),false,item));
        else if(target.part!==undefined)applied=tendMissingPart(record,target.part);
        if(!applied)throw Error('Stale actual animal treatment target');
      }
    }else {const patientDraft={...patient,health:record},doctorDraft=doctor===patient?patientDraft:doctor;resolveHumanTendBatch(patientDraft,doctorDraft,humanBatch!,{schemaVersion:c.schemaVersion,random:c.random,awardJobXp:false,medicine:item,bedOffset:0,infectionRoomFactor:()=>1000});}
    if(item&&item!=='medicine')recordCaravanInventoryEffect256(group,item,-1);
    patient.health=record;
    if(medicine&&item){
      if(medicine.quantity===1)group.items.splice(sourceIndex,1);else medicine.quantity--;
      if(sourceOwner?.type!=='inventory'||grams===undefined)throw Error('Changed medicine ownership/profile');
      group.ledger.medicineUsed=medicineUsed;removed.push({pawnId:sourceOwner.pawnId,grams});
    }
  }
  const massRemovedGrams=removed.reduce((sum,r)=>sum+r.grams,0);
  if(!Number.isSafeInteger(massRemovedGrams))throw Error('Care mass overflow');
  return {massRemovedGrams,removed};
}
