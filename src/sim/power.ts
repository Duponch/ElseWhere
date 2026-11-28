import { PowerTopologyCache, bestPowerParent, validPowerParent, connectedPowerDispatchGroups,isPowerDispatchKind } from './power-topology.ts';
import { powerWatts,powerPotential,isPowerTrader } from './power-rules.ts';
import { isPowerConnector } from './power-grid.ts';
import { filteredStructures } from './structure-navigation.ts';
import {structureFamily379} from './structure-family-379.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
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
  const closed=!!terrainJournalReadOwner();
  const connectors=closed?structureFamily379(world,'power-connector-owners',isPowerConnector):undefined;
  if(closed?!connectors!.some(s=>isPowerConnector(s.kind)&&s.power):!world.structures.some(s=>s.power))return;
  const topology=cache(world).read(world);
  // The shared connector list: the same structures, in array order.
  for(const s of connectors??filteredStructures(world,'power-connectors',isConnectorKind))if(s.power&&(!closed||isPowerConnector(s.kind))) {
    const p=s.power;
    // Clear before the balanced-network fast path. The player's actual switch
    // and connection survive the night; morning still uses ordinary startup.
    if(s.kind==='sun-lamp'&&!sunLampScheduled(world))p.on=false;
    if(p.parentId===null||!validPowerParent(topology,s,p.parentId,world.schemaVersion)) {
      const parent=bestPowerParent(topology,s,undefined,world.schemaVersion);
      if(parent!==p.parentId){p.parentId=parent;p.on=false;}
      if(parent===null)p.on=false;
    }
  }
}
function randomPart<T>(world:World,parts:T[]):T {
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
  for(const s of structureFamily379(world,'batteries',kind=>kind==='battery'))if(s.battery&&!s.breakdown)batteries.push(s as Structure&BatteryOwner);
  for(const p of world.packed){const s=p.building;if(s.battery&&!s.breakdown)batteries.push(s as Structure&BatteryOwner);}
  const closed=!!terrainJournalReadOwner();
  const dispatch=closed?structureFamily379(world,'power-dispatch-owners',isPowerDispatchKind):world.structures;
  if(!dispatch.some(s=>s.power&&(!closed||isPowerDispatchKind(s.kind)))&&!batteries.length)return;
  const condition=world.worldIncidents?.active;
  const disabledDuringTick=!!condition&&condition.start*10<world.tick*10&&condition.endCore>(world.tick-1)*10;
  // No actor/fuel mutation occurs inside this call. Balanced fully active
  // networks skip their ten candidate scans unless a solar condition overlaps
  // this step: surplus and absent storage cannot protect consumers from shedding.
  const groups=connectedPowerDispatchGroups(world,cache(world).read(world)).filter(parts=>
    parts.some(s=>s.battery||!s.power!.on&&wantsPower(s,world))||parts.reduce((n,s)=>n+powerWatts(s,world),0)<0
      ||parts.some(s=>s.emp&&s.emp.untilCore>(world.tick-1)*10)
      ||disabledDuringTick&&parts.some(s=>powerWatts(s,world)<0))
    .map(parts=>{
      const traders=parts.filter(s=>isPowerTrader(s.kind));
      // This closed call only changes power.on and battery charge. Fuel,
      // thermostats, generation, switches and the sun-lamp schedule cannot
      // change between its ten Core boundaries. Keep on and EMP reads live:
      // startup/shedding and an EMP ending inside this tick still take effect
      // at their original boundaries, in their original source order.
      const sources=traders.map(s=>({s,potential:powerPotential(s,world),wants:wantsPower(s,world)}));
      const storage=parts.filter((s):s is Structure&BatteryOwner=>!!s.battery&&!s.breakdown);
      // In this synchronous call only the startup and shedding branches
      // change an on/off switch. An EMP transition keeps its boundary reads.
      const stableUntilSwitch=closed&&!parts.some(s=>s.emp);
      return {parts:traders,sources,storage,stableUntilSwitch,
        electrical:undefined as {balance:number;waiting:typeof sources}|undefined};
    });
  for(let sub=0;sub<10;sub++) {
    const coreTick=(world.tick-1)*10+sub+1;
    const disabled=disabledDuringTick&&electricityDisabledAtCore(world,coreTick);
    // CompPowerBattery's self-discharge remains independent of network transfer.
    for(const battery of batteries)leakBattery(battery.battery);
    for(const group of groups) {
      const {parts,sources,storage,stableUntilSwitch}=group;
      if(disabled){
        if(coreTick%20===0){shedPower(world,parts,coreTick);group.electrical=undefined;}
        continue;
      }
      if(stableUntilSwitch&&!group.electrical){
        let balance=0;const waiting:typeof sources=[];
        for(const source of sources)if(source.wants){
          if(source.s.power!.on)balance+=source.potential;else waiting.push(source);
        }
        group.electrical={balance,waiting};
      }
      let balance=group.electrical?.balance??sources.reduce((n,p)=>n+(p.wants&&p.s.power!.on&&!empStructureActive(p.s,coreTick)?p.potential:0),0);
      const availableStorage=stableUntilSwitch?storage:storage.filter(s=>!empStructureActive(s,coreTick));
      const stored=availableStorage.reduce((n,s)=>n+batteryQuanta(s.battery),0);
      if(stored+balance*2>=0) {
        const available=stored-(availableStorage.length&&stored>=BATTERY_START_THRESHOLD?BATTERY_START_RESERVE:0);
        const waiting=available+balance*2>=0?(group.electrical?.waiting??sources.filter(p=>!p.s.power!.on&&p.wants)):[];
        if(waiting.length&&coreTick%Math.max(30,Math.floor(200/waiting.length))===0)for(let n=0;n<Math.max(1,roundEven(waiting.length*.05));n++) {
          const p=randomPart(world,waiting),s=p.s,cost=-p.potential;
          if(!s.power!.on&&stored+balance*2>=cost*2){s.power!.on=true;balance-=cost;group.electrical=undefined;}
        }
        if(balance>0)chargeBatteries(availableStorage,balance,coreTick);
        // Core excludes EMP batteries from apparent reserve/charging, while
        // its actual giving-battery redistribution still includes their energy.
        else if(balance<0)dischargeBatteries(storage,-balance*2,coreTick);
      } else if(coreTick%20===0) {
        shedPower(world,parts,coreTick);group.electrical=undefined;
      }
    }
  }
}
