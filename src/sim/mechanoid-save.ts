import {isCorePhysicalSchema297} from './physical-schema-297.ts';

import {validCapturedCoreMove297} from './core-move-save-297.ts';
import {MIN_PAWN_SPEED_V87} from './travel-validation.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import {findShipCasketActor277} from './ship-casket-state-277.ts';
import {validFilthFeet} from './filth-save.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {validSiteMechField263,validateSiteMechGroups263} from './world-site-mechanoids-263.ts';
import {mechRaidGroup261} from './mechanical-raid-groups-261.ts';
import {validMechanicalWorldFactionField259,validMechanicalWorldFaction259} from './mechanoid-world-faction-259.ts';
import {mechanicalOrder256,mechanicalDuty256,validTempleMechField256,validateTempleMechGroups256} from './temple-mech-duty-256.ts';
import {validRetainedCorpseDamage256} from './retained-corpse-damage-256.ts';
import { validateMechanoidMedicalRecord } from './injury-validation.ts';
import { isMechanoidKind,mechanoidDefinition,type MechanoidKind } from './mechanoid-definition.ts';
import { validMechanoidRangedShape,validateMechanoidRanged } from './mechanoid-ranged-save.ts';
import { medicalStatus } from './injury-state.ts';
import { travelEnd,validSlowIntervals,validStunIntervals } from './travel-timing.ts';
import { validStagger } from './stagger.ts';
import { validStunShape } from './melee-save.ts';
import { validMechanoidEmpState,validMechanoidEmpIntervals } from './emp-save.ts';
import { isBarrier } from './barriers.ts';
import { footprintCells } from './definitions.ts';
import type { MedicalRecord } from './injury-types.ts';
import type { Mechanoid } from './mechanoid-state.ts';
import type { World } from './types.ts';
import type { NumericMembershipSink } from './numeric-membership.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const finite=(v:unknown,min=0,max=Number.MAX_VALUE):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const cell=(v:unknown)=>object(v)&&keys(v,['x','z'])&&integer(v.x)&&integer(v.z);
const tools=(kind:MechanoidKind)=>kind==='scyther'?['left-blade-cut','left-blade-stab','right-blade-cut','right-blade-stab','head']:['left-fist','right-fist','head','barrel','barrel-poke'];

/** Sparse clock: mechanical records advance only on a real impact. A carcass
 * freezes that last clock, not the current World clock. Human owners never call
 * this guard and still reject the mechanical body in their ordinary validator. */
export function validMechaMedicalRecord(value:unknown,worldTick:number,dead:boolean,kind:MechanoidKind='scyther',version=194):value is MedicalRecord {
  if(!integer(worldTick)||validateMechanoidMedicalRecord(value,version,kind))return false;
  const record=value as MedicalRecord;
  return record.tick<=worldTick&&!!record.death===dead;
}
export function validMechanoidShape(value:unknown,version:number,tick:number,heldAt277?:number,coreNow297?:number):value is Mechanoid {
 const physicalCoreNow297=validationCore297(version,tick,coreNow297),physicalLocalNow297=isCorePhysicalSchema297(version)?physicalCoreNow297/10:tick;if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(physicalCoreNow297))return false;
  if(object(value)){const d=Object.getOwnPropertyDescriptor(value,'shipCryptosleepHeldAt277');if(heldAt277!==undefined?(!isSchema277OrLater(version)||heldAt277!==tick||!d?.enumerable||!Object.hasOwn(d,'value')||d.value!==heldAt277):'shipCryptosleepHeldAt277'in value)return false;if(Object.hasOwn(value,'filthFeet')&&(!isSchema277OrLater(version)||!validFilthFeet(value.filthFeet,version)))return false;}
  if(version<194||!integer(tick)||!object(value)||!validMechanicalWorldFactionField259(value,version)||!validRetainedCorpseDamage256(value,version)||!validTempleMechField256(value,version,tick,coreNow297)||!validSiteMechField263(value,version,tick,coreNow297)||!keys(value,['id','mechKind','x','z','state','health','path','motion','heading','moveCooldown','planCooldown','raid','melee','stagger','stun',...(version>=197?['ranged','meleeThreat']:[]),...(version>=208?['emp']:[]),...(version>=256?['corpseDamage','temple']:[]),...(version>=259?['worldFaction259']:[]),...(isSchema263OrLater(version)?['site263']:[]),...(isSchema277OrLater(version)?['filthFeet']:[]),...(heldAt277!==undefined?['shipCryptosleepHeldAt277']:[])])
    ||!integer(value.id,1)||!isMechanoidKind(value.mechKind)||version<197&&value.mechKind!=='scyther'||!integer(value.x)||!integer(value.z)
    ||typeof value.state!=='string'||!['idle','moving','working','downed','dead'].includes(value.state)||!finite(value.heading,-Math.PI*2,Math.PI*2)
    ||!finite(value.moveCooldown,0,1000)||!integer(value.planCooldown,0,1000)||!Array.isArray(value.path)||!value.path.every(cell)
    ||!validStagger(value.stagger,version,tick,coreNow297)||!validStunShape(value.stun,version,tick,version>=318?120:45,coreNow297)
    ||Object.hasOwn(value,'emp')&&(value.emp===undefined||!validMechanoidEmpState(value.emp,version,tick,value.state==='dead'||value.state==='downed',coreNow297)))return false;
  const m=value as unknown as Mechanoid;
  if(m.health!==undefined&&!validMechaMedicalRecord(m.health,tick,m.state==='dead',m.mechKind,version))return false;
  if(!m.health&&(m.state==='downed'||m.state==='dead'))return false;
  if(m.ranged!==undefined&&!validMechanoidRangedShape(m.ranged,m.mechKind,version,tick,coreNow297))return false;
  if(m.meleeThreat!==undefined&&(!object(m.meleeThreat)||!keys(m.meleeThreat,['attackerId','atCore'])||!integer(m.meleeThreat.attackerId,1)||!integer(m.meleeThreat.atCore,0,physicalCoreNow297)))return false;
  if(m.raid!==undefined&&(!object(m.raid)||!keys(m.raid,['group','goal'])||!integer(m.raid.group,1)||m.raid.goal!==null&&!cell(m.raid.goal)))return false;
  if(m.motion!==undefined){
    const motion=m.motion;
    // Spatial277 may carry any represented mechanical body on a HUMAN edge.
    // A released patient keeps that admitted segment. This does not change an
    // autonomous mech's speed: the envelope has no route, work or attack order.
    const carriedSegment277=isSchema277OrLater(version)&&m.path.length===0&&['idle','downed','dead'].includes(m.state)
      &&!m.melee?.order&&!m.ranged?.order&&m.ranged?.stance?.phase!=='warmup'&&!mechanicalOrder256(m)?.goal;
    const maximumSpeed=carriedSegment277?Math.max(1,mechanoidDefinition(m.mechKind).moveSpeed/4.6):mechanoidDefinition(m.mechKind).moveSpeed/4.6;
    if(!object(motion)||!keys(motion,['from','to','start','end','speedFactor','terrainDelay','stagger','stuns',...(isCorePhysicalSchema297(version)&&carriedSegment277?['coreMove297','coreMoveWalk297']:[])])||!cell(motion.from)||!cell(motion.to)
      ||!validCapturedCoreMove297(motion,version,carriedSegment277)||motion.coreMove297===true&&motion.speedFactor!==undefined&&!finite(motion.speedFactor,MIN_PAWN_SPEED_V87,1)
      ||!finite(motion.start,0,physicalLocalNow297)||!finite(motion.end,0,physicalLocalNow297+1000)||motion.end<=motion.start
      ||motion.speedFactor!==undefined&&!finite(motion.speedFactor,.001,maximumSpeed)||motion.terrainDelay!==undefined&&!finite(motion.terrainDelay,0,50)
      ||!validSlowIntervals(motion.stagger,version,motion.start,tick,coreNow297)
      ||!validStunIntervals(motion.stuns,version,motion.start,tick,coreNow297)&&!validMechanoidEmpIntervals(motion.stuns,version,motion.start,tick,m.emp,coreNow297)
      ||Math.max(Math.abs(motion.from.x-motion.to.x),Math.abs(motion.from.z-motion.to.z))!==1
      ||motion.to.x!==m.x||motion.to.z!==m.z||Math.abs(motion.end-travelEnd(motion))>1e-7
      ||Math.abs(m.moveCooldown-Math.max(0,motion.end-physicalLocalNow297))>1e-7)return false;
  }else if(m.moveCooldown>0)return false;
  if(m.melee!==undefined){
    const melee=m.melee;
    if(!object(melee)||!keys(melee,['order','strike'])||melee.order===null&&melee.strike===null)return false;
    const o=melee.order,s=melee.strike;
    if(o!==null&&(!object(o)||!keys(o,['structure','targetId','startedDowned','jobUntilCore'])||!integer(o.targetId,1)||o.startedDowned!==false
      ||o.structure!==undefined&&o.structure!==true||(o.structure?o.jobUntilCore!==undefined:!integer(o.jobUntilCore,physicalCoreNow297+1,physicalCoreNow297+480))))return false;
    const pause=object(s)?s.empPause:undefined;
    const validPause=version>=208&&object(s)&&object(pause)&&keys(pause,['ticks','lastAtCore'])
      &&pause.lastAtCore===physicalCoreNow297&&integer(pause.lastAtCore,Number(s.atCore))&&integer(pause.ticks,0,pause.lastAtCore-Number(s.atCore));
    const pausedTicks=validPause&&object(pause)?Number(pause.ticks):0;
    if(s!==null&&(!object(s)||!keys(s,['structure','targetId','atCore','untilCore','tool','outcome',...(version>=208?['empPause']:[]),...(isSchema277OrLater(version)?['suspendedCore277']:[])])||!(integer(s.targetId,1)||version>=256&&s.targetId===null&&s.structure===undefined)
      ||Object.hasOwn(s,'suspendedCore277')&&(!isSchema277OrLater(version)||!integer(s.suspendedCore277,1,physicalCoreNow297-Number(s.atCore)))||Object.hasOwn(s,'empPause')&&!validPause||!integer(s.atCore,0,physicalCoreNow297)||!integer(s.untilCore,physicalCoreNow297+1)
      ||s.untilCore-s.atCore!==(m.mechKind==='pikeman'&&(s.tool==='barrel'||s.tool==='barrel-poke')?156:120)+pausedTicks+Number(s.suspendedCore277??0)||typeof s.tool!=='string'||!tools(m.mechKind).includes(s.tool)
      ||typeof s.outcome!=='string'||!['hit','miss','dodge'].includes(s.outcome)||s.structure!==undefined&&(!cell(s.structure)||s.outcome!=='hit')))return false;
  }
  return true;
}

/** Context after owner shapes and the prior global namespace have been read.
 * This adopts only mechanical identities into the supplied common set. */
export function validateMechanoids(w:World,version:number=w.schemaVersion,ids:NumericMembershipSink=new Set<number>()):string[] {
  const errors:string[]=[];
  if(w.mechanoids===undefined)return errors;
  if(version<194||!Array.isArray(w.mechanoids)){errors.push('Invalid mechanoid population.');return errors;}
  errors.push(...validateTempleMechGroups256(w));
  errors.push(...validateSiteMechGroups263(w));
  const inBounds=(c:{x:number;z:number})=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;
  for(const m of w.mechanoids){
    if(!validMechanoidShape(m,version,w.tick,undefined,isCorePhysicalSchema297(version)?effectiveCore297(w):undefined)){errors.push('Invalid mechanoid shape.');continue;}
    if(!validMechanicalWorldFaction259(m,version,w.worldFactions))errors.push('Invalid actual mechanical faction foreign key.');
    if(m.id>=w.nextId||ids.has(m.id))errors.push('Invalid mechanoid identity.');ids.add(m.id);
    if(m.meleeThreat&&(m.meleeThreat.attackerId>=w.nextId||m.meleeThreat.attackerId===m.id))errors.push('Invalid mechanical melee threat identity.');
    errors.push(...validateMechanoidRanged(w,m,version));
    if(!inBounds(m)||m.path.length>w.width*w.height||m.path.some(c=>!inBounds(c))||m.motion&&(!inBounds(m.motion.from)||!inBounds(m.motion.to))||mechanicalOrder256(m)?.goal&&!inBounds(mechanicalOrder256(m)!.goal!))errors.push('Mechanoid position is outside the map.');
    let previous={x:m.x,z:m.z};for(const c of m.path){if(Math.max(Math.abs(c.x-previous.x),Math.abs(c.z-previous.z))!==1)errors.push('Disconnected mechanoid route.');previous=c;}
    const status=m.health?medicalStatus(m.health):'mobile',stopped=status!=='mobile';
    if(stopped?m.state!==status:m.state==='dead'||m.state==='downed')errors.push('Inconsistent mechanoid medical state.');
    if(stopped&&(m.path.length||m.melee?.order||mechanicalOrder256(m)?.goal||m.stun))errors.push('Incapacitated mechanoid retains an intention.');
    if(m.motion&&m.motion.end>effectiveLocal297(w)&&!['moving','downed','dead'].includes(m.state))errors.push('Mechanoid edge has no movement owner.');
    const group=mechRaidGroup261(w,m.raid?.group);
    if(m.raid&&(stopped?m.raid.group>(w.raids?.serial??0):!group||group.id!==m.raid.group||!group.members.includes(m.id)))errors.push('Mechanoid raid has no owner.');
    const o=m.melee?.order,s=m.melee?.strike;
    if(o){
      if(o.targetId>=w.nextId||o.targetId===m.id)errors.push('Invalid mechanoid melee target.');
      if(o.structure){
        if(mechanicalDuty256(w,m)?.phase!=='assault'||!w.structures.some(t=>t.id===o.targetId&&isBarrier(t)))errors.push('Invalid mechanoid barrier order.');
      }else if(!w.pawns.some(t=>t.id===o.targetId)&&!w.wildlife?.animals.some(t=>t.id===o.targetId))errors.push('Mechanoid living target is missing.');
    }
    if(s){
      if(s.targetId!==null&&s.targetId>=w.nextId||s.targetId===m.id||m.path.length||(m.motion?.end??0)>effectiveLocal297(w))errors.push('Invalid mechanoid recovery.');
      if(s.structure){
        const structure=w.structures.find(t=>t.id===s.targetId);
        if(!inBounds(s.structure)||structure&&(!isBarrier(structure)||!footprintCells(structure).some(c=>c.x===s.structure!.x&&c.z===s.structure!.z))
          ||!structure&&[w.pawns,w.mechanoids??[],w.piles,w.jobs,w.resources,w.wildlife?.animals??[]].some(owners=>owners.some(t=>t.id===s.targetId))
          ||w.packed.some(p=>p.building.id===s.targetId))errors.push('Invalid mechanoid barrier recovery.');
      }else if(!(version>=256&&s.targetId===null)&&!w.pawns.some(t=>t.id===s.targetId)&&!w.wildlife?.animals.some(t=>t.id===s.targetId)
        &&!findShipCasketActor277(w,{kind:'human',id:s.targetId!})&&!findShipCasketActor277(w,{kind:'animal',id:s.targetId!})&&!w.piles.some(p=>p.id===s.targetId&&(!!p.corpse||!!p.humanCorpse||!!p.mechCorpse))&&!w.raids?.departed.some(t=>t.pawnId===s.targetId))errors.push('Mechanoid recovery has no historical target.');
    }
  }
  return errors;
}
