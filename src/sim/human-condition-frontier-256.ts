import {medicalCivilTick271,medicalCivilCore271} from './suspended-human-clock-271.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {advanceAnimalAgeConditionInterval256,tickAnimalConditionTends256} from './animal-age-condition-runtime-256.ts';
import {destroyAnimalConditionPart256} from './animal-condition-missing-part-256.ts';
import {animalClinicalRandom256,type AnimalConditionMedicalFrontier256} from './animal-condition-medical-frontier-256.ts';
import {advanceAnimalConfusionState256} from './animal-condition-mental-runtime-256.ts';
import {hasHumanConditionMind256,startHumanConfusion256,recoverHumanConfusion256} from './human-condition-mind-256.ts';
import {medicalStatus,reconcileMedicalDeath} from './injury-state.ts';
import {learnSkill,xpRequired} from './skills.ts';
import {BACKGROUND_SKILL_IDS,backgroundSkillRefusal} from './colonist-backgrounds.ts';
import type {MedicalRecord,MedicalRandom} from './injury-types.ts';
import type {Pawn,World} from './types.ts';
import {forgetHumanMemory382} from './human-alzheimer-382.ts';
import {advanceAmbrosiaClinical382} from './ambrosia-clinical-382.ts';
export type HumanConditionOwner256={kind:'map';world:World}|{kind:'caravan';schemaVersion?:number}|{kind:'world-pawn';schemaVersion?:number};
/** Same actual actor/record/owner clock. WorldPawn admission intentionally
 * cannot start a new mental episode, as the primary StateCanOccur refuses it. */
export function humanConditionMedicalFrontier256(p:Pawn,record:MedicalRecord,clock:number,draw:MedicalRandom,owner:HumanConditionOwner256,actualCommitPawn?:Pawn):AnimalConditionMedicalFrontier256|undefined {
 if(!record.animalAgeConditions&&p.mental?.crisis?.kind!=='confused-wander'&&!record.toxicBuildup&&!record.ambrosia382)return;
 if(record.body)throw Error('Human condition frontier requires the actual human record');
 const version=owner.kind==='map'?owner.world.schemaVersion:owner.schemaVersion??256;
 if(version<382&&record.humanHealthScale!==undefined&&record.animalAgeConditions?.cases.some(c=>c.kind==='Alzheimers'))throw Error('Actual native Human Alzheimer memories and conditional thoughts are not bound');
 // Carcinoma has no mental giver or skill/memory effect. A newly acquired
 // liver cancer can evolve on an old literal human without inventing a mind.
 const requiresMind=!!record.animalAgeConditions&&(!record.alcohol||record.animalAgeConditions.cases.some(c=>c.kind!=='Carcinoma'))||!!record.toxicBuildup||p.mental?.crisis?.kind==='confused-wander';
 if(requiresMind&&!hasHumanConditionMind256(p))throw Error('Historical human clinical wander authority is unavailable');
 const local=owner.kind==='map'?owner.world:undefined,commitPawn=actualCommitPawn??p;
 if(actualCommitPawn&&(owner.kind!=='map'||!local||!isSchema256Or257(local.schemaVersion)||actualCommitPawn===p||p.id!==actualCommitPawn.id||p.health!==record||actualCommitPawn.health===record||local.tick!==clock||!local.pawns.includes(actualCommitPawn)||local.pawns.some(a=>a!==actualCommitPawn&&a.id===p.id)))throw Error('Private clinical outcome lacks its actual original map owner');
 const random=animalClinicalRandom256(draw);
 const clinicalId=version>=382?p.nativeHuman?.sourceThingId382??p.id:p.id,phase=version>=382&&local?local.phaseCore297??0:0;
 let last=record.tick,done=false,episode=p.mental?.crisis?.kind==='confused-wander'?{revision:1 as const,ageCore:p.mental.crisis.age}:undefined,started=false,recovered=false;
 const bindings:import('./animal-age-condition-runtime-256.ts').AnimalAgeConditionBindings256={
  inMentalState:()=>!!p.mental?.crisis||!!episode,
  tryStartConfused:()=>{if(owner.kind==='world-pawn'||episode||p.mental?.crisis||['dead','downed','sleeping'].includes(p.state)||medicalStatus(record)!=='mobile')return false;episode={revision:1,ageCore:0};started=true;return true;},
  destroyPart:(part,atCore)=>{destroyAnimalConditionPart256(record,part,atCore,random);},
  reconcileHealth:()=>reconcileMedicalDeath(record)
 };
 if(version>=382&&record.humanHealthScale!==undefined&&record.animalAgeConditions?.cases.some(c=>c.kind==='Alzheimers'))bindings.forgetHumanMemory=()=>{forgetHumanMemory382(p,random);};
 if(version>=382&&record.humanHealthScale!==undefined&&record.animalAgeConditions?.cases.some(c=>c.ageCore===0&&c.bornAt>record.tick)){
  const newborn=record.animalAgeConditions.cases.filter(c=>c.ageCore===0&&c.bornAt>record.tick);
  bindings.deferNewCondition=c=>newborn.includes(c)&&c.bornAt>=record.tick;
 }
 return {
  step(current){
   if(current!==record||record.tick!==last+1||done)throw Error('Human condition frontier lost its actual original');last=record.tick;
   for(let core=(record.tick-1)*10+1;core<=record.tick*10&&!record.death;core++){
    if(record.ambrosia382)advanceAmbrosiaClinical382(record,clinicalId,medicalCivilCore271(record,core)+phase);
    tickAnimalConditionTends256(record);
    advanceAnimalAgeConditionInterval256(record,{actorId:clinicalId,atCore:core,civilCore:medicalCivilCore271(record,core)+phase,deltaCore:1,random,bindings});
    for(const c of record.animalAgeConditions?.cases??[])if(c.kind==='Dementia'&&!bindings.deferNewCondition?.(c)){
     const f=Math.fround;
     for(const [key,skill] of Object.entries(p.skills)){
      if(key==='lastResetTick'||!skill||typeof skill!=='object')continue;
      const id=BACKGROUND_SKILL_IDS.find(id=>p.skills[id]===skill);if(skill.level===0||id&&backgroundSkillRefusal(p,id))continue;
      const percentage=skill.level<=4?.05:skill.level>=20?.25:.05+(skill.level-4)*.0125;
      const loss=f(f(f(xpRequired(skill.level)/1000)*f(c.severity*f(percentage)))/60000),remainders=c.skillDecayRemainders!;
      const accrued=f(f(remainders[key]??0)+f(loss*1000)),units=Math.floor(accrued);remainders[key]=f(accrued-units);
      if(units)learnSkill(skill,-units,p);
     }
    }
    if(episode&&(medicalStatus(record)!=='mobile'||advanceAnimalConfusionState256(episode,clinicalId,medicalCivilCore271(record,core)+phase,1,random))){episode=undefined;recovered=true;}
   }
  },
  commit(){
   if(done||(record.death?medicalCivilTick271(record)>clock:medicalCivilTick271(record)!==clock)||actualCommitPawn&&(!local||!isSchema256Or257(local.schemaVersion)||!local.pawns.includes(actualCommitPawn)||local.pawns.some(a=>a!==actualCommitPawn&&a.id===p.id)||local.tick!==clock||actualCommitPawn.health!==record||actualCommitPawn.id!==p.id))throw Error('Human condition outcome has an invalid owner clock/adoption');done=true;
   if(record.death||recovered&&!episode){recoverHumanConfusion256(commitPawn,local);return;}
   if(started&&episode&&!startHumanConfusion256(commitPawn,clock,local))throw Error('Human clinical admission changed before actual commit');
   if(episode&&commitPawn.mental?.crisis?.kind==='confused-wander')commitPawn.mental.crisis.age=episode.ageCore;
  }
 };
}
