import {adultAgeTicks,juvenileAgeTicks} from '../sim/animal-life';
import {trackedAnimalLifeStage256} from '../sim/animal-growth-runtime-256';
import type {AnimalSpeciesId} from '../sim/animal-species';

/** Core 1.6 draws each life stage with its own `bodyGraphicData.drawSize`
 * (PawnKindDef lifeStages: baby, juvenile, adult). The drawn size is not the
 * life-stage body size factor (0.1 or 0.2 for a baby, 0.5 for a juvenile):
 * a muffalo calf is drawn at 1.5 against 3 for the adult, half its size, not a
 * fifth. Numbers only (no texture or text). Presentation only: body size,
 * nutrition and every rule keep reading `bodySizeAtAge`. */
const CORE_STAGE_DRAW_SIZES:Readonly<Record<AnimalSpeciesId,readonly [number,number,number]>>=Object.freeze({
 'alpaca':[1.3,1.9,2.2],'arctic-fox':[1,1.2,1.75],'arctic-wolf':[1.05,1.5,1.95],'bison':[1.5,2.25,3],'boomalope':[1,1.6,2.2],'boomrat':[0.8,1,1.15],
 'capybara':[1,1.25,1.5],'caribou':[1.9,2.8,3.5],'cassowary':[1.1,1.4,1.8],'cat':[0.6,0.8,1],'chinchilla':[0.5,0.75,0.85],'cobra':[1,1.25,1.5],
 'cougar':[1.1,1.4,2.18],'deer':[1.375,1.875,2.25],'donkey':[1.3,1.6,1.9],'dromedary':[1.5,2.25,3],'duck':[0.45,0.75,0.87],'elephant':[1.8,2.6,3.8],
 'elk':[1.5,2.3,3.1],'emu':[1,1.3,1.6],'fennec-fox':[0.9,1.2,1.45],'gazelle':[1,1.3,1.65],'grizzly-bear':[1.4,2,2.7],'guinea-pig':[0.5,0.75,1],
 'hare':[1,1.25,1.5],'horse':[1.3,1.8,2.1],'husky':[1,1.5,1.75],'ibex':[1,1.3,1.8],'iguana':[1,1.25,1.5],'labrador-retriever':[0.95,1.35,1.6],
 'lynx':[1.1,1.4,1.6],'megascarab':[1,1.25,1.5],'megasloth':[1.8,2.6,3.8],'megaspider':[1.2,1.6,2.5],'monkey':[1.25,1.5,1.75],'muffalo':[1.5,2.25,3],
 'ostrich':[1.1,1.4,1.8],'panther':[1.05,1.35,2.12],'polar-bear':[1.4,2,2.7],'raccoon':[1.1,1.3,1.6],'rat':[1,1.1,1.25],'red-fox':[1,1.2,1.68],
 'rhinoceros':[1.5,2.25,3],'snow-hare':[1,1.25,1.5],'spelopede':[1,1.25,1.65],'squirrel':[1,1.25,1.5],'timber-wolf':[1.05,1.5,1.95],'tortoise':[0.9,1.2,1.5],
 'turkey':[1,1.2,1.4],'warg':[1.05,1.7,2.15],'wild-boar':[1.5,2.25,2.65],'yak':[1.3,2.15,2.7],'yorkshire-terrier':[0.48,0.75,0.9],
});

/** 0 baby, 1 juvenile, 2 adult: the persisted growth when the animal has one
 * (never reconstructed from age), otherwise the Core stage ages. */
export function animalStageIndex(species:AnimalSpeciesId,ageTicks:number,growth?:number):0|1|2 {
 if(growth!==undefined)return Math.max(0,Math.min(2,trackedAnimalLifeStage256(species,{value:growth}).index)) as 0|1|2;
 return ageTicks>=adultAgeTicks(species)?2:ageTicks>=juvenileAgeTicks(species)?1:0;
}

/** Linear scale of the adult model drawn for this stage (1 for an adult). */
export function animalStageDrawScale(species:AnimalSpeciesId,ageTicks:number,growth?:number):number {
 const sizes=CORE_STAGE_DRAW_SIZES[species];
 if(!sizes)return 1;
 return sizes[animalStageIndex(species,ageTicks,growth)]/sizes[2];
}
