import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {tryApplyAnimalAgeCondition256} from './animal-birthday-application-256.ts';
import {animalConditionStage256,ANIMAL_AGE_CONDITION_DEFINITIONS_256 as definitions} from './animal-age-condition-data-256.ts';
import type {AnimalAgeMedical256,AnimalAgeConditionCase256} from './animal-age-condition-state-256.ts';
import type {InitialAnimalRandom256} from './initial-animal-age-256.ts';
import type {BodyPartId} from './body-definition.ts';
const f=Math.fround;
/** Actual mutation adapters, deliberately not supplied by this nucleus.
 * Activating a record that needs a missing adapter is a hard refusal before
 * its interval. A dummy callback is not a valid integration. */
export interface AnimalAgeConditionBindings256 {
 inMentalState():boolean;
 tryStartConfused(source:AnimalAgeConditionCase256,atCore:number):boolean;
 destroyPart(part:BodyPartId,atCore:number):void;
 reconcileHealth(atCore:number):void;
 forgetHumanMemory?():void;
 /** Native human AgeTickInterval follows HealthTickInterval; an age condition
  * created at this macro boundary must not receive the already elapsed health pass. */
 deferNewCondition?(condition:AnimalAgeConditionCase256):boolean;
}
export function unresolvedAnimalConditionBindings256(record:AnimalAgeMedical256,bindings:Partial<AnimalAgeConditionBindings256>):string[] {
 const kinds=new Set(record.animalAgeConditions?.cases.map(c=>c.kind)),missing:string[]=[];
 if((kinds.has('Dementia')||kinds.has('Alzheimers'))&&(typeof bindings.inMentalState!=='function'||typeof bindings.tryStartConfused!=='function'))missing.push('actual-confused-mental-owner-and-jobs');
 if(kinds.has('Carcinoma')&&typeof bindings.destroyPart!=='function')missing.push('actual-missing-part-transaction');
 if(record.animalAgeConditions?.cases.length&&typeof bindings.reconcileHealth!=='function')missing.push('actual-animal-health-terminal-owner');
 return missing;
}
/** Same bounded rare-event draw contract as the closed Rand.MTB facts, with
 * the dyadic sampling scale expressed separately. Not a Poisson substitute. */
export function animalConditionMtbEvent256(days:number,intervalCore:number,random:InitialAnimalRandom256):boolean {
 if(!Number.isFinite(days)||days<=0||!Number.isSafeInteger(intervalCore)||intervalCore<1)throw Error('Invalid condition risk interval');
 const chance=intervalCore/(days*60000);let scale=1;while(chance*scale<.0001)scale*=8;
 return (scale===1||random.value()<=1/scale)&&random.value()<chance*scale;
}
/** Exactly ONE actual HealthTickInterval call. The owner supplies elapsed
 * Core time; no phase is synthesized from a new clock or wall time. */
export function advanceAnimalAgeConditionInterval256(record:AnimalAgeMedical256,input:{actorId:number;atCore:number;civilCore?:number;deltaCore:number;random:InitialAnimalRandom256;bindings:Partial<AnimalAgeConditionBindings256>}):void {
 if(!record.animalAgeConditions||record.death)return;
 if(!Number.isSafeInteger(input.actorId)||input.actorId<1||!Number.isSafeInteger(input.atCore)||input.atCore<0||!Number.isInteger(input.deltaCore)||input.deltaCore<1||input.deltaCore>16||input.atCore>record.tick*10||input.atCore-input.deltaCore<(record.tick-1)*10)throw Error('Condition interval does not belong to its actual clinical owner');
 const missing=unresolvedAnimalConditionBindings256(record,input.bindings);if(missing.length)throw Error('Unresolved animal condition bindings: '+missing.join(', '));
 const {actorId,atCore,deltaCore,random}=input,bindings=input.bindings as AnimalAgeConditionBindings256;
 const snapshot=[...record.animalAgeConditions.cases];
 for(const c of snapshot){if(record.death)return;if(!record.animalAgeConditions.cases.includes(c)||bindings.deferNewCondition?.(c))continue;
  if(!Number.isSafeInteger(c.ageCore+deltaCore))throw Error('Condition age exhausted');c.ageCore+=deltaCore;
  const stage=animalConditionStage256(c.kind,c.severity),hash=(period:number)=>groupPawnInterval256(actorId,input.civilCore??atCore,period,deltaCore);
  if(stage.heartAttackMtb&&hash(60)&&animalConditionMtbEvent256(stage.heartAttackMtb,60,random))tryApplyAnimalAgeCondition256(record,'HeartAttack',random);
  if(stage.confusionMtb&&hash(60)&&!bindings.inMentalState()&&animalConditionMtbEvent256(stage.confusionMtb,60,random))bindings.tryStartConfused(c,atCore);
  if(c.kind==='Alzheimers'&&bindings.forgetHumanMemory&&hash(400)&&animalConditionMtbEvent256(c.severity>=f(.8)?1:c.severity>=f(.5)?2:c.severity>=f(.2)?4:7,400,random))bindings.forgetHumanMemory();
  // Real animals have neither skills nor a Mood memory tracker. The primary
  // SkillDecay/forget-memory branches therefore perform no mutation/draw here.
  if(stage.destroyPart)bindings.destroyPart(c.part,atCore);
  if(!record.animalAgeConditions.cases.includes(c)){bindings.reconcileHealth(atCore);continue;}
  if(c.kind==='HeartAttack'&&hash(Math.trunc(f(5000*f(c.intervalFactor!)))))c.severity=Math.max(0,Math.min(1,f(c.severity+random.float(f(-.4),f(.6)))));
  let adjustment=0;
  if(hash(200)){
   // Comp order: tending precedes GrowthMode on carcinoma, follows the
   // Immunizable increase on asthma. Sum as float32, assign Severity once.
   if(c.kind==='Carcinoma'){
    if(c.tend!.ticksLeft>0)adjustment=f(adjustment+f(f(f(-.0027)*c.tend!.quality)*f(.0033333334)));
    const growth=c.growth!,perDay=growth.mode===0?f(f(.003)*growth.growingFactor):growth.mode===1?0:f(f(-.002)*growth.remissionFactor);adjustment=f(adjustment+f(perDay*f(.0033333334)));
   }else if(c.kind==='Alzheimers')adjustment=f(f(.003)*f(.0033333334));
   else if(c.kind==='Asthma'){adjustment=f(f(.25)*f(.0033333334));if(c.tend!.ticksLeft>0)adjustment=f(adjustment+f(f(f(-.8)*c.tend!.quality)*f(.0033333334)));}
   else if(c.kind==='HeartArteryBlockage')adjustment=f(f(f(.0007)*c.severityFactor!)*f(.0033333334));
  }
  if(c.kind==='Carcinoma'&&hash(5000)&&animalConditionMtbEvent256(100,5000,random)){const old=c.growth!.mode,alternatives=([0,1,2] as const).filter(n=>n!==old);c.growth!.mode=alternatives[random.integer(0,2)]!;}
  if(adjustment!==0){const def=definitions[c.kind];c.severity=Math.max(f(def.min),Math.min(f(def.max),f(c.severity+adjustment)));}
  if(c.severity<=0)record.animalAgeConditions.cases.splice(record.animalAgeConditions.cases.indexOf(c),1);
  bindings.reconcileHealth(atCore);
 }
}
/** The primary separates per-Core CompPostTick from interval physiology. The
 * real owner must call this once per completed unsuspended Core tick. */
export function tickAnimalConditionTends256(record:AnimalAgeMedical256):void {if(record.death)return;for(const c of record.animalAgeConditions?.cases??[])if(c.tend&&c.tend.ticksLeft>0)c.tend.ticksLeft--;}
/** Physiological result only; the REAL doctor/medicine/contact transaction
 * must supply its completed quality and maxQuality, just as tendInjury does. */
export function tendAnimalAgeCondition256(record:AnimalAgeMedical256,id:number,quality:number,maxQuality:number,random:InitialAnimalRandom256):boolean {
 if(record.death)return false;if(!Number.isSafeInteger(id)||id<1||!Number.isFinite(quality)||quality<0||!Number.isFinite(maxQuality)||maxQuality<quality)throw Error('Invalid actual tending result');
 const c=record.animalAgeConditions?.cases.find(c=>c.id===id);if(!c)return false;
 if(c.kind==='HeartAttack'){if(random.value()<f(f(.65)*f(quality)))c.severity=Math.max(0,f(c.severity-f(.3)));return true;}
 if(!c.tend||c.tend.ticksLeft>=7500)return false;
 c.tend.quality=f(Math.max(0,Math.min(f(maxQuality),f(f(quality)+random.float(f(-.25),f(.25))))));c.tend.totalQuality=f(c.tend.totalQuality+c.tend.quality);
 const duration=c.kind==='Asthma'?427500:247500;if(!Number.isSafeInteger(Math.max(0,c.tend.ticksLeft)+duration))throw Error('Tend duration exhausted');c.tend.ticksLeft=Math.max(0,c.tend.ticksLeft)+duration;return true;
}
