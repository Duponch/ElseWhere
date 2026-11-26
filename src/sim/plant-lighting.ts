import { isPlant,plantGrowth } from './plants.ts';
import { isRoofed,roofCoverage,roofIdentity,sameRoofIdentity,type RoofIdentity } from './roof-rules.ts';
import type { LightEnvironment,LightReader } from './light-environment.ts';
import type { Resource,World } from './types.ts';
import { structuresOfKind } from './structure-navigation.ts';
import {markResourceChanged,captureResourceJournal,readResourceJournal,resourceMembershipUnchanged,type ResourceJournalCursor} from './resource-mutation-journal.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';

/** Settle the captured light/thermal interval before changing either regime.
 * Roof producers still call this before mutating physical coverage. */
export function checkpointPlantGrowth(world:World,plant:Resource):void {
  if(!isPlant(plant))return;
  plant.growth=plantGrowth(world,plant);plant.growthTick=world.tick;
  markResourceChanged(world,plant);
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
  /** The number of the pass that set `modes` (see writingPasses). */
  modesPass?:number;
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
/* Passes that may write `reconciled` entries, of every world, numbered. While
 * a binding's `modesPass` is the last one, no pass wrote entries since its
 * own: the entries of its plants are those it left (key regimeKey297, mode
 * its `modes`). A number, not a World reference, so no world is retained. */
let writingPasses=0;
const sameCoverage=(previous:readonly number[],current:readonly number[]|undefined):boolean=>
  previous.length===(current?.length??0)&&previous.every((cell,i)=>cell===current![i]);

interface OwnedBinding {
  owner:object;source:Resource[];cursor:ResourceJournalCursor;plants:Set<Resource>;
  artificial:Float32Array|undefined;roofs:RoofArrays;coverage:readonly number[];width:number;height:number;key:object;pass:number;
}
const ownedBindings=new WeakMap<World,OwnedBinding>();
/** Under the closed SIM owner, the membership journal gives the ordered
 * survivors and appended records directly. Lighting is the sole writer of an
 * on-map plant's growthLight; tree replantation clears it before its append.
 * An unchanged regime therefore only needs to reconcile appended plants.
 * Unknown transactions, owner changes and another world's lighting pass lose
 * that proof and visit the complete ordered membership. */
function reconcileOwnedPlantLighting(world:World,provided:LightEnvironment|LightReader,owner:object):boolean {
  const previous=ownedBindings.get(world);let binding=previous,membershipChanged=false,full=false;
  let appended:Set<Resource>|undefined;
  if(binding?.owner!==owner)binding=undefined;
  if(binding&&(binding.source!==world.resources||!resourceMembershipUnchanged(world.resources,binding.cursor))){
    const delta=readResourceJournal(world.resources,binding.cursor);
    if(delta?.membershipEdits){
      membershipChanged=delta.membershipChanged;
      apply:for(const edit of delta.membershipEdits){
        for(const plant of edit.removed)if(isPlant(plant)){
          if(!binding.plants.delete(plant)){binding=undefined;break apply;}appended?.delete(plant);
        }
        for(const plant of edit.appended)if(isPlant(plant)){
          if(binding.plants.has(plant)){binding=undefined;break apply;}binding.plants.add(plant);(appended??=new Set()).add(plant);
        }
      }
    }else binding=undefined;
  }
  if(!binding){
    const plants=new Set<Resource>();let count=0;for(const plant of world.resources)if(isPlant(plant)){plants.add(plant);count++;}
    // A malformed repeated object has no ordered-Set representation. Keep the
    // ordinary array path, including its duplicate visits, for that caller.
    if(plants.size!==count){ownedBindings.delete(world);bindings.delete(world);return false;}
    binding={owner,source:world.resources,cursor:captureResourceJournal(world.resources),plants,artificial:undefined,roofs:roofArrays(world),coverage:[],width:0,height:0,key:{},pass:0};
    full=true;
  }
  if(verifyTerrainWriteCaches){
    const expected=world.resources.filter(isPlant),actual=binding.plants.values();
    for(const plant of expected)if(actual.next().value!==plant)throw Error('Incremental plant lighting membership differs from a complete capture');
    if(!actual.next().done)throw Error('Incremental plant lighting membership differs from a complete capture');
  }
  const hasLamp=structuresOfKind(world,'sun-lamp').length>0;
  const artificial=hasLamp?(typeof provided==='function'?provided():provided).artificial:undefined,roofs=roofArrays(world);
  const sameDims=binding.width===world.width&&binding.height===world.height;
  let coverage:readonly number[]=binding.coverage;
  if(!sameRoofArrays(binding.roofs,roofs)||full)coverage=roofCoverage(world);
  const sameRegime=previous?.owner===owner&&previous.artificial===artificial&&sameDims&&sameCoverage(previous.coverage,coverage);
  if(!sameRegime){binding.key={};full=true;}
  // A different World can legally share resource objects in reader fixtures.
  // Its pass may have reconciled them under another regime in the meantime.
  if(membershipChanged&&binding.pass!==writingPasses)full=true;
  binding.source=world.resources;binding.cursor=captureResourceJournal(world.resources);
  binding.artificial=artificial;binding.roofs=roofs;binding.coverage=coverage;binding.width=world.width;binding.height=world.height;
  ownedBindings.set(world,binding);
  if(!full&&!appended?.size)return true;
  const key=binding.key,pass=++writingPasses;
  if(verifyTerrainWriteCaches&&!full)for(const plant of binding.plants)if(!appended!.has(plant)){
    const seen=reconciled.get(plant);if(!seen||seen.key!==key||seen.mode!==plant.growthLight)throw Error('Unobserved plant light mutation under a closed membership proof');
  }
  for(const plant of full?binding.plants:appended!){
    const seen=reconciled.get(plant);if(seen?.key===key&&seen.mode===plant.growthLight)continue;
    const cell=plant.z*world.width+plant.x,mode=(artificial?.[cell]??0)>=1?'artificial-full':isRoofed(world,cell)?'dark':undefined;
    reconciled.set(plant,{key,mode});
    if(plant.growthLight===mode)continue;
    checkpointPlantGrowth(world,plant);
    if(mode===undefined)delete plant.growthLight;else plant.growthLight=mode;
  }
  binding.pass=pass;return true;
}

/** The light cache supplies a stable, immutable field. Sky and the temporary
 * roofs Set are deliberately excluded from the invalidation key. Stable calls
 * compare roof primitives but never walk the forest or copy the coverage.
 * Producers replace Resource[] when adding/removing/replacing plant objects. */
export function reconcilePlantLighting(world:World,provided:LightEnvironment|LightReader):void {
  const owner=terrainJournalReadOwner();
  if(owner&&world.schemaVersion>=256&&reconcileOwnedPlantLighting(world,provided,owner))return;
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
  const carriedPlants=regimeKey&&previous!.modes&&previous!.modesPass===writingPasses?previous!.plants:undefined,carriedModes=previous?.modes;
  // One entry pushed per plant, in order.
  const plants=binding.plants,modes:Resource['growthLight'][]=[];
  binding.modes=undefined;const pass=++writingPasses;
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
  Object.assign(binding,{artificial,hasCaptured,constructed,coverage:[...(constructed??[])],width:world.width,height:world.height,roofs,regimeKey297:key,modes:world.schemaVersion>=256?modes:undefined,modesPass:pass});
}
