import {afterEach,expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Job,Pawn,World} from '../src/sim/types';
import type {WildAnimal} from '../src/sim/wildlife-state';
import {createSourceReservationRead379,reservedSource} from '../src/sim/materials';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';
import {processCooking} from '../src/sim/cooking';
import {newCookingBill,cookingSpot} from '../src/sim/cooking-bills';
import {releaseWork} from '../src/sim/work-release';

afterEach(()=>{setTerrainWriteCacheVerification(false);vi.restoreAllMocks();});
const haul=(pileId:number,quantity:number)=>({sourcePileId:pileId,quantity,phase:'pickup' as const,carryPileId:null,destination:{type:'aside' as const,x:1,z:1}});
const ingredient=(pileId:number,quantity:number,stage:'source'|'placed'|'held'='source')=>({pileId,quantity,item:'rice' as const,stage,cell:{x:1,z:1}});
const cooking=(ingredients:ReturnType<typeof ingredient>[])=>({stationId:1,billId:1,spot:{x:1,z:1},actionCell:{x:1,z:1},phase:'gather' as const,ingredients,progress:0,productId:null,storageId:null});
function fixture(){
 const w=createWorld(42,16,16);delete w.worldMaps;delete w.campaignMap;delete w.scout;delete w.commercialTrip;delete w.group;
 const [p,q,r]=w.pawns as [Pawn,Pawn,Pawn],ids=[20000,20001,20002,20003,20004];
 w.structures=[];w.jobs=[];w.resources=[];w.piles=ids.map(id=>({id,kind:'food',item:'rice',quantity:75,owner:{type:'ground',x:3,z:3}}));
 w.piles[3]={id:ids[3]!,kind:'corpse',item:'human-corpse',quantity:1,owner:{type:'ground',x:4,z:3},humanCorpse:{pawnId:77} as NonNullable<World['piles'][number]['humanCorpse']>};
 for(const actor of w.pawns){actor.need=null;actor.haul=null;actor.cooking=null;actor.recreation.task=null;actor.orders.queue=[];}
 const a:WildAnimal={id:30000,species:'hare',sex:'female',x:4,z:4,ageTicks:1000,food:.1,rest:1,state:'idle',path:[],nextDecision:0,meal:{kind:'pile',id:ids[0]!,quantity:3,progress:0},haul:{...haul(ids[1]!,4),destination:{type:'stockpile',stockpileId:1},phase:'pickup'} as WildAnimal['haul']};
 w.wildlife={profile:'temperate-hares-v1',rng:1,animals:[a],eatenPlants:0,eatenNutrition:0,eatenItems:0};
 const base:Job={id:40000,kind:'wall',x:8,z:8,orientation:0,footprint:'standard',status:'pending',reservedBy:p.id,progress:0,escrow:{wood:0,food:0}};
 w.jobs=Array.from({length:80},(_,i)=>({...base,id:base.id+i}));
 w.jobs[0]!.tree={kind:'replant',phase:'pickup',sourcePileId:ids[0]} as Job['tree'];w.jobs[1]!.tree={kind:'replant',phase:'pickup',sourcePileId:ids[1]} as Job['tree'];w.jobs[1]!.reservedBy=null;
 w.scout={phase:'loading',pawnId:q.id,sourcePileId:ids[0]!,quantity:2,startedAt:w.tick};
 w.commercialTrip={phase:'loading',pawnId:p.id,cursor:0,manifest:[{sourcePileId:ids[0],quantity:5},{sourcePileId:ids[1],quantity:6}]} as NonNullable<World['commercialTrip']>;
 w.group={phase:'loading',cursor:0,manifest:[{pileId:ids[0],quantity:7},{pileId:ids[1],quantity:8}]} as NonNullable<World['group']>;
 p.recreation.task={activity:'read',stage:'pickup',bookId:ids[0]} as NonNullable<Pawn['recreation']['task']>;
 p.burial={phase:'pickup',corpseId:ids[2]} as Pawn['burial'];p.hunting={animalId:ids[2]} as Pawn['hunting'];p.equipmentTask={action:'equip',itemId:ids[2]} as Pawn['equipmentTask'];
 p.cooking=cooking([ingredient(ids[0]!,.1),ingredient(ids[0]!,.2),ingredient(ids[1]!,9,'held'),ingredient(ids[2]!,10,'placed')]);
 p.animalHandling={phase:'pickup',sourcePileId:ids[0],quantity:11} as Pawn['animalHandling'];
 p.animalCare={phase:'pickup',medicine:{sourcePileId:ids[0],quantity:12}} as Pawn['animalCare'];
 p.surgery={patientId:q.id,part:'left-arm',bedId:1,spot:{x:1,z:1},progress:0,workCore:0,phase:'pickup',medicine:{item:'herbal-medicine',sourcePileId:ids[0]!,quantity:13,carryPileId:null},ingredients:[{...ingredient(ids[1]!,14),item:'wood'},{...ingredient(ids[2]!,15,'held'),item:'wood'}]};
 p.tend={phase:'pickup',medicine:{sourcePileId:ids[0],quantity:16}} as Pawn['tend'];
 p.need={kind:'eat',phase:'pickup',sourcePileId:ids[2],quantity:17,paste:{ingredients:[{pileId:ids[0],quantity:18}]}} as Pawn['need'];
 p.feed={phase:'pickup',sourcePileId:ids[2],quantity:19,paste:{ingredients:[{pileId:ids[0],quantity:20}]}} as Pawn['feed'];
 p.animalFeed={phase:'pickup',sourcePileId:ids[1],quantity:21} as Pawn['animalFeed'];p.ward={kind:'food',phase:'pickup',sourcePileId:ids[1],quantity:22} as Pawn['ward'];
 p.haul={...haul(ids[0]!,999),constructionBatch379:{item:'wood',sources:[{pileId:ids[0],quantity:23},{pileId:ids[2],quantity:24}],destinations:[]}} as Pawn['haul'];
 q.haul={...haul(ids[0]!,55),haulOpportunity379:{quantity:25}};
 p.orders.queue=[haul(ids[0]!,26),{cooking:cooking([ingredient(ids[0]!,27,'held')])},{...haul(ids[1]!,999),constructionBatch379:{item:'wood',sources:[{pileId:ids[0]!,quantity:28}],destinations:[]}}];
 q.orderedQueue378=[{type:'order-consume',pawnId:q.id,pileId:ids[1]!,queue:false}];r.orderedQueue378=[{type:'order-bury',pawnId:r.id,bodyPawnId:77,queue:false}];
 return {w,p,q,r,a,ids};
}
test('immutable source reads match every active/queued claim and every exclusion, including generalized corpse claims',()=>{
 const {w,p,q,r,a,ids}=fixture(),owner={},before=JSON.stringify(w);
 withJournalTerrainReadScope(owner,()=>{
  for(const except of [undefined,p.id,q.id,r.id,a.id])for(const tree of [undefined,w.jobs[0]!.id])for(const excluded of [undefined,new Set([p.id,a.id]),new Set([-1,q.id])]){
   const read=createSourceReservationRead379(w,ids,except,tree,excluded);
   for(const id of [...ids,98765,NaN,0,Number.MAX_SAFE_INTEGER+1])expect(read(id),`id=${id}, except=${except}, tree=${tree}`).toBe(reservedSource(w,id,except,tree,excluded));
  }
 });
 expect(JSON.stringify(w)).toBe(before);
});
test('the physical fold keeps IEEE addition order rather than summing subtotal families in a different order',()=>{
 const {w,p,q,a,ids}=fixture(),id=ids[0]!;w.pawns=[p];p.recreation.task=null;p.burial=undefined;p.hunting=undefined;p.equipmentTask=undefined;p.cooking=cooking([ingredient(id,1)]);p.animalHandling=undefined;p.animalCare=undefined;p.surgery=undefined;p.tend=undefined;p.need=null;p.feed=undefined;p.animalFeed=undefined;p.ward=undefined;p.haul=null;p.orders.queue=[haul(id,1)];
 w.commercialTrip={phase:'loading',pawnId:q.id,cursor:0,manifest:[{sourcePileId:id,quantity:1e16}]} as NonNullable<World['commercialTrip']>;
 // This deliberately synthetic single-unit scout claim isolates each IEEE addition.
 w.group={phase:'loading',cursor:0,manifest:[{pileId:id,quantity:1}]} as NonNullable<World['group']>;w.jobs=w.jobs.slice(0,1);w.scout={phase:'loading',pawnId:q.id,sourcePileId:id,quantity:1,startedAt:w.tick} as unknown as NonNullable<World['scout']>;a.meal={kind:'pile',id,quantity:1,progress:0};delete a.haul;
 withJournalTerrainReadScope({},()=>{expect(reservedSource(w,id)).toBe(1e16);expect(createSourceReservationRead379(w,[id])(id)).toBe(1e16);});
});
test('one read visits each job once; fresh proposals and public/escaped readers immediately observe same-tick admissions and releases',()=>{
 const {w,p,ids}=fixture(),owner={},iterate=vi.spyOn(w.jobs,Symbol.iterator);let escaped:(id:number)=>number;
 withJournalTerrainReadScope(owner,()=>{
  const read=createSourceReservationRead379(w,ids);const expected=ids.map(id=>reservedSource(w,id));iterate.mockClear();
  for(let i=0;i<24;i++)for(let j=0;j<ids.length;j++)expect(read(ids[j]!)).toBe(expected[j]);expect(iterate).toHaveBeenCalledTimes(1);
  escaped=read;p.orders.queue.push(haul(ids[4]!,9));
  expect(createSourceReservationRead379(w,ids)(ids[4]!)).toBe(9);
  p.orders.queue=[];expect(createSourceReservationRead379(w,ids)(ids[4]!)).toBe(0);
 });
 p.orders.queue=[haul(ids[4]!,12)];expect(escaped!(ids[4]!)).toBe(12);
 const live=createSourceReservationRead379(w,ids);expect(live(ids[4]!)).toBe(12);p.orders.queue=[];expect(live(ids[4]!)).toBe(0);
});
test('real split-ingredient validation sees the first cook release before the second cook proposes its move in the same tick',()=>{
 const w=createWorld(42,16,16);w.structures=[];w.resources=[];w.jobs=[];w.piles=[];w.pawns=w.pawns.slice(0,2);w.tiles=w.tiles.map(()=>({terrain:'grass'}));
 const pileId=w.nextId++;w.piles=[{id:pileId,kind:'food',item:'rice',quantity:75,owner:{type:'ground',x:9,z:9}}];
 for(let i=0;i<w.pawns.length;i++){
  const p=w.pawns[i]!;delete p.background;delete p.traits;p.x=2+i;p.z=2;p.moveCooldown=0;p.motion=null;p.priorities.cook=1;p.skills.cooking!.level=20;
  const bill=newCookingBill(w.nextId++,'cook-simple-meal-bulk'),station={id:w.nextId++,kind:'campfire' as const,x:6+i*2,z:6,orientation:0 as const,footprint:'standard' as const,bills:[bill],fuel:{ticks:6000,burned:0,autoRefuel:false}};w.structures.push(station);
  p.cooking={...cooking(Array.from({length:4},()=>ingredient(pileId,10))),recipe:'cook-simple-meal-bulk',stationId:station.id,billId:bill.id,spot:cookingSpot(station)};
 }
 const run=(closed:boolean)=>{const copy=structuredClone(w),calls:unknown[]=[];const act=()=>{for(const p of copy.pawns)processCooking(copy,p,{search:()=>null,move:(cell,exact)=>{calls.push(['move',p.id,cell,exact]);},release:()=>{calls.push(['release',p.id]);return releaseWork(copy,p);},event:message=>{calls.push(['event',message]);},workRate:()=>1});};if(closed)withJournalTerrainReadScope({},act);else act();return {copy,calls};};
 const expected=run(false),actual=run(true);expect(actual).toStrictEqual(expected);expect(actual.calls.map(c=>(c as unknown[])[0])).toEqual(['release','move']);
});
