import {geyserCells256} from './local-geyser-state-256.ts';
import {STRUCTURE_DEFINITIONS,footprintCells} from './definitions.ts';
import {STRUCTURE_SHOT_FILL,FRAME_SHOT_FILL,resourceShotFill,itemShotFill} from './combat-content.ts';
import {isPassageDoor} from './door-rules.ts';
import {constructionFinalWipesPlants,constructionFrameWipesPlants} from './construction-plants.ts';
import {actualAdditionalPlantOwners256} from './actual-plant-physical-masks-256.ts';
import {naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import {readNaturalPlantSubstrate256,terrainIsWater256} from './natural-terrain-runtime-256.ts';
import {roofKindAt} from './roof-rules.ts';
import {runtimePlantDef256} from './wild-plant-runtime-256.ts';
import {PlantSpatialRegions256} from './wild-plant-spatial-regions-256.ts';
import {WILD_PLANT_GENERATION_FACTS_256 as FACTS,type WildPlantGenerationDef256 as Def} from './wild-plant-generation-data-256.ts';
import type {World,StructureKind,Cell} from './types.ts';
import type {ExistingGenerationPlant256} from './wild-plant-generation-256.ts';
import {createPreparedSpatialWildPlantSpawner256,type PreparedPlantPopulation256,type PlantSpatialSpawnerInput256,type PlantSpawnerCell256,type PlantSpawnerRegionCounts256} from './wild-plant-spawner-256.ts';

const f=Math.fround;
const BLOCKED=1,FULL=2,COVER=4,BLOCKS_PLANT=8,DOOR=16,FENCE=32;
const ZERO_FILL_EDIFICES:ReadonlySet<StructureKind>=new Set(['power-switch','spike-trap','grave','bedroll','sleeping-spot','animal-sleeping-spot','crafting-spot','butcher-spot','horseshoes']);
interface SpatialCell256 extends PlantSpawnerCell256 {readonly regionType:number;readonly walkableNoDoor:boolean}
type Header256=Omit<PlantSpatialSpawnerInput256,'existing'|'spatial'>;

/** One synchronous actual-map renewal decision. Owners are captured once;
 * physical cells and12x12 regions are read only when queried. Nothing here is
 * retained by World, save/load, or the next tick. This is not an admission
 * validator: the public cold capture remains the complete strict boundary. */
export function createActualPlantSpatialSession256(world:World,header:Header256):PlantSpatialSpawnerInput256 {
 return captureActualPlantSpatialSession256(world,header);
}
/** Runtime-only ownership transfer. The full physical capture and duplicate
 * guards still run once; the kernel receives the population built by that
 * same pass. No exposed existing array or previous session is reused. */
export function createActualPlantSpatialSpawner256(world:World,header:Header256,order:readonly Def[]) {
 const base=resourceCapture256(world);
 const population:PreparedPlantPopulation256={at:new OverlayPlantMap256(base.at),globalSpecies:new Map(base.species),totalPlants:base.total};
 const input=captureActualPlantSpatialSession256(world,header,population,base);
 return createPreparedSpatialWildPlantSpawner256(input,order,population);
}
/* Resource-derived part of the runtime capture, shared across ticks.
 * world.resources is only ever replaced (never mutated in place) once a
 * World runs, and a resource's kind/species/position are immutable, so the
 * occupancy bits and plant rows it contributes are a pure function of the
 * array identity. Everything else (structures, frames, piles, potted plants,
 * geysers, tiles) is still read fresh by every capture. */
interface ResourceCapture256 {readonly n:number;readonly owners:Uint8Array;readonly at:ReadonlyMap<number,ExistingGenerationPlant256>;readonly species:ReadonlyMap<string,number>;readonly total:number}
const resourceCaptures256=new WeakMap<readonly World['resources'][number][],ResourceCapture256>();
function resourceCapture256(world:World):ResourceCapture256 {
 const n=world.width*world.height,cached=resourceCaptures256.get(world.resources);
 if(cached&&cached.n===n)return cached;
 const owners=new Uint8Array(n),at=new Map<number,ExistingGenerationPlant256>(),species=new Map<string,number>();let total=0;
 for(const resource of world.resources){
  const fill=resourceShotFill(resource),blocks=resource.kind!=='rock';
  if(!Number.isFinite(fill)||fill<0||fill>1)throw Error('Missing physical plant fill definition');
  if(!Number.isSafeInteger(resource.x)||!Number.isSafeInteger(resource.z)||resource.x<0||resource.z<0||resource.x>=world.width||resource.z>=world.height)throw Error('Physical plant owner outside its actual map');
  const bits=(fill>.99?FULL:0)|(fill>=.01?COVER:0)|(blocks||fill>=.01?BLOCKS_PLANT:0),cell=resource.z*world.width+resource.x;
  if(bits)owners[cell]=owners[cell]!|bits;
  const defId=runtimePlantDef256(resource);
  if(defId!==undefined){
   if(at.has(cell))throw Error('Invalid existing initial plant');
   at.set(cell,{cell,defId,nonStump:true});total++;species.set(defId,(species.get(defId)??0)+1);
  }
 }
 const capture={n,owners,at,species,total};resourceCaptures256.set(world.resources,capture);return capture;
}
/** Copy-on-write population: plants recorded during one decision stay local. */
class OverlayPlantMap256 extends Map<number,ExistingGenerationPlant256> {
 private readonly base:ReadonlyMap<number,ExistingGenerationPlant256>;
 constructor(base:ReadonlyMap<number,ExistingGenerationPlant256>){super();this.base=base;}
 override get(key:number):ExistingGenerationPlant256|undefined{return super.has(key)?super.get(key):this.base.get(key);}
 override has(key:number):boolean{return super.has(key)||this.base.has(key);}
}
function captureActualPlantSpatialSession256(world:World,header:Header256,population?:PreparedPlantPopulation256,base?:ResourceCapture256):PlantSpatialSpawnerInput256 {
 const n=world.width*world.height;
 if(world.schemaVersion<256||header.width!==world.width||header.height!==world.height||![world.width,world.height].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=400)||world.tiles.length!==n)throw Error('Invalid actual spatial plant map');
 const owners=base&&base.n===n?base.owners.slice():new Uint8Array(n),existing:ExistingGenerationPlant256[]=[],plantCells=population?.at??new Set<number>();
 const index=(c:Cell)=>{if(!Number.isSafeInteger(c.x)||!Number.isSafeInteger(c.z)||c.x<0||c.z<0||c.x>=world.width||c.z>=world.height)throw Error('Physical plant owner outside its actual map');return c.z*world.width+c.x;};
 // Map's non-number keys never matched a valid numeric cell query. Preserve
 // that raw behavior instead of coercing a malformed geyser key to an index.
 const add=(cell:number,bits:number)=>{if(bits&&typeof cell==='number')owners[cell]=owners[cell]!|bits;};
 const filled=(c:Cell,fill:number,blocks=false)=>{
  if(!Number.isFinite(fill)||fill<0||fill>1)throw Error('Missing physical plant fill definition');
  add(index(c),(fill>.99?FULL:0)|(fill>=.01?COVER:0)|(blocks||fill>=.01?BLOCKS_PLANT:0));
 };
 const plant=(row:ExistingGenerationPlant256)=>{
  if(!Number.isSafeInteger(row.cell)||row.cell<0||row.cell>=n||plantCells.has(row.cell))throw Error('Invalid existing initial plant');
  if(population){
   population.at.set(row.cell,row);
   if(row.nonStump){population.totalPlants++;population.globalSpecies.set(row.defId,(population.globalSpecies.get(row.defId)??0)+1);}
  }else{(plantCells as Set<number>).add(row.cell);existing.push(row);}
 };
 for(const structure of world.structures){
  if(!Object.hasOwn(STRUCTURE_SHOT_FILL,structure.kind)||!Object.hasOwn(STRUCTURE_DEFINITIONS,structure.kind))throw Error('Missing physical plant structure metadata');
  const fill=STRUCTURE_SHOT_FILL[structure.kind],edifice=ZERO_FILL_EDIFICES.has(structure.kind);
  if(fill<.01&&structure.kind!=='power-conduit'&&!edifice)throw Error('Unresolved zero-fill edifice metadata');
  const bits=(fill>.99?FULL:0)|(fill>=.01||edifice?COVER:0)|(constructionFinalWipesPlants(structure.kind)?BLOCKS_PLANT:0)|
   (STRUCTURE_DEFINITIONS[structure.kind].blocksMovement?BLOCKED:0)|(isPassageDoor(structure.kind)?DOOR:structure.kind==='fence'?FENCE:0);
  for(const cell of footprintCells(structure))add(index(cell),bits);
 }
 for(const job of world.jobs)if(job.construction==='frame'){
  const kind=job.furniture?.kind??job.kind;if(job.kind==='lay-floor'||job.kind==='build-bridge')continue;
  if(!constructionFrameWipesPlants(kind))throw Error('Missing actual Thing Frame metadata');
  for(const cell of footprintCells(job))filled(cell,FRAME_SHOT_FILL,true);
 }
 // With a shared resource capture its bits are already in owners and its
 // plants in population (bitwise OR and keyed rows do not depend on order).
 if(!(base&&base.n===n))for(const resource of world.resources){
  filled(resource,resourceShotFill(resource),resource.kind!=='rock');const defId=runtimePlantDef256(resource);
  if(defId!==undefined)plant({cell:resource.z*world.width+resource.x,defId,nonStump:true});
 }
 for(const row of actualAdditionalPlantOwners256(world))plant(row);
 for(const pile of world.piles)if(pile.owner.type==='ground')filled(pile.owner,itemShotFill(pile.item));
 for(const pack of world.packed)if(pack.owner.type==='ground')index(pack.owner);
 for(const geyser of world.geysers?.items??[])for(const cell of geyserCells256(world.width,geyser))add(cell,BLOCKS_PLANT);
 const cells=new Map<number,SpatialCell256>();
 const cellAt=(c:number):SpatialCell256=>{
  let cell=cells.get(c);if(cell)return cell;
  if(!Number.isSafeInteger(c)||c<0||c>=n)throw Error('Invalid actual spatial plant cell');
  const tile=world.tiles[c];if(!tile)throw Error('Actual plant terrain is absent');
  const substrate=readNaturalPlantSubstrate256(tile),roof=roofKindAt(world,c),bits=owners[c]!,solid=tile.terrain==='rock'||!!tile.collapsedRock;
  const normal=!!(tile.bridge||tile.floor||naturalTerrainWalkable256(tile.terrain))&&!solid&&!(bits&BLOCKED),door=!!(bits&DOOR);
  const fertility=f(substrate.fertility),snowDepth=f(tile.snowDepth??0),baseWater=terrainIsWater256(tile.terrain);
  if(!Number.isFinite(fertility)||fertility<0||!Number.isFinite(snowDepth)||snowDepth<0)throw Error('Invalid actual spatial plant cell');
  cell={fertility,naturalRoof:roof==='natural-thin'||roof==='natural-thick',water:!tile.bridge&&!tile.floor&&baseWater,baseWater,
   terrainDefId:substrate.terrainDefId,terrainTags:substrate.tags,occupied:solid||!!(bits&COVER),blocksPlanting:solid||!!(bits&BLOCKS_PLANT),snowDepth,sandDepth:0,
   regionType:door?2:bits&FENCE?3:normal?1:solid||bits&FULL?0:4,walkableNoDoor:normal&&!door};
  cells.set(c,cell);return cell;
 };
 const anyIgnores=header.rules.wildPlants.some(row=>FACTS[row.defId as Def].completelyIgnoreFertility)||Object.values(FACTS).some(row=>row.cavePlant&&row.completelyIgnoreFertility);
 const baseAt=(c:number)=>{const cell=cellAt(c);let value=cell.fertility;if(cell.naturalRoof)value=f(value*.5);if(anyIgnores&&cell.water&&value<=0)value=f(.1);return value;};
 const regions=new PlantSpatialRegions256(world.width,world.height,c=>cellAt(c).regionType,baseAt),counts=new Map<number,PlantSpawnerRegionCounts256>();
 return {...header,existing,spatial:{cell:cellAt,near:(cell,radius)=>regions.near(cell,radius),record:()=>counts.clear(),counts(region,plants){
  let result=counts.get(region.id);if(result)return result;
  let count=0;const species=new Map<string,number>();
  // A1x1 plant can touch only the region's bounding rectangle plus one cell.
  // Integer counts do not depend on source owner order; duplicate contacts to
  // the same region are counted once, as in the cold lister's Set.
  for(let z=Math.max(0,region.minZ-1);z<=Math.min(world.height-1,region.maxZ+1);z++)for(let x=Math.max(0,region.minX-1);x<=Math.min(world.width-1,region.maxX+1);x++){
   const c=z*world.width+x,row=plants.get(c);if(!row?.nonStump||!regions.touches(c,region,c=>cellAt(c).walkableNoDoor))continue;
   count++;species.set(row.defId,(species.get(row.defId)??0)+1);
  }
  result={count,species};counts.set(region.id,result);return result;
 }}};
}
