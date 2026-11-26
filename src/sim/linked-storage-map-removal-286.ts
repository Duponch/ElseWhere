import {revokeActorRecordSource297} from './actor-record-source-297.ts';
import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {captureDuckMapRemovedOwners256} from './duck-owner-capture-256.ts';
import {prepareLinkedStorageRemoval286} from './linked-storage-plan-286.ts';
import {isShelfKind} from './shelf-storage.ts';
import {registeredCampaign,registeredMap,registeredMapId} from './world-map-context.ts';
import {areaRemovalWrites259,removalWritesApplied259,removalWritesMutable259,sealRemovalOriginal259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
import {prepareRemovedMapAreas,removedMapAreasCurrent,commitRemovedMapAreas,beginRemovedMapAreas287} from './pawn-map-areas.ts';
import {prepareRemovedMapBeds256} from './actor-bed-transition-256.ts';
import {planPawnDrops} from './work-release.ts';
import {hasMapRemovalJob259} from './world-lost-owners.ts';
import {brandHeldCasketRemoval259} from './world-pawn-casket-259.ts';
import {isAncientCasket256,ancientCasketHasContents256} from './ancient-casket-state-256.ts';
import {isPlayerCasket271} from './cryptosleep-state-271.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import type {CampMapRemoved256} from './world-pawn-map-removed-256.ts';
import type {ReformDeparture260} from './group-reform-departure-260.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {CampaignState} from './world-map-state.ts';
import type {World} from './types.ts';

export interface LinkedStorageMapRemoval286 {
 readonly writes:readonly MapRemovalWrite259[];
 readonly lostIds:readonly number[];
 readonly applied:boolean;
 current():boolean;
 /** Consume the complete custody admission before Reform/area/bed writes. */
 begin():void;
 /** Later phases recheck only the declared policy recipients and values;
  * their physical transfers remain sealed by the enclosing removal. */
 beforeWrites():boolean;
 afterWrites():boolean;
 commit():void;
 projectPacked(packed:readonly PackedFurniture[]):PackedFurniture[];
}
export type LinkedStorageMapRemovalResult286={ok:false;reason:string}|{ok:true;plan:LinkedStorageMapRemoval286};

/** Lost furniture only, using the same post-Reform/post-drop distinction as
 * prepareRemovedMapBeds256. Inventory/archive/casket survivors keep links. */
export function prepareLinkedStorageMapRemoval286(input:CampaignState,map:World,mapId:number,plannedDrops:ReadonlySet<number>,departure?:ReformDeparture260):LinkedStorageMapRemovalResult286 {
 const no=(reason:string):LinkedStorageMapRemovalResult286=>({ok:false,reason});
 try{
  const root=registeredCampaign(input);
  if(!isSchema286OrLater(root.schemaVersion)){let begun=false,applied=false;return {ok:true,plan:{writes:[],lostIds:[],get applied(){return applied;},current:()=>!begun,beforeWrites:()=>begun&&!applied,afterWrites:()=>applied,begin(){if(begun)throw Error('Repeated historical storage-removal admission');begun=true;},commit(){if(!begun||applied)throw Error('Unadmitted historical storage removal');applied=true;},projectPacked:packs=>structuredClone([...packs])}};}
  if(registeredCampaign(map)!==root||registeredMapId(map)!==mapId||registeredMap(root,mapId)!==map)return no('Le stockage doit quitter sa vraie carte enregistrée.');
  const retained=new Set([...map.pawns.map(p=>p.id),...(map.wildlife?.animals.map(a=>a.id)??[]),...captureDuckMapRemovedOwners256(map).map(r=>r.animal.id)]);
  const lostIds=map.structures.filter(s=>isShelfKind(s.kind)).map(s=>s.id);
  for(const pack of map.packed){
   if(!isShelfKind(pack.building.kind)||departure?.packedIds.has(pack.building.id))continue;
   const owner=departure?departure.valueAfter(pack,'owner') as PackedFurniture['owner']:pack.owner;
   if(!owner||typeof owner!=='object')return no('Le vrai propriétaire du meuble retiré manque.');
   if(owner.type==='ground'||!retained.has(owner.pawnId)||departure?.ids.has(owner.pawnId)||plannedDrops.has(pack.building.id))lostIds.push(pack.building.id);
  }
  const removal=prepareLinkedStorageRemoval286(root,lostIds);if(!removal.ok)return removal;
  // Removal changes only membership. A future planner must not silently add
  // a policy/hauling transition that this phase does not own.
  if(removal.changedCellIds.length)return no('Le retrait ne peut pas changer une politique de stockage effective.');
  const writes=removal.writes.map(write=>Object.freeze({...write})),rootBefore=Object.getOwnPropertyDescriptor(root,'linkedStorage286');
  const bounded={registry:root.linkedStorage286,states:writes.filter(w=>w.object!==root).map(w=>w.object),desired:writes.map(w=>w.value)};
  const seal=sealRemovalOriginal259(bounded,[],writes),tick=root.tick;
  const rootCurrent=()=>{const now=Object.getOwnPropertyDescriptor(root,'linkedStorage286');return rootBefore?!!now&&now.enumerable===rootBefore.enumerable&&now.configurable===rootBefore.configurable&&now.writable===rootBefore.writable&&Object.hasOwn(now,'value')&&Object.is(now.value,rootBefore.value):!now&&!('linkedStorage286'in root);};
  let begun=false,applied=false;
  const sameSource=()=>registeredCampaign(map)===root&&registeredMapId(map)===mapId&&root.tick===tick&&isSchema286OrLater(root.schemaVersion);
  const beforeWrites=()=>begun&&!applied&&sameSource()&&rootCurrent()&&seal(0)&&removalWritesMutable259(writes);
  const afterWrites=()=>applied&&sameSource()&&seal(2)&&removalWritesApplied259(writes);
  const current=()=>!begun&&sameSource()&&removal.current()&&rootCurrent()&&seal(0);
  if(!current())return no('Les propriétaires du stockage ont changé pendant la préparation.');
  return {ok:true,plan:{writes,lostIds:Object.freeze([...lostIds]),get applied(){return applied;},current,beforeWrites,afterWrites,
   begin(){if(!current())throw Error('Stale linked storage MapRemoved admission');begun=true;},
   commit(){
    if(!beforeWrites())throw Error('Stale admitted linked storage MapRemoved recipients');
    for(const write of writes){revokeActorRecordSource297(write.object);if(write.present){if(Object.hasOwn(write.object,write.key)){if(!Reflect.set(write.object,write.key,write.value))throw Error('Admitted storage-removal write failed');}
     else Object.defineProperty(write.object,write.key,{value:write.value,writable:true,enumerable:true,configurable:true});}
     else if(!Reflect.deleteProperty(write.object,write.key))throw Error('Admitted storage-removal deletion failed');}
    applied=true;if(!afterWrites())throw Error('Unexpected linked storage MapRemoved result');
   },
   projectPacked(packs){return packs.map(pack=>{
    const next=structuredClone(pack),shelf=pack.building.shelf;if(!shelf||!next.building.shelf)return next;
    // The WorldPawn draft is a private record projection, never another owner.
    // Casket packs stay under their original holder and use the same declared
    // writes in its existing phase seal instead of being projected here.
    for(const write of writes)if(write.object===shelf){if(write.present)Reflect.set(next.building.shelf,write.key,structuredClone(write.value));else Reflect.deleteProperty(next.building.shelf,write.key);}
    return next;
   });},
  }};
 }catch(e){return no(e instanceof Error?e.message:String(e));}
}

/** Current classic maps and geographic maps without live transfers retain
 * their literal archive contract. No WorldPawn/faction owner is invented for
 * a furniture-only removal. Historical versions bypass this wrapper. */
export function composeArchiveLinkedStorageMapRemoval286(input:CampaignState,map:World,mapId:number,base:CampMapRemoved256):CampMapRemoved256 {
 const root=registeredCampaign(input),no=(reason:string):CampMapRemoved256=>({ok:false,reason});
 if(!base.ok||!isSchema286OrLater(root.schemaVersion))return base;
 try{
 const preAreas=isSchema287OrLater(root.schemaVersion)?prepareRemovedMapAreas(root,mapId,new Set((map.allowedAreas??[]).map(a=>a.id))):undefined;
 if(!map.structures.some(s=>!!s.shelf?.linked286)&&!map.packed.some(p=>!!p.building.shelf?.linked286)&&(!preAreas?.animal287||preAreas.animal287.noop))return base;
  if(!root.worldMaps?.sites.some(s=>s.id===mapId)||registeredCampaign(map)!==root||registeredMapId(map)!==mapId||registeredMap(root,mapId)!==map)return no('Le retrait classique exige sa vraie carte enregistrée.');
  // Those cross-owner drivers require the geographic removal phase; a permit
  // for shelves must never accidentally authorize an occupied casket/pair.
  if(map.pawns.some(p=>!!p.coupleTask285))return no('Terminez le moment intime avant le retrait de cette carte classique avec étagères liées.');
  if(map.structures.some(s=>isAncientCasket256(s)&&ancientCasketHasContents256(s.casket)||isPlayerCasket271(s)&&s.cryptosleep.human||isShipCasket277(s)&&s.shipCryptosleep277.occupant))return no('Le vrai transfert des caissons occupés exige sa frontière géographique avant ce retrait.');
  const dropping=new Set(map.pawns.filter(hasMapRemovalJob259).map(p=>p.id)),drops=planPawnDrops(map,dropping);if(!drops)return no('Les cargaisons réelles n’ont pas de dépôt admissible avant ce retrait.');
  const result=prepareLinkedStorageMapRemoval286(root,map,mapId,new Set(drops.keys()));if(!result.ok)return no(result.reason);const linked=result.plan;
  const areas=preAreas??prepareRemovedMapAreas(root,mapId,new Set((map.allowedAreas??[]).map(a=>a.id))),areaWrites=areaRemovalWrites259(areas),beds=prepareRemovedMapBeds256(root,map,mapId,new Set(drops.keys()));
  const finalWrites=[...(beds?.removalWrites259??[]),...linked.writes],tick=root.tick,rng=root.rng,nextId=root.nextId;
  const source={structures:map.structures,piles:map.piles,packed:map.packed,pawns:map.pawns,animals:map.wildlife?.animals},sourceSeal=sealRemovalOriginal259(source,areaWrites,finalWrites);
  const dropRows=[...drops].map(([id,cell])=>({id,cell,x:cell.x,z:cell.z})),dropsCurrent=()=>drops.size===dropRows.length&&dropRows.every(r=>drops.get(r.id)===r.cell&&r.cell.x===r.x&&r.cell.z===r.z);
  const mutable=()=>removalWritesMutable259(areaWrites)&&removalWritesMutable259(finalWrites),header=()=>root.tick===tick&&root.rng===rng&&root.nextId===nextId&&registeredCampaign(map)===root&&registeredMapId(map)===mapId&&mutable()&&dropsCurrent();
  let phase:'prepared'|'begun'|'areas'|'beds'|'used'='prepared';
  const current=()=>phase==='prepared'&&header()&&base.current()&&linked.current()&&removedMapAreasCurrent(areas)&&(beds?.current?.()??true)&&sourceSeal(0);
  const admitted=()=>phase==='areas'&&header()&&linked.beforeWrites()&&removalWritesApplied259(areaWrites)&&sourceSeal(1);
  const plan:CampMapRemoved256={ok:true,current,commit(compact){
   if(phase!=='beds'||!header()||!linked.afterWrites()||!removalWritesApplied259(areaWrites)||!removalWritesApplied259(finalWrites)||compact.mapId!==mapId||compact.removedAt!==tick)throw Error('Stale classic linked storage MapRemoved receipt');
   base.commit(compact);phase='used';
  }};
  if(!current())return no('Les destinataires du retrait classique ne sont pas mutables ou ont changé.');
  return brandHeldCasketRemoval259(plan,map,admitted,()=>{
   if(!current())throw Error('Stale classic linked storage MapRemoved begin');beginRemovedMapAreas287(areas);linked.begin();phase='begun';
   return {drops260:drops,areas(){
    if(phase!=='begun'||!header()||!linked.beforeWrites()||!sourceSeal(0))throw Error('Stale classic storage before area removal');
    commitRemovedMapAreas(areas);phase='areas';if(!admitted())throw Error('Unexpected classic storage area result');
   },beds(){
    if(phase!=='areas'||!header()||!linked.beforeWrites()||!removalWritesApplied259(areaWrites))throw Error('Stale classic storage before final removal');
    beds?.commit();linked.commit();phase='beds';
    if(!linked.afterWrites()||!removalWritesApplied259(finalWrites))throw Error('Unexpected classic storage final result');
   }};
  },current);
 }catch(e){return no(e instanceof Error?e.message:String(e));}
}
