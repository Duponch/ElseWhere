import { ADULTHOODS, BACKGROUND_ADULT_MIN_TICKS, BACKGROUND_SKILL_IDS, CHILDHOODS, backgroundGains, type ColonistBackground, type ElsewhereChildhoodId as ChildhoodId, type ElsewhereAdulthoodId as AdulthoodId } from './colonist-backgrounds.ts';
import { CORE_KIND_BACKSTORY_370,applyCoreBackstoryBody370,backstoryFiltersFor370,backstoryStream370,birthFactionDef370,drawAdmittedCoreBackground370,isBackstories370,pawnFactionDef370,type CoreBirth370 } from './core-backstory-draw-370.ts';
import { initialHumanAge, initialHumanAilments, type HumanAge } from './human-age.ts';
import { createMedicalRecord } from './injury-state.ts';
import { startingSkills, type PawnSkills } from './skills.ts';
import { coreSkillBirth372 } from './skill-generation-372.ts';
export { validOfferedBackground } from './background-save.ts';
import type { Pawn,World } from './types.ts';

const hash=(seed:number,identity:number,salt:number):number=>{
  let n=(seed^Math.imul(identity,0x9e3779b1)^salt)>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
};
/** Selection is private and bounded. Fighters filter out Violent, including
 * childhood restrictions, before either choice; no retry can shift combat RNG. */
export function generateBackground(seed:number,identity:number,age:HumanAge,fighter=false,negotiator=false):ColonistBackground {
  const children=(Object.keys(CHILDHOODS) as ChildhoodId[]).filter(id=>(!fighter||!CHILDHOODS[id].disables.includes('violent'))&&(!negotiator||!CHILDHOODS[id].disables.includes('social')));
  const childhood=children[hash(seed,identity,0x210c11d)%children.length]!;
  const adults=(Object.keys(ADULTHOODS) as AdulthoodId[]).filter(id=>(!fighter||!ADULTHOODS[id].disables.includes('violent'))&&(!negotiator||!ADULTHOODS[id].disables.includes('social'))&&!ADULTHOODS[id].requires.some(tag=>CHILDHOODS[childhood].disables.includes(tag)));
  return {childhood,...age.biologicalTicks>=BACKGROUND_ADULT_MIN_TICKS?{adulthood:adults[hash(seed,identity,0x210ad17)%adults.length]!}:{}};
}
function skillsWithBackground(base:PawnSkills,background:ColonistBackground):PawnSkills {
  const result={...base};
  const gains=backgroundGains(background);
  for(const key of BACKGROUND_SKILL_IDS){
    const old=base[key];
    if(old)result[key]={...old,level:Math.min(20,Math.max(0,old.level+(gains[key]??0)))};
    else if(gains[key]!==undefined)result[key]={level:Math.min(20,Math.max(0,(key==='plants'||key==='mining'?8:0)+gains[key]!)),xp:0,dailyXp:0,passion:0};
  }
  return result;
}
/** Used before acceptance; this is the same birth calculation, never learning
 * or a mutation of an offer, Pawn, existing skill record or random stream. */
export const previewBackgroundSkills=(profile:number,background:ColonistBackground):PawnSkills=>skillsWithBackground(startingSkills(profile),background);
/** Call only from a prospective birth producer. Historical offer acceptance
 * intentionally does not call it without a recorded background. */
export function assignBackground(pawn:Pawn,background:ColonistBackground):void {
  if(pawn.background!==undefined)return;
  pawn.background={...background};pawn.skills=skillsWithBackground(pawn.skills,background);
  // Schema 370 (only a Core adulthood exists there): its body type.
  applyCoreBackstoryBody370(pawn);
}
/** A birth's background. From schema 372 a Core background adds no skill
 * gain: Core's GenerateSkills reads it once the traits are drawn
 * (giveBornTraits361, skill-generation-372.ts). Below, `assignBackground`. */
export function assignBornBackground(version:number,pawn:Pawn,background:ColonistBackground):void {
  if(!coreSkillBirth372(version,background)){assignBackground(pawn,background);return;}
  if(pawn.background!==undefined)return;
  pawn.background={...background};
  applyCoreBackstoryBody370(pawn);
}
export function generatePawnBackground(pawn:Pawn,seed:number,fighter=false,negotiator=false):void {
  if(!pawn.age||pawn.background!==undefined)return;
  assignBackground(pawn,generateBackground(seed,pawn.id,pawn.age,fighter,negotiator));
}
/** A newborn NPC's background. From schema 370, Core's backstory draw
 * (core-backstory-draw-370.ts) for the person's kind and faction (its bound
 * world faction unless `core.faction` says otherwise), retried for violence
 * (`core.violent`, else `fighter`) and the kind's required work tags; Core
 * has no negotiator rule. Below 370, the historical Elsewhere draw. */
export function generateBornBackground(w:{readonly schemaVersion:number;readonly worldFactions?:World['worldFactions']},pawn:Pawn,seed:number,fighter=false,negotiator=false,core:CoreBirth370={}):void {
  if(!isBackstories370(w.schemaVersion)){generatePawnBackground(pawn,seed,fighter,negotiator);return;}
  if(!pawn.age||pawn.background!==undefined)return;
  const draw=backstoryStream370(seed,pawn.id),faction=birthFactionDef370(w,draw,core.faction,pawnFactionDef370(w,pawn)??core.fallbackFaction);
  const kind=core.kind!==undefined&&Object.hasOwn(CORE_KIND_BACKSTORY_370,core.kind)?CORE_KIND_BACKSTORY_370[core.kind]:undefined;
  assignBornBackground(w.schemaVersion,pawn,drawAdmittedCoreBackground370(draw,pawn.age.biologicalTicks,backstoryFiltersFor370(core.kind,faction),{violent:core.violent??fighter,...kind?.requiredWorkTags?{requiredWorkTags:kind.requiredWorkTags}:{}}));
}
/** The three authored starters cover the physical economy and at least two
 * defenders. Their established traits/passions remain a scenario adaptation. */
export function initializeCampBackgrounds(world:World):void {
  const children:readonly ChildhoodId[]=['workshop-child','field-child','school-child'];
  const adults:readonly AdulthoodId[]=['builder','farmer','medic'];
  world.pawns.forEach((pawn,index)=>{
    if(!pawn.age||pawn.background)return;
    assignBackground(pawn,{childhood:children[index%3]!,...pawn.age.biologicalTicks>=BACKGROUND_ADULT_MIN_TICKS?{adulthood:adults[index%3]!}:{}});
  });
}
export interface OfferedBackground {age?:HumanAge;background?:ColonistBackground}
/** Identity belongs to the offer, so subsequent material/actor allocations
 * cannot change the profile already shown to the player. */
export function offeredBackground(seed:number,identity:number):Required<OfferedBackground> {
  const age=initialHumanAge(seed,identity);
  return {age,background:generateBackground(seed,identity,age)};
}
/** Schema 370: the offer's Core backstories, drawn on the same identity (the
 * same age as before). An offered joiner's faction is not the player's: its
 * bio reads a random non-colony humanlike faction, as PawnGenerator does for
 * a request without one. Below 370, `offeredBackground`. */
export function offeredBornBackground(w:{readonly schemaVersion:number;readonly worldFactions?:World['worldFactions']},seed:number,identity:number,core:CoreBirth370):Required<OfferedBackground> {
  if(!isBackstories370(w.schemaVersion))return offeredBackground(seed,identity);
  const age=initialHumanAge(seed,identity),draw=backstoryStream370(seed,identity),faction=birthFactionDef370(w,draw,core.faction,undefined);
  const kind=core.kind!==undefined&&Object.hasOwn(CORE_KIND_BACKSTORY_370,core.kind)?CORE_KIND_BACKSTORY_370[core.kind]:undefined;
  return {age,background:drawAdmittedCoreBackground370(draw,age.biologicalTicks,backstoryFiltersFor370(core.kind,faction),{violent:core.violent??false,...kind?.requiredWorkTags?{requiredWorkTags:kind.requiredWorkTags}:{}})};
}
/** `version`: the schema of the birth (from 372 a Core background adds no
 * gain, see assignBornBackground); without it, the historical rule. */
export function assignOfferedBackground(pawn:Pawn,offer:OfferedBackground,seed:number,currentTick:number,version?:number):void {
  if(pawn.background!==undefined||!offer.background||!offer.age)return;
  pawn.age={...offer.age};
  // startingPawn's allocation-time age is replaced only for this new person.
  // Recompute its birth ailments against the age actually advertised.
  if(pawn.health)delete pawn.health.ageAilments;
  const ailments=initialHumanAilments(seed,pawn.id,pawn.age);
  if(ailments.length){pawn.health??=createMedicalRecord(currentTick);pawn.health.ageAilments=ailments;}
  if(version===undefined)assignBackground(pawn,offer.background);else assignBornBackground(version,pawn,offer.background);
}
