import { isPlant,plantGrowth } from './plants.ts';
import { isRoofed,roofCoverage,roofIdentity,sameRoofIdentity,type RoofIdentity } from './roof-rules.ts';
import type { LightEnvironment,LightReader } from './light-environment.ts';
import type { Resource,World } from './types.ts';
import { structuresOfKind } from './structure-navigation.ts';

/** Settle the captured light/thermal interval before changing either regime.
 * Roof producers still call this before mutating physical coverage. */
export function checkpointPlantGrowth(world:World,plant:Resource):void {
  if(!isPlant(plant))return;
  plant.growth=plantGrowth(world,plant);plant.growthTick=world.tick;
}

interface Binding {
  source:Resource[];
  plants:Resource[];
  artificial:Float32Array|undefined;
  hasCaptured:boolean;
  constructed:readonly number[]|undefined;
  coverage:number[];
  width:number;
  height:number;
  /** Identity of the three roof arrays the coverage was derived from. */
  roofs?:RoofArrays;
  /** Identity of the light regime (coverage, artificial field, size). */
  regimeKey297?:object;
  /** Set by a complete pass over `plants` (cleared when one starts): the
   * `reconciled` mode of each plant, aligned with `plants`, which is also its
   * growthLight when the pass ended. */
  modes?:Resource['growthLight'][];
}
type RoofArrays=RoofIdentity;
const bindings=new WeakMap<World,Binding>();
// Equal roof array identities prove an equal coverage (see roofIdentity).
const roofArrays=roofIdentity,sameRoofArrays=sameRoofIdentity;
/* Light regime under which each plant object was last reconciled (schema>=256).
 * A plant's regime depends only on its immutable cell, the roof coverage and
 * the artificial field; when those are unchanged a plant object already
 * reconciled (and whose growthLight was not altered since) needs no work. */
const reconciled=new WeakMap<Resource,{key:object;mode:Resource['growthLight']}>();
/* The world of the last pass that wrote `reconciled` entries. While it is the
 * world being reconciled, the entries of the plants of its binding are those
 * its last pass left: key regimeKey297, mode the binding's `modes`. */
let lastWritingWorld:World|undefined;
const sameCoverage=(previous:readonly number[],current:readonly number[]|undefined):boolean=>
  previous.length===(current?.length??0)&&previous.every((cell,i)=>cell===current![i]);

/** The light cache supplies a stable, immutable field. Sky and the temporary
 * roofs Set are deliberately excluded from the invalidation key. Stable calls
 * compare roof primitives but never walk the forest or copy the coverage.
 * Producers replace Resource[] when adding/removing/replacing plant objects. */
export function reconcilePlantLighting(world:World,provided:LightEnvironment|LightReader):void {
  let binding=bindings.get(world);
  const previous=binding;
  if(!binding||binding.source!==world.resources) {
    const plants=world.resources.filter(isPlant);
    // hasCaptured is only read below schema 256 (a complete pass replaces it).
    binding={source:world.resources,plants,hasCaptured:world.schemaVersion<256&&plants.some(p=>p.growthLight!==undefined),artificial:undefined,
      constructed:undefined,coverage:[],width:0,height:0};
    bindings.set(world,binding);
  }
  const hasLamp=(structuresOfKind(world,'sun-lamp').length>0);
  // Historical maps do not acquire new dark states or force a diffusion read.
  // With no sun lamp, all other glowers cap at .5 and cannot supply full light.
  if(world.schemaVersion<256&&!hasLamp&&!binding.hasCaptured)return;
  const artificial=hasLamp?(typeof provided==='function'?provided():provided).artificial:undefined;
  const roofs=roofArrays(world),sameDims=binding.width===world.width&&binding.height===world.height;
  if(binding.artificial===artificial&&sameDims&&sameRoofArrays(binding.roofs,roofs))return;
  const constructed=roofCoverage(world);
  if(binding.artificial===artificial&&sameDims&&sameCoverage(binding.coverage,constructed)){binding.roofs=roofs;return;}
  // Same regime inputs as the previous complete pass over another resources
  // array: only plant objects not yet reconciled under them can change.
  const regimeKey=previous&&previous!==binding&&world.schemaVersion>=256&&previous.artificial===artificial
    &&previous.width===world.width&&previous.height===world.height&&sameCoverage(previous.coverage,constructed)?previous.regimeKey297:undefined;
  const key=regimeKey??{};
  // The previous binding's plants, whose `reconciled` entries are known
  // without reading the WeakMap (key regimeKey, mode carriedModes[j]): its last
  // pass was complete and no other world's pass wrote entries since.
  const carriedPlants=regimeKey&&lastWritingWorld===world&&previous!.modes?previous!.plants:undefined,carriedModes=previous?.modes;
  // One entry pushed per plant, in order.
  const plants=binding.plants,modes:Resource['growthLight'][]=[];
  binding.modes=undefined;lastWritingWorld=world;
  let hasCaptured=false,j=0;
  for(let i=0;i<plants.length;i++) {
    const plant=plants[i]!;
    if(regimeKey){
      // A carried plant: the previous plants follow in order, some of them
      // removed (searched up to 64 positions ahead); any other plant (an
      // appended one, or past a longer gap) reads the WeakMap.
      let found=-1;
      if(carriedPlants){const end=Math.min(carriedPlants.length,j+64);for(let k=j;k<end;k++)if(carriedPlants[k]===plant){found=k;break;}if(found>=0)j=found+1;}
      if(found>=0){const mode=carriedModes![found];if(plant.growthLight===mode){hasCaptured||=mode!==undefined;modes.push(mode);continue;}}
      else{const seen=reconciled.get(plant);if(seen&&seen.key===regimeKey&&plant.growthLight===seen.mode){hasCaptured||=seen.mode!==undefined;modes.push(seen.mode);continue;}}
    }
    const cell=plant.z*world.width+plant.x;
    const mode=(artificial?.[cell]??0)>=1?'artificial-full':isRoofed(world,cell)?'dark':undefined;
    hasCaptured||=mode!==undefined;modes.push(mode);
    if(world.schemaVersion>=256)reconciled.set(plant,{key,mode});
    if(plant.growthLight===mode)continue;
    checkpointPlantGrowth(world,plant);
    if(mode===undefined)delete plant.growthLight;else plant.growthLight=mode;
  }
  Object.assign(binding,{artificial,hasCaptured,constructed,coverage:[...(constructed??[])],width:world.width,height:world.height,roofs,regimeKey297:key,modes:world.schemaVersion>=256?modes:undefined});
}
