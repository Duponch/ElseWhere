import {pileById} from './pile-identity-directory.ts';
import {validAnimalGrowthTracker256,validAnimalGrowthClinicalOwner256,trackedAnimalLifeStage256} from './animal-growth-runtime-256.ts';
import {animalStageAgeTicks256} from './animal-core-v256.ts';
import type {MiniTurretBombWave} from './bomb-state.ts';
import type {World} from './types.ts';
export type ExplosiveAnimal256='boomalope'|'boomrat';
export const isExplosiveAnimal256=(species:unknown):species is ExplosiveAnimal256=>species==='boomalope'||species==='boomrat';
export interface AnimalDeathExplosion256 {species:ExplosiveAnimal256;lifeStage:'baby'|'juvenile'|'adult';deathTick:number;deathAtCore297?:number}
export const animalDeathExplosionRadius256=(proof:AnimalDeathExplosion256):number=>proof.species==='boomrat'||proof.lifeStage==='baby'?1.9:proof.lifeStage==='juvenile'?2.9:4.9;
/** Historical source can retire, but cannot become an unrelated current
 * identity. A retained body/pile must attest the exact clinical death. */
export function validAnimalDeathExplosionOwner256(world:World,wave:MiniTurretBombWave):boolean {
 const proof=wave.animalDeath;if(!proof)return true;
 const animal=(Array.isArray(world.wildlife?.animals)?world.wildlife.animals:[]).find(a=>a&&a.id===wave.sourceId),pile=pileById(world,wave.sourceId);
 const body=animal?animal.state==='dead'?animal:undefined:pile?.corpse;
 if(animal&&!body||pile&&!pile.corpse)return false;
 if(!body)return ![...world.pawns,...world.structures,...world.jobs,...world.resources,...world.packed.map(p=>p.building),...(world.mechanoids??[])].some(o=>o.id===wave.sourceId);
 const record=body.health,age=body.ageTicks;
 if(body.species!==proof.species||!record?.death||record.death.tick!==proof.deathTick||record.body!==proof.species||!Number.isSafeInteger(age)||age<0||!Number.isSafeInteger(record.animalBirthTick)||record.tick-record.animalBirthTick! !== age)return false;
 if(!validAnimalGrowthTracker256(body,world.schemaVersion,record.death.tick)||!validAnimalGrowthClinicalOwner256(body,world.schemaVersion))return false;
 const stage=body.growthTracker?({AnimalAdult:'adult',AnimalBaby:'baby',AnimalBabyTiny:'baby',AnimalJuvenile:'juvenile',EusocialInsectLarva:'baby',EusocialInsectJuvenile:'juvenile',EusocialInsectAdult:'adult'} as const)[trackedAnimalLifeStage256(body.species,body.growthTracker).definition]:age>=animalStageAgeTicks256(proof.species,'adult')?'adult':age>=animalStageAgeTicks256(proof.species,'juvenile')?'juvenile':'baby';
 return stage===proof.lifeStage;
}
