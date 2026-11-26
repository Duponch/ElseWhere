import {expect,test} from 'vitest';
import {copyCoreData297} from '../src/bridge/core-phase-data-297.ts';
import {frozenDataCopy297} from '../src/bridge/core-phase-owner-297.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {CORE_ANIMAL_OPTIONAL297,CORE_ANIMAL_REQUIRED297,CORE_HUMAN_OPTIONAL297,CORE_HUMAN_REQUIRED297,CORE_MECH_OPTIONAL297,CORE_MECH_REQUIRED297} from '../src/bridge/core-phase-projection-297.ts';

// The faster actor copy must be indistinguishable from the pinned copyCoreData297.
const deepFrozen=(v:unknown):boolean=>v===null||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v as object).every(deepFrozen);
const outcome=(f:()=>unknown):string=>{try{const r=f();return 'ok:'+JSON.stringify(r)+':'+deepFrozen(r);}catch(e){return 'throw:'+(e as Error).message;}};

test('each actor projection declares a single ordered occurrence of every required or optional key',()=>{
 for(const [required,optional] of [[CORE_HUMAN_REQUIRED297,CORE_HUMAN_OPTIONAL297],[CORE_ANIMAL_REQUIRED297,CORE_ANIMAL_OPTIONAL297],[CORE_MECH_REQUIRED297,CORE_MECH_OPTIONAL297]]){
  const all=[...required,...optional];expect(new Set(all).size).toBe(all.length);
 }
});

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

// The publisher's actor capture must be indistinguishable from the pinned captureCoreActor297.
test('fast actor capture matches captureCoreActor297 on real actors and refuses the same inputs',async()=>{
 const {captureCoreActor297}=await import('../src/bridge/core-phase-data-297.ts');
 const {captureCoreActorFast297}=await import('../src/bridge/core-frozen-copy-297.ts');
 const w=deconstructionCamp(3,32);
 const actors:[('human'|'animal'|'mechanical'),unknown][]=[...w.pawns.map(p=>['human',p] as ['human',unknown]),...(w.wildlife?.animals??[]).map(a=>['animal',a] as ['animal',unknown]),...(w.mechanoids??[]).map(m=>['mechanical',m] as ['mechanical',unknown])];
 expect(actors.length).toBeGreaterThan(0);
 const both=(kind:'human'|'animal'|'mechanical',index:number,actor:unknown)=>[outcome(()=>captureCoreActorFast297(kind as 'human',index,actor as never)),outcome(()=>captureCoreActor297(kind as 'human',index,actor as never))];
 for(const [i,[kind,actor]] of actors.entries()){const [fast,pinned]=both(kind,i,actor);expect(fast).toBe(pinned);expect(fast.startsWith('ok:')).toBe(true);}
 const pawn=structuredClone(w.pawns[0]!) as unknown as Record<string,unknown>;
 const missing={...pawn};delete missing.path;
 const accessor={...pawn};Object.defineProperty(accessor,'state',{enumerable:true,get:()=>'idle'});
 const hidden={...pawn};Object.defineProperty(hidden,'x',{enumerable:false,value:1});
 const nonData={...pawn,motion:{f:()=>1}};
 for(const bad of [missing,accessor,hidden,nonData]){const [fast,pinned]=both('human',0,bad);expect(fast).toBe(pinned);expect(fast.startsWith('throw:')).toBe(true);}
 const fast=captureCoreActorFast297('human',0,w.pawns[0]!),pinned=captureCoreActor297('human',0,w.pawns[0]!);
 expect(Reflect.ownKeys(fast.fields)).toEqual(Reflect.ownKeys(pinned.fields));
 for(const key of Reflect.ownKeys(pinned.fields))expect(Object.getOwnPropertyDescriptor(fast.fields,key)).toEqual(Object.getOwnPropertyDescriptor(pinned.fields,key));
});

test('actor descriptor snapshots preserve nested depth bounds, numeric refusals and accessor ordering',async()=>{
 const {captureCoreActor297}=await import('../src/bridge/core-phase-data-297.ts');
 const {captureCoreActorFast297}=await import('../src/bridge/core-frozen-copy-297.ts');
 const pawn={id:7,x:1,z:1,state:'idle',moveCooldown:0,planCooldown:0,path:[]};
 const compare=(actor:unknown,index=0)=>{
  const expected=outcome(()=>captureCoreActor297('human',index,actor as never));
  expect(outcome(()=>captureCoreActorFast297('human',index,actor as never))).toBe(expected);
  return expected;
 };
 for(let depth=18;depth<=26;depth++){
  let motion:unknown=1;for(let i=0;i<depth;i++)motion={next:motion};
  compare({...pawn,motion});
 }
 for(const value of [NaN,Infinity,-Infinity]){
  expect(compare({...pawn,id:value})).toContain('Nonfinite Core phase number');
  expect(compare(pawn,value)).toContain('Nonfinite Core phase number');
 }
 let reads=0;const bad={...pawn};
 Object.defineProperty(bad,'moveCooldown',{enumerable:true,get(){reads++;throw Error('getter ran');}});
 expect(compare(bad)).toContain('Physical actor field is not own data');expect(reads).toBe(0);
 const nested={};Object.defineProperty(nested,'hidden',{value:1});
 expect(compare({...pawn,motion:nested})).toContain('Core phase requires plain own data');
});
