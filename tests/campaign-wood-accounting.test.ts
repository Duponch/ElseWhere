import { createWoodLedger,readWoodLedger,trackWoodStep,conservedWood,gatherProbe,assertWoodGather,legalWoodOutputs } from './scenarios/wood-conservation.ts';
import { expect,test } from 'vitest';
import { gatherResource } from '../src/sim/gathering.ts';
import { addMaterial } from '../src/sim/materials.ts';
import { plantHarvestYield } from '../src/sim/plant-skills.ts';
import { deconstructionCamp } from './scenarios/deconstruction.ts';
import type { Resource } from '../src/sim/types.ts';

test('wood yield bounds distinguish two rounds from a single multiplication and do not reduce successful trees below skill 8',()=>{
  // raw13.5 gives base13 or14. Multiplying raw directly would wrongly exclude13.
  expect(legalWoodOutputs(13.5,1.06)).toEqual([13,14,15]);
  expect(legalWoodOutputs(12,1.06)).toEqual([12,13]);
  expect(legalWoodOutputs(12,.6)).toEqual([12]);
  expect(legalWoodOutputs(0,1.13)).toEqual([0]);
  expect(()=>legalWoodOutputs(12,1.51)).toThrow();
});

test('a real skilled chop credits only bounded physical wood, while double creation and unrelated pile loss remain detectable',()=>{
  const w=deconstructionCamp(),pawn=w.pawns[0]!,ledger=createWoodLedger();
  pawn.skills.plants={level:14,xp:0,dailyXp:0,passion:0};
  const tree:Resource={id:w.nextId++,kind:'tree',amount:12,x:12,z:16};w.resources.push(tree);
  pawn.x=13;pawn.z=16;w.rng=1;
  expect(plantHarvestYield(pawn)).toBe(1.06);
  const initial=conservedWood(w,ledger),beforeIds=new Set(w.piles.map(p=>p.id));
  trackWoodStep(w,ledger,()=>expect(gatherResource(w,tree,'chop',undefined,pawn)).toBe(13));
  expect(ledger).toMatchObject({revision:2,nominalRemoved:12,produced:13,netYieldLost:0,netYieldBonus:1,woodConstructionLost:0});
  expect(conservedWood(w,ledger)).toBe(initial);
  expect(readWoodLedger(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
  expect(()=>readWoodLedger(undefined)).toThrow(/historical bonuses/);

  const nextTree:Resource={id:w.nextId++,kind:'tree',amount:12,x:12,z:18};w.resources.push(nextTree);pawn.x=13;pawn.z=18;
  gatherProbe.records.length=0;gatherProbe.active=true;
  try{gatherResource(w,nextTree,'chop',undefined,pawn);}finally{gatherProbe.active=false;}
  const observed=gatherProbe.records[0]!;expect(observed).toBeDefined();
  expect(()=>assertWoodGather({...observed,stockAfter:observed.stockBefore+2*observed.quantity!})).toThrow();
  expect(()=>assertWoodGather({...observed,quantity:100,stockAfter:observed.stockBefore+100})).toThrow();
  expect(()=>assertWoodGather({...observed,presentBefore:false})).toThrow();
  gatherProbe.records.length=0;

  const created=w.piles.find(p=>p.item==='wood'&&!beforeIds.has(p.id))!;
  const accounted=conservedWood(w,ledger);created.quantity--;
  expect(conservedWood(w,ledger)).toBe(accounted-1);
  expect(conservedWood(w,ledger)).not.toBe(accounted);
});

test('a refused positive wood deposit grants no ledger credit and preserves source, identity and RNG',()=>{
  const w=deconstructionCamp(1,20),pawn=w.pawns[0]!,ledger=createWoodLedger();
  pawn.skills.plants={level:14,xp:0,dailyXp:0,passion:0};
  const tree:Resource={id:w.nextId++,kind:'tree',amount:12,x:10,z:10};w.resources.push(tree);
  pawn.x=11;pawn.z=10;
  for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++)addMaterial(w,'wood',75,{type:'ground',x,z});
  const before=JSON.stringify(w),initial=conservedWood(w,ledger);
  trackWoodStep(w,ledger,()=>expect(gatherResource(w,tree,'chop',undefined,pawn)).toBeNull());
  expect(JSON.stringify(w)).toBe(before);expect(ledger).toEqual(createWoodLedger());
  expect(conservedWood(w,ledger)).toBe(initial);
});
