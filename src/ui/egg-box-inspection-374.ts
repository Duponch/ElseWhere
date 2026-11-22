import {eggBoxInspection374} from '../sim/egg-box-374';
import {EGG_BOX_374} from '../sim/egg-box-state-374';
import {ITEM_DEFINITIONS,type ItemId} from '../sim/items';
import type {Structure,World} from '../sim/types';

/** Schema 374: the content of an egg box (CompThingContainer.CompInspectStringExtra
 * with the hatcher's line when the eggs are fertilized); empty otherwise. */
export function eggBoxInspection374Text(world:World,structure:Structure):string {
  const state=eggBoxInspection374(world,structure);if(!state)return '';
  if(!state.item)return `Contenu : rien · capacité ${EGG_BOX_374.stackLimit} œufs ; les animaux de la colonie viennent y pondre.`;
  const label=ITEM_DEFINITIONS[state.item as ItemId]?.label??state.item;
  const empty=state.quantity>=EGG_BOX_374.minCountToEmpty?'vidée par les porteurs':`vidée à partir de ${EGG_BOX_374.minCountToEmpty} œufs`;
  return `Contenu : ${label} × ${state.quantity} / ${EGG_BOX_374.stackLimit} · ${empty}${state.incubation!==undefined?` · incubation ${Math.floor(Math.min(1,state.incubation)*100)} %`:''}`;
}
