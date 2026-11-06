import {actualAdditionalPlantOwners256} from './actual-plant-physical-masks-256.ts';
import type {World,Resource} from './types.ts';
import {healthRandom} from './health.ts';
import {localBiomeRules256} from './local-biome-rules-v256.ts';
import {terrainGroundFertility256,terrainIsWater256} from './natural-terrain-runtime-256.ts';
import {roofKindAt} from './roof-rules.ts';
import {FLORA_DEFINITIONS,isPlantSpeciesInVersion} from './biome-flora.ts';
import {createWildPlantResource256} from './wild-plant-acquisition-v256.ts';
import {WILD_PLANT_GENERATION_FACTS_256 as FACTS,type WildPlantGenerationDef256 as Def} from './wild-plant-generation-data-256.ts';
import {plantCellOrder256} from './wild-plant-generation-math-256.ts';
import {surfaceTileHash} from './world-site-geography.ts';
import {validatePlantMap256,type WildPlantMapInput256} from './wild-plant-generation-256.ts';
import {createWildPlantSpawner256,PlantRegionCache256} from './wild-plant-spawner-256.ts';
import {actualPlantRuntimeSessionFactory256} from './wild-plant-runtime-session-256.ts';
import {resourceAt} from './farming.ts';
const f=Math.fround;
export interface WildFloraState256 {
 revision:2;cycleIndex:number;desired:number;desiredTmp:number;fertile:number;fertileTmp:number;hasCalculated:boolean;lastTick:number;
}
export interface RuntimePlantCell256 {readonly fertility:number;readonly naturalRoof:boolean;readonly roofed:boolean;readonly water:boolean}
/** Composition owns real normal-walkability, edifice/cover and annual tile
 * climate inputs. These are the SAME grids/contracts as initial generation.
 * capture is lazy (only a real attempt); it must neither step nor draw RNG.
 * There is no standability substitution, climate guess or generated fake map. */
export interface WildPlantMapReader256 {
 densityFactor(world:World):number;
 cell(world:World,index:number):RuntimePlantCell256;
 capture(world:World):WildPlantMapInput256 & {readonly worldSeed:number;readonly tileHash:number};
}
/** O(1), current real terrain/floor/bridge and single roof authority. */
export function runtimePlantCell256(world:World,index:number):RuntimePlantCell256 {
 const tile=world.tiles[index];if(!tile)throw Error('Missing physical plant cell');
 const roof=roofKindAt(world,index);
 return {fertility:f(terrainGroundFertility256(tile)),naturalRoof:roof==='natural-thin'||roof==='natural-thick',roofed:roof!==undefined,water:!tile.bridge&&!tile.floor&&terrainIsWater256(tile.terrain)};
}
const scalarKeys=['revision','cycleIndex','desired','desiredTmp','fertile','fertileTmp','hasCalculated','lastTick'] as const;
const integer=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
export function validWildFloraState256(value:unknown,world:Pick<World,'site'|'tick'|'width'|'height'>,version:number):value is WildFloraState256 {
 if(version<256||world.site?.revision!==3||!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const v=value as Record<string,unknown>,area=world.width*world.height;
 if(Reflect.ownKeys(v).length!==scalarKeys.length||!scalarKeys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)??{},'value')))return false;
 const finite=(n:unknown,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max&&Object.is(n,f(n));
 // Initial production has actually completed the whole-map calculation. A
 // false flag may exist privately during that phase, never in an admitted map.
 return v.revision===2&&v.hasCalculated===true&&integer(v.cycleIndex,0,area)&&finite(v.desired,area)&&finite(v.desiredTmp,Number(v.cycleIndex))&&integer(v.fertile,0,area)&&integer(v.fertileTmp,0,Number(v.cycleIndex))&&integer(v.lastTick,world.tick,world.tick);
}
export function validateWildFlora256(world:Pick<World,'flora'|'site'|'tick'|'width'|'height'|'resources'>,version:number):boolean {
 if(!validWildFloraState256(world.flora,world,version))return false;
 return world.resources.every(plant=>{
  if(plant.species===undefined)return true;
  if(!isPlantSpeciesInVersion(plant.species,version))return false;
  const def=FLORA_DEFINITIONS[plant.species];
  return plant.kind===def.kind&&plant.amount===def.yield&&typeof plant.growth==='number'&&Number.isFinite(plant.growth)&&plant.growth>=0&&plant.growth<=1&&integer(plant.growthTick,0,world.tick)&&plant.plantLife!==undefined;
 });
}
function authority(world:World) {
 const site=world.site,rules=site?.revision===3?localBiomeRules256(site.biome,world.schemaVersion):undefined;
 if(world.schemaVersion<256||site?.revision!==3||!rules||world.planet?.revision!==3)throw Error('Wild renewal requires a real geographic site3');
 return {site,rules,worldSeed:world.planet.generationSeed,tileHash:surfaceTileHash(site.tileId)};
}
function cellDesired(cell:RuntimePlantCell256,density:number,rules:ReturnType<typeof authority>['rules'],anyIgnores:boolean):number {
 if(!Number.isFinite(cell.fertility)||cell.fertility<0||typeof cell.naturalRoof!=='boolean'||typeof cell.roofed!=='boolean'||typeof cell.water!=='boolean'||cell.naturalRoof&&!cell.roofed)throw Error('Invalid real renewal cell');
 let base=cell.fertility;if(cell.naturalRoof)base=f(base*.5);if(anyIgnores&&cell.water&&base<=0)base=f(.1);
 const fertility=cell.fertility<=0&&anyIgnores?1:cell.fertility;
 return Math.min(f(base*f(f(rules.scalars.plantDensity*density)*fertility)),1);
}
function densityAt(world:World,reader:WildPlantMapReader256):number {
 const density=f(reader.densityFactor(world));if(!Number.isFinite(density)||density<0)throw Error('Invalid real plant density factor');return density;
}
/** Call only after completed initial plants/resources, before first actual
 * local step. No RNG or observation of a previous saved map is performed. */
export function createWildFloraState256(world:World,reader:WildPlantMapReader256):WildFloraState256 {
 const {rules}=authority(world),density=densityAt(world,reader),anyIgnores=rules.wildPlants.some(row=>FACTS[row.defId as Def].completelyIgnoreFertility);
 let desired=0,fertile=0;
 for(let index=0;index<world.width*world.height;index++){const cell=reader.cell(world,index);desired=f(desired+cellDesired(cell,density,rules,anyIgnores));if(cell.fertility>0)fertile++;}
 return {revision:2,cycleIndex:0,desired,desiredTmp:0,fertile,fertileTmp:0,hasCalculated:true,lastTick:world.tick};
}
/** Exact Rand.MTBEventOccurs double probability + rare-event two draws. */
export function plantRegrowthMtb256(days:number,random:()=>number):boolean {
 if(days===Infinity)return false;if(days<=0)return true;
 let chance=10000/(f(days)*60000),gate=1;if(!(chance>0))return false;
 if(chance<.0001){while(chance<.0001){chance*=8;gate/=8;}if(random()>gate)return false;}
 return random()<chance;
}
const contexts=new WeakMap<World,{width:number;height:number;worldSeed:number;tileHash:number;order:Uint32Array;regions:PlantRegionCache256}>();
function context(world:World,worldSeed:number,tileHash:number){let c=contexts.get(world);if(!c||c.width!==world.width||c.height!==world.height||c.worldSeed!==worldSeed||c.tileHash!==tileHash){c={width:world.width,height:world.height,worldSeed,tileHash,order:plantCellOrder256(world.width*world.height,worldSeed,tileHash).cells,regions:new PlantRegionCache256()};contexts.set(world,c);}return c;}
const speciesDefs=new Map<string,string>(Object.entries(FACTS).map(([def,row])=>[row.species,def]));
const crops:Readonly<Record<string,string>>={rice:'Plant_Rice',potato:'Plant_Potato',corn:'Plant_Corn',cotton:'Plant_Cotton',healroot:'Plant_Healroot',haygrass:'Plant_Haygrass'};
export function runtimePlantDef256(resource:Resource):string|undefined {return resource.species===undefined?crops[resource.kind]:speciesDefs.get(resource.species);}
/** Exact subset of the actual spawner's early rejection (see pick()). */
function actualSpawnerRejects256(world:World,cell:number,density:number):boolean {
 if(density<=0)return true;
 const tile=world.tiles[cell];if(!tile)return false;
 if(tile.terrain==='rock'||!!tile.collapsedRock)return true;
 if(f(tile.snowDepth??0)>=f(.2))return true;
 const resource=resourceAt(world,cell);
 return resource!==undefined&&resource.x+resource.z*world.width===cell&&runtimePlantDef256(resource)!==undefined;
}
function captureBound(world:World,reader:WildPlantMapReader256,density:number) {
 const expected=authority(world),input=reader.capture(world);
 if(input.schemaVersion!==world.schemaVersion||input.width!==world.width||input.height!==world.height||input.worldSeed!==expected.worldSeed||input.tileHash!==expected.tileHash||input.rules!==expected.rules||input.densityFactor!==density)throw Error('Plant reader does not describe this actual map');
 const actual=world.resources.flatMap(resource=>{const defId=runtimePlantDef256(resource);return defId===undefined?[]:[{cell:resource.z*world.width+resource.x,defId,nonStump:true}];}).concat(actualAdditionalPlantOwners256(world));
 if(input.existing.length!==actual.length||actual.some((plant,i)=>{const row=input.existing[i];return !row||row.cell!==plant.cell||row.defId!==plant.defId||row.nonStump!==plant.nonStump;}))throw Error('Plant reader lost actual resource owners');
 return {input,order:validatePlantMap256(input)};
}
/** One actual local tick, exactly ten Core substeps. All RNG, IDs, resources
 * and counters are planned together; any rejected reader/ID leaves them intact.
 * Same tick is a no-op; a skipped tick is refused, never replayed as catch-up. */
export function advanceWildFlora256(world:World,reader:WildPlantMapReader256):void {
 const state=world.flora;if(!state||state.revision!==2)return;
 if(state.lastTick===world.tick)return;
 const previousTick=world.tick-1;
 if(state.lastTick!==previousTick||!validWildFloraState256(state,{site:world.site,tick:previousTick,width:world.width,height:world.height},world.schemaVersion))throw Error('Wild renewal is not the next actual local tick');
 const {rules,worldSeed,tileHash}=authority(world),density=densityAt(world,reader),anyIgnores=rules.wildPlants.some(row=>FACTS[row.defId as Def].completelyIgnoreFertility),cache=context(world,worldSeed,tileHash);
 const next={...state},stream={rng:world.rng},random={value:()=>f(healthRandom(stream))},newPlants:Resource[]=[];
 const area=world.width*world.height,checks=Math.ceil(f(area*f(.0001)));let nextId=world.nextId,spawner:ReturnType<typeof createWildPlantSpawner256>|undefined;
 const chance=(value:number)=>{if(value<=0)return false;if(value>=1)return true;return random.value()<value;};
 for(let core=0;core<10;core++){
  // The source snapshots this chance once per Core call, before rollover.
  const cachedChance=f(next.desired/next.fertile);
  for(let sample=0;sample<checks;sample++){
   if(next.cycleIndex>=area){next.desired=next.desiredTmp;next.desiredTmp=0;next.fertile=next.fertileTmp;next.fertileTmp=0;next.cycleIndex=0;}
   const cell=cache.order[next.cycleIndex]!,physical=reader.cell(world,cell);
   next.desiredTmp=f(next.desiredTmp+cellDesired(physical,density,rules,anyIgnores));if(physical.fertility>0)next.fertileTmp++;
   if(chance(cachedChance)&&plantRegrowthMtb256(physical.naturalRoof?130:rules.scalars.wildPlantRegrowDays,()=>random.value())&&(!physical.roofed||physical.naturalRoof)){
    // The actual spawner's pick() returns undefined, before reading any random
    // value, when density<=0, a plant already stands on the cell, the cell is
    // solid (rock/collapsed rock) or snow is >= 0.2. Those exact sufficient
    // conditions are read directly here so the whole-map spatial capture is
    // only built for a cell that can actually receive a plant.
    let rejected=false;
    if(!spawner){const actualSession=actualPlantRuntimeSessionFactory256(reader);if(actualSession){if(actualSpawnerRejects256(world,cell,density))rejected=true;else spawner=actualSession(world,density,next.desired);}else {const captured=captureBound(world,reader,density);spawner=createWildPlantSpawner256(captured.input,captured.order,cache.regions);}}
    const def=rejected?undefined:spawner!.pick(cell,random,next.desired,true);
    if(def!==undefined){if(!Number.isSafeInteger(nextId+1))throw Error('No plant identity available');
     const plant=createWildPlantResource256(world,nextId++,cell%world.width,Math.floor(cell/world.width),FACTS[def].species,.15,true);
     if(!plant)throw Error('Missing actual renewal resource definition');newPlants.push(plant);spawner!.record({cell,defId:def,nonStump:true});
    }
   }
   next.cycleIndex++;
  }
 }
 next.lastTick=world.tick;
 // No callbacks or validation can fail after this commit boundary.
 if(newPlants.length)world.resources=[...world.resources,...newPlants];world.nextId=nextId;world.rng=stream.rng;Object.assign(state,next);
}
/** Only an explicit map-clock rebase, never initialization/load or skipped
 * simulation. All cycle sums and plants' actual ages are retained. */
export function rebaseWildFloraClock256(state:WildFloraState256,fromTick:number,toTick:number):void {
 if(state.lastTick!==fromTick||!Number.isSafeInteger(toTick)||toTick<0)throw Error('Invalid renewal clock rebase');state.lastTick=toTick;
}
