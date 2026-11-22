import { CORE_TRAIT_DEFS,CORE_TRAIT_DEF_NAMES,TRAITS,isTraitsSchema361,traitDefCommonality,traitDefsConflict,type CoreTraitDefName,type TraitId } from './traits.ts';
import { BACKGROUND_SKILL_IDS,backgroundSkillRefusal,backgroundTagRefusal,type BackgroundSkillId,type ColonistBackground } from './colonist-backgrounds.ts';
import { HUMAN_YEAR_TICKS } from './human-age.ts';
import type { SkillRecord } from './skills.ts';
import type { Pawn } from './types.ts';
import { traitForcedPassions362 } from './trait-links-362.ts';
import { bornWimpRecord362 } from './wimp-record-362.ts';

/** Schema 361: Core PawnGenerator.GenerateTraits for a newly born human,
 * with no pawn-kind or backstory forced/disallowed traits (Elsewhere's own
 * backstories map to none of Core's). Every draw is a private hash of the
 * birth identity: no simulation, arrival or generation stream moves.
 *
 * Core facts (PawnGenerator, TraitDef, GrowthUtility):
 * - count: TraitsCountRange IntRange(1,3), capped by the growth birthdays
 *   7, 10 and 13 already reached; one GenerateTraitsFor(1) per birthday;
 * - each attempt draws a TraitDef by (gender-specific) commonality, up to
 *   501 attempts, and refuses a held def, a conflict (lists and exclusion
 *   tags), a required work tag the person cannot do, a trait refused on a
 *   hostile spawn, then a uniform degree;
 * - the mental break threshold check reads Core's 5-tick stat cache, i.e. the
 *   threshold before this generation (0.35 here): no Core trait exceeds 0.50;
 * - a sexuality trait is then drawn if none was: no trait with the summed
 *   commonality of every other def not held, against Gay 0.3, Bisexual 0.2
 *   and Asexual 0.2 (Biotech's age gate does not apply in Core).
 * Defs left out of this game are never drawn: the others share their
 * weight. Schema 362 adds Undergrounder, Tortured artist and Wimp, schema 368
 * Pyromaniac (no requiredWorkTags, no conflict); a birth of an older schema
 * keeps its own set, so its draws stay identical. */
export interface TraitBirth361 {
  /** Uniform [0,1) for a salt, private to this birth. */
  draw:(salt:number)=>number;
  sex:'male'|'female'|'none';
  ageYears:number;
  background?:ColonistBackground;
  hostile?:boolean;
  /** The schema of the birth (default 361): it decides which degrees exist. */
  schema?:number;
}
const GROWTH_MOMENT_AGES=[7,10,13] as const;
const SALT_COUNT=0x3610001,SALT_SEXUALITY=0x3610002,SALT_DEF=0x3611000,SALT_DEGREE=0x3618000;
const ATTEMPTS=501;
const MAX_BREAK_THRESHOLD=50,BREAK_BASE=35;

function weightedDef(defs:readonly CoreTraitDefName[],weight:(def:CoreTraitDefName)=>number,roll:number):CoreTraitDefName|undefined {
  const total=defs.reduce((s,def)=>s+weight(def),0);if(total<=0)return undefined;
  let left=roll*total;
  for(const def of defs){const w=weight(def);if(w<=0)continue;left-=w;if(left<0)return def;}
  return defs.findLast(def=>weight(def)>0);
}
/** The degrees a birth of `schema` may receive (361: the 361 set; 362 adds
 * three defs; 368 adds Pyromaniac). */
const degreesAt=(def:CoreTraitDefName,schema:number):readonly TraitId[]=>CORE_TRAIT_DEFS[def].degrees.filter(id=>(TRAITS[id].since??0)<=schema);
const drawableAt=(schema:number)=>Object.freeze(CORE_TRAIT_DEF_NAMES.filter(def=>degreesAt(def,schema).length>0));
const DRAWABLE=drawableAt(361),DRAWABLE_362=drawableAt(362),DRAWABLE_368=drawableAt(368);
function drawOne(birth:TraitBirth361,held:readonly TraitId[],slot:number):TraitId|undefined {
  const heldDefs=held.map(id=>TRAITS[id].def),schema=birth.schema??361,drawable=schema>=368?DRAWABLE_368:schema>=362?DRAWABLE_362:DRAWABLE;
  for(let attempt=0;attempt<ATTEMPTS;attempt++){
    const def=weightedDef(drawable,d=>traitDefCommonality(d,birth.sex),birth.draw(SALT_DEF+slot*0x800+attempt));
    if(!def||heldDefs.includes(def))continue;
    const data=CORE_TRAIT_DEFS[def];
    if(birth.hostile&&!data.allowOnHostileSpawn)continue;
    if(heldDefs.some(o=>traitDefsConflict(o,def)))continue;
    if(birth.background&&data.requiredWorkTags.some(tag=>backgroundTagRefusal({background:birth.background},tag)!==undefined))continue;
    // Schema 362, TraitDef.forcedPassions: a trait forcing a passion for a
    // skill the person cannot use is refused (Tortured artist: Art).
    if(birth.background&&def==='TorturedArtist'&&backgroundSkillRefusal({background:birth.background},'artistic')!==undefined)continue;
    const degrees=degreesAt(def,schema);
    const id=degrees[Math.min(degrees.length-1,Math.floor(birth.draw(SALT_DEGREE+slot*0x800+attempt)*degrees.length))]!;
    if(BREAK_BASE+TRAITS[id].breakOffset>MAX_BREAK_THRESHOLD)continue;
    return id;
  }
  return undefined;
}
export function drawCoreTraits361(birth:TraitBirth361):TraitId[] {
  const traits:TraitId[]=[];
  const count=1+Math.min(2,Math.floor(birth.draw(SALT_COUNT)*3));
  const moments=GROWTH_MOMENT_AGES.filter(age=>age<=Math.floor(birth.ageYears)).length;
  for(let slot=0;slot<moments&&traits.length<count;slot++){const id=drawOne(birth,traits,slot);if(id)traits.push(id);}
  if(!traits.some(id=>CORE_TRAIT_DEFS[TRAITS[id].def].sexuality)){
    const heldDefs=traits.map(id=>TRAITS[id].def);
    const none=CORE_TRAIT_DEF_NAMES.filter(def=>!heldDefs.includes(def)&&!CORE_TRAIT_DEFS[def].sexuality).reduce((s,def)=>s+traitDefCommonality(def,birth.sex),0);
    const options=[[undefined,none],['gay',traitDefCommonality('Gay',birth.sex)],['bisexual',traitDefCommonality('Bisexual',birth.sex)],['asexual',traitDefCommonality('Asexual',birth.sex)]] as const;
    let left=birth.draw(SALT_SEXUALITY)*options.reduce((s,o)=>s+o[1],0);
    for(const [id,w] of options){left-=w;if(left<0){if(id)traits.push(id);break;}}
  }
  return traits;
}
/** Core skill gains of the drawn traits (FinalLevelOfSkill adds them to the
 * birth level), clamped like background gains. A missing skill record is
 * created only for a positive gain. */
export function applyTraitSkillGains361(skills:Pawn['skills'],traits:readonly TraitId[]):void {
  const record=skills as unknown as Partial<Record<BackgroundSkillId,SkillRecord>>;
  for(const id of traits)for(const skill of BACKGROUND_SKILL_IDS){
    const gain=TRAITS[id].skillGains?.[skill];if(!gain)continue;
    const old=record[skill];
    if(old)record[skill]={...old,level:Math.min(20,Math.max(0,old.level+gain))};
    else if(gain>0)record[skill]={level:Math.min(20,gain),xp:0,dailyXp:0,passion:0};
  }
}
/** Core TraitDef.conflictingPassions: no passion is created for these skills. */
export const traitForbidsPassion361=(traits:readonly TraitId[]|undefined,skill:BackgroundSkillId):boolean=>skill==='shooting'&&!!traits?.includes('brawler');

const hash=(seed:number,identity:number,salt:number):number=>{
  let n=(seed^Math.imul(identity,0x9e3779b1)^salt)>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
};
/** A private birth channel: the world seed (or an owner's own seed) and the
 * person's identity, never a shared stream. */
export const traitBirthDraw361=(seed:number,identity:number)=>(salt:number):number=>hash(seed^0x3617a17,identity,salt)/0x100000000;
const ageYears=(pawn:Pick<Pawn,'age'>):number=>pawn.age?pawn.age.biologicalTicks/HUMAN_YEAR_TICKS:30;
/** Give a newly born human its Core traits (schema 361). Called once, after
 * the background (its work tags decide what may be drawn). Authored or
 * already held traits are kept. */
export function giveBornTraits361(w:{readonly schemaVersion:number;readonly seed:number;readonly tick?:number},pawn:Pawn,hostile=false,seed=w.seed):void {
  if(!isTraitsSchema361(w.schemaVersion)||pawn.traits!==undefined)return;
  const traits=drawCoreTraits361({draw:traitBirthDraw361(seed,pawn.id),sex:pawn.appearance?.sex??'none',ageYears:ageYears(pawn),...pawn.background?{background:pawn.background}:{},hostile,...w.schemaVersion>=362?{schema:w.schemaVersion}:{}});
  if(!traits.length)return;
  pawn.traits=traits;bornTraitEffects361(pawn,w.tick??0);
}
/** The birth effects of the traits a new person holds: skill gains, and no
 * passion a trait forbids. */
export function bornTraitEffects361(pawn:Pawn,tick=0):void {
  const traits=pawn.traits??[];applyTraitSkillGains361(pawn.skills,traits);
  for(const skill of BACKGROUND_SKILL_IDS){const r=(pawn.skills as unknown as Partial<Record<BackgroundSkillId,SkillRecord>>)[skill];if(r?.passion&&traitForbidsPassion361(traits,skill))r.passion=0;}
  // Schema 362 traits only (none exists in an older world).
  traitForcedPassions362(pawn);bornWimpRecord362(pawn,tick);
}
/** An arrival offer is shown before the person (and its sex) exists. */
export function offeredTraits361(seed:number,identity:number,age:Pawn['age'],background:ColonistBackground|undefined,schema=361):TraitId[]|undefined {
  const traits=drawCoreTraits361({draw:traitBirthDraw361(seed^0x361a77,identity),sex:'none',ageYears:ageYears({age}),...background?{background}:{},...schema>=362?{schema}:{}});
  return traits.length?traits:undefined;
}
