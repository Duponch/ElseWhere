import {expect,test} from 'vitest';
import {generateWorld} from '../src/sim/generation';
import {updateFoodTemperatures} from '../src/sim/thermal-food';
import type {MaterialOwner,MaterialPile,World} from '../src/sim/types';

test('food thermal captures follow current ground, pawn, inventory and job owners on repeated public calls',()=>{
  const w=generateWorld(42,16,16);w.piles=[];w.tick=10;delete w.wildlife;
  w.pawns=w.pawns.slice(0,1);const pawn=w.pawns[0]!;Object.assign(pawn,{x:2,z:2});delete pawn.body;
  w.jobs=[{id:900,x:3,z:2} as World['jobs'][number]];
  w.thermal={regions:[{cells:[34],temperature:-5},{cells:[35],temperature:5}]};
  const indices=new Int32Array(256).fill(-1);indices[34]=0;indices[35]=1;
  const layout={rooms:[],doors:[],indices},rng=w.rng;
  const pile=(owner:MaterialOwner):MaterialPile=>{
    const p:MaterialPile={id:w.nextId++,kind:'food',item:'rice',quantity:3,owner,rot:{progress:30,atTick:0,rate:.75,fallout294:7}};
    w.piles.push(p);return p;
  };
  const ground=pile({type:'ground',x:2,z:2}),held=pile({type:'pawn',pawnId:pawn.id}),inventory=pile({type:'inventory',pawnId:pawn.id}),job=pile({type:'job',jobId:900}),missing=pile({type:'job',jobId:901});
  const unlocated=missing.rot;
  updateFoodTemperatures(w,layout);
  for(const p of [ground,held,inventory])expect(p.rot).toEqual({progress:37.5,atTick:10,rate:0,fallout294:7});
  expect(job.rot).toEqual({progress:37.5,atTick:10,rate:.5,fallout294:7});expect(missing.rot).toBe(unlocated);
  const stableGround=ground.rot;
  // Public replacements within the same arrays must be recaptured even when
  // all memberships, tick phases and derived temperature indices are stable.
  w.tick=14;w.pawns[0]={...pawn,x:3};w.jobs[0]={...w.jobs[0]!,x:2};
  updateFoodTemperatures(w,layout);
  expect(ground.rot).toBe(stableGround);
  for(const p of [held,inventory])expect(p.rot).toEqual({progress:37.5,atTick:14,rate:.5,fallout294:7});
  expect(job.rot).toEqual({progress:39.5,atTick:14,rate:0,fallout294:7});expect(missing.rot).toBe(unlocated);expect(w.rng).toBe(rng);
});
