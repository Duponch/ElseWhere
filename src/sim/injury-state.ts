import {toxicStage256} from './toxic-buildup-256.ts';
import {alcoholModifiers265} from './alcohol-rules-265.ts';
import {animalAgeConditionEffects256,removeAnimalConditionsWithin256} from './animal-age-condition-state-256.ts';
import {cryptosleepSicknessModifiers256} from './cryptosleep-sickness-256.ts';
import { MALNUTRITION_UNIT,malnutritionModifiers } from './malnutrition.ts';
import { anestheticModifiers } from './anesthetic.ts';
import { foodPoisoningModifiers } from './food-poisoning.ts';
import { FLU_UNIT,fluModifiers } from './flu-rules.ts';
import { IMMUNE_DISEASE_UNIT,immuneDiseaseModifiers } from './immune-diseases-rules.ts';
import { parasiteModifiers306 } from './parasites-306.ts';
import { coldModifiers } from './cold-rules.ts';
import { HEAT_UNIT,heatModifiers } from './heat-severity.ts';
import { assessBody,type BodyAssessment } from './body-capacities.ts';
import { projectedMedicalBody } from './medical-assessment-cache.ts';
import type { BodyPartId } from './body-definition.ts';
import { HUMAN_MODEL,medicalModel,modelHasPart } from './body-model.ts';
import { BLOOD_UNIT,HP_UNIT,PAIN_UNIT,FRESH_MISSING_TICKS,INJURY_RULES,injuryPartRules,medicalPartInjuryRule,bloodConsciousness,coagulationAge,isWithinPart,scarChance,type InjuryKind,type ScarPain } from './injury-rules.ts';
import { artificialPartCovering,artificialPartEfficiencies } from './artificial-parts-rules.ts';
import type { Injury,MedicalRandom,MedicalRecord } from './injury-types.ts';
import { INFECTION_DELAY_MAX_CORE,INFECTION_UNIT,infectionModifiers,injuryInfectionChance } from './infection-rules.ts';
import { initializeInfectionRisk,removeInfectionsWithin } from './infection-state.ts';
import { isMechanoidKind } from './mechanoid-definition.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';

export function createMedicalRecord(tick=0):MedicalRecord {
  if(!Number.isSafeInteger(tick)||tick<0)throw new Error('Invalid medical tick');
  return {tick,nextInjuryId:1,injuries:[],missing:[],bloodLoss:0};
}
export function partMissing(record:MedicalRecord,part:BodyPartId):boolean {return record.missing.some(m=>isWithinPart(part,m.part,medicalModel(record)));}
export function remainingPartHealth(record:MedicalRecord,part:BodyPartId):number {
  if(partMissing(record,part))return 0;
  const hp=Math.max(medicalModel(record).byId[part].destroyable?0:1,medicalModel(record).byId[part].hp-record.injuries.reduce((n,i)=>n+(i.part===part?i.severity/HP_UNIT:0),0));
  const floor=Math.floor(hp);
  return (hp-floor===.5?floor+floor%2:Math.round(hp))*HP_UNIT;
}
export function freshMissing(record:MedicalRecord,part:MedicalRecord['missing'][number]):boolean {
  return !part.nonFresh&&!part.tended&&!artificialPartCovering(record,part.part)&&record.tick-part.bornAt<FRESH_MISSING_TICKS&&medicalModel(record).byId[part.part].depth==='outside'&&!medicalPartInjuryRule(record,part.part).solid;
}
export function injuryBleed(record:MedicalRecord,injury:Injury):number {
  return injuryBleedUnits(record,injury)*1000/BLOOD_UNIT;
}
function injuryBleedUnits(record:MedicalRecord,injury:Injury):number {
  if(record.death||artificialPartCovering(record,injury.part)||injury.tended!==undefined||injury.scar?.pain!==undefined||record.tick-injury.bornAt>=coagulationAge(injury.severity))return 0;
  return injury.severity*INJURY_RULES[injury.kind].bleedUnits*medicalPartInjuryRule(record,injury.part).bleed;
}
export function medicalPain(record:MedicalRecord):number {
  if(record.death||isMechanoidKind(record.body))return 0;
  const aging=animalAgeConditionEffects256(record);
  let pain=(heatModifiers(record.heatstroke).pain+coldModifiers(record.hypothermia).pain)*PAIN_UNIT;
  for(const i of record.injuries)if(!artificialPartCovering(record,i.part))pain+=i.severity*(i.scar?.pain!==undefined?5*i.scar.pain:INJURY_RULES[i.kind].painUnits);
  for(const m of record.missing)if(freshMissing(record,m))pain+=medicalModel(record).byId[m.part].hp*10000;
  const alcohol=alcoholModifiers265(record);
  return Math.min(1,(pain/PAIN_UNIT/medicalModel(record).healthScale+infectionModifiers(record).pain+foodPoisoningModifiers(record.foodPoisoning).painOffset+fluModifiers(record.flu).pain+immuneDiseaseModifiers(record).pain+parasiteModifiers306(record).pain+aging.pain+alcohol.painOffset)*anestheticModifiers(record.anesthetic).painFactor*alcohol.painFactor);
}
export function medicalBleed(record:MedicalRecord):number {
  return medicalBleedUnits(record)*1000/BLOOD_UNIT;
}
/** Blood units gained per reference 60-tick interval; exact integer threshold. */
export function medicalBleedUnits(record:MedicalRecord):number {
  if(record.death||isMechanoidKind(record.body))return 0;
  let rate=record.injuries.reduce((n,i)=>n+injuryBleedUnits(record,i),0);
  for(const m of record.missing)if(freshMissing(record,m))rate+=medicalModel(record).byId[m.part].hp*HP_UNIT*36*injuryPartRules(medicalModel(record))[m.part].bleed;
  return Math.round(rate/medicalModel(record).healthScale);
}
/** Pure chronic conditions have three immutable projections. Keep the dynamic
 * path for any other condition so in-place medical changes remain visible. */
const chronicBody=(badBack:boolean,frail:boolean):BodyAssessment=>assessBody({damage:[],missing:[],pain:0,
  movingOffset:-(badBack?.3:0)-(frail?.3:0),manipulationOffset:-(badBack?.1:0)-(frail?.3:0)},HUMAN_MODEL);
const CHRONIC_BODIES=[chronicBody(false,false),chronicBody(true,false),chronicBody(false,true),chronicBody(true,true)] as const;
const chronicOnly=(record:MedicalRecord):boolean=>!!record.ageAilments?.length&&!record.body&&!Object.hasOwn(record,'humanHealthScale')&&!record.death&&
  !record.injuries.length&&!record.missing.length&&!record.bloodLoss&&!record.heatstroke&&!record.hypothermia&&
  !record.malnutrition&&!record.cryptosleepSickness&&!record.toxicBuildup&&!record.alcohol&&!record.animalAgeConditions&&!record.infections&&!record.flu&&!record.immuneDiseases&&!record.foodPoisoning&&!record.anesthetic&&!record.artificialParts?.length;
export function assessMedical(record:MedicalRecord):BodyAssessment {
  if(isMechanoidKind(record.body))return projectedMedicalBody(record,{damage:record.injuries.map(i=>({part:i.part,loss:i.severity/HP_UNIT})),missing:record.missing.map(m=>m.part),pain:0},medicalModel(record));
  if(chronicOnly(record))return CHRONIC_BODIES[(record.ageAilments!.includes('bad-back')?1:0)+(record.ageAilments!.includes('frail')?2:0)];
  const heat=heatModifiers(record.heatstroke),cold=coldModifiers(record.hypothermia),blood=bloodConsciousness(record.bloodLoss),infection=infectionModifiers(record),flu=fluModifiers(record.flu),diseases=immuneDiseaseModifiers(record),parasites=parasiteModifiers306(record),malnutrition=malnutritionModifiers(record.malnutrition),anesthetic=anestheticModifiers(record.anesthetic);
  const badBack=record.ageAilments?.includes('bad-back')??false,frail=record.ageAilments?.includes('frail')??false;
  const {painOffset:_foodPain,...foodFactors}=foodPoisoningModifiers(record.foodPoisoning);
  const crypto=cryptosleepSicknessModifiers256(record.cryptosleepSickness),combinedFoodFactors={...foodFactors,consciousnessFactor:foodFactors.consciousnessFactor*crypto.consciousnessFactor,movingFactor:foodFactors.movingFactor*crypto.movingFactor,manipulationFactor:foodFactors.manipulationFactor*crypto.manipulationFactor};
  const aging=animalAgeConditionEffects256(record),toxic=toxicStage256(record.toxicBuildup?.severity??0),alcohol=alcoholModifiers265(record);
  return projectedMedicalBody(record,{damage:record.injuries.map(i=>({part:i.part,loss:i.severity/HP_UNIT})),missing:record.missing.map(m=>m.part),...(record.artificialParts?{artificialParts:artificialPartEfficiencies(record)}:{}),pain:medicalPain(record),...(aging.partOffsets.length||alcohol.partOffsets.length?{partEfficiencyOffsets:[...aging.partOffsets,...alcohol.partOffsets]}:{}),hearingOffset:aging.hearing,consciousnessOffset:toxic.offset+(blood.consciousnessOffset??0)+heat.consciousnessOffset+cold.consciousnessOffset+infection.consciousnessOffset+flu.consciousnessOffset+diseases.consciousnessOffset+malnutrition.consciousnessOffset+alcohol.consciousnessOffset,consciousnessMax:Math.min(toxic.max,aging.consciousnessMax,blood.consciousnessMax??Infinity,heat.consciousnessMax,cold.consciousnessMax,infection.consciousnessMax,diseases.consciousnessMax,malnutrition.consciousnessMax,anesthetic.consciousnessMax,alcohol.consciousnessMax),movingOffset:aging.moving+heat.movingOffset+cold.movingOffset-(badBack?.3:0)-(frail?.3:0)+anesthetic.movingOffset+alcohol.movingOffset+parasites.movingOffset,manipulationOffset:aging.manipulation+cold.manipulationOffset+flu.manipulationOffset+diseases.manipulationOffset+parasites.manipulationOffset-(badBack?.1:0)-(frail?.3:0)+anesthetic.manipulationOffset+alcohol.manipulationOffset,breathingOffset:infection.breathingOffset+flu.breathingOffset+diseases.breathingOffset,bloodFiltrationOffset:diseases.bloodFiltrationOffset,sightOffset:anesthetic.sightOffset,talkingOffset:aging.talking+anesthetic.talkingOffset,digestionOffset:anesthetic.digestionOffset,...combinedFoodFactors,manipulationFactor:combinedFoodFactors.manipulationFactor*alcohol.manipulationFactor,consciousnessFactor:combinedFoodFactors.consciousnessFactor*aging.consciousnessFactor*alcohol.consciousnessFactor},medicalModel(record));
}
export function medicalStatus(record:MedicalRecord,body=assessMedical(record)):'mobile'|'downed'|'dead' {
  return record.death?'dead':body.painShock||!body.canBeAwake||!body.movingCapable?'downed':'mobile';
}
export function reconcileMedicalDeath(record:MedicalRecord):void {
  if(record.death)return;
  if(isMechanoidKind(record.body)){
    const cause=assessMedical(record).vitalFailure?'vital-failure':record.injuries.reduce((n,i)=>n+i.severity,0)>=150*HP_UNIT*medicalModel(record).healthScale?'trauma':null;
    if(cause)record.death={tick:medicalCivilTick271(record),cause};return;
  }
  const cause=(record.toxicBuildup?.severity??0)>=1?'toxic-buildup':record.animalAgeConditions?.cases.some(c=>c.kind==='HeartAttack'&&c.severity>=1)?'heart-attack':record.animalAgeConditions?.cases.some(c=>c.kind==='HeartArteryBlockage'&&c.severity>=1)?'heart-artery-blockage':(record.malnutrition??0)>=MALNUTRITION_UNIT?'malnutrition':(record.heatstroke??0)>=HEAT_UNIT?'heatstroke':(record.hypothermia??0)>=HEAT_UNIT?'hypothermia':record.bloodLoss>=BLOOD_UNIT?'blood-loss':record.infections?.cases.some(c=>c.severity>=INFECTION_UNIT)?'infection':(record.flu?.severity??0)>=FLU_UNIT?'flu':(record.immuneDiseases?.malaria?.severity??0)>=IMMUNE_DISEASE_UNIT?'malaria':(record.immuneDiseases?.plague?.severity??0)>=IMMUNE_DISEASE_UNIT?'plague':assessMedical(record).vitalFailure?'vital-failure':record.injuries.reduce((n,i)=>n+i.severity,0)>=150*HP_UNIT*medicalModel(record).healthScale?'trauma':null;
  if(cause)record.death={tick:medicalCivilTick271(record),cause};
}
export function rollScarPain(random:MedicalRandom):ScarPain {const n=random();return n<.5?0:n<.7?1:n<.9?3:6;}

/** Apply already localized, post-armor/post-overkill damage. The producer must
 * resolve hit selection, outside-part preservation and instant-kill protection.
 * It must NOT feed raw weapon damage into this lower layer. */
export function addResolvedInjury(record:MedicalRecord,part:BodyPartId,kind:InjuryKind,severity:number,random:MedicalRandom):Injury|null {
  validateResolvedInjury(record,part,kind,severity);
  if(record.death||severity===0||partMissing(record,part))return null;
  if(!Number.isSafeInteger((record.injuries.reduce((n,i)=>n+i.severity,0)+severity)*100))throw new Error('Medical severity overflow');
  if(!Number.isSafeInteger(record.nextInjuryId+1))throw new Error('Medical identity exhausted');
  const injury=applyResolvedInjury(record,part,kind,severity,random);
  reconcileMedicalDeath(record);return injury;
}
export interface ResolvedInjury {part:BodyPartId;kind:InjuryKind;severity:number}
/** One already-resolved physical impact may injure several anatomical layers.
 * Commit all layers at the same medical tick, then evaluate the final status.
 * No future impact can extend a dead record. Input/capacity checks precede RNG. */
export function addResolvedInjuryBatch(record:MedicalRecord,hits:readonly ResolvedInjury[],random:MedicalRandom):void {
  if(hits.length>64)throw new Error('Too many layers in one impact');
  let severity=record.injuries.reduce((n,i)=>n+i.severity,0);
  for(const hit of hits){validateResolvedInjury(record,hit.part,hit.kind,hit.severity);severity+=hit.severity;}
  if(!Number.isSafeInteger(severity*100)||!Number.isSafeInteger(record.nextInjuryId+hits.length))throw new Error('Medical impact capacity exhausted');
  if(record.death)return;
  for(const hit of hits)if(hit.severity>0&&!partMissing(record,hit.part))applyResolvedInjury(record,hit.part,hit.kind,hit.severity,random);
  reconcileMedicalDeath(record);
}
function validateResolvedInjury(record:MedicalRecord,part:BodyPartId,kind:InjuryKind,severity:number):void {
  if(kind==='frostbite')throw Error('Fresh Frostbite exposure is not bound; only actual initial permanent Frostbite is represented');
  if(!modelHasPart(medicalModel(record),part)||medicalModel(record).byId[part].conceptual||!Object.hasOwn(INJURY_RULES,kind)||!Number.isSafeInteger(severity)||severity<0)throw new Error('Invalid localized injury');
  if(!record.death&&severity>0&&injuryInfectionChance(record,{part,kind})>0&&!Number.isSafeInteger(record.tick*10+INFECTION_DELAY_MAX_CORE))throw new Error('Infection exposure clock exhausted');
}
function applyResolvedInjury(record:MedicalRecord,part:BodyPartId,kind:InjuryKind,severity:number,random:MedicalRandom):Injury|null {
  const injury:Injury={id:record.nextInjuryId++,part,kind,severity,bornAt:record.tick};
  const chance=scarChance(part,kind,severity,medicalModel(record),record);
  if(chance>0&&(chance>=1||random()<chance)) {
    injury.scar=medicalPartInjuryRule(record,part).delicate?{threshold:severity,pain:rollScarPain(random)}:
      {threshold:Math.round(HP_UNIT+random()*(severity/2-HP_UNIT))};
  }
  // Crush can merge into an untreated nonpermanent injury. Its older scar
  // threshold survives; the incoming threshold is discarded by that merge.
  const existing=INJURY_RULES[kind].merge&&injury.scar?.pain===undefined?record.injuries.find(i=>i.part===part&&i.kind===kind&&i.tended===undefined&&i.scar?.pain===undefined):undefined;
  if(existing){existing.severity+=severity;existing.bornAt=record.tick;}else record.injuries.push(injury);
  if(medicalModel(record).byId[part].parent!==null&&remainingPartHealth(record,part)===0) {
    const artificial=!!artificialPartCovering(record,part);
    record.injuries=record.injuries.filter(i=>!isWithinPart(i.part,part,medicalModel(record)));
    record.missing=record.missing.filter(m=>!isWithinPart(m.part,part,medicalModel(record)));
    record.missing.push({part,bornAt:record.tick,...artificial?{nonFresh:true as const}:{}});
    if(record.artificialParts){record.artificialParts=record.artificialParts.filter(p=>!isWithinPart(p.part,part,medicalModel(record)));if(!record.artificialParts.length)delete record.artificialParts;}
    removeInfectionsWithin(record,part);
    removeAnimalConditionsWithin256(record,part,medicalModel(record));
    return null;
  }
  if(!existing)initializeInfectionRisk(record,injury,random);
  return existing??injury;
}

/** Physiological result only, not a remote-care player command. */
export function tendInjury(record:MedicalRecord,id:number,quality:number):boolean {
  if(!Number.isSafeInteger(quality)||quality<0||quality>1300)throw new Error('Invalid tending quality');
  if(record.death||isMechanoidKind(record.body))return false;
  const injury=record.injuries.find(i=>i.id===id);
  if(!injury||injury.tended!==undefined||injury.scar?.pain!==undefined)return false;
  injury.tended=quality;return true;
}
export function tendMissingPart(record:MedicalRecord,part:BodyPartId):boolean {
  const missing=record.missing.find(m=>m.part===part);
  if(record.death||isMechanoidKind(record.body)||!missing||!freshMissing(record,missing))return false;
  missing.tended=true;return true;
}
