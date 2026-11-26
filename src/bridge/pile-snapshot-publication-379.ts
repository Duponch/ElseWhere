import type {MaterialPile,World} from '../sim/types';
import {capturePileContentCursor379,readPileContentCursor379,ordinaryPileSourceVersion379,type PileContentCursor379} from '../sim/ordinary-pile-source-379';
import {capturePileMembershipCursor379,readPileMembershipCursor379,type PileMembershipCursor379} from '../sim/pile-identity-directory';
import {ResourcePublicationOrder,type ResourcePublicationCandidates} from './resource-publication-order';

interface State {
 readonly order:ResourcePublicationOrder<MaterialPile>;
 readonly hot:Set<number>;
 content:PileContentCursor379;
 membership:PileMembershipCursor379;
}
/** Fixed Full codec only. Every admitted ordinary pile without a rot clock
 * is a cold component: its real writes and membership commits alone select
 * it for comparison. Rot-bearing/complex piles are always hot candidates,
 * as the independent rot and complex nested writers remain exhaustive. The
 * same ranked order owner handles remove/append edges for resources/piles. */
export class PileSnapshotPublication379 {
 private state:State|undefined;
 private pending:{state:State;content:PileContentCursor379;membership:PileMembershipCursor379;candidates:ResourcePublicationCandidates<MaterialPile>}|undefined;
 private world:World|undefined;
 private rebuild=false;
 constructor(private readonly owner:object){}
 private hot(pile:MaterialPile):boolean {return Object.hasOwn(pile,'rot')||!ordinaryPileSourceVersion379(pile,this.owner);}
 reset(world:World):void {this.world=world;this.pending=undefined;this.rebuild=true;}
 previousOrder():number[]|undefined {return this.state?.order.publishedOrder();}
 prepare(world:World):ResourcePublicationCandidates<MaterialPile>|undefined {
  this.world=world;this.pending=undefined;this.rebuild=true;
  const state=this.state;if(!state)return;
  const membership=readPileMembershipCursor379(world.piles,this.owner,state.membership),content=readPileContentCursor379(this.owner,state.content);
  if(!membership||!content||membership.edits.some(edit=>edit.unordered))return;
  const dirty=new Set(state.hot);
  for(const edit of membership.edits){for(const pile of edit.removed)dirty.add(pile.id);for(const pile of edit.appended)dirty.add(pile.id);}
  for(const target of content.writes)dirty.add((target as MaterialPile).id);
  const candidates=state.order.prepare(membership.edits,dirty,world.piles.length);if(!candidates)return;
  this.pending={state,content:content.cursor,membership:membership.cursor,candidates};this.rebuild=false;return candidates;
 }
 commit():void {
  const world=this.world;if(!world)return;
  if(this.rebuild){
   const order=ResourcePublicationOrder.capture(world.piles),membership=capturePileMembershipCursor379(world.piles,this.owner);
   this.state=order&&membership?{order,membership,content:capturePileContentCursor379(this.owner),hot:new Set(world.piles.filter(pile=>this.hot(pile)).map(pile=>pile.id))}:undefined;
  }else if(this.pending){
   const {state,membership,content,candidates}=this.pending;
   state.order.commit();state.membership=membership;state.content=content;
   for(const id of candidates.dirtyIds){const pile=state.order.row(id);if(pile&&this.hot(pile))state.hot.add(id);else state.hot.delete(id);}
  }
  this.pending=undefined;this.rebuild=false;this.world=undefined;
 }
 clear():void {this.state=undefined;this.pending=undefined;this.rebuild=false;this.world=undefined;}
}
