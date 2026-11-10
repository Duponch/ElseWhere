import type {NumericMembershipLookup} from './numeric-membership.ts';
import { BOMB_RADIUS } from './bomb-state.ts';
import {actualBombWick256,actualBombSourceRadius256} from './ancient-casket-explosive-state-256.ts';
import { canStandAt } from './furniture-travel.ts';
import { interruptWork,retryInterruptedCargo } from './interrupted-cargo.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { applyScoutCommand } from './caravan-loading.ts';
import { applyCommercialPreparation } from './commercial-loading.ts';
import { routeToCell } from './pathfinding.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { searchCandidates,type NavigationGrid,type SearchBudget } from './work-planner.ts';
import { moveToward,CIVIL_TRANSIT_BLOCKERS } from './travel.ts';
import type { LightReader } from './light-environment.ts';
import type { BombRefuge } from './mini-turret-state.ts';
import type { Cell,Pawn,Structure,World } from './types.ts';
import { miniTurretExplosive } from './bomb-eligibility.ts';
import { filteredStructures,structureById } from './structure-navigation.ts';

const distance=(a:Cell,b:Cell)=>(a.x-b.x)**2+(a.z-b.z)**2;
/** Capture once after combat, then borrow through the actor pass. */
// actualBombWick256 holds only for the three cryptosleep casket kinds.
export const captureBombDangerSources=(w:World):readonly Structure[]=>w.schemaVersion>=193?filteredStructures(w,'cryptosleep-casket-kinds',s=>s.kind==='ancient-cryptosleep-casket'||s.kind==='cryptosleep-casket'||s.kind==='ship-cryptosleep-casket').filter(s=>actualBombWick256(s)):[];
export function validBombRefugeShape(v:unknown,version=193):v is BombRefuge {
  if(version<193||!v||typeof v!=='object'||Array.isArray(v))return false;
  const r=v as Record<string,unknown>,t=r.target as Record<string,unknown>|undefined;
  return Object.keys(r).every(k=>['sourceId','target','endCore'].includes(k))&&Number.isSafeInteger(r.sourceId)&&Number(r.sourceId)>0
    &&Number.isSafeInteger(r.endCore)&&Number(r.endCore)>0&&!!t&&typeof t==='object'&&!Array.isArray(t)&&Object.keys(t).every(k=>k==='x'||k==='z')
    &&Number.isSafeInteger(t.x)&&Number(t.x)>=0&&Number.isSafeInteger(t.z)&&Number(t.z)>=0;
}
export function validateBombRefuges(w:World,errors:string[]=[],ids?:NumericMembershipLookup):string[] {
  for(const p of w.pawns)if(Object.hasOwn(p,'bombRefuge')){
    const r=p.bombRefuge;
    if(!validBombRefugeShape(r,w.schemaVersion)||r.sourceId>=w.nextId||r.target.x>=w.width||r.target.z>=w.height||p.state==='dead'||p.state==='downed'
      ||w.pawns.some(a=>a.rescue?.phase==='carry'&&a.rescue.patientId===p.id)){errors.push('Invalid bomb refuge owner/shape.');continue;}
    const end=p.path.at(-1);
    if(end&&(end.x!==r.target.x||end.z!==r.target.z))errors.push('Bomb refuge route misses its target.');
    const source=structureById(w,r.sourceId),wick=source?actualBombWick256(source):undefined;
    // A detonation may precede completion of this actor's captured edge. Such
    // historical refuge is removed at the next physical decision frontier.
    if(source&&(!['mini-turret','ancient-cryptosleep-casket'].includes(source.kind)||!wick)||wick&&(wick.endCore!==r.endCore||distance(source!,r.target)<=actualBombSourceRadius256(source!)**2))errors.push('Invalid bomb refuge source/target.');
    if(!source){const wave=w.bombWaves?.some(wave=>wave.sourceId===r.sourceId),recovery=p.moveCooldown>0||p.motion&&p.motion.end>w.tick||p.melee?.strike||p.shooting?.stance?.phase==='cooldown'||p.stun;
      const active=ids?.has(r.sourceId)??[...w.pawns,...w.jobs,...w.resources,...w.piles,...w.structures,...w.packed.map(p=>p.building),...(w.wildlife?.animals??[]),...(w.projectiles??[]),...(w.bombWaves??[]),...(w.fires?.items??[])].some(o=>o.id===r.sourceId);
      if(active||!miniTurretExplosive(r.sourceId)||(!wave&&!recovery)||r.endCore>w.tick*10)errors.push('Invalid historical bomb refuge.');}
    if(r.endCore>w.tick*10+240)errors.push('Invalid bomb refuge deadline.');
  }
  return errors;
}

/** Voluntary/mental orders can pause for a real fuse, but physical recovery and
 * committed edges remain independent. Failed drops retain their actual owner. */
export function bombDanger(w:World,p:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader,sources=captureBombDangerSources(w)):boolean {
  if(w.schemaVersion<193||!sources.length&&!p.bombRefuge)return false;
  if(p.state==='dead'||p.state==='downed'){delete p.bombRefuge;return false;}
  if(p.moveCooldown>0||p.motion&&p.motion.end>w.tick||p.melee?.strike||p.shooting?.stance?.phase==='cooldown'||p.stun||w.pawns.some(a=>a.rescue?.phase==='carry'&&a.rescue.patientId===p.id))return false;
  const active=sources.filter(s=>w.structures.includes(s)&&(actualBombWick256(s)?.endCore??0)>w.tick*10);
  const old=p.bombRefuge;
  if(old&&!active.some(s=>s.id===old.sourceId&&actualBombWick256(s)!.endCore===old.endCore)){delete p.bombRefuge;p.path=[];p.planCooldown=0;p.state='idle';}
  const source=active.filter(s=>distance(s,p)<=actualBombSourceRadius256(s)**2).sort((a,b)=>actualBombWick256(a)!.endCore-actualBombWick256(b)!.endCore||a.id-b.id)[0];
  if(!source&&!p.bombRefuge)return false;
  if(p.bombRefuge&&!source){p.path=[];p.state='idle';retryInterruptedCargo(w,p);return true;}
  const unsafe=(c:Cell)=>active.some(s=>distance(c,s)<=actualBombSourceRadius256(s)**2);
  let refuge=p.bombRefuge;
  if(!refuge||unsafe(refuge.target)||!canStandAt(w,refuge.target)){
    const reserved=reservedServiceCells(w,p.id),reach=searchCandidates(w,p,getBlocked(),CIVIL_TRANSIT_BLOCKERS,budget);
    if(!reach)return true;
    const candidates:Cell[]=[];
    for(let z=Math.max(0,p.z-8);z<=Math.min(w.height-1,p.z+8);z++)for(let x=Math.max(0,p.x-8);x<=Math.min(w.width-1,p.x+8);x++){
      const c={x,z};if(!unsafe(c)&&!reserved.has(z*w.width+x)&&canStandAt(w,c))candidates.push(c);
    }
    candidates.sort((a,b)=>distance(p,a)-distance(p,b)||a.z-b.z||a.x-b.x);
    let plan:{target:Cell;path:Cell[]}|undefined;
    for(const target of candidates){const path=routeToCell(w,target,reach);if(path!==null){plan={target,path};break;}}
    if(!plan)return true;
    if(w.scout&&'pawnId' in w.scout&&w.scout.pawnId===p.id)applyScoutCommand(w,{type:'scout-cancel'});
    if(w.commercialTrip&&'pawnId' in w.commercialTrip&&w.commercialTrip.pawnId===p.id)applyCommercialPreparation(w,{type:'commercial-cancel'});
    interruptWork(w,p);cancelMelee(p);cancelShooting(p);
    refuge={sourceId:source!.id,target:plan.target,endCore:actualBombWick256(source!)!.endCore};p.bombRefuge=refuge;p.path=plan.path;p.planCooldown=0;
  }
  if(p.x===refuge.target.x&&p.z===refuge.target.z){p.path=[];p.state='idle';retryInterruptedCargo(w,p);return true;}
  moveToward(w,p,refuge.target,true,getBlocked,budget,true,getLight);return true;
}
