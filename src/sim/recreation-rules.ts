import { TICKS_PER_DAY, type Cell, type Pawn, type World } from './types.ts';

import { pawnBody } from './health-rules.ts';
import type {ReadingTask295} from './reading-state-295.ts';

export const RECREATION_KINDS = ['solitary', 'dexterity', 'cerebral', 'social', 'television'] as const;
export type RecreationKind = typeof RECREATION_KINDS[number] | 'chemical' | 'reading';
export type RecreationActivity = 'skygaze' | 'horseshoes' | 'chess' | 'social-relax' | 'visit-sick' | 'watch-television' | 'party' | 'read' | import('./joy-tables-354.ts').JoyTableActivity354;
export interface OrdinaryRecreationTask { activity: Exclude<RecreationActivity,'read'>; target: Cell; buildingId: number | null; seatId?: number; patientId?: number; partyStartedAtCore?:number; phase: 'travel' | 'active'; elapsed: number;
  /** Schema 354 billiards only: local ticks of the current shot (JobDriver_PlayBilliards ShotDuration)
   * and the tick the game began, its clock running through the walks between shots. */
  shot354?: number; since354?: number }
export type RecreationTask=OrdinaryRecreationTask|ReadingTask295;
export interface RecreationNeed { level: number; tolerance: Record<typeof RECREATION_KINDS[number], number>&{chemical?:number;reading?:number}; bored: Record<typeof RECREATION_KINDS[number], boolean>&{chemical?:boolean;reading?:boolean}; task: RecreationTask | null }
export const RECREATION_DURATION = 400;
export const VISIT_SICK_DURATION = 150;
export const RECREATION_GAIN = 36 * 24 / TICKS_PER_DAY;
// Extremely low expectations. Wealth-derived expectations await the economy.
export const TOLERANCE_FALL = 18 / TICKS_PER_DAY;
export const recreationKind = (activity: RecreationActivity): Exclude<RecreationKind,'chemical'> => activity==='read'?'reading':activity === 'horseshoes'||activity==='hoopstone'||activity==='billiards' ? 'dexterity' : activity === 'chess'||activity==='game-of-ur'||activity==='poker' ? 'cerebral' : activity === 'watch-television' ? 'television' : activity === 'social-relax'||activity === 'visit-sick'||activity==='party' ? 'social' : 'solitary';
export const initialRecreation = (level = 55): RecreationNeed => ({level, tolerance: {solitary: 0, dexterity: 0, cerebral: 0, social: 0, television:0}, bored: {solitary: false, dexterity: false, cerebral: false, social: false, television:false}, task: null});

export function updateRecreation(pawn: Pawn,body?:import('./body-capacities.ts').BodyAssessment,toleranceFall=TOLERANCE_FALL,elapsedLocal=1): void {
  if (pawn.mental?.crisis||pawn.state === 'sleeping'||pawn.state==='dead'||pawn.medicalSleep||pawn.health&&(body??pawnBody(pawn)).capacities.consciousness<.3) return;
  const joy = pawn.recreation;
  for (const kind of RECREATION_KINDS) {
    // Historical worlds keep their own family keys until a validated migration.
    if(kind==='television'&&!Object.hasOwn(joy.tolerance,kind))continue;
    joy.tolerance[kind] = Math.max(0, joy.tolerance[kind] - toleranceFall);
    if (joy.tolerance[kind] < 30) joy.bored[kind] = false;
  }
  if(joy.tolerance.chemical!==undefined){joy.tolerance.chemical=Math.max(0,joy.tolerance.chemical-toleranceFall);if(joy.tolerance.chemical<30)joy.bored.chemical=false;}
  if(joy.tolerance.reading!==undefined){joy.tolerance.reading=Math.max(0,joy.tolerance.reading-toleranceFall);if(joy.tolerance.reading<30)joy.bored.reading=false;}
  if (pawn.state !== 'recreating' || joy.task?.phase !== 'active'||joy.task.activity==='read'&&joy.task.stage!=='read') {
    const factor = joy.level < 1 ? 1 : joy.level < 15 ? .4 : joy.level < 30 ? .7 : 1;
    joy.level = Math.max(0, joy.level - 60 / TICKS_PER_DAY * factor * elapsedLocal);
  }
}
export function gainRecreation(joy: RecreationNeed, kind: RecreationKind, amount = RECREATION_GAIN): number {
  const gained = Math.min(100 - joy.level, Math.max(0, amount) * (1 - (joy.tolerance[kind]??0) / 100));
  joy.level += gained;
  joy.tolerance[kind] = Math.min(100, (joy.tolerance[kind]??0) + gained * .65);
  if(kind==='chemical'&&joy.bored.chemical===undefined)joy.bored.chemical=false;
  if(kind==='reading'&&joy.bored.reading===undefined)joy.bored.reading=false;
  if (joy.tolerance[kind]! > 50) joy.bored[kind] = true;
  return gained;
}
export const recreationMood = (level: number): number => level < 1 ? -20 : level < 15 ? -10 : level < 30 ? -5 : level < 70 ? 0 : level < 85 ? 5 : 10;

/** Serialized simulation RNG, consumed only for a real recreation decision. */
export function recreationRandom(world: World): number {
  let value = world.rng; value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  world.rng = value >>> 0; return world.rng / 0x100000000;
}
