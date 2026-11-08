import { expect, test } from 'vitest';
import { createScenarioWorld } from '../src/sim/new-game';
import { updateNeeds } from '../src/sim/needs';
import { updateWellbeing, wellbeingLocalTicks } from '../src/sim/wellbeing';
import { groupPawnInterval256 } from '../src/sim/group-core-cadence-256';
import { MOOD_FALL_PER_HOUR, MOOD_RISE_PER_HOUR, moodTarget, moodThoughts } from '../src/sim/mood';
import { TICKS_PER_DAY, type World } from '../src/sim/types';

// RimWorld 1.6 Pawn_NeedsTracker: NeedInterval once every 150 Core ticks at the
// pawn's hashed tick, by a full 150-tick step. One local tick = 10 Core ticks:
// local tick t owns Core ticks (t-1)*10+1 … t*10.
const due = (id: number, tick: number) => groupPawnInterval256(id, Math.max(0, (tick - 1) * 10 + 1), 150, 10);

function world(schemaVersion?: number): World {
  const w = createScenarioWorld(42, 32, 'crashlanded', { hilliness: 'small-hills', biome: 'temperate-forest' });
  if (schemaVersion !== undefined) w.schemaVersion = schemaVersion as World['schemaVersion'];
  return w;
}

test('the map need pass steps comfort and mood once per 15 local ticks, at each colonist hashed tick', () => {
  const w = world(), pawns = w.pawns.filter(p => p.state !== 'dead' && p.state !== 'sleeping');
  expect(pawns.length).toBeGreaterThan(0);
  for (const p of pawns) { p.mood = 10; p.comfort = 50; }
  const steps = new Map(pawns.map(p => [p.id, 0]));
  for (let i = 0; i < 30; i++) {
    w.tick += 1;
    for (const p of pawns) {
      const before = [p.mood, p.comfort], isDue = due(p.id, w.tick);
      expect(wellbeingLocalTicks(w, p)).toBe(isDue ? 15 : 0);
      const target = moodTarget(moodThoughts(w, p, undefined, undefined, false));
      updateNeeds(w, p);
      if (!isDue) { expect([p.mood, p.comfort]).toEqual(before); continue; }
      steps.set(p.id, steps.get(p.id)! + 1);
      const amount = (target > before[0]! ? MOOD_RISE_PER_HOUR : MOOD_FALL_PER_HOUR) * 24 / TICKS_PER_DAY * 15;
      expect(p.mood).toBe(target > before[0]! ? Math.min(target, before[0]! + amount) : Math.max(target, before[0]! - amount));
    }
  }
  // 30 local ticks = 300 Core ticks: exactly two intervals per colonist.
  for (const p of pawns) expect(steps.get(p.id)).toBe(2);
});

test('a direct wellbeing step covers the given local ticks', () => {
  const w = world(), p = w.pawns.find(x => x.state !== 'dead' && x.state !== 'sleeping')!;
  p.mood = 10;
  const target = moodTarget(moodThoughts(w, p, undefined, undefined, false));
  updateWellbeing(w, p, undefined, undefined, undefined, undefined, 15);
  const amount = (target > 10 ? MOOD_RISE_PER_HOUR : MOOD_FALL_PER_HOUR) * 24 / TICKS_PER_DAY * 15;
  expect(p.mood).toBe(target > 10 ? Math.min(target, 10 + amount) : Math.max(target, 10 - amount));
});

test('historical schemas keep the per-tick wellbeing pass', () => {
  const w = world(300), p = w.pawns.find(x => x.state !== 'dead' && x.state !== 'sleeping')!;
  for (let i = 0; i < 20; i++) { w.tick += 1; expect(wellbeingLocalTicks(w, p)).toBe(1); }
});
