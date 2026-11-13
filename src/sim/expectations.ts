/** Core 1.6.4871 Expectations.xml, without royalty or Ideology roles. The
 * upper bound of each stage is exclusive. This is a pure decision from the
 * sampled map wealth; callers must not rescan the map for each pawn. */
export interface ColonyExpectation {
  readonly id: 'extremely-low' | 'very-low' | 'low' | 'moderate' | 'high' | 'sky-high';
  readonly label: string;
  readonly moodOffset: number;
  /** Core Need_Joy does not vary its level decay by expectation. */
  readonly joyFallFactor: 1;
  readonly joyToleranceDropPerDay: number;
  readonly joyKindsNeeded: number;
  readonly minWealth: number;
  readonly nextWealth: number | null;
}

export const COLONY_EXPECTATIONS: readonly ColonyExpectation[] = Object.freeze([
  Object.freeze({id:'extremely-low',label:'Attentes extrêmement basses',moodOffset:30,joyFallFactor:1,joyToleranceDropPerDay:.18,joyKindsNeeded:2,minWealth:0,nextWealth:15000}),
  Object.freeze({id:'very-low',label:'Attentes très basses',moodOffset:24,joyFallFactor:1,joyToleranceDropPerDay:.13,joyKindsNeeded:3,minWealth:15000,nextWealth:31000}),
  Object.freeze({id:'low',label:'Attentes basses',moodOffset:18,joyFallFactor:1,joyToleranceDropPerDay:.11,joyKindsNeeded:3,minWealth:31000,nextWealth:81000}),
  Object.freeze({id:'moderate',label:'Attentes modérées',moodOffset:12,joyFallFactor:1,joyToleranceDropPerDay:.10,joyKindsNeeded:4,minWealth:81000,nextWealth:182000}),
  Object.freeze({id:'high',label:'Attentes élevées',moodOffset:6,joyFallFactor:1,joyToleranceDropPerDay:.08,joyKindsNeeded:5,minWealth:182000,nextWealth:308000}),
  Object.freeze({id:'sky-high',label:'Attentes extrêmes',moodOffset:0,joyFallFactor:1,joyToleranceDropPerDay:.07,joyKindsNeeded:6,minWealth:308000,nextWealth:null}),
]);

export function expectationForWealth(mapWealth: number): ColonyExpectation {
  if (!Number.isFinite(mapWealth) || mapWealth < 0) throw new RangeError('Invalid map wealth.');
  return COLONY_EXPECTATIONS.find(stage => stage.nextWealth === null || mapWealth < stage.nextWealth)!;
}
/** Schema 313: Core ExpectationsUtility gives VeryLow to a player pawn or a
 * colony prisoner that has no map (in a caravan). */
export const VERY_LOW_EXPECTATION313:ColonyExpectation=COLONY_EXPECTATIONS.find(e=>e.id==='very-low')!;
