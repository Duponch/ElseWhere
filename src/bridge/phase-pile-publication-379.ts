import type {MaterialPile,World} from '../sim/types';
import {capturePileContentCursor379,readPileContentCursor379,ordinaryPileSourceVersion379,type PileContentCursor379} from '../sim/ordinary-pile-source-379';
import {capturePileMembershipCursor379,readPileMembershipCursor379,type PileMembershipCursor379} from '../sim/pile-identity-directory';
import {verifyPileIndex} from '../sim/pile-index';
import {verifyResourceJournal} from '../sim/resource-mutation-journal';
import {verifyTerrainWriteCaches} from '../sim/terrain-mutation-journal';
import {equalDependencyValue297,samePilePresentation297} from './actor-phase-dependencies-297';
import type {CorePilePatch297} from './core-phase-projection-297';

type Baseline=Map<number,Readonly<MaterialPile>>;
interface State {
 readonly baseline:Baseline;
 readonly members:Map<number,MaterialPile>;
 readonly identities:WeakMap<MaterialPile,number>;
 readonly complex:Set<number>;
 content:PileContentCursor379;
 membership:PileMembershipCursor379;
}
export interface PhasePileDraft379 {
 readonly baseline:Baseline;
 /** Full: changes to its private baseline only. Phase: actual wire rows. */
 readonly rows:readonly CorePilePatch297[];
 readonly commit:()=>void;
}
interface Capture {
 full(pile:MaterialPile,previous:Readonly<MaterialPile>|undefined):Readonly<MaterialPile>;
 same(pile:MaterialPile,previous:Readonly<MaterialPile>):boolean;
 patch(pile:MaterialPile):CorePilePatch297;
}
const checking=()=>verifyResourceJournal||verifyPileIndex||verifyTerrainWriteCaches;

/** A persistent, independently cursor-owned pile view for the fixed phase
 * publisher. Membership is advanced by the actual append/splice/filter
 * transactions. Ordinary non-rot components are read only after an actual
 * writer happened; complex components retain exhaustive comparison. The
 * complete public codec, also used as the verification oracle, is unchanged.
 * All directory changes are committed *after* the synchronous packet send. */
export class PhasePilePublication379 {
 private current:State|undefined;
 constructor(private readonly owner:object,private readonly capture:Capture){}
 reset():void {this.current=undefined;}
 prepare(world:World,previous:Baseline|undefined,full:boolean):PhasePileDraft379 {
  const state=this.current;
  const prepared=state&&state.baseline===previous?this.prepareSparse(world,state,full):undefined;
  return prepared??this.prepareComplete(world,previous,full);
 }
 private prepareComplete(world:World,previous:Baseline|undefined,full:boolean):PhasePileDraft379 {
  if(!full&&!previous)throw Error('Pile patch requires a Full pile baseline');
  const baseline=full?new Map<number,Readonly<MaterialPile>>():previous!,members=new Map<number,MaterialPile>(),identities=new WeakMap<MaterialPile,number>(),complex=new Set<number>();
  const rows:CorePilePatch297[]=[];let unique=true;
  for(const pile of world.piles){
   if(members.has(pile.id)||!Number.isSafeInteger(pile.id))unique=false;
   members.set(pile.id,pile);identities.set(pile,pile.id);
   const prior=previous?.get(pile.id);
   if(full)baseline.set(pile.id,this.capture.full(pile,prior));
   else if(!prior||!this.capture.same(pile,prior))rows.push(this.capture.patch(pile));
   if(!ordinaryPileSourceVersion379(pile,this.owner))complex.add(pile.id);
  }
  if(!full&&(members.size!==previous!.size||rows.length))for(const id of previous!.keys())if(!members.has(id))rows.push(Object.freeze({id,pile:null}));
  rows.sort((a,b)=>a.id-b.id);
  // Never use an incomplete identity proof, and do not advance the reader
  // before its enclosing Core publisher validates the actual commit.
  const membership=unique?capturePileMembershipCursor379(world.piles,this.owner):undefined,content=capturePileContentCursor379(this.owner);
  const state=membership?{baseline,members,identities,complex,content,membership}:undefined;
  return {baseline,rows,commit:()=>{this.current=state;}};
 }
 private prepareSparse(world:World,state:State,full:boolean):PhasePileDraft379|undefined {
  const membership=readPileMembershipCursor379(world.piles,this.owner,state.membership),content=readPileContentCursor379(this.owner,state.content);
  if(!membership||!content)return;
  const overlay=new Map<number,MaterialPile|null>();let size=state.members.size;
  const current=(id:number):MaterialPile|undefined=>overlay.has(id)?overlay.get(id)??undefined:state.members.get(id);
  for(const edit of membership.edits){
   for(const pile of edit.removed){if(current(pile.id)!==pile)return;overlay.set(pile.id,null);size--;}
   for(const pile of edit.appended){if(!Number.isSafeInteger(pile.id)||current(pile.id))return;overlay.set(pile.id,pile);size++;}
  }
  if(size!==world.piles.length)return;
  const dirty=new Set<number>(overlay.keys());
  for(const target of content.writes){
   const pile=target as MaterialPile,identity=state.identities.get(pile);
   if(identity!==undefined&&identity!==pile.id)return;
   if(current(pile.id)===pile)dirty.add(pile.id);
  }
  // The bounded journal covers only ordinary writers. A component whose
  // source shape cannot be certified always stays a candidate, even if the
  // membership and every enrolled source retained its old version.
  for(const id of state.complex)if(current(id))dirty.add(id);
  const rows:CorePilePatch297[]=[],classification=new Map<number,boolean>();
  for(const id of dirty){
   const pile=current(id),prior=state.baseline.get(id);
   if(!pile){if(prior)rows.push(Object.freeze({id,pile:null}));classification.set(id,false);continue;}
   if(full){const copy=this.capture.full(pile,prior);if(copy!==prior)rows.push({id,pile:copy});}
   else if(!prior||!this.capture.same(pile,prior))rows.push(this.capture.patch(pile));
   classification.set(id,!ordinaryPileSourceVersion379(pile,this.owner));
  }
  rows.sort((a,b)=>a.id-b.id);
  if(checking())this.verify(world,state,overlay,rows,full,current);
  return {baseline:state.baseline,rows,commit:()=>{
   for(const [id,pile]of overlay){const old=state.members.get(id);if(old&&old!==pile)state.identities.delete(old);
    if(pile){state.members.set(id,pile);state.identities.set(pile,id);}else state.members.delete(id);
   }
   for(const [id,complex]of classification)if(complex)state.complex.add(id);else state.complex.delete(id);
   state.content=content.cursor;state.membership=membership.cursor;
  }};
 }
 private verify(world:World,state:State,overlay:ReadonlyMap<number,MaterialPile|null>,rows:readonly CorePilePatch297[],full:boolean,current:(id:number)=>MaterialPile|undefined):void {
  const seen=new Set<number>(),expected:CorePilePatch297[]=[],written=new Map(rows.map(row=>[row.id,row.pile]));
  for(const pile of world.piles){
   if(seen.has(pile.id)||current(pile.id)!==pile)throw Error('Unmarked pile publication membership write');seen.add(pile.id);
   const prior=state.baseline.get(pile.id);
   if(full){const result=written.get(pile.id)??prior;if(!result||!samePilePresentation297(pile,result))throw Error('Unmarked pile publication content write');}
   else if(!prior||!samePilePresentation297(pile,prior))expected.push({id:pile.id,pile});
  }
  for(const id of state.baseline.keys())if(!seen.has(id)){
   if(full){if(written.get(id)!==null)throw Error('Unmarked pile publication membership write');}
   else expected.push({id,pile:null});
  }
  for(const [id,pile]of overlay)if(pile&&!seen.has(id))throw Error('Unmarked pile publication membership write');
  if(!full&&!equalDependencyValue297(rows,expected.sort((a,b)=>a.id-b.id)))throw Error('Unmarked pile publication content write');
 }
}
