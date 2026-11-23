import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, createWorld } from '../src/sim/index';
import { newCookingBill } from '../src/sim/cooking-bills';
import { CLOTHING_RESEARCH_COST } from '../src/sim/research';
import { newPowerState } from '../src/sim/power-rules';
import { PRODUCTION_RECIPES } from '../src/sim/production-recipes';
import { backgroundWorkRefusal } from '../src/sim/colonist-backgrounds';
import { storedPriority } from '../src/sim/work-types';
import type { CookingBill } from '../src/sim/cooking-types';
import type { Command, Structure, World } from '../src/sim/types';
import type { NativeControl, NativePage, NativeUiActions, NativeUiState } from '../src/ui3d/native-contract';
import { deserializeWorld, serializeWorld } from '../src/sim/serialization';
import { buildNativeInspector, setNativeInspectorTab } from '../src/ui3d/native-inspector';
import { buildNativePanel } from '../src/ui3d/native-panels';
import { workColumns } from '../src/ui3d/native-catalog';
import { BILL_STACK_MAX_COUNT, billClipboard, clearBillClipboard, pasteBillFromClipboard } from '../src/ui/bill-clipboard';
import { clearWorkPriorityClipboard, hasWorkPriorityClipboard, workPriorityClipboardValue } from '../src/ui/work-priority-clipboard';

/* Copy and paste of production bills (Core BillUtility.Clipboard, ITab_Bills)
 * and of a colonist's work priorities (PawnColumnWorker_CopyPasteWorkPriorities),
 * driven through the native inspector and Work table with the real commands. */

let epoch = 365_000;
const ok = (world: World, command: Command) => { const result = applyCommand(world, command); expect(result, JSON.stringify(command)).toMatchObject({ ok: true }); };
const find = (page: NativePage, id: string): NativeControl | undefined => [...page.rows.flatMap(row => row.controls ?? []), ...(page.actions ?? [])].find(control => control.id === id);
const control = (page: NativePage, id: string): NativeControl => { const found = find(page, id); expect(found, `Contrôle absent : ${id}`).toBeDefined(); return found!; };
const feedback = (page: NativePage) => page.rows.find(row => row.id === 'inspector-feedback')?.label ?? '';
/** The fields Core's Bill_Production.Clone copies that Elsewhere has. */
const copied = (bill: CookingBill) => { const { id: _id, reservePause, ...rest } = bill; return { ...rest, pause: reservePause ? { enabled: reservePause.enabled, resumeAt: reservePause.resumeAt } : undefined }; };

function billFixture(refuse?: (command: Command) => string | undefined) {
  const world = createWorld(++epoch, 24, 24);
  for (const pawn of world.pawns) delete pawn.background;
  world.research = { project: null, points: CLOTHING_RESEARCH_COST, completedAt: world.tick }; // tailoring benches
  const bench = (kind: Structure['kind'], z: number, material: Structure['material']): Structure => {
    const station: Structure = { id: world.nextId++, kind, x: 6, z, orientation: 0, footprint: 'standard', material, bills: [], ...kind === 'electric-tailor-bench' ? { power: newPowerState(kind) } : {} };
    world.resources = world.resources.filter(r => r.x < 3 || r.x > 9 || r.z < z - 2 || r.z > z + 2);
    world.structures.push(station); for (let x = 4; x <= 8; x++) for (let dz = -1; dz <= 1; dz++) delete world.tiles[(z + dz) * world.width + x]!.fogged;
    return station;
  };
  const source = bench('tailor-bench', 4, 'wood'), target = bench('electric-tailor-bench', 10, 'steel'), art = bench('art-bench', 16, 'wood');
  const bill = newCookingBill(world.nextId++, 'shirt', world.schemaVersion); source.bills!.push(bill);
  const materials = PRODUCTION_RECIPES.shirt.inputs;
  // Non-default settings, each through its real command.
  ok(world, { type: 'bill-update', structureId: source.id, billId: bill.id, settings: {
    mode: 'until', target: 7, suspended: true, radius: 42, destination: 'drop',
    filters: Object.fromEntries(materials.map((item, index) => [item, index % 2 === 0])),
    apparelCount: { hpMin: 51, hpMax: 100, qualityMin: 'normal', qualityMax: 'legendary', includeEquipped: true },
  } });
  ok(world, { type: 'bill-pause-policy', structureId: source.id, billId: bill.id, policy: { enabled: true, resumeAt: 3 } });
  ok(world, { type: 'bill-worker-policy', structureId: source.id, billId: bill.id, policy: { pawnId: world.pawns[0]!.id, skillMin: 2, skillMax: 15 } });
  const state: NativeUiState = {
    world, epoch, panel: null, category: 'orders', tool: 'select', orientation: 0,
    selectedPawnIds: [], selectedObjects: [], constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } },
    speed: 0, hasGame: true, busy: false, saves: [],
  };
  let page!: NativePage;
  const sent: Command[] = [], noop = () => {};
  const actions: NativeUiActions = {
    command: vi.fn(async (command: Command) => { sent.push(command); const reason = refuse?.(command); return reason ? { ok: false, reason } : applyCommand(world, command); }),
    panel: noop, category: noop, tool: noop, selectPawn: noop, speed: noop, rotate: noop, material: noop, creationStorage: noop, front: noop,
    save: noop, exportSave: noop, showPage: next => { page = next; }, refresh: noop, readState: () => state,
  };
  /** Selects a bench and opens its bills, as the player does. */
  const openBills = async (station: Structure) => {
    state.selectedObjects = [{ kind: 'structure', id: station.id }];
    setNativeInspectorTab('bills');
    page = buildNativeInspector(state, actions)!;
    return page;
  };
  const rebuild = () => { page = buildNativeInspector(state, actions)!; return page; };
  return { world, state, actions, sent, source, target, art, bill, openBills, rebuild, get page() { return page; } };
}

describe('bill clipboard', () => {
  beforeEach(() => { clearBillClipboard(); clearWorkPriorityClipboard(); });

  it('copies the applied bill and pastes an equal new bill on another bench through existing commands', async () => {
    const f = billFixture();
    const before = structuredClone(f.bill);
    let page = await f.openBills(f.source);
    expect(find(page, 'bill-paste')).toBeUndefined();
    // An unapplied draft is not copied: Core copies the bill itself.
    await page.rows.find(row => row.id === `bill-target-${f.bill.id}`)!.input!.onCommit('99');
    await control(f.page, `bill-copy-${f.bill.id}`).onActivate();
    expect(feedback(f.page)).toContain('Facture copiée : Chemise');
    expect(billClipboard(f.state.epoch)?.settings.target).toBe(7);
    expect(f.sent).toEqual([]);

    page = await f.openBills(f.target);
    const paste = control(page, 'bill-paste');
    expect(paste.disabled).toBe(false);
    expect(page.rows.find(row => row.id === 'bill-paste')?.value).toBe('Chemise');
    const nextId = f.world.nextId;
    await paste.onActivate();
    expect(f.sent.map(command => command.type)).toEqual(['bill-add', 'bill-update', 'bill-pause-policy', 'bill-worker-policy']);
    expect(f.target.bills).toHaveLength(1);
    const pasted = f.target.bills![0]!;
    expect(pasted.id).toBe(nextId);
    expect(pasted.id).not.toBe(f.bill.id);
    expect(copied(pasted)).toEqual(copied(f.bill));
    expect(pasted).toMatchObject({ recipe: 'shirt', mode: 'until', target: 7, suspended: true, radius: 42, destination: 'drop', worker: { pawnId: f.world.pawns[0]!.id, skillMin: 2, skillMax: 15 } });
    expect(pasted.reservePause).toEqual({ enabled: true, resumeAt: 3, paused: false });
    expect(f.bill).toEqual(before);
    expect(feedback(f.page)).toBe('Facture collée : Chemise.');
    // The clipboard is kept: a second paste gives a second independent bill.
    await control(f.page, 'bill-paste').onActivate();
    expect(f.target.bills).toHaveLength(2);
    expect(copied(f.target.bills![1]!)).toEqual(copied(f.bill));
    expect(f.target.bills![1]!.filters).not.toBe(f.target.bills![0]!.filters);
    // The pasted bills are ordinary bills of the save; the clipboard is not saved.
    const text = serializeWorld(f.world), reloaded = deserializeWorld(text);
    expect(serializeWorld(reloaded)).toBe(text);
    expect(text).not.toContain('clipboard');
    expect(copied(reloaded.structures.find(s => s.id === f.target.id)!.bills![1]!)).toEqual(copied(f.bill));
  });

  it('refuses the paste on a bench without the recipe and at the 15-bill limit, with no command', async () => {
    const f = billFixture();
    await f.openBills(f.source);
    await control(f.page, `bill-copy-${f.bill.id}`).onActivate();

    let page = await f.openBills(f.art);
    let paste = control(page, 'bill-paste');
    expect(paste.disabled).toBe(true);
    expect(paste.hint).toContain('Ce poste ne fait pas cette recette.');
    await paste.onActivate();
    await expect(pasteBillFromClipboard({ send: f.actions.command, readWorld: () => f.world }, f.art.id, f.state.epoch)).rejects.toThrow('Ce poste ne fait pas cette recette.');
    expect(f.sent).toEqual([]);
    expect(f.art.bills).toEqual([]);

    for (let n = 0; n < BILL_STACK_MAX_COUNT - 1; n++) ok(f.world, { type: 'bill-add', structureId: f.target.id, recipe: 'pants' });
    page = await f.openBills(f.target);
    expect(control(page, 'bill-paste').disabled).toBe(false);
    expect(control(page, 'add-bill').select!.options.find(option => option.value === 'add-bill-pants')!.disabled).toBeFalsy();
    await control(page, 'bill-paste').onActivate();
    expect(f.target.bills).toHaveLength(BILL_STACK_MAX_COUNT);
    f.sent.length = 0;
    page = f.rebuild();
    paste = control(page, 'bill-paste');
    expect(paste.disabled).toBe(true);
    expect(paste.hint).toContain('15 factures, le maximum par poste');
    expect(control(page, 'add-bill').select!.options.find(option => option.value === 'add-bill-pants')!.disabled).toBe(true);
    await paste.onActivate();
    await expect(pasteBillFromClipboard({ send: f.actions.command, readWorld: () => f.world }, f.target.id, f.state.epoch)).rejects.toThrow('le maximum par poste');
    expect(f.sent).toEqual([]);
    expect(f.target.bills).toHaveLength(BILL_STACK_MAX_COUNT);
  });

  it('removes the added bill when a later setting is refused, so a paste is complete or absent', async () => {
    let refusing = true;
    const f = billFixture(command => refusing && command.type === 'bill-pause-policy' ? 'Refus simulé.' : undefined);
    await f.openBills(f.source);
    await control(f.page, `bill-copy-${f.bill.id}`).onActivate();
    const page = await f.openBills(f.target);
    await control(page, 'bill-paste').onActivate();
    expect(f.sent.map(command => command.type)).toEqual(['bill-add', 'bill-update', 'bill-pause-policy', 'bill-remove']);
    expect(f.target.bills).toEqual([]);
    expect(feedback(f.page)).toContain('la facture ajoutée a été retirée : Refus simulé.');
    refusing = false;
    await control(f.rebuild(), 'bill-paste').onActivate();
    expect(f.target.bills).toHaveLength(1);
  });

  it('clears an unavailable designated person as Bill.ValidateSettings does, keeping the skill range', async () => {
    const f = billFixture();
    await f.openBills(f.source);
    await control(f.page, `bill-copy-${f.bill.id}`).onActivate();
    f.world.pawns[0]!.state = 'dead';
    const page = await f.openBills(f.target);
    await control(page, 'bill-paste').onActivate();
    expect(f.sent.map(command => command.type)).toEqual(['bill-add', 'bill-update', 'bill-pause-policy', 'bill-worker-policy', 'bill-worker-policy']);
    expect(f.target.bills![0]!.worker).toEqual({ pawnId: null, skillMin: 2, skillMax: 15 });
    expect(feedback(f.page)).toContain('n’est plus disponible');
    expect(billClipboard(f.state.epoch)?.worker).toEqual({ pawnId: null, skillMin: 2, skillMax: 15 });
  });

  it('lives in the interface: kept across a change of map view, dropped by another game, never in the World', async () => {
    const f = billFixture();
    await f.openBills(f.source);
    await control(f.page, `bill-copy-${f.bill.id}`).onActivate();
    expect(JSON.stringify(f.world)).not.toContain('clipboard');
    // Another selection, panel or map view keeps the copy (same game epoch).
    f.state.selectedObjects = []; f.rebuild();
    expect(billClipboard(f.state.epoch)?.recipe).toBe('shirt');
    let page = await f.openBills(f.target);
    expect(find(page, 'bill-paste')).toBeDefined();
    // A new or loaded game is a new epoch: Core clears the clipboard with the maps and world.
    f.state.epoch = (f.state.epoch ?? 0) + 1;
    page = await f.openBills(f.target);
    expect(find(page, 'bill-paste')).toBeUndefined();
    expect(billClipboard(f.state.epoch)).toBeUndefined();
  });
});

function workFixture() {
  const world = createWorld(++epoch, 16, 16);
  for (const pawn of world.pawns) delete pawn.background;
  let page!: NativePage;
  const sent: Command[] = [];
  const state: NativeUiState = { world, epoch, panel: 'work', category: 'structure', tool: 'select', orientation: 0,
    selectedPawnIds: [], selectedObjects: [], constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } },
    speed: 0, hasGame: true, busy: false, saves: [] };
  const noop = () => {};
  const actions: NativeUiActions = { command: vi.fn(async (command: Command) => { sent.push(command); return applyCommand(world, command); }), panel: vi.fn(), category: noop,
    tool: vi.fn(), selectPawn: noop, speed: noop, rotate: noop, material: noop, creationStorage: noop, front: noop,
    save: noop, exportSave: noop, showPage: vi.fn(next => { page = next; }), refresh: vi.fn(), readState: () => state };
  const rebuild = () => { page = buildNativePanel(state, actions)!; return page; };
  rebuild();
  return { world, state, sent, rebuild, get page() { return page; } };
}

describe('work priorities clipboard', () => {
  beforeEach(() => { clearBillClipboard(); clearWorkPriorityClipboard(); });
  const works = workColumns.map(column => column.id);

  it('adds a copy and a paste cell to each colonist row of the Work table', () => {
    const f = workFixture(), pawn = f.world.pawns[0]!;
    expect(f.page.rows[0]!.columns?.slice(-2).map(column => column.label)).toEqual(['Copier', 'Coller']);
    const row = f.page.rows.find(entry => entry.id === `worker-${pawn.id}`)!;
    expect(row.controls?.slice(-2).map(entry => entry.id)).toEqual([`work-copy-${pawn.id}`, `work-paste-${pawn.id}`]);
    expect(control(f.page, `work-paste-${pawn.id}`).disabled).toBe(true);
  });

  it('copies 0 for a work the source cannot do and skips the works the target cannot do', async () => {
    const f = workFixture(), [a, b] = f.world.pawns as [typeof f.world.pawns[0], typeof f.world.pawns[0]];
    a.background = { childhood: 'settlement-child', adulthood: 'mercenary' }; // cannot doctor
    b.background = { childhood: 'settlement-child', adulthood: 'medic' }; // cannot hunt
    expect(backgroundWorkRefusal(a, 'doctor')).toBeDefined();
    expect(backgroundWorkRefusal(b, 'hunt')).toBeDefined();
    works.forEach((work, index) => { a.priorities[work] = index % 5; b.priorities[work] = (index + 2) % 5; });
    a.priorities.doctor = 2; a.priorities.hunt = 1; b.priorities.doctor = 4; b.priorities.hunt = 3;
    const bBefore = Object.fromEntries(works.map(work => [work, storedPriority(b, work)]));
    f.rebuild();
    await control(f.page, `work-copy-${a.id}`).onActivate();
    expect(hasWorkPriorityClipboard()).toBe(true);
    expect(workPriorityClipboardValue('doctor')).toBe(0);
    expect(f.sent).toEqual([]);
    f.rebuild();
    expect(control(f.page, `work-paste-${b.id}`).disabled).toBe(false);
    await control(f.page, `work-paste-${b.id}`).onActivate();
    for (const work of works) {
      const expected = backgroundWorkRefusal(b, work) ? bBefore[work] : backgroundWorkRefusal(a, work) ? 0 : storedPriority(a, work);
      expect(storedPriority(b, work), work).toBe(expected);
    }
    expect(b.priorities.hunt).toBe(3);
    expect(b.priorities.doctor).toBe(0);
    expect(f.sent.every(command => command.type === 'priority' && command.pawnId === b.id)).toBe(true);
    expect(f.sent.some(command => command.type === 'priority' && command.work === 'hunt')).toBe(false);
    // Only the changed values are sent; pasting again sends nothing.
    f.sent.length = 0; f.rebuild();
    await control(f.page, `work-paste-${b.id}`).onActivate();
    expect(f.sent).toEqual([]);
  });

  it('copies the shown priority of the simple tab and keeps the copy across another game', async () => {
    const f = workFixture(), [a, b] = f.world.pawns as [typeof f.world.pawns[0], typeof f.world.pawns[0]];
    for (const work of works) { a.priorities[work] = 0; b.priorities[work] = 0; }
    a.priorities.build = 1; a.priorities.cook = 4; b.priorities.mine = 2;
    f.world.simpleWorkTab344 = true; f.rebuild();
    await control(f.page, `work-copy-${a.id}`).onActivate();
    expect(workPriorityClipboardValue('build')).toBe(3);
    expect(workPriorityClipboardValue('cook')).toBe(3);
    f.state.epoch = (f.state.epoch ?? 0) + 1; f.rebuild();
    await control(f.page, `work-paste-${b.id}`).onActivate();
    expect([b.priorities.build, b.priorities.cook, b.priorities.mine]).toEqual([3, 3, 0]);
  });
});

