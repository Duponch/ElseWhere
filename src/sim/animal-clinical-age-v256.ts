import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {applyLiveAnimalBirthday256} from './animal-live-birthday-256.ts';
import {healthRandom} from './health.ts';
import {advanceLocalTrackedAnimalAge379,synchronizeAnimalGrowthMedical256,type AnimalGrowthTracker256} from './animal-growth-runtime-256.ts';
import {animalGrowthFactor} from './animal-life.ts';
import {isAnimalSpecies256} from './animal-core-v256.ts';
import {createMedicalRecord} from './injury-state.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {WildAnimal} from './wildlife-state.ts';
/** Called only by actual local injury/illness producers. Older species retain
 * their original record bytes; no migration adds a clinical birth anchor. */
export function createAnimalMedicalRecord256(world:{tick:number;schemaVersion:number},animal:Pick<WildAnimal,'species'|'ageTicks'>&{growthTracker?:AnimalGrowthTracker256},tick=world.tick):MedicalRecord {
  if(!isAnimalSpecies256(animal.species)&&!animal.growthTracker)return {...createMedicalRecord(tick),body:animal.species};
  const birth=world.tick-animal.ageTicks;
  if(world.schemaVersion<256||!Number.isSafeInteger(birth)||!Number.isSafeInteger(animal.ageTicks)||animal.ageTicks<0||tick>world.tick)throw Error('Invalid animal clinical owner.');
  // A newborn cannot have a clinical interval before its actual birth.
  tick=Math.max(tick,birth);
  return {...createMedicalRecord(tick),body:animal.species,animalBirthTick:birth,...animal.growthTracker?{animalGrowth:animal.growthTracker.value}:{}};
}
/** A living owner's age is at World.tick; a retained body or corpse age stops
 * at the exact clinical death tick. No clock or owner is repaired here. */
export function validAnimalClinicalOwner256(record:MedicalRecord,species:WildAnimal['species'],ageTicks:number,worldTick:number):boolean {
  if(!isAnimalSpecies256(species)&&record.animalGrowth===undefined)return record.animalBirthTick===undefined;
  const clinical=record.tick,civil=record.death?.tick??medicalCivilTick271(record),birth=record.animalBirthTick;
  if(record.body!==species||typeof birth!=='number'||!Number.isSafeInteger(birth)||!Number.isSafeInteger(ageTicks)||ageTicks<0||!Number.isSafeInteger(clinical)||!Number.isSafeInteger(civil)||civil>worldTick)return false;
  const ageAtClinical=record.death?ageTicks:ageTicks-(worldTick-civil);
  return Number.isSafeInteger(ageAtClinical)&&ageAtClinical>=0&&clinical-birth===ageAtClinical;
}

/** New species age at the start of the local step, before traps/fire/combat. */
export function advanceAnimalAges256(world:{schemaVersion:number;tick:number;rng:number;wildlife?:{animals:WildAnimal[]}}):void {
  if(world.schemaVersion<256)return;
  const draw=()=>healthRandom(world),atCore=world.tick*10;
  for(const animal of world.wildlife?.animals??[]){if(animal.growthTracker){const oldAgeCore=animal.ageTicks*10+(animal.ageCoreRemainder??0);advanceLocalTrackedAnimalAge379(animal,atCore,animalGrowthFactor);
   // The successful living kernel already copied its growth into any clinical
   // header. A terminal age call deliberately skipped the kernel, so retain
   // the local boundary's synchronization for that case.
   if(animal.state==='dead')synchronizeAnimalGrowthMedical256(animal);
   applyLiveAnimalBirthday256(world,animal,oldAgeCore,draw);
  }else if(isAnimalSpecies256(animal.species)&&animal.state!=='dead'&&animal.ageTicks<Number.MAX_SAFE_INTEGER)animal.ageTicks++;}
}
