import { describe, expect, it, vi } from 'vitest';
import { applyCommand, createWorld } from '../src/sim/index';
import type { ScheduleAssignment } from '../src/sim/schedule';
import type { NativeControl, NativePage, NativeUiActions, NativeUiState } from '../src/ui3d/native-contract';
import { buildNativePanel, buildNativeToolPalette } from '../src/ui3d/native-panels';
import { workColumns } from '../src/ui3d/native-catalog';

let seed = 476600;
function fixture(panel: 'work' | 'schedule' | 'architect' = 'work') {
  const world = createWorld(++seed, 16, 16);
  for (const pawn of world.pawns) delete pawn.background;
  let page: NativePage;
  const state: NativeUiState = { world, epoch: seed, panel, category: 'structure', tool: 'select', orientation: 0,
    selectedPawnIds: [], selectedObjects: [], constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } },
    speed: 0, hasGame: true, busy: false, saves: [] };
  const noop = () => {};
  const actions: NativeUiActions = { command: vi.fn(async command => applyCommand(world, command)), panel: vi.fn(), category: noop,
    tool: vi.fn(), selectPawn: noop, speed: noop, rotate: noop, material: noop, creationStorage: noop, front: noop,
    save: noop, exportSave: noop, showPage: vi.fn(next => { page = next; }), refresh: vi.fn(), readState: () => state,
    pawnActivity: id => `Activité confirmée ${id}` };
  const rebuild = () => { page = buildNativePanel(state, actions)!; return page; };
  const control = (id: string): NativeControl => {
    const found = [...page.rows.flatMap(row => row.controls ?? []), ...(page.actions ?? [])].find(control => control.id === id);
    if (!found) throw Error(`Contrôle natif absent : ${id}`); return found;
  };
  rebuild();
  return { world, state, actions, rebuild, control, get page() { return page; } };
}

describe('native work and schedule retain their direct confirmed interactions', () => {
  it('shows the twenty named columns and changes every priority through the local 0–4 selector', async () => {
    const f = fixture(), pawn = f.world.pawns[0]!, beforeOthers = f.world.pawns.slice(1).map(pawn => ({ ...pawn.priorities }));
    expect(f.page.layout).toBe('table');
    expect(f.page.rows[0]!.columns?.map(column => column.hint)).toEqual(workColumns.map(column => column.label));
    expect(f.page.rows[0]!.columns?.every(column => column.label.length > 0 && column.label.length <= 7)).toBe(true);
    const worker = f.page.rows.find(row => row.id === `worker-${pawn.id}`)!;
    expect(worker.controls).toHaveLength(20); expect(worker.value).toBe(`Activité confirmée ${pawn.id}`);
    const select = f.control(`work-${pawn.id}-build`);
    expect(select.select!.options.map(option => [option.value, option.label])).toEqual(['0', '1', '2', '3', '4'].map(value => [value, value]));
    expect(select.caption).toContain(String(pawn.skills.construction.level));
    expect(select.hint).toContain('Construction'); expect(select.hint).toContain('apprentissage');
    await select.onActivate();
    expect(f.actions.showPage).not.toHaveBeenCalled(); expect(f.actions.command).not.toHaveBeenCalled();
    for (const priority of [0, 1, 2, 3, 4]) {
      await select.select!.onChange(String(priority));
      expect(pawn.priorities.build).toBe(priority);
      expect(f.actions.command).toHaveBeenLastCalledWith({ type: 'priority', pawnId: pawn.id, work: 'build', value: priority });
      f.rebuild(); expect(f.control(select.id).select!.value).toBe(String(priority));
    }
    expect(f.world.pawns.slice(1).map(pawn => pawn.priorities)).toEqual(beforeOthers);
    expect(f.page.id).toBe('work'); expect(f.actions.showPage).not.toHaveBeenCalled();
  });

  it('keeps shooting, crafting and intellectual levels and passions visible in their work columns', () => {
    const f = fixture(), pawn = f.world.pawns[0]!;
    pawn.skills.shooting = { level: 9, xp: 120, dailyXp: 20, passion: 2 };
    pawn.skills.crafting = { level: 6, xp: 80, dailyXp: 10, passion: 1 };
    pawn.skills.intellectual = { level: 14, xp: 240, dailyXp: 30, passion: 0 };
    f.rebuild();
    const worker = f.page.rows.find(row => row.id === `worker-${pawn.id}`)!;
    expect(worker.compact).toBe(true);
    for (const [work, skill, label, passion] of [
      ['hunt', 'shooting', 'Tir', 'Passion brûlante'],
      ['craft', 'crafting', 'Artisanat', 'Passion'],
      ['research', 'intellectual', 'Intellectuel', 'Sans passion'],
    ] as const) {
      const record = pawn.skills[skill]!, control = f.control(`work-${pawn.id}-${work}`);
      expect(worker.controls).toContain(control);
      expect(control.caption).toBe(`${record.level}${' ♨'.repeat(record.passion)}`);
      expect(control.hint).toContain(`${label} ${record.level}/20`);
      expect(control.hint).toContain(passion);
      expect(control.hint).toContain('apprentissage');
      expect(control.select!.value).toBe(String(pawn.priorities[work]));
    }
    expect(f.actions.command).not.toHaveBeenCalled();
  });

  it('rejects invalid values, busy edits, and an incapacity newly applied to the real owner', async () => {
    const f = fixture(), pawn = f.world.pawns[0]!, select = f.control(`work-${pawn.id}-haul`).select!, saved = pawn.priorities.haul;
    for (const value of ['-1', '5', '1.5', 'not-a-priority']) expect(() => select.onChange(value)).toThrow('0 à 4');
    expect(f.actions.command).not.toHaveBeenCalled();
    f.state.busy = true;
    await expect(Promise.resolve().then(() => select.onChange('2'))).rejects.toThrow('opération courante');
    expect(f.actions.command).not.toHaveBeenCalled(); f.state.busy = false;
    pawn.background = { childhood: 'school-child', adulthood: 'researcher' };
    await expect(Promise.resolve().then(() => select.onChange('2'))).rejects.toThrow('Incapacité liée au passé');
    expect(pawn.priorities.haul).toBe(saved);
    f.rebuild(); const refused = f.control(`work-${pawn.id}-haul`);
    expect(refused.disabled).toBe(true); expect(refused.select!.value).toBe(String(saved));
    expect(refused.hint).toContain('Priorité enregistrée');
  });

  it('keeps the existing command-in-flight guard while a selector waits for confirmation', async () => {
    const f = fixture(), pawn = f.world.pawns[0]!, select = f.control(`work-${pawn.id}-build`).select!;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(f.actions.command).mockImplementationOnce(async command => { await gate; return applyCommand(f.world, command); });
    const pending = select.onChange('1');
    await expect(Promise.resolve().then(() => select.onChange('3'))).rejects.toThrow('opération courante');
    expect(f.actions.command).toHaveBeenCalledTimes(1);
    release(); await pending;
    expect(pawn.priorities.build).toBe(1);
    await select.onChange('3'); expect(pawn.priorities.build).toBe(3);
  });

  it('paints the supplied drag hours with one real command and leaves every other hour unchanged', async () => {
    const f = fixture('schedule'), pawn = f.world.pawns[0]!, before = [...pawn.schedule];
    await f.control('brush-work').onActivate(); f.rebuild();
    const row = f.page.rows.find(row => row.id === `schedule-${pawn.id}`)!;
    expect(row.controls).toHaveLength(26);
    const hours = row.controls!.slice(0, 24);
    expect(hours.map(control => control.paint!.index)).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
    expect(new Set(hours.map(control => control.paint!.group))).toEqual(new Set([`schedule-${pawn.id}`]));
    await hours[6]!.paint!.onPaint([6, 7, 8, 9]);
    expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'schedule-paint', pawnId: pawn.id, hours: [6, 7, 8, 9], assignment: 'work' });
    expect(pawn.schedule).toEqual(before.map((assignment, hour) => hour >= 6 && hour <= 9 ? 'work' : assignment));
    expect(pawn.schedule).toHaveLength(24);
  });

  it('copies and replaces exactly twenty-four confirmed hours without sharing either owner’s schedule', async () => {
    const f = fixture('schedule'), source = f.world.pawns[0]!, target = f.world.pawns[1]!;
    const assignments: ScheduleAssignment[] = ['anything', 'work', 'sleep', 'recreation'];
    source.schedule = Array.from({ length: 24 }, (_, hour) => assignments[hour % assignments.length]!);
    const expected = [...source.schedule];
    f.rebuild(); await f.control(`copy-${source.id}`).onActivate();
    expect(f.actions.command).not.toHaveBeenCalled();
    source.schedule[0] = 'sleep'; target.schedule = Array.from({ length: 24 }, () => 'anything');
    f.rebuild(); expect(f.control(`paste-${target.id}`).disabled).toBe(false);
    await f.control(`paste-${target.id}`).onActivate();
    expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({ type: 'schedule-replace', pawnId: target.id, assignments: expected });
    expect(target.schedule).toEqual(expected); expect(target.schedule).toHaveLength(24);
    expect(target.schedule).not.toBe(source.schedule);
    target.schedule[1] = 'sleep'; f.rebuild(); await f.control(`paste-${target.id}`).onActivate();
    expect(target.schedule).toEqual(expected); expect(source.schedule[0]).toBe('sleep');
  });

  it('keeps orders and zones outside Architect while dispatching their existing map tools', async () => {
    const f = fixture('architect');
    const categories = f.page.rows.find(row => row.id === 'architect-categories')!.controls!;
    expect(categories.map(control => control.id)).not.toContain('category-orders');
    expect(categories.map(control => control.id)).not.toContain('category-zones');
    for (const [kind, tool] of [['orders', 'mine'], ['zones', 'stockpile']] as const) {
      const palette = buildNativeToolPalette(f.state, f.actions, kind);
      expect(palette.id).toBe(`map-tools-${kind}`); expect(palette.layout).toBe('palette');
      const control = palette.rows.flatMap(row => row.controls ?? []).find(control => control.id === `tool-${tool}-select`)!;
      await control.onActivate(); expect(f.actions.tool).toHaveBeenLastCalledWith(tool);
      expect(palette.rows.flatMap(row => row.controls ?? []).some(control => control.id === 'tool-select-select')).toBe(false);
    }
    expect(f.actions.command).not.toHaveBeenCalled();
  });
});
