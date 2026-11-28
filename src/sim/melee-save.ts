import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import {findShipCasketActor277} from './ship-casket-state-277.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isSchema272OrLater} from './schema-compatibility-257.ts';
import {isSpearToolId272} from './spear-combat-272.ts';
import {isLongswordToolId270} from './longsword-combat-270.ts';
import {isMaceToolId269} from './mace-combat-269.ts';
import { isBarrier } from './barriers.ts';
import { automaticOwnership,automaticPost } from './automatic-combat-save.ts';
import { hostileTo,isColonist } from './affiliation.ts';
import { meleeRecoveryCore,type MeleeToolId } from './melee-statistics.ts';
import { mentalMeleeOwnership } from './aggressive-crisis-order.ts';
import { prisonBreakMeleeOwned } from './prison-break-state.ts';
import { retaliationPermission } from './combat-target.ts';
import { footprintCells } from './definitions.ts';
import { structureMaxHp } from './thing-damage-rules.ts';
import type { World } from './types.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
export function validMeleeShape(value:unknown,version:number,tick:number,coreNow297?:number):boolean {
 const physicalCoreNow297=validationCore297(version,tick,coreNow297);if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(physicalCoreNow297))return false;
  if(value===undefined)return true;
  if(version<59||!object(value)||!keys(value,['order','strike'])||value.order===null&&value.strike===null)return false;
  const o=value.order,s=value.strike;
  if(o!==null&&(!object(o)||!keys(o,['targetId','startedDowned',...(version>=60?['auto']:[]),...(version>=67?['structure']:[]),...(version>=192?['untilCore']:[])])||!integer(o.targetId,1)||o.structure!==undefined&&(o.structure!==true||o.startedDowned||o.auto!==undefined&&!(version>=192&&o.auto==='mental'||version>=204&&o.auto==='prison-break'))||typeof o.startedDowned!=='boolean'||o.auto!==undefined&&(typeof o.auto!=='string'||!['draft','response',...(version>=125?['social']:[]),...(version>=192?['mental','retaliation']:[]),...(version>=204?['prison-break']:[])].includes(o.auto))||o.untilCore!==undefined&&(!['mental','retaliation'].includes(String(o.auto))||!integer(o.untilCore,1,physicalCoreNow297+(o.auto==='retaliation'?200:900)))||o.auto==='retaliation'&&o.untilCore===undefined))return false;
  if(s===null)return o!==null;
  return object(s)&&keys(s,['targetId','atCore','untilCore','tool','outcome',...(version>=67?['structure']:[]),...(isSchema277OrLater(version)?['suspendedCore277']:[])])&&(!Object.hasOwn(s,'suspendedCore277')||isSchema277OrLater(version)&&integer(s.suspendedCore277,1,physicalCoreNow297-Number(s.atCore)))&&(s.structure===undefined||object(s.structure)&&keys(s.structure,['x','z'])&&integer(s.structure.x,0)&&integer(s.structure.z,0)&&s.outcome==='hit')&&(integer(s.targetId,1)||version>=256&&s.targetId===null&&s.structure===undefined)&&integer(s.atCore,0,physicalCoreNow297)&&integer(s.untilCore,physicalCoreNow297+1)&&s.untilCore-s.atCore===meleeRecoveryCore(s.tool as MeleeToolId)+Number(s.suspendedCore277??0)&&(version>=382&&['thrumbo-point-scratch','thrumbo-point-stab','thrumbo-base'].includes(String(s.tool))||isSchema272OrLater(version)&&isSpearToolId272(s.tool)||version>=270&&isLongswordToolId270(s.tool)||version>=269&&isMaceToolId269(s.tool)||['left-fist','right-fist','head','teeth','grip','barrel','barrel-poke',...(version>=88?['knife-handle','knife-blade','knife-point']:[])].includes(String(s.tool)))&&['hit','miss','dodge'].includes(String(s.outcome));
}
export function validStunShape(value:unknown,version:number,tick:number,maxDuration=45,coreNow297?:number):boolean {
 const physicalCoreNow297=validationCore297(version,tick,coreNow297);if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(physicalCoreNow297))return false;
  if(value===undefined)return true;
  return version>=59&&object(value)&&keys(value,['sinceCore','untilCore'])&&integer(value.sinceCore,0,physicalCoreNow297)&&integer(value.untilCore,physicalCoreNow297+1,physicalCoreNow297+maxDuration)&&value.untilCore-value.sinceCore>=45;
}
export function validateMelee(world:World):string[] {
  const errors:string[]=[];
  for(const p of world.pawns) {
    if(p.stun&&p.state==='dead')errors.push('Dead actor cannot be stunned.');
    const m=p.melee;if(!m)continue;
    if(m.order?.auto&&m.order.startedDowned&&!(world.schemaVersion>=192&&m.order.auto==='mental'&&p.mental?.crisis?.kind==='murderous-rage'&&mentalMeleeOwnership(world,p,m.order)))errors.push('Automatic melee cannot start on a downed target.');
    if(['dead','downed','sleeping','eating','working','resting','recreating'].includes(p.state)||p.need||p.jobId!==null||p.haul||p.cooking||p.rescue||p.tend||p.ward||p.feed||p.equipmentTask||p.flee||p.recreation.task||p.orders.active!==null||p.orders.queue.length||p.priorityWork)errors.push('Melee conflicts with another activity.');
    if(m.order&&!m.order.structure){
      const order=m.order,target=world.pawns.find(t=>t.id===order.targetId);
      const social=order.auto==='social';
      const mental=world.schemaVersion>=192&&order.auto==='mental'&&mentalMeleeOwnership(world,p,order);
      const breakout=world.schemaVersion>=204&&order.auto==='prison-break'&&prisonBreakMeleeOwned(world,p,order)&&!!target&&!target.prisoner&&target.state!=='dead'&&target.state!=='downed'&&hostileTo(p,target);
      const retaliation=world.schemaVersion>=192&&order.auto==='retaliation'&&retaliationPermission(p)&&!p.draft&&p.meleeThreat?.attackerId===order.targetId;
      const owned=social?world.schemaVersion>=125&&isColonist(p)&&!p.prisoner&&!p.draft&&!!target&&isColonist(target)&&!target.prisoner
        &&p.social?.fight?.opponentId===target.id&&target.social?.fight?.opponentId===p.id
        :order.auto==='prison-break'?breakout:order.auto==='mental'?mental:order.auto==='retaliation'?retaliation:order.auto==='draft'||order.auto==='response'?automaticOwnership(world,p,order.targetId,order.auto):!isColonist(p)||!!p.draft;
      if((!target||target.id===p.id||!social&&!isColonist(p)&&!hostileTo(p,target))
        &&!(world.schemaVersion>=78&&isColonist(p)&&(!order.auto||mental||retaliation||world.schemaVersion>=183&&(order.auto==='draft'||order.auto==='response')&&automaticOwnership(world,p,order.targetId,order.auto))&&world.wildlife?.animals.some(a=>a.id===order.targetId))
        &&!(world.schemaVersion>=194&&world.mechanoids?.some(t=>t.id===order.targetId)&&(!isColonist(p)||!order.auto||mental||retaliation||automaticOwnership(world,p,order.targetId,order.auto as 'draft'|'response')))
        ||!owned||p.shooting?.order||(!order.auto&&p.draft?.target)||order.auto==='draft'&&!automaticPost(p)||p.draft?.queue.length)
        errors.push('Invalid melee order ownership.');
    }
    if(m.order?.structure){
      const mental=world.schemaVersion>=192&&m.order.auto==='mental'&&mentalMeleeOwnership(world,p,m.order);
      const breakout=world.schemaVersion>=204&&m.order.auto==='prison-break'&&prisonBreakMeleeOwned(world,p,m.order);
      if((!mental&&!breakout&&!(isColonist(p)?!!p.draft:!!p.raid))||m.order.auto!==undefined&&!mental&&!breakout||p.shooting?.order||p.draft?.target||p.draft?.queue.length||!world.structures.some(s=>s.id===m.order!.targetId&&s.kind!=='hidden-conduit'&&(mental?structureMaxHp(s)>0:isBarrier(s))))errors.push('Invalid barrier melee order.');
    }
    if(m.strike?.structure&&(m.strike.structure.x>=world.width||m.strike.structure.z>=world.height||(m.strike.targetId===null||m.strike.targetId>=world.nextId)))errors.push('Invalid barrier recovery position.');
    if(m.strike?.structure){
      const s=world.structures.find(s=>s.id===m.strike!.targetId),c=m.strike.structure;
      if(s&&(world.schemaVersion>=192?structureMaxHp(s)<=0||!footprintCells(s).some(cell=>cell.x===c.x&&cell.z===c.z):!isBarrier(s)||s.x!==c.x||s.z!==c.z)||[world.pawns,world.jobs,world.piles,world.resources,world.mechanoids??[]].some(items=>items.some(item=>item.id===m.strike!.targetId))||world.packed.some(p=>p.building.id===m.strike!.targetId))errors.push('Barrier recovery conflicts with a live entity.');
    }
    if(m.strike&&(!(world.schemaVersion>=256&&m.strike.targetId===null)&&!m.strike.structure&&!world.pawns.some(t=>t.id===m.strike!.targetId&&t.id!==p.id)&&!findShipCasketActor277(world,{kind:'human',id:m.strike!.targetId!})&&!findShipCasketActor277(world,{kind:'animal',id:m.strike!.targetId!})&&!findShipCasketActor277(world,{kind:'mechanical',id:m.strike!.targetId!})&&!world.raids?.departed.some(d=>d.pawnId===m.strike!.targetId)&&!(world.schemaVersion>=204&&world.prisonDepartures?.some(d=>d.pawnId===m.strike!.targetId))&&!(world.schemaVersion>=78&&world.wildlife?.animals.some(a=>a.id===m.strike!.targetId))&&!(world.schemaVersion>=79&&world.piles.some(p=>p.corpse?.animalId===m.strike!.targetId))&&!(world.schemaVersion>=194&&(world.mechanoids?.some(t=>t.id===m.strike!.targetId)||world.piles.some(p=>p.id===m.strike!.targetId&&p.mechCorpse)))||(p.motion?.end??0)>(isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick)||p.shooting?.stance?.phase==='aim'))errors.push('Invalid melee recovery.');
  }
  return errors;
}
