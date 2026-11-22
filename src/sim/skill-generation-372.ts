import { schemaAtLeast } from './schema-range.ts';
import { BACKGROUND_SKILL_IDS,adulthoodDefinition,backgroundSkillRefusal,childhoodDefinition,type BackgroundSkillId,type ColonistBackground } from './colonist-backgrounds.ts';
import { isCoreBackstoryId370 } from './core-backstories-370.ts';
import { biologicalYears } from './human-age.ts';
import { TRAITS,type TraitId } from './traits.ts';
import type { PawnSkills,SkillRecord } from './skills.ts';
import type { Pawn } from './types.ts';

/** Schema 372: Core's skill and passion generation for a newborn adult
 * (RimWorld 1.6 PawnGenerator.GenerateSkills and FinalLevelOfSkill), for a
 * person whose backstories are Core's (schema 370 draw). Rewritten from the
 * decompiled behaviour; no Ludeon text or code is copied.
 *
 * Core facts:
 * - order: GiveAppropriateBioAndNameTo, GenerateTraits, GenerateBodyType,
 *   GenerateGenes, then GenerateSkills; the skills are taken in SkillDefs
 *   order (Skills.xml: Shooting, Melee, Construction, Mining, Cooking, Plants,
 *   Animals, Crafting, Artistic, Medicine, Social, Intellectual);
 * - FinalLevelOfSkill: a base of Rand.RangeInclusive(0,4) when the SkillDef is
 *   usuallyDefinedInBackstories (every skill but Animals), else
 *   Rand.ByCurve(LevelRandomCurve); each backstory (childhood, then
 *   adulthood) adds amount × Rand.Range(1,1.4) for its gain in this skill;
 *   each trait degree adds its skill gain; then × Rand.Range(1,
 *   AgeSkillMaxFactorCurve(age)) (no draw while the curve is at most 1, i.e.
 *   up to 35 years), × AgeSkillFactor(age), LevelFinalAdjustmentCurve, the
 *   kind's extraSkillLevels when positive (0 for every Core kind), the
 *   kind's skill range (a new Rand.RangeInclusive inside it when outside),
 *   then Mathf.RoundToInt (banker's rounding) clamped to 0–20. The age is the
 *   whole number of biological years. A totally disabled skill keeps its
 *   computed level (SkillRecord.GetLevel then reads 0);
 * - passions: 5 + Clamp(Rand.Gaussian(), -4, 4) points, spent while at least
 *   1 is left: a major passion (1.5 points) when at least 1.5 is left and
 *   Rand.Bool, else a minor one (1 point); first the trait-forced passions
 *   (TraitDef.forcedPassions, CreatePassion(force): a major one while any is
 *   left, else a minor one even without points), then every skill by
 *   descending level (stable), skipping totally disabled skills and the
 *   skills a trait conflicts with (TraitDef.conflictingPassions). A skill may
 *   be visited twice (forced, then by level), as in Core.
 * Elsewhere's private birth stream replaces Verse.Rand (same draw order, not
 * the same numbers); single-precision arithmetic is reproduced. */
export const SKILLS_SCHEMA_372=372;
export const isSkills372=schemaAtLeast(SKILLS_SCHEMA_372);
/** A birth that takes Core's skills: schema 372 and Core backstories. */
export const coreSkillBirth372=(version:number,background:ColonistBackground|undefined):boolean=>
  isSkills372(version)&&!!background&&isCoreBackstoryId370(background.childhood);

type Curve=readonly (readonly [number,number])[];
const f=Math.fround;
const curve=(points:readonly (readonly [number,number])[]):Curve=>Object.freeze(points.map(([x,y])=>Object.freeze([f(x),f(y)] as const)));
/** PawnGenerator's static curves. */
export const AGE_SKILL_MAX_FACTOR_CURVE_372=curve([[0,0],[10,.7],[35,1],[60,1.6]]);
export const AGE_SKILL_FACTOR_CURVE_372=curve([[3,.2],[18,1]]);
export const LEVEL_FINAL_ADJUSTMENT_CURVE_372=curve([[0,0],[10,10],[20,16],[27,20]]);
export const LEVEL_RANDOM_CURVE_372=curve([[0,0],[.5,150],[4,150],[5,25],[10,5],[15,0]]);
/** SkillDef.usuallyDefinedInBackstories is false for Animals only. */
const BASE_BY_CURVE:ReadonlySet<BackgroundSkillId>=new Set(['animals']);
/** TraitDef.forcedPassions / conflictingPassions in Core 1.6 (Traits_Singular.xml). */
export const TRAIT_FORCED_PASSIONS_372:Readonly<Partial<Record<TraitId,readonly BackgroundSkillId[]>>>=Object.freeze({'tortured-artist':Object.freeze(['artistic'] as const)});
export const TRAIT_CONFLICTING_PASSIONS_372:Readonly<Partial<Record<TraitId,readonly BackgroundSkillId[]>>>=Object.freeze({brawler:Object.freeze(['shooting'] as const)});
/** PawnKindDef.skills (Core 1.6): the human kinds with a skill range. */
export const CORE_KIND_SKILL_RANGES_372:Readonly<Record<string,Readonly<Partial<Record<BackgroundSkillId,readonly [number,number]>>>>>=Object.freeze({
  Mercenary_Gunner:{shooting:[4,14]},Mercenary_Gunner_Acidifier:{shooting:[4,14]},
  Mercenary_Sniper:{shooting:[8,16]},Mercenary_Sniper_Acidifier:{shooting:[8,16]},
  Mercenary_Elite:{shooting:[10,15]},Mercenary_Elite_Acidifier:{shooting:[10,15]},
  AncientSoldier:{shooting:[4,18]},StrangerInBlack:{shooting:[8,16]},
});

const clamp01=(t:number):number=>t<0?0:t>1?1:t;
/** Mathf.Lerp (t clamped). */
const lerp=(a:number,b:number,t:number):number=>f(a+f(f(b-a)*clamp01(t)));
/** SimpleCurve.Evaluate. */
export function evaluateCurve372(points:Curve,x:number):number {
  const first=points[0]!,last=points[points.length-1]!;
  if(x<=first[0])return first[1];
  if(x>=last[0])return last[1];
  const index=points.findIndex(p=>x<=p[0]);
  const a=points[index-1]!,b=points[index]!;
  return lerp(a[1],b[1],f(f(x-a[0])/f(b[0]-a[0])));
}
/** Rand.Range(float, float): no draw when the range is empty. */
const rangeFloat=(draw:()=>number,min:number,max:number):number=>max<=min?min:f(f(f(draw())*f(max-min))+min);
/** Rand.RangeInclusive(int, int). */
const rangeInclusive=(draw:()=>number,min:number,max:number):number=>max<=min?min:min+Math.min(max-min,Math.floor(draw()*(max-min+1)));
/** Mathf.Clamp: a NaN goes through unchanged. */
const clamp=(v:number,min:number,max:number):number=>v<min?min:v>max?max:v;
/** Rand.Gaussian (Box–Muller on two values). */
const gaussian=(draw:()=>number):number=>{const a=f(draw()),b=f(draw());return f(f(Math.sqrt(f(-2*f(Math.log(a)))))*f(Math.sin(f(f(Math.PI*2)*b))));};
/** Rand.ByCurve: a segment by area, a uniform point in it, then the
 * reflection that makes the density follow the segment's slope. */
export function byCurve372(points:Curve,draw:()=>number):number {
  let total=0;
  for(let i=0;i<points.length-1;i++)total=f(total+f(f(points[i+1]![0]-points[i]![0])*f(points[i]![1]+points[i+1]![1])));
  let left=rangeFloat(draw,0,total);
  for(let j=0;j<points.length-1;j++){
    const a=points[j]!,b=points[j+1]!,area=f(f(b[0]-a[0])*f(a[1]+b[1]));
    // Core throws past the last segment; a float residue keeps the last one.
    if(area<left&&j<points.length-2){left=f(left-area);continue;}
    const width=f(b[0]-a[0]);let x=f(left/f(a[1]+b[1]));
    if(rangeFloat(draw,0,f(f(a[1]+b[1])/2))>lerp(a[1],b[1],f(x/width)))x=f(width-x);
    return f(x+a[0]);
  }
  return points[points.length-1]![0];
}
/** Mathf.RoundToInt: Math.Round, halves to even. */
export function roundToInt372(x:number):number {
  const r=Math.round(x);
  return Math.abs(x%1)===.5&&r%2!==0?r-1:r;
}

export interface CoreSkillBirth372 {
  /** Sequential uniform [0,1) stream, private to this birth. */
  draw:()=>number;
  /** Whole biological years. */
  ageYears:number;
  background:ColonistBackground;
  traits:readonly TraitId[];
  /** Core PawnKindDef defName, for its skill ranges. */
  kind?:string;
}
export interface CoreSkill372 {level:number;passion:0|1|2}
const disabled=(birth:CoreSkillBirth372,skill:BackgroundSkillId):boolean=>backgroundSkillRefusal({background:birth.background,traits:[...birth.traits]},skill)!==undefined;
/** FinalLevelOfSkill for one skill (adult request). */
function finalLevel(birth:CoreSkillBirth372,skill:BackgroundSkillId):number {
  const {draw}=birth;
  let num=BASE_BY_CURVE.has(skill)?byCurve372(LEVEL_RANDOM_CURVE_372,draw):rangeInclusive(draw,0,4);
  const stories=[childhoodDefinition(birth.background.childhood),...birth.background.adulthood?[adulthoodDefinition(birth.background.adulthood)]:[]];
  for(const story of stories){const gain=story.gains[skill];if(gain!==undefined)num=f(num+f(gain*rangeFloat(draw,1,1.4)));}
  for(const id of birth.traits){const gain=TRAITS[id].skillGains?.[skill];if(gain!==undefined)num=f(num+gain);}
  num=f(num*rangeFloat(draw,1,evaluateCurve372(AGE_SKILL_MAX_FACTOR_CURVE_372,birth.ageYears)));
  num=f(num*evaluateCurve372(AGE_SKILL_FACTOR_CURVE_372,birth.ageYears));
  num=evaluateCurve372(LEVEL_FINAL_ADJUSTMENT_CURVE_372,num);
  const range=birth.kind!==undefined&&Object.hasOwn(CORE_KIND_SKILL_RANGES_372,birth.kind)?CORE_KIND_SKILL_RANGES_372[birth.kind]![skill]:undefined;
  if(range&&(num<range[0]||num>range[1]))num=rangeInclusive(draw,range[0],range[1]);
  return Math.min(20,Math.max(0,roundToInt372(num)));
}
/** GenerateSkills: the levels in SkillDefs order, then the passions. */
export function generateCoreSkills372(birth:CoreSkillBirth372):Record<BackgroundSkillId,CoreSkill372> {
  const result={} as Record<BackgroundSkillId,CoreSkill372>;
  for(const skill of BACKGROUND_SKILL_IDS)result[skill]={level:finalLevel(birth,skill),passion:0};
  let minor=0,major=0,points=f(5+clamp(gaussian(birth.draw),-4,4));
  while(points>=1){
    if(points>=1.5&&birth.draw()<.5){major++;points=f(points-1.5);}
    else{minor++;points=f(points-1);}
  }
  const create=(skill:BackgroundSkillId,force=false):void=>{
    if(major>0){result[skill].passion=2;major--;}
    else if(minor>0||force){result[skill].passion=1;minor--;}
  };
  const off=new Set(BACKGROUND_SKILL_IDS.filter(skill=>disabled(birth,skill)));
  for(const skill of BACKGROUND_SKILL_IDS){
    if(off.has(skill))continue;
    for(const id of birth.traits)if(TRAIT_FORCED_PASSIONS_372[id]?.includes(skill))create(skill,true);
  }
  // Under 13 Core gives growth-moment passions instead; Elsewhere births
  // adults only (18 years or more), so that branch is never reached.
  if(birth.ageYears<13)return result;
  const order=[...BACKGROUND_SKILL_IDS].sort((a,b)=>(off.has(b)?0:result[b].level)-(off.has(a)?0:result[a].level));
  for(const skill of order){
    if(off.has(skill)||birth.traits.some(id=>TRAIT_CONFLICTING_PASSIONS_372[id]?.includes(skill)))continue;
    create(skill);
  }
  return result;
}

const hash=(seed:number,identity:number,salt:number):number=>{
  let n=(seed^Math.imul(identity,0x9e3779b1)^salt)>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
};
/** A private sequential birth stream (seed and identity of the person),
 * never a shared simulation stream. */
export function skillStream372(seed:number,identity:number):()=>number {
  let counter=0;return ()=>hash(seed^0x372c5a1,identity,0x3720000+counter++)/0x100000000;
}
/** The skill records of a Core birth: every skill, no experience. */
export function coreSkillRecords372(birth:CoreSkillBirth372,lastResetTick:number):PawnSkills {
  const generated=generateCoreSkills372(birth),skills={lastResetTick} as PawnSkills;
  const records=skills as unknown as Record<BackgroundSkillId,SkillRecord>;
  for(const skill of BACKGROUND_SKILL_IDS)records[skill]={level:generated[skill].level,xp:0,dailyXp:0,passion:generated[skill].passion};
  return skills;
}
/** Give a Core-born person (background and traits already set) its skills
 * and passions. `kind` is its Core PawnKindDef, for a skill range. */
export function giveCoreSkills372(pawn:Pawn,draw:()=>number,kind?:string):void {
  if(!pawn.background)return;
  pawn.skills=coreSkillRecords372({draw,ageYears:pawn.age?biologicalYears(pawn.age):30,background:pawn.background,traits:pawn.traits??[],...kind!==undefined?{kind}:{}},pawn.skills.lastResetTick);
}
