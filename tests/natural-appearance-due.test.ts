import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {deserializeWorld} from '../src/sim/serialization';
import {createPlantGrowthForecastReader,plantGrowth,plantGrowthExceedTickBound,plantHarvestMinGrowth,isPlant} from '../src/sim/plants';
import {FixedCoreClock297} from '../src/bridge/fixed-core-clock-297';
import type {Resource} from '../src/sim/types';

// The Worker's plant appearance skips a plant until a tick before which its
// growth cannot reach its next visible quarter or its harvest threshold
// (src/bridge/worker-natural-appearance.ts). The bound must never be late.
const world=deserializeWorld(readFileSync(new URL('../public/test-saves/v419/les-eclaircies.json',import.meta.url),'utf8'));
const growing=world.resources.filter(r=>isPlant(r)&&(r.growth??1)!==1&&r.growthTick!==undefined&&!r.blight);

test('a plant cannot exceed its next quarter or harvest threshold before the bound',()=>{
 expect(growing.length).toBeGreaterThan(100);
 const forecast=createPlantGrowthForecastReader(world);let checked=0;
 for(const r of growing){
  const g=plantGrowth(world,r);
  for(const target of [Math.ceil(g*4)/4,plantHarvestMinGrowth(r)]){
   if(target>=1)continue;
   const bound=plantGrowthExceedTickBound(r,target);
   if(target<(r.growth??1)){expect(bound).toBe(-Infinity);continue;}
   expect(Number.isFinite(bound)).toBe(true);
   // Growth only increases: the reading at the bound itself must not exceed the target.
   if(bound>world.tick){expect(forecast(r,bound)).toBeLessThanOrEqual(target);checked++;}
  }
 }
 expect(checked).toBeGreaterThan(100);
});

test('constant readings have no bound, and the bound uses the stored record only',()=>{
 const r=growing[0]!;
 expect(plantGrowthExceedTickBound({...r,growth:1},.5)).toBe(Infinity);
 expect(plantGrowthExceedTickBound({...r,blight:{} as Resource['blight']},.99)).toBe(Infinity);
 const {growthTick:_tick,...noTick}=r;expect(plantGrowthExceedTickBound(noTick as Resource,.99)).toBe(Infinity);
 expect(plantGrowthExceedTickBound(r,1)).toBe(Infinity);
 // A later checkpoint (same growth) moves the bound by the same delay.
 const later={...r,growthTick:r.growthTick!+600};
 expect(plantGrowthExceedTickBound(later,.99)-plantGrowthExceedTickBound(r,.99)).toBe(600);
});

test('the Core clock reports the gap between reservations',()=>{
 const clock=new FixedCoreClock297();clock.reset(0);
 clock.reserve(20,3);expect(clock.lastReserveGapMs).toBe(20);while(clock.consume()){}
 clock.reserve(420,3);expect(clock.lastReserveGapMs).toBe(400);
});
