import type {FloraDefinition} from './biome-flora.ts';
import type {LightSource} from './light-sources.ts';
import type {Resource,World} from './types.ts';
import {resourceArrayDelta,resourceSnapshot,sameResources} from './resource-array-delta.ts';
export const CAVE_PLANT_SPECIES_256=['glowstool','agarilux','bryolux'] as const;
export type CavePlantSpecies256=typeof CAVE_PLANT_SPECIES_256[number];
// Same answer as CAVE_PLANT_SPECIES_256.includes(species) (called for every resource).
export const isCavePlant256=(species:unknown,version=256):species is CavePlantSpecies256=>version>=256&&(species==='glowstool'||species==='agarilux'||species==='bryolux');
/** Original catalogue: resolved scalar facts, original labels and pigments. */
export const CAVE_FLORA_DEFINITIONS_256:Readonly<Record<CavePlantSpecies256,FloraDefinition>>={
 glowstool:{label:'Champignon luisant',kind:'wild-plant',growDays:40,minFertility:.01,sensitivity:.15,harvestMinGrowth:.65,yield:20,product:'raw-fungus',persistent:false,nutrition:.5,hitPoints:100,flammability:1,maxGrowthTemperature:58,coldLeafless:true,lifespanMultiplier:8},
 agarilux:{label:'Agarilux',kind:'wild-plant',growDays:60,minFertility:.01,sensitivity:.15,harvestMinGrowth:.65,yield:35,product:'raw-fungus',persistent:false,nutrition:.75,hitPoints:150,flammability:1,maxGrowthTemperature:58,coldLeafless:true,lifespanMultiplier:8},
 bryolux:{label:'Bryolux',kind:'wild-plant',growDays:60,minFertility:.01,sensitivity:.15,harvestMinGrowth:.65,yield:0,product:null,persistent:false,nutrition:.3,hitPoints:100,flammability:1,maxGrowthTemperature:58,coldLeafless:true,lifespanMultiplier:8},
};
export const CAVE_PLANT_FACTS_256={glowstool:{pathCost:14,beauty:2,dieIfLeafless:true,radius:5.9,red:10,green:50,blue:64},agarilux:{pathCost:30,beauty:4,dieIfLeafless:false,radius:10,red:23,green:15,blue:30},bryolux:{pathCost:30,beauty:1,dieIfLeafless:true,radius:10,red:5,green:5,blue:25}} as const;
/** Only sunlight/artificial light excluding ALL cave glowers is supplied.
 * Ordinary darkness never harms these plants. Same2000Core individual phase. */
export function caveLightDamage256(glowWithoutCaves:number,elapsedCore=2000):number {
 if(!Number.isFinite(glowWithoutCaves)||glowWithoutCaves<0||glowWithoutCaves>1||!Number.isSafeInteger(elapsedCore)||elapsedCore<0)throw Error('Invalid real cave exposure');
 const low=Math.fround(.0001),high=Math.fround(.001),rate=Math.fround(low+Math.fround(Math.fround(high-low)*glowWithoutCaves));
 return glowWithoutCaves>0?Math.ceil(Math.fround(rate*elapsedCore)):0;
}
interface CaveLightBinding {width:number;snapshot:readonly Resource[];plants:readonly Resource[];sources:readonly LightSource[]}
const lightBindings=new WeakMap<Resource[],CaveLightBinding>();
let lastBound:{list:Resource[];binding:CaveLightBinding}|undefined;
const CAVE_DELTA_LIMIT=256;
/** The cave plants of `list` in array order, from the last bound array when
 * resources were only removed or appended (resourceArrayDelta) and that array
 * still holds the elements it was bound with: a resource's species never changes, so this is the
 * scan's answer. Undefined: scan. */
function derivedCavePlants(list:Resource[]):Resource[]|undefined {
 const last=lastBound;if(!last||last.list===list||!sameResources(last.list,last.binding.snapshot))return undefined;
 const delta=resourceArrayDelta(last.list,list,CAVE_DELTA_LIMIT);if(!delta)return undefined;
 const removed=delta.removed.filter(r=>isCavePlant256(r.species)),plants:Resource[]=[];let k=0;
 for(const r of last.binding.plants){if(k<removed.length&&r===removed[k]){k++;continue;}plants.push(r);}
 if(k!==removed.length)return undefined;
 for(let t=delta.appendedFrom;t<list.length;t++){const r=list[t]!;if(isCavePlant256(r.species))plants.push(r);}
 return plants;
}
/** Producers replace Resource[] after add/remove/replant. Read only after
 * adoption/step; there is no frame scan or per-plant light object. */
export function caveLightSources256(world:Pick<World,'schemaVersion'|'resources'|'width'>):readonly LightSource[] {
 if(world.schemaVersion<256)return [];
 let binding=lightBindings.get(world.resources);if(binding&&binding.width===world.width)return binding.sources;
 const list=world.resources,plants=(lastBound?.binding.width===world.width?derivedCavePlants(list):undefined)??list.filter(r=>isCavePlant256(r.species,world.schemaVersion));
 const sources:LightSource[]=[];for(const r of plants){
  const d=CAVE_PLANT_FACTS_256[r.species as CavePlantSpecies256];sources.push({cell:r.z*world.width+r.x,radius:d.radius,red:d.red,green:d.green,blue:d.blue});
 }sources.sort((a,b)=>a.cell-b.cell);binding={width:world.width,snapshot:resourceSnapshot(list),plants,sources};lightBindings.set(list,binding);lastBound={list,binding};return sources;
}
