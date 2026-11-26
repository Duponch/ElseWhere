import {expect,test} from 'vitest';
import {applyCommand} from '../src/sim/index.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {blockedCells} from '../src/sim/pathfinding.ts';
import {planWork} from '../src/sim/work-planner.ts';
import {medicalCamp} from './scenarios/health.ts';
import type {ItemId} from '../src/sim/items.ts';
import type {Pawn} from '../src/sim/types.ts';

test.each([300,379])('storage planning retains non-food item capacities and exact pair accounting at schema %i',version=>{
  for(const item of ['wood','steel','component','medicine','beer','shell-high-explosive'] as ItemId[]){
    if(version<357&&item==='shell-high-explosive')continue;
    const w=medicalCamp(),p=w.pawns[0]!;w.schemaVersion=version as typeof w.schemaVersion;
    delete p.background;delete p.traits;Object.assign(p,{x:8,z:10});p.priorities.haul=1;
    const kind=ITEM_DEFINITIONS[item].kind;
    addMaterial(w,kind,5,{type:'ground',x:9,z:10},item);const pile=w.piles.at(-1)!;
    expect(applyCommand(w,{type:'stockpile',x:14,z:10,enabled:true,filters:{wood:false,food:false,[kind]:true},capacity:75,priority:5}).ok).toBe(true);
    const before=structuredClone(w.piles),rng=w.rng,budget={remaining:8,pairs:9};
    planWork(w,p,()=>blockedCells(w),new Set(),budget);
    expect(p.haul,item).toMatchObject({sourcePileId:pile.id,quantity:5,phase:'pickup',destination:{type:'stockpile',stockpileId:w.stockpiles[0]!.id}});
    expect(budget.pairs,item).toBe(8);expect(w.piles,item).toEqual(before);expect(w.rng,item).toBe(rng);
  }
});

test('storage decisions reread item filters and destination reservations while retaining distance and priority ties',()=>{
  const w=medicalCamp(2),p=w.pawns[0]!,other=w.pawns[1]!;
  delete p.background;delete p.traits;Object.assign(p,{x:8,z:10});Object.assign(other,{x:25,z:25});p.priorities.haul=1;
  addMaterial(w,'food',5,{type:'ground',x:9,z:10},'rice');const source=w.piles.at(-1)!;
  for(const [x,priority] of [[14,4],[16,5],[18,5]] as const){
    expect(applyCommand(w,{type:'stockpile',x,z:10,enabled:true,filters:{wood:false,food:true},items:{rice:true,berries:false},capacity:5,priority}).ok).toBe(true);
  }
  const plan=():Pawn['haul']=>{p.haul=null;p.path=[];p.state='idle';const budget={remaining:8,pairs:50};planWork(w,p,()=>blockedCells(w),new Set(),budget);return p.haul;};
  expect(plan()?.destination).toMatchObject({type:'stockpile',stockpileId:w.stockpiles[1]!.id});
  w.stockpiles[1]!.items!.rice=false;
  expect(plan()?.destination).toMatchObject({type:'stockpile',stockpileId:w.stockpiles[2]!.id});
  addMaterial(w,'food',5,{type:'pawn',pawnId:other.id},'rice');const cargo=w.piles.at(-1)!;
  other.haul={sourcePileId:source.id,quantity:5,phase:'deliver',carryPileId:cargo.id,destination:{type:'stockpile',stockpileId:w.stockpiles[2]!.id}};
  expect(plan()?.destination).toMatchObject({type:'stockpile',stockpileId:w.stockpiles[0]!.id});
  other.haul=null;w.stockpiles[1]!.items!.rice=true;
  expect(plan()?.destination).toMatchObject({type:'stockpile',stockpileId:w.stockpiles[1]!.id});
  expect(source.quantity).toBe(5);expect(source.owner).toEqual({type:'ground',x:9,z:10});
});
