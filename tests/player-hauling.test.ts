import { SCHEMA_VERSION } from '../src/sim/types';
import {asOldSchema} from './scenarios/old-schema';
import { withoutPawnSkills, withMigratedSkills } from './scenarios/legacy-skills';
import {validateCampaignSchema378} from '../src/sim/serialization';
import { expect, test } from 'vitest';
import { addGroundMaterial, applyCommand, createWorld, deserializeWorld, refreshStock, serializeWorld, stepWorld, validateWorld } from '../src/sim/index';
import { reservedDestination, reservedSource } from '../src/sim/materials';
import { queryOrderOptions } from '../src/sim/player-orders';
import { rotAge, ROT_DAYS } from '../src/sim/food-preservation';
import { TICKS_PER_DAY, type World } from '../src/sim/types';

function camp():World {
  const w=createWorld(42,32,32);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];w.pawns=w.pawns.slice(0,2);
  w.pawns.forEach((p,i)=>{p.x=8;p.z=10+i;p.hunger=100;p.rest=100;p.schedule.fill('anything');p.priorities={handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2,haul:1,build:0,grow:0,gather:0,cook:0};});refreshStock(w);return w;
}
function storage(w:World,x:number,capacity=15,food=false,priority=3) {
  expect(applyCommand(w,{type:'stockpile',x,z:8,enabled:true,capacity,priority,filters:{wood:!food,food}}).ok).toBe(true);return w.stockpiles.at(-1)!;
}
function tick(w:World,n=1) {for(let i=0;i<n;i++){stepWorld(w);const errors=validateWorld(w);expect(errors,`tick ${w.tick}${errors.length?JSON.stringify(w.pawns.map(p=>({id:p.id,jobId:p.jobId,state:p.state,frameToil301:p.frameToil301,postureUntilCore301:p.postureUntilCore301,haul:p.haul,orders:p.orders,motion:p.motion,path:p.path,moveCooldown:p.moveCooldown}))):''}`).toEqual([]);}}
function rejected(w:World,command:Parameters<typeof applyCommand>[1]) {const before=JSON.stringify(w);expect(applyCommand(w,command).ok).toBe(false);expect(JSON.stringify(w)).toBe(before);}

test('forced stock hauling reserves active and queued quantities/capacity against other workers, preserves priority and exact continuation',()=>{
  const w=camp(),[p,q]=w.pawns;const high=storage(w,16),low=storage(w,20,15,false,2),third=storage(w,24,15,false,1);
  expect(applyCommand(w,{type:'stockpile',x:high.x,z:high.z,enabled:true,capacity:15,priority:3,filters:{wood:true,food:true}}).ok).toBe(true);
  addGroundMaterial(w,'wood',45,{x:8,z:8},'wood');const source=w.piles[0]!,target={type:'pile' as const,pileId:source.id};
  const before=JSON.stringify(w);expect(queryOrderOptions(w,p!.id,{x:8,z:8})[0]).toMatchObject({enabled:true,haulTarget:target});expect(JSON.stringify(w)).toBe(before);
  expect(applyCommand(w,{type:'order-haul',pawnId:p!.id,target,queue:false}).ok).toBe(true);
  expect(applyCommand(w,{type:'order-haul',pawnId:p!.id,target,queue:true}).ok).toBe(true);
  expect(p!.haul?.quantity).toBe(15);expect(p!.orders.queue[0]).toMatchObject({quantity:15,destination:{stockpileId:low.id}});
  expect(applyCommand(w,{type:'order-haul',pawnId:q!.id,target,queue:false}).ok).toBe(true);expect(q!.haul?.destination).toEqual({type:'stockpile',stockpileId:third.id});expect(q!.haul?.quantity).toBe(15);
  expect(reservedSource(w,source.id)).toBe(45);expect(reservedDestination(w,{type:'stockpile',stockpileId:high.id})).toBe(15);expect(reservedDestination(w,{type:'stockpile',stockpileId:low.id})).toBe(15);expect(reservedDestination(w,{type:'stockpile',stockpileId:third.id})).toBe(15);
  // The empty destination already has a promised wood stack. Enabling food does
  // not permit a queued rice stack to occupy that same cell before wood arrives.
  addGroundMaterial(w,'food',10,{x:10,z:8},'rice');const rice=w.piles.find(p=>p.item==='rice')!;
  rejected(w,{type:'order-haul',pawnId:q!.id,target:{type:'pile',pileId:rice.id},queue:true});
  for(const pawn of w.pawns)expect(applyCommand(w,{type:'priority',pawnId:pawn.id,work:'haul',value:0}).ok).toBe(true);
  rejected(w,{type:'order-haul',pawnId:p!.id,target,queue:true});
  while(!w.pawns.some(p=>p.haul?.phase==='deliver'))tick(w);
  const resumed=deserializeWorld(serializeWorld(w));tick(w,160);tick(resumed,160);expect(resumed).toEqual(w);
  expect(w.pawns.every(p=>p.orders.active===null&&!p.orders.queue.length&&!p.haul)).toBe(true);
  expect(w.piles.find(p=>p.owner.type==='ground'&&p.owner.x===16)?.quantity).toBe(15);
  expect(w.piles.find(p=>p.owner.type==='ground'&&p.owner.x===20)?.quantity).toBe(15);expect(w.piles.find(p=>p.owner.type==='ground'&&p.owner.x===24)?.quantity).toBe(15);
  expect(w.piles.find(p=>p.id===source.id)).toBeUndefined();expect(w.stock.wood).toBe(45);
  applyCommand(w,{type:'priority',pawnId:p!.id,work:'haul',value:1});
  const stored=w.piles.find(p=>p.owner.type==='ground'&&p.owner.x===16)!;
  rejected(w,{type:'order-haul',pawnId:p!.id,target:{type:'pile',pileId:stored.id},queue:false});
});

test('schema378 keeps the historical ten-unit active and five-unit queued claims on one fifteen-unit destination',()=>{
  const w=JSON.parse(asOldSchema(serializeWorld(camp()),378)) as World,[p,q]=w.pawns,high=storage(w,16),low=storage(w,20,15,false,1);
  addGroundMaterial(w,'wood',30,{x:8,z:8},'wood');const source=w.piles[0]!,target={type:'pile' as const,pileId:source.id};
  expect(applyCommand(w,{type:'order-haul',pawnId:p!.id,target,queue:false}).ok).toBe(true);expect(applyCommand(w,{type:'order-haul',pawnId:p!.id,target,queue:true}).ok).toBe(true);
  expect(p!.haul).toMatchObject({quantity:10,destination:{stockpileId:high.id}});expect(p!.orders.queue[0]).toMatchObject({quantity:5,destination:{stockpileId:high.id}});
  expect(applyCommand(w,{type:'order-haul',pawnId:q!.id,target,queue:false}).ok).toBe(true);expect(q!.haul).toMatchObject({quantity:10,destination:{stockpileId:low.id}});
  expect(reservedSource(w,source.id)).toBe(25);expect(reservedDestination(w,{type:'stockpile',stockpileId:high.id})).toBe(15);expect(source.quantity).toBe(30);expect(validateCampaignSchema378(w)).toEqual([]);
});

test('forced construction deliveries are physical subjobs, builders need no hauling assignment, cancellation keeps delivered and carried materials',()=>{
  const w=camp(),p=w.pawns[0]!;w.pawns=w.pawns.slice(0,1);p.priorities={handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2,haul:0,build:1,grow:0,gather:0,cook:0};
  for(const x of [16,18])expect(applyCommand(w,{type:'designate',kind:'wall',x,z:8}).ok).toBe(true);
  addGroundMaterial(w,'wood',12,{x:8,z:8},'wood');const [a,b]=w.jobs;
  expect(queryOrderOptions(w,p.id,a!).find(o=>o.haulTarget)?.enabled).toBe(true);
  expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'job',jobId:a!.id},queue:false}).ok).toBe(true);
  rejected(w,{type:'order-haul',pawnId:p.id,target:{type:'job',jobId:b!.id},queue:true});
  expect(reservedSource(w,w.piles[0]!.id)).toBe(10);
  applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:0});tick(w,160);
  expect(w.structures).toEqual([]);expect(w.jobs.map(j=>[j.construction,j.escrow.wood])).toEqual([['frame',5],['frame',5]]);expect(w.stock.wood).toBe(2);
  const canceled=deserializeWorld(serializeWorld(w));expect(applyCommand(canceled,{type:'cancel',x:a!.x,z:a!.z}).ok).toBe(true);expect(canceled.stock.wood).toBe(7);expect(validateWorld(canceled)).toEqual([]);
  applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:1});expect(applyCommand(w,{type:'order-job',pawnId:p.id,jobId:a!.id,queue:false}).ok).toBe(true);
  applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:0});tick(w,150);expect(w.structures.map(s=>s.kind)).toEqual(['wall']);expect(w.stock.wood).toBe(2);expect(validateWorld(w)).toEqual([]);
  applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:1});expect(applyCommand(w,{type:'order-job',pawnId:p.id,jobId:b!.id,queue:false}).ok).toBe(true);applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:0});tick(w,150);expect(w.structures.map(s=>s.kind)).toEqual(['wall','wall']);expect(w.stock.wood).toBe(2);

  const c=camp(),actor=c.pawns[0]!;c.pawns=c.pawns.slice(0,1);const zone=storage(c,24,20,true);
  addGroundMaterial(c,'food',20,{x:8,z:8},'rice');const rice=c.piles[0]!;rice.rot={progress:150,atTick:0};
  applyCommand(c,{type:'order-haul',pawnId:actor.id,target:{type:'pile',pileId:rice.id},queue:false});applyCommand(c,{type:'order-haul',pawnId:actor.id,target:{type:'pile',pileId:rice.id},queue:true});
  while(actor.haul?.phase!=='deliver')tick(c);
  const held=c.piles.find(x=>x.owner.type==='pawn')!,id=held.id,age=rotAge(held,c.tick);
  expect(applyCommand(c,{type:'stockpile',x:zone.x,z:zone.z,enabled:false}).ok).toBe(true);
  expect(actor.orders).toEqual({active:null,queue:[]});expect(c.piles.find(x=>x.id===id)?.owner).toMatchObject({type:'ground'});expect(rotAge(c.piles.find(x=>x.id===id)!,c.tick)).toBe(age);expect(c.stock.food).toBe(20);expect(validateWorld(c)).toEqual([]);
});

test('waiting hauling survives migration/replay, releases vanished sources, rejects corrupt quantities and legacy extensions atomically',()=>{
  const w=camp(),p=w.pawns[0]!;w.pawns=w.pawns.slice(0,1);storage(w,16,20,true);storage(w,28,10,true,2);
  addGroundMaterial(w,'food',30,{x:8,z:8},'rice');const rice=w.piles[0]!;
  applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:rice.id},queue:false});applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:rice.id},queue:true});
  const raw=JSON.parse(serializeWorld(w));
  for(const mutate of [(s:any)=>s.pawns[0].orders.queue[0].quantity=11,(s:any)=>s.pawns[0].orders.queue[0].phase='deliver',(s:any)=>s.pawns[0].orders.queue[0].destination.stockpileId=999999,(s:any)=>s.pawns[0].orders.queue=[null],(s:any)=>s.schemaVersion=17]) {
    const invalid=structuredClone(raw);mutate(invalid);expect(()=>deserializeWorld(JSON.stringify(invalid))).toThrow();expect(w).toEqual(raw);
  }
  rice.rot={progress:ROT_DAYS.rice*TICKS_PER_DAY-1,atTick:w.tick};tick(w);expect(w.spoiled.rice).toBe(30);expect(p.orders).toEqual({active:null,queue:[]});expect(w.stock.food).toBe(0);
  const old=JSON.parse(serializeWorld(camp()));(old.schemaVersion=17,withoutPawnSkills(old));for(const a of old.pawns){delete a.priorities.mine;delete a.priorities.craft;}delete old.deconstructed;delete old.packed;const migrated=deserializeWorld(JSON.stringify(old));expect(migrated).toEqual(withMigratedSkills({...old,pawns:old.pawns.map((p:any)=>({...p,priorities: {handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,craft:2,...p.priorities,mine:2}})),schemaVersion:SCHEMA_VERSION,packed:[],deconstructed:{count:0,lostWood:0,fuelTicks:0}}));

  const blocked=camp(),actor=blocked.pawns[0]!;blocked.pawns=blocked.pawns.slice(0,1);storage(blocked,20,30);addGroundMaterial(blocked,'wood',20,{x:8,z:8},'wood');const wood=blocked.piles[0]!;
  applyCommand(blocked,{type:'order-haul',pawnId:actor.id,target:{type:'pile',pileId:wood.id},queue:false});applyCommand(blocked,{type:'order-haul',pawnId:actor.id,target:{type:'pile',pileId:wood.id},queue:true});
  // Clearing orders releases both reservations, including during a physical move.
  tick(blocked,2);expect(applyCommand(blocked,{type:'clear-orders',pawnId:actor.id}).ok).toBe(true);expect(reservedSource(blocked,wood.id)).toBe(0);expect(validateWorld(blocked)).toEqual([]);

  // A once reachable queued source becomes enclosed while the first trip runs.
  addGroundMaterial(blocked,'wood',10,{x:25,z:20},'wood');const distant=blocked.piles.at(-1)!;
  expect(applyCommand(blocked,{type:'order-haul',pawnId:actor.id,target:{type:'pile',pileId:wood.id},queue:false}).ok).toBe(true);
  expect(applyCommand(blocked,{type:'order-haul',pawnId:actor.id,target:{type:'pile',pileId:distant.id},queue:true}).ok).toBe(true);
  applyCommand(blocked,{type:'priority',pawnId:actor.id,work:'haul',value:0});
  for(const [x,z] of [[25,19],[25,21],[24,20],[26,20]])blocked.tiles[z!*blocked.width+x!]={terrain:'water'};
  tick(blocked,160);expect(actor.orders).toEqual({active:null,queue:[]});expect(blocked.events.some(e=>e.message.includes('Accès perdu'))).toBe(true);expect(distant.quantity).toBe(10);expect(reservedSource(blocked,distant.id)).toBe(0);
});
