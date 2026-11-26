import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {actualPlantRegions379} from '../src/sim/actual-plant-regions-379.ts';
import {createActualPlantSpatialSession256} from '../src/sim/actual-plant-spatial-session-256.ts';
import {PlantSpatialRegions256} from '../src/sim/wild-plant-spatial-regions-256.ts';
import {LOCAL_BIOME_RULES_256} from '../src/sim/local-biome-rules-v256.ts';
import {structureMembershipToken} from '../src/sim/structure-navigation.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {markTerrainCellChanged,invalidateTerrainJournal,setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal.ts';
import type {World} from '../src/sim/types.ts';

afterEach(()=>setTerrainWriteCacheVerification(false));
function fixture():World {
 const world=createWorld(71,32,32);world.structures=[];world.resources=[];world.jobs=[];world.piles=[];world.packed=[];delete world.geysers;
 world.tiles=world.tiles.map((_,c)=>({terrain:c%37===0?'rock':c%11===0?'water-shallow':c%7===0?'rich-soil':'soil-natural'}));
 world.roofing={constructed:[40,41],build:[],remove:[],cursor:0,natural:{thin:[500,501,502],thick:[530]}};return world;
}
function oracle(world:World):PlantSpatialRegions256 {
 const input=createActualPlantSpatialSession256(world,{width:world.width,height:world.height,rules:LOCAL_BIOME_RULES_256['temperate-forest'],densityFactor:1,tileMinTemperature:0,tileMaxTemperature:30,desiredPlants:200});
 return new PlantSpatialRegions256(world.width,world.height,c=>(input.spatial.cell(c) as unknown as {regionType:number}).regionType,c=>{
  const cell=input.spatial.cell(c);let base=cell.fertility;if(cell.naturalRoof)base=Math.fround(base*.5);if(cell.water&&base<=0)base=Math.fround(.1);return base;
 });
}
const shape=(region:ReturnType<PlantSpatialRegions256['regionAt']>)=>region&&{...region,neighbours:[]};
test('retained flora regions preserve component cells, ordered float sums, contacts and BFS after real dependency edits',()=>{
 const world=fixture(),owner={},writes=new Int32Array(0);
 const capture=()=>{structureMembershipToken(world);return withJournalTerrainReadScope(owner,()=>actualPlantRegions379(world,writes,true)!);};
 expect(actualPlantRegions379(world,writes,true)).toBeUndefined();
 const compare=()=>{
  const cold=oracle(world),actual=capture();
  for(let c=0;c<world.tiles.length;c++)expect(shape(actual.regions.regionAt(c))).toStrictEqual(shape(cold.regionAt(c)));
  for(const c of [1,100,530,1023])for(const radius of [0,7,20,25.5])expect(actual.regions.near(c,radius).map(shape)).toStrictEqual(cold.near(c,radius).map(shape));
  return actual;
 };
 setTerrainWriteCacheVerification(true);let previous=compare();
 world.tiles[100]={...world.tiles[100]!,snowDepth:.15};markTerrainCellChanged(world.tiles,100);
 expect(compare().regions).toBe(previous.regions);
 world.resources=[{id:30000,kind:'rice',x:4,z:4,amount:6}];world.piles=[];
 expect(compare().regions).toBe(previous.regions);
 world.tiles[100]={terrain:'water-shallow',bridge:true};markTerrainCellChanged(world.tiles,100);
 const changed=compare();expect(changed.regions).not.toBe(previous.regions);previous=changed;
 world.roofing!.natural!.thin=[100,500,501,502];expect(compare().regions).not.toBe(previous.regions);
 previous=capture();invalidateTerrainJournal(world.tiles);expect(compare().regions).not.toBe(previous.regions);
 previous=capture();world.tiles=world.tiles.slice();expect(compare().regions).not.toBe(previous.regions);
});
test('closed flora region validation rejects an unmarked physical edit instead of silently accepting stale topology',()=>{
 const world=fixture(),owner={},writes=new Int32Array(0);structureMembershipToken(world);
 withJournalTerrainReadScope(owner,()=>actualPlantRegions379(world,writes,true)!.regions.regionAt(100));
 world.tiles[100]={terrain:'rock'};setTerrainWriteCacheVerification(true);
 expect(()=>withJournalTerrainReadScope(owner,()=>actualPlantRegions379(world,writes,true))).toThrow('Unmarked plant region input mutation');
});

test('real structure flags retain door and fence precedence, full-fill barriers and normal walkability',()=>{
 const world=fixture(),owner={};
 world.structures=[
  {id:31000,kind:'wall',x:2,z:3,orientation:0,footprint:'standard'},
  {id:31001,kind:'door',x:3,z:3,orientation:0,footprint:'standard'},
  {id:31002,kind:'fence',x:4,z:3,orientation:0,footprint:'standard'},
  {id:31003,kind:'table-square',x:5,z:3,orientation:0,footprint:'standard'},
 ];
 // The actual producer's bit writes, with overlap preserved as an OR.
 const writes=new Int32Array([98,1|2|4|8,99,1|2|4|8|16,100,4|8|32,101,4|8]);structureMembershipToken(world);
 const actual=withJournalTerrainReadScope(owner,()=>actualPlantRegions379(world,writes,true)!),cold=oracle(world);
 for(let c=0;c<world.tiles.length;c++)expect(shape(actual.regions.regionAt(c))).toStrictEqual(shape(cold.regionAt(c)));
 for(const c of [98,99,100,101])expect(actual.walkableNoDoorAt(c)).toBe(c===100||c===101);
});
