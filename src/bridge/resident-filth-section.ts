import type {World} from '../sim/types';
import type {SnapshotMessage} from './snapshots';

/** Fixed-Worker adaptation only; no public codec,
 * gameplay cadence, authoritative object or save field is changed here. */
type Data=Record<string,unknown>;
type Row=Data&{id:number};
type Presence={readonly present:false}|{readonly present:true;readonly value:unknown};
type Section={readonly mode:'absent'}|{readonly mode:'literal';readonly value:unknown}|{
 readonly mode:'items';readonly reset:boolean;readonly count:number;readonly header:Data;
 readonly removed:readonly number[];readonly upserted:readonly Row[];readonly order?:readonly number[];
};
export interface ResidentFilthDelta {
 readonly epoch:number;readonly revision:number;readonly tick:number;readonly checkpoint:boolean;
 readonly baseRevision?:number;readonly section:Section;
}
type Wire<T extends {world:object}>=T extends unknown?Omit<T,'world'>&{readonly world:Omit<T['world'],'filth'>&{readonly filth?:0}}:never;
export type ResidentFilthPublication=Wire<SnapshotMessage<true>>;
const own=(value:object,key:PropertyKey)=>Object.hasOwn(value,key);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
function record(value:unknown):value is Data {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 // One descriptor read per key (the same answer as reading it twice).
 for(const key of Reflect.ownKeys(value)){if(typeof key!=='string')return false;const field=Object.getOwnPropertyDescriptor(value,key);if(field?.enumerable!==true||!own(field,'value'))return false;}
 return true;
}
function dense(value:unknown):value is unknown[] {
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)return false;
 for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!own(d,'value'))return false;}return true;
}
const exact=(value:Data,keys:readonly string[])=>Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const keysFor=new WeakMap<object,readonly string[]>();
const frozenItemLists=new WeakSet<object>();
/** Array identity made by prepareItems, never a literal/foreign freeze proof.
 * Row provenance is checked separately before caching a semantic list body. */
export const isOwnedResidentFilthItemListInternal=(value:object):boolean=>frozenItemLists.has(value);
/** Representation proof only: ordinary recursively copied/frozen data. It
 * neither admits a publication nor certifies Firefoam fields or local clocks. */
export const isOwnedResidentFilthCopyInternal=(value:object):boolean=>keysFor.has(value);
function valid(value:unknown,depth=0):boolean {
 if(depth>24)return false;
 if(value===null||value===undefined||['string','number','boolean'].includes(typeof value))return true;
 if(dense(value))return value.every(v=>valid(v,depth+1));
 return record(value)&&Object.keys(value).every(key=>valid(value[key],depth+1));
}
function copy(value:unknown,depth=0):unknown {
 if(depth>24)throw Error('Filth transport data depth');
 if(value===null||value===undefined||['string','number','boolean'].includes(typeof value))return value;
 if(dense(value))return Object.freeze(value.map(v=>copy(v,depth+1)));
 if(!record(value))throw Error('Filth transport requires plain own data');
 const keys=Object.keys(value),out:Data={};
 for(const key of keys)Object.defineProperty(out,key,{value:copy(value[key],depth+1),enumerable:true,writable:true,configurable:true});
 keysFor.set(out,keys);return Object.freeze(out);
}
/** Compare against a private value capture, never a mutable previous World. */
function same(before:unknown,value:unknown):boolean {
 if(Object.is(before,value))return true;
 if(!before||!value||typeof before!=='object'||typeof value!=='object')return false;
 if(Array.isArray(before)){
  if(!dense(value)||before.length!==value.length)return false;
  for(let i=0;i<before.length;i++)if(!same(before[i],value[i]))return false;return true;
 }
 if(Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const keys=keysFor.get(before);if(!keys)return false;
 // Reflect includes symbols and nonenumerable properties. Compare their exact
 // ordered presence and each data descriptor/value in the SAME traversal.
 // In particular, unchanged age fields are still read on every observation.
 const current=Reflect.ownKeys(value);if(current.length!==keys.length)return false;
 for(let i=0;i<current.length;i++){
  const key=current[i];if(typeof key!=='string'||key!==keys[i])return false;
  const field=Object.getOwnPropertyDescriptor(value,key);
  if(!field||field.enumerable!==true||!own(field,'value')||!same((before as Data)[key],field.value))return false;
 }
 return true;
}
interface Items {readonly header:Data;readonly values:readonly Row[];readonly slots:ReadonlyMap<number,number>}
interface Held {readonly presence:Presence;readonly items?:Items;readonly rootToken:object;readonly itemsToken:object}
const index=(values:readonly Row[])=>new Map(values.map((row,ordinal)=>[row.id,ordinal]));
function split(value:unknown,nextId:number):value is Data&{items:Row[]} {
 if(!record(value)||!own(value,'items')||!dense(value.items))return false;
 const seen=new Set<number>();
 // Only inspect identity here. same/copy below checks each row's complete own
 // data once; a second recursive validation of all 4173 rows buys no coverage.
 for(const row of value.items){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.getPrototypeOf(row)!==Object.prototype)return false;
  const id=Object.getOwnPropertyDescriptor(row,'id');if(!id?.enumerable||!own(id,'value')||!integer(id.value,1,nextId-1)||seen.has(id.value))return false;seen.add(id.value);
 }return true;
}
function heldItems(header:Data,values:readonly Row[],slots:ReadonlyMap<number,number>,old?:Held):Held {
 const keepValues=!!old?.items&&old.items.values===values;
 if(keepValues&&same(old!.items!.header,header))return old!;
 const value=Object.freeze({...header,items:values});
 return {presence:{present:true,value},items:{header,values,slots},rootToken:{},itemsToken:keepValues?old!.itemsToken:{}};
}

export class ResidentFilthEncoder {
 private epoch=0;private revision=0;private tick=-1;private previous:Held|undefined;
 clear():void {this.epoch=this.revision=0;this.tick=-1;this.previous=undefined;}
 capture(packet:SnapshotMessage<true>):{publication:ResidentFilthPublication;filth:ResidentFilthDelta} {
  const checkpoint=packet.kind==='checkpoint';
  if(!integer(packet.epoch,1)||!integer(packet.revision,1)||!integer(packet.world.tick)||!integer(packet.world.nextId,1)
   ||!checkpoint&&(packet.epoch!==this.epoch||packet.baseRevision!==this.revision||packet.revision!==this.revision+1||packet.world.tick<this.tick))throw Error('Missing filth producer predecessor');
  const source=packet.world as unknown as Data,old=checkpoint?undefined:this.previous;
  let section:Section,next:Held;
  if(!own(source,'filth')){section={mode:'absent'};next=old&&!old.presence.present?old:{presence:{present:false},rootToken:{},itemsToken:{}};}
  else if(!split(source.filth,packet.world.nextId)){
   const value=old?.presence.present&&same(old.presence.value,source.filth)?old.presence.value:copy(source.filth);
   section={mode:'literal',value};next=old?.presence.present&&Object.is(old.presence.value,value)?old:{presence:{present:true,value},rootToken:{},itemsToken:{}};
  }else{
   const filth=source.filth,previous=old?.items,reset=!previous;
   const header=copy({...filth,items:0}) as Data,removed:number[]=[],upserted:Row[]=[],seen=new Set<number>();
   let unchangedOrder=!!previous&&previous.values.length===filth.items.length,values:Row[]|undefined;
   for(let ordinal=0;ordinal<filth.items.length;ordinal++){
    const row=filth.items[ordinal]!,before=previous?.values[previous.slots.get(row.id)??-1];seen.add(row.id);
    if(previous?.values[ordinal]?.id!==row.id)unchangedOrder=false;
    const value=before&&same(before,row)?before:copy(row) as Row;
    if(value!==before)upserted.push(value);
    if(values)values.push(value);
    else if(value!==previous?.values[ordinal])values=[...(previous?.values.slice(0,ordinal)??[]),value];
   }
   for(const row of previous?.values??[])if(!seen.has(row.id))removed.push(row.id);
   let nextValues:readonly Row[]=values??previous?.values??[];
   // Shrinking a prefix needs no write during the forward loop.
   if(nextValues.length!==filth.items.length)nextValues=nextValues.slice(0,filth.items.length);
   let order:number[]|undefined;
   if(previous&&!unchangedOrder){
    const implicit=previous.values.filter(row=>seen.has(row.id)).map(row=>row.id);
    for(const row of upserted)if(!previous.slots.has(row.id))implicit.push(row.id);
    if(implicit.length!==filth.items.length||implicit.some((id,i)=>id!==filth.items[i]!.id))order=filth.items.map(row=>row.id);
   }
   if(nextValues!==previous?.values)Object.freeze(nextValues);
   next=heldItems(header,nextValues,unchangedOrder?previous!.slots:index(nextValues),old);
   section={mode:'items',reset,count:nextValues.length,header,removed,upserted,...order?{order}:{}};
  }
  const world={...packet.world} as unknown as Data;if(own(world,'filth'))world.filth=0;
  // Every value copy and reference check completed before producer advancement.
  this.previous=next;this.epoch=packet.epoch;this.revision=packet.revision;this.tick=packet.world.tick;
  return {publication:{...packet,world} as unknown as ResidentFilthPublication,
   filth:{epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,checkpoint,...checkpoint?{}:{baseRevision:packet.baseRevision},section}};
 }
}

interface State {readonly owner:object;readonly epoch:number;readonly revision:number;readonly tick:number;readonly held:Held}
export interface PreparedResidentFilth {readonly packet:SnapshotMessage<true>;readonly previous:State|undefined;readonly state:State}
export interface ResidentFilthFrame {readonly rootToken:object;readonly itemsToken:object}
const frames=new WeakMap<World,ResidentFilthFrame>();
export const readResidentFilthFrame=(world:World):ResidentFilthFrame|undefined=>frames.get(world);

function prepareItems(raw:Data,old:Held|undefined,nextId:number,checkpoint:boolean,maxItems:number):Held|undefined {
 if(!exact(raw,own(raw,'order')?['mode','reset','count','header','removed','upserted','order']:['mode','reset','count','header','removed','upserted'])
  ||typeof raw.reset!=='boolean'||raw.reset!==(checkpoint||!old?.items)||!integer(raw.count,0,maxItems)||!record(raw.header)||!own(raw.header,'items')||raw.header.items!==0||!valid(raw.header)
  ||!dense(raw.removed)||!dense(raw.upserted)||raw.upserted.length>maxItems||own(raw,'order')&&!dense(raw.order))return;
 const previous=raw.reset?undefined:old?.items,touched=new Set<number>(),removed=raw.removed as unknown[],writes=new Map<number,Row>();
 if(raw.reset&&(removed.length||own(raw,'order')))return;
 for(const id of removed){if(!integer(id,1,nextId-1)||touched.has(id)||!previous?.slots.has(id))return;touched.add(id);}
 for(const row of raw.upserted){
  if(!record(row)||!integer(row.id,1,nextId-1)||touched.has(row.id)||!valid(row))return;touched.add(row.id);
  const before=previous?.values[previous.slots.get(row.id)??-1];writes.set(row.id,before&&same(before,row)?before:copy(row) as Row);
 }
 const sparse=!!previous&&!removed.length&&!own(raw,'order')&&[...writes.keys()].every(id=>previous.slots.has(id));
 let values:readonly Row[],slots:ReadonlyMap<number,number>;
 if(sparse){
  values=previous!.values;slots=previous!.slots;let changed:Row[]|undefined;
  for(const [id,row]of writes){const at=slots.get(id)!;if(row===values[at])continue;changed??=[...values];changed[at]=row;}
  if(changed){values=Object.freeze(changed);frozenItemLists.add(values);}
 }else{
  const byId=new Map((previous?.values??[]).map(row=>[row.id,row]));
  for(const id of removed)byId.delete(id as number);for(const [id,row]of writes)byId.set(id,row);
  if(byId.size>maxItems)return;
  if(own(raw,'order')){
   const order=raw.order as unknown[];
   if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!integer(id,1,nextId-1)||!byId.has(id)))return;
   values=order.map(id=>byId.get(id as number)!);
  }else values=[...byId.values()];
  if(previous&&values.length===previous.values.length&&values.every((row,i)=>row===previous.values[i])){values=previous.values;slots=previous.slots;}
  else{
   values=Object.freeze(values);slots=index(values);
   // The no-order branch above uses an array literal. order.map may consult
   // Array species; it does not acquire this ordinary-array provenance.
   if(!own(raw,'order'))frozenItemLists.add(values);
  }
 }
 if(values.length!==raw.count)return;
 return heldItems(copy(raw.header) as Data,values,slots,old);
}

/** Prepare before the base/natural/auxiliary admission; commit only after ALL
 * validators succeed. Refusal, throw, missing edge and retry cannot advance it. */
export class ResidentFilthFrameOwner {
 private readonly identity={};private current:State|undefined;
 clear():void {this.current=undefined;}
 prepare(packet:SnapshotMessage<true>,raw:unknown):PreparedResidentFilth|'stale'|undefined {
  if(!record(packet)||!record(packet.world)||!integer(packet.epoch,1)||!integer(packet.revision,1)||!integer(packet.world.tick)
   ||!integer(packet.world.nextId,1)||!integer(packet.world.width,1)||!integer(packet.world.height,1))return;
  const old=this.current,checkpoint=packet.kind==='checkpoint';
  if(old&&(packet.epoch<old.epoch||packet.epoch===old.epoch&&packet.revision<=old.revision))return 'stale';
  if(!record(raw)||!exact(raw,checkpoint?['epoch','revision','tick','checkpoint','section']:['epoch','revision','tick','checkpoint','baseRevision','section'])
   ||raw.epoch!==packet.epoch||raw.revision!==packet.revision||raw.tick!==packet.world.tick||raw.checkpoint!==checkpoint||!record(raw.section)
   ||!checkpoint&&(!old||old.epoch!==packet.epoch||packet.baseRevision!==old.revision||raw.baseRevision!==old.revision||packet.revision!==old.revision+1||packet.world.tick<old.tick))return;
  const section=raw.section;let held:Held|undefined;
  if(section.mode==='absent'){
   if(!exact(section,['mode']))return;held=old&&!checkpoint&&!old.held.presence.present?old.held:{presence:{present:false},rootToken:{},itemsToken:{}};
  }else if(section.mode==='literal'){
   if(!exact(section,['mode','value'])||!valid(section.value))return;
   const before=checkpoint?undefined:old?.held;
   held=before?.presence.present&&same(before.presence.value,section.value)?before:{presence:{present:true,value:copy(section.value)},rootToken:{},itemsToken:{}};
  }else if(section.mode==='items')held=prepareItems(section,checkpoint?undefined:old?.held,packet.world.nextId,checkpoint,packet.world.width*packet.world.height*9);
  if(!held)return;
  const world={...packet.world} as unknown as Data,present=own(world,'filth');
  if(present!==held.presence.present||present&&world.filth!==0)return;
  if(held.presence.present)world.filth=held.presence.value;
  const state:State={owner:this.identity,epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,held};
  return {packet:{...packet,world} as unknown as SnapshotMessage<true>,previous:old,state};
 }
 canCommit(world:World,draft:PreparedResidentFilth):boolean {
  if(draft.state.owner!==this.identity||draft.previous!==this.current)return false;
  const held=draft.state.held;return own(world,'filth')===held.presence.present&&(!held.presence.present||world.filth===held.presence.value);
 }
 commit(world:World,draft:PreparedResidentFilth):void {
  if(!this.canCommit(world,draft))throw Error('Lost filth frame preparation');
  const held=draft.state.held;
  this.current=draft.state;frames.set(world,Object.freeze({rootToken:held.rootToken,itemsToken:held.itemsToken}));
 }
}
