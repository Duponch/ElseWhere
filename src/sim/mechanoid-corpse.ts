import {appendPileEntries} from './pile-identity-directory.ts';
import {mechRaidGroup261} from './mechanical-raid-groups-261.ts';
import {retainedCorpseDamage256,type RetainedCorpseDamage256} from './retained-corpse-damage-256.ts';
import {neutralLossPlan} from './destruction-losses.ts';
import type {Mechanoid} from './mechanoid-state.ts';
import { groundCapacity } from './ground-placement.ts';
import { mechaMass } from './mechanoid-health.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { cancelMechanoidRanged } from './mechanoid-ranged-state.ts';
import type { MechanoidKind } from './mechanoid-definition.ts';
import type { MechCorpseItem } from './items.ts';
import type { MedicalRecord } from './injury-types.ts';
import type { MaterialPile,World } from './types.ts';

/** The entire dead mechanical owner, never food or an ordinary generic stack. */
export interface MechanoidCorpseState {
  mechKind:MechanoidKind;health:MedicalRecord;heading?:number;
}
export const mechCorpseItem=(kind:MechanoidKind):MechCorpseItem=>`${kind}-corpse`;
export const mechCorpseMass=(p:MaterialPile):number=>p.mechCorpse?mechaMass(p.mechCorpse):0;

function releaseTargets(w:World,id:number):void {
  for(const p of w.pawns){
    if(p.melee?.order?.targetId===id){cancelMelee(p);p.path=[];}
    if(p.shooting?.order?.targetId===id){cancelShooting(p);p.path=[];}
    if(p.tactics?.targetId===id){p.tactics.targetId=null;p.tactics.post=null;p.tactics.reviewAtCore=0;}
  }
  for(const a of w.wildlife?.animals??[]){
    if(a.threat?.targetId===id)delete a.threat;
    if(a.retaliation?.targetId===id)delete a.retaliation;
  }
  for(const m of w.mechanoids??[])if(m.melee?.order?.targetId===id){cancelMelee(m);m.path=[];}
  for(const m of w.mechanoids??[])if(m.ranged?.order?.targetKey===`mech:${id}`){cancelMechanoidRanged(m);m.path=[];}
}

/** A crowded cell retains the dead actor until this same cell becomes usable. */
export function advanceMechanoidCorpses(w:World):void {
  if(w.schemaVersion<194||!w.mechanoids?.length)return;
  const removed=new Set<number>();
  for(const m of w.mechanoids){
    if(m.state!=='dead'||!m.health?.death||(m.motion?.end??0)>w.tick||m.moveCooldown>0
      ||(m.melee?.strike?.untilCore??0)>w.tick*10||m.ranged?.stance||w.piles.length>=32768
      ||groundCapacity(w,m,mechCorpseItem(m.mechKind))<1||w.piles.some(p=>p.id===m.id))continue;
    appendPileEntries(w.piles,{...retainedCorpseDamage256(m)?{damage:retainedCorpseDamage256(m)}:{},id:m.id,kind:'mech-corpse',item:mechCorpseItem(m.mechKind),quantity:1,
      owner:{type:'ground',x:m.x,z:m.z},mechCorpse:{mechKind:m.mechKind,health:m.health,heading:m.heading}});
    const group=mechRaidGroup261(w,m.raid?.group);
    if(group?.members.includes(m.id)&&!group.lost.includes(m.id)){group.lost.push(m.id);group.lost.sort((a,b)=>a-b);}
    removed.add(m.id);releaseTargets(w,m.id);
  }
  if(removed.size)w.mechanoids=w.mechanoids.filter(m=>!removed.has(m.id));
}

export function destroyRetainedMechanoidBody256(w:World,m:Mechanoid):boolean {
 if(w.schemaVersion<256||!w.mechanoids?.includes(m)||m.state!=='dead'||!m.health?.death)return false;
 const plan=neutralLossPlan(w,{items:{[mechCorpseItem(m.mechKind)]:1}});if(!plan)return false;
 const group=mechRaidGroup261(w,m.raid?.group);if(group?.members.includes(m.id)&&!group.lost.includes(m.id)){group.lost.push(m.id);group.lost.sort((a,b)=>a-b);}
 w.destroyed=plan;w.mechanoids.splice(w.mechanoids.indexOf(m),1);releaseTargets(w,m.id);return true;
}

export function damageRetainedMechanoidBody256(w:World,m:Mechanoid,amount:number):boolean {
 if(w.schemaVersion<256||!w.mechanoids?.includes(m)||m.state!=='dead'||!m.health?.death||!Number.isSafeInteger(amount)||amount<=0)return false;
 const damage=retainedCorpseDamage256(m)+amount;if(damage>=100)return destroyRetainedMechanoidBody256(w,m);(m as Mechanoid&RetainedCorpseDamage256).corpseDamage=damage;return true;
}
