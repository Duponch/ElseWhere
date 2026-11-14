import {expect,test} from 'vitest';
import {stepWorld} from '../src/sim/index.ts';
import {advanceVisitors,enableVisitors} from '../src/sim/visitors.ts';
import type {HomeVisitorCalendar} from '../src/sim/visitor-state.ts';
import {generateNovelBook295} from '../src/sim/book-state-295.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import type {World} from '../src/sim/types.ts';

const calendar=(w:World)=>w.visitors as HomeVisitorCalendar;
function clock(w:World,tick:number):void {
  w.tick=tick;
  if(w.corePathBudget297)w.corePathBudget297.tick=tick;
  if(w.deterioration)w.deterioration.lastTick=tick;
}

/** Visitors buy novels since schema 327. A trader who leaves with one keeps it
 * in the frozen departure record, which the save must accept (it refused the
 * `book` key of a novel stack). */
test('a trader who leaves with a novel keeps a valid save',()=>{
  const w=deconstructionCamp(2,48);enableVisitors(w);
  let group=calendar(w).groups.find(g=>g.caravan332);
  for(let k=0;k<20&&!group;k++){clock(w,calendar(w).caravan332!.pending[0]!);advanceVisitors(w);group=calendar(w).groups.find(g=>g.caravan332);}
  expect(group).toBeDefined();
  const trader=w.pawns.find(p=>p.visitor?.group===group!.id&&p.visitor.role==='trader')!;
  // The stack the trader bought: a novel in its inventory.
  w.piles.push({id:w.nextId,kind:'book',item:'novel',quantity:1,owner:{type:'inventory',pawnId:trader.id},book:generateNovelBook295(w.nextId,()=>.5)});w.nextId++;
  expect(validateWorld(w)).toEqual([]);
  const id=group!.id;
  for(let i=0;i<20000&&calendar(w).groups.some(g=>g.id===id);i++)stepWorld(w);
  expect(calendar(w).groups.some(g=>g.id===id)).toBe(false);
  expect(calendar(w).departed.some(d=>d.items.some(p=>p.item==='novel'))).toBe(true);
  expect(validateWorld(w)).toEqual([]);
  const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);
},600_000);
