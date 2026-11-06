import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {humanMoveSpeedFactor297} from './human-move-speed-297.ts';
import type {DuckTerrainOverride256} from './duck-water-256.ts';
import {naturalTerrainCosts256} from './natural-terrain-movement-256.ts';
import {isWetTerrain} from './shallow-water.ts';
import {MARSH_PATH_COST_CORE,MARSH_PERCEIVED_CORE} from './marsh.ts';
import {snowTravelDelay,snowSearchCost} from './snow-rules.ts';
import { fireNavigationCosts,addFireNavigationCosts } from './fire-navigation.ts';
import { doorWait,isRoomDoor } from './door-rules.ts';
import { footprintCells, footprintContains } from './definitions.ts';
import { frameAt, frameCosts, FRAME_TRAVEL_DELAY } from './construction-costs.ts';
import { overlayNavigationCosts,type NavigationCostLookup } from './navigation-costs.ts';
import { FLOOR_DEFINITIONS } from './flooring.ts';
import { spikeTrapKnowsOf,spikeTrapNavigationActor,SPIKE_TRAP_SEARCH_COST,SPIKE_TRAP_WALK_DELAY } from './spike-trap-state.ts';
import type { Cell, StructureKind, World } from './types.ts';
import { captureStructureNavigation,type StructureNavigationGeometry } from './structure-navigation.ts';

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
  if(version>=28&&world.piles.some(p=>p.kind==='chunk'&&p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z))return false;
  return !world.jobs.some(j=>(version<16&&(j.kind==='wall'||j.kind==='table')||version>=22&&j.construction==='frame'&&j.kind!=='power-conduit'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')&&footprintContains(j,cell));
}
/** For a batch of point queries in one read-only decision. Discard before any
 * world mutation; this is not a shared navigation or cross-actor cache. */
export function captureStandability(world:World,geometry?:StructureNavigationGeometry):(cell:Cell)=>boolean {
  const version=world.schemaVersion;
  geometry??=captureStructureNavigation(world);
  const denied=new Set<number>(),add=(s:Parameters<typeof footprintCells>[0])=>{for(const c of footprintCells(s))denied.add(c.z*world.width+c.x);};
  if(geometry){for(const {structure:s,cells} of geometry.entries)if(version<22?s.kind==='wall'||s.kind==='table':!FURNITURE_TRAVEL[s.kind].stand)for(const i of cells)denied.add(i);}
  else for(const s of world.structures)if(version<22?s.kind==='wall'||s.kind==='table':!FURNITURE_TRAVEL[s.kind].stand)add(s);
  for(const j of world.jobs)if(version<16&&(j.kind==='wall'||j.kind==='table')||version>=22&&j.construction==='frame'&&j.kind!=='power-conduit'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')add(j);
  if(version>=28)for(const p of world.piles)if(p.kind==='chunk'&&p.owner.type==='ground')denied.add(p.owner.z*world.width+p.owner.x);
  return cell=>Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height
    &&!['rock','water'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain)&&!denied.has(cell.z*world.width+cell.x);
}
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
  let repeats=target?FURNITURE_TRAVEL[target].repeat:false;
  if(version>=28)for(const p of world.piles)if(p.kind==='chunk'&&p.owner.type==='ground') {
    if(p.owner.x===to.x&&p.owner.z===to.z){objectDelay=Math.max(objectDelay,4.2);repeats=true;}
    if(p.owner.x===from.x&&p.owner.z===from.z)previousRepeats=true;
  }
  const materialDelay=world.piles.some(p=>(version>=29&&p.kind==='steel'||version>=32&&p.kind==='blocks'||version>=41&&p.kind==='component'||version>=123&&(p.kind==='gold'||p.kind==='plasteel'||p.kind==='advanced-component'))&&p.owner.type==='ground'&&p.owner.x===to.x&&p.owner.z===to.z)?1.4:0;
  const actor=trap?spikeTrapNavigationActor(world,from):undefined,overrideCost=terrainOverride?.coreCost(world.tiles[to.z*world.width+to.x]!);
  return Math.max(repeats&&previousRepeats?0:objectDelay,materialDelay,(overrideCost===undefined?terrainTravelDelay(world,to.z*world.width+to.x):overrideCost/10),world.snow?snowTravelDelay(world.tiles[to.z*world.width+to.x]!.snowDepth??0):0)
    +(actor&&spikeTrapKnowsOf(world,actor)?SPIKE_TRAP_WALK_DELAY:0);
}
/** Captured once per synchronous search. No shared mutation or cross-tick cache. */
export function navigationCosts(world:World,origin?:Cell,terrainOverride?:DuckTerrainOverride256,geometry?:StructureNavigationGeometry):{costs:NavigationCostLookup|undefined;repeaters:ReadonlySet<number>;stops:ReadonlySet<number>;floors:NavigationCostLookup;coreMoveCosts297?:{cardinal:number;diagonal:number}} {
  const version=world.schemaVersion,width=world.width,snow=!!world.snow;
  geometry??=captureStructureNavigation(world);
  const costs=new Map(frameCosts(world)),repeaters=new Set<number>(),stops=new Set<number>();
  const actor=version>=226?spikeTrapNavigationActor(world,origin):undefined,knows=!!actor&&spikeTrapKnowsOf(world,actor),traps=new Map<number,number>(),marshPerceptionCosts=new Map<number,number>();
  if(version>=22) {
    const add=(s:World['structures'][number],i:number)=>{
      const p=FURNITURE_TRAVEL[s.kind];
      if(knows&&s.kind==='spike-trap'&&s.spikeTrap)traps.set(i,SPIKE_TRAP_SEARCH_COST);
      if(p.delay)costs.set(i,Math.round(p.delay/3*1000));
      if(p.repeat)repeaters.add(i);if(!p.stand)stops.add(i);
    };
    if(geometry){for(const {structure,cells} of geometry.entries)for(const i of cells)add(structure,i);}
    else for(const s of world.structures)for(const c of footprintCells(s))add(s,c.z*width+c.x);
    for(const j of world.jobs)if(j.construction==='frame'&&j.kind!=='power-conduit'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')for(const c of footprintCells(j))stops.add(c.z*width+c.x);
  }
  const floors=new Map<number,number>();
  // A single captured byte per cell replaces two mostly dense Maps on a site.
  // Objects remain sparse; both lookups retain the same terrain floor.
  let terrain:Uint8Array|Uint16Array=new Uint8Array(world.tiles.length);let terrainMaximum=0;
  if(version>=28) {
    for(const p of world.piles)if(p.kind==='chunk'&&p.owner.type==='ground'){const i=p.owner.z*width+p.owner.x;costs.set(i,Math.max(costs.get(i)??0,1400));repeaters.add(i);stops.add(i);}
    // Capture terrain on every decision: flooring can mutate between actors
    // within a tick. Read floor definitions when a floor is present, like the
    // scalar travel rule, without scanning the whole map through that helper.
    const tiles=world.tiles,hasSite=!!world.site;
    const drafted=!!actor&&'draft' in actor&&!!actor.draft,marshPerception=drafted?MARSH_PERCEIVED_CORE.drafted:MARSH_PERCEIVED_CORE.ordinary;
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
  }
  if(version>=29)for(const p of world.piles)if((p.kind==='steel'||version>=32&&p.kind==='blocks'||version>=41&&p.kind==='component'||version>=123&&(p.kind==='gold'||p.kind==='plasteel'||p.kind==='advanced-component'))&&p.owner.type==='ground'){const i=p.owner.z*width+p.owner.x;floors.set(i,Math.max(floors.get(i)??0,467));costs.set(i,Math.max(costs.get(i)??0,467));}
  // Door wait is added after the terrain/object/material maximum, not compared
  // with it. Preserve present zero entries for fully open doors on bare floors.
  for(const s of geometry?.roomDoors??world.structures)if(isRoomDoor(s.kind)) {const i=s.z*width+s.x;repeaters.delete(i);costs.set(i,Math.max(costs.get(i)??0,terrain[i]??0)+Math.round(doorWait(s,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveLocal297(world):world.tick)/3*1000));}
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
