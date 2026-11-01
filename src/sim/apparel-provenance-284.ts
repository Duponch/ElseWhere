import {isSchema284OrLater} from './schema-compatibility-257.ts';
import type {MaterialPile,Pawn} from './types.ts';

/** Absence is unknown historical provenance, never evidence of cleanliness. */
export function validApparelProvenance284(apparel:unknown,version:number):boolean {
 if(!Number.isInteger(version)||version<0||version>301||!apparel||typeof apparel!=='object')return false;
 const d=Object.getOwnPropertyDescriptor(apparel,'corpseWear284');
 if(!d)return !('corpseWear284'in apparel);
 return isSchema284OrLater(version)&&d.enumerable===true&&Object.hasOwn(d,'value')&&typeof d.value==='boolean';
}

/** Called at the real death event BEFORE stripping/redistributing possessions.
 * All currently delivered Apparel types care about corpse wear, including armor
 * and helmets. Inventory cargo is not worn apparel. No ID, RNG or clinical work. */
export function markCorpseWornApparel284(items:readonly (Pick<MaterialPile,'kind'|'apparel'>&{owner:{type:string;pawnId?:number}})[],pawn:Pick<Pawn,'id'|'state'|'health'>,version:number):void {
 if(!isSchema284OrLater(version)||pawn.state!=='dead'||!pawn.health?.death)return;
 for(const pile of items)if(pile.kind==='apparel'&&pile.apparel&&pile.owner.type==='apparel'&&pile.owner.pawnId===pawn.id&&pile.apparel.corpseWear284!==true)pile.apparel.corpseWear284=true;
}

/** Before historical migration/adoption only. Current custody and field guards
 * own284; its normal save/adoption path pays no recursive historical scan. */
export function validApparelProvenanceHistoricalTransport284(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>301)return false;
 if(isSchema284OrLater(version))return true;
 const domains=['piles','pawns','structures','jobs','packed','worldMaps','secondarySite','campaignMap','worldGroups','worldPawns','worldFactions','group','groupLosses','commercialTrip','civilianPost','visitors','raids','trade','orbital','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','wildlife'];
 let budget=2_000_000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype||'corpseWear284'in v)return false;
  active.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return false;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(!walk(d.value))return false;
  }
  active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const envelope=Object.getOwnPropertyDescriptor(value,'world');if(envelope&&!Object.hasOwn(envelope,'value'))return false;
  const root=envelope?.value&&typeof envelope.value==='object'?envelope.value:value;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in root)return false;}
  if(root!==value)for(const key of ['piles','pawns','structures','jobs','packed']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in value)return false;}
  return true;
 }catch{return false;}
}
