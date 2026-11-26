import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {appendPileEntries} from './pile-identity-directory.ts';
import {assignPileOwner} from './pile-index.ts';
import {isColonist} from './affiliation.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {pawnBody} from './health-rules.ts';
import {carrierOf} from './rescue-state.ts';
import {reservedSource} from './materials.ts';
import {routeToJob} from './pathfinding.ts';
import {urgentMedicalTask} from './urgent-care.ts';
import {drugPolicyFor265,penoxycylinePolicyOf337} from './alcohol-policy-265.ts';
import {copyPileCondition} from './pile-condition.ts';
import {createMedicalRecord} from './injury-state.ts';
import {reconcilePawnHealth,updatePawnHealth} from './health.ts';
import {isPenoxycyline337,scheduledPenoxycylineDue337,applyPenoxycylineDose337,PENOXYCYLINE_FACTS_337} from './penoxycyline-337.ts';
import type {NeedContext} from './needs.ts';
import type {Cell,MaterialPile,NeedTask,Pawn,World} from './types.ts';

/* Schema 337: Core JobGiver_TakeDrugsForDrugPolicy for penoxycyline. When the
 * policy entry makes a dose due, the colonist takes one from its own
 * inventory first, otherwise from the closest reachable allowed stack
 * (FindDrugFor), through the ordinary physical eat job: walk, pick up the
 * same unit, chew it standing (chairSearchRadius 0) for 100 Core ticks, and
 * only then receive PenoxycylineHigh. Adaptation: Core also searches the
 * inventories of colony animals; this game does not. */
type Eat=Extract<NeedTask,{kind:'eat'}>;
export const penoxycylinePile337=(pile:MaterialPile|undefined):pile is MaterialPile&{kind:'drug';item:'penoxycyline'}=>!!pile&&pile.kind==='drug'&&pile.item==='penoxycyline'&&pile.quantity>0;
const sourceCache=new WeakMap<World,{tick:number;piles:MaterialPile[];length:number;doses:MaterialPile[]}>();
function doses(world:World):MaterialPile[]{let cache=sourceCache.get(world);if(!cache||cache.tick!==world.tick||cache.piles!==world.piles||cache.length!==world.piles.length){cache={tick:world.tick,piles:world.piles,length:world.piles.length,doses:world.piles.filter(penoxycylinePile337)};sourceCache.set(world,cache);}return cache.doses;}

export interface PenoxycylinePlan337 {task:Eat;path:Cell[];source:MaterialPile}
/** Core FindDrugFor: own inventory, then the closest reachable spawned unit
 * that is allowed and not entirely reserved by someone else. */
export function planPenoxycyline337(world:World,pawn:Pawn,context:NeedContext):PenoxycylinePlan337|null|undefined {
 const all=doses(world);if(!all.length)return;
 const task=(source:MaterialPile):Eat=>({kind:'eat',drugReason337:'scheduled',phase:'pickup',sourcePileId:source.id,carryPileId:null,quantity:1,progress:0,dining:null});
 const owned=all.find(p=>p.owner.type==='inventory'&&p.owner.pawnId===pawn.id);
 if(owned)return {source:owned,path:[],task:task(owned)};
 const candidates=all.filter(p=>p.owner.type==='ground'&&materialAllowedForPlayer256(p)&&allowedAreaAllows(world,pawn,p.owner)&&!world.tiles[p.owner.z*world.width+p.owner.x]?.fogged&&p.quantity>reservedSource(world,p.id,pawn.id));
 if(!candidates.length)return;
 const goals=new Set(candidates.map(p=>{const o=p.owner as {x:number;z:number};return o.z*world.width+o.x;})),reach=context.search(goals);if(!reach)return null;
 let best:PenoxycylinePlan337|undefined;
 for(const source of candidates){if(source.owner.type!=='ground')continue;const path=routeToJob(world,source.owner,reach,true);if(!path)continue;
  if(!best||path.length<best.path.length||path.length===best.path.length&&source.id<best.source.id)best={source,path,task:task(source)};
 }
 return best;
}
/** The engine calls after automatic beer, before work and recreation; the
 * same tick-local navigation and conservative cargo release are shared. */
export function processScheduledPenoxycyline337(world:World,pawn:Pawn,context:NeedContext):boolean {
 if(!isPenoxycyline337(world.schemaVersion)||pawn.need||pawn.needCooldown>0||pawn.orders.active!==null||pawn.draft||!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||['dead','downed','sleeping'].includes(pawn.state)||pawn.medicalSleep||pawn.health?.death||pawn.health?.body!==undefined)return false;
 const entry=penoxycylinePolicyOf337(drugPolicyFor265(world,pawn));
 if(!entry.allowScheduled||!scheduledPenoxycylineDue337(world.tick,pawn,entry))return false;
 if(carrierOf(world,pawn.id)||urgentMedicalTask(pawn,world)||pawn.interruptedCargo||pawn.burning||pawn.bombRefuge||pawn.heatRefuge||pawn.stun||pawn.melee||pawn.shooting||pawn.mental?.crisis)return false;
 if(!doses(world).length)return false;
 const body=pawnBody(pawn);if(body.capacities.eating<=0||body.capacities.manipulation<=0)return false;
 const plan=planPenoxycyline337(world,pawn,context);if(plan===null)return true;
 if(!plan){pawn.needCooldown=20;return false;}
 if(plan.source.quantity>1&&plan.source.owner.type==='ground'&&(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1)))return false;
 if(!context.release())return true;
 pawn.need=plan.task;pawn.path=plan.path;pawn.state='moving';pawn.planCooldown=0;pawn.needCooldown=0;return true;
}
/** Core TakeItemFromInventoryToCarrier: one unit leaves the actor's own
 * inventory for its hands; any remainder keeps its stack and identity. */
export function takeOwnedPenoxycyline337(world:World,pawn:Pawn,source:MaterialPile,task:Eat):boolean {
 if(source.owner.type!=='inventory'||source.owner.pawnId!==pawn.id||task.quantity!==1||!penoxycylinePile337(source))return false;
 if(source.quantity===1){assignPileOwner(source,{type:'pawn',pawnId:pawn.id});task.carryPileId=source.id;}
 else {if(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return false;markPileContentWrite379(source).quantity--;const id=world.nextId++;appendPileEntries(world.piles,{id,item:'penoxycyline',kind:'drug',quantity:1,owner:{type:'pawn',pawnId:pawn.id},...copyPileCondition(source)});task.carryPileId=id;}
 task.phase='choose-spot';pawn.path=[];pawn.state='moving';return true;
}
/** Called only after the real held unit was removed at the ingest contact. */
export function ingestPenoxycyline337(world:World,pawn:Pawn):void {
 if(!isPenoxycyline337(world.schemaVersion))throw Error('Future penoxycyline ingestion');
 if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
 pawn.health??=createMedicalRecord(world.tick);
 applyPenoxycylineDose337(pawn.health,pawn.id,world.tick);
 reconcilePawnHealth(world,pawn);
}
export const PENOXYCYLINE_INGEST_TICKS_337=PENOXYCYLINE_FACTS_337.ingestTicks;
