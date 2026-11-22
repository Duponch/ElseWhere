// The game's random generator (Verse.Rand). Expected values were derived by
// hand from the decompiled algorithm with an independent big-integer and
// float32 computation, not by running this module.
import {describe,expect,it} from 'vitest';
import {VerseRand,murmurHashInt,stableStringHash,hashCombineInt,roundToInt,simpleCurveEvaluate,monoLerp} from '../src/sim/verse-rand';

describe('hashes',()=>{
 it('MurmurHash.GetInt mixes the seed and the iteration count',()=>{
  expect([murmurHashInt(0,0),murmurHashInt(1,0),murmurHashInt(0,1),murmurHashInt(0x12345678,42),murmurHashInt(0xffffffff,0xffffffff)])
   .toEqual([467335754,2037871401,1393367368,-51349920,1833162199]);
 });
 it('GenText.StableStringHash and Gen.HashCombineInt wrap on 32 bits',()=>{
  expect([stableStringHash('poivre'),stableStringHash('Test'),stableStringHash(''),stableStringHash('é🌲'),stableStringHash(null)]).toEqual([-2044998282,23844169,23,2682280,0]);
  expect([hashCombineInt(stableStringHash('poivre'),83469557),hashCombineInt(-5,7),hashCombineInt(2147483647,-1)]).toEqual([-1917803779,1640531845,-1043822968]);
 });
 it('Mathf.RoundToInt rounds half to even',()=>{
  expect([0.5,1.5,2.5,-0.5,-1.5,2.4999,2.5001].map(roundToInt)).toEqual([0,2,2,0,-2,2,3]);
 });
});

describe('VerseRand',()=>{
 it('draws the terrain step parameters of the seed « poivre » in order',()=>{
  const r=new VerseRand();r.seed=hashCombineInt(stableStringHash('poivre'),83469557);
  const seeds=[0,1,2,3].map(()=>r.range(0,2147483647));
  expect(seeds).toEqual([81866598,504829344,648072408,1606830272]);
  expect(r.rangeFloat(-.4,-.35)).toBe(-0.3871902525424957);
  expect(r.rangeFloat(.4,.6)).toBe(0.40159380435943604);
  expect(r.state.iterations).toBe(6);
 });
 it('Value, Bool, Range, RangeInclusive and Range(float) follow one counter',()=>{
  const r=new VerseRand();r.seed=42;
  expect([r.value,r.value,r.value]).toEqual([0.7218942642211914,0.82420814037323,0.44540247321128845]);
  r.seed=42;
  expect(r.bool).toBe(false);expect(r.range(0,4)).toBe(2);expect(r.range(1,7)).toBe(3);expect(r.rangeFloat(10,20)).toBe(19.272235870361328);
  r.seed=42;expect(r.rangeInclusive(5,5)).toBe(5);expect(r.state.iterations).toBe(0);
  expect(r.range(3,3)).toBe(3);expect(r.rangeFloat(2,1)).toBe(2);
 });
 it('Gaussian, ByCurve, Element, ElementByWeight and the weighted list choices',()=>{
  const r=new VerseRand();
  r.seed=7;expect(r.gaussian(3,1.5)).toBe(3.9007816314697266);expect(r.state.iterations).toBe(2);
  r.seed=3;expect(r.byCurve([[0,0],[1,1],[2,0]])).toBe(0.5293595194816589);
  r.seed=5;expect(r.element(['a','b','c'])).toBe('c');
  r.seed=9;expect(r.elementByWeight(['a',1],['b',3])).toBe('b');
  const weights=[2,0,5,1],items=[0,1,2,3];
  r.seed=11;expect(r.tryRandomElementByWeight(items,i=>weights[i]!)).toEqual({found:true,value:2});
  r.seed=11;expect(r.randomElementByWeight(items,i=>weights[i]!)).toBe(2);
  expect(r.tryRandomElementByWeight(items,()=>0)).toEqual({found:false});
  expect(()=>r.byCurve([[0,1],[1,1],[2,0]])).toThrow();
 });
 it('Chance and the mean time between events',()=>{
  const r=new VerseRand();r.seed=42;
  expect(r.chance(0)).toBe(false);expect(r.chance(1)).toBe(true);expect(r.state.iterations).toBe(0);
  expect(r.chance(.8)).toBe(true);expect(r.chance(.8)).toBe(false);
  expect(r.mtbEventOccurs(Infinity,60000,60)).toBe(false);expect(r.mtbEventOccurs(0,60000,60)).toBe(true);
 });
 it('PushState and PopState save and restore the seed and the count',()=>{
  const r=new VerseRand();r.seed=42;const first=r.value;
  r.pushState(99);const other=r.value;r.pushState();r.value;r.popState();expect(r.value).not.toBe(first);
  r.popState();expect(r.stackDepth).toBe(0);
  expect(r.value).toBe(0.82420814037323);
  const seeded=r.valueSeeded(99);expect(seeded).toBe(other);expect(r.value).toBe(0.44540247321128845);
  expect(()=>r.popState()).toThrow();
  const copy=VerseRand.fromState(r.state);expect(copy.value).toBe(r.value);
 });
});

describe('SimpleCurve and Mathf.Lerp with the runtime precision',()=>{
 it('clamps outside the points and interpolates inside',()=>{
  const curve=[[0,30],[.1,29],[.5,7],[1,-37]] as const;
  expect(simpleCurveEvaluate(curve,-1)).toBe(30);expect(simpleCurveEvaluate(curve,2)).toBe(-37);
  expect(simpleCurveEvaluate(curve,.3)).toBe(Math.fround(29+(7-29)*Math.fround((Math.fround(.3)-Math.fround(.1))/(Math.fround(.5)-Math.fround(.1)))));
  expect(monoLerp(0,40,2)).toBe(40);expect(monoLerp(10,20,.25)).toBe(12.5);
 });
});
