import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validationCore297} from './core-phase-297.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import type { World } from './types.ts';
import { isColonist } from './affiliation.ts';
import { MENTAL_CRISIS_CATALOG } from './mental-catalog.ts';
import { isAggressiveMentalCrisis } from './mental-state.ts';
import { isMoodPool350,isMoodPoolCrisis350 } from './mood-pool-memories-350.ts';
import { structureMaxHp } from './thing-damage-rules.ts';
import { isTraitLinks362 } from './trait-links-362.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,lo:number,hi=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=lo&&Number(v)<=hi;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
export function validMentalShape(value:unknown,version:number,tick:number,width:number,height:number):boolean {
  if(value===undefined)return true;
  if(version<65||!object(value)||!keys(value,['below','cooldown','catharsis','crisis',...(version>=256?['wander']:[])])||!Array.isArray(value.below)||value.below.length!==3||!value.below.every(n=>integer(n,0,2100)&&n%150===0)||Number(value.below[0])<Number(value.below[1])||Number(value.below[1])<Number(value.below[2])||!integer(value.cooldown,0,1500)||!Array.isArray(value.catharsis)||value.catharsis.length>5||!value.catharsis.every((n,i,a)=>integer(n,tick+1,tick+18000)&&(i===0||n>Number(a[i-1]))))return false;
  if(Object.hasOwn(value,'wander')){const d=Object.getOwnPropertyDescriptor(value,'wander');if(version<256||!d||!('value'in d)||!d.enumerable||!object(d.value)||Reflect.ownKeys(d.value).length!==2||!Reflect.ownKeys(d.value).every(k=>{const p=Object.getOwnPropertyDescriptor(d.value,k)!;return typeof k==='string'&&['revision','nextMoveOrderIsWait'].includes(k)&&'value'in p&&p.enumerable;})||d.value.revision!==1||typeof d.value.nextMoveOrderIsWait!=='boolean')return false;}else if('wander'in value)return false;
  const c=value.crisis;if(c===undefined)return true;
  if(!object(c)||typeof c.kind!=='string'||!Object.hasOwn(MENTAL_CRISIS_CATALOG,c.kind)||c.kind==='food-binge'&&version<150||!['sad-wander','food-binge'].includes(c.kind)&&version<192)return false;
  if(c.kind==='confused-wander'&&(version<256||!Object.hasOwn(value,'wander')))return false;
  if(c.kind==='drug-binge'&&!isSchema265OrLater(version))return false;
  if(isMoodPoolCrisis350(c.kind)&&!isMoodPool350(version))return false;
  const rules=MENTAL_CRISIS_CATALOG[c.kind as keyof typeof MENTAL_CRISIS_CATALOG];
  if(!integer(c.age,0,rules.maxCore+(c.kind==='murderous-rage'?19:-1))||c.age%30!==0||typeof c.waitUntil!=='number'||!Number.isFinite(c.waitUntil)||c.waitUntil<0||c.waitUntil>tick+(c.kind==='wander-own-room'?60:20.1)||!(c.target===null||object(c.target)&&keys(c.target,['x','z'])&&integer(c.target.x,0,width-1)&&integer(c.target.z,0,height-1)))return false;
  // Schema 362: a crisis not caused by mood carries `notMood362: true`.
  if(Object.hasOwn(c,'notMood362')&&(!isTraitLinks362(version)||c.notMood362!==true||c.kind==='confused-wander'))return false;
  const base=['kind','age','target','waitUntil',...isTraitLinks362(version)?['notMood362']:[]];
  if(c.kind==='tantrum')return keys(c,[...base,'targetId','targetSinceCore','attempted','nextTargetCore'])&&(c.targetId===null||integer(c.targetId,1))&&integer(c.targetSinceCore,0,tick*10)&&typeof c.attempted==='boolean'&&integer(c.nextTargetCore,0,tick*10+500);
  if(c.kind==='berserk')return keys(c,[...base,'targetId','jobUntilCore'])&&(c.targetId===null||integer(c.targetId,1))&&(c.jobUntilCore===null||integer(c.jobUntilCore,0,tick*10+900))&&(c.targetId===null)===(c.jobUntilCore===null);
  if(c.kind==='murderous-rage')return keys(c,[...base,'targetId','nextCheckCore'])&&integer(c.targetId,1)&&integer(c.nextCheckCore,0,tick*10+120);
  // Schema 350: the own room's bed cell; a spree's target and its two Core clocks.
  if(c.kind==='wander-own-room')return keys(c,[...base,'root'])&&object(c.root)&&keys(c.root,['x','z'])&&integer(c.root.x,0,width-1)&&integer(c.root.z,0,height-1);
  const core=(v:unknown)=>v===null||integer(v,0,tick*10);
  if(c.kind==='insulting-spree')return keys(c,[...base,'insultTargetId','insulted','lastInsultCore','foundCore'])&&(c.insultTargetId===null||integer(c.insultTargetId,1))&&typeof c.insulted==='boolean'&&core(c.lastInsultCore)&&core(c.foundCore)
    &&(c.insultTargetId!==null||c.insulted===false&&c.foundCore===null);
  if(c.kind==='targeted-insulting-spree')return keys(c,[...base,'insultTargetId','insulted','lastInsultCore'])&&integer(c.insultTargetId,1)&&typeof c.insulted==='boolean'&&core(c.lastInsultCore);
  return keys(c,base);
}
export function validMeleeThreatShape(value:unknown,version:number,tick:number,coreNow297?:number):boolean {
  const core=isCorePhysicalSchema297(version)?validationCore297(version,tick,coreNow297):tick*10;
  if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(core))return false;
  return value===undefined||version>=192&&object(value)&&keys(value,['attackerId','atCore'])&&integer(value.attackerId,1)&&integer(value.atCore,0,core);
}
export function validateMental(world:World,version:number):string[] {
  const errors:string[]=[];
  for(const p of world.pawns) {
    if(p.meleeThreat&&(p.meleeThreat.attackerId===p.id||p.meleeThreat.attackerId>=world.nextId||[world.structures,world.resources,world.jobs].some(items=>items.some(item=>item.id===p.meleeThreat!.attackerId))||world.piles.some(item=>item.id===p.meleeThreat!.attackerId&&item.corpse?.animalId!==item.id&&!(version>=194&&item.mechCorpse))||world.packed.some(item=>item.building.id===p.meleeThreat!.attackerId)))errors.push('Invalid melee threat identity.');
    const m=p.mental;if(m===undefined)continue;
    if(!isColonist(p)&&!(version>=256&&m.wander&&(!m.crisis||m.crisis.kind==='confused-wander'))||!validMentalShape(m,version,world.tick,world.width,world.height)){errors.push('Invalid mental state.');continue;}
    const c=m.crisis;if(!c)continue;
    const aggressive=isAggressiveMentalCrisis(c);
    // Schema 350: the own room and the sprees are colonists' breaks; a spree's target is a person.
    if((c.kind==='wander-own-room'||c.kind==='insulting-spree'||c.kind==='targeted-insulting-spree')&&(p.prisoner&&!isColonist(p)||p.visitor||p.podRescue||p.raid))errors.push('Invalid mood break owner.');
    if((c.kind==='insulting-spree'||c.kind==='targeted-insulting-spree')&&c.insultTargetId!==null&&(c.insultTargetId===p.id||!world.pawns.some(t=>t.id===c.insultTargetId)))errors.push('Invalid insult target.');
    if(c.kind==='drug-binge'&&(p.prisoner||p.visitor||p.podRescue||p.raid))errors.push('Invalid alcohol binge owner.');
    if(aggressive&&(p.prisoner||p.visitor||p.podRescue||p.raid))errors.push('Invalid aggressive crisis owner.');
    if('targetId' in c&&c.targetId!==null) {
      if(c.targetId>=world.nextId||c.targetId===p.id)errors.push('Invalid mental target identity.');
      const structure=world.structures.find(s=>s.id===c.targetId),human=world.pawns.find(t=>t.id===c.targetId);
      const other=world.piles.some(t=>t.id===c.targetId&&!(c.kind==='berserk'&&(t.corpse?.animalId===t.id||version>=194&&t.mechCorpse)))||world.resources.some(t=>t.id===c.targetId)||world.jobs.some(t=>t.id===c.targetId)||world.packed.some(t=>t.building.id===c.targetId);
      if(c.kind==='tantrum'&&(human||other||world.wildlife?.animals.some(t=>t.id===c.targetId)||world.mechanoids?.some(t=>t.id===c.targetId)||structure&&structureMaxHp(structure)<=0))errors.push('Invalid destruction crisis target.');
      if(c.kind!=='tantrum'&&(structure||other))errors.push('Invalid violent crisis target.');
      if(c.kind==='murderous-rage'&&(world.wildlife?.animals.some(t=>t.id===c.targetId)||world.mechanoids?.some(t=>t.id===c.targetId)))errors.push('Murderous rage requires a human victim.');
    }
    if(!(version>=87&&p.burning)&&!p.need&&p.path.length&&!(aggressive&&p.melee?.order?.auto==='mental')) {
      const end=p.path.at(-1)!,target=version>=193&&p.bombRefuge?p.bombRefuge.target:c.target;
      if(!target||end.x!==target.x||end.z!==target.z)errors.push('Mental route has no matching destination.');
    }
    const meleeAllowed=version>=192&&p.melee&&(!p.melee.order||aggressive&&p.melee.order.auto==='mental');
    const shootingAllowed=version>=192&&p.shooting&&!p.shooting.order&&p.shooting.stance?.phase==='cooldown';
    if(p.state==='dead'||p.state==='downed'||p.draft||p.shooting&&!shootingAllowed||p.melee&&!meleeAllowed||p.flee||p.tactics||p.jobId!==null||p.haul||p.cooking||p.research||p.hunting||p.surgery||p.equipmentTask||p.ward||p.feed||p.tend||p.rescue||p.recreation.task||p.orders.active!==null||p.orders.queue.length||p.priorityWork)errors.push('Conflicting mental task.');
    if(!p.need&&!['idle','moving','hungry',...(version>=87&&p.burning?['working']:[])].includes(p.state))errors.push('Invalid mental posture.');
    if(aggressive&&p.need)errors.push('Aggressive crisis has an ordinary need job.');
  }
  return errors;
}
