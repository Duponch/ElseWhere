import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {reconcilePlantLighting} from '../src/sim/plant-lighting.ts';
import {updatePlantTemperatures} from '../src/sim/thermal-plants.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {markResourceArrayChanged,invalidateResourceJournal} from '../src/sim/resource-mutation-journal.ts';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal.ts';
import type {Resource,World} from '../src/sim/types.ts';
import type {ThermalLayout} from '../src/sim/thermal-topology.ts';
import type {LightEnvironment} from '../src/sim/light-environment.ts';

afterEach(()=>setTerrainWriteCacheVerification(false));
const noLight=()=>{throw Error('No sun lamp should require an artificial field');};
function fixture():World {
 const world=createWorld(81,16,16);world.tick=2000;delete world.site;
 world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.structures=[];world.jobs=[];world.piles=[];
 world.resources=[
  {id:20000,kind:'rice',x:5,z:5,amount:6,growth:.123456789,growthTick:1900},
  {id:20001,kind:'rice',x:6,z:5,amount:6,growth:.234567891,growthTick:1800},
  {id:20002,kind:'wild-plant',species:'grass',x:7,z:5,amount:6,growth:.345678912,growthTick:1700},
  {id:20003,kind:'rock',x:8,z:5,amount:10},
 ];
 world.roofing={constructed:[85],build:[],remove:[],cursor:0};
 world.thermal={regions:[{cells:[85,86,87],temperature:3}]};return world;
}
const layoutFor=(world:World):ThermalLayout=>({rooms:[],doors:[],indices:new Int32Array(world.width*world.height).fill(0)});
function edit(world:World,removed:Resource[],appended:Resource[],known=true):void {
 const before=world.resources,gone=new Set(removed);world.resources=[...before.filter(p=>!gone.has(p)),...appended];
 markResourceArrayChanged(world,before,appended,known?removed:undefined);
}
function continuation(world:World,closed:boolean):unknown[] {
 const owner={},layout=layoutFor(world),snapshots:unknown[]=[];
 const observe=()=>{const run=()=>{reconcilePlantLighting(world,noLight);updatePlantTemperatures(world,layout);};if(closed)withJournalTerrainReadScope(owner,run);else run();snapshots.push(structuredClone(world));};
 observe();
 world.tick++;edit(world,[world.resources[0]!],[{id:20011,kind:'rice',x:5,z:5,amount:6,growth:.456789123,growthTick:1900}]);observe();
 world.tick++;observe();
 world.tick+=198;world.thermal!.regions[0]!.temperature=51;
 const removed=world.resources[0]!;edit(world,[removed],[]);edit(world,[],[{...removed,id:22000,x:5,growthLight:undefined}]);observe();
 world.tick++;world.roofing!.constructed=[85,86,87];observe();
 world.tick++;world.resources=world.resources.slice().reverse();invalidateResourceJournal(world);observe();
 world.tick+=200;edit(world,[world.resources[0]!],[{id:24022,kind:'rice',x:6,z:5,amount:6,growth:.567891234,growthTick:world.tick-23}],false);observe();
 world.tick+=200;world.thermal!.regions[0]!.temperature=20;world.roofing!.constructed=[];observe();
 return snapshots;
}

test('closed lighting and TickLong membership preserve every state through edits, regimes, unknown history and elapsed ticks',()=>{
 const source=fixture(),expected=continuation(structuredClone(source),false);
 setTerrainWriteCacheVerification(true);
 expect(continuation(structuredClone(source),true)).toStrictEqual(expected);
});

test('stable lighting visits only appended plants, while the public mutable-array reader remains exhaustive',()=>{
 const world=fixture(),owner={};
 withJournalTerrainReadScope(owner,()=>reconcilePlantLighting(world,noLight));
 const survivor=world.resources[1]!;let reads=0;
 Object.defineProperty(survivor,'growthLight',{configurable:true,enumerable:true,get(){reads++;return undefined;}});
 edit(world,[world.resources[0]!],[{id:22010,kind:'rice',x:5,z:5,amount:6,growth:.5,growthTick:world.tick-10}]);
 withJournalTerrainReadScope(owner,()=>reconcilePlantLighting(world,noLight));
 expect(reads).toBe(0);expect(world.resources.at(-1)!.growthLight).toBe('dark');
 reconcilePlantLighting(world,noLight);expect(reads).toBeGreaterThan(0);
});

test('lighting fields and shared reader Worlds invalidate the sparse survivor proof without changing growth',()=>{
 const source=fixture();source.structures=[{id:30000,kind:'sun-lamp',x:2,z:2,orientation:0,footprint:'standard'}];
 const execute=(closed:boolean)=>{
  const world=structuredClone(source),other={...world,resources:world.resources.slice(),roofing:{constructed:[86],build:[],remove:[],cursor:0}} as World;
  const owner={},field=new Float32Array(world.tiles.length),light={artificial:field} as LightEnvironment;
  const run=(w:World)=>closed?withJournalTerrainReadScope(owner,()=>reconcilePlantLighting(w,light)):reconcilePlantLighting(w,light);
  run(world);run(other);edit(world,[],[{id:22010,kind:'rice',x:5,z:5,amount:6,growth:.5,growthTick:world.tick-10}]);run(world);
  field[85]=1; // A new immutable field is supplied by the real light cache.
  const next={artificial:field.slice()} as LightEnvironment;
  if(closed)withJournalTerrainReadScope(owner,()=>reconcilePlantLighting(world,next));else reconcilePlantLighting(world,next);
  return structuredClone(world);
 };
 expect(execute(true)).toStrictEqual(execute(false));
});
