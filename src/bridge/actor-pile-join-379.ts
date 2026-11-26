import type {MaterialPile,World} from '../sim/types';
import {capturePileContentCursor379,readPileContentCursor379,captureOrdinaryPileSource379,type PileContentCursor379} from '../sim/ordinary-pile-source-379';
import {capturePileMembershipCursor379,readPileMembershipCursor379,type PileMembershipCursor379} from '../sim/pile-identity-directory';
import {verifyPileIndex} from '../sim/pile-index';
import {verifyResourceJournal} from '../sim/resource-mutation-journal';
import {verifyTerrainWriteCaches} from '../sim/terrain-mutation-journal';
import {ResourcePublicationOrder} from './resource-publication-order';

export interface ActorPileJoin379 {
 /** Source order, including every possible body and actor-owned visual row. */
 readonly rows:readonly MaterialPile[];
 byId(id:number):MaterialPile|undefined;
}
interface State {
 readonly order:ResourcePublicationOrder<MaterialPile>;
 readonly active:Set<number>;
 readonly complex:Set<number>;
 rows:readonly MaterialPile[];
 content:PileContentCursor379;
 membership:PileMembershipCursor379;
}
const relevant=(pile:MaterialPile):boolean=>!!(pile.humanCorpse||pile.corpse||pile.mechCorpse)||pile.owner.type==='pawn'||pile.owner.type==='equipment'||pile.owner.type==='apparel';
const checking=()=>verifyResourceJournal||verifyPileIndex||verifyTerrainWriteCaches;
const NO_CANDIDATES:ReadonlySet<number>=new Set();

/** Read-only join for the actual fixed Worker. The directory takes shape
 * proofs from the same actual writers as the Full/phase codecs. Cold ground
 * commodities no longer rebuild the apparel/cargo/body lists each macro.
 * Complex rows still re-evaluate their current components. Source order is
 * retained (last body/equipment/held row and first meal identities are exact).
 * It is a borrowed synchronous input, never a new gameplay/renderer owner. */
export class ActorPileJoinOwner379 {
 private state:State|undefined;
 constructor(private readonly owner:object){}
 reset():void {this.state=undefined;}
 private seed(world:World):State|undefined {
  const order=ResourcePublicationOrder.capture(world.piles),membership=capturePileMembershipCursor379(world.piles,this.owner);
  if(!order||!membership)return;
  const active=new Set<number>(),complex=new Set<number>(),rows:MaterialPile[]=[];
  for(const pile of world.piles){if(relevant(pile)){active.add(pile.id);rows.push(pile);}if(!captureOrdinaryPileSource379(pile,this.owner))complex.add(pile.id);}
  return {order,membership,content:capturePileContentCursor379(this.owner),active,complex,rows};
 }
 capture(world:World):ActorPileJoin379|undefined {
  let state=this.state;
  if(state&&!this.advance(world,state))state=undefined;
  if(!state)state=this.seed(world);
  this.state=state;if(!state)return;
  if(checking()){
   const rows=world.piles.filter(relevant);
   if(rows.length!==state.rows.length||rows.some((pile,i)=>pile!==state!.rows[i])||world.piles.some(pile=>state!.order.row(pile.id)!==pile))throw Error('Unmarked actor pile join write');
  }
  const held=state;return {rows:held.rows,byId:id=>held.order.row(id)};
 }
 private advance(world:World,state:State):boolean {
  const membership=readPileMembershipCursor379(world.piles,this.owner,state.membership),content=readPileContentCursor379(this.owner,state.content);
  if(!membership||!content||membership.edits.some(edit=>edit.unordered))return false;
  const members=new Set<number>(),dirty=new Set(state.complex);
  for(const edit of membership.edits){for(const pile of edit.removed){members.add(pile.id);dirty.add(pile.id);}for(const pile of edit.appended){members.add(pile.id);dirty.add(pile.id);}}
  for(const source of content.writes)dirty.add((source as MaterialPile).id);
  if(membership.edits.length&&!state.order.prepare(membership.edits,NO_CANDIDATES,world.piles.length))return false;
  let changed=false;
  for(const id of dirty){
   const pile=state.order.row(id);
   if(!pile){if(state.active.delete(id))changed=true;state.complex.delete(id);continue;}
   if(relevant(pile)){if(!state.active.has(id)||members.has(id))changed=true;state.active.add(id);}
   else if(state.active.delete(id))changed=true;
   // Known complex components remain exhaustive (including an in-place
   // nested mutation). An ordinary shape changed at a real non-rot writer
   // is rechecked before it can remain cold; a replaced row starts anew.
   if(members.has(id)||!state.complex.has(id)){if(captureOrdinaryPileSource379(pile,this.owner))state.complex.delete(id);else state.complex.add(id);}
  }
  if(changed)state.rows=state.order.orderedRows(state.active);
  if(membership.edits.length)state.order.commit();state.content=content.cursor;state.membership=membership.cursor;return true;
 }
}
