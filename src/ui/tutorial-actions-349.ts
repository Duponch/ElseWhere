/** Core tutorial action tags of Elsewhere's interface actions (TutorSystem
 * AllowAction / Notify_Event callers): designators, Architect build and zone
 * placement, main tabs, inspector tabs, gizmos, building materials and the
 * storyteller choice. Reading only: a tag is a string, never a command. The
 * camera and the time controls have no tag (Core never gates them). */
import {constructionLineCells} from '../sim/construction-line';
import type {Cell,Command,World} from '../sim/types';
import type {Panel,Tool} from './layout';

/** Core ThingDef names of the buildings the lessons name; any other building
 * gets an Elsewhere name no lesson allows. */
const THING_DEFS:Readonly<Record<string,string>>=Object.freeze({
  wall:'Wall',door:'Door',bed:'Bed','torch-lamp':'TorchLamp','animal-sleeping-spot':'AnimalSleepingSpot',horseshoes:'HorseshoesPin',
  'fueled-stove':'FueledStove','research-bench':'SimpleResearchBench',sandbags:'Sandbags',
});
/** Core designator tutorTags of the orders and zones tools. */
const DESIGNATORS:Readonly<Record<string,string>>=Object.freeze({
  stockpile:'ZoneAddStockpile_Resources',growing:'ZoneAdd_Growing','remove-stockpile':'ZoneDelete','remove-growing':'ZoneDelete',
  allow:'Unforbid',forbid:'Forbid',mine:'Mine',chop:'PlantsHarvestWood',harvest:'PlantsHarvest',cut:'PlantsCut',
  home:'AreaHomeExpand','remove-home':'AreaHomeClear','build-roof':'AreaBuildRoofExpand','remove-roof':'AreaNoRoofExpand','ignore-roof':'AreaBuildRoofClear',
  cancel:'Cancel',deconstruct:'Deconstruct',uninstall:'Uninstall','haul-chunks':'Haul','snow-clear':'AreaSnowClear','remove-snow-clear':'AreaSnowClearClear',
  'smooth-floor':'SmoothSurface','extract-tree':'ExtractTree','allowed-expand':'AreaAllowedExpand','allowed-shrink':'AreaAllowedClear',
});
/** Core building materials (stuff) of the lessons. */
const STUFF:Readonly<Record<string,string>>=Object.freeze({wood:'WoodLog',steel:'Steel'});
/** Core MainButtonDefs of the bottom tabs. */
const MAIN_TABS:Readonly<Record<Exclude<Panel,null>,string>>=Object.freeze({
  architect:'Architect',work:'Work',schedule:'Schedule',assign:'Assign',animals:'Animals',wildlife:'Wildlife',research:'Research',quests:'Quests',world:'World',history:'History',menu:'Menu',
});
/** Core inspector tabs (ITab tutorTag) of the native inspector controls. */
const INSPECTOR_TABS:Readonly<Record<string,string>>=Object.freeze({
  'pawn-tab-bio':'Character','pawn-tab-needs':'Needs','pawn-tab-health':'Health','pawn-tab-gear':'Gear','pawn-tab-social':'Social','pawn-tab-journal':'Log','pawn-tab-prisoner':'Prisoner',
  'station-bills':'Bills','shelf-policy':'Storage','stockpile-settings':'Storage',
});
const pascal=(id:string)=>id.split(/[-_]/).filter(Boolean).map(part=>part[0]!.toUpperCase()+part.slice(1)).join('');
/** The Core name of a building or designator of Elsewhere. */
export const tutorialDesignatorName349=(tool:string):string=>THING_DEFS[tool]??DESIGNATORS[tool]??`Elsewhere-${tool}`;
/** Designator.TutorTagSelect. */
export const tutorialToolTag349=(tool:Tool):string|undefined=>tool==='select'?undefined:`SelectDesignator-${tutorialDesignatorName349(tool)}`;
/** Designator_Build stuff float option: SelectStuff-<thing>-<stuff>. */
export const tutorialStuffTag349=(tool:Tool,material:string):string=>`SelectStuff-${tutorialDesignatorName349(tool)}-${STUFF[material]??pascal(material)}`;
/** MainButtonWorker.InterfaceTryActivate: the Menu is never denied (canBeTutorDenied false). */
export const tutorialMainTabTag349=(panel:Panel):string|undefined=>panel===null||panel==='menu'?undefined:`MainTab-${MAIN_TABS[panel]}-Open`;
export const tutorialMainTabEvent349=(panel:Panel):string|undefined=>panel===null?undefined:`MainTab-${MAIN_TABS[panel]}-Open`;
/** InspectPaneUtility.InterfaceToggleTab: an inspector tab being opened. */
export const tutorialInspectorTag349=(controlId:string):string|undefined=>INSPECTOR_TABS[controlId]?`ITab-${INSPECTOR_TABS[controlId]}-Open`:undefined;
/** Page_SelectStartingSite: ChooseBiome-<biome>-<hilliness>-<landmark>.
 * Elsewhere has no landmarks. */
export const tutorialBiomeTag349=(biome:string,hilliness:string):string=>`ChooseBiome-${pascal(biome)}-${pascal(hilliness)}-None`;
/** Core plant defs of the growing zone selector. */
export const tutorialPlantTag349=(plant:string):string=>`GrowingZoneSetPlant-Plant_${pascal(plant)}`;

export interface TutorialAction349 {tag:string;cells?:readonly Cell[];rect?:{minX:number;minZ:number;maxX:number;maxZ:number}}
export interface TutorialCommandActions349 {
  /** Asked before the command is sent (TutorSystem.AllowAction). */
  gate?:TutorialAction349;
  /** Told once the command is accepted (TutorSystem.Notify_Event). */
  event?:TutorialAction349;
}
/** Designations whose lessons check cells (Instruction AllowAction overrides). */
const CELL_TAGS=new Set(['Designate-Wall','Designate-Door','Designate-Bed','Designate-TorchLamp','Designate-AnimalSleepingSpot','Designate-HorseshoesPin','Designate-FueledStove','Designate-SimpleResearchBench','Designate-Sandbags','Designate-Mine']);
const rectOf=(from:Cell,to:Cell)=>({minX:Math.min(from.x,to.x),minZ:Math.min(from.z,to.z),maxX:Math.max(from.x,to.x),maxZ:Math.max(from.z,to.z)});
/** Designator_Mine.CanDesignateCell: a known mineable rock without a mining order yet. */
function mineCells(world:World|undefined,rect:{minX:number;minZ:number;maxX:number;maxZ:number}):Cell[] {
  if(!world)return [];
  const ordered=new Set(world.jobs.filter(j=>j.kind==='mine').map(j=>j.z*world.width+j.x)),out:Cell[]=[];
  // A bounded rectangle (Core designation drags are bounded by the map).
  for(let z=Math.max(0,rect.minZ);z<=Math.min(world.height-1,rect.maxZ);z++)for(let x=Math.max(0,rect.minX);x<=Math.min(world.width-1,rect.maxX);x++){
    const i=z*world.width+x,t=world.tiles[i]!;
    if(t.terrain==='rock'&&!t.fogged&&!ordered.has(i))out.push({x,z});
  }
  return out;
}
const designation=(name:string,world:World|undefined,cells?:Cell[],rect?:TutorialAction349['rect']):TutorialAction349=>{
  const tag=`Designate-${name}`;if(!CELL_TAGS.has(tag)&&!rect)return {tag};
  if(tag==='Designate-Mine'&&rect)return {tag,cells:mineCells(world,rect)};
  return rect&&!cells?{tag,rect}:{tag,cells:cells??[]};
};

/** The tutorial tags of a command: what is asked before sending it and what
 * is told once accepted. Ungated commands (orders, bills, priorities, the
 * lessons' own chain) have no gate. */
export function tutorialCommandActions349(command:Command,world:World|undefined):TutorialCommandActions349 {
  const both=(a:TutorialAction349)=>({gate:a,event:a});
  switch(command.type){
    case 'area':{
      const rect=rectOf(command.from,command.to),name=tutorialDesignatorName349(command.action);
      if(command.action==='stockpile'||command.action==='growing')return both({tag:`Designate-${name}`,rect});
      return both(designation(name,world,undefined,rect));
    }
    case 'designate':return both(designation(tutorialDesignatorName349(command.kind),world,[{x:command.x,z:command.z}]));
    case 'cancel':return both({tag:'Designate-Cancel'});
    case 'build-line':{
      const name=tutorialDesignatorName349(command.kind);
      // Designator.DesignateMultiCell: cells that already hold this building are skipped.
      const cells=constructionLineCells(command.from,command.to).filter(c=>!world||!(world.structures.some(s=>s.kind===command.kind&&s.x===c.x&&s.z===c.z)||world.jobs.some(j=>j.kind===command.kind&&j.x===c.x&&j.z===c.z)));
      return both({tag:`Designate-${name}`,cells});
    }
    case 'draft':return both({tag:command.enabled?'Draft':'Undraft'});
    case 'fire-at-will':return both({tag:'FireAtWillToggle'});
    case 'shoot':case 'melee':return both({tag:'VerbTarget'});
    case 'material-forbid':case 'weapon-permission':case 'apparel-permission':case 'egg-forbid':return both({tag:'ToggleForbidden'});
    case 'door-policy':return both({tag:command.setting==='forbidden'?'ToggleForbidden-Door':'TutorTagNotSet'});
    // Command_SetPlantToGrow: choosing a plant (the same one too) is
    // GrowingZoneSetPlant-<plant>; the sowing toggles have no tutor tag.
    case 'growing-policy':return both({tag:command.plant!==undefined?tutorialPlantTag349(command.plant):'TutorTagNotSet'});
    // Gizmos without a tutor tag (Command.tutorTag "TutorTagNotSet").
    case 'power-flick':case 'refuel-policy':case 'gather-spot':case 'spike-trap-auto-rebuild':case 'wind-auto-cut':case 'heater-adjust':case 'cooler-adjust':case 'cooler-target':
    case 'firefoam-auto-rebuild':case 'firefoam-trigger':case 'cut-blighted-crops':case 'install':
      return both({tag:'TutorTagNotSet'});
    case 'research-project':return command.project===null?{}:{event:{tag:'StartResearchProject'}};
    case 'choose-storyteller':return both({tag:'ChooseStoryteller'});
    default:return {};
  }
}
