import { isColonist } from './affiliation.ts';
import { interruptDraftWork } from './drafting.ts';
import { medicallyStopped,pawnBody } from './health-rules.ts';
import { cancelMelee } from './melee-state.ts';
import { meleeContact,meleePlaces,meleeRoute } from './melee-space.ts';
import { meleeTools } from './melee-statistics.ts';
import { blockedCells } from './pathfinding.ts';
import { carrierOf } from './rescue-state.ts';
import { addFightAftermath,socialRandom,socialSeed } from './social-state.ts';
import type { Pawn,World } from './types.ts';

function available(world:World,pawn:Pawn):boolean {
  return isColonist(pawn)&&!pawn.prisoner&&!medicallyStopped(pawn)&&pawn.state!=='sleeping'&&!pawn.medicalSleep
    &&!pawn.collapsePending&&!pawn.burning&&!pawn.mental?.crisis&&!pawn.stun&&!pawn.raid&&!pawn.tactics
    &&!pawn.flee&&!pawn.shooting&&!pawn.melee&&!pawn.social?.fight&&!carrierOf(world,pawn.id)
    &&pawnBody(pawn).canBeAwake&&meleeTools(world,pawn).length>0;
}

type FightPlan={pawn:Pawn;target:Pawn;path:Pawn['path']};
function planSocialFight(world:World,a:Pawn,b:Pawn):FightPlan[]|null {
  if(a===b||!world.pawns.includes(a)||!world.pawns.includes(b)||!available(world,a)||!available(world,b))return null;
  const blocked=blockedCells(world),contact=blockedCells(world,true),claimed=new Set<number>();
  const plans:FightPlan[]=[];
  for(const [pawn,target] of [[a,b],[b,a]] as const){
    const path=meleeContact(world,pawn,target,contact)?[]:meleeRoute(world,pawn,meleePlaces(world,pawn,target,claimed),blocked);
    if(!path)return null;
    const end=path.at(-1)??pawn;claimed.add(end.z*world.width+end.x);
    plans.push({pawn,target,path});
  }
  return plans;
}
/** Read-only eligibility check before a social RNG draw. */
export function canStartSocialFight(world:World,a:Pawn,b:Pawn):boolean {
  return planSocialFight(world,a,b)!==null;
}
/** Capture both physical routes before interrupting either actor's work. A failed
 * fight roll leaves the social exchange and all work reservations untouched. */
export function startSocialFight(world:World,a:Pawn,b:Pawn):boolean {
  const plans=planSocialFight(world,a,b);if(!plans)return false;
  for(const {pawn} of plans)interruptDraftWork(world,pawn);
  for(const {pawn,target,path} of plans){
    delete pawn.draft;
    pawn.social??={rng:socialSeed(world.seed,pawn.id),memories:[]};
    pawn.social.fight={opponentId:target.id,startedAt:world.tick};
    pawn.melee={order:{targetId:target.id,startedDowned:false,auto:'social'},strike:null};
    pawn.path=path;pawn.planCooldown=0;
    pawn.state=path.length||pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick?'moving':'idle';
  }
  return true;
}

/** End the pair together. Existing strike recovery remains physical and can be
 * saved, while a cancelled participant keeps any newer player order. */
export function finishSocialFight(world:World,pawn:Pawn):void {
  const opponentId=pawn.social?.fight?.opponentId??(pawn.melee?.order?.auto==='social'?pawn.melee.order.targetId:undefined);
  if(opponentId===undefined)return;
  const other=world.pawns.find(p=>p.id===opponentId);
  const pair=other?.social?.fight?.opponentId===pawn.id;
  if(pair)addFightAftermath(world,pawn,other);
  for(const actor of [pawn,...(other?[other]:[])]){
    if(actor.social?.fight&&(actor===pawn||actor.social.fight.opponentId===pawn.id))delete actor.social.fight;
    if(actor.melee?.order?.auto!=='social')continue;
    cancelMelee(actor);actor.path=[];
    if(!medicallyStopped(actor))actor.state=actor.moveCooldown>0||(actor.motion?.end??0)>world.tick?'moving':'idle';
  }
}

/** A cancelled command can leave reciprocal markers until the next simulation
 * pass, but no fighter may take another swing after either order is gone. */
export function activeSocialFight(world:World,pawn:Pawn,targetId:number):boolean {
  const target=world.pawns.find(p=>p.id===targetId);
  return !!target&&!medicallyStopped(pawn)&&!medicallyStopped(target)
    &&pawn.social?.fight?.opponentId===target.id&&target.social?.fight?.opponentId===pawn.id
    &&pawn.melee?.order?.auto==='social'&&pawn.melee.order.targetId===target.id
    &&target.melee?.order?.auto==='social'&&target.melee.order.targetId===pawn.id;
}

/** Core checks recovery every 30 Core ticks after 420 Core ticks of fighting.
 * At MTB 0.02 Core days (1,200 Core ticks), Core Rand.MTBEventOccurs succeeds
 * with chance 30/1200 per check (schema 325); 1-exp(-30/1200) before. */
export function socialFightRecoveryDue(pawn:Pawn,core:number,version:number=0):boolean {
  const state=pawn.social;if(!state?.fight)return false;
  return core-state.fight.startedAt*10>=420&&(core+pawn.id)%30===0
    &&socialRandom(state)<(version>=325?30/1200:1-Math.exp(-30/1200));
}
