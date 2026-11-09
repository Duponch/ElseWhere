import { describe, expect, test } from 'vitest';
import { stepWorld, validateWorld } from '../src/sim/index';
import { urgentWorkEnabled } from '../src/sim/urgent-care';
import { fireCamp, woodFire } from './scenarios/fire';
import type { Pawn, World } from '../src/sim/types';

// Core 1.6, Pawn_WorkSettings.CacheWorkGiversInOrder: an emergency giver is on
// the emergency list when its work type's priority is at most the best
// priority among the active work types that have an ordinary giver.
// Humanlike: JobGiver_Work(emergency) comes before eating (short of
// starvation), sleeping and recreation.

function only(p: Pawn, priorities: Partial<Pawn['priorities']>): void {
  for (const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[]) p.priorities[key] = 0;
  Object.assign(p.priorities, priorities);
}
function tired(w: World): { w: World; p: Pawn; fireId: number } {
  const p = w.pawns[0]!;
  // Tired enough to want sleep, far from exhaustion; fed.
  Object.assign(p, { rest: 20, hunger: 100 }); p.schedule.fill('anything');
  const fireId = woodFire(w, { x: p.x + 3, z: p.z });
  w.home = [...new Set([...(w.home ?? []), p.z * w.width + p.x + 3])].sort((a, b) => a - b);
  return { w, p, fireId };
}

describe('Core emergency work list', () => {
  test('firefighting has no ordinary giver, so it never sets the bound for doctoring or patient work', () => {
    const w = fireCamp(), p = w.pawns[0]!;
    only(p, { firefight: 1, doctor: 2, patient: 2, haul: 3 });
    expect(urgentWorkEnabled(p, 'doctor', w)).toBe(true);
    expect(urgentWorkEnabled(p, 'patient', w)).toBe(true);
    // Historical schemas keep their former bound.
    expect(urgentWorkEnabled(p, 'doctor', { schemaVersion: 300 } as unknown as World)).toBe(false);
    // An ordinary work type with a better priority does set it.
    only(p, { firefight: 1, doctor: 2, build: 1 });
    expect(urgentWorkEnabled(p, 'doctor', w)).toBe(false);
    expect(urgentWorkEnabled(p, 'firefight', w)).toBe(true);
    only(p, { firefight: 3, build: 1 });
    expect(urgentWorkEnabled(p, 'firefight', w)).toBe(false);
  });
  test('an idle tired colonist whose firefighting is an emergency fights the fire before going to sleep', () => {
    const { w, p, fireId } = tired(fireCamp());
    only(p, { firefight: 1, haul: 3 });
    for (let i = 0; i < 40 && !p.firefighting; i++) stepWorld(w);
    expect(p.firefighting?.fireId).toBe(fireId);
    expect(p.need?.kind).not.toBe('sleep');
    expect(validateWorld(w)).toEqual([]);
  });
  test('when ordinary work has a better priority, firefighting is ordinary work: the tired colonist sleeps first', () => {
    const { w, p } = tired(fireCamp());
    only(p, { firefight: 3, haul: 1 });
    for (let i = 0; i < 40 && !p.firefighting && p.need?.kind !== 'sleep'; i++) stepWorld(w);
    expect(p.firefighting).toBeUndefined();
    expect(p.need?.kind).toBe('sleep');
    expect(validateWorld(w)).toEqual([]);
  });
});
