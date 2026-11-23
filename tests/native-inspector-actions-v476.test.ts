import { describe, expect, it, vi } from 'vitest';
import { applyCommand, createWorld } from '../src/sim/index';
import type { MaterialPile, Resource, World } from '../src/sim/types';
import { backgroundSkillRefusal, type BackgroundSkillId } from '../src/sim/colonist-backgrounds';
import { ITEM_DEFINITIONS } from '../src/sim/items';
import { ANIMAL_EGG_CONTENT_256 } from '../src/sim/animal-egg-content-v256';
import { newWeaponState } from '../src/sim/equipment-rules';
import { newApparelState } from '../src/sim/apparel-rules';
import { infectCrop } from '../src/sim/plant-blight';
import type { NativePage, NativeUiActions, NativeUiState } from '../src/ui3d/native-contract';
import { buildNativeInspector, setNativeInspectorTab } from '../src/ui3d/native-inspector';
import { animalRescueCamp } from './helpers/animal-rescue-v310';

let epoch = 476100;
/** A fact of the info card behind the pane's (i) button, or a row left in the page. */
const infoRow = (page: NativePage, id: string) => [...page.rows, ...(page.inspectInfo ?? [])].find(row => row.id === id);
function inspector(world: World, selected: Partial<Pick<NativeUiState, 'selectedAnimalId' | 'selectedObjects' | 'selectedPawnIds'>>) {
  let page: NativePage;
  const state: NativeUiState = { world, epoch: ++epoch, panel: null, category: 'orders', tool: 'select', orientation: 0,
    selectedPawnIds: [], selectedObjects: [], ...selected, constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } }, speed: 0, hasGame: true, busy: false, saves: [] };
  const noop = () => {};
  const actions: NativeUiActions = { command: vi.fn(async command => applyCommand(world, command)), readState: () => state,
    panel: noop, category: noop, tool: noop, selectPawn: noop, speed: noop, rotate: noop, material: noop, creationStorage: noop,
    front: noop, save: noop, exportSave: noop, showPage: next => { page = next; }, refresh: noop };
  page = buildNativeInspector(state, actions)!;
  return { state, actions, get page() { return page; } };
}
function rescueFixture() {
  const f = animalRescueCamp(), doctor = f.world.pawns.find(pawn => pawn.id === f.doctorId)!;
  doctor.priorities.doctor = 1;
  f.world.structures.push({ id: f.world.nextId++, kind: 'animal-sleeping-spot', ...f.medicalSpot, orientation: 0, footprint: 'standard', medical: true });
  return { ...f, doctor, animal: f.world.wildlife!.animals.find(animal => animal.id === f.animalId)! };
}

describe('native inspector restores real animal rescue and egg permissions', () => {
  it('projects all twelve real skills in the Core Bio card (514 × 489 tab window)', () => {
    const world = createWorld(476, 16, 16), pawn = world.pawns[0]!;
    setNativeInspectorTab('bio');
    const ui = inspector(world, { selectedPawnIds: [pawn.id] }), skills = ui.page.rows.find(row => row.id === 'bio-card')!.bio!.skills;
    expect(ui.page).toMatchObject({ layout: 'inspector', inspectTab: { id: 'bio', width: 514, height: 489, margin: 17 } });
    expect(skills).toHaveLength(12);
    for (const skill of skills) {
      const id = skill.id.slice('skill-'.length) as BackgroundSkillId, record = pawn.skills[id];
      expect(skill).toMatchObject({ level: record?.level ?? (id === 'mining' || id === 'plants' ? 8 : 0), passion: record?.passion ?? 0, disabled: !!backgroundSkillRefusal(pawn, id) });
      // The level's experience is in the tooltip (Core SkillUI), not a second gauge.
      expect(skill.hint).toContain('Expérience du niveau');
      expect(skill.hint).toContain(`${((record?.xp ?? 0) / 1000).toFixed(1)} / `);
      expect(skill.hint).toContain('Apprentissage');
    }
    const tabs = ui.page.rows.find(row => row.id === 'pawn-tabs')!;
    expect(tabs.compact).toBe(true); expect(tabs.column).toBeUndefined();
    expect(tabs.controls!.every(control => !!control.hint)).toBe(true);
    expect(ui.actions.command).not.toHaveBeenCalled();
  });

  it('changes the inspected colonist’s hostility through the real local selector and preserves map structures', async () => {
    const world = createWorld(476, 16, 16), pawn = world.pawns[0]!, structures = structuredClone(world.structures);
    const positions = world.pawns.map(person => [person.id, person.x, person.z]);
    setNativeInspectorTab('bio');
    const ui = inspector(world, { selectedPawnIds: [pawn.id] });
    // Core's hostility response is a gizmo beside the inspect pane.
    const select = () => ui.page.actions!.find(control => control.id === 'pawn-hostility')!.select!;
    expect(select().options).toEqual([{ value: 'flee', label: 'Fuir' }, { value: 'ignore', label: 'Ignorer' }, { value: 'attack', label: 'Attaquer' }]);
    await select().onChange('not-a-response');
    expect(ui.actions.command).not.toHaveBeenCalled();
    for (const response of ['ignore', 'attack', 'flee'] as const) {
      await select().onChange(response);
      expect(ui.actions.command).toHaveBeenLastCalledWith({ type: 'hostility-response', pawnId: pawn.id, response });
      expect(pawn.hostilityResponse ?? 'flee').toBe(response);
      expect(select().value).toBe(response);
    }
    expect(ui.actions.command).toHaveBeenCalledTimes(3);
    expect(world.structures).toEqual(structures);
    expect(world.pawns.map(person => [person.id, person.x, person.z])).toEqual(positions);
    expect(ui.page.rows.find(row => row.id === 'pawn-orders')!.value).toContain(`${pawn.orders.queue.length} en file`);
  });

  it('keeps busy and captured epoch guards on the inspected hostility selector', async () => {
    const world = createWorld(476, 16, 16), pawn = world.pawns[0]!, response = pawn.hostilityResponse;
    setNativeInspectorTab('bio');
    const ui = inspector(world, { selectedPawnIds: [pawn.id] });
    const select = ui.page.actions!.find(control => control.id === 'pawn-hostility')!.select!;
    ui.state.busy = true; await select.onChange('attack');
    expect(ui.actions.command).not.toHaveBeenCalled(); expect(pawn.hostilityResponse).toBe(response);
    ui.state.busy = false; ui.state.epoch!++; await select.onChange('attack');
    expect(ui.actions.command).not.toHaveBeenCalled(); expect(pawn.hostilityResponse).toBe(response);
    expect(ui.page.actions!.find(control=>control.id==='pawn-hostility')!.select).not.toBe(select);
  });

  it('orders the selected doctor to approach the same animal without moving it remotely', async () => {
    const f = rescueFixture(), ui = inspector(f.world, { selectedAnimalId: f.animalId });
    const before = { x: f.animal.x, z: f.animal.z }, chooser = ui.page.actions!.find(control => control.id === 'animal-rescue-select')!.select!;
    expect(chooser.options.find(option => option.value === `animal-rescue-${f.doctorId}`)!.disabled).toBeFalsy(); await chooser.onChange(`animal-rescue-${f.doctorId}`);
    expect(f.doctor.animalRescue).toMatchObject({ animalId: f.animalId, phase: 'approach', forced: true });
    expect({ x: f.animal.x, z: f.animal.z }).toEqual(before);
    expect(ui.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'order-animal-rescue', pawnId: f.doctorId, animalId: f.animalId });
  });

  it('rechecks veterinary permission before using a captured rescue choice', async () => {
    const f = rescueFixture(), ui = inspector(f.world, { selectedAnimalId: f.animalId });
    const chooser = ui.page.actions!.find(control => control.id === 'animal-rescue-select')!.select!;
    f.animal.domestic!.care = 'none'; await chooser.onChange(`animal-rescue-${f.doctorId}`);
    expect(ui.actions.command).not.toHaveBeenCalled(); expect(f.doctor.animalRescue).toBeUndefined();
    expect(ui.page.rows.find(row => row.id === 'inspector-feedback')!.label).toContain('désactivés');
  });

  it('can authorize a wild egg then forbid it again using its existing permission field', async () => {
    const world = createWorld(476, 16, 16), item = ANIMAL_EGG_CONTENT_256.turkey.unfertilizedItem;
    const egg = { id: world.nextId++, item, kind: ITEM_DEFINITIONS[item].kind, quantity: 1, eggForbidden: true as true | undefined, owner: { type: 'ground' as const, x: 7, z: 8 } };
    world.piles.push(egg); delete world.tiles[8 * world.width + 7]!.fogged;
    const ui = inspector(world, { selectedObjects: [{ kind: 'pile', id: egg.id }] });
    expect(ui.page.actions!.filter(control => /permission/.test(control.id))).toHaveLength(1);
    await ui.page.actions!.find(control => control.id === 'egg-permission')!.onActivate();
    expect(egg.eggForbidden).toBeUndefined(); expect(infoRow(ui.page, 'egg-permission-state')!.value).toBe('Autorisé');
    await ui.page.actions!.find(control => control.id === 'egg-permission')!.onActivate();
    expect(egg.eggForbidden).toBe(true); expect(infoRow(ui.page, 'egg-permission-state')!.value).toBe('Interdit');
    expect(ui.actions.command).toHaveBeenCalledTimes(2);
  });

  it('authorizes forbidden ground weapons and apparel through their own existing commands', async () => {
    for (const apparel of [false, true]) {
      const world = createWorld(476, 16, 16), pile: MaterialPile = apparel
        ? { id: world.nextId++, item: 'cloth-shirt', kind: 'apparel', quantity: 1, apparel: { ...newApparelState('cloth-shirt'), forbidden: true }, owner: { type: 'ground', x: 7, z: 8 } }
        : { id: world.nextId++, item: 'revolver', kind: 'weapon', quantity: 1, weapon: { ...newWeaponState('revolver'), forbidden: true }, owner: { type: 'ground', x: 7, z: 8 } };
      world.piles.push(pile); delete world.tiles[8 * world.width + 7]!.fogged;
      const ui = inspector(world, { selectedObjects: [{ kind: 'pile', id: pile.id }] });
      await ui.page.actions!.find(control => control.id === 'equipment-permission')!.onActivate();
      expect((pile.apparel ?? pile.weapon)!.forbidden).not.toBe(true);
      expect(ui.actions.command).toHaveBeenCalledExactlyOnceWith({ type: apparel ? 'apparel-permission' : 'weapon-permission', itemId: pile.id, allowed: true });
    }
  });

  it('toggles an existing gathering place without changing its structure or occupants', async () => {
    const world = createWorld(476, 16, 16), table = { id: world.nextId++, kind: 'table' as const, x: 7, z: 8, orientation: 0 as const, footprint: 'standard' as const };
    world.structures.push(table); delete world.tiles[8 * world.width + 7]!.fogged;
    const ui = inspector(world, { selectedObjects: [{ kind: 'structure', id: table.id }] }), before = world.pawns.map(pawn => [pawn.id, pawn.x, pawn.z]);
    await ui.page.actions!.find(control => control.id === 'gather-spot')!.onActivate();
    expect(world.structures.find(structure => structure.id === table.id)!.gatherSpot).toBe(false);
    expect(world.pawns.map(pawn => [pawn.id, pawn.x, pawn.z])).toEqual(before);
    expect(ui.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'gather-spot', structureId: table.id, enabled: false });
  });

  it('designates the real blighted crops through the existing bulk action', async () => {
    const world = createWorld(476, 16, 16);
    const plants: Resource[] = [7, 8].map(x => ({ id: world.nextId++, kind: 'rice', x, z: 8, amount: 6, growth: .5, growthTick: world.tick }));
    world.resources = plants; world.jobs = [];
    for (const plant of plants) { expect(infectCrop(world, plant, 42)).toBe(true); delete world.tiles[plant.z * world.width + plant.x]!.fogged; }
    const ui = inspector(world, { selectedObjects: [{ kind: 'resource', id: plants[0]!.id }] });
    await ui.page.actions!.find(control => control.id === 'cut-blighted-crops')!.onActivate();
    expect(world.jobs.filter(job => job.kind === 'cut').map(job => [job.x, job.z])).toEqual(plants.map(plant => [plant.x, plant.z]));
    expect(plants.every(plant => plant.blight)).toBe(true);
    expect(ui.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'cut-blighted-crops' });
  });

  it('resizes and deletes the whole stockpile when its selected cell is not the zone anchor', async () => {
    const world = createWorld(476, 16, 16), zoneId = world.nextId++, cellId = world.nextId++;
    world.stockpiles = [{ id: zoneId, zoneId, x: 7, z: 8, priority: 3, capacity: 75, filters: { wood: true, food: true } },
      { id: cellId, zoneId, x: 8, z: 8, priority: 3, capacity: 75, filters: { wood: true, food: true } }];
    delete world.tiles[8 * world.width + 8]!.fogged;
    const ui = inspector(world, { selectedObjects: [{ kind: 'stockpile', id: cellId }] }), resize = vi.fn();
    ui.actions.resizeZone = resize; ui.actions.showPage(buildNativeInspector(ui.state, ui.actions)!);
    await ui.page.actions!.find(control => control.id === 'stockpile-expand')!.onActivate();
    await ui.page.actions!.find(control => control.id === 'stockpile-shrink')!.onActivate();
    expect(resize.mock.calls).toEqual([['stockpile', zoneId, false], ['stockpile', zoneId, true]]);
    expect(ui.actions.command).not.toHaveBeenCalled();
    await ui.page.actions!.find(control => control.id === 'delete-stockpile')!.onActivate();
    expect(world.stockpiles).toEqual([]);
    expect(ui.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'delete-zone', kind: 'stockpile', zoneId });
  });
});
