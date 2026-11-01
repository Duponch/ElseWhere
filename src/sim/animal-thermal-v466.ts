import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {animalComfyRange256,isAnimalSpecies256} from './animal-core-v256.ts';
import {actualNativeSevenFacts256} from './actual-animal-profile-256.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {nextColdSeverity} from './cold-rules.ts';
import {nextHeatSeverity} from './heat-severity.ts';
import {reconcileMedicalDeath} from './injury-state.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {World} from './types.ts';

export interface AnimalThermalProfile466 {min:number;max:number;cold:boolean}
/** Actual original only: the seven historical species need their existing
 * native-profile witness. Insect cold slowdown is a different hediff. */
export function animalThermalProfile466(a:Pick<WildAnimal,'species'|'growthTracker'>):AnimalThermalProfile466|undefined {
 if(isAnimalSpecies256(a.species)){
  const r=animalComfyRange256(a.species);
  return {min:r.minimum,max:r.maximum,cold:!['megascarab','spelopede','megaspider'].includes(a.species)};
 }
 const r=actualNativeSevenFacts256(a);return r?{min:r.comfyMin,max:r.comfyMax,cold:true}:undefined;
}
/** Current physical-owner admission only. The surrounding owner/medical
 * guards still validate anatomy, growth provenance, clocks and descriptors.
 * In particular an unmarked historical seven or insect cold is not opened. */
export function animalThermalFields466(value:unknown,version:number):{heat:boolean;cold:boolean} {
 if(version!==287&&version!==288&&(version!==289&&(version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))))))))||!value||typeof value!=='object')return {heat:false,cold:false};
 const species=Object.getOwnPropertyDescriptor(value,'species'),growth=Object.getOwnPropertyDescriptor(value,'growthTracker');
 if(!species?.enumerable||!Object.hasOwn(species,'value')||typeof species.value!=='string'||'growthTracker'in value&&(!growth?.enumerable||!Object.hasOwn(growth,'value')))return {heat:false,cold:false};
 const range=animalThermalProfile466(value as Pick<WildAnimal,'species'|'growthTracker'>);
 return {heat:range!==undefined,cold:range?.cold===true};
}
/** Supplied only by the sole local wildlife pass, after its actual hash60
 * opportunity. It is neither a persisted marker nor a medical catch-up dose. */
export interface AnimalThermalOpportunity466 {temperature:number;mapHeld:boolean}

/** One current opportunity on the caller's real/private clinical outcome.
 * Fixed-point severity kernels are the existing local adaptation. Frostbite,
 * air burns and insect cold slowdown remain distinct unrepresented effects. */
export function applyAnimalThermal466(w:Pick<World,'tick'|'schemaVersion'>,a:WildAnimal,record:MedicalRecord|undefined,input:AnimalThermalOpportunity466):MedicalRecord|undefined {
 if(!isSchema287OrLater(Number(w.schemaVersion))||record?.death||a.state==='dead')return record;
 const range=animalThermalProfile466(a);if(!range)return record;
 if(!Number.isFinite(input.temperature)||typeof input.mapHeld!=='boolean')throw Error('Invalid actual local animal thermal opportunity');
 const cold=record?.hypothermia??0,heat=record?.heatstroke??0;
 const nextCold=range.cold?nextColdSeverity(cold,input.temperature,range.min,!input.mapHeld):cold;
 const nextHeat=nextHeatSeverity(heat,input.temperature,range.max);
 if(nextCold===cold&&nextHeat===heat)return record;
 const h=record??createAnimalMedicalRecord256(w,a,w.tick);
 if(medicalCivilTick271(h)!==w.tick)throw Error('Local animal thermal clinical frontier differs from its owner');
 // Core's OrganicStandard orders Hypothermia before Heat. Its death barrier
 // prevents Heat recovery from reviving the same animal killed by cold.
 if(range.cold){if(nextCold)h.hypothermia=nextCold;else delete h.hypothermia;reconcileMedicalDeath(h);if(h.death)return h;}
 if(nextHeat)h.heatstroke=nextHeat;else delete h.heatstroke;
 reconcileMedicalDeath(h);return h;
}
