import { PowerTopologyCache, bestPowerParent, validPowerParent, connectedPowerGroups } from './power-topology.ts';
import { powerWatts,powerPotential,isPowerTrader } from './power-rules.ts';
import { isPowerConnector } from './power-grid.ts';
import { filteredStructures } from './structure-navigation.ts';
import { sunLampScheduled } from './sun-lamp.ts';
import { electricityDisabledAtCore } from './cassandra-world.ts';
import { empStructureActive } from './emp-state.ts';
import { BATTERY_START_RESERVE,BATTERY_START_THRESHOLD,batteryQuanta,leakBattery,chargeBatteries,dischargeBatteries,type BatteryOwner } from './power-battery.ts';
import type { World, Structure } from './types.ts';

const isConnectorKind=(s:Structure):boolean=>isPowerConnector(s.kind);
const owners=new WeakMap<World,PowerTopologyCache>();
function cache(world:World):PowerTopologyCache {let c=owners.get(world);if(!c){c=new PowerTopologyCache();owners.set(world,c);}return c;}
/** Retain a valid parent, including when its source runs out of fuel. */
export function reconcilePower(world:World):void {
  if(!world.structures.some(s=>s.power))return;
  const topology=cache(world).read(world);
  // The shared connector list: the same structures, in array order.
  for(const s of filteredStructures(world,'power-connectors',isConnectorKind))if(s.power) {
    const p=s.power;
    // Clear before the balanced-network fast path. The player's actual switch
    // and connection survive the night; morning still uses ordinary startup.
    if(s.kind==='sun-lamp'&&!sunLampScheduled(world))p.on=false;
    if(p.parentId===null||!validPowerParent(topology,s,p.parentId)) {
      const parent=bestPowerParent(topology,s);
      if(parent!==p.parentId){p.parentId=parent;p.on=false;}
      if(parent===null)p.on=false;
    }
  }
}
function randomPart(world:World,parts:Structure[]):Structure {
  let n=world.rng;n^=n<<13;n^=n>>>17;n^=n<<5;world.rng=n>>>0;
  return parts[Math.floor(world.rng/0x100000000*parts.length)]!;
}
function roundEven(n:number):number {const f=Math.floor(n);return n-f===.5?f+f%2:Math.round(n);}
function shedPower(world:World,parts:Structure[],core=world.tick*10):void {
  const active=parts.filter(s=>powerWatts(s,world,core)<0);
  for(let n=0;n<Math.max(1,roundEven(active.length*.05))&&active.length;n++)randomPart(world,active).power!.on=false;
}
const wantsPower=(s:Structure,world:World):boolean=>isPowerTrader(s.kind)&&!s.breakdown&&s.power!.switchOn!==false&&(s.kind!=='wood-generator'&&s.kind!=='chemfuel-generator'||!!s.fuel?.ticks)&&(s.kind!=='sun-lamp'||sunLampScheduled(world));
/** Core's gradual randomized startup/shedding. Ten small
 * reference-time boundaries avoid aliased modulo periods (e.g. 200/6 = 33).
 * Our random stream and integer W are independent of Unity's implementation. */
export function advancePower(world:World):void {
  reconcilePower(world);
  // Structures then packed buildings, in order, without copying the lists.
  const batteries:(Structure&BatteryOwner)[]=[];
  for(const s of world.structures)if(s.battery&&!s.breakdown)batteries.push(s as Structure&BatteryOwner);
  for(const p of world.packed){const s=p.building;if(s.battery&&!s.breakdown)batteries.push(s as Structure&BatteryOwner);}
  if(!world.structures.some(s=>s.power)&&!batteries.length)return;
  const condition=world.worldIncidents?.active;
  const disabledDuringTick=!!condition&&condition.start*10<world.tick*10&&condition.endCore>(world.tick-1)*10;
  // No actor/fuel mutation occurs inside this call. Balanced fully active
  // networks skip their ten candidate scans unless a solar condition overlaps
  // this step: surplus and absent storage cannot protect consumers from shedding.
  const groups=connectedPowerGroups(world,cache(world).read(world)).filter(parts=>
    parts.some(s=>s.battery||!s.power!.on&&wantsPower(s,world))||parts.reduce((n,s)=>n+powerWatts(s,world),0)<0
      ||parts.some(s=>s.emp&&s.emp.untilCore>(world.tick-1)*10)
      ||disabledDuringTick&&parts.some(s=>powerWatts(s,world)<0))
    .map(parts=>({parts:parts.filter(s=>isPowerTrader(s.kind)),storage:parts.filter((s):s is Structure&BatteryOwner=>!!s.battery&&!s.breakdown)}));
  for(let sub=0;sub<10;sub++) {
    const coreTick=(world.tick-1)*10+sub+1;
    const disabled=disabledDuringTick&&electricityDisabledAtCore(world,coreTick);
    // CompPowerBattery's self-discharge remains independent of network transfer.
    for(const battery of batteries)leakBattery(battery.battery);
    for(const {parts,storage} of groups) {
      if(disabled){
        if(coreTick%20===0)shedPower(world,parts,coreTick);
        continue;
      }
      let balance=parts.reduce((n,s)=>n+powerWatts(s,world,coreTick),0);
      const availableStorage=storage.filter(s=>!empStructureActive(s,coreTick));
      const stored=availableStorage.reduce((n,s)=>n+batteryQuanta(s.battery),0);
      if(stored+balance*2>=0) {
        const available=stored-(availableStorage.length&&stored>=BATTERY_START_THRESHOLD?BATTERY_START_RESERVE:0);
        const waiting=available+balance*2>=0?parts.filter(s=>!s.power!.on&&wantsPower(s,world)):[];
        if(waiting.length&&coreTick%Math.max(30,Math.floor(200/waiting.length))===0)for(let n=0;n<Math.max(1,roundEven(waiting.length*.05));n++) {
          const s=randomPart(world,waiting),cost=-powerPotential(s,world);
          if(!s.power!.on&&stored+balance*2>=cost*2){s.power!.on=true;balance-=cost;}
        }
        if(balance>0)chargeBatteries(availableStorage,balance,coreTick);
        // Core excludes EMP batteries from apparent reserve/charging, while
        // its actual giving-battery redistribution still includes their energy.
        else if(balance<0)dischargeBatteries(storage,-balance*2,coreTick);
      } else if(coreTick%20===0) {
        shedPower(world,parts,coreTick);
      }
    }
  }
}
