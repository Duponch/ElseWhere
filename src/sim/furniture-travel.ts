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
import { LayeredMap,LayeredSet,overlayNavigationCosts,type NavigationCostLookup } from './navigation-costs.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { spikeTrapKnowsOf,spikeTrapNavigationActor,SPIKE_TRAP_SEARCH_COST,SPIKE_TRAP_WALK_DELAY } from './spike-trap-state.ts';
import type { Cell, StructureKind, World } from './types.ts';
import { captureStructureNavigation,filteredStructures,type StructureNavigationGeometry } from './structure-navigation.ts';
import { terrainWriteCount,verifyTerrainWriteCaches } from './terrain-mutation-journal.ts';
import { PILE_CHUNK,PILE_MATERIAL_FLOOR,materialFloorPile,pileIndex,pileIndexMismatch,verifyPileIndex } from './pile-index.ts';

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
  'spike-trap':{delay:0,stand:true,repeat:false},
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
  sandbags:{delay:4.2,stand:false,repeat:true},
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
  wall:{delay:0,stand:false,repeat:false},table:{delay:4.2,stand:false,repeat:true},'table-square':{delay:4.2,stand:false,repeat:true},'table-long':{delay:4.2,stand:false,repeat:true},'chess-table':{delay:3,stand:false,repeat:true},
  bedroll:{delay:1.4,stand:true,repeat:true},
  bed:{delay:4.2,stand:false,repeat:true},
  'hospital-bed':{delay:4.2,stand:false,repeat:true},campfire:{delay:4.2,stand:false,repeat:true},
  stool:{delay:3,stand:true,repeat:true},'dining-chair':{delay:3,stand:true,repeat:true},armchair:{delay:3,stand:true,repeat:true},'end-table':{delay:3,stand:false,repeat:true},dresser:{delay:5,stand:false,repeat:true},'flower-pot':{delay:3,stand:false,repeat:true},horseshoes:{delay:1.4,stand:true,repeat:false},
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
  return !world.jobs.some(j=>(version<16&&(j.kind==='wall'||j.kind==='table')||version>=22&&j.construction==='frame'&&j.kind!=='power-conduit'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')&&footprintContains(j,cell));
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
  for(const j of world.jobs)if(version<16&&(j.kind==='wall'||j.kind==='table')||version>=22&&j.construction==='frame'&&j.kind!=='power-conduit'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')add(j);
  // Ground chunks: inside a simulation step, a copy of the pile index's facts
  // taken now (the same cells as the chunk list, as a snapshot); else the list.
  const index=version>=28?pileIndex(world):undefined;
  const chunks=index&&!verifyPileIndex&&index.groundFacts.length===world.width*world.height?index.groundFacts.slice():undefined;
  if(version>=28&&!chunks)for(const p of groundChunkPiles(world))denied.add(p.owner.z*world.width+p.owner.x);
  return cell=>{
    if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)return false;
    const i=cell.z*world.width+cell.x,terrain=world.tiles[i]!.terrain;
    return terrain!=='rock'&&terrain!=='water'&&!structures?.[i]&&!(chunks&&chunks[i]!&PILE_CHUNK)&&!denied.has(i);
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
      if(s.kind!=='power-conduit')target=s.kind;
      if(s.kind==='spike-trap'&&s.spikeTrap&&s.x===to.x&&s.z===to.z)trap=true;
    }
    previousRepeats=geometry.at(from).some(s=>FURNITURE_TRAVEL[s.kind].repeat);
  }else for(const s of world.structures) {
    if(s.kind!=='power-conduit'&&footprintContains(s,to))target=s.kind;
    if(s.kind==='spike-trap'&&s.spikeTrap&&s.x===to.x&&s.z===to.z)trap=true;
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
 * Without a terrain override, or with one naming its layerKey, the layer is reused while the same Tile[] keeps
 * the same physical write count (every physical cell write marks its cell, see
 * terrain-mutation-journal); flooring can mutate between actors within a tick
 * and is still observed through that count. Consumers only read the layer. */
const terrainLayers=new WeakMap<readonly World['tiles'][number][],{writes:number;version:number;site:boolean;snow:boolean;layers:Map<string,TerrainCostLayer>}>();
function terrainCostLayer(world:World,version:number,drafted:boolean,snow:boolean,terrainOverride?:DuckTerrainOverride256):TerrainCostLayer {
  const tiles=world.tiles,hasSite=!!world.site;
  // An override is kept only when it names itself a pure function of the tile.
  if(terrainOverride&&terrainOverride.layerKey===undefined)return computeTerrainCostLayer(world,version,drafted,snow,hasSite,terrainOverride);
  const writes=terrainWriteCount(tiles);let entry=terrainLayers.get(tiles);
  if(!entry||entry.writes!==writes||entry.version!==version||entry.site!==hasSite||entry.snow!==snow){entry={writes,version,site:hasSite,snow,layers:new Map()};terrainLayers.set(tiles,entry);}
  const slot=`${drafted?1:0}${terrainOverride?.layerKey??''}`,cached=entry.layers.get(slot);
  if(cached){
    if(verifyTerrainWriteCaches){const fresh=computeTerrainCostLayer(world,version,drafted,snow,hasSite,terrainOverride);
      if(fresh.maximum!==cached.maximum||fresh.terrain.length!==cached.terrain.length||fresh.terrain.some((v,i)=>v!==cached.terrain[i])||fresh.marsh.size!==cached.marsh.size||[...fresh.marsh].some(([k,v])=>cached.marsh.get(k)!==v))throw Error('Unmarked terrain write under an unchanged Tile[] count');}
    return cached;
  }
  const layer=computeTerrainCostLayer(world,version,drafted,snow,hasSite,terrainOverride);entry.layers.set(slot,layer);return layer;
}
function computeTerrainCostLayer(world:World,version:number,drafted:boolean,snow:boolean,hasSite:boolean,terrainOverride?:DuckTerrainOverride256):TerrainCostLayer {
  let terrain:Uint8Array|Uint16Array=new Uint8Array(world.tiles.length);let terrainMaximum=0;const marshPerceptionCosts=new Map<number,number>();
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
  for(let i=0;i<tiles.length;i++){
    const tile=tiles[i]!,kind=tile.terrain;
    let cost=tile.floor?Math.round(FLOOR_DEFINITIONS[tile.floor].pathCost/10/3*1000):kind==='rough-stone'||kind==='rich-soil'||kind==='gravel'||hasSite&&kind==='grass'||isCorePhysicalSchema297(Number(version))&&(kind==='grass'||kind==='soil')?67:0;
    const natural=readNatural(kind);
    if(natural&&!tile.bridge&&!tile.floor)cost=natural.pathCost;
    else if(isWetTerrain(kind)&&!tile.bridge&&!tile.floor)cost=Math.round(MARSH_PATH_COST_CORE/30*1000);
    const override=terrainOverride?.coreCost(tile);if(override!==undefined)cost=Math.round(override/30*1000);
    if(snow)cost=Math.max(cost,snowSearchCost(tile.snowDepth??0));
    const perceivedOverride=terrainOverride?.perceivedCore(tile),perception=perceivedOverride??(natural?natural.perceivedCore:isWetTerrain(kind)?marshPerception:0);
    if(perception&&!tile.bridge&&!tile.floor)marshPerceptionCosts.set(i,perceivedOverride==null&&natural?natural.perceivedCost:Math.round(perception/30*1000));
    if(cost>255&&terrain instanceof Uint8Array){const wide:Uint16Array=new Uint16Array(terrain.length);wide.set(terrain);terrain=wide;}
    if(cost){terrain[i]=cost;if(cost>terrainMaximum)terrainMaximum=cost;}
  }
  return {terrain,maximum:terrainMaximum,marsh:marshPerceptionCosts};
}
/* Structure part of the navigation costs, per (immutable) shared geometry.
 * Kinds and footprint cells never change for a geometry, so this is exactly
 * what every search rebuilt from its entries: in entry order, the delay of the
 * last structure setting a cell (inserted at its first setting), the repeater
 * and stop cells, and the spike-trap entries, whose state is still read live. */
interface StructureTravelBase {costs:ReadonlyMap<number,number>;costMaximum:number;repeaters:ReadonlySet<number>;stops:ReadonlySet<number>;traps:readonly StructureNavigationGeometry['entries'][number][]}
const structureTravelBases=new WeakMap<StructureNavigationGeometry,StructureTravelBase>();
function structureTravelBase(geometry:StructureNavigationGeometry):StructureTravelBase {
  let base=structureTravelBases.get(geometry);if(base)return base;
  const costs=new Map<number,number>(),repeaters=new Set<number>(),stops=new Set<number>(),traps:StructureTravelBase['traps'][number][]=[];
  for(const entry of geometry.entries){
    const p=FURNITURE_TRAVEL[entry.structure.kind];if(entry.structure.kind==='spike-trap')traps.push(entry);
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
  else for(const s of world.structures)if(s.kind==='spike-trap'&&s.spikeTrap)for(const c of footprintCells(s))traps.set(c.z*world.width+c.x,SPIKE_TRAP_SEARCH_COST);
  return traps;
}
/** Captured once per synchronous search. The terrain layer is shared only on an
 * exact unchanged-tiles proof (terrainCostLayer); every other part is fresh. */
export function navigationCosts(world:World,origin?:Cell,terrainOverride?:DuckTerrainOverride256,geometry?:StructureNavigationGeometry,layered=false):{costs:NavigationCostLookup|undefined;repeaters:ReadonlySet<number>;stops:ReadonlySet<number>;floors:NavigationCostLookup;coreMoveCosts297?:{cardinal:number;diagonal:number}} {
  const version=world.schemaVersion,width=world.width,snow=!!world.snow;
  geometry??=captureStructureNavigation(world);
  // Repeaters and stops start with the structure cells, in the same order.
  const structureBase=version>=22&&geometry?structureTravelBase(geometry):undefined,frames=frameCosts(world);
  // layered: the same reads over the shared structure part instead of copies
  // of it (no copy for a short search; slower lookups for a long one).
  const costs:Map<number,number>|LayeredMap=layered&&structureBase&&!frames?new LayeredMap(structureBase.costs,structureBase.costMaximum):structureBase&&!frames?new Map(structureBase.costs):new Map(frames);
  const repeaters:Set<number>|LayeredSet=layered?new LayeredSet(structureBase?.repeaters):new Set<number>(structureBase?.repeaters),stops:Set<number>|LayeredSet=layered?new LayeredSet(structureBase?.stops):new Set<number>(structureBase?.stops);
  const actor=version>=226?spikeTrapNavigationActor(world,origin):undefined,knows=!!actor&&spikeTrapKnowsOf(world,actor),traps=new Map<number,number>();
  if(version>=22) {
    const add=(s:World['structures'][number],i:number)=>{
      const p=FURNITURE_TRAVEL[s.kind];
      if(knows&&s.kind==='spike-trap'&&s.spikeTrap)traps.set(i,SPIKE_TRAP_SEARCH_COST);
      if(p.delay)costs.set(i,Math.round(p.delay/3*1000));
      if(p.repeat)repeaters.add(i);if(!p.stand)stops.add(i);
    };
    if(structureBase){
      if(knows)for(const {structure,cells} of structureBase.traps)if(structure.spikeTrap)for(const i of cells)traps.set(i,SPIKE_TRAP_SEARCH_COST);
      if(frames)for(const [i,v] of structureBase.costs)costs.set(i,v);
    }
    else for(const s of world.structures)for(const c of footprintCells(s))add(s,c.z*width+c.x);
    for(const j of world.jobs)if(j.construction==='frame'&&j.kind!=='power-conduit'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')for(const c of footprintCells(j))stops.add(c.z*width+c.x);
  }
  const floors=new Map<number,number>();
  // A single captured byte per cell replaces two mostly dense Maps on a site.
  // Objects remain sparse; both lookups retain the same terrain floor.
  let terrain:Uint8Array|Uint16Array=new Uint8Array(world.tiles.length);let terrainMaximum=0;
  let marshPerceptionCosts:ReadonlyMap<number,number>=new Map<number,number>();
  if(version>=28) {
    for(const p of groundChunkPiles(world)){const i=p.owner.z*width+p.owner.x;costs.set(i,Math.max(costs.get(i)??0,1400));repeaters.add(i);stops.add(i);}
    const drafted=!!actor&&'draft' in actor&&!!actor.draft;
    const layer=terrainCostLayer(world,version,drafted,snow,terrainOverride);
    terrain=layer.terrain;terrainMaximum=layer.maximum;marshPerceptionCosts=layer.marsh;
  }
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
  const result={costs:addFireNavigationCosts(addFireNavigationCosts(addFireNavigationCosts(costs.size||terrainMaximum?overlayNavigationCosts(terrain,terrainMaximum,costs):undefined,fire),traps),marshPerceptionCosts),repeaters,stops,floors:addFireNavigationCosts(addFireNavigationCosts(addFireNavigationCosts(overlayNavigationCosts(terrain,terrainMaximum,floors),fire),traps),marshPerceptionCosts)!};
  const human=isCorePhysicalSchema297(Number(version))&&origin&&'id'in origin?world.pawns.find(p=>p.id===origin.id):undefined;
  if(!human)return result;
  const factor=humanMoveSpeedFactor297(world,human),base=60/(4.6*factor);
  return {...result,costs:coreNavigationUnits297(result.costs),floors:coreNavigationUnits297(result.floors)!,coreMoveCosts297:{cardinal:Math.round(Math.min(450,Math.max(1,base))),diagonal:Math.round(Math.min(450,Math.max(1,base*1.41421)))}};
}

/** Converts the captured legacy integer normalization back into integer Core
 * costs. No new dense map, actor lookup or allocation in the search loop. */
export function coreNavigationUnits297(costs:NavigationCostLookup|undefined):NavigationCostLookup|undefined {
 return costs?{get(index){const value=costs.get(index);return value===undefined?undefined:Math.round(value*.03);},has:index=>costs.has(index),maximum:Math.round(costs.maximum*.03)}:undefined;
}
