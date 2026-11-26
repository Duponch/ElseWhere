import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {markFrameGeometryChanged379} from './frame-geometry-379.ts';
import {pileById,splicePileEntries,appendPileEntries} from './pile-identity-directory.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {carryStackLimit379} from './carry-quantity-379.ts';
import {constructionCapacity} from './construction-materials.ts';
import {constructionJobAllowed379} from './construction-state-379.ts';
import {constructionSiteFree,isConstruction} from './construction-rules.ts';
import {footprintCells} from './definitions.ts';
import {withoutQueuedOrder} from './haul-reservations.ts';
import {hasTravellingCargo} from './interrupted-cargo.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {caveRadialPattern256} from './local-cave-radial-256.ts';
import {refreshStock,reservedSource,transferPile,createSourceReservationRead379} from './materials.ts';
import {captureOrderedWorkClaims378,orderedJobClaimed378} from './ordered-work-claims-378.ts';
import {adjacent,routeToJob,workNeighbours,type Reachability} from './pathfinding.ts';
import {assignPileOwner} from './pile-index.ts';
import {copyPileCondition} from './pile-condition.ts';
import {commitConstructionPlantRetirement,planConstructionPlantRetirement} from './plant-retirement.ts';
import {woodWallTouch301} from './wall-frame-kind-301.ts';
import {releaseAssignments,releaseWork} from './work-release.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {haulingWork} from './work-types.ts';
import type {Cell,HaulTask,Job,MaterialPile,Pawn,World} from './types.ts';

/** Only remaining allocations are saved. A pickup may already own one cargo;
 * the other sources remain physical ground stacks until it reaches them. */
export interface ConstructionBatch379 {
 item:ItemId;
 sources:{pileId:number;quantity:number}[];
 destinations:{jobId:number;quantity:number}[];
}
const distance2=(a:Cell,b:Cell)=>(a.x-b.x)**2+(a.z-b.z)**2;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
let radialOrder:ReadonlyMap<string,number>|undefined;
function radialRank(center:Cell,target:Cell):number {
 if(!radialOrder){const pattern=caveRadialPattern256(8),order=new Map<string,number>();for(let i=0;i<pattern.count;i++){const [x,z]=pattern.offsets[i]!;order.set(`${x}:${z}`,i);}radialOrder=order;}
 return radialOrder.get(`${target.x-center.x}:${target.z-center.z}`)??Infinity;
}
const int=(n:unknown,min=1,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const data=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>{
 const d=Object.getOwnPropertyDescriptor(v,k);return typeof k==='string'&&(required.includes(k)||optional.includes(k))&&d?.enumerable===true&&Object.hasOwn(d,'value');
});
const rows=(v:unknown):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1
 &&Reflect.ownKeys(v).every(k=>k==='length'||typeof k==='string'&&/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<v.length&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const simple=(p:MaterialPile)=>!['ai-core','book','plant','corpse','mech-corpse','unfinished','weapon','apparel'].includes(p.kind);
/** Deliberately conservative: no mixing different damage, rot or biological
 * conditions without an existing merge rule. Equal conditions need no draw. */
const compatible=(a:MaterialPile,b:MaterialPile)=>a.item===b.item&&a.kind===b.kind&&JSON.stringify(copyPileCondition(a))===JSON.stringify(copyPileCondition(b));
const eligibleJob=(w:World,p:Pawn,j:Job)=>isConstruction(j)&&j.kind!=='install'&&!j.clearance&&constructionJobAllowed379(j)
 &&allowedAreaAllows(w,p,j)&&constructionSiteFree(w,j,p.id);

export function constructionBatchSourceQuantity379(task:HaulTask,pileId:number):number {
 return task.constructionBatch379?.sources.find(s=>s.pileId===pileId)?.quantity??0;
}
export function constructionBatchDestinationQuantity379(task:HaulTask,jobId:number):number {
 return task.constructionBatch379?.destinations.find(d=>d.jobId===jobId)?.quantity??0;
}

/** The ordinary producer chooses the first source and first construction.
 * Extend that real trip locally; no reservation, path or World field changes. */
export function planConstructionBatch379(w:World,p:Pawn,initial:HaulTask,reach:Reachability):HaulTask {
 if(Number(w.schemaVersion)<379||initial.constructionBatch379||initial.whole||initial.eggBox374!==undefined||initial.phase!=='pickup'||initial.carryPileId!==null||initial.destination.type!=='job')return initial;
 const targetId=initial.destination.jobId;
 const first=pileById(w,initial.sourcePileId),job=w.jobs.find(j=>j.id===targetId);
 if(!first||first.owner.type!=='ground'||!simple(first)||!materialAllowedForPlayer256(first)||!job||!eligibleJob(w,p,job))return initial;
 const limit=carryStackLimit379(w,p,first.item);if(limit<1)return initial;
 const claims=captureOrderedWorkClaims378(w,p.id);if(orderedJobClaimed378(claims,job))return initial;
 const sources=[first,...w.piles.filter(s=>s!==first&&s.owner.type==='ground'&&distance2(first.owner as Cell,s.owner)>0&&distance2(first.owner as Cell,s.owner)<=25&&simple(s)&&compatible(first,s)&&materialAllowedForPlayer256(s)&&allowedAreaAllows(w,p,s.owner))
  .sort((a,b)=>radialRank(first.owner as Cell,a.owner as Cell)-radialRank(first.owner as Cell,b.owner as Cell)||a.id-b.id)];
 const available:{pileId:number;quantity:number}[]=[];let supply=0;
 const reserved=sources.length>1?createSourceReservationRead379(w,sources.map(s=>s.id)):undefined;
 for(const source of sources){
  if(source.owner.type!=='ground'||!allowedAreaAllows(w,p,source.owner))continue;
  const quantity=Math.min(limit-supply,Math.max(0,source.quantity-(reserved?reserved(source.id):reservedSource(w,source.id))));
  if(!quantity||routeToJob(w,source.owner,reach,true)===null)continue;
  available.push({pileId:source.id,quantity});supply+=quantity;if(supply===limit)break;
 }
 if(!available.length||available[0]!.pileId!==first.id)return initial;
 const jobs=[job,...w.jobs.filter(j=>j!==job&&distance2(job,j)<=64&&eligibleJob(w,p,j)&&!orderedJobClaimed378(claims,j))
  .sort((a,b)=>radialRank(job,a)-radialRank(job,b)||a.id-b.id)];
 const destinations:ConstructionBatch379['destinations']=[];let quantity=0;
 for(const target of jobs){
  const amount=Math.min(supply-quantity,constructionCapacity(w,target,first.item));
  if(!amount||routeToJob(w,target,reach,false)===null)continue;
  destinations.push({jobId:target.id,quantity:amount});quantity+=amount;if(quantity===supply)break;
 }
 if(!destinations.length||destinations[0]!.jobId!==job.id)return initial;
 let remaining=quantity;
 const allocations:ConstructionBatch379['sources']=[];
 for(const source of available){const amount=Math.min(remaining,source.quantity);if(amount)allocations.push({pileId:source.pileId,quantity:amount});remaining-=amount;if(!remaining)break;}
 if(allocations.length===1&&destinations.length===1)return quantity===initial.quantity?initial:{...initial,quantity};
 return {...initial,quantity,constructionBatch379:{item:first.item,sources:allocations,destinations}};
}

/** Descriptor-safe nested admission, also usable before Pawn reconstruction. */
export function validConstructionBatchShape379(raw:unknown,version:number):boolean {
 if(!raw||typeof raw!=='object')return false;
 const descriptor=Object.getOwnPropertyDescriptor(raw,'constructionBatch379');
 if(!descriptor)return !('constructionBatch379' in raw);
 if(version<379||descriptor.enumerable!==true||!Object.hasOwn(descriptor,'value')||!plain(raw)||!data(raw,['sourcePileId','quantity','phase','destination','carryPileId','constructionBatch379'],['pickupCell']))return false;
 const b=descriptor.value,d=raw.destination;
 if(!plain(b)||!data(b,['item','sources','destinations'])||typeof b.item!=='string'||!Object.hasOwn(ITEM_DEFINITIONS,b.item)
  ||!rows(b.sources)||!rows(b.destinations)||b.sources.length>500||!b.destinations.length||b.destinations.length>500
  ||!int(raw.sourcePileId)||!int(raw.quantity,1,ITEM_DEFINITIONS[b.item as ItemId].stackLimit)
  ||!['pickup','deliver'].includes(String(raw.phase))||raw.carryPileId!==null&&!int(raw.carryPileId)
  ||!plain(d)||!data(d,['type','jobId'],['forConstruction'])||d.type!=='job'||!int(d.jobId)||Object.hasOwn(d,'forConstruction')&&typeof d.forConstruction!=='boolean')return false;
 if(Object.hasOwn(raw,'pickupCell')){const c=raw.pickupCell;if(!plain(c)||!data(c,['x','z'])||!int(c.x,0)||!int(c.z,0))return false;}
 const sources=new Set<number>(),destinations=new Set<number>();let sourceQuantity=0,destinationQuantity=0;
 for(const s of b.sources){if(!plain(s)||!data(s,['pileId','quantity'])||!int(s.pileId)||!int(s.quantity,1,500)||sources.has(s.pileId))return false;sources.add(s.pileId);sourceQuantity+=s.quantity;}
 for(const target of b.destinations){if(!plain(target)||!data(target,['jobId','quantity'])||!int(target.jobId)||!int(target.quantity,1,500)||destinations.has(target.jobId))return false;destinations.add(target.jobId);destinationQuantity+=target.quantity;}
 if(destinationQuantity!==raw.quantity||d.jobId!==(b.destinations[0] as Record<string,unknown>).jobId)return false;
 return raw.phase==='pickup'?b.sources.length>0&&raw.sourcePileId===(b.sources[0] as Record<string,unknown>).pileId&&sourceQuantity<=raw.quantity&&(raw.carryPileId===null?sourceQuantity===raw.quantity:sourceQuantity<raw.quantity)
  :!b.sources.length&&raw.carryPileId!==null;
}

/** Durable owners and exact outstanding claims. Current injury, danger and
 * changed stack conditions are runtime interruptions, never load-time repair. */
export function validConstructionBatchTask379(w:World,p:Pawn,task:HaulTask,version:number,queued=false):boolean {
 try{
  if(!validConstructionBatchShape379(task,version))return false;
  const b=task.constructionBatch379;if(!b)return true;
  if(queued&&(task.phase!=='pickup'||task.carryPileId!==null))return false;
  const view=p.orders.queue.includes(task)?withoutQueuedOrder(w,task):w;
  const exceptPawn=queued?undefined:p.id;
  const carry=task.carryPileId===null?undefined:pileById(w,task.carryPileId);
  if(carry&&(!simple(carry)||carry.owner.type!=='pawn'||carry.owner.pawnId!==p.id||carry.item!==b.item)||task.carryPileId!==null&&!carry)return false;
  if(task.phase==='pickup'&&b.sources.reduce((n,s)=>n+s.quantity,0)+(carry?.quantity??0)!==task.quantity||task.phase==='deliver'&&carry?.quantity!==task.quantity)return false;
  if(!queued&&p.haul===task&&(w.piles.filter(s=>s.owner.type==='pawn'&&s.owner.pawnId===p.id).length!==(carry?1:0)||w.packed.some(s=>s.owner.type==='pawn'&&s.owner.pawnId===p.id)))return false;
  const reserved=b.sources.length>1?createSourceReservationRead379(view,b.sources.map(s=>s.pileId),exceptPawn):undefined;
  for(const s of b.sources){const source=pileById(w,s.pileId);if(!source||!simple(source)||!materialAllowedForPlayer256(source)||source.item!==b.item||source.owner.type!=='ground'||source.quantity-(reserved?reserved(source.id):reservedSource(view,source.id,exceptPawn))<s.quantity)return false;}
  for(const d of b.destinations){const job=w.jobs.find(j=>j.id===d.jobId);if(!job||!isConstruction(job)||job.kind==='install'||!constructionJobAllowed379(job)||constructionCapacity(view,job,b.item,exceptPawn)<d.quantity)return false;}
  return true;
 }catch{return false;}
}
export function validateConstructionBatches379(w:World,version:number):string[] {
 const errors:string[]=[];
 for(const p of w.pawns){
  if(p.haul&&!validConstructionBatchTask379(w,p,p.haul,version))errors.push('Invalid construction batch ownership.');
  for(const task of p.orders.queue)if(typeof task==='object'&&task!==null&&'sourcePileId' in task&&!validConstructionBatchTask379(w,p,task,version,true))errors.push('Invalid queued construction batch ownership.');
 }
 return errors;
}
export function queuedConstructionBatchReason379(w:World,task:HaulTask,p:Pawn):string|undefined {
  return validConstructionBatchTask379(withoutQueuedOrder(w,task),p,task,Number(w.schemaVersion),true)&&targetsAvailable(w,p,task)?undefined:'Les piles ou les chantiers de ce transport ne sont plus disponibles.';
}
export function startConstructionBatch379(p:Pawn,task:HaulTask,path:Cell[]):void {
 p.haul=task;p.orders.active='haul';p.path=path;p.planCooldown=0;p.state=path.length||p.moveCooldown>0?'moving':'working';
}
function stop(w:World,p:Pawn):void {
 if(hasTravellingCargo(w,p)){releaseAssignments(w,p);p.interruptedCargo=true;p.planCooldown=0;}
 else if(!releaseWork(w,p)){releaseAssignments(w,p);p.interruptedCargo=true;p.planCooldown=1+p.id%20;}
 delete p.priorityWork;
}
function settle(p:Pawn):void {p.path=[];p.planCooldown=0;p.state='working';}
function deliverHeld(task:HaulTask,quantity:number):void {
 const b=task.constructionBatch379!;let remaining=quantity;
 const destinations:ConstructionBatch379['destinations']=[];
 for(const d of b.destinations){const take=Math.min(remaining,d.quantity);if(take)destinations.push({jobId:d.jobId,quantity:take});remaining-=take;if(!remaining)break;}
 b.sources=[];b.destinations=destinations;markPileContentWrite379(task).quantity=quantity;task.phase='deliver';
}
function targetsAvailable(w:World,p:Pawn,task:HaulTask):boolean {
 const b=task.constructionBatch379!;
 for(const d of b.destinations){const job=w.jobs.find(j=>j.id===d.jobId);if(!job||!constructionJobAllowed379(job)||!allowedAreaAllows(w,p,job))return false;}
 for(const s of b.sources){const source=pileById(w,s.pileId);if(!source||source.owner.type!=='ground'||!materialAllowedForPlayer256(source)||!allowedAreaAllows(w,p,source.owner))return false;}
 return true;
}
/** Commands can destroy or forbid a secondary target while paused. Release
 * all outstanding claims immediately; physical cargo follows normal dropping
 * and retains its captured edge if it is still travelling. */
export function reconcileConstructionBatches379(w:World):void {
 if(Number(w.schemaVersion)<379)return;
 for(const p of w.pawns){
  const task=p.haul;
  if(task?.constructionBatch379&&(!validConstructionBatchTask379(w,p,task,Number(w.schemaVersion))||!targetsAvailable(w,p,task)))stop(w,p);
  for(let i=p.orders.queue.length-1;i>=0;i--){const queued=p.orders.queue[i];if(typeof queued==='object'&&queued!==null&&'sourcePileId' in queued&&queued.constructionBatch379
   &&(!validConstructionBatchTask379(w,p,queued,Number(w.schemaVersion),true)||!targetsAvailable(w,p,queued)))p.orders.queue.splice(i,1);}
 }
}
function contact(w:World,p:Pawn,job:Job):boolean {
 const cells=footprintCells(job),touch=woodWallTouch301(w,job);
 return !cells.some(c=>same(p,c))&&cells.some(c=>touch?workNeighbours(c,undefined,true).some(n=>same(n,p)):adjacent(p,c));
}
/** Each call performs at most one real pickup or one real delivery. Movement
 * and the captured edge always finish before quantities or owners change. */
export function processConstructionBatch379(w:World,p:Pawn,move:(target:Cell,allowTarget:boolean)=>void,wake:()=>void):void {
 const task=p.haul,b=task?.constructionBatch379;if(!task||!b)return;
 if(!validConstructionBatchTask379(w,p,task,Number(w.schemaVersion))||backgroundWorkRefusal(p,haulingWork(task.destination))){stop(w,p);return;}
 if(!targetsAvailable(w,p,task)){stop(w,p);return;}
 if(task.phase==='pickup'){
  const allocation=b.sources[0]!,source=pileById(w,allocation.pileId)!;
  const carry=task.carryPileId===null?undefined:pileById(w,task.carryPileId)!;
  if(!materialAllowedForPlayer256(source)||!allowedAreaAllows(w,p,source.owner as Cell)||carry&&!compatible(carry,source)){stop(w,p);return;}
  const room=Math.max(0,carryStackLimit379(w,p,b.item)-(carry?.quantity??0));
  if(!room){if(carry){deliverHeld(task,carry.quantity);p.path=[];p.planCooldown=0;p.state=(p.motion?.end??0)>w.tick?'moving':'working';}else stop(w,p);return;}
  if(!same(p,source.owner as Cell)&&!adjacent(p,source.owner as Cell)){move(source.owner as Cell,true);return;}
  if((p.motion?.end??0)>w.tick||p.moveCooldown>0)return;
  const quantity=Math.min(allocation.quantity,room);
  if(!carry&&quantity<source.quantity&&(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1))){stop(w,p);return;}
  task.pickupCell={x:(source.owner as Cell).x,z:(source.owner as Cell).z};
  if(carry){markPileContentWrite379(carry).quantity+=quantity;markPileContentWrite379(source).quantity-=quantity;if(!source.quantity)splicePileEntries(w.piles,w.piles.indexOf(source),1);}
  else if(quantity===source.quantity){assignPileOwner(source,{type:'pawn',pawnId:p.id});task.carryPileId=source.id;}
  else{markPileContentWrite379(source).quantity-=quantity;const id=w.nextId++;appendPileEntries(w.piles,{id,kind:source.kind,item:source.item,quantity,owner:{type:'pawn',pawnId:p.id},...copyPileCondition(source)});task.carryPileId=id;}
  if(quantity<allocation.quantity||task.quantity>carryStackLimit379(w,p,b.item))deliverHeld(task,(carry?.quantity??quantity));
  else{b.sources.shift();if(b.sources.length)task.sourcePileId=b.sources[0]!.pileId;else task.phase='deliver';}
  settle(p);refreshStock(w);return;
 }
 const allocation=b.destinations[0]!,job=w.jobs.find(j=>j.id===allocation.jobId)!,carry=pileById(w,task.carryPileId)!;
 if(!contact(w,p,job)){move(job,false);return;}
 if((p.motion?.end??0)>w.tick||p.moveCooldown>0)return;
 if(!constructionSiteFree(w,job,p.id)){stop(w,p);return;}
 const quantity=allocation.quantity;
 if(quantity<carry.quantity&&(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1))){stop(w,p);return;}
 if(job.kind!=='lay-floor'){
  const retirement=planConstructionPlantRetirement(w,job,job.id,'frame');
  if(!retirement||retirement.actors.has(p.id)||!commitConstructionPlantRetirement(w,retirement)){settle(p);return;}
 }
 if(quantity===carry.quantity){if(!transferPile(w,carry,{type:'job',jobId:job.id})){stop(w,p);return;}}
 else{
  const id=w.nextId++,part:MaterialPile={id,kind:carry.kind,item:carry.item,quantity,owner:{type:'pawn',pawnId:p.id},...copyPileCondition(carry)};
  markPileContentWrite379(carry).quantity-=quantity;appendPileEntries(w.piles,part);
  if(!transferPile(w,part,{type:'job',jobId:job.id})){markPileContentWrite379(carry).quantity+=quantity;splicePileEntries(w.piles,w.piles.indexOf(part),1);w.nextId=id;stop(w,p);return;}
 }
 job.construction='frame';markFrameGeometryChanged379(w);b.destinations.shift();markPileContentWrite379(task).quantity-=quantity;refreshStock(w);
 if(b.destinations.length){task.destination={...task.destination,jobId:b.destinations[0]!.jobId} as HaulTask['destination'];settle(p);return;}
 p.haul=null;if(p.orders.active==='haul')p.orders.active=null;p.path=[];p.state='idle';p.planCooldown=0;wake();
}
