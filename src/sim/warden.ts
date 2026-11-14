import {notePopulationGain320} from './population-intent-320.ts';
import {assignPileOwner} from './pile-index.ts';
import { enableAndInitializeWork, initializesWorkLikeCore302 } from './work-initialization.ts';
import {commitJoinedPlayer259} from './world-affiliation-259.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { isColonist } from './affiliation.ts';
import { bedsideAccess,patientClaimed } from './care-access.ts';
import { needsAssistedFeeding,FEED_HUNGER } from './feeding-rules.ts';
import { copyPileCondition } from './pile-condition.ts';
import { selectFood } from './food-selection.ts';
import { groundCapacity,groundPile,nearbyGround } from './ground-placement.ts';
import { medicalWorkRefusal,pawnBody } from './health-rules.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { ITEM_DEFINITIONS,mealQuantity,nutritionOf } from './items.ts';
import { reservedSource } from './materials.ts';
import { adjacent,routeToCell,type Reachability } from './pathfinding.ts';
import { capturePrisonTopology,prisonRoom } from './prison-space.ts';
import type { RoomTopology } from './room-topology.ts';
import { PRISON_RAPPORTS,PRISON_RAPPORT_TICKS,prisonerChatReady,prisonerResistanceReduction,recordPrisonerChat,type WardTask,type WardFoodTask } from './prisoner-state.ts';
import { carrierOf } from './rescue-state.ts';
import { learnSkill,XP_SCALE } from './skills.ts';
import { addSocialMemory,expireSocialMemories,socialImpact,socialSeed } from './social-state.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,Pawn,World } from './types.ts';
import { compareSearchKeys,type RegionSearch } from './region-search.ts';

export interface WardenProposal {task:WardTask;path:Cell[]}
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const secure=(p:Pawn)=>!!p.prisoner&&!prisonBreakActive(p)&&!p.prisoner.escape&&p.prisoner.releasedAt===undefined&&p.state!=='dead'&&!p.mental?.crisis;
const actorReady=(p:Pawn)=>isColonist(p)&&!p.prisoner&&workPriority(p,'warden')>0&&p.state!=='downed'&&p.state!=='dead'&&!p.draft&&!p.mental?.crisis&&!p.interruptedCargo;
function chatEligible(world:World,actor:Pawn,p:Pawn):boolean {
  return allowedAreaAllows(world,actor,p)&&secure(p)&&prisonerChatReady(world,p)&&pawnBody(actor).capacities.talking>0&&pawnBody(p).canBeAwake
    &&p.state!=='sleeping'&&!p.medicalSleep&&(!p.need||p.need.kind==='sleep')&&(p.state!=='downed'||p.need?.kind==='sleep'&&p.need.bedId!==null&&p.need.phase==='sleep')&&!carrierOf(world,p.id);
}
/** Available room meals count toward every hungry resident, not just this job.
 * The .5 nutrition margin is the Core delivery heuristic, not food creation. */
function roomHasFood(world:World,patient:Pawn,map:RoomTopology):boolean {
  const room=prisonRoom(world,patient,map);if(!room)return false;
  if(world.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===patient.id&&ITEM_DEFINITIONS[i.item].nutrition))return true;
  let nutrition=0;
  for(const pile of world.piles)if(pile.owner.type==='ground'&&['berries','simple-meal','fine-meal','vegetarian-fine-meal','carnivore-fine-meal','lavish-meal','vegetarian-lavish-meal','carnivore-lavish-meal','survival-meal','pemmican','legacy-portion'].includes(pile.item)&&prisonRoom(world,pile.owner,map)?.id===room.id){
    nutrition+=nutritionOf({...pile,quantity:Math.max(0,pile.quantity-reservedSource(world,pile.id))});
  }
  const wanted=world.pawns.filter(p=>secure(p)&&p.hunger<FEED_HUNGER&&prisonRoom(world,p,map)?.id===room.id).reduce((sum,p)=>sum+Math.max(0,100-p.hunger),0);
  return nutrition+50>=wanted;
}
function foodEligible(world:World,p:Pawn,enclosure:()=>RoomTopology):boolean {
  return secure(p)&&p.prisoner!.mode!=='release'&&p.state!=='downed'&&p.hunger<FEED_HUNGER&&!needsAssistedFeeding(p)&&!carrierOf(world,p.id)&&!!prisonRoom(world,p,enclosure())&&!roomHasFood(world,p,enclosure());
}
export function wardenWanted(world:World,actor:Pawn):boolean {
  let map:RoomTopology|undefined;const enclosure=()=>map??=capturePrisonTopology(world);
  return actorReady(actor)&&world.pawns.some(p=>p!==actor&&allowedAreaAllows(world,actor,p)&&secure(p)&&!patientClaimed(world,p.id,actor)&&(chatEligible(world,actor,p)||!medicalWorkRefusal(actor)&&foodEligible(world,p,enclosure)));
}
function foodSpot(world:World,actor:Pawn,patient:Pawn,item:World['piles'][number]['item'],quantity:number,reach:Reachability,map:RoomTopology):Cell|undefined {
  const room=prisonRoom(world,patient,map);if(!room)return;
  return nearbyGround(world,patient,5).find(c=>allowedAreaAllows(world,actor,c)&&prisonRoom(world,c,map)?.id===room.id&&!groundPile(world,c)&&groundCapacity(world,c,item,actor.id)>=quantity
    &&!world.pawns.some(p=>p!==actor&&p.ward?.kind==='food'&&same(p.ward.spot,c))&&routeToCell(world,c,reach)!==null);
}
/** With `search` (schema 301 family), each giver takes its prisoners in
 * RimWorld's order (region search from the warden, then straight-line
 * distance); otherwise by identifier. Food delivery still precedes chats. */
export function wardenProposal(world:World,actor:Pawn,reach:Reachability,search?:RegionSearch):WardenProposal|undefined {
  if(!actorReady(actor))return;
  let map:RoomTopology|undefined;const enclosure=()=>map??=capturePrisonTopology(world);
  const eligible=world.pawns.filter(p=>p!==actor&&allowedAreaAllows(world,actor,p)&&secure(p)&&!patientClaimed(world,p.id,actor));
  const ordered=(giver:'DeliverFoodToPrisoner'|'ChatWithPrisoner')=>search
    ?eligible.map(p=>({p,key:search.key(p,giver),near:(p.x-actor.x)**2+(p.z-actor.z)**2})).sort((a,b)=>compareSearchKeys(a.key,b.key)||a.near-b.near||a.p.id-b.p.id).map(e=>e.p)
    :[...eligible].sort((a,b)=>a.id-b.id);
  for(const p of ordered('DeliverFoodToPrisoner'))if(!medicalWorkRefusal(actor)&&foodEligible(world,p,enclosure)){
    const piles=world.piles.filter(i=>i.kind==='food'&&i.owner.type==='ground'&&!prisonRoom(world,i.owner,enclosure())&&i.quantity>reservedSource(world,i.id));
    const food=selectFood(world,actor,piles,reach,p,enclosure());if(!food)continue;
    const pile=piles.find(i=>i.id===food.id)!,quantity=mealQuantity(p,pile,pile.quantity-reservedSource(world,pile.id));
    const spot=foodSpot(world,actor,p,pile.item,quantity,reach,enclosure());if(!spot)continue;
    return {task:{kind:'food',patientId:p.id,sourcePileId:pile.id,carryPileId:null,quantity,spot,phase:'pickup'},path:food.path};
  }
  for(const p of ordered('ChatWithPrisoner'))if(chatEligible(world,actor,p)){
    const access=bedsideAccess(world,actor,p,reach);if(access)return {task:{kind:'chat',patientId:p.id,spot:access.spot,phase:'approach',progress:0,rapports:0},path:access.path};
  }
}
export function startWarden(actor:Pawn,proposal:WardenProposal):void {
  actor.ward=proposal.task;actor.path=proposal.path;actor.state='moving';actor.planCooldown=0;
}
function foodTaskValid(world:World,actor:Pawn,patient:Pawn,t:WardFoodTask):boolean {
  const pile=world.piles.find(p=>p.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
  if(medicalWorkRefusal(actor)||!secure(patient))return false;
  const map=capturePrisonTopology(world),room=prisonRoom(world,patient,map);
  return !!room&&room.id===prisonRoom(world,t.spot,map)?.id&&!!pile&&pile.kind==='food'
    &&(t.phase==='pickup'?pile.owner.type==='ground'&&!prisonRoom(world,pile.owner,map)&&reservedSource(world,pile.id)<=pile.quantity:pile.owner.type==='pawn'&&pile.owner.pawnId===actor.id&&pile.quantity===t.quantity)
    &&!groundPile(world,t.spot)&&groundCapacity(world,t.spot,pile.item,actor.id)>=t.quantity;
}
export function reconcileWarden(world:World):void {
  for(const actor of world.pawns)if(actor.ward){const t=actor.ward,p=world.pawns.find(p=>p.id===t.patientId);
    if(!allowedAreaServicesAllowed(world,actor)){interruptWork(world,actor);continue;}
    if(!actorReady(actor)||!p||patientClaimed(world,p.id,actor)||(t.kind==='food'?!foodTaskValid(world,actor,p,t):t.phase==='closing'?p.state==='dead':!chatEligible(world,actor,p)))interruptWork(world,actor);
  }
}
function rapport(world:World,actor:Pawn,p:Pawn):void {
  const impact=socialImpact(actor);expireSocialMemories(p,world.tick);
  p.social??={rng:socialSeed(world.seed,p.id),memories:[]};addSocialMemory(p.social,actor.id,'rapport',world.tick,impact);
  actor.skills.social??={level:0,xp:0,dailyXp:0,passion:0};learnSkill(actor.skills.social,45*XP_SCALE,actor);
}
function finishConversation(world:World,actor:Pawn,p:Pawn,context:NeedContext):boolean {
  const prisoner=p.prisoner;if(!prisoner||!prisonerChatReady(world,p))return false;
  // A joining person must first release any physical engagement conservatively.
  if(prisoner.resistance<=0&&prisoner.mode==='recruit'&&!releaseWork(world,p))return false;
  recordPrisonerChat(world,p);
  actor.skills.social??={level:0,xp:0,dailyXp:0,passion:0};learnSkill(actor.skills.social,230*XP_SCALE,actor);
  if(prisoner.resistance>0){
    const reduction=Math.min(prisoner.resistance,prisonerResistanceReduction(world,actor,p));prisoner.resistance=Math.max(0,prisoner.resistance-reduction);
    context.event(`${actor.name} réduit la résistance de ${p.name} de ${reduction.toFixed(2)} (${prisoner.resistance.toFixed(2)} restante).`);
  }else if(prisoner.mode==='recruit'){
    const raidGroup=p.raid?.group;p.recruitment={capturedAt:prisoner.capturedAt,recruitedAt:world.tick,fromFaction:'outlaws',...(raidGroup===undefined?{}:{raidGroup})};
    commitJoinedPlayer259(world,p);notePopulationGain320(world);delete p.prisoner;delete p.raid;p.faction='colony';p.bedId=null;delete p.bedSlot;
    // Core SetGuestStatus releases the prison bed: the global claim goes too,
    // or the save holds a bed owner with no matching local bed.
    if(world.schemaVersion>=256)delete p.mapBed;p.needCooldown=0;p.planCooldown=0;
    if(initializesWorkLikeCore302(world.schemaVersion))enableAndInitializeWork(p);
    // Core DoRecruit: the new colonist remembers who recruited them (319).
    if(world.schemaVersion>=319){const state=p.social??={rng:socialSeed(world.seed,p.id),memories:[]};expireSocialMemories(p,world.tick);addSocialMemory(state,actor.id,'recruited-me',world.tick,1);}
    clearQueuedOrders(world,p);context.event(`${p.name} rejoint la colonie après les conversations avec ${actor.name}.`);
  }
  return true;
}
export function processWarden(world:World,actor:Pawn,context:NeedContext):void {
  if(!allowedAreaServicesAllowed(world,actor)){interruptWork(world,actor);return;}
  const t=actor.ward;if(!t)return;const p=world.pawns.find(p=>p.id===t.patientId);
  if(!p||!actorReady(actor)||patientClaimed(world,p.id,actor)){interruptWork(world,actor);return;}
  if(t.kind==='food'){
    if(!foodTaskValid(world,actor,p,t)){interruptWork(world,actor);return;}
    const pile=world.piles.find(i=>i.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId))!;
    if(t.phase==='pickup'){
      if(pile.owner.type!=='ground'){interruptWork(world,actor);return;}
      if(!same(actor,pile.owner)&&!adjacent(actor,pile.owner)){context.move(pile.owner,false);return;}
      if(pile.quantity===t.quantity){assignPileOwner(pile,{type:'pawn',pawnId:actor.id});t.carryPileId=pile.id;}
      else{
        if(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1)){interruptWork(world,actor);return;}
        pile.quantity-=t.quantity;t.carryPileId=world.nextId++;world.piles.push({id:t.carryPileId,kind:'food',item:pile.item,quantity:t.quantity,owner:{type:'pawn',pawnId:actor.id},...copyPileCondition(pile)});
      }
      t.phase='deliver';actor.path=[];actor.state='moving';return;
    }
    if(!same(actor,t.spot)){context.move(t.spot,true);return;}
    assignPileOwner(pile,{type:'ground',...t.spot});p.needCooldown=0;
    context.event(`${actor.name} dépose un repas dans la prison de ${p.name}.`);releaseWork(world,actor);return;
  }
  if(t.phase==='closing'){
    actor.state='working';if(++t.progress>=PRISON_RAPPORT_TICKS)releaseWork(world,actor);return;
  }
  if(!chatEligible(world,actor,p)){interruptWork(world,actor);return;}
  if(!adjacent(actor,p)){
    t.phase='approach';const reach=context.search();if(!reach)return;const access=bedsideAccess(world,actor,p,reach);
    if(!access){interruptWork(world,actor);return;}t.spot=access.spot;context.move(t.spot,true);return;
  }
  t.spot={x:actor.x,z:actor.z};actor.path=[];actor.state='working';t.phase='rapport';
  // Interaction effects precede their wait, as in the Core toil. Persisting the
  // completed count prevents replaying XP/opinion after a mid-wait restore.
  if(t.progress===0&&t.rapports<PRISON_RAPPORTS){rapport(world,actor,p);t.rapports++;}
  if(++t.progress<PRISON_RAPPORT_TICKS)return;
  t.progress=0;
  if(t.rapports===PRISON_RAPPORTS){if(!finishConversation(world,actor,p,context)){interruptWork(world,actor);return;}t.phase='closing';}
}
