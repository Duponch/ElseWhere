import {advanceCoveredInFirefoam290} from './firefoam-actor-state-290.ts';
import {advanceToxicBuildupCore256} from './toxic-buildup-256.ts';
import {applyToxicFalloutDose294} from './toxic-fallout-dose-294.ts';
import {TOXIC_FALLOUT_DOSE_INTERVAL294} from './toxic-fallout-state-294.ts';
import {advanceAlcoholCore265} from './alcohol-clinical-265.ts';
import {alcoholClinicalActive265} from './alcohol-state-265.ts';
import {animalClinicalRandom256} from './animal-condition-medical-frontier-256.ts';
import type {AnimalConditionMedicalFrontier256} from './animal-condition-medical-frontier-256.ts';
import {advanceCryptosleepSickness256,cryptosleepSick256} from './cryptosleep-sickness-256.ts';
import { medicalModel } from './body-model.ts';
import { BLOOD_UNIT,HEAL_INTERVAL,MEDICAL_INTERVAL,bloodStage } from './injury-rules.ts';
import { medicalBleedUnits,reconcileMedicalDeath,rollScarPain } from './injury-state.ts';
import type { Injury,MedicalContext,MedicalRandom,MedicalRecord } from './injury-types.ts';
import { advanceInfections,advanceInfectionImmunity } from './infection-evolution.ts';
import { advanceMalnutrition } from './malnutrition.ts';
import { advanceFoodPoisoning } from './food-poisoning.ts';
import { advanceFlu } from './flu-evolution.ts';
import { advanceImmuneDiseases } from './immune-diseases-evolution.ts';
import { advanceMechanites307 } from './mechanites-307.ts';
import { advanceAnesthetic } from './anesthetic.ts';
import { isMechanoidKind } from './mechanoid-definition.ts';
import {medicalCivilTick271,medicalCivilCore271} from './suspended-human-clock-271.ts';

function heal(record:MedicalRecord,injury:Injury,amount:number,random:MedicalRandom):void {
  injury.severity-=amount;
  if(injury.scar&&injury.severity<=injury.scar.threshold) {
    injury.severity=injury.scar.threshold;injury.scar.pain=rollScarPain(random);
  } else if(injury.severity<=0)record.injuries.splice(record.injuries.indexOf(injury),1);
}
function chosen(list:Injury[],random:MedicalRandom):Injury {return list[Math.floor(random()*list.length)]!;}

/** Physiological time only. Context is constant over this call; the World adapter
 * must split at hunger/posture changes and handle downing/death at their tick.
 * Mutates its owned record; snapshots and the PRNG remain the caller's concern. */
export function advanceMedical(record:MedicalRecord,ticks:number,context:MedicalContext,random:MedicalRandom,animalConditions?:AnimalConditionMedicalFrontier256):void {
  const startCivil=medicalCivilTick271(record),endCivil=context.civilTick??startCivil+ticks,offset=startCivil-record.tick;
  if(!Number.isSafeInteger(ticks)||ticks<0||ticks>100000||!Number.isSafeInteger(record.tick+ticks)||
    !Number.isInteger(context.phase)||context.phase<0||context.phase>=HEAL_INTERVAL||
    !['standing','ground','bed'].includes(context.posture)||typeof context.starving!=='boolean'||
    context.malnutritionRate!==undefined&&(!Number.isSafeInteger(context.malnutritionRate)||context.malnutritionRate<906000||context.malnutritionRate>1359000)||
    [context.hunger,context.rest].some(value=>value!==undefined&&(!Number.isFinite(value)||value<0||value>100))||
    context.restingBonus!==undefined&&typeof context.restingBonus!=='boolean'||
    context.infectionChanceFactor!==undefined&&(!Number.isFinite(context.infectionChanceFactor)||context.infectionChanceFactor<0||context.infectionChanceFactor>1)||
    context.infectionSeed!==undefined&&(!Number.isInteger(context.infectionSeed)||context.infectionSeed<0||context.infectionSeed>0xffffffff)||
    context.ageImmunityFactor!==undefined&&(!Number.isFinite(context.ageImmunityFactor)||context.ageImmunityFactor<.5||context.ageImmunityFactor>1)||
    context.bedHealPerDay!==undefined&&context.bedHealPerDay!==0&&context.bedHealPerDay!==4&&context.bedHealPerDay!==10||
    context.bedImmunityFactor!==undefined&&context.bedImmunityFactor!==1&&context.bedImmunityFactor!==1.05&&context.bedImmunityFactor!==1.07&&context.bedImmunityFactor!==1.11&&context.bedImmunityFactor!==1.13)throw new Error('Invalid medical interval');
  if(!Number.isSafeInteger(endCivil)||(record.civilTick271!==undefined||context.civilTick!==undefined)&&!Number.isSafeInteger(endCivil*10)||endCivil-startCivil!==ticks||offset<0)throw Error('Medical interval does not match its actual civil frontier');
  if(record.death||isMechanoidKind(record.body))return;
  // All local medical periods divide60. Moving the hash phase retains their
  // civil cadence while conditions/deadlines keep the active clinical clock.
  if(offset)context={...context,phase:((context.phase-offset)%HEAL_INTERVAL+HEAL_INTERVAL)%HEAL_INTERVAL};
  if(record.alcohol&&(!context.alcoholOwner||!Number.isSafeInteger(context.alcoholOwner.id)||context.alcoholOwner.id<1||typeof context.alcoholOwner.spawned!=='boolean'||typeof context.alcoholOwner.awake!=='boolean'))throw Error('Alcohol clinical interval requires its actual original owner');
  if((record.toxicBuildup||context.toxicFallout294)&&(!context.toxicOwner||!Number.isSafeInteger(context.toxicOwner.id)||context.toxicOwner.id<1||typeof context.toxicOwner.spawned!=='boolean'||typeof context.toxicOwner.awake!=='boolean'))throw Error('Toxic clinical interval requires its actual original owner');
  const fallout=context.toxicFallout294;
  if(fallout&&(!context.toxicOwner!.spawned||!Number.isSafeInteger(fallout.firstCore)||!Number.isSafeInteger(fallout.lastCore)||fallout.firstCore<=startCivil*10||fallout.lastCore>endCivil*10||fallout.firstCore>fallout.lastCore||fallout.firstCore%TOXIC_FALLOUT_DOSE_INTERVAL294!==0||fallout.lastCore%TOXIC_FALLOUT_DOSE_INTERVAL294!==0||!Number.isFinite(fallout.dose)||fallout.dose<=0||Math.fround(fallout.dose)!==fallout.dose))throw Error('Invalid actual fallout clinical segment');
  if(record.animalAgeConditions&&!animalConditions)throw Error('Actual conditions require the real owner frontier');
  if(record.cryptosleepSickness&&typeof context.cryptosleepSicknessSpawned!=='boolean')throw Error('Missing actual cryptosleep sickness physical owner');
  const pending=record.injuries.filter(i=>i.infection&&i.infection.dueCore<=(record.tick+ticks)*10).length;
  if(pending&&!Number.isSafeInteger((record.infections?.nextId??1)+pending))throw new Error('Infection identities exhausted');
  if((record.infections?.cases.length||pending)&&!Number.isSafeInteger((record.tick+ticks)*10))throw new Error('Infection clock exhausted');
  if(record.immuneDiseases&&!Number.isSafeInteger((record.tick+ticks)*10))throw new Error('Immune disease clock exhausted');
  if(record.mechanites307&&!Number.isSafeInteger((record.tick+ticks)*10))throw new Error('Mechanite clock exhausted');
  if(!fallout&&!animalConditions&&!alcoholClinicalActive265(record.alcohol)&&!record.injuries.length&&!record.missing.length&&!record.bloodLoss&&!record.infections?.cases.length&&!record.infections?.immunity&&!record.foodPoisoning&&!record.toxicBuildup&&!record.cryptosleepSickness&&!record.flu&&!record.immuneDiseases&&!record.mechanites307&&!record.anesthetic&&!(context.malnutritionRate&&(context.starving||record.malnutrition))){advanceCoveredInFirefoam290(record,ticks*10);record.tick+=ticks;if(record.civilTick271!==undefined)record.civilTick271=endCivil;return;}
  const end=record.tick+ticks;
  while(record.tick<end) {
    record.tick++;
    advanceCoveredInFirefoam290(record,10);
    if(record.civilTick271!==undefined)record.civilTick271=record.tick+offset;
    if(record.cryptosleepSickness){
      const sickness=record.cryptosleepSickness;
      // Hediff tests MTB before Spawned/Awake. A non-spawned owner consumes
      // its trial but never receives a spatial job through a fabricated map.
      if(!context.cryptosleepSicknessSpawned&&cryptosleepSick256(sickness)&&record.tick%60===context.phase%60)random();
      if(!advanceCryptosleepSickness256(sickness,10))delete record.cryptosleepSickness;
    }
    animalConditions?.step(record);if(record.death)return;
    if(record.alcohol){for(let core=(record.tick-1)*10+1;core<=record.tick*10&&!record.death;core++){advanceAlcoholCore265(record,core,context.alcoholOwner!,random);reconcileMedicalDeath(record);}if(record.death)return;}
    if(record.toxicBuildup||fallout){const actual=context.toxicOwner!,draw=animalClinicalRandom256(random);for(let core=(record.tick-1)*10+1;core<=record.tick*10&&!record.death;core++){
      const civilCore=medicalCivilCore271(record,core);
      if(fallout&&civilCore>=fallout.firstCore&&civilCore<=fallout.lastCore&&civilCore%TOXIC_FALLOUT_DOSE_INTERVAL294===0){applyToxicFalloutDose294(record,fallout.dose,random);reconcileMedicalDeath(record);if(record.death)return;}
      advanceToxicBuildupCore256(record,actual.id,core,draw,actual);reconcileMedicalDeath(record);
    }if(record.death)return;}
    if(advanceAnesthetic(record,context.phase)){reconcileMedicalDeath(record);if(record.death)return;}
    if(record.foodPoisoning){
      const previous=record.foodPoisoning.severity;
      if(!advanceFoodPoisoning(record.foodPoisoning,record.tick,context.phase))delete record.foodPoisoning;
      if(previous!==(record.foodPoisoning?.severity??0)){reconcileMedicalDeath(record);if(record.death)return;}
    }
    if(context.malnutritionRate&&(context.starving||record.malnutrition)) {
      advanceMalnutrition(record,context.starving,context.malnutritionRate,context.phase);
      reconcileMedicalDeath(record);if(record.death)return;
    }
    if(record.tick%MEDICAL_INTERVAL===context.phase%MEDICAL_INTERVAL) {
      const bleed=medicalBleedUnits(record);
      const previousStage=bloodStage(record.bloodLoss);
      // The code reference has a 0.1/day threshold; below it recovery applies.
      // This deliberately differs from the wiki's unqualified "any bleeding".
      record.bloodLoss=bleed>=BLOOD_UNIT/10000?Math.min(BLOOD_UNIT,record.bloodLoss+bleed):
        Math.max(0,record.bloodLoss-BLOOD_UNIT/3000);
      if(bloodStage(record.bloodLoss)!==previousStage)reconcileMedicalDeath(record);
      if(record.death)return;
    }
    advanceInfections(record,context,random);
    if(record.death)return;
    advanceImmuneDiseases(record,context);
    advanceMechanites307(record);
    if(record.death)return;
    advanceFlu(record,context);
    if(record.death)return;
    if(record.tick%HEAL_INTERVAL===context.phase&&!context.starving) {
      let eligible=record.injuries.filter(i=>i.scar?.pain===undefined);
      const natural=context.posture==='standing'?80:120+(context.posture==='bed'?(context.bedHealPerDay??4)*10:0);
      if(eligible.length)heal(record,chosen(eligible,random),Math.round(natural*medicalModel(record).healthScale),random);
      eligible=record.injuries.filter(i=>i.tended!==undefined&&i.scar?.pain===undefined);
      if(eligible.length) {
        const injury=chosen(eligible,random);
        heal(record,injury,Math.round((40+Math.min(1000,injury.tended!)*.08)*medicalModel(record).healthScale),random);
      }
    }
    advanceInfectionImmunity(record,context);
  }
}
