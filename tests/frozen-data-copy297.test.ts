import {expect,test} from 'vitest';
import {copyCoreData297} from '../src/bridge/core-phase-data-297.ts';
import {frozenDataCopy297} from '../src/bridge/core-phase-owner-297.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';

// The faster actor copy must be indistinguishable from the pinned copyCoreData297.
const deepFrozen=(v:unknown):boolean=>v===null||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v as object).every(deepFrozen);
const outcome=(f:()=>unknown):string=>{try{const r=f();return 'ok:'+JSON.stringify(r)+':'+deepFrozen(r);}catch(e){return 'throw:'+(e as Error).message;}};

test('identical copies of real actors',()=>{
 const w=deconstructionCamp(3,32);
 for(const value of [w.pawns,w.wildlife?.animals??[],w.mechanoids??[],{a:[1,{b:'x'}],c:null,d:undefined}]){
  expect(outcome(()=>frozenDataCopy297(value))).toBe(outcome(()=>copyCoreData297(value)));
 }
 const copy=frozenDataCopy297({a:1});expect(Object.getOwnPropertyDescriptor(copy,'a')).toEqual(Object.getOwnPropertyDescriptor(copyCoreData297({a:1}),'a'));
});

test('identical rejections',()=>{
 const accessor={};Object.defineProperty(accessor,'x',{enumerable:true,get:()=>1});
 const hidden={};Object.defineProperty(hidden,'x',{enumerable:false,value:1});
 const symbol={[Symbol('s')]:1};
 const holes=[1,,3];const extra=Object.assign([1,2],{k:3});
 const cycle:Record<string,unknown>={};cycle.self=cycle;
 const deep:Record<string,unknown>={};let cur=deep;for(let i=0;i<30;i++){const next={};cur.n=next;cur=next;}
 class Custom{a=1}
 for(const bad of [accessor,hidden,symbol,holes,extra,cycle,deep,new Custom(),{n:NaN},{f:()=>1},new Float32Array(2),[Infinity]]){
  expect(outcome(()=>frozenDataCopy297(bad))).toBe(outcome(()=>copyCoreData297(bad)));
 }
});
