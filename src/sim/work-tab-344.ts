import { isColonist } from './affiliation.ts';
import { backgroundWorkRefusal, type BackgroundSkillId } from './colonist-backgrounds.ts';
import { schemaAtLeast } from './schema-range.ts';
import type { CommandResult, Pawn, WorkType, World } from './types.ts';
import { RIM_WORK_TYPES } from './work-givers-rimworld.ts';
import { effectiveSkillLevel, storedPriority, workTabIsSimple344 } from './work-types.ts';

/* The Work tab of Core 1.6 (schema 344).
 *
 * PlaySettings.useWorkPriorities is saved with the game and is false in a new
 * game: the tab then shows one checkbox per work type. Pawn_WorkSettings keeps
 * each stored priority 0..4 in both modes; while the setting is off,
 * GetPriority answers 3 for any stored priority above 0 (humanlike pawns),
 * and a checkbox click stores 3 (on) or 0 (off). Toggling the setting
 * rewrites nothing: manual values set before reappear when it is turned back
 * on. MainTabWindow_Work only marks the work-giver order dirty.
 *
 * Elsewhere stores the setting as its opposite, `simpleWorkTab344: true` on
 * the campaign (one authority for every map, like the policies); absent means
 * manual priorities. A new game from schema 344 starts simple; a migrated save
 * stays manual (migration by number only), so its priorities keep their
 * meaning. Below 344 nothing reads it. */
export const isSchema344OrLater=schemaAtLeast(344);

export interface WorkTabOwner344 {schemaVersion:unknown;simpleWorkTab344?:true}
/** The simple Work tab (Core useWorkPriorities off) of this campaign. */
export const simpleWorkTab344=(world:WorkTabOwner344):boolean=>isSchema344OrLater(world.schemaVersion)&&world.simpleWorkTab344===true;

/** Strict: absent, or exactly `true` from schema 344 as an own enumerable
 * data property. A map view forwards the campaign value through an accessor;
 * its root is validated on its own. */
export function validSimpleWorkTab344(input:Record<string,unknown>,version:number):boolean {
  const descriptor=Object.getOwnPropertyDescriptor(input,'simpleWorkTab344');
  const value=descriptor&&'value'in descriptor?descriptor.value:input.simpleWorkTab344;
  if(value===undefined)return true;
  if(!isSchema344OrLater(version)||value!==true)return false;
  return !descriptor||!('value'in descriptor)||descriptor.enumerable===true;
}

export type WorkClick344='primary'|'secondary';
export type WorkTabCommand344=
  | {type:'work-tab-mode';manual:boolean}
  | {type:'priority-column';work:WorkType;pawnIds:readonly number[];click:WorkClick344};

/** Pawn_WorkSettings.GetPriority: the priority the Work tab shows and the
 * work-giver order uses (3 for any enabled work while the tab is simple). */
export const shownWorkPriority344=(pawn:Pick<Pawn,'priorities'>,work:WorkType,simple:boolean):number=>{
  const value=storedPriority(pawn,work);return simple&&value>0?3:value;
};

/** WidgetsWork.DrawWorkBoxFor, one cell. Manual: left click 4 → 3 → 2 → 1 →
 * off → 4 (priority − 1, below 0 wraps to 4), right click the reverse
 * (+ 1, above 4 wraps to off). Simple: the checkbox stores 3 when it is off and
 * 0 when it is on (an invisible button: either mouse button). */
export function nextCellPriority344(shown:number,simple:boolean,click:WorkClick344):number {
  if(simple)return shown>0?0:3;
  return click==='primary'?(shown-1<0?4:shown-1):(shown+1>4?0:shown+1);
}

/** PawnColumnWorker_WorkPriority.HeaderClicked with Shift held, for one pawn
 * of the table that can do the work; undefined leaves it unchanged. Manual:
 * left click raises one step every pawn not already at 1 (off becomes 4),
 * right click lowers one step every pawn not off (4 becomes off). Simple: left
 * click turns on (3) the pawns that are off, right click turns off the others. */
export function nextColumnPriority344(shown:number,simple:boolean,click:WorkClick344):number|undefined {
  if(simple)return click==='primary'?(shown>0?undefined:3):(shown>0?0:undefined);
  if(click==='primary')return shown===1?undefined:shown-1<0?4:shown-1;
  return shown===0?undefined:shown+1>4?0:shown+1;
}

/* Built on first use: this module is also imported by save validators, so it
 * reads the work type table only once every module is initialized. */
let relevant:ReadonlyMap<WorkType,readonly BackgroundSkillId[]>|undefined;
const relevantOf=(work:WorkType):readonly BackgroundSkillId[]=>(relevant??=new Map(Object.values(RIM_WORK_TYPES).map(type=>[type.work as WorkType,type.skills as readonly BackgroundSkillId[]]))).get(work)??[];
/** WorkTypeDef.relevantSkills (WorkTypes.xml). */
export const relevantSkills344=(work:WorkType):readonly BackgroundSkillId[]=>relevantOf(work);
/** Pawn_SkillTracker.AverageOfRelevantSkillsFor: the mean level of the work
 * type's relevant skills (WorkTypes.xml), 3 when it has none. Same reading as
 * enableAndInitializeWork (a skill a background disables counts 0). */
export function relevantSkillAverage344(pawn:Pick<Pawn,'skills'|'background'>,work:WorkType):number {
  const skills=relevantOf(work);if(!skills.length)return 3;
  let sum=0;for(const skill of skills)sum+=effectiveSkillLevel(pawn,skill,pawn.skills[skill]?.level??0);
  return sum/skills.length;
}
/** Pawn_SkillTracker.MaxPassionOfRelevantSkillsFor (0 none, 1 minor, 2 major). */
export function relevantPassion344(pawn:Pick<Pawn,'skills'>,work:WorkType):0|1|2 {
  let passion:0|1|2=0;for(const skill of relevantOf(work)){const value=pawn.skills[skill]?.passion??0;if(value>passion)passion=value;}
  return passion;
}
/** WidgetsWork: the red warning frame of an enabled work whose relevant
 * skills average 2 or less. */
export const veryBadSkill344=(pawn:Pick<Pawn,'skills'|'background'>,work:WorkType,shown:number):boolean=>
  relevantOf(work).length>0&&shown>0&&relevantSkillAverage344(pawn,work)<=2;

/** PawnColumnWorker_WorkPriority.GetValueToCompare: -1 when the pawn cannot do
 * the work, else the relevant skill average. */
export const workSortValue344=(pawn:Pick<Pawn,'skills'|'background'>,work:WorkType):number=>
  backgroundWorkRefusal(pawn,work)?-1:relevantSkillAverage344(pawn,work);

export interface WorkSort344 {work:WorkType;descending:boolean}
/** PawnColumnWorker.HeaderClicked without Shift (work columns are sortable).
 * Left click: unsorted → "descending" → "ascending" → unsorted; right click:
 * unsorted → "ascending" → "descending" → unsorted. Another column restarts. */
export function nextWorkSort344(current:WorkSort344|undefined,work:WorkType,click:WorkClick344):WorkSort344|undefined {
  if(current?.work!==work)return {work,descending:click==='primary'};
  if(click==='primary')return current.descending?{work,descending:false}:undefined;
  return current.descending?undefined:{work,descending:true};
}
/** PawnTable.RecachePawns: a stable sort of the table's own order. Core's
 * "descending" state sorts with the column comparer as given (smallest value
 * first), the other state with it reversed (largest first). */
export function sortWorkRows344<T extends Pick<Pawn,'skills'|'background'>>(rows:readonly T[],sort:WorkSort344|undefined):T[] {
  if(!sort)return [...rows];
  const keyed=rows.map((row,index)=>({row,index,value:workSortValue344(row,sort.work)}));
  keyed.sort((a,b)=>(sort.descending?a.value-b.value:b.value-a.value)||a.index-b.index);
  return keyed.map(entry=>entry.row);
}

/** The 'work-tab-mode' command: the "manual priorities" checkbox of the Work
 * tab, on the campaign root (never a map view, whose field only forwards).
 * Stored priorities are untouched; turning it on again restores them. */
export function applyWorkTabMode344(root:World,command:{type:'work-tab-mode';manual:boolean}):CommandResult {
  if(!isSchema344OrLater(root.schemaVersion))return {ok:false,code:'invalid-command',reason:'Commande inconnue.'};
  const keys=Reflect.ownKeys(command);
  if(keys.length!==2||!keys.includes('type')||!keys.includes('manual')||typeof command.manual!=='boolean')return {ok:false,code:'invalid-command',reason:'Réglage du tableau Travail invalide.'};
  if(command.manual)delete root.simpleWorkTab344;else root.simpleWorkTab344=true;
  return {ok:true};
}

let works:ReadonlySet<WorkType>|undefined;
/** The 'priority-column' command lists the table's pawns (its visible rows):
 * distinct colonists of this map who are not prisoners, at most 1000. */
export function priorityColumnRefusal344(world:Pick<World,'schemaVersion'|'pawns'>,command:unknown):string|undefined {
  if(!isSchema344OrLater(world.schemaVersion))return 'Commande inconnue.';
  if(!command||typeof command!=='object'||Array.isArray(command))return 'Colonne du tableau Travail invalide.';
  const c=command as Record<string,unknown>,keys=Reflect.ownKeys(c);
  if(keys.length!==4||!['type','work','pawnIds','click'].every(key=>keys.includes(key))||c.type!=='priority-column')return 'Colonne du tableau Travail invalide.';
  if(typeof c.work!=='string'||!(works??=new Set<WorkType>(Object.values(RIM_WORK_TYPES).map(type=>type.work))).has(c.work as WorkType)||(c.click!=='primary'&&c.click!=='secondary'))return 'Colonne du tableau Travail invalide.';
  const ids=c.pawnIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>1000||!ids.every(id=>Number.isSafeInteger(id))||new Set(ids).size!==ids.length)return 'Liste de colons invalide.';
  for(const id of ids){const pawn=world.pawns.find(p=>p.id===id);if(!pawn||!isColonist(pawn)||pawn.prisoner)return 'Cette personne n’est plus dans le tableau Travail.';}
  return undefined;
}
/** The priorities a Shift-click on a column sets, in the listed order, for the
 * pawns that can do the work (PawnColumnWorker_WorkPriority.HeaderClicked
 * skips the others), in the mode of the current command. */
export function priorityColumnChanges344(world:Pick<World,'schemaVersion'|'pawns'>,command:{work:WorkType;pawnIds:readonly number[];click:WorkClick344}):{pawn:Pawn;value:number}[] {
  if(priorityColumnRefusal344(world,command))return [];
  const simple=workTabIsSimple344(),changes:{pawn:Pawn;value:number}[]=[];
  for(const id of command.pawnIds){
    const pawn=world.pawns.find(p=>p.id===id)!;
    if(pawn.state==='dead'||backgroundWorkRefusal(pawn,command.work))continue;
    const value=nextColumnPriority344(shownWorkPriority344(pawn,command.work,simple),simple,command.click);
    if(value!==undefined)changes.push({pawn,value});
  }
  return changes;
}
