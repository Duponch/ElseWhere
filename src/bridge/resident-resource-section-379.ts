import type {Resource,World} from '../sim/types';
import {validPlantLife} from '../sim/plant-life-save';
import type {SnapshotMessage,ResourceStructureCandidate} from './snapshots';
import {residentOwnerArray379,residentOwnerArraySlice379,isOrdinaryResidentOwnerArray379} from './resident-owner-records-379';
import {nextResidentMembershipValues379,nextResidentOrdinalSlots379,residentOrdinalSlots379} from './resident-ordinal-slots-379';
import {readPrivateNativeAuxLease379} from './native-aux-lease-reader-379';
import {PLANT_LIFE_INTERVAL} from '../sim/plant-life';
import {PLANT_SPECIES} from '../sim/biome-flora';
import {verifyTerrainWriteCaches} from '../sim/terrain-mutation-journal';
import {verifyResourceJournal} from '../sim/resource-mutation-journal';

/** Fixed presentation wire only. Resources are constructed from checked
 * columns before they are first exposed; old public/literal Worlds never
 * acquire these immutable representation facts. */
const numeric=new Set(['id','x','z','amount','growth','growthTick','growthThermalFactor','damage']);
const text=new Set(['kind','species','growthLight','stone']);
const lifeKeys=new Set(['initialAgeCore','pausedTicks','ageTick','leaflessPausedTicks','since','bornAt','age','darkTicks','leaflessAt','nextCheck']);
const blightKeys=new Set(['since','severity','lastHarmTick','nextCheck','rng']);
const resourceKeys=new Set([...numeric,...text,'sown291','plantLife','blight']);
const nestedKeys=new Set([...lifeKeys,...blightKeys]);
const MAX_ROWS=262144,MAX_FIELDS=32;
const own=Object.hasOwn;
type Data=Record<string,unknown>;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(v:unknown):v is Data {
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
 for(const key of Reflect.ownKeys(v)){const d=typeof key==='string'?Object.getOwnPropertyDescriptor(v,key):undefined;if(!d?.enumerable||!own(d,'value'))return false;}return true;
}
function dense(v:unknown):v is unknown[]{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)return false;
 for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,i);if(!d?.enumerable||!own(d,'value'))return false;}return true;
}
function captureRecord(v:unknown):Data|undefined {
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return;const out:Data={};
 for(const key of Reflect.ownKeys(v)){const d=typeof key==='string'?Object.getOwnPropertyDescriptor(v,key):undefined;if(!d?.enumerable||!own(d,'value'))return;Object.defineProperty(out,key,{value:d.value,enumerable:true,writable:true,configurable:true});}return out;
}
function captureDense(v:unknown,limit:number):unknown[]|undefined {
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype)return;
 const length=Object.getOwnPropertyDescriptor(v,'length');if(!length||!own(length,'value')||!integer(length.value,0,limit)||Reflect.ownKeys(v).length!==length.value+1)return;
 const out:unknown[]=[];for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(v,i);if(!d?.enumerable||!own(d,'value'))return;Object.defineProperty(out,i,{value:d.value,enumerable:true,writable:true,configurable:true});}return out;
}
const exact=(v:Data,keys:readonly string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(key=>own(v,key));
function column<T extends Uint16Array|Float64Array>(v:unknown,type:{new(...args:any[]):T;prototype:T},limit:number):v is T {
 return ArrayBuffer.isView(v)&&v instanceof type&&Object.getPrototypeOf(v)===type.prototype&&!own(v,'buffer')&&!own(v,'length')&&v.buffer instanceof ArrayBuffer&&v.length<=limit;
}
export interface ResourceColumns379 {
 readonly shapes:readonly (readonly string[])[];readonly layouts:Uint16Array;readonly numbers:Float64Array;readonly strings:readonly string[];
 readonly objectShapes:readonly (readonly string[])[];readonly objectLayouts:Uint16Array;readonly objectNumbers:Float64Array;
}
export interface ResidentResourceSection379 {readonly checkpoint:boolean;readonly rows:ResourceColumns379|null}

function encodeRows(raw:unknown):ResourceColumns379|undefined {
 if(!dense(raw)||raw.length>MAX_ROWS)return;
 const shapes:string[][]=[],shapeIds=new Map<string,number>(),layouts:number[]=[],numbers:number[]=[],strings:string[]=[],stringIds=new Map<string,number>();
 const objectShapes:string[][]=[],objectShapeIds=new Map<string,number>(),objectLayouts:number[]=[],objectNumbers:number[]=[],objects=new WeakMap<object,number>();
 const shape=(keys:string[],rows:string[][],ids:Map<string,number>)=>{const key=keys.join('|');let id=ids.get(key);if(id===undefined){id=rows.length;if(id>65535)throw Error('Resource shape budget');rows.push(keys);ids.set(key,id);}return id;};
 const nested=(value:unknown,allowed:ReadonlySet<string>):number=>{
  if(!record(value))throw Error('Resource nested data');const keys=Object.keys(value);if(keys.length>MAX_FIELDS||keys.some(key=>!allowed.has(key)))throw Error('Resource nested keys');
  const found=objects.get(value);if(found!==undefined)return found;
  const id=objectLayouts.length;objectLayouts.push(shape(keys,objectShapes,objectShapeIds));objects.set(value,id);
  for(const key of keys){const n=value[key];if(n!==undefined&&(typeof n!=='number'||!Number.isFinite(n)))throw Error('Resource nested scalar');objectNumbers.push(n===undefined?NaN:n);}
  return id;
 };
 try{
  for(const row of raw){
   if(!record(row))return;const keys=Object.keys(row);if(keys.length>MAX_FIELDS||keys.some(key=>!resourceKeys.has(key)))return;
   layouts.push(shape(keys,shapes,shapeIds));
   for(const key of keys){
    const value=row[key];if(value===undefined){numbers.push(NaN);continue;}
    if(numeric.has(key)){if(typeof value!=='number'||!Number.isFinite(value))return;numbers.push(value);}
    else if(text.has(key)){if(typeof value!=='string')return;let id=stringIds.get(value);if(id===undefined){id=strings.length;strings.push(value);stringIds.set(value,id);}numbers.push(id);}
    else if(key==='sown291'){if(typeof value!=='boolean')return;numbers.push(value?1:0);}
    else numbers.push(nested(value,key==='plantLife'?lifeKeys:blightKeys));
   }
  }
  return {shapes,layouts:new Uint16Array(layouts),numbers:new Float64Array(numbers),strings,objectShapes,objectLayouts:new Uint16Array(objectLayouts),objectNumbers:new Float64Array(objectNumbers)};
 }catch{return;}
}

const ownedRows=new WeakSet<object>(),ownedLists=new WeakMap<object,number>();
/** Immutable ordinary wild plant row facts, seeded only by the complete
 * validator on a real private update. Growth-only edits inherit the same
 * life shape; paused, cultivated, legacy and unknown rows stay literal. */
interface LifeFact379 {readonly version:number;readonly adoptedAt:number|undefined;readonly since:number;readonly minimumSince:number;readonly phase:number;readonly leaflessAt:number|undefined}
const lifeFacts379=new WeakMap<Resource,LifeFact379>();
const plantSpecies379=PLANT_SPECIES.slice();
const plantPrototypes379=[Object.prototype,Array.prototype,Map.prototype].map(value=>({value,prototype:Object.getPrototypeOf(value),keys:Reflect.ownKeys(value),descriptors:Object.getOwnPropertyDescriptors(value)}));
function stablePlantFacts379():boolean {
 if(Object.getPrototypeOf(Object.prototype)!==null||Object.getPrototypeOf(PLANT_SPECIES)!==Array.prototype||Object.hasOwn(PLANT_SPECIES,'includes')||PLANT_SPECIES.length!==plantSpecies379.length)return false;
 for(let i=0;i<plantSpecies379.length;i++){const d=Object.getOwnPropertyDescriptor(PLANT_SPECIES,i);if(!d?.enumerable||!Object.hasOwn(d,'value')||d.value!==plantSpecies379[i])return false;}
 for(const saved of plantPrototypes379){
  if(Object.getPrototypeOf(saved.value)!==saved.prototype)return false;const keys=Reflect.ownKeys(saved.value);if(keys.length!==saved.keys.length)return false;
  for(let i=0;i<keys.length;i++){const key=keys[i]!;if(key!==saved.keys[i])return false;const a=Object.getOwnPropertyDescriptor(saved.value,key)!,b=(saved.descriptors as Record<PropertyKey,PropertyDescriptor>)[key]!;if(a.value!==b.value||a.get!==b.get||a.set!==b.set||a.enumerable!==b.enumerable||a.configurable!==b.configurable||a.writable!==b.writable)return false;}
 }
 return true;
}
function inheritLife379(prior:Resource,row:Resource,enabled:boolean):void {const fact=enabled?lifeFacts379.get(prior):undefined;if(fact)lifeFacts379.set(row,fact);}
function validLifePatch379(prior:Resource,row:Resource,version:number,world:Pick<World,'tick'|'climate'>,enabled:boolean):boolean {
 const life=row.plantLife!,fact=enabled&&lifeFacts379.get(prior),tick=world.tick,adoptedAt=world.climate?.adoptedAt;
 if(fact&&fact.version===version&&!!world.climate&&fact.adoptedAt===adoptedAt){
  const valid=integer(fact.since,fact.minimumSince,tick)&&integer(life.age,0,tick-fact.since)&&integer(life.darkTicks,0,life.age)&&integer(life.nextCheck,tick+1,tick+PLANT_LIFE_INTERVAL)&&life.nextCheck%PLANT_LIFE_INTERVAL===fact.phase&&life.age===Math.max(0,life.nextCheck-PLANT_LIFE_INTERVAL-fact.since)&&(fact.leaflessAt===undefined||integer(fact.leaflessAt,fact.since,tick)&&fact.leaflessAt%PLANT_LIFE_INTERVAL===fact.phase);
  if((verifyTerrainWriteCaches||verifyResourceJournal)&&valid!==validPlantLife(row,version,world))throw Error('Owned ordinary life clock differs from exhaustive guard');
  if(valid)lifeFacts379.set(row,fact);return valid;
 }
 const valid=validPlantLife(row,version,world);
 if(valid&&enabled&&version>=379&&!!world.climate&&typeof row.species==='string'&&Object.hasOwn(row,'species')&&!Object.hasOwn(row,'sown291')&&['tree','berries','wild-plant'].includes(row.kind)&&!['pausedTicks','ageTick','leaflessPausedTicks'].some(key=>Object.hasOwn(life,key))){
  lifeFacts379.set(row,{version,adoptedAt,since:life.since,minimumSince:Object.hasOwn(life,'initialAgeCore')?0:adoptedAt??0,phase:(row.id+1)%PLANT_LIFE_INTERVAL,leaflessAt:life.leaflessAt});
 }
 return valid;
}
function sealedRow(value:Resource):Resource {Object.freeze(value);ownedRows.add(value);return value;}
function sealedList(values:Resource[],maxId:number):Resource[]{if(!isOrdinaryResidentOwnerArray379(values))throw Error('Unowned resource array construction');Object.freeze(values);ownedLists.set(values,maxId);return values;}
/** Immutable shape only, never native receipt or gameplay admission. */
export function hasOwnedResidentResourceShape379(v:unknown,nextId:number):boolean {
 const max=v&&typeof v==='object'?ownedLists.get(v):undefined;return max!==undefined&&max<nextId;
}
export function hasOwnedResidentResourceTransport379(v:object,keys:ReadonlySet<PropertyKey>):boolean {
 if(!ownedRows.has(v)&&!ownedLists.has(v)||Object.getPrototypeOf(Object.prototype)!==null)return false;
 for(const key of resourceKeys)if(keys.has(key))return false;
 for(const key of Reflect.ownKeys(Object.prototype))if(keys.has(key))return false;
 return true;
}
function readShapes(raw:unknown,allowed:ReadonlySet<string>):string[][]|undefined {
 const rows=captureDense(raw,65536);if(!rows)return;const result:string[][]=[];
 for(const rawRow of rows){const row=captureDense(rawRow,MAX_FIELDS);if(!row||row.some(key=>typeof key!=='string'||!allowed.has(key))||new Set(row).size!==row.length)return;result.push(row as string[]);}return result;
}
function construct(keys:readonly string[],values:readonly unknown[]):Data {
 const out:Data={};for(let i=0;i<keys.length;i++)Object.defineProperty(out,keys[i]!,{value:values[i],enumerable:true,writable:true,configurable:true});return out;
}
function decodeRows(raw:unknown,nextId:number):{values:Resource[];slots:Map<number,number>;maxId:number}|undefined {
 const data=captureRecord(raw);if(!data||!exact(data,['shapes','layouts','numbers','strings','objectShapes','objectLayouts','objectNumbers'])
  ||!column(data.layouts,Uint16Array,MAX_ROWS)||!column(data.numbers,Float64Array,MAX_ROWS*MAX_FIELDS)
  ||!column(data.objectLayouts,Uint16Array,MAX_ROWS*2)||!column(data.objectNumbers,Float64Array,MAX_ROWS*MAX_FIELDS*2))return;
 const shapes=readShapes(data.shapes,resourceKeys),objectShapes=readShapes(data.objectShapes,nestedKeys),strings=captureDense(data.strings,MAX_ROWS*MAX_FIELDS);if(!shapes||!objectShapes||!strings||strings.some(v=>typeof v!=='string'))return;
 // All remaining reads are indexed reads of genuine, non-shared typed arrays.
 // The external key/string graphs have already been detached by descriptors.
 const layouts=data.layouts,numbers=data.numbers,objectLayouts=data.objectLayouts,objectNumbers=data.objectNumbers;
 const objects:Data[]=[],objectFields:string[][]=[];let at=0;
 for(let i=0;i<objectLayouts.length;i++){
  const keys=objectShapes[objectLayouts[i]!];if(!keys||at+keys.length>objectNumbers.length)return;const values:unknown[]=[];
  for(const _key of keys){const n=objectNumbers[at++]!;if(!Number.isFinite(n)&&!Number.isNaN(n))return;values.push(Number.isNaN(n)?undefined:n);}
  objects.push(Object.freeze(construct(keys,values)));objectFields.push(keys);
 }
 if(at!==objectNumbers.length)return;
 const values=residentOwnerArray379<Resource>(),slots=new Map<number,number>();let maxId=0;at=0;
 for(let i=0;i<layouts.length;i++){
  const keys=shapes[layouts[i]!];if(!keys||at+keys.length>numbers.length)return;const fields:unknown[]=[];
  for(const key of keys){
   const n=numbers[at++]!;if(Number.isNaN(n)){fields.push(undefined);continue;}
   if(numeric.has(key)){if(!Number.isFinite(n))return;fields.push(n);}
   else if(text.has(key)){if(!integer(n,0,strings.length-1))return;fields.push(strings[n]);}
   else if(key==='sown291'){if(n!==0&&n!==1)return;fields.push(n===1);}
   else {if(!integer(n,0,objects.length-1)||objectFields[n]!.some(field=>!(key==='plantLife'?lifeKeys:blightKeys).has(field)))return;fields.push(objects[n]);}
  }
  const row=construct(keys,fields) as unknown as Resource;if(!integer(row.id,1,nextId-1)||slots.has(row.id))return;
  slots.set(row.id,values.length);maxId=Math.max(maxId,row.id);values.push(sealedRow(row));
 }
 if(at!==numbers.length)return;return {values:sealedList(values,maxId),slots,maxId};
}

/** Source selection is negotiated only by the fixed presentation entry. An
 * unsupported row switches to the original literal path until checkpoint. */
export class ResidentResourceRowsEncoder379 {
 private active=false;
 clear():void {this.active=false;}
 capture(packet:SnapshotMessage<true>):{packet:SnapshotMessage<true>;resources?:ResidentResourceSection379} {
  const checkpoint=packet.kind==='checkpoint';if(!checkpoint&&!this.active)return {packet};
  const patch=packet as unknown as {resources?:{upserted:Resource[]}},raw=checkpoint?(packet.world as unknown as {resources:Resource[]}).resources:patch.resources?.upserted;
  const rows=raw===undefined?null:encodeRows(raw);if(rows===undefined){this.active=false;return {packet};}
  this.active=true;
  if(checkpoint)return {packet:{...packet,world:{...packet.world,resources:0}} as unknown as SnapshotMessage<true>,resources:{checkpoint,rows}};
  return {packet:patch.resources?{...packet,resources:{...patch.resources,upserted:0}} as unknown as SnapshotMessage<true>:packet,resources:{checkpoint,rows}};
 }
}

const privateSlots=new WeakMap<ReadonlyMap<number,number>,Map<number,number>>();
function immutableSlots(map:Map<number,number>):ReadonlyMap<number,number> {
 const view:ReadonlyMap<number,number>=Object.freeze({get size(){return map.size;},get:(id:number)=>map.get(id),has:(id:number)=>map.has(id),
  entries:()=>map.entries(),keys:()=>map.keys(),values:()=>map.values(),[Symbol.iterator]:()=>map[Symbol.iterator](),
  forEach:(callback:(value:number,key:number,map:ReadonlyMap<number,number>)=>void,thisArg?:unknown)=>map.forEach((value,key)=>callback.call(thisArg,value,key,view))});privateSlots.set(view,map);return view;
}
interface State {readonly epoch:number;readonly revision:number;readonly values:Resource[];readonly slots:ReadonlyMap<number,number>;readonly maxId:number}
export interface PreparedResidentResources379 {
 readonly generation:number;
 readonly previous:State|undefined;readonly state:State;readonly packet:SnapshotMessage<true>;
 readonly indices:number[]|undefined;readonly edge:ResourceStructureCandidate|undefined;readonly baseEdge:ResourceStructureCandidate|undefined;
}
const preparations=new WeakMap<object,PreparedResidentResources379>();
export function bindPreparedResidentResources379(packet:SnapshotMessage<true>,draft:PreparedResidentResources379):void {preparations.set(packet,draft);}
export function readPreparedResidentResources379(packet:SnapshotMessage<true>,previous:World|undefined):PreparedResidentResources379|undefined {
 const draft=preparations.get(packet);return draft&&(packet.kind==='checkpoint'||draft.previous?.values===previous?.resources)?draft:undefined;
}
function intList(raw:unknown,nextId:number):number[]|undefined {
 const list=captureDense(raw,MAX_ROWS);if(!list||list.some(n=>!integer(n,1,nextId-1)))return;return Object.freeze(list) as unknown as number[];
}
function tuples(raw:unknown,count:number,privateRaw=false):Float64Array|undefined {
 if(!column(raw,Float64Array,count*4)||raw.length%4)return;if(privateRaw)return raw;const out=new Float64Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw[i]!;return out;
}
/** Diagnostic independent comparison. Shared life records and all own key
 * order/undefined/numeric bits must survive the same immutable preparation. */
function sameResourceGraphs379(a:unknown,b:unknown):boolean {
 const left=new WeakMap<object,object>(),right=new WeakMap<object,object>();
 const visit=(x:unknown,y:unknown):boolean=>{
  if(!x||!y||typeof x!=='object'||typeof y!=='object')return Object.is(x,y);
  const old=left.get(x),other=right.get(y);if(old||other)return old===y&&other===x;left.set(x,y);right.set(y,x);
  if(Object.getPrototypeOf(x)!==Object.getPrototypeOf(y))return false;const keys=Reflect.ownKeys(x),next=Reflect.ownKeys(y);if(keys.length!==next.length)return false;
  for(let i=0;i<keys.length;i++){const key=keys[i]!;if(key!==next[i])return false;const a=Object.getOwnPropertyDescriptor(x,key),b=Object.getOwnPropertyDescriptor(y,key);if(!a||!b||!Object.hasOwn(a,'value')||!Object.hasOwn(b,'value')||a.enumerable!==b.enumerable||!visit(a.value,b.value))return false;}return true;
 };return visit(a,b);
}

/** One private immutable resource predecessor. No old mutable World array is
 * adopted into it, and no state advances until the enclosing Full commits. */
export class ResidentResourceFrameOwner379 {
 private current:State|undefined;
 private generation=0;
 private readonly drafts=new WeakSet<object>();
 clear():void {this.current=undefined;this.generation++;}
 prepare(packet:SnapshotMessage<true>,raw:unknown,privateLease379?:unknown):PreparedResidentResources379|undefined {
  const generation=this.generation;
  try{
   const privateRaw=readPrivateNativeAuxLease379(privateLease379,'resources',raw,Object.getOwnPropertyDescriptor(packet,'resources')?.value),lifeOwned=privateRaw&&stablePlantFacts379();
   const outer=captureRecord(packet),world=captureRecord(outer?.world),section=captureRecord(raw);if(!outer||!world||!section)return;
   const source={...outer,world} as unknown as SnapshotMessage<true>,draft=this.prepareChecked(source,section,privateRaw,lifeOwned);
   if(privateRaw&&(verifyTerrainWriteCaches||verifyResourceJournal)){
    const oracle=this.prepareChecked(source,section,false,false);
    if(!!draft!==!!oracle||draft&&oracle&&(!sameResourceGraphs379(draft.state.values,oracle.state.values)||!sameResourceGraphs379([draft.indices,draft.edge,draft.baseEdge],[oracle.indices,oracle.edge,oracle.baseEdge])||draft.state.values.some(row=>draft.state.slots.get(row.id)!==oracle.state.slots.get(row.id))))throw Error('Private Native resources differ from exhaustive preparation');
   }
   if(!draft)return;
   Object.freeze(draft.state);if(draft.indices)Object.freeze(draft.indices);
   const sealEdge=(edge:ResourceStructureCandidate|undefined)=>{if(!edge)return;for(const rows of [edge.removed,edge.added,edge.updated]){for(const row of rows)Object.freeze(row);Object.freeze(rows);}Object.freeze(edge);};
   sealEdge(draft.edge);sealEdge(draft.baseEdge);if(generation!==this.generation)return;
   const prepared=Object.freeze({...draft,generation});this.drafts.add(prepared);return prepared;
  }catch{return;}
 }
 private prepareChecked(packet:SnapshotMessage<true>,raw:unknown,privateRaw=false,lifeOwned=false):Omit<PreparedResidentResources379,'generation'>|undefined {
  const previous=this.current,checkpoint=packet.kind==='checkpoint',nextId=packet.world.nextId;
  if(!record(raw)||!exact(raw,['checkpoint','rows'])||raw.checkpoint!==checkpoint||!integer(nextId,1)
   ||!checkpoint&&(!previous||previous.epoch!==packet.epoch||previous.revision!==packet.baseRevision||packet.revision!==previous.revision+1))return;
  if(checkpoint){
   if((packet.world as unknown as Data).resources!==0||raw.rows===null)return;const decoded=decodeRows(raw.rows,nextId);if(!decoded)return;
   const state:State={epoch:packet.epoch,revision:packet.revision,...decoded,slots:immutableSlots(decoded.slots)},full={...packet,world:{...packet.world,resources:state.values}} as SnapshotMessage<true>;
   return {previous,state,packet:full,indices:undefined,edge:undefined,baseEdge:undefined};
  }
  const before=previous!,old=before.values,oldSlots=privateSlots.get(before.slots)??before.slots;
  if(!own(packet,'resources')){
   if(raw.rows!==null)return;const edge:ResourceStructureCandidate={beforeCount:old.length,afterCount:old.length,removed:[],added:[],updated:[]};
   return {previous,state:{...before,revision:packet.revision},packet,indices:[],edge,baseEdge:edge};
  }
  const patch=captureRecord((packet as unknown as Data).resources);
  if(!patch||Object.keys(patch).some(key=>!['removed','upserted','order','growth','life'].includes(key))||!own(patch,'removed')||patch.upserted!==0||raw.rows===null)return;
  const decoded=decodeRows(raw.rows,nextId),gone=intList(patch.removed,nextId),order=own(patch,'order')?intList(patch.order,nextId):undefined;
  if(!decoded||!gone||own(patch,'order')&&!order)return;
  const growth=own(patch,'growth')?tuples(patch.growth,old.length,privateRaw):undefined,life=own(patch,'life')?tuples(patch.life,old.length,privateRaw):undefined;
  if(own(patch,'growth')&&!growth||own(patch,'life')&&!life)return;
  const restored={...patch,removed:gone,upserted:decoded.values,...order?{order}:{},...growth?{growth}:{},...life?{life}:{}};
  if(!gone.length&&!own(patch,'order')&&decoded.values.every(row=>oldSlots.has(row.id))){
   // Exact existing-ID path: one copy on the first write, and indices/edges
   // collected alongside each checked tuple. No writes Map or second walk of
   // all changed IDs; the private membership index survives unchanged.
   let values=old;const touched=new Set<number>(),indices:number[]=[],updated:ResourceStructureCandidate['updated'][number][]=[],baseUpdated:ResourceStructureCandidate['updated'][number][]=[];
   for(const row of decoded.values){
    const slot=oldSlots.get(row.id);if(slot===undefined||old[slot]?.id!==row.id)return;
    if(values===old)values=residentOwnerArraySlice379(old);values[slot]=row;touched.add(row.id);indices.push(slot);updated.push({id:row.id,afterOrdinal:slot});baseUpdated.push({id:row.id,afterOrdinal:slot});
   }
   if(growth)for(let i=0;i<growth.length;i+=4){
    const id=growth[i]!,value=growth[i+1]!,tick=growth[i+2]!,factor=growth[i+3]!,slot=oldSlots.get(id),prior=old[slot??-1];
    if(!integer(id,1,nextId-1)||!prior||typeof prior.growth!=='number'||touched.has(id)||!Number.isFinite(value)||value<0||value>1||!integer(tick,0,packet.world.tick)||!Number.isNaN(factor)&&(!Number.isFinite(factor)||factor<0||factor>1)||slot===undefined||prior.id!==id)return;
    const row={...prior,growth:value,growthTick:tick};if(Number.isNaN(factor))delete row.growthThermalFactor;else Object.defineProperty(row,'growthThermalFactor',{value:factor,enumerable:true,writable:true,configurable:true});
    inheritLife379(prior,row,lifeOwned);
    if(values===old)values=residentOwnerArraySlice379(old);values[slot]=sealedRow(row);touched.add(id);indices.push(slot);updated.push({id,afterOrdinal:slot});
   }
   if(life)for(let i=0;i<life.length;i+=4){
    const id=life[i]!,slot=oldSlots.get(id),prior=old[slot??-1];if(!integer(id,1,nextId-1)||!prior?.plantLife||touched.has(id)||slot===undefined||prior.id!==id)return;
    const row={...prior,plantLife:Object.freeze({...prior.plantLife,age:life[i+1]!,darkTicks:life[i+2]!,nextCheck:life[i+3]!})};if(!validLifePatch379(prior,row,packet.world.schemaVersion,packet.world,lifeOwned))return;
    if(values===old)values=residentOwnerArraySlice379(old);values[slot]=sealedRow(row);touched.add(id);indices.push(slot);updated.push({id,afterOrdinal:slot});
   }
   const edge:ResourceStructureCandidate={beforeCount:old.length,afterCount:old.length,removed:[],added:[],updated},state:State={epoch:packet.epoch,revision:packet.revision,values:values===old?old:sealedList(values,before.maxId),slots:before.slots,maxId:before.maxId};
   return {previous,state,packet:{...packet,resources:restored} as SnapshotMessage<true>,indices,edge,baseEdge:{...edge,updated:baseUpdated}};
  }
  const touched=new Set<number>(),removed:ResourceStructureCandidate['removed'][number][]=[],writes=new Map<number,Resource>();
  for(const id of gone){const slot=oldSlots.get(id);if(slot===undefined||touched.has(id))return;touched.add(id);removed.push({id,beforeOrdinal:slot});}
  for(const row of decoded.values){if(touched.has(row.id))return;touched.add(row.id);writes.set(row.id,row);}
  const read=(id:number)=>writes.get(id)??old[oldSlots.get(id)??-1];
  if(growth)for(let i=0;i<growth.length;i+=4){
   const id=growth[i]!,value=growth[i+1]!,tick=growth[i+2]!,factor=growth[i+3]!,prior=read(id);
   if(!integer(id,1,nextId-1)||!prior||typeof prior.growth!=='number'||touched.has(id)||!Number.isFinite(value)||value<0||value>1||!integer(tick,0,packet.world.tick)||!Number.isNaN(factor)&&(!Number.isFinite(factor)||factor<0||factor>1))return;
   const row={...prior,growth:value,growthTick:tick};if(Number.isNaN(factor))delete row.growthThermalFactor;else Object.defineProperty(row,'growthThermalFactor',{value:factor,enumerable:true,writable:true,configurable:true});
   inheritLife379(prior,row,lifeOwned);
   touched.add(id);writes.set(id,sealedRow(row));
  }
  if(life)for(let i=0;i<life.length;i+=4){
   const id=life[i]!,prior=read(id);if(!integer(id,1,nextId-1)||!prior?.plantLife||touched.has(id))return;
   const row={...prior,plantLife:Object.freeze({...prior.plantLife,age:life[i+1]!,darkTicks:life[i+2]!,nextCheck:life[i+3]!})};
   if(!validLifePatch379(prior,row,packet.world.schemaVersion,packet.world,lifeOwned))return;touched.add(id);writes.set(id,sealedRow(row));
  }
  const sparse=!gone.length&&!order&&decoded.values.every(row=>oldSlots.has(row.id)),appended=order||sparse?[]:decoded.values.filter(row=>!oldSlots.has(row.id));let values:Resource[],slots:ReadonlyMap<number,number>;
  if(order){
   const byId=new Map<number,Resource>();for(const row of old)byId.set(row.id,row);for(const id of gone)byId.delete(id);for(const [id,row]of writes)byId.set(id,row);
   if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!byId.has(id)))return;values=residentOwnerArray379<Resource>();for(const id of order)values.push(byId.get(id)!);
  }else if(sparse){values=writes.size?residentOwnerArraySlice379(old):old;for(const [id,row]of writes)values[oldSlots.get(id)!]=row;}
  else values=nextResidentMembershipValues379(old,oldSlots,removed,writes,appended);
  slots=sparse?before.slots:order?residentOrdinalSlots379(values):nextResidentOrdinalSlots379(before.slots,removed,appended,values);
  const maxId=Math.max(before.maxId,decoded.maxId),state:State={epoch:packet.epoch,revision:packet.revision,values:values===old?old:sealedList(values,maxId),slots,maxId};
  const edge:ResourceStructureCandidate|undefined=order?undefined:{beforeCount:old.length,afterCount:values.length,removed,
   added:[...writes.keys()].filter(id=>!oldSlots.has(id)).map(id=>({id,afterOrdinal:slots.get(id)!})),updated:[...writes.keys()].filter(id=>oldSlots.has(id)).map(id=>({id,afterOrdinal:slots.get(id)!}))};
  const baseEdge=edge?{...edge,updated:decoded.values.filter(row=>oldSlots.has(row.id)).map(row=>({id:row.id,afterOrdinal:slots.get(row.id)!}))}:undefined;
  return {previous,state,packet:{...packet,resources:restored} as SnapshotMessage<true>,indices:sparse?[...touched].map(id=>slots.get(id)!):undefined,edge,baseEdge};
 }
 canCommit(world:World,draft:PreparedResidentResources379):boolean {return this.drafts.has(draft)&&draft.generation===this.generation&&draft.previous===this.current&&world.resources===draft.state.values&&ownedLists.has(world.resources);}
 commit(world:World,draft:PreparedResidentResources379):void {if(!this.canCommit(world,draft))throw Error('Lost immutable resource predecessor');this.drafts.delete(draft);this.current=draft.state;}
}
