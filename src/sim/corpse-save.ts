import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {validAnimalAreaField287} from './animal-area-save-287.ts';
import {animalThermalFields466} from './animal-thermal-v466.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {validScariaRecord261} from './animal-scaria-261.ts';
import {toxicCorpseRotAllowance256} from './toxic-victim-256.ts';
import {validToxicFalloutRotCredit294} from './toxic-fallout-save-294.ts';
import {validAnimalAgeCoreRemainder256} from './initial-animal-age-owner-256.ts';
import {validAnimalClinicalOwner256} from './animal-clinical-age-v256.ts';
import { validateMedicalRecord } from './injury-validation.ts';
import type { World } from './types.ts';
import { animalSpecies,isAnimalSpeciesInVersion } from './animal-species.ts';
import { validCorpseConsumption } from './corpse-anatomy.ts';
import type { CorpseState } from './corpses.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
/** Corpses may keep ageing beyond either rotting threshold. The body remains an
 * object; time changes its usability, not its existence or its owner. */
export function validCorpseRot(v:unknown,tick:number,death:number,version:number,medical?:unknown):boolean {
  const scaria=object(medical)&&object(medical.death)&&medical.death.tick===death&&validScariaRecord261(medical,261,true)&&object(medical.scaria261)&&medical.scaria261.deathRot===true?15000:0;
  const credit=object(v)?Object.getOwnPropertyDescriptor(v,'fallout294')?.value??0:0;
  return object(v)&&Object.getPrototypeOf(v)===Object.prototype&&validToxicFalloutRotCredit294(v,version,true)&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&['progress','atTick','rate',...(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))?['fallout294']:[]].includes(k)&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'))&&int(v.atTick,death,tick)
    &&credit<=Math.min(Number.MAX_SAFE_INTEGER,3000*(Number(v.atTick)-death+1))
    &&typeof v.progress==='number'&&Number.isFinite(v.progress)&&v.progress>=credit&&v.progress-credit<=Number(v.atTick)-death+Math.max(scaria,toxicCorpseRotAllowance256(medical,death))
    &&(v.rate===undefined||typeof v.rate==='number'&&Number.isFinite(v.rate)&&v.rate>=0&&v.rate<1);
}
export function validCorpseShape(p:Record<string,unknown>,version:number):boolean {
  if(p.kind!=='corpse')return p.corpse===undefined;
  const c=p.corpse;
  const thermal=animalThermalFields466(c,version),clock=isSchema287OrLater(version)&&object(c)&&object(c.health)?medicalCivilTick271(c.health as unknown as import('./injury-types.ts').MedicalRecord):Number((object(c)?c.health as {tick?:number}:undefined)?.tick);
  return version>=79&&object(c)&&validAnimalAreaField287(c,version,Number.MAX_SAFE_INTEGER)&&validAnimalAgeCoreRemainder256(c,version,clock)&&isAnimalSpeciesInVersion(c.species,version)&&(version>=178||String(c.species)!=='red-fox')&&(version>=91||c.species==='hare')&&p.item===animalSpecies(c.species).corpseItem&&p.quantity===1&&object(p.owner)&&['ground','pawn'].includes(String(p.owner.type))
    &&Object.keys(c).every(k=>['animalId','species','sex','health','facing',...version>=121?['ageTicks']:[],...version>=178?['consumedParts']:[],...version>=256?['growthTracker','ageCoreRemainder']:[],...isSchema287OrLater(version)?['animalMapAreas287']:[]].includes(k))
    &&(version<121?c.ageTicks===undefined:int(c.ageTicks,0,Number.MAX_SAFE_INTEGER))
    &&c.animalId===p.id&&['female','male'].includes(String(c.sex))
    &&(c.facing===undefined||typeof c.facing==='number'&&Number.isFinite(c.facing)&&Math.abs(c.facing)<=Math.PI)
    // This validator owns animal corpses only; the human-corpse pile keeps its
    // owner's medical record on the human pawn, validated in serialization.
    &&validateMedicalRecord(c.health,true,true,thermal.heat,thermal.cold,true,version>=79,version>=81,version>=84,version>=87,version>=88,version>=89,version,false)===null&&object(c.health)&&object(c.health.death)&&c.health.body===c.species
    &&validAnimalClinicalOwner256(c.health as unknown as import('./injury-types.ts').MedicalRecord,c.species,Number(c.ageTicks),clock)
    &&validCorpseConsumption(c as unknown as CorpseState,Number.MAX_SAFE_INTEGER,version);
}
export function validateCorpses(w:World,version:number):string[] {
  const errors:string[]=[];
  for(const p of w.piles)if(p.kind==='corpse'&&p.item!=='human-corpse') {
    if(!validCorpseShape(p as unknown as Record<string,unknown>,version)){errors.push('Invalid corpse state.');continue;}
    const c=p.corpse!;
    if(!validCorpseConsumption(c,w.tick,version,c.consumedParts?.some(m=>m.atCore382!==undefined)?effectiveCore297(w):undefined))errors.push('Invalid consumed corpse anatomy or clock.');
    if(!validCorpseRot(p.rot,w.tick,c.health.death!.tick,version,c.health)||c.health.tick>w.tick||Array.isArray(w.wildlife?.animals)&&w.wildlife.animals.some(a=>a?.id===c.animalId))errors.push('Invalid corpse age, clock or duplicated animal.');
  }
  return errors;
}
