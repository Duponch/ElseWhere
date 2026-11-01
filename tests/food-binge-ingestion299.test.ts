import {expect,test} from 'vitest';
import {localIngestionCore299,groupIngestionCore299,commitHumanIngestion299,foodBingeDue299,selfFoodPermission299} from '../src/sim/human-ingestion-clock299.ts';
import {processEating} from '../src/sim/eating.ts';
import {processNeeds} from '../src/sim/needs.ts';
import {finishMentalBreak} from '../src/sim/mental-state.ts';
import {reachableCells,blockedCells} from '../src/sim/pathfinding.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {selfFoodAccessible} from '../src/sim/prison-food.ts';
import {medicalCamp} from './scenarios/health.ts';
import type {World,Pawn,MaterialPile} from '../src/sim/types.ts';
import type {NeedContext} from '../src/sim/needs.ts';

// Configured component inputs, not fabricated valid campaign saves. Persistence
// and full schema299 ownership are qualified separately by the schema contracts.
function setup(){const w=medicalCamp();(w as unknown as {schemaVersion:number}).schemaVersion=299;w.phaseCore297=0;const p=w.pawns[0]!;p.hunger=100;p.rest=100;delete p.health;
 p.mental={below:[0,0,0],cooldown:0,catharsis:[],crisis:{kind:'food-binge',age:0,target:null,waitUntil:w.tick}};
 return {w,p};}
function context(){const calls={released:0,moved:0,searched:0,events:[] as string[]};const c:NeedContext={search:()=>{calls.searched++;return null;},move:()=>{calls.moved++;},release:()=>{calls.released++;return true;},event:m=>calls.events.push(m)};return {c,calls};}
function chewing(w:World,p:Pawn){const id=w.nextId++;const food:MaterialPile={id,kind:'food',item:'simple-meal',quantity:1,owner:{type:'pawn',pawnId:p.id}};w.piles.push(food);
 p.state='eating';p.path=[];p.need={kind:'eat',phase:'ingest',sourcePileId:id,carryPileId:id,quantity:1,progress:49,dining:{target:{x:p.x,z:p.z},seatId:null,tableId:null}};return food;}

test('unknown stays absent; exact same-owner Core and strict greater-than1100 gate persist between reads',()=>{
 const {w,p}=setup(),before=JSON.stringify(p);expect(foodBingeDue299(w,p)).toBe(true);expect(JSON.stringify(p)).toBe(before);
 const at=localIngestionCore299(w,p)!;commitHumanIngestion299(p,at);expect(p.lastIngestAtCore299).toBe(w.tick*10);
 w.tick+=110;expect(foodBingeDue299(w,p)).toBe(false);w.phaseCore297=1;expect(foodBingeDue299(w,p)).toBe(true);
 expect(()=>localIngestionCore299(w,{...p})).toThrow('actual local person');
 w.tick-=111;expect(()=>foodBingeDue299(w,p)).toThrow('frontier');
});

test('real processEating completes current chewing despite recent stamp and stamps only the consumed portion',()=>{
 const {w,p}=setup(),food=chewing(w,p),{c,calls}=context(),at=w.tick*10;p.lastIngestAtCore299=at-100;
 expect(foodBingeDue299(w,p)).toBe(false);const priorFood=w.piles.reduce((n,q)=>n+(q.kind==='food'?q.quantity:0),0);
 processEating(w,p,c);expect(p.lastIngestAtCore299).toBe(at);expect(w.piles.includes(food)).toBe(false);expect(p.need).toBeNull();
 expect(w.piles.reduce((n,q)=>n+(q.kind==='food'?q.quantity:0),0)).toBe(priorFood-1);expect(calls.events.filter(x=>x.includes('a mangé une portion'))).toHaveLength(1);
});

test('invalid/missing held source never records a consumption',()=>{
 const {w,p}=setup(),food=chewing(w,p),{c,calls}=context();w.piles.splice(w.piles.indexOf(food),1);
 processEating(w,p,c);expect(p.lastIngestAtCore299).toBeUndefined();expect(calls.released).toBe(1);expect(calls.events).toEqual([]);
});

test('resolved permission changes only forbid and retains actual ground ownership independently of crisis',()=>{
 const {w,p}=setup();const food:MaterialPile={id:w.nextId++,kind:'food',item:'simple-meal',quantity:1,forbidden:true,owner:{type:'ground',x:p.x,z:p.z}};
 expect(selfFoodPermission299(food)).toBe(false);expect(selfFoodPermission299(food,true)).toBe(true);expect(selfFoodAccessible(w,p,food,undefined,true)).toBe(true);
 delete p.mental!.crisis;expect(selfFoodAccessible(w,p,food,undefined,true)).toBe(true);expect(selfFoodAccessible(w,p,food)).toBe(false);
 food.owner={type:'inventory',pawnId:p.id};expect(selfFoodAccessible(w,p,food,undefined,true)).toBe(false);
});

test('group frontier is explicit fine endpoint, not its ceil civil envelope or a selected Map',()=>{
 const {p}=setup();delete p.lastIngestAtCore299;const group={members:[p],lastPersonalTick:101};
 const at=groupIngestionCore299(group,p,299,101,1001);expect(at).toBe(1001);commitHumanIngestion299(p,at);expect(p.lastIngestAtCore299).toBe(1001);
 expect(()=>groupIngestionCore299(group,p,299,101,undefined)).toThrow('actual group frontier');
 expect(()=>groupIngestionCore299(group,{...p},299,101,1002)).toThrow('actual group frontier');
 expect(()=>groupIngestionCore299(group,p,299,102,1011)).toThrow('actual group frontier');
 expect(()=>groupIngestionCore299(group,p,299,101,1000)).toThrow('actual group frontier');
});

test('historical ingestion helpers do not add prospective date fields',()=>{
 const {w,p}=setup();(w as {schemaVersion:number}).schemaVersion=298;expect(localIngestionCore299(w,p)).toBeUndefined();commitHumanIngestion299(p,undefined);
 expect(Object.hasOwn(p,'lastIngestAtCore299')).toBe(false);expect(groupIngestionCore299({members:[p],lastPersonalTick:2},p,298,2,undefined)).toBeUndefined();
});

function planContext(w:World,p:Pawn,pending=false){const calls={searched:0,released:0,moved:0};const c:NeedContext={
 search:goals=>{calls.searched++;return pending?null:reachableCells(w,p,blockedCells(w),new Set(),goals);},
 move:()=>{calls.moved++;},release:()=>{calls.released++;return releaseWork(w,p);},event:()=>{},
};return {c,calls};}
function groundFood(w:World,p:Pawn,item:'rice'|'simple-meal',forbidden=false,dx=2){const pile:MaterialPile={id:w.nextId++,kind:'food',item,quantity:10,owner:{type:'ground',x:p.x+dx,z:p.z},...(forbidden?{forbidden:true as const}:{})};w.piles.push(pile);return pile;}

test.each([29.9,30])('ordinary provider uses strict30 threshold while the compulsive interval is pending: hunger%s',hunger=>{
 const {w,p}=setup();p.need=null;p.hunger=hunger;p.lastIngestAtCore299=w.tick*10;const source=groundFood(w,p,'simple-meal'),{c,calls}=planContext(w,p);
 processNeeds(w,p,c);const need=p.need as Pawn['need'];if(hunger<30){expect(calls.searched).toBe(1);expect(need?.kind).toBe('eat');if(need?.kind==='eat'){expect(need.sourcePileId).toBe(source.id);expect(need.foodBinge299).toBeUndefined();}}
 else{expect(calls.searched).toBe(0);expect(p.need).toBeNull();}
});

test('admissible ordinary food precedes a better forbidden compulsive source even when binge is due',()=>{
 const {w,p}=setup();p.need=null;p.hunger=20;p.foodPolicyId=4;p.lastIngestAtCore299=w.tick*10-1200;const ordinary=groundFood(w,p,'rice'),forbidden=groundFood(w,p,'simple-meal',true,3),{c,calls}=planContext(w,p);
 processNeeds(w,p,c);const need=p.need as Pawn['need'];expect(calls.searched).toBe(1);expect(need?.kind).toBe('eat');if(need?.kind==='eat'){expect(need.sourcePileId).toBe(ordinary.id);expect(need.foodBinge299).toBeUndefined();}
 expect(forbidden.quantity).toBe(10);expect(calls.released).toBe(1);
});

test('known absence of ordinary admissible food permits one due compulsive proposal with retained provenance',()=>{
 const {w,p}=setup();p.need=null;p.hunger=20;p.lastIngestAtCore299=w.tick*10-1200;const forbidden=groundFood(w,p,'simple-meal',true),{c,calls}=planContext(w,p),before=forbidden.quantity;
 processNeeds(w,p,c);const need=p.need as Pawn['need'];expect(calls.searched).toBe(1);expect(calls.released).toBe(1);expect(need?.kind).toBe('eat');if(need?.kind==='eat'){expect(need.sourcePileId).toBe(forbidden.id);expect(need.foodBinge299).toBe(true);}
 expect(forbidden.quantity).toBe(before);expect(p.lastIngestAtCore299).toBe(w.tick*10-1200);
});

test('pending ordinary reachability cannot become a second compulsive search or a pickup',()=>{
 const {w,p}=setup();p.need=null;p.hunger=20;p.lastIngestAtCore299=w.tick*10-1200;const ordinary=groundFood(w,p,'rice'),forbidden=groundFood(w,p,'simple-meal',true,3),{c,calls}=planContext(w,p,true);
 const prior=JSON.stringify(w.piles);expect(processNeeds(w,p,c)).toBe(true);expect(calls.searched).toBe(1);expect(calls.released).toBe(0);expect(p.need).toBeNull();expect(JSON.stringify(w.piles)).toBe(prior);expect(ordinary.quantity+forbidden.quantity).toBe(20);
});

test('actual eating retains captured permission after task clone and crisis finish; absent flag grants nothing',()=>{
 const tagged=setup(),food=chewing(tagged.w,tagged.p),marked=tagged.p.need!;if(marked.kind!=='eat')throw Error('fixture');marked.foodBinge299=true;food.forbidden=true;tagged.p.need=structuredClone(marked);finishMentalBreak(tagged.w,tagged.p);
 const first=context();processEating(tagged.w,tagged.p,first.c);expect(tagged.w.piles.includes(food)).toBe(false);expect(tagged.p.lastIngestAtCore299).toBe(tagged.w.tick*10);expect(first.calls.released).toBe(0);
 const untagged=setup(),oldFood=chewing(untagged.w,untagged.p);oldFood.forbidden=true;const second=context();processEating(untagged.w,untagged.p,second.c);
 expect(untagged.w.piles.includes(oldFood)).toBe(true);expect(untagged.p.lastIngestAtCore299).toBeUndefined();expect(second.calls.released).toBe(1);
});
