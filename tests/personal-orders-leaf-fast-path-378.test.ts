import {expect,test} from 'vitest';
import {createPersonalOrdersTransportValidators378,validPersonalOrdersProjection378,validPersonalOrdersTransport378} from '../src/bridge/personal-orders-transport-378.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';
import {medicalCamp} from './scenarios/health.ts';

const inspected=['world','summary','campaign','dynamic','map','secondarySite','campaignMap','worldMaps','sites','worldGroups','groups','group','state','pending261','groupLosses','losses','abandonedContents','humans','animals','members','people','pawn','actor','human','animal','pawns','structures','jobs','packed','building','items','piles','wildlife','animalOwners','worldPawns','owners','worldFactions','leaders','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','cryptosleep','shipCryptosleep277','occupant','visitors','podRescues','departed','banishedDepartures378','startingArrival','pods','scout','commercialTrip','upserted','identity378','orderedQueue378','hunting','animalHandling','animalCare','animalFeed','animalRescue'];

function validators(...records:object[]){
 const ordinary=new WeakSet(records);
 return {ordinary,...createPersonalOrdersTransportValidators378(v=>ordinary.has(v))};
}

test('witnessed ordinary leaves agree with strict transport across supported and invalid versions',()=>{
 const symbol=Symbol('unrelated'),leaf={id:1,kind:'wall',[symbol]:true};
 let reads=0;Object.defineProperty(leaf,'unrelated',{get(){reads++;throw Error('unrelated getter');}});
 const fast=validators(leaf),raw={structures:[leaf],piles:[leaf]};
 for(const version of [0,1,377,378,SCHEMA_VERSION,SCHEMA_VERSION+1,NaN,1.5])expect(fast.transport(raw,version)).toBe(validPersonalOrdersTransport378(raw,version));
 expect(reads).toBe(0);
 // The same witness cannot hide a later relevant field or a prototype change.
 Object.defineProperty(leaf,'identity378',{value:{revision:1,title:''},configurable:true});
 expect(fast.transport(raw,SCHEMA_VERSION)).toBe(false);
 delete (leaf as {identity378?:unknown}).identity378;
 Object.setPrototypeOf(leaf,{pawns:[]});expect(fast.transport(raw,SCHEMA_VERSION)).toBe(false);
});

test('every inspected own lane retains hidden/accessor rejection without invoking its getter',()=>{
 for(const key of inspected){
  for(const accessor of [false,true]){
   const leaf={id:1},fast=validators(leaf);let reads=0;
   Object.defineProperty(leaf,key,accessor?{enumerable:true,get(){reads++;throw Error('getter');}}:{value:undefined});
   const raw={piles:[leaf]};
   expect(fast.transport(raw,SCHEMA_VERSION),key).toBe(validPersonalOrdersTransport378(raw,SCHEMA_VERSION));
   expect(fast.transport(raw,SCHEMA_VERSION),key).toBe(false);expect(reads,key).toBe(0);
  }
 }
});

test('inherited inspected fields added to Object.prototype are checked live',()=>{
 const leaf={id:1},fast=validators(leaf),raw={piles:[leaf]};
 expect(fast.transport(raw,SCHEMA_VERSION)).toBe(true);
 for(const key of ['pawns','identity378','orderedQueue378','banishedDepartures378','hunting','animalHandling','animalCare','animalFeed','animalRescue']){
  const before=Object.getOwnPropertyDescriptor(Object.prototype,key);let actual:boolean,expected:boolean,reads=0;
  try{
   Object.defineProperty(Object.prototype,key,{configurable:true,get(){reads++;throw Error('inherited getter');}});
   actual=fast.transport(raw,SCHEMA_VERSION);expected=validPersonalOrdersTransport378(raw,SCHEMA_VERSION);
  }finally{if(before)Object.defineProperty(Object.prototype,key,before);else Reflect.deleteProperty(Object.prototype,key);}
  expect(actual!,key).toBe(expected!);expect(actual!,key).toBe(false);expect(reads,key).toBe(0);
 }
 expect(fast.transport(raw,SCHEMA_VERSION)).toBe(true);
});

test('unwitnessed and throwing proxies keep the strict descriptor path',()=>{
 const fast=validators();
 const proxy=new Proxy({id:1},{getOwnPropertyDescriptor(target,key){if(key==='identity378')return {configurable:true,enumerable:false,value:{revision:1,title:'A'}};return Reflect.getOwnPropertyDescriptor(target,key);}});
 const throwing=new Proxy({},{getOwnPropertyDescriptor(){throw Error('descriptor trap');}});
 const revoked=Proxy.revocable({},{});revoked.revoke();
 for(const raw of [proxy,throwing,revoked.proxy,{piles:[proxy]}])expect(fast.transport(raw,SCHEMA_VERSION)).toBe(validPersonalOrdersTransport378(raw,SCHEMA_VERSION));
 const inherited=Object.create({world:{identity378:{revision:1,title:'A'}}});fast.ordinary.add(inherited);
 expect(fast.transport(inherited,SCHEMA_VERSION)).toBe(false);
});

test('owner roles, task forced fields, arrays and projection clocks still use the strict oracle',()=>{
 const leaf={id:1},fast=validators(leaf);
 for(const version of [377,378,SCHEMA_VERSION]){
  for(const raw of [
   {pawns:[leaf,{identity378:{revision:1,title:'A'}}]},
   {structures:[leaf,{cryptosleep:{human:{identity378:{revision:1,title:'A'}}}}]},
   ...['hunting','animalHandling','animalCare','animalFeed','animalRescue'].map(task=>({pawns:[leaf,{[task]:{kind:'milk',forced378:true}}]})),
   {piles:[leaf,...new Array(1)]},
  ])expect(fast.transport(raw,version)).toBe(validPersonalOrdersTransport378(raw,version));
 }
 const w=medicalCamp(),p=w.pawns[0]!;fast.ordinary.add(w);fast.ordinary.add(p);
 for(const pile of w.piles)fast.ordinary.add(pile);for(const s of w.structures)fast.ordinary.add(s);
 const same=()=>expect(fast.projection(w)).toBe(validPersonalOrdersProjection378(w));
 same();p.identity378={revision:1,title:'Artisane'};same();
 p.identity378={revision:1,banishedAt:w.tick+1};same();expect(fast.projection(w)).toBe(false);
 p.identity378={revision:1,title:'Artisane'};p.orderedQueue378=[];same();
 (w as unknown as {schemaVersion:number}).schemaVersion=377;same();expect(fast.projection(w)).toBe(false);
});
