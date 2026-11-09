import {expect,vi} from 'vitest';
import type {World} from '../../src/sim/types.ts';
import * as probedBreakdowns from '../../src/sim/breakdowns.ts';
import { sameMapWorld } from './same-map.ts';

/** External test notebook: no historical repair consumption is inferred. */
export interface RepairLedger {revision:1;spent:number;successes:number;failures:number}
export const createRepairLedger=():RepairLedger=>({revision:1,spent:0,successes:0,failures:0});
export function readRepairLedger(value:unknown):RepairLedger {
  const keys=['revision','spent','successes','failures'] as const;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length
    ||!Object.keys(value).every(key=>keys.includes(key as typeof keys[number])))
    throw Error('Use a checkpoint with repair instrumentation revision 1; historical maintenance cannot be reconstructed.');
  const ledger=value as RepairLedger;
  if(ledger.revision!==1||keys.slice(1).some(key=>!Number.isSafeInteger(ledger[key])||ledger[key]<0)
    ||ledger.spent!==ledger.successes+ledger.failures)throw Error('Invalid repair instrumentation ledger.');
  return ledger;
}

const repairProbe=vi.hoisted(()=>({world:null as World|null,ledger:null as RepairLedger|null}));
// Spy on the export binding every importer reads at call time
// (a vi.mock factory deadlocks: the probed modules import each other).
{
  const actual={advanceBreakdownFix:probedBreakdowns.advanceBreakdownFix};
  vi.spyOn(probedBreakdowns,'advanceBreakdownFix').mockImplementation((...args:Parameters<typeof actual.advanceBreakdownFix>)=>{
    const [world,,job]=args,ledger=repairProbe.ledger;
    if(!sameMapWorld(repairProbe.world,world)||!ledger)return actual.advanceBreakdownFix(...args);
    const target=world.structures.find(s=>s.id===job.fixBreakdown?.structureId);
    const targetBefore=target?structuredClone(target):undefined;
    const components=world.piles.filter(p=>p.item==='component').map(p=>structuredClone(p));
    const delivered=components.filter(p=>p.owner.type==='job'&&p.owner.jobId===job.id);
    const rngBefore=world.rng,nextIdBefore=world.nextId,calendarBefore=JSON.stringify(world.breakdown);
    const result=actual.advanceBreakdownFix(...args);
    const context=`repair ${job.id}, structure ${target?.id}, tick ${world.tick}`;
    expect(world.rng,context).toBe(rngBefore);expect(world.nextId,context).toBe(nextIdBefore);
    if(result===null){
      expect(world.piles.filter(p=>p.item==='component'),context).toEqual(components);
      expect(target,context).toEqual(targetBefore);
      expect(JSON.stringify(world.breakdown),context).toBe(calendarBefore);
      return null;
    }
    expect(delivered,`${context}, exactly one ordinary piece must be physically delivered`).toHaveLength(1);
    expect(delivered[0]!.quantity,context).toBe(1);
    expect(world.piles.filter(p=>p.item==='component'),`${context}, remove only that original piece`)
      .toEqual(components.filter(p=>p.id!==delivered[0]!.id));
    expect(target,context).toBeDefined();expect(targetBefore,context).toBeDefined();
    const expected=targetBefore;
    expect(expected?.breakdown,context).toBeDefined();
    if(result==='success')delete expected!.breakdown;
    expect(world.structures.find(s=>s.id===target!.id),`${context}, preserve building identity and HP`).toBe(target);
    expect(target,context).toEqual(expected);expect(job.progress,context).toBe(0);
    ledger.spent++;
    if(result==='success')ledger.successes++;else ledger.failures++;
    readRepairLedger(ledger);
    return result;
  });
}

/** Compose with trackWoodStep; validation and accounting observe the real call.
 * Incomplete work/refusal consumes nothing. Even a later failing tick retains
 * the already confirmed physical consumption in its raw failure notebook. */
export function trackMaintenanceStep(world:World,ledger:RepairLedger,step:()=>void):void {
  readRepairLedger(ledger);
  if(repairProbe.world!==null||repairProbe.ledger!==null)throw Error('Nested repair instrumentation');
  repairProbe.world=world;repairProbe.ledger=ledger;
  try{step();}finally{repairProbe.world=null;repairProbe.ledger=null;readRepairLedger(ledger);}
}
