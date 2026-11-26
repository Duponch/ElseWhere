import {expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {PowerTopologyCache,connectedPowerDispatchGroups,connectedPowerGroups,isPowerDispatchKind} from '../src/sim/power-topology.ts';
import {newPowerState} from '../src/sim/power-rules.ts';
import {reconcilePower} from '../src/sim/power.ts';
import {ThermalTopologyCache,type ThermalLayout} from '../src/sim/thermal-topology.ts';
import {appendStructureEntries,structureMembershipToken} from '../src/sim/structure-navigation.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {markResourceArrayChanged,invalidateResourceJournal} from '../src/sim/resource-mutation-journal.ts';
import {markTerrainCellChanged,setTerrainWriteCacheVerification,verifyTerrainWriteCaches} from '../src/sim/terrain-mutation-journal.ts';
import {createActualPlantSpatialSession256,createActualPlantSpatialSpawner256} from '../src/sim/actual-plant-spatial-session-256.ts';
import {createSpatialWildPlantSpawner256} from '../src/sim/wild-plant-spawner-256.ts';
import {LOCAL_BIOME_RULES_256} from '../src/sim/local-biome-rules-v256.ts';
import {WILD_PLANT_GENERATION_FACTS_256,type WildPlantGenerationDef256} from '../src/sim/wild-plant-generation-data-256.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import type {World,Structure,Resource} from '../src/sim/types.ts';

const fixture=():World=>{
 const w=createWorld(93,32,32);
 w.tiles=w.tiles.map(()=>({terrain:'soil-natural'}));w.structures=[];w.resources=[];
 w.jobs=[];w.piles=[];w.packed=[];delete w.geysers;delete w.roofing;delete w.site;
 return w;
};
const building=(w:World,kind:Structure['kind'],x:number,z:number):Structure=>({id:w.nextId++,kind,x,z,orientation:0,footprint:'standard'});
const add=(w:World,kind:Structure['kind'],x:number,z:number):Structure=>{const s=building(w,kind,x,z);appendStructureEntries(w,s);return s;};

test('private electrical dispatch omits passive wires, keeps canonical owner order and retains topology through unrelated appends',()=>{
 const w=fixture(),owner={};
 const electric=(kind:Structure['kind'],x:number,z:number)=>{
  const s=add(w,kind,x,z);s.power=newPowerState(kind);return s;
 };
 electric('wood-generator',2,5);for(let x=3;x<10;x++)electric('power-conduit',x,5);
 const gate=electric('power-switch',10,5);
 for(let x=11;x<18;x++)electric('power-conduit',x,5);
 electric('battery',18,5).battery={stored:1};
 electric('standing-lamp',4,8);electric('heater',15,8);
 // The topology sorts the transmitters, but the connected consumers are
 // appended in source order. A reverse input witnesses both.
 w.structures.reverse();
 const reader=new PowerTopologyCache(),read=()=>reader.read(w);
 const keyed=vi.spyOn(reader as unknown as {readKeyed(w:World,nominal?:readonly Structure[]):unknown},'readKeyed');
 const compare=()=>{reconcilePower(w);const topology=read(),parts=connectedPowerDispatchGroups(w,topology);
  expect(parts).toEqual(connectedPowerGroups(w,topology).map(group=>group.filter(s=>isPowerDispatchKind(s.kind))));
  expect(parts.flat().some(s=>s.kind==='power-conduit'||s.kind==='power-switch')).toBe(false);
  return topology;
 };
 withJournalTerrainReadScope(owner,()=>{
  const before=compare();keyed.mockClear();
  add(w,'stool',20,20);expect(compare()).toBe(before);if(!verifyTerrainWriteCaches)expect(keyed).not.toHaveBeenCalled();
  gate.power!.switchOn=false;expect(compare()).not.toBe(before);
  gate.power!.switchOn=true;compare();
  w.structures=w.structures.filter(s=>!(s.kind==='power-conduit'&&s.x===9));compare();
 });
});

test('retained thermal proof survives irrelevant structure appends without revalidating the full layout',()=>{
 const w=fixture(),owner={};
 for(let z=2;z<=7;z++)for(let x=2;x<=7;x++)if(x===2||x===7||z===2||z===7)add(w,'wall',x,z);
 const constructed:number[]=[];for(let z=3;z<7;z++)for(let x=3;x<7;x++)constructed.push(z*w.width+x);
 w.roofing={constructed,build:[],remove:[],cursor:0};
 const cache=new ThermalTopologyCache();
 const full=vi.spyOn(cache as unknown as {readFull(world:World,geographic:boolean):ThermalLayout},'readFull');
 const read=()=>withJournalTerrainReadScope(owner,()=>cache.read(w));
 const initial=read();
 full.mockClear();withJournalTerrainReadScope(owner,()=>{add(w,'stool',25,25);add(w,'wall',25,26);});
 expect(read()).toBe(initial);
 if(!verifyTerrainWriteCaches)expect(full).not.toHaveBeenCalled();
 expect(read()).toEqual(new ThermalTopologyCache().read(w));
 withJournalTerrainReadScope(owner,()=>add(w,'wall',4,4));
 const changed=read();expect(changed).not.toBe(initial);expect(changed).toEqual(new ThermalTopologyCache().read(w));
 w.structures=w.structures.filter(s=>s.x!==4||s.z!==4);expect(read()).toEqual(initial);
});

const order=Object.keys(WILD_PLANT_GENERATION_FACTS_256) as WildPlantGenerationDef256[];
const header=(w:World)=>({width:w.width,height:w.height,rules:LOCAL_BIOME_RULES_256['temperate-forest'],densityFactor:1,tileMinTemperature:0,tileMaxTemperature:30,desiredPlants:450});
const grass=(w:World,x:number,z:number):Resource=>({id:w.nextId++,kind:'wild-plant',species:'grass',x,z,amount:6,growth:.3,growthTick:w.tick});
test('journal population and immutable structural mask preserve exact flora choices through removals, appends and unknown replacement',()=>{
 const w=fixture(),owner={};w.resources=[grass(w,3,3),grass(w,7,7),grass(w,8,8)];add(w,'wall',9,9);
 const wasChecking=verifyTerrainWriteCaches;setTerrainWriteCacheVerification(true);
 try{
  const compare=()=>{
   const expectedWorld=structuredClone(w),literal=createSpatialWildPlantSpawner256(createActualPlantSpatialSession256(expectedWorld,header(expectedWorld)),order);
   withJournalTerrainReadScope(owner,()=>{
    structureMembershipToken(w);
    const actual=createActualPlantSpatialSpawner256(w,header(w),order),a=new WorldGenerationRandom(319),b=new WorldGenerationRandom(319);
    for(let c=0;c<w.tiles.length;c+=11){
     expect(actual.desiredAt(c)).toBe(literal.desiredAt(c));
     expect(actual.pick(c,a,450,true)).toBe(literal.pick(c,b,450,true));expect(a.state).toEqual(b.state);
    }
   });
  };
  const edit=(gone:Resource[],added:Resource[])=>withJournalTerrainReadScope(owner,()=>{
   const old=w.resources;w.resources=[...old.filter(p=>!gone.includes(p)),...added];markResourceArrayChanged(w,old,added,gone);
  });
  compare();edit([w.resources[1]!],[grass(w,10,15)]);edit([],[grass(w,15,10)]);compare();
  withJournalTerrainReadScope(owner,()=>{add(w,'stool',27,27);add(w,'wall',11,11);});compare();
  w.structures=w.structures.filter(s=>s.kind!=='wall');compare();
  invalidateResourceJournal(w);w.resources=w.resources.slice().reverse();compare();
 }finally{setTerrainWriteCacheVerification(wasChecking);}
});

test('plant region commits rebuild changed chunks, retain remote components and rediscover ordered adjacency',()=>{
 const w=fixture(),owner={};
 const actual=()=>withJournalTerrainReadScope(owner,()=>{structureMembershipToken(w);return createActualPlantSpatialSession256(w,header(w));});
 const remote=29*w.width+29,a=3*w.width+3,b=4*w.width+4,first=actual();
 const nearFirst=first.spatial.near(a,0)[0]!,remoteFirst=first.spatial.near(remote,0)[0]!;
 const original=nearFirst.cells.slice();
 // Force the cached cross-chunk adjacency before changing the component.
 first.spatial.near(a,25);
 withJournalTerrainReadScope(owner,()=>add(w,'wall',4,4));
 const compare=()=>{
  const retained=actual(),coldWorld=structuredClone(w),cold=createActualPlantSpatialSession256(coldWorld,header(coldWorld));
  for(const cell of [a,remote,11*w.width+11,12*w.width+12,b])for(const radius of [0,12,25])
   expect(retained.spatial.near(cell,radius)).toEqual(cold.spatial.near(cell,radius));
  return retained;
 };
 const changed=compare(),changedRegion=changed.spatial.near(a,0)[0]!;expect(changedRegion).not.toBe(nearFirst);
 expect(changed.spatial.near(remote,0)[0]).toBe(remoteFirst);expect(nearFirst.cells).toEqual(original);
 w.tiles[5*w.width+5]={terrain:'rock'};markTerrainCellChanged(w.tiles,5*w.width+5);
 const second=compare();expect(second.spatial.near(a,0)[0]).not.toBe(changedRegion);expect(second.spatial.near(remote,0)[0]).toBe(remoteFirst);
 const firstChanged=6*w.width+6,bad=7*w.width+7;
 // A rejected second input may follow a perfectly valid first edit. The
 // failed patch must not certify that first edit while its region slots
 // still describe the previous topology.
 w.tiles[firstChanged]={terrain:'rock'};markTerrainCellChanged(w.tiles,firstChanged);
 w.tiles[bad]={terrain:'soil-natural',snowDepth:NaN};markTerrainCellChanged(w.tiles,bad);
 expect(()=>actual()).toThrow('Invalid actual spatial plant cell');
 w.tiles[bad]={terrain:'soil-natural'};markTerrainCellChanged(w.tiles,bad);
 const recovered=compare();expect(recovered.spatial.near(a,0)[0]!.cells).not.toContain(firstChanged);
});
