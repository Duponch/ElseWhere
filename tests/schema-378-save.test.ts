import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {validatePawnRecordShape,validateDetachedPawnRecordShape,validateAwayPawnRecordShape,validateShipCasketPawnShape277,validateRetainedShipCasketPawnShape277,validateRetainedPlayerCasketPawnShape271} from '../src/sim/pawn-record-save.ts';
import {validPawnIdentity378} from '../src/sim/pawn-identity-state-378.ts';
import {validOrderedQueuePawn378} from '../src/sim/ordered-queue-378.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';

const raw=(p:Pawn)=>p as unknown as Record<string,unknown>;
const identityError='Invalid or future actual Pawn identity.';
const queueError='Invalid or future personal order queue for its actual Pawn owner.';

test('377 is admitted strictly then migrated by its number alone, without new owners or personal history',()=>{
 const w=createWorld(378,20,20),old=asOldSchema(serializeWorld(w),377),expected=JSON.parse(old);
 expected.schemaVersion=SCHEMA_VERSION;
 const loaded=deserializeWorld(old);
 expect(loaded).toEqual(expected);expect(validateWorld(loaded)).toEqual([]);
 expect(Object.hasOwn(loaded,'banishedDepartures378')).toBe(false);
 for(const p of loaded.pawns){expect(Object.hasOwn(p,'identity378')).toBe(false);expect(Object.hasOwn(p,'orderedQueue378')).toBe(false);}
});

test('the authentic 377 boundary rejects each future field before migration',()=>{
 const w=createWorld(378,20,20),original=asOldSchema(serializeWorld(w),377);
 for(const edit of [
  (old:World)=>{old.pawns[0]!.identity378={revision:1,title:'Chef'};},
  (old:World)=>{old.pawns[0]!.orderedQueue378=[{type:'read-book-295',pawnId:old.pawns[0]!.id,bookId:1}];},
  (old:World)=>{old.banishedDepartures378=[];},
 ]){const old=JSON.parse(original) as World;edit(old);expect(()=>deserializeWorld(JSON.stringify(old))).toThrow(/version377/);}
});

test('378 persists a title and queued order literally with the original pawn, PRNG and item allocator',()=>{
 const w=createWorld(378,20,20),p=w.pawns[0]!;
 p.identity378={revision:1,title:'Chef'};
 p.orderedQueue378=[{type:'read-book-295',pawnId:p.id,bookId:w.nextId+50}];
 expect(validateWorld(w)).toEqual([]);
 const json=serializeWorld(w),loaded=deserializeWorld(json);
 expect(serializeWorld(loaded)).toBe(json);expect(loaded.rng).toBe(w.rng);expect(loaded.nextId).toBe(w.nextId);
 expect(loaded.pawns[0]!.identity378).toEqual(p.identity378);expect(loaded.pawns[0]!.orderedQueue378).toEqual(p.orderedQueue378);
});

test('all shared physical Pawn guards reject future identity and queued intents at their own owner clock',()=>{
 const w=createWorld(378,20,20),p=w.pawns[0]!,context={width:w.width,height:w.height,tick:w.tick,nextId:w.nextId};
 const guards=[
  (version:number)=>validatePawnRecordShape(raw(p),w,version),
  (version:number)=>validateDetachedPawnRecordShape(raw(p),context,version),
  (version:number)=>validateAwayPawnRecordShape(raw(p),context,version,w.tick,new Set()),
  (version:number)=>validateShipCasketPawnShape277(raw(p),w,version,w.tick,w.nextId-1),
  (version:number)=>validateRetainedShipCasketPawnShape277(raw(p),context,version,w.tick,w.nextId-1),
  (version:number)=>validateRetainedPlayerCasketPawnShape271(raw(p),context,version,w.tick,{casketId:w.nextId-1,heldAt:w.tick}),
 ];
 p.identity378={revision:1,title:'Chef'};for(const guard of guards)expect(guard(377)).toEqual([identityError]);
 p.identity378={revision:1,banishedAt:w.tick+1};for(const guard of guards)expect(guard(378)).toEqual([identityError]);
 delete p.identity378;p.orderedQueue378=[{type:'read-book-295',pawnId:p.id,bookId:1}];for(const guard of guards)expect(guard(377)).toEqual([queueError]);
 for(const guard of guards.slice(1))expect(guard(378)).toEqual([queueError]);
});

test('378 optional raw fields require their actual enumerable data descriptors and dense queue data',()=>{
 const w=createWorld(378,20,20),p=w.pawns[0]!;
 for(const value of [undefined,null,{}, {revision:1}, {revision:1,title:''}, {revision:1,title:'Chef',extra:true}]){
  expect(validPawnIdentity378({...p,identity378:value},378,w.tick)).toBe(false);
 }
 const inherited=Object.assign(Object.create({identity378:{revision:1,title:'Chef'}}),p);
 expect(validPawnIdentity378(inherited,378,w.tick)).toBe(false);
 const getter={...p};Object.defineProperty(getter,'identity378',{enumerable:true,get(){throw Error('must not read accessor');}});
 expect(validPawnIdentity378(getter,378,w.tick)).toBe(false);
 const hidden={...p};Object.defineProperty(hidden,'identity378',{value:{revision:1,title:'Chef'}});
 expect(validPawnIdentity378(hidden,378,w.tick)).toBe(false);
 expect(validOrderedQueuePawn378({...p,orderedQueue378:[]},378)).toBe(false);
 expect(validOrderedQueuePawn378({...p,orderedQueue378:new Array(1)},378)).toBe(false);
 expect(validOrderedQueuePawn378({...p,orderedQueue378:[{type:'read-book-295',pawnId:p.id+1,bookId:1}]},378)).toBe(false);
 expect(validateWorld({...w,banishedDepartures378:undefined}).length).toBeGreaterThan(0);
});
