import type {Resource} from './types.ts';

/** Core Plants_Special.xml. DeadPlant has no growth, no dying from age or
 * leaflessness, and does not contribute to WildPlantSpawner's live counts. */
export const DEAD_STUMP_SPECIES_382=['burned-stump','chopped-stump','smashed-stump'] as const;
export type DeadStumpSpecies382=typeof DEAD_STUMP_SPECIES_382[number];
export const DEAD_STUMP_FACTS_382:Readonly<Record<DeadStumpSpecies382,{defId:string;label:string;beauty:number;flammability:number;deterioration:number;workCore:number}>>=Object.freeze({
 'burned-stump':{defId:'BurnedTree',label:'Souche calcinée',beauty:-8,flammability:0,deterioration:4,workCore:180},
 'chopped-stump':{defId:'ChoppedStump',label:'Souche coupée',beauty:0,flammability:0,deterioration:20,workCore:90},
 'smashed-stump':{defId:'SmashedStump',label:'Souche brisée',beauty:-8,flammability:0,deterioration:4,workCore:180},
});
export const isDeadStump382=(species:unknown):species is DeadStumpSpecies382=>species==='burned-stump'||species==='chopped-stump'||species==='smashed-stump';
export const isSpecialPlantSpecies382=(species:unknown):boolean=>species==='ambrosia'||isDeadStump382(species);
export const isDeadStumpResource382=(resource:Pick<Resource,'species'>):boolean=>isDeadStump382(resource.species);

