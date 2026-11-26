import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {navigationCosts,navigationSearchCosts379,captureStandability} from '../src/sim/furniture-travel';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {withPileIndexScope,assignPileOwner} from '../src/sim/pile-index';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';
import {newDoorState} from '../src/sim/door-rules';
import {ensureFireState} from '../src/sim/fire-rules';
import type {Job} from '../src/sim/types';
afterEach(()=>setTerrainWriteCacheVerification(false));
test('owned human search costs borrow immutable contributors while speed and actual source writes stay live',()=>{
 const w=createWorld(42,20,20),p=w.pawns[0]!,q=w.pawns[1]!;w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.jobs=[];w.structures=[];w.resources=[];w.piles=[];
 const door={id:w.nextId++,kind:'door' as const,x:5,z:5,orientation:0 as const,footprint:'standard' as const,material:'wood' as const,door:newDoorState(w.tick)};
 const gate={...door,id:w.nextId++,kind:'fence-gate' as const,x:8,door:{...door.door}};w.structures=[door,gate];
 const pile={id:w.nextId++,kind:'chunk' as const,item:'granite-chunk' as const,quantity:1,owner:{type:'ground' as const,x:11,z:11}};w.piles=[pile];
 const frame:Job={id:w.nextId++,kind:'wall',x:12,z:12,orientation:0,footprint:'standard',construction:'frame',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};
 const owner={},at=(x:number,z:number)=>z*w.width+x;
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope(owner,()=>withPileIndexScope(()=>{
  const first=navigationSearchCosts379(w,p),second=navigationSearchCosts379(w,q);expect([...second.repeaters]).toEqual([...first.repeaters]);expect([...second.stops]).toEqual([...first.stops]);expect(second.costs!.get(at(5,5))).toBe(first.costs!.get(at(5,5)));
  expect(first.repeaters.has(at(11,11))).toBe(true);
  // A formerly closed door now has zero wait. The ancestor's cost snapshot
  // remains intact even when the producer reuses its structure object.
  door.door.open=true;door.door.from=1;const open=navigationSearchCosts379(w,p);expect(open.costs!.get(at(5,5))!).toBeLessThan(first.costs!.get(at(5,5))!);expect(navigationSearchCosts379(w,q).costs!.get(at(5,5))).toBe(open.costs!.get(at(5,5)));
  const stand=captureStandability(w);expect(stand(pile.owner as {x:number;z:number})).toBe(false);
  assignPileOwner(pile,{type:'ground',x:14,z:14});const moved=navigationSearchCosts379(w,p);expect(moved.repeaters.has(at(11,11))).toBe(false);expect(moved.repeaters.has(at(14,14))).toBe(true);expect(stand({x:11,z:11})).toBe(false);expect(first.repeaters.has(at(11,11))).toBe(true);expect([...first.repeaters]).toContain(at(11,11));
  w.jobs.push(frame);const framed=navigationSearchCosts379(w,p);expect(framed.stops.has(at(12,12))).toBe(true);expect(moved.stops.has(at(12,12))).toBe(false);
  ensureFireState(w).items.push({id:w.nextId++,x:1,z:1,size:.1,bornCore:0,nextPulseCore:15,complexCore:150,spreadCore:150});const burning=navigationSearchCosts379(w,q);expect(burning.costs!.get(at(1,1))!).toBeGreaterThan(framed.costs!.get(at(1,1))!);
  const again=navigationSearchCosts379(w,p);expect(again.costs!.get(at(1,1))).toBe(burning.costs!.get(at(1,1)));
 }));
 const publicCost=navigationCosts(w,p),fresh=withJournalTerrainReadScope(owner,()=>withPileIndexScope(()=>navigationSearchCosts379(w,p)));
 expect(publicCost.costs).not.toBe(fresh.costs);for(let i=0;i<w.width*w.height;i++){expect(publicCost.costs?.get(i)).toBe(fresh.costs?.get(i));expect(publicCost.floors.get(i)).toBe(fresh.floors.get(i));}
});
