import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {readingAllowed295,readingAutoNeeds295,readingDuration295,effectiveReadingPolicy295,type ReadingTask295} from './reading-state-295.ts';
import {isColonist} from './affiliation.ts';
import {pawnBody} from './health-rules.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {knownCell256} from './exploration-visibility-256.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {reservedSource} from './materials.ts';
import {readingBook295,readingPile295,readingSourceAllowed295,readingPickupCandidates295,readingTaskSiteValid295,chooseReadingPlace295,chooseReadingStorage295} from './reading-space-295.ts';
import {novelJoyFactor295} from './book-state-295.ts';
import {gainRecreation,RECREATION_GAIN} from './recreation-rules.ts';
import {assignmentAt} from './schedule.ts';
import {allowedAreaRecreationAllowed} from './allowed-area-services.ts';
import {urgentMedicalTask} from './urgent-care.ts';
import {releaseWork} from './work-release.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {carrierOf} from './rescue-state.ts';
import {transferPile} from './materials.ts';
import {storageAt} from './shelf-storage.ts';
import {storageCapacity} from './ground-placement.ts';
import {learnSkill,XP_SCALE} from './skills.ts';
import {rememberRoomUse} from './room-experience.ts';
import {cellIndex,routeToCell} from './pathfinding.ts';
import type {NeedContext} from './needs.ts';
import type {CommandResult,MaterialPile,Pawn,World} from './types.ts';

export {readingBook295} from './reading-space-295.ts';
/** Pure inspection uses the same admission as the command, with no search,
 * reservation write, random draw or policy/task adoption. */
export function readingRefusal295(world:World,pawn:Pawn,book:MaterialPile,manual=true):string|null {
 if((Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion))))||!world.pawns.includes(pawn)||!isColonist(pawn)||pawn.prisoner||pawn.visitor)return 'Lecteur indisponible.';
 if(carrierOf(world,pawn.id))return 'Ce colon est encore porté.';
 // Do not reveal a hidden, away or foreign item's content through a refusal.
 if(readingPile295(world,book.id)!==book||book.owner.type==='ground'&&!knownCell256(world,cellIndex(world,book.owner.x,book.owner.z))
  ||book.owner.type!=='ground'&&(!manual||(book.owner.type!=='pawn'&&book.owner.type!=='inventory')||book.owner.pawnId!==pawn.id))return 'Livre indisponible.';
 if(!materialAllowedForPlayer256(book))return 'Livre interdit.';
 if(book.owner.type==='ground'&&!allowedAreaAllows(world,pawn,book.owner))return 'Livre hors de la zone autorisée.';
 if(reservedSource(world,book.id,pawn.id)>0)return 'Livre déjà réservé.';
 if(pawn.draft)return 'Colon mobilisé.';
 const body=pawnBody(pawn);
 if(body.capacities.sight<=0)return 'La lecture demande la vue.';
 if(body.capacities.manipulation<=0)return 'La lecture demande la manipulation.';
 if(pawn.interruptedCargo)return 'Le chargement actuel doit être posé.';
 if((pawn.motion?.end??0)>world.tick)return 'Le déplacement en cours doit se terminer.';
 if(!manual&&effectiveReadingPolicy295(pawn)===2)return 'La politique interdit la lecture automatique.';
 if(!readingAllowed295(pawn,manual)||!readingSourceAllowed295(world,pawn,book,manual))return 'Lecture indisponible.';
 if(!manual&&!readingAutoNeeds295(pawn))return 'La faim ou le repos demande une pause.';
 return null;
}
const same=(a:{x:number;z:number},b:{x:number;z:number}):boolean=>a.x===b.x&&a.z===b.z;
const near=(a:{x:number;z:number},b:{x:number;z:number}):boolean=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
const stop=(world:World,pawn:Pawn):false=>{interruptWork(world,pawn,true);return false;};
const finishDrop=(world:World,pawn:Pawn,context:NeedContext):void=>{if(!context.release())interruptWork(world,pawn,true);};
function moveReading(world:World,pawn:Pawn,context:NeedContext,target:{x:number;z:number},exact:boolean):boolean {
 if(!pawn.path.length){
  const goals=exact?[target]:[{...target},{x:target.x-1,z:target.z},{x:target.x+1,z:target.z},{x:target.x,z:target.z-1},{x:target.x,z:target.z+1}];
  const reach=context.search(new Set(goals.filter(c=>c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height).map(c=>cellIndex(world,c.x,c.z))));if(!reach)return true;
  const paths=goals.flatMap(c=>{const path=routeToCell(world,c,reach);return path?[path]:[];}).sort((a,b)=>a.length-b.length);
  if(!paths.length)return stop(world,pawn);pawn.path=paths[0]!;
 }
 context.move(target,exact);return true;
}
const awaiting=(pawn:Pawn,task:ReadingTask295,stage:'seat'|'return'):void=>{
 task.stage=stage;task.phase='active';task.target={x:pawn.x,z:pawn.z};task.buildingId=null;delete task.seatId;pawn.path=[];pawn.state='idle';pawn.planCooldown=0;
};
/** Shared weighted joy decision has already selected an actual reachable book. */
export function beginReading295(world:World,pawn:Pawn,bookId:number,manual=false):string|null {
 if((Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion))))||!world.pawns.includes(pawn)||carrierOf(world,pawn.id)||!readingAllowed295(pawn,manual)||!manual&&!readingAutoNeeds295(pawn))return 'Lecture indisponible.';
 const pile=readingPile295(world,bookId);if(!pile||!readingSourceAllowed295(world,pawn,pile,manual))return 'Livre indisponible.';
 const candidates=readingPickupCandidates295(world,pawn,bookId);if(!candidates.length)return 'Livre inaccessible.';
 const chosen=candidates[0]!;if(!manual)delete chosen.manual;
 pawn.recreation.task=chosen;pawn.path=[];pawn.state='moving';pawn.planCooldown=0;pawn.needCooldown=0;return null;
}
/** Commands have their own local-information admission because dispatch occurs
 * before the generic hidden-target handler. Every refusal is content-neutral. */
export function applyReadBook295(world:World,pawnId:number,bookId:number):CommandResult {
 const pawn=world.pawns.find(p=>p.id===pawnId),pile=readingPile295(world,bookId);
 if(!pawn||!pile)return {ok:false,reason:'Lecture indisponible.'};
 const refusal=readingRefusal295(world,pawn,pile,true);if(refusal)return {ok:false,reason:refusal};
 if(!readingPickupCandidates295(world,pawn,bookId).length)return {ok:false,reason:'Livre inaccessible.'};
 if(!releaseWork(world,pawn))return {ok:false,reason:'Le chargement actuel ne peut pas être posé.'};
 clearQueuedOrders(world,pawn);delete pawn.priorityWork;
 const reason=beginReading295(world,pawn,bookId,true);return reason?{ok:false,reason}:{ok:true};
}
export function applyReadingPolicy295(world:World,pawnId:number,policyId:1|2):CommandResult {
 const pawn=world.pawns.find(p=>p.id===pawnId);
 if((Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion))))||!pawn||!isColonist(pawn)||pawn.prisoner||pawn.visitor||(policyId!==1&&policyId!==2))return {ok:false,reason:'Politique de lecture indisponible.'};
 pawn.readingPolicy295=policyId;
 if(policyId===2&&pawn.recreation.task?.activity==='read'&&!pawn.recreation.task.manual)interruptWork(world,pawn,true);
 return {ok:true};
}
/** This runs only for a real read task. Travel, deferred searches and storage
 * contribute neither joy nor XP nor passion; one MaterialPile remains owner. */
export function processReading295(world:World,pawn:Pawn,context:NeedContext):boolean {
 const task=pawn.recreation.task;if(task?.activity!=='read')return false;
 const manual=task.manual===true;
 if((Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion))))||carrierOf(world,pawn.id)||!readingAllowed295(pawn,manual)||urgentMedicalTask(pawn,world)||!manual&&(assignmentAt(world,pawn)==='work'||!readingAutoNeeds295(pawn))||!allowedAreaRecreationAllowed(world,pawn,task))return stop(world,pawn);
 const book=readingBook295(world,pawn,task);if(!book)return stop(world,pawn);
 // Logical arrival is ahead of the captured rendered edge. A held book cannot
 // be picked up, enjoyed or dropped at that future position during this edge.
 if((pawn.motion?.end??0)>world.tick){pawn.state='moving';return true;}
 if(task.stage==='pickup'){
  if(!readingSourceAllowed295(world,pawn,book,manual))return stop(world,pawn);
  if(book.owner.type==='ground'){
   if(!near(task.target,book.owner)||!readingTaskSiteValid295(world,task))return stop(world,pawn);
   if(!same(pawn,task.target))return moveReading(world,pawn,context,task.target,true);
  }
  if(!transferPile(world,book,{type:'pawn',pawnId:pawn.id}))return stop(world,pawn);
  awaiting(pawn,task,'seat');
 }
 if(task.stage==='seat'){
  if(task.phase==='active'){
   const selected=chooseReadingPlace295(world,pawn,context);if(!selected)return true;
   task.target=selected.target;task.buildingId=selected.buildingId;if(selected.seatId!==undefined)task.seatId=selected.seatId;else delete task.seatId;
   task.phase='travel';pawn.path=selected.path;pawn.state='moving';
  }
  if(!readingTaskSiteValid295(world,task)||!allowedAreaRecreationAllowed(world,pawn,task))return stop(world,pawn);
  if(!same(pawn,task.target))return moveReading(world,pawn,context,task.target,true);
  task.stage='read';task.phase='active';pawn.path=[];pawn.state='recreating';context.event(`${pawn.name} commence à lire un roman.`);
 }
 if(task.stage==='read'){
  if(!readingTaskSiteValid295(world,task)||!same(pawn,task.target))return stop(world,pawn);
  pawn.state='recreating';gainRecreation(pawn.recreation,'reading',RECREATION_GAIN*novelJoyFactor295(book.book!.quality));
  pawn.skills.intellectual??={level:0,xp:0,dailyXp:0,passion:0};learnSkill(pawn.skills.intellectual,XP_SCALE,pawn);
  task.elapsed++;
  if(task.elapsed<readingDuration295(task)&&(manual||pawn.recreation.level<99.99))return true;
  rememberRoomUse(world,pawn,'recreation');context.event(`${pawn.name} termine sa lecture.`);awaiting(pawn,task,'return');
 }
 if(task.stage==='return'){
  if(task.phase==='active'){
   const selected=chooseReadingStorage295(world,pawn,book,context);if(selected===null)return true;
   if(!selected){finishDrop(world,pawn,context);return true;}
   task.target=selected.target;task.phase='travel';pawn.path=selected.path;pawn.state='moving';
  }
  const storage=storageAt(world,task.target);
  if(!storage||storageCapacity(world,storage,book,pawn.id)<1){finishDrop(world,pawn,context);return true;}
  if(!near(pawn,task.target))return moveReading(world,pawn,context,task.target,false);
  if(!transferPile(world,book,{type:'ground',...task.target})){finishDrop(world,pawn,context);return true;}
  context.release();
 }
 return true;
}

/** The same shared search budget used by every ordinary recreation activity. */
export function selectAutomaticReading295(world:World,pawn:Pawn,context:NeedContext):boolean|'unavailable' {
 if((Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion))))||carrierOf(world,pawn.id)||!readingAllowed295(pawn)||!readingAutoNeeds295(pawn))return 'unavailable';
 const candidates=readingPickupCandidates295(world,pawn);if(!candidates.length)return 'unavailable';
 const reach=context.search(new Set(candidates.map(c=>cellIndex(world,c.target.x,c.target.z))));if(!reach)return true;
 const reachable=candidates.flatMap(task=>{const path=routeToCell(world,task.target,reach);return path?[{task,path}]:[];});
 reachable.sort((a,b)=>a.path.length-b.path.length||a.task.bookId-b.task.bookId||cellIndex(world,a.task.target.x,a.task.target.z)-cellIndex(world,b.task.target.x,b.task.target.z));
 if(!reachable.length)return 'unavailable';
 const selected=reachable[0]!;pawn.recreation.task=selected.task;pawn.path=selected.path;pawn.state='moving';pawn.planCooldown=0;return true;
}
