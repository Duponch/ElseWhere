import {validCollapsedRock256,excavatedCollapsedRock256,admittedRoofTerrain256} from './collapsed-rocks-256.ts';
import type {Tile} from './types.ts';
import {terrainBridgeable256} from './natural-terrain-runtime-256.ts';
import {footprintContains} from './definitions.ts';
import type {Cell,Job,World,StructureKind} from './types.ts';
export const BRIDGE_SCHEMA_VERSION=247;
export const BRIDGE_WOOD=12;
export const BRIDGE_WORK_CORE=1500;
export const BRIDGE_REMOVE_CORE=300;
export const BRIDGE_BOMB_THRESHOLD=35;
export const bridgeAt=(w:Pick<World,'width'|'tiles'>,c:Cell):boolean=>w.tiles[c.z*w.width+c.x]?.bridge===true;
export const isBridgeJob=(j:Pick<Job,'kind'>):boolean=>j.kind==='build-bridge'||j.kind==='remove-bridge';
export function validBridgeTile(tile:{terrain?:unknown;floor?:unknown;snowDepth?:unknown;bridge?:unknown;collapsedRock?:unknown},version:number):boolean {
  if(!validCollapsedRock256(tile,version,Number.MAX_SAFE_INTEGER,v=>admittedRoofTerrain256(v,version)))return false;
  if(tile.collapsedRock)tile=excavatedCollapsedRock256(tile as Tile);
  return !Object.hasOwn(tile,'bridge')||version>=BRIDGE_SCHEMA_VERSION&&tile.bridge===true&&terrainBridgeable256(tile.terrain,version)&&tile.floor===undefined;
}

/** Core1.6.4871 resolved terrainAffordanceNeeded. Stuff replaces it ONLY for
 * these explicit Stuff rows; furniture does not become Heavy just by stone. */
export const BUILDING_SUPPORT:Readonly<Record<StructureKind,'Light'|'Medium'|'Heavy'|'Diggable'|'Stuff'|'None'>>={
 'firefoam-popper':'Light',
 'tool-cabinet':'Light',
 'ship-cryptosleep-casket':'Heavy',
 'ship-computer':'Heavy','ship-sensors':'Heavy',
 'ship-beam':'Heavy','ship-engine':'Heavy',
 'ship-reactor':'Heavy',
 'fueled-smithy':'Medium','electric-smithy':'Medium',
 brewery:'Medium','fermenting-barrel':'Light',
 'insect-hive':'None','glow-pod':'None',
  'ancient-cryptosleep-casket':'Medium',
  'cryptosleep-casket':'Medium',
  column:'Light',urn:'Light','stele-large':'Medium','stele-grand':'Heavy',sarcophagus:'Light',
  'ancient-road-barrier':'Light','ancient-road-lamp':'Light',
  'ship-chunk':'Light',
  'torch-lamp':'Light',
  'bedroll':'Light',
  'bed':'Light',
  'double-bed':'Light',
  'hospital-bed':'Light',
  'table':'Light',
  'table-square':'Light',
  'table-long':'Light',
  'stool':'Light',
  'dining-chair':'Light',
  'armchair':'Light',
  'shelf':'Light',
  'small-shelf':'Light',
  'end-table':'Light',
  'dresser':'Light',
  'flower-pot':'Light',
  'sleeping-spot':'Light',
  'animal-sleeping-spot':'Light',
  'crafting-spot':'Light',
  'butcher-spot':'Light',
  'power-conduit':'Light',
  'power-switch':'Light',
  'standing-lamp':'Light',
  'sun-lamp':'Light',
  'heater':'Light',
  'passive-cooler':'Light',
  'campfire':'Light',
  'horseshoes':'Light',
  'chess-table':'Light',
  'hoopstone-ring':'Light','game-of-ur-board':'Light','poker-table':'Light',
  'billiards-table':'Medium',
  'tube-television':'Light',
  'spike-trap':'Light',
  'sandbags':'Light',
  'small-sculpture':'Light',
  'large-sculpture':'Light',
  'hopper':'Light',
  'orbital-beacon':'Light',
  'deep-drill':'Light',
  'vitals-monitor':'Light',
  'pen-marker':'Light',
  'mini-turret':'Light',
  'vent':'Medium',
  'cooler':'Medium',
  'battery':'Medium',
  'solar-generator':'Medium',
  'wood-generator':'Medium',
  'chemfuel-generator':'Medium',
  'geothermal-generator':'Heavy',
  'comms-console':'Medium',
  'hydroponics-basin':'Medium',
  'multi-analyzer':'Medium',
  'fueled-stove':'Medium',
  'electric-stove':'Medium',
  'tailor-bench':'Medium',
  'electric-tailor-bench':'Medium',
  'butcher-table':'Medium',
  'art-bench':'Medium',
  'research-bench':'Medium',
  'machining-table':'Medium',
  'drug-lab':'Medium',
  'wind-turbine':'Heavy',
  'ground-scanner':'Heavy',
  'electric-crematorium':'Heavy',
  'electric-smelter':'Heavy',
  'biofuel-refinery':'Heavy',
  'fabrication-bench':'Heavy',
  'hi-tech-research-bench':'Heavy',
  'stonecutter':'Heavy',
  'nutrient-paste-dispenser':'Heavy',
  grave:'Diggable',
  'wall':'Stuff',
  'door':'Stuff',
  'autodoor':'Stuff',
  'fence':'Stuff',
  'fence-gate':'Stuff'
};
/** Only wall:legacy may omit Stuff in a valid current save; its existing
 * recipe and HP rules already interpret that immutable form as wood. */
export function buildingSupportNeed256(entity:{kind:string;material?:unknown}):'Light'|'Medium'|'Heavy'|'Diggable'|undefined {
 const need=BUILDING_SUPPORT[entity.kind as StructureKind];if(need==='None')return undefined;if(need!=='Stuff')return need;
 if(entity.material==='wood'||entity.kind==='wall'&&entity.material===undefined)return 'Light';if(entity.material==='steel')return 'Medium';
 return typeof entity.material==='string'&&['granite-blocks','limestone-blocks','marble-blocks','sandstone-blocks','slate-blocks'].includes(entity.material)?'Heavy':undefined;
}
export function bridgeSupportsBuilding(entity:{kind:string;material?:unknown}):boolean {return buildingSupportNeed256(entity)==='Light';}

export function validateBridgeTransport(w:World,version:number,changedTiles?:readonly number[]):string[] {
  const bad=(s:string)=>[s],check=(i:number)=>!!w.tiles[i]&&validBridgeTile(w.tiles[i]!,version);
  if(changedTiles?changedTiles.some(i=>!check(i)):w.tiles.some((_,i)=>!check(i)))return bad('Invalid or future bridge foundation.');
  const seen=new Set<number>();
  for(const job of w.jobs){
    if(Object.hasOwn(job,'bridge'))return bad('Bridge state belongs to a terrain tile.');
    if(!isBridgeJob(job))continue;
    const index=job.z*w.width+job.x,tile=w.tiles[index];
    if(version<247||!tile||!terrainBridgeable256(tile.terrain,version)||tile.floor!==undefined||job.kind==='build-bridge'&&tile.bridge!==undefined||job.kind==='remove-bridge'&&tile.bridge!==true
      ||seen.has(index)||job.orientation!==0||job.footprint!=='standard'||job.material!==undefined||job.floor!==undefined||job.furniture!==undefined||job.deconstruction!==undefined
      ||job.tree!==undefined||job.plantTarget!==undefined||job.repair!==undefined||job.flick!==undefined||job.growingZoneId!==undefined||job.flowerPotId!==undefined||job.clearance!==undefined&&(version<256||job.kind!=='build-bridge')||job.pickTicks!==undefined||job.installationWork!==undefined)return bad('Invalid or future bridge work.');
    if(job.kind==='remove-bridge'&&(w.structures.some(s=>footprintContains(s,job))||w.jobs.some(j=>j!==job&&(j.kind==='install'||Object.hasOwn(BUILDING_SUPPORT,j.kind))&&footprintContains(j,job))))return bad('Voluntary bridge removal would lose an occupied support.');
    seen.add(index);
  }
  if((w.packed??[]).some(p=>Object.hasOwn(p,'bridge')))return bad('Foundation cannot belong to a packed wrapper.');
  for(const entity of [...w.structures,...(w.packed??[]).map(p=>p.building)])if(Object.hasOwn(entity,'bridge'))return bad('Foundation cannot be a building or packed object.');
  return [];
}
