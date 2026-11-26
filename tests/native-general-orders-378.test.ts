import {expect,test} from 'vitest';
import {applyCommand} from '../src/sim/engine';
import {queryOrderOptions} from '../src/sim/player-orders';
import {addMaterial,reservedSource,reservedSourcesByPile} from '../src/sim/materials';
import {validateWorld} from '../src/sim/serialization';
import {nativeOrderPage,cancelNativeOrderPage,type NativeOrderClient} from '../src/ui3d/native-orders';
import {FLOAT_MENU_PRIORITY,compareFloatMenuOptions} from '../src/ui3d/native-float-menu';
import type {NativePage} from '../src/ui3d/native-contract';
import type {Command,World} from '../src/sim/types';
import {medicalCamp} from './scenarios/health';

function fixture(count=2){
 const world=medicalCamp(count),actor=world.pawns[0]!;
 for(const [i,p] of world.pawns.entries()){p.x=4+i;p.z=5;p.hunger=55;p.rest=100;p.priorities.gather=1;}
 world.resources.push({id:world.nextId++,kind:'tree',x:8,z:5,amount:12});
 expect(applyCommand(world,{type:'designate',kind:'chop',x:8,z:5}).ok).toBe(true);
 const job=world.jobs[0]!;
 addMaterial(world,'food',4,{type:'ground',x:10,z:5},'survival-meal');
 addMaterial(world,'weapon',1,{type:'ground',x:12,z:5},'revolver');
 return {world,actor,job,food:world.piles.find(p=>p.item==='survival-meal')!,weapon:world.piles.find(p=>p.item==='revolver')!};
}
function submit(world:World,command:Command){const result=applyCommand(world,command);if(!result.ok)throw Error(result.reason??'Refus');}
async function menu(world:World,pawnId:number,queue:boolean,x=10){
 cancelNativeOrderPage();const pages:NativePage[]=[],sent:Command[]=[];
 const client:NativeOrderClient={currentWorld:()=>world,orderOptions:async(pawn,x,z,queued)=>queryOrderOptions(world,pawn,{x,z},queued),command:async command=>{submit(world,command);sent.push(command);return undefined;},close:()=>{}};
 await nativeOrderPage(world,[pawnId],{x,z:5},300,200,queue,undefined,client,p=>pages.push(p));
 return {page:pages.at(-1)!,sent};
}

test('native context samples Shift at the actual choice, accepts the real consumption intent without interrupting work, and marks Core priorities',async()=>{
 const {world,actor,job,food}=fixture();
 submit(world,{type:'order-job',pawnId:actor.id,jobId:job.id,queue:false});
 const {page:gearPage}=await menu(world,actor.id,false,12);
 const equip=gearPage.rows.find(r=>r.label.includes('Équiper'))!.controls![0]!;
 const {page,sent}=await menu(world,actor.id,false);
 const eat=page.rows.find(r=>r.label.startsWith('Consommer'))!.controls![0]!;
 expect(eat.floatMenuPriority).toBe(FLOAT_MENU_PRIORITY.Default);
 expect(equip.floatMenuPriority).toBe(FLOAT_MENU_PRIORITY.High);
 expect([eat,equip].sort(compareFloatMenuOptions)).toEqual([equip,eat]);
 await eat.onActivate({shift:true});
 const intent={type:'order-consume',pawnId:actor.id,pileId:food.id,queue:false};
 expect(sent).toEqual([{type:'queue-order-378',order:intent}]);
 expect(actor.jobId).toBe(job.id);expect(actor.orderedQueue378).toEqual([intent]);
 expect(validateWorld(world)).toEqual([]);
});

test('releasing Shift before selecting a direct option replaces the current order, rather than using the menu opening modifier',async()=>{
 const {world,actor,job,weapon}=fixture();
 submit(world,{type:'order-job',pawnId:actor.id,jobId:job.id,queue:false});
 const {page,sent}=await menu(world,actor.id,true,12);
 const equip=page.rows.find(r=>r.label.includes('Équiper'))!.controls![0]!;
 await equip.onActivate({shift:false});
 expect(sent).toEqual([{type:'order-equipment',action:'equip',pawnId:actor.id,itemId:weapon.id,queue:false}]);
 expect(actor.orderedQueue378).toBeUndefined();expect(actor.equipmentTask?.itemId).toBe(weapon.id);expect(actor.jobId).toBeNull();
 expect(validateWorld(world)).toEqual([]);
});

test('a future exclusive pile claim leaves the already committed serving available to its actual owner, and releases on cancel',()=>{
 const {world,actor,job,food}=fixture(),eater=world.pawns[1]!;
 submit(world,{type:'order-consume',pawnId:eater.id,pileId:food.id,queue:false});
 expect(eater.need?.kind).toBe('eat');const actual=eater.need?.kind==='eat'?eater.need.quantity??1:0;
 expect(actual).toBeGreaterThan(0);expect(actual).toBeLessThan(food.quantity);
 submit(world,{type:'order-job',pawnId:actor.id,jobId:job.id,queue:false});
 submit(world,{type:'queue-order-378',order:{type:'order-consume',pawnId:actor.id,pileId:food.id,queue:false}});
 expect(reservedSource(world,food.id)).toBe(food.quantity);
 expect(reservedSource(world,food.id,eater.id)).toBe(food.quantity-actual);
 expect(reservedSourcesByPile(world,eater.id).get(food.id)).toBe(food.quantity-actual);
 expect(validateWorld(world)).toEqual([]);
 submit(world,{type:'clear-orders',pawnId:actor.id});
 expect(reservedSource(world,food.id)).toBe(actual);expect(actor.orderedQueue378).toBeUndefined();
 expect(validateWorld(world)).toEqual([]);
});
