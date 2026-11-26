import {expect,test} from 'vitest';
import {createConstructionValidators379,validConstructionTransport379,validateConstructionForbid379} from '../src/sim/construction-forbid-save-379.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';

function native<T>(source:T){
 const value=structuredClone(source),known=new WeakSet<object>();
 const enroll=(v:unknown):void=>{
  if(!v||typeof v!=='object'||known.has(v))return;known.add(v);
  for(const key of Reflect.ownKeys(v)){
   const d=Object.getOwnPropertyDescriptor(v,key);if(d&&Object.hasOwn(d,'value'))enroll(d.value);
  }
 };
 enroll(value);return {value,known,validators:createConstructionValidators379(v=>known.has(v))};
}

test('native ordinary leaves match strict admission before and after same-object edits',()=>{
 const h=native({resources:[{id:1,kind:'tree',growth:.5},{id:2,kind:'rock'}],structures:[{id:3,kind:'wall'}],piles:[{id:4,quantity:3}]}),
  check=()=>expect(h.validators.transport(h.value,379)).toBe(validConstructionTransport379(h.value,379));
 check();expect(h.validators.transport(h.value,379)).toBe(true);
 const leaf=h.value.resources[0]! as Record<string,unknown>;
 for(const key of ['forbidden379','tailorSteel379','constructionBatch379','haulOpportunity379','jobs','resources','plan','destinations']){
  Object.defineProperty(leaf,key,{value:undefined,configurable:true,enumerable:false});check();expect(h.validators.transport(h.value,379)).toBe(false);delete leaf[key];check();
 }
 leaf.forbidden379=true;check();expect(h.validators.transport(h.value,379)).toBe(false);delete leaf.forbidden379;check();
});

test('hidden/accessor/inherited relevant fields preserve strict rejection without invoking getters',()=>{
 for(const key of ['forbidden379','tailorSteel379','constructionBatch379','haulOpportunity379','jobs']){
  const h=native({resources:[{id:1}]}),leaf=h.value.resources[0]!;let reads=0;
  Object.defineProperty(leaf,key,{configurable:true,enumerable:true,get(){reads++;throw Error('must not read');}});
  expect(h.validators.transport(h.value,379)).toBe(validConstructionTransport379(h.value,379));expect(h.validators.transport(h.value,379)).toBe(false);expect(reads).toBe(0);
  delete (leaf as Record<string,unknown>)[key];Object.setPrototypeOf(leaf,Object.create(Object.prototype,{[key]:{get(){reads++;throw Error('must not read');}}}));
  expect(h.validators.transport(h.value,379)).toBe(validConstructionTransport379(h.value,379));expect(h.validators.transport(h.value,379)).toBe(false);expect(reads).toBe(0);
 }
 const h=native({resources:[{id:1}]}),leaf=h.value.resources[0]!;let reads=0;
 Object.defineProperty(leaf,'unrelated',{get(){reads++;throw Error('unrelated accessor');}});
 expect(h.validators.transport(h.value,379)).toBe(true);expect(validConstructionTransport379(h.value,379)).toBe(true);expect(reads).toBe(0);
});

test('prototype facts remain live when an unwitnessed traversal callback mutates a later leaf',()=>{
 const run=(fast:boolean):boolean=>{
  const h=native({resources:[{id:1}]}),root={world:new Proxy({}, {getOwnPropertyDescriptor(target,key){
   if(key==='destinations')Object.defineProperty(Object.prototype,'forbidden379',{value:true,configurable:true});
   return Reflect.getOwnPropertyDescriptor(target,key);
  }}),resources:h.value.resources};
  try{return fast?h.validators.transport(root,379):validConstructionTransport379(root,379);}
  finally{delete (Object.prototype as Record<string,unknown>).forbidden379;}
 };
 expect(run(true)).toBe(run(false));expect(run(true)).toBe(false);
});

test('live prototype pollution and removed pollution never grant a retained leaf proof',()=>{
 const h=native({resources:[{id:1}]});expect(h.validators.transport(h.value,379)).toBe(true);
 try{
  Object.defineProperty(Object.prototype,'resources',{value:undefined,configurable:true});
  expect(h.validators.transport(h.value,379)).toBe(validConstructionTransport379(h.value,379));expect(h.validators.transport(h.value,379)).toBe(false);
 }finally{delete (Object.prototype as Record<string,unknown>).resources;}
 expect(h.validators.transport(h.value,379)).toBe(true);
});

test('unwitnessed proxies preserve the original trap order and role admission',()=>{
 const run=(fast:boolean)=>{
  const calls:string[]=[],target={kind:'wall',construction:'blueprint',forbidden379:true},proxy=new Proxy(target,{
   has(t,key){calls.push(`has:${String(key)}`);return Reflect.has(t,key);},
   getOwnPropertyDescriptor(t,key){calls.push(`descriptor:${String(key)}`);return Reflect.getOwnPropertyDescriptor(t,key);},
   ownKeys(t){calls.push('keys');return Reflect.ownKeys(t);},getPrototypeOf(t){calls.push('prototype');return Reflect.getPrototypeOf(t);},
  }),validators=createConstructionValidators379(()=>false),raw={jobs:[proxy],structures:[proxy]};
  return {result:fast?validators.transport(raw,379):validConstructionTransport379(raw,379),calls};
 };
 expect(run(true)).toEqual(run(false));expect(run(true).result).toBe(false);
});

test('version admission precedes the witness and world admission retains actual execution rules',()=>{
 let calls=0;const validators=createConstructionValidators379(()=>{calls++;return true;});
 for(const version of [0,-1,1.5,NaN,SCHEMA_VERSION+1]){expect(validators.transport({},version)).toBe(false);expect(calls).toBe(0);}
 const h=native({jobs:[{id:1,kind:'wall',construction:'blueprint',forbidden379:true}],pawns:[{jobId:1,clearance:false,haul:null,orders:{queue:[]}}]}),world=h.value as unknown as World;
 expect(h.validators.world(world,379)).toEqual(validateConstructionForbid379(world,379));
 expect(h.validators.world(world,379)).toContain('Forbidden construction retains active execution or delivery.');
 expect(h.validators.world(world,378)).toEqual(validateConstructionForbid379(world,378));
});

test('shared ordinary aliases retain independent traversal roles and cycle refusals',()=>{
 const leaf={id:1,kind:'wall',construction:'blueprint'},h=native({world:{jobs:[leaf]},summary:{structures:[leaf]},resources:[leaf]});
 expect(h.value.world.jobs[0]).toBe(h.value.summary.structures[0]);
 expect(h.validators.transport(h.value,379)).toBe(validConstructionTransport379(h.value,379));
 expect(h.validators.transport(h.value,379)).toBe(true);
 Object.assign(h.value.world.jobs[0]!,{forbidden379:true});
 expect(h.validators.transport(h.value,379)).toBe(validConstructionTransport379(h.value,379));
 expect(h.validators.transport(h.value,379)).toBe(false);
 const cycle=native({resources:[] as unknown[]});cycle.value.resources.push(cycle.value);
 expect(cycle.validators.transport(cycle.value,379)).toBe(validConstructionTransport379(cycle.value,379));
 expect(cycle.validators.transport(cycle.value,379)).toBe(false);
});

test('a leaf proved in one role cannot hide a later mutation before another role in the same traversal',()=>{
 const run=(fast:boolean)=>{
  const h=native({id:1,kind:'wall',construction:'blueprint'}),leaf=h.value;
  const summary=new Proxy({structures:[leaf]},{getOwnPropertyDescriptor(target,key){
   if(key==='forbidden379')Object.assign(leaf,{forbidden379:true});
   return Reflect.getOwnPropertyDescriptor(target,key);
  }});
  const raw={world:{jobs:[leaf]},summary};
  return fast?h.validators.transport(raw,379):validConstructionTransport379(raw,379);
 };
 expect(run(true)).toBe(run(false));expect(run(true)).toBe(false);
});

test('a later inherited marker is still seen for a shared leaf in a different role',()=>{
 const run=(fast:boolean)=>{
  const h=native({id:1,kind:'wall',construction:'blueprint'}),leaf=h.value;
  const summary=new Proxy({structures:[leaf]},{getOwnPropertyDescriptor(target,key){
   // The wrapper's marker checks have finished, but its shared structure
   // has not been visited yet. The last lane would mutate too late.
   if(key==='structures')Object.defineProperty(Object.prototype,'forbidden379',{value:true,configurable:true});
   return Reflect.getOwnPropertyDescriptor(target,key);
  }});
  try{return fast?h.validators.transport({world:{jobs:[leaf]},summary},379):validConstructionTransport379({world:{jobs:[leaf]},summary},379);}
  finally{delete (Object.prototype as Record<string,unknown>).forbidden379;}
 };
 expect(run(true)).toBe(run(false));expect(run(true)).toBe(false);
});
