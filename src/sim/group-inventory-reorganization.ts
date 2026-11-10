import {assignPileOwner} from './pile-index.ts';
import {SCHEMA_VERSION} from './types.ts';
import {groupPackedMassGrams258} from './group-freight-mass-258.ts';
import {canMergeEggPile256} from './animal-egg-permission-v256.ts';
import {caravanPawnCapacityGrams256} from './group-animal-capacity-256.ts';
import type {CaravanPhysicalPawn256} from './group-animal-state-256.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {validCaravanBedrollPacks256} from './group-bedroll-capture-256.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import type {MaterialPile,Pawn} from './types.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {mergePileContamination,mergePileEgg256} from './pile-condition.ts';
import {mergeThingDamage} from './thing-damage-rules.ts';
import {mergeRot,rotAge} from './food-preservation.ts';
import {healthRandom} from './health.ts';
export interface GroupInventoryReceipt {sourceId:number;quantity:number;fromPawnId:number;toPawnId:number;fragmentId:number;absorbedById?:number}
export interface GroupInventorySplitDraft {
 packedOriginals:readonly PackedFurniture[];packedSignatures:readonly string[];
 sourcePacked:PackedFurniture[];childPacked:PackedFurniture[];packedUpdates:{original:PackedFurniture;owner:PackedFurniture['owner']}[];
 packedReceipts:{structureId:number;fromPawnId:number;toPawnId:number}[];
 originals:readonly MaterialPile[];signatures:readonly string[];
 source:MaterialPile[];child:MaterialPile[];
 updates:{original:MaterialPile;next:MaterialPile}[];
 nextId:number;rng:number;receipts:GroupInventoryReceipt[];
}
const whole=(v:number)=>Number.isSafeInteger(v)&&v>=1;
const owner=(p:MaterialPile)=>'pawnId'in p.owner?p.owner.pawnId:undefined;
/** Only the current admitted adult-human domain. Animals supply their own real
 * carriers in the subsequent fauna raccord; never turn an animal into a Pawn. */
function canCarry(p:CaravanPhysicalPawn256):boolean{return caravanPawnCapacityGrams256(p)>0;}
function inventoryMass(items:readonly MaterialPile[],id:number,version:number):number|undefined {
 let grams=0;
 for(const p of items)if(owner(p)===id){const mass=groupCaravanPileMass256(p,true,version);if(mass===undefined)return;grams+=mass*p.quantity;if(!Number.isSafeInteger(grams))return;}
 return grams;
}
/** Preflight is private data only. RNG belongs to this draft until all command
 * preconditions are rechecked and the enclosing transaction commits. */
export function draftSplitInventory(members:readonly CaravanPhysicalPawn256[],items:readonly MaterialPile[],childIds:ReadonlySet<number>,lines:readonly {pileId:number;quantity:number}[],nextId:number,rng:number,tick:number,packed:readonly PackedFurniture[]=[],packedIds:readonly number[]=[],stripOwnerId?:number,version:number=SCHEMA_VERSION):GroupInventorySplitDraft|undefined {
 try{
 if(!whole(nextId)||!whole(rng)||rng>0xffffffff||!Number.isSafeInteger(tick)||tick<0||members.length<2||new Set(members.map(p=>p.id)).size!==members.length)return;
 const memberIds=new Set(members.map(p=>p.id)),sourceMembers=members.filter(p=>!childIds.has(p.id)),childMembers=members.filter(p=>childIds.has(p.id));
 if(!sourceMembers.length||!childMembers.length||childMembers.length!==childIds.size||new Set(items.map(p=>p.id)).size!==items.length||new Set(lines.map(l=>l.pileId)).size!==lines.length)return;
 for(const p of items)if(!whole(p.id)||p.id>=nextId||!whole(p.quantity)||!['inventory','apparel','equipment'].includes(p.owner.type)||!memberIds.has(owner(p)??-1))return;
 for(const l of lines){const p=items.find(p=>p.id===l.pileId);if(!p||p.owner.type!=='inventory'||!whole(l.quantity)||l.quantity>p.quantity)return;}
 if(!validCaravanBedrollPacks256(packed,members,nextId,version,tick)||new Set(packedIds).size!==packedIds.length||packedIds.some(id=>!packed.some(p=>p.building.id===id)))return;
 const draftPacks=packed.map(p=>({...p,owner:{...p.owner}})),packedReceipts:GroupInventorySplitDraft['packedReceipts']=[];
 const draft=items.map(p=>{const q=structuredClone(p);if(stripOwnerId!==undefined&&'pawnId'in q.owner&&q.owner.pawnId===stripOwnerId)assignPileOwner(q,{type:'inventory',pawnId:stripOwnerId});return q;}),shares=new Map(items.map(p=>[p.id,new Map([[p.id,p.quantity]])])),receipts:GroupInventoryReceipt[]=[],randomState={rng};let freshId=nextId;
 const mass=(id:number)=>{const grams=inventoryMass(draft,id,version);if(grams===undefined)return;let total=grams;for(const pack of draftPacks)if(pack.owner.type==='inventory'&&pack.owner.pawnId===id){const unit=groupPackedMassGrams258(pack,version);if(unit===undefined)return;total+=unit;}return Number.isSafeInteger(total)?total:undefined;};
 if(members.some(p=>mass(p.id)===undefined))return;
 const choose=(current:number,candidates:readonly CaravanPhysicalPawn256[]):CaravanPhysicalPawn256=>{
  const others=candidates.filter(p=>p.id!==current&&(stripOwnerId===undefined||p.state!=='dead'&&!p.health?.death)),capable=others.filter(canCarry),light=capable.filter(p=>mass(p.id)!<=caravanPawnCapacityGrams256(p)),pool=light.length?light:capable.length?capable:others;
  if(!pool.length)throw Error('Split has no real alternative inventory owner');
  return pool[Math.floor(healthRandom(randomState)*pool.length)]!;
 };
 const splitShares=(p:MaterialPile,count:number,preferred?:number):Map<number,number>=>{
  const source=shares.get(p.id);if(!source)throw Error('Missing inventory provenance');const out=new Map<number,number>();let left=count;
  const order=preferred===undefined?[...source.keys()]:[preferred,...[...source.keys()].filter(id=>id!==preferred)];
  for(const id of order){const n=Math.min(left,source.get(id)??0);if(!n)continue;out.set(id,n);const remains=source.get(id)!-n;if(remains)source.set(id,remains);else source.delete(id);left-=n;if(!left)break;}
  if(left)throw Error('Inventory provenance quantity mismatch');return out;
 };
 const newIdentity=()=>{if(!Number.isSafeInteger(freshId+1))throw Error('Thing identities exhausted');return freshId++;};
 const move=(p:MaterialPile,count:number,target:CaravanPhysicalPawn256,preferred?:number)=>{
  const from=owner(p)!,movedShares=splitShares(p,count,preferred);let fragment=p;
  if(count<p.quantity){fragment=structuredClone(p);fragment.id=newIdentity();fragment.quantity=count;p.quantity-=count;draft.push(fragment);}
  shares.set(fragment.id,movedShares);assignPileOwner(fragment,{type:'inventory',pawnId:target.id});
  // ThingOwner walks existing inventory order, partially filling each real
  // stack before appending the remaining original fragment. Partial absorption
  // itself performs SplitOff, consuming a Thing ID even when absorbed at once.
  if(fragment.kind!=='plant'&&fragment.kind!=='apparel'&&fragment.kind!=='weapon'){
   for(const into of draft.slice()){
    if(into===fragment||into.owner.type!=='inventory'||into.owner.pawnId!==target.id||into.item!==fragment.item||!canMergeEggPile256(into,fragment))continue;
    const n=Math.min(fragment.quantity,ITEM_DEFINITIONS[into.item].stackLimit-into.quantity);if(n<=0)continue;
    const absorbedId=n===fragment.quantity?fragment.id:newIdentity(),absorbedShares=splitShares(fragment,n),targetShares=shares.get(into.id)!;
    for(const [id,units] of absorbedShares)targetShares.set(id,(targetShares.get(id)??0)+units);
    mergePileEgg256(into,n,fragment.egg);mergePileContamination(into,n,fragment.foodPoison);mergeThingDamage(into,n,fragment.damage);mergeRot(into,n,rotAge(fragment,tick),tick);into.quantity+=n;fragment.quantity-=n;
    receipts.push({sourceId:p.id,quantity:n,fromPawnId:from,toPawnId:target.id,fragmentId:absorbedId,absorbedById:into.id});
    if(!fragment.quantity){draft.splice(draft.indexOf(fragment),1);shares.delete(fragment.id);return;}
   }
  }
  receipts.push({sourceId:p.id,quantity:fragment.quantity,fromPawnId:from,toPawnId:target.id,fragmentId:fragment.id});
 };
 const movePack=(pack:PackedFurniture,target:CaravanPhysicalPawn256)=>{if(pack.owner.type!=='inventory')throw Error('Packed thing has no inventory holder');packedReceipts.push({structureId:pack.building.id,fromPawnId:pack.owner.pawnId,toPawnId:target.id});assignPileOwner(pack,{type:'inventory',pawnId:target.id});};
 // Core first empties the selected people's inventories into the retained
 // cohort. Equipment/apparel never enters this redistribution.
 for(const p of childMembers)for(const pile of draft.filter(q=>q.owner.type==='inventory'&&q.owner.pawnId===p.id))move(pile,pile.quantity,choose(p.id,sourceMembers));
 for(const person of childMembers)for(const pack of draftPacks.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===person.id))movePack(pack,choose(person.id,sourceMembers));
 for(const line of lines){
  let remaining=line.quantity;
  // Only the exact opening quantity follows the confirmed ID through actual
  // first-stage coalescences. No item-name fallback can donate substitute goods.
  for(const pile of draft.slice()){
   const held=shares.get(pile.id)?.get(line.pileId)??0;if(!held)continue;
   if(pile.owner.type!=='inventory'||childIds.has(pile.owner.pawnId))throw Error('Chosen inventory lost its source holder');
   const quantity=Math.min(remaining,held);move(pile,quantity,choose(pile.owner.pawnId,childMembers),line.pileId);remaining-=quantity;if(!remaining)break;
  }
  if(remaining)throw Error('Confirmed inventory quantity disappeared');
 }
 for(const id of packedIds){const pack=draftPacks.find(p=>p.building.id===id)!;if(pack.owner.type!=='inventory'||childIds.has(pack.owner.pawnId))throw Error('Packed source holder disappeared');movePack(pack,choose(pack.owner.pawnId,childMembers));}
 const byOriginal=new Map(items.map(p=>[p.id,p])),resolved=new Map<number,MaterialPile>(),updates:GroupInventorySplitDraft['updates']=[];
 for(const pile of draft){const original=byOriginal.get(pile.id);if(original){resolved.set(pile.id,original);updates.push({original,next:pile});}else resolved.set(pile.id,pile);}
 const packedUpdates=draftPacks.map((p,i)=>({original:packed[i]!,owner:p.owner})),sourcePacked=packed.filter((_p,i)=>draftPacks[i]!.owner.type==='inventory'&&!childIds.has((draftPacks[i]!.owner as {pawnId:number}).pawnId)),childPacked=packed.filter(p=>!sourcePacked.includes(p));
 return {packedOriginals:packed,packedSignatures:packed.map(p=>JSON.stringify(p)),sourcePacked,childPacked,packedUpdates,packedReceipts,originals:items,signatures:items.map(p=>JSON.stringify(p)),source:draft.filter(p=>!childIds.has(owner(p)!)).map(p=>resolved.get(p.id)!),child:draft.filter(p=>childIds.has(owner(p)!)).map(p=>resolved.get(p.id)!),updates,nextId:freshId,rng:randomState.rng,receipts};
 }catch{return;}
}
export function splitInventoryDraftCurrent(items:readonly MaterialPile[],draft:GroupInventorySplitDraft,packed:readonly PackedFurniture[]=[]):boolean {
 return packed.length===draft.packedOriginals.length&&packed.every((p,i)=>p===draft.packedOriginals[i]&&JSON.stringify(p)===draft.packedSignatures[i])&&items.length===draft.originals.length&&draft.originals.every((p,i)=>items[i]===p&&JSON.stringify(p)===draft.signatures[i]);
}
/** Enclosing transaction already checks IDs, RNG, tick, group refs and members.
 * No callback, refusal or random draw follows this first write. */
export function commitSplitInventory(draft:GroupInventorySplitDraft):void {
 for(const update of draft.packedUpdates)assignPileOwner(update.original,update.owner);
 for(const {original,next} of draft.updates){
  const target=original as unknown as Record<string,unknown>,source=next as unknown as Record<string,unknown>;
  for(const key of Object.keys(target))if(!Object.hasOwn(source,key))delete target[key];
  for(const key of Object.keys(source))if(JSON.stringify(target[key])!==JSON.stringify(source[key]))target[key]=source[key];
 }
}