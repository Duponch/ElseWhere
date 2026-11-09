import { expect,vi } from 'vitest';
import { woodAccount } from './wood-account.ts';
import type { World } from '../../src/sim/types.ts';
import * as probedGathering from '../../src/sim/gathering.ts';
import {berryYield} from '../../src/sim/plants.ts';
import {plantHarvestYield} from '../../src/sim/plant-skills.ts';
import * as probedWildlifeFood from '../../src/sim/wildlife-food.ts';
import * as probedWildFlora from '../../src/sim/wild-flora.ts';
import {FLORA_DEFINITIONS} from '../../src/sim/biome-flora.ts';
import { sameMapWorld } from './same-map.ts';
import * as probedWallFrameFailure301 from '../../src/sim/wall-frame-failure-301.ts';

export interface WoodGatherCapture {
  world:World;kind:string;resourceKind:string;resourceId:number;nominal:number;raw:number;factor:number;
  human:boolean;legacyExact:boolean;sterile:boolean;quantity:number|null;presentBefore:boolean;removed:boolean;
  stockBefore:number;stockAfter:number;rngBefore:number;rngAfter:number;nextIdBefore:number;nextIdAfter:number;
  sourceBefore:string;sourceAfter:string;
}
interface GrazingCapture {world:World;resourceId:number;resourceKind:string;amount:number;removed:boolean;confirmed:boolean}
interface RegrowCapture {world:World;resourceId:number;amount:number}
const gatherProbe=vi.hoisted(()=>({active:false,records:[] as WoodGatherCapture[]}));
const grazingProbe=vi.hoisted(()=>({active:false,records:[] as GrazingCapture[]}));
const regrowProbe=vi.hoisted(()=>({active:false,records:[] as RegrowCapture[]}));
const constructionProbe=vi.hoisted(()=>({active:false,records:[] as {world:World;lost:number}[]}));
export { gatherProbe,grazingProbe };
const woodStock=(w:World)=>w.piles.reduce((sum,pile)=>sum+(pile.item==='wood'?pile.quantity:0),0);

// Spy on the export binding every importer reads at call time
// (a vi.mock factory deadlocks: the probed modules import each other).
{
  const actual={gatherResource:probedGathering.gatherResource};
  vi.spyOn(probedGathering,'gatherResource').mockImplementation((...args:Parameters<typeof actual.gatherResource>)=>{
    const [world,resource,kind,,worker]=args;
    if(!gatherProbe.active||resource.kind!=='tree')return actual.gatherResource(...args);
    const before={world,kind,resourceKind:resource.kind,resourceId:resource.id,nominal:resource.amount,
      raw:berryYield(world,resource),factor:worker&&kind!=='cut'?plantHarvestYield(worker):1,
      human:!!worker&&kind!=='cut',legacyExact:kind==='chop'&&!resource.species&&!worker,
      sterile:kind==='cut'&&!!resource.species,presentBefore:world.resources.includes(resource),
      stockBefore:woodStock(world),rngBefore:world.rng,nextIdBefore:world.nextId,sourceBefore:JSON.stringify(resource)};
    const quantity=actual.gatherResource(...args);
    const record:WoodGatherCapture={...before,quantity,removed:!world.resources.some(r=>r.id===resource.id),
      stockAfter:woodStock(world),rngAfter:world.rng,nextIdAfter:world.nextId,sourceAfter:JSON.stringify(resource)};
    assertWoodGather(record);gatherProbe.records.push(record);return quantity;
  });
}
// Spy on the export binding every importer reads at call time
// (a vi.mock factory deadlocks: the probed modules import each other).
{
  const actual={finishAnimalMeal:probedWildlifeFood.finishAnimalMeal};
  vi.spyOn(probedWildlifeFood,'finishAnimalMeal').mockImplementation((...args:Parameters<typeof actual.finishAnimalMeal>)=>{
    const [world,animal]=args,meal=animal.meal;
    const plant=grazingProbe.active&&meal?.kind==='plant'?world.resources.find(r=>r.id===meal.id):undefined;
    const eatenBefore=world.wildlife?.eatenPlants??0,amount=plant?.amount;
    const result=actual.finishAnimalMeal(...args);
    if(plant)grazingProbe.records.push({world,resourceId:plant.id,resourceKind:plant.kind,amount:amount!,
      removed:!world.resources.includes(plant),confirmed:(world.wildlife?.eatenPlants??0)===eatenBefore+1});
    return result;
  });
}
// Spy on the export binding every importer reads at call time
// (a vi.mock factory deadlocks: the probed modules import each other).
{
  const actual={advanceWildFlora:probedWildFlora.advanceWildFlora};
  vi.spyOn(probedWildFlora,'advanceWildFlora').mockImplementation((world:World)=>{
    if(!regrowProbe.active||!world.flora||world.flora.revision!==1||world.tick<world.flora.nextCheck)return actual.advanceWildFlora(world);
    const firstId=world.nextId;actual.advanceWildFlora(world);
    for(const tree of world.resources)if(tree.id>=firstId&&tree.kind==='tree'){
      expect(tree.plantLife?.bornAt,'Unconfirmed new tree').toBe(world.tick);
      expect(tree.species,'New tree has no species').toBeDefined();
      expect(tree.amount).toBe(FLORA_DEFINITIONS[tree.species!].yield);
      regrowProbe.records.push({world,resourceId:tree.id,amount:tree.amount});
    }
  });
}

// FailConstruction destroys the unrecovered Frame wood without a world counter.
{
  const actual={failWoodWallFrame301:probedWallFrameFailure301.failWoodWallFrame301};
  vi.spyOn(probedWallFrameFailure301,'failWoodWallFrame301').mockImplementation((...args:Parameters<typeof actual.failWoodWallFrame301>)=>{
    const receipt=actual.failWoodWallFrame301(...args);
    if(constructionProbe.active)constructionProbe.records.push({world:args[0],lost:receipt.original-receipt.placed});
    return receipt;
  });
}

/** At most four legal outcomes, independent of harvestRoll's random stream. */
export function legalWoodOutputs(raw:number,factor:number):number[] {
  if(!Number.isFinite(raw)||raw<0||!Number.isFinite(factor)||factor<0||factor>1.5)throw Error('Invalid wood yield inputs');
  const bases=[Math.floor(raw),Math.ceil(raw)];
  return [...new Set(bases.flatMap(base=>factor>1?[Math.floor(base*factor),Math.ceil(base*factor)]:[base]))].sort((a,b)=>a-b);
}
export function assertWoodGather(r:WoodGatherCapture):void {
  const context=`tree ${r.resourceId}, tick ${r.world.tick}`;
  expect(r.presentBefore,context).toBe(true);
  expect(Number.isSafeInteger(r.nominal)&&r.nominal>=0&&Number.isFinite(r.raw)&&r.raw>=0&&r.raw<=r.nominal,context).toBe(true);
  if(r.quantity===null){
    expect(r.removed,context).toBe(false);expect(r.stockAfter,context).toBe(r.stockBefore);
    expect(r.rngAfter,context).toBe(r.rngBefore);expect(r.nextIdAfter,context).toBe(r.nextIdBefore);
    expect(r.sourceAfter,context).toBe(r.sourceBefore);return;
  }
  const allowed=r.sterile?[0]:r.legacyExact?[r.nominal]:legalWoodOutputs(r.raw,r.human?r.factor:1);
  expect(Number.isSafeInteger(r.quantity)&&allowed.includes(r.quantity),`${context}, allowed ${allowed}`).toBe(true);
  expect(r.removed,context).toBe(true);
  expect(r.stockAfter-r.stockBefore,`${context}, physical wood creation`).toBe(r.quantity);
}

export interface WoodLedger {
  revision:2;nominalRemoved:number;produced:number;netYieldLost:number;netYieldBonus:number;woodGrazed:number;woodRegrown:number;
  /** Wood destroyed with a failed wall Frame: its original material minus what was placed back (FailConstruction). */
  woodConstructionLost:number;
}
export const createWoodLedger=():WoodLedger=>({revision:2,nominalRemoved:0,produced:0,netYieldLost:0,netYieldBonus:0,woodGrazed:0,woodRegrown:0,woodConstructionLost:0});
export function readWoodLedger(value:unknown):WoodLedger {
  const keys=['revision','nominalRemoved','produced','netYieldLost','netYieldBonus','woodGrazed','woodRegrown','woodConstructionLost'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length
    ||!Object.keys(value).every(key=>keys.includes(key)))throw Error('Use a checkpoint with wood instrumentation revision 2; historical bonuses cannot be reconstructed.');
  const ledger=value as WoodLedger;
  if(ledger.revision!==2||keys.slice(1).some(key=>!Number.isSafeInteger(ledger[key as keyof WoodLedger])||ledger[key as keyof WoodLedger]<0)
    ||ledger.nominalRemoved-ledger.produced!==ledger.netYieldLost-ledger.netYieldBonus)throw Error('Invalid wood instrumentation ledger.');
  return ledger;
}
export function trackWoodStep(w:World,ledger:WoodLedger,step:()=>void):void {
  const flags=[gatherProbe.active,grazingProbe.active,regrowProbe.active,constructionProbe.active] as const;
  if(flags.some(Boolean))throw Error('Nested wood instrumentation');
  const starts=[gatherProbe.records.length,grazingProbe.records.length,regrowProbe.records.length,constructionProbe.records.length] as const;
  gatherProbe.active=grazingProbe.active=regrowProbe.active=constructionProbe.active=true;
  try{step();}finally{[gatherProbe.active,grazingProbe.active,regrowProbe.active,constructionProbe.active]=flags;}
  for(const r of gatherProbe.records.slice(starts[0]))if(sameMapWorld(r.world,w)&&r.quantity!==null){
    ledger.nominalRemoved+=r.nominal;ledger.produced+=r.quantity;
    ledger.netYieldLost+=Math.max(0,r.nominal-r.quantity);ledger.netYieldBonus+=Math.max(0,r.quantity-r.nominal);
  }
  for(const r of grazingProbe.records.slice(starts[1]))if(sameMapWorld(r.world,w)&&r.resourceKind==='tree'&&r.confirmed&&r.removed)ledger.woodGrazed+=r.amount;
  for(const r of regrowProbe.records.slice(starts[2]))if(sameMapWorld(r.world,w))ledger.woodRegrown+=r.amount;
  for(const r of constructionProbe.records.slice(starts[3]))if(sameMapWorld(r.world,w))ledger.woodConstructionLost+=r.lost;
  gatherProbe.records.length=starts[0]!;grazingProbe.records.length=starts[1]!;regrowProbe.records.length=starts[2]!;constructionProbe.records.length=starts[3]!;
  readWoodLedger(ledger);
}
/** Existing recipe/fuel losses are already included by woodAccount. */
export function conservedWood(w:World,ledger:WoodLedger):number {
  readWoodLedger(ledger);
  return woodAccount(w)+ledger.netYieldLost-ledger.netYieldBonus+ledger.woodGrazed-ledger.woodRegrown+ledger.woodConstructionLost
    +(w.fires?.ledger.items.wood??0)+(w.fires?.ledger.woodPotentialLost??0)
    +((w.fires?.ledger.fuelTicksLost??0)+(w.fires?.ledger.fuelTicksBurned??0))/600
    +(w.destroyed?.items?.wood??0)+(w.destroyed?.woodPotentialLost??0)
    +((w.destroyed?.fuelTicksLost??0)+(w.destroyed?.fuelTicksBurned??0))/600;
}
