import {expect,test} from 'vitest';
import {blockedCells,withTerrainBlockedReadScope} from '../src/sim/pathfinding';
import {terrainReadScope,withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {navigationCosts} from '../src/sim/furniture-travel';
import {captureTerrainJournal,captureTerrainReadCursor,invalidateTerrainJournal,markTerrainCellChanged,peekTerrainJournalCursor,readTerrainJournal,setTerrainWriteCacheVerification,TERRAIN_JOURNAL_CAPACITY,verifyTerrainWriteCaches} from '../src/sim/terrain-mutation-journal';
import type {Tile,World} from '../src/sim/types';

// Only the fields consumed by blockedCells: no engine generation or clocks.
const fixture=()=>({schemaVersion:379,width:4,height:4,tiles:Array.from({length:16},()=>({terrain:'soil'} as Tile)),structures:[],jobs:[],piles:[],pawns:[],tick:0}) as unknown as World;

test('navigation journal observation preserves encoder enrollment and independent cursors',()=>{
 const tiles:Tile[]=[{terrain:'soil'},{terrain:'water'}],nav=captureTerrainReadCursor(tiles);
 expect(peekTerrainJournalCursor(tiles)).toBeUndefined();
 markTerrainCellChanged(tiles,1);expect(readTerrainJournal(tiles,nav)?.indices).toEqual([1]);
 const transport=captureTerrainJournal(tiles);expect(peekTerrainJournalCursor(tiles)?.version).toBe(transport.version);
 markTerrainCellChanged(tiles,0);markTerrainCellChanged(tiles,1);
 expect(readTerrainJournal(tiles,nav)?.indices).toEqual([0,1]);
 expect(readTerrainJournal(tiles,transport)?.indices).toEqual([0,1]);
});

test('marked same-scope refresh matches a fresh full grid through repeats, bulk and overflow',()=>{
 const world=fixture(),compare=()=>expect(blockedCells(world)).toEqual(blockedCells({...world,tiles:world.tiles.slice()}));
 withTerrainBlockedReadScope(()=>{
  compare();
  world.tiles[5]={terrain:'water'};markTerrainCellChanged(world.tiles,5);markTerrainCellChanged(world.tiles,5);compare();
  world.tiles[5]={terrain:'soil'};markTerrainCellChanged(world.tiles,5);world.tiles[8]={terrain:'rock'};markTerrainCellChanged(world.tiles,8);compare();
  world.tiles[9]={terrain:'water'};invalidateTerrainJournal(world.tiles);compare();
  world.tiles[10]={terrain:'water'};for(let i=0;i<=TERRAIN_JOURNAL_CAPACITY;i++)markTerrainCellChanged(world.tiles,10);compare();
 });
 world.tiles[5]={terrain:'water'};withTerrainBlockedReadScope(compare); // unmarked external fixture edit
 expect(terrainReadScope()).toBeUndefined();
});

test('nested scopes retain a token and verification rejects an unmarked edit beside a marked one',()=>{
 const world=fixture(),before=verifyTerrainWriteCaches;
 try{
  setTerrainWriteCacheVerification(true);
  withTerrainBlockedReadScope(()=>{
   const token=terrainReadScope();blockedCells(world);
   withTerrainBlockedReadScope(()=>expect(terrainReadScope()).toBe(token));
   world.tiles[3]={terrain:'water'};markTerrainCellChanged(world.tiles,3);
   world.tiles[7]={terrain:'water'};
   expect(()=>blockedCells(world)).toThrow('Unmarked terrain replacement');
  });
  expect(blockedCells(world)[7]).toBe(1);
 }finally{setTerrainWriteCacheVerification(before);}
});

test('incremental cost layers equal complete captures and retain old decisions through maximum and marsh removal',()=>{
 const world=fixture(),before=verifyTerrainWriteCaches;
 world.snow={revision:1,adoptedAt:0,lastTick:0,cursor:0,seed:1};
 const captures:{costs:ReturnType<typeof navigationCosts>;values:(number|undefined)[]}[]=[];
 const compare=()=>{
  const actual=navigationCosts(world),fresh=navigationCosts({...world,tiles:world.tiles.slice()});
  for(const key of ['costs','floors'] as const){
   expect(actual[key]?.maximum).toBe(fresh[key]?.maximum);
   for(let i=-1;i<=world.tiles.length;i++){expect(actual[key]?.get(i)).toBe(fresh[key]?.get(i));expect(actual[key]?.has(i)).toBe(fresh[key]?.has(i));}
  }
  for(const old of captures)expect(world.tiles.map((_,i)=>old.costs.costs?.get(i))).toEqual(old.values);
  captures.push({costs:actual,values:world.tiles.map((_,i)=>actual.costs?.get(i))});
 };
 try{
  setTerrainWriteCacheVerification(true);
  withTerrainBlockedReadScope(()=>{
   compare();
   world.tiles[3]={terrain:'marsh',snowDepth:1};markTerrainCellChanged(world.tiles,3);compare();
   world.tiles[3]={terrain:'soil',snowDepth:.3};markTerrainCellChanged(world.tiles,3);compare();
   world.tiles[3]={terrain:'soil'};markTerrainCellChanged(world.tiles,3);compare();
   world.tiles[5]={terrain:'marsh'};markTerrainCellChanged(world.tiles,5);compare();
   world.tiles[5]={terrain:'marsh',bridge:true};markTerrainCellChanged(world.tiles,5);compare();
   world.tiles[5]={terrain:'marsh',floor:'wood-planks'};invalidateTerrainJournal(world.tiles);compare();
   delete world.snow;compare();
  });
  world.tiles[7]={terrain:'marsh'};withTerrainBlockedReadScope(compare);
  world.tiles[7]={terrain:'soil'};compare(); // standalone unmarked replacement
 }finally{setTerrainWriteCacheVerification(before);}
});

test('exclusive Worker terrain witness follows marks across clock tasks, not external calls or a different owner',()=>{
 const w=fixture(),owner={},old=verifyTerrainWriteCaches;
 const read=()=>({blocked:blockedCells(w),costs:w.tiles.map((_,i)=>navigationCosts(w).costs?.get(i))});
 try{
  const first=withJournalTerrainReadScope(owner,read);w.tiles[3]={terrain:'marsh'};markTerrainCellChanged(w.tiles,3);
  const second=withJournalTerrainReadScope(owner,read);expect(second).toEqual(read());expect(second.costs).not.toEqual(first.costs);
  w.tiles[4]={terrain:'rock'};expect(withJournalTerrainReadScope({},read).blocked[4]).toBe(1);
  withJournalTerrainReadScope(owner,read);w.tiles[7]={terrain:'rock'};setTerrainWriteCacheVerification(true);
  expect(()=>withJournalTerrainReadScope(owner,()=>blockedCells(w))).toThrow('Unmarked terrain replacement');
  expect(blockedCells(w)[7]).toBe(1);
 }finally{setTerrainWriteCacheVerification(old);}
});
