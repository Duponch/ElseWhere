import {animalLifeStageData256,isAnimalSpecies256} from './animal-core-v256.ts';
import type {WildAnimal} from './wildlife-state.ts';
export const ANIMAL_PRODUCTS_256={"alpaca":{"kind":"shear","item":"alpaca-wool","quantity":45,"days":10,"work":170,"rank":-0.85,"femaleOnly":false},"bison":{"kind":"shear","item":"bison-wool","quantity":120,"days":15,"work":170,"rank":-0.85,"femaleOnly":false},"boomalope":{"kind":"milk","item":"chemfuel","quantity":11,"days":1,"work":40,"rank":-0.9,"femaleOnly":false},"caribou":{"kind":"milk","item":"milk","quantity":10,"days":2,"work":40,"rank":-0.9,"femaleOnly":true},"elk":{"kind":"milk","item":"milk","quantity":11,"days":1,"work":40,"rank":-0.9,"femaleOnly":true},"megasloth":{"kind":"shear","item":"megasloth-wool","quantity":200,"days":20,"work":170,"rank":-0.85,"femaleOnly":false},"yak":{"kind":"milk","item":"milk","quantity":11,"days":1,"work":40,"rank":-0.9,"femaleOnly":true},goat:{kind:'milk',item:'milk',quantity:12,days:3,work:40,rank:-.9,femaleOnly:true}} as const;
export function animalProductDefinition256(a:Pick<WildAnimal,'species'|'ageTicks'|'sex'|'growthTracker'>){
 if(!isAnimalSpecies256(a.species)||!Object.hasOwn(ANIMAL_PRODUCTS_256,a.species))return;
 const def=ANIMAL_PRODUCTS_256[a.species as keyof typeof ANIMAL_PRODUCTS_256],stage=animalLifeStageData256(a.species,a.ageTicks,a.growthTracker?.value);
 if(!(def.kind==='milk'?stage.milkable:stage.shearable)||def.femaleOnly&&a.sex!=='female')return;
 return def;
}
