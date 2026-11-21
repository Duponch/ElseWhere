import {isDoubleBedKind} from './bed-kinds.ts';
import type {Pawn,Structure} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {isBedKind} from './bed-kinds.ts';
export interface ActorMapBed256 {revision:1;mapId:number|null;bedId:number;slot?:0|1}
export interface ActualBedReference256 {id:number;mapId:number|null;animal:boolean;slots:1|2}
export type BedActor256=(Pawn|WildAnimal)&{mapBed?:ActorMapBed256};
const animal=(a:BedActor256):a is WildAnimal&{mapBed?:ActorMapBed256}=>'species'in a;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function reference(b:Structure,mapId:number|null):ActualBedReference256|undefined {return b.kind==='animal-sleeping-spot'?{id:b.id,mapId,animal:true,slots:1}:isBedKind(b.kind)?{id:b.id,mapId,animal:false,slots:isDoubleBedKind(b.kind)?2:1}:undefined;}
/** Only real originals supplied by the enclosing physical-owner capture.
 * A packed bed is the same original, with no spawned Map. */
export function actualBedReferences256(mapId:number,structures:readonly Structure[],packed:readonly PackedFurniture[]):ActualBedReference256[] {
 const refs:ActualBedReference256[]=[];for(const b of structures){const r=reference(b,mapId);if(r)refs.push(r);}for(const p of packed){const r=reference(p.building,null);if(r)refs.push(r);}return refs;
}
export function validActorMapBedField256(value:unknown,version:number,nextId:number):boolean {
 if(!value||typeof value!=='object')return false;const d=Object.getOwnPropertyDescriptor(value,'mapBed');if(!d)return true;
 if(version<256||!Object.hasOwn(d,'value')||!d.enumerable||!object(d.value))return false;const r=d.value,keys=Reflect.ownKeys(r);
 return keys.length===(Object.hasOwn(r,'slot')?4:3)&&['revision','mapId','bedId'].every(k=>Object.hasOwn(r,k))&&r.revision===1&&(r.mapId===null||integer(r.mapId))&&integer(r.bedId,1,nextId-1)&&(!Object.hasOwn(r,'slot')||r.slot===0||r.slot===1);
}
export function validBedReferences256(value:unknown,nextId:number):value is ActualBedReference256[] {
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1||value.length>nextId-1)return false;
 const ids=new Set<number>();for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value')||!object(d.value))return false;const r=d.value;if(Reflect.ownKeys(r).length!==4||!integer(r.id,1,nextId-1)||ids.has(r.id)||(r.mapId!==null&&!integer(r.mapId))||typeof r.animal!=='boolean'||r.slots!==1&&r.slots!==2||r.animal&&r.slots!==1)return false;ids.add(r.id);}return true;
}
function localBed(a:BedActor256):number|null {return animal(a)?a.domestic?.bedId??null:a.bedId;}
function localSlot(a:BedActor256):0|1|undefined {return animal(a)?undefined:a.bedSlot;}
function writeAlias(a:BedActor256,bedId:number|null,slot?:0|1):void {if(animal(a)){if(!a.domestic&&bedId!==null)throw Error('Animal has no real player settings');if(a.domestic){if(bedId===null)delete a.domestic.bedId;else a.domestic.bedId=bedId;}}else {a.bedId=bedId;if(slot===undefined)delete a.bedSlot;else a.bedSlot=slot;}}
export function validActorMapBedBinding256(a:BedActor256,refs:readonly ActualBedReference256[],activeMapId:number|null,local:boolean):boolean {
 const claim=a.mapBed;if(!claim)return true;const actual=refs.find(r=>r.id===claim.bedId);if(!actual||actual.mapId!==claim.mapId||actual.animal!==animal(a)||(actual.slots===2?claim.slot===undefined:claim.slot!==undefined))return false;
 const here=local&&activeMapId!==null&&claim.mapId===activeMapId;return here?localBed(a)===claim.bedId&&localSlot(a)===claim.slot:localBed(a)===null&&localSlot(a)===undefined;
}
/** Pure command draft, after normal local admission and real owner capture.
 * No remote assignment command is introduced. Equal slot claims are displaced
 * globally; a genuine new claim replaces that actor's old global reference. */
export interface ActorBedClaimPlan256 {updates:{actor:BedActor256;before:string;claim?:ActorMapBed256;clearAlias:boolean}[]}
const stamp=(a:BedActor256)=>JSON.stringify([a.mapBed,localBed(a),localSlot(a)]);
export function prepareActorBedClaim256(actors:readonly BedActor256[],actor:BedActor256|null,bed:ActualBedReference256,slot?:0|1):ActorBedClaimPlan256 {
 if(bed.mapId===null||actor&&!actors.includes(actor)||actor&&animal(actor)!==bed.animal||(bed.slots===2?(slot!==0&&slot!==1):slot!==undefined))throw Error('Invalid actual local bed claim');
 const updates:ActorBedClaimPlan256['updates']=[];for(const a of actors){const c=a.mapBed,same=c?.bedId===bed.id&&c.slot===slot;if(a===actor)updates.push({actor:a,before:stamp(a),claim:{revision:1,mapId:bed.mapId,bedId:bed.id,...slot!==undefined?{slot}:{}},clearAlias:false});else if(same)updates.push({actor:a,before:stamp(a),clearAlias:true});}return {updates};
}
export function actorBedClaimCurrent256(p:ActorBedClaimPlan256):boolean{return p.updates.every(u=>stamp(u.actor)===u.before);}
export function commitActorBedClaim256(p:ActorBedClaimPlan256):void {for(const u of p.updates){if(u.claim)u.actor.mapBed=u.claim;else delete u.actor.mapBed;if(u.clearAlias)writeAlias(u.actor,null);}}
/** Call only on a true departure before clearing existing local aliases. An
 * old255 save is never enriched by migration, inspection or this no-op path. */
export function rememberActorBedDeparture256(a:BedActor256,mapId:number,refs:readonly ActualBedReference256[],version:number):void {
 if(version<256)return;const id=localBed(a);if(id!==null){const r=refs.find(r=>r.id===id&&r.mapId===mapId);if(!r||r.animal!==animal(a))throw Error('Bed departure has no actual original');const slot=localSlot(a);if(r.slots===2?(slot!==0&&slot!==1):slot!==undefined)throw Error('Invalid actual bed slot');a.mapBed={revision:1,mapId,bedId:id,...slot!==undefined?{slot}:{}};}writeAlias(a,null);
}
/** Refusal is before entry commit. A missing original is not reconstructed. */
export function actorBedEntryAlias256(a:BedActor256,mapId:number,refs:readonly ActualBedReference256[]):{bedId:number|null;slot?:0|1} {
 const claim=a.mapBed;if(!claim)return {bedId:null};const actual=refs.find(r=>r.id===claim.bedId);if(!actual||actual.mapId!==claim.mapId||actual.animal!==animal(a)||(actual.slots===2?claim.slot===undefined:claim.slot!==undefined))throw Error('Owned bed reference no longer has its original');
 return actual.mapId===mapId?{bedId:actual.id,...claim.slot!==undefined?{slot:claim.slot}:{}}:{bedId:null};
}
export function commitActorBedEntry256(a:BedActor256,alias:{bedId:number|null;slot?:0|1}):void {writeAlias(a,alias.bedId,alias.slot);}
/** True minification (Vanish) preserves the claim; reinstallation relocates
 * the SAME original. Destruction/loss supplies null original to forget(). */
export function relocateActorBedClaims256(actors:readonly BedActor256[],original:ActualBedReference256,localMapFor:(actor:BedActor256)=>number|null):void {
 for(const a of actors)if(a.mapBed?.bedId===original.id){a.mapBed={...a.mapBed,mapId:original.mapId};if(original.mapId!==null&&localMapFor(a)===original.mapId)writeAlias(a,original.id,a.mapBed.slot);else writeAlias(a,null);}
}
export function forgetActorBedClaims256(actors:readonly BedActor256[],removedBedIds:ReadonlySet<number>):void {for(const a of actors)if(a.mapBed&&removedBedIds.has(a.mapBed.bedId)){delete a.mapBed;writeAlias(a,null);}}
/** MapDeiniter explicitly UnclaimAll on a Pawn remaining on the removed map,
 * independently from global references to beds physically lost with that map. */
export function unclaimDetachedActorBed256(a:BedActor256):void {delete a.mapBed;writeAlias(a,null);}
