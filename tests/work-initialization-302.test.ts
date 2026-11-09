import { describe, expect, test } from 'vitest';
import { createScenarioWorld } from '../src/sim/new-game';
import { isColonist } from '../src/sim/affiliation';
import { startingPawn } from '../src/sim/starting-pawns';
import { enableAndInitializeWork, initializesWorkLikeCore302 } from '../src/sim/work-initialization';
import type { Pawn, WorkType } from '../src/sim/types';

// Core 1.6 Pawn_WorkSettings.EnableAndInitialize, with the WorkTypeDefs of
// Defs/WorkTypeDefs/WorkTypes.xml (definition order, alwaysStartActive,
// relevantSkills).
const ALWAYS: readonly WorkType[] = ['firefight', 'patient', 'bedrest', 'basic', 'haul', 'clean'];

function pawnWith(levels: Record<string, number>, background?: Pawn['background']): Pawn {
  const pawn = startingPawn(1, 'Test', 0, 0, 0, 55, 7, 0, 302);
  for (const [skill, level] of Object.entries(levels)) (pawn.skills as unknown as Record<string, unknown>)[skill] = { level, xp: 0, dailyXp: 0, passion: 0 };
  if (background) pawn.background = background;
  return pawn;
}
const active = (pawn: Pawn) => (Object.entries(pawn.priorities) as [WorkType, number][]).filter(([, value]) => value === 3).map(([work]) => work).sort();
const LEVELS = { shooting: 2, melee: 0, construction: 9, mining: 4, cooking: 7, plants: 5, animals: 6, crafting: 8, artistic: 1, medicine: 3, social: 3, intellectual: 10 };

describe('work settings of a human who joins the colony (schema 302)', () => {
  test('the six best work types by relevant skills, plus the types that always start active, at 3; the rest at 0', () => {
    const pawn = pawnWith(LEVELS);
    enableAndInitializeWork(pawn);
    // Research 10, Construction 9, Smithing/Tailoring/Crafting 8, Cooking 7.
    expect(active(pawn)).toEqual([...ALWAYS, 'research', 'build', 'smith', 'tailor', 'craft', 'cook'].sort());
    expect(Object.keys(pawn.priorities)).toHaveLength(20);
    expect(Object.values(pawn.priorities).every(value => value === 0 || value === 3)).toBe(true);
  });

  test('ties keep the work type definition order (a stable sort)', () => {
    // Handling and Cooking both average 6: Handling is defined first.
    const pawn = pawnWith({ ...LEVELS, cooking: 6 });
    enableAndInitializeWork(pawn);
    expect(pawn.priorities.handle).toBe(3);
    expect(pawn.priorities.cook).toBe(0);
    // Hunting averages its two relevant skills, Shooting and Animals: 4.
    expect(pawn.priorities.hunt).toBe(0);
  });

  test('work the pawn is incapable of stays disabled, including a type that always starts active', () => {
    // Sheltered childhood: no firefighting. Merchant: no skilled manual work.
    const pawn = pawnWith(LEVELS, { childhood: 'sheltered-child', adulthood: 'merchant' } as Pawn['background']);
    enableAndInitializeWork(pawn);
    expect(pawn.priorities.firefight).toBe(0);
    for (const work of ['build', 'mine', 'gather', 'grow', 'cook', 'craft', 'smith', 'tailor'] as const) expect(pawn.priorities[work]).toBe(0);
    // The six best of the remaining types: Research, Handling, Hunting, then
    // Doctor and Warden (3, in definition order) and Art.
    expect(active(pawn)).toEqual(['patient', 'bedrest', 'basic', 'haul', 'clean', 'research', 'handle', 'hunt', 'doctor', 'warden', 'art'].sort());
  });

  test('only from schema 302', () => {
    expect(initializesWorkLikeCore302(301)).toBe(false);
    expect(initializesWorkLikeCore302(302)).toBe(true);
  });

  test('a new game starts its colonists with these work settings', () => {
    const world = createScenarioWorld(42, 64, 'survivors');
    const colonists = world.pawns.filter(isColonist);
    expect(colonists.length).toBe(3);
    for (const pawn of colonists) {
      const expected = structuredClone(pawn);
      enableAndInitializeWork(expected);
      expect(pawn.priorities).toEqual(expected.priorities);
      expect(active(pawn).filter(work => !ALWAYS.includes(work)).length).toBe(6);
    }
  });
});
