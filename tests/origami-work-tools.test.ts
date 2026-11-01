import { expect, test } from 'vitest';
import type { Job, Pawn } from '../src/sim/types';
import { origamiWorkTool } from '../src/render/origami/work-tools';
import {createWorld} from '../src/sim/index';

// One isolated fresh 32-cell QA fixture supplies a complete Pawn record. These
// tests only project cosmetic activity; no saved campaign or clock is advanced.
const basePawn = createWorld(1,32,32).pawns[0]!;
function fixture(kind: Job['kind'] = 'mine'): { pawn: Pawn; job: Job } {
  const pawn = structuredClone(basePawn);
  pawn.state = 'working'; pawn.jobId = 9001;
  delete pawn.draft; delete pawn.stun; pawn.haul = null; delete pawn.rescue;
  delete pawn.animalRescue; pawn.need = null; delete pawn.melee; delete pawn.shooting;
  const job: Job = { id: 9001, kind, x: pawn.x + 1, z: pawn.z, orientation: 0,
    footprint: 'standard', status: 'active', reservedBy: pawn.id, progress: .2, escrow: { wood: 0, food: 0 } };
  return { pawn, job };
}

test.each(['mine', 'chop', 'cut', 'harvest'] as const)('owned %s work has its cosmetic attachment while approaching and working', kind => {
  const { pawn, job } = fixture(kind), before = structuredClone({ pawn, job });
  const working = origamiWorkTool(pawn, job);
  expect(working).toBeLessThan(0);
  pawn.state = 'moving'; expect(origamiWorkTool(pawn, job)).toBe(working);
  pawn.state = before.pawn.state; expect({ pawn, job }).toEqual(before);
  // No replacement inventory/tool mechanic is created by the projection.
  expect(Object.keys(pawn)).toEqual(Object.keys(before.pawn));
});

test('mining, woodcutting and harvesting remain visually distinguishable, unsupported jobs have no invented tool', () => {
  const visible = ['mine', 'chop', 'harvest'].map(kind => {
    const { pawn, job } = fixture(kind as Job['kind']); return origamiWorkTool(pawn, job);
  });
  expect(new Set(visible).size).toBe(3);
  for (const kind of ['wall', 'lay-floor', 'build-roof'] as const) {
    const { pawn, job } = fixture(kind); expect(origamiWorkTool(pawn, job)).toBe(0);
  }
});

test('job cancellation, release or reassignment hides an old attachment immediately', () => {
  const { pawn, job } = fixture();
  expect(origamiWorkTool(pawn, undefined)).toBe(0);
  expect(origamiWorkTool({ ...pawn, jobId: null }, job)).toBe(0);
  expect(origamiWorkTool(pawn, { ...job, id: job.id + 1 })).toBe(0);
  expect(origamiWorkTool(pawn, { ...job, status: 'pending', reservedBy: null })).toBe(0);
  expect(origamiWorkTool(pawn, { ...job, reservedBy: null })).toBe(0);
  expect(origamiWorkTool(pawn, { ...job, reservedBy: pawn.id + 1 })).toBe(0);
});

test.each(['idle', 'sleeping', 'eating', 'resting', 'downed', 'dead'] as const)('interrupted %s actors cannot retain a work attachment', state => {
  const { pawn, job } = fixture(); pawn.state = state;
  expect(origamiWorkTool(pawn, job)).toBe(0);
});

test('drafting, stun and confirmed combat recovery suppress the work attachment without changing their owners', () => {
  const { pawn, job } = fixture();
  const cases: Partial<Pawn>[] = [
    { draft: { lastActiveTick: 3000, target: null, queue: [] } },
    { stun: { sinceCore: 30000, untilCore: 30045 } },
    { melee: { order: null, strike: null } },
    { shooting: { order: null, stance: { phase: 'cooldown', startedAtCore: 30000, endsAtCore: 30045 } } },
    { need: { kind: 'sleep', phase: 'travel', bedId: null, target: { x: pawn.x, z: pawn.z } } },
  ];
  for (const state of cases) {
    const subject = { ...pawn, ...state }, before = structuredClone(subject);
    expect(origamiWorkTool(subject, job)).toBe(0); expect(subject).toEqual(before);
  }
});

test('item hauling and human/animal carrying cannot show a work tool on the same hands', () => {
  const { pawn, job } = fixture();
  const cases: Partial<Pawn>[] = [
    { haul: { sourcePileId: 811, quantity: 4, phase: 'deliver', destination: { type: 'stockpile', stockpileId: 812 }, carryPileId: 813 } },
    { rescue: { patientId: 814, bedId: 815, phase: 'carry' } },
    { animalRescue: { animalId: 816, spotId: 817, phase: 'carry' } },
  ];
  for (const state of cases) {
    const subject = { ...pawn, ...state }, before = structuredClone(subject);
    expect(origamiWorkTool(subject, job)).toBe(0); expect(subject).toEqual(before);
  }
});
