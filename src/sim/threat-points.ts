/** Core 1.6.4871's home-map threat curves, applied to wealth known to Lisière.
 * The map-wealth collector and raid composition live outside this pure module.
 * A private deterministic minimum substitutes for Core's seeded Rand.Range. */
import {medicalModel} from './body-model.ts';
import {freshMissing} from './injury-state.ts';
import {HP_UNIT,injuryPartRules,isWithinPart} from './injury-rules.ts';
import type {MedicalRecord} from './injury-types.ts';

export interface ThreatPointsInput {
  /** Already summed as items + half building/floor value + pawn market value. */
  readonly knownWealth: number;
  readonly freeColonists: number;
  /** Sum of living colonists' SummaryHealthPercent proxies, each in [0, 1]. */
  readonly colonistHealthSum: number;
  readonly elapsedDays: number;
  readonly adaptationDays: number;
  /** Stable integer identifying the local equivalent of Core's 2,500-tick bucket. */
  readonly seedBucket: number;
  /** Schema 328: Core reads the days factor at whole days passed
   * (DaysPassedSinceSettle); the minimum points keep the fractional day. */
  readonly timeFactorWholeDays?: boolean;
  /** Schema 329: colony animals able to learn Release (animal-threat-points-329.ts). */
  readonly animalPoints?: number;
}

export interface ThreatPointsResult {
  readonly points: number;
  readonly wealthPoints: number;
  readonly colonistPoints: number;
  readonly adaptationFactor: number;
  readonly timeFactor: number;
  readonly minimum: number;
  readonly unclampedPoints: number;
}

type Point = readonly [number, number];
const WEALTH_POINTS: readonly Point[] = [[0, 0], [14000, 0], [400000, 2400], [700000, 3600], [1000000, 4200]];
const COLONIST_POINTS: readonly Point[] = [[0, 15], [10000, 15], [400000, 140], [1000000, 200]];
const TIME_FACTOR: readonly Point[] = [[10, .7], [40, 1]];
const ADAPT_FACTOR: readonly Point[] = [[-30, .4], [0, .8], [30, 1], [60, 1.2], [120, 1.6], [180, 2]];
const DOWN_LOSS: readonly Point[] = [[1, 8], [2, 6], [3, 6], [11, 5], [20, 3.5]];
const COLONIST_LOSS: readonly Point[] = [[0, 30], [11, 30], [20, 20]];
const GROWTH_RATE: readonly Point[] = [[-30.01, 6], [-30, 3], [-0.01, 3], [0, 1], [59.99, 1], [60, .5], [119.99, .5], [120, .25]];

function curve(points: readonly Point[], x: number): number {
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [endX, endY] = points[i]!;
    if (x <= endX) {
      const [startX, startY] = points[i - 1]!;
      return startY + (endY - startY) * (x - startX) / (endX - startX);
    }
  }
  return points.at(-1)![1];
}

function validFinite(value: number, min: number, max = Number.POSITIVE_INFINITY): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** Core SummaryHealthHandler over the injuries and missing parts represented
 * by the local medical record. Unmodelled Core hediffs cannot contribute. */
export function summaryHealthPercent(record: MedicalRecord): number {
  if (record.death) return 0;
  const model = medicalModel(record), rules = injuryPartRules(model);
  let result = 1;
  for (const injury of record.injuries) {
    // A finished local scar is Core's permanent injury; acute wounds are visible.
    if (injury.scar?.pain !== undefined) continue;
    result *= 1 - Math.min(injury.severity / HP_UNIT / (75 * model.healthScale), .95);
  }
  for (const missing of record.missing) {
    if (!freshMissing(record, missing) || record.missing.some(other =>
      other !== missing && isWithinPart(missing.part, other.part, model))) continue;
    const part = model.byId[missing.part];
    // Local body definitions have groups rather than Core's part tags. Fresh
    // non-solid extremities with children or bleeding retain their impact.
    if (!model.parts.some(child => child.parent === part.id) && rules[part.id].bleed <= 0 && !part.groups.length) continue;
    result *= 1 - Math.min(part.hp / (75 * model.healthScale), .95);
  }
  return Math.max(.05, Math.min(1, result));
}

/** Core chooses a seeded value in [35, ceiling]. This stable local mixer is not
 * claimed to reproduce Core's PRNG or to consume the simulation PRNG. */
function minimumThreatPoints(elapsedDays: number, seedBucket: number): number {
  const ceiling = curve([[12, 35], [35, 70]], elapsedDays);
  let hash = (seedBucket ^ 0x9e3779b9) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return 35 + (ceiling - 35) * (hash >>> 0) / 0x100000000;
}

/** Ordinary home-map incident points for the fixed Adventure Story profile.
 * The classic introductory raid supplies its own 40 points and bypasses this. */
export function computeThreatPoints(input: ThreatPointsInput): ThreatPointsResult {
  const {knownWealth, freeColonists, colonistHealthSum, elapsedDays, adaptationDays, seedBucket} = input;
  if (!validFinite(knownWealth, 0) || !Number.isSafeInteger(freeColonists) || freeColonists < 0 ||
      !validFinite(colonistHealthSum, 0, freeColonists) || !validFinite(elapsedDays, 0) ||
      !validFinite(adaptationDays, -60, 100) || !Number.isSafeInteger(seedBucket)) {
    throw new RangeError('Invalid threat-points input.');
  }
  const wealthPoints = curve(WEALTH_POINTS, knownWealth);
  const colonistPoints = curve(COLONIST_POINTS, knownWealth) *
    (.35 * freeColonists + .65 * colonistHealthSum);
  const adaptationFactor = curve(ADAPT_FACTOR, adaptationDays);
  const timeFactor = curve(TIME_FACTOR, input.timeFactorWholeDays ? Math.floor(elapsedDays) : elapsedDays);
  const animalPoints = input.animalPoints ?? 0;
  if (!validFinite(animalPoints, 0)) throw new RangeError('Invalid threat-points input.');
  const unclampedPoints = (wealthPoints + colonistPoints + animalPoints) * adaptationFactor * .6 * timeFactor;
  const minimum = minimumThreatPoints(elapsedDays, seedBucket);
  return {points: Math.min(10000, Math.max(minimum, unclampedPoints)), wealthPoints,
    colonistPoints, adaptationFactor, timeFactor, minimum, unclampedPoints};
}

/** One Core half-day update, after any downing/loss notifications in that tick. */
export function advanceThreatAdaptationHalfDay(adaptationDays: number, elapsedDays: number): number {
  if (!validFinite(adaptationDays, -60, 100) || !validFinite(elapsedDays, 0)) throw new RangeError('Invalid adaptation state.');
  if (adaptationDays >= 0 && Math.floor(elapsedDays) < 30) return adaptationDays;
  const growth = .5 * curve(GROWTH_RATE, adaptationDays) * (adaptationDays > 0 ? .75 : 1);
  return Math.min(100, adaptationDays + growth);
}

/** Current free-colonist population includes the newly downed person. Call
 * only for a downing caused by a damage def flagged ExternalViolenceFor. */
export function loseThreatAdaptationForViolentDowning(adaptationDays: number, population: number): number {
  if (!validFinite(adaptationDays, -60, 100) || !Number.isSafeInteger(population) || population < 1) throw new RangeError('Invalid adaptation loss.');
  return Math.max(-60, adaptationDays - curve(DOWN_LOSS, population));
}

/** Core's population argument is the free-colonist count after death/loss.
 * Same-tick death cancels a pending violent-downing loss for that colonist. */
export function loseThreatAdaptationForColonistLoss(adaptationDays: number, postPopulation: number): number {
  if (!validFinite(adaptationDays, -60, 100) || !Number.isSafeInteger(postPopulation) || postPopulation < 0) throw new RangeError('Invalid adaptation loss.');
  return Math.max(-60, adaptationDays - curve(COLONIST_LOSS, postPopulation));
}

/** A separate input for the prospective paid World target. The historical
 * home-map API/body above is unchanged. Contributions are already weighted
 * by actual health and casket ownership; World random factor is exactly One.
 * Existing local adaptation/minimum remain explicit Cassandra-partial inputs. */
export interface WeightedWorldThreatInput298 {
 readonly knownWealth:number;readonly colonistContribution:number;
 readonly animalHealthPower:number;readonly elapsedDays:number;
 readonly adaptationDays:number;readonly seedBucket:number;
}
export function computeWeightedWorldThreatPoints298(input:WeightedWorldThreatInput298):ThreatPointsResult&{animalPoints:number} {
 const {knownWealth,colonistContribution,animalHealthPower,elapsedDays,adaptationDays,seedBucket}=input;
 if(!validFinite(knownWealth,0)||!validFinite(colonistContribution,0)||!validFinite(animalHealthPower,0)
  ||!validFinite(elapsedDays,0)||!validFinite(adaptationDays,-60,100)||!Number.isSafeInteger(seedBucket))throw new RangeError('Invalid known World threat-points input.');
 const wealthPoints=curve(WEALTH_POINTS,knownWealth),colonistPoints=curve(COLONIST_POINTS,knownWealth)*colonistContribution;
 const animalPoints=animalHealthPower*.08,adaptationFactor=curve(ADAPT_FACTOR,adaptationDays),timeFactor=curve(TIME_FACTOR,elapsedDays);
 const unclampedPoints=(wealthPoints+colonistPoints+animalPoints)*adaptationFactor*.6*timeFactor;
 const minimum=minimumThreatPoints(elapsedDays,seedBucket);
 return {points:Math.min(10000,Math.max(minimum,unclampedPoints)),wealthPoints,colonistPoints,animalPoints,adaptationFactor,timeFactor,minimum,unclampedPoints};
}