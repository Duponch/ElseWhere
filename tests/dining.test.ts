import { expect, test } from 'vitest';
import { addGroundMaterial, applyCommand, createWorld, deserializeWorld, hashWorld, refreshStock, serializeWorld, stepWorld, validateWorld } from '../src/sim/index.ts';
import type { StructureKind, World } from '../src/sim/types.ts';
import { comfortMood, updateWellbeing } from '../src/sim/wellbeing.ts';
import { adjacentTable, chooseDiningPlace, validDiningPlace } from '../src/sim/dining.ts';
import { reachableCells } from '../src/sim/pathfinding.ts';
import { withJournalTerrainReadScope } from '../src/sim/terrain-read-scope.ts';
import { couchCells365 } from '../src/sim/straw-couch-365.ts';
import legacyMeal from './fixtures/schema-3-ingestion.json';

function fixture(count = 1, size = 64): World {
  const w = createWorld(87, size, size);
  w.foodRules = 'legacy';
  w.foodRules = 'legacy';
  w.tiles = w.tiles.map(() => ({ terrain: 'grass' })); w.resources = []; w.piles = []; w.stockpiles = [];
  w.pawns = w.pawns.slice(0, count);
  w.pawns.forEach((p, i) => { p.x = 2; p.z = 2 + i * 2; p.hunger = 20; p.rest = 100; p.comfort = 10; p.priorities = {handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2, gather: 0, build: 0, haul: 0, grow: 0 , cook: 0 }; });
  refreshStock(w); return w;
}
function furniture(w: World, kind: StructureKind, x: number, z: number, orientation: 0 | 1 | 2 | 3 = 0): number {
  const id = w.nextId++; w.structures.push({ id, kind, x, z, orientation, footprint: 'standard', quality: 'normal' }); return id;
}
function checked(w: World, count = 1): void {
  for (let i = 0; i < count; i++) { stepWorld(w); expect(validateWorld(w), `tick ${w.tick}`).toEqual([]); }
}

test('closed dining lookups preserve couch cells, table priority and live claims', () => {
  const world=fixture(1,32),pawn=world.pawns[0]!;
  world.structures=[]; world.jobs=[];
  const seatId=furniture(world,'couch',8,8);
  const seat=couchCells365(world.structures[0]!)[1]!;
  pawn.x=seat.x; pawn.z=seat.z;
  const first=furniture(world,'table',seat.x+1,seat.z,1);
  const last=furniture(world,'table',seat.x+1,seat.z,1);
  const context={search:()=>reachableCells(world,pawn,new Uint8Array(world.width*world.height),new Set()),move(){},release:()=>true,event(){}};
  const closed=<T>(f:()=>T)=>withJournalTerrainReadScope(world,f);
  const choose=()=>chooseDiningPlace(world,pawn,context);
  const placement={target:seat,seatId,tableId:last};
  expect(choose()?.place).toEqual(placement);
  expect(closed(choose)?.place).toEqual(placement);
  expect(closed(()=>adjacentTable(world,seat))?.id).toBe(first);
  expect(closed(()=>validDiningPlace(world,placement))).toBe(true);
  world.structures[2]!.factionId=null;
  expect(closed(choose)?.place.tableId).toBe(first);
  expect(closed(()=>validDiningPlace(world,placement))).toBe(false);
  world.structures=world.structures.slice(1);
  expect(closed(()=>validDiningPlace(world,{...placement,tableId:first}))).toBe(false);
});
function until(w: World, predicate: () => boolean, limit = 600): void {
  for (let i = 0; i < limit && !predicate(); i++) checked(w);
  expect(predicate(), JSON.stringify(w.pawns)).toBe(true);
}

test('two diners reserve distinct seats, physically carry food, save every phase and conserve meals through interruption', () => {
  const w = fixture(2, 32);
  furniture(w, 'table', 9, 2);
  const seats = [furniture(w, 'stool', 8, 2, 3), furniture(w, 'stool', 10, 3, 2)];
  w.pawns.forEach(p => addGroundMaterial(w, 'food', 1, { x: 4, z: p.z }));
  const phases = new Map<string, string>();
  const initialComfort = w.pawns.map(p => p.comfort);
  for (let i = 0; i < 260; i++) {
    checked(w);
    const reserved = w.pawns.flatMap(p => p.need?.kind === 'eat' && p.need.dining?.seatId !== null && p.need.dining ? [p.need.dining.seatId] : []);
    expect(new Set(reserved).size).toBe(reserved.length);
    for (const p of w.pawns) {
      if (p.need?.kind !== 'eat') continue;
      if (!phases.has(p.need.phase)) phases.set(p.need.phase, serializeWorld(w));
      expect(p.hunger).toBeLessThan(20);
      if (p.need.phase !== 'ingest') expect(p.need.progress).toBe(0);
      else {
        expect(seats).toContain(p.need.dining!.seatId);
        expect({ x: p.x, z: p.z }).toEqual(p.need.dining!.target);
        expect(w.piles.find(pile => pile.owner.type === 'pawn' && pile.owner.pawnId === p.id)).toMatchObject({ kind: 'food', quantity: 1 });
      }
    }
  }
  expect([...phases.keys()]).toEqual(['pickup', 'choose-spot', 'travel', 'ingest']);
  expect(w.stock.food).toBe(0); expect(w.pawns.every(p => p.memories.length === 0 && p.hunger > 50)).toBe(true);
  expect(w.pawns.every((p, i) => p.comfort > initialComfort[i]!)).toBe(true);
  for (const saved of phases.values()) {
    const a = deserializeWorld(saved), b = deserializeWorld(saved);
    checked(a, 280); checked(b, 280); expect(hashWorld(a)).toBe(hashWorld(b));
  }
  const removed = deserializeWorld(phases.get('travel')!);
  const eater = removed.pawns.find(p => p.need?.kind === 'eat' && p.need.phase === 'travel')!;
  if (eater.need?.kind !== 'eat') throw new Error('Missing meal');
  const heldId = eater.need.carryPileId;
  const removedSeat = eater.need.dining!.seatId;
  removed.structures = removed.structures.filter(item => item.id !== removedSeat);
  checked(removed);
  expect(removed.piles.some(pile => pile.id === heldId)).toBe(true);
  until(removed, () => removed.stock.food === 0);
  const interrupted = deserializeWorld(phases.get('ingest')!);
  const tired = interrupted.pawns.find(p => p.state === 'eating')!;
  tired.rest = 0; tired.restZeroTicks = 150; tired.collapsePending = true; const before = interrupted.stock.food; checked(interrupted);
  expect(tired.state).toBe('sleeping'); expect(interrupted.stock.food).toBe(before);
  expect(tired.memories).toEqual([]);
  expect(interrupted.piles.some(pile => pile.owner.type === 'ground' && pile.owner.x === tired.x && pile.owner.z === tired.z)).toBe(true);
  const migrated = deserializeWorld(JSON.stringify(legacyMeal));
  expect(migrated.pawns[0]!.need).toMatchObject({ kind: 'eat', phase: 'ingest', progress: 17 });
  expect(migrated.piles.map(({item, ...pile}) => pile)).toEqual(legacyMeal.piles); expect(migrated.pawns[0]!.memories).toEqual([]);
  checked(migrated, 33); expect(migrated.stock.food).toBe(1);
  for (const mutate of [
    (data: any) => { data.pawns.find((p: any) => p.state === 'eating').need.dining.target.x++; },
    (data: any) => { data.pawns.find((p: any) => p.state === 'eating').need.dining.seatId = 999999; },
    (data: any) => { data.pawns[0].comfort = NaN; },
    (data: any) => { data.pawns[0].memories = [{ kind: 'ate-without-table', expiresAt: data.tick + 6001 }]; },
  ]) {
    const data = JSON.parse(phases.get('ingest')!); mutate(data); expect(() => deserializeWorld(JSON.stringify(data))).toThrow();
  }
});

test('seat search uses the pickup position and food radius, cardinal adjacency and reachability, with standing fallback', () => {
  for (const [distance, expectedSeat] of [[32, true], [33, false]] as const) for (const orientation of [0, 1, 2, 3] as const) {
    const w = fixture(); addGroundMaterial(w, 'food', 1, w.pawns[0]!);
    const seat = furniture(w, 'stool', 2 + distance, 2, orientation); furniture(w, 'table', 3 + distance, 2);
    until(w, () => w.pawns[0]!.state === 'eating');
    expect(w.pawns[0]!.need).toMatchObject({ dining: { seatId: expectedSeat ? seat : null } });
    until(w, () => w.pawns[0]!.need?.kind !== 'eat');
    expect(w.pawns[0]!.memories.length).toBe(expectedSeat ? 0 : 1);
  }
  const distant = fixture(); furniture(distant, 'stool', 3, 2); furniture(distant, 'table', 4, 2);
  addGroundMaterial(distant, 'food', 1, { x: 46, z: 2 });
  until(distant, () => distant.pawns[0]!.state === 'eating');
  expect(distant.pawns[0]!.x).toBeGreaterThan(40);
  expect(distant.pawns[0]!.need).toMatchObject({ dining: { seatId: null } });
  const blocked = fixture(); furniture(blocked, 'stool', 7, 2); furniture(blocked, 'table', 8, 2);
  for (let z = 0; z < blocked.height; z++) blocked.tiles[z * blocked.width + 5] = { terrain: 'rock' };
  addGroundMaterial(blocked, 'food', 1, blocked.pawns[0]!); until(blocked, () => blocked.pawns[0]!.state === 'eating');
  expect(blocked.pawns[0]!.need).toMatchObject({ dining: { seatId: null } });
  const diagonal = fixture(); furniture(diagonal, 'stool', 6, 2); furniture(diagonal, 'table', 7, 3);
  addGroundMaterial(diagonal, 'food', 1, diagonal.pawns[0]!); until(diagonal, () => diagonal.pawns[0]!.state === 'eating');
  expect(diagonal.pawns[0]!.need).toMatchObject({ dining: { seatId: null } });
  const standing = fixture(); furniture(standing, 'table', 3, 2); addGroundMaterial(standing, 'food', 1, standing.pawns[0]!);
  until(standing, () => standing.pawns[0]!.state === 'eating'); checked(standing, 50);
  expect(standing.pawns[0]!.memories).toEqual([]); expect(standing.pawns[0]!.comfort).toBeLessThan(10);
  const contested = fixture(2); furniture(contested, 'table', 8, 2); furniture(contested, 'stool', 7, 2);
  contested.pawns.forEach(p => addGroundMaterial(contested, 'food', 1, p));
  until(contested, () => contested.stock.food === 0);
  expect(contested.pawns.filter(p => p.memories.length === 1)).toHaveLength(1);
});

test('wood must be delivered before furniture construction; comfort approaches a ceiling and meal memory expires without stacking', () => {
  const w = fixture(1, 32); const p = w.pawns[0]!;
  p.hunger = 100; p.priorities = {handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2, gather: 0, build: 1, haul: 1, grow: 0 , cook: 0 };
  addGroundMaterial(w, 'wood', 60, { x: 1, z: 4 });
  expect(applyCommand(w, { type: 'designate', kind: 'table', x: 8, z: 6, orientation: 1 })).toEqual({ ok: true });
  expect(applyCommand(w, { type: 'designate', kind: 'stool', x: 8, z: 5 })).toEqual({ ok: true });
  for (let i = 0; i < 900 && w.jobs.length; i++) {
    checked(w);
    for (const job of w.jobs) if (job.progress > 0) expect(job.escrow.wood).toBe(job.kind === 'table' ? 28 : 25);
    expect(w.piles.reduce((sum, pile) => sum + pile.quantity, 0) + w.structures.reduce((sum, item) => sum + (item.kind === 'table' ? 28 : 25), 0)).toBe(60);
  }
  expect(w.structures).toHaveLength(2); expect(w.stock.wood).toBe(7);
  const mood = fixture(1, 32), pawn = mood.pawns[0]!;
  addGroundMaterial(mood, 'food', 3, pawn);
  until(mood, () => mood.stock.food === 2); const expiry = pawn.memories[0]!.expiresAt;
  expect(expiry).toBe(mood.tick + 6000);
  pawn.hunger = 20; until(mood, () => mood.stock.food === 1);
  expect(pawn.memories).toHaveLength(1); expect(pawn.memories[0]!.expiresAt).toBeGreaterThan(expiry);
  furniture(mood, 'table', 3, 2); const seat = furniture(mood, 'stool', 2, 2, 2);
  const oldMemory = structuredClone(pawn.memories); pawn.hunger = 20; pawn.comfort = 49;
  until(mood, () => pawn.state === 'eating'); checked(mood, 49);
  expect(pawn.comfort).toBe(50); expect(pawn.need).toMatchObject({ dining: { seatId: seat } });
  checked(mood); expect(pawn.memories).toEqual(oldMemory);
  // A high comfort level decreases gradually toward a lower ceiling, not instantly.
  pawn.comfort = 75; const startTick = mood.tick;
  checked(mood, 250); expect(pawn.comfort).toBeCloseTo(71, 8); expect(mood.tick).toBe(startTick + 250);
  mood.tick = pawn.memories[0]!.expiresAt - 1; checked(mood); expect(pawn.memories).toEqual([]);
  expect([0, 9.99, 10, 59.99, 60, 70, 80, 90, 100].map(comfortMood)).toEqual([-3, -3, 0, 0, 4, 6, 8, 10, 10]);
  const bed = furniture(mood, 'bed', 12, 12); pawn.x = 12; pawn.z = 12; pawn.bedId = bed; pawn.rest = 10;
  pawn.need = { kind: 'sleep', phase: 'sleep', bedId: bed, target: { x: 12, z: 12 } }; pawn.state = 'sleeping'; pawn.comfort = 74.9;
  updateWellbeing(mood, pawn); expect(pawn.comfort).toBe(75);
});
