import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import type {MedicalRecord} from './injury-types.ts';

export interface CoveredInFirefoam290 {remainingCore:number}
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export function validCoveredInFirefoamState290(value:unknown):value is CoveredInFirefoam290 {
 try{
  if(!plain(value)||Reflect.ownKeys(value).length!==1)return false;
  const d=Object.getOwnPropertyDescriptor(value,'remainingCore');
  return !!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&typeof d.value==='number'&&Number.isSafeInteger(d.value)&&d.value>=1&&d.value<=900;
 }catch{return false;}
}
/** Descriptor-first medical header. Absence never acquires an effect. */
export function validCoveredInFirefoamField290(record:unknown,version:number):boolean {
 try{
  if(!plain(record)||!Number.isSafeInteger(version)||version<1||version>301)return false;
  const d=Object.getOwnPropertyDescriptor(record,'coveredInFirefoam290');
  if(!d)return !('coveredInFirefoam290'in record);
  return (version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))&&d.enumerable===true&&Object.hasOwn(d,'value')&&validCoveredInFirefoamState290(d.value);
 }catch{return false;}
}
export function firefoamIgnitionFactor290(record:MedicalRecord|undefined):0|1 {
 return record?.coveredInFirefoam290?0:1;
}
/** Only actual active owner frontiers call this; no civil/load catch-up. */
export function advanceCoveredInFirefoam290(record:MedicalRecord,deltaCore:number):void {
 if(!record.coveredInFirefoam290||record.death)return;
 if(!Number.isSafeInteger(deltaCore)||deltaCore<0)throw Error('Invalid active firefoam interval');
 const remaining=record.coveredInFirefoam290.remainingCore-deltaCore;
 if(remaining<=0)delete record.coveredInFirefoam290;else record.coveredInFirefoam290.remainingCore=remaining;
}
