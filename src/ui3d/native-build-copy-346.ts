import type {Structure,World} from '../sim/types';
import {constructionMaterials,type ConstructionMaterial} from '../sim/construction-materials';
import type {Tool} from '../ui/layout';
import {architectToolAvailable} from '../ui/architect-availability';
import {toolDefinitions} from './native-catalog';

export interface BuildCopy346 {tool:Tool;material?:ConstructionMaterial}

/** Core Building.GetGizmos adds BuildCopyCommandUtility.BuildCopyCommand(def,
 * Stuff): the same Architect designator is selected, but only when it is
 * visible (FindAllowedDesignator, mustBeVisible: research done), with the
 * building's stuff when the def is made from stuff. The rotation is not
 * copied. Presentation only: no command, the placement keeps every rule. */
export function buildCopy346(world:World,structure:Structure):BuildCopy346|undefined {
  const definition=toolDefinitions.find(tool=>tool.id===structure.kind&&tool.category!=='orders'&&tool.category!=='zones');
  if(!definition||!architectToolAvailable(world,definition.id))return;
  const materials=constructionMaterials(structure.kind);
  const material=materials.length>1&&structure.material&&materials.includes(structure.material)?structure.material:undefined;
  return {tool:definition.id,...material?{material}:{}};
}
