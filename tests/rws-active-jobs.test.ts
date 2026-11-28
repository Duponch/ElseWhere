import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {importActiveJobs} from '../src/import/rimworld/import-active-jobs.ts';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {RwsLocalCoordinates} from '../src/import/rimworld/local-coordinates.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import type {ImportContext} from '../src/import/rimworld/convert.ts';
import {medicalCamp,controlledInjury} from './scenarios/health.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';
import {applyCommand,stepWorld,refreshStock,validateWorld,serializeWorld,deserializeWorld} from '../src/sim/index';
import {addMaterial} from '../src/sim/materials.ts';
import {cookingSpot,newCookingBill,ingredientPlaceFree,ingredientWithinReach} from '../src/sim/cooking-bills.ts';
import {productionWorkTotal} from '../src/sim/production-recipes.ts';
import {groundCapacity} from '../src/sim/ground-placement.ts';
import {footprintCells} from '../src/sim/definitions.ts';
import type {Cell,MaterialPile,Pawn,Resource,Structure} from '../src/sim/types.ts';

function context(count=1):ImportContext{
 const save=readRwsSave(readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8')),w=medicalCamp(count),coords=new RwsLocalCoordinates(w.width,w.height);
 const map={...save.maps[0]!,width:w.width,height:w.height,things:[]};
 return {save,map,w,notes:new ImportNotes(),geographic:false,thingIds:new Map(),coordinates:coords,blocked:new Set(),pendingChunks:[],index:c=>c.z*w.width+c.x,inside:c=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height} as ImportContext;
}
const raw=(ctx:ImportContext,c:Cell)=>`(${c.x},0,${ctx.w.height-1-c.z})`;
function sourceJob(ctx:ImportContext,p:Pawn,job:string,driver:string,pather='',mind=''){
 const id=`Human${p.id}`;ctx.thingIds.set(id,p.id);
 ctx.map.things.push(readThing(parseXml(`<thing Class="Pawn"><def>Human</def><id>${id}</id><pos>${raw(ctx,p)}</pos><jobs><curJob>${job}</curJob><curDriver>${driver}</curDriver></jobs><pather>${pather}</pather><mindState>${mind}</mindState></thing>`)));
}
function pile(ctx:ImportContext,ref:string,quantity:number,owner:MaterialPile['owner'],item:MaterialPile['item']='hay',kind:MaterialPile['kind']='food'){
 addMaterial(ctx.w,kind,quantity,owner,item);const p=ctx.w.piles.at(-1)!;ctx.thingIds.set(ref,p.id);return p;
}
const check=(ctx:ImportContext)=>{expect(validateWorld(ctx.w)).toEqual([]);expect(validateWorld(deserializeWorld(serializeWorld(ctx.w)))).toEqual([]);};

it('restores actual haul pickup reservation and carried delivery, not the fictive future quota',()=>{
 const ctx=context(2),w=ctx.w,[a,b]=w.pawns;
 a!.priorities.haul=1;b!.priorities.haul=1;
 const x={x:18,z:15},y={x:18,z:17};
 expect(applyCommand(w,{type:'area',action:'stockpile',from:x,to:x}).ok).toBe(true);
 expect(applyCommand(w,{type:'area',action:'stockpile',from:y,to:y}).ok).toBe(true);
 // Existing destination filters are explicitly widened to hay for the test.
 for(const s of w.stockpiles){s.filters.food=true;s.items=undefined;}
 const aPile=pile(ctx,'Hay1',11,{type:'ground',x:12,z:17}),bPile=pile(ctx,'Hay2',24,{type:'pawn',pawnId:b!.id});
 b!.interruptedCargo=true;
 sourceJob(ctx,a!,`<def>HaulToCell</def><targetA>Thing_Hay1</targetA><targetB>${raw(ctx,x)}</targetB><count>85</count>`,`<curToilIndex>4</curToilIndex>`);
 sourceJob(ctx,b!,`<def>HaulToCell</def><targetA>Thing_Hay2</targetA><targetB>${raw(ctx,y)}</targetB><count>64</count>`,`<curToilIndex>9</curToilIndex>`);
 refreshStock(w);importActiveJobs(ctx);
 expect(a!.haul).toMatchObject({sourcePileId:aPile.id,quantity:11,phase:'pickup',carryPileId:null,destination:{type:'stockpile'}});
 expect(b!.haul).toMatchObject({sourcePileId:bPile.id,quantity:24,phase:'deliver',carryPileId:bPile.id});expect(b!.interruptedCargo).toBeUndefined();
 expect(a!.path).toEqual([]);expect(b!.path).toEqual([]);check(ctx);
 stepWorld(w,60);expect(validateWorld(w)).toEqual([]);
});

it('keeps actual research station and elapsed work interval without fabricating global progress',()=>{
 const ctx=context(),w=ctx.w,p=w.pawns[0]!,station:Structure=fixtureBuilding(w,'research-bench',17,16);
 station.material='wood';
 ctx.thingIds.set('Bench1',station.id);p.priorities.research=1;
 // The initial project is a valid legacy clothing project, no new points.
 w.research={project:'complex-clothing',points:0};const previous=structuredClone(w.research);
 Object.assign(p,cookingSpot(station));
 sourceJob(ctx,p,'<def>Research</def><targetA>Thing_Bench1</targetA>','<curToilIndex>1</curToilIndex><ticksLeftThisToil>1504</ticksLeftThisToil>');
 importActiveJobs(ctx);expect(p.research).toMatchObject({stationId:station.id,spot:cookingSpot(station),worked:249});expect(p.state).toBe('working');expect(w.research).toEqual(previous);check(ctx);
});

it('restores the real Core wander-wait clock and alternation, rather than drawing another idle timer',()=>{
 const ctx=context(),p=ctx.w.pawns[0]!;p.mental!.wander={revision:1,nextMoveOrderIsWait:true};
 sourceJob(ctx,p,'<def>Wait_Wander</def><startTick>29970</startTick><expiryInterval>198</expiryInterval>','<curToilIndex>0</curToilIndex>','','<nextMoveOrderIsWait>False</nextMoveOrderIsWait>');
 importActiveJobs(ctx);expect(p.idleWander300).toEqual({kind:'wait',at:{x:p.x,z:p.z},startedAtCore:29970,expiryIntervalCore:198});expect(p.mental!.wander!.nextMoveOrderIsWait).toBe(false);check(ctx);
});

it('resumes a real game with its elapsed time and strict position, and rejects nonexistent target',()=>{
 const ctx=context(2),w=ctx.w,[a,b]=w.pawns,pin=fixtureBuilding(w,'horseshoes',17,16);ctx.thingIds.set('Pin1',pin.id);
 Object.assign(a!,{x:12,z:16});Object.assign(b!,{x:14,z:16});
 sourceJob(ctx,a!,`<def>Play_Horseshoes</def><targetA>Thing_Pin1</targetA><targetB>${raw(ctx,a!)}</targetB>`,'<curToilIndex>1</curToilIndex><ticksLeftThisToil>993</ticksLeftThisToil>');
 sourceJob(ctx,b!,`<def>Play_Horseshoes</def><targetA>Thing_missing</targetA><targetB>${raw(ctx,b!)}</targetB>`,'<curToilIndex>1</curToilIndex><ticksLeftThisToil>993</ticksLeftThisToil>');
 importActiveJobs(ctx);expect(a!.recreation.task).toMatchObject({buildingId:pin.id,activity:'horseshoes',phase:'active',elapsed:300});expect(b!.recreation.task).toBeNull();expect(ctx.notes.after.get('active-jobs')).toBe(1);check(ctx);
});

it('restores a partial harvest on its actual crop and reservation, not a new fictional order',()=>{
 const ctx=context(),w=ctx.w,p=w.pawns[0]!,target={x:17,z:16};p.priorities.grow=1;Object.assign(p,{x:17,z:17});
 const zone={id:w.nextId++,cells:[ctx.index(target)],plant:'rice' as const,allowSow:true,allowCut:true};w.growingZones=[zone];
 const plant:Resource={...target,id:w.nextId++,kind:'rice',amount:6,growth:1,growthTick:w.tick};w.resources=[plant];ctx.thingIds.set('Plant1',plant.id);
 if(w.flora?.revision===1)w.flora.capacity++;
 sourceJob(ctx,p,'<def>Harvest</def><targetA>Thing_Plant1</targetA>','<curToilIndex>5</curToilIndex><workDone>30.42</workDone>');
 importActiveJobs(ctx);const job=w.jobs[0];expect(job).toMatchObject({kind:'harvest',growingZoneId:zone.id,status:'active',reservedBy:p.id,progress:3,workRemainder:420,plantTarget:{resourceId:plant.id}});expect(p.jobId).toBe(job?.id);check(ctx);
});

it('retains an exact bill ingredient owner and count during pickup, rejecting incomplete input instead of inventing it',()=>{
 const ctx=context(),w=ctx.w,p=w.pawns[0]!,station:Structure=fixtureBuilding(w,'campfire',17,16);p.priorities.cook=1;
 const bill=newCookingBill(w.nextId++,'simple-meal');station.bills=[bill];ctx.thingIds.set('Bill_CookMealSimple_1',bill.id);ctx.thingIds.set('Fire1',station.id);
 const rice=pile(ctx,'Rice1',10,{type:'ground',x:13,z:17},'rice');refreshStock(w);
 sourceJob(ctx,p,'<def>DoBill</def><targetA>Thing_Fire1</targetA><targetB>Thing_Rice1</targetB><bill>Bill_CookMealSimple_1</bill><count>10</count>','<curToilIndex>4</curToilIndex>');
 importActiveJobs(ctx);expect(p.cooking?.ingredients).toMatchObject([{pileId:rice.id,quantity:10,item:'rice',stage:'source'}]);expect(p.cooking?.billId).toBe(bill.id);expect(p.path).toEqual([]);check(ctx);
});

it('retains actual paid work during a meal bill when the source ingredients are already placed',()=>{
 const ctx=context(),w=ctx.w,p=w.pawns[0]!,station:Structure=fixtureBuilding(w,'campfire',17,16);p.priorities.cook=1;
 const bill=newCookingBill(w.nextId++,'simple-meal');station.bills=[bill];ctx.thingIds.set('Bill_CookMealSimple_1',bill.id);ctx.thingIds.set('Fire1',station.id);
 const spot=cookingSpot(station),cell=[...footprintCells(station),spot,{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z+1},{x:spot.x,z:spot.z-1}].find(c=>ingredientPlaceFree(w,c,spot,'simple-meal',station)&&ingredientWithinReach(c,spot,station)&&groundCapacity(w,c,'rice')>=10)!;
 expect(cell).toBeDefined();const rice=pile(ctx,'Rice1',10,{type:'ground',...cell},'rice');refreshStock(w);Object.assign(p,spot);
 sourceJob(ctx,p,'<def>DoBill</def><targetA>Thing_Fire1</targetA><targetB>Thing_Rice1</targetB><bill>Bill_CookMealSimple_1</bill><count>10</count><placedThings><li><thing>Thing_Rice1</thing><count>10</count></li></placedThings>','<curToilIndex>14</curToilIndex><workLeft>100</workLeft><ticksSpentDoingRecipeWork>80</ticksSpentDoingRecipeWork>');
 importActiveJobs(ctx);expect(p.cooking).toMatchObject({phase:'work',progress:productionWorkTotal('simple-meal')-100000,workTicks:8,ingredients:[{pileId:rice.id,quantity:10,item:'rice',stage:'placed',cell}]});expect(p.state).toBe('working');check(ctx);
});

it('restores a real awake medical rest in its original bed without creating a fictional sleep need',()=>{
 const ctx=context(),w=ctx.w,p=w.pawns[0]!,bed:Structure=fixtureBuilding(w,'bed',17,16);bed.material='wood';bed.medical=true;
 ctx.thingIds.set('Bed1',bed.id);Object.assign(p,{x:bed.x,z:bed.z});p.priorities.patient=1;p.priorities.bedrest=1;controlledInjury(w,p,'torso',10,'bruise');
 sourceJob(ctx,p,'<def>LayDown</def><targetA>Thing_Bed1</targetA>','<curToilIndex>2</curToilIndex>','','<lastJobTag>RestingForMedicalReasons</lastJobTag>');
 importActiveJobs(ctx);expect(p.need).toMatchObject({kind:'sleep',phase:'sleep',bedId:bed.id,medical:'patient'});expect(p.state).toBe('resting');check(ctx);
});
