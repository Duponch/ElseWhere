import {tendAnimalAgeCondition256} from './animal-age-condition-runtime-256.ts';
import {animalClinicalRandom256} from './animal-condition-medical-frontier-256.ts';
import {MEDICINES} from './medicine-rules.ts';
import { medicalTendQuality,treatmentTargets,type RankedTreatment } from './care-rules.ts';
import { learnSkill } from './skills.ts';
import { tendQuality,tendXp,type MedicineItem } from './medicine-rules.ts';
import { tendInjury,tendMissingPart } from './injury-state.ts';
import { tendInfection,captureInfectionTendRoom } from './infection-state.ts';
import { tendFlu } from './flu-state.ts';
import { tendImmuneDisease } from './immune-diseases-state.ts';
import { isParasiteKind306,tendParasite306 } from './parasites-306.ts';
import type { Pawn } from './types.ts';

export interface HumanTendContext {
  random():number;
  /** True only for the completed local Toils_Tend provider. Caravan DoTend bypasses that Toil. */
  awardJobXp:boolean;
  medicine?:MedicineItem;
  /** Actual occupied hospital bed only. Off-map owner without a delivered bed supplies zero. */
  bedOffset:number;
  infectionRoomFactor():number;
}
const key=(t:RankedTreatment)=>'animalConditionId'in t?`condition:${t.animalConditionId}`:t.injuryId!==undefined?`injury:${t.injuryId}`:
  t.infectionId!==undefined?`infection:${t.infectionId}`:t.flu?'flu':t.disease?`disease:${t.disease}`:`missing:${t.part}`;

/** Shared finished-treatment kernel. Caller owns the actual patient, dose,
 * RNG and notices; local Toil XP and abstract caravan care remain distinct. */
export function resolveHumanTendBatch(patient:Pawn,doctor:Pawn,batch:readonly RankedTreatment[],c:HumanTendContext):void {
  const available=new Set(treatmentTargets(patient).map(key));
  if(!patient.health||patient.health.death||!batch.length||new Set(batch.map(key)).size!==batch.length||batch.some(t=>!available.has(key(t))))throw Error('Stale treatment batch');
  // Primary local job XP precedes the quality query. DoTend itself grants none.
  if(c.awardJobXp)learnSkill(doctor.skills.medicine,tendXp(c.medicine),doctor);
  const quality=medicalTendQuality(doctor);
  let roomFactor:number|undefined;
  for(const target of batch){
    let applied:boolean;
    if('animalConditionId'in target){
      const rule=c.medicine?MEDICINES[c.medicine]:{potency:.3,maxQuality:.7},f=Math.fround;
      const base=f(Math.max(0,Math.min(f(rule.maxQuality),f(f(f(f(quality)*f(rule.potency))+f(c.bedOffset))*f(doctor===patient?.7:1)))));
      applied=tendAnimalAgeCondition256(patient.health,target.animalConditionId,base,rule.maxQuality,animalClinicalRandom256(c.random));
    }else if(target.injuryId!==undefined){
      applied=tendInjury(patient.health,target.injuryId,tendQuality(quality,c.random(),doctor===patient,c.medicine,c.bedOffset));
      if(patient.health.injuries.some(i=>i.id===target.injuryId&&i.infection)){
        roomFactor??=c.infectionRoomFactor();
        captureInfectionTendRoom(patient.health,target.injuryId,roomFactor);
      }
    }else if(target.infectionId!==undefined)applied=tendInfection(patient.health,target.infectionId,tendQuality(quality,c.random(),doctor===patient,c.medicine,c.bedOffset));
    else if(target.flu)applied=tendFlu(patient.health,tendQuality(quality,c.random(),doctor===patient,c.medicine,c.bedOffset));
    else if(target.disease){const disease=target.disease,q=tendQuality(quality,c.random(),doctor===patient,c.medicine,c.bedOffset);applied=isParasiteKind306(disease)?tendParasite306(patient.health,disease,q):tendImmuneDisease(patient.health,disease,q);}
    else applied=tendMissingPart(patient.health,target.part);
    if(!applied)throw Error('Treatment producer refused a prevalidated target');
  }
}
