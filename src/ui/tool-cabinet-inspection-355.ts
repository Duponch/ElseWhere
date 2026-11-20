import {TOOL_CABINET_FACTS_355,isToolCabinetBench355,isToolCabinetSchema355,linkedToolCabinets355,toolCabinetLinkedBenches355} from '../sim/tool-cabinet-355';
import {buildingLabels} from './building-labels';
import type {Structure,World} from '../sim/types';

const percent=(value:number)=>`+${Math.round(value*100)} %`;
/** Schema 355 facility facts of a bench or a tool cabinet; empty otherwise.
 * Core's bench inspector lists its linked facilities, the cabinet its links. */
export function toolCabinetInspection355(world:World,structure:Structure):string {
  if(!isToolCabinetSchema355(world.schemaVersion))return '';
  if(structure.kind==='tool-cabinet'){
    const benches=toolCabinetLinkedBenches355(world,structure);
    return benches.length?`Lié à ${benches.length} établi(s) : ${benches.map(b=>buildingLabels[b.kind]).join(', ')} · vitesse de travail ${percent(TOOL_CABINET_FACTS_355.workSpeedOffset)} à chacun`
      :`Aucun établi lié · un établi en vue, à ${TOOL_CABINET_FACTS_355.maxDistance} cases au plus, gagne ${percent(TOOL_CABINET_FACTS_355.workSpeedOffset)} de vitesse de travail`;
  }
  if(!isToolCabinetBench355(structure.kind))return '';
  const cabinets=linkedToolCabinets355(world,structure);
  return cabinets.length?`Installations liées : ${cabinets.length===1?'armoire à outils':`${cabinets.length} × armoire à outils`} · vitesse de travail ${percent(cabinets.length*TOOL_CABINET_FACTS_355.workSpeedOffset)}`
    :`Installations liées : aucune (jusqu’à ${TOOL_CABINET_FACTS_355.maxSimultaneous} armoires à outils)`;
}
