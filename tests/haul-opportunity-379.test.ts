import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {addMaterial,refreshStock,reservedSource} from '../src/sim/materials';
import {reconcileHaulOpportunities379} from '../src/sim/haul-opportunity-379';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization';
import {FUEL_UNIT_TICKS,newBuildingFuel} from '../src/sim/fuel';
import {medicalCamp} from './scenarios/health';
import {fixtureBuilding} from './scenarios/deconstruction';
import type {Command,World,Structure} from '../src/sim/types';

const ok=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
function until(w:World,predicate:()=>boolean,max=350){for(let i=0;i<max&&!predicate();i++)stepWorld(w);expect(predicate()).toBe(true);}
function camp(second=30,x=9,item:'wood'|'duck-egg-unfertilized'='wood',count=1){
 const w=medicalCamp(count),p=w.pawns[0]!;delete p.background;delete p.traits;p.priorities.haul=1;Object.assign(p,{x:4,z:5});
 const kind=item==='wood'?'wood':'food';
 addMaterial(w,kind,20,{type:'ground',x:6,z:5},item);const first=w.piles.at(-1)!;
 addMaterial(w,kind,second,{type:'ground',x,z:5},item);const extra=w.piles.at(-1)!;
 ok(w,{type:'stockpile',x:20,z:5,enabled:true,filters:{wood:true,food:true}});
 ok(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:first.id},queue:false});return {w,p,first,extra};
}

test('nearby partial stacks join the same real cargo only after contact, with exact pickup and destination claims and replay',()=>{
 const {w,p,first,extra}=camp();until(w,()=>!!p.haul?.haulOpportunity379);
 const held=w.piles.find(i=>i.id===p.haul!.carryPileId)!;
 expect(w.piles.includes(first)).toBe(false);expect(held.quantity).toBe(20);expect(extra.quantity).toBe(30);
 expect(p.haul).toMatchObject({phase:'pickup',sourcePileId:extra.id,quantity:50,haulOpportunity379:{quantity:30}});
 expect(reservedSource(w,extra.id)).toBe(30);expect(validateWorld(w)).toEqual([]);
 const copy=deserializeWorld(serializeWorld(w)),id=held.id;until(w,()=>p.haul?.phase==='deliver');stepWorld(copy,w.tick-copy.tick);
 expect(copy).toEqual(w);expect(p.haul!.carryPileId).toBe(id);expect(held.quantity).toBe(50);expect(w.piles.includes(extra)).toBe(false);
 expect(validateWorld(w)).toEqual([]);until(w,()=>!p.haul);
 expect(w.piles.find(i=>i.item==='wood'&&i.owner.type==='ground'&&i.owner.x===20)?.quantity).toBe(50);expect(validateWorld(w)).toEqual([]);
});

test.each([[75,9],[30,15]])('full stacks and stacks outside the eight-cell source radius remain untouched (%i at x=%i)',(quantity,x)=>{
 const {w,p,extra}=camp(quantity,x);until(w,()=>p.haul?.phase==='deliver');expect(p.haul?.haulOpportunity379).toBeUndefined();
 expect(p.haul?.quantity).toBe(20);expect(extra.quantity).toBe(quantity);expect(reservedSource(w,extra.id)).toBe(0);
});

test('forbidding an extra pickup retains the already held stack and delivers it without crediting the cancelled source',()=>{
 const {w,p,extra}=camp();until(w,()=>!!p.haul?.haulOpportunity379);const id=p.haul!.carryPileId;
 ok(w,{type:'material-forbid',pileId:extra.id,forbidden:true});expect(p.haul).toMatchObject({phase:'deliver',quantity:20,carryPileId:id});
 expect(p.haul?.haulOpportunity379).toBeUndefined();expect(reservedSource(w,extra.id)).toBe(0);expect(extra.quantity).toBe(30);
 expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);until(w,()=>!p.haul);
 expect(w.piles.find(i=>i.owner.type==='ground'&&i.owner.x===20)?.quantity).toBe(20);expect(extra.quantity).toBe(30);
});

test('loss of the extra source retires its claim while retaining the held delivery',()=>{
 const {w,p,extra}=camp();until(w,()=>!!p.haul?.haulOpportunity379);const id=p.haul!.carryPileId;
 w.piles.splice(w.piles.indexOf(extra),1);refreshStock(w);reconcileHaulOpportunities379(w);
 expect(p.haul).toMatchObject({phase:'deliver',quantity:20,carryPileId:id});expect(p.haul?.haulOpportunity379).toBeUndefined();expect(validateWorld(w)).toEqual([]);
});

test('a paused egg-forbid command cancels only the duplicate pickup and leaves the real eggs held',()=>{
 const {w,p,extra}=camp(30,9,'duck-egg-unfertilized');until(w,()=>!!p.haul?.haulOpportunity379);const id=p.haul!.carryPileId;
 ok(w,{type:'egg-forbid',pileId:extra.id,forbidden:true});expect(p.haul).toMatchObject({phase:'deliver',quantity:20,carryPileId:id});
 expect(p.haul?.haulOpportunity379).toBeUndefined();expect(extra.eggForbidden).toBe(true);expect(extra.quantity).toBe(30);
 expect(reservedSource(w,extra.id)).toBe(0);expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('an existing refuel claim keeps its exact share when another worker gathers a duplicate stack',()=>{
 const {w,p,extra}=camp(30,9,'wood',2),other=w.pawns[1]!;delete other.background;delete other.traits;other.priorities.haul=1;Object.assign(other,{x:25,z:25});
 const s:Structure=fixtureBuilding(w,'campfire',21,25);s.material='wood';s.bills=[];s.fuel={...newBuildingFuel('campfire'),ticks:10*FUEL_UNIT_TICKS,autoRefuel:false};
 ok(w,{type:'order-haul',pawnId:other.id,target:{type:'fuel',structureId:s.id},queue:false});expect(other.haul).toMatchObject({sourcePileId:extra.id,quantity:10});
 until(w,()=>!!p.haul?.haulOpportunity379);expect(p.haul).toMatchObject({quantity:40,haulOpportunity379:{quantity:20}});
 expect(reservedSource(w,extra.id)).toBe(30);expect(reservedSource(w,extra.id,p.id)).toBe(10);expect(validateWorld(w)).toEqual([]);
});

test('fuel duplicate pickup collects only the real missing fuel quota and refuels after physical delivery',()=>{
 const w=medicalCamp(1),p=w.pawns[0]!;delete p.background;delete p.traits;p.priorities.haul=1;Object.assign(p,{x:12,z:16});
 const s:Structure=fixtureBuilding(w,'campfire',21,16);s.material='wood';s.bills=[];s.fuel={...newBuildingFuel('campfire'),ticks:0,autoRefuel:false};
 addMaterial(w,'wood',10,{type:'ground',x:14,z:16});addMaterial(w,'wood',15,{type:'ground',x:17,z:18});const extra=w.piles.at(-1)!;
 ok(w,{type:'order-haul',pawnId:p.id,target:{type:'fuel',structureId:s.id},queue:false});until(w,()=>!!p.haul?.haulOpportunity379);
 expect(p.haul).toMatchObject({quantity:20,haulOpportunity379:{quantity:10}});expect(s.fuel.ticks).toBe(0);expect(reservedSource(w,extra.id)).toBe(10);expect(validateWorld(w)).toEqual([]);
 until(w,()=>p.haul?.phase==='deliver');expect(extra.quantity).toBe(5);expect(s.fuel.ticks).toBe(0);until(w,()=>!p.haul);
 expect(s.fuel.ticks+s.fuel.burned).toBe(20*FUEL_UNIT_TICKS);expect(validateWorld(w)).toEqual([]);
});
