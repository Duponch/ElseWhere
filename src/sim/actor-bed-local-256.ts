import {isDoubleBedKind} from './bed-kinds.ts';
import {captureShipCasketAnimals277} from './ship-casket-state-277.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {captureCoreStartingAnimals256} from './starting-pod-state-256.ts';
import {captureDuckFlyerOwners256} from './duck-owner-capture-256.ts';
/** Actual physical bed/actor capture and local attribution only. No fabricated
 * World, retained campaign cache or new remote assignment command. */
import {campaignPhysicalCaptures} from './campaign-people.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {actualBedReferences256,prepareActorBedClaim256,actorBedClaimCurrent256,
 commitActorBedClaim256,unclaimDetachedActorBed256,
 rememberActorBedDeparture256,actorBedEntryAlias256,
 type BedActor256,type ActualBedReference256} from './actor-map-bed-256.ts';
import type {GroupAnimalOwners256,GroupAnimalLoss256} from './group-animal-state-256.ts';
import type {CampaignState} from './world-map-state.ts';
import type {World,Pawn,Structure} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {PackedFurniture} from './furniture-rules.ts';
export interface ActualActorBeds256 {
 readonly actors:readonly BedActor256[];
 readonly refs:readonly ActualBedReference256[];
 localMapFor(actor:BedActor256):number|null;
}
const isAnimal=(a:BedActor256):a is WildAnimal&BedActor256=>'species' in a;
const localId=(a:BedActor256):number|null=>isAnimal(a)?a.domestic?.bedId??null:a.bedId;
const localSlot=(a:BedActor256):0|1|undefined=>isAnimal(a)?undefined:a.bedSlot;
function alias(a:BedActor256,id:number|null,slot?:0|1):void {
 if(isAnimal(a)){
  if(!a.domestic){if(id!==null)throw Error('Animal bed claim lacks real player settings');return;}
  if(id===null)delete a.domestic.bedId;else a.domestic.bedId=id;
 } else {a.bedId=id;if(slot===undefined)delete a.bedSlot;else a.bedSlot=slot;}
}
/** Slot captures already enumerate every full human owner, including actual
 * away/terminal/frozen/contained originals and their packed possessions.
 * Local animal originals stay on their actual map; travelling animals are
 * consumed only from their owner's biological roster, never preparing IDs. */
export function captureActorBeds256(input:CampaignState):ActualActorBeds256 {
 const root=registeredCampaign(input);
 if(root.schemaVersion<256)throw Error('Prospective actor-bed capture requires256');
 const actors:BedActor256[]=[],refs:ActualBedReference256[]=[];
 const places=new Map<BedActor256,number|null>(),beds=new Map<Structure,number|null>(),
  identities=new Map<number,object>(),packs=new Set<PackedFurniture>(),bedSources=new Map<Structure,object>();
 const identity=(id:number,owner:object)=>{
  const old=identities.get(id);if(old&&old!==owner)throw Error('Distinct actor/bed originals share an identity');
  identities.set(id,owner);
 };
 const actor=(a:BedActor256,mapId:number|null)=>{
  identity(a.id,a);
  if(places.has(a)){if(places.get(a)!==mapId)throw Error('Actor has contradictory physical map owners');return;}
  places.set(a,mapId);actors.push(a);
 };
 const bed=(b:Structure,mapId:number|null,source:object=b)=>{
  const base=actualBedReferences256(mapId??0,[b],[])[0];
  // This is reference metadata for that very original, not a fabricated pack.
  const ref=base?{...base,mapId}:undefined;
  if(!ref)return;identity(b.id,b);
  if(beds.has(b)){if(beds.get(b)!==mapId||bedSources.get(b)!==source)throw Error('Bed original has two physical owners');return;}
  beds.set(b,mapId);bedSources.set(b,source);refs.push(ref);
 };
 const packed=(pack:PackedFurniture)=>{
  if(packs.has(pack))return;packs.add(pack);bed(pack.building,null,pack);
 };
 // These are existing physical-owner captures, not a union of people-as-knowledge.
 for(const captured of campaignPhysicalCaptures(input as World)){
  const mapId=captured.world?registeredMapId(captured.world):undefined;
  for(const slot of captured.owners.pawnOwners){
   // A player casket freezes its original on this map; it is not a departure
   // and retains the same local bed alias, including a historical bare bedId.
   actor(slot.pawn!,(slot.kind==='map'||slot.kind==='player-casket'||slot.kind==='ship-casket')&&mapId!==undefined?mapId:null);
   for(const pack of slot.packed)packed(pack);
  }
  if(captured.world){
   if(captured.world.structures.length&&mapId===undefined)throw Error('Spawned beds lack a real map authority');
   for(const b of captured.world.structures)bed(b,mapId??null);
   for(const held of captureShipCasketAnimals277(captured.world)){actor(held.animal,mapId??null);for(const pack of held.packed)packed(pack);}
   for(const p of captured.world.packed)packed(p);
   for(const a of captureCoreStartingAnimals256(captured.world))actor(a,null);
   if(mapId!==undefined){for(const a of captured.world.wildlife?.animals??[])actor(a,mapId);for(const held of captureDuckFlyerOwners256(captured.world)){identity(held.holderId,held.holder);actor(held.animal,null);}}
  }
 }
 for(const e of root.worldPawns?.heldShipCaskets277??[]){const o=e.casket.shipCryptosleep277.occupant;if(o?.kind==='animal')actor(o.animal,null);for(const p of e.casket.shipCryptosleep277.packed)packed(p);}
 for(const owner of root.worldPawns?.owners??[]){if(owner.kind!=='mechanical')actor(owner.actor,null);for(const p of owner.packed)packed(p);}
 if((Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion)))))for(const group of root.worldGroups?.groups??[]){for(const a of group.pending261?.animals??[])actor(a,null);for(const p of group.pending261?.packed??[])packed(p);}
 for(const owner of root.worldFactions?.leaders??[])actor(owner.pawn,null);
 for(const record of root.worldGroups?.groups??[])if('members' in record.state){
  const state=record.state as typeof record.state&{animalOwners?:GroupAnimalOwners256};
  for(const a of state.animalOwners?.members??[])actor(a,null);
  for(const p of record.state.packed??[])packed(p);
 }
 const registry=root.worldGroups as typeof root.worldGroups&{animalLosses?:GroupAnimalLoss256[]};
 for(const loss of registry?.animalLosses??[]){actor(loss.animal,null);for(const p of loss.packed??[])packed(p);}
 for(const archive of root.worldGroups?.abandonedContents??[])
  for(const owner of archive.animals){actor(owner.animal,null);for(const p of owner.packed??[])packed(p);}
 return {actors,refs,localMapFor:a=>places.get(a)??null};
}
export function claimLocalActorBed256(w:World,a:BedActor256,b:Structure,slot?:0|1):void {
 if(!targetBuildingPlayerUse263(w,b))throw Error('Actual bed is not owned by the player');
 if(w.schemaVersion<256){alias(a,b.id,slot);return;}
 if(isAnimal(a)&&!a.domestic)throw Error('Local animal bed claim lacks actual player settings');
 const mapId=registeredMapId(w);
 if(mapId===undefined)throw Error('Bed attribution has no actual local map');
 if(a.mapBed?.mapId===mapId&&a.mapBed.bedId===b.id&&a.mapBed.slot===slot&&localId(a)===b.id&&localSlot(a)===slot&&
    w.structures.includes(b)&&(isAnimal(a)?w.wildlife?.animals.includes(a):w.pawns.includes(a)))return;
 const capture=captureActorBeds256(registeredCampaign(w));
 if(capture.localMapFor(a)!==mapId)throw Error('Bed attribution requires the actual local actor');
 const ref=capture.refs.find(r=>r.id===b.id&&r.mapId===mapId);
 if(!ref||!w.structures.includes(b))throw Error('Bed attribution requires the actual spawned original');
 const plan=prepareActorBedClaim256(capture.actors,a,ref,slot);
 // Migration did not enrich historical local aliases. A real new attribution
 // also displaces their matching local claim; no metadata is offered to them.
 const oldAliases=capture.actors.filter(other=>other!==a&&capture.localMapFor(other)===mapId&&
  localId(other)===b.id&&(ref.slots===1||localSlot(other)===slot));
 if(oldAliases.some(other=>other.mapBed&&other.mapBed.bedId!==b.id))throw Error('Inconsistent historical bed alias');
 if(!actorBedClaimCurrent256(plan))throw Error('Bed claim changed before local commit');
 commitActorBedClaim256(plan);
 for(const other of oldAliases)unclaimDetachedActorBed256(other);
 alias(a,b.id,slot);
}
/** Actual relinquishment/role change only; transient sleep/service reservations
 * do not call this. An unrelated remote bed claim must remain intact. */
export function forgetLocalActorBed256(w:World,a:BedActor256):void {
 if(w.schemaVersion<256){alias(a,null);return;}
 unclaimDetachedActorBed256(a);
}
/** A true individual departure/return uses the same original global bed as
 * collective travel. These helpers never invent a map or migrated claim. */
export function rememberLocalActorBedDeparture256(w:World,a:BedActor256):void {
 if(w.schemaVersion<256)return;
 const mapId=registeredMapId(w);if(mapId===undefined)throw Error('Actual bed departure has no map owner');
 const capture=captureActorBeds256(registeredCampaign(w));
 if(capture.localMapFor(a)!==mapId)throw Error('Actual bed departure has no local actor owner');
 rememberActorBedDeparture256(a,mapId,capture.refs,w.schemaVersion);
}
export function prepareLocalActorBedReturn256(w:World,a:BedActor256):{bedId:number|null;slot?:0|1}|undefined {
 if(w.schemaVersion<256)return;
 const mapId=registeredMapId(w);if(mapId===undefined)throw Error('Actual bed return has no map owner');
 return actorBedEntryAlias256(a,mapId,captureActorBeds256(registeredCampaign(w)).refs);
}
export function forgetLocalBedOwners256(w:World,bedId:number,prepared?:ActualActorBeds256):void {
 if(w.schemaVersion<256)return;
 const mapId=registeredMapId(w);if(mapId===undefined)throw Error('Bed release has no actual local map');
 const capture=prepared??captureActorBeds256(registeredCampaign(w));
 for(const a of capture.actors)if(a.mapBed?.bedId===bedId||
  capture.localMapFor(a)===mapId&&localId(a)===bedId)unclaimDetachedActorBed256(a);
}

/** Global original owners, including a historical local alias that has never
 * acquired prospective metadata. Knowledge-only IDs are never actor owners. */
export function actualBedOwners256(capture:ActualActorBeds256,bedId:number,
 slot?:0|1):readonly BedActor256[] {
 const ref=capture.refs.find(r=>r.id===bedId);if(!ref)return [];
 return capture.actors.filter(a=>{
  const claim=a.mapBed;
  if(claim?.bedId===bedId)return slot===undefined||ref.slots===1||claim.slot===slot;
  return !claim&&ref.mapId!==null&&capture.localMapFor(a)===ref.mapId&&localId(a)===bedId&&
   (slot===undefined||ref.slots===1||localSlot(a)===slot);
 });
}
/** Optional capture lets one planning pass reuse the same original-owner list. */
export function otherActorOwnsBed256(w:World,b:Structure,a:BedActor256,
 slot?:0|1,capture?:ActualActorBeds256):boolean {
 if(w.schemaVersion<256)return false;
 return actualBedOwners256(capture??captureActorBeds256(registeredCampaign(w)),b.id,slot).some(owner=>owner!==a&&owner.state!=='dead'&&!owner.health?.death);
}

/** Existing civil sharing rule extended to the same actual owners while away.
 * Manual assignment admission remains elsewhere; this is an automatic-provider
 * predicate, not permission to add an unrelated second owner. */
export function globalCivilBedShare256(w:World,b:Structure,p:Pawn,
 capture?:ActualActorBeds256):boolean {
 if(w.schemaVersion<256||!isDoubleBedKind(b.kind))return true;
 if(p.bedId===b.id&&(p.bedSlot===0||p.bedSlot===1)&&w.pawns.includes(p))return true;
 const c=capture??captureActorBeds256(registeredCampaign(w)),owners=actualBedOwners256(c,b.id).filter(owner=>owner.state!=='dead'&&!owner.health?.death);
 if(owners.includes(p))return true;
 return owners.every(other=>!isAnimal(other)&&
  (other.faction??'colony')==='colony'&&!other.prisoner&&!other.visitor&&!other.raid&&!other.podRescue&&other.state!=='dead'&&
  w.relationships?.links.some(link=>(link.kind==='lover'||link.kind==='spouse')&&
   (link.aId===p.id&&link.bId===other.id||link.bId===p.id&&link.aId===other.id)));
}
export function localBedClaimAvailable256(w:World,b:Structure,p:BedActor256,
 slot?:0|1,capture?:ActualActorBeds256):boolean {
 if(!targetBuildingPlayerUse263(w,b))return false;
 if(w.schemaVersion<256||b.medical)return true;
 // A validated continuing local alias already owns this actual place. A true
 // later attribution clears it atomically, including historical aliases.
 if(localId(p)===b.id&&(!isDoubleBedKind(b.kind)||localSlot(p)===slot)&&w.structures.includes(b)&&
    (isAnimal(p)?w.wildlife?.animals.includes(p):w.pawns.includes(p)))return true;
 const c=capture??captureActorBeds256(registeredCampaign(w));
 return !otherActorOwnsBed256(w,b,p,slot,c)&&
  (isAnimal(p)||globalCivilBedShare256(w,b,p,c));
}
