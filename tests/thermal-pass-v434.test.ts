import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {createPlantGrowthReader,plantGrowth} from '../src/sim/plants.ts';
import {advanceTemperature,outdoorTemperature,reconcileTemperature} from '../src/sim/temperature.ts';
import {ThermalTopologyCache,type ThermalLayout} from '../src/sim/thermal-topology.ts';
import {updatePlantTemperatures} from '../src/sim/thermal-plants.ts';
import type {Resource,World} from '../src/sim/types.ts';

// Synthetic reader fixtures only: no claim of paid construction or valid save.
// Full continuation is covered separately by the acquired 25 entire Worlds.
function room():World {
  const w=createWorld(81,16,16);w.tick=2000;delete w.site;
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.structures=[];w.resources=[];w.jobs=[];w.piles=[];
  for(let z=2;z<=7;z++)for(let x=2;x<=7;x++)if(x===2||x===7||z===2||z===7)
    w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard'});
  const door=w.structures.find(s=>s.x===2&&s.z===4)!;door.kind='door';door.door=newDoorState(w.tick);
  const vent=w.structures.find(s=>s.x===7&&s.z===4)!;vent.kind='vent';vent.orientation=1;vent.vent={open:true};
  const constructed:number[]=[];for(let z=3;z<=6;z++)for(let x=3;x<=6;x++)if(!((z===4&&(x===4||x===5))||(z===5&&x===4)))constructed.push(z*w.width+x);
  constructed.push(4*w.width+2);constructed.sort((a,b)=>a-b);w.roofing={constructed,build:[],remove:[],cursor:0};return w;
}
function bits(value:number):number[]{const bytes=new ArrayBuffer(8);new DataView(bytes).setFloat64(0,value,true);return [...new Uint8Array(bytes)];}

test('one stable-environment growth reader rereads settled values, changed anchors and live thermal factors',()=>{
  const w=room(),plants:Resource[]=[
    {id:w.nextId++,kind:'rice',x:4,z:4,amount:6,growth:.123456789,growthTick:1800,growthThermalFactor:.25},
    {id:w.nextId++,kind:'wild-plant',species:'grass',x:5,z:4,amount:6,growth:.234567891,growthTick:1900,growthThermalFactor:.75},
    {id:w.nextId++,kind:'berries',x:9,z:4,amount:6,growth:.345678912,growthTick:1750,growthThermalFactor:.125},
    {id:w.nextId++,kind:'rice',x:3,z:3,amount:6,growth:.456789123,growthTick:1850,growthThermalFactor:.375,growthLight:'artificial-full'},
    {id:w.nextId++,kind:'wild-plant',species:'glowstool',x:5,z:5,amount:6,growth:.567891234,growthTick:1950,growthThermalFactor:.625},
  ];
  w.resources=plants;for(const plant of plants)w.tiles[plant.z*w.width+plant.x]!.terrain='soil-natural';
  const reader=createPlantGrowthReader(w),rng=w.rng;
  for(const [i,plant] of plants.entries()){
    const actual=reader(plant);expect(bits(actual)).toEqual(bits(plantGrowth(w,plant)));expect(actual).toBeGreaterThan(plant.growth!);
    plant.growth=actual;plant.growthTick=w.tick;
    if(i%2)delete plant.growthThermalFactor;else plant.growthThermalFactor=.8125;
    expect(bits(reader(plant))).toEqual(bits(plantGrowth(w,plant)));expect(bits(reader(plant))).toEqual(bits(actual));
    // Explicitly change only the anchor/factor while environmental inputs stay
    // fixed. A cached result or captured old factor would fail these reads.
    plant.growthTick=w.tick-17;plant.growthThermalFactor=.125;
    const lower=reader(plant);expect(bits(lower)).toEqual(bits(plantGrowth(w,plant)));
    plant.growthThermalFactor=.875;
    const higher=reader(plant);expect(bits(higher)).toEqual(bits(plantGrowth(w,plant)));expect(higher).toBeGreaterThan(lower);
  }
  for(const plant of [...plants].reverse())expect(bits(reader(plant))).toEqual(bits(plantGrowth(w,plant)));
  expect(w.rng).toBe(rng);
});

test('thermal settlement preserves uncached growth across three regions, different limits and different old anchors',()=>{
  const w=room(),layout=reconcileTemperature(w);
  w.resources=[
    {id:w.nextId++,kind:'rice',x:4,z:4,amount:6,growth:.1,growthTick:1700,growthThermalFactor:.25},
    {id:w.nextId++,kind:'wild-plant',species:'grass',x:5,z:4,amount:6,growth:.2,growthTick:1800,growthThermalFactor:.375},
    {id:w.nextId++,kind:'rice',x:9,z:4,amount:6,growth:.3,growthTick:1900,growthThermalFactor:.5},
    {id:w.nextId++,kind:'wild-plant',species:'agave',x:10,z:4,amount:6,growth:.4,growthTick:1950,growthThermalFactor:.625},
    {id:w.nextId++,kind:'wild-plant',species:'grass',x:2,z:4,amount:6,growth:.5,growthTick:1750,growthThermalFactor:.75,growthLight:'artificial-full'},
  ];
  for(const plant of w.resources)w.tiles[plant.z*w.width+plant.x]!.terrain='soil-natural';
  expect(w.resources.map(p=>layout.indices[p.z*w.width+p.x]!)).toEqual([0,0,-1,-1,1]);
  const rng=w.rng;w.tick+=9;w.thermal!.regions.forEach((r,i)=>r.temperature=50+i*.125);
  const expected=w.resources.map(p=>plantGrowth(w,p));updatePlantTemperatures(w,layout);
  expect(w.resources.map(p=>p.growthThermalFactor)).toEqual([.5,25/33,undefined,undefined,24.875/33]);
  expect(w.resources.map(p=>p.growthTick)).toEqual([w.tick,w.tick,w.tick,w.tick,w.tick]);
  for(const [i,plant] of w.resources.entries())expect(bits(plant.growth!)).toEqual(bits(expected[i]!));
  w.tick+=9;w.thermal!.regions.forEach(r=>r.temperature=3);
  const next=w.resources.map(p=>plantGrowth(w,p));updatePlantTemperatures(w,layout);
  expect(w.resources.map(p=>p.growthThermalFactor)).toEqual([.5,.5,undefined,undefined,.5]);
  // The already-correct first crop is not rewritten, while changed species
  // settle their old factors before receiving the new half-rate interval.
  for(const i of [1,4])expect(bits(w.resources[i]!.growth!)).toEqual(bits(next[i]!));
  expect(w.rng).toBe(rng);
});

test('door exchange keeps the first matching ID and rereads replacements and open state on every call',()=>{
  const w=room();w.structures=[];const id=w.nextId++;
  const first={id,kind:'door' as const,x:1,z:1,orientation:0 as const,footprint:'standard' as const,door:newDoorState(w.tick)};
  w.structures=[first,{...first,x:2,door:{...first.door,open:true}}];
  const layout:ThermalLayout={rooms:[{cells:[0],unroofed:0,equalize:[],door:true}],doors:[{id,cell:1,neighbors:[0,-1]}],indices:new Int32Array(w.tiles.length).fill(-1)};layout.indices[0]=0;
  const outside=outdoorTemperature(w),mean=(10+outside)/2,rng=w.rng;
  const advance=(open:boolean)=>{w.thermal={regions:[{cells:[0],temperature:10}]};advanceTemperature(w,layout);expect(bits(w.thermal.regions[0]!.temperature)).toEqual(bits(10+(mean-10)*Math.min(1,10/(open?34:375))));};
  advance(false);first.door.open=true;advance(true);
  w.structures[0]={...first,door:{...first.door,open:false}};advance(false);expect(w.rng).toBe(rng);
});

test('public topology recaptures source-order overlaps and same-tick vent edits without changing older layouts',()=>{
  const w=room(),cache=new ThermalTopologyCache(),air=[51,52,53,54,67,68,69,70,83,84,85,86,99,100,101,102],doorCell=66,vent=w.structures.find(s=>s.kind==='vent')!;
  const first=cache.read(w),old=structuredClone(first);
  expect(first.rooms.map(r=>r.cells)).toEqual([air,[doorCell]]);expect(first.indices[doorCell]).toBe(1);
  expect(first.vents).toEqual([{id:vent.id,structureIndex:w.structures.indexOf(vent),sides:[-1,0]}]);expect(cache.read(w)).toBe(first);
  w.structures.push({id:w.nextId++,kind:'wall',x:2,z:4,orientation:0,footprint:'standard'});
  const blocked=cache.read(w);expect(blocked.rooms.map(r=>r.cells)).toEqual([air]);expect(blocked.indices[doorCell]).toBe(-1);
  w.structures.reverse();const reordered=cache.read(w);expect(reordered.rooms.map(r=>r.cells)).toEqual([air,[doorCell]]);expect(reordered.indices[doorCell]).toBe(1);
  // Orientation and terrain are immutable in place (structure index and Tile
  // contracts): an edit replaces the structures array or the Tile object.
  w.structures=w.structures.map(s=>s===vent?{...vent,orientation:0 as const}:s);const rotated=cache.read(w);expect(rotated).not.toBe(reordered);expect(rotated.vents).toEqual([]);
  w.structures=w.structures.map(s=>s.id===vent.id?vent:s);const grass=w.tiles[72]!;w.tiles[72]={...grass,terrain:'rock'};expect(cache.read(w).vents).toEqual([]);
  w.tiles[72]=grass;expect(cache.read(w).vents).toEqual([{id:vent.id,structureIndex:w.structures.indexOf(vent),sides:[-1,0]}]);
  expect(first).toEqual(old);
});
