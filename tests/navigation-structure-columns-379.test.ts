import {expect,test} from 'vitest';
import {footprintCells} from '../src/sim/definitions.ts';
import {appendStructureEntries,captureStructureNavigation,structureAnchors,structuresOfKind,filteredStructures,filteredStructureEntries} from '../src/sim/structure-navigation.ts';
import {lazyAnimalNavigationCosts,navigationCosts} from '../src/sim/furniture-travel.ts';
import {withPileIndexScope} from '../src/sim/pile-index.ts';
import {withTerrainBlockedReadScope} from '../src/sim/terrain-read-scope.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {WeightedSearch} from '../src/sim/weighted-search.ts';
import type {Structure,World} from '../src/sim/types.ts';

const fixture=()=>({schemaVersion:379,phaseCore297:0,width:8,height:8,tiles:Array.from({length:64},()=>({terrain:'soil'})),structures:[],jobs:[],piles:[],pawns:[],tick:30}) as unknown as World;
function add(w:World,kind:Structure['kind'],x:number,z:number,orientation:Structure['orientation']=0){
 const s:Structure={id:w.structures.length+1,kind,x,z,orientation,footprint:'standard',material:'wood'};
 if(kind==='door')s.door=newDoorState(0);
 w.structures.push(s);return s;
}

test('spatial columns retain footprint and anchor source order and old membership captures',()=>{
 const w=fixture();add(w,'table',3,3,1);add(w,'stool',3,3);add(w,'power-conduit',3,3);add(w,'bed',5,5,2);
 const geometry=captureStructureNavigation(w),anchors=structureAnchors(w);
 for(let z=-1;z<=8;z++)for(let x=-1;x<=8;x++){
  const inMap=x>=0&&z>=0&&x<8&&z<8;
  expect(geometry.at({x,z})).toEqual(inMap?w.structures.filter(s=>footprintCells(s).some(c=>c.x===x&&c.z===z)):[]);
  expect(anchors.anchoredAt(x,z)).toEqual(inMap?w.structures.filter(s=>s.x===x&&s.z===z):[]);
 }
 expect(geometry.at({x:3.5,z:3})).toEqual([]);
 const old=geometry.at({x:3,z:3});w.structures=[{...w.structures[0]!,x:1,z:1}];
 expect(captureStructureNavigation(w).at({x:3,z:3})).toEqual([]);
 expect(geometry.at({x:3,z:3})).toBe(old);expect(old.map(s=>s.kind)).toEqual(['table','stool','power-conduit']);
});

test('structural travel columns match sparse captures in costs, maxima and every parent after same-tick changes',()=>{
 const w=fixture();add(w,'table',3,3,1);add(w,'stool',3,3);add(w,'power-conduit',3,3);add(w,'bed',5,5,2);const door=add(w,'door',4,3);
 w.jobs.push({id:20,kind:'wall',x:6,z:2,orientation:0,footprint:'standard',construction:'frame',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
 w.piles.push({id:21,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:3,z:4}},
  {id:22,kind:'steel',item:'steel',quantity:1,owner:{type:'ground',x:5,z:5}});
 const read=()=>withTerrainBlockedReadScope(()=>withPileIndexScope(()=>lazyAnimalNavigationCosts(w)));
 const route=(n:ReturnType<typeof navigationCosts>)=>new WeightedSearch(8,8,0,new Uint8Array(64),n.costs,n.repeaters,n.floors,new Set([28])).finish();
 const old=read(),oldValues=Array.from({length:64},(_,i)=>[old.costs?.get(i),old.floors.get(i),old.repeaters.has(i),old.stops.has(i)]);
 for(let phase=0;phase<3;phase++){
  if(phase===1){door.door!.open=true;door.door!.from=1;w.tiles[20]={terrain:'gravel',floor:'wood-planks'};w.jobs=[];w.piles=[];}
  if(phase===2){w.structures=w.structures.filter(s=>s.kind!=='table');add(w,'shelf',2,5);}
  const sparse=navigationCosts(w,undefined,undefined,undefined,false),dense=read();
  for(let i=-1;i<=64;i++){
   expect(dense.costs?.get(i)).toBe(sparse.costs?.get(i));expect(dense.costs?.has(i)).toBe(sparse.costs?.has(i));
   expect(dense.floors.get(i)).toBe(sparse.floors.get(i));expect(dense.floors.has(i)).toBe(sparse.floors.has(i));
   expect(dense.repeaters.has(i)).toBe(sparse.repeaters.has(i));expect(dense.stops.has(i)).toBe(sparse.stops.has(i));
  }
  expect(dense.costs?.maximum).toBe(sparse.costs?.maximum);expect(dense.floors.maximum).toBe(sparse.floors.maximum);
  expect(route(dense)).toEqual(route(sparse));
 }
 expect(Array.from({length:64},(_,i)=>[old.costs?.get(i),old.floors.get(i),old.repeaters.has(i),old.stops.has(i)])).toEqual(oldValues);
});

test('paged spatial columns preserve empty pages, page boundaries, partial final pages and noninteger lookups',()=>{
 const w=fixture();w.width=17;w.height=33;w.tiles=Array.from({length:561},()=>({terrain:'soil'}));
 for(const [n,i] of [0,255,256,511,512,560].entries())add(w,n%2?'standing-lamp':'stool',i%17,Math.floor(i/17));
 const geometry=captureStructureNavigation(w),anchors=structureAnchors(w);
 const dense=withTerrainBlockedReadScope(()=>withPileIndexScope(()=>lazyAnimalNavigationCosts(w,undefined,geometry))),sparse=navigationCosts(w);
 for(const i of [-1,0,.5,254,255,255.5,256,257,400,510,511,512,559,560,561,4294967296]){
  for(const key of ['costs','floors'] as const){expect(dense[key]?.get(i)).toBe(sparse[key]?.get(i));expect(dense[key]?.has(i)).toBe(sparse[key]?.has(i));}
  expect(dense.repeaters.has(i)).toBe(sparse.repeaters.has(i));expect(dense.stops.has(i)).toBe(sparse.stops.has(i));
 }
 for(let i=0;i<w.tiles.length;i++){
  const x=i%17,z=Math.floor(i/17);
  expect(geometry.at({x,z})).toEqual(geometry.entries.filter(e=>e.cells.includes(i)).map(e=>e.structure));
  expect(anchors.anchoredAt(x,z)).toEqual(w.structures.filter(s=>s.x===x&&s.z===z));
 }
});

test('construction append advances only the new geometry and preserves every earlier capture',()=>{
 const w=fixture();add(w,'table',3,3,1);add(w,'power-conduit',3,3);add(w,'door',4,3);
 const before=captureStructureNavigation(w),anchors=structureAnchors(w),oldEntries=before.entries,oldAt=before.at({x:3,z:3});
 const additions:Structure[]=[{id:50,kind:'stool',x:3,z:3,orientation:0,footprint:'standard'},
  {id:51,kind:'bed',x:6,z:6,orientation:1,footprint:'standard'},
  {id:52,kind:'door',x:3,z:3,orientation:0,footprint:'standard',door:newDoorState(0)}];
 expect(appendStructureEntries(w,...additions)).toBe(6);
 const next=captureStructureNavigation(w),cold=captureStructureNavigation({...w,structures:w.structures.slice()});
 expect(next).not.toBe(before);expect(next.entries).toEqual(cold.entries);expect(next.corners).toEqual(cold.corners);expect(next.roomDoors).toEqual(cold.roomDoors);
 for(let z=-1;z<=8;z++)for(let x=-1;x<=8;x++){
  expect(next.at({x,z})).toEqual(cold.at({x,z}));
  expect(structureAnchors(w).anchoredAt(x,z)).toEqual(structureAnchors({...w,structures:w.structures.slice()}).anchoredAt(x,z));
 }
 expect(before.entries).toBe(oldEntries);expect(before.entries).toHaveLength(3);expect(before.at({x:3,z:3})).toBe(oldAt);expect(oldAt).toHaveLength(2);
 expect(anchors.anchoredAt(3,3)).toHaveLength(2);expect(before.corners.has(27)).toBe(false);expect(before.roomDoors).toHaveLength(1);
 const updated=navigationCosts(w),independent=navigationCosts({...w,structures:w.structures.slice()});
 for(let i=-1;i<=64;i++)for(const key of ['costs','floors'] as const){expect(updated[key]?.get(i)).toBe(independent[key]?.get(i));expect(updated[key]?.has(i)).toBe(independent[key]?.has(i));}
 expect(updated.costs?.maximum).toBe(independent.costs?.maximum);expect(updated.floors.maximum).toBe(independent.floors.maximum);
});

test('construction append cold-falls back after an ordinary membership or dimension replacement',()=>{
 const w=fixture();add(w,'stool',2,2);captureStructureNavigation(w);
 w.structures.push({id:30,kind:'wall',x:4,z:4,orientation:0,footprint:'standard'});
 appendStructureEntries(w,{id:31,kind:'table',x:5,z:5,orientation:1,footprint:'standard'});
 expect(captureStructureNavigation(w).entries.map(e=>e.structure)).toEqual(w.structures);
 const geometry=captureStructureNavigation(w);w.width=4;w.height=16;
 appendStructureEntries(w,{id:32,kind:'stool',x:1,z:10,orientation:0,footprint:'standard'});
 expect(captureStructureNavigation(w)).not.toBe(geometry);
 expect(captureStructureNavigation(w).at({x:1,z:10}).map(s=>s.id)).toEqual([32]);
});

test('source-owned append extends existing kind/family views without revisiting old members',()=>{
 const w=fixture();add(w,'stool',2,2);add(w,'table',3,3);
 let reads=0;const keep=(s:Structure)=>{reads++;return s.kind==='stool';};
 const oldKind=structuresOfKind(w,'stool'),oldFamily=filteredStructures(w,'test-stools',keep),oldEntries=filteredStructureEntries(w,'test-stools',keep);
 expect(reads).toBe(4);
 const appended:Structure={id:40,kind:'stool',x:4,z:4,orientation:0,footprint:'standard'};
 appendStructureEntries(w,appended);expect(reads).toBe(6);
 expect(structuresOfKind(w,'stool')).toEqual([...oldKind,appended]);
 expect(filteredStructures(w,'test-stools',keep)).toEqual([...oldFamily,appended]);
 expect(filteredStructureEntries(w,'test-stools',keep).map(e=>e.structure)).toEqual([...oldFamily,appended]);
 expect(reads).toBe(6);expect(oldKind).toHaveLength(1);expect(oldFamily).toHaveLength(1);expect(oldEntries).toHaveLength(1);
});
