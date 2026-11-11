import {resourceArrayDelta} from './resource-array-delta.ts';
import {STRUCTURE_DEFINITIONS} from './definitions.ts';
import type {PlantSpecies} from './biome-flora.ts';
import type {Job,JobKind,Resource,StructureKind,World} from './types.ts';

/** Resolved Core1.6.4871 harvestWork metadata, not the clone's timed cut work.
 * In particular Grass40Core cannot be inferred from clearingDuration60local. */
const FLORA_WORK:Readonly<Record<PlantSpecies,number>>=Object.freeze({
  glowstool:200,agarilux:200,bryolux:200,
  grass:40,'tall-grass':60,brambles:60,moss:60,'berry-bush':250,
  oak:1400,poplar:800,pine:710,birch:800,agave:300,saguaro:210,drago:660,'healroot-wild':400,
  'alocasia':200,'astragalus':200,'bush':200,'chokevine':150,'clivia':200,'dandelion':200,'pincushion-cactus':200,'rafflesia':200,'low-shrub':60,'bamboo':460,'cecropia':510,'cypress':1800,'maple':800,'palm':510,'teak':1800,'willow':800,
});
const LEGACY_WORK:Readonly<Record<string,number>>=Object.freeze({
  tree:800,berries:250,rice:200,potato:200,corn:200,cotton:200,haygrass:200,healroot:400,
});
export const plantHarvestWorkCore=(resource:Pick<Resource,'kind'|'species'>):number=>
  resource.species===undefined?LEGACY_WORK[resource.kind]??Infinity:FLORA_WORK[resource.species]??Infinity;
export const isConstructionLightPlant=(resource:Pick<Resource,'kind'|'species'>):boolean=>
  resource.kind!=='rock'&&plantHarvestWorkCore(resource)<=200;
/** Existing import retained; all eight current floors have fertility0. */
export const isFloorLightPlant=isConstructionLightPlant;
type LightPlantIndex={length:number;readonly width:number;readonly height:number;readonly counts:Uint32Array;readonly other:Resource[]};
const lightPlantIndexes=new WeakMap<readonly Resource[],LightPlantIndex>();
/* The last indexed resources array: a new array that only drops some of its
 * resources and appends others (resourceArrayDelta) takes over its index,
 * updated by those differences, instead of a full rebuild. The old array then
 * loses its index (rebuilt if it is ever asked again). */
let lastLightPlants:{list:readonly Resource[];index:LightPlantIndex}|undefined;
const LIGHT_PLANT_DELTA_LIMIT=256;
/** Whether a light plant stands on one of the cells: the same answer as
 * scanning `world.resources`, from an index per resources array (a count of
 * light plants per in-map cell, and the others in a list). A running World
 * replaces that array instead of editing it in place (generation pushes
 * change its length, which rebuilds the index), and a resource's kind,
 * species and position never change. */
export function lightPlantOnCells(world:Pick<World,'resources'|'width'|'height'>,cells:readonly {x:number;z:number}[]):boolean {
  const list=world.resources,{width,height}=world,inside=(x:number,z:number)=>Number.isSafeInteger(x)&&Number.isSafeInteger(z)&&x>=0&&z>=0&&x<width&&z<height;
  let index=lightPlantIndexes.get(list);
  if(!index||index.length!==list.length||index.width!==width||index.height!==height){
    const add=(target:LightPlantIndex,r:Resource,step:1|-1)=>{
      if(!isConstructionLightPlant(r))return;
      if(inside(r.x,r.z))target.counts[r.z*width+r.x]!+=step;
      else if(step>0)target.other.push(r);else{const k=target.other.indexOf(r);if(k>=0)target.other.splice(k,1);}
    };
    const last=lastLightPlants,old=last?.index;
    const delta=!index&&last&&old&&old.width===width&&old.height===height&&old.length===last.list.length&&lightPlantIndexes.get(last.list)===old
      ?resourceArrayDelta(last.list,list,LIGHT_PLANT_DELTA_LIMIT):undefined;
    if(delta&&old){
      for(const r of delta.removed)add(old,r,-1);
      for(let k=delta.appendedFrom;k<list.length;k++)add(old,list[k]!,1);
      old.length=list.length;lightPlantIndexes.delete(last!.list);index=old;
    }else{
      index={length:list.length,width,height,counts:new Uint32Array(width*height),other:[]};
      for(const r of list)add(index,r,1);
    }
    lightPlantIndexes.set(list,index);lastLightPlants={list,index};
  }
  const found=index;
  return cells.some(c=>inside(c.x,c.z)&&found.counts[c.z*width+c.x]!>0)||found.other.some(r=>cells.some(c=>c.x===r.x&&c.z===r.z));
}
export function constructionPlantBlocks(job:Job,resource:Resource):boolean {
  // Keep an accepted historical clearance's real elapsed work after migration.
  return job.clearance?.resourceId===resource.id||!isConstructionLightPlant(resource);
}

/** FINAL ENTITY policy only; not the generated Frame or its transition.
 * SpawningWipes also calls BlocksPlanting. Core's SupportsPlants exception is
 * independent of item occupancy, clearBuildingArea and the plant's weight.
 * Current ordinary clone structures derive from an edifice or positive fill;
 * these explicit no-wipe kinds have SupportsPlants or conduit fill0/non-edifice.
 * Validate this catalog before adding future structures. */
const KEEP_PLANTS:ReadonlySet<StructureKind>=new Set([
  'power-conduit','sleeping-spot','animal-sleeping-spot','crafting-spot','butcher-spot',
  'hydroponics-basin','flower-pot',
]);
export const constructionFinalWipesPlants=(kind:JobKind|StructureKind):boolean=>
  kind==='lay-floor'||kind==='build-bridge'||kind in STRUCTURE_DEFINITIONS&&!KEEP_PLANTS.has(kind as StructureKind);

/** The generated Thing Frame has fill0.2 and no copied sowTag. Unlike the
 * final SupportsPlants entity, every physical Thing Frame blocks planting.
 * Terrain Frames have fill0 and categoryEthereal, and never wipe here. */
export const constructionFrameWipesPlants=(kind:JobKind|StructureKind):boolean=>kind in STRUCTURE_DEFINITIONS;

/** Existing strict fraction reused for a paid output refusal, not a new field.
 * An exact historical fraction may be finalized up to0.0001 local unit early. */
export const workOutputPending=(work:Pick<Job,'progress'|'workRemainder'>|undefined,duration:number):boolean=>
  Number.isSafeInteger(duration)&&duration>=1&&work?.progress===duration-1&&work.workRemainder===9999;
export const clearanceOutputPending=(job:Pick<Job,'clearance'>,duration:number):boolean=>
  workOutputPending(job.clearance,duration);

/** A reserved future order is not an executing plant claim. Queried only on
 * work admission, not per animation/render frame. The owner may replace its
 * own current work, while another actor must wait for the existing producer. */
export function plantExecutionReserved(world:World,resourceId:number,pawnId:number):boolean {
  const source=world.resources.find(r=>r.id===resourceId);
  if(!source)return false;
  return world.jobs.some(j=>{
    if(j.status!=='active'||j.reservedBy===null||j.reservedBy===pawnId)return false;
    const id=j.clearance?.resourceId??(j.tree?.kind==='extract'?j.tree.resourceId:undefined)??j.plantTarget?.resourceId;
    const matches=id===resourceId||id===undefined&&j.flowerPotId===undefined&&['cut','chop','harvest'].includes(j.kind)&&j.x===source.x&&j.z===source.z;
    return matches&&world.pawns.some(p=>p.id===j.reservedBy&&p.jobId===j.id);
  });
}
