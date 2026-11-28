import {isBurialContainer256} from './ancient-monument-runtime-256.ts';
import { isColonist } from './affiliation.ts';
import { BURIAL_TICKS,graveAccepts } from './burial.ts';
import { validCorpseRot } from './corpse-save.ts';
import {validConsumedParts382} from './corpse-anatomy.ts';
import type {MedicalRecord} from './injury-types.ts';
import {effectiveCore297} from './core-phase-297.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import type { World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
export function validHumanBodyShape(v:unknown,version:number,tick:number,medical?:unknown,coreLimit=Number.MAX_SAFE_INTEGER):boolean {
  if(v===undefined)return true;
  if(object(v)&&Object.hasOwn(v,'damage')){const d=Object.getOwnPropertyDescriptor(v,'damage');if(version<256||!d||!Object.hasOwn(d,'value')||!int(d.value,1,99)||v.pileId!==undefined||v.lostAt!==undefined)return false;}
  if(object(v)&&'consumedParts382' in v){
    const d=Object.getOwnPropertyDescriptor(v,'consumedParts382');
    if(version<382||!d?.enumerable||!Object.hasOwn(d,'value')||d.value===undefined||!object(medical)||!object(medical.death)||medical.body!==undefined||!Array.isArray(medical.missing))return false;
    try{if(!validConsumedParts382(medical as unknown as MedicalRecord,d.value,tick,version,coreLimit))return false;}catch{return false;}
  }
  return version>=89&&object(v)&&keys(v,['observedAt','pileId','lostAt','rot',...(version>=256?['damage']:[]),...(version>=382?['consumedParts382']:[])])&&int(v.observedAt,0,tick)
    &&(v.pileId===undefined? v.lostAt===undefined?validCorpseRot(v.rot,tick,Number(v.observedAt),version,medical):version>=256&&int(v.lostAt,Number(v.observedAt),tick)&&v.rot===undefined
      :int(v.pileId,1)&&v.rot===undefined&&(v.lostAt===undefined||int(v.lostAt,Number(v.observedAt),tick)));
}
export function validHumanCorpseShape(v:unknown,version:number,tick:number):boolean {
  return version>=89&&object(v)&&keys(v,['pawnId','nextBileTick'])&&int(v.pawnId,1)
    &&(v.nextBileTick===undefined||int(v.nextBileTick,0,Math.min(Number.MAX_SAFE_INTEGER,tick+6000)));
}
export function validGraveShape(v:unknown,version:number):boolean {
  return version>=89&&object(v)&&keys(v,['corpseId','assignedPawnId','colonists','strangers'])
    &&typeof v.colonists==='boolean'&&typeof v.strangers==='boolean'
    &&(v.corpseId===undefined||int(v.corpseId,1))&&(v.assignedPawnId===undefined||int(v.assignedPawnId,1));
}
export function validBurialTaskShape(v:unknown,version:number):boolean {
  if(v===undefined)return true;
  return version>=89&&object(v)&&keys(v,['bodyPawnId','graveId','corpseId','phase','progress'])&&int(v.bodyPawnId,1)&&int(v.graveId,1)
    &&(v.corpseId===undefined||int(v.corpseId,1))&&['pickup','carry','bury'].includes(String(v.phase))&&int(v.progress,0,BURIAL_TICKS-1)
    &&(v.phase==='pickup'?v.progress===0:v.corpseId!==undefined)&&(v.phase!=='carry'||v.progress===0);
}
/** Base collection/identity/medical shapes precede these cross references.
 * Lost body IDs remain reserved, like exported historical identities. */
export function validateBurials(w:World,version:number,ids?:Set<number>):string[] {
  const errors:string[]=[],people=new Map(w.pawns.map(p=>[p.id,p])),piles=new Map(w.piles.map(p=>[p.id,p]));
  const bodies=new Set<number>(),graveBodies=new Set<number>(),assigned=new Set<number>(),bodyClaims=new Set<number>(),graveClaims=new Set<number>();
  for(const p of w.pawns){
    if(!validHumanBodyShape(p.body,version,w.tick,p.health,p.body?.consumedParts382?effectiveCore297(w):undefined)){errors.push('Invalid human body state.');continue;}
    const b=p.body;if(!b)continue;
    if(p.state!=='dead'||!p.health?.death||b.observedAt<p.health.death.tick)errors.push('Living or retroactive human body.');
    if(version>=256&&b.lostAt!==undefined&&(w.packed.some(i=>(i.owner.type==='inventory'||i.owner.type==='pawn')&&i.owner.pawnId===p.id)||w.piles.some(i=>['pawn','inventory','equipment','apparel'].includes(i.owner.type)&&'pawnId' in i.owner&&i.owner.pawnId===p.id)))errors.push('Destroyed body still owns possessions.');
    if(b.pileId!==undefined){
      if(b.pileId>=w.nextId||bodies.has(b.pileId))errors.push('Duplicate human corpse identity.');bodies.add(b.pileId);
      const pile=piles.get(b.pileId);
      if(b.lostAt!==undefined){
        if(pile||ids?.has(b.pileId)||w.pawns.some(a=>a.id===b.pileId))errors.push('Lost body identity was reused.');
        else ids?.add(b.pileId);
        if(w.piles.some(i=>['inventory','equipment','apparel'].includes(i.owner.type)&&'pawnId' in i.owner&&i.owner.pawnId===p.id))errors.push('Destroyed body still owns possessions.');
      } else if(!pile?.humanCorpse||pile.humanCorpse.pawnId!==p.id)errors.push('Human body has no matching corpse.');
    }
  }
  for(const pile of w.piles){
    if(pile.item!=='human-corpse'){
      if(pile.humanCorpse!==undefined||pile.owner.type==='grave')errors.push('Unexpected human corpse ownership.');continue;
    }
    if(!validHumanCorpseShape(pile.humanCorpse,version,w.tick)||pile.kind!=='corpse'||pile.quantity!==1||pile.corpse!==undefined||!['ground','pawn','grave'].includes(pile.owner.type)){
      errors.push('Invalid human corpse shape.');continue;
    }
    const p=people.get(pile.humanCorpse!.pawnId);
    if(!p?.body||p.body.pileId!==pile.id||p.body.lostAt!==undefined||!validCorpseRot(pile.rot,w.tick,p.body.observedAt,version,p.health))errors.push('Invalid human corpse provenance or age.');
    if(pile.owner.type==='grave'){
      const graveId=pile.owner.graveId,grave=w.structures.find(s=>s.id===graveId);
      if(!isBurialContainer256(grave?.kind,version)||grave?.grave?.corpseId!==pile.id||pile.rot?.rate!==0)errors.push('Invalid buried corpse ownership or suspended age.');
    }
  }
  for(const s of w.structures){
    if(!isBurialContainer256(s.kind,version)){if(s.grave!==undefined)errors.push('Unexpected grave state.');continue;}
    if(!validGraveShape(s.grave,version)){errors.push('Invalid grave state.');continue;}
    const g=s.grave!;
    if(g.assignedPawnId!==undefined){
      const p=people.get(g.assignedPawnId);if(!p||!isColonist(p)||p.body?.lostAt!==undefined||assigned.has(p.id))errors.push('Invalid or repeated grave assignment.');else assigned.add(p.id);
    }
    if(g.corpseId!==undefined){
      const pile=piles.get(g.corpseId);
      if(!pile?.humanCorpse||pile.owner.type!=='grave'||pile.owner.graveId!==s.id||graveBodies.has(g.corpseId)
        ||g.assignedPawnId!==undefined&&g.assignedPawnId!==pile.humanCorpse.pawnId)errors.push('Invalid or repeated grave content.');graveBodies.add(g.corpseId);
    }
  }
  for(const actor of w.pawns){
    if(!validBurialTaskShape(actor.burial,version)){errors.push('Invalid burial task.');continue;}
    const t=actor.burial;if(!t){if(actor.orders?.active==='bury')errors.push('Burial order without task.');continue;}
    const body=people.get(t.bodyPawnId),grave=w.structures.find(s=>s.id===t.graveId),pile=t.corpseId===undefined?undefined:piles.get(t.corpseId);
    if(!body||body.state!=='dead'||body.body?.lostAt!==undefined||!grave||!graveAccepts(w,grave,body,actor.id)||bodyClaims.has(t.bodyPawnId)||graveClaims.has(t.graveId)
      ||!isColonist(actor)||actor.prisoner||actor.visitor||medicalWorkRefusal(actor)||actor.mental?.crisis||actor.burning||actor.draft
      ||actor.jobId!==null||actor.haul||actor.need||actor.cooking||actor.rescue||actor.feed||actor.tend||actor.ward||actor.hunting||actor.research||actor.trade||actor.firefighting||actor.equipmentTask||actor.recreation.task||actor.interruptedCargo
      ||actor.orders.active!==null&&actor.orders.active!=='bury'||actor.orders.queue.length
      ||t.corpseId!==undefined&&(!pile?.humanCorpse||pile.humanCorpse.pawnId!==t.bodyPawnId||body?.body?.pileId!==t.corpseId)
      ||t.phase==='pickup'&&pile?.owner.type!=='ground'&&pile!==undefined
      ||t.phase!=='pickup'&&(pile?.owner.type!=='pawn'||pile.owner.pawnId!==actor.id))errors.push('Inconsistent burial reservation or physical cargo.');
    bodyClaims.add(t.bodyPawnId);graveClaims.add(t.graveId);
  }
  return errors;
}
