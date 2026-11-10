import {validPlantLife} from '../sim/plant-life-save.ts';
import {validFrameProjection301} from '../sim/finish-frame-save-301.ts';
import {validHumanIngestionProjection299} from '../sim/human-ingestion-save-299.ts';
import {validIdleWanderProjection300} from '../sim/idle-wander-save-300.ts';
import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {validPhaseCore297} from '../sim/core-phase-297';
import {validCorePathBudget297} from '../sim/core-path-budget-297';
import {validWallDoorHistoricalTransport296,validWallDoorWorld296,validWallDoorResidentNamespace296} from '../sim/wall-door-save-296.ts';
import {validNovelHistoricalTransport295} from '../sim/book-save-295.ts';
import {validReadingWorld295} from '../sim/book-transport-295.ts';
import {validPeaceTalksHistorical293,validPeaceTalksBindings293} from '../sim/peace-talks-save-293.ts';
import {validToxicFalloutTransport294} from '../sim/toxic-fallout-transport-294.ts';
import {validMiscIncidents} from '../sim/cassandra-misc-save.ts';
import {validDrugPolicyRegistry265} from '../sim/alcohol-policy-265.ts';
import {isSchema265OrLater} from '../sim/schema-compatibility-257.ts';
import {validPartyHistoricalTransport292,validPartyWorld292} from '../sim/party-save-292.ts';
import {validForestryPolicies291,validForestryHistoricalTransport291} from '../sim/forestry-save-291.ts';
import {validFirefoamHistoricalTransport290,validFirefoamWorld290} from '../sim/firefoam-save-290.ts';
import {validBillPauseHistoricalTransport289,validBillPauseWorld289} from '../sim/bill-pause-save-289.ts';
import {validAnimalThermalRefugeHistoricalTransport288,validAnimalThermalRefugeWorld288} from '../sim/animal-thermal-refuge-save-288.ts';
import {validAnimalAreaHistoricalTransport287,validAnimalAreaWorld287} from '../sim/animal-area-save-287.ts';
import {validSmoothFloorsHistoricalTransport281,validSmoothFloorTile281,validSmoothFloorWorld281} from '../sim/smooth-floor-save-281';
import {validAnimalTrainingHistoricalTransport282} from '../sim/animal-training-historical-282';
import {validAnimalTrainingWorld282} from '../sim/animal-training-world-282';
import {validPrisonerSurgeryHistoricalTransport280,validPrisonerSurgeryWorld280} from '../sim/prisoner-surgery-save-280';
import {validApparelTradeHistoricalTransport279,validApparelTradeWorld279} from '../sim/apparel-trade-save-279';
import {validApparelReservesBuilding278,validApparelReservesHistoricalTransport278} from '../sim/apparel-reserves-save-278';
import {validResidentTradeRequests284} from '../sim/trade-request-projection-save-284';
import {validCoupleHistoricalTransport285,validCoupleProjection285} from '../sim/couple-owner-save-285';
import {validTradeRequestHistorical284} from '../sim/trade-request-save-284';
import {validApparelProvenanceHistoricalTransport284} from '../sim/apparel-provenance-284';
import {validBillWorkerHistoricalTransport283,validBillWorkerWorld283} from '../sim/bill-worker-save-283';
import {validLinkedStorageHistorical286,validLinkedStorageProjection286} from '../sim/linked-storage-save-286';
import {validShipCasketHistoricalTransport277} from '../sim/ship-casket-save-277';
import {validShipPartHistoricalTransport276} from '../sim/ship-part-save-276';
import {validShipReactorHistoricalTransport275} from '../sim/ship-reactor-save-275';
/** Closed MAIN read projection from presentation.worker, never a save decoder.
 * Authority for gameplay/ownership rules is the fixed SIM producer, whose load
 * and replacement boundaries remain strict. This reader checks transport shape,
 * order and patch references; it deliberately does not certify arbitrary Worlds.
 * Each accepted version is persistent: queued older render Worlds stay intact. */
import {SCHEMA_VERSION,type World,type Resource,type Tile} from '../sim/types';
import {MAX_EXTENDED_MAP_SIZE} from '../sim/map-config';
import type {CampaignSummary} from '../sim/world-map-state';
import type {CampaignOnlyMessage} from './protocol';
import {PlanetGeographyTransportDecoder256} from './planet-geography-transport-256';
import {prepareRiverWaterSnapshot256} from './river-water-transport-256';
import {freezeAdmittedRiverWater256} from '../sim/river-water-owner-256';
import {freezeAdmittedNativeWorldPawnOrder256,captureNativeWorldPawnBirth256,sameNativeWorldPawnBirth256} from '../sim/world-pawn-native-order-256';
import {captureFactionInitializations256,sameFactionInitializations256} from '../sim/world-faction-no-expansion-ideo-256';
import {groupWorld} from '../sim/world-map-authority';
import {SnapshotChangeJournal,StructureChangeJournal,ResourceStructureJournal,
 type ResourceStructureCandidate,type SnapshotMessage,type SnapshotAdoption} from './snapshots';
import {ResidentResourceBaseJournal} from './resident-resource-base-journal';
import {canReuseResidentAuxiliaryStockpiles} from './resident-auxiliary-sections';
import {validGiftHistoricalTransport274} from '../sim/diplomatic-gift-transport-274';

const own=(value:object,key:PropertyKey):boolean=>Object.hasOwn(value,key);
function record(value:unknown):value is Record<string,unknown> {
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype
  &&Reflect.ownKeys(value).every(key=>typeof key==='string'&&Object.getOwnPropertyDescriptor(value,key)?.enumerable===true
   &&own(Object.getOwnPropertyDescriptor(value,key)!,'value'));
}
function dense(value:unknown):value is unknown[] {
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)return false;
 for(let i=0;i<value.length;i++){const field=Object.getOwnPropertyDescriptor(value,String(i));if(!field||!own(field,'value')||field.enumerable!==true)return false;}
 return true;
}
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
function rows(value:unknown):value is Record<string,unknown>[] {return dense(value)&&value.every(record);}
function identified(value:unknown,nextId:number):value is {id:number}[] {
 if(!rows(value))return false;const ids=new Set<number>();
 for(const row of value){if(!integer(row.id,1,nextId-1)||ids.has(row.id))return false;ids.add(row.id);}return true;
}
function slots<T extends {id:number}>(values:T[]):Map<number,number> {return new Map(values.map((value,index)=>[value.id,index]));}
function projectionReferences(value:unknown,local:boolean):boolean {
 if(!record(value)||!record(value.mapSize)||!integer(value.mapSize.width,1,MAX_EXTENDED_MAP_SIZE)||!integer(value.mapSize.height,1,MAX_EXTENDED_MAP_SIZE)
  ||!integer(value.campaignSeed,0,0xffffffff)||!rows(value.maps)||!rows(value.groups))return false;
 const ids=(values:Record<string,unknown>[],minimum:number):Set<number>|undefined=>{const out=new Set<number>();for(const row of values){if(!integer(row.id,minimum)||out.has(row.id))return;out.add(row.id);}return out;};
 // Map IDs have their own zero-based registry (the original home is map0).
 // Group IDs remain positive Thing identities; never conflate the namespaces.
 const maps=ids(value.maps,0),groups=ids(value.groups,1);if(!maps||!groups)return false;
 if(local?!integer(value.activeMapId,0)||!maps.has(value.activeMapId):value.activeMapId!==null)return false;
 if(value.rootMapId!==null&&(!integer(value.rootMapId,0)||!maps.has(value.rootMapId)))return false;
 return value.selectedGroupId===null||integer(value.selectedGroupId,1)&&groups.has(value.selectedGroupId);
}
type Patch<T>={removed:number[];upserted:T[];order?:number[];growth?:Float64Array;life?:Float64Array};
/** Complete check of a record rebuilt from a plant age tuple (see ResourceChanges.life). */
type LifeCheck<T>=(value:T)=>boolean;
const lifeTuples=(life:unknown,limit:number):life is Float64Array=>life instanceof Float64Array&&Object.getPrototypeOf(life)===Float64Array.prototype&&life.length%4===0&&life.length<=limit*4;
type Prepared<T>={values:T[];slots:Map<number,number>;indices:number[]|undefined;edge:ResourceStructureCandidate|undefined;baseEdge:ResourceStructureCandidate|undefined};

/** Sparse existing-ID upserts and growth have no membership/order edits.
 * Keep all tuple guards and BASE upserts, without a writes Map or ID rescans.
 * A new ID/inconsistent index falls back without changing any owner. */
function patchSparseGrowth<T extends {id:number}>(previous:T[],oldSlots:Map<number,number>,upserted:T[],growthRaw:unknown,nextId:number,growthTick:number,lifeRaw?:unknown,validLife?:LifeCheck<T>):Prepared<T>|undefined|null {
 // Either list may be absent; a present one keeps every tuple guard.
 const growth=growthRaw===undefined?new Float64Array():growthRaw,life=lifeRaw===undefined?new Float64Array():lifeRaw;
 if(!(growth instanceof Float64Array)||Object.getPrototypeOf(growth)!==Float64Array.prototype
  ||growth.length%4||growth.length>previous.length*4)return;
 if(!lifeTuples(life,previous.length)||life.length&&!validLife)return;
 const touched=new Set<number>(),indices:number[]=[],updated:ResourceStructureCandidate['updated'][number][]=[],baseUpdated:ResourceStructureCandidate['updated'][number][]=[];
 let values=previous;
 // identified(upserted,nextId) already checked row shape and unique IDs.
 // New IDs require the unchanged generic membership reconstruction.
 for(const value of upserted){
  const slot=oldSlots.get(value.id);if(slot===undefined||previous[slot]?.id!==value.id)return null;
  if(values===previous)values=previous.slice();values[slot]=value;
  touched.add(value.id);indices.push(slot);updated.push({id:value.id,afterOrdinal:slot});baseUpdated.push({id:value.id,afterOrdinal:slot});
 }
 for(let index=0;index<growth.length;index+=4){
  const id=growth[index]!,value=growth[index+1]!,tick=growth[index+2]!,factor=growth[index+3]!,slot=oldSlots.get(id),old=previous[slot??-1] as (T&Partial<Resource>)|undefined;
  if(!integer(id,1,nextId-1)||!old||typeof old.growth!=='number'||touched.has(id)
   ||!Number.isFinite(value)||value<0||value>1||!integer(tick,0,growthTick)
   ||!Number.isNaN(factor)&&(!Number.isFinite(factor)||factor<0||factor>1))return;
  if(slot===undefined||old.id!==id)return null;
  const changed={...old,growth:value,growthTick:tick};
  if(Number.isNaN(factor))delete changed.growthThermalFactor;else changed.growthThermalFactor=factor;
  if(values===previous)values=previous.slice();values[slot]=changed;
  touched.add(id);indices.push(slot);updated.push({id,afterOrdinal:slot});
 }
 for(let index=0;index<life.length;index+=4){
  const id=life[index]!,slot=oldSlots.get(id),old=previous[slot??-1] as (T&Partial<Resource>)|undefined;
  if(!integer(id,1,nextId-1)||!old||!record(old.plantLife)||touched.has(id))return;
  if(slot===undefined||old.id!==id)return null;
  const changed={...old,plantLife:{...old.plantLife,age:life[index+1]!,darkTicks:life[index+2]!,nextCheck:life[index+3]!}} as T;
  if(!validLife!(changed))return;
  if(values===previous)values=previous.slice();values[slot]=changed;
  touched.add(id);indices.push(slot);updated.push({id,afterOrdinal:slot});
 }
 const edge:ResourceStructureCandidate={beforeCount:previous.length,afterCount:values.length,removed:[],added:[],updated};
 return {values,slots:oldSlots,indices,edge,baseEdge:{...edge,updated:baseUpdated}};
}

/** No private index points at a mutable producer object. Membership/order
 * changes rebuild only that collection; sparse edits keep its stable slots. */
function patchCollection<T extends {id:number}>(previous:T[],oldSlots:Map<number,number>,raw:unknown,nextId:number,
 growthTick?:number,validLife?:LifeCheck<T>):Prepared<T>|undefined {
 if(!record(raw)||Object.keys(raw).some(key=>!['removed','upserted','order',...(growthTick===undefined?[]:['growth']),...(validLife?['life']:[])].includes(key))
  ||!own(raw,'removed')||!own(raw,'upserted')||!dense(raw.removed)||!identified(raw.upserted,nextId)
  ||own(raw,'order')&&!dense(raw.order))return;
 const patch=raw as unknown as Patch<T>,sparse=!patch.removed.length&&!own(raw,'order')&&patch.upserted.every(value=>oldSlots.has(value.id));
 if(growthTick!==undefined&&sparse&&(own(raw,'growth')||own(raw,'life'))){
  const prepared=patchSparseGrowth(previous,oldSlots,patch.upserted,own(raw,'growth')?patch.growth??null:undefined,nextId,growthTick,own(raw,'life')?patch.life??null:undefined,validLife);if(prepared!==null)return prepared;
 }
 const touched=new Set<number>(),removed:{id:number;beforeOrdinal:number}[]=[];
 for(const id of patch.removed){if(!integer(id,1,nextId-1)||touched.has(id)||!oldSlots.has(id))return;touched.add(id);removed.push({id,beforeOrdinal:oldSlots.get(id)!});}
 const byId=sparse?undefined:new Map(previous.map(value=>[value.id,value]));
 for(const id of patch.removed)byId!.delete(id);
 const writes=new Map<number,T>();
 const read=(id:number):T|undefined=>writes.get(id)??(byId?byId.get(id):previous[oldSlots.get(id)??-1]);
 const write=(value:T):void=>{writes.set(value.id,value);if(byId)byId.set(value.id,value);};
 for(const value of patch.upserted){if(touched.has(value.id))return;touched.add(value.id);write(value);}
 if(own(raw,'growth')){
  const growth=patch.growth;
  if(growthTick===undefined||!(growth instanceof Float64Array)||Object.getPrototypeOf(growth)!==Float64Array.prototype
   ||growth.length%4||growth.length>previous.length*4)return;
  for(let index=0;index<growth.length;index+=4){
   const id=growth[index]!,value=growth[index+1]!,tick=growth[index+2]!,factor=growth[index+3]!,old=read(id) as (T&Partial<Resource>)|undefined;
   if(!integer(id,1,nextId-1)||!old||typeof old.growth!=='number'||touched.has(id)
    ||!Number.isFinite(value)||value<0||value>1||!integer(tick,0,growthTick)
    ||!Number.isNaN(factor)&&(!Number.isFinite(factor)||factor<0||factor>1))return;
   const updated={...old,growth:value,growthTick:tick};
   if(Number.isNaN(factor))delete updated.growthThermalFactor;else updated.growthThermalFactor=factor;
   touched.add(id);write(updated);
  }
 }
 if(own(raw,'life')){
  const life=patch.life;
  if(!validLife||!lifeTuples(life,previous.length))return;
  for(let index=0;index<life.length;index+=4){
   const id=life[index]!,old=read(id) as (T&Partial<Resource>)|undefined;
   if(!integer(id,1,nextId-1)||!old||!record(old.plantLife)||touched.has(id))return;
   const updated={...old,plantLife:{...old.plantLife,age:life[index+1]!,darkTicks:life[index+2]!,nextCheck:life[index+3]!}} as T;
   if(!validLife(updated))return;
   touched.add(id);write(updated);
  }
 }
 let values:T[];
 if(own(raw,'order')){
  const order=patch.order!;
  if(order.length!==byId!.size||new Set(order).size!==order.length||order.some(id=>!integer(id,1,nextId-1)||!byId!.has(id)))return;
  values=order.map(id=>byId!.get(id)!);
 }else if(byId)values=touched.size?[...byId.values()]:previous;
 else if(writes.size){values=previous.slice();for(const [id,value]of writes)values[oldSlots.get(id)!]=value;}
 else values=previous;
 const nextSlots=sparse?oldSlots:slots(values),indices=sparse?[...touched].map(id=>nextSlots.get(id)!):undefined;
 // Without explicit order, Map deletion/insertion preserves survivors and
 // appends additions, exactly matching the encoder's historical reconstruction.
 const edge:ResourceStructureCandidate|undefined=own(raw,'order')?undefined:{beforeCount:previous.length,afterCount:values.length,removed,
  added:[...writes.keys()].filter(id=>!oldSlots.has(id)).map(id=>({id,afterOrdinal:nextSlots.get(id)!})),
  updated:[...writes.keys()].filter(id=>oldSlots.has(id)).map(id=>({id,afterOrdinal:nextSlots.get(id)!}))};
 // Keep all actual upserts as a conservative BASE superset. Growth tuples
 // already replace exact values above, but never change IDs/classification or
 // position and therefore do not invalidate structural consumer memberships.
 const baseEdge=edge?{...edge,updated:patch.upserted.filter(value=>oldSlots.has(value.id)).map(value=>({id:value.id,afterOrdinal:nextSlots.get(value.id)!}))}:undefined;
 return {values,slots:nextSlots,indices,edge,baseEdge};
}

function tileChanges(previous:Tile[],raw:unknown):{tiles:Tile[];indices:number[]}|undefined {
 if(!dense(raw))return;
 const touched=new Set<number>(),changes:{index:number;tile:Tile}[]=[];
 for(const tuple of raw){
  if(!dense(tuple)||tuple.length<2||tuple.length>12)return;
  const [index,terrain,stone,miningDamage,ore,floor,miningYield,snowDepth,bridge,collapsedRock,fogged,mineable]=tuple;
  if(!integer(index,0,previous.length-1)||touched.has(index)||typeof terrain!=='string'
   ||collapsedRock!==undefined&&!record(collapsedRock)||mineable!==undefined&&!record(mineable))return;
  const tile={terrain,...stone===undefined?{}:{stone},...miningDamage===undefined?{}:{miningDamage},...ore===undefined?{}:{ore},
   ...floor===undefined?{}:{floor},...miningYield===undefined?{}:{miningYield},...snowDepth===undefined?{}:{snowDepth},
   ...bridge===undefined?{}:{bridge},...collapsedRock===undefined?{}:{collapsedRock:{id:collapsedRock.id,terrain:collapsedRock.terrain}},
   ...fogged===undefined?{}:{fogged},...mineable===undefined?{}:{mineable:{id:mineable.id,def:mineable.def,terrain:mineable.terrain}}} as Tile;
  touched.add(index);changes.push({index,tile});
 }
 if(!changes.length)return {tiles:previous,indices:[]};
 const tiles=previous.slice();for(const change of changes)tiles[change.index]=change.tile;return {tiles,indices:[...touched]};
}

function localShape(raw:unknown,checkpoint:boolean,sparseStructures:boolean,reuseStockpiles=false):string|undefined {
 if(!record(raw))return 'World data record';
 if(!integer(raw.schemaVersion,1,SCHEMA_VERSION))return 'schemaVersion';
 if(!validSmoothFloorsHistoricalTransport281(raw,raw.schemaVersion))return 'future natural stone smoothing';
 if(!validPrisonerSurgeryHistoricalTransport280(raw,raw.schemaVersion))return 'future captive surgery';
 if(!validApparelTradeHistoricalTransport279(raw,raw.schemaVersion))return 'future ordinary apparel inventory or trade';
 if(!validApparelReservesHistoricalTransport278(raw,raw.schemaVersion))return 'future apparel reserve settings';
 if(!validShipCasketHistoricalTransport277(raw,raw.schemaVersion))return 'future spatial casket content';
 if(!validShipPartHistoricalTransport276(raw,raw.schemaVersion))return 'future ship hull or engine research';
 if(!validShipReactorHistoricalTransport275(raw,raw.schemaVersion))return 'future ship reactor';
 if(!validGiftHistoricalTransport274(raw,raw.schemaVersion))return 'future diplomatic gift';
 if(!integer(raw.tick))return 'tick';
 if(!validPhaseCore297(raw,raw.schemaVersion)||!validCorePathBudget297(raw,raw.schemaVersion,raw.tick,isCorePhysicalSchema297(raw.schemaVersion)?Number(raw.phaseCore297):0,true))return 'physical clock/local path-budget owner';
 if(!integer(raw.nextId,1))return 'nextId';
 if(!integer(raw.width,1,MAX_EXTENDED_MAP_SIZE)||!integer(raw.height,1,MAX_EXTENDED_MAP_SIZE))return 'dimensions';
 if(!integer(raw.seed,0,0xffffffff)||!integer(raw.rng,0,0xffffffff))return 'seed/rng uint32';
 for(const key of ['pawns','jobs','stockpiles','growingZones'])if(!(key==='stockpiles'&&reuseStockpiles)&&!identified(raw[key],raw.nextId))return key+' IDs';
 for(const key of ['packed','events'])if(!rows(raw[key]))return key+' data rows';
 if(own(raw,'campaignMap')){
  const metadata=raw.campaignMap;if(!record(metadata))return 'campaignMap record';
  if(metadata.revision===2){if(!projectionReferences(metadata,true))return 'campaignMap references';}
  else if(own(metadata,'revision')||!['home','secondary'].includes(String(metadata.active)))return 'legacy campaignMap';
 }
 if(sparseStructures?own(raw,'structures'):!identified(raw.structures,raw.nextId))return 'structures form';
 if(checkpoint){
  if(!rows(raw.tiles)||raw.tiles.length!==raw.width*raw.height)return 'tiles extent/data rows';
  if(!identified(raw.resources,raw.nextId))return 'resources IDs';
  if(!identified(raw.piles,raw.nextId))return 'piles IDs';
 }else if(own(raw,'tiles')||own(raw,'resources')||own(raw,'piles'))return 'ambiguous dynamic collections';
}
type CampaignAdoption={status:'applied';replaced:boolean;summary:CampaignSummary}|{status:'stale'}|{status:'resync';reason:string};
type Chronology={calendar:number|undefined;birth:ReturnType<typeof captureNativeWorldPawnBirth256>;factions:ReturnType<typeof captureFactionInitializations256>};
const mapIdentity=(view:Pick<World,'campaignMap'>):number|string|undefined=>view.campaignMap?.revision===2?view.campaignMap.activeMapId:view.campaignMap?.active;

/* The packets adopted here come from this same build's own Worker. Re-running
 * every save-grade validator over the whole World on each delta (about 25 deep
 * walks, 110-140 ms on a large colony) dominated the main thread. Production
 * may sample that deep validation; structural checks (header, predecessor,
 * collection patches, geography, chronology) always run, and any failure
 * still triggers a resync. Default 0 keeps validation on every publication. */
let residentDeltaValidationIntervalMs=0;
const residentClock=():number=>typeof performance!=='undefined'?performance.now():Date.now();
export function setResidentDeltaValidationInterval(ms:number):void {
 if(!Number.isFinite(ms)||ms<0)throw RangeError('Invalid resident validation interval');
 residentDeltaValidationIntervalMs=ms;
}
export class ResidentPresentationAssembler {
 protected firefoamTransport(value:unknown,version:unknown):boolean {return validFirefoamHistoricalTransport290(value,version);}
 protected firefoamWorld(value:World,_packet:SnapshotMessage<true>):boolean {return validFirefoamWorld290(value);}
 private epoch=0;
 private revision=0;
 private current:World|undefined;
 private lastDeepValidationAt=-Infinity;
 private deepValidationDue():boolean {return residentDeltaValidationIntervalMs<=0||residentClock()-this.lastDeepValidationAt>=residentDeltaValidationIntervalMs;}
 private resourceSlots=new Map<number,number>();
 private pileSlots=new Map<number,number>();
 private structureSlots=new Map<number,number>();
 private calendar?:number;
 private birth:ReturnType<typeof captureNativeWorldPawnBirth256>;
 private factions:ReturnType<typeof captureFactionInitializations256>;
 private readonly geography=new PlanetGeographyTransportDecoder256();
 private readonly changes=new SnapshotChangeJournal();
 private readonly structures=new StructureChangeJournal();
 private readonly resourceStructure=new ResourceStructureJournal();
 private readonly resourceBase=new ResidentResourceBaseJournal();
 prepareDraftPreview(packet:unknown){return this.geography.prepareDraftPreview(packet);}
 authorizeDraftPreview(preview:import('../sim/world-geography-owner-256').DraftGeographyPreview256):void {this.geography.authorizeDraftPreview(preview);}
 discardDraftPreview():void {this.geography.discardDraftPreview();}
 private header(packet:{epoch:number;revision:number;stepMs:number;speed:number}):'stale'|'invalid'|'new' {
  if(!record(packet)||!integer(packet.epoch,1)||!integer(packet.revision,1)||!Number.isFinite(packet.stepMs)||packet.stepMs<0||![0,1,3,6].includes(packet.speed))return 'invalid';
  return packet.epoch<this.epoch||packet.epoch===this.epoch&&packet.revision<=this.revision?'stale':'new';
 }
 private chronology(view:World,epoch:number,calendar:number|undefined):boolean {
  if(view.planet?.revision===3&&!integer(calendar,Number.MIN_SAFE_INTEGER))return false;
  return epoch!==this.epoch||calendar===this.calendar&&sameNativeWorldPawnBirth256(this.birth,view.worldPawns)&&sameFactionInitializations256(this.factions,view.worldFactions);
 }
 private captureChronology(view:World,calendar:number|undefined):Chronology {
  return {calendar,birth:captureNativeWorldPawnBirth256(view.worldPawns),factions:captureFactionInitializations256(view.worldFactions)};
 }
 private commitChronology(facts:Chronology,epoch:number,revision:number):void {
  this.epoch=epoch;this.revision=revision;this.calendar=facts.calendar;this.birth=facts.birth;this.factions=facts.factions;
 }
 adoptCampaignOnly(packet:CampaignOnlyMessage,acceptExtra?:(view:World)=>boolean):CampaignAdoption {
  const fail=(reason='Projection de campagne illisible.'):CampaignAdoption=>({status:'resync',reason});
  const header=this.header(packet);if(header==='stale')return {status:'stale'};if(header==='invalid'||packet.type!=='campaign-only'||Object.keys(packet).some(key=>!['type','epoch','revision','stepMs','speed','summary','urgentThreats','geography'].includes(key))||!record(packet.summary))return fail();
  const raw=packet.summary;
  if(!validWallDoorHistoricalTransport296(raw,raw.schemaVersion))return fail();
  // The two campaign-owned fields travel together. Reuse their native scalar
  // registry contract, without scanning alcohol dossiers in this read model.
  if(!isSchema265OrLater(raw.schemaVersion)?own(raw,'drugPolicies')||own(raw,'nextDrugPolicyId'):
   own(raw,'drugPolicies')!==own(raw,'nextDrugPolicyId')||own(raw,'drugPolicies')&&(raw.drugPolicies===undefined||raw.nextDrugPolicyId===undefined)||!validDrugPolicyRegistry265(raw.drugPolicies,raw.nextDrugPolicyId))return fail();
  if(!validNovelHistoricalTransport295(raw,raw.schemaVersion))return fail();
  if(!validToxicFalloutTransport294(raw,raw.schemaVersion))return fail();
  if(!validPeaceTalksHistorical293(raw,raw.schemaVersion)||!validPartyHistoricalTransport292(raw,raw.schemaVersion)||!validForestryHistoricalTransport291(raw,raw.schemaVersion)||!validFirefoamHistoricalTransport290(raw,raw.schemaVersion)||!validBillPauseHistoricalTransport289(raw,raw.schemaVersion)||!validAnimalThermalRefugeHistoricalTransport288(raw,raw.schemaVersion)||!validAnimalAreaHistoricalTransport287(raw,raw.schemaVersion)||!validLinkedStorageHistorical286(raw,raw.schemaVersion)||!validCoupleHistoricalTransport285(raw,raw.schemaVersion)||!validTradeRequestHistorical284(raw,raw.schemaVersion)||!validApparelProvenanceHistoricalTransport284(raw,raw.schemaVersion)||!validBillWorkerHistoricalTransport283(raw,raw.schemaVersion))return fail();
  if(!integer(raw.schemaVersion,1,SCHEMA_VERSION)||!integer(raw.tick)||!integer(raw.nextId,1)||!integer(raw.rng,0,0xffffffff)||!Number.isSafeInteger(raw.civilTick)||!projectionReferences(raw,false)
   ||!validSmoothFloorsHistoricalTransport281(raw,raw.schemaVersion)||!validPrisonerSurgeryHistoricalTransport280(raw,raw.schemaVersion)||!validGiftHistoricalTransport274(raw,raw.schemaVersion)||!validApparelTradeHistoricalTransport279(raw,raw.schemaVersion)||!validApparelReservesHistoricalTransport278(raw,raw.schemaVersion)||!validShipCasketHistoricalTransport277(raw,raw.schemaVersion)||!validShipPartHistoricalTransport276(raw,raw.schemaVersion)||!validShipReactorHistoricalTransport275(raw,raw.schemaVersion)||!rows(raw.events)||!rows(raw.people)||!rows(raw.lossContexts)||!rows(raw.lostMemories)||!rows(raw.incidents)
   ||own(raw,'tiles')||own(raw,'resources')||own(raw,'piles')||own(raw,'pawns')||own(raw,'structures')||own(raw,'jobs')||own(raw,'worldMaps')||own(raw,'worldGroups'))return fail();
  if(!validPhaseCore297(raw,Number(raw.schemaVersion))||!validCorePathBudget297(raw,Number(raw.schemaVersion),Number(raw.tick),isCorePhysicalSchema297(raw.schemaVersion)?Number(raw.phaseCore297):0,false))return fail('Physical mapless clock or unexpected local path budget');
  const geographic=this.geography.prepare(raw,packet.geography,own(packet,'geography'),packet.epoch!==this.epoch);if(!geographic.ok)return fail();
  const summary={...geographic.state},view=groupWorld(summary,null),calendar=summary.planet?.revision===3?summary.calendarOrigin:undefined;
  if(!view||!validHumanIngestionProjection299(view,view.schemaVersion)||!validIdleWanderProjection300(view,view.schemaVersion)||!validFrameProjection301(view,view.schemaVersion)||!validPeaceTalksBindings293(summary)||!validFirefoamWorld290(summary)||!validBillPauseWorld289(summary)||!validAnimalThermalRefugeWorld288(summary)||!validAnimalAreaWorld287(summary)||!validResidentTradeRequests284(view,summary)||!validLinkedStorageProjection286(summary)||!validBillWorkerWorld283(view)||!validCoupleProjection285(view)||!this.chronology(view,packet.epoch,calendar)||acceptExtra&&!acceptExtra(view)||!this.geography.canCommit(geographic))return fail();
  // Freezing is a representation adapter for exact native slots/free lists,
  // never inferred from final membership. Only the candidate is written.
  freezeAdmittedNativeWorldPawnOrder256(summary);view.worldPawns=summary.worldPawns;
  const facts=this.captureChronology(view,calendar);
  if(!this.geography.commit(geographic))throw Error('Lost resident geography preparation');
  const replaced=packet.epoch!==this.epoch;
  this.commitChronology(facts,packet.epoch,packet.revision);this.current=undefined;
  this.resourceSlots=new Map();this.pileSlots=new Map();this.structureSlots=new Map();
  // No new stamps are emitted. The next local checkpoint resets all three
  // generations, so a mapless interval can never bridge old/new map journals.
  return {status:'applied',replaced,summary};
 }
 adopt(packet:SnapshotMessage<true>,acceptExtra?:(view:World)=>boolean):SnapshotAdoption {
  const fail=(reason='Projection locale illisible.'):SnapshotAdoption=>({status:'resync',reason});
  const header=this.header(packet);if(header==='stale')return {status:'stale'};
  if(header==='invalid'||packet.type!=='snapshot'||packet.kind!=='checkpoint'&&packet.kind!=='delta')return fail('Invalid resident publication header');
  const unknown=Object.keys(packet).find(key=>!['type','kind','epoch','revision','stepMs','speed','world','geography','explorationApproachers','urgentThreats','motion','audioCues','corePhase297','baseRevision','tiles','resources','piles','structures'].includes(key));
  if(unknown)return fail('Unknown resident publication field: '+unknown);
  if(own(packet,'corePhase297')&&!isCorePhysicalSchema297(Number(packet.world?.schemaVersion)))return fail('Future physical header on historical resident World');
  const checkpoint=packet.kind==='checkpoint',sparseStructures=!checkpoint&&own(packet,'structures');
  const malformed=localShape(packet.world,checkpoint,sparseStructures,!checkpoint&&canReuseResidentAuxiliaryStockpiles(packet,this.current));if(malformed)return fail('Invalid resident shape: '+malformed);
  // Deep save-grade validation: every checkpoint, the first delta after it,
  // and then at most once per residentDeltaValidationIntervalMs (0 = always).
  const deep=packet.kind==='checkpoint'||!this.current||this.deepValidationDue();
  if(deep){
  if(!validNovelHistoricalTransport295(packet,packet.world.schemaVersion))return fail('Invalid or future resident Novel/reading data');
  if(!validWallDoorHistoricalTransport296(packet,packet.world.schemaVersion))return fail('Invalid or future resident wall-door successor data');
  if(!validToxicFalloutTransport294(packet,packet.world.schemaVersion))return fail('Invalid or future resident ToxicFallout condition or corpse rot credit');
  if(!validMiscIncidents(packet.world.miscIncidents,packet.world.schemaVersion,packet.world))return fail('Invalid resident Misc incident calendar');
  if(!validPeaceTalksHistorical293(packet,packet.world.schemaVersion))return fail('Invalid or future resident PeaceTalks transport');
  if(!validPartyHistoricalTransport292(packet,packet.world.schemaVersion))return fail('Invalid or future resident Party transport');
  if(!validForestryHistoricalTransport291(packet,packet.world.schemaVersion))return fail('Invalid or future resident Forestry transport');
  if(!this.firefoamTransport(packet,packet.world.schemaVersion))return fail('Invalid or future resident firefoam transport');
  if(!validBillPauseHistoricalTransport289(packet,packet.world.schemaVersion))return fail('Invalid or future resident bill reserve pause');
  }
  if(checkpoint&&['tiles','resources','piles','structures','baseRevision'].some(key=>own(packet,key)))return fail('Ambiguous resident checkpoint');
  const previous=this.current;
  if(!checkpoint&&(!previous||packet.epoch!==this.epoch||packet.baseRevision!==this.revision||packet.revision!==packet.baseRevision+1
   ||packet.world.schemaVersion!==previous.schemaVersion||packet.world.width!==previous.width||packet.world.height!==previous.height||packet.world.seed!==previous.seed
   ||mapIdentity(packet.world)!==mapIdentity(previous)||packet.world.tick<previous.tick))return fail('Missing resident predecessor or changed map.');
  const geographic=this.geography.prepare(packet.world,packet.geography,own(packet,'geography'),packet.epoch!==this.epoch);if(!geographic.ok)return fail(geographic.reason);
  let dynamic=geographic.state;
  // Reuse the existing exact omission contract, including site/seed/map/schema
  // identity. Own undefined never means inheritance; checkpoints never inherit.
  const river=prepareRiverWaterSnapshot256(dynamic,dynamic.schemaVersion,previous,{kind:packet.kind,epoch:packet.epoch,revision:packet.revision,
   ...packet.kind==='delta'?{baseRevision:packet.baseRevision}:{},previousEpoch:this.epoch,previousRevision:this.revision});
  if(!river.ok)return fail('Invalid resident river reference');if(river.inherited)dynamic={...dynamic,riverWater:river.owner!};
  let next:World,resourceSlots:Map<number,number>,pileSlots:Map<number,number>,structureSlots:Map<number,number>;
  let resourceIndices:number[]|undefined=[],structureIndices:number[]|undefined=[],tileIndices:number[]=[];
  let edge:ResourceStructureCandidate|undefined,baseEdge:ResourceStructureCandidate|undefined;
  if(checkpoint){
   next={...dynamic} as World;resourceSlots=slots(next.resources);pileSlots=slots(next.piles);structureSlots=slots(next.structures);
  }else{
   let tiles=previous!.tiles,resources=previous!.resources,piles=previous!.piles,structures=dynamic.structures;
   resourceSlots=this.resourceSlots;pileSlots=this.pileSlots;structureSlots=this.structureSlots;
   edge={beforeCount:resources.length,afterCount:resources.length,removed:[],added:[],updated:[]};
   baseEdge=edge;
   if(own(packet,'tiles')){const prepared=tileChanges(tiles,packet.tiles);if(!prepared)return fail('Invalid resident tile indices');tiles=prepared.tiles;tileIndices=prepared.indices;}
   if(own(packet,'resources')){
    const prepared=patchCollection(resources,this.resourceSlots,packet.resources,dynamic.nextId,dynamic.tick,value=>validPlantLife(value,dynamic.schemaVersion,dynamic));if(!prepared)return fail('Invalid resident resource references');
    resources=prepared.values;resourceSlots=prepared.slots;resourceIndices=prepared.indices;edge=prepared.edge;baseEdge=prepared.baseEdge;
   }
   if(own(packet,'piles')){
    const prepared=patchCollection(piles,this.pileSlots,packet.piles,dynamic.nextId);if(!prepared)return fail('Invalid resident pile references');
    piles=prepared.values;pileSlots=prepared.slots;
   }
   if(sparseStructures){
    const prepared=patchCollection(previous!.structures,this.structureSlots,packet.structures,dynamic.nextId);if(!prepared)return fail('Invalid resident structure references');
    structures=prepared.values;structureSlots=prepared.slots;structureIndices=prepared.indices;
   }else {structureSlots=slots(structures!);structureIndices=undefined;}
   // Preserve historical root key order and complete dynamic replacement:
   // missing optional fields are removed, never resurrected from an old World.
   next={...previous,...dynamic,structures,tiles,resources,piles} as World;
   for(const key of Object.keys(previous!)as (keyof World)[])if(key!=='tiles'&&key!=='resources'&&key!=='piles'&&key!=='structures'&&!own(dynamic,key))delete (next as Partial<World>)[key];
  }
  if(deep){
  if(!validPeaceTalksBindings293(next)||!validPartyWorld292(next)||!validForestryPolicies291(next))return fail('Invalid or locked forest growing policy');
  // Both transport fences already accepted this exact packet and schema above.
  if(!this.firefoamWorld(next,packet)||!validBillPauseWorld289(next)||!validAnimalThermalRefugeHistoricalTransport288(packet,next.schemaVersion)||!validAnimalAreaHistoricalTransport287(packet,next.schemaVersion)||!validAnimalThermalRefugeWorld288(next)||!validAnimalAreaWorld287(next)||!validLinkedStorageHistorical286(packet,next.schemaVersion)||!validCoupleHistoricalTransport285(packet,next.schemaVersion)||!validTradeRequestHistorical284(packet,next.schemaVersion)||!validApparelProvenanceHistoricalTransport284(packet,next.schemaVersion)||!validResidentTradeRequests284(next)||!validBillWorkerHistoricalTransport283(packet,next.schemaVersion)||!validLinkedStorageProjection286(next)||!validBillWorkerWorld283(next)||!validCoupleProjection285(next))return fail('Invalid resident couple or bill worker settings');
  if(!validAnimalTrainingHistoricalTransport282(packet,next.schemaVersion)||!validAnimalTrainingWorld282(next))return fail('Invalid resident animal training or hauling');
  if(!validSmoothFloorsHistoricalTransport281(packet,next.schemaVersion)||!validSmoothFloorWorld281(next,packet.epoch===this.epoch?previous:undefined))return fail('Invalid resident natural stone smoothing');
  if((checkpoint?next.tiles.some(t=>!validSmoothFloorTile281(t,next.schemaVersion)):tileIndices.some(i=>!validSmoothFloorTile281(next.tiles[i]!,next.schemaVersion))))return fail('Invalid resident smoothed terrain');
  if(!validPrisonerSurgeryHistoricalTransport280(packet,next.schemaVersion)||!validPrisonerSurgeryWorld280(next))return fail('Invalid resident captive surgery');
  if(next.structures.some(s=>!validApparelReservesBuilding278(s,next.schemaVersion))||next.packed.some(p=>!validApparelReservesBuilding278(p.building,next.schemaVersion)))return fail('Invalid resident apparel reserve settings');
  if(!validApparelTradeHistoricalTransport279(packet,next.schemaVersion)||!validApparelTradeWorld279(next))return fail('Invalid resident ordinary apparel custody');
  if(!validReadingWorld295(next))return fail('Invalid resident Novel ownership, reading phase or reservation');
  if(!validWallDoorWorld296(next)||!validWallDoorResidentNamespace296(next))return fail('Invalid resident wall-door target, work owner or successor identity');
  if(!validHumanIngestionProjection299(next,next.schemaVersion))return fail('Invalid actual human ingestion clock or provider provenance');
  if(!validIdleWanderProjection300(next,next.schemaVersion))return fail('Invalid actual local civil wander task');
  if(!validFrameProjection301(next,next.schemaVersion))return fail('Invalid actual FinishFrame301 owner or work');
   this.lastDeepValidationAt=residentClock();
  }
  const calendar=next.planet?.revision===3&&next.campaignMap?.revision===2?next.campaignMap.calendarOrigin:undefined;
  if(!this.chronology(next,packet.epoch,calendar)||acceptExtra&&!acceptExtra(next)||!this.geography.canCommit(geographic))return fail('Rejected resident transaction');
  freezeAdmittedNativeWorldPawnOrder256(next);if(!river.inherited&&next.riverWater)freezeAdmittedRiverWater256(next.riverWater);
  const facts=this.captureChronology(next,calendar);
  if(!this.geography.commit(geographic))throw Error('Lost resident geography preparation');
  const replaced=packet.epoch!==this.epoch;
  this.commitChronology(facts,packet.epoch,packet.revision);
  this.current=next;this.resourceSlots=resourceSlots;this.pileSlots=pileSlots;this.structureSlots=structureSlots;
  // Publish only after the complete adoption commits. BASE has its own WeakMap
  // capability; it must never overwrite the full public resource witness.
  if(checkpoint||!previous){this.changes.reset(next,packet.epoch,packet.revision);this.structures.reset(next,packet.epoch,packet.revision);this.resourceStructure.reset(next,packet.epoch,packet.revision,next.resources.length);}
  else {this.changes.append(previous,next,packet.epoch,packet.revision,resourceIndices,tileIndices);this.structures.append(previous,next,packet.epoch,packet.revision,structureIndices,tileIndices);this.resourceStructure.append(previous,next,packet.epoch,packet.revision,edge,tileIndices,next.resources.length);}
  if(checkpoint||!previous)this.resourceBase.reset(next,packet.epoch,packet.revision,next.resources.length);
  else this.resourceBase.append(previous,next,packet.epoch,packet.revision,baseEdge,next.resources.length);
  return {status:'applied',world:next,replaced};
 }
}
