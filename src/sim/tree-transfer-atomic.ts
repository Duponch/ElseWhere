import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
/** Atomic transactions bound to actual World arrays and owners. */
import type {Cell,MaterialOwner,MaterialPile,Resource} from './types.ts';
import type {PlantLife} from './plant-life.ts';
import {PLANT_LIFE_INTERVAL} from './plant-life.ts';
import {treeExpiryYield,treePackDeadline,extractTreeDefinition,treePackLive,treePackExpiry271} from './tree-transfer-rules.ts';
import type {MinifiedTreePile,TreeJob,TreeOutput} from './tree-transfer-state.ts';
export type PausedTreeLife=PlantLife&{pausedTicks:number;ageTick:number;leaflessPausedTicks?:number};
export interface TreePileRef {pile:MinifiedTreePile;container:unknown;clock:number;active:boolean}
export interface TreeExpiryOutputPlan {
  outputs:readonly TreeOutput[];newIds:number;
  /** Immutable host plan, including real owner/container and prospective freed slot. */
  token:unknown;
}
export interface TreeHost {
  tick:number;nextId:number;rng:number;
  resource(id:number):Resource|undefined;
  resourceIsExact(resource:Resource):boolean;
  pile(id:number):TreePileRef|undefined;
  job(id:number):TreeJob|undefined;
  /** Must exclude the source being removed but retain all other live reservations. */
  extractionCell(resource:Resource,job:TreeJob):Cell|undefined;
  extractionReady(job:TreeJob,resource:Resource):boolean;
  replantReady(job:TreeJob,pile:MinifiedTreePile):boolean;
  /** A retired wrapper frees exactly one slot in its actual owner container. */
  idsAvailable(count:number,retiring?:TreePileRef):boolean;
  /** Real local arrays only. Must replace arrays to invalidate geometry caches. */
  removeResource(resource:Resource):void;
  addResource(resource:Resource):void;
  removePile(ref:TreePileRef):void;
  addGroundTree(pile:MinifiedTreePile):void;
  /** Drop/split/mass checks include foreign real containers, never a fake home map. */
  expiryYieldFactor(ref:TreePileRef):number;
  expiryOutput(ref:TreePileRef,quantity:number):TreeExpiryOutputPlan|undefined;
  expiryOutputStillValid(ref:TreePileRef,plan:TreeExpiryOutputPlan):boolean;
  commitExpiryOutput(ref:TreePileRef,plan:TreeExpiryOutputPlan):void;
  /** Release source-ID rivals/clearance and real carrier task after committing goods. */
  removeTreeClaims(resourceId:number,wrapperId?:number,completedJobId?:number,expiry?:true):void;
  finish(job:TreeJob):void;
  /** Captured source-cell growth, not contained coordinates queried after removal. */
  growth(resource:Resource):number;
  reconcileReplantedGrowth(resource:Resource):void;
}
const fingerprint=(value:unknown):string=>JSON.stringify(value);
export interface ExtractPlan {tick:number;nextId:number;job:TreeJob;source:Resource;signature:string;cell:Cell;growth:number}
export function planTreeExtraction(host:TreeHost,job:TreeJob):ExtractPlan|undefined {
  if(job.tree.kind!=='extract')return;
  const source=host.resource(job.tree.resourceId);
  if(!source||!extractTreeDefinition(source)||job.progress<extractTreeDefinition(source)!.workCore||!host.extractionReady(job,source)||!host.idsAvailable(1))return;
  const cell=host.extractionCell(source,job);if(!cell)return;
  const growth=host.growth(source);if(!Number.isFinite(growth)||growth<0||growth>1)return;
  return {tick:host.tick,nextId:host.nextId,job,source,signature:fingerprint(source),cell:{...cell},growth};
}
export function commitTreeExtraction(host:TreeHost,plan:ExtractPlan):MinifiedTreePile|undefined {
  if(host.tick!==plan.tick||host.nextId!==plan.nextId||host.job(plan.job.id)!==plan.job||
    !host.resourceIsExact(plan.source)||fingerprint(plan.source)!==plan.signature||
    !host.extractionReady(plan.job,plan.source)||!host.idsAvailable(1))return;
  const cell=host.extractionCell(plan.source,plan.job);
  if(!cell||cell.x!==plan.cell.x||cell.z!==plan.cell.z)return;
  // No draw or allocation happens before the full physical preflight.
  const original=plan.source;
  if(original.species!==undefined){original.growth=plan.growth;original.growthTick=host.tick;}
  const pile:MinifiedTreePile={id:host.nextId,kind:'plant',item:'minified-tree',quantity:1,
    owner:{type:'ground',...plan.cell},innerResource:original,
    plantPack:{packedAt:host.tick,expiresAt:treePackDeadline(host.tick)}};
  host.nextId++;host.removeResource(original);host.addGroundTree(pile);
  host.removeTreeClaims(original.id,undefined,plan.job.id);host.finish(plan.job);return pile;
}
/** Resume the same age and birth; packed elapsed time is explicitly excluded. */
export function resumeTreeLife(resource:Resource,packedAt:number,tick:number):void {
  const old=resource.plantLife;if(!old)return;
  const pause=tick-packedAt;if(pause<0)throw Error('Tree owner clock moved backwards');
  const previous=old as Partial<PausedTreeLife>&PlantLife;
  const ageTick=(previous.ageTick??Math.max(old.since,old.nextCheck-PLANT_LIFE_INTERVAL))+pause;
  const life:PausedTreeLife={...old,pausedTicks:(previous.pausedTicks??0)+pause,ageTick,
    nextCheck:tick+(resource.id-tick%PLANT_LIFE_INTERVAL+PLANT_LIFE_INTERVAL)%PLANT_LIFE_INTERVAL+1};
  if(old.leaflessAt!==undefined){life.leaflessAt=old.leaflessAt+pause;life.leaflessPausedTicks=(previous.leaflessPausedTicks??0)+pause;}
  resource.plantLife=life;
}
export interface ReplantPlan {tick:number;nextId:number;job:TreeJob;ref:TreePileRef;signature:string}
export function planTreeReplantation(host:TreeHost,job:TreeJob):ReplantPlan|undefined {
  if(job.tree.kind!=='replant'||job.tree.phase!=='prepare'||job.tree.carryPileId===null)return;
  const ref=host.pile(job.tree.carryPileId);
  if(!ref||!ref.active||ref.pile.owner.type!=='pawn'||ref.pile.owner.pawnId!==job.reservedBy||
    ref.pile.innerResource.id!==job.tree.resourceId||!treePackLive(ref.pile,host.tick)||
    !host.replantReady(job,ref.pile))return;
  return {tick:host.tick,nextId:host.nextId,job,ref,signature:fingerprint(ref.pile)};
}
export function commitTreeReplantation(host:TreeHost,plan:ReplantPlan):Resource|undefined {
  if(host.tick!==plan.tick||host.nextId!==plan.nextId||host.job(plan.job.id)!==plan.job||
    host.pile(plan.ref.pile.id)?.pile!==plan.ref.pile||fingerprint(plan.ref.pile)!==plan.signature||
    !host.replantReady(plan.job,plan.ref.pile)||!treePackLive(plan.ref.pile,host.tick))return;
  const original=plan.ref.pile.innerResource;
  if(host.resource(original.id))return; // No coexistence with a forged clone.
  resumeTreeLife(original,plan.ref.pile.plantPack.packedAt,host.tick);
  Object.assign(original,{x:plan.job.x,z:plan.job.z});
  if(original.species!==undefined)original.growthTick=host.tick;
  host.removePile(plan.ref);host.addResource(original);
  host.reconcileReplantedGrowth(original);host.removeTreeClaims(original.id,plan.ref.pile.id,plan.job.id);host.finish(plan.job);
  return original;
}
export interface ExpiryPlan {tick:number;nextId:number;beforeRng:number;afterRng:number;ref:TreePileRef;signature:string;output:TreeExpiryOutputPlan}
export function planTreeExpiry(host:TreeHost,ref:TreePileRef,destroyed=false):ExpiryPlan|undefined {
  if(!ref.active||!destroyed&&host.tick<treePackExpiry271(ref.pile))return;
  const pending=ref.pile.plantPack.pendingExpiry,roll=pending?{quantity:pending.quantity,rng:host.rng}:treeExpiryYield(ref.pile,host.rng,host.expiryYieldFactor(ref));if(!roll)return;
  const output=host.expiryOutput(ref,roll.quantity);
  if(!output||!host.idsAvailable(output.newIds,ref))return;
  if(output.outputs.reduce((n,o)=>n+o.quantity,0)!==roll.quantity)return;
  return {tick:host.tick,nextId:host.nextId,beforeRng:host.rng,afterRng:roll.rng,ref,signature:fingerprint(ref.pile),output};
}
export function commitTreeExpiry(host:TreeHost,plan:ExpiryPlan):boolean {
  if(host.tick!==plan.tick||host.nextId!==plan.nextId||host.rng!==plan.beforeRng||
    host.pile(plan.ref.pile.id)?.pile!==plan.ref.pile||fingerprint(plan.ref.pile)!==plan.signature||
    !host.expiryOutputStillValid(plan.ref,plan.output)||!host.idsAvailable(plan.output.newIds,plan.ref))return false;
  // Adapter commits removal/new IDs in one transaction; a held owner stays at the
  // same physical container. It interrupts current work without ending a live edge.
  host.removePile(plan.ref);host.commitExpiryOutput(plan.ref,plan.output);host.rng=plan.afterRng;
  host.removeTreeClaims(plan.ref.pile.innerResource.id,plan.ref.pile.id,undefined,true);return true;
}
export interface PendingExpiryPlan {tick:number;nextId:number;beforeRng:number;afterRng:number;ref:TreePileRef;signature:string;quantity:number;retryAt:number}
/** Only the first failed expiry captures a draw. No lifetime is extended. */
export function planPendingTreeExpiry(host:TreeHost,ref:TreePileRef):PendingExpiryPlan|undefined {
  if(!ref.active||host.tick<treePackExpiry271(ref.pile)||ref.pile.plantPack.pendingExpiry||!Number.isSafeInteger(host.tick+20))return;
  const roll=treeExpiryYield(ref.pile,host.rng,host.expiryYieldFactor(ref));if(!roll||roll.quantity<1)return;
  return {tick:host.tick,nextId:host.nextId,beforeRng:host.rng,afterRng:roll.rng,ref,signature:fingerprint(ref.pile),quantity:roll.quantity,retryAt:host.tick+20};
}
export function commitPendingTreeExpiry(host:TreeHost,plan:PendingExpiryPlan):boolean {
  if(host.tick!==plan.tick||host.nextId!==plan.nextId||host.rng!==plan.beforeRng||host.pile(plan.ref.pile.id)?.pile!==plan.ref.pile||fingerprint(plan.ref.pile)!==plan.signature)return false;
  markPileContentWrite379(plan.ref.pile).plantPack={...plan.ref.pile.plantPack,pendingExpiry:{quantity:plan.quantity,retryAt:plan.retryAt}};
  host.rng=plan.afterRng;host.removeTreeClaims(plan.ref.pile.innerResource.id,plan.ref.pile.id,undefined,true);return true;
}
