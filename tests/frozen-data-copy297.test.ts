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

// In place: the same frozen own data and the same refusals as the copy.
test('in-place freezing matches the copy on real actors and refuses the same inputs',async()=>{
 const {frozenDataInPlace297}=await import('../src/bridge/core-frozen-copy-297.ts');
 const w=deconstructionCamp(3,32);
 for(const value of [w.pawns,w.wildlife?.animals??[],w.mechanoids??[],{a:[1,{b:'x'}],c:null,d:undefined}]){
  const source=structuredClone(value),expected=outcome(()=>frozenDataCopy297(structuredClone(value)));
  const frozen=frozenDataInPlace297(source);expect(frozen).toBe(source);expect(outcome(()=>frozen)).toBe(expected);
 }
 const accessor={};Object.defineProperty(accessor,'x',{enumerable:true,get:()=>1});
 const hidden={};Object.defineProperty(hidden,'x',{enumerable:false,value:1});
 const holes=[1,,3];const extra=Object.assign([1,2],{k:3});
 const cycle:Record<string,unknown>={};cycle.self=cycle;
 const deep:Record<string,unknown>={};let cur=deep;for(let i=0;i<30;i++){const next={};cur.n=next;cur=next;}
 class Custom{a=1}
 for(const make of [()=>accessor,()=>hidden,()=>({[Symbol('s')]:1}),()=>holes,()=>extra,()=>cycle,()=>deep,()=>new Custom(),()=>({n:NaN}),()=>({f:()=>1}),()=>new Float32Array(2),()=>[Infinity],()=>({ok:{x:1},bad:{n:-Infinity}})]){
  const copied=outcome(()=>frozenDataCopy297(make())),inPlace=outcome(()=>frozenDataInPlace297(make()));
  expect(inPlace.startsWith('throw:')).toBe(copied.startsWith('throw:'));if(copied.startsWith('throw:'))expect(inPlace).toBe(copied);
 }
});
