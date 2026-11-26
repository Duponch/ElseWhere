import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {advancePower,reconcilePower} from '../src/sim/power.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {PowerTopologyCache,connectedPowerGroups} from '../src/sim/power-topology.ts';
import {newPowerState,isPowerTrader,powerWatts,powerPotential} from '../src/sim/power-rules.ts';
import {sunLampScheduled} from '../src/sim/sun-lamp.ts';
import {electricityDisabledAtCore} from '../src/sim/cassandra-world.ts';
import {empStructureActive} from '../src/sim/emp-state.ts';
import {BATTERY_START_RESERVE,BATTERY_START_THRESHOLD,batteryQuanta,leakBattery,chargeBatteries,dischargeBatteries,type BatteryOwner} from '../src/sim/power-battery.ts';
import type {World,Structure} from '../src/sim/types.ts';

// Frozen pre-capture dispatch oracle. These prepared networks exercise only
// the synchronous power owner; they do not claim paid construction or a save.
function reference(world:World):void {
  reconcilePower(world);
  const batteries:(Structure&BatteryOwner)[]=[];
  for(const s of world.structures)if(s.battery&&!s.breakdown)batteries.push(s as Structure&BatteryOwner);
  for(const p of world.packed){const s=p.building;if(s.battery&&!s.breakdown)batteries.push(s as Structure&BatteryOwner);}
  if(!world.structures.some(s=>s.power)&&!batteries.length)return;
  const random=(parts:Structure[])=>{let n=world.rng;n^=n<<13;n^=n>>>17;n^=n<<5;world.rng=n>>>0;return parts[Math.floor(world.rng/0x100000000*parts.length)]!;};
  const round=(n:number)=>{const f=Math.floor(n);return n-f===.5?f+f%2:Math.round(n);};
  const wants=(s:Structure)=>isPowerTrader(s.kind)&&!s.breakdown&&s.power!.switchOn!==false&&(s.kind!=='wood-generator'&&s.kind!=='chemfuel-generator'||!!s.fuel?.ticks)&&(s.kind!=='sun-lamp'||sunLampScheduled(world));
  const shed=(parts:Structure[],core:number)=>{const active=parts.filter(s=>powerWatts(s,world,core)<0);for(let n=0;n<Math.max(1,round(active.length*.05))&&active.length;n++)random(active).power!.on=false;};
  const condition=world.worldIncidents?.active,disabledDuringTick=!!condition&&condition.start*10<world.tick*10&&condition.endCore>(world.tick-1)*10;
  const groups=connectedPowerGroups(world,new PowerTopologyCache().read(world)).filter(parts=>
    parts.some(s=>s.battery||!s.power!.on&&wants(s))||parts.reduce((n,s)=>n+powerWatts(s,world),0)<0
    ||parts.some(s=>s.emp&&s.emp.untilCore>(world.tick-1)*10)||disabledDuringTick&&parts.some(s=>powerWatts(s,world)<0))
    .map(parts=>({parts:parts.filter(s=>isPowerTrader(s.kind)),storage:parts.filter((s):s is Structure&BatteryOwner=>!!s.battery&&!s.breakdown)}));
  for(let sub=0;sub<10;sub++){
    const coreTick=(world.tick-1)*10+sub+1,disabled=disabledDuringTick&&electricityDisabledAtCore(world,coreTick);
    for(const battery of batteries)leakBattery(battery.battery);
    for(const {parts,storage} of groups){
      if(disabled){if(coreTick%20===0)shed(parts,coreTick);continue;}
      let balance=parts.reduce((n,s)=>n+powerWatts(s,world,coreTick),0);
      const availableStorage=storage.filter(s=>!empStructureActive(s,coreTick)),stored=availableStorage.reduce((n,s)=>n+batteryQuanta(s.battery),0);
      if(stored+balance*2>=0){
        const available=stored-(availableStorage.length&&stored>=BATTERY_START_THRESHOLD?BATTERY_START_RESERVE:0);
        const waiting=available+balance*2>=0?parts.filter(s=>!s.power!.on&&wants(s)):[];
        if(waiting.length&&coreTick%Math.max(30,Math.floor(200/waiting.length))===0)for(let n=0;n<Math.max(1,round(waiting.length*.05));n++){
          const s=random(waiting),cost=-powerPotential(s,world);if(!s.power!.on&&stored+balance*2>=cost*2){s.power!.on=true;balance-=cost;}
        }
        if(balance>0)chargeBatteries(availableStorage,balance,coreTick);else if(balance<0)dischargeBatteries(storage,-balance*2,coreTick);
      }else if(coreTick%20===0)shed(parts,coreTick);
    }
  }
}

function fixture(seed:number,stored:number):World {
  const world=createWorld(seed,32,32);world.tick=2000;world.structures=[];world.packed=[];world.pawns=[];
  delete world.gameProfile;delete world.climate;delete world.worldIncidents;
  const add=(kind:Structure['kind'],x:number,z:number)=>{const s:Structure={id:world.nextId++,kind,x,z,orientation:0,footprint:'standard',power:newPowerState(kind)};world.structures.push(s);return s;};
  for(let x=2;x<23;x++)add('power-conduit',x,8);
  for(const [i,kind] of (['wood-generator','solar-generator','wind-turbine','chemfuel-generator','geothermal-generator'] as const).entries()){
    const s=add(kind,2+i*4,8);s.power!.on=true;
    if(kind==='wood-generator'||kind==='chemfuel-generator')s.fuel={ticks:i===0?100:0,burned:0,autoRefuel:true,burnRemainder:0};
    if(kind==='wind-turbine')s.wind={cachedWatts:1234,updateCounter:0,autoCut:false};
  }
  for(let i=0;i<45;i++){const s=add((['standing-lamp','heater','cooler','sun-lamp','electric-stove'] as const)[i%5]!,2+i%21,6+Math.floor(i/21));s.power!.on=i%3===0;if(s.kind==='heater')s.heater={target:21,high:i%2===0};if(s.kind==='cooler')s.cooler={target:-4,high:i%2===0};}
  for(let i=0;i<3;i++){const s=add('battery',10+i,8);s.battery={stored:stored+i,half:true};}
  return world;
}

test('closed power capture matches prior dispatch through startup, shedding, fuel, switches, EMP, packed batteries and solar conditions',()=>{
  for(const seed of [1,22,71])for(const stored of [0,BATTERY_START_RESERVE-2,BATTERY_START_RESERVE+300]){
    const actual=fixture(seed,stored),expected=structuredClone(actual),owner={};
    for(let step=0;step<48;step++){
      for(const world of [actual,expected]){
        world.tick++;
        const wood=world.structures.find(s=>s.kind==='wood-generator')!,wind=world.structures.find(s=>s.kind==='wind-turbine')!,heater=world.structures.find(s=>s.kind==='heater')!,store=world.structures.find(s=>s.battery)!;
        if(step===1)wood.fuel!.ticks=0;if(step===6)wood.fuel!.ticks=100;
        if(step===2)wind.emp={sinceCore:world.tick*10-7,untilCore:world.tick*10+13};
        if(step===3)store.emp={sinceCore:world.tick*10-5,untilCore:world.tick*10+7};
        if(step===8)heater.power!.switchOn=false;if(step===11)heater.power!.switchOn=true;
        if(step===12)wood.breakdown={brokenAt:world.tick};if(step===15)delete wood.breakdown;
        if(step===17)world.worldIncidents={profile:'cassandra-world-v1',adoptedAt:0,rng:seed,nextCheck:90100,checks:0,opportunities:1,flares:1,lastStart:world.tick-1,lastEndCore:world.tick*10+13,active:{start:world.tick-1,endCore:world.tick*10+13}};
        if(step===22){world.structures=world.structures.filter(s=>s!==store);world.packed.push({building:store,owner:{type:'ground',x:25,z:25}});}
        if(step===28){const s=world.structures.find(s=>s.kind==='solar-generator')!;world.roofing={constructed:[s.z*world.width+s.x],build:[],remove:[],cursor:0};}
      }
      withJournalTerrainReadScope(owner,()=>advancePower(actual));reference(expected);expect(actual).toEqual(expected);
    }
  }
});
