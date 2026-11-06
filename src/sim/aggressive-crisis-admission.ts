import { isColonist,factionOf,distanceSquared } from './affiliation.ts';
import { carrierOf } from './rescue-state.ts';
import { captureMeleePlaces } from './melee-space.ts';
import { blockedCells,hasReachableCell } from './pathfinding.ts';
import { candidateAccess } from './candidate-access.ts';
import { structureMaxHp } from './thing-damage-rules.ts';
import { isRoomDoor } from './door-rules.ts';
import { healthRandom } from './health.ts';
import type { AggressiveCrisis,AggressiveCrisisKind } from './mental-state.ts';
import type { SearchBudget } from './work-planner.ts';
import type { Pawn,Structure,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import type { Mechanoid } from './mechanoid-state.ts';
import { structureById } from './structure-navigation.ts';

export interface AggressiveCrisisAdmission { targetIds:number[];population:number }
export const freePresentColonist=(w:World,p:Pawn):boolean=>w.pawns.includes(p)&&isColonist(p)&&!p.prisoner&&!p.visitor&&!p.podRescue&&!p.raid&&p.state!=='dead';
export const aggressiveCrisisPopulation=(w:World):number=>w.pawns.filter(p=>freePresentColonist(w,p)).length;

export function murderVictim(w:World,p:Pawn,t:Pawn):boolean {
  return t!==p&&w.pawns.includes(t)&&t.state!=='dead'&&(factionOf(t)===factionOf(p)||!!t.prisoner)
    &&!carrierOf(w,t.id)&&!t.raid?.exiting&&!t.prisoner?.escape&&t.visitor?.phase!=='leaving'
    &&!(w.scout?.phase==='leaving'&&w.scout.pawnId===t.id)
    &&!(w.commercialTrip?.phase==='leaving'&&w.commercialTrip.pawnId===t.id);
}

/** One read-only spatial decision. Null defers it without any RNG draw; empty
 * means no physically admitted target. Region rules are adapted to this map. */
export function aggressiveCrisisCandidates(w:World,p:Pawn,kind:AggressiveCrisisKind,budget?:SearchBudget,bashDoors=false):number[]|null {
  const candidates:(Pawn|Structure|WildAnimal|Mechanoid)[]=kind==='tantrum'
    ?w.structures.filter(s=>structureMaxHp(s)>0&&distanceSquared(p,s)<=40**2)
    :kind==='murderous-rage'?w.pawns.filter(t=>murderVictim(w,p,t)):[
      ...w.pawns.filter(t=>t!==p&&t.state!=='dead'&&t.state!=='downed'&&!carrierOf(w,t.id)&&distanceSquared(p,t)<=40**2),
      ...(w.wildlife?.animals??[]).filter(t=>t.state!=='dead'&&t.state!=='downed'&&distanceSquared(p,t)<=40**2),
      ...(w.mechanoids??[]).filter(t=>t.state!=='dead'&&t.state!=='downed'&&!t.health?.death&&distanceSquared(p,t)<=40**2),
    ];
  if(!candidates.length)return [];
  if(budget&&!budget.remaining)return null;
  if(budget)budget.remaining--;
  const grid=blockedCells(w);
  if(bashDoors)for(const s of w.structures)if(isRoomDoor(s.kind))grid[s.z*w.width+s.x]=0;
  const reach=candidateAccess(w,p,grid,new Set(),true),places=captureMeleePlaces(w,p);
  return candidates.filter(t=>places(t).some(c=>hasReachableCell(reach,c.z*w.width+c.x))).map(t=>t.id);
}

/** Admission does not interrupt, reserve, select a target or consume randomness. */
export function aggressiveCrisisAdmission(w:World,p:Pawn,kind:AggressiveCrisisKind,budget?:SearchBudget):AggressiveCrisisAdmission|undefined|null {
  if(!freePresentColonist(w,p)||p.state==='downed'||p.state==='sleeping'||p.mental?.crisis||carrierOf(w,p.id))return;
  const population=aggressiveCrisisPopulation(w);
  if(kind==='berserk')return {targetIds:[],population};
  const targetIds=aggressiveCrisisCandidates(w,p,kind,budget);
  if(targetIds===null)return null;
  return targetIds.length>=(kind==='tantrum'?2:1)?{targetIds,population}:undefined;
}

const random=(rng:{value:number})=>{const state={rng:rng.value},roll=healthRandom(state);rng.value=state.rng;return roll;};
export function chooseTantrumTarget(w:World,p:Pawn,ids:readonly number[],rng:{value:number}):number|undefined {
  const weighted=ids.flatMap(id=>{const s=structureById(w,id);return s?[{id,weight:(1-Math.min(Math.sqrt(distanceSquared(p,s))/40,1))**2+.01}]:[];});
  if(!weighted.length)return;
  let roll=random(rng)*weighted.reduce((sum,t)=>sum+t.weight,0);
  return weighted.find(t=>(roll-=t.weight)<0)?.id??weighted.at(-1)!.id;
}

/** The caller adopts the explicit stream only when committing the new crisis. */
export function planAggressiveCrisis(w:World,p:Pawn,kind:AggressiveCrisisKind,admission:AggressiveCrisisAdmission,rng:{value:number}):AggressiveCrisis {
  const base={age:0,target:null,waitUntil:w.tick},core=w.tick*10;
  if(kind==='tantrum')return {...base,kind,targetId:chooseTantrumTarget(w,p,admission.targetIds,rng)??null,targetSinceCore:core,attempted:false,nextTargetCore:core+500};
  if(kind==='berserk')return {...base,kind,targetId:null,jobUntilCore:null};
  if(!admission.targetIds.length)throw new Error('Murderous rage requires an admitted victim.');
  return {...base,kind,targetId:admission.targetIds[Math.floor(random(rng)*admission.targetIds.length)]!,nextCheckCore:core+120};
}
