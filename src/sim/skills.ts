import { globalLearningFactor } from './traits.ts';
import { BACKGROUND_SKILL_IDS, backgroundSkillRefusal } from './colonist-backgrounds.ts';
import { effectiveSkillLevel } from './work-types.ts';
import { devGodMode } from './dev-session.ts';
import { TICKS_PER_DAY, type Job, type Pawn, type World } from './types.ts';
import { isConstruction } from './construction-rules.ts';
import { constructionRecipe } from './construction-materials.ts';

/** Millipoints, not a rounded percentage. Core 200 ticks = 20 local ticks. */
export const XP_SCALE = 1000;
export interface SkillRecord { level:number; xp:number; dailyXp:number; passion:0|1|2 }
/** Add a skill only when its producer and consumer are implemented. */
export interface PawnSkills { mining?:SkillRecord; plants?:SkillRecord; animals?:SkillRecord; artistic?:SkillRecord; cooking?:SkillRecord; intellectual?:SkillRecord; crafting?:SkillRecord; social?:SkillRecord; construction:SkillRecord; medicine:SkillRecord; shooting:SkillRecord; melee:SkillRecord; lastResetTick:number }
export const xpRequired = (level:number):number => (level <= 9 ? 1000*(level+1) : 10000+2000*(Math.min(level,19)-9))*XP_SCALE;
export const learningFactor = (skill:SkillRecord,pawn?:Pick<Pawn,'traits'>):number => (pawn?globalLearningFactor(pawn):1)* [0.35,1,1.5][skill.passion]!*(skill.dailyXp>4000*XP_SCALE ? .2 : 1);
export const constructionSpeed = (pawn:Pawn):number => (3000+875*effectiveSkillLevel(pawn,'construction',pawn.skills.construction.level))/10000;
const decay = [100,200,400,600,1000,1800,2800,4000,6000,8000,12000];

export function initialSkills(level=8,passion:0|1|2=0,lastResetTick=-1):PawnSkills {
  return {cooking:{level:8,xp:0,dailyXp:0,passion:0},melee:{level:8,xp:0,dailyXp:0,passion:0},shooting:{level:8,xp:0,dailyXp:0,passion:0},construction:{level,xp:0,dailyXp:0,passion},medicine:{level:8,xp:0,dailyXp:0,passion:0},lastResetTick};
}
/** Scenario choices, not a random biography generator or Core distribution. */
export function startingSkills(index:number):PawnSkills {
  const skills=initialSkills([8,10,4][index%3]!,([1,2,0] as const)[index%3]!);
  skills.mining={level:8,xp:0,dailyXp:0,passion:([1,0,1] as const)[index%3]!};
  skills.plants={level:8,xp:0,dailyXp:0,passion:([1,0,1] as const)[index%3]!};
  skills.animals={level:[8,4,2][index%3]!,xp:0,dailyXp:0,passion:0};
  skills.cooking!.level=[8,4,6][index%3]!;skills.cooking!.passion=([1,0,0] as const)[index%3]!;
  skills.intellectual={level:[8,3,6][index%3]!,xp:0,dailyXp:0,passion:([1,0,0] as const)[index%3]!};skills.medicine.level=[6,3,8][index%3]!;skills.medicine.passion=([1,0,2] as const)[index%3]!;skills.shooting.level=[8,5,3][index%3]!;skills.shooting.passion=([1,0,0] as const)[index%3]!;return skills;
}
export function learnSkill(skill:SkillRecord,baseUnits:number,pawn?:Pick<Pawn,'traits'|'background'>&Partial<Pick<Pawn,'skills'>>):void {
  if(pawn?.background&&pawn.skills){
    const id=BACKGROUND_SKILL_IDS.find(id=>pawn.skills![id]===skill);
    if(id&&backgroundSkillRefusal(pawn,id))return;
  }
  const units=baseUnits>0 ? Math.round(baseUnits*learningFactor(skill,pawn)) : baseUnits;
  if(units<0&&skill.level===0)return;
  skill.xp+=units;skill.dailyXp+=units;
  while(skill.level<20&&skill.xp>=xpRequired(skill.level)) {skill.xp-=xpRequired(skill.level);skill.level++;}
  if(skill.level===20)skill.xp=Math.min(skill.xp,xpRequired(20)-XP_SCALE);
  // Core permits a debt below zero before losing a level, down to -1000 XP.
  while(skill.xp<=-1000*XP_SCALE&&skill.level>0) {
    skill.level--;skill.xp+=xpRequired(skill.level);
    if(skill.level===0)skill.xp=0;
  }
}
/** Staggered cadence derived from saved tick/id; no clock/cache per actor. */
export function tickSkills(world:World,pawn:Pawn):void {tickSkillsAt(pawn,world.tick);}
export function tickSkillsAt(pawn:Pawn,tick:number):void {
  if((tick%20+pawn.id%20)%20!==0)return;
  const skills=pawn.skills;
  if(tick%TICKS_PER_DAY<TICKS_PER_DAY/24&&(skills.lastResetTick<0||tick-skills.lastResetTick>=TICKS_PER_DAY/2)) {
    skills.lastResetTick=tick;skills.construction.dailyXp=0;skills.medicine.dailyXp=0;skills.shooting.dailyXp=0;skills.melee.dailyXp=0;if(skills.mining)skills.mining.dailyXp=0;if(skills.plants)skills.plants.dailyXp=0;if(skills.animals)skills.animals.dailyXp=0;if(skills.artistic)skills.artistic.dailyXp=0;if(skills.social)skills.social.dailyXp=0;if(skills.crafting)skills.crafting.dailyXp=0;if(skills.intellectual)skills.intellectual.dailyXp=0;if(skills.cooking)skills.cooking.dailyXp=0;
  }
  for(const skill of [skills.construction,skills.medicine,skills.shooting,skills.melee,...skills.mining?[skills.mining]:[],...skills.plants?[skills.plants]:[],...skills.animals?[skills.animals]:[],...skills.artistic?[skills.artistic]:[],...skills.social?[skills.social]:[],...skills.crafting?[skills.crafting]:[],...skills.intellectual?[skills.intellectual]:[],...skills.cooking?[skills.cooking]:[]]){const loss=decay[skill.level-10];if(loss)learnSkill(skill,-(pawn.traits?.includes('great-memory')?loss/2:loss),pawn);}
}
export function usesConstructionSkill(job:Job):boolean {
  return !job.clearance&&(isConstruction(job)||job.kind==='remove-bridge'||job.kind==='remove-floor'||job.kind==='deconstruct'||job.kind==='uninstall'||job.kind==='install'||job.kind==='build-roof'||job.kind==='remove-roof');
}
/** Called only at the physically reached, executable work phase. */
export function constructionWorkRate(pawn:Pawn,job:Job,light:number,body?:import('./body-capacities.ts').BodyAssessment):number {
  if(!usesConstructionSkill(job))return light*physicalWorkFactor(pawn,'plant',body);
  // Developer mode, god mode: construction work is instant (Core's god mode builds at once).
  if(devGodMode()&&usesConstructionSkill(job))return 1e6;
  // Learning precedes the stat query, as in ConstructFinishFrame.
  if(job.kind==='deconstruct'||isConstruction(job)&&!job.furniture) {
    const recipe=job.kind==='deconstruct'&&job.deconstruction ? constructionRecipe(job.deconstruction) : constructionRecipe(job);
    if(recipe.ingredients.length>0)learnSkill(pawn.skills.construction,2500,pawn);
  }
  return light*constructionSpeed(pawn)*physicalWorkFactor(pawn,'build',body)*((job.kind==='remove-bridge'||job.kind==='remove-floor')?1.7:1);
}
import { physicalWorkFactor } from './health-rules.ts';
