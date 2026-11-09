import { describe, expect, test } from 'vitest';
import { applyCommand, createWorld, deserializeWorld, serializeWorld, validateWorld } from '../src/sim/index';
import { billWork, stationWork } from '../src/sim/production-recipes';
import { disablesWork, storedPriority, workPriority } from '../src/sim/work-types';
import { RIM_WORK_TYPES } from '../src/sim/work-givers-rimworld';
import { SCHEMA_VERSION } from '../src/sim/types';
import type { Pawn, World } from '../src/sim/types';

// Core 1.6: Smithing (470), Tailoring (450) and Crafting (400) are three work
// types with their own priority; a bill's work type is its table's giver's.

describe('work types of bills and tables', () => {
  test('smithy, machining table and fabrication bench are Smithing; tailor benches Tailoring; other crafting tables Crafting', () => {
    expect(RIM_WORK_TYPES.Smithing.work).toBe('smith');
    expect(RIM_WORK_TYPES.Tailoring.work).toBe('tailor');
    expect(RIM_WORK_TYPES.Crafting.work).toBe('craft');
    for (const recipe of ['make-plate-armor', 'make-longsword', 'make-revolver', 'make-flak-vest', 'make-prosthetic-arm', 'make-component', 'make-recon-armor', 'shred-mechanoid'] as const)
      expect(billWork({ recipe }), recipe).toBe('smith');
    for (const recipe of ['shirt', 'pants', 'duster', 'parka', 'tuque'] as const) expect(billWork({ recipe }), recipe).toBe('tailor');
    for (const recipe of ['tribalwear', 'stone-blocks', 'smelt-weapon', 'chemfuel-from-wood', 'make-medicine', 'smash-mechanoid'] as const) expect(billWork({ recipe }), recipe).toBe('craft');
    expect(billWork({ recipe: 'simple-meal' })).toBe('cook');
    for (const kind of ['fueled-smithy', 'electric-smithy', 'machining-table', 'fabrication-bench'] as const) expect(stationWork({ kind })).toBe('smith');
    for (const kind of ['tailor-bench', 'electric-tailor-bench'] as const) expect(stationWork({ kind })).toBe('tailor');
    for (const kind of ['crafting-spot', 'stonecutter', 'electric-smelter', 'biofuel-refinery', 'drug-lab'] as const) expect(stationWork({ kind })).toBe('craft');
  });
});

function colony(): { w: World; p: Pawn } {
  const w = createWorld(42, 32, 32), p = w.pawns[0]!;
  delete p.background;
  return { w, p };
}

describe('priorities of the three work types', () => {
  test('a pawn without its own smithing or tailoring priority uses its crafting priority', () => {
    const { p } = colony();
    p.priorities.craft = 2; delete p.priorities.smith; delete p.priorities.tailor;
    expect(storedPriority(p, 'smith')).toBe(2); expect(workPriority(p, 'tailor')).toBe(2);
  });
  test('the first change of any of the three sets them apart; each then changes alone', () => {
    const { w, p } = colony();
    p.priorities.craft = 2; delete p.priorities.smith; delete p.priorities.tailor;
    expect(applyCommand(w, { type: 'priority', pawnId: p.id, work: 'craft', value: 4 }).ok).toBe(true);
    expect(p.priorities).toMatchObject({ craft: 4, smith: 2, tailor: 2 });
    expect(applyCommand(w, { type: 'priority', pawnId: p.id, work: 'smith', value: 1 }).ok).toBe(true);
    expect(p.priorities).toMatchObject({ craft: 4, smith: 1, tailor: 2 });
    expect(validateWorld(w)).toEqual([]);
    const loaded = deserializeWorld(serializeWorld(w));
    expect(loaded.pawns[0]!.priorities).toMatchObject({ craft: 4, smith: 1, tailor: 2 });
  });
  test('disabling crafting stops smithing only while smithing still follows it (older saves)', () => {
    const { p } = colony();
    delete p.priorities.smith;
    expect(disablesWork({ schemaVersion: 301 }, p, 'craft', 'smith')).toBe(true);
    expect(disablesWork({ schemaVersion: SCHEMA_VERSION }, p, 'craft', 'smith')).toBe(false);
    p.priorities.smith = 3;
    expect(disablesWork({ schemaVersion: 301 }, p, 'craft', 'smith')).toBe(false);
    expect(disablesWork({ schemaVersion: SCHEMA_VERSION }, p, 'smith', 'smith')).toBe(true);
  });
});

describe('schema 302', () => {
  test('a 301 save migrates by its number only, and refuses future smithing or tailoring priorities', () => {
    const { w, p } = colony();
    p.priorities.craft = 3; delete p.priorities.smith; delete p.priorities.tailor;
    const raw = JSON.parse(serializeWorld(w));
    raw.schemaVersion = 301;
    const migrated = deserializeWorld(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.pawns[0]!.priorities.smith).toBeUndefined();
    expect(storedPriority(migrated.pawns[0]!, 'smith')).toBe(3);
    const future = JSON.parse(JSON.stringify(raw));
    future.pawns[0].priorities.smith = 2;
    expect(() => deserializeWorld(JSON.stringify(future))).toThrow(/Invalid version301 save/);
  });
  test('a 302 save accepts its own smithing priority from 0 to 4 only', () => {
    const { w, p } = colony();
    p.priorities.smith = 4; expect(validateWorld(w)).toEqual([]);
    p.priorities.smith = 5; expect(validateWorld(w)).toContain('Invalid smithing or tailoring priority for schema.');
  });
});
