import { expect, test } from 'vitest';
import { applyCommand, createWorld, stepWorld, validateWorld } from '../src/sim/index';
import { newPowerState } from '../src/sim/power-rules';
import { fixturePower } from './scenarios/power';
import { researchCost } from '../src/sim/research';
import type { Structure, World } from '../src/sim/types';

// Core 1.6, WorkGiver_Researcher: prioritized by the bench's research speed
// factor (highest first), then the closest bench.
function camp(): World {
  const w = createWorld(42, 24, 24);
  w.resources = []; w.structures = []; w.piles = []; w.jobs = []; w.pawns = w.pawns.slice(0, 1);
  w.tiles = w.tiles.map(() => ({ terrain: 'grass' }));
  const p = w.pawns[0]!; Object.assign(p, { x: 3, z: 3, hunger: 100, rest: 100 }); p.schedule.fill('work');
  for (const k in p.priorities) p.priorities[k as keyof typeof p.priorities] = 0;
  p.priorities.research = 1;
  return w;
}

test('a researcher takes the faster bench before a closer, slower one', () => {
  const w = camp(), p = w.pawns[0]!;
  const simple: Structure = { id: w.nextId++, kind: 'research-bench', x: 6, z: 3, orientation: 0, material: 'wood', footprint: 'standard' };
  const hiTech: Structure = { id: w.nextId++, kind: 'hi-tech-research-bench', x: 16, z: 16, orientation: 0, material: 'steel', footprint: 'standard', power: newPowerState('hi-tech-research-bench') };
  // The hi-tech bench exists only after Microelectronics.
  w.research = { project: null, points: 0, microelectronics: { points: researchCost('microelectronics'), completedAt: w.tick } } as World['research'];
  w.structures.push(simple, hiTech);
  // Within reach of the generator's network (consumers link within six cells).
  fixturePower(w, 'wood-generator', 11, 14);
  // The bench is usable once its network has switched it on.
  for (let i = 0; i < 400 && !hiTech.power!.on; i++) stepWorld(w);
  expect(hiTech.power!.on).toBe(true);
  expect(applyCommand(w, { type: 'research-project', project: 'complex-clothing' }).ok).toBe(true);
  for (let i = 0; i < 40 && !p.research; i++) stepWorld(w);
  expect(p.research?.stationId).toBe(hiTech.id);
  expect(validateWorld(w)).toEqual([]);
});
