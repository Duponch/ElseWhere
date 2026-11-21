import {schemaAtLeast} from './schema-range.ts';
import {backgroundSkillRefusal} from './colonist-backgrounds.ts';
import type {InspirationKind360} from './inspirations-360.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {TraitId} from './traits.ts';
import type {Pawn} from './types.ts';

/* Schema 362: the Core traits that tie wave 5 together (outdoors need 359,
 * inspirations 360, the trait set 361), read from RimWorld 1.6 TraitDefs
 * (Traits_Singular.xml, Traits_Spectrum.xml), ThoughtDefs and the classes
 * TraitDegreeData, Trait.Notify_MentalStateEndedOn, MentalState.
 * RecoverFromState, InspirationWorker.InspirationCanOccur, PawnGenerator.
 * GenerateTraitsFor / GenerateSkills and Pawn_HealthTracker.InPainShock.
 * The three new degrees (Undergrounder, Tortured artist, Wimp) exist only
 * from 362, so every reader below is inert for an older save. */
export const TRAIT_LINKS_SCHEMA_362=362;
export const isTraitLinks362=schemaAtLeast(TRAIT_LINKS_SCHEMA_362);

/** TraitDegreeData.disallowedInspirations: Brawler (Frenzy_Shoot) and
 * Slowpoke (Frenzy_Go); no other Core degree lists one. */
const DISALLOWED_INSPIRATIONS:Partial<Record<TraitId,readonly InspirationKind360[]>>=Object.freeze({brawler:Object.freeze(['shoot-frenzy'] as const),slowpoke:Object.freeze(['go-frenzy'] as const)});
/** InspirationWorker.InspirationCanOccur refuses a def a held trait disallows.
 * Brawler and Slowpoke exist from 361: the rule applies from 362 only, so a
 * 361 game keeps its draws. */
export function traitDisallowsInspiration362(p:Pick<Pawn,'traits'>,kind:InspirationKind360,version:number):boolean {
  if(!isTraitLinks362(version))return false;
  for(const id of p.traits??[])if(DISALLOWED_INSPIRATIONS[id]?.includes(kind))return true;
  return false;
}

/** TorturedArtist forcedPassions Artistic (PawnGenerator.GenerateSkills:
 * CreatePassion(force) gives at least a minor passion to a skill that is not
 * totally disabled). Elsewhere's passions are drawn before the traits, by its
 * own distribution: the forced passion is added afterwards, without a draw. */
export function traitForcedPassions362(pawn:Pawn):void {
  if(!pawn.traits?.includes('tortured-artist')||backgroundSkillRefusal(pawn,'artistic'))return;
  const art=pawn.skills.artistic;
  if(art&&!art.passion)art.passion=1;
}

/** Wimp: PainShockThreshold offset −0.5 on Core's base 0.8. The threshold is
 * read by every status check from the medical record alone, so a wimp's
 * record carries it: created at birth (wimp-record-362.ts; the trait never
 * changes afterwards) and copied with the record wherever the record goes. */
export const PAIN_SHOCK_THRESHOLD_362=.8,WIMP_PAIN_SHOCK_THRESHOLD_362=.3;
export const painShockThreshold362=(record:Pick<MedicalRecord,'wimp362'>):number=>record.wimp362?WIMP_PAIN_SHOCK_THRESHOLD_362:PAIN_SHOCK_THRESHOLD_362;
/** Strict: the marker is `true`, from 362, on a human record only. */
export function validWimpRecordField362(record:Record<string,unknown>,version:number,human:boolean):boolean {
  if(!Object.hasOwn(record,'wimp362'))return true;
  return isTraitLinks362(version)&&human&&record.wimp362===true;
}
/** A person's record carries the marker exactly when the person is a wimp. */
export function wimpRecordMatches362(item:Record<string,unknown>):boolean {
  const traits=item.traits,health=item.health as Record<string,unknown>|undefined;
  const wimp=Array.isArray(traits)&&traits.includes('wimp');
  return wimp?!!health&&health.wimp362===true:!health||!Object.hasOwn(health,'wimp362');
}

/** MentalState.causedByMood: Core gives the recovery thought (Catharsis) and
 * the trait inspiration chance only to a mood-caused state. A trait's random
 * state (TraitMentalStateGiver) and an addiction's binge are not caused by
 * mood: from 362 such a crisis is marked when it starts. */
export function markCrisisNotMood362(version:number,pawn:Pawn):void {
  const crisis=pawn.mental?.crisis;
  if(isTraitLinks362(version)&&crisis)crisis.notMood362=true;
}
