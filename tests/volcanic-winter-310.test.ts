import {expect,test} from 'vitest';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {adoptMiscIncidents,advanceMiscIncidents,MISC_FIRST_CHECK} from '../src/sim/cassandra-misc.ts';
import {validMiscIncidents} from '../src/sim/cassandra-misc-save.ts';
import {outdoorTemperature} from '../src/sim/temperature.ts';
import {annualNaturalLight,annualGrowingLightIntegral} from '../src/sim/environment.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {eligibleVolcanicWinter310,resolveSelectedVolcanicWinter310} from '../src/sim/volcanic-winter-310.ts';
import {VOLCANIC_WINTER_MAX_CORE310,VOLCANIC_WINTER_MIN_CORE310,VOLCANIC_WINTER_TRANSITION_CORE310,volcanicAnimalDensityFactor310,volcanicWinterStrength310} from '../src/sim/volcanic-winter-state-310.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,TICKS_PER_DAY,type World} from '../src/sim/types.ts';

function colony():World{
  // A real Crashlanded start (its own profile and Misc calendar), clock moved to day 60.
  const w=createScenarioWorld(42,32,'crashlanded');if(!w.miscIncidents)adoptMiscIncidents(w);
  const s=w.miscIncidents!;w.tick=60*TICKS_PER_DAY;s.nextCheck=w.tick+100;s.introDone=true;s.opportunities=1;s.checks=Math.max(s.checks,1);
  // A prepared clock jump: the path budget is dated with the world tick.
  if(w.corePathBudget297)w.corePathBudget297.tick=w.tick;
  return w;
}

test('a volcanic winter cannot start before day 60, then lasts 7.5 to 40 days',()=>{
  const w=colony();
  w.tick=60*TICKS_PER_DAY-1;expect(eligibleVolcanicWinter310(w)).toBe(false);
  w.tick=60*TICKS_PER_DAY;expect(eligibleVolcanicWinter310(w)).toBe(true);
  expect(resolveSelectedVolcanicWinter310(w,()=>0)).toBe(true);
  const v=w.miscIncidents!.volcanicWinter310!;expect(v.endCore-v.startCore).toBe(VOLCANIC_WINTER_MIN_CORE310);
  expect(eligibleVolcanicWinter310(w)).toBe(false);
  expect(validMiscIncidents(w.miscIncidents,SCHEMA_VERSION,w)).toBe(true);
  expect(validMiscIncidents(w.miscIncidents,309,w)).toBe(false);
  const w2=colony();resolveSelectedVolcanicWinter310(w2,()=>.9999999);
  expect(w2.miscIncidents!.volcanicWinter310!.endCore-w2.miscIncidents!.volcanicWinter310!.startCore).toBeLessThanOrEqual(VOLCANIC_WINTER_MAX_CORE310);
});

test('it ramps in over 50,000 Core ticks to -7 °C, a darker day, half the animals; then ends and waits 140 days',()=>{
  const w=colony(),start=w.tick,before=outdoorTemperature(w),light=annualNaturalLight(w,start+TICKS_PER_DAY/2);
  resolveSelectedVolcanicWinter310(w,()=>.5);
  expect(volcanicWinterStrength310(w)).toBe(0);
  w.tick=start+VOLCANIC_WINTER_TRANSITION_CORE310/20;expect(volcanicWinterStrength310(w)).toBeCloseTo(.5,9);
  w.tick=start;const full=start+VOLCANIC_WINTER_TRANSITION_CORE310/10;
  expect(outdoorTemperature({...w,tick:full})-outdoorTemperature({...w,tick:full,miscIncidents:{...w.miscIncidents!,volcanicWinter310:undefined}})).toBeCloseTo(-7,9);
  expect(volcanicAnimalDensityFactor310(w,full)).toBe(.5);
  // At noon of a day at full strength the light is pulled towards 0.55.
  const noon=start+TICKS_PER_DAY+TICKS_PER_DAY/2-(start%TICKS_PER_DAY);
  const plain={...w,miscIncidents:{...w.miscIncidents!,volcanicWinter310:undefined}};
  const base=annualNaturalLight(plain,noon);
  expect(annualNaturalLight(w,noon)).toBeCloseTo(base+(.55-base)*.3,9);
  expect(before).toBeTypeOf('number');expect(light).toBeTypeOf('number');
  // Growth light is lost only while it lasts.
  expect(annualGrowingLightIntegral(w,noon)).toBeLessThan(annualGrowingLightIntegral(plain,noon));
  const v=w.miscIncidents!.volcanicWinter310!;w.tick=Math.ceil(v.endCore/10);advanceMiscIncidents(w);
  expect(w.miscIncidents!.volcanicWinter310).toBeUndefined();
  expect(eligibleVolcanicWinter310(w)).toBe(w.tick-start>=140*TICKS_PER_DAY);
  w.tick=start+140*TICKS_PER_DAY;expect(eligibleVolcanicWinter310(w)).toBe(true);
});

test('the calendar keeps the condition exactly, and a 309 save migrates by its number only',()=>{
  const w=colony();resolveSelectedVolcanicWinter310(w,()=>.25);
  // The prepared 60-day clock jump leaves plants unaged: the calendar is
  // checked on its own, then through a JSON round trip.
  const copy=JSON.parse(JSON.stringify(w.miscIncidents));
  expect(copy).toEqual(w.miscIncidents);expect(validMiscIncidents(copy,SCHEMA_VERSION,w)).toBe(true);
  copy.volcanicWinter310.startCore+=10;expect(validMiscIncidents(copy,SCHEMA_VERSION,w)).toBe(false);
  // A real new game, with no clock jump.
  const plain=createScenarioWorld(42,32,'crashlanded'),current=serializeWorld(plain);
  expect(validateWorld(plain)).toEqual([]);
  expect(serializeWorld(deserializeWorld(asOldSchema(current,309)))).toBe(current);
});
