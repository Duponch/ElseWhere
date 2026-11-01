import { describe, expect, it, vi } from 'vitest';
import { applyCommand, createWorld } from '../src/sim/index';
import { ITEM_DEFINITIONS } from '../src/sim/items';
import { groundMaxStacks, newShelfStorage } from '../src/sim/shelf-storage';
import { newCookingBill } from '../src/sim/cooking-bills';
import { newApparelCountFilter278 } from '../src/sim/apparel-count-278';
import { STORAGE_FILTER_TREE, storageNodeLeaves, storageTreeSelection } from '../src/ui/storage-filter-tree';
import { shelfControlOptions } from '../src/ui/shelf-inspection';
import type { Structure } from '../src/sim/types';
import type { NativeControl, NativePage, NativeUiActions, NativeUiState } from '../src/ui3d/native-contract';
import { buildNativeInspector } from '../src/ui3d/native-inspector';

let epoch = 47600;
function storageControl(page: NativePage, id: string): NativeControl {
  const result = page.rows.flatMap(row => row.controls ?? []).find(control => control.id === id);
  expect(result, `Missing storage control ${id}`).toBeDefined();
  return result!;
}
async function fixture(kind: 'stockpile' | 'shelf' | 'tailor' = 'stockpile') {
  const world = createWorld(476, 16, 16);
  const stockpile = { id: world.nextId++, x: 7, z: 8, priority: 3, capacity: 75, filters: { wood: true, food: true } };
  const shelf: Structure = { id: world.nextId++, kind: 'small-shelf', x: 7, z: 8, orientation: 0, footprint: 'standard', shelf: newShelfStorage([world.nextId++]) };
  const bill = newCookingBill(world.nextId++, 'shirt', world.schemaVersion);
  const station: Structure = { id: world.nextId++, kind: 'tailor-bench', x: 7, z: 8, orientation: 0, footprint: 'standard', bills: [bill] };
  world.stockpiles = kind === 'stockpile' ? [stockpile] : [];
  if (kind === 'shelf') world.structures.push(shelf);
  if (kind === 'tailor') world.structures.push(station);
  delete world.tiles[8 * world.width + 7]!.fogged;
  const state: NativeUiState = {
    world, epoch: ++epoch, panel: null, category: 'orders', tool: 'select', orientation: 0,
    selectedPawnIds: [], selectedObjects: [{ kind: kind === 'stockpile' ? 'stockpile' : 'structure', id: kind === 'tailor' ? station.id : kind === 'shelf' ? shelf.id : stockpile.id }],
    constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } },
    speed: 0, hasGame: true, busy: false, saves: [],
  };
  let page: NativePage;
  const noop = () => {};
  const actions: NativeUiActions = {
    command: vi.fn(async command => applyCommand(world, command)), panel: noop, category: noop, tool: noop,
    selectPawn: noop, speed: noop, rotate: noop, material: noop, creationStorage: noop, front: noop,
    save: noop, exportSave: noop, showPage: next => { page = next; }, refresh: noop, readState: () => state,
  };
  page = buildNativeInspector(state, actions)!;
  await page.actions!.find(control => control.id === (kind === 'tailor' ? 'station-bills' : kind === 'shelf' ? 'shelf-policy' : 'stockpile-settings'))!.onActivate();
  return { world, state, stockpile, shelf, station, bill, actions, get page() { return page; } };
}

describe('native storage controls match confirmed storage rules', () => {
  it('allows the highest priority and refuses priorities outside the real range', async () => {
    const f = await fixture();
    const priority = () => storageControl(f.page, 'storage-priority').select!;
    expect(priority().options.map(option => option.value)).toEqual(['1', '2', '3', '4', '5']);
    expect(f.page.rows.find(row => row.id === 'storage-priority')!.input).toBeUndefined();
    await priority().onChange('0');
    await priority().onChange('6');
    expect(f.actions.command).not.toHaveBeenCalled();
    await priority().onChange('5');
    expect(f.stockpile.priority).toBe(5);
    expect(priority().value).toBe('5');
    expect(priority().options.some(option => Number(option.value) > 5)).toBe(false);
    await priority().onChange('1');
    expect(f.stockpile.priority).toBe(1);
    expect(priority().value).toBe('1');
    expect(priority().options.some(option => Number(option.value) < 1)).toBe(false);
    expect(f.actions.command).toHaveBeenCalledTimes(2);
  });

  it('accepts the ground quota boundary and refuses a quota exceeding the item provider', async () => {
    const f = await fixture(), limit = ITEM_DEFINITIONS.silver.stackLimit;
    await f.page.rows.find(row => row.id === 'storage-capacity')!.input!.onCommit(String(limit + 1));
    await f.page.rows.find(row => row.id === 'storage-capacity')!.input!.onCommit('0');
    expect(f.actions.command).not.toHaveBeenCalled();
    await f.page.rows.find(row => row.id === 'storage-capacity')!.input!.onCommit(String(limit));
    expect(f.stockpile.capacity).toBe(limit);
    expect(f.page.rows.find(row => row.id === 'storage-capacity')!.controls!.find(control => control.id.endsWith('-more'))!.disabled).toBe(true);
  });

  it('shows real shelf stack places without offering an ineffective capacity edit', async () => {
    const f = await fixture('shelf'), capacity = f.page.rows.find(row => row.id === 'storage-capacity')!;
    expect(capacity.value).toBe(`${groundMaxStacks(f.world, f.shelf)} piles`);
    expect(capacity.input).toBeUndefined();
    expect(capacity.controls).toBeUndefined();
    await storageControl(f.page, 'storage-priority').select!.onChange('5');
    expect(f.shelf.shelf!.settings.priority).toBe(5);
    expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'shelf-policy', structureId: f.shelf.id, settings: { priority: 5 } });
  });

  it('toggles a shelf parent over its permitted leaves and keeps excluded leaves unchanged', async () => {
    const f = await fixture('shelf'), node = STORAGE_FILTER_TREE.find(node => node.id === 'corpses')!;
    const leaves = storageNodeLeaves(node), allowed = leaves.filter(item => shelfControlOptions.fixedAllows!(item));
    const selected = () => storageTreeSelection(f.shelf.shelf!.settings.filters, f.shelf.shelf!.settings.items);
    const excludedBefore = leaves.filter(item => !shelfControlOptions.fixedAllows!(item)).map(item => [item, selected().has(item)] as const);
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.length).toBeLessThan(leaves.length);
    expect(f.page.rows.some(row => row.id === 'storage-node-muffalo-corpse')).toBe(false);
    await storageControl(f.page, 'storage-node-corpses-expand').onActivate();
    await storageControl(f.page, 'storage-node-animal-corpses-expand').onActivate();
    // A small body from a normally large species remains a real permitted choice.
    expect(storageControl(f.page, 'storage-node-muffalo-corpse-permission').disabled).toBe(false);
    expect(storageControl(f.page, 'storage-node-human-corpses-permission').disabled).toBe(true);
    expect(storageControl(f.page, 'storage-node-mech-corpses-permission').disabled).toBe(true);
    // Search can expose a physically excluded leaf without enabling it.
    await f.page.rows.find(row => row.id === 'storage-search')!.input!.onCommit('scyther');
    expect(storageControl(f.page, 'storage-node-scyther-corpse-permission').disabled).toBe(true);
    await storageControl(f.page, 'storage-node-scyther-corpse-permission').onActivate();
    expect(f.actions.command).not.toHaveBeenCalled();
    await f.page.rows.find(row => row.id === 'storage-search')!.input!.onCommit('');
    await storageControl(f.page, 'storage-node-corpses-permission').onActivate();
    expect(allowed.every(item => selected().has(item))).toBe(true);
    expect(f.page.rows.find(row => row.id === 'storage-node-corpses')!.tree!.state).toBe('all');
    await storageControl(f.page, 'storage-node-corpses-permission').onActivate();
    expect(allowed.every(item => !selected().has(item))).toBe(true);
    expect(f.page.rows.find(row => row.id === 'storage-node-corpses')!.tree!.state).toBe('none');
    expect(excludedBefore.map(([item]) => [item, selected().has(item)])).toEqual(excludedBefore);
    expect(f.actions.command).toHaveBeenCalledTimes(2);
  });

  it('can disable, apply and re-enable an apparel reserve filter on the same confirmed bill', async () => {
    const f = await fixture('tailor'), toggle = `apparel-reserve-${f.bill.id}`, apply = `bill-apply-${f.bill.id}`;
    await f.page.rows.find(row => row.id === toggle)!.controls![0]!.onActivate();
    await f.page.rows.find(row => row.id === apply)!.controls!.find(control => control.id === apply)!.onActivate();
    expect(f.bill.apparelCount).toBeUndefined();
    expect(f.page.rows.find(row => row.id === toggle)!.value).toBe('Non');
    await f.page.rows.find(row => row.id === toggle)!.controls![0]!.onActivate();
    expect(f.bill.apparelCount).toBeUndefined();
    expect(f.page.rows.some(row => row.id === `reserve-hp-min-${f.bill.id}`)).toBe(true);
    await f.page.rows.find(row => row.id === apply)!.controls!.find(control => control.id === apply)!.onActivate();
    expect(f.bill.apparelCount).toEqual(newApparelCountFilter278());
    expect(f.actions.command).toHaveBeenCalledTimes(2);
  });

  it('returns a rejected commit to the native editor when the command refuses a valid value', async () => {
    const f = await fixture();
    vi.mocked(f.actions.command).mockResolvedValueOnce({ ok: false, reason: 'Stockage indisponible.' });
    await storageControl(f.page, 'storage-priority').select!.onChange('4');
    expect(f.stockpile.priority).toBe(3);
    expect(storageControl(f.page, 'storage-priority').select!.value).toBe('3');
    expect(f.page.rows[0]!.label).toBe('Stockage indisponible.');
    vi.mocked(f.actions.command).mockResolvedValueOnce({ ok: false, reason: 'Stockage indisponible.' });
    expect(await f.page.rows.find(row => row.id === 'storage-capacity')!.input!.onCommit('100')).toBe(false);
    expect(f.stockpile.capacity).toBe(75);
    expect(f.actions.command).toHaveBeenCalledTimes(2);
  });

  it('applies localized quality choices directly to the same storage and rejects values absent from its options', async () => {
    const f = await fixture(), minimum = storageControl(f.page, 'storage-quality-min').select!;
    expect(minimum.options.some(option => option.value === 'good' && !!option.label)).toBe(true);
    await minimum.onChange('not-a-quality');
    expect(f.actions.command).not.toHaveBeenCalled();
    await minimum.onChange('good');
    expect(f.world.stockpiles[0]!.quality).toEqual({ min: 'good', max: 'legendary' });
    expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'stockpile-policy', stockpileId: f.stockpile.id, settings: { quality: { min: 'good', max: 'legendary' } } });
    const maximum = storageControl(f.page, 'storage-quality-max').select!;
    expect(maximum.options.some(option => option.value === 'normal')).toBe(false);
    await maximum.onChange('normal');
    expect(f.actions.command).toHaveBeenCalledTimes(1);
    await maximum.onChange('excellent');
    expect(f.world.stockpiles[0]!.quality).toEqual({ min: 'good', max: 'excellent' });
    expect(f.actions.command).toHaveBeenLastCalledWith({ type: 'stockpile-policy', stockpileId: f.stockpile.id, settings: { quality: { min: 'good', max: 'excellent' } } });
    expect(f.page.id).toBe(`inspect-storage-${f.stockpile.id}`);
  });

  it('retains the captured map guard and the current busy guard for localized select changes', async () => {
    const f = await fixture(), minimum = storageControl(f.page, 'storage-quality-min').select!;
    f.state.busy = true; await minimum.onChange('good');
    expect(f.actions.command).not.toHaveBeenCalled();
    f.state.busy = false; f.state.epoch!++; await minimum.onChange('good');
    expect(f.actions.command).not.toHaveBeenCalled();
    expect(f.world.stockpiles[0]!.quality).toBeUndefined();
    expect(f.page.rows.some(row => row.controls?.some(control => control.id === 'storage-quality-min'))).toBe(false);
    expect(f.page.rows.some(row => row.id === 'object-id')).toBe(true);
  });

  it('edits a bill through its local repeat selector and keeps the confirmed bill unchanged until Apply', async () => {
    const f = await fixture('tailor'), before = f.bill.mode;
    const mode = f.page.rows.find(row => row.id === `bill-mode-${f.bill.id}`)!.controls![0]!.select!;
    expect(mode.options).toEqual([{ value: 'times', label: 'Faire X fois' }, { value: 'until', label: 'Jusqu’à X en réserve' }, { value: 'forever', label: 'Sans limite' }]);
    await mode.onChange('forever');
    expect(f.bill.mode).toBe(before);
    expect(f.actions.command).not.toHaveBeenCalled();
    expect(f.page.rows.find(row => row.id === `bill-mode-${f.bill.id}`)!.controls![0]!.select!.value).toBe('forever');
    const apply = `bill-apply-${f.bill.id}`;
    await f.page.rows.find(row => row.id === apply)!.controls!.find(control => control.id === apply)!.onActivate();
    expect(f.bill.mode).toBe('forever');
    expect(f.actions.command).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'bill-update', structureId: f.station.id, billId: f.bill.id, settings: expect.objectContaining({ mode: 'forever' }) }));
  });

  it('pastes an independent confirmed policy copy into the actual target without copying ground capacity', async () => {
    const f = await fixture();
    Object.assign(f.stockpile, { priority: 5, capacity: 12, quality: { min: 'good', max: 'excellent' }, allowRotten: false });
    await f.page.rows.find(row => row.id === 'storage-copy-settings')!.controls!.find(control => control.id === 'storage-copy')!.onActivate();
    f.stockpile.filters.wood = false;
    f.world.structures.push(f.shelf); f.state.selectedObjects = [{ kind: 'structure', id: f.shelf.id }];
    f.actions.showPage(buildNativeInspector(f.state, f.actions)!);
    await f.page.actions!.find(control => control.id === 'shelf-policy')!.onActivate();
    await f.page.rows.find(row => row.id === 'storage-copy-settings')!.controls!.find(control => control.id === 'storage-paste')!.onActivate();
    expect(f.shelf.shelf!.settings).toMatchObject({ priority: 5, capacity: 500, filters: { wood: true, food: true }, quality: { min: 'good', max: 'excellent' }, allowRotten: false });
    expect(f.shelf.shelf!.settings.filters).not.toBe(f.stockpile.filters);
    expect(f.actions.command).toHaveBeenCalledTimes(1);
    const stalePaste = f.page.rows.find(row => row.id === 'storage-copy-settings')!.controls!.find(control => control.id === 'storage-paste')!;
    f.state.epoch!++; await stalePaste.onActivate();
    expect(f.actions.command).toHaveBeenCalledTimes(1);
  });
});
