import {ANIMAL_SPECIES_IDS,isAnimalSpeciesInVersion,type AnimalSpeciesId} from './animal-species.ts';
/** Keep the historical five's original order for old saves/tests. At 382 the
 * Core's controller applies to every admitted owned animal, not only livestock. */
export const LEGACY_AUTO_SLAUGHTER_SPECIES=['hare','deer','gazelle','muffalo','dromedary'] as const;
const legacySpecies=new Set<string>(LEGACY_AUTO_SLAUGHTER_SPECIES);
export const AUTO_SLAUGHTER_SPECIES:readonly AnimalSpeciesId[]=Object.freeze([...LEGACY_AUTO_SLAUGHTER_SPECIES,...ANIMAL_SPECIES_IDS.filter(id=>!legacySpecies.has(id))]);
export type AutoSlaughterSpecies=AnimalSpeciesId;
export const isAutoSlaughterSpecies=(value:unknown,version:number):value is AnimalSpeciesId=>version>=382?isAnimalSpeciesInVersion(value,version):typeof value==='string'&&legacySpecies.has(value);
const rank=new Map(AUTO_SLAUGHTER_SPECIES.map((id,index)=>[id,index]));
export const autoSlaughterOrder=(a:AutoSlaughterSpecies,b:AutoSlaughterSpecies):number=>rank.get(a)!-rank.get(b)!;
export function visibleAutoSlaughterSpecies(w:Pick<import('./types.ts').World,'schemaVersion'|'wildlife'|'autoSlaughter'>):readonly AutoSlaughterSpecies[]{
 if(w.schemaVersion<382)return LEGACY_AUTO_SLAUGHTER_SPECIES;
 const entries=new Set<AutoSlaughterSpecies>(LEGACY_AUTO_SLAUGHTER_SPECIES);
 for(const animal of w.wildlife?.animals??[])if(animal.domestic&&animal.state!=='dead')entries.add(animal.species);
 for(const config of w.autoSlaughter??[])entries.add(config.species);
 return [...entries].sort(autoSlaughterOrder);
}
export interface AutoSlaughterConfig {
  species:AutoSlaughterSpecies;
  maxTotal:number;
  maxMales:number;
  maxMalesYoung:number;
  maxFemales:number;
  maxFemalesYoung:number;
  allowPregnant:boolean;
  allowBonded382?:true;
}
export type AutoSlaughterCommand={type:'auto-slaughter-policy';config:AutoSlaughterConfig};
export function defaultAutoSlaughterConfig(species:AutoSlaughterSpecies):AutoSlaughterConfig {
  return {species,maxTotal:-1,maxMales:-1,maxMalesYoung:-1,maxFemales:-1,maxFemalesYoung:-1,allowPregnant:false};
}
