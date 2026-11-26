import {expect,test} from 'vitest';
import {encodeCorePhaseWire379,decodeOwnedCorePhaseWire379,CORE_PHASE_GRAPH_FORMAT379,type CorePhaseWire379} from '../src/bridge/core-phase-wire-379';
import {captureNativeMessageForDeferred297,isCapturedCoreData297} from '../src/bridge/native-message-capture';
import {readCorePhaseData297} from '../src/bridge/core-phase-data-297';
import {readNativeCorePhaseInput297} from '../src/bridge/native-clone-resident';
import {expandCorePhaseWire379} from '../scripts/expand-core-phase-wire-379';
import type {CorePhaseEnvelope297} from '../src/bridge/core-phase-projection-297';

const phase=(type:CorePhaseEnvelope297['type']='actor-frontier-297'):CorePhaseEnvelope297=>({type,audioCues:[],epoch:1,mapId:0,baseRevision:1,phaseSeq:1,nextId:100,fromCore:200,toCore:type==='actor-phase-297'?201:230,speed:1,actors:[{kind:'human',id:7,index:0,fields:{x:11,z:10,state:'moving',moveCooldown:0,planCooldown:0,path:[]}}],tracks:[],projectiles:{upserted:[],removed:[]}});
const anchor={epoch:1,mapId:0,revision:1,core:200,width:32,height:32,nextId:100,layout:{human:[7],animal:[],mechanical:[]}};
const pack=(input:unknown)=>{const result=encodeCorePhaseWire379(input as CorePhaseEnvelope297);if(!result)throw Error('Expected graph packing');return result;};
const transfer=(input:unknown)=>{const result=pack(input),received=structuredClone(result.message,{transfer:result.transfer});expect(result.transfer.every(b=>b.byteLength===0)).toBe(true);return received;};
/** Pinned capture proof observes actual prototypes, descriptor flags, own key
 * order, exact doubles and within-graph alias topology. No JSON witness. */
function equivalent(a:unknown,b:unknown,frozen:boolean):void {
 const left=new WeakMap<object,object>(),right=new WeakMap<object,object>();
 function walk(x:unknown,y:unknown):void {
  if(x===null||y===null||typeof x!=='object'||typeof y!=='object'){expect(Object.is(x,y)).toBe(true);return;}
  if(left.has(x)){expect(left.get(x)).toBe(y);expect(right.get(y)).toBe(x);return;}
  expect(right.has(y)).toBe(false);left.set(x,y);right.set(y,x);
  expect(Object.getPrototypeOf(x)).toBe(Object.getPrototypeOf(y));expect(Object.isFrozen(x)).toBe(frozen);expect(Object.isFrozen(y)).toBe(frozen);
  const keys=Reflect.ownKeys(x);expect(keys).toEqual(Reflect.ownKeys(y));
  for(const k of keys){const A=Object.getOwnPropertyDescriptor(x,k)!,B=Object.getOwnPropertyDescriptor(y,k)!;
   expect([A.enumerable,A.writable,A.configurable,Object.hasOwn(A,'value')]).toEqual([B.enumerable,B.writable,B.configurable,true]);walk(A.value,B.value);}
 }
 walk(a,b);
}

test.each(['actor-frontier-297','actor-phase-297'] as const)('private graph wire reconstructs %s and keeps downstream semantic validator/receipt separate',type=>{
 const input=phase(type),wire=transfer(input),raw=expandCorePhaseWire379(wire),held=captureNativeMessageForDeferred297(wire),expected=captureNativeMessageForDeferred297(input);
 equivalent(raw,structuredClone(input),false);equivalent(held,expected,true);
 expect(isCapturedCoreData297(wire)).toBe(false);expect(isCapturedCoreData297(held)).toBe(true);expect(readNativeCorePhaseInput297(held)).toBeUndefined();
 expect(readCorePhaseData297(held,anchor,200,1,100,new Set(),'frontier')).toBe(held);
 const wrong=transfer({...input,phaseSeq:2}),bad=captureNativeMessageForDeferred297(wrong);
 expect(()=>readCorePhaseData297(bad,anchor,200,1,100,new Set(),'frontier')).toThrow('header/predecessor');
});

test('raw alias graph, exact own undefined, signed zero, poison own keys and Native occurrence normalization',()=>{
 const poison=JSON.parse('{"z":1,"10":10,"2":2,"__proto__":{"p":1},"constructor":{"prototype":{"p":2}}}');poison.value=undefined;poison.zero=-0;
 const shared={poison,list:[-0,undefined,true,null,false]},input={...phase(),payload:{one:shared,two:shared,child:shared.list}};
 const wire=transfer(input),raw=expandCorePhaseWire379(wire),held=captureNativeMessageForDeferred297(wire) as typeof input,expected=captureNativeMessageForDeferred297(input);
 equivalent(raw,structuredClone(input),false);equivalent(held,expected,true);
 expect(raw.payload.one).toBe(raw.payload.two);expect(raw.payload.one.list).toBe(raw.payload.child);
 expect(held.payload.one).not.toBe(held.payload.two);expect(held.payload.one.list).not.toBe(held.payload.child);
 expect(Object.hasOwn(held.payload.one.poison,'value')).toBe(true);expect(Object.is(held.payload.one.poison.zero,-0)).toBe(true);expect(Object.hasOwn(held.payload.one.poison,'__proto__')).toBe(true);
 // A later listener may mutate the delivered wire; the owned capture never
 // retains it, any of its buffers, or a mutable dictionary reference.
 new Float64Array(wire.phaseWire379.numbers).fill(0);(wire.phaseWire379.strings as string[]).fill('changed');equivalent(held,expected,true);
});

test('unsupported source descriptors, cycles, holes, numbers and depth use literal fallback without invoking getters',()=>{
 let reads=0;const accessor={};Object.defineProperty(accessor,'x',{enumerable:true,get(){reads++;throw Error('getter');}});
 const hidden=Object.defineProperty({},'x',{value:1}),symbol={[Symbol('x')]:1},cycle:Record<string,unknown>={};cycle.self=cycle;
 let deep:unknown=0;for(let i=0;i<25;i++)deep=[deep];
 const bad=[accessor,hidden,symbol,cycle,[1,,3],Object.assign([1],{extra:2}),Object.create(null),new Date(),Infinity,NaN,1n,deep,new Float32Array(1)];
 for(const payload of bad)expect(encodeCorePhaseWire379({...phase(),payload} as unknown as CorePhaseEnvelope297)).toBeUndefined();expect(reads).toBe(0);
});

function rejected(wire:unknown):void {expect(()=>captureNativeMessageForDeferred297(wire)).toThrow();expect(isCapturedCoreData297(wire)).toBe(false);}
function manual(words:number[],numbers:number[],strings:string[],shapes:string[][]):CorePhaseWire379 {
 return {type:'actor-frontier-297',toCore:230,phaseWire379:{format:CORE_PHASE_GRAPH_FORMAT379,words:new Int32Array(words).buffer,numbers:new Float64Array(numbers).buffer,strings,shapes}};
}
const tag=(code:number,arg=0)=>(code<<28)|arg;
const head=[tag(6),tag(1),tag(0)],dict=['actor-frontier-297'],shapes=[['type','toCore','payload']];
test('malformed wire header, payload extent, unknown tags, cyclic/backwards references and nonfinite numbers never mark data',()=>{
 const valid=()=>transfer(phase());let wire=valid();rejected({...wire,toCore:231});rejected({...wire,type:'actor-phase-297'});rejected({...wire,extra:true});
 wire=valid();rejected({...wire,phaseWire379:{...wire.phaseWire379,format:'unknown'}});
 wire=valid();new Float64Array(wire.phaseWire379.numbers)[0]=Infinity;rejected(wire);
 wire=valid();new Int32Array(wire.phaseWire379.words)[0]=tag(15);rejected(wire);
 for(const token of [tag(8,0),tag(8,100),tag(2,1),tag(9),tag(1,100),tag(0,2),tag(7,100)])rejected(manual([...head,token],[230],dict,shapes));
 rejected(manual([...head,tag(3),tag(3)],[230],dict,shapes));rejected(manual([...head,tag(3)],[230,1],dict,shapes));
 rejected(manual([...head,tag(3)],[230],[...dict,'unused'],shapes));
 rejected(manual([...head,tag(3)],[230],dict,[...shapes,['unused']]));
});

test('strict dictionaries and buffers reject accessors, holes, duplicate/out-of-order keys, custom prototypes, detached or shared memory',()=>{
 const valid=()=>transfer(phase());let reads=0;
 let wire=valid(),section={...wire.phaseWire379};Object.defineProperty(section,'shapes',{enumerable:true,get(){reads++;throw Error('getter');}});rejected({...wire,phaseWire379:section});expect(reads).toBe(0);
 wire=valid();const inherited=Object.assign(Object.create(null),wire.phaseWire379);rejected({...wire,phaseWire379:inherited});
 wire=valid();rejected({...wire,phaseWire379:{...wire.phaseWire379,strings:[...wire.phaseWire379.strings,wire.phaseWire379.strings[0]]}});
 rejected(manual([...head,tag(3)],[230],dict,[['type','toCore','payload','payload']]));
 rejected(manual([...head,tag(3)],[230],dict,[['type','toCore','2']]));
 wire=valid();rejected({...wire,phaseWire379:{...wire.phaseWire379,shapes:[,]}});
 wire=valid();Object.defineProperty(wire.phaseWire379.words,'extra',{value:1});rejected(wire);
 wire=valid();rejected({...wire,phaseWire379:{...wire.phaseWire379,words:new Int32Array(wire.phaseWire379.words)}});
 if(typeof SharedArrayBuffer==='function'){wire=valid();rejected({...wire,phaseWire379:{...wire.phaseWire379,words:new SharedArrayBuffer(4)}});}
 wire=valid();structuredClone(wire.phaseWire379.words,{transfer:[wire.phaseWire379.words]});rejected(wire);
});

test('changed platform prototypes decline wire before inherited setter; historical literal capture still works',()=>{
 const wire=transfer(phase()),key='wireCapturePoison379';let reads=0,refused=false;
 try{Object.defineProperty(Object.prototype,key,{configurable:true,set(){reads++;}});try{captureNativeMessageForDeferred297(wire);}catch{refused=true;}
  const literal={...phase()};Object.defineProperty(literal,key,{value:1,enumerable:true});captureNativeMessageForDeferred297(literal);
 }finally{Reflect.deleteProperty(Object.prototype,key);}
 expect(refused).toBe(true);expect(reads).toBe(0);
});

test('a trap changing prototypes during compact extraction neither invokes a new setter nor an external iterator',()=>{
 const wire=transfer(phase()),original=Object.getOwnPropertyDescriptor(Array.prototype,Symbol.iterator)!,key='words';let setters=0,iterators=0,mutated=false,refused=false;
 const rawSection=wire.phaseWire379,section=new Proxy(rawSection,{getOwnPropertyDescriptor(target,field){
  if(field==='words'&&!mutated){mutated=true;Object.defineProperty(Object.prototype,key,{configurable:true,set(){setters++;}});Object.defineProperty(Array.prototype,Symbol.iterator,{configurable:true,writable:true,value:function(){iterators++;throw Error('external iterator');}});}
  return Reflect.getOwnPropertyDescriptor(target,field);
 }});
 try{captureNativeMessageForDeferred297({...wire,phaseWire379:section});}catch{refused=true;}
 finally{Object.defineProperty(Array.prototype,Symbol.iterator,original);Reflect.deleteProperty(Object.prototype,key);}
 expect(mutated).toBe(true);expect(refused).toBe(true);expect(setters).toBe(0);expect(iterators).toBe(0);expect(isCapturedCoreData297(wire)).toBe(false);
});

test('compact capture is reentrant, detached, and uses captured array constructors after extraction',()=>{
 const a=transfer(phase()),b=transfer({...phase(),toCore:231}),original=globalThis.Array;let nested:unknown,entered=false,constructed=0,held:unknown;
 const section=new Proxy(a.phaseWire379,{getOwnPropertyDescriptor(target,key){
  if(key==='strings'&&!entered){entered=true;nested=captureNativeMessageForDeferred297(b);globalThis.Array=(function(){constructed++;throw Error('unexpected Array constructor');}) as unknown as ArrayConstructor;}
  return Reflect.getOwnPropertyDescriptor(target,key);
 }});
 try{held=captureNativeMessageForDeferred297({...a,phaseWire379:section});}finally{globalThis.Array=original;}
 expect(entered).toBe(true);expect(constructed).toBe(0);expect(isCapturedCoreData297(nested)).toBe(true);expect(isCapturedCoreData297(held)).toBe(true);expect(held).not.toBe(nested);
 expect((held as CorePhaseEnvelope297).toCore).toBe(230);expect((nested as CorePhaseEnvelope297).toCore).toBe(231);
});

test('actual normalized depth and node budget (including repeated raw occurrences) are not relaxed by compression',()=>{
 const deep=manual([...head,...Array(25).fill(tag(7,1)),tag(3)],[230],dict,shapes);expect(()=>decodeOwnedCorePhaseWire379(deep)).toThrow('budget');rejected(deep);
 const B=1048576,count=B-4,words=new Int32Array(B);words.set([...head,tag(7,count)]);words.fill(tag(3),4);
 const limit={type:'actor-frontier-297',toCore:230,phaseWire379:{format:CORE_PHASE_GRAPH_FORMAT379,words:words.buffer,numbers:new Float64Array([230]).buffer,strings:dict,shapes}};
 const captured=decodeOwnedCorePhaseWire379(limit) as {payload:readonly unknown[]};expect(captured.payload.length).toBe(count);expect(Object.isFrozen(captured.payload)).toBe(true);
 // Few thousand tokens can describe more than the 1M occurrence budget.
 // Every ref charges the ENTIRE normalized subtree before acquiring a copy.
 const bomb=manual([...head,tag(7,1025),tag(7,1024),...Array(1024).fill(tag(3)),...Array(1024).fill(tag(8,2))],[230],dict,shapes);
 expect(()=>decodeOwnedCorePhaseWire379(bomb)).toThrow('budget');
 const child=Array(1024).fill(null),payload=Array(1025).fill(child);expect(encodeCorePhaseWire379({...phase(),payload} as unknown as CorePhaseEnvelope297)).toBeUndefined();
});
