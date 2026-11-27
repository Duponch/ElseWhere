import { describe, expect, it, vi } from 'vitest';
import { applyCommand, createWorld } from '../src/sim/index';
import type { Resource, Structure, World } from '../src/sim/types';
import { newCookingBill } from '../src/sim/cooking-bills';
import { newShelfStorage } from '../src/sim/shelf-storage';
import type { NativeControl, NativePage, NativeUiActions, NativeUiState } from '../src/ui3d/native-contract';
import { buildNativeInspector, setNativeInspectorTab } from '../src/ui3d/native-inspector';
import { layoutNativePage } from '../src/ui3d/native-layout';
import { TRAINING_SIZE, layoutTrainingTab, type TrainingSpec } from '../src/ui3d/native-tab-training';
import { composeThingPane, gizmosFromRow, hitPointGauge, isGizmoRow, objectPaneParts } from '../src/ui3d/native-thing-pane';
import { animalRescueCamp } from './helpers/animal-rescue-v310';

/** Wave 4, lot 3: the inspect pane, tabs, gizmos and info card of things that
 * are not people (InspectPaneFiller, InspectPaneUtility, ITab_Bills,
 * ITab_Storage, ITab_Pawn_Training, Dialog_InfoCard). */
const measure = (text: string) => text.length * 7;
const pageMeasure = (text: string, size: number) => text.length * size * 7 / 13;
const viewport = { width: 1440, height: 900 };
let epoch = 5_300_000;

function inspector(world: World, selected: Partial<Pick<NativeUiState, 'selectedAnimalId' | 'selectedObjects' | 'selectedPawnIds'>>) {
  let page: NativePage;
  const state: NativeUiState = { world, epoch: ++epoch, panel: null, category: 'orders', tool: 'select', orientation: 0, selectedPawnIds: [], selectedObjects: [], ...selected,
    constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } }, speed: 0, hasGame: true, busy: false, saves: [] };
  const noop = () => {};
  const actions: NativeUiActions = { command: vi.fn(async command => applyCommand(world, command)), readState: () => state, panel: noop, category: noop, tool: noop, selectPawn: noop, speed: noop, rotate: noop,
    material: noop, creationStorage: noop, front: noop, save: noop, exportSave: noop, showPage: next => { page = next; }, refresh: noop, clearSelection: noop };
  page = buildNativeInspector(state, actions)!;
  return { state, actions, rebuild: () => { page = buildNativeInspector(state, actions)!; return page; }, get page() { return page; } };
}
const box = (page: NativePage) => layoutNativePage(page, viewport, false, pageMeasure);
const allControls = (page: NativePage): NativeControl[] => {
  const layout = box(page), fromCards = layout.rows.flatMap(entry => entry.card?.targets.flatMap(target => target.control ? [target.control] : []) ?? []);
  const fromGauges = page.rows.flatMap(row => row.gauges?.flatMap(gauge => gauge.select ? [{ id: `gauge-${gauge.id}`, select: gauge.select } as unknown as NativeControl] : []) ?? []);
  return [...page.rows.flatMap(row => row.controls ?? []), ...(page.actions ?? []), ...(page.inspectInfo ?? []).flatMap(row => row.controls ?? []), ...fromCards, ...fromGauges];
};
function bench() {
  const world = createWorld(5300, 16, 16), bill = newCookingBill(world.nextId++, 'shirt', world.schemaVersion);
  const station: Structure = { id: world.nextId++, kind: 'tailor-bench', x: 7, z: 8, orientation: 0, footprint: 'standard', bills: [bill], power: { switchOn: true } as Structure['power'] };
  world.structures.push(station); delete world.tiles[8 * world.width + 7]!.fogged;
  return { world, station };
}

describe('Training tab (ITab_Pawn_Training, TrainingCardUtility)', () => {
  const spec: TrainingSpec = { type: 'training', lines: [{ id: 'a', label: 'Familiarité', value: '5 / 5', hint: 'a' }, { id: 'b', label: 'Maître', value: 'Eden', hint: 'b' }],
    rows: ['obedience', 'haul'].map(id => ({ id, label: id, steps: '1 / 3', learned: false, wanted: id === 'haul', disabled: false, hint: id, control: { id: `train-${id}`, label: id, onActivate: () => undefined } })) };
  const card = layoutTrainingTab(spec, measure);
  it('is 300 wide, labels of 22 two apart under 17 + 10, a gap of 12, then rows of 28 and 17 under', () => {
    expect(card.width).toBe(TRAINING_SIZE.width); expect(TRAINING_SIZE.width).toBe(300);
    const line = card.targets.find(target => target.id === 'training-line:a')!, second = card.targets.find(target => target.id === 'training-line:b')!;
    expect(line).toMatchObject({ x: 17, y: 27, w: 266, h: 22 }); expect(second.y).toBe(27 + 22 + 2);
    const row = card.targets.find(target => target.id === 'training-row:obedience')!;
    expect(row).toMatchObject({ x: 17, y: 27 + 24 * 2 + 12, w: 266, h: 28 });
    expect(card.targets.find(target => target.id === 'training-row:haul')!.y).toBe(row.y + 28);
    expect(card.height).toBe(row.y + 28 * 2 + 17);
  });
  it('draws a check per row (on for a wanted skill) and the steps in the right column', () => {
    const checks = card.items.filter(item => item.k === 'glyph' && item.glyph === 'check');
    expect(checks.map(item => item.k === 'glyph' && item.on)).toEqual([false, true]);
    const steps = card.items.filter(item => item.k === 'text' && item.text === '1 / 3');
    expect(steps).toHaveLength(2);
  });
});

describe('sorting of a dossier into the pane (InspectPaneFiller, Gizmo)', () => {
  it('draws the hit points as « current / max » with the colour of DrawHealth', () => {
    expect(hitPointGauge('hp', 50, 50)).toMatchObject({ label: '50 / 50', fill: 1, color: '#bdb39c' });
    expect(hitPointGauge('hp', 30, 50).color).toBe('#d2bb62'); expect(hitPointGauge('hp', 10, 50).color).toBe('#c4806a'); expect(hitPointGauge('hp', 0, 50)).toMatchObject({ fill: 0, color: '#9a9a9a' });
  });
  it('turns a toggle row into a gizmo named by the row and marked by its state', () => {
    const row = { id: 'door-hold', label: 'Maintenir ouverte', value: 'Non', controls: [{ id: 'door-hold', label: 'Activer', active: false, onActivate: () => undefined }] };
    expect(isGizmoRow(row)).toBe(true);
    expect(gizmosFromRow(row)[0]).toMatchObject({ id: 'door-hold', label: 'Maintenir ouverte', caption: 'Non' });
    expect(isGizmoRow({ id: 'fact', label: 'Taille', value: '1 × 1' })).toBe(false);
    expect(isGizmoRow({ ...row, meter: { value: 1 } })).toBe(false);
  });
  it('keeps the facts of a row on the info card and copies the inspect-string rows as lines', () => {
    const rows = [{ id: 'structure-condition', label: 'Points de vie', value: '40 / 50', meter: { value: 40, max: 50 } }, { id: 'structure-quality', label: 'Qualité', value: 'Normale' }, { id: 'structure-size', label: 'Encombrement', value: '1 × 1' }];
    const parts = objectPaneParts(rows);
    expect(parts.gauges[0]).toMatchObject({ label: '40 / 50' }); expect(parts.lines.map(line => line.text)).toEqual(['Qualité : Normale']);
    const page = composeThingPane({ page: { id: 'p', title: 'T', rows, actions: [] }, spec: { ...parts, tabs: [] }, activeTab: null, control: (id, label, action) => ({ id, label, onActivate: async () => { await action(); } }), toggleTab: () => undefined, openInfo: () => undefined });
    expect(page.inspectInfo!.map(row => row.id)).toEqual(['structure-condition', 'structure-quality', 'structure-size']);
    expect(page.rows[0]!.id).toBe('pawn-tabs'); expect(page.actions!.map(action => action.id)).toEqual(['inspect-info']);
  });
});

describe('a building: the pane of InspectPaneUtility with its tabs, gizmos and info card', () => {
  it('shows the hit points bar, the Factures tab at ITab_Bills size (420 × 480) and the gizmos right of the pane', () => {
    setNativeInspectorTab('none');
    const f = bench(), ui = inspector(f.world, { selectedObjects: [{ kind: 'structure', id: f.station.id }] });
    expect(ui.page.rows[0]!.controls!.map(control => control.id)).toEqual(['pane-tab-bills']);
    const pane = ui.page.rows.find(row => row.id === 'pane-gauges')!.gauges!;
    expect(pane[0]!.label).toMatch(/^\d+ \/ \d+$/);
    const closed = box(ui.page);
    expect(closed.inspectorParts!.summary.height).toBe(165); expect(closed.inspectorParts!.tabs.height).toBe(30);
    expect(closed.inspectorParts!.gauges![0]!.rect).toMatchObject({ width: 93, height: 16 });
    expect(closed.inspectorParts!.sheet.height).toBe(0);
    setNativeInspectorTab('bills'); const open = ui.rebuild();
    expect(open.inspectTab).toEqual({ id: 'bills', width: 420, height: 480, margin: 10 });
    const sheet = box(open).inspectorParts!.sheet; expect(sheet.width).toBe(420); expect(sheet.height).toBeLessThanOrEqual(480);
    // The gizmos are 75 × 75 and sit right of the 432-wide pane.
    const tiles = box(open).actions.filter(entry => entry.style === 'tile');
    expect(tiles.length).toBeGreaterThan(0); for (const tile of tiles) { expect([tile.width, tile.height]).toEqual([75, 75]); expect(tile.x).toBeGreaterThanOrEqual(432); }
    setNativeInspectorTab('none');
  });
  it('lists the recipes behind one « Ajouter une facture » list, as ITab_Bills opens a float menu', () => {
    const f = bench(); setNativeInspectorTab('bills');
    const ui = inspector(f.world, { selectedObjects: [{ kind: 'structure', id: f.station.id }] });
    const add = allControls(ui.page).find(control => control.id === 'add-bill')!;
    expect(add.select!.options.length).toBeGreaterThan(1); expect(add.select!.options.some(option => option.value === 'add-bill-shirt')).toBe(true);
    setNativeInspectorTab('none');
  });
  it('opens the info card with every fact, and goes back', async () => {
    setNativeInspectorTab('none');
    const f = bench(), ui = inspector(f.world, { selectedObjects: [{ kind: 'structure', id: f.station.id }] });
    const facts = ui.page.inspectInfo!.map(row => row.id);
    expect(facts).toEqual(expect.arrayContaining(['object-id', 'structure-condition', 'structure-size', 'structure-movement']));
    await ui.page.actions!.find(control => control.id === 'inspect-info')!.onActivate();
    const card = ui.page;
    expect(card.title).toMatch(/Informations$/); expect(card.layout).toBe('info');
    expect(card.rows.filter(row=>row.infoEntry&&row.id!=='info-description').map(row=>row.id).sort()).toEqual(facts.sort());
    await card.actions!.find(control => control.id === 'info-back')!.onActivate();
    expect(ui.page.rows[0]!.id).toBe('pawn-tabs');
  });
  it('keeps every command of the old dossier reachable (gizmo, tab or info card)', () => {
    setNativeInspectorTab('none');
    const f = bench(), ui = inspector(f.world, { selectedObjects: [{ kind: 'structure', id: f.station.id }] });
    const ids = new Set(allControls(ui.page).map(control => control.id));
    for (const id of ['object-action-deconstruct', 'uninstall']) expect(ids.has(id), id).toBe(true);
    // A workbench has no switch (canFlickDevice, CompFlickable in Core): the simulation always refused this row's command.
    expect(ids.has('power')).toBe(false);
    setNativeInspectorTab('bills');
    expect(allControls(ui.rebuild()).some(control => control.id === 'add-bill')).toBe(true);
    setNativeInspectorTab('none');
  });
});

describe('a shelf and a stockpile zone: the Stockage tab at ITab_Storage size (300 × 480)', () => {
  it('opens on both, and a zone has no hit points bar (it is not a Thing)', () => {
    const world = createWorld(5301, 16, 16);
    const zone = { id: world.nextId++, x: 7, z: 8, priority: 3, capacity: 75, filters: { wood: true, food: true } };
    const shelf: Structure = { id: world.nextId++, kind: 'small-shelf', x: 9, z: 8, orientation: 0, footprint: 'standard', shelf: newShelfStorage([world.nextId++]) };
    world.stockpiles = [zone]; world.structures.push(shelf); for (const x of [7, 9]) delete world.tiles[8 * world.width + x]!.fogged;
    setNativeInspectorTab('storage');
    const onZone = inspector(world, { selectedObjects: [{ kind: 'stockpile', id: zone.id }] }).page;
    expect(onZone.inspectTab).toEqual({ id: 'storage', width: 300, height: 480, margin: 10 }); expect(onZone.rows.some(row => row.id === 'pane-gauges')).toBe(false);
    const onShelf = inspector(world, { selectedObjects: [{ kind: 'structure', id: shelf.id }] }).page;
    expect(onShelf.inspectTab).toMatchObject({ id: 'storage', width: 300, height: 480 }); expect(onShelf.rows.some(row => row.id === 'pane-gauges')).toBe(true);
    expect(onShelf.rows.some(row => row.controls?.some(control => control.id === 'storage-copy'))).toBe(true);
    setNativeInspectorTab('none');
  });
});

describe('a plant: the growth lines of Plant.GetInspectString under the hit points bar', () => {
  it('shows « current / max » and a growth line', () => {
    setNativeInspectorTab('none');
    const world = createWorld(5302, 16, 16), plant: Resource = { id: world.nextId++, kind: 'rice', x: 7, z: 8, amount: 6, growth: .5, growthTick: world.tick };
    world.resources = [plant]; delete world.tiles[plant.z * world.width + plant.x]!.fogged;
    const page = inspector(world, { selectedObjects: [{ kind: 'resource', id: plant.id }] }).page;
    expect(page.rows.find(row => row.id === 'pane-gauges')!.gauges![0]!.label).toMatch(/^\d+ \/ \d+$/);
    expect(page.rows.filter(row => row.inspectPane && row.value).some(row => /^Croissance \d+ %$/.test(row.value!))).toBe(true);
  });
});

describe('an animal: the tabs of Races_Animal_Base and the gizmos', () => {
  const rescue = () => { const f = animalRescueCamp(); return { ...f, animal: f.world.wildlife!.animals.find(animal => animal.id === f.animalId)! }; };
  it('has the health bar, the allowed-area bar (a list), and Journal, Social, Dressage, Besoins, Santé in Core order', () => {
    setNativeInspectorTab('none');
    const f = rescue(), ui = inspector(f.world, { selectedAnimalId: f.animalId });
    expect(ui.page.rows[0]!.controls!.map(control => control.id)).toEqual(['pane-tab-journal', 'pane-tab-social', 'pane-tab-training', 'pane-tab-needs', 'pane-tab-health']);
    expect(ui.page.rows.find(row => row.id === 'pane-gauges')!.gauges!.map(gauge => gauge.id)).toEqual(['health']);
  });
  it('lets a tame animal that supports allowed areas change its zone from the bar (InspectPaneFiller.DrawAreaAllowed)', () => {
    const f = rescue(); f.animal.species = 'husky'; delete f.animal.health;
    const gauges = inspector(f.world, { selectedAnimalId: f.animalId }).page.rows.find(row => row.id === 'pane-gauges')!.gauges!;
    expect(gauges.map(gauge => gauge.id)).toEqual(['health', 'area']); expect(gauges[1]!.select!.options.map(option => option.label)).toEqual(expect.arrayContaining(['Sans restriction', 'Foyer']));
  });
  it('keeps each Core ITab width but fits the animal card to its occupied height', () => {
    const f = rescue(), ui = inspector(f.world, { selectedAnimalId: f.animalId });
    const sizes: Record<string, [number, number | undefined]> = { health: [630, 430], social: [540, 510], journal: [630, 510], training: [300, undefined], needs: [225, undefined] };
    for (const [id, [width, height]] of Object.entries(sizes)) {
      setNativeInspectorTab(id); const page = ui.rebuild();
      expect(page.inspectTab!.id).toBe(id);
      const layout=box(page),sheet=layout.inspectorParts!.sheet,card=layout.rows.find(row=>row.card)?.card;
      expect(sheet.width,id).toBe(width);expect(card,id).toBeDefined();
      expect(sheet.height,id).toBe(Math.max(40,card!.height));
      if(height!==undefined){expect(page.inspectTab!.height,id).toBe(height);expect(sheet.height,id).toBeLessThanOrEqual(height);}
      if(id==='health')expect(sheet.height,id).toBeLessThan(430);
      for(const region of card!.regions){expect(region.y,id+':'+region.id).toBeGreaterThanOrEqual(0);expect(region.y+region.h,id+':'+region.id).toBeLessThanOrEqual(card!.height+1e-6);}
    }
    setNativeInspectorTab('none');
  });
  it('keeps every control of the old animal dossier reachable', () => {
    const f = rescue(), ui = inspector(f.world, { selectedAnimalId: f.animalId }), found = new Set<string>();
    for (const id of ['none', 'training', 'health', 'needs']) { setNativeInspectorTab(id); for (const control of allControls(ui.rebuild())) found.add(control.id); }
    for (const id of ['animal-rescue-select', 'train-obedience', 'train-haul', 'animal-care', 'animal-slaughter']) expect(found.has(id), id).toBe(true);
    setNativeInspectorTab('none');
  });
  it('keeps the group label of several selected things (InspectPaneUtility.AdjustedLabelFor)', () => {
    setNativeInspectorTab('none');
    const world = createWorld(5303, 16, 16), plants: Resource[] = [7, 8].map(x => ({ id: world.nextId++, kind: 'rice', x, z: 8, amount: 6, growth: .5, growthTick: world.tick }));
    world.resources = plants; for (const plant of plants) delete world.tiles[plant.z * world.width + plant.x]!.fogged;
    const page = inspector(world, { selectedObjects: plants.map(plant => ({ kind: 'resource' as const, id: plant.id })) }).page;
    expect(page.title).toMatch(/×2$/); expect(page.rows[0]!.id).toBe('pawn-tabs');
  });
});
