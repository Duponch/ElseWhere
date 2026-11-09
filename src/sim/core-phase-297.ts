import {SCHEMA_VERSION} from './types.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import type {World} from './types.ts';
export interface PhaseWorld297 {readonly tick:number;readonly schemaVersion:number;readonly phaseCore297?:number}
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
/** LIVE validated state only; forwards real campaign fields, grants no owner. */
export function effectiveCore297(w:PhaseWorld297):number {
 const version=Number(w.schemaVersion),tick=w.tick;
 if(!integer(tick)||!integer(version,1,SCHEMA_VERSION))throw Error('Invalid live physical clock');
 const core=tick*10;if(!integer(core))throw Error('Physical clock exhausted');
 if(!isCorePhysicalSchema297(version))return core; // Do not read a future field on historical Worlds.
 const phase=w.phaseCore297;if(!integer(phase,0,9)||!integer(core+phase))throw Error('Invalid committed physical phase');return core+phase;
}
export const effectiveLocal297=(w:PhaseWorld297):number=>effectiveCore297(w)/10;
/** Shape callers with a civil timestamp need an EXPLICIT physical owner proof.
 * Missing proof is rejected in297; it is not borrowed from an unrelated root. */
export function validationCore297(version:number,civilTick:number,coreNow297?:number):number {
 if(!integer(version,1,SCHEMA_VERSION))return NaN;
 if(!isCorePhysicalSchema297(version))return civilTick*10;
 return integer(civilTick)&&integer(coreNow297)&&Math.floor(coreNow297/10)===civilTick?coreNow297:NaN;
}
export function validPhaseCore297(raw:unknown,version:number,localBody=false):boolean {
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!integer(version,1,SCHEMA_VERSION))return false;
 const present='phaseCore297'in raw;
 if(!isCorePhysicalSchema297(version)||localBody)return !present;
 const p=Object.getOwnPropertyDescriptor(raw,'phaseCore297'),t=Object.getOwnPropertyDescriptor(raw,'tick');
 return !!p&&p.enumerable===true&&Object.hasOwn(p,'value')&&integer(p.value,0,9)&&!!t&&t.enumerable===true&&Object.hasOwn(t,'value')&&integer(t.value)&&integer(t.value*10+p.value);
}
export interface SuspensionClock297 {readonly version:297;readonly heldAtCore297:number;readonly targetCore297:number}
/** The caller supplies the actual holder and target frontiers, not wall time. */
export function suspensionDeltas297(heldAt:number,targetCivil:number,physical?:SuspensionClock297):{civil:number;core:number} {
 if(!integer(heldAt)||!integer(targetCivil,heldAt))throw Error('Invalid civil suspension interval');
 const civil=targetCivil-heldAt;if(physical===undefined)return {civil,core:civil*10};
 if(!physical||typeof physical!=='object'||Array.isArray(physical))throw Error('Suspension proof requires own closed data');
 const descriptors=Reflect.ownKeys(physical);if(descriptors.length!==3||descriptors.some(key=>typeof key!=='string'||!['version','heldAtCore297','targetCore297'].includes(key)||!Object.getOwnPropertyDescriptor(physical,key)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(physical,key)!,'value')))throw Error('Suspension proof requires own closed data');
 if(physical.version!==297||!integer(physical.heldAtCore297)||!integer(physical.targetCore297,physical.heldAtCore297)||Math.floor(physical.heldAtCore297/10)!==heldAt||Math.floor(physical.targetCore297/10)!==targetCivil)throw Error('Invalid owned physical suspension interval');
 return {civil,core:physical.targetCore297-physical.heldAtCore297};
}
/** Optional prospective holder field. Absence is the historical phase0 capture. */
export function heldCore297(holder:unknown,version:number,heldAt:number):number {
 if(!integer(version,1,SCHEMA_VERSION)||!holder||typeof holder!=='object'||Array.isArray(holder)||!integer(heldAt)||!integer(heldAt*10))return NaN;
 const present='heldAtCore297'in holder;if(!present)return heldAt*10;
 const d=Object.getOwnPropertyDescriptor(holder,'heldAtCore297');return isCorePhysicalSchema297(version)&&!!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&integer(d.value)&&Math.floor(d.value/10)===heldAt?d.value:NaN;
}

/** Call ONLY inside the real occupied-holder capture transaction. */
export function captureOccupiedHeldCore297(w:PhaseWorld297):{heldAtCore297:number} {if(!isCorePhysicalSchema297(Number(w.schemaVersion)))throw Error('Prospective held clock before297');return {heldAtCore297:effectiveCore297(w)};}
