import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isSpearToolId272,spearTool272,type SpearToolId272} from './spear-combat-272.ts';
import {isLongswordToolId270,longswordTool270,type LongswordToolId270} from './longsword-combat-270.ts';
import { HUMAN_BODY,type BodyGroup,type BodyPartId } from './body-definition.ts';
import { bodyEfficiencies } from './body-capacities.ts';
import { medicalModel } from './body-model.ts';
import { HP_UNIT } from './injury-rules.ts';
import { equippedWeapon,isWeaponItem,weaponMeleeQualityFactor } from './equipment-rules.ts';
import { pawnBody } from './health-rules.ts';
import { partMissing } from './injury-state.ts';
import {isMaceItem269} from './mace-content-269.ts';
import {isMaceToolId269,maceTool269,type MaceToolId269} from './mace-combat-269.ts';
import type { Pawn,World } from './types.ts';

export type MeleeDamage='toxic-bite'|'blunt'|'poke'|'bite'|'scratch'|'cut'|'stab';
export type MeleeToolId=SpearToolId272|LongswordToolId270|MaceToolId269|`animal256-tool-${number}-${number}`|'left-fist'|'right-fist'|'left-claw'|'right-claw'|'head'|'teeth'|'grip'|'barrel'|'barrel-poke'|'knife-handle'|'knife-blade'|'knife-point'|'left-blade-cut'|'left-blade-stab'|'right-blade-cut'|'right-blade-stab';
export interface MeleeTool { id:MeleeToolId; damage:number; penetration:number; kind:MeleeDamage; cooldownCore:number; weight:number }
export const meleeRecoveryCore=(id:MeleeToolId):number=>isSpearToolId272(id)?spearTool272(id).cooldownCore:isLongswordToolId270(id)?longswordTool270(id).cooldownCore:isMaceToolId269(id)?maceTool269(id).cooldownCore:id==='knife-blade'?72:id==='knife-point'||id==='knife-handle'?96:120;
export function curve(x:number,points:readonly (readonly [number,number])[]):number {
  if(x<=points[0]![0])return points[0]![1];
  for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!;if(x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
  return points.at(-1)![1];
}
export function meleeHitChance(level:number,sight=1,manipulation=1):number {
  return curve(level+12*(Math.min(sight,1.5)-1)+12*(Math.min(manipulation,1.5)-1),[[-20,.05],[-10,.1],[0,.5],[10,.8],[20,.9],[40,.96],[60,.98]]);
}
export function meleeDodgeChance(level:number,moving=1,sight=1):number {
  return curve(level+18*(moving-1)+8*(Math.min(sight,1.4)-1),[[5,0],[20,.3],[60,.5]]);
}
/** Skillless Core mechanical baseline .62; capacities shift the stat itself. */
export const mechaMeleeHitChance=(sight=1,manipulation=1):number=>curve(12*(Math.min(sight,1.5)-1)+12*(Math.min(manipulation,1.5)-1),[[-24,.05],[-14,.1],[-4,.5],[6,.8],[16,.9],[36,.96],[56,.98]]);
/** Natural adult and the delivered held weapons. Qualities affect melee damage;
 * capacities affect hit/dodge, not a fictitious fist damage multiplier. */
export function meleeTools(world:World,pawn:Pawn,body=()=>pawnBody(pawn)):MeleeTool[] {
  const tools:MeleeTool[]=[];
  const add=(id:MeleeToolId,damage:number,kind:MeleeDamage,factor=1,penetration=damage*.015)=>{const cooldownCore=meleeRecoveryCore(id);tools.push({id,damage,kind,penetration,cooldownCore,weight:damage*(1+penetration)/(cooldownCore/60)*factor});};
  const exists=(id:typeof HUMAN_BODY[number]['id'])=>!pawn.health||!partMissing(pawn.health,id);
  const efficiency=bodyToolEfficiency324(world,pawn);
  // LeftHand/RightHand groups are the fingers; missing every finger removes the tool.
  for(const side of ['left','right'] as const){
    if(isSchema273OrLater(world.schemaVersion)&&pawn.health?.artificialParts?.some(p=>p.kind==='prosthetic-arm'&&p.part===`${side}-shoulder`)){add(`${side}-fist`,8.2,'blunt');continue;}
    if(!HUMAN_BODY.some(p=>p.groups.includes(`${side}-hand`)&&exists(p.id)))continue;
    const factor=efficiency?efficiency.group(`${side}-hand`):1;if(factor>0)add(`${side}-fist`,8.2*factor,'blunt');
  }
  if(exists('jaw')){const factor=efficiency?efficiency.part('jaw'):1;if(factor>0)add('teeth',8.2*factor,'bite',.07);}
  if(exists('head'))add('head',5*(efficiency?Math.max(.4,efficiency.part('head')):1),'blunt',.2);
  const weapon=equippedWeapon(world,pawn);
  if(weapon?.weapon&&isWeaponItem(weapon.item)&&!pawn.equipmentDropPending&&body().capacities.manipulation>0) {
    const factor=weaponMeleeQualityFactor(weapon.weapon.quality);
    if(weapon.item==='plasteel-knife'){
      add('knife-handle',9*.9*factor,'blunt');add('knife-blade',12*1.1*factor,'cut');add('knife-point',13*1.1*factor,'stab');
    } else if(isSpearItem272(weapon.item)){
      if(world.schemaVersion>=272)for(const part of ['shaft-blunt','shaft-poke','point'] as const){const t=spearTool272(`${weapon.item}-${part}`);add(t.id,t.damage*factor,t.kind,1,t.penetration*factor);}
    } else if(isLongswordItem270(weapon.item)){
      if(world.schemaVersion>=270)for(const part of ['handle','tip','edge'] as const){const tool=longswordTool270(`${weapon.item}-${part}`);add(tool.id,tool.damage*factor,tool.kind);}
    } else if(isMaceItem269(weapon.item)){
      if(world.schemaVersion>=269)for(const part of ['handle','head'] as const){const tool=maceTool269(`${weapon.item}-${part}`);add(tool.id,tool.damage*factor,tool.kind);}
    } else if(weapon.item==='short-bow'||weapon.item==='recurve-bow'||weapon.item==='greatbow'){
      // Core Bow_Short, Bow_Recurve and Bow_Great: one limb tool, Blunt and
      // Poke, power 9, cooldown 2 s:
      // the two existing gun verbs without the grip.
      const damage=9*factor;add('barrel',damage,'blunt');add('barrel-poke',damage,'poke');
    } else {const damage=9*factor;add('grip',damage,'blunt');add('barrel',damage,'blunt');add('barrel-poke',damage,'poke');}
  }
  return rankMeleeTools(tools);
}
/** Core VerbProperties.GetDamageFactorFor (schema 324): a body tool hits as
 * hard as the average efficiency of the natural parts of its linked group
 * (the fingers of a fist, the jaw for the teeth); the head butt keeps at
 * least 0.4. Undefined for a healthy body or an older schema. */
export function bodyToolEfficiency324(world:{schemaVersion:number},pawn:Pick<Pawn,'health'>):{group:(group:BodyGroup)=>number;part:(id:BodyPartId)=>number}|undefined {
  const record=pawn.health;
  if(world.schemaVersion<324||!record||!record.injuries.length&&!record.missing.length)return undefined;
  const model=medicalModel(record),efficiency=bodyEfficiencies({damage:record.injuries.map(i=>({part:i.part,loss:i.severity/HP_UNIT})),missing:record.missing.map(m=>m.part),pain:0},model);
  const part=(id:BodyPartId)=>partMissing(record,id)?0:efficiency[model.index[id]]!;
  return {part,group:group=>{let sum=0,count=0;for(const p of model.parts)if(p.groups.includes(group)&&!partMissing(record,p.id)){sum+=efficiency[model.index[p.id]]!;count++;}return count?sum/count:0;}};
}
export function rankMeleeTools(tools:readonly MeleeTool[]):MeleeTool[] {
  const highest=Math.max(...tools.map(t=>t.weight));
  const category=(t:MeleeTool)=>t.weight>=highest*.95?'best':t.weight<highest*.25?'worst':'mid';
  const counts={best:0,mid:0,worst:0};for(const t of tools)counts[category(t)]++;
  return tools.map(t=>({...t,weight:category(t)==='worst'?0:(category(t)==='best'?.75:.25)/counts[category(t)]}));
}
export function chooseMeleeTool(tools:readonly MeleeTool[],random:()=>number):MeleeTool|null {
  const total=tools.reduce((n,t)=>n+t.weight,0);if(!total)return null;
  let roll=random()*total;for(const t of tools){roll-=t.weight;if(roll<0)return t;}
  return tools.filter(t=>t.weight>0).at(-1)!;
}
