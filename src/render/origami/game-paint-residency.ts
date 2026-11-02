import {BESTIARY_PAINT_DESCRIPTORS} from './bestiary-paint-descriptors';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,PROTECTED_REFERENCE_PAINT_DESCRIPTORS,bestiaryPaintProfile} from './reference-profiles';
import {VirtualPaintPool} from './virtual-paint-pool';

/** Exact material union of the42 corrected game presentation factories.
 * No species/model names are guessed, no virtual identity is removed/moved.
 * The independent real-factory contract guards this list. */
export const GAME_UNUSED_BESTIARY_SOURCE_KEYS=Object.freeze([
 'matMuffaloBlue','matFoxSnout','matCamelTan','matHareSand','matDogOchre',
 'matDogSaddle','matDogCollar','matBuffaloDark','matGazelleFlank','matElephantSlate',
] as const);
const unused=new Set<string>(GAME_UNUSED_BESTIARY_SOURCE_KEYS);
export const GAME_USED_BESTIARY_DESCRIPTORS=Object.freeze(BESTIARY_PAINT_DESCRIPTORS.filter(descriptor=>!unused.has(descriptor.sourceKey)));
export const GAME_USED_BESTIARY_SOURCE_KEYS=Object.freeze(GAME_USED_BESTIARY_DESCRIPTORS.map(descriptor=>descriptor.sourceKey));
export const GAME_USED_BESTIARY_VIRTUAL_IDS=Object.freeze(GAME_USED_BESTIARY_SOURCE_KEYS.map(bestiaryPaintProfile));
export const GAME_REQUIRED_VIRTUAL_IDS78=Object.freeze([
 ...PROTECTED_REFERENCE_PAINT_DESCRIPTORS.map((_,index)=>index),...GAME_USED_BESTIARY_VIRTUAL_IDS,
]);
if(GAME_USED_BESTIARY_DESCRIPTORS.length!==35||GAME_REQUIRED_VIRTUAL_IDS78.length!==78)throw Error('Expected ROOT inventory35+protected43; review source changes.');

/** Pure planning counterpart for contracts. No context/Canvas/texture exists. */
export function createGamewideVirtualPool78():VirtualPaintPool{
 const pool=new VirtualPaintPool(PROTECTED_REFERENCE_PAINT_DESCRIPTORS);
 for(const descriptor of BASE_REFERENCE_PAINT_DESCRIPTORS.slice(PROTECTED_REFERENCE_PAINT_DESCRIPTORS.length))pool.register(descriptor);
 pool.sealStaticCatalog();pool.requireProfiles('all-game-paint78',GAME_REQUIRED_VIRTUAL_IDS78);return pool;
}
