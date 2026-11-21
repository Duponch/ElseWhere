import { expect,test } from 'vitest';
import { CROP_KINDS,type CropKind } from '../src/sim/crops.ts';
import { growingJobValid,jobDuration,resourceAt,scheduleGrowing } from '../src/sim/farming.ts';
import { gatherResource } from '../src/sim/gathering.ts';
import { initializeHydroponicBasin } from '../src/sim/hydroponics.ts';
import { advanceCropBlight,cropBlightable,infectCrop } from '../src/sim/plant-blight.ts';
import { berryYield,harvestable,harvestRoll,plantGrowth,PLANT_DEFINITIONS } from '../src/sim/plants.ts';
import { newPowerState } from '../src/sim/power-rules.ts';
import { resourceMaxHp } from '../src/sim/thing-damage.ts';
import type { Job,Resource,Structure,World } from '../src/sim/types.ts';
import { healrootCamp } from './helpers/healroot-domestic-v195.ts';

function crop(w:World,x=8,z=8,kind:CropKind='rice',growth=.4):Resource {
  const p:Resource={id:w.nextId++,kind,x,z,amount:PLANT_DEFINITIONS[kind].yield,growth,growthTick:w.tick};
  w.resources=[...w.resources,p];return p;
}
function due(w:World,p:Resource):void {w.tick=p.blight!.nextCheck;advanceCropBlight(w);}
function job(w:World,p:Resource,kind:Job['kind']='harvest'):Job {
  const j:Job={id:w.nextId++,kind,x:p.x,z:p.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};
  w.jobs.push(j);return j;
}

test('only explicitly grown cultivated crops admit blight; flora, sprouts and old schemas stay neutral',()=>{
  const w=healrootCamp(32);
  // Core Plant_Devilstrand (schema 358) is neverBlightable.
  for(const kind of CROP_KINDS){const p=crop(w,8,w.resources.length+5,kind,.0001);expect(cropBlightable(w,p)).toBe(kind!=='devilstrand');}
  const p=crop(w);p.growth=0;expect(cropBlightable(w,p)).toBe(false);
  delete p.growth;expect(cropBlightable(w,p)).toBe(false);
  p.growth=.4;p.species='healroot-wild';expect(cropBlightable(w,p)).toBe(false);delete p.species;
  for(const kind of ['tree','berries','wild-plant','rock'] as const){p.kind=kind;expect(cropBlightable(w,p)).toBe(false);}
  p.kind='rice';(w as {schemaVersion:number}).schemaVersion=204;
  const before=JSON.stringify(w);expect(infectCrop(w,p,1)).toBe(false);advanceCropBlight(w);expect(JSON.stringify(w)).toBe(before);
});

test('infection settles healthy growth exactly, installs the next future phase and draws no shared RNG or ID',()=>{
  const w=healrootCamp(32),p=crop(w),identity=p;w.tick+=117;
  const growth=plantGrowth(w,p),rng=w.rng,next=w.nextId;
  expect(infectCrop(w,p,42)).toBe(true);expect(p).toBe(identity);
  expect(p.growth).toBe(growth);expect(p.growthTick).toBe(w.tick);
  expect(p.blight).toMatchObject({since:w.tick,severity:.2,lastHarmTick:w.tick,rng:42});
  expect(p.blight!.nextCheck).toBeGreaterThan(w.tick);expect(p.blight!.nextCheck).toBeLessThanOrEqual(w.tick+200);
  expect(p.blight!.nextCheck%200).toBe((p.id+1)%200);expect(w.rng).toBe(rng);expect(w.nextId).toBe(next);
  const before=JSON.stringify(p);expect(infectCrop(w,p,1)).toBe(false);expect(JSON.stringify(p)).toBe(before);
  w.tick+=1200;expect(plantGrowth(w,p)).toBe(growth);expect(harvestable(w,p)).toBe(false);expect(berryYield(w,p)).toBe(0);
  expect(harvestRoll(w,p,w.pawns[0])).toEqual({quantity:0,rng});expect(w.rng).toBe(rng);
});

test('invalid infection seeds and absent plants refuse without changing their growth checkpoint',()=>{
  const w=healrootCamp(32),p=crop(w),before=JSON.stringify(p);
  for(const seed of [0,-1,.5,0x100000000,NaN])expect(infectCrop(w,p,seed)).toBe(false);
  expect(infectCrop(w,{...p},1)).toBe(false);expect(JSON.stringify(p)).toBe(before);
});

test('severity advances only at its saved phase; reproduction starts after the .28 threshold',()=>{
  const w=healrootCamp(32),p=crop(w),other=crop(w,9,8);infectCrop(w,p,1);const next=p.blight!.nextCheck,rng=w.rng;
  w.tick=next-1;advanceCropBlight(w);expect(p.blight!.severity).toBe(.2);expect(p.blight!.rng).toBe(1);
  due(w,p);expect(p.blight!.severity).toBeCloseTo(.2+1/30);expect(p.blight!.rng).toBe(1);expect(other.blight).toBeUndefined();
  due(w,p);expect(p.blight!.severity).toBeCloseTo(.2+2/30);expect(p.blight!.rng).toBe(1);
  due(w,p);expect(p.blight!.severity).toBeCloseTo(.3);expect(other.blight).toBeDefined();expect(w.rng).toBe(rng);
  expect(other.blight!.since).toBe(w.tick);expect(other.blight!.severity).toBe(.2);expect(other.blight!.nextCheck).toBeGreaterThan(w.tick);
});

test('spread chooses the nearest candidate across crops and rooms, then stops at radius four',()=>{
  const w=healrootCamp(32),p=crop(w),nearest=crop(w,9,8,'cotton'),farther=crop(w,8,10,'corn'),outside=crop(w,13,8,'potato');
  // A wall/roof is not a spread barrier or an incident-root room filter.
  w.structures.push({id:w.nextId++,kind:'wall',x:9,z:7,orientation:0,footprint:'standard'});
  w.roofing={constructed:[8*w.width+9],build:[],remove:[],cursor:0};
  infectCrop(w,p,1);p.blight!.severity=1;due(w,p);
  expect(nearest.blight).toBeDefined();expect(farther.blight).toBeUndefined();expect(outside.blight).toBeUndefined();
  w.resources=[p,outside];p.blight!.rng=1;due(w,p);expect(outside.blight).toBeUndefined();
  const boundary=crop(w,12,8,'healroot');p.blight!.rng=1;due(w,p);expect(boundary.blight).toBeDefined();
});

test('equidistant candidates use the private lottery, with a separate nonzero child stream',()=>{
  const w=healrootCamp(32),p=crop(w),left=crop(w,7,8,'potato'),right=crop(w,9,8,'healroot');
  infectCrop(w,p,1);p.blight!.severity=1;const rng=w.rng;due(w,p);
  // xorshift seed1: occurrence .00006, tie choice .01575, child seed2647435461.
  expect(left.blight?.rng).toBe(2647435461);expect(right.blight).toBeUndefined();
  expect(p.blight!.rng).toBe(2647435461);expect(w.rng).toBe(rng);
});

test('infection after a previously empty phase capture is observed without replacing Resource[]',()=>{
  const w=healrootCamp(32),p=crop(w);advanceCropBlight(w);const resources=w.resources;
  infectCrop(w,p,1);expect(w.resources).toBe(resources);due(w,p);expect(p.blight!.severity).toBeCloseTo(.2+1/30);
  w.resources=w.resources.filter(r=>r!==p);w.tick=p.blight!.nextCheck;const before=JSON.stringify(p);advanceCropBlight(w);expect(JSON.stringify(p)).toBe(before);
});

test('blight harms by five HP only after a full day, without a fire ledger or a harvest',()=>{
  const w=healrootCamp(32),p=crop(w);infectCrop(w,p,8192);const since=w.tick,fires=JSON.stringify(w.fires),rng=w.rng;
  while(p.blight!.nextCheck<since+6000){due(w,p);expect(p.damage).toBeUndefined();}
  due(w,p);expect(p.damage).toBe(5);expect(p.blight!.lastHarmTick).toBe(w.tick);expect(w.tick-since).toBeLessThan(6200);
  due(w,p);expect(p.damage).toBe(5);expect(p.blight!.severity).toBe(1);expect(w.piles).toEqual([]);expect(JSON.stringify(w.fires)).toBe(fires);expect(w.rng).toBe(rng);
});

test('fatal daily harm retires crop work and resource caches without changing its growing policy',()=>{
  const w=healrootCamp(32),p=crop(w),pawn=w.pawns[0]!,j=job(w,p,'cut');p.damage=resourceMaxHp(p)-5;
  w.growingZones=[{id:w.nextId++,plant:'rice',cells:[p.z*w.width+p.x],allowSow:true,allowCut:true}];
  j.reservedBy=pawn.id;j.status='active';pawn.jobId=j.id;pawn.orders.queue=[j.id];
  expect(resourceAt(w,p.z*w.width+p.x)).toBe(p);infectCrop(w,p,8192);
  while(w.resources.includes(p))due(w,p);
  expect(w.jobs).toEqual([]);expect(pawn.jobId).toBeNull();expect(pawn.orders.queue).toEqual([]);
  expect(resourceAt(w,p.z*w.width+p.x)).toBeUndefined();expect(w.growingZones).toHaveLength(1);expect(w.piles).toEqual([]);
  scheduleGrowing(w); // The regular rotating scheduler owns subsequent sowing.
});

test('sick crops request cutting according to allowCut, invalidate an old harvest, and retain exact cut duration',()=>{
  const w=healrootCamp(32),p=crop(w,8,8,'rice',1),zone={id:w.nextId++,plant:'rice' as const,cells:[8*w.width+8],allowSow:true,allowCut:true};
  w.growingZones=[zone];const old=job(w,p);old.growingZoneId=zone.id;old.reservedBy=w.pawns[0]!.id;
  expect(growingJobValid(w,old)).toBe(true);infectCrop(w,p,1);expect(growingJobValid(w,old)).toBe(false);
  w.jobs=[];scheduleGrowing(w);expect(w.jobs).toHaveLength(1);expect(w.jobs[0]!.kind).toBe('cut');
  expect(jobDuration(w,w.jobs[0]!)).toBeCloseTo(20);
  p.growth=.0001;expect(jobDuration(w,w.jobs[0]!)).toBeCloseTo(20/(3.3-2.3*.0001));
  p.kind='healroot';expect(jobDuration(w,w.jobs[0]!)).toBeCloseTo(40/(3.3-2.3*.0001));
  w.jobs=[];zone.allowCut=false;scheduleGrowing(w);expect(w.jobs).toEqual([]);
});

test('cutting yields nothing and retains its producer until completeJob while retiring competing claims',()=>{
  const w=healrootCamp(32),p=crop(w,8,8,'corn',1),pawn=w.pawns[0]!;infectCrop(w,p,1);
  const producer=job(w,p,'cut'),rival=job(w,p,'harvest');
  producer.status='active';producer.reservedBy=pawn.id;pawn.jobId=producer.id;pawn.orders.queue=[rival.id];
  const rng=w.rng,next=w.nextId;
  expect(gatherResource(w,p,'harvest',rival.id,pawn)).toBeNull();expect(w.resources).toContain(p);
  expect(gatherResource(w,p,'cut',producer.id,pawn)).toBe(0);
  expect(w.resources).not.toContain(p);expect(w.piles).toEqual([]);expect(w.jobs).toEqual([producer]);
  expect(pawn.jobId).toBe(producer.id);expect(pawn.orders.queue).toEqual([]);expect(w.rng).toBe(rng);expect(w.nextId).toBe(next);
});

test('a hydroponic crop can acquire blight independently of basin power, without retiring the basin or its policy',()=>{
  const w=healrootCamp(32),basin:Structure={id:w.nextId++,kind:'hydroponics-basin',x:6,z:4,orientation:0,footprint:'standard',material:'steel',power:newPowerState('hydroponics-basin')};
  w.structures.push(basin);initializeHydroponicBasin(w,basin);const zone=w.growingZones[0]!,p=crop(w,6,4,'rice',1),rng=w.rng;
  expect(infectCrop(w,p,1)).toBe(true);expect(gatherResource(w,p,'cut')).toBe(0);
  expect(w.structures).toContain(basin);expect(w.growingZones[0]).toBe(zone);expect(zone.basinId).toBe(basin.id);expect(w.rng).toBe(rng);expect(w.piles).toEqual([]);
});
