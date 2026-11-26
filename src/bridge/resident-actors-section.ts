import type {SnapshotMessage} from './snapshots';
import type {World} from '../sim/types';
import {isOrdinaryResidentOwnerRecord379,isOrdinaryResidentOwnerArray379,residentOwnerArraySlice379,residentOwnerRecord379} from './resident-owner-records-379';

/** Fixed resident transport, not a save format. A row whose own field layout
 * changes is sent whole; otherwise its numeric edits share one Float64 column
 * of (id, field ordinal, value). Other changed fields are literal values;
 * shrinking paths can name a retained suffix instead. Both sides preserve the
 * order and presence of every actor and property, including own undefined.
 * No live SIM object is used as the producer's comparison witness. */
type Data=Record<string,unknown>;
type Edit=readonly [id:number,field:number,value:unknown];
type Rows={readonly mode:'rows';readonly reset:boolean;readonly count:number;
 readonly removed:readonly number[];readonly full:readonly Data[];
 readonly numbers:Float64Array;readonly values:readonly Edit[];readonly tails:Float64Array;
 readonly order?:readonly number[]};
type ListDelta={readonly mode:'literal'}|Rows;
export interface ResidentActorsDelta {readonly pawns:ListDelta;readonly animals:ListDelta}
interface HeldList {readonly rows:readonly Data[];readonly slots:ReadonlyMap<number,number>}
interface Lists {readonly pawns?:HeldList;readonly animals?:HeldList}
const LITERAL=Object.freeze({mode:'literal' as const});
const MAX_ROWS=65536,MAX_NODES=1048576,MAX_DEPTH=24;
const own=Object.hasOwn;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const plain=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const dataRecord=(v:unknown):v is Data=>plain(v)&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&own(Object.getOwnPropertyDescriptor(v,k)!,'value'));
function dense(v:unknown):v is unknown[]{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)return false;
 for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,i);if(!d?.enumerable||!own(d,'value'))return false;}return true;
}
function exactKeys(v:Data,keys:readonly string[]):boolean {const a=Object.keys(v);return a.length===keys.length&&a.every(k=>keys.includes(k));}
function sameKeys(a:readonly string[],b:readonly string[]):boolean {
 if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;
}
function write(row:Data,key:string,value:unknown):void {
 if(key==='__proto__'&&!own(row,key))Object.defineProperty(row,key,{value,enumerable:true,writable:true,configurable:true});else row[key]=value;
}
const slots=(rows:readonly Data[])=>new Map(rows.map((row,i)=>[row.id as number,i]));
const UNSUPPORTED=Symbol('not a plain actor graph');

/** Keys belong exclusively to detached producer snapshots. On this fixed SIM
 * lane the enumerable value graph is the structured-clone surface. A new or
 * altered shape is captured, not guessed from a schema-specific field list.
 * Reuse unchanged subtrees and only allocate on the first changed child. */
class ActorValueCapture {
 private readonly keys=new WeakMap<object,readonly string[]>();
 fields(row:Data):readonly string[]{return this.keys.get(row)??Object.keys(row);}
 hold(row:Data,keys:readonly string[]):Data {this.keys.set(row,keys);return row;}
 read(v:unknown,before:unknown,depth=0):unknown {
  if(depth>MAX_DEPTH)throw UNSUPPORTED;
  if(Object.is(v,before)&&(v===null||typeof v!=='object'))return v;
  if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw UNSUPPORTED;return v;}
  if(typeof v!=='object')throw UNSUPPORTED;
  if(Array.isArray(v)){
   if(Object.getPrototypeOf(v)!==Array.prototype||Object.keys(v).length!==v.length)throw UNSUPPORTED;
   const sameLength=Array.isArray(before)&&before.length===v.length;
   let copy:unknown[]|undefined=sameLength?undefined:new Array(v.length);
   for(let i=0;i<v.length;i++){
    if(!own(v,i))throw UNSUPPORTED;
    const old=sameLength?before[i]:undefined,raw=v[i],next=sameLength&&Object.is(raw,old)?old:this.read(raw,old,depth+1);
    if(copy)copy[i]=next;else if(!Object.is(old,next)){const changed=(before as unknown[]).slice();changed[i]=next;copy=changed;}
   }
   return copy??before;
  }
  if(!plain(v))throw UNSUPPORTED;
  const keys=Object.keys(v),same=plain(before)&&sameKeys(this.fields(before),keys);
  let copy:Data|undefined=same?undefined:{};
  for(const key of keys){const old=same?before[key]:undefined,raw=v[key],next=same&&Object.is(raw,old)?old:this.read(raw,old,depth+1);
   if(copy)write(copy,key,next);else if(!Object.is(old,next)){const changed={...(before as Data)};write(changed,key,next);copy=changed;}
  }
  return copy?this.hold(copy,keys):before;
 }
 /** Reuse a suffix of a confirmed array only after comparing every remaining
  * value. The general path below captures replacements/expansions literally. */
 suffix(v:unknown,before:unknown):number {
  if(!Array.isArray(v)||!Array.isArray(before)||v.length>=before.length||Object.getPrototypeOf(v)!==Array.prototype||Object.keys(v).length!==v.length)return 0;
  const drop=before.length-v.length;
  for(let i=0;i<v.length;i++)if(!own(v,i)||!Object.is(this.read(v[i],before[drop+i],2),before[drop+i]))return 0;
  return drop;
 }
 encode(live:unknown,previous:HeldList|undefined,nextId:number):{section:ListDelta;held?:HeldList} {
  if(!Array.isArray(live)||live.length>MAX_ROWS||Object.getPrototypeOf(live)!==Array.prototype||Object.keys(live).length!==live.length)return {section:LITERAL};
  try {
   const rows:Data[]=[],full:Data[]=[],numbers:number[]=[],values:Edit[]=[],tails:number[]=[],seen=new Set<number>();
   for(let at=0;at<live.length;at++){
    const row:unknown=live[at];if(!own(live,at)||!plain(row)||!integer(row.id,1,nextId-1)||seen.has(row.id))throw UNSUPPORTED;
    const id=row.id;seen.add(id);const old=previous?.rows[previous.slots.get(id)??-1],keys=Object.keys(row);
    if(!old||!sameKeys(this.fields(old),keys)){
     rows.push(this.read(row,undefined,1) as Data);full.push(row);continue;
    }
    let next:Data|undefined;
    for(let field=0;field<keys.length;field++){
     const key=keys[field]!,a=old[key],b=row[key];
     if(Object.is(a,b))continue;
     let captured:unknown,drop=key==='path'?this.suffix(b,a):0;
     if(drop){captured=(a as unknown[]).slice(drop);tails.push(id,field,drop);}
     else {
      captured=this.read(b,a,2);if(Object.is(captured,a))continue;
      if(typeof b==='number')numbers.push(id,field,b);else values.push([id,field,b]);
     }
     next??={...old};write(next,key,captured);
    }
    rows.push(next?this.hold(next,keys):old);
   }
   const removed:number[]=[],implicit:number[]=[];
   if(previous)for(const row of previous.rows){const id=row.id as number;if(seen.has(id))implicit.push(id);else removed.push(id);}
   if(previous)for(const row of full)if(!previous.slots.has(row.id as number))implicit.push(row.id as number);
   const order=previous&&implicit.some((id,i)=>id!==rows[i]?.id)?rows.map(row=>row.id as number):undefined;
   return {section:{mode:'rows',reset:!previous,count:rows.length,removed,full,numbers:new Float64Array(numbers),values,tails:new Float64Array(tails),...order?{order}:{}},held:{rows,slots:slots(rows)}};
  }catch(e){if(e!==UNSUPPORTED)throw e;return {section:LITERAL};}
 }
}

export class ResidentActorsEncoder {
 private readonly capture=new ActorValueCapture();private held:Lists={};
 clear():void {this.held={};}
 prepare(packet:SnapshotMessage<true>){
  const previous=this.held,checkpoint=packet.kind==='checkpoint',world={...packet.world} as unknown as Data;
  const pawns=this.capture.encode(world.pawns,checkpoint?undefined:previous.pawns,packet.world.nextId);
  const wildlife=plain(world.wildlife)?world.wildlife:undefined;
  const animals=this.capture.encode(wildlife?.animals,checkpoint?undefined:previous.animals,packet.world.nextId);
  if(pawns.section.mode==='rows')world.pawns=0;
  if(animals.section.mode==='rows')world.wildlife={...wildlife,animals:0};
  return {packet:{...packet,world} as unknown as SnapshotMessage<true>,actors:{pawns:pawns.section,animals:animals.section} satisfies ResidentActorsDelta,previous,held:{pawns:pawns.held,animals:animals.held} satisfies Lists};
 }
 commit(draft:ReturnType<ResidentActorsEncoder['prepare']>):void {
  if(draft.previous!==this.held)throw Error('Lost actor producer predecessor');this.held=draft.held;
 }
}

/** MAIN owns the input graph. Check exactly the Core frozen data contract,
 * including total occurrences (not unique objects), and maximum depth.
 * Only our recursively checked, frozen objects have metadata; a frozen
 * wrapper from a caller cannot skip a check. Cached subtrees still contribute
 * their full sizes/depths to the enclosing list's original budget. */
interface Facts {readonly nodes:number;readonly depth:number}
const facts=new WeakMap<object,Facts>(),ownedGraphs=new WeakSet<object>(),admittedLists=new WeakMap<object,number>(),LEAF:Facts={nodes:1,depth:0};
interface TransportEntry {readonly results:Map<number,number>}
interface TransportProjection {readonly keys:ReadonlySet<PropertyKey>;readonly entries:WeakMap<object,TransportEntry>}
const transportProjections:TransportProjection[]=[];
const transportPrototypes=[Object.prototype,Array.prototype].map(value=>({value,prototype:Object.getPrototypeOf(value),keys:Reflect.ownKeys(value),descriptors:Object.getOwnPropertyDescriptors(value)}));
function unchangedTransportPrototypes():boolean {
 for(const saved of transportPrototypes){
  if(Object.getPrototypeOf(saved.value)!==saved.prototype)return false;
  const keys=Reflect.ownKeys(saved.value);if(!sameKeys(keys as string[],saved.keys as string[]))return false;
  for(const key of keys){const a=Object.getOwnPropertyDescriptor(saved.value,key)!,b=(saved.descriptors as Record<PropertyKey,PropertyDescriptor>)[key]!;
   if(a.value!==b.value||a.get!==b.get||a.set!==b.set||a.enumerable!==b.enumerable||a.configurable!==b.configurable||a.writable!==b.writable)return false;
  }
 }
 return true;
}
/** A projection belongs to graphs constructed here, never arbitrary frozen
 * inputs. Its dependencies include the validator's recursive lanes and every
 * local marker dependency. Numeric actor edits outside those dependencies can
 * retain the exact transport result, without retaining a predecessor World. */
export function createResidentActorTransportMemoInternal(keys:ReadonlySet<PropertyKey>):{
 read:(value:object,version:number,role:number)=>number|undefined;
 remember:(value:object,version:number,role:number,features:number)=>void;
 begin:()=>void;end:()=>void;
} {
 const projection:TransportProjection={keys:new Set(keys),entries:new WeakMap()};transportProjections.push(projection);
 // Until the matching remember, the entire entered subtree is frozen own
 // data on ordinary objects. Its traversal cannot call input code, so nested
 // entries share this prototype check. Both exits clear it after rejection.
 let protectedRoot:object|undefined;
 const entry=(value:object):TransportEntry|undefined=>{
  if(!ownedGraphs.has(value))return;
  let held=projection.entries.get(value);if(!held){held={results:new Map()};projection.entries.set(value,held);}return held;
 };
 return {
  begin:()=>{protectedRoot=undefined;},end:()=>{protectedRoot=undefined;},
  read:(value,version,role)=>{
   const held=entry(value);if(!held||!protectedRoot&&!unchangedTransportPrototypes())return;
   const result=held.results.get(version*16+role);if(result===undefined)protectedRoot??=value;return result;
  },
  remember:(value,version,role,features)=>{
   const held=entry(value);if(held&&(protectedRoot||unchangedTransportPrototypes()))held.results.set(version*16+role,features);
   if(value===protectedRoot)protectedRoot=undefined;
  },
 };
}
function inheritActorTransport(row:Data,before:Data,changed:readonly string[]):void {
 for(const projection of transportProjections){
  const held=projection.entries.get(before);if(held&&!changed.some(key=>projection.keys.has(key)))projection.entries.set(row,held);
 }
}
function inheritActorListTransport(rows:Data[],before:readonly Data[]|undefined):void {
 if(!before||rows.length!==before.length)return;
 for(const projection of transportProjections){
  const held=projection.entries.get(before);if(!held)continue;
  let same=true;for(let i=0;i<rows.length;i++)if(rows[i]!==before[i]){
   const retained=projection.entries.get(before[i]!);if(!retained||projection.entries.get(rows[i]!)!==retained){same=false;break;}
  }
  if(same)projection.entries.set(rows,held);
 }
}
/** Keep the existing in-place actor seal and descriptor order. A graph earns
 * transport ownership only if every node was already known to be ordinary.
 * A frozen caller Proxy never acquires that representation fact. */
function seal(v:unknown,active:Set<object>,depth=0):Facts {
 if(depth>MAX_DEPTH)throw UNSUPPORTED;
 if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return LEAF;
 if(typeof v!=='object'||v===null||active.has(v))throw UNSUPPORTED;
 const known=facts.get(v);if(known){if(depth+known.depth>MAX_DEPTH)throw UNSUPPORTED;return known;}
 active.add(v);
 try{
  let nodes=1,maxDepth=0,owned=Array.isArray(v)?isOrdinaryResidentOwnerArray379(v):isOrdinaryResidentOwnerRecord379(v);
  const add=(value:unknown)=>{const child=seal(value,active,depth+1);nodes+=child.nodes;maxDepth=Math.max(maxDepth,child.depth+1);if(nodes>MAX_NODES)throw UNSUPPORTED;if(value&&typeof value==='object'&&!ownedGraphs.has(value))owned=false;};
  if(Array.isArray(v)){
   if(Object.getPrototypeOf(v)!==Array.prototype||v.length>=MAX_NODES||Reflect.ownKeys(v).length!==v.length+1)throw UNSUPPORTED;
   for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,i);if(!d?.enumerable||!own(d,'value'))throw UNSUPPORTED;add(d.value);}
  }else{
   if(Object.getPrototypeOf(v)!==Object.prototype)throw UNSUPPORTED;
   for(const key of Reflect.ownKeys(v)){const d=typeof key==='string'?Object.getOwnPropertyDescriptor(v,key):undefined;if(!d?.enumerable||!own(d,'value'))throw UNSUPPORTED;add(d.value);}
  }
  Object.freeze(v);const result={nodes,depth:maxDepth};facts.set(v,result);if(owned)ownedGraphs.add(v);return result;
 }finally{active.delete(v);}
}
/** New rows from a spread of an already validated actor are our own plain
 * data records. Only their replacement values need a deep/descriptor check;
 * retained children still contribute their exact node count and depth. The
 * generated outer row and list need no second descriptor walk. */
function sealedFacts(value:unknown):Facts {
 if(value===null||typeof value!=='object')return LEAF;
 const known=facts.get(value);if(!known)throw Error('Lost validated resident actor subtree');return known;
}
function sealChangedActor(row:Data,before:Data,keys:readonly string[],fields:ReadonlySet<number>):void {
 const prior=sealedFacts(before),active=new Set<object>([row]),changed:string[]=[];let nodes=prior.nodes,depth=prior.depth,mayShrink=false,owned=ownedGraphs.has(before);
 for(const field of fields){
  const key=keys[field]!,old=sealedFacts(before[key]),next=seal(row[key],active,2);
  changed.push(key);const value=row[key];if(value&&typeof value==='object'&&!ownedGraphs.has(value))owned=false;
  nodes+=next.nodes-old.nodes;depth=Math.max(depth,next.depth+1);
  if(old.depth+1===prior.depth&&next.depth<old.depth)mayShrink=true;
 }
 // Numeric edits need no scan of the hundreds of already checked fields.
 // If a deepest subtree shrank, recover the exact maximum from checked facts.
 if(mayShrink&&depth===prior.depth){depth=0;for(const key of keys)depth=Math.max(depth,sealedFacts(row[key]).depth+1);}
 if(nodes>MAX_NODES)throw UNSUPPORTED;Object.freeze(row);facts.set(row,{nodes,depth});
 if(owned)ownedGraphs.add(row);
 inheritActorTransport(row,before,changed);
}
function sealActorList(rows:Data[],nextId:number,before:readonly Data[]|undefined):void {
 let nodes=1,depth=0,maxId=0,owned=true;const active=new Set<object>([rows]);
 for(const row of rows){const child=seal(row,active,1);nodes+=child.nodes;depth=Math.max(depth,child.depth+1);if(nodes>MAX_NODES||!integer(row.id,1,nextId-1))throw UNSUPPORTED;maxId=Math.max(maxId,row.id);if(!ownedGraphs.has(row))owned=false;}
 // decodeList has proved the distinct identities through the ordered ID map.
 Object.freeze(rows);facts.set(rows,{nodes,depth});admittedLists.set(rows,maxId);
 if(owned)ownedGraphs.add(rows);
 inheritActorListTransport(rows,before);
}
/** Representation proof only; not a Native event/admission capability. */
export function isOwnedResidentActorListInternal(v:unknown):boolean {return !!v&&typeof v==='object'&&admittedLists.has(v);}
export function hasOwnedResidentActorShapeInternal(v:unknown,nextId:number):boolean {
 const max=v&&typeof v==='object'?admittedLists.get(v):undefined;
 return typeof max==='number'&&max<nextId;
}
const column=(v:unknown):v is Float64Array=>v instanceof Float64Array&&Object.getPrototypeOf(v)===Float64Array.prototype&&v.buffer instanceof ArrayBuffer&&v.length%3===0&&v.length<=MAX_NODES*3;
function decodeList(raw:unknown,old:HeldList|undefined,nextId:number,checkpoint:boolean):{literal:true}|{literal:false;held:HeldList}|undefined {
 if(!dataRecord(raw))return;
 if(raw.mode==='literal')return exactKeys(raw,['mode'])?{literal:true}:undefined;
 if(raw.mode!=='rows'||!exactKeys(raw,['mode','reset','count','removed','full','numbers','values','tails',...own(raw,'order')?['order']:[]])
  ||raw.reset!==(checkpoint||!old)||!integer(raw.count,0,MAX_ROWS)||!dense(raw.removed)||!dense(raw.full)||!dense(raw.values)||!column(raw.numbers)||!column(raw.tails)||own(raw,'order')&&!dense(raw.order))return;
 const before=raw.reset?undefined:old;
 if(raw.removed.length>MAX_ROWS||raw.full.length>MAX_ROWS||raw.values.length>MAX_NODES||raw.reset&&(raw.removed.length||raw.numbers.length||raw.values.length||raw.tails.length||own(raw,'order')))return;
 const byId=new Map<number,Data>((before?.rows??[]).map(row=>[row.id as number,row])),replaced=new Set<number>();
 for(const id of raw.removed){if(!integer(id,1,nextId-1)||replaced.has(id)||!byId.delete(id))return;replaced.add(id);}
 for(const row of raw.full){if(!dataRecord(row)||!integer(row.id,1,nextId-1)||replaced.has(row.id))return;replaced.add(row.id);byId.set(row.id,row);}
 const changes=new Map<number,{row:Data;before:Data;keys:string[];fields:Set<number>}>();
 const field=(id:unknown,ordinal:unknown)=>{
  if(!integer(id,1,nextId-1)||!integer(ordinal)||replaced.has(id))return;
  let change=changes.get(id);
  if(!change){const row=byId.get(id);if(!row)return;change={row:residentOwnerRecord379(row,{}),before:row,keys:Object.keys(row),fields:new Set()};changes.set(id,change);}
  const key=change.keys[ordinal];if(key===undefined||key==='id'||change.fields.has(ordinal))return;
  change.fields.add(ordinal);return {row:change.row,key};
 };
 for(let i=0;i<raw.numbers.length;i+=3){const target=field(raw.numbers[i],raw.numbers[i+1]),value=raw.numbers[i+2];if(!target||!Number.isFinite(value)||Object.is(target.row[target.key],value))return;write(target.row,target.key,value);}
 for(const edit of raw.values){if(!dense(edit)||edit.length!==3||typeof edit[2]==='number')return;const target=field(edit[0],edit[1]);if(!target)return;write(target.row,target.key,edit[2]);}
 for(let i=0;i<raw.tails.length;i+=3){const target=field(raw.tails[i],raw.tails[i+1]),drop=raw.tails[i+2];if(!target||target.key!=='path')return;const a=target.row[target.key];if(!Array.isArray(a)||!integer(drop,1,a.length))return;write(target.row,target.key,residentOwnerArraySlice379(a,drop));}
 for(const [id,change] of changes)byId.set(id,change.row);
 if(byId.size!==raw.count)return;
 let rows:Data[];
 if(own(raw,'order')){
  const order=raw.order as unknown[];if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!integer(id,1,nextId-1)||!byId.has(id)))return;
  rows=order.map(id=>byId.get(id as number)!);
 }else rows=[...byId.values()];
 try{
  for(const change of changes.values())sealChangedActor(change.row,change.before,change.keys,change.fields);
  sealActorList(rows,nextId,before?.rows);
 }catch(e){if(e===UNSUPPORTED)return;throw e;}
 return {literal:false,held:{rows,slots:slots(rows)}};
}

export class ResidentActorsFrameOwner {
 private held:Lists={};
 clear():void {this.held={};}
 prepare(packet:SnapshotMessage<true>,raw:unknown){
  if(!dataRecord(raw)||!exactKeys(raw,['pawns','animals']))return;
  const previous=this.held,checkpoint=packet.kind==='checkpoint',world={...packet.world} as unknown as Data,nextId=packet.world.nextId;
  if(!integer(nextId,1))return;
  const pawns=decodeList(raw.pawns,previous.pawns,nextId,checkpoint),animals=decodeList(raw.animals,previous.animals,nextId,checkpoint);if(!pawns||!animals)return;
  if(pawns.literal){if(world.pawns===0)return;}else{if(!own(world,'pawns')||world.pawns!==0)return;world.pawns=pawns.held.rows;}
  const wildlife=world.wildlife;
  if(animals.literal){if(plain(wildlife)&&wildlife.animals===0)return;}
  else{if(!dataRecord(wildlife)||!own(wildlife,'animals')||wildlife.animals!==0)return;world.wildlife={...wildlife,animals:animals.held.rows};}
  return {packet:{...packet,world} as unknown as SnapshotMessage<true>,previous,held:{pawns:pawns.literal?undefined:pawns.held,animals:animals.literal?undefined:animals.held} satisfies Lists};
 }
 canCommit(world:World,draft:NonNullable<ReturnType<ResidentActorsFrameOwner['prepare']>>):boolean {
  const lists=world as unknown as {pawns?:unknown;wildlife?:{animals?:unknown}};
  return draft.previous===this.held&&(!draft.held.pawns||lists.pawns===draft.held.pawns.rows)&&(!draft.held.animals||lists.wildlife?.animals===draft.held.animals.rows);
 }
 commit(world:World,draft:NonNullable<ReturnType<ResidentActorsFrameOwner['prepare']>>):void {
  if(!this.canCommit(world,draft))throw Error('Lost resident actor preparation');this.held=draft.held;
 }
}
