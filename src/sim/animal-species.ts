import {ANIMAL_SPECIES_256,type AnimalLeatherItem256} from './animal-species-v256.ts';
import {ANIMAL_SPECIES_IDS_256,isAnimalSpecies256} from './animal-core-v256.ts';
import type {AnimalBodyDef256} from './animal-anatomy-data-v256.ts';
import type { BodyPartId } from './body-definition.ts';
import type { MeleeDamage, MeleeToolId } from './melee-statistics.ts';

export const LEGACY_ANIMAL_SPECIES_IDS = ['hare','snow-hare','deer','muffalo','gazelle','dromedary','red-fox'] as const;
export const ANIMAL_SPECIES_IDS=[...LEGACY_ANIMAL_SPECIES_IDS,...ANIMAL_SPECIES_IDS_256] as const;
export type AnimalSpeciesId = typeof ANIMAL_SPECIES_IDS[number];
export type AnimalCorpseItem = `${AnimalSpeciesId}-corpse`;
export type AnimalMeatItem = `${AnimalSpeciesId}-meat`|'pig-meat';
export type AnimalLeatherItem = AnimalLeatherItem256 | 'light-leather'|'plainleather'|'bluefur'|'camelhide'|'foxfur';
export type FaunaBiomeId = 'temperate-forest'|'boreal-forest'|'arid-shrubland'|'tundra';

export interface AnimalMeleeProfile {
  readonly id:MeleeToolId;
  readonly sourcePart:BodyPartId;
  readonly sourceParts?:readonly BodyPartId[];
  readonly damage:number;
  readonly penetration:number;
  readonly kind:MeleeDamage;
  readonly cooldownCore:number;
  readonly chanceFactor:number;
  readonly surpriseStun?:number;
  /** Core ensureLinkedBodyPartsGroupAlwaysUsable: efficiency never below 0.4. */
  readonly alwaysUsable?:true;
}
export interface AnimalSpeciesProfile {
  readonly id:AnimalSpeciesId;
  readonly label:string;
  readonly bodySize:number;
  readonly healthScale:number;
  readonly combatPower:number;
  readonly predator?:true;
  readonly maxPreySize?:number;
  readonly bodyTemplate:'paws'|'hooves'|'camelid'|AnimalBodyDef256;
  readonly core256?:true;
  /** Maximum stored nutrition for one adult. */
  readonly nutrition:number;
  readonly foodPerDay:number;
  /** Local ticks per cardinal cell while purposeful / wandering. */
  readonly moveTicks:number;
  readonly walkTicks:number;
  readonly ingestTicks:number;
  readonly ecoSystemWeight:number;
  readonly wildGroupSize:readonly [number,number];
  readonly corpseItem:AnimalCorpseItem;
  readonly meatItem:AnimalMeatItem;
  readonly leatherItem:AnimalLeatherItem|null;
  readonly rawMeat:number;
  readonly rawLeather:number;
  readonly melee:readonly AnimalMeleeProfile[];
}

const attack=(id:MeleeToolId,sourcePart:BodyPartId,damage:number,kind:MeleeDamage,cooldownCore:number,chanceFactor=1,surpriseStun?:number):AnimalMeleeProfile=>
  Object.freeze({id,sourcePart,damage,kind,cooldownCore,chanceFactor,penetration:damage*.015,...(surpriseStun===undefined?{}:{surpriseStun})});
const profile=(value:Omit<AnimalSpeciesProfile,'corpseItem'|'meatItem'|'rawMeat'|'rawLeather'>):AnimalSpeciesProfile=>Object.freeze({
  ...value,
  corpseItem:`${value.id}-corpse`,
  meatItem:`${value.id}-meat`,
  // Core's adult base values are 140 meat and 40 leather per body-size unit;
  // corpseYield applies the shared small-body curve and injury loss later.
  rawMeat:140*value.bodySize,
  rawLeather:40*value.bodySize,
});
const HARE_MELEE=Object.freeze([
  attack('teeth','jaw',3.4,'bite',120),
  attack('head','head',1.5,'blunt',120,.2),
]);
const deerMelee=Object.freeze([
  attack('head','left-front-leg',7,'blunt',120),attack('head','right-front-leg',7,'blunt',120),
  attack('teeth','jaw',8,'bite',120,.5),attack('head','head',5,'blunt',120,.2),
]);
const gazelleMelee=Object.freeze([
  attack('head','left-front-leg',5.5,'blunt',90),attack('head','right-front-leg',5.5,'blunt',90),
  attack('teeth','jaw',7,'bite',120,.7),attack('head','head',7,'blunt',120,.2),
]);
const muffaloMelee=Object.freeze([
  attack('head','head',13,'blunt',156),attack('head','left-front-leg',10,'blunt',120),
  attack('head','right-front-leg',10,'blunt',120),attack('teeth','jaw',10,'bite',120,.5),
]);
const dromedaryMelee=Object.freeze([
  attack('head','left-front-leg',9,'blunt',120),attack('head','right-front-leg',9,'blunt',120),
  attack('teeth','jaw',10,'bite',120,.7),attack('head','head',7,'blunt',120,.2),
]);
const foxMelee=Object.freeze([
  attack('left-claw','left-front-paw',8,'scratch',120,1,14),
  attack('right-claw','right-front-paw',8,'scratch',120,1,14),
  attack('teeth','jaw',9,'bite',120,.9,14),attack('head','head',4,'blunt',120,.2),
]);

/** Effective adult rates are the local Core declarations after the shared
 * ×1.6 need factor, rounded as the UI values used by the V76 hare contract. */
export const ANIMAL_SPECIES:Readonly<Record<AnimalSpeciesId,AnimalSpeciesProfile>>=Object.freeze({
  ...ANIMAL_SPECIES_256,
  hare:profile({id:'hare',label:'lièvre',combatPower:33,bodySize:.2,healthScale:.4,bodyTemplate:'paws',nutrition:.2,foodPerDay:.18,moveTicks:1,walkTicks:5,ingestTicks:50,ecoSystemWeight:.25,wildGroupSize:[1,1],leatherItem:'light-leather',melee:HARE_MELEE}),
  'snow-hare':profile({id:'snow-hare',label:'lièvre des neiges',combatPower:33,bodySize:.2,healthScale:.4,bodyTemplate:'paws',nutrition:.2,foodPerDay:.18,moveTicks:1,walkTicks:5,ingestTicks:50,ecoSystemWeight:.25,wildGroupSize:[1,1],leatherItem:'light-leather',melee:HARE_MELEE}),
  deer:profile({id:'deer',label:'cerf',combatPower:50,bodySize:1.2,healthScale:.9,bodyTemplate:'hooves',nutrition:1.2,foodPerDay:.32,moveTicks:6/5.5,walkTicks:30/5.5,ingestTicks:50,ecoSystemWeight:.5,wildGroupSize:[3,9],leatherItem:'plainleather',melee:deerMelee}),
  muffalo:profile({id:'muffalo',label:'mufalo',combatPower:100,bodySize:2.4,healthScale:1.75,bodyTemplate:'hooves',nutrition:2.4,foodPerDay:.86,moveTicks:6/4.5,walkTicks:30/4.5,ingestTicks:50,ecoSystemWeight:1.1,wildGroupSize:[3,9],leatherItem:'bluefur',melee:muffaloMelee}),
  gazelle:profile({id:'gazelle',label:'gazelle',combatPower:40,bodySize:.7,healthScale:.7,bodyTemplate:'hooves',nutrition:.7,foodPerDay:.24,moveTicks:1,walkTicks:5,ingestTicks:50,ecoSystemWeight:.45,wildGroupSize:[4,13],leatherItem:'plainleather',melee:gazelleMelee}),
  dromedary:profile({id:'dromedary',label:'dromadaire',combatPower:90,bodySize:2.1,healthScale:1.6,bodyTemplate:'camelid',nutrition:2.1,foodPerDay:.86,moveTicks:6/4.3,walkTicks:30/4.3,ingestTicks:50,ecoSystemWeight:1,wildGroupSize:[2,5],leatherItem:'camelhide',melee:dromedaryMelee}),
  'red-fox':profile({id:'red-fox',label:'renard roux',combatPower:45,predator:true,maxPreySize:.8,bodySize:.55,healthScale:.7,bodyTemplate:'paws',nutrition:.55,foodPerDay:.16,moveTicks:6/4.6,walkTicks:30/4.6,ingestTicks:50,ecoSystemWeight:.25,wildGroupSize:[1,1],leatherItem:'foxfur',melee:foxMelee}),
});
export const isAnimalSpecies=(value:unknown):value is AnimalSpeciesId=>typeof value==='string'&&(ANIMAL_SPECIES_IDS as readonly string[]).includes(value);
export const isAnimalSpeciesInVersion=(value:unknown,version:number):value is AnimalSpeciesId=>isAnimalSpecies(value)&&(version>=256||!isAnimalSpecies256(value));
export const animalSpecies=(id:AnimalSpeciesId):AnimalSpeciesProfile=>ANIMAL_SPECIES[id];

export interface BiomeFaunaEntry {readonly species:AnimalSpeciesId;readonly commonality:number}
export interface BiomeFaunaProfile {
  readonly id:FaunaBiomeId;
  readonly animalDensity:number;
  /** Sum of every local Core entry, including species outside V91. */
  readonly totalCommonality:number;
  readonly entries:readonly BiomeFaunaEntry[];
}
const biome=(id:FaunaBiomeId,animalDensity:number,totalCommonality:number,entries:readonly (readonly [AnimalSpeciesId,number])[]):BiomeFaunaProfile=>
  Object.freeze({id,animalDensity,totalCommonality,entries:Object.freeze(entries.map(([species,commonality])=>Object.freeze({species,commonality})))});
/** Missing Core species remain in totalCommonality. A selection that lands in
 * that interval is an empty result; its weight is never reassigned. Snowhare
 * remains tied to the local tundra profile rather than replacing boreal hare. */
export const BIOME_FAUNA:Readonly<Record<FaunaBiomeId,BiomeFaunaProfile>>=Object.freeze({
  'temperate-forest':biome('temperate-forest',3.7,12.27,[['hare',1],['deer',.5],['muffalo',.5],['gazelle',.3],['red-fox',.07]]),
  'boreal-forest':biome('boreal-forest',2.8,10.12,[['hare',1],['deer',.5],['muffalo',.5],['red-fox',.07]]),
  'arid-shrubland':biome('arid-shrubland',1.8,11.867,[['hare',1.3],['gazelle',.7],['dromedary',.7]]),
  tundra:biome('tundra',1.1,13.53,[['hare',2],['snow-hare',2],['muffalo',1]]),
});
const HERBIVORE_FAUNA=Object.freeze(Object.fromEntries(Object.entries(BIOME_FAUNA).map(([id,p])=>[id,
  Object.freeze({...p,entries:Object.freeze(p.entries.filter(e=>!animalSpecies(e.species).predator))})
])) as Record<FaunaBiomeId,BiomeFaunaProfile>);
export const faunaBiome=(id:FaunaBiomeId,includePredators=true):BiomeFaunaProfile=>includePredators?BIOME_FAUNA[id]:HERBIVORE_FAUNA[id];
export function selectBiomeSpecies(profile:BiomeFaunaProfile,roll:number):AnimalSpeciesId|undefined {
  let cursor=Math.max(0,Math.min(1-Number.EPSILON,roll))*profile.totalCommonality;
  for(const entry of profile.entries){cursor-=entry.commonality;if(cursor<0)return entry.species;}
  return undefined;
}
