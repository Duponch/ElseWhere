import type {ThreeAPI,RegisterMaterial,CreatePart,BestiaryFactory} from '../../src/render/origami/bestiary-types';
/** Independent pre-TypeScript geometry oracle; only its dependency imports
 * point at the same admitted parent/eye helpers as the production adapter. */
export function createBestiaryAdaptations(api:ThreeAPI,registerMaterial?:RegisterMaterial,createPart?:CreatePart,reference?:BestiaryFactory):BestiaryFactory;
