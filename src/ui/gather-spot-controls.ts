import type { Structure } from '../sim/types';

const gatherSpotKinds = new Set<Structure['kind']>(['table', 'table-square', 'table-long', 'table-large', 'campfire']);

export function gatherSpotControls(panel: HTMLElement, send: (structureId: number, enabled: boolean) => Promise<void>): void {
  const button = document.createElement('button');
  button.id = 'cell-gather-spot';
  button.className = 'secondary-action';
  button.hidden = true;
  button.onclick = () => {
    const id = Number(button.dataset.structureId);
    if (!Number.isInteger(id) || button.disabled) return;
    button.disabled = true;
    void send(id, button.getAttribute('aria-pressed') !== 'true').finally(() => { button.disabled = false; });
  };
  panel.querySelector('.cell-actions')!.prepend(button);
}

export function updateGatherSpotControls(panel: HTMLElement, structure: Structure | undefined): void {
  const button = panel.querySelector<HTMLButtonElement>('#cell-gather-spot');
  if (!button) return;
  button.hidden = !structure || !gatherSpotKinds.has(structure.kind);
  if (button.hidden || !structure) return;
  const active = structure.gatherSpot !== false;
  button.dataset.structureId = String(structure.id);
  button.setAttribute('aria-pressed', String(active));
  button.textContent = `Point de rencontre : ${active ? 'actif' : 'inactif'}`;
  button.title = active ? 'Désactiver le point de rencontre' : 'Activer le point de rencontre';
}
