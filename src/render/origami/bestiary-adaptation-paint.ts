// Static adaptation pigment dependencies only. References to existing best46 descriptors, in exactly
// their source order. No new hue/config/seed/ID, bake, Canvas or material clone.
import {BESTIARY_PAINT_DESCRIPTORS} from './bestiary-paint-descriptors';

export const ADAPTATION_SOURCE_KEYS=Object.freeze([
 'best46:matCharcoalGouache','best46:matCreamWhiteGouache','best46:matSnowWhiteGouache','best46:matPinkEarGouache',
 'best46:matDonkeyDun','best46:matSlothEarth','best46:matBoomSacAmber','best46:matChitinOlive',
 'best46:matChinchillaSilver','best46:matCamelMuzzle','best46:matDeerAuburn','best46:matDeerMane','best46:matAntlerCream',
] as const);
const required=new Set<string>(ADAPTATION_SOURCE_KEYS);
export const ADAPTATION_PAINT_DESCRIPTORS=Object.freeze(BESTIARY_PAINT_DESCRIPTORS.filter(descriptor=>required.has(descriptor.key)));
if(ADAPTATION_PAINT_DESCRIPTORS.length!==required.size)throw Error('Adaptation pigment dependencies must all exist in the45 source descriptors');
