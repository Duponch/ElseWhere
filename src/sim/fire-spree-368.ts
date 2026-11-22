import {ERRORED_PATHER_WAIT_LOCAL_368,IGNITE_COOLDOWN_CORE_368,IGNITE_FIRE_SIZE_368,IGNITE_WARMUP_CORE_368} from './pyromaniac-368.ts';
import {footprintCells} from './definitions.ts';
import {FireContent,type FireTarget} from './fire-content.ts';
import {groundFire} from './fire-rules.ts';
import {startFire} from './fire.ts';
import {fireTouch} from './firefighting.ts';
import {captureRoomQuality} from './room-quality.ts';
import {canStopAt,hasReachableCell,routeToCell,type Reachability} from './pathfinding.ts';
import {canStandAt} from './furniture-travel.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {aimingDelayFactor361} from './traits.ts';
import {aimedWarmup361} from './shooting-traits-361.ts';
import {structureById} from './structure-navigation.ts';
import {FIRE_SPREE_SALT_368,fireSpreeRoll368} from './fire-spree-stream-368.ts';
import type {FireSpreeCrisis368} from './mental-state.ts';
import type {NeedContext} from './needs.ts';
import type {Cell,Pawn,World} from './types.ts';

/* Schema 368: the Pyromaniac's fire-starting spree, read from RimWorld 1.6
 * (Defs/MentalStateDefs/MentalStates_Mood.xml FireStartingSpree, ThinkTreeDefs
 * SubTrees_Misc, Traits_Singular.xml Pyromaniac, Thoughts_Situation_Traits.xml
 * PyromaniacNearFire) and the classes JobGiver_FireStartingSpree,
 * JobDriver_Ignite, Pawn_NativeVerbs, Verb_Ignite, VerbDefsHardcodedNative,
 * Stance_Warmup, FireUtility, ThoughtWorker_PyromaniacNearFlames, CellFinder.
 * TryFindClosestRegionWith and ForbidUtility. Only a pyromaniac (a 368 trait)
 * ever starts this state, so no older save reads any of it. */
export {PYROMANIAC_SCHEMA_368,isPyromaniac368} from './pyromaniac-368.ts';

/** JobGiver_FireStartingSpree: waitTicks IntRange(80, 140), FireStartChance 0.75;
 * RCellFinder.RandomWanderDestFor radius 10. */
export const FIRE_SPREE_WAIT_CORE_368=[80,140] as const;
export const FIRE_SPREE_START_CHANCE_368=.75;
const WANDER_RADIUS=10;

export const newFireSpreeCrisis368=(w:World):FireSpreeCrisis368=>({kind:'fire-starting-spree',age:0,target:null,waitUntil:w.tick,igniteId:null,stanceCore:null,cast:false,waitNext:false});
const roll=(w:World,p:Pawn,salt:number)=>fireSpreeRoll368(w.seed,p.id,w.tick,salt);
/** TraitMentalStateGiver, Pyromaniac randomMentalState FireStartingSpree,
 * randomMentalStateMtbDaysMoodCurve (0, 50): MTB 50 days at any mood, checked
 * every 150 ticks (Rand.MTBEventOccurs), on the private stream. */
export const pyromaniacRandomSpreeDue368=(w:World,p:Pawn):boolean=>roll(w,p,FIRE_SPREE_SALT_368.randomState)<150/(50*60000);

/** The cells of a target thing (an item or a minified building lies on its owner cell). */
export function targetCells368(w:World,t:FireTarget):Cell[] {
  if(t.kind==='structure'){
    const pack=w.packed.find(p=>p.building===t.value);
    return pack?pack.owner.type==='ground'?[{x:pack.owner.x,z:pack.owner.z}]:[]:footprintCells(t.value);
  }
  if(t.kind==='pile')return t.value.owner.type==='ground'?[{x:t.value.owner.x,z:t.value.owner.z}]:[];
  return [{x:t.value.x,z:t.value.z}];
}
const targetId=(t:FireTarget):number=>t.value.id;
/** The Thing an Ignite job holds, while it is still spawned (FailOnDespawnedOrNull). */
function igniteTarget(w:World,id:number):FireTarget|undefined {
  const s=structureById(w,id);if(s)return {kind:'structure',value:s};
  const pack=w.packed.find(p=>p.building.id===id&&p.owner.type==='ground');if(pack)return {kind:'structure',value:pack.building};
  const pile=w.piles.find(p=>p.id===id&&p.owner.type==='ground');if(pile)return {kind:'pile',value:pile};
  const r=w.resources.find(r=>r.id===id&&r.kind!=='rock');if(r)return {kind:'resource',value:r};
  return undefined;
}
/** Thing.Position: the anchor of a building, else its own cell. */
function position(w:World,t:FireTarget):Cell|undefined {
  const cells=targetCells368(w,t);
  return t.kind==='structure'?cells.find(c=>c.x===t.value.x&&c.z===t.value.z)??cells[0]:cells[0];
}
export const staticFireCells368=(w:World):Set<number>=>new Set((w.fires?.items??[]).filter(groundFire).map(f=>f.z*w.width+f.x));
/** FireUtility.IsBurning: a static fire on one of its cells. */
const isBurning=(w:World,t:FireTarget,fires:ReadonlySet<number>):boolean=>targetCells368(w,t).some(c=>fires.has(c.z*w.width+c.x));
/** CellRect.ClosestCellTo the caster: its nearest footprint cell. */
function closestCell(w:World,t:FireTarget,from:Cell):Cell {
  let best:Cell|undefined,distance=Infinity;
  for(const c of targetCells368(w,t)){const d=(c.x-from.x)**2+(c.z-from.z)**2;if(d<distance){best=c;distance=d;}}
  return best!;
}
/** The Ignite verb's reach (range 1.42): the caster touches the target's
 * closest cell, without cutting a solid corner (the firefighting touch rule). */
const touches=(w:World,p:Cell,t:FireTarget):boolean=>fireTouch(w,p,closestCell(w,t,p));

/** The pawn's region, as Core's Region: the cells of its room space
 * connected (four neighbours) inside its aligned 12 x 12 block; a doorway is
 * a region of its own. Adaptation: Elsewhere's rooms count impassable
 * furniture as room cells. Empty when the pawn stands on no room cell. */
export function pawnRegion368(w:World,at:Cell):number[] {
  const topology=captureRoomQuality(w).topology,width=w.width,start=at.z*width+at.x,label=topology.labelAt(start);
  if(label===undefined||label===-1)return [];
  if(label===-2)return [start];
  const x0=at.x-at.x%12,z0=at.z-at.z%12,x1=Math.min(width,x0+12),z1=Math.min(w.height,z0+12);
  const out=[start],seen=new Set(out);
  for(let head=0;head<out.length;head++){
    const index=out[head]!,x=index%width,z=Math.floor(index/width);
    for(const [nx,nz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]] as const){
      if(nx<x0||nz<z0||nx>=x1||nz>=z1)continue;
      const n=nz*width+nx;if(!seen.has(n)&&topology.labelAt(n)===label){seen.add(n);out.push(n);}
    }
  }
  return out;
}
/** JobGiver_FireStartingSpree.TryFindRandomIgniteTarget. CellFinder.
 * TryFindClosestRegionWith starts at the pawn's own region, and a pawn in a
 * mental state never cares about forbidden areas (ForbidUtility.
 * CaresAboutForbidden): the search is always the pawn's region. Its things
 * (RegionListersUpdater: those in the region or touchable from it) that are
 * buildings, items or plants, flammable now, not burning and not covering the
 * pawn's cell. In id order, for a stable draw. */
export function igniteCandidates368(w:World,p:Pawn):FireTarget[] {
  const region=pawnRegion368(w,p);if(!region.length)return [];
  const content=new FireContent(w),fires=staticFireCells368(w),seen=new Set<object>(),found:FireTarget[]=[];
  for(const index of region){
    const from={x:index%w.width,z:Math.floor(index/w.width)};
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const c={x:from.x+dx,z:from.z+dz};
      if(!content.inside(c)||(dx||dz)&&!fireTouch(w,from,c))continue;
      for(const t of content.allTargets(c))if(!seen.has(t.value)){seen.add(t.value);found.push(t);}
    }
  }
  // Thing.FlammableNow: flammability of 0.01 or more, not shielded by a fire
  // bulwark (a full edifice) on its position: Elsewhere's fire targets.
  return found.filter(t=>{
    const at=position(w,t);
    return !!at&&content.targets(at).includes(t)&&!isBurning(w,t,fires)&&!targetCells368(w,t).some(c=>c.x===p.x&&c.z===p.z);
  }).sort((a,b)=>targetId(a)-targetId(b));
}
/** Toils_Goto.GotoThing(Touch): the shortest route to a cell touching one of
 * the target's cells (or on it, when standable). */
function igniteRoute(w:World,p:Pawn,t:FireTarget,reach:Reachability):{cell:Cell;path:Cell[]}|undefined {
  const reserved=reservedServiceCells(w,p.id),spots:{cell:Cell;steps:number;order:number}[]=[],seen=new Set<number>();
  for(const f of targetCells368(w,t))for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const c={x:f.x+dx,z:f.z+dz},index=c.z*w.width+c.x;
    if(c.x<0||c.z<0||c.x>=w.width||c.z>=w.height||seen.has(index))continue;
    if(!fireTouch(w,c,f)||reserved.has(index)||!canStopAt(w,c,reach)||!hasReachableCell(reach,index))continue;
    seen.add(index);spots.push({cell:c,steps:Math.max(Math.abs(c.x-p.x),Math.abs(c.z-p.z)),order:spots.length});
  }
  spots.sort((a,b)=>a.steps-b.steps||a.order-b.order);
  let best:{cell:Cell;path:Cell[];order:number}|undefined;
  for(const s of spots){
    // Eight-neighbour travel cannot use fewer edges than the Chebyshev distance.
    if(best&&(s.steps>best.path.length||s.steps===best.path.length&&s.order>best.order))continue;
    const path=routeToCell(w,s.cell,reach);
    if(path!==null&&(!best||path.length<best.path.length||path.length===best.path.length&&s.order<best.order))best={cell:s.cell,path,order:s.order};
  }
  return best&&{cell:best.cell,path:best.path};
}
/** RCellFinder.RandomWanderDestFor(pawn, Position, 10): adapted as the other
 * crisis wanders, a uniform reachable standing cell within the radius. */
function wanderDest(w:World,p:Pawn,reach:Reachability,r:number):Cell|undefined {
  const reserved=reservedServiceCells(w,p.id),candidates:Cell[]=[];
  for(let z=Math.max(0,p.z-WANDER_RADIUS);z<=Math.min(w.height-1,p.z+WANDER_RADIUS);z++)for(let x=Math.max(0,p.x-WANDER_RADIUS);x<=Math.min(w.width-1,p.x+WANDER_RADIUS);x++){
    if((x-p.x)**2+(z-p.z)**2>WANDER_RADIUS**2||x===p.x&&z===p.z||reserved.has(z*w.width+x)||!canStandAt(w,{x,z}))continue;
    if(hasReachableCell(reach,z*w.width+x))candidates.push({x,z});
  }
  return candidates.length?candidates[Math.floor(r*candidates.length)]:undefined;
}
/** The Ignite job ends (success, failure or a cancelled stance). */
function endIgnite(c:FireSpreeCrisis368,p:Pawn):void {c.igniteId=null;c.stanceCore=null;c.cast=false;c.target=null;p.path=[];p.state='idle';}
/** A need took the pawn: its current spree job ends. */
export function fireSpreeJobEnded368(p:Pawn):void {
  const c=p.mental?.crisis;if(c?.kind==='fire-starting-spree'){c.igniteId=null;c.stanceCore=null;c.cast=false;}
}

/** One step of the spree's think node (after ordinary needs, like the other
 * crises): the current job, else JobGiver_FireStartingSpree.TryGiveJob. True
 * when the pawn holds this crisis. */
export function processFireStartingSpree368(w:World,p:Pawn,context:NeedContext,candidatesReach:()=>Reachability|null):boolean {
  const c=p.mental?.crisis;if(c?.kind!=='fire-starting-spree')return false;
  const now=w.tick*10;
  if(c.igniteId!==null){
    const target=igniteTarget(w,c.igniteId);
    if(!target){endIgnite(c,p);return true;}
    if(c.stanceCore===null){
      // GotoThing(Touch).FailOnBurningImmobile.
      if(isBurning(w,target,staticFireCells368(w))){endIgnite(c,p);return true;}
      if(touches(w,p,target)){
        // JobDriver_Ignite's second toil: Pawn_NativeVerbs.TryStartIgnite, a
        // warmup stance of 3 s x AimingDelayFactor.
        p.path=[];c.target=null;p.state='idle';
        c.stanceCore=now+aimedWarmup361(IGNITE_WARMUP_CORE_368,aimingDelayFactor361(p));
        return true;
      }
      if(c.target&&p.path.length){context.move(c.target,true);if(p.state==='idle'&&!p.path.length)c.target=null;return true;}
      p.state='idle';
      if(p.planCooldown>0)return true;
      const reach=candidatesReach();if(!reach)return true;
      const route=igniteRoute(w,p,target,reach);
      if(!route){endIgnite(c,p);c.waitUntil=w.tick+ERRORED_PATHER_WAIT_LOCAL_368;return true;}
      c.target=route.cell;p.path=route.path;p.planCooldown=0;context.move(c.target,true);
      return true;
    }
    p.path=[];p.state='idle';
    if(!c.cast){
      // Stance_Warmup: cancelled when the caster can no longer reach the target.
      if(!touches(w,p,target)){endIgnite(c,p);return true;}
      if(now<c.stanceCore)return true;
      // Verb_Ignite.TryCastShot: FireUtility.TryStartFireIn at the closest cell.
      startFire(w,closestCell(w,target,p),IGNITE_FIRE_SIZE_368);
      c.cast=true;c.stanceCore=now+IGNITE_COOLDOWN_CORE_368;
      return true;
    }
    if(now>=c.stanceCore)endIgnite(c,p);
    return true;
  }
  if(c.target){
    // GotoWander.
    if(!canStandAt(w,c.target)||reservedServiceCells(w,p.id).has(c.target.z*w.width+c.target.x)){c.target=null;p.path=[];p.state='idle';c.waitUntil=w.tick+1;return true;}
    if(p.x===c.target.x&&p.z===c.target.z){c.target=null;p.path=[];p.state='idle';return true;}
    context.move(c.target,true);
    if(p.state==='idle'&&!p.path.length){c.target=null;c.waitUntil=w.tick+20;}
    return true;
  }
  p.state='idle';
  if(w.tick<c.waitUntil||p.planCooldown>0)return true;
  // JobGiver_FireStartingSpree.TryGiveJob.
  if(c.waitNext){
    const [lo,hi]=FIRE_SPREE_WAIT_CORE_368;
    c.waitNext=false;c.waitUntil=w.tick+(lo+Math.floor(roll(w,p,FIRE_SPREE_SALT_368.wait)*(hi-lo+1)))/10;
    return true;
  }
  if(roll(w,p,FIRE_SPREE_SALT_368.chance)<FIRE_SPREE_START_CHANCE_368){
    const candidates=igniteCandidates368(w,p);
    if(candidates.length){
      const t=candidates[Math.floor(roll(w,p,FIRE_SPREE_SALT_368.target)*candidates.length)]!;
      c.waitNext=true;c.igniteId=targetId(t);c.stanceCore=null;c.cast=false;
      // The job starts this tick: its first toil walks (or the pawn already touches it).
      return processFireStartingSpree368(w,p,context,candidatesReach);
    }
  }
  const reach=candidatesReach();if(!reach)return true;
  const dest=wanderDest(w,p,reach,roll(w,p,FIRE_SPREE_SALT_368.wander));
  if(!dest){c.waitUntil=w.tick+20;return true;}
  c.waitNext=true;c.target=dest;p.path=routeToCell(w,dest,reach)!;p.planCooldown=0;context.move(c.target,true);
  return true;
}
