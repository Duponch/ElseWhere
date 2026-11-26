import {expect,test} from 'vitest';
import {carryStackLimit379,carryingCapacity379,itemVolume379,validateCarryQuantities379} from '../src/sim/carry-quantity-379';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {addMaterial} from '../src/sim/materials';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization';
import {planHaulOrder} from '../src/sim/player-hauling';
import {planServiceHaul} from '../src/sim/player-service-hauling';
import {newBuildingFuel} from '../src/sim/fuel';
import {newPowerState} from '../src/sim/power-rules';
import {medicalCamp,controlledInjury} from './scenarios/health';
import {fixtureBuilding} from './scenarios/deconstruction';
import {huntingCamp} from './scenarios/hunting';
import type {ItemId} from '../src/sim/items';
import type {World,Command,Structure} from '../src/sim/types';

const ok=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
function camp(item:ItemId='wood',quantity=75){
 const w=medicalCamp(1),p=w.pawns[0]!;delete p.background;delete p.traits;p.priorities.haul=1;Object.assign(p,{x:4,z:5});
 addMaterial(w,item==='silver'||item==='gold'?item:'wood',quantity,{type:'ground',x:6,z:5},item);
 ok(w,{type:'stockpile',x:12,z:5,enabled:true,filters:{wood:true,food:false,silver:true,gold:true}});
 return {w,p,source:w.piles.find(i=>i.item===item)!};
}
function until(w:World,predicate:()=>boolean,max=300){for(let i=0;i<max&&!predicate();i++)stepWorld(w);expect(predicate()).toBe(true);}

test('Core local capacity uses body/manipulation and item volume, independent of mass or caravan limits',()=>{
 const {w,p}=camp();
 expect(carryingCapacity379(p)).toBe(75);expect(carryStackLimit379(w,p,'wood')).toBe(75);expect(carryStackLimit379(w,p,'steel')).toBe(75);
 expect(itemVolume379('silver')).toBe(Math.fround(.1));expect(carryStackLimit379(w,p,'silver')).toBe(500);expect(carryStackLimit379(w,p,'gold')).toBe(500);
 expect(carryStackLimit379(w,p,'herbal-medicine')).toBe(25);expect(carryStackLimit379(w,p,'component')).toBe(50);expect(carryStackLimit379(w,p,'revolver')).toBe(1);
 expect(carryStackLimit379({schemaVersion:378},p,'wood')).toBe(10);expect(carryStackLimit379({schemaVersion:378},p,'silver')).toBe(10);
 const a=huntingCamp().wildlife!.animals[0]!;expect(carryStackLimit379(w,a,'wood')).toBeGreaterThan(0);expect(carryStackLimit379(w,a,'wood')).toBeLessThanOrEqual(75);
 controlledInjury(w,p,'left-hand',10000,'bruise');expect(carryStackLimit379(w,p,'wood')).toBeLessThan(75);
});

test.each([['wood',75],['silver',500],['gold',500]] as const)('manual %s hauling carries its Core whole stack in one physical trip and replays exactly', (item,quantity)=>{
 const {w,p,source}=camp(item,quantity);
 expect(planHaulOrder(w,p,{type:'pile',pileId:source.id}).task?.quantity).toBe(quantity);
 ok(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:source.id},queue:false});expect(p.haul?.quantity).toBe(quantity);
 expect(validateWorld(w)).toEqual([]);const copy=deserializeWorld(serializeWorld(w));
 until(w,()=>p.haul?.phase==='deliver');stepWorld(copy,w.tick-copy.tick);
 expect(w.piles.find(i=>i.id===p.haul?.carryPileId)?.quantity).toBe(quantity);expect(copy).toEqual(w);expect(validateWorld(w)).toEqual([]);
 until(w,()=>!p.haul);expect(w.piles.find(i=>i.item===item&&i.owner.type==='ground'&&i.owner.x===12)?.quantity).toBe(quantity);
 expect(validateWorld(w)).toEqual([]);
});

test('pickup clamps a changed carrying capacity while an already held stack survives injury and reload',()=>{
 const first=camp(),{w,p,source}=first;
 ok(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:source.id},queue:false});
 controlledInjury(w,p,'left-hand',10000,'bruise');const limit=carryStackLimit379(w,p,'wood');expect(limit).toBeLessThan(75);
 expect(validateWorld(w)).toEqual([]);until(w,()=>p.haul?.phase==='deliver');expect(p.haul?.quantity).toBe(limit);
 expect(w.piles.find(i=>i.id===source.id)?.quantity).toBe(75-limit);
 const second=camp();ok(second.w,{type:'order-haul',pawnId:second.p.id,target:{type:'pile',pileId:second.source.id},queue:false});until(second.w,()=>second.p.haul?.phase==='deliver');
 controlledInjury(second.w,second.p,'left-hand',10000,'bruise');expect(second.p.haul?.quantity).toBe(75);
 expect(validateWorld(second.w)).toEqual([]);expect(deserializeWorld(serializeWorld(second.w))).toEqual(second.w);
 const bad=structuredClone(second.w);bad.pawns[0]!.haul!.quantity=76;expect(validateCarryQuantities379(bad,379)).not.toEqual([]);
});

test.each([['campfire',20],['wood-generator',75],['chemfuel-generator',30]] as const)('%s refill uses actor capacity while retaining its real %i fuel quota', (kind,quantity)=>{
 const w=medicalCamp(1),p=w.pawns[0]!;delete p.background;delete p.traits;p.priorities.haul=1;
 const s:Structure=fixtureBuilding(w,kind,18,16);s.material=kind==='campfire'?'wood':'steel';s.fuel={...newBuildingFuel(kind),ticks:0,autoRefuel:false};
 if(kind==='campfire')s.bills=[];else s.power={...newPowerState(kind),on:false};
 const item=kind==='chemfuel-generator'?'chemfuel':'wood';addMaterial(w,item,75,{type:'ground',x:p.x+1,z:p.z},item);
 expect(planServiceHaul(w,p,{type:'fuel',structureId:s.id}).task?.quantity).toBe(quantity);
});
