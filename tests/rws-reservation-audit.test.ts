import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {ImportContext} from '../src/import/rimworld/convert.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {auditImportedReservations} from '../src/import/rimworld/import-reservation-audit.ts';
import {createWorld} from '../src/sim/engine.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

const base=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
function context():ImportContext {
 const save=readRwsSave(base),map=save.maps[0]!,w=createWorld(183,map.width,map.height);
 map.things.splice(0);map.node.children.splice(0);
 return new ImportContext(save,map,w,new ImportNotes(),false);
}
function actor(ctx:ImportContext,def:string,id:string,job:string,loadId:number,mappedId:number):void {
 ctx.map.things.push(readThing(parseXml(`<thing Class="Pawn"><def>${def}</def><id>${id}</id><pos>(4,0,5)</pos><jobs><curJob><def>${job}</def><loadID>${loadId}</loadID></curJob></jobs></thing>`)));
 ctx.thingIds.set(id,mappedId);
}
const row=(claimant:string,job:number,target:string)=>`<li><claimant>Thing_${claimant}</claimant><job>Job_${job}</job><target>${target}</target><maxPawns>2</maxPawns><stackCount>7</stackCount></li>`;
const sourceRows=(ctx:ImportContext,rows:string[])=>ctx.map.node.children.push(parseXml(`<reservationManager><reservations>${rows.join('')}</reservations></reservationManager>`));

describe('RimWorld reservation receipts are audited, not synthesized',()=>{
 it('checks the original job, exact actor, real workstation, matching seat and reflected cell',()=>{
  const ctx=context(),{w}=ctx,p=w.pawns[0]!,other=w.pawns[1]!,bench=w.nextId++,chair=w.nextId++,wrongChair=w.nextId++;
  actor(ctx,'Human','Human9','Research',41,p.id);actor(ctx,'Human','Human12','Research',42,other.id);
  const spot=ctx.coordinates.cell({x:3,z:7});
  w.structures.push({id:bench,kind:'research-bench',x:spot.x,z:spot.z+1,orientation:0,footprint:'standard'},
   {id:chair,kind:'dining-chair',...spot,orientation:0,footprint:'standard'},
   {id:wrongChair,kind:'dining-chair',x:spot.x+1,z:spot.z,orientation:0,footprint:'standard'});
  ctx.thingIds.set('Bench10',bench);ctx.thingIds.set('Chair11',chair);ctx.thingIds.set('Chair13',wrongChair);
  p.research={stationId:bench,spot,worked:0};
  sourceRows(ctx,[row('Human9',41,'Thing_Bench10'),row('Human9',41,'Thing_Chair11'),row('Human9',41,'(3, 0, 7)'),
   row('Human9',41,'Thing_Chair13'),row('Human9',99,'Thing_Bench10'),row('Human12',42,'Thing_Bench10'),row('Human9',41,'Thing_Missing99')]);
  const old=structuredClone(w),ids=[...ctx.thingIds],source=structuredClone(ctx.map.node);
  auditImportedReservations(ctx);
  expect(ctx.notes.before.get('reservations')).toBe(7);expect(ctx.notes.after.get('reservations')).toBe(3);
  expect(ctx.notes.summary('reservations')).toEqual({exact:0,adapted:3,dropped:4,unknown:0});
  const rows=[...ctx.notes.tallies.get('reservations')!.values()];
  expect(rows.filter(r=>r.status==='adapted').map(r=>r.to)).toEqual(['recherche','place de recherche','place de recherche']);
  expect(rows.filter(r=>r.status==='dropped').map(r=>r.origin)).toEqual(['model','source','both','source']);
  expect(rows.every(r=>r.note?.includes('maxPawns=2 ; stackCount=7'))).toBe(true);
  expect(w).toEqual(old);expect([...ctx.thingIds]).toEqual(ids);expect(ctx.map.node).toEqual(source);
 });
 it('distinguishes an actual animal bed claim from an independent floor-rest reservation',()=>{
  const ctx=context(),{w}=ctx,bed=w.nextId++,goat=w.nextId++,bison=w.nextId++;
  const spot=ctx.coordinates.cell({x:4,z:5});
  w.structures.push({id:bed,kind:'animal-sleeping-spot',...spot,orientation:0,footprint:'standard'});
  // Census-only fixture: task fields are the only animal state the audit reads.
  w.wildlife={profile:'temperate-hares-v1',rng:1,eatenPlants:0,eatenNutrition:0,eatenItems:0,animals:[
   {id:goat,animalRest:{spotId:bed,phase:'sleep'},...spot} as WildAnimal,{id:bison,state:'sleeping',...spot} as WildAnimal]};
  actor(ctx,'Goat','Goat21','LayDown',51,goat);actor(ctx,'Bison','Bison22','LayDown',52,bison);
  ctx.thingIds.set('AnimalSleepingSpot23',bed);
  sourceRows(ctx,[row('Goat21',51,'Thing_AnimalSleepingSpot23'),row('Bison22',52,'(4,0,5)')]);
  auditImportedReservations(ctx);
  expect(ctx.notes.summary('reservations')).toEqual({exact:0,adapted:1,dropped:1,unknown:0});
  expect([...ctx.notes.tallies.get('reservations')!.values()].map(r=>r.to)).toEqual(['couchage animal',undefined]);
 });
 it('reports true haul source quantities, storage destination and ingredients, without claiming arbitrary approach cells',()=>{
  const ctx=context(),{w}=ctx,p=w.pawns[0]!,cook=w.pawns[1]!,pile=w.nextId++,ingredient=w.nextId++,station=w.nextId++,slot=w.nextId++;
  const destination=ctx.coordinates.cell({x:4,z:5}),drop=ctx.coordinates.cell({x:5,z:5}),spot=ctx.coordinates.cell({x:6,z:5}),approach=ctx.coordinates.cell({x:7,z:5});
  w.stockpiles.push({id:slot,...destination,priority:3,capacity:75,filters:{wood:true,food:false}});
  p.haul={sourcePileId:pile,quantity:7,phase:'pickup',destination:{type:'stockpile',stockpileId:slot},carryPileId:null};
  cook.cooking={stationId:station,billId:w.nextId++,spot,actionCell:approach,phase:'gather',ingredients:[{pileId:ingredient,item:'rice',quantity:10,stage:'source',cell:drop}],progress:0,productId:null,storageId:null};
  actor(ctx,'Human','Human31','HaulToCell',61,p.id);actor(ctx,'Human','Human32','DoBill',62,cook.id);
  ctx.thingIds.set('WoodLog33',pile);ctx.thingIds.set('RawRice34',ingredient);ctx.thingIds.set('Stove35',station);
  sourceRows(ctx,[row('Human31',61,'Thing_WoodLog33'),row('Human31',61,'(4,0,5)'),row('Human32',62,'Thing_Stove35'),row('Human32',62,'Thing_RawRice34'),row('Human32',62,'(5,0,5)'),row('Human32',62,'(7,0,5)')]);
  auditImportedReservations(ctx);
  expect(ctx.notes.summary('reservations')).toEqual({exact:0,adapted:5,dropped:1,unknown:0});
  const results=[...ctx.notes.tallies.get('reservations')!.values()];
  expect(results[0]?.note).toContain('transport natif : 7');expect(results[3]?.note).toContain('Quantité native : 10');
  expect(results[5]?.status).toBe('dropped');
 });
});
