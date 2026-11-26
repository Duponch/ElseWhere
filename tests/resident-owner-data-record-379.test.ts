import {expect,test,vi} from 'vitest';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler';
import {residentOwnerRecord379} from '../src/bridge/resident-owner-records-379';
import type {SnapshotMessage} from '../src/bridge/snapshots';

// Stop after record validation, before any gameplay validator. The invalid
// schema gives an observable distinction between accepted shape and bad data.
function admit(world:object){
 const packet={type:'snapshot',kind:'checkpoint',epoch:1,revision:1,stepMs:0,speed:1,world} as SnapshotMessage<true>;
 return new ResidentPresentationAssembler().adopt(packet);
}
const shapeAccepted={status:'resync',reason:'Invalid resident shape: schemaVersion'};
const shapeRefused={status:'resync',reason:'Invalid resident shape: World data record'};

test('ordinary representation reads one current descriptor while raw and Proxy inputs retain their original reads',()=>{
 const data={schemaVersion:0,kept:undefined},ordinary=residentOwnerRecord379(data,{}),raw={...data};
 const counts=new Map<object,number>(),read=Object.getOwnPropertyDescriptor;
 const proxy=new Proxy({...data},{}),targets=new Set([ordinary,raw,proxy]);
 const spy=vi.spyOn(Object,'getOwnPropertyDescriptor').mockImplementation((value,key)=>{
  if(targets.has(value)&&key==='kept')counts.set(value,(counts.get(value)??0)+1);
  return read(value,key);
 });
 try{
  for(const value of targets)expect(admit(value)).toEqual(shapeAccepted);
  expect(counts.get(ordinary)).toBe(1);expect(counts.get(raw)).toBe(2);expect(counts.get(proxy)).toBe(2);
 }finally{spy.mockRestore();}
});

test('ordinary representation never caches mutable shape, descriptor, symbol or prototype facts',()=>{
 const value=residentOwnerRecord379({schemaVersion:0,kept:undefined},{});let reads=0;
 expect(admit(value)).toEqual(shapeAccepted);
 Object.defineProperty(value,'extra',{enumerable:false,configurable:true,value:undefined});expect(admit(value)).toEqual(shapeRefused);
 Reflect.deleteProperty(value,'extra');expect(admit(value)).toEqual(shapeAccepted);
 Object.defineProperty(value,'extra',{enumerable:true,configurable:true,get(){reads++;throw Error('must not invoke');}});expect(admit(value)).toEqual(shapeRefused);expect(reads).toBe(0);
 Reflect.deleteProperty(value,'extra');const symbol=Symbol('own');Object.defineProperty(value,symbol,{enumerable:true,configurable:true,value:1});expect(admit(value)).toEqual(shapeRefused);
 Reflect.deleteProperty(value,symbol);Object.setPrototypeOf(value,{kept:1});expect(admit(value)).toEqual(shapeRefused);
 Object.setPrototypeOf(value,Object.prototype);expect(admit(value)).toEqual(shapeAccepted);
});

test('an unwitnessed Proxy can alter a descriptor between strict reads and remains refused',()=>{
 let reads=0;
 const value=new Proxy({schemaVersion:0,kept:undefined},{getOwnPropertyDescriptor(target,key){
  if(key==='kept'&&++reads===2)return {configurable:true,enumerable:true,get(){throw Error('must not invoke');}};
  return Reflect.getOwnPropertyDescriptor(target,key);
 }});
 expect(admit(value)).toEqual(shapeRefused);expect(reads).toBe(2);
});
