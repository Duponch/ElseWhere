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
export const workPriority=(pawn:Pick<Pawn,'priorities'|'background'>,work:WorkType):number=>backgroundWorkRefusal(pawn,work)?0:storedPriority(pawn,work);
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
