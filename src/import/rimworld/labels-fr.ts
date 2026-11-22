/** French names of the Elsewhere targets shown in the import report and in
 * the import page. The notes keep Elsewhere's ids; only the display changes.
 * A target is an id, sometimes followed by a detail (« rough-stone (marble) »,
 * « advanced-fabrication (en cours) »): the id is named, the detail kept. */
import {ITEM_DEFINITIONS} from '../../sim/items.ts';
import {ANIMAL_SPECIES} from '../../sim/animal-species.ts';
import {FLORA_DEFINITIONS} from '../../sim/biome-flora.ts';
import {TRAITS} from '../../sim/traits.ts';
import {buildingLabels} from '../../ui/building-labels.ts';
import {TERRAIN_LABELS} from '../../ui/terrain-inspection.ts';
import {researchProjects} from '../../ui/research-projects.ts';
import type {Family} from './notes.ts';

const own=<T extends object>(table:T,id:string):string|undefined=>Object.hasOwn(table,id)?(table as Record<string,unknown>)[id] as string|undefined:undefined;
const capital=(text:string):string=>text.charAt(0).toUpperCase()+text.slice(1);
const labelOf=(table:object,id:string):string|undefined=>{const entry=own(table,id) as unknown;return typeof entry==='object'&&entry!==null&&typeof (entry as {label?:unknown}).label==='string'?(entry as {label:string}).label:undefined;};

function nameOf(family:Family,id:string):string|undefined {
 switch(family){
  case 'items':case 'apparel':case 'weapons':return labelOf(ITEM_DEFINITIONS,id);
  case 'buildings':return own(buildingLabels,id);
  case 'animals':{const label=labelOf(ANIMAL_SPECIES,id);return label&&capital(label);}
  case 'plants':return labelOf(FLORA_DEFINITIONS,id)??labelOf(ITEM_DEFINITIONS,id);
  case 'traits':return labelOf(TRAITS,id);
  case 'terrain':return own(TERRAIN_LABELS,id);
  case 'research':return researchProjects.find(project=>project.id===id)?.title;
  default:return undefined;
 }
}
/** The French name of a target, or the target itself when none is known. */
export function elsewhereTargetLabel(family:Family,to:string):string {
 const space=to.indexOf(' '),id=space<0?to:to.slice(0,space),rest=space<0?'':to.slice(space);
 const name=nameOf(family,id);
 return name?`${name}${rest}`:to;
}
