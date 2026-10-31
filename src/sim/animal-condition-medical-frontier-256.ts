import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {medicalCivilCore271} from './suspended-human-clock-271.ts';
import {advanceAnimalAgeConditionInterval256,tickAnimalConditionTends256} from './animal-age-condition-runtime-256.ts';
import {destroyAnimalConditionPart256} from './animal-condition-missing-part-256.ts';
import {advanceAnimalConfusionState256,tryStartAnimalConfusionLocal256,tryStartAnimalConfusionCaravan256,interruptAnimalConditionJob256} from './animal-condition-mental-runtime-256.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {medicalStatus,reconcileMedicalDeath} from './injury-state.ts';
import type {AnimalAgeMedical256} from './animal-age-condition-state-256.ts';
import type {ActualAnimalMind256,AnimalConfusion256} from './animal-condition-mental-state-256.ts';
import type {MedicalRecord,MedicalRandom} from './injury-types.ts';
import type {InitialAnimalRandom256} from './initial-animal-age-256.ts';
import type {World} from './types.ts';
/** Explicit adapter for the existing gameplay stream; no hidden RNG, no
 * restoration of the generation counter stream during subsequent health. */
export function animalClinicalRandom256(draw:MedicalRandom):InitialAnimalRandom256 {
 const value=()=>{const n=draw();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Invalid actual animal clinical draw');return n;};
 return {value,float:(min,max)=>max<=min?Math.fround(min):Math.fround(Math.fround(value()*Math.fround(max-min))+Math.fround(min)),integer:(min,max)=>max<=min?min:min+Math.floor(value()*(max-min))};
}
export interface AnimalConditionMedicalFrontier256 {
 /** Called by advanceMedical immediately after each real record.tick++.
  * It cannot itself advance the record, owner or global clock. */
 step(record:MedicalRecord):void;
 /** Called only after the existing World outcome/death-capacity preflight.
  * Failed outcomes never mutate intentions/reservations or mental state. */
 commit():void;
}
function frontier(a:ActualAnimalMind256,record:AnimalAgeMedical256,draw:MedicalRandom,local:World|undefined,caravan:boolean):AnimalConditionMedicalFrontier256|undefined {
 if(!record.animalAgeConditions&&!a.confusion&&!record.toxicBuildup)return;
 if(!a.wander)throw Error('Animal condition frontier requires the actually constructed mind');
 const random=animalClinicalRandom256(draw);let episode:AnimalConfusion256|undefined=a.confusion?{...a.confusion}:undefined,startedAt:number|undefined,recovered=false,lastTick=record.tick,committed=false;
 const canStart=()=>!episode&&!a.manhunter&&!!a.wander&&a.state!=='sleeping'&&a.state!=='dead'&&a.state!=='downed'&&medicalStatus(record)==='mobile'&&(caravan||!!local?.wildlife?.animals.includes(a)&&!animalCarrier(local,a.id));
 return {
  step(current){
   if(current!==record||record.tick!==lastTick+1||committed)throw Error('Animal clinical frontier is not its actual original outcome');lastTick=record.tick;
   for(let core=(record.tick-1)*10+1;core<=record.tick*10&&!record.death;core++){
    tickAnimalConditionTends256(record);
    advanceAnimalAgeConditionInterval256(record,{actorId:a.id,atCore:core,civilCore:medicalCivilCore271(record,core),deltaCore:1,random,bindings:{
     inMentalState:()=>!!a.manhunter||!!episode,
     tryStartConfused:(_source,atCore)=>{if(!canStart())return false;episode={revision:1,ageCore:0};startedAt=medicalCivilCore271(record,atCore);return true;},
     destroyPart:(part,atCore)=>{destroyAnimalConditionPart256(record,part,atCore,random);},
     reconcileHealth:()=>{reconcileMedicalDeath(record);}
    }});
    if(episode){if(medicalStatus(record)!=='mobile'||a.manhunter||advanceAnimalConfusionState256(episode,a.id,medicalCivilCore271(record,core),1,random)){episode=undefined;recovered=true;}}
   }
  },
  commit(){
   if(committed)throw Error('Animal clinical mental outcome already committed');committed=true;
   if(record.death){delete a.confusion;return;}
   if(startedAt!==undefined&&episode){
    const ok=local?tryStartAnimalConfusionLocal256(local,a,isCorePhysicalSchema297(Number(local.schemaVersion))?effectiveCore297(local):startedAt):caravan&&tryStartAnimalConfusionCaravan256(a);
    if(!ok)throw Error('Prepared actual animal mental admission changed before commit');a.confusion=episode;
   }else if(episode)a.confusion=episode;
   else if(recovered){delete a.confusion;if(local)interruptAnimalConditionJob256(a,local.tick,true);}
  }
 };
}
/** Real World adapter, including explosive-health's private outcome record. */
export function localAnimalConditionFrontier256(w:World,a:ActualAnimalMind256,record:MedicalRecord,draw:MedicalRandom):AnimalConditionMedicalFrontier256|undefined {
 if(w.schemaVersion<256)return;
 if(!w.wildlife?.animals.includes(a))throw Error('Clinical local animal owner missing');
 return frontier(a,record,draw,w,false);
}
/** The caller already holds the actual group original and origin header.
 * No local World, coordinates, standability or grid are manufactured. */
export function caravanAnimalConditionFrontier256(a:ActualAnimalMind256,record:MedicalRecord,draw:MedicalRandom):AnimalConditionMedicalFrontier256|undefined {return frontier(a,record,draw,undefined,true);}
/** Actual Free WorldPawn: health advances, spatial mental admission does not. */
export function worldPawnAnimalConditionFrontier256(a:ActualAnimalMind256,record:MedicalRecord,draw:MedicalRandom):AnimalConditionMedicalFrontier256|undefined {return frontier(a,record,draw,undefined,false);}
