import type {CorePhaseEnvelope297} from './core-phase-projection-297';

/** Fixed Worker wire representation only. It neither grants Native authority
 * nor changes the canonical Core phase envelope, predecessor, or cadence.
 * Each packet is self-contained. All doubles and ordered own-data shapes are
 * exact, including own undefined and the original graph's shared references. */
export const CORE_PHASE_GRAPH_FORMAT379='core-phase-graph-379-1' as const;
export interface CorePhaseWire379 {
 readonly type:CorePhaseEnvelope297['type'];readonly toCore:number;
 readonly phaseWire379:{readonly format:typeof CORE_PHASE_GRAPH_FORMAT379;readonly words:ArrayBuffer;readonly numbers:ArrayBuffer;readonly strings:readonly string[];readonly shapes:readonly (readonly string[])[]};
}
const MAX_NODES=1048576,MAX_DEPTH=24,LOW=0xfffffff;
const NUMBER=0,STRING=1,UNDEFINED=2,NULL=3,FALSE=4,TRUE=5,OBJECT=6,ARRAY=7,REFERENCE=8;
const ownKeys=Reflect.ownKeys,keysOf=Object.keys,descriptor=Object.getOwnPropertyDescriptor,proto=Object.getPrototypeOf,own=Object.hasOwn,freeze=Object.freeze,define=Object.defineProperty,create=Object.create,same=Object.is;
const ObjectPrototype=Object.prototype,ArrayPrototype=Array.prototype,BufferPrototype=ArrayBuffer.prototype;
const isArray=Array.isArray,ArrayType=Array,arrayJoin=Array.prototype.join,finite=Number.isFinite,safeInteger=Number.isSafeInteger,max=Math.max,IntWords=Int32Array,DoubleWords=Float64Array;
const bufferLength=descriptor(BufferPrototype,'byteLength')!.get!,bufferResizable=descriptor(BufferPrototype,'resizable')?.get;
const typedLength=descriptor(proto(IntWords.prototype),'length')!.get!;
const copyWords=IntWords.prototype.set,copyNumbers=DoubleWords.prototype.set;
const SetType=Set,setHas=Set.prototype.has,setAdd=Set.prototype.add;
const unsupported=Symbol('Unsupported Core phase graph');
const phaseType=(v:unknown):v is CorePhaseEnvelope297['type']=>v==='actor-frontier-297'||v==='actor-phase-297';
function sameKeys(a:readonly PropertyKey[],b:readonly PropertyKey[]):boolean {if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
type SourceObject={id:number;nodes:number;height:number};

/** The real prepared phase already owns its detached data. The writer also
 * rechecks the graph domain during its one packing walk, so an unsupported
 * shape, cycle, number or extent retains the exact ordinary literal path. */
export function encodeCorePhaseWire379(packet:CorePhaseEnvelope297):{readonly message:CorePhaseWire379;readonly transfer:ArrayBuffer[]}|undefined {
 try{
  const type=descriptor(packet,'type'),toCore=descriptor(packet,'toCore');
  if(!type?.enumerable||!own(type,'value')||!phaseType(type.value)||!toCore?.enumerable||!own(toCore,'value')||typeof toCore.value!=='number'||!finite(toCore.value))return;
  const words:number[]=[],numbers:number[]=[],strings:string[]=[],shapes:string[][]=[],stringIds=new Map<string,number>(),shapeIds=new Map<string,number>(),objects=new WeakMap<object,SourceObject>();
  let objectCount=0,left=MAX_NODES;
  const put=(tag:number,data=0)=>{if(data>LOW)throw unsupported;words.push((tag<<28)|data);};
  function walk(v:unknown,depth:number):number {
   if(--left<0||depth>MAX_DEPTH)throw unsupported;
   if(v===undefined){put(UNDEFINED);return 0;}if(v===null){put(NULL);return 0;}if(v===false){put(FALSE);return 0;}if(v===true){put(TRUE);return 0;}
   if(typeof v==='number'){if(!finite(v))throw unsupported;put(NUMBER,numbers.length);numbers.push(v);return 0;}
   if(typeof v==='string'){let id=stringIds.get(v);if(id===undefined){id=strings.length;stringIds.set(v,id);strings.push(v);}put(STRING,id);return 0;}
   if(typeof v!=='object')throw unsupported;
   const before=objects.get(v);
   if(before){if(!before.nodes||(left-=before.nodes-1)<0||depth+before.height>MAX_DEPTH)throw unsupported;put(REFERENCE,before.id);return before.height;}
   const entry:SourceObject={id:objectCount++,nodes:0,height:0};objects.set(v,entry);
   const start=left;let height=0;
   if(isArray(v)){
    const length=v.length;if(proto(v)!==ArrayPrototype||length>left||ownKeys(v).length!==length+1)throw unsupported;put(ARRAY,length);
    for(let i=0;i<length;i++){const d=descriptor(v,i);if(!d?.enumerable||!own(d,'value'))throw unsupported;height=max(height,1+walk(d.value,depth+1));}
   }else{
    if(proto(v)!==ObjectPrototype)throw unsupported;
    const keys=ownKeys(v);if(keys.length>left)throw unsupported;
    let layout:string[]|undefined;for(const key of keys)if(typeof key!=='string')throw unsupported;else (layout??=[]).push(key);
    const shape=layout??[],name=shape.join('\0');let id=shapeIds.get(name);
    if(id===undefined){id=shapes.length;shapeIds.set(name,id);shapes.push(shape);}else if(!sameKeys(shape,shapes[id]!))throw unsupported;
    put(OBJECT,id);
    for(const key of shape){const d=descriptor(v,key);if(!d?.enumerable||!own(d,'value'))throw unsupported;height=max(height,1+walk(d.value,depth+1));}
   }
   entry.nodes=1+start-left;entry.height=height;return height;
  }
  walk(packet,0);
  const packedWords=new IntWords(words).buffer as ArrayBuffer,packedNumbers=new DoubleWords(numbers).buffer as ArrayBuffer;
  return {message:{type:type.value,toCore:toCore.value,phaseWire379:{format:CORE_PHASE_GRAPH_FORMAT379,words:packedWords,numbers:packedNumbers,strings,shapes}},transfer:[packedWords,packedNumbers]};
 }catch{return undefined;}
}

// Native representation capture: only the original Object/Array data
// intrinsics can use assignment to our new records. A changed prototype
// declines the compact format without reading any inherited accessor.
const platform=[ObjectPrototype,ArrayPrototype].map(value=>{const keys=ownKeys(value);return {value,prototype:proto(value),keys,fields:keys.map(key=>descriptor(value,key)!)};});
function ordinaryPlatform():boolean {
 // Do not enter the potentially replaced iterator before checking it.
 for(let i=0;i<platform.length;i++){const p=platform[i]!;
  if(proto(p.value)!==p.prototype||!sameKeys(ownKeys(p.value),p.keys))return false;
  for(let at=0;at<p.keys.length;at++){const a=descriptor(p.value,p.keys[at]!)!,b=p.fields[at]!;if(!same(a.value,b.value)||a.get!==b.get||a.set!==b.set||a.writable!==b.writable||a.enumerable!==b.enumerable||a.configurable!==b.configurable)return false;}
 }
 return true;
}
const fail=(reason:string):never=>{throw new Error('Invalid Core phase graph: '+reason);};
// All destinations of defineData are fresh, private ordinary records/arrays
// and all keys are primitive. Native DefineProperty can never call user code
// here, even when a Proxy reenters the decoder during a source read.
const dataDescriptor=create(null) as PropertyDescriptor;
dataDescriptor.writable=dataDescriptor.enumerable=dataDescriptor.configurable=true;
function defineData(target:object,key:PropertyKey,value:unknown):void {
 dataDescriptor.value=value;
 try{define(target,key,dataDescriptor);}finally{dataDescriptor.value=undefined;}
}
function fields(value:unknown,expected:readonly string[]):Record<string,unknown> {
 if(!value||typeof value!=='object'||proto(value)!==ObjectPrototype||!sameKeys(ownKeys(value),expected))return fail('record shape');
 const copy:Record<string,unknown>={};
 // A public Proxy trap can replace a prototype DURING discovery. The owned
 // scratch data must not enter any inherited setter or external iterator,
 // even on the path that will subsequently refuse the changed platform.
 for(let i=0;i<expected.length;i++){const key=expected[i]!,d=descriptor(value,key);if(!d?.enumerable||!own(d,'value'))return fail('record own data');defineData(copy,key,d.value);}
 return copy;
}
function dense(value:unknown,max:number):unknown[] {
 if(!isArray(value)||proto(value)!==ArrayPrototype)return fail('array shape');
 const length=descriptor(value,'length')?.value;if(!safeInteger(length)||length<0||length>max||ownKeys(value).length!==length+1)return fail('array extent');
 const out:unknown[]=new ArrayType(length);for(let i=0;i<length;i++){const d=descriptor(value,i);if(!d?.enumerable||!own(d,'value'))return fail('array own data');defineData(out,i,d.value);}return out;
}
function exactBuffer(value:unknown,unit:number):{buffer:ArrayBuffer;count:number} {
 if(!value||typeof value!=='object'||proto(value)!==BufferPrototype||ownKeys(value).length!==0)return fail('buffer shape');
 const length=bufferLength.call(value) as number;
 if(bufferResizable?.call(value)||length%unit!==0||length/unit>MAX_NODES)return fail('buffer extent');
 return {buffer:value as ArrayBuffer,count:length/unit};
}
function indexKey(key:string):number|undefined {
 // Only canonical uint32 indices sort ahead of ordinary insertion-order keys.
 const number=+key;return safeInteger(number)&&number>=0&&number<4294967295&&`${number}`===key?number:undefined;
}
function readShapes(value:unknown,max:number):string[][] {
 let left=MAX_NODES;const rows=dense(value,max),seen=new SetType<string>();
 for(let i=0;i<rows.length;i++){
  const row=dense(rows[i],left);left-=row.length;const unique=new SetType<string>();let last=-1,ordinary=false;
  for(let at=0;at<row.length;at++){const key=row[at];
   if(typeof key!=='string'||setHas.call(unique,key))return fail('shape key');setAdd.call(unique,key);
   const index=indexKey(key);if(index===undefined)ordinary=true;else if(ordinary||index<=last)return fail('shape key order');else last=index;
  }
  // Encode uses precisely one layout per signature; collision stays literal.
  const signature=arrayJoin.call(row,'\0');if(setHas.call(seen,signature))return fail('duplicate layout');setAdd.call(seen,signature);
  // dense created this own index before inspecting any child. Updating it
  // cannot enter an inherited setter, even if the next row has a Proxy trap.
  rows[i]=row;
 }
 return rows as string[][];
}

// These backing stores hold only numeric wire data for the synchronous
// capture. No returned value points into them. Bound the idle footprint to
// 384 KiB; unusually large packets and reentrant captures get private stores.
const MAX_SCRATCH_ELEMENTS=32768;
let residentWords=new IntWords(0),residentNumbers=new DoubleWords(0),scratchInUse=false;
function scratchCapacity(required:number):number {
 let capacity=256;
 while(capacity<required)capacity*=2;
 return capacity;
}

/** Exact old owned-Core tree normalization, including a distinct frozen
 * copy for each occurrence of a shared raw object. The native Event receipt
 * and the downstream core-phase-data predecessor/content validator are
 * deliberately NOT part of this representation function. */
export function decodeOwnedCorePhaseWire379(raw:unknown):object {
 if(!ordinaryPlatform())return fail('platform changed');
 const envelope=fields(raw,['type','toCore','phaseWire379']);
 if(!phaseType(envelope.type)||typeof envelope.toCore!=='number'||!finite(envelope.toCore))return fail('header');
 const section=fields(envelope.phaseWire379,['format','words','numbers','strings','shapes']);
 if(section.format!==CORE_PHASE_GRAPH_FORMAT379||section.words===section.numbers)return fail('format');
 const wordBuffer=exactBuffer(section.words,4),numberBuffer=exactBuffer(section.numbers,8);
 if(!wordBuffer.count)return fail('empty packet');
 // Native bulk copies detach the reader from the delivered message. No raw
 // buffer, array, dictionary record or trap is consulted after extraction.
 const inputWords=new IntWords(wordBuffer.buffer),inputNumbers=new DoubleWords(numberBuffer.buffer);
 if(typedLength.call(inputWords)!==wordBuffer.count||typedLength.call(inputNumbers)!==numberBuffer.count)return fail('detached buffer');
 const useResident=!scratchInUse&&wordBuffer.count<=MAX_SCRATCH_ELEMENTS&&numberBuffer.count<=MAX_SCRATCH_ELEMENTS;
 if(useResident)scratchInUse=true;
 try{
  if(useResident&&wordBuffer.count>typedLength.call(residentWords))residentWords=new IntWords(scratchCapacity(wordBuffer.count));
  if(useResident&&numberBuffer.count>typedLength.call(residentNumbers))residentNumbers=new DoubleWords(scratchCapacity(numberBuffer.count));
  const words=useResident?residentWords:new IntWords(wordBuffer.count),numbers=useResident?residentNumbers:new DoubleWords(numberBuffer.count);
  copyWords.call(words,inputWords);copyNumbers.call(numbers,inputNumbers);
  return readOwnedTree(envelope,section,words,wordBuffer.count,numbers,numberBuffer.count);
 }finally{if(useResident)scratchInUse=false;}
}

function readOwnedTree(envelope:Record<string,unknown>,section:Record<string,unknown>,words:Int32Array,wordCount:number,numbers:Float64Array,numberCount:number):object {
 const strings=dense(section.strings,wordCount),seenStrings=new SetType<string>();
 for(let i=0;i<strings.length;i++){const value=strings[i];if(typeof value!=='string'||setHas.call(seenStrings,value))return fail('string table');setAdd.call(seenStrings,value);}
 const shapes=readShapes(section.shapes,wordCount);
 if(!ordinaryPlatform())return fail('platform changed during extraction');
 // The public graph format permits aliases. In normal simulation the
 // prepared phases are already distinct occurrence trees. Index only the
 // prefix actually named by references in this packet. Never retain decoded
 // trees between captures or allocate a bookkeeping row for every record.
 let lastReference=-1;
 for(let i=0;i<wordCount;i++){const word=words[i]!;if(word>>>28===REFERENCE)lastReference=max(lastReference,word&LOW);}
 const objects:({value:object;nodes:number;height:number}|undefined)[]=[];
 let at=0,objectCount=0,numberAt=0,stringExtent=0,shapeExtent=0,left=MAX_NODES,lastHeight=0;
 const charge=(depth:number)=>{if(--left<0||depth>MAX_DEPTH)throw Error('Core phase payload budget exceeded');};
 const put=(row:Record<string,unknown>,key:string,value:unknown)=>{if(key==='__proto__')define(row,key,{value,writable:true,enumerable:true,configurable:true});else row[key]=value;};
 // Source is one of our own frozen, acyclic, already validated data trees.
 function duplicate(value:unknown):unknown {
  if(value===null||typeof value!=='object')return value;
  if(isArray(value)){const out:unknown[]=new ArrayType(value.length);for(let i=0;i<value.length;i++)out[i]=duplicate(value[i]);return freeze(out);}
  const row:Record<string,unknown>={};for(const key of keysOf(value))put(row,key,duplicate((value as Record<string,unknown>)[key]));return freeze(row);
 }
 function walk(depth:number):unknown {
  charge(depth);lastHeight=0;if(at>=wordCount)return fail('truncated data');
  const word=words[at++]!,tag=word>>>28,data=word&LOW;
  switch(tag){
   case NUMBER:if(data!==numberAt++||data>=numberCount||!finite(numbers[data]))return fail('number');return numbers[data];
   case STRING:if(data>stringExtent||data>=strings.length)return fail('string reference');if(data===stringExtent)stringExtent++;return strings[data];
   case UNDEFINED:if(data)return fail('constant');return undefined;
   case NULL:if(data)return fail('constant');return null;
   case FALSE:if(data)return fail('constant');return false;
   case TRUE:if(data)return fail('constant');return true;
   case REFERENCE:{
    const previous=data<objectCount&&own(objects,data)?objects[data]:undefined;if(!previous)return fail('cyclic/missing reference');
    // Charge the complete normalized occurrence before allocating any copy;
    // a tiny graph cannot use repeated aliases to exceed the old node bound.
    if((left-=previous.nodes-1)<0||depth+previous.height>MAX_DEPTH)throw Error('Core phase payload budget exceeded');lastHeight=previous.height;return duplicate(previous.value);
   }
   case ARRAY:{
    if(data>left||data>wordCount-at)return fail('array extent');
    const index=objectCount++,out:unknown[]=new ArrayType(data),start=left;let height=0;
    for(let i=0;i<data;i++){out[i]=walk(depth+1);height=max(height,lastHeight+1);}
    freeze(out);if(index<=lastReference)objects[index]={value:out,nodes:1+start-left,height};lastHeight=height;return out;
   }
   case OBJECT:{
    const keys=shapes[data];if(!keys||data>shapeExtent||keys.length>left||keys.length>wordCount-at)return fail('object extent');if(data===shapeExtent)shapeExtent++;
    const index=objectCount++,row:Record<string,unknown>={},start=left;let height=0;
    for(let i=0;i<keys.length;i++){put(row,keys[i]!,walk(depth+1));height=max(height,lastHeight+1);}
    freeze(row);if(index<=lastReference)objects[index]={value:row,nodes:1+start-left,height};lastHeight=height;return row;
   }
   default:return fail('unknown tag');
  }
 }
 const result=walk(0);
 if(at!==wordCount||numberAt!==numberCount||stringExtent!==strings.length||shapeExtent!==shapes.length)return fail('trailing data');
 if(!result||typeof result!=='object'||isArray(result)||!own(result,'type')||!own(result,'toCore')||(result as Record<string,unknown>).type!==envelope.type||!same((result as Record<string,unknown>).toCore,envelope.toCore))return fail('header mismatch');
 return result;
}
