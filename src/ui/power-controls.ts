import {isConduitKind} from '../sim/conduit-kinds-382.ts';
import {targetBuildingPlayerUse263} from '../sim/world-target-building-263';
import {roadPropCanDeconstruct256} from '../sim/local-road-prop-ownership-256';
import { footprintContains } from '../sim/definitions';
import { canFlickDevice, actualDeviceSwitch } from '../sim/power-flick';
import { isElectrical } from '../sim/power-rules';
import { buildingLabels } from './building-labels';
import { powerInspection } from './power-inspection';
import type { Cell, Command, World } from '../sim/types';

/** A cable under a wall remains inspectable and removable by its identity. */
export function updatePowerControls(root: HTMLElement, world: World, cell: Cell, send: (command: Command) => void): void {
  let section = root.querySelector<HTMLElement>('[data-power-controls]');
  if (!section) {
    section = document.createElement('section'); section.dataset.powerControls = '';
    section.className = 'power-controls'; section.setAttribute('aria-label', 'Commandes des appareils'); root.append(section);
  }
  const structures = world.structures.filter(s => (isElectrical(s.kind)||s.kind==='vent') && footprintContains(s, cell));
  section.hidden = !structures.length;
  for (const card of section.querySelectorAll<HTMLElement>('[data-power-id]')) {
    if (!structures.some(s => s.id === Number(card.dataset.powerId))) card.remove();
  }
  for (const structure of structures) {
    let card = section.querySelector<HTMLElement>(`[data-power-id="${structure.id}"]`);
    if (!card) {
      card = document.createElement('div'); card.dataset.powerId = String(structure.id);
      card.innerHTML = '<h3></h3><p data-power-state></p><p data-power-request role="status"></p><button type="button" data-power-flick class="secondary-action"></button><button type="button" data-power-remove class="secondary-action">Déconstruire ce câble</button>';
      const thermostat = document.createElement('div'); thermostat.dataset.heaterControls = ''; thermostat.className = 'cooler-buttons';
      thermostat.setAttribute('role', 'group'); thermostat.setAttribute('aria-label', 'Consigne du radiateur');
      for (const [label, offset] of [['−10', -10], ['−1', -1], ['21 °C', null], ['+1', 1], ['+10', 10]] as const) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.heaterOffset = String(offset);
        button.setAttribute('aria-label', offset === null ? 'Réinitialiser la consigne à 21 °C' : `${offset < 0 ? 'Diminuer' : 'Augmenter'} la consigne de ${Math.abs(offset)} °C`);
        button.onclick = () => send({type: 'heater-adjust', structureId: structure.id, offset}); thermostat.append(button);
      }
      const autoCut = document.createElement('label'); autoCut.className = 'storage-settings'; autoCut.dataset.windControls = '';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.windAutoCut = '';
      checkbox.onchange = () => send({type: 'wind-auto-cut', structureId: structure.id, enabled: checkbox.checked});
      autoCut.append(checkbox, ' Désigner les arbres gênants à couper');
      card.append(thermostat, autoCut);
      section.append(card);
    }
    card.dataset.powerKind = structure.kind;
    card.querySelector('h3')!.textContent = buildingLabels[structure.kind];
    card.querySelector('[data-power-state]')!.textContent = (structure.kind==='vent'?`${structure.vent?.open?'Ouverte':'Fermée'} · échange entre les deux faces, passage bloqué. Sans électricité ; aucun soutien de toit.`:powerInspection(world, structure)).replace(/^ · /, '');
    const pending = world.jobs.find(j => j.flick?.structureId === structure.id);
    const removing = world.jobs.some(j => j.deconstruction?.structureId === structure.id);
    card.querySelector('[data-power-request]')!.textContent = pending ? `${structure.kind==='vent'?(pending.flick!.on?'Ouverture':'Fermeture'):(pending.flick!.on?'Mise en marche':'Arrêt')} demandé${structure.kind==='vent'?'e':''} · attend l’intervention d’un colon (Manutention).` : '';
    const flick = card.querySelector<HTMLButtonElement>('[data-power-flick]')!;
    flick.hidden = !canFlickDevice(structure); flick.disabled = removing||!targetBuildingPlayerUse263(world,structure);
    flick.textContent = pending ? 'Annuler la demande' : structure.kind==='vent'?(actualDeviceSwitch(structure)?'Demander la fermeture':'Demander l’ouverture'):actualDeviceSwitch(structure) ? 'Demander l’arrêt' : 'Demander la mise en marche';
    flick.onclick = () => send({type: 'power-flick', structureId: structure.id, on: pending ? actualDeviceSwitch(structure) : !actualDeviceSwitch(structure)});
    const remove = card.querySelector<HTMLButtonElement>('[data-power-remove]')!;
    remove.hidden = !isConduitKind(structure.kind); remove.disabled = removing||!roadPropCanDeconstruct256(world,structure);
    remove.onclick = () => send({type: 'designate', kind: 'deconstruct', targetId: structure.id, x: structure.x, z: structure.z});
    const thermostat = card.querySelector<HTMLElement>('[data-heater-controls]')!;
    thermostat.hidden = structure.kind !== 'heater'; thermostat.dataset.target = String(structure.heater?.target ?? '');
    for (const button of thermostat.querySelectorAll('button')) button.disabled = removing;
    card.querySelector<HTMLElement>('[data-wind-controls]')!.hidden = structure.kind !== 'wind-turbine';
    const autoCut = card.querySelector<HTMLInputElement>('[data-wind-auto-cut]')!;
    autoCut.checked = structure.wind?.autoCut === true; autoCut.disabled = removing;
  }
}
