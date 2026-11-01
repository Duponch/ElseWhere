import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {FLORA_DEFINITIONS} from './biome-flora.ts';
import {isCropKindInVersion,type CropKind} from './crops.ts';
import {localBiomeRules256,PROSPECTIVE_BIOME_PLANT_BINDINGS_256} from './local-biome-rules-v256.ts';
import {PLANT_DEFINITIONS} from './plants.ts';
import type {World} from './types.ts';

export const FORESTRY_SPECIES_291=['oak','poplar','pine','birch','saguaro','drago','bamboo','cecropia','cypress','maple','palm','teak','willow'] as const;
export type ForestrySpecies291=typeof FORESTRY_SPECIES_291[number];
export type GrowingPlant291=CropKind|ForestrySpecies291;
export const TREE_SOWING_COST_291=1_000_000_000;
export const isForestrySpecies291=(value:unknown):value is ForestrySpecies291=>typeof value==='string'&&(FORESTRY_SPECIES_291 as readonly string[]).includes(value);
export const isGrowingPlantInVersion291=(value:unknown,version:number):value is GrowingPlant291=>Number.isSafeInteger(version)&&version<=300&&(isCropKindInVersion(value,version)||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))))&&isForestrySpecies291(value));
export const treeSowingUnlocked291=(world:Pick<World,'schemaVersion'|'research'>):boolean=>(Number(world.schemaVersion)===291||(Number(world.schemaVersion)===292||(Number(world.schemaVersion)===293||(Number(world.schemaVersion)===294||(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))))))&&world.research?.treeSowing291?.completedAt!==undefined;
/** Potential indigenous flora, never the set of trees physically on the map. */
export function forestNativeSpecies291(world:Pick<World,'schemaVersion'|'site'>):readonly ForestrySpecies291[]{
 if((Number(world.schemaVersion)!==291&&(Number(world.schemaVersion)!==292&&(Number(world.schemaVersion)!==293&&(Number(world.schemaVersion)!==294&&(Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion)))))))))return [];
 const rules=localBiomeRules256(world.site?.biome,world.schemaVersion);if(!rules)return [];
 const bindings:Readonly<Record<string,string|undefined>>=PROSPECTIVE_BIOME_PLANT_BINDINGS_256,native=new Set<string>();for(const row of rules.wildPlants){const species=bindings[row.defId];if(row.commonality>0&&species)native.add(species);}
 return FORESTRY_SPECIES_291.filter(species=>native.has(species));
}
export const forestSowingChoices291=(world:Pick<World,'schemaVersion'|'site'|'research'>):readonly ForestrySpecies291[]=>treeSowingUnlocked291(world)?forestNativeSpecies291(world):[];
export const growingPlantLabel291=(plant:GrowingPlant291):string=>isForestrySpecies291(plant)?FLORA_DEFINITIONS[plant].label:PLANT_DEFINITIONS[plant].label;
export const growingPlantMinFertility291=(plant:GrowingPlant291):number=>isForestrySpecies291(plant)?FLORA_DEFINITIONS[plant].minFertility:PLANT_DEFINITIONS[plant].minFertility;
/** Local work units: ten Core ticks each; speed/light remain runtime inputs. */
export const growingPlantSowTicks291=(plant:GrowingPlant291):number=>isForestrySpecies291(plant)?400:plant==='healroot'?80:17;
export const growingPlantSowSkill291=(plant:GrowingPlant291):number=>isForestrySpecies291(plant)?6:plant==='healroot'?8:plant==='hops'?3:0;
