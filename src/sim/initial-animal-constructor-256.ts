import {constructAnimalMind256} from './animal-condition-mental-state-256.ts';
import {attachActualAnimalGrowth256} from './animal-growth-runtime-256.ts';
/** Original no-DLC initial wild-owner constructor. The caller owns its actual
 * private new-map generation transaction, identities and step RNG. Nothing is
 * appended to the map on a blocked branch; no retry heals a chosen old injury. */
import {drawInitialAnimalAge256,initialAnimalGrowth256,initialAnimalStage256,drawInitialAnimalClinicalFrontier256,type InitialAnimalRandom256} from './initial-animal-age-256.ts';
import type {InitialAnimalFact256} from './initial-animal-data-256.ts';
import {initializeAnimalEggLayer256} from './animal-egg-local-v256.ts';
import {isAnimalSpecies256} from './animal-core-v256.ts';
import {animalMechanicalReadiness256} from './animal-readiness-v256.ts';
import type {WildAnimal} from './wildlife-state.ts';
export type InitialGeneratedAnimal256=WildAnimal&{ageCoreRemainder:number};
export type InitialAnimalConstruction256=
 |{status:'ready';animal:InitialGeneratedAnimal256;ageCoreTicks:number;ageSamples:number;growth:number;nextGrowthCheckCore:number}
 |{status:'blocked';reason:string;branch?:string;giver?:string;year?:number;ageCoreTicks?:number;scarCount?:number;partIndex?:number};
export interface InitialWildAnimalInput256 {fact:InitialAnimalFact256;id:number;cell:{x:number;z:number};tick:number;random:InitialAnimalRandom256;unspawnedAnimals:readonly WildAnimal[];
 /** A requested sex (schema 305 farm animals) replaces the random draw. */
 forcedSex?:'male'|'female'}
/** Historical caller contract is preserved. New WorldPawns generation calls
 * the fresh branch only AFTER its true redress transaction consumed Chance. */
export function constructInitialWildAnimal256(input:InitialWildAnimalInput256):InitialAnimalConstruction256 {
 const {id,tick}=input;if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(tick)||tick<0||!Number.isSafeInteger(tick+1)||!Number.isSafeInteger(tick*10+240))throw Error('Invalid initial animal owner frontier');
 if(isAnimalSpecies256(input.fact.species)&&!animalMechanicalReadiness256(input.fact.species).ok)return {status:'blocked',reason:'Real selected species has an unsupported mechanic'};
 if(input.unspawnedAnimals.some(a=>a.species===input.fact.species))return {status:'blocked',reason:'actual retained animal may require WorldPawn redress'};
 input.random.value();return constructFreshInitialWildAnimal256(input);
}
export function constructFreshInitialWildAnimal256(input:Omit<InitialWildAnimalInput256,'unspawnedAnimals'>):InitialAnimalConstruction256 {
 const {fact,id,cell,tick,random}=input;
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(tick)||tick<0||!Number.isSafeInteger(tick+1)||!Number.isSafeInteger(tick*10+240))throw Error('Invalid initial animal owner frontier');
 if(isAnimalSpecies256(fact.species)&&!animalMechanicalReadiness256(fact.species).ok)return {status:'blocked',reason:'Real selected species has an unsupported mechanic'};
 // Thing ID is already reserved by the private caller at MakeThing. Installed
 // animal startingHP is1..1; AttachBase/milk/shear/egg PostMake add no draw.
 // Need(Pawn) invokes the virtual initializer; AddNeed then invokes it
 // again for that SAME need. Native enumeration is Food before Rest, so
 // both Food calls precede both Rest calls, before gender and biological age.
 random.float(.5,.9);random.float(.5,.9);
 if(fact.needsRest){random.float(.9,1);random.float(.9,1);}
 let sex:WildAnimal['sex'];
 const forced=fact.fixedGender??(fact.forceGender==='None'?null:fact.forceGender);
 if(forced==='Male')sex='male';else if(forced==='Female')sex='female';else if(fact.hasGenders)sex=input.forcedSex??(random.value()<.5?'male':'female');else return {status:'blocked',reason:'genderless owner is not represented'};
 const age=drawInitialAnimalAge256(fact,random);
 // All46 Core wild kinds have cryptosleepCommonality0 and no chronological
 // range: the direct comparison nevertheless consumes a Value, unlike Chance0.
 if(fact.backstoryCryptosleepCommonality!==0)return {status:'blocked',reason:'nonzero cryptosleep branch is not represented',ageCoreTicks:age.ageCoreTicks};
 random.value();
 random.integer(20,41); // ResetAgeReversalDemand(Initial), even without DLC.
 // SetInitialLevels repeats Food then Rest, after the actual age was selected.
 const foodPercentage=random.float(.5,.9),rest=fact.needsRest?random.float(.9,1):1;
 const f=Math.fround,stage=initialAnimalStage256(fact,age.ageCoreTicks),foodMax=f(f(f(stage.bodySizeFactor)*f(fact.baseBodySize))*f(stage.foodMaxFactor));
 const animal:InitialGeneratedAnimal256={id,species:fact.species,sex,x:cell.x,z:cell.z,
  ageTicks:Math.floor(age.ageCoreTicks/10),ageCoreRemainder:age.ageCoreTicks%10,
  food:f(foodPercentage*foodMax),rest,state:'idle',path:[],nextDecision:tick+1,
  // Pawn_HealthTracker initializes this from Humanlike, false for animals.
  caravanCarrySick:false};
 attachActualAnimalGrowth256(animal,{value:initialAnimalGrowth256(fact,age.ageCoreTicks),nextCheckCore:tick*10+240},256);
 constructAnimalMind256(animal,256);
 const clinical=drawInitialAnimalClinicalFrontier256(fact,age.ageCoreTicks,random,tick,animal);
 if(clinical.status==='blocked')return {status:'blocked',reason:clinical.reason??'selected clinical generation branch is not represented',branch:clinical.branch,...(clinical.defId?{giver:clinical.defId}:{}),...(clinical.year===undefined?{}:{year:clinical.year}),...(clinical.scarCount===undefined?{}:{scarCount:clinical.scarCount}),...(clinical.partIndex===undefined?{}:{partIndex:clinical.partIndex}),ageCoreTicks:age.ageCoreTicks};
 // PawnTechHediffsMoney0..0 has no draw; noDLC animals have no apparel,
 // weapons, inventoryOptions, invNutrition or generated addictions. The
 // combat-drug guard is a direct Value>=0 and DOES consume one final draw.
 random.value();

 if(clinical.status==='represented-injured')animal.health=clinical.health;
 initializeAnimalEggLayer256(animal);
 return {status:'ready',animal,ageCoreTicks:age.ageCoreTicks,ageSamples:age.ageSamples,growth:initialAnimalGrowth256(fact,age.ageCoreTicks),nextGrowthCheckCore:tick*10+240};
}
