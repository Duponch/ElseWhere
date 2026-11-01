import {copyPileCondition} from './pile-condition.ts';
import {mergeThingDamage,pileMaxHp} from './thing-damage-rules.ts';
import {groundMaxStacks} from './shelf-storage.ts';
import {refreshStock} from './materials.ts';
import {removeIdentity} from './collection-remove.ts';
import type {Cell,Job,MaterialPile,World} from './types.ts';

export type DetachedWood301=Omit<MaterialPile,'owner'>&{kind:'wood';item:'wood'};
export interface WoodLeavingsHolder301 {readonly kind:'wood-leavings-holder301'}
type State301={world:World;status:'held'|'consumed'|'ended';pile:DetachedWood301|undefined};
const holders301=new WeakMap<WoodLeavingsHolder301,State301>();
const withdrawn301=new WeakMap<MaterialPile,number>();
function stateOf(holder:WoodLeavingsHolder301,world?:World):State301 {
 const state=holders301.get(holder);
 if(!state||world&&state.world!==world)throw Error('Original wood holder and actual map required');
 return state;
}
function wood(pile:Pick<MaterialPile,'kind'|'item'|'quantity'>):boolean {
 return pile.kind==='wood'&&pile.item==='wood'&&Number.isSafeInteger(pile.quantity)&&pile.quantity>0&&pile.quantity<=75;
}
/** Real one-time withdrawal from a Frame's actual owner-job stack.
 * A partial SplitOff consumes a new identity NOW, even if subsequently absorbed.
 * The detached piece has NO fake MaterialOwner and is not in World.piles.
 * Only this original holder owns it. Whole withdrawal retains the real object.
 *
 * The retired Frame record may already be despawned by its synchronous failure
 * transaction; the original pile must still really be in this map under its
 * matching owner-job. No new source, quantity or condition is fabricated. */
export function takeFrameWood301(world:World,frame:Job,source:MaterialPile,quantity:number):WoodLeavingsHolder301 {
 if(frame.kind!=='wall'||frame.construction!=='frame'||frame.clearance||frame.furniture||frame.wallDoor296
  ||frame.material!==undefined&&frame.material!=='wood'||!world.piles.includes(source)||!wood(source)
  ||source.owner.type!=='job'||source.owner.jobId!==frame.id||withdrawn301.get(source)===frame.id
  ||!Number.isSafeInteger(quantity)||quantity<1||quantity>source.quantity)throw Error('Actual simple Frame wood withdrawal required');
 const split=quantity<source.quantity;
 if(split&&(!Number.isSafeInteger(world.nextId)||world.nextId<1||!Number.isSafeInteger(world.nextId+1)))throw RangeError('Wood split identity budget exhausted');
 let piece:DetachedWood301;
 if(split){
  // Real condition-copy hook also copies the exact forbiddable boolean. This
  // copy is the newly allocated physical split, not a second owned source.
  const {owner:_oldOwner,...fields}=source;
  piece={...fields,...copyPileCondition(source),id:world.nextId++,quantity,kind:'wood',item:'wood'};
  source.quantity-=quantity;
 }else{
  removeIdentity(world.piles,source);
  delete (source as Partial<MaterialPile>).owner;
  piece=source as unknown as DetachedWood301; // actual removal of the owner slot above
 }
 withdrawn301.set(source,frame.id);
 const holder:WoodLeavingsHolder301=Object.freeze({kind:'wood-leavings-holder301'});
 holders301.set(holder,{world,status:'held',pile:piece});
 refreshStock(world);
 return holder;
}
export function readWoodLeavings301(holder:WoodLeavingsHolder301):{
 readonly status:State301['status'];readonly pile:Readonly<DetachedWood301>|undefined;readonly quantity:number;
} {
 const state=stateOf(holder);return {status:state.status,pile:state.pile,quantity:state.pile?.quantity??0};
}
export interface WoodDirectResult301 {
 readonly success:boolean;
 readonly transferred:number;
 readonly remaining:number;
 readonly remainder:Readonly<DetachedWood301>|undefined;
 readonly lastResult:MaterialPile|undefined;
}
/** Actual Direct mutations on an already Near-validated cell, not a selector.
 * Near owns Walkable/CanSpawnAt/indestructibles/room/haul-destination checks.
 * Direct adds NO forbidden, Home, work-reservation or storage-zone veto.
 *
 * Ordinary admitted WoodLog has the same Def/Stuff and no modeled stack veto;
 * CompForbiddable allows stacking and changes neither target flag nor source
 * remainder flag. HP merge uses the existing weighted surviving-HP ceil.
 * Non-wood Items and minified furniture count toward initial Item occupancy.
 * Equal-count order follows this map's existing array order (native equal-key
 * sort order is not claimed). No complete-capacity preflight or rollback. */
export function directDropWood301(world:World,holder:WoodLeavingsHolder301,cell:Cell):WoodDirectResult301 {
 const state=stateOf(holder,world),piece=state.pile;
 if(state.status!=='held'||!piece||!wood(piece))throw Error('Held real wood remainder required; consumed holder cannot replay');
 if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)throw RangeError('Direct requires an in-bounds Near-selected cell');
 const items=world.piles.filter(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z);
 const packed=world.packed.filter(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z).length;
 const initialItemCount=items.length+packed,maxItems=groundMaxStacks(world,cell),before=piece.quantity;
 let lastResult:MaterialPile|undefined;
 // Copy/sort actual cell entries, not World.piles and not an invented ID order.
 for(const target of items.slice().sort((a,b)=>b.quantity-a.quantity)){
  if(!wood(target)||target.quantity>=75)continue;
  const moved=Math.min(piece.quantity,75-target.quantity);
  if(!moved)continue;
  mergeThingDamage(target,moved,piece.damage??0,pileMaxHp(target,world.schemaVersion));
  target.quantity+=moved;piece.quantity-=moved;lastResult=target;
  // No OR/AND, permission comparison or source-to-target forbidden assignment.
  if(piece.quantity===0){state.pile=undefined;state.status='consumed';break;}
 }
 if(state.pile&&maxItems-initialItemCount>0){
  // This scope starts from a real admitted WoodLog stack<=75. Its entire
  // remainder is spawned, with its SAME split/whole identity and conditions.
  // Larger-than-stack inputs cannot be manufactured through this holder.
  if(world.piles.length>=32768)throw RangeError('Frame transaction must preflight the published pile budget');
  const spawned:MaterialPile=Object.assign(piece,{owner:{type:'ground' as const,x:cell.x,z:cell.z}});
  world.piles.push(spawned);lastResult=spawned;state.pile=undefined;state.status='consumed';
 }
 refreshStock(world);
 return {success:state.status==='consumed',transferred:before-(state.pile?.quantity??0),remaining:state.pile?.quantity??0,remainder:state.pile,lastResult};
}
/** Call ONLY at the real end of this synchronous leavings operation.
 * An unfinished piece is explicitly returned without a saved owner; it is NOT
 * silently destroyed, reattached, retried or converted into hidden World stock.
 * Its live record may remain referenced by the caller, as in the native path.
 * Finishing/consuming invalidates this holder's lifecycle, not its prior drops. */
export function finishWoodLeavings301(world:World,holder:WoodLeavingsHolder301):Readonly<DetachedWood301>|undefined {
 const state=stateOf(holder,world);if(state.status==='ended')throw Error('Wood leavings holder already ended');
 const unownedRemainder=state.pile;state.pile=undefined;state.status='ended';return unownedRemainder;
}

