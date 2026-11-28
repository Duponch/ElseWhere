import {isConduitKind} from './conduit-kinds-382.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {humanMoveSpeedFactor297} from './human-move-speed-297.ts';
import type {DuckTerrainOverride256} from './duck-water-256.ts';
import {naturalTerrainCosts256} from './natural-terrain-movement-256.ts';
import {isWetTerrain} from './shallow-water.ts';
import {MARSH_PATH_COST_CORE,MARSH_PERCEIVED_CORE} from './marsh.ts';
import {snowTravelDelay,snowSearchCost} from './snow-rules.ts';
import { fireNavigationCosts,addFireNavigationCosts } from './fire-navigation.ts';
import { doorWait,isFenceGateSpeedSchema303,isRoomDoor } from './door-rules.ts';
import { footprintCells, footprintContains } from './definitions.ts';
import { frameAt, frameCosts, FRAME_TRAVEL_DELAY } from './construction-costs.ts';
import { LayeredMap,LayeredSet,overlayNavigationCosts,captureNavigationCostLayers,captureNavigationCostProgram379,transformNavigationCosts,type NavigationCostLookup } from './navigation-costs.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { isTrapKind357 } from './ied-traps-357.ts';
import { spikeTrapKnowsOf,spikeTrapNavigationActor,SPIKE_TRAP_SEARCH_COST,SPIKE_TRAP_WALK_DELAY } from './spike-trap-state.ts';
import type { Cell, StructureKind, World } from './types.ts';
import { captureStructureNavigation,filteredStructures,type StructureNavigationGeometry } from './structure-navigation.ts';
import { captureTerrainReadCursor,readTerrainJournal,terrainWriteCount,verifyTerrainWriteCaches,type TerrainJournalCursor } from './terrain-mutation-journal.ts';
import {terrainReadScope,terrainJournalReadOwner} from './terrain-read-scope.ts';
import { PILE_CHUNK,PILE_MATERIAL_FLOOR,materialFloorPile,pileIndex,capturePileGroundFacts379,captureGroundChunkOrder379,pileIndexMismatch,verifyPileIndex,type PileIndex } from './pile-index.ts';
import {captureFrameGeometry379} from './frame-geometry-379.ts';
import {humanById379} from './human-roster-379.ts';
import type {Pawn} from './types.ts';

/** Core natural floors cost two Core ticks. Historical grass/soil stay neutral. */
export function terrainTravelDelay(world:World,index:number):number {
  const tile=world.tiles[index],terrain=tile?.terrain;
  if(tile?.bridge)return 0;
  if(tile?.floor)return FLOOR_DEFINITIONS[tile.floor].pathCost/10;
  const natural=naturalTerrainCosts256(terrain);if(natural)return natural.pathCostCore/10;
  if(isWetTerrain(terrain))return MARSH_PATH_COST_CORE/10;
  return terrain==='rough-stone'||terrain==='rich-soil'||terrain==='gravel'||world.site&&terrain==='grass'||isCorePhysicalSchema297(Number(world.schemaVersion))&&(terrain==='grass'||terrain==='soil')?.2:0;
}

/** Current Core wiki path costs, converted by the local day/tick ratio (10).
 * Repeat suppression is shared by all qualifying furniture, not by instance. */
export const FURNITURE_TRAVEL:Readonly<Record<StructureKind,Readonly<{delay:number;stand:boolean;repeat:boolean}>>>=Object.freeze({
  // Schema 354, Buildings_Joy pathCost: hoopstone 14 (Standable), Game of Ur 14, billiards and poker 42.
  'hoopstone-ring':{delay:1.4,stand:true,repeat:false},'game-of-ur-board':{delay:1.4,stand:false,repeat:true},
  'billiards-table':{delay:4.2,stand:false,repeat:true},'poker-table':{delay:4.2,stand:false,repeat:true},
  'ship-cryptosleep-casket':{delay:4.2,stand:false,repeat:true},
  'ship-computer':{delay:0,stand:false,repeat:false},'ship-sensors':{delay:0,stand:false,repeat:false},
  'ship-beam':{delay:0,stand:false,repeat:false},'ship-engine':{delay:0,stand:false,repeat:false},
  'ship-reactor':{delay:0,stand:false,repeat:false},
  'fueled-smithy':{delay:5,stand:false,repeat:true},'electric-smithy':{delay:5,stand:false,repeat:true},
  brewery:{delay:5,stand:false,repeat:true},'fermenting-barrel':{delay:4.2,stand:false,repeat:true},
  'insect-hive':{delay:4.2,stand:false,repeat:true},'glow-pod':{delay:0,stand:false,repeat:true},
  'ancient-cryptosleep-casket':{delay:4.2,stand:false,repeat:true},
  'cryptosleep-casket':{delay:4.2,stand:false,repeat:true},
  column:{delay:0,stand:false,repeat:true},urn:{delay:3,stand:false,repeat:true},'stele-large':{delay:5,stand:false,repeat:true},'stele-grand':{delay:5,stand:false,repeat:true},sarcophagus:{delay:4.2,stand:false,repeat:true},
  shelf:{delay:5,stand:false,repeat:true},'small-shelf':{delay:5,stand:false,repeat:true},
  'firefoam-popper':{delay:3,stand:false,repeat:true},
  'tool-cabinet':{delay:4.2,stand:false,repeat:true},
  // Schema 374 EggBox: Standable, pathCost 10, pathCostIgnoreRepeat default.
  'egg-box':{delay:1,stand:true,repeat:true},
  'spike-trap':{delay:0,stand:true,repeat:false},
  'ied-high-explosive':{delay:0,stand:true,repeat:false},'ied-incendiary':{delay:0,stand:true,repeat:false},
  'double-bed':{delay:4.2,stand:false,repeat:true},
  'electric-crematorium':{delay:0,stand:false,repeat:false},
  'electric-smelter':{delay:5,stand:false,repeat:true},
  'biofuel-refinery':{delay:5,stand:false,repeat:true},
  'geothermal-generator':{delay:0,stand:false,repeat:false},
  'chemfuel-generator':{delay:5,stand:false,repeat:true},
  'nutrient-paste-dispenser':{delay:0,stand:false,repeat:false},
  hopper:{delay:4.2,stand:false,repeat:false},
  'orbital-beacon':{delay:1.4,stand:false,repeat:false},
  'comms-console':{delay:5,stand:false,repeat:true},
  'deep-drill':{delay:5,stand:false,repeat:true},
  'ground-scanner':{delay:5,stand:false,repeat:true},
  'vitals-monitor':{delay:.5,stand:false,repeat:true},
  'hydroponics-basin':{delay:3,stand:false,repeat:true},
  'mini-turret':{delay:5,stand:false,repeat:true},
  'tube-television':{delay:4.2,stand:false,repeat:true},
  'ancient-road-barrier':{delay:4.2,stand:false,repeat:true},
  'ancient-road-lamp':{delay:4.2,stand:false,repeat:false},
  'ship-chunk':{delay:4.2,stand:false,repeat:true},
  sandbags:{delay:4.2,stand:false,repeat:true},barricade:{delay:4.2,stand:false,repeat:true},
  'drug-lab':{delay:5,stand:false,repeat:true},
  'art-bench':{delay:5,stand:false,repeat:true},
  'fabrication-bench':{delay:5,stand:false,repeat:true},
  'hi-tech-research-bench':{delay:5,stand:false,repeat:true},
  'multi-analyzer':{delay:5,stand:false,repeat:true},
  'small-sculpture':{delay:5,stand:false,repeat:true},
  'large-sculpture':{delay:5,stand:false,repeat:true},
  grave:{delay:0,stand:true,repeat:false},
  heater:{delay:3,stand:false,repeat:true},
  'wind-turbine':{delay:5,stand:false,repeat:true},
  'power-conduit':{delay:0,stand:true,repeat:false},
  'hidden-conduit':{delay:0,stand:true,repeat:false},
  'power-switch':{delay:0,stand:true,repeat:false},
  battery:{delay:5,stand:false,repeat:true},
  'solar-generator':{delay:5,stand:false,repeat:true},
  'fueled-stove':{delay:5,stand:false,repeat:true},
  'electric-stove':{delay:5,stand:false,repeat:true},
  'butcher-table':{delay:5,stand:false,repeat:true},
  cooler:{delay:0,stand:false,repeat:false},
  vent:{delay:0,stand:false,repeat:false},
  'research-bench':{delay:5,stand:false,repeat:true},
  'tailor-bench':{delay:5,stand:false,repeat:true},
  'machining-table':{delay:5,stand:false,repeat:true},
  'electric-tailor-bench':{delay:5,stand:false,repeat:true},
  'butcher-spot':{delay:0,stand:true,repeat:false},
  'sleeping-spot':{delay:0,stand:true,repeat:false},
  'animal-sleeping-spot':{delay:0,stand:true,repeat:false},
  'crafting-spot':{delay:0,stand:true,repeat:false},
  'wood-generator':{delay:5,stand:false,repeat:true},
  'torch-lamp':{delay:1.4,stand:false,repeat:false},
  'standing-lamp':{delay:1.4,stand:false,repeat:false},
  'sun-lamp':{delay:1.4,stand:false,repeat:false},
  'passive-cooler':{delay:3,stand:false,repeat:true},
  door:{delay:0,stand:true,repeat:false},
  autodoor:{delay:0,stand:true,repeat:false},
  fence:{delay:2,stand:true,repeat:false},
  'fence-gate':{delay:0,stand:true,repeat:false},
  'pen-marker':{delay:0,stand:true,repeat:false},
  stonecutter:{delay:5,stand:false,repeat:true},
  wall:{delay:0,stand:false,repeat:false},table:{delay:4.2,stand:false,repeat:true},'table-square':{delay:4.2,stand:false,repeat:true},'table-long':{delay:4.2,stand:false,repeat:true},'table-large':{delay:4.2,stand:false,repeat:true},'double-bedroll':{delay:1.4,stand:true,repeat:true},'double-sleeping-spot':{delay:0,stand:true,repeat:false},'wall-lamp':{delay:0,stand:true,repeat:false},'chess-table':{delay:3,stand:false,repeat:true},
  bedroll:{delay:1.4,stand:true,repeat:true},
  bed:{delay:4.2,stand:false,repeat:true},
  'hospital-bed':{delay:4.2,stand:false,repeat:true},campfire:{delay:4.2,stand:false,repeat:true},
  stool:{delay:3,stand:true,repeat:true},'dining-chair':{delay:3,stand:true,repeat:true},armchair:{delay:3,stand:true,repeat:true},couch:{delay:3,stand:true,repeat:true},'end-table':{delay:3,stand:false,repeat:true},dresser:{delay:5,stand:false,repeat:true},'flower-pot':{delay:3,stand:false,repeat:true},horseshoes:{delay:1.4,stand:true,repeat:false},
});
export function canStandAt(world:World,cell:Cell,geometry?:StructureNavigationGeometry):boolean {
  const version=world.schemaVersion;
  geometry??=captureStructureNavigation(world);
  if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height||['rock','water'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain))return false;
  for(const s of geometry?.at(cell)??world.structures)if((geometry||footprintContains(s,cell))&&(version<22?s.kind==='wall'||s.kind==='table':!FURNITURE_TRAVEL[s.kind].stand))return false;
  if(version>=28){
    // The cell is an in-map integer cell here: the pile index answers in a step.
    const index=pileIndex(world),indexed=index?!!(index.groundFacts[cell.z*world.width+cell.x]!&PILE_CHUNK):undefined;
    const chunk=indexed!==undefined&&!verifyPileIndex?indexed:world.piles.some(p=>p.kind==='chunk'&&p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z);
    if(indexed!==undefined&&indexed!==chunk)pileIndexMismatch('standable chunk');
    if(chunk)return false;
  }
  const frames=version>=22?captureFrameGeometry379(world):undefined;
  return frames?!frames.standDenied.has(cell.z*world.width+cell.x):!world.jobs.some(j=>(version<16&&(j.kind==='wall'||j.kind==='table')||version>=22&&j.construction==='frame'&&!isConduitKind(j.kind)&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')&&footprintContains(j,cell));
}
/** For a batch of point queries in one read-only decision. Discard before any
 * world mutation; this is not a shared navigation or cross-actor cache. */
/* Structure part of the standability mask, per (immutable) shared geometry and
 * rule era: kinds never change, so it is fixed for a geometry. Indexed by the
 * in-map cell, exactly the set the per-call capture used to rebuild. */
const structureStandDenied=new WeakMap<StructureNavigationGeometry,{width:number;size:number;masks:(Uint8Array|undefined)[]}>();
function structureDeniedMask(world:World,geometry:StructureNavigationGeometry,legacy:boolean):Uint8Array {
  const size=world.width*world.height;let entry=structureStandDenied.get(geometry);
  if(!entry||entry.width!==world.width||entry.size!==size){entry={width:world.width,size,masks:[]};structureStandDenied.set(geometry,entry);}
  const slot=legacy?1:0;let mask=entry.masks[slot];
  if(!mask){mask=new Uint8Array(size);for(const {structure:s,cells} of geometry.entries)if(legacy?s.kind==='wall'||s.kind==='table':!FURNITURE_TRAVEL[s.kind].stand)for(const i of cells)if(i>=0&&i<size)mask[i]=1;entry.masks[slot]=mask;}
  return mask;
}
export function captureStandability(world:World,geometry?:StructureNavigationGeometry):(cell:Cell)=>boolean {
  const version=world.schemaVersion;
  geometry??=captureStructureNavigation(world);
  const denied=new Set<number>(),add=(s:Parameters<typeof footprintCells>[0])=>{for(const c of footprintCells(s))denied.add(c.z*world.width+c.x);};
  const structures=geometry?structureDeniedMask(world,geometry,version<22):undefined;
  if(!geometry)for(const s of world.structures)if(version<22?s.kind==='wall'||s.kind==='table':!FURNITURE_TRAVEL[s.kind].stand)add(s);
  const frameDenied=version>=22?captureFrameGeometry379(world)?.standDenied:undefined;
  if(!frameDenied)for(const j of world.jobs)if(version<16&&(j.kind==='wall'||j.kind==='table')||version>=22&&j.construction==='frame'&&!isConduitKind(j.kind)&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')add(j);
  // Ground chunks: inside a simulation step, a copy of the pile index's facts
  // taken now (the same cells as the chunk list, as a snapshot); else the list.
  const index=version>=28?pileIndex(world):undefined;
  const chunks=index&&!verifyPileIndex&&index.groundFacts.length===world.width*world.height?(terrainJournalReadOwner()?capturePileGroundFacts379(index).facts:index.groundFacts.slice()):undefined;
  if(version>=28&&!chunks)for(const p of groundChunkPiles(world))denied.add(p.owner.z*world.width+p.owner.x);
  return cell=>{
    if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)return false;
    const i=cell.z*world.width+cell.x,terrain=world.tiles[i]!.terrain;
    return terrain!=='rock'&&terrain!=='water'&&!structures?.[i]&&!(chunks&&chunks[i]!&PILE_CHUNK)&&!frameDenied?.has(i)&&!denied.has(i);
  };
}
/* Every ground chunk / material-floor pile, in array order: from the pile
 * index inside a simulation step, else from a scan (the same filter). */
type GroundPile=World['piles'][number]&{owner:{type:'ground';x:number;z:number}};
function sameList(a:readonly unknown[],b:readonly unknown[]):boolean {if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function groundChunkPiles(world:World):readonly GroundPile[] {
  const index=pileIndex(world);
  if(index&&!verifyPileIndex)return index.groundChunks as readonly GroundPile[];
  const scanned=world.piles.filter(p=>p.kind==='chunk'&&p.owner.type==='ground') as GroundPile[];
  if(index&&!sameList(index.groundChunks,scanned))pileIndexMismatch('ground chunks');
  return scanned;
}
function groundMaterialFloorPiles(world:World):readonly GroundPile[] {
  const index=pileIndex(world),version=world.schemaVersion;
  if(index&&!verifyPileIndex)return index.groundMaterialFloors as readonly GroundPile[];
  const scanned=world.piles.filter(p=>materialFloorPile(version,p.kind)&&p.owner.type==='ground') as GroundPile[];
  if(index&&!sameList(index.groundMaterialFloors,scanned))pileIndexMismatch('ground material floors');
  return scanned;
}
const inMap=(world:World,c:Cell)=>Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height;
export function furnitureDelay(world:World,from:Cell,to:Cell,terrainOverride?:DuckTerrainOverride256,geometry?:StructureNavigationGeometry):number {
  const version=world.schemaVersion;
  if(version<22)return frameAt(world,to)?FRAME_TRAVEL_DELAY:0;
  let target:StructureKind|undefined,previousRepeats=false,trap=false;
  // Shared footprint index: identical membership/order to the full scan
  // (footprintContains ≡ footprintCells for every structure kind).
  geometry??=captureStructureNavigation(world);
  if(geometry){
    for(const s of geometry.at(to)){
      if(!isConduitKind(s.kind)&&(s.kind!=='wall-lamp'||version<382||target===undefined))target=s.kind;
      if(isTrapKind357(s.kind)&&s.spikeTrap&&s.x===to.x&&s.z===to.z)trap=true;
    }
    previousRepeats=geometry.at(from).some(s=>FURNITURE_TRAVEL[s.kind].repeat);
  }else for(const s of world.structures) {
    if(!isConduitKind(s.kind)&&(s.kind!=='wall-lamp'||version<382||target===undefined)&&footprintContains(s,to))target=s.kind;
    if(isTrapKind357(s.kind)&&s.spikeTrap&&s.x===to.x&&s.z===to.z)trap=true;
    if(footprintContains(s,from)&&FURNITURE_TRAVEL[s.kind].repeat)previousRepeats=true;
  }
  let objectDelay=target?FURNITURE_TRAVEL[target].delay:frameAt(world,to)?FRAME_TRAVEL_DELAY:0;
  let repeats=target?FURNITURE_TRAVEL[target].repeat:false,materialDelay=0;
  // Inside a simulation step, the pile index answers for the two in-map cells
  // (an OR over each cell's ground piles; a pile outside the map matches none).
  const facts=inMap(world,to)&&inMap(world,from)?pileIndex(world)?.groundFacts:undefined;
  if(facts&&!verifyPileIndex){
    const atTo=facts[to.z*world.width+to.x]!,atFrom=facts[from.z*world.width+from.x]!;
    if(atTo&PILE_CHUNK){objectDelay=Math.max(objectDelay,4.2);repeats=true;}
    if(atFrom&PILE_CHUNK)previousRepeats=true;
    if(atTo&PILE_MATERIAL_FLOOR)materialDelay=1.4;
  }else{
    const scoped=facts?{objectDelay,repeats,previousRepeats}:undefined;
    // One pass over the piles, cell test first: only ground piles on `to` or
    // `from` matter, for the chunk (repeat) rule and the material-floor rule.
    for(const p of world.piles){
      const owner=p.owner;if(owner.type!=='ground')continue;
      const atTo=owner.x===to.x&&owner.z===to.z,atFrom=owner.x===from.x&&owner.z===from.z;
      if(!atTo&&!atFrom)continue;
      if(version>=28&&p.kind==='chunk'){if(atTo){objectDelay=Math.max(objectDelay,4.2);repeats=true;}if(atFrom)previousRepeats=true;}
      if(atTo&&(version>=29&&p.kind==='steel'||version>=32&&p.kind==='blocks'||version>=41&&p.kind==='component'||version>=123&&(p.kind==='gold'||p.kind==='plasteel'||p.kind==='advanced-component')))materialDelay=1.4;
    }
    if(scoped&&facts){
      const atTo=facts[to.z*world.width+to.x]!,atFrom=facts[from.z*world.width+from.x]!;
      const expected={objectDelay:atTo&PILE_CHUNK?Math.max(scoped.objectDelay,4.2):scoped.objectDelay,repeats:scoped.repeats||!!(atTo&PILE_CHUNK),previousRepeats:scoped.previousRepeats||!!(atFrom&PILE_CHUNK),materialDelay:atTo&PILE_MATERIAL_FLOOR?1.4:0};
      if(expected.objectDelay!==objectDelay||expected.repeats!==repeats||expected.previousRepeats!==previousRepeats||expected.materialDelay!==materialDelay)pileIndexMismatch('travel delay piles');
    }
  }
  const actor=trap?spikeTrapNavigationActor(world,from):undefined,overrideCost=terrainOverride?.coreCost(world.tiles[to.z*world.width+to.x]!);
  return Math.max(repeats&&previousRepeats?0:objectDelay,materialDelay,(overrideCost===undefined?terrainTravelDelay(world,to.z*world.width+to.x):overrideCost/10),world.snow?snowTravelDelay(world.tiles[to.z*world.width+to.x]!.snowDepth??0):0)
    +(actor&&spikeTrapKnowsOf(world,actor)?SPIKE_TRAP_WALK_DELAY:0);
}
interface TerrainCostLayer {terrain:Uint8Array|Uint16Array;maximum:number;marsh:ReadonlyMap<number,number>}
/** Per-cell terrain search costs, a pure function of the tiles (terrain, floor,
 * bridge, snow), the schema, site/snow flags and the drafted marsh perception.
 * A closed simulation call validates Tile identities on its first read and
 * then follows marked writes. A new immutable layer copies the prior one and
 * refreshes precisely those cells when the bounded history is complete;
 * flooring between actors is observed too. Consumers only read the layer.
 * Public reads and history/configuration gaps use a complete capture. */
interface TerrainLayers {writes:number;version:number;site:boolean;snow:boolean;layers:Map<string,TerrainCostLayer>;cursor:TerrainJournalCursor;refs:World['tiles'][number][];scope:number;owner?:object;previous?:Map<string,TerrainCostLayer>;changed?:readonly number[]}
const terrainLayers=new WeakMap<readonly World['tiles'][number][],TerrainLayers>();
function terrainCostLayer(world:World,version:number,drafted:boolean,snow:boolean,terrainOverride?:DuckTerrainOverride256):TerrainCostLayer {
  const tiles=world.tiles,hasSite=!!world.site,scope=terrainReadScope(),owner=terrainJournalReadOwner();
  // An override is kept only when it names itself a pure function of the tile.
  // Public mutable fixtures have no closed writer contract: always read them.
  if(scope===undefined||terrainOverride&&terrainOverride.layerKey===undefined){const old=terrainLayers.get(tiles);if(old&&scope===undefined)old.owner=undefined;return computeTerrainCostLayer(world,version,drafted,snow,hasSite,terrainOverride);}
  const writes=terrainWriteCount(tiles);let entry=terrainLayers.get(tiles);
  if(!entry||entry.version!==version||entry.site!==hasSite||entry.snow!==snow||entry.refs.length!==tiles.length){
    entry={writes,version,site:hasSite,snow,layers:new Map(),cursor:captureTerrainReadCursor(tiles),refs:tiles.slice(),scope,owner};terrainLayers.set(tiles,entry);
  }else{
    let changed:readonly number[]|undefined,complete=true;
    if(entry.writes!==writes){const delta=readTerrainJournal(tiles,entry.cursor);changed=delta?.indices;complete=!!delta;}
    // A new call admits external direct Tile replacements too. Within the
    // call only marked cells can change. Check that proof in verification.
    const sameObservation=entry.scope===scope||owner!==undefined&&entry.owner===owner;
    if(complete&&(!sameObservation||verifyTerrainWriteCaches)){
      let unexpected=false;const allowed=changed?new Set(changed):undefined;
      for(let i=0;i<tiles.length;i++)if(entry.refs[i]!==tiles[i]&&!allowed?.has(i)){unexpected=true;break;}
      if(unexpected){if(sameObservation&&verifyTerrainWriteCaches)throw Error('Unmarked terrain replacement within navigation-cost simulation scope');complete=false;}
    }
    if(entry.writes!==writes||!complete){
      const previous=complete?entry.layers:undefined,refs=entry.refs;
      if(complete){for(const i of changed??[])refs[i]=tiles[i]!;}else for(let i=0;i<tiles.length;i++)refs[i]=tiles[i]!;
      entry={writes,version,site:hasSite,snow,layers:new Map(),cursor:captureTerrainReadCursor(tiles),refs,scope,owner,previous,changed};terrainLayers.set(tiles,entry);
    }else {entry.scope=scope;entry.owner=owner;}
  }
  const slot=`${drafted?1:0}${terrainOverride?.layerKey??''}`,cached=entry.layers.get(slot);
  if(cached){
    if(verifyTerrainWriteCaches){const fresh=computeTerrainCostLayer(world,version,drafted,snow,hasSite,terrainOverride);
      if(fresh.maximum!==cached.maximum||fresh.terrain.length!==cached.terrain.length||fresh.terrain.some((v,i)=>v!==cached.terrain[i])||fresh.marsh.size!==cached.marsh.size||[...fresh.marsh].some(([k,v])=>cached.marsh.get(k)!==v))throw Error('Unmarked terrain write under an unchanged Tile[] count');}
    return cached;
  }
  // No override: all built-in terrain costs fit the stored integer layer.
  // A custom override retains its complete evaluation and maximum contract.
  const previous=!terrainOverride?entry.previous?.get(slot):undefined;
  const layer=computeTerrainCostLayer(world,version,drafted,snow,hasSite,terrainOverride,previous,previous?entry.changed:undefined);entry.layers.set(slot,layer);
  if(verifyTerrainWriteCaches){const fresh=computeTerrainCostLayer(world,version,drafted,snow,hasSite,terrainOverride);if(fresh.maximum!==layer.maximum||fresh.terrain.some((v,i)=>v!==layer.terrain[i])||fresh.marsh.size!==layer.marsh.size||[...fresh.marsh].some(([i,v])=>layer.marsh.get(i)!==v))throw Error('Incremental terrain navigation costs differ from a complete capture');}
  return layer;
}
function computeTerrainCostLayer(world:World,version:number,drafted:boolean,snow:boolean,hasSite:boolean,terrainOverride?:DuckTerrainOverride256,previous?:TerrainCostLayer,changed?:readonly number[]):TerrainCostLayer {
  let terrain:Uint8Array|Uint16Array=previous?previous.terrain.slice():new Uint8Array(world.tiles.length);let terrainMaximum=previous?.maximum??0,maximumRemoved=false;const marshPerceptionCosts=new Map<number,number>(previous?.marsh);
  // Capture terrain on every decision: flooring can mutate between actors
  // within a tick. Read floor definitions when a floor is present, like the
  // scalar travel rule, without scanning the whole map through that helper.
  const tiles=world.tiles;
  const marshPerception=drafted?MARSH_PERCEIVED_CORE.drafted:MARSH_PERCEIVED_CORE.ordinary;
  // Definition facts are frozen; retain only their conversions in this one
  // capture. Every Tile and override is still read in the original order.
  const naturalByKind=new Map<World['tiles'][number]['terrain'],{pathCost:number;perceivedCore:number;perceivedCost:number}|null>();
  const readNatural=(kind:World['tiles'][number]['terrain'])=>{
    const cached=naturalByKind.get(kind);if(cached!==undefined)return cached;
    const definition=naturalTerrainCosts256(kind),perceivedCore=definition?(drafted?definition.perceivedDraftedCore:definition.perceivedCivilCore):0;
    const captured=definition?{pathCost:Math.round(definition.pathCostCore/30*1000),perceivedCore,perceivedCost:Math.round(perceivedCore/30*1000)}:null;
    naturalByKind.set(kind,captured);return captured;
  };
  for(let k=0;k<(changed?.length??tiles.length);k++){
    const i=changed?changed[k]!:k;
    const tile=tiles[i]!,kind=tile.terrain;
    let cost=tile.floor?Math.round(FLOOR_DEFINITIONS[tile.floor].pathCost/10/3*1000):kind==='rough-stone'||kind==='rich-soil'||kind==='gravel'||hasSite&&kind==='grass'||isCorePhysicalSchema297(Number(version))&&(kind==='grass'||kind==='soil')?67:0;
    const natural=readNatural(kind);
    if(natural&&!tile.bridge&&!tile.floor)cost=natural.pathCost;
    else if(isWetTerrain(kind)&&!tile.bridge&&!tile.floor)cost=Math.round(MARSH_PATH_COST_CORE/30*1000);
    const override=terrainOverride?.coreCost(tile);if(override!==undefined)cost=Math.round(override/30*1000);
    if(snow)cost=Math.max(cost,snowSearchCost(tile.snowDepth??0));
    const perceivedOverride=terrainOverride?.perceivedCore(tile),perception=perceivedOverride??(natural?natural.perceivedCore:isWetTerrain(kind)?marshPerception:0);
    if(perception&&!tile.bridge&&!tile.floor)marshPerceptionCosts.set(i,perceivedOverride==null&&natural?natural.perceivedCost:Math.round(perception/30*1000));else if(previous)marshPerceptionCosts.delete(i);
    if(cost>255&&terrain instanceof Uint8Array){const wide:Uint16Array=new Uint16Array(terrain.length);wide.set(terrain);terrain=wide;}
    if(previous&&terrain[i]===previous.maximum&&cost<previous.maximum)maximumRemoved=true;
    terrain[i]=cost;if(cost>terrainMaximum)terrainMaximum=cost;
  }
  if(maximumRemoved){terrainMaximum=0;for(let i=0;i<terrain.length;i++)if(terrain[i]!>terrainMaximum)terrainMaximum=terrain[i]!;}
  return {terrain,maximum:terrainMaximum,marsh:marshPerceptionCosts};
}
/* Structure part of the navigation costs, per (immutable) shared geometry.
 * Kinds and footprint cells never change for a geometry, so this is exactly
 * what every search rebuilt from its entries: in entry order, the delay of the
 * last structure setting a cell (inserted at its first setting), the repeater
 * and stop cells, and the spike-trap entries, whose state is still read live. */
interface StructureTravelBase {costs:ReadonlyMap<number,number>;costMaximum:number;repeaters:ReadonlySet<number>;stops:ReadonlySet<number>;traps:readonly StructureNavigationGeometry['entries'][number][]}
const structureTravelBases=new WeakMap<StructureNavigationGeometry,StructureTravelBase>();
/** Immutable columns of a shared structural capture. Mutable doors, piles,
 * frames and terrain remain on the decision's own layers. Zero means absent:
 * the structural cost map contains only strictly positive furniture delays. */
interface StructureTravelColumns {size:number;pages:({costs:Float64Array;flags:Uint8Array}|undefined)[]}
const structureTravelColumns=new WeakMap<StructureTravelBase,StructureTravelColumns>();
function travelColumns(base:StructureTravelBase,size:number):StructureTravelColumns {
  let columns=structureTravelColumns.get(base);
  if(!columns||columns.size!==size){
    const pages:StructureTravelColumns['pages']=new Array(Math.ceil(size/256));
    const page=(i:number)=>pages[i>>>8]??=(()=>{const length=Math.min(256,size-(i>>>8)*256);return {costs:new Float64Array(length),flags:new Uint8Array(length)};})();
    for(const [i,value] of base.costs)if(Number.isInteger(i)&&i>=0&&i<size)page(i).costs[i&255]=value;
    for(const i of base.repeaters)if(Number.isInteger(i)&&i>=0&&i<size){const flags=page(i).flags;flags[i&255]=flags[i&255]!|1;}
    for(const i of base.stops)if(Number.isInteger(i)&&i>=0&&i<size){const flags=page(i).flags;flags[i&255]=flags[i&255]!|2;}
    columns={size,pages};structureTravelColumns.set(base,columns);
  }
  return columns;
}
function structureTravelBase(geometry:StructureNavigationGeometry):StructureTravelBase {
  let base=structureTravelBases.get(geometry);if(base)return base;
  const costs=new Map<number,number>(),repeaters=new Set<number>(),stops=new Set<number>(),traps:StructureTravelBase['traps'][number][]=[];
  for(const entry of geometry.entries){
    const p=FURNITURE_TRAVEL[entry.structure.kind];if(isTrapKind357(entry.structure.kind))traps.push(entry);
    for(const i of entry.cells){if(p.delay)costs.set(i,Math.round(p.delay/3*1000));if(p.repeat)repeaters.add(i);if(!p.stand)stops.add(i);}
  }
  let costMaximum=-Infinity;for(const value of costs.values())if(value>costMaximum)costMaximum=value;
  base={costs,costMaximum,repeaters,stops,traps};structureTravelBases.set(geometry,base);return base;
}
/** The spike-trap search costs that navigationCosts adds, after the ordinary
 * maximum, for an actor knowing the traps: the same cells and values. The
 * additive layers commute, so they can be added to the costs captured for an
 * actor that does not know them. */
export function knownSpikeTrapCosts(world:World,geometry?:StructureNavigationGeometry):Map<number,number> {
  const traps=new Map<number,number>();if(world.schemaVersion<226)return traps;
  geometry??=captureStructureNavigation(world);
  const structureBase=geometry?structureTravelBase(geometry):undefined;
  if(structureBase){for(const {structure,cells} of structureBase.traps)if(structure.spikeTrap)for(const i of cells)traps.set(i,SPIKE_TRAP_SEARCH_COST);}
  else for(const s of world.structures)if(isTrapKind357(s.kind)&&s.spikeTrap)for(const c of footprintCells(s))traps.set(c.z*world.width+c.x,SPIKE_TRAP_SEARCH_COST);
  return traps;
}
/** Captured once per synchronous search. The terrain layer is shared only on an
 * exact unchanged-tiles proof (terrainCostLayer). Closed simulation scopes use
 * private overlays of the immutable structure base; all mutable facts are
 * captured now, so no subsequent edit can change this decision's lookups.
 * Standalone public callers retain the native Map/Set capture contract. */
type NavigationCapture={costs:NavigationCostLookup|undefined;repeaters:ReadonlySet<number>;stops:ReadonlySet<number>;floors:NavigationCostLookup;coreMoveCosts297?:{cardinal:number;diagonal:number}};
function humanMovementCost(world:World,human:Pawn):{cardinal:number;diagonal:number} {
 const factor=humanMoveSpeedFactor297(world,human),base=60/(4.6*factor);
 return {cardinal:Math.round(Math.min(450,Math.max(1,base))),diagonal:Math.round(Math.min(450,Math.max(1,base*1.41421)))};
}
export function navigationCosts(world:World,origin?:Cell,terrainOverride?:DuckTerrainOverride256,geometry?:StructureNavigationGeometry,layered=terrainReadScope()!==undefined):NavigationCapture {
 return computeNavigationCosts(world,origin,terrainOverride,geometry,layered);
}
function computeNavigationCosts(world:World,origin?:Cell,terrainOverride?:DuckTerrainOverride256,geometry?:StructureNavigationGeometry,layered=terrainReadScope()!==undefined):NavigationCapture {
  const version=world.schemaVersion,width=world.width,snow=!!world.snow;
  geometry??=captureStructureNavigation(world);
  // Repeaters and stops start with the structure cells, in the same order.
  const structureBase=version>=22&&geometry?structureTravelBase(geometry):undefined,frames=frameCosts(world);
  // layered: the same reads over the shared structure part instead of copies
  // of it (no copy for a short search; slower lookups for a long one).
  const costs:Map<number,number>|LayeredMap=layered&&structureBase?new LayeredMap(structureBase.costs,structureBase.costMaximum):structureBase?new Map(structureBase.costs):new Map(frames);
  // Structure entries overwrite frames. Copy that larger native map once,
  // then add only the frame cells it did not set. The private map's iteration
  // order is immaterial: its only aggregate is the maximum integer cost.
  if(structureBase&&frames)for(const [i,v] of frames)if(!structureBase.costs.has(i))costs.set(i,v);
  const repeaters:Set<number>|LayeredSet=layered?new LayeredSet(structureBase?.repeaters):new Set<number>(structureBase?.repeaters),stops:Set<number>|LayeredSet=layered?new LayeredSet(structureBase?.stops):new Set<number>(structureBase?.stops);
  const actor=version>=226?spikeTrapNavigationActor(world,origin):undefined,knows=!!actor&&spikeTrapKnowsOf(world,actor),traps=new Map<number,number>();
  if(version>=22) {
    const add=(s:World['structures'][number],i:number)=>{
      const p=FURNITURE_TRAVEL[s.kind];
      if(knows&&isTrapKind357(s.kind)&&s.spikeTrap)traps.set(i,SPIKE_TRAP_SEARCH_COST);
      if(p.delay)costs.set(i,Math.round(p.delay/3*1000));
      if(p.repeat)repeaters.add(i);if(!p.stand)stops.add(i);
    };
    if(structureBase){
      if(knows)for(const {structure,cells} of structureBase.traps)if(structure.spikeTrap)for(const i of cells)traps.set(i,SPIKE_TRAP_SEARCH_COST);
    }
    else for(const s of world.structures)for(const c of footprintCells(s))add(s,c.z*width+c.x);
    for(const j of world.jobs)if(j.construction==='frame'&&!isConduitKind(j.kind)&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')for(const c of footprintCells(j))stops.add(c.z*width+c.x);
  }
  const floors=new Map<number,number>();
  // A single captured byte per cell replaces two mostly dense Maps on a site.
  // Objects remain sparse; both lookups retain the same terrain floor.
  let terrain:Uint8Array|Uint16Array,terrainMaximum=0;
  let marshPerceptionCosts:ReadonlyMap<number,number>;
  if(version>=28) {
    for(const p of groundChunkPiles(world)){const i=p.owner.z*width+p.owner.x;costs.set(i,Math.max(costs.get(i)??0,1400));repeaters.add(i);stops.add(i);}
    const drafted=!!actor&&'draft' in actor&&!!actor.draft;
    const layer=terrainCostLayer(world,version,drafted,snow,terrainOverride);
    terrain=layer.terrain;terrainMaximum=layer.maximum;marshPerceptionCosts=layer.marsh;
  }else{terrain=new Uint8Array(world.tiles.length);marshPerceptionCosts=new Map();}
  if(version>=29)for(const p of groundMaterialFloorPiles(world)){const i=p.owner.z*width+p.owner.x;floors.set(i,Math.max(floors.get(i)??0,467));costs.set(i,Math.max(costs.get(i)??0,467));}
  // Door wait is added after the terrain/object/material maximum, not compared
  // with it. Preserve present zero entries for fully open doors on bare floors.
  for(const s of geometry?.roomDoors??world.structures)if(isRoomDoor(s.kind)) {const i=s.z*width+s.x;repeaters.delete(i);costs.set(i,Math.max(costs.get(i)??0,terrain[i]??0)+Math.round(doorWait(s,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick)/3*1000));}
  // Schema 303: RimWorld 1.6 prices a fence gate like any door in a pawn's path
  // search (PathUtility.GetDoorCost: its TicksToOpenNow unless in free
  // passage). Applied to humans; animals keep their own gate rules.
  if(isFenceGateSpeedSchema303(version)&&origin&&'id' in origin&&world.pawns.some(p=>p.id===(origin as {id:unknown}).id)) {
    const now=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick;
    for(const s of filteredStructures(world,'fence-gates',s=>s.kind==='fence-gate')){const i=s.z*width+s.x;costs.set(i,Math.max(costs.get(i)??0,terrain[i]??0)+Math.round(doorWait(s,now)/3*1000));}
  }
  const fire=fireNavigationCosts(world);
  // Trap avoidance is additive after the ordinary terrain/object maximum, like
  // fire danger. Its 800 Core cost already includes avoidance: do not add the
  // separate 40 Core physical walk delay to the search a second time.
  const additions=[fire,traps,marshPerceptionCosts];
  const result={costs:captureNavigationCostLayers(terrain,terrainMaximum,costs,additions,!!(costs.size||terrainMaximum)),repeaters,stops,floors:captureNavigationCostLayers(terrain,terrainMaximum,floors,additions)!};
  const human=isCorePhysicalSchema297(Number(version))&&origin&&'id'in origin?humanById379(world.pawns,origin.id):undefined;
  if(!human)return result;
  return {...result,costs:coreNavigationUnits297(result.costs),floors:coreNavigationUnits297(result.floors)!,coreMoveCosts297:humanMovementCost(world,human)};
}

/** navigationCosts(world, undefined, terrainOverride, geometry) for an animal
 * (no actor: no trap knowledge, no draft, no human rules), each cell computed
 * when a search reads it: the same values, has(), maxima, repeaters, stops and
 * floors. Snapshots taken now (construction frames and their stops, the pile
 * index facts of chunks and material floors, room door waits, fire) and the
 * shared immutable layers (structure base, terrain cost layer) replace the
 * map-wide capture. Iterating repeaters or stops is not supported. Falls back to
 * the full capture before schema 29 or outside a simulation step. */
export function lazyAnimalNavigationCosts(world:World,terrainOverride?:DuckTerrainOverride256,geometry?:StructureNavigationGeometry):ReturnType<typeof navigationCosts> {
  const version=world.schemaVersion,size=world.width*world.height;
  geometry??=captureStructureNavigation(world);
  const index=version>=29?pileIndex(world):undefined;
  if(!geometry||!index||verifyPileIndex||index.groundFacts.length!==size)return navigationCosts(world,undefined,terrainOverride,geometry,true);
  return captureLazyNavigation379(world,terrainOverride,geometry,index);
}
/** The real closed human search borrows the same producer-owned terrain,
 * structure/frame ordinal columns and ground facts as wildlife. Only door
 * waits, trap knowledge, fire and movement speed need a fresh observation.
 * Unlike the full-program cache trial this never duplicates a capture or
 * checks an unrelated actor's program before building its own. */
export function navigationSearchCosts379(world:World,origin:Cell,geometry?:StructureNavigationGeometry):NavigationCapture {
 const human=terrainJournalReadOwner()&&world.schemaVersion>=379&&'id' in origin&&!('species' in origin)&&!('mechKind' in origin)?humanById379(world.pawns,origin.id):undefined;
 const index=human?pileIndex(world):undefined,size=world.width*world.height;
 if(!human||!index||index.groundOutside||verifyPileIndex||index.groundFacts.length!==size)return navigationCosts(world,origin,undefined,geometry);
 geometry??=captureStructureNavigation(world);const capture=captureLazyNavigation379(world,undefined,geometry,index,human);
 if(verifyTerrainWriteCaches){const fresh=navigationCosts(world,origin,undefined,geometry);
  for(const key of ['costs','floors'] as const){const a=capture[key],b=fresh[key];if(a?.maximum!==b?.maximum)throw Error('Owned human navigation maximum changed');for(let i=0;i<size;i++)if(!Object.is(a?.get(i),b?.get(i))||a?.has(i)!==b?.has(i))throw Error('Owned human navigation cost changed');}
  for(let i=0;i<size;i++)if(capture.repeaters.has(i)!==fresh.repeaters.has(i)||capture.stops.has(i)!==fresh.stops.has(i))throw Error('Owned human navigation membership changed');
  if(!sameList([...capture.repeaters],[...fresh.repeaters])||!sameList([...capture.stops],[...fresh.stops])||capture.coreMoveCosts297!.cardinal!==fresh.coreMoveCosts297!.cardinal||capture.coreMoveCosts297!.diagonal!==fresh.coreMoveCosts297!.diagonal)throw Error('Owned human navigation source order or speed changed');
 }
 return capture;
}
function captureLazyNavigation379(world:World,terrainOverride:DuckTerrainOverride256|undefined,geometry:StructureNavigationGeometry,index:PileIndex,human?:Pawn):NavigationCapture {
  const version=world.schemaVersion,width=world.width,size=width*world.height,snow=!!world.snow;
  const base=structureTravelBase(geometry),columns=travelColumns(base,size),frames=frameCosts(world),pileFacts=capturePileGroundFacts379(index),facts=pileFacts.facts;
  let frameStops=captureFrameGeometry379(world)?.standDenied;
  if(!frameStops){const captured=new Set<number>();for(const j of world.jobs)if(j.construction==='frame'&&!isConduitKind(j.kind)&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')for(const c of footprintCells(j))captured.add(c.z*width+c.x);frameStops=captured;}
  const layer=terrainCostLayer(world,version,!!human?.draft,snow,terrainOverride),terrain=layer.terrain;
  const now=isCorePhysicalSchema297(Number(version))?effectiveLocal297(world):world.tick;
  // Room doors in the capture's order: each adds its wait after the maximum.
  const doors=new Map<number,number[]>(),roomDoors=new Set<number>();
  const addDoor=(s:World['structures'][number]):number=>{const i=s.z*width+s.x,list=doors.get(i),wait=Math.round(doorWait(s,now)/3*1000);if(list)list.push(wait);else doors.set(i,[wait]);return i;};
  for(const s of geometry.roomDoors??world.structures)if(isRoomDoor(s.kind)){const i=addDoor(s);if(human)roomDoors.add(i);}
  if(human&&isFenceGateSpeedSchema303(version))for(const s of filteredStructures(world,'fence-gates',s=>s.kind==='fence-gate'))addDoor(s);
  const anyChunk=!!(pileFacts.mask&PILE_CHUNK),anyFloor=!!(pileFacts.mask&PILE_MATERIAL_FLOOR);
  const initial=(i:number):number|undefined=>{const value=columns.pages[Math.floor(i/256)]?.costs[i%256],v=value===undefined&&(!Number.isInteger(i)||i<0||i>=size)?base.costs.get(i):value||undefined;return v!==undefined||!frames?v:frames.get(i);};
  /** The capture's object cost at i (its `costs` map entry). */
  const sparse=(i:number):number|undefined=>{
    let v=initial(i);const f=facts[i]!;
    if(f&PILE_CHUNK)v=Math.max(v??0,1400);
    if(f&PILE_MATERIAL_FLOOR)v=Math.max(v??0,467);
    const waits=doors.get(i);if(waits)for(const wait of waits)v=Math.max(v??0,terrain[i]??0)+wait;
    return v;
  };
  let initialMaximum=base.costs.size?base.costMaximum:-Infinity;
  if(frames)for(const [i,v] of frames)if(!base.costs.has(i)&&v>initialMaximum)initialMaximum=v;
  let sparseMaximum=initialMaximum;if(anyChunk)sparseMaximum=Math.max(sparseMaximum,1400);if(anyFloor)sparseMaximum=Math.max(sparseMaximum,467);
  for(const i of doors.keys())sparseMaximum=Math.max(sparseMaximum,sparse(i)!);
  const anySparse=base.costs.size>0||!!frames?.size||anyChunk||anyFloor||doors.size>0;
  const overlay=(extra:(i:number)=>number|undefined,extraMaximum:number):NavigationCostLookup=>({
    get(i){const floor=terrain[i]||undefined,value=extra(i);return value===undefined?floor:Math.max(value,floor??0);},
    has:i=>!!terrain[i]||extra(i)!==undefined,maximum:Math.max(layer.maximum,extraMaximum)});
  const fire=fireNavigationCosts(world),traps=human&&spikeTrapKnowsOf(world,human)?knownSpikeTrapCosts(world,geometry):undefined;
  const addLayers=(lookup:NavigationCostLookup|undefined)=>{const withFire=addFireNavigationCosts(lookup,fire),withTraps=traps?addFireNavigationCosts(withFire,traps):withFire;return addFireNavigationCosts(withTraps,layer.marsh);};
  const costs=addLayers(anySparse||layer.maximum?overlay(sparse,sparseMaximum):undefined);
  const floorExtra=(i:number)=>facts[i]!&PILE_MATERIAL_FLOOR?467:undefined;
  const floors=addLayers(overlay(floorExtra,anyFloor?467:-Infinity))!;
  const unsupported=():never=>{throw Error('Lazy navigation sets cannot be iterated');};
  const lazySet=(has:(i:number)=>boolean,materialize?:()=>Set<number>):ReadonlySet<number>=>{
   if(!materialize)return {has,get size():number{return unsupported();},forEach:unsupported,entries:unsupported,keys:unsupported,values:unsupported,[Symbol.iterator]:unsupported} as ReadonlySet<number>;
   let rows:Set<number>|undefined;const read=()=>rows??=materialize();const view:ReadonlySet<number>={has,get size(){return read().size;},forEach(callback,thisArg){for(const value of read())callback.call(thisArg,value,value,view);},entries:()=>read().entries(),keys:()=>read().keys(),values:()=>read().values(),[Symbol.iterator]:()=>read().values()};return view;
  };
  const removedRepeaters=human?roomDoors:doors,chunks=human?captureGroundChunkOrder379(index,pileFacts):undefined;
  const repeaters=lazySet(i=>{const flags=columns.pages[Math.floor(i/256)]?.flags[i%256];return ((flags===undefined?(!Number.isInteger(i)||i<0||i>=size)&&base.repeaters.has(i):!!(flags&1))||!!(facts[i]!&PILE_CHUNK))&&!removedRepeaters.has(i);},chunks?()=>{const result=new Set(base.repeaters);for(const i of chunks)result.add(i);for(const i of roomDoors)result.delete(i);return result;}:undefined);
  const stops=lazySet(i=>{const flags=columns.pages[Math.floor(i/256)]?.flags[i%256];return (flags===undefined?(!Number.isInteger(i)||i<0||i>=size)&&base.stops.has(i):!!(flags&2))||frameStops.has(i)||!!(facts[i]!&PILE_CHUNK);},chunks?()=>{const result=new Set(base.stops);for(const i of frameStops)result.add(i);for(const i of chunks)result.add(i);return result;}:undefined);
  const capturedCosts=captureNavigationCostProgram379(costs,size),capturedFloors=captureNavigationCostProgram379(floors,size)!;
  return human?{costs:coreNavigationUnits297(capturedCosts),repeaters,stops,floors:coreNavigationUnits297(capturedFloors)!,coreMoveCosts297:humanMovementCost(world,human)}:{costs:capturedCosts,repeaters,stops,floors:capturedFloors};
}
/** navigationCosts(world, origin, terrainOverride, geometry) for an animal
 * origin, on demand: the trap-free costs of lazyAnimalNavigationCosts, plus
 * the known spike traps' additive layer when the animal knows them (additive
 * layers commute). A human, drafted or pawn origin keeps the full capture. */
export function animalNavigationCosts(world:World,origin:Cell,terrainOverride?:DuckTerrainOverride256,geometry?:StructureNavigationGeometry):ReturnType<typeof navigationCosts> {
  const actor=world.schemaVersion>=226?spikeTrapNavigationActor(world,origin):undefined;
  if('id' in origin&&world.pawns.some(p=>p.id===(origin as {id:unknown}).id)||actor&&'draft' in actor&&!!actor.draft)return navigationCosts(world,origin,terrainOverride,geometry);
  const lazy=lazyAnimalNavigationCosts(world,terrainOverride,geometry);
  if(!actor||!spikeTrapKnowsOf(world,actor))return lazy;
  const traps=knownSpikeTrapCosts(world,geometry);
  const size=world.width*world.height;
  return {...lazy,costs:captureNavigationCostProgram379(addFireNavigationCosts(lazy.costs,traps),size),floors:captureNavigationCostProgram379(addFireNavigationCosts(lazy.floors,traps),size)!};
}
/** Converts the captured legacy integer normalization back into integer Core
 * costs. No new dense map, actor lookup or allocation in the search loop. */
export function coreNavigationUnits297(costs:NavigationCostLookup|undefined):NavigationCostLookup|undefined {
 return transformNavigationCosts(costs,.03,true);
}
