import {maxStunHold318} from './travel-validation.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import { microelectronicsUnlocked } from './research.ts';
import { validCookingOrder } from './player-cooking-save.ts';
import { validBillSettings } from './cooking-bills.ts';
import type { World } from './types.ts';
import { EMP_ADAPTATION_CORE_TICKS,EMP_DAMAGE_AMOUNTS,EMP_MAX_STUN_CORE_TICKS,empStunDuration } from './emp-rules.ts';
import { empStructureSupported,empStunUntilCore277 } from './emp-state.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const durations=EMP_DAMAGE_AMOUNTS.map(empStunDuration);

export function validMechanoidEmpState(value:unknown,version:number,tick:number,stopped=false,coreNow297?:number):boolean {
 const physicalCoreNow297=validationCore297(version,tick,coreNow297);if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(physicalCoreNow297))return false;
  if(value===undefined)return true;
  const core=physicalCoreNow297,offset=object(value)?value.suspendedCore277:undefined;
  if(offset!==undefined&&(!isSchema277OrLater(version)||!integer(offset,1,core)||!object(value)||!integer(value.lastAtCore,0,core-offset)))return false;
  return version>=208&&integer(core)&&object(value)&&keys(value,['lastAtCore','adaptedUntilCore','stunUntilCore',...(isSchema277OrLater(version)?['suspendedCore277']:[])])
    &&integer(value.lastAtCore,0,core)&&integer(value.adaptedUntilCore)&&integer(value.stunUntilCore)
    &&value.adaptedUntilCore===value.lastAtCore+EMP_ADAPTATION_CORE_TICKS
    &&(durations.includes(value.stunUntilCore-value.lastAtCore)&&!stopped
      ||integer(value.stunUntilCore,value.lastAtCore,Math.min(core-Number(offset??0),value.lastAtCore+EMP_MAX_STUN_CORE_TICKS)))
    &&Number.isSafeInteger(Math.max(value.adaptedUntilCore,value.stunUntilCore)+Number(offset??0))&&Math.max(value.adaptedUntilCore,value.stunUntilCore)+Number(offset??0)>core;
}

/** The larger future horizon belongs only to the EMP mechanical owner.
 * Ordinary human/animal/melee interval readers retain their 45-Core limit. */
export function validMechanoidEmpIntervals(value:unknown,version:number,start:number,tick:number,emp:unknown,coreNow297?:number):boolean {
 const physicalLocalNow297=isCorePhysicalSchema297(version)?validationCore297(version,tick,coreNow297)/10:tick;if(isCorePhysicalSchema297(version)&&!Number.isFinite(physicalLocalNow297))return false;
  if(version<208||!Array.isArray(value)||!value.length||value.length>4096||Object.keys(value).length!==value.length)return false;
  let previous=start-1;
  return value.every(s=>{
    if(!object(s)||!keys(s,['start','end'])||typeof s.start!=='number'||!Number.isFinite(s.start)||typeof s.end!=='number'||!Number.isFinite(s.end)
      ||s.start<start||s.start>physicalLocalNow297||s.end<=s.start||s.start<=previous||!Number.isSafeInteger(s.end*10)||s.end>physicalLocalNow297+EMP_MAX_STUN_CORE_TICKS/10
      ||s.end>physicalLocalNow297+maxStunHold318(version)&&(!object(emp)||s.end*10!==empStunUntilCore277(emp as unknown as import('./emp-state.ts').EmpAdaptationState)))return false;
    previous=s.end;return true;
  });
}
export function validStructureEmpState(value:unknown,kind:unknown,version:number,tick:number,coreNow297?:number):boolean {
 const physicalCoreNow297=validationCore297(version,tick,coreNow297);if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(physicalCoreNow297))return false;
  if(value===undefined)return true;
  const core=physicalCoreNow297;
  return version>=208&&integer(core)&&empStructureSupported(kind)&&object(value)
    &&keys(value,['sinceCore','untilCore'])&&integer(value.sinceCore,0,core)&&integer(value.untilCore,core+1,core+EMP_MAX_STUN_CORE_TICKS)
    &&value.untilCore-value.sinceCore>=1350;
}

/** Installed devices and minified batteries retain the absolute disable clock.
 * Plans are references and never own an additional transient state. */
export function validEmpStructureTransport(w:World,version?:number,packedRecords?:readonly PackedFurniture[],clock?:number,coreNow297?:number):boolean;
export function validEmpStructureTransport(w:Pick<World,'schemaVersion'|'research'|'tick'>&Partial<Pick<World,'phaseCore297'>>,version:number,packedRecords:readonly PackedFurniture[],clock?:number,coreNow297?:number):boolean;
export function validEmpStructureTransport(w:World|Pick<World,'schemaVersion'|'research'|'tick'>&Partial<Pick<World,'phaseCore297'>>,version:number=w.schemaVersion,packedRecords?:readonly PackedFurniture[],clock:number=w.tick,coreNow297?:number):boolean {
  const local='structures'in w?w:undefined;if(!packedRecords&&!local)return false;
 const actualCore=isCorePhysicalSchema297(version)?(packedRecords?(coreNow297??clock*10):effectiveCore297(w)):undefined;
  if(!packedRecords)for(const s of local!.structures)if(Object.hasOwn(s,'emp')&&(s.emp===undefined||!validStructureEmpState(s.emp,s.kind,version,w.tick,actualCore)))return false;
  const copied=(v:unknown)=>object(v)&&Object.hasOwn(v,'emp');
  const packed=(p:unknown,tick:number,physicalCore?:number)=>!copied(p)&&object(p)&&object(p.building)
    &&(!copied(p.building)||p.building.kind==='battery'&&p.building.emp!==undefined&&validStructureEmpState(p.building.emp,'battery',version,tick,physicalCore));
  for(const p of packedRecords??local!.packed??[])if(!packed(p,packedRecords?clock:w.tick,actualCore))return false;
  if(packedRecords)return true;
  for(const j of local!.jobs)if(copied(j)||copied(j.furniture)||copied(j.deconstruction))return false;
  for(const records of [local!.visitors?.departed??[],local!.podRescues?.departed??[]])for(const departure of records)
    for(const p of departure.packed??[])if(!packed(p,departure.tick,isCorePhysicalSchema297(version)?departure.tick*10:undefined))return false;
  return true;
}

/** Prospective content gate shared by save and sparse transport. Existing
 * production guards still validate the common gun task/ingredients/claims. */
export function validEmpProductionTransport(w:World,version?:number,packedRecords?:readonly PackedFurniture[]):boolean;
export function validEmpProductionTransport(w:Pick<World,'schemaVersion'|'research'|'tick'>&Partial<Pick<World,'phaseCore297'>>,version:number,packedRecords:readonly PackedFurniture[]):boolean;
export function validEmpProductionTransport(w:World|Pick<World,'schemaVersion'|'research'|'tick'>&Partial<Pick<World,'phaseCore297'>>,version:number=w.schemaVersion,packedRecords?:readonly PackedFurniture[]):boolean {
  const local='structures'in w?w:undefined;if(!packedRecords&&!local)return false;
  const allowed=version>=208&&microelectronicsUnlocked(w);
  for(const station of packedRecords?packedRecords.map(p=>p.building):[...local!.structures,...(local!.packed??[]).map(p=>p.building)])for(const bill of station.bills??[])
    if(bill.recipe==='make-emp-launcher'&&(!allowed||station.kind!=='machining-table'||!validBillSettings(bill,bill.recipe,version)))return false;
  if(packedRecords)return true;
  for(const pile of local!.piles)if(pile.gunWork?.recipe==='make-emp-launcher'&&!allowed)return false;
  for(const p of local!.pawns){
    if(p.cooking?.recipe==='make-emp-launcher'&&!allowed)return false;
    for(const order of p.orders?.queue??[])if(object(order)&&object(order.cooking)&&order.cooking.recipe==='make-emp-launcher'
      &&(!allowed||!validCookingOrder(order,local!)))return false;
  }
  return true;
}
