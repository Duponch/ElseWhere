import {CORE_ANIMAL_OPTIONAL297,CORE_ANIMAL_REQUIRED297,CORE_HUMAN_OPTIONAL297,CORE_HUMAN_REQUIRED297,CORE_MECH_OPTIONAL297,CORE_MECH_REQUIRED297,type CoreActorProjection297} from './core-phase-projection-297';
import type {Pawn} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import {admitsActorRecordSource297,type ActorRecordSourceShape297} from '../sim/actor-record-source-297.ts';
/* Same contract as copyCoreData297 (pinned in core-phase-data-297.ts): the
 * same budget, depth, cycle, finite-number, dense-array and plain-own-data
 * rejections with the same messages, and an identical deeply frozen result
 * (same keys and order; frozen properties are non-writable/non-configurable).
 * It reads each property descriptor once and assigns before freezing instead
 * of two descriptor reads plus defineProperty per key, which made the actor
 * copy of every Full ~15% of the main thread on large colonies. */
export function frozenDataCopy297<T>(value:T):T {
 return copyFrozenData297(value);
}
/** Only captureActor supplies this private descriptor snapshot. Each actor
 * field is already checked as enumerable own data; its nested value still
 * gets the complete copy validation. The temporary field bag never escapes. */
type CapturedFields297={record:object;keys:readonly string[];values:readonly unknown[]};
declare const ownedDataBrand297:unique symbol;
export interface OwnedCoreSourceData297 {readonly [ownedDataBrand297]:true}
interface OwnedSourceData297 extends DataExtent297 {readonly source:object;readonly value:unknown}
const ownedSourceData297=new WeakMap<OwnedCoreSourceData297,OwnedSourceData297>();
interface DataExtent297 {readonly nodes:number;readonly height:number;readonly arrayUniform?:{readonly nodes:number;readonly height:number}}
const ownedDataExtents297=new WeakMap<object,DataExtent297>(),primitiveExtent297:DataExtent297={nodes:1,height:0};
const sourceArray=Array,sourceArrayPrototype=Array.prototype,sourceSlice=Array.prototype.slice,sourceSpecies=Object.getOwnPropertyDescriptor(Array,Symbol.species)?.get;
function ownedDataExtent297(value:unknown):DataExtent297 {
 if(!value||typeof value!=='object')return primitiveExtent297;
 const held=ownedDataExtents297.get(value);if(held)return held;
 let nodes=1,height=0,first:DataExtent297|undefined,uniform=Array.isArray(value);
 for(const child of Array.isArray(value)?value:Object.values(value)){
  const extent=ownedDataExtent297(child);nodes+=extent.nodes;height=Math.max(height,extent.height+1);
  if(uniform){if(!first)first=extent;else if(extent.nodes!==first.nodes||extent.height!==first.height)uniform=false;}
 }
 const extent:DataExtent297={nodes,height,...uniform&&first?{arrayUniform:{nodes:first.nodes,height:first.height}}:{}};ownedDataExtents297.set(value,extent);return extent;
}
function ownSourceData297(source:object,value:unknown,extent=ownedDataExtent297(value)):OwnedCoreSourceData297 {
 if(value&&typeof value==='object')ownedDataExtents297.set(value,extent);
 const token=Object.freeze({}) as OwnedCoreSourceData297;
 ownedSourceData297.set(token,{source,value,...extent});return token;
}
/** A complete validated frozen copy, with its exact copy-budget extent. The
 * fixed producer may reuse it only while its actual writer stamp survives.
 * No caller-provided wrapper, frozen object or value grants this capability. */
export function captureOwnedCoreSourceData297(source:object):OwnedCoreSourceData297 {
 return ownSourceData297(source,frozenDataCopy297(source));
}
/** A source-owned path consumed a proven prefix. Its immutable point copies
 * survive; only the remaining array of references is needed. No live cell is
 * copied/revalidated and exact node/depth bounds remain attached. */
export function sliceOwnedCoreSourceData297(token:OwnedCoreSourceData297,source:object,from:number):OwnedCoreSourceData297 {
 const data=ownedSourceData297.get(token);
 if(!data||!Array.isArray(data.value)||!Number.isSafeInteger(from)||from<0||from>data.value.length)throw Error('Invalid owned source prefix');
 const native=Object.getPrototypeOf(data.value)===sourceArrayPrototype&&Object.getOwnPropertyDescriptor(sourceArrayPrototype,'slice')?.value===sourceSlice&&Object.getOwnPropertyDescriptor(sourceArrayPrototype,'constructor')?.value===sourceArray&&sourceSpecies&&Object.getOwnPropertyDescriptor(sourceArray,Symbol.species)?.get===sourceSpecies;
 const remaining=Object.freeze(data.value.slice(from)),length=data.value.length-from,uniform=data.arrayUniform;
 // Physical paths are uniform Cell pairs. Suffixes retain the exact node
 // extent/depth of every cell without a second walk of all remaining cells.
 // A nonuniform graph or changed Array species/prototype stays exhaustive.
 return native&&uniform?ownSourceData297(source,remaining,{nodes:1+length*uniform.nodes,height:length?uniform.height+1:0,...length?{arrayUniform:uniform}:{}}):ownSourceData297(source,remaining);
}
/** Explicit checking mode detects a missed source mutation before reuse. */
export function verifyOwnedCoreSourceData297(token:OwnedCoreSourceData297):void {
 const data=ownedSourceData297.get(token);if(!data||!sameLiveData297(data.value,data.source,0))throw Error('Unmarked actor motion source write');
}
function copyFrozenData297<T>(value:T,fields?:CapturedFields297,shared?:OwnedCoreSourceData297,secondShared?:OwnedCoreSourceData297):T {
 const sharedData=shared&&ownedSourceData297.get(shared),secondData=secondShared&&ownedSourceData297.get(secondShared);
 const active=new Set<object>();let left=1048576;
 const copy=(v:unknown,depth:number):unknown=>{
  if(--left<0||depth>24)throw Error('Core phase payload budget exceeded');
  const owned=sharedData&&v===sharedData.source?sharedData:secondData&&v===secondData.source?secondData:undefined;
  if(owned){
   left-=owned.nodes-1;if(left<0||depth+owned.height>24)throw Error('Core phase payload budget exceeded');
   return owned.value;
  }
  if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Nonfinite Core phase number');return v;}
  if(typeof v!=='object'||active.has(v))throw Error('Cyclic or non-data Core phase value');active.add(v);
  try{
   if(fields&&depth===0&&v===value){
    // captureActor alone creates this four-field outer own-data literal.
    // Keep the exact recursive depth, order and budget checks on its values,
    // not another descriptor bag/shape discovery of our own container.
    const envelope=v as Record<string,unknown>;
    return Object.freeze({kind:copy(envelope.kind,depth+1),id:copy(envelope.id,depth+1),index:copy(envelope.index,depth+1),fields:copy(envelope.fields,depth+1)});
   }
   if(fields&&v===fields.record){
    const out:Record<string,unknown>={};
    for(let i=0;i<fields.keys.length;i++)out[fields.keys[i]!]=copy(fields.values[i],depth+1);
    return Object.freeze(out);
   }
   if(Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1){
    const n=v.length,values:unknown[]=new Array(n);let dense=true;
    for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')){dense=false;break;}values[i]=d.value;}
    // Every descriptor has already been checked; the scratch row is owned.
    // Rewrite it with the copies instead of allocating a second dense array.
    if(dense){for(let i=0;i<n;i++)values[i]=copy(values[i],depth+1);return Object.freeze(values);}
   }
   if(Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)throw Error('Core phase requires plain own data');
   const keys=Reflect.ownKeys(v),values:unknown[]=new Array(keys.length);
   for(let i=0;i<keys.length;i++){const k=keys[i]!;const d=typeof k==='string'?Object.getOwnPropertyDescriptor(v,k):undefined;if(!d||d.enumerable!==true||!Object.hasOwn(d,'value'))throw Error('Core phase requires plain own data');values[i]=d.value;}
   const out:Record<string,unknown>={};
   for(let i=0;i<keys.length;i++){const k=keys[i] as string,copied=copy(values[i],depth+1);if(k==='__proto__')Object.defineProperty(out,k,{value:copied,enumerable:true,writable:true,configurable:true});else out[k]=copied;}
   return Object.freeze(out);
  }finally{active.delete(v);}
 };
 return copy(value,0) as T;
}

/* Same checks, budget, depth and messages as frozenDataCopy297, in the same
 * order, but the given own-data tree is frozen in place and returned instead of
 * copied. Only for data its caller exclusively owns and never writes again: the
 * actors of a World just decoded from a Worker message, which the main thread
 * only reads. After a refusal the tree may be partly frozen; the caller then
 * discards it. */
export function frozenDataInPlace297<T>(value:T):T {
 const active=new Set<object>();let left=1048576;
 const visit=(v:unknown,depth:number):void=>{
  if(--left<0||depth>24)throw Error('Core phase payload budget exceeded');
  if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Nonfinite Core phase number');return;}
  if(typeof v!=='object'||active.has(v))throw Error('Cyclic or non-data Core phase value');active.add(v);
  try{
   if(Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1){
    const n=v.length,values:unknown[]=new Array(n);let dense=true;
    for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')){dense=false;break;}values[i]=d.value;}
    if(dense){for(let i=0;i<n;i++)visit(values[i],depth+1);Object.freeze(v);return;}
   }
   if(Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)throw Error('Core phase requires plain own data');
   const keys=Reflect.ownKeys(v),values:unknown[]=new Array(keys.length);
   for(let i=0;i<keys.length;i++){const k=keys[i]!;const d=typeof k==='string'?Object.getOwnPropertyDescriptor(v,k):undefined;if(!d||d.enumerable!==true||!Object.hasOwn(d,'value'))throw Error('Core phase requires plain own data');values[i]=d.value;}
   for(let i=0;i<keys.length;i++)visit(values[i],depth+1);
   Object.freeze(v);
  }finally{active.delete(v);}
 };
 visit(value,0);
 return value;
}

/* Same contract as captureCoreActor297 (pinned in core-phase-data-297.ts):
 * the same fields in the same order (required, then optional), the same
 * refusals for a missing required field or a field that is not own data, and
 * a result identical to its copyCoreData297, here made by frozenDataCopy297.
 * The publisher captures every changed actor of every phase. */
export function captureCoreActorFast297(kind:'human',index:number,actor:Pawn):CoreActorProjection297;
export function captureCoreActorFast297(kind:'animal',index:number,actor:WildAnimal):CoreActorProjection297;
export function captureCoreActorFast297(kind:'mechanical',index:number,actor:Mechanoid):CoreActorProjection297;
export function captureCoreActorFast297(kind:CoreActorProjection297['kind'],index:number,actor:Pawn|WildAnimal|Mechanoid):CoreActorProjection297 {
 return captureActor(kind,index,actor,false);
}
/* The row captureCoreActorFast297 makes, with the same refusals for every
 * field, except that the path's cells are not copied: `path` (still required
 * own data) becomes an empty frozen array. For a frontier row whose path the
 * renderer rebuilds from the cells it already holds (see CorePathKeep297). */
export function captureCoreActorHeldPath297(kind:CoreActorProjection297['kind'],index:number,actor:Pawn|WildAnimal|Mechanoid):CoreActorProjection297 {
 return captureActor(kind,index,actor,true);
}
/** Internal source-stamped lane; all outer actor descriptors retain their
 * ordinary checks. Only the certified nested source keeps its owned copy. */
export function captureCoreActorSharedSource297(kind:CoreActorProjection297['kind'],index:number,actor:Pawn|WildAnimal|Mechanoid,heldPath:boolean,shared:OwnedCoreSourceData297|undefined,secondShared?:OwnedCoreSourceData297,shape?:ActorRecordSourceShape297):CoreActorProjection297 {
 return captureActor(kind,index,actor,heldPath,shared,secondShared,shape);
}
const capturedActorFieldKeys297=new WeakMap<object,readonly string[]>();
/** Owned row construction: replacing the already-present canonical path does
 * not change its key order. Preserve only keys established by this module's
 * successful capture; arbitrary input rows receive no memoized evidence. */
export function withCapturedCoreActorPath297(row:CoreActorProjection297,path:readonly {readonly x:number;readonly z:number}[]):CoreActorProjection297 {
 const fields=Object.freeze({...row.fields,path}),keys=capturedActorFieldKeys297.get(row.fields);if(keys)capturedActorFieldKeys297.set(fields,keys);
 return Object.freeze({...row,fields}) as CoreActorProjection297;
}
function captureActor(kind:CoreActorProjection297['kind'],index:number,actor:Pawn|WildAnimal|Mechanoid,heldPath:boolean,shared?:OwnedCoreSourceData297,secondShared?:OwnedCoreSourceData297,shape?:ActorRecordSourceShape297):CoreActorProjection297 {
 const required:readonly string[]=kind==='human'?CORE_HUMAN_REQUIRED297:kind==='animal'?CORE_ANIMAL_REQUIRED297:CORE_MECH_REQUIRED297;
 const optional:readonly string[]=kind==='human'?CORE_HUMAN_OPTIONAL297:kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
 const source=actor as unknown as Record<string,unknown>,data:Record<string,unknown>={},keys:string[]=[],values:unknown[]=[];
 const ownedShape=shape!==undefined&&admitsActorRecordSource297(shape,kind,actor);
 const take=(key:string,isRequired:boolean)=>{
  if(ownedShape){
   if(!Object.hasOwn(source,key)){if(isRequired)throw Error('Missing physical actor field');return;}
   keys.push(key);values.push(source[key]);return;
  }
  const d=Object.getOwnPropertyDescriptor(source,key);
  if(!d){if(isRequired)throw Error('Missing physical actor field');return;}
  if(!d.enumerable||!Object.hasOwn(d,'value'))throw Error('Physical actor field is not own data');
  keys.push(key);values.push(d.value);
 };
 for(const key of required)take(key,true);
 // The declared CORE_*_OPTIONAL297 and CORE_*_REQUIRED297 lists are disjoint.
 for(const key of optional)take(key,false);
 if(heldPath)values[keys.indexOf('path')]=[];
 const row=copyFrozenData297({kind,id:actor.id,index,fields:data},{record:data,keys,values},shared,secondShared) as unknown as CoreActorProjection297;
 capturedActorFieldKeys297.set(row.fields,keys);return row;
}

/* Whether a live value would copy (frozenDataCopy297) to a value equal to the
 * sent copy `sent` (sameCoreValue297), without copying: the same refusals
 * (plain own enumerable data, dense arrays, depth 24, finite numbers; a
 * finite sent copy bounds cycles and the budget) and the same key order. */
function sameLiveData297(sent:unknown,live:unknown,depth:number):boolean {
 if(depth>24)return false;
 if(sent===null||typeof sent!=='object')return Object.is(sent,live)&&(typeof live!=='number'||Number.isFinite(live));
 if(live===null||typeof live!=='object')return false;
 if(Array.isArray(sent)){
  if(!Array.isArray(live)||Object.getPrototypeOf(live)!==Array.prototype||live.length!==sent.length||Reflect.ownKeys(live).length!==live.length+1)return false;
  for(let i=0;i<live.length;i++){const d=Object.getOwnPropertyDescriptor(live,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')||!sameLiveData297(sent[i],d.value,depth+1))return false;}
  return true;
 }
 if(Array.isArray(live)||Object.getPrototypeOf(live)!==Object.prototype)return false;
 const keys=Object.keys(sent),liveKeys=Reflect.ownKeys(live);if(liveKeys.length!==keys.length)return false;
 for(let i=0;i<keys.length;i++){
  const k=liveKeys[i];if(k!==keys[i])return false;
  const d=Object.getOwnPropertyDescriptor(live,k);if(!d||d.enumerable!==true||!Object.hasOwn(d,'value')||!sameLiveData297((sent as Record<string,unknown>)[k],d.value,depth+1))return false;
 }
 return true;
}
/** True when captureCoreActorFast297 (heldPath false) or
 * captureCoreActorHeldPath297 keeping the whole sent path (heldPath true) would
 * succeed and give fields equal to `sentFields` (sameCoreValue297), with no
 * copy made: the same fields in the same order, each own data, each value
 * equal. A held path is the sent path itself and is not compared. The phase
 * publisher marks every actor changed after a macro tick and keeps an
 * unchanged row unsent; this answers that before paying the copy. */
export function sameCapturedActor297(kind:CoreActorProjection297['kind'],actor:Pawn|WildAnimal|Mechanoid,sentFields:Readonly<Record<string,unknown>>,heldPath:boolean,shared?:OwnedCoreSourceData297,secondShared?:OwnedCoreSourceData297,shape?:ActorRecordSourceShape297):boolean {
 const sharedData=shared&&ownedSourceData297.get(shared),secondData=secondShared&&ownedSourceData297.get(secondShared);
 const required:readonly string[]=kind==='human'?CORE_HUMAN_REQUIRED297:kind==='animal'?CORE_ANIMAL_REQUIRED297:CORE_MECH_REQUIRED297;
 const optional:readonly string[]=kind==='human'?CORE_HUMAN_OPTIONAL297:kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
 const source=actor as unknown as Record<string,unknown>,sentKeys=capturedActorFieldKeys297.get(sentFields)??Object.keys(sentFields),ownedShape=shape!==undefined&&admitsActorRecordSource297(shape,kind,actor);let at=0;
 const take=(key:string,isRequired:boolean):boolean=>{
  let value:unknown;
  if(ownedShape){if(!Object.hasOwn(source,key))return !isRequired;value=source[key];}
  else {const d=Object.getOwnPropertyDescriptor(source,key);if(!d)return !isRequired;if(!d.enumerable||!Object.hasOwn(d,'value'))return false;value=d.value;}
  if(sentKeys[at++]!==key)return false;
  return heldPath&&key==='path'||sharedData&&value===sharedData.source&&sentFields[key]===sharedData.value
   ||secondData&&value===secondData.source&&sentFields[key]===secondData.value?true:sameLiveData297(sentFields[key],value,1);
 };
 for(const key of required)if(!take(key,true))return false;
 for(const key of optional)if(!take(key,false))return false;
 return at===sentKeys.length;
}
