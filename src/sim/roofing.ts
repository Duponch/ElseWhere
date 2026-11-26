import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {roofCollapseProjection256} from './roof-collapse-projection-256.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {carrierOf} from './rescue-state.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {damageNaturalRoofCell256,roofPhysicalCell256} from './roof-natural-damage-256.ts';
import {placeCollapsedRock256} from './collapsed-rocks-256.ts';
import {addFilth,removeFilth} from './filth.ts';
import { workPriority } from './work-types.ts';
import { RoomTopologyCache } from './room-topology.ts';
import { RoofContext, roofCoverage, roofKindAt, isRoofJob, roofIndex, roofJobWanted } from './roof-rules.ts';
import { releaseWork } from './work-release.ts';
import { isPlant, plantGrowth } from './plants.ts';
import type { Cell, Job, World } from './types.ts';
import {invalidateResourceJournal} from './resource-mutation-journal.ts';

function setConstructedRoofs(world: World, cells: number[]): void {
  const old=new Set(world.roofing!.constructed),next=new Set(cells);
  const changed=world.resources.some(r=>isPlant(r)&&old.has(roofIndex(world,r))!==next.has(roofIndex(world,r)));
  if(changed){invalidateResourceJournal(world);world.resources=world.resources.map(r=>isPlant(r)&&old.has(roofIndex(world,r))!==next.has(roofIndex(world,r))
    ?{...r,growth:plantGrowth(world,r),growthTick:world.tick}:r);}
  world.roofing!.constructed=cells;
}

export function designateRoofArea(world: World, cells: readonly number[], action: string): void {
  const state = world.roofing ??= { constructed: [], build: [], remove: [], cursor: 0 };
  const chosen = new Set(cells);
  state.build = state.build.filter(i => !chosen.has(i)); state.remove = state.remove.filter(i => !chosen.has(i));
  if (action === 'build-roof') state.build.push(...cells);
  if (action === 'remove-roof') state.remove.push(...cells.filter(i=>roofKindAt(world,i)!=='natural-thick'));
  state.build.sort((a,b)=>a-b); state.remove.sort((a,b)=>a-b); state.cursor = 0;
  reconcileRoofJobs(world);
  for (const p of world.pawns) if (p.jobId === null && !p.haul && !p.cooking) p.planCooldown = 0;
}

export function reconcileRoofJobs(world: World, context?: RoofContext): void {
  if(!world.jobs.some(isRoofJob))return;
  context ??= new RoofContext(world);
  const current=context;
  const stale = new Set(world.jobs.filter(j => isRoofJob(j) && !roofJobWanted(world,j,current)).map(j => j.id));
  if (!stale.size) return;
  for (const pawn of world.pawns) if (pawn.jobId !== null && stale.has(pawn.jobId)){if(world.roofing?.natural)interruptWork(world,pawn,true);else releaseWork(world,pawn);}
  for (const pawn of world.pawns) pawn.orders.queue = pawn.orders.queue.filter(order => typeof order !== 'number' || !stale.has(order));
  world.jobs = world.jobs.filter(j => !stale.has(j.id));
}

/** Bounded intentions, separate ceiling layer: no material escrow or frame. */
export function scheduleRoofs(world: World): void {
  const state = world.roofing; if (!state || world.tick % 5 !== 0) return;
  const context = new RoofContext(world); reconcileRoofJobs(world,context);
  // Inaccessible generated targets must not monopolize a small worker pool.
  // Rotate only unclaimed intentions, never active or accepted queued work.
  if(world.tick%50===0) {
    const roofJobs=world.jobs.filter(isRoofJob);
    if(roofJobs.length&&roofJobs.every(j=>j.reservedBy===null))world.jobs=world.jobs.filter(j=>!isRoofJob(j));
  }
  const pending = world.jobs.filter(isRoofJob), used = new Set(pending.map(j => roofIndex(world,j)));
  let capacity = Math.max(0, Math.min(128, world.pawns.filter(p=>workPriority(p,'build')>0).length * 2) - pending.length);
  const candidates = [...state.remove, ...state.build]; if (!candidates.length) { state.cursor = 0; return; }
  const limit = Math.min(candidates.length, 1024);
  for (let scanned = 0; scanned < limit && capacity > 0; scanned++) {
    const at = state.cursor % candidates.length, index = candidates[at]!; state.cursor = (at+1)%candidates.length;
    if (used.has(index)) continue;
    const kind = context.remove.has(index) ? 'remove-roof' : 'build-roof';
    const job: Job = {id:world.nextId,kind,x:index%world.width,z:Math.floor(index/world.width),orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};
    if (!roofJobWanted(world,job,context) || !Number.isSafeInteger(world.nextId+1)) continue;
    // A ground task already cutting the same tree owns that plant first.
    if (kind==='build-roof' && world.resources.some(r=>r.kind==='tree'&&roofIndex(world,r)===index)
      && world.jobs.some(j=>!isRoofJob(j)&&roofIndex(world,j)===index)) continue;
    world.nextId++; world.jobs.push(job); used.add(index); capacity--;
  }
}

/** Called only when a finished wall/door changes the enclosure. No roof appears
 * automatically: the resulting designation still requires a builder. */
export function autoRoofRooms(world: World, at: Cell): void {
  const topology = new RoomTopologyCache().read(world), spaces = new Set<number>();
  for (const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const s=topology.at(at.x+dx!,at.z+dz!);
    if(s?.kind==='space'&&!s.touchesMapEdge&&s.cellCount<=320)spaces.add(s.id);
  }
  if(!spaces.size)return;
  const context=new RoofContext(world), cells=new Set<number>();
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++) {
    const room=topology.at(x,z);if(room?.kind!=='space'||!spaces.has(room.id))continue;
    const index=z*world.width+x;
    if(!context.remove.has(index)&&context.supported(index,true))cells.add(index);
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx=x+dx!,nz=z+dz!,i=nz*world.width+nx;
      if(nx>=0&&nz>=0&&nx<world.width&&nz<world.height&&context.holders[i]&&!context.remove.has(i))cells.add(i);
    }
  }
  if(cells.size)designateRoofArea(world,[...cells],'build-roof');
}

/** Loss of support removes constructed coverage and damages people below.
 * Re-evaluate until stable because one lost connection can expose another. */
export function reconcileRoofSupport(world: World, removal = false, lostSupport?: Cell): number {
  const state=world.roofing;if(state?.natural)return reconcileNaturalRoofSupport256(world,removal,lostSupport);if(!state?.constructed.length)return 0;
  let removed=0;const collapsed=new Set<number>();
  for(;;) {
    const context=new RoofContext(world), connected=context.connectedRoofs();
    const retained=state.constructed.filter(i=>connected.has(i) && (removal || lostSupport && (i%world.width-lostSupport.x)**2+(Math.floor(i/world.width)-lostSupport.z)**2>6.9**2 || context.supported(i)));
    if(retained.length===state.constructed.length)break;
    const kept=new Set(retained);for(const cell of state.constructed)if(!kept.has(cell))collapsed.add(cell);
    removed+=state.constructed.length-retained.length;setConstructedRoofs(world,retained);
  }
  if(removed&&!removal) {
    damageFromRoofCollapse(world,collapsed);
    world.events.push({tick:world.tick,type:'job',message:`Effondrement : ${removed} case(s) de toit sans support.`});
    if(world.events.length>80)world.events.splice(0,world.events.length-80);
  }
  reconcileRoofJobs(world);return removed;
}

export function finishRoofJob(world: World, job: Job): void {
  const state=world.roofing!,context=new RoofContext(world),at=roofIndex(world,job);
  if(job.kind==='remove-roof') {
    if(context.thick.has(at))return;
    if(state.natural){
      const projection=roofCollapseProjection256(world),draft=projection.view,r=draft.roofing!;
      setNaturalRoofCoverage256(draft,r.constructed.filter(i=>i!==at),r.natural!.thin.filter(i=>i!==at),r.natural!.thick);
      executeNaturalRoofSupport256(draft,true,job);if(!projection.finish().adopt())throw Error('Stale natural roof removal transaction');
    }
    else {setConstructedRoofs(world,state.constructed.filter(i=>i!==at));reconcileRoofSupport(world,true);}
  } else {
    // Cardinal then diagonals, root last: deterministic local adaptation of
    // Core's 3x3 placement, each new cell can support the next in this action.
    for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1],[0,0]]) {
      const x=job.x+dx!,z=job.z+dz!,index=z*world.width+x;
      if(x<0||z<0||x>=world.width||z>=world.height||!context.build.has(index)||context.roof.has(index)||!context.supported(index)
        ||world.resources.some(r=>r.kind==='tree'&&r.x===x&&r.z===z))continue;
      context.roof.add(index);context.constructed.add(index);
    }
    setConstructedRoofs(world,[...context.constructed].sort((a,b)=>a-b));
  }
}
import { damageFromRoofCollapse } from './roof-damage.ts';

/** Write the union after anchoring lazy plant growth under the old physical
 * coverage. References change only at the actual roof mutation. */
function setNaturalRoofCoverage256(world:World,constructed:number[],thin:number[],thick:number[]):void {
 const state=world.roofing!,old=new Set(roofCoverage(world)),next=new Set([...constructed,...thin,...thick]);
 invalidateResourceJournal(world);
 world.resources=world.resources.map(r=>isPlant(r)&&old.has(roofIndex(world,r))!==next.has(roofIndex(world,r))?{...r,growth:plantGrowth(world,r),growthTick:world.tick}:r);
 state.constructed=constructed;state.natural={thin,thick};
}
interface CollapseTransaction {pending:Cell[]}
const naturalCollapseTransactions=new WeakMap<World,CollapseTransaction>();
/** Rare synchronous frontier, never an RAF/index. Destruction of a support
 * during phase one queues its real cell instead of recursively entering a
 * second collapse transaction against stale candidates. */
function reconcileNaturalRoofSupport256(world:World,removal:boolean,lostSupport?:Cell):number {
 if(naturalCollapseTransactions.has(world))return executeNaturalRoofSupport256(world,removal,lostSupport);
 if(lostSupport){const context=new RoofContext(world),at=roofIndex(world,lostSupport);
  if(!context.floatingNear([at]).size&&(removal||!context.unsupportedNear(at).length)){reconcileRoofJobs(world,context);return 0;}
 }
 // Every helper, clinical event, ID, random draw, drop and phase-two deposit
 // succeeds against owned drafts before any actual phase-one effect commits.
 const projection=roofCollapseProjection256(world),count=executeNaturalRoofSupport256(projection.view,removal,lostSupport),prepared=projection.finish();
 if(!prepared.adopt())throw Error('Stale natural roof collapse transaction');return count;
}
function executeNaturalRoofSupport256(world:World,removal:boolean,lostSupport?:Cell):number {
 const active=naturalCollapseTransactions.get(world);if(active){if(lostSupport)active.pending.push({x:lostSupport.x,z:lostSupport.z});return 0;}
 const transaction:CollapseTransaction={pending:[]};naturalCollapseTransactions.set(world,transaction);let count=0;
 const work:Array<{at:number;removal:boolean}>=lostSupport?[{at:roofIndex(world,lostSupport),removal}]:[];
 try {
  // This cold fallback is for callers without an actual changed cell. Normal
  // mining/destruction/removal always supplies its own physical position.
  if(!lostSupport){const context=new RoofContext(world),connected=context.connectedRoofs();for(const at of context.roof)if(!connected.has(at)||!removal&&!context.supported(at))work.push({at,removal});}
  while(work.length){
   const changed=work.shift()!,context=new RoofContext(world),marked=context.floatingNear([changed.at]);
   if(!changed.removal)for(const at of context.unsupportedNear(changed.at))marked.add(at);
   if(!marked.size)continue;
   const cells=[...marked].map(at=>({at,kind:roofKindAt(world,at)!})),vanished=new Set<number>();
   // Voluntary removal quietly removes only the vanish-on-collapse types.
   // A flying thick roof still takes the actual damaging collapse branch.
   for(const cell of cells){
    const thick=cell.kind==='natural-thick';
    if(!changed.removal||thick){
     damageNaturalRoofCell256(world,cell.at,thick);
     if(thick){
      for(const f of [...(world.filth?.items??[])])if(roofIndex(world,f)===cell.at)removeFilth(world,f);
      placeCollapsedRock256(world,cell.at);
     }
     count++;
    }
    if(!thick)vanished.add(cell.at);
   }
   const state=world.roofing!,natural=state.natural!;
   if(vanished.size)setNaturalRoofCoverage256(world,state.constructed.filter(i=>!vanished.has(i)),natural.thin.filter(i=>!vanished.has(i)),natural.thick);
   // Phase two follows phase one for ALL selected cells; newly spawned rock
   // is already impassable, so the shared filth producer spills legitimately.
   for(const cell of cells)if(!changed.removal||cell.kind==='natural-thick')addFilth(world,{x:cell.at%world.width,z:Math.floor(cell.at/world.width)},cell.kind==='constructed'?'building-rubble':'rock-rubble');
   for(const at of vanished)work.push({at,removal:changed.removal});
   for(const at of transaction.pending.splice(0))work.push({at:roofIndex(world,at),removal:false});
  }
 } finally {naturalCollapseTransactions.delete(world);}
 if(count){world.events.push({tick:world.tick,type:'job',message:`Effondrement : ${count} case(s) de toit sans support.`});if(world.events.length>80)world.events.splice(0,world.events.length-80);}
 reconcileRoofJobs(world);return count;
}


/** Skyfaller standard 1x1 HitRoof at its real Core frontier. The centre is
 * unconditional; the expanded neighbours are filtered again on EACH pass,
 * like the deferred Core enumerable. Supports do not suppress the centre.
 * A false result has no physical/ID/RNG effect; caller must keep its holder
 * pending and must not mark hasHitRoof or spawn the arriving owner. */
export function hitSkyfallerRoof256(world:World,cell:Cell,atCore:number):boolean {
 if(world.schemaVersion<256||!Number.isSafeInteger(atCore)||(isCorePhysicalSchema297(Number(world.schemaVersion))?atCore!==effectiveCore297(world):atCore<Math.max(0,(world.tick-1)*10)||atCore>world.tick*10)
  ||!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)return false;
 const center=roofIndex(world,cell);
 // Core does not punch neighbouring roofs when the occupied rect has none.
 if(!roofKindAt(world,center))return true;
 try{
  const projection=roofCollapseProjection256(world),draft=projection.view,hadNatural=!!draft.roofing!.natural;
  draft.roofing!.natural??={thin:[],thick:[]};
  const transaction:CollapseTransaction={pending:[]};naturalCollapseTransactions.set(draft,transaction);
  const cells:number[]=[];for(let z=cell.z-1;z<=cell.z+1;z++)for(let x=cell.x-1;x<=cell.x+1;x++)if(x>=0&&z>=0&&x<draft.width&&z<draft.height)cells.push(z*draft.width+x);
  const spawnedPawnAt=(index:number):boolean=>{
   const at=(a:Parameters<typeof roofPhysicalCell256>[1])=>roofIndex(draft,roofPhysicalCell256(draft,a))===index;
   return draft.pawns.some(p=>p.body?.pileId===undefined&&p.body?.lostAt===undefined&&!carrierOf(draft,p.id)&&at(p))
    ||!!draft.wildlife?.animals.some(a=>!animalCarrier(draft,a.id)&&at(a))
    ||!!draft.mechanoids?.some(at);
  };
  const selected=(index:number)=>index===center||!spawnedPawnAt(index)&&!new RoofContext(draft).holds(index);
  let count=0;const vanished:number[]=[];
  try{
   for(const index of cells){
    const kind=roofKindAt(draft,index);if(!kind||!selected(index))continue;
    const thick=kind==='natural-thick';damageNaturalRoofCell256(draft,index,thick,atCore);
    if(thick){for(const f of [...(draft.filth?.items??[])])if(roofIndex(draft,f)===index)removeFilth(draft,f);placeCollapsedRock256(draft,index);}
    count++;
   }
   // The live predicate matters: a newly spawned neighbouring CollapsedRocks
   // now holds a roof, so it is excluded from this second enumeration.
   for(const index of cells){
    const kind=roofKindAt(draft,index);if(!kind||!selected(index))continue;
    addFilth(draft,{x:index%draft.width,z:Math.floor(index/draft.width)},kind==='constructed'?'building-rubble':'rock-rubble');
    if(kind!=='natural-thick'){const state=draft.roofing!;setNaturalRoofCoverage256(draft,state.constructed.filter(i=>i!==index),state.natural!.thin.filter(i=>i!==index),state.natural!.thick);vanished.push(index);}
   }
  }finally{naturalCollapseTransactions.delete(draft);}
  for(const at of transaction.pending)executeNaturalRoofSupport256(draft,false,at);
  for(const index of vanished)executeNaturalRoofSupport256(draft,true,{x:index%draft.width,z:Math.floor(index/draft.width)});
  // A real forced action on an old constructed-only map does not grant it
  // natural roof history or change the later historical support producer.
  if(!hadNatural&&!draft.roofing!.natural!.thin.length&&!draft.roofing!.natural!.thick.length)delete draft.roofing!.natural;
  if(count){draft.events.push({tick:draft.tick,type:'job',message:`Toit traversé : ${count} case(s) endommagée(s).`});if(draft.events.length>80)draft.events.splice(0,draft.events.length-80);}
  reconcileRoofJobs(draft);return projection.finish().adopt();
 }catch{return false;}
}
