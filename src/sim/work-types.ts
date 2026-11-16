import { backgroundWorkRefusal, backgroundSkillRefusal, type BackgroundSkillId } from './colonist-backgrounds.ts';
import type { HaulDestination, Job, Pawn, WorkType } from './types.ts';

/** Provider identity is separate from assignment and from a temporary forced
 * priority. These queries do not reserve or change the saved work table. */
export const workType=(job:Pick<Job,'kind'|'growingZoneId'|'flowerPotId'|'installationWork'>):WorkType=>job.kind==='extract-tree'?'gather':job.kind==='replant-tree'?'grow':job.kind==='flick'?'basic':job.kind==='mine'?'mine':job.installationWork??(job.growingZoneId!==undefined||job.flowerPotId!==undefined||job.kind==='sow'?'grow':['chop','harvest','cut'].includes(job.kind)?'gather':'build');
/** Smithing and Tailoring have their own priority since schema 302 (Core's
 * Smithing, Tailoring and Crafting work types). A pawn without one (an older
 * save, or a priority never set apart) smiths and tails at its crafting
 * priority, exactly as before. */
export const storedPriority=(pawn:Pick<Pawn,'priorities'>,work:WorkType):number=>work==='smith'||work==='tailor'?pawn.priorities[work]??pawn.priorities.craft:pawn.priorities[work];
/** Core's Pawn_WorkSettings.GetPriority answers 3 for every enabled work type
 * while the Work tab is simple (schema 344, see work-tab-344.ts). The engine
 * sets this around each step and command of a campaign in that mode, so every
 * reader of workPriority (work-giver order included) sees the same value; the
 * stored manual priority is kept for a return to manual priorities. Outside
 * those calls, and below schema 344, the stored priority is read as before. */
let simpleWorkTab=false;
export function withWorkTabMode344<R>(simple:boolean,run:()=>R):R {
  const previous=simpleWorkTab;simpleWorkTab=simple;
  try{return run();}finally{simpleWorkTab=previous;}
}
/** The mode of the current step or command (false outside them). */
export const workTabIsSimple344=():boolean=>simpleWorkTab;
export const workPriority=(pawn:Pick<Pawn,'priorities'|'background'>,work:WorkType):number=>{
  const value=backgroundWorkRefusal(pawn,work)?0:storedPriority(pawn,work);
  return simpleWorkTab&&value>0?3:value;
};
/** Whether disabling `changed` disables the running work `running`: the same
 * work type, or crafting for smithing or tailoring that still follow it (an
 * older save; from schema 302 a change of the crafting priority first sets
 * the three apart). */
export const disablesWork=(world:{schemaVersion:unknown},pawn:Pick<Pawn,'priorities'>,changed:WorkType,running:WorkType):boolean=>changed===running
  ||changed==='craft'&&(running==='smith'||running==='tailor')&&Number(world.schemaVersion)<302&&pawn.priorities[running]===undefined;
/** Some non-work activities still consume a skill; keep its stored record. */
export const effectiveSkillLevel=(pawn:Pick<Pawn,'background'>,skill:BackgroundSkillId,storedLevel:number):number=>backgroundSkillRefusal(pawn,skill)?0:storedLevel;
/** Physical carrying belongs to its provider: builders/growers/cooks/crafters can carry
 * their own materials without being admitted to general hauling. */
export const haulingWork=(destination:HaulDestination):WorkType=>destination.type==='stockpile'&&destination.forHunting?'hunt':destination.type==='job'&&destination.forConstruction||destination.type==='aside'&&destination.forConstruction?'build':destination.type==='aside'?destination.constructionId===undefined?'grow':'haul':destination.type==='fuel'?(destination.forCrafting?'craft':destination.forCooking?'cook':'haul'):'haul';
