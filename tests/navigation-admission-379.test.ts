import {expect,test} from 'vitest';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {withPileIndexScope,pileIndex,capturePileGroundFacts379,assignPileOwner} from '../src/sim/pile-index.ts';
import {lazyAnimalNavigationCosts,navigationCosts} from '../src/sim/furniture-travel.ts';
import {constructionObstructions} from '../src/sim/construction-rules.ts';
import {footprintCells} from '../src/sim/definitions.ts';
import type {Job,Resource,World} from '../src/sim/types.ts';

const fixture=():World=>({schemaVersion:379,width:18,height:18,tiles:Array.from({length:324},()=>({terrain:'grass'})),structures:[],jobs:[],piles:[],pawns:[],resources:[],tick:30,phaseCore297:0}) as unknown as World;
const job=(id:number,kind:Job['kind'],x:number,z:number):Job=>({id,kind,x,z,orientation:0,footprint:'standard',construction:'blueprint',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
const resource=(id:number,x:number,z:number,kind:Resource['kind']='tree'):Resource=>({id,kind,x,z,amount:10}) as Resource;

test('pile facts capture is shared until actual cell flags change and old decisions remain immutable',()=>{
 const w=fixture(),owner={};w.piles.push({id:1,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:2,z:2}});
 const capture=()=>withPileIndexScope(()=>capturePileGroundFacts379(pileIndex(w)!));
 withJournalTerrainReadScope(owner,()=>{
  const first=capture();expect(first.mask).toBe(1);expect(capture()).toBe(first);
  w.piles[0]!.quantity=99;expect(capture()).toBe(first);
  w.piles.push({id:2,kind:'wood',item:'wood',quantity:1,owner:{type:'ground',x:7,z:7}});expect(capture()).toBe(first);
  w.piles.push({id:3,kind:'steel',item:'steel',quantity:1,owner:{type:'ground',x:3,z:2}});const second=capture();expect(second).not.toBe(first);expect(second.mask).toBe(3);expect(first.facts[39]).toBe(0);
  assignPileOwner(w.piles[0]!,{type:'ground',x:4,z:2});const third=capture();expect(third.facts[38]).toBe(0);expect(third.facts[40]).toBe(1);expect(first.facts[38]).toBe(1);
 });
 const publicA=capture(),publicB=capture();expect(publicA).not.toBe(publicB);
});

test('owned lazy animal admission equals full source capture before and after construction and pile commits',()=>{
 const w=fixture();w.structures.push({id:1,kind:'table',x:5,z:5,orientation:0,footprint:'standard',material:'wood'});
 w.jobs.push({...job(2,'wall',9,9),construction:'frame'});
 w.piles.push({id:3,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',x:3,z:3}},{id:4,kind:'steel',item:'steel',quantity:1,owner:{type:'ground',x:4,z:4}});
 withJournalTerrainReadScope({},()=>withPileIndexScope(()=>{
  const compare=()=>{const full=navigationCosts(w),lazy=lazyAnimalNavigationCosts(w);for(const key of ['costs','floors'] as const){expect(lazy[key]?.maximum).toBe(full[key]?.maximum);for(let i=0;i<w.tiles.length;i++){expect(lazy[key]?.get(i)).toBe(full[key]?.get(i));expect(lazy[key]?.has(i)).toBe(full[key]?.has(i));}}for(let i=0;i<w.tiles.length;i++){expect(lazy.repeaters.has(i)).toBe(full.repeaters.has(i));expect(lazy.stops.has(i)).toBe(full.stops.has(i));}};
  compare();assignPileOwner(w.piles[0]!,{type:'ground',x:10,z:9});w.jobs=w.jobs.slice(0,0);compare();
 }));
});

test('construction footprint queries retain canonical plant/pile order across removals, append and public mutations',()=>{
 const w=fixture();w.jobs.push(job(1,'table',5,5),job(2,'wall',12,12));const cells=footprintCells(w.jobs[0]!);
 const first=resource(3,cells.at(-1)!.x,cells.at(-1)!.z),second=resource(4,cells[0]!.x,cells[0]!.z),far=Array.from({length:500},(_,i)=>resource(100+i,0,0));w.resources=[...far,first,second,resource(5,12,12,'rock')];
 w.piles.push({id:6,kind:'wood',item:'wood',quantity:1,owner:{type:'ground',x:cells.at(-1)!.x,z:cells.at(-1)!.z}});
 const owner={},compare=()=>{const expected=constructionObstructions(w),actual=withJournalTerrainReadScope(owner,()=>constructionObstructions(w));expect(actual).toEqual(expected);return actual;};
 expect(compare().get(1)!.plant).toBe(first);
 // Exercise the resident source-order index directly before a public read
 // retires it: removal + append keeps all survivors' relative ordinals.
 withJournalTerrainReadScope(owner,()=>{
  w.resources=w.resources.filter(r=>r!==first);expect(constructionObstructions(w).get(1)!.plant).toBe(second);
  const appended=resource(7,cells.at(-1)!.x,cells.at(-1)!.z);w.resources=[...w.resources,appended];expect(constructionObstructions(w).get(1)!.plant).toBe(second);
 });
 compare();w.resources[500]!.x=1;w.resources.reverse();compare();w.jobs.reverse();compare();
});
