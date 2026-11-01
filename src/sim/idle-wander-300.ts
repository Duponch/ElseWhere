import {effectiveCore297,effectiveLocal297} from './core-phase-297.ts';
import {isColonist} from './affiliation.ts';
import {allowedAreaOtherActivity,allowedAreaAllows,captureAllowedArea} from './allowed-area-state.ts';
import {pawnBody} from './health-rules.ts';
import {stopCapturedTravel297} from './movement.ts';
import {canStandAt,furnitureDelay} from './furniture-travel.ts';
import {canStep,hasReachableCell,routeToCell} from './pathfinding.ts';
import {healthRandom} from './health.ts';
import {isGatherSpot,gatherActive} from './recreation-space.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {capturePrisonTopology,prisonRoom} from './prison-space.ts';
import {comfortableTemperature} from './heat-rules.ts';
import {spikeTrapKnowsOf} from './spike-trap-state.ts';
import {isStunned} from './stun.ts';
import {chooseClinicalWanderDestination256} from './animal-confused-wander-256.ts';
import {animalClinicalRandom256} from './animal-condition-medical-frontier-256.ts';
import type {NeedContext} from './needs.ts';
import type {Reachability} from './pathfinding.ts';
import {footprintCells} from './definitions.ts';
import type {Cell,Pawn,World,Structure} from './types.ts';

/** New task authority only. The real MindState bit remains shared with clinical
 * wander in300; no imported299 bit, timer or route is rewritten at admission. */
export type IdleWander300={kind:'wait';at:Cell;startedAtCore:number;expiryIntervalCore:number}|{kind:'move';target:Cell};
type IdlePawn300=Pawn&{idleWander300?:IdleWander300};
export const idleWanderTask300=(pawn:Pawn):IdleWander300|undefined=>(pawn as IdlePawn300).idleWander300;
export interface IdleWanderContext300 extends NeedContext {candidates():Reachability|null;blocked():Uint8Array}
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;

/** Gen.HashCombineInt(id,169495093), including C# signed32 overflow. */
export function idleHashOffset300(id:number):number {const seed=id|0;return (seed^(169495093+2654435769+(seed<<6)+(seed>>2)))|0;}
/** The assigned interval is NOT an exact end deadline: the JobTracker also
 * requires its signed32 hash window. Runtime advances this owner one Core. */
export function idleWaitExpiry300(task:Extract<IdleWander300,{kind:'wait'}>,id:number,core:number,delta=1):boolean {
 return core>=task.startedAtCore+task.expiryIntervalCore&&Math.abs((((core|0)+idleHashOffset300(id))|0)%task.expiryIntervalCore)<delta;
}
export function idleOtherActivity300(p:Pawn):boolean {
 return allowedAreaOtherActivity(p)||!!(p.medicalSleep||p.draft||p.mental?.crisis||p.allowedAreaReturn||p.brewing||p.coupleTask285||p.factionComms298||p.shipCasketTask277||p.firefoamTask290||p.prisoner||p.visitor||p.raid||p.podRescue);
}
/** O(1) physical-owner gate, usable by the existing per-pawn Core pass. */
export function idleMotionAllowed300(w:World,p:Pawn):boolean {
 // Stun suspends the pather; it does not revoke the GotoWander owner.
 // The existing Core movement pass still refuses to advance a stunned pawn.
 return Number(w.schemaVersion)===300&&idleWanderTask300(p)?.kind==='move'&&!idleOtherActivity300(p)&&p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&!p.collapsePending;
}
export function releaseIdleWander300(p:Pawn,clearRoute=true):void {
 const owner=p as IdlePawn300;if(!owner.idleWander300)return;delete owner.idleWander300;
 if(clearRoute){p.path=[];if(!idleOtherActivity300(p)&&p.state!=='dead'&&p.state!=='downed')p.state=p.moveCooldown>0?'moving':'idle';p.planCooldown=0;p.needCooldown=0;}
}
/** New nonempty effective assignment only; painting has no new speculative
 * interrupt contract here. StopDead uses the existing real pather stop. */
export function interruptIdleForArea300(w:World,p:Pawn):void {
 if(Number(w.schemaVersion)!==300)return;const task=idleWanderTask300(p);if(!task)return;
 const policy=captureAllowedArea(w,p),at=task.kind==='wait'?task.at:task.target;
 if(policy&&!policy.has(at.z*w.width+at.x)){stopCapturedTravel297(w,p);releaseIdleWander300(p);}
}
function mayOffer(w:World,p:Pawn):boolean {
 return Number(w.schemaVersion)===300&&w.pawns.includes(p)&&!idleWanderTask300(p)&&isColonist(p)&&!idleOtherActivity300(p)&&!isStunned(p,effectiveCore297(w))
  &&p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&!p.collapsePending&&p.moveCooldown===0&&(p.motion?.end??0)<=effectiveLocal297(w)
  &&p.mental?.wander?.revision===1&&pawnBody(p).canBeAwake&&pawnBody(p).capacities.moving>0
  &&!w.piles.some(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id)&&!w.packed.some(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id);
}

/** Scoped destination-presence consumer, not an obstacle grid or a furniture
 * reservation. A real release removes this claim by deleting the task. */
export function idleDestinationReserved300(w:World,pawn:Pawn,cell:Cell):boolean {
 return w.pawns.some(other=>{const task=other===pawn?undefined:idleWanderTask300(other);return task?.kind==='wait'&&same(task.at,cell);});
}

// BuildingProperties.ai_chillDestination defaults TRUE. These delivered ids
// inherit explicit FALSE Core definitions/parents from the targeted XML read;
// normal beds, tables, chairs and workstations must not be collapsed to walls.
const NO_CHILL300:ReadonlySet<string>=new Set(['sleeping-spot','animal-sleeping-spot','moisture-pump','grave','sarcophagus','cryptosleep-casket','ancient-cryptosleep-casket','door','autodoor','fence','fence-gate','marriage-spot','party-spot','caravan-packing-spot','pen-marker','power-conduit','power-switch','geothermal-generator','watermill-generator','crafting-spot','butcher-spot','sandbags','barricade','spike-trap']);
export const idleChillBuilding300=(kind:string):boolean=>kind==='wall'||!NO_CHILL300.has(kind);

/** One quota-granted root decision; source arrays retain their actual order.
 * Existing clone navigation/RegionLink geometry remains an explicit adapter,
 * not a claim of exhaustive native ordering or destination/RNG parity. */
export function colonyWanderRoot300(w:World,p:Pawn,reach:Reachability,random:()=>number):Cell {
 const allowed=(c:Cell)=>allowedAreaAllows(w,p,c)&&!idleDestinationReserved300(w,p,c)&&canStandAt(w,c)&&hasReachableCell(reach,c.z*w.width+c.x);
 const pick=(cells:Cell[])=>cells.length?cells[Math.min(cells.length-1,Math.floor(random()*cells.length))]:undefined;
 const eight=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]] as const;
 const surrounding=(s:Structure):Cell[]=>{
  const own=footprintCells(s),inside=new Set(own.map(c=>c.z*w.width+c.x)),result=new Map<number,Cell>();
  for(const at of own)for(const [dx,dz]of eight){const c={x:at.x+dx,z:at.z+dz};if(c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)continue;const key=c.z*w.width+c.x;if(!inside.has(key))result.set(key,c);}
  return [...result.values()];
 };
 const around=(s:Structure)=>surrounding(s).filter(allowed);
 // A gathering supplies its Position as the root. Touch reachability is
 // tested at its real oriented footprint, not used to replace that root.
 const touch=(s:Structure)=>[...footprintCells(s),...surrounding(s)].some(c=>canStandAt(w,c)&&hasReachableCell(reach,c.z*w.width+c.x));
 const gatherings=w.structures.filter(s=>targetBuildingPlayerUse263(w,s)&&isGatherSpot(s)&&gatherActive(s)&&allowedAreaAllows(w,p,s)&&touch(s)).map(s=>({x:s.x,z:s.z}));
 const gathering=pick(gatherings);if(gathering)return gathering;
 const home=new Set(w.home??[]),topology=w.structures.some(s=>s.prisoner)?capturePrisonTopology(w):undefined;
 const buildings=w.structures.filter(s=>targetBuildingPlayerUse263(w,s)&&idleChillBuilding300(s.kind)&&home.has(s.z*w.width+s.x)&&allowedAreaAllows(w,p,s)).flatMap(around)
  .filter(c=>!topology||!prisonRoom(w,c,topology));
 const building=pick(buildings);if(building)return building;
 return pick(w.pawns.filter(q=>isColonist(q)&&!q.prisoner&&q.state!=='dead'&&allowed(q)).map(q=>({x:q.x,z:q.z})))??{x:p.x,z:p.z};
}
/** Call only after a RESOLVED absence of earlier offers. PENDING search must
 * not reach this supplier, and must consume neither alternation nor RNG here. */
export function offerIdleWander300(w:World,p:Pawn,context:IdleWanderContext300):'admitted'|'unavailable'|'pending' {
 if(!mayOffer(w,p))return 'unavailable';
 const mind=p.mental!.wander!,wantWait=mind.nextMoveOrderIsWait,stream={rng:w.rng};
 const random=()=>healthRandom(stream);
 const wait=()=>{const interval=125+Math.floor(random()*76);stopCapturedTravel297(w,p);
  (p as IdlePawn300).idleWander300={kind:'wait',at:{x:p.x,z:p.z},startedAtCore:effectiveCore297(w),expiryIntervalCore:interval};p.state='idle';p.path=[];
  mind.nextMoveOrderIsWait=!mind.nextMoveOrderIsWait;w.rng=stream.rng;return 'admitted' as const;};
 if(wantWait)return wait();
 const reach=context.candidates();if(!reach)return 'pending';
 const root=colonyWanderRoot300(w,p,reach,random),physical=context.blocked(),occupied=new Set<number>(),comfy=comfortableTemperature(w,p);
 const free=(c:Cell)=>allowedAreaAllows(w,p,c)&&!idleDestinationReserved300(w,p,c)&&canStandAt(w,c);
 const destination=chooseClinicalWanderDestination256(w,root,{free,occupy:free,step:(a,b)=>canStep(w,a,b,physical,occupied)},
  {canReach:c=>hasReachableCell(reach,c.z*w.width+c.x),pathTo:c=>routeToCell(w,c,reach)??undefined},animalClinicalRandom256(random),
  {comfy:{minimum:comfy.min,maximum:comfy.max},water:false,knowsTraps:spikeTrapKnowsOf(w,p),delayCore:c=>furnitureDelay(w,p,c)*10,destinationAllowed:c=>allowedAreaAllows(w,p,c)&&!idleDestinationReserved300(w,p,c)});
 if(same(destination,p))return wait();
 const path=routeToCell(w,destination,reach);
 if(!path||!free(destination)){mind.nextMoveOrderIsWait=false;w.rng=stream.rng;return 'unavailable';}
 (p as IdlePawn300).idleWander300={kind:'move',target:{x:destination.x,z:destination.z}};p.path=path;p.state='moving';
 mind.nextMoveOrderIsWait=!mind.nextMoveOrderIsWait;w.rng=stream.rng;context.move(destination,true);return idleWanderTask300(p)?'admitted':'unavailable';
}
/** Active optional job owns the turn. MainWork is not re-run every20 local
 * ticks or every constant-tree30Core window. Real commands clear it on commit. */
export function processIdleWander300(w:World,p:Pawn,context:IdleWanderContext300):boolean {
 const task=Number(w.schemaVersion)===300?idleWanderTask300(p):undefined;if(!task)return false;
 if(idleOtherActivity300(p)||p.state==='dead'||p.state==='downed'||p.health?.death||p.collapsePending){releaseIdleWander300(p,!idleOtherActivity300(p));return false;}
 if(task.kind==='wait'){p.state='idle';return true;}
 if(isStunned(p,effectiveCore297(w)))return true;
 if(!allowedAreaAllows(w,p,task.target)||!canStandAt(w,task.target)){releaseIdleWander300(p);return false;}
 context.move(task.target,true);
 if(p.state==='idle'&&!p.path.length&&p.moveCooldown===0){releaseIdleWander300(p);return false;}
 return true;
}

/** Barrier-captured active subset only, not a new scan of World everyCore.
 * A finished task wakes Main for its next existing macro (0..9Core lag). This
 * explicit F01/F03 limitation is NOT an admission-only Main at60Hz. */
export function createIdleWanderCore300(w:World){
 let dirty=true,owners:Pawn[]=[];
 return {invalidate(){dirty=true;},advance(core:number):{actorsChanged:number[];requiresFull:boolean}{
  if(Number(w.schemaVersion)!==300)return {actorsChanged:[],requiresFull:false};
  if(core!==effectiveCore297(w))throw Error('Idle300 requires its actual committed Core');
  if(dirty){owners=w.pawns.filter(p=>idleWanderTask300(p));dirty=false;}
  const changed:number[]=[];
  for(const p of owners){const task=idleWanderTask300(p);if(!task)continue;
   if(idleOtherActivity300(p)||p.state==='dead'||p.state==='downed'||p.health?.death||p.collapsePending){releaseIdleWander300(p,!idleOtherActivity300(p));changed.push(p.id);continue;}
   const done=task.kind==='wait'?idleWaitExpiry300(task,p.id,core):same(p,task.target)&&p.path.length===0&&p.moveCooldown===0&&(p.motion?.end??0)<=core/10;
   if(done){releaseIdleWander300(p);changed.push(p.id);}
  }
  if(changed.length)owners=owners.filter(p=>idleWanderTask300(p));
  return {actorsChanged:changed,requiresFull:changed.length>0};
 }};
}
