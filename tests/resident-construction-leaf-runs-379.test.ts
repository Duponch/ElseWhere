import {expect,test} from 'vitest';
import {createResidentConstructionValidators379,validConstructionTransport379} from '../src/sim/construction-forbid-save-379';
import {createResidentOwnerLeafRun379,isOrdinaryResidentOwnerRecord379,residentOwnerArray379,residentOwnerArraySlice379,residentOwnerRecord379} from '../src/bridge/resident-owner-records-379';

const row=()=>residentOwnerRecord379({id:1,kind:'wall',construction:'blueprint'},{});
function list<T>(...rows:T[]):T[]{const values=residentOwnerArray379<T>();values.push(...rows);return values;}
function scanner(){
 let skipped=0;
 const validators=createResidentConstructionValidators379(isOrdinaryResidentOwnerRecord379,keys=>{
  const run=createResidentOwnerLeafRun379(keys);
  return (array,from,accept)=>{const through=run(array,from,accept);skipped+=through-from;return through;};
 });
 return {...validators,skipped:()=>skipped};
}

test('owned ordinary prefixes skip only negative leaves and keep independent alias roles',()=>{
 const leaf=row(),h=scanner(),raw={world:{jobs:list(leaf,leaf)},summary:{structures:list(leaf)},resources:list(leaf)};
 expect(h.transport(raw,379)).toBe(validConstructionTransport379(raw,379));expect(h.skipped()).toBe(4);
 Object.assign(leaf,{forbidden379:true});expect(h.transport(raw,379)).toBe(validConstructionTransport379(raw,379));expect(h.transport(raw,379)).toBe(false);
});

test('unknown arrays and Proxy array wrappers never grant a prefix, even when frozen',()=>{
 const run=createResidentOwnerLeafRun379(new Set(['forbidden379'])),leaf=row(),unknown=[leaf],owned=list(leaf),proxy=new Proxy(owned,{});
 for(const values of [unknown,Object.freeze([leaf]),proxy])expect(run(values,0,()=>true)).toBe(0);
 expect(run(owned,0,()=>true)).toBe(1);
});

test('a strict Proxy between prefixes can pollute inherited lanes before the next leaf',()=>{
 const execute=(fast:boolean)=>{
  const first=row(),last=row(),proxy=new Proxy({}, {getOwnPropertyDescriptor(target,key){
   if(key==='destinations')Object.defineProperty(Object.prototype,'forbidden379',{value:true,configurable:true});
   return Reflect.getOwnPropertyDescriptor(target,key);
  }}),raw={resources:list<object>(first,proxy,last)},h=scanner();
  try{return {valid:fast?h.transport(raw,379):validConstructionTransport379(raw,379),skipped:h.skipped()};}
  finally{delete (Object.prototype as Record<string,unknown>).forbidden379;}
 };
 expect(execute(true)).toEqual({valid:execute(false).valid,skipped:1});expect(execute(true).valid).toBe(false);
});

test('prefixes stop on hidden relevant keys, replacement rows, index accessors and sparse slots without invoking getters',()=>{
 const run=createResidentOwnerLeafRun379(new Set(['jobs','forbidden379'])),first=row(),last=row(),values=list<object>(first,last);let reads=0;
 expect(run(values,0,()=>true)).toBe(2);
 Object.defineProperty(last,'jobs',{value:undefined,configurable:true});expect(run(values,0,()=>true)).toBe(1);
 Reflect.deleteProperty(last,'jobs');values[1]={id:2};expect(run(values,0,()=>true)).toBe(1);
 values[1]=last;Object.defineProperty(values,'1',{enumerable:true,configurable:true,get(){reads++;throw Error('must not invoke');}});
 expect(run(values,0,()=>true)).toBe(1);expect(scanner().transport({resources:values},379)).toBe(false);expect(reads).toBe(0);
 Reflect.deleteProperty(values,'1');expect(run(values,0,()=>true)).toBe(1);expect(scanner().transport({resources:values},379)).toBe(false);
});

test('a prefix cannot hide an active ancestor after an unknown callback removes its ownership lane',()=>{
 const execute=(fast:boolean)=>{
  const root=residentOwnerRecord379({} as Record<string,unknown>,{}),values=list(root);
  root.world=new Proxy({resources:values},{getOwnPropertyDescriptor(target,key){if(key==='forbidden379')delete root.world;return Reflect.getOwnPropertyDescriptor(target,key);}});
  return fast?scanner().transport(root,379):validConstructionTransport379(root,379);
 };
 expect(execute(true)).toBe(execute(false));expect(execute(true)).toBe(false);
});

test('owned slices preserve holes, references and retained predecessors, and only their real dense prefix can be skipped',()=>{
 const a=row(),b=row(),before=list(a,b),after=residentOwnerArraySlice379(before),run=createResidentOwnerLeafRun379(new Set(['forbidden379']));
 expect(after).not.toBe(before);expect(after[0]).toBe(a);expect(run(after,0,()=>true)).toBe(2);
 after[0]=row();expect(before[0]).toBe(a);expect(run(before,0,()=>true)).toBe(2);
 Reflect.deleteProperty(before,'0');const sparse=residentOwnerArraySlice379(before);expect(0 in sparse).toBe(false);expect(sparse[1]).toBe(b);
 expect(run(sparse,0,()=>true)).toBe(0);expect(scanner().transport({resources:sparse},379)).toBe(false);
});

test('custom slice and constructor/species keep their original calls and their results remain unwitnessed',()=>{
 const leaf=row(),run=createResidentOwnerLeafRun379(new Set(['forbidden379']));let methods=0,constructors=0;
 const custom=list(leaf),output=new Proxy([leaf],{});
 Object.defineProperty(custom,'slice',{value(){methods++;return output;}});
 expect(residentOwnerArraySlice379(custom)).toBe(output);expect(methods).toBe(1);expect(run(output,0,()=>true)).toBe(0);
 class CustomArray<T> extends Array<T>{}
 const source=list(leaf);Object.defineProperty(source,'constructor',{get(){constructors++;return {[Symbol.species]:CustomArray};}});
 const result=residentOwnerArraySlice379(source);expect(result).toBeInstanceOf(CustomArray);expect(result[0]).toBe(leaf);expect(constructors).toBe(1);expect(run(result,0,()=>true)).toBe(0);
});
