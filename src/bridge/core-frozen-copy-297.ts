import {CORE_ANIMAL_OPTIONAL297,CORE_ANIMAL_REQUIRED297,CORE_HUMAN_OPTIONAL297,CORE_HUMAN_REQUIRED297,CORE_MECH_OPTIONAL297,CORE_MECH_REQUIRED297,type CoreActorProjection297} from './core-phase-projection-297';
import type {Pawn} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
/* Same contract as copyCoreData297 (pinned in core-phase-data-297.ts): the
 * same budget, depth, cycle, finite-number, dense-array and plain-own-data
 * rejections with the same messages, and an identical deeply frozen result
 * (same keys and order; frozen properties are non-writable/non-configurable).
 * It reads each property descriptor once and assigns before freezing instead
 * of two descriptor reads plus defineProperty per key, which made the actor
 * copy of every Full ~15% of the main thread on large colonies. */
export function frozenDataCopy297<T>(value:T):T {
 const active=new Set<object>();let left=1048576;
 const copy=(v:unknown,depth:number):unknown=>{
  if(--left<0||depth>24)throw Error('Core phase payload budget exceeded');
  if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Nonfinite Core phase number');return v;}
  if(typeof v!=='object'||active.has(v))throw Error('Cyclic or non-data Core phase value');active.add(v);
  try{
   if(Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1){
    const n=v.length,values:unknown[]=new Array(n);let dense=true;
    for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')){dense=false;break;}values[i]=d.value;}
    if(dense){const out:unknown[]=new Array(n);for(let i=0;i<n;i++)out[i]=copy(values[i],depth+1);return Object.freeze(out);}
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
function captureActor(kind:CoreActorProjection297['kind'],index:number,actor:Pawn|WildAnimal|Mechanoid,heldPath:boolean):CoreActorProjection297 {
 const required:readonly string[]=kind==='human'?CORE_HUMAN_REQUIRED297:kind==='animal'?CORE_ANIMAL_REQUIRED297:CORE_MECH_REQUIRED297;
 const optional:readonly string[]=kind==='human'?CORE_HUMAN_OPTIONAL297:kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
 const source=actor as unknown as Record<string,unknown>,data:Record<string,unknown>={};
 const take=(key:string,isRequired:boolean)=>{
  const d=Object.getOwnPropertyDescriptor(source,key);
  if(!d){if(isRequired)throw Error('Missing physical actor field');return;}
  if(!d.enumerable||!Object.hasOwn(d,'value'))throw Error('Physical actor field is not own data');
  data[key]=d.value;
 };
 for(const key of required)take(key,true);
 for(const key of optional)take(key,required.includes(key));
 if(heldPath)data.path=[];
 return frozenDataCopy297({kind,id:actor.id,index,fields:data}) as unknown as CoreActorProjection297;
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
export function sameCapturedActor297(kind:CoreActorProjection297['kind'],actor:Pawn|WildAnimal|Mechanoid,sentFields:Readonly<Record<string,unknown>>,heldPath:boolean):boolean {
 const required:readonly string[]=kind==='human'?CORE_HUMAN_REQUIRED297:kind==='animal'?CORE_ANIMAL_REQUIRED297:CORE_MECH_REQUIRED297;
 const optional:readonly string[]=kind==='human'?CORE_HUMAN_OPTIONAL297:kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
 const source=actor as unknown as Record<string,unknown>,sentKeys=Object.keys(sentFields);let at=0;
 const seen=new Set<string>();
 const take=(key:string,isRequired:boolean):boolean=>{
  const d=Object.getOwnPropertyDescriptor(source,key);
  if(!d)return !isRequired;
  if(!d.enumerable||!Object.hasOwn(d,'value'))return false;
  if(seen.has(key))return true;seen.add(key);
  if(sentKeys[at++]!==key)return false;
  return heldPath&&key==='path'?true:sameLiveData297(sentFields[key],d.value,1);
 };
 for(const key of required)if(!take(key,true))return false;
 for(const key of optional)if(!take(key,required.includes(key)))return false;
 return at===sentKeys.length;
}
