import type { ColonistBackground } from './colonist-backgrounds.ts';
import { CORE_BACKSTORIES_370,isCoreBackstoryId370,type CoreBackstory370,type CoreTraitRef370 } from './core-backstories-370.ts';
import { CORE_TRAIT_DEFS,TRAITS,type TraitId } from './traits.ts';

/** Schema 370: what a Core backstory does to PawnGenerator.GenerateTraits.
 * - forcedTraits, childhood then adulthood: each is gained (at its degree)
 *   unless its def is already held; they count toward the drawn total;
 * - disallowedTraits: a drawn def whose drawn degree a story disallows is
 *   refused (BackstoryDef.DisallowsTrait, after the degree draw).
 * A forced trait Elsewhere does not deliver at the birth's schema is not
 * given (only Pyromaniac, until it exists). Elsewhere's own stories force
 * and disallow nothing. */
const stories=(b:ColonistBackground|undefined):CoreBackstory370[]=>!b?[]:[b.childhood,b.adulthood].flatMap(id=>isCoreBackstoryId370(id)?[CORE_BACKSTORIES_370[id]]:[]);
const traitOf=([def,degree]:CoreTraitRef370,schema:number):TraitId|undefined=>
  CORE_TRAIT_DEFS[def].degrees.find(id=>TRAITS[id].degree===degree&&(TRAITS[id].since??0)<=schema);
export function coreBackstoryForcedTraits370(background:ColonistBackground|undefined,schema:number):TraitId[] {
  const held:TraitId[]=[];
  for(const story of stories(background))for(const ref of story.forcedTraits){
    const id=traitOf(ref,schema);
    if(id&&!held.some(h=>TRAITS[h].def===TRAITS[id].def))held.push(id);
  }
  return held;
}
export const coreBackstoryDisallows370=(background:ColonistBackground|undefined,id:TraitId):boolean=>
  stories(background).some(story=>story.disallowedTraits.some(([def,degree])=>def===TRAITS[id].def&&degree===TRAITS[id].degree));
