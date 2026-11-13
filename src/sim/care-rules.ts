import {medicalModel} from './body-model.ts';
import {animalConditionCareTargets256,animalConditionMedicalRest256} from './animal-condition-care-256.ts';
import { type BodyPartId } from './body-definition.ts';
import { pawnBody } from './health-rules.ts';
import { freshMissing,injuryBleed,medicalBleed } from './injury-state.ts';
import { BLOOD_UNIT,HP_UNIT,PART_INJURY_RULES } from './injury-rules.ts';
import type { Cell,Pawn } from './types.ts';
import { medicalCare,tendQuality,type TendMedicine } from './medicine-rules.ts';
import { infectionTargets,infectionNeedsRest } from './infection-state.ts';
import { FLU_UNIT } from './flu-rules.ts';
import { fluNeedsRest,fluTendable } from './flu-state.ts';
import { immuneDiseaseTargets,immuneDiseasesNeedRest } from './immune-diseases-state.ts';
import type { ImmuneDiseaseKind } from './immune-diseases-types.ts';
import { parasiteTargets306,type ParasiteKind306 } from './parasites-306.ts';
import { mechaniteTargets307,type MechaniteKind307 } from './mechanites-307.ts';

export interface TendTask { drafted?:true; patientId:number; spot:Cell; phase:'find-medicine'|'pickup'|'approach'|'tend'; progress:number; duration?:number; urgent?:true; useMedicine?:true; medicine?:TendMedicine }
export type TreatmentTarget={animalConditionId:number;injuryId?:never;part?:never;infectionId?:never;flu?:never;disease?:never}|{injuryId:number;part?:never;infectionId?:never;flu?:never;disease?:never}|{part:BodyPartId;injuryId?:never;infectionId?:never;flu?:never;disease?:never}|{infectionId:number;injuryId?:never;part?:never;flu?:never;disease?:never}|{flu:true;injuryId?:never;part?:never;infectionId?:never;disease?:never}|{disease:ImmuneDiseaseKind|ParasiteKind306|MechaniteKind307;injuryId?:never;part?:never;infectionId?:never;flu?:never};
export type RankedTreatment=TreatmentTarget&{priority:number;severity:number};
export function treatmentTargets(p:Pawn):RankedTreatment[] {
  const h=p.health;if(!h||h.death||medicalCare(p)==='none')return [];
  const list:RankedTreatment[]=[];
  for(const i of h.injuries)if(i.tended===undefined&&i.scar?.pain===undefined)list.push({injuryId:i.id,priority:injuryBleed(h,i)*1.5,severity:i.severity});
  for(const m of h.missing)if(freshMissing(h,m))list.push({part:m.part,priority:medicalModel(h).byId[m.part].hp*.12*PART_INJURY_RULES[m.part].bleed*1.5,severity:HP_UNIT});
  if(h.infections)for(const t of infectionTargets(h))list.push({infectionId:t.infectionId,priority:t.priority,severity:t.severity});
  if(fluTendable(h))list.push({flu:true,priority:h.flu!.severity>=833_000_000?1:.025,severity:h.flu!.severity/FLU_UNIT*1000});
  list.push(...immuneDiseaseTargets(h),...parasiteTargets306(h),...mechaniteTargets307(h),...animalConditionCareTargets256(h));
  return list.sort((a,b)=>b.priority-a.priority||b.severity-a.severity);
}
/** One medicine treats the first injury even above 20 HP, then fits later
 * injuries within 20 HP total. An oversized candidate does not end the scan. */
export function treatmentBatch(targets:readonly RankedTreatment[],medicine:boolean):RankedTreatment[] {
  const first=targets[0];if(!first)return [];
  const batch=[first];let severity=first.severity;
  if(medicine&&first.injuryId!==undefined)for(const next of targets.slice(1))if(next.injuryId!==undefined&&severity+next.severity<=20*HP_UNIT){batch.push(next);severity+=next.severity;}
  return batch;
}
export function medicineCount(targets:readonly RankedTreatment[]):number {
  let left=[...targets],count=0;
  while(left.length){const batch=new Set(treatmentBatch(left,true));left=left.filter(t=>!batch.has(t));count++;}
  return count;
}
/** Core ranks life-threatening illness, bleeding and treatment benefit before
 * severity. Deterministic stored order breaks ties between equal targets. */
export function treatmentTarget(p:Pawn):TreatmentTarget|undefined {
  const h=p.health;if(!h||h.death||medicalCare(p)==='none')return;
  let best:{target:TreatmentTarget;priority:number;severity:number}|undefined;
  const consider=(target:TreatmentTarget,priority:number,severity:number)=>{
    if(!best||priority>best.priority||priority===best.priority&&severity>best.severity)best={target,priority,severity};
  };
  for(const i of h.injuries)if(i.tended===undefined&&i.scar?.pain===undefined)consider({injuryId:i.id},injuryBleed(h,i)*1.5,i.severity);
  for(const m of h.missing)if(freshMissing(h,m))consider({part:m.part},medicalModel(h).byId[m.part].hp*.12*PART_INJURY_RULES[m.part].bleed*1.5,HP_UNIT);
  if(h.infections)for(const t of infectionTargets(h))consider({infectionId:t.infectionId},t.priority,t.severity);
  if(fluTendable(h))consider({flu:true},h.flu!.severity>=833_000_000?1:.025,h.flu!.severity/FLU_UNIT*1000);
  for(const t of immuneDiseaseTargets(h))consider({disease:t.disease},t.priority,t.severity);
  for(const t of parasiteTargets306(h))consider({disease:t.disease},t.priority,t.severity);
  for(const t of mechaniteTargets307(h))consider({disease:t.disease},t.priority,t.severity);
  for(const t of animalConditionCareTargets256(h))consider({animalConditionId:t.animalConditionId},t.priority,t.severity);
  return best?.target;
}
export const healingInjury=(p:Pawn):boolean=>!!p.health?.injuries.some(i=>i.tended!==undefined&&i.scar?.pain===undefined);
export const medicalRestNeeded=(p:Pawn):boolean=>healingInjury(p)||!!p.health&&(infectionNeedsRest(p.health)||fluNeedsRest(p.health)||immuneDiseasesNeedRest(p.health)||animalConditionMedicalRest256(p.health));
export const urgentTreatment=(p:Pawn):boolean=>!!treatmentTarget(p)&&!!p.health&&medicalBleed(p.health)>0&&(1-p.health.bloodLoss/BLOOD_UNIT)/medicalBleed(p.health)<.75;
export function medicalTendSpeed(p:Pawn,light=1):number {
  const c=pawnBody(p).capacities;
  return Math.max(.1,(.4+.06*p.skills.medicine.level)*c.manipulation*(.2+.8*Math.min(1.3,c.sight))*light);
}
export function medicalTendQuality(p:Pawn):number {
  const c=pawnBody(p).capacities,v=(.2+.1*p.skills.medicine.level)*Math.min(1.4,c.manipulation)*(.3+.7*Math.min(1.4,c.sight));
  return v<=1?v:v<=2?1+(v-1)*.5:1.5+(v-2)*.25;
}
/** Additive variation, not a multiplicative +/-25%. Thousandths persisted. */
export const dryTendQuality=(stat:number,random:number,self=false):number=>tendQuality(stat,random,self);
