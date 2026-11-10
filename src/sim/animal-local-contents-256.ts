import {assignPileOwner} from './pile-index.ts';
import {groupPackedMassGrams258} from './group-freight-mass-258.ts';
import {captureDuckFlyerOwners256,heldDuckAnimal256} from './duck-owner-capture-256.ts';
import type {DuckFlyer256} from './duck-flyer-state-256.ts';
import {refreshStock} from './materials.ts';
import {cancelGroupPreparation} from './group-authority.ts';
import {localWorldGroups,registeredCampaign,withWorldGroup} from './world-map-context.ts';
import type {World,MaterialPile,Cell} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import {pawnContentsLocation} from './human-corpses.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {furnitureDropCell} from './furniture-transfer.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
const data=(v:unknown,key:string):unknown=>{if(!v||typeof v!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(v,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const corpseId=(pile:MaterialPile):number|undefined=>{const id=data(data(pile,'corpse'),'animalId');return typeof id==='number'&&Number.isSafeInteger(id)&&id>0&&data(pile,'id')===id?id:undefined;};
export type ActualAnimalContentsOwner256={kind:'animal';animal:WildAnimal;holder?:DuckFlyer256}|{kind:'corpse';pile:MaterialPile};
/** Operation-local index of originals, not a persistent witness or cache. */
export function captureAnimalContentsOwners256(w:Pick<World,'schemaVersion'|'wildlife'|'piles'>):ReadonlyMap<number,ActualAnimalContentsOwner256> {
 const owners=new Map<number,ActualAnimalContentsOwner256>();if(w.schemaVersion<256)return owners;
 for(const animal of w.wildlife?.animals??[]){if(owners.has(animal.id))throw Error('Duplicate actual animal owner');owners.set(animal.id,{kind:'animal',animal});}
 for(const f of captureDuckFlyerOwners256(w)){if(owners.has(f.animal.id))throw Error('Duplicate actual held animal owner');owners.set(f.animal.id,{kind:'animal',animal:f.animal,holder:f.holder});}
 for(const pile of w.piles){const id=corpseId(pile);if(id===undefined)continue;if(owners.has(id))throw Error('Duplicate actual animal corpse owner');owners.set(id,{kind:'corpse',pile});}return owners;
}
export function animalContentsOwner256(w:Pick<World,'wildlife'>&{schemaVersion:number;piles?:readonly MaterialPile[]},id:number):ActualAnimalContentsOwner256|undefined {
 if(w.schemaVersion<256)return;const local=w.wildlife?.animals.find(a=>a.id===id),held=heldDuckAnimal256(w,id),pile=w.piles?.find(p=>corpseId(p)===id);
 if(local&&held||(local||held)&&pile)throw Error('Animal has two physical owners');
 if(local)return {kind:'animal',animal:local};
 if(held){const holder=w.wildlife!.flyers!.find(f=>f.animal===held)!;return {kind:'animal',animal:held,holder};}
 return pile&&pile.id===id?{kind:'corpse',pile}:undefined;
}
export function animalContentsLocation256(w:World,id:number):{cell:Cell;suspended:boolean}|null {
 const owner=animalContentsOwner256(w,id);if(!owner)return null;if(owner.kind==='animal')return {cell:owner.holder?.cell??owner.animal,suspended:owner.holder!==undefined};
 const o=owner.pile.owner;if(o.type==='ground')return {cell:o,suspended:false};if(o.type==='pawn'){const carrier=w.pawns.find(p=>p.id===o.pawnId);return carrier?pawnContentsLocation(w,carrier):null;}return null;
}
/** Call once on the real local death transition, with spawned captured before
 * service cleanup. Failed drops stay in the true animal/corpse holder. */
export function dropAnimalContentsOnDeath256(w:World,a:WildAnimal,wasSpawned:boolean):void {
 if(w.schemaVersion<256||!wasSpawned)return;if(!w.wildlife?.animals.includes(a)||!a.health?.death)throw Error('Actual local dead animal required');
 const cell=a.motion&&a.motion.end>w.tick?a.motion.from:a;
 for(const p of w.piles)if(p.owner.type==='inventory'&&p.owner.pawnId===a.id)dropRetainingIdentity(w,p,cell);
 for(const p of w.packed)if(p.owner.type==='inventory'&&p.owner.pawnId===a.id){const drop=furnitureDropCell(w,cell);if(drop)assignPileOwner(p,{type:'ground',...drop});}
 refreshStock(w);
}
/** Contents are counted once through their actual holder. Caller adds the
 * already resolved bare corpse mass once; this helper does not admit freight. */
export function animalContentsMassGrams256(w:World,id:number):number|undefined {
 if(!animalContentsOwner256(w,id))return;let grams=0;const ids=new Set<number>();
 for(const p of w.piles)if(p.owner.type==='inventory'&&p.owner.pawnId===id){const unit=groupCaravanPileMass256(p,true,w.schemaVersion);if(unit===undefined||ids.has(p.id)||!Number.isSafeInteger(p.quantity)||p.quantity<1)return;ids.add(p.id);grams+=unit*p.quantity;if(!Number.isSafeInteger(grams))return;}
 for(const p of w.packed)if(p.owner.type==='inventory'&&p.owner.pawnId===id){const unit=groupPackedMassGrams258(p,w.schemaVersion);if(unit===undefined||ids.has(p.building.id))return;ids.add(p.building.id);grams+=unit;if(!Number.isSafeInteger(grams))return;}return grams;
}

/** Retire only the local intention whose actual referenced animal died.
 * cancelGroupPreparation preserves committed human/animal motion and goods. */
export function cancelAnimalLocalGroupIntents256(w:World,id:number):void {
 if(w.schemaVersion<256)return;const ids=localWorldGroups(w).filter(r=>{const g=r.state;return 'manifest'in g?g.animalPreparation?.lines.some(l=>l.animalId===id):g.phase==='unloading'&&g.animalIds?.includes(id);}).map(r=>r.state.id);
 for(const groupId of ids)withWorldGroup(registeredCampaign(w),groupId,actual=>cancelGroupPreparation(actual));
 if(!w.worldGroups&&w.group&&('manifest'in w.group?w.group.animalPreparation?.lines.some(l=>l.animalId===id):w.group.phase==='unloading'&&w.group.animalIds?.includes(id)))cancelGroupPreparation(w);
}

export function animalCorpseMassWithContents256(w:World,corpse:MaterialPile,bareGrams:number):number|undefined {
 if(!w.piles.includes(corpse)||!corpse.corpse||!Number.isSafeInteger(bareGrams)||bareGrams<0)return;const contents=animalContentsMassGrams256(w,corpse.corpse.animalId);if(contents===undefined||!Number.isSafeInteger(bareGrams+contents))return;return bareGrams+contents;
}
