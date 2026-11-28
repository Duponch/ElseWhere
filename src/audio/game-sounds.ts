/* Game sound coverage of 22 November 2026 (docs/development/audio-coverage-20261122.md,
 * « Sons du jeu »). Presentation only: pure tables read by the Worker's cue
 * recorder and by the AudioDirector. Nothing here is saved, and no simulation
 * random state is read.
 *
 * Core facts (RimWorld 1.6.4871, Data/Core/Defs and Assembly-CSharp), rewritten:
 * - animal voices: RaceProperties.lifeStageAges soundCall/soundAngry/
 *   soundWounded/soundDeath, played by Pawn_CallTracker and
 *   LifeStageUtility.PlayNearestLifestageSound (the current stage or the next
 *   one up that has a sound, pitched by the voxPitch ratio). Elsewhere groups
 *   the 31 Core voices into 14 families; Core's shared voices fall in the same
 *   family (Pawn_Dog_* for dogs and wolves, Pawn_Elk_* for elk, alpaca and
 *   caribou, Pawn_Boomrat_* for boomrat, rat and raccoon…);
 * - call interval: RaceProperties.soundCallIntervalRange 2000–4000 ticks (no
 *   species overrides it), ×0.25 when aggressive (soundCallIntervalAggressiveFactor);
 *   idle calls at 0.25 volume at the highest speed (IdleCallVolumeFactor);
 * - animal eating: RaceProperties.soundEating (7 classes);
 * - human eating: ThingDef.ingestible.ingestSound (Meal_Eat, RawVegetable_Eat,
 *   RawMeat_Eat, Ingest_Beer, Ingest_Pill);
 * - drops: ThingDef.soundDrop (Wood_Drop, Metal_Drop, Silver_Drop, Stone_Drop,
 *   ChunkRock_Drop, ChunkSlag_Drop, Grain_Drop, Corpse_Drop, Standard_Drop);
 * - construction: Frame.ConstructionEffect (stuff constructEffect, then the
 *   built def's, else ConstructMetal; floors default to ConstructDirt);
 * - production: RecipeDef.soundWorking / recipeMaker.soundWorking per product;
 * - shots: Verb soundCast per weapon; melee: Verb_MeleeAttack hit, miss and
 *   dodge sounds (stuff soundMeleeHitSharp/Blunt, race soundMeleeHitPawn). */
import type { AnimalSpeciesId } from '../sim/animal-species.ts';

export type AnimalVoiceFamily = 'canine' | 'feline' | 'big-cat' | 'bear' | 'bovine' | 'cervid' | 'equine'
  | 'pachyderm' | 'boar' | 'rodent' | 'bird' | 'reptile' | 'insect' | 'primate';
export type AnimalVoiceVerb = 'call' | 'angry' | 'hurt' | 'death';
export type AnimalEatClass = 'herbivore' | 'bird' | 'predator-large' | 'predator-small' | 'rodent' | 'reptile' | 'insect';
export const ANIMAL_VOICE_FAMILIES: readonly AnimalVoiceFamily[] = ['canine', 'feline', 'big-cat', 'bear', 'bovine', 'cervid',
  'equine', 'pachyderm', 'boar', 'rodent', 'bird', 'reptile', 'insect', 'primate'];
export const ANIMAL_EAT_CLASSES: readonly AnimalEatClass[] = ['herbivore', 'bird', 'predator-large', 'predator-small', 'rodent', 'reptile', 'insect'];

/** Core voice of each species' adult stage; null: Core plays none (foxes, the
 * adult big birds). Cougar, lynx and panther have no idle call in Core. */
const VOICE: Readonly<Record<AnimalSpeciesId, AnimalVoiceFamily | null>> = {
  goat: 'cervid', pig: 'boar', thrumbo: 'pachyderm',
  hare: 'rodent', 'snow-hare': 'rodent', deer: 'cervid', muffalo: 'bovine', gazelle: 'cervid', dromedary: 'equine',
  'red-fox': null, megascarab: 'insect', spelopede: 'insect', megaspider: 'insect', cat: 'feline',
  'yorkshire-terrier': 'canine', 'labrador-retriever': 'canine', husky: 'canine', alpaca: 'cervid', 'grizzly-bear': 'bear',
  'polar-bear': 'bear', bison: 'bovine', boomalope: 'bovine', boomrat: 'rodent', capybara: 'rodent', caribou: 'cervid',
  cassowary: null, chinchilla: 'rodent', cobra: 'reptile', cougar: 'big-cat', donkey: 'equine', duck: 'bird',
  elephant: 'pachyderm', elk: 'cervid', emu: null, 'arctic-fox': null, 'fennec-fox': null, 'guinea-pig': 'rodent',
  horse: 'equine', ibex: 'cervid', iguana: 'reptile', lynx: 'big-cat', megasloth: 'pachyderm', monkey: 'primate',
  ostrich: null, panther: 'big-cat', raccoon: 'rodent', rat: 'rodent', rhinoceros: 'pachyderm', squirrel: 'rodent',
  tortoise: 'reptile', turkey: null, warg: 'canine', 'wild-boar': 'boar', 'arctic-wolf': 'canine', 'timber-wolf': 'canine',
  yak: 'bovine',
};
const EAT: Readonly<Record<AnimalSpeciesId, AnimalEatClass>> = {
  goat: 'herbivore', pig: 'herbivore', thrumbo: 'herbivore',
  hare: 'rodent', 'snow-hare': 'rodent', deer: 'herbivore', muffalo: 'herbivore', gazelle: 'herbivore', dromedary: 'herbivore',
  'red-fox': 'predator-small', megascarab: 'insect', spelopede: 'insect', megaspider: 'insect', cat: 'predator-small',
  'yorkshire-terrier': 'predator-small', 'labrador-retriever': 'predator-small', husky: 'predator-small', alpaca: 'herbivore',
  'grizzly-bear': 'predator-large', 'polar-bear': 'predator-large', bison: 'herbivore', boomalope: 'herbivore', boomrat: 'rodent',
  capybara: 'rodent', caribou: 'herbivore', cassowary: 'bird', chinchilla: 'rodent', cobra: 'reptile', cougar: 'predator-large',
  donkey: 'herbivore', duck: 'bird', elephant: 'herbivore', elk: 'herbivore', emu: 'bird', 'arctic-fox': 'predator-small',
  'fennec-fox': 'predator-small', 'guinea-pig': 'rodent', horse: 'herbivore', ibex: 'herbivore', iguana: 'reptile',
  lynx: 'predator-small', megasloth: 'herbivore', monkey: 'herbivore', ostrich: 'bird', panther: 'predator-large',
  raccoon: 'rodent', rat: 'rodent', rhinoceros: 'herbivore', squirrel: 'rodent', tortoise: 'reptile', turkey: 'bird',
  warg: 'predator-large', 'wild-boar': 'herbivore', 'arctic-wolf': 'predator-large', 'timber-wolf': 'predator-large', yak: 'herbivore',
};
/** Core AnimalBabyTiny birds: Pawn_Chick_Call on the first stage for every verb. */
const CHICK_BIRDS: ReadonlySet<string> = new Set(['duck', 'cassowary', 'emu', 'ostrich', 'turkey']);
const INSECTS: ReadonlySet<string> = new Set(['megascarab', 'spelopede', 'megaspider']);
/** Elsewhere's earlier species voices (V166, V196): kept in front of the family. */
const SPECIES_VOICE: Readonly<Partial<Record<AnimalSpeciesId, { hurt?: string; death?: string }>>> = {
  hare: { hurt: 'hare', death: 'hare' }, 'snow-hare': { hurt: 'hare', death: 'hare' }, deer: { hurt: 'deer', death: 'deer' },
  muffalo: { hurt: 'muffalo', death: 'muffalo' }, gazelle: { hurt: 'gazelle', death: 'gazelle' },
  dromedary: { hurt: 'dromedary', death: 'dromedary' }, 'red-fox': { hurt: 'red-fox' },
};

export interface AnimalVoiceCue { kind: string; pitch: number; volume: number }

/** The sound Core plays for this verb at this life stage (0 baby, 1 juvenile,
 * 2 adult), with Core's voxPitch/voxVolume ratio; undefined when Core is silent.
 * AnimalBaby 1.6/0.8, AnimalJuvenile 1.2, EusocialInsectLarva 1.6/0.4. */
export function animalVoiceCue(species: AnimalSpeciesId, stage: 0 | 1 | 2, verb: AnimalVoiceVerb): AnimalVoiceCue | undefined {
  if (CHICK_BIRDS.has(species) && stage === 0) return { kind: 'animal.call.chick', pitch: 1, volume: 1 };
  const family = VOICE[species];
  const own = verb === 'hurt' || verb === 'death' ? SPECIES_VOICE[species]?.[verb] : undefined;
  if (!family && !own) return undefined;
  if (verb === 'call' && family === 'big-cat') return undefined;
  const pitch = stage === 0 ? 1.6 : stage === 1 ? 1.2 : 1;
  const volume = stage === 0 ? (INSECTS.has(species) ? 0.4 : 0.8) : 1;
  return { kind: own ? `animal.${verb}.${own}` : `animal.${verb}.${family}`, pitch, volume };
}

export const animalEatCue = (species: AnimalSpeciesId): string => `animal.eat.${EAT[species]}`;

/** Core soundCallIntervalRange 2000–4000 ticks, in local ticks of 10 Core ticks;
 * ×0.25 when aggressive. A presentation hash replaces Core's Rand. */
export const ANIMAL_CALL_INTERVAL_TICKS: readonly [number, number] = [200, 400];
export function animalCallInterval(animalId: number, count: number, aggressive: boolean): number {
  const span = ANIMAL_CALL_INTERVAL_TICKS[1] - ANIMAL_CALL_INTERVAL_TICKS[0] + 1;
  const ticks = ANIMAL_CALL_INTERVAL_TICKS[0] + presentationHash(animalId, count, 0x5bd1e995) % span;
  return aggressive ? Math.max(1, Math.floor(ticks * 0.25)) : ticks;
}
/** Core Pawn_CallTracker.Notify_DidMeleeAttack: half the strikes call 0–20 ticks later. */
export function animalStrikeCallDelay(animalId: number, atCore: number): number | undefined {
  const hash = presentationHash(animalId, atCore, 0x27d4eb2f);
  return hash & 1 ? (hash >>> 1) % 3 : undefined;
}
export function presentationHash(a: number, b: number, salt: number): number {
  let hash = Math.imul((a ^ salt) >>> 0, 0x9e3779b1) ^ Math.imul(b >>> 0, 0x85ebca6b);
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x2c1b3c6d); hash ^= hash >>> 12;
  return hash >>> 0;
}

/** Core ThingDef.soundDrop by item, through Elsewhere's material kinds. */
export function dropCue(item: string, kind: string | undefined): string {
  if (kind === 'wood') return 'haul.drop-wood';
  if (kind === 'steel' || kind === 'plasteel' || kind === 'uranium' || kind === 'ai-core') return 'haul.drop-metal';
  if (kind === 'silver' || kind === 'gold') return 'haul.drop-silver';
  if (kind === 'blocks') return 'haul.drop-stone';
  if (kind === 'chunk') return item.startsWith('slag-') ? 'haul.drop-slag' : 'haul.drop-chunk';
  if (kind === 'jade') return 'haul.drop-chunk';
  if (kind === 'corpse' || kind === 'mech-corpse') return 'haul.drop-corpse';
  if (item === 'rice' || item === 'corn') return 'haul.drop-grain';
  return 'haul.drop';
}

/** Core ingestSound of the food: meals keep the existing eating.work. */
export function ingestCue(item: string, kind: string | undefined): string {
  if (kind === 'beer') return 'eating.drink';
  if (kind === 'drug') return 'eating.pill';
  if (kind !== 'food') return 'eating.work';
  if (item === 'kibble' || RAW_PLANT_FOOD.has(item)) return 'eating.vegetable';
  if (item.endsWith('-meat') || /-egg-/.test(item)) return 'eating.meat';
  return 'eating.work';
}
const RAW_PLANT_FOOD: ReadonlySet<string> = new Set(['rice', 'corn', 'potato', 'berries', 'agave-fruit', 'raw-fungus', 'hops', 'hay']);

/** Core Frame.ConstructionEffect: wood keeps construction.hit (Interact_ConstructWood). */
export function constructionCue(job: { kind: string; material?: string; floor?: string }): string {
  if (job.kind === 'lay-floor') {
    const floor = job.floor ?? '';
    if (floor === 'wood-planks') return 'construction.hit';
    if (floor === 'steel-tile' || floor === 'sterile-tile' || floor === 'silver-tile' || floor === 'gold-tile') return 'construction.metal';
    return 'construction.dirt';
  }
  if (job.kind === 'build-bridge') return 'construction.hit';
  if (job.kind === 'grave') return 'construction.dirt';
  // The simulation reads a structure without material as wood (historical
  // walls and doors); the industrial buildings it places carry 'steel'.
  if (job.material === undefined || job.material === 'wood') return 'construction.hit';
  return 'construction.metal';
}

/** Core RecipeDef.soundWorking per Elsewhere recipe; others keep their cue. */
const PRODUCTION: Readonly<Record<string, string>> = {
  'stone-blocks': 'crafting.stonecut', 'brew-wort': 'crafting.brew', 'cremate-corpse': 'crafting.cremate', 'burn-apparel': 'crafting.cremate',
  'chemfuel-from-wood': 'crafting.cremate', 'chemfuel-from-organics': 'crafting.cremate', 'smelt-slag': 'crafting.smelt',
  'smelt-apparel': 'crafting.smelt', 'smelt-weapon': 'crafting.smelt', 'small-sculpture': 'crafting.sculpt', 'large-sculpture': 'crafting.sculpt',
  'make-short-bow': 'crafting.bow', 'make-recurve-bow': 'crafting.bow', 'make-greatbow': 'crafting.bow',
  'smash-mechanoid': 'crafting.mech', 'shred-mechanoid': 'crafting.mech',
  'make-penoxycyline': 'crafting.drug', 'make-penoxycyline-bulk': 'crafting.drug',
  'make-component': 'crafting.machining', 'make-advanced-component': 'crafting.machining', 'make-recon-armor': 'crafting.machining',
  'make-recon-helmet': 'crafting.machining', 'make-flak-vest': 'crafting.machining', 'make-flak-pants': 'crafting.machining',
  'make-flak-helmet': 'crafting.machining',
  'make-spear': 'crafting.smith', 'make-longsword': 'crafting.smith', 'make-mace': 'crafting.smith', 'make-plasteel-knife': 'crafting.smith',
  'make-plate-armor': 'crafting.smith', 'make-simple-helmet': 'crafting.smith', 'make-prosthetic-arm': 'crafting.smith',
  'make-prosthetic-leg': 'crafting.smith', 'make-revolver': 'crafting.smith', 'make-bolt-action-rifle': 'crafting.smith',
  'make-pump-shotgun': 'crafting.smith', 'make-autopistol': 'crafting.smith', 'make-machine-pistol': 'crafting.smith',
  'make-chain-shotgun': 'crafting.smith', 'make-heavy-smg': 'crafting.smith', 'make-lmg': 'crafting.smith',
  'make-assault-rifle': 'crafting.smith', 'make-sniper-rifle': 'crafting.smith', 'make-emp-launcher': 'crafting.smith',
  'make-kibble': 'cooking.work', 'make-pemmican': 'cooking.work', tribalwear: 'tailoring.work',
};
export const productionCue = (recipe: string): string | undefined => PRODUCTION[recipe];

/** Core Verb soundCast, grouped: the great bow plays the bow lower. */
const SHOTS: Readonly<Record<string, { kind: string; pitch?: number }>> = {
  revolver: { kind: 'weapon.shot-pistol' }, autopistol: { kind: 'weapon.shot-pistol' }, 'machine-pistol': { kind: 'weapon.shot-pistol' },
  'bolt-action-rifle': { kind: 'weapon.shot-rifle' }, 'assault-rifle': { kind: 'weapon.shot-rifle' },
  'sniper-rifle': { kind: 'weapon.shot-sniper' }, 'pump-shotgun': { kind: 'weapon.shot-shotgun' }, 'chain-shotgun': { kind: 'weapon.shot-shotgun' },
  'heavy-smg': { kind: 'weapon.shot-auto' }, lmg: { kind: 'weapon.shot-auto', pitch: 0.92 },
  'short-bow': { kind: 'weapon.shot-bow', pitch: 1.08 }, 'recurve-bow': { kind: 'weapon.shot-bow' }, greatbow: { kind: 'weapon.shot-bow', pitch: 0.86 },
  'emp-launcher': { kind: 'weapon.shot-launcher' }, 'lancer-gun': { kind: 'weapon.shot-charge' }, 'pikeman-gun': { kind: 'weapon.shot-needle' },
};
export function shotCue(weaponItem: string | undefined): { kind: string; pitch?: number } {
  return (weaponItem && SHOTS[weaponItem]) || { kind: 'weapon.gunshot' };
}

/** Core Verb_MeleeAttack: a miss or dodge whooshes; a weapon hit sounds by its
 * stuff (sharp or blunt), an animal by its race (small scratch, big bash), a
 * mechanoid by its blades, bare hands by the punch. */
export function meleeCue(actor: 'human' | 'animal' | 'mechanical', outcome: string | undefined, tool: string | undefined,
  weapon: { item: string; kind?: string } | undefined, bigAnimal: boolean): string {
  if (outcome === 'miss' || outcome === 'dodge') return 'weapon.melee-miss';
  if (actor === 'mechanical') return 'weapon.melee-mech';
  if (actor === 'animal') return bigAnimal ? 'weapon.melee-bash' : 'weapon.melee-scratch';
  if (!weapon || !tool || tool.endsWith('-fist') || tool === 'head' || tool === 'teeth') return 'weapon.melee';
  if (weapon.item.startsWith('wood-')) return 'weapon.melee-wood';
  if (/mace/.test(weapon.item)) return 'weapon.melee-blunt';
  return 'weapon.melee-sharp';
}
/** Core soundMeleeHitPawn per race: Pawn_Melee_BigBash_HitPawn or SmallScratch. */
const BIG_BASH: ReadonlySet<string> = new Set(['deer', 'muffalo', 'gazelle', 'dromedary', 'megaspider', 'alpaca', 'grizzly-bear',
  'polar-bear', 'bison', 'boomalope', 'caribou', 'cougar', 'donkey', 'elephant', 'elk', 'horse', 'ibex', 'lynx', 'megasloth',
  'panther', 'rhinoceros', 'yak', 'thrumbo']);
export const bigBashAnimal = (species: string): boolean => BIG_BASH.has(species);

/** A missing specific take falls back on the cue it refines, so a manifest
 * without it keeps the sound this lot replaced. */
export function fallbackCue(kind: string): string | undefined {
  if (kind.startsWith('haul.drop-')) return 'haul.drop';
  if (kind === 'construction.metal' || kind === 'construction.dirt') return 'construction.hit';
  if (kind.startsWith('crafting.')) return kind === 'crafting.work' ? undefined : 'crafting.work';
  if (kind.startsWith('eating.')) return kind === 'eating.work' ? undefined : 'eating.work';
  if (kind === 'medical.surgery') return 'medical.tend';
  if (kind.startsWith('weapon.shot-')) return 'weapon.gunshot';
  if (kind.startsWith('weapon.melee-')) return 'weapon.melee';
  return undefined;
}

/** Every cue this lot can emit from the Worker (the shared phase validator accepts them). */
export const GAME_SOUND_CUE_KINDS: ReadonlySet<string> = new Set([
  ...ANIMAL_VOICE_FAMILIES.flatMap(family => (['call', 'angry', 'hurt', 'death'] as const)
    .filter(verb => !(family === 'big-cat' && verb === 'call')).map(verb => `animal.${verb}.${family}`)),
  'animal.call.chick',
  ...ANIMAL_EAT_CLASSES.map(cls => `animal.eat.${cls}`),
  ...['wood', 'metal', 'silver', 'stone', 'chunk', 'slag', 'grain', 'corpse'].map(cls => `haul.drop-${cls}`),
  'construction.metal', 'construction.dirt',
  ...['smith', 'machining', 'stonecut', 'smelt', 'brew', 'drug', 'sculpt', 'bow', 'cremate', 'mech'].map(cls => `crafting.${cls}`),
  'medical.surgery', 'farming.harvest-finish', 'eating.vegetable', 'eating.meat', 'eating.drink', 'eating.pill',
  ...['pistol', 'rifle', 'sniper', 'shotgun', 'auto', 'bow', 'launcher', 'charge', 'needle'].map(cls => `weapon.shot-${cls}`),
  ...['sharp', 'blunt', 'wood', 'scratch', 'bash', 'mech', 'miss'].map(cls => `weapon.melee-${cls}`),
]);
export type GameSoundCueKind =
  | `animal.${AnimalVoiceVerb}.${AnimalVoiceFamily}` | 'animal.call.chick' | `animal.eat.${AnimalEatClass}`
  | `haul.drop-${'wood' | 'metal' | 'silver' | 'stone' | 'chunk' | 'slag' | 'grain' | 'corpse'}`
  | 'construction.metal' | 'construction.dirt'
  | `crafting.${'smith' | 'machining' | 'stonecut' | 'smelt' | 'brew' | 'drug' | 'sculpt' | 'bow' | 'cremate' | 'mech'}`
  | 'medical.surgery' | 'farming.harvest-finish' | `eating.${'vegetable' | 'meat' | 'drink' | 'pill'}`
  | `weapon.shot-${'pistol' | 'rifle' | 'sniper' | 'shotgun' | 'auto' | 'bow' | 'launcher' | 'charge' | 'needle'}`
  | `weapon.melee-${'sharp' | 'blunt' | 'wood' | 'scratch' | 'bash' | 'mech' | 'miss'}`;

/** Core Ambient_NightInsects_Standard volume curves: time of day (full from
 * 22.04 h to 1.74 h, silent from 3.74 h to 19.08 h, linear between) and outdoor
 * temperature (0 at 0 °C, 1 from 5 °C). Camera height is applied by the caller. */
export function nightInsectsGain(hour: number, outdoorCelsius: number): number {
  const h = ((hour % 24) + 24) % 24;
  const time = h <= 1.743164 ? 1 : h < 3.74354 ? 1 - (h - 1.743164) / (3.74354 - 1.743164)
    : h <= 19.08203 ? 0 : h < 22.03683 ? (h - 19.08203) / (22.03683 - 19.08203) : 1;
  const warmth = Math.max(0, Math.min(1, outdoorCelsius / 5));
  return time * warmth;
}
/** Core BiomeDef.soundsAmbient with Ambient_NightInsects_Standard. The tropical
 * biomes have their own jungle insects in Core; Elsewhere reuses the standard
 * loop there (adaptation). Desert, ice and water biomes have none. */
const INSECT_BIOMES: ReadonlySet<string> = new Set(['temperate-forest', 'temperate-swamp', 'boreal-forest', 'tundra', 'cold-bog',
  'arid-shrubland', 'tropical-rainforest', 'tropical-swamp']);
export const biomeHasNightInsects = (biome: string | undefined): boolean => INSECT_BIOMES.has(biome ?? 'temperate-forest');
