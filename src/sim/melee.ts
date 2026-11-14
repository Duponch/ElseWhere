import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import { combatCell297,combatTarget,isAnimalTarget,meleeThreatTarget,retaliationPermission,type LivingTarget } from './combat-target.ts';
import { violentWorkRefusal } from './colonist-backgrounds.ts';
import { strikeLivingTarget } from './living-melee.ts';
import { isBarrier,damageBarrier } from './barriers.ts';
import { damageStructure,structureMaxHp } from './thing-damage.ts';
import { mentalMeleeOwnership } from './aggressive-crisis-order.ts';
import { prisonBreakMeleeOwned } from './prison-break-state.ts';
import { isRoomDoor } from './door-rules.ts';
import { disturbanceEvents } from './disturbance.ts';
import { automaticPermission,automaticTarget } from './automatic-combat-state.ts';
import type { shootingQueries } from './shooting.ts';
import { assaultTarget,hostileTo,isColonist } from './affiliation.ts';
import { cancelShooting } from './shooting-state.ts';
import { cancelMelee,type MeleeCommand } from './melee-state.ts';
import { interruptDraftWork } from './drafting.ts';
import { carrierOf } from './rescue-state.ts';
import { medicallyStopped } from './health-rules.ts';
import { healthRandom } from './health.ts';
import { chooseMeleeTool,meleeTools } from './melee-statistics.ts';
import { meleeContact,meleeTargetContact,structureMeleeCell,meleePlaces,meleeRoute } from './melee-space.ts';
import { activeSocialFight,finishSocialFight,socialFightRecoveryDue } from './social-fight.ts';
import { isStunned } from './stun.ts';
import { blockedCells,canStep } from './pathfinding.ts';
import { startTravel } from './movement.ts';
import type { LightReader } from './light-environment.ts';
import type { NavigationGrid,SearchBudget } from './work-planner.ts';
import type { CommandResult,Pawn,World } from './types.ts';

const EMPTY:ReadonlySet<number>=new Set();

function targetFor(world:World,pawn:Pawn,carried=(id:number)=>!!carrierOf(world,id),readThreat=()=>meleeThreatTarget(world,pawn)):LivingTarget|undefined {
  const order=pawn.melee?.order;
  const p=order?combatTarget(world,order.targetId):undefined;
  if(order?.auto==='prison-break'&&(!prisonBreakMeleeOwned(world,pawn,order)||!p||!world.pawns.includes(p as Pawn)||!hostileTo(pawn,p as Pawn)||!!(p as Pawn).prisoner))return;
  const mental=order?.auto==='mental'&&mentalMeleeOwnership(world,pawn,order);
  const domesticRefusal=p&&isAnimalTarget(p)&&p.domestic&&!(mental&&pawn.mental?.crisis?.kind==='berserk')
    &&!(order?.auto==='retaliation'&&retaliationPermission(pawn)&&readThreat()?.id===p.id);
  return p&&!domesticRefusal&&p.state!=='dead'&&(order!.startedDowned||mental&&pawn.mental?.crisis?.kind==='murderous-rage'||p.state!=='downed')&&(!isAnimalTarget(p)?!carried(p.id):world.schemaVersion>=78)?p:undefined;
}
function canFight(world:World,pawn:Pawn,carried=(id:number)=>!!carrierOf(world,id)):boolean {
  const order=pawn.melee?.order;
  return (!violentWorkRefusal(pawn)||!!order&&mentalMeleeOwnership(world,pawn,order))&&!medicallyStopped(pawn)&&!pawn.health?.toxicBuildup?.vomit&&pawn.state!=='sleeping'&&!pawn.need&&!pawn.collapsePending&&!carried(pawn.id);
}
function structureTarget(world:World,pawn:Pawn){
  const order=pawn.melee?.order;
  return order?.structure?world.structures.find(s=>s.id===order.targetId&&(order.auto==='mental'?mentalMeleeOwnership(world,pawn,order)&&structureMaxHp(s)>0:order.auto==='prison-break'?prisonBreakMeleeOwned(world,pawn,order)&&isBarrier(s):isBarrier(s))):undefined;
}
function mentalAttempt(pawn:Pawn):void {
  const c=pawn.mental?.crisis;if(!c||pawn.melee?.order?.auto!=='mental')return;
  if(c.kind==='tantrum'){c.attempted=true;cancelMelee(pawn);}
  else if(c.kind==='berserk'&&!pawn.melee.order.structure){c.targetId=null;c.jobUntilCore=null;cancelMelee(pawn);}
}
export function applyMeleeCommand(world:World,command:MeleeCommand):CommandResult {
  const refuse=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!Array.isArray(command.pawnIds)||!command.pawnIds.length||command.pawnIds.some(id=>!Number.isSafeInteger(id))||new Set(command.pawnIds).size!==command.pawnIds.length||!Number.isSafeInteger(command.targetId))return refuse('Ordre de mêlée invalide.');
  if(command.structure!==undefined&&command.structure!==true)return refuse('Type de cible invalide.');
  const target=command.structure?world.structures.find(s=>s.id===command.targetId&&isBarrier(s)):combatTarget(world,command.targetId);
  if(!target||'state' in target&&(target.state==='dead'||!isAnimalTarget(target)&&!!carrierOf(world,target.id)))return refuse(command.structure?'Mur ou porte indisponible.':'Cible vivante indisponible.');
  if('state' in target&&isAnimalTarget(target)&&target.domestic)return refuse('Cet animal appartient à la colonie.');
  const plans:{pawn:Pawn;path:Pawn['path']}[]=[],claimed=new Set<number>(),blocked=blockedCells(world);
  for(const id of [...command.pawnIds].sort((a,b)=>a-b)) {
    const pawn=world.pawns.find(p=>p.id===id);
    const refusal=pawn?violentWorkRefusal(pawn):undefined;if(refusal)return refuse(refusal);
    if(!pawn||!pawn.draft||!isColonist(pawn)||pawn===target||!canFight(world,pawn)||!meleeTools(world,pawn).length)return refuse('Mobilisez un colon éveillé et capable de combattre.');
    const path=meleeRoute(world,pawn,meleePlaces(world,pawn,target,claimed),blocked);
    if(!path)return refuse('Aucune place de mêlée accessible et libre.');
    const end=path.at(-1)??pawn;claimed.add(end.z*world.width+end.x);plans.push({pawn,path});
  }
  for(const {pawn,path} of plans) {
    const strike=pawn.melee?.strike??null;cancelShooting(pawn);interruptDraftWork(world,pawn);
    pawn.melee={order:{targetId:target.id,startedDowned:'state' in target&&target.state==='downed',...(command.structure?{structure:true as const}:{})},strike};
    pawn.draft!.target=null;pawn.draft!.queue=[];pawn.draft!.lastActiveTick=world.tick;
    pawn.path=strike||pawn.shooting?.stance?.phase==='cooldown'?[]:path;pawn.state=pawn.path.length||pawn.moveCooldown?'moving':'idle';pawn.planCooldown=0;
  }
  return {ok:true};
}
/** Fixed sentry only: counter an adjacent enemy, no implicit raid pursuit. */
export function startSentryMelee(world:World,pawn:Pawn):boolean {
  if(isColonist(pawn)||!canFight(world,pawn))return false;
  const core=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):0,source=combatCell297(Number(world.schemaVersion),pawn,core);
  const nearby=world.pawns.filter(p=>{if(!hostileTo(pawn,p)||!assaultTarget(pawn,p))return false;const cell=combatCell297(Number(world.schemaVersion),p,core);return Math.abs(cell.x-source.x)<=1&&Math.abs(cell.z-source.z)<=1;});
  if(!nearby.length)return false;
  const blocked=blockedCells(world,true);
  const target=nearby.filter(p=>hostileTo(pawn,p)&&assaultTarget(pawn,p)&&meleeContact(world,pawn,p,blocked)).sort((a,b)=>a.id-b.id)[0];
  if(!target)return false;
  cancelShooting(pawn);pawn.path=[];
  pawn.melee={order:{targetId:target.id,startedDowned:false},strike:pawn.melee?.strike??null};return true;
}
/** One Core substep. Return true when medical/ground captures have expired. */
export function advanceMelee(world:World,pawn:Pawn,core:number,contactGrid:()=>Uint8Array,queries:ReturnType<typeof shootingQueries>,disturbance=disturbanceEvents(world)):boolean {
  const m=pawn.melee;if(!m)return false;
  if(medicallyStopped(pawn)){if(m.order?.auto==='social')finishSocialFight(world,pawn);delete pawn.melee;return false;}
  if(m.strike&&core>=m.strike.untilCore)m.strike=null;
  if(m.order?.auto==='social'&&!activeSocialFight(world,pawn,m.order.targetId)){finishSocialFight(world,pawn);return false;}
  if(!canFight(world,pawn,queries.carried)){
    if(m.order?.auto==='social')finishSocialFight(world,pawn);else {
      if(m.order?.auto==='mental'||m.order?.auto==='retaliation'||m.order?.auto==='prison-break')pawn.path=[];
      cancelMelee(pawn);
    }
    return false;
  }
  if(m.order?.auto==='social'&&socialFightRecoveryDue(pawn,core,world.schemaVersion)){finishSocialFight(world,pawn);return false;}
  const auto=m.order?.auto;
  if(auto==='draft'||auto==='response'){
    if(!automaticPermission(pawn,auto)||!automaticTarget(world,pawn,m.order!.targetId))cancelMelee(pawn);
  }else if(auto==='prison-break'&&!prisonBreakMeleeOwned(world,pawn,m.order!)) {cancelMelee(pawn);pawn.path=[];}
  else if(auto==='mental'&&(!mentalMeleeOwnership(world,pawn,m.order!)||m.order!.untilCore!==undefined&&core>=m.order!.untilCore)
    ||auto==='retaliation'&&(!retaliationPermission(pawn)||meleeThreatTarget(world,pawn,core,queries.grid())?.id!==m.order!.targetId||core>=m.order!.untilCore!))cancelMelee(pawn);
  else if(!auto&&isColonist(pawn)&&!pawn.draft)cancelMelee(pawn);
  if(m.order?.structure){
    const target=structureTarget(world,pawn);
    if(!target){cancelMelee(pawn);pawn.path=[];return false;}
    const cell=structureMeleeCell(world,pawn,target,contactGrid());
    if(m.strike||isStunned(pawn,core)||pawn.shooting?.stance?.phase==='cooldown'||(pawn.motion?.end??0)>core/10||!cell)return false;
    const state={rng:world.rng},random=()=>healthRandom(state),tool=chooseMeleeTool(meleeTools(world,pawn,()=>queries.body(pawn)),random);
    if(!tool){cancelMelee(pawn);return false;}
    const raw=Math.max(1,tool.damage*(.8+random()*.4)),floor=Math.floor(raw),damage=floor+(random()<raw-floor?1:0);
    const order=m.order;
    if(!(world.schemaVersion<193&&isBarrier(target)?damageBarrier(world,target,damage,state.rng):damageStructure(world,target,damage,'melee',state.rng,{core,rawAmount:damage,instigatorKey:`pawn:${pawn.id}`})))return false;
    if(medicallyStopped(pawn))return true;
    pawn.melee={order:world.structures.includes(target)?order:null,strike:{targetId:target.id,structure:{...cell},atCore:core,untilCore:core+tool.cooldownCore,tool:tool.id,outcome:'hit'}};
    // Destruction may already have cancelled the order; notify from its real
    // attempt without recreating an engagement after a medical interruption.
    if(order?.auto==='mental'&&pawn.mental?.crisis?.kind==='tantrum'){pawn.mental.crisis.attempted=true;cancelMelee(pawn);}
    pawn.path=[];if(!medicallyStopped(pawn))pawn.state='idle';
    return true;
  }
  const readThreat=()=>meleeThreatTarget(world,pawn,core,queries.grid());
  const target=targetFor(world,pawn,queries.carried,readThreat);
  if(m.order&&!target){if(m.order.auto==='social')finishSocialFight(world,pawn);else {cancelMelee(pawn);pawn.path=[];}}
  if(!pawn.melee)return false;
  if(!m.order&&!m.strike){delete pawn.melee;return false;}
  if(m.strike||!target||isStunned(pawn,core)||pawn.shooting?.stance?.phase==='cooldown'||(pawn.motion?.end??0)>core/10)return false;
  if(!meleeContact(world,pawn,target,contactGrid()))return false;
  // Contact is logical, as in the reference; captured travel cannot permit the
  // attacker to swing before reaching its own interaction cell.
  const randomState={rng:world.rng},random=()=>healthRandom(randomState);
  const tool=chooseMeleeTool(meleeTools(world,pawn,()=>queries.body(pawn)),random);if(!tool){if(m.order?.auto==='social')finishSocialFight(world,pawn);else cancelMelee(pawn);return false;}
  strikeLivingTarget(world,pawn,target,tool,core,randomState,disturbance);
  mentalAttempt(pawn);
  if(m.order?.auto==='social'){
    if(!activeSocialFight(world,pawn,target.id))finishSocialFight(world,pawn);
  }else if(m.order?.auto==='draft'||m.order?.auto==='retaliation'||!targetFor(world,pawn,queries.carried,readThreat))cancelMelee(pawn);
  return true;
}
export function processMelee(world:World,pawn:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader):void {
  if(pawn.melee?.order?.auto==='prison-break'&&!prisonBreakMeleeOwned(world,pawn,pawn.melee.order)){cancelMelee(pawn);pawn.path=[];return;}
  const m=pawn.melee!,target=m.order?.structure?structureTarget(world,pawn):targetFor(world,pawn);if(pawn.draft)pawn.draft.lastActiveTick=world.tick;
  if(m.order?.auto==='social'&&(!activeSocialFight(world,pawn,m.order.targetId)||!target||!canFight(world,pawn))){finishSocialFight(world,pawn);return;}
  if(!target||!canFight(world,pawn)){cancelMelee(pawn);pawn.path=[];return;}
  if(m.strike||pawn.shooting?.stance?.phase==='cooldown'||isStunned(pawn,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):world.tick*10)){pawn.path=[];pawn.state='idle';return;}
  if(meleeTargetContact(world,pawn,target,getBlocked())){pawn.path=[];pawn.state='idle';return;}
  if(!isColonist(pawn)&&!pawn.tactics&&!pawn.raid&&!(m.order&&prisonBreakMeleeOwned(world,pawn,m.order))||m.order?.auto==='draft'){cancelMelee(pawn);return;}
  const blocked=getBlocked(),end=pawn.path.at(-1),next=pawn.path[0];
  const traversable=!!next&&canStep(world,pawn,next,blocked,EMPTY);
  if(!traversable||!end||!meleeTargetContact(world,end,target,blocked)) {
    if(!budget.remaining||pawn.planCooldown) {
      // A moving target makes the goal stale, not the safe route prefix.
      // Throttling a new search must not throttle physical pursuit as well.
      if(!traversable){pawn.path=[];pawn.state='idle';return;}
    }else{
      budget.remaining--;pawn.planCooldown=20;
      const path=meleeRoute(world,pawn,meleePlaces(world,pawn,target),blocked);
      if(!path){if(m.order?.auto==='social')finishSocialFight(world,pawn);else {cancelMelee(pawn);pawn.path=[];pawn.state='idle';}return;}pawn.path=path;
    }
  }
  const step=pawn.path[0];
  if(step&&m.order?.auto==='mental'&&!m.order.structure&&pawn.mental?.crisis?.kind!=='tantrum'){
    const door=world.structures.find(s=>isRoomDoor(s.kind)&&s.x===step.x&&s.z===step.z&&!s.door?.open);
    if(door){m.order={...m.order,targetId:door.id,startedDowned:false,structure:true};pawn.path=[];pawn.state='idle';pawn.planCooldown=0;return;}
  }
  if(step){pawn.state='moving';if(startTravel(world,pawn,step,getLight)){
    pawn.path.shift();
    // An exhausted successful route may need another goal when this edge
    // finishes. Failed searches retain their backoff; they commit no step.
    if(!pawn.path.length)pawn.planCooldown=0;
  }}
}
