import {isIedSchema357,isShellItem357} from './ied-traps-357.ts';
import {isFutureEcologyItem256} from './cave-products-256.ts';
import { ITEM_DEFINITIONS,V219_ITEM_IDS } from './items.ts';
import { isColonist } from './affiliation.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { FIRE_MAX_SIZE,FIRE_MIN_SIZE,type BurningReaction } from './fire-rules.ts';
import { pileMaxHp,resourceMaxHp } from './thing-damage-rules.ts';
import type { World } from './types.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:object,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const cell=(w:World,c:unknown,strict=true):c is {x:number;z:number}=>object(c)&&(!strict||keys(c,['x','z']))&&int(c.x,0,w.width-1)&&int(c.z,0,w.height-1);
/** Sparse loss keys have their own schema gate, even when no plant remains. */
export function validFireResourceLosses(value:unknown,version:number):boolean {
  return object(value)&&Object.entries(value).every(([kind,count])=>
    (['tree','berries','rice','potato','corn','cotton'].includes(kind)||version>=91&&kind==='wild-plant'||version>=182&&kind==='healroot'||version>=227&&kind==='haygrass'||version>=265&&kind==='hops')&&int(count,1));
}
export function validBurningReaction(w:World,v:unknown,version:number):v is BurningReaction {
  return version>=87&&object(v)&&keys(v,['phase','remainingCore','target'])&&['panic','extinguish'].includes(String(v.phase))&&int(v.remainingCore,0,v.phase==='extinguish'?150:10)&&(v.target===undefined||v.phase==='panic'&&cell(w,v.target));
}
export function validateThingDamage(w:World,version:number):string[] {
  const errors:string[]=[];
  for(const r of w.resources)if(r.damage!==undefined&&(version<87||!int(r.damage,1,resourceMaxHp(r)-1)))errors.push('Invalid resource damage.');
  for(const p of w.piles)if(p.damage!==undefined&&(version<87||p.apparel||p.weapon||!int(p.damage,1,pileMaxHp(p,version)-1)))errors.push('Invalid item damage.');
  return errors;
}
/** Call after ordinary world/actor shapes, using the global identity registry. */
export function validateFires(w:World,version:number,ids?:Set<number>):string[] {
  const errors:string[]=[],s=w.fires,now=w.tick*10;
  if(s===undefined){if(w.pawns.some(p=>p.burning||p.firefighting)||w.wildlife?.animals.some(a=>a.burning))errors.push('Fire activity without fire state.');return errors;}
  if(version<87||!object(s)||!keys(s,['rng','clockCore','items','embers','batteryWicks','ledger'])||!int(s.rng,1,0xffffffff)||s.clockCore!==now||!Array.isArray(s.items)||s.items.length>w.width*w.height+w.pawns.length+(w.wildlife?.animals.length??0)||!Array.isArray(s.embers)||!Array.isArray(s.batteryWicks))return ['Invalid fire state.'];
  const ownIds=new Set<number>(),ground=new Set<number>(),pawns=new Set<number>(),animals=new Set<number>();
  const identity=(id:unknown)=>{if(!int(id,1,w.nextId-1)||ownIds.has(id)||ids?.has(id)){errors.push('Invalid or duplicate fire identity.');return;}ownIds.add(id);ids?.add(id);};
  for(const f of s.items){
    if(!object(f)||!keys(f,['id','x','z','size','bornCore','nextPulseCore','complexCore','spreadCore','attachedPawnId','attachedAnimalId'])||!cell(w,f,false)||!finite(f.size,f.attachedPawnId!==undefined||f.attachedAnimalId!==undefined?Number.MIN_VALUE:FIRE_MIN_SIZE,FIRE_MAX_SIZE)||!int(f.bornCore,0,now)||!int(f.nextPulseCore,now+1,now+15)||f.nextPulseCore<=f.bornCore||(f.nextPulseCore-f.bornCore)%15!==0||!int(f.complexCore,0,135)||f.complexCore%15!==0||f.complexCore!==((f.nextPulseCore-f.bornCore-15)%150)||!int(f.spreadCore)||f.attachedPawnId!==undefined&&f.attachedAnimalId!==undefined){errors.push('Invalid fire record.');continue;}
    identity(f.id);
    if(f.attachedPawnId!==undefined){const p=w.pawns.find(p=>p.id===f.attachedPawnId);if(!p||p.state==='dead'||pawns.has(p.id)||!validBurningReaction(w,p.burning,version)||p.x!==f.x||p.z!==f.z)errors.push('Invalid burning person.');else pawns.add(p.id);}
    else if(f.attachedAnimalId!==undefined){const a=w.wildlife?.animals.find(a=>a.id===f.attachedAnimalId);if(!a||a.state==='dead'||animals.has(a.id)||!validBurningReaction(w,a.burning,version)||a.x!==f.x||a.z!==f.z)errors.push('Invalid burning animal.');else animals.add(a.id);}
    else {const i=f.z*w.width+f.x;if(ground.has(i))errors.push('Duplicate ground fire.');ground.add(i);}
  }
  for(const e of s.embers){if(!object(e)||!keys(e,['id','from','to','impactCore'])||!cell(w,e.from)||!cell(w,e.to)||!int(e.impactCore,now+1,now+130)||Math.hypot(e.to.x-e.from.x,e.to.z-e.from.z)>Math.sqrt(5)+1e-9){errors.push('Invalid fire ember.');continue;}identity(e.id);}
  const wicks=new Set<number>();for(const wick of s.batteryWicks){if(!object(wick)||!keys(wick,['structureId','endCore'])||!int(wick.structureId,1,w.nextId-1)||!int(wick.endCore,now+1,now+150)||wicks.has(wick.structureId)||!w.structures.some(b=>b.kind==='battery'&&b.id===wick.structureId))errors.push('Invalid battery fire fuse.');else wicks.add(wick.structureId);}
  const l=s.ledger;
  if(!object(l)||!keys(l,['items','resources','structures','extinguished','ignitions','batteryEnergyLost','fuelTicksLost','fuelTicksBurned','woodPotentialLost'])||!object(l.items)||!object(l.resources)||!int(l.woodPotentialLost)||!int(l.fuelTicksLost)||!int(l.fuelTicksBurned)||!int(l.structures)||!int(l.extinguished)||!int(l.ignitions)||!finite(l.batteryEnergyLost,0,Number.MAX_SAFE_INTEGER)||!Number.isSafeInteger(l.batteryEnergyLost*2)||Object.entries(l.items).some(([k,v])=>!Object.hasOwn(ITEM_DEFINITIONS,k)||!isIedSchema357(version)&&isShellItem357(k)||version<256&&(isFutureEcologyItem256(k)||k==='slag-steel-chunk')||version<235&&k==='minified-tree'||version<227&&['hay','kibble'].includes(k)||version<206&&k==='neutroamine'||version<194&&k==='scyther-corpse'||version<197&&V219_ITEM_IDS.some(item=>item===k)||version<152&&k==='fine-meal'||version<154&&k==='lavish-meal'||version<155&&k==='vegetarian-fine-meal'||version<156&&k==='carnivore-fine-meal'||version<157&&k==='vegetarian-lavish-meal'||version<159&&k==='carnivore-lavish-meal'||!int(v,1))||!validFireResourceLosses(l.resources,version))errors.push('Invalid fire loss ledger.');
  // Active fires and recorded extinctions are disjoint subsets of ignitions.
  // The subtraction avoids overflow and reserves an exact counter increment
  // for every remaining fire, even at the safe-integer boundary.
  if(object(l)&&int(l.ignitions)&&int(l.extinguished)&&l.ignitions-l.extinguished<s.items.length)errors.push('Inconsistent fire ignition and extinction ledger.');
  for(const p of w.pawns){
    if(p.burning!==undefined&&!pawns.has(p.id))errors.push('Orphan burning reaction.');
    if(p.burning&&p.state!=='downed'&&p.state!=='dead'&&(p.burning.phase==='extinguish'&&p.path.length||p.path.length&&(!p.burning.target||p.path.at(-1)!.x!==p.burning.target.x||p.path.at(-1)!.z!==p.burning.target.z)))errors.push('Invalid burning route.');
    if(p.burning&&(p.hunting||p.research||p.equipmentTask||p.jobId!==null||p.ward||p.feed||p.tend||p.rescue||p.haul||p.cooking||p.need||p.recreation.task||p.orders.active!==null||p.orders.queue.length||p.priorityWork||p.firefighting))errors.push('Burning pawn still owns ordinary work.');
    const t=p.firefighting;if(t===undefined)continue;
    if(!object(t)||!keys(t,['fireId','forced','phase','cooldownCore','spentCore'])||!s.items.some(f=>f.id===t.fireId)||typeof t.forced!=='boolean'||!['approach','beat'].includes(t.phase)||!int(t.cooldownCore,0,now+66)||!int(t.spentCore,0,36000)||t.spentCore%10||!isColonist(p)||p.prisoner||medicalWorkRefusal(p)||p.burning||p.jobId!==null||p.research||p.hunting||p.equipmentTask||p.ward||p.feed||p.tend||p.rescue||p.haul||p.need||p.cooking||p.orders.active!==null||p.orders.queue.length||p.recreation.task||p.interruptedCargo)errors.push('Invalid firefighting task.');
  }
  for(const a of w.wildlife?.animals??[])if(a.burning!==undefined&&(!animals.has(a.id)||a.meal||a.flee||a.threat||a.retaliation
    ||a.strike&&(version<183||a.path.length||(a.motion?.end??0)>w.tick||!['idle','sleeping'].includes(a.state))))errors.push('Invalid animal burning activity.');
  return errors;
}
