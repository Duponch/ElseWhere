import {expect,test} from 'vitest';
import {
  adjustBillReserveTarget289,defaultBillResumeAt289,nextBillReservePaused289,
  supportsBillReservePause289,validBillReservePausePolicy289,validBillReservePauseState289,
} from '../src/sim/bill-pause-rules-289.ts';
import {PRODUCTION_RECIPES,type ProductionRecipe} from '../src/sim/production-recipes.ts';
import type {CookingBill} from '../src/sim/cooking-types.ts';
import type {BillReservePause289} from '../src/sim/bill-pause-state-289.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';

/** Scalar contract only: stock figures below are supplied observations, not a
 * claimed physical production run. The caller alone commits acquired memory. */
function bill(overrides:Partial<CookingBill>={}):CookingBill {
  return {id:1,recipe:'simple-meal',mode:'until',target:10,suspended:false,
    filters:{},radius:999,destination:'stockpile',
    reservePause:{enabled:true,resumeAt:5,paused:false},...overrides};
}
const state=(overrides:Partial<BillReservePause289>={}):BillReservePause289=>({enabled:true,resumeAt:5,paused:false,...overrides});

test('same stock between thresholds means active before satisfaction and paused after satisfaction, until the inclusive restart threshold',()=>{
  const current=bill();
  const observations=[
    {count:6,paused:false},{count:10,paused:true},{count:9,paused:true},
    {count:6,paused:true},{count:5,paused:false},{count:6,paused:false},
  ];
  let reads=0;
  for(const observation of observations){
    const before=structuredClone(current);
    const acquired=nextBillReservePaused289(current,()=>{reads++;return observation.count;});
    expect(acquired).toBe(observation.paused);
    expect(current).toEqual(before);
    current.reservePause!.paused=acquired;
  }
  expect(reads).toBe(observations.length);
});

test('a counted batch of four can overshoot the target and still acquires the same pause without treating an intermediate decline as a restart',()=>{
  const current=bill();
  for(const [count,expected] of [[8,false],[12,true],[8,true],[5,false]] as const){
    current.reservePause!.paused=nextBillReservePaused289(current,()=>count);
    expect(current.reservePause!.paused).toBe(expected);
  }
});

test('the release condition follows acquisition: a stored threshold at or above target clears the memory but does not establish production admission',()=>{
  for(const resumeAt of [10,11]){
    const current=bill({reservePause:state({resumeAt,paused:true})});
    expect(nextBillReservePaused289(current,()=>10)).toBe(false);
    expect(current.target).toBe(10);
  }
  // Admission still separately requires count < target; this helper returns
  // the memory only, never permission to fabricate at a satisfied target.
});

test('manual suspension in until preserves both possible memories without reading stock, including when the option has been disabled',()=>{
  for(const enabled of [true,false])for(const paused of [true,false]){
    const current=bill({suspended:true,reservePause:state({enabled,paused})});
    const before=structuredClone(current);
    expect(nextBillReservePaused289(current,()=>{throw Error('Suspended bill must not count');})).toBe(paused);
    expect(current).toEqual(before);
  }
});

test('leaving until clears memory before the manual-suspension branch and does not inspect stock or change hidden settings',()=>{
  for(const mode of ['times','forever'] as const){
    const current=bill({mode,suspended:true,reservePause:state({paused:true})});
    const before=structuredClone(current);
    expect(nextBillReservePaused289(current,()=>{throw Error('No reserve in this mode');})).toBe(false);
    expect(current).toEqual(before);
  }
});

test('disabling automatic pause clears an acquired memory at evaluation, while absence stays absent and never reads stock',()=>{
  const disabled=bill({reservePause:state({enabled:false,paused:true})});
  expect(nextBillReservePaused289(disabled,()=>12)).toBe(false);
  const historical=bill();delete historical.reservePause;
  expect(nextBillReservePaused289(historical,()=>{throw Error('Historical bill must not opt in');})).toBe(false);
  expect(Object.hasOwn(historical,'reservePause')).toBe(false);
});

test('target zero uses restart minus one and cannot be released by the ordinary nonnegative stock count',()=>{
  const current=bill({target:0,reservePause:state({resumeAt:-1})});
  expect(defaultBillResumeAt289(0)).toBe(-1);
  expect(nextBillReservePaused289(current,()=>0)).toBe(true);
  current.reservePause!.paused=true;
  expect(nextBillReservePaused289(current,()=>4)).toBe(true);
});

test('the 61 current recipes expose reserve pause only for the 57 recipes already accepting an until reserve',()=>{
  const recipes=Object.keys(PRODUCTION_RECIPES) as ProductionRecipe[];
  // 55 before schema 312, then the T-shirt and the jacket (312), the short
  // bow (316), the pump shotgun (322), the recurve bow and the greatbow (326).
  expect(recipes).toHaveLength(61);
  const unsupported=recipes.filter(recipe=>!supportsBillReservePause289(recipe));
  expect(unsupported.sort()).toEqual(['burn-apparel','cremate-corpse','smelt-apparel','smelt-weapon']);
  expect(recipes.filter(supportsBillReservePause289)).toHaveLength(57);
  for(const recipe of recipes){
    expect(validBillReservePauseState289(state(),289,recipe)).toBe(!unsupported.includes(recipe));
  }
});

test('policy accepts the native zero-target sentinel and local upper bound, but never a caller-supplied acquired memory',()=>{
  for(const resumeAt of [-1,0,9999]){
    expect(validBillReservePausePolicy289({enabled:true,resumeAt})).toBe(true);
    expect(validBillReservePauseState289(state({resumeAt,enabled:false,paused:true}),289,'simple-meal')).toBe(true);
  }
  expect(validBillReservePausePolicy289({enabled:true,resumeAt:5,paused:false})).toBe(false);
  for(const resumeAt of [-2,10000,0.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,'5',undefined]){
    expect(validBillReservePausePolicy289({enabled:true,resumeAt})).toBe(false);
    expect(validBillReservePauseState289({...state(),resumeAt},289,'simple-meal')).toBe(false);
  }
  for(const enabled of [0,'true',undefined]){
    expect(validBillReservePausePolicy289({enabled,resumeAt:5})).toBe(false);
    expect(validBillReservePauseState289({...state(),enabled},289,'simple-meal')).toBe(false);
  }
  for(const paused of [0,'false',undefined])expect(validBillReservePauseState289({...state(),paused},289,'simple-meal')).toBe(false);
});

test('policy and persisted state require plain own enumerable data fields, rejecting accessors without running them',()=>{
  let getterReads=0;
  for(const persisted of [false,true]){
    const plain=()=>persisted?state():{enabled:true,resumeAt:5};
    const accepts=(value:unknown)=>persisted?validBillReservePauseState289(value,289,'simple-meal'):validBillReservePausePolicy289(value);
    class Wrapped {enabled=true;resumeAt=5;paused=false;}
    const invalid:unknown[]=[undefined,null,false,[],{},Object.create(plain()),
      Object.assign(Object.create(null),plain()),new Wrapped(),
      {...plain(),future:true},{...plain(),[Symbol('future')]:true}];
    const missing={...plain()};delete (missing as Partial<BillReservePause289>).resumeAt;invalid.push(missing);
    for(const field of persisted?['enabled','resumeAt','paused']:['enabled','resumeAt']){
      const hidden={...plain()};Object.defineProperty(hidden,field,{value:5,enumerable:false});invalid.push(hidden);
      const accessor={...plain()};Object.defineProperty(accessor,field,{enumerable:true,get(){getterReads++;throw Error('Data-only field');}});invalid.push(accessor);
    }
    invalid.push(new Proxy(plain(),{getPrototypeOf(){throw Error('Unreadable prototype');}}));
    for(const value of invalid)expect(accepts(value)).toBe(false);
    const valid=plain(),before=JSON.stringify(valid);expect(accepts(valid)).toBe(true);expect(JSON.stringify(valid)).toBe(before);
  }
  expect(getterReads).toBe(0);
});

test('persisted pause belongs only to schema 289 and cannot appear on a historical or future envelope',()=>{
  for(const version of [1,287,288,SCHEMA_VERSION+1,NaN,Infinity,289.5]){
    expect(validBillReservePauseState289(state(),version,'simple-meal')).toBe(false);
  }
  expect(validBillReservePauseState289(state({enabled:false,paused:true}),289,'simple-meal')).toBe(true);
  expect(validBillReservePauseState289(state({enabled:false,paused:true}),SCHEMA_VERSION,'simple-meal')).toBe(true);
});

test('explicit adoption preserves the native gap of five where possible and keeps the zero-target sentinel',()=>{
  const expectations=[[0,-1],[1,0],[4,0],[5,0],[6,1],[10,5],[9999,9994]] as const;
  for(const [target,resumeAt] of expectations)expect(defaultBillResumeAt289(target)).toBe(resumeAt);
});

test('the shared target editor shifts restart by the same delta, then applies local bounds and the enabled strict-target clamp',()=>{
  const cases=[
    {old:10,target:12,resumeAt:5,enabled:true,expected:7},
    {old:10,target:4,resumeAt:5,enabled:true,expected:0},
    {old:10,target:0,resumeAt:5,enabled:true,expected:-1},
    {old:10,target:0,resumeAt:5,enabled:false,expected:0},
    {old:0,target:10,resumeAt:-1,enabled:true,expected:9},
    {old:10,target:10,resumeAt:9999,enabled:true,expected:9},
    {old:0,target:9999,resumeAt:9999,enabled:false,expected:9999},
    {old:0,target:9999,resumeAt:9999,enabled:true,expected:9998},
  ];
  for(const sample of cases){
    const current=bill({target:sample.target,reservePause:state({resumeAt:sample.resumeAt,enabled:sample.enabled,paused:true})});
    const before=structuredClone(current);
    adjustBillReserveTarget289(current,sample.old);
    expect(current).toEqual({...before,reservePause:{...before.reservePause!,resumeAt:sample.expected}});
  }
});

test('quantity changes in times or forever retain hidden policy, while historical bills acquire no new field',()=>{
  for(const mode of ['times','forever'] as const){
    const current=bill({mode,target:0,reservePause:state({paused:true})});
    const before=structuredClone(current);adjustBillReserveTarget289(current,10);expect(current).toEqual(before);
  }
  const historical=bill();delete historical.reservePause;
  const before=structuredClone(historical);adjustBillReserveTarget289(historical,1);expect(historical).toEqual(before);
});
