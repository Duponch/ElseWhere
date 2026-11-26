import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Prospective biological owner, not a phase derived from id/tick or a cache.
 * Definition facts are immutable; the only mutable state is on the original. */
import {constructAnimalMind256} from './animal-condition-mental-state-256.ts';
import {INITIAL_ANIMAL_FACTS_256,type InitialAnimalFact256} from './initial-animal-data-256.ts';
import {CORE_ANIMAL_DATA_256,CORE_ANIMAL_LIFE_STAGES_256} from './animal-core-data-v256.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {WildAnimal} from './wildlife-state.ts';
export interface AnimalGrowthTracker256 {revision:1;value:number;nextCheckCore:number|null}
export type GrowthAnimal256=Pick<WildAnimal,'species'|'ageTicks'|'ageCoreRemainder'|'state'>&{growthTracker?:AnimalGrowthTracker256};
const f=Math.fround,year=3600000;
const facts=new Map<string,InitialAnimalFact256>(Object.values(INITIAL_ANIMAL_FACTS_256).map(row=>[row.species,row]));
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
// The descriptor is already detached from its owner by the native lookup;
// allocating an additional value-only record for every clinical field is redundant.
function data(v:object,k:string){const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')&&d.enumerable===true?d:undefined;}
/** Original data only. Optional ownerTick is the TRUE local/caravan/held or
 * terminal clock; do not replace it by the selected map's current clock. */
export function validAnimalGrowthTracker256(value:unknown,version:number,ownerTick?:number):boolean {
 if(!value||typeof value!=='object')return false;
 const d=Object.getOwnPropertyDescriptor(value,'growthTracker');if(!d)return !('growthTracker'in value);
 const g=Object.hasOwn(d,'value')&&d.enumerable===true?d:undefined,species=data(value,'species'),age=data(value,'ageTicks'),remainder=data(value,'ageCoreRemainder');
 if(version<256||!g||!object(g.value)||Reflect.ownKeys(g.value).length!==3||!species||!facts.has(species.value)||!age||!Number.isSafeInteger(age.value)||age.value<0||!remainder||!Number.isInteger(remainder.value)||remainder.value<0||remainder.value>9||!Number.isSafeInteger(age.value*10+remainder.value))return false;
 const revision=data(g.value,'revision'),growth=data(g.value,'value'),next=data(g.value,'nextCheckCore');
 if(revision?.value!==1||!growth||typeof growth.value!=='number'||!Number.isFinite(growth.value)||f(growth.value)!==growth.value||growth.value<0||growth.value>1||!next)return false;
 const food=Object.getOwnPropertyDescriptor(value,'food');if(food&&(!Object.hasOwn(food,'value')||!food.enumerable||typeof food.value!=='number'||!Number.isFinite(food.value)||food.value<0||food.value>trackedAnimalNutritionMaximum256(species.value,{value:growth.value})))return false;
 if(next.value===null)return growth.value===1;
 if(!Number.isSafeInteger(next.value)||next.value<0)return false;
 return ownerTick===undefined||Number.isSafeInteger(ownerTick)&&ownerTick>=0&&Number.isSafeInteger(ownerTick*10+240)&&next.value<=ownerTick*10+240;
}
/** Core MaxNutrition is1 for the seven original species too; the same body
 * and stage facts already feed the actual initial constructor. */
export function trackedAnimalNutritionMaximum256(species:WildAnimal['species'],tracker:Pick<AnimalGrowthTracker256,'value'>):number {
 const profile=growthProfile256(species,'Missing actual nutrition species');return profile.nutrition[stageIndex256(profile,tracker.value)]!;
}
export function trackedAnimalBodySize256(species:WildAnimal['species'],tracker:Pick<AnimalGrowthTracker256,'value'>):number {
 const profile=growthProfile256(species,'Missing actual body-size species');return profile.bodySize[stageIndex256(profile,tracker.value)]!;
}
/** The life-stage property reads persisted growth, including the same float
 * interpolation and epsilon as Core; it NEVER reconstructs growth from age. */
function trackedLifeStageData256(species:WildAnimal['species'],fact:NonNullable<ReturnType<typeof facts.get>>,index:number){
 const explicit=Object.hasOwn(CORE_ANIMAL_DATA_256,species)?CORE_ANIMAL_DATA_256[species as keyof typeof CORE_ANIMAL_DATA_256].lifeStages[index]!.defId:undefined;
 const definition=explicit??(index===fact.stages.length-1?'AnimalAdult':index===0?'AnimalBaby':'AnimalJuvenile');
 return Object.freeze({definition,index,minimumAgeTicks:Math.round(fact.stages[index]!.minAgeYears*year/10),...CORE_ANIMAL_LIFE_STAGES_256[definition]});
}
/** Compile immutable species facts once. These are the native definition
 * constants, never a cache of the mutable animal or the growth deadline.
 * Each caller still uses the real persisted growth value; all Math.fround
 * boundaries and stage-order comparisons stay precisely where they were. */
interface GrowthProfile256 {readonly adultYears:number;readonly adultTicks:number;readonly stages:readonly ReturnType<typeof trackedLifeStageData256>[];readonly thresholds:Float32Array;readonly nutrition:Float32Array;readonly bodySize:Float32Array}
const growthProfiles256=new Map<WildAnimal['species'],GrowthProfile256>(),GROWTH_EPSILON256=f(.000001);
function growthProfile256(species:WildAnimal['species'],error:string):GrowthProfile256 {
 let profile=growthProfiles256.get(species);if(profile)return profile;
 const fact=facts.get(species);if(!fact)throw Error(error);
 const adultYears=f(fact.stages.at(-1)!.minAgeYears),adultTicks=Math.max(Math.floor(f(adultYears*year)),1),stages=fact.stages.map((_,i)=>trackedLifeStageData256(species,fact,i));
 const max=Object.hasOwn(CORE_ANIMAL_DATA_256,species)?CORE_ANIMAL_DATA_256[species as keyof typeof CORE_ANIMAL_DATA_256].stats.MaxNutrition:1;
 const bodySize=Float32Array.from(stages,stage=>f(f(fact.baseBodySize)*f(stage.bodySizeFactor)));
 profile={adultYears,adultTicks,stages,thresholds:Float32Array.from(fact.stages,s=>s.minAgeYears),nutrition:Float32Array.from(stages,(stage,i)=>f(f(f(max)*bodySize[i]!)*f(stage.foodMaxFactor))),bodySize};
 growthProfiles256.set(species,profile);return profile;
}
function stageIndex256(profile:GrowthProfile256,growth:number):number {
 const boundary=f(f(profile.adultYears*growth)+GROWTH_EPSILON256),thresholds=profile.thresholds;
 for(let i=thresholds.length-1;i>=0;i--)if(thresholds[i]!<=boundary)return i;
 return 0;
}
export function trackedAnimalLifeStage256(species:WildAnimal['species'],tracker:Pick<AnimalGrowthTracker256,'value'>){
 const profile=growthProfile256(species,'Missing actual growth species');return profile.stages[stageIndex256(profile,tracker.value)]!;
}
export function synchronizeAnimalGrowthMedical256(a:GrowthAnimal256&{health?:{animalGrowth?:number}}):void {
 if(a.growthTracker&&a.health)a.health.animalGrowth=a.growthTracker.value;
}
export function validAnimalGrowthMedicalHeader256(value:unknown,version:number,animal:boolean):boolean {
 if(!value||typeof value!=='object')return false;const d=Object.getOwnPropertyDescriptor(value,'animalGrowth');if(!d)return !('animalGrowth'in value);
 return version>=256&&animal&&Object.hasOwn(d,'value')&&d.enumerable===true&&typeof d.value==='number'&&Number.isFinite(d.value)&&f(d.value)===d.value&&d.value>=0&&d.value<=1;
}
/** Header equality is checked at the real OWNER boundary, not inferred from
 * a species, a purported medical clock, or another actor with the same id. */
export function validAnimalGrowthClinicalOwner256(value:unknown,version:number):boolean {
 if(!value||typeof value!=='object')return false;
 const g=data(value,'growthTracker'),h=Object.getOwnPropertyDescriptor(value,'health');if(!h)return true;
 if(!Object.hasOwn(h,'value')||!h.enumerable)return false;if(h.value===undefined)return true;
 if(!object(h.value)||!validAnimalGrowthMedicalHeader256(h.value,version,true))return false;
 const witness=data(h.value,'animalGrowth');return g&&object(g.value)?!!witness&&witness.value===g.value.value:!Object.hasOwn(h.value,'animalGrowth');
}
/** Creation operation only. Constructor outputs are forwarded verbatim,
 * including an adult's still-finite FIRST deadline. No migration calls this. */
export function attachActualAnimalGrowth256(a:GrowthAnimal256,initial:{value:number;nextCheckCore:number},version:number):void {
 if(!isSchema256Or257(version)||Object.hasOwn(a,'growthTracker'))throw Error('Growth creation requires a new prospective original');
 const trial={...a,ageCoreRemainder:a.ageCoreRemainder??0,growthTracker:{revision:1 as const,value:initial.value,nextCheckCore:initial.nextCheckCore}};
 if(!validAnimalGrowthTracker256(trial,version))throw Error('Invalid actual constructor growth');
 a.ageCoreRemainder=trial.ageCoreRemainder;a.growthTracker=trial.growthTracker;
 synchronizeAnimalGrowthMedical256(a);
}
export function attachNewbornAnimalGrowth256(a:GrowthAnimal256,atCore:number,version:number):void {
 if(a.ageTicks!==0||a.ageCoreRemainder!==undefined&&a.ageCoreRemainder!==0||!Number.isSafeInteger(atCore)||atCore<0||!Number.isSafeInteger(atCore+240))throw Error('Invalid actual newborn growth frontier');
 attachActualAnimalGrowth256(a,{value:0,nextCheckCore:atCore+240},version);constructAnimalMind256(a,version);
}
export function attachGeneratedAnimalGrowth256(a:GrowthAnimal256,atCore:number,version:number):void {
 const fact=facts.get(a.species),age=a.ageTicks*10+(a.ageCoreRemainder??0);
 if(!fact||!Number.isSafeInteger(age)||age<0||!Number.isSafeInteger(atCore)||atCore<0||!Number.isSafeInteger(atCore+240))throw Error('Invalid actual generated growth frontier');
 // Same closed float formula as initialAnimalGrowth256; no import of the
 // clinical generator here (it itself needs these stage readers).
 const years=f(f(age)/year),growth=Math.max(0,Math.min(1,f(years/f(fact.stages.at(-1)!.minAgeYears))));
 attachActualAnimalGrowth256(a,{value:growth,nextCheckCore:atCore+240},version);constructAnimalMind256(a,version);
}
/** One REAL age call. Suspension and death do not rewrite age/deadline. A
 * resumed overdue tracker performs only ONE growth240 call, never catch-up.
 * Hunger multiplier is supplied by the existing true Food category reader. */
export function advanceTrackedAnimalAge256(a:GrowthAnimal256,input:{atCore:number;deltaCore:number;hungerMultiplier:number;suspended:boolean}):boolean {
 const g=a.growthTracker;if(!g)return false;
 if(!validAnimalGrowthTracker256(a,256)||!validAnimalGrowthClinicalOwner256(a,256)||!Number.isSafeInteger(input.atCore)||input.atCore<0||!Number.isSafeInteger(input.deltaCore)||input.deltaCore<0||input.deltaCore>input.atCore||!Number.isFinite(input.hungerMultiplier)||input.hungerMultiplier<0||input.hungerMultiplier>1||typeof input.suspended!=='boolean')throw Error('Invalid actual animal age call');
 return advanceValidatedAge256(a,g,input.atCore,input.deltaCore,input.hungerMultiplier,input.suspended);
}
function advanceValidatedAge256(a:GrowthAnimal256,g:AnimalGrowthTracker256,atCore:number,deltaCore:number,hungerMultiplier:number,suspended:boolean):true {
 if(a.state==='dead'||suspended)return true;
 const age=a.ageTicks*10+a.ageCoreRemainder!+deltaCore;if(!Number.isSafeInteger(age))throw Error('Biological animal age exhausted');
 if(g.nextCheckCore!==null&&atCore>=g.nextCheckCore){
  if(g.value>=1)g.nextCheckCore=null;
  else {if(!Number.isSafeInteger(atCore+240))throw Error('Animal growth deadline exhausted');const adultTicks=growthProfile256(a.species,'Missing actual growth species').adultTicks,increment=f(f(f(hungerMultiplier)*240)/f(adultTicks));g.value=Math.min(1,f(g.value+increment));g.nextCheckCore=atCore+240;}
 }
 a.ageTicks=Math.floor(age/10);a.ageCoreRemainder=age%10;synchronizeAnimalGrowthMedical256(a);return true;
}
/** Closed local macro uses the real deadline to choose the pure numerical
 * kernel, postponing the Food-category calculation until its result can be
 * consumed. No age/header/food validation, biological step or birthday is
 * postponed. Mutable/public and verification lanes retain the literal input. */
export function advanceLocalTrackedAnimalAge379(a:WildAnimal,atCore:number,readHungerMultiplier:(animal:WildAnimal)=>number):boolean {
 if(!terrainJournalReadOwner()||verifyTerrainWriteCaches)return advanceTrackedAnimalAge256(a,{atCore,deltaCore:10,hungerMultiplier:readHungerMultiplier(a),suspended:false});
 const g=a.growthTracker;if(!g)return false;
 if(!validAnimalGrowthTracker256(a,256)||!validAnimalGrowthClinicalOwner256(a,256)||!Number.isSafeInteger(atCore)||atCore<10)throw Error('Invalid actual animal age call');
 const needsMultiplier=a.state!=='dead'&&g.value<1&&g.nextCheckCore!==null&&atCore>=g.nextCheckCore;
 const multiplier=needsMultiplier?readHungerMultiplier(a):1;
 if(!Number.isFinite(multiplier)||multiplier<0||multiplier>1)throw Error('Invalid actual animal age call');
 return advanceValidatedAge256(a,g,atCore,10,multiplier,false);
}
