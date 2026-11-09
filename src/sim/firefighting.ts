import { workPriority } from './work-types.ts';
import { urgentWorkEnabled } from './urgent-care.ts';
import { rimWorkGiverOrder301 } from './work-givers-rimworld.ts';
import { allowedAreaAllows,allowedAreaReason,captureAllowedArea } from './allowed-area-state.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { isColonist,isPlayerPatient } from './affiliation.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { canStopAt,routeToCell,workNeighbours } from './pathfinding.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { workType } from './work-types.ts';
import { taskWork } from './production-recipes.ts';
import { haulingWork } from './haul-aside.ts';
import type { Reachability } from './pathfinding.ts';
import { inHome } from './repairs.ts';
import { isRoomDoor } from './door-rules.ts';
import { structureAnchors } from './structure-navigation.ts';
import { extinguishFire } from './fire.ts';
import { firePosition,ensureFireState,fireRandom,FIREFIGHT_COOLDOWN_CORE,type FireRecord } from './fire-rules.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,Pawn,World } from './types.ts';
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const distance=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
const inside=(w:World,c:Cell)=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;
// Structures anchored on the cell, from the shared anchor index: the same
// members as scanning every structure for its anchor position.
const solid=(w:World,c:Cell)=>!inside(w,c)||w.tiles[c.z*w.width+c.x]?.terrain==='rock'||structureAnchors(w).anchoredAt(c.x,c.z).some(s=>s.kind==='wall'||s.kind==='cooler'||isRoomDoor(s.kind)&&!s.door?.open);
/** The diagonal wall-fire fix in Core 1.6.4528 is retained, with no reach through a solid corner. */
export function fireTouch(w:World,actor:Cell,target:Cell):boolean {
  const dx=Math.abs(actor.x-target.x),dz=Math.abs(actor.z-target.z);if(dx>1||dz>1)return false;
  return !dx||!dz||!solid(w,{x:actor.x,z:target.z})&&!solid(w,{x:target.x,z:actor.z});
}
function allowed(w:World,p:Pawn,f:FireRecord,forced:boolean,policy=captureAllowedArea(w,p)):boolean {
  const cell=firePosition(w,f);if(cell&&policy&&!allowedAreaAllows(w,p,cell,policy))return false;
  if(f.attachedAnimalId!==undefined)return false; // Veterinary firefighting is not a colonist assignment in this slice.
  if(f.attachedPawnId!==undefined){const target=w.pawns.find(q=>q.id===f.attachedPawnId);return !!target&&target!==p&&isPlayerPatient(target)&&(forced||distance(p,target)<=15);}
  return forced||inHome(w,f.z*w.width+f.x);
}
export function applyExtinguish(w:World,command:{pawnId:number;fireId:number}):string|null {
  const p=w.pawns.find(p=>p.id===command.pawnId),f=w.fires?.items.find(f=>f.id===command.fireId);
  if(!p||!isColonist(p)||p.prisoner)return 'Seul un colon libre peut recevoir cet ordre.';
  const refusal=backgroundWorkRefusal(p,'firefight')??medicalWorkRefusal(p);if(refusal)return refusal;
  if(p.burning||p.mental?.crisis)return 'Ce colon ne peut pas suivre cet ordre maintenant.';
  const target=f&&firePosition(w,f),areaReason=target?allowedAreaReason(w,p,target):undefined;if(areaReason)return areaReason;
  if(!f||!allowed(w,p,f,true))return 'Le feu visé ne peut pas être éteint par ce colon.';
  const drops=planCommandDrops(w,{type:'order-extinguish',...command});if(!drops)return 'La cargaison doit être déposée avant cet ordre.';
  clearQueuedOrders(w,p);delete p.priorityWork;releaseWork(w,p,drops);
  p.firefighting={fireId:f.id,forced:true,phase:'approach',cooldownCore:0,spentCore:0};p.path=[];p.planCooldown=0;return null;
}
export function firefightingTargets(w:World,p:Pawn):FireRecord[] {
  if(!workPriority(p,'firefight')||p.burning||medicalWorkRefusal(p))return [];
  const policy=captureAllowedArea(w,p);
  return (w.fires?.items??[]).filter(f=>allowed(w,p,f,false,policy)&&!(distance(p,firePosition(w,f)!)>15&&w.pawns.some(q=>q!==p&&q.firefighting?.fireId===f.id)))
    .sort((a,b)=>distance(p,firePosition(w,a)!)-distance(p,firePosition(w,b)!)||a.id-b.id);
}
export interface FirefightingProposal {fireId:number;target:Cell;path:Cell[]}
export function firefightingProposal(w:World,p:Pawn,reach:Reachability):FirefightingProposal|undefined {
  const origin={x:reach.start%w.width,z:Math.floor(reach.start/w.width)};
  for(const f of firefightingTargets(w,p)){
    const target=firePosition(w,f)!;
    const cells=[target,...workNeighbours(target,'mine')]
      .filter(c=>inside(w,c)&&fireTouch(w,c,target)&&canStopAt(w,c,reach))
      .map((cell,index)=>({cell,index,minSteps:Math.max(Math.abs(origin.x-cell.x),Math.abs(origin.z-cell.z))}))
      .sort((a,b)=>a.minSteps-b.minSteps||a.index-b.index);
    let best:{path:Cell[];index:number}|undefined;
    for(const {cell,index,minSteps} of cells){
      // Eight-neighbour travel cannot use fewer than minSteps edges. The old
      // stable sort chose the earliest cell when paths had equal lengths.
      if(best&&(minSteps>best.path.length||minSteps===best.path.length&&index>best.index))continue;
      const path=routeToCell(w,cell,reach);
      if(path!==null&&(!best||path.length<best.path.length||path.length===best.path.length&&index<best.index))best={path,index};
    }
    if(best)return {fireId:f.id,target:{x:target.x,z:target.z},path:best.path};
  }
  return undefined;
}
export function startFirefighting(p:Pawn,proposal:FirefightingProposal):void {
  p.firefighting={fireId:proposal.fireId,forced:false,phase:'approach',cooldownCore:0,spentCore:0};p.path=proposal.path;p.state=p.path.length?'moving':'working';p.planCooldown=0;
}
function currentPriority(w:World,p:Pawn):number|null {
  const job=w.jobs.find(j=>j.id===p.jobId);
  const work=job?workType(job):p.deepWork?(p.deepWork.kind==='drill'?'mine':'research'):p.research?'research':p.cooking?taskWork(p.cooking):p.haul?haulingWork(p.haul.destination):p.ward?'warden':p.tend||p.feed||p.rescue?'doctor':p.hunting?'hunt':p.need?.kind==='sleep'&&p.need.medical==='patient'?'patient':null;
  return work?workPriority(p,work):null;
}
/** Emergency interruption compares actual running work; idle work uses the common planner.
 * A forced existing order keeps its authority; explicit extinguish replaces it. */
export function processFirefighting(w:World,p:Pawn,context:NeedContext):boolean {
  if(!w.fires?.items.length)return false;
  if(backgroundWorkRefusal(p,'firefight')||!isColonist(p)||p.prisoner||p.burning||medicalWorkRefusal(p)||p.mental?.crisis||p.interruptedCargo){delete p.firefighting;return false;}
  let task=p.firefighting;
  if(!task){
    if(p.orders.active!==null||p.orders.queue.length||p.flee||p.melee||p.shooting||p.hunger<=0||p.rest<=0)return false;
    const current=currentPriority(w,p),priority=workPriority(p,'firefight');
    // Ordinary idle work is ranked by planWork. This is only a running-task
    // interruption or the separate drafted contact reflex. In the schema 301
    // family an idle colonist whose firefighting is on Core's emergency list
    // fights fires before eating (short of starvation), sleeping or relaxing,
    // as JobGiver_Work(emergency) comes before those needs in Humanlike.
    if(!priority||!p.draft&&(current===null?!urgentWorkEnabled(p,'firefight',w)||!rimWorkGiverOrder301(Number(w.schemaVersion)):current<priority))return false;
    const fires=firefightingTargets(w,p).filter(f=>!p.draft||fireTouch(w,p,firePosition(w,f)!));if(!fires.length)return false;
    const reach=context.search(new Set(fires.flatMap(f=>{const c=firePosition(w,f)!;return [c,...workNeighbours(c,'mine')].filter(v=>inside(w,v)&&fireTouch(w,v,c)).map(c=>c.z*w.width+c.x);})));if(!reach)return false;
    const proposal=firefightingProposal(w,p,reach);if(!proposal||p.draft&&!fireTouch(w,p,proposal.target))return false;
    interruptWork(w,p);if(p.interruptedCargo)return false;
    startFirefighting(p,proposal);task=p.firefighting!;
  }
  const fire=w.fires.items.find(f=>f.id===task.fireId),target=fire&&firePosition(w,fire);
  if(!fire||!target||!allowed(w,p,fire,task.forced)||!task.forced&&!workPriority(p,'firefight')||task.spentCore>=36000){delete p.firefighting;p.path=[];p.planCooldown=0;return false;}
  if(p.moveCooldown>0)return true;
  if(!fireTouch(w,p,target)){
    task.phase='approach';
    if(!p.path.length){
      const spots=[target,...workNeighbours(target,'mine')].filter(c=>inside(w,c)&&fireTouch(w,c,target));
      const reach=context.search(new Set(spots.map(c=>c.z*w.width+c.x)));if(!reach)return true;
      const paths=spots.filter(c=>canStopAt(w,c,reach)).map(c=>routeToCell(w,c,reach)).filter((path):path is Cell[]=>path!==null).sort((a,b)=>a.length-b.length);
      if(!paths.length){delete p.firefighting;p.planCooldown=20;return false;}p.path=paths[0]!;
    }
    const end=p.path.at(-1);if(end)context.move(end,true);return true;
  }
  p.path=[];p.state='working';task.phase='beat';task.spentCore+=10;
  if(w.tick*10>fire.bornCore&&w.tick*10>=task.cooldownCore){task.cooldownCore=w.tick*10+FIREFIGHT_COOLDOWN_CORE;extinguishFire(w,fire.id,32);}
  return true;
}
/** Shared decision shape: self-beating takes 150 Core ticks; otherwise sprint
 * to a bounded reachable cell, then wait 5..10 Core before deciding again. */
export function processBurning(w:World,p:Pawn,context:NeedContext):boolean {
  const fire=w.fires?.items.find(f=>f.attachedPawnId===p.id);if(!fire){delete p.burning;return false;}
  if(p.state==='dead'||p.state==='downed')return true;
  const reaction=p.burning??={phase:'panic',remainingCore:0};
  if(p.moveCooldown>0)return true;
  if(reaction.phase==='extinguish'){
    p.path=[];p.state='working';reaction.remainingCore=Math.max(0,reaction.remainingCore-10);
    if(!reaction.remainingCore)extinguishFire(w,fire.id,1000);return true;
  }
  if(p.path.length&&reaction.target){context.move(reaction.target,true);return true;}
  if(reaction.remainingCore>0){reaction.remainingCore=Math.max(0,reaction.remainingCore-10);p.state='idle';return true;}
  const state=ensureFireState(w);
  if(fireRandom(state)<.1){reaction.phase='extinguish';reaction.remainingCore=150;delete reaction.target;p.state='working';return true;}
  const angle=fireRandom(state)*Math.PI*2,radius=1+Math.floor(fireRandom(state)*7),goal={x:p.x+Math.round(Math.cos(angle)*radius),z:p.z+Math.round(Math.sin(angle)*radius)};
  reaction.remainingCore=5+Math.floor(fireRandom(state)*6);
  if(!inside(w,goal)||!canStopAt(w,goal)){p.state='idle';return true;}
  const reach=context.search(new Set([goal.z*w.width+goal.x]));if(!reach)return true;
  const path=routeToCell(w,goal,reach);if(path?.length){p.path=path;reaction.target=goal;context.move(goal,true);}else p.state='idle';return true;
}
