import {FIRST_DAYS_MEMORIES_343,isFirstDaysMemory343} from './first-days-memories-343.ts';
import {MOOD_POOL_MEMORIES_350,isMoodPoolMemory350} from './mood-pool-memories-350.ts';
import {suspensionDeltas297,type SuspensionClock297} from './core-phase-297.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {Pawn} from './types.ts';
import {prepareAnestheticResume271} from './anesthetic.ts';

/** All owner frontiers are civil. The medical kernel owns active time. */
export const medicalCivilTick271=(record:MedicalRecord):number=>record.civilTick271??record.tick;
/** Convert a step in the CURRENT active segment only, never a historical date. */
export const medicalCivilCore271=(record:MedicalRecord,clinicalCore:number):number=>clinicalCore+(medicalCivilTick271(record)-record.tick)*10;
export const medicalDeathCivilTick271=(record:MedicalRecord):number|undefined=>record.death?.tick;
export function medicalElapsedTicks271(record:MedicalRecord,targetCivil:number):number {
 const current=medicalCivilTick271(record),elapsed=targetCivil-current;
 if(!Number.isSafeInteger(targetCivil)||!Number.isSafeInteger(current)||!Number.isSafeInteger(elapsed)||elapsed<0)throw Error('Invalid actual civil medical interval');
 return elapsed;
}
/** Header admission is descriptor-first, including explicit undefined and
 * inherited/accessor values. The caller admits humans271 or the prospective flesh-animal277 domain. */
export function validMedicalCivilHeader271(value:unknown,version:number,human=true):boolean {
 if(!value||typeof value!=='object')return false;
 const d=Object.getOwnPropertyDescriptor(value,'civilTick271');if(!d)return !('civilTick271'in value);
 const t=Object.getOwnPropertyDescriptor(value,'tick');
 return isSchema271OrLater(version)&&human&&Object.hasOwn(d,'value')&&d.enumerable===true&&Number.isSafeInteger(d.value)&&d.value>=0&&!!t&&Object.hasOwn(t,'value')&&Number.isSafeInteger(t.value)&&t.value>=0&&d.value>=t.value&&Number.isSafeInteger(d.value*10);
}
type Write271={object:object;key:string;before:PropertyDescriptor|undefined;after:unknown};
export interface SuspendedHumanResume271 {current():boolean;commit():boolean}
/** Pure plan over actual originals. No mutation, random draw or skipped tick
 * is performed while planning or while adopting the held civil gap. */
export function prepareSuspendedHumanResume271(pawn:Pawn,heldAt:number,targetCivil:number,physical297?:SuspensionClock297):SuspendedHumanResume271 {
 if(!Number.isSafeInteger(heldAt)||heldAt<0||!Number.isSafeInteger(targetCivil)||targetCivil<heldAt||!Number.isSafeInteger(targetCivil*10))throw Error('Invalid actual human suspension interval');
 const deltas297=suspensionDeltas297(heldAt,targetCivil,physical297),delta=deltas297.civil,deltaCore297=deltas297.core,h=pawn.health,age=pawn.age,body=pawn.body,bodyRot=body?.rot,mental=pawn.mental,denied=pawn.deniedJoining,catharsis=mental?.catharsis,marker=pawn.cryptosleepHeldAt271,writes:Write271[]=[],links:(()=>boolean)[]=[];
 if(marker!==undefined&&marker!==heldAt)throw Error('Actual pawn suspension marker differs from holder');
 const put=(object:object,key:string,after:unknown)=>{
  const before=Object.getOwnPropertyDescriptor(object,key);
  if(before&&(!Object.hasOwn(before,'value')||!before.writable)||!before&&(!Object.isExtensible(object)||key in object))throw Error('Suspension original is not mutable data');
  writes.push({object,key,before,after});
 };
 const add=(object:object,key:string,amount:number)=>{const old=(object as Record<string,unknown>)[key];if(typeof old!=='number'||!Number.isSafeInteger(old)||!Number.isSafeInteger(old+amount))throw Error('Suspension numeric clock exhausted');put(object,key,old+amount);};
 if(h){
  const clinical=h.tick,civil=h.civilTick271,death=h.death;
  links.push(()=>h.tick===clinical&&h.civilTick271===civil&&h.death===death);
  if(h.body!==undefined||(h.death?medicalCivilTick271(h)!==h.death.tick||h.death.tick>heldAt:medicalCivilTick271(h)!==heldAt))throw Error('Actual held human clinical frontier differs from holder');
  if(!h.death&&delta){
   const anesthetic=h.anesthetic,cadence=prepareAnestheticResume271(h,pawn.id%20,targetCivil),aStamp=anesthetic?JSON.stringify(anesthetic):undefined;
   links.push(()=>h.anesthetic===anesthetic&&(!anesthetic||JSON.stringify(anesthetic)===aStamp));
   if(anesthetic&&cadence)put(anesthetic,'cadence271',cadence);
   put(h,'civilTick271',targetCivil);
  }
 }
 if(age&&delta)add(age,'chronologicalTicks',delta);
 // Schema 360: a suspended pawn is not ticked, so its inspiration does not age.
 const inspiration360=pawn.inspiration360;if(inspiration360){links.push(()=>pawn.inspiration360===inspiration360);if(delta)add(inspiration360,'until',delta);}
 const attack=pawn.lastAttack,disturbance=pawn.disturbance;
 if(attack){const at=attack.atCore,other=attack.targetId;links.push(()=>pawn.lastAttack===attack&&attack.atCore===at&&attack.targetId===other);const old=attack.suspendedTicks??0;if(delta){if(!Number.isSafeInteger(old+delta))throw Error('Suspended attack memory clock exhausted');put(attack,'suspendedTicks',old+delta);}}
 if(disturbance){links.push(()=>pawn.disturbance===disturbance);if(deltaCore297){add(disturbance,'sleepUntilCore',deltaCore297);add(disturbance,'lieUntilCore',deltaCore297);}}
 // Prospective271 owner only. Spatial277 shifts its own stagger separately.
 // Marker and explicit held/target Core proof jointly bind this frozen timer;
 // no elapsed off-map recovery and no historical <=296 retiming.
 if(physical297!==undefined&&marker===heldAt){const stagger=pawn.stagger;links.push(()=>pawn.stagger===stagger);if(stagger&&deltaCore297)add(stagger,'untilCore',deltaCore297);}
 // These are factual event dates with an individual active-age correction.
 const dated=(list:readonly object[]|undefined,born:(memory:Record<string,unknown>)=>number)=>{
  if(!list)return;const originals=[...list];links.push(()=>list.length===originals.length&&list.every((m,i)=>m===originals[i]));
  for(const memory of list){const m=memory as Record<string,unknown>,at=born(m),old=m.suspendedTicks??0;
   links.push(()=>born(m)===at&&(m.suspendedTicks??0)===old);
   if(!Number.isSafeInteger(at)||at<0||at>targetCivil||typeof old!=='number'||!Number.isSafeInteger(old)||old<0)throw Error('Invalid actual suspended memory');
   const span=targetCivil-Math.max(heldAt,at);if(span){if(!Number.isSafeInteger(old+span))throw Error('Suspended memory clock exhausted');put(memory,'suspendedTicks',old+span);}
  }
 };
 // Their expiresAt is an original civil deadline, not an event date. Keep it
 // unchanged and store the same per-memory correction as dated thoughts.
 dated(pawn.memories,m=>Number(m.expiresAt)-6000);
 dated(pawn.roomMemories,m=>Number(m.expiresAt)-(isFirstDaysMemory343(m.kind)?FIRST_DAYS_MEMORIES_343[m.kind].duration:isMoodPoolMemory350(m.kind)?MOOD_POOL_MEMORIES_350[m.kind].duration:6000));
 dated(pawn.bereavement,m=>Number(m.at));dated(pawn.deathThoughts,m=>Number(m.at));dated(pawn.familyBereavement,m=>Number(m.at));dated(pawn.romanceMemories,m=>Number(m.at));dated(pawn.partyMemories292,m=>Number(m.at));dated(pawn.coupleMemories285,m=>Number(m.at));dated(pawn.social?.memories,m=>Number(m.at));
 const coupleOthers285=pawn.coupleMemories285?.map(m=>m.otherId);
 links.push(()=>!coupleOthers285||pawn.coupleMemories285?.every((m,i)=>m.otherId===coupleOthers285[i])===true);
 const lists=[pawn.memories,pawn.roomMemories,pawn.bereavement,pawn.deathThoughts,pawn.familyBereavement,pawn.romanceMemories,pawn.partyMemories292,pawn.coupleMemories285,pawn.social?.memories],social=pawn.social;
 links.push(()=>pawn.social===social&&[pawn.memories,pawn.roomMemories,pawn.bereavement,pawn.deathThoughts,pawn.familyBereavement,pawn.romanceMemories,pawn.partyMemories292,pawn.coupleMemories285,pawn.social?.memories].every((list,i)=>list===lists[i]));
 // Couple clocks are absolute global Core deadlines. Only the memories above
 // receive active-age correction; never shift a cooldown, attempt date or RNG.
 // Legacy scalar arrays contain deadlines, not factual event dates.
 for(const [list,duration] of [[pawn.deniedJoining,36000],[pawn.mental?.catharsis,18000]] as const)if(list){const before=[...list];links.push(()=>list.length===before.length&&list.every((v,i)=>v===before[i]));for(let i=0;i<list.length;i++){const span=targetCivil-Math.max(heldAt,list[i]!-duration);if(span>0)add(list,String(i),span);}}
 const hive=pawn.hiveDefeats,hiveHeld=pawn.hiveDefeatSuspendedTicks271;
 if(hive?.length){const dates=[...hive],offsets=hiveHeld?[...hiveHeld]:undefined;
  links.push(()=>pawn.hiveDefeats===hive&&pawn.hiveDefeatSuspendedTicks271===hiveHeld&&hive.length===dates.length&&hive.every((v,i)=>v===dates[i])&&(!hiveHeld||hiveHeld.length===offsets!.length&&hiveHeld.every((v,i)=>v===offsets![i])));
  const after=hive.map((at,i)=>{const next=(hiveHeld?.[i]??0)+targetCivil-Math.max(heldAt,at);if(!Number.isSafeInteger(next)||next<0)throw Error('Invalid original suspended Hive memory');return next;});
  if(delta)put(pawn,'hiveDefeatSuspendedTicks271',after);
 }
 if(body?.rot&&delta)add(body.rot,'atTick',delta);
 let done=false;
 const current=()=>!done&&pawn.health===h&&pawn.age===age&&pawn.body===body&&body?.rot===bodyRot&&pawn.mental===mental&&mental?.catharsis===catharsis&&pawn.deniedJoining===denied&&pawn.cryptosleepHeldAt271===marker&&links.every(f=>f())&&writes.every(w=>{const d=Object.getOwnPropertyDescriptor(w.object,w.key);return w.before?!!d&&Object.hasOwn(d,'value')&&d.value===w.before.value&&d.writable===w.before.writable&&d.enumerable===w.before.enumerable&&d.configurable===w.before.configurable:d===undefined&&Object.isExtensible(w.object);});
 return {current,commit(){if(!current())return false;done=true;for(const w of writes)(w.object as Record<string,unknown>)[w.key]=w.after;return true;}};
}
