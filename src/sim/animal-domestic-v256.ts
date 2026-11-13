import {ANIMAL_SPECIES_IDS_256,animalCore256,isAnimalSpecies256} from './animal-core-v256.ts';
import {animalItemDiet256} from './animal-diet-v256.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {ItemId} from './items.ts';
export const PEN_ANIMALS_256=Object.freeze(ANIMAL_SPECIES_IDS_256.filter(id=>animalCore256(id).race.roamMtbDays!==null));
const even=(x:number)=>{const n=Math.floor(x),f=x-n;return f<.5?n:f>.5?n+1:n%2===0?n:n+1;};
export function animalHandlingSkill256(species:WildAnimal['species']):number|undefined {
 if(!isAnimalSpecies256(species))return;
 const w=animalCore256(species).stats.Wildness,points=[[0,0],[.15,1],[.98,10],[.99,14]] as const;
 let value=14;
 for(let i=1;i<points.length;i++)if(w<=points[i]![0]){const a=points[i-1]!,b=points[i]!;value=a[1]+Math.max(0,(w-a[0])/(b[0]-a[0]))*(b[1]-a[1]);break;}
 return even(Math.max(0,Math.min(20,value)));
}
/** Core Wildness of the original wild species (Hare, Snowhare, Deer, Gazelle,
 * Muffalo, Dromedary, Fox_Red, Fox_Fennec), used from schema 315. */
export const LEGACY_WILDNESS315:Readonly<Record<string,number>>=Object.freeze({hare:.75,'snow-hare':.75,deer:.75,gazelle:.75,muffalo:.6,dromedary:.25,'red-fox':.75,'fennec-fox':.75});
export const animalWildness315=(species:WildAnimal['species']):number=>isAnimalSpecies256(species)?animalCore256(species).stats.Wildness:LEGACY_WILDNESS315[species]??.5;
/** Core TameChanceFactorCurve_Wildness (1 -> 0, 0.5 -> 1, 0 -> 2). */
export const tameWildnessFactor315=(species:WildAnimal['species']):number=>Math.max(0,Math.min(2,2*(1-animalWildness315(species))));
/** Core trainability factor LerpDouble(0, 1, 1.5, 0.5, wildness). */
export const trainWildnessFactor315=(species:WildAnimal['species']):number=>Math.max(.5,Math.min(1.5,1.5-animalWildness315(species)));
export const tameWildnessFactor256=(species:WildAnimal['species']):number=>isAnimalSpecies256(species)?Math.max(0,Math.min(2,2*(1-animalCore256(species).stats.Wildness))):1;
/** Only RawBad/RawTasty physical food piles, matching the animal's actual
 * food flags; no meat substitution for a strict carnivore or hay pickup. */
export function animalHandlingFood256(a:WildAnimal,item:ItemId):boolean|undefined {
 if(!isAnimalSpecies256(a.species))return;
 if(item==='hay'||item==='pemmican'||item==='legacy-portion'||item.endsWith('-meal')||item.endsWith('-fertilized'))return false;
 return animalItemDiet256(a,item,false)===true;
}
