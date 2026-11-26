import {shiftActorPath297} from './actor-path-source-297.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {noPaidTravel297} from './core-path-progress-297.ts';
import {effectiveCore297,effectiveLocal297} from './core-phase-297.ts';
import {stopCapturedTravel297} from './movement.ts';
import { cancelMelee } from './melee-state.ts';
import { activeCombatThreat,hostileTarget } from './combat-target.ts';
import { cancelShooting } from './shooting-state.ts';
import { advanceShooter,shootingQueries } from './shooting.ts';
import { AUTO_UNDRAFT_TICKS,DRAFT_QUEUE_LIMIT,sameCell,type DraftCommand } from './drafting-rules.ts';
import { draftDestination,draftDestinationContext } from './drafting-destinations.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { releaseAssignments } from './work-release.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { medicallyStopped } from './health-rules.ts';
import { isColonist } from './affiliation.ts';
import { blockedCells,canStep,routeToCell } from './pathfinding.ts';
import { startTravel } from './movement.ts';
import { CIVIL_TRANSIT_BLOCKERS } from './travel.ts';
import { search,type NavigationGrid,type SearchBudget } from './work-planner.ts';
import { canStandAt } from './furniture-travel.ts';
import { leaveTransitCell } from './transit-exit.ts';
import type { LightReader } from './light-environment.ts';
import type { CommandResult,Pawn,World } from './types.ts';

const refuse=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
function announce(world:World,pawn:Pawn,reason:string):void {
  world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : ${reason}`});if(world.events.length>80)world.events.splice(0,world.events.length-80);
}

/** The logical cell already denotes the end of an active edge. Keep the load on
 * its GPU pose until that edge finishes; never drop it ahead of its carrier. */
export function interruptDraftWork(world:World,pawn:Pawn):void {
  const travelling=!!pawn.motion&&pawn.motion.end>(isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick);
  const carrying=travelling&&(world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)||world.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id));
  if(!carrying){interruptWork(world,pawn);return;}
  clearQueuedOrders(world,pawn);delete pawn.priorityWork;releaseAssignments(world,pawn);
  pawn.interruptedCargo=true;pawn.planCooldown=0;
}

export function endDraft(world:World,pawn:Pawn):void {
  cancelShooting(pawn);cancelMelee(pawn);delete pawn.draft;interruptDraftWork(world,pawn);pawn.planCooldown=0;pawn.needCooldown=0;
}
export function applyDraftCommand(world:World,command:DraftCommand,preview=false):CommandResult {
  if(!Array.isArray(command.pawnIds)||!command.pawnIds.length||command.pawnIds.some(id=>!Number.isSafeInteger(id))||new Set(command.pawnIds).size!==command.pawnIds.length)return refuse('Sélection tactique invalide.');
  const pawns=command.pawnIds.map(id=>world.pawns.find(p=>p.id===id));
  if(pawns.some(p=>!p))return refuse('Colon introuvable.');
  if(pawns.some(p=>p&&(!isColonist(p)||p.prisoner)))return refuse('Seuls les colons libres peuvent recevoir un ordre tactique.');
  const selected=(pawns as Pawn[]).sort((a,b)=>a.id-b.id);
  if(command.type==='draft') {
    if(typeof command.enabled!=='boolean')return refuse('État de mobilisation invalide.');
    if(command.enabled&&selected.some(medicallyStopped))return refuse('Un colon à terre ou décédé ne peut pas être mobilisé.');
    for(const pawn of selected)if(!!pawn.draft!==command.enabled){
      if(command.enabled){delete pawn.flee;interruptDraftWork(world,pawn);pawn.draft={lastActiveTick:world.tick,target:null,queue:[]};pawn.planCooldown=0;}
      else endDraft(world,pawn);
    }
    return {ok:true};
  }
  if(selected.some(p=>!p.draft||medicallyStopped(p)))return refuse('Mobilisez d’abord tous les colons sélectionnés.');
  if(command.type==='fire-at-will') {
    if(typeof command.enabled!=='boolean')return refuse('Réglage de tir invalide.');
    for(const pawn of selected){
      if(command.enabled)delete pawn.draft!.holdFire;
      else {
        pawn.draft!.holdFire=true;
        if(pawn.shooting?.order?.auto?.kind==='draft')cancelShooting(pawn);
        else if(pawn.shooting?.stance?.phase==='aim') {
          // Soft cancellation resets the warmup, but an explicit attack survives.
          pawn.shooting.stance=null;advanceShooter(world,pawn,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):world.tick*10,shootingQueries(world));
        }
      }
    }
    return {ok:true};
  }
  if(command.type==='draft-stop') {
    for(const pawn of selected){if(isCorePhysicalSchema297(Number(world.schemaVersion)))stopCapturedTravel297(world,pawn);cancelShooting(pawn);cancelMelee(pawn);interruptDraftWork(world,pawn);pawn.draft={lastActiveTick:world.tick,target:null,queue:[],...pawn.draft?.holdFire?{holdFire:true}:{}};pawn.planCooldown=0;}
    return {ok:true};
  }
  if(!command.target||!Number.isInteger(command.target.x)||!Number.isInteger(command.target.z)||typeof command.queue!=='boolean')return refuse('Destination tactique invalide.');
  if(command.queue&&selected.some(p=>p.draft!.queue.length>=DRAFT_QUEUE_LIMIT))return refuse('La file de déplacements est pleine.');
  if(isCorePhysicalSchema297(Number(world.schemaVersion))&&!command.queue&&selected.length===1){
    const p=selected[0]!,now=effectiveLocal297(world),occupied=p.motion&&p.motion.end>now?p.motion.from:p;
    // Native single-selection GoHere does not replace an order by clicking
    // the cell still occupied during the already committed step.
    if(sameCell(command.target,occupied))return {ok:true};
  }
  const blocked=blockedCells(world),context=draftDestinationContext(world,command.queue?new Set():new Set(command.pawnIds));
  const plans=[];
  for(const pawn of selected) {
    const now=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick,m=pawn.motion;
    const reset297=isCorePhysicalSchema297(Number(world.schemaVersion))&&!command.queue&&!!m&&m.end>now&&(noPaidTravel297(m,now)||!canStep(world,{...pawn,x:m.from.x,z:m.from.z},m.to,blocked,CIVIL_TRANSIT_BLOCKERS));
    const origin=command.queue?(pawn.draft!.queue.at(-1)??pawn.draft!.target??pawn):reset297?{...pawn,x:m!.from.x,z:m!.from.z}:pawn;
    const queued=command.queue&&!!(pawn.draft!.target||pawn.draft!.queue.length);
    const plan=draftDestination(world,pawn,command.target,blocked,context,origin,!queued);
    if(!plan)return refuse('Aucune destination accessible et libre près du clic.');
    context.claimed.add(plan.target.z*world.width+plan.target.x);plans.push({pawn,reset297,...plan});
  }
  // Validate the whole group before releasing any ownership or reservation.
  if(preview)return {ok:true};
  for(const {pawn,target,path,reset297} of plans) {
    const draft=pawn.draft!;
    if(command.queue&&(draft.target||draft.queue.length)){draft.queue.push(target);continue;}
    if(reset297)stopCapturedTravel297(world,pawn);
    cancelShooting(pawn);cancelMelee(pawn);interruptDraftWork(world,pawn);draft.target=target;draft.queue=[];draft.lastActiveTick=world.tick;
    pawn.path=path;pawn.planCooldown=0;pawn.state=path.length||pawn.moveCooldown>0?'moving':'idle';
    if(pawn.shooting?.stance?.phase==='cooldown'||pawn.melee?.strike){pawn.path=[];pawn.state='idle';}
    if(isCorePhysicalSchema297(Number(world.schemaVersion))&&(pawn.motion?.end??0)<=effectiveLocal297(world)&&pawn.path.length){
      const next=pawn.path[0]!;if(startTravel(world,pawn,next,undefined,undefined,true))shiftActorPath297(pawn.path);
    }
  }
  return {ok:true};
}

/** Shared weighted navigation/captured edges; no planner or need bonus in tactical mode. */
export function processDraft(world:World,pawn:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader):void {
  const draft=pawn.draft!;
  if(draft.target&&!canStandAt(world,draft.target)) {draft.target=null;pawn.path=[];pawn.state='idle';pawn.planCooldown=0;announce(world,pawn,'destination devenue impraticable.');}
  if((!draft.target||sameCell(pawn,draft.target))&&draft.queue.length) {
    if(!budget.remaining)return;budget.remaining--;
    const intent=draft.queue.shift()!,context=draftDestinationContext(world,new Set([pawn.id]));
    const next=draftDestination(world,pawn,intent,getBlocked(),context);
    if(next){draft.target=next.target;pawn.path=next.path;pawn.planCooldown=0;}
    else {draft.target=null;pawn.path=[];announce(world,pawn,'déplacement en file inaccessible, ordre suivant conservé.');}
  }
  if(draft.target&&!sameCell(pawn,draft.target)) {
    draft.lastActiveTick=world.tick;pawn.state='moving';
    const blocked=getBlocked();let next=pawn.path[0];
    if(!next||!canStep(world,pawn,next,blocked,CIVIL_TRANSIT_BLOCKERS)) {
      if(pawn.planCooldown>0)return;
      const reach=search(world,pawn,blocked,CIVIL_TRANSIT_BLOCKERS,budget,new Set([draft.target.z*world.width+draft.target.x]));if(!reach)return;
      const path=routeToCell(world,draft.target,reach);pawn.planCooldown=20;
      if(!path){draft.target=null;pawn.path=[];pawn.state='idle';announce(world,pawn,'chemin interrompu.');return;}
      pawn.path=path;next=path[0];
    }
    if(next&&startTravel(world,pawn,next,getLight))shiftActorPath297(pawn.path);
    return;
  }
  if(leaveTransitCell(world,pawn,getBlocked,budget,getLight)){draft.lastActiveTick=world.tick;return;}
  pawn.state='idle';pawn.path=[];
  if(world.pawns.some(p=>hostileTarget(pawn,p)&&activeCombatThreat(p))
    ||world.wildlife?.animals.some(a=>hostileTarget(pawn,a)&&activeCombatThreat(a))){draft.lastActiveTick=world.tick;return;}
  // Any active hostile on the map prevents automatic demobilization, including
  // a manhunter beyond firing range. Peaceful fauna never claims this activity.
  if(world.tick-draft.lastActiveTick>=AUTO_UNDRAFT_TICKS){endDraft(world,pawn);announce(world,pawn,'démobilisation après une longue attente sans menace.');}
}
