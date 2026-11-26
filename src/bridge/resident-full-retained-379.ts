import type {Job,World} from '../sim/types';
import type {ThermalRegion,ThermalState} from '../sim/temperature';
import type {SnapshotMessage} from './snapshots';
import {terrainJournalReadOwner} from '../sim/terrain-read-scope';
import {verifyTerrainWriteCaches} from '../sim/terrain-mutation-journal';
import {verifyResourceJournal} from '../sim/resource-mutation-journal';
import {residentOwnerRecord379,residentOwnerArray379,residentOwnerArraySlice379} from './resident-owner-records-379';

/** Fixed Full only. Public snapshots stay literal. Job rows are compact only
 * in the ordinary scalar + owned escrow family; unknown/nested rows keep the
 * historical wire. Thermal membership is an actual immutable topology owner.
 * A delta cannot carry a reference outside its exact Full predecessor. */
type Packet=SnapshotMessage<true>;
type Data=Record<string,unknown>;
type Literal={readonly mode:'literal'};
type JobsSection=Literal|{readonly mode:'rows';readonly reset:boolean;readonly count:number;readonly removed:readonly number[];readonly upserted:readonly Job[];readonly order?:readonly number[]};
type ThermalSection=Literal|{readonly mode:'regions';readonly reset:true;readonly count:number;readonly value:ThermalState}|{readonly mode:'regions';readonly reset:false;readonly count:number;readonly temperatures:Float64Array};
export interface ResidentFullRetainedDelta379 {readonly epoch:number;readonly revision:number;readonly tick:number;readonly checkpoint:boolean;readonly baseRevision?:number;readonly jobs:JobsSection;readonly thermal:ThermalSection}
interface JobsHeld {readonly rows:Job[];readonly slots:ReadonlyMap<number,number>;readonly maxId:number}
interface ThermalCapture {readonly value:ThermalState;readonly source:ThermalState;readonly cells:readonly number[][];readonly generation:object}
interface Held {readonly epoch:number;readonly revision:number;readonly tick:number;readonly jobs?:JobsHeld;readonly thermal?:ThermalState}
interface ProducerHeld extends Held {readonly thermalCapture?:ThermalCapture}
type Captured={readonly publication:Packet;readonly delta:ResidentFullRetainedDelta379;readonly previous:ProducerHeld|undefined;readonly next:ProducerHeld};
export interface PreparedResidentFullRetained379 {readonly packet:Packet;readonly previous:Held|undefined;readonly next:Held;readonly owner:object}
let generation={};
/** Actual commands/speculative campaign transactions do not inherit proofs. */
export function invalidateFullRetained379():void {generation={};}
const own=Object.hasOwn;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const primitive=(v:unknown)=>v===null||v===undefined||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v);
const finiteTemperature=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=-273.15&&v<=1000;
function fields(value:unknown):Record<string,PropertyDescriptor>|undefined {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return;
 const keys=Reflect.ownKeys(value),out:Record<string,PropertyDescriptor>=Object.create(null);
 for(const key of keys){if(typeof key!=='string')return;const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!own(d,'value'))return;out[key]=d;}
 return out;
}
function dense(value:unknown):value is unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)return false;
 for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,i);if(!d?.enumerable||!own(d,'value'))return false;}return true;
}
function exact(value:unknown,keys:readonly string[]):value is Data {const data=fields(value);return !!data&&Object.keys(data).length===keys.length&&keys.every(k=>own(data,k));}
function define(out:Data,key:string,value:unknown):void {Object.defineProperty(out,key,{value,writable:true,enumerable:true,configurable:true});}
const coreJobKeys=['id','kind','x','z','orientation','footprint','status','reservedBy','progress','escrow'] as const;
const scalarJobKeys=new Set<string>([...coreJobKeys.filter(k=>k!=='escrow'),'forbidden379','tailorSteel379','frameDamage','floor','pickTicks','workRemainder','material','installationWork','construction','growingZoneId','flowerPotId']);
/** A root only has scalar fields and its unique two-number escrow. The
 * exclusive gameplay source is born from JSON or the actual Job constructors;
 * every constructor owns a fresh escrow and refreshStock replaces it from a
 * job-ID-local Map. No actor or other saved domain retains a Job record (only
 * its ID); world.stock is a separate object. Nested task/target variants are
 * deliberately NOT enrolled. No generic recursive graph interning. */
function ordinaryJob(value:unknown,nextId:number,before?:Job):{row:Job;escrow:object}|undefined {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||!coreJobKeys.every(k=>own(value,k)))return;
 const id=Object.getOwnPropertyDescriptor(value,'id'),escrowField=Object.getOwnPropertyDescriptor(value,'escrow');
 if(!id?.enumerable||!own(id,'value')||!integer(id.value,1,nextId-1)||!escrowField?.enumerable||!own(escrowField,'value'))return;
 const escrow=escrowField.value,stock=fields(escrow),stockKeys=stock&&Object.keys(stock);
 if(!stock||stockKeys!.length!==2||!own(stock,'wood')||!own(stock,'food')||!integer(stock.wood!.value)||!integer(stock.food!.value))return;
 const keys=Reflect.ownKeys(value),beforeKeys=before&&Object.keys(before),beforeStock=before&&Object.keys(before.escrow),values:unknown[]=[];
 let same=!!before&&beforeKeys!.length===keys.length&&beforeStock!.length===stockKeys!.length&&stockKeys!.every((k,i)=>k===beforeStock![i]&&Object.is((before!.escrow as unknown as Data)[k],stock[k]!.value));
 for(let i=0;i<keys.length;i++){
  const key=keys[i]!;if(typeof key!=='string')return;const field=key==='id'?id:key==='escrow'?escrowField:Object.getOwnPropertyDescriptor(value,key);
  if(!field?.enumerable||!own(field,'value'))return;const v=field.value;if(key!=='escrow'&&(!scalarJobKeys.has(key)||!primitive(v)))return;values.push(v);
  if(same&&(beforeKeys![i]!==key||key!=='escrow'&&!Object.is((before as unknown as Data)[key],v)))same=false;
 }
 if(same)return {row:before!,escrow};
 const row=residentOwnerRecord379<Data,Data>({},{}),copy=residentOwnerRecord379<Data,Data>({},{});for(const key of stockKeys!)define(copy,key,stock[key]!.value);Object.freeze(copy);
 for(let i=0;i<keys.length;i++){const key=keys[i] as string;define(row,key,key==='escrow'?copy:values[i]);}
 return {row:Object.freeze(row) as unknown as Job,escrow};
}
const jobProofs=new WeakMap<object,number>();
/** Representation proof, not admission: this array and every row is private
 * frozen, dense and unique. Global/semantic construction checks still run. */
export function hasOwnedRetainedJobsShape379(value:unknown,nextId:number):boolean {return !!value&&typeof value==='object'&&(jobProofs.get(value)??Infinity)<nextId;}
function heldJobs(rows:Job[],previous?:JobsHeld):JobsHeld {
 if(previous&&rows.length===previous.rows.length&&rows.every((r,i)=>r===previous.rows[i]))return previous;
 if(previous&&rows.length===previous.rows.length&&rows.every((r,i)=>r.id===previous.rows[i]!.id)){
  const held={rows:Object.freeze(rows) as Job[],slots:previous.slots,maxId:previous.maxId};jobProofs.set(held.rows,held.maxId);return held;
 }
 const slots=new Map<number,number>();let maxId=0;for(let i=0;i<rows.length;i++){slots.set(rows[i]!.id,i);maxId=Math.max(maxId,rows[i]!.id);}
 const held={rows:Object.freeze(rows) as Job[],slots,maxId};jobProofs.set(held.rows,maxId);return held;
}
function captureJobs(source:World,nextId:number,old:JobsHeld|undefined):{section:JobsSection;held?:JobsHeld} {
 if(!dense(source.jobs)||source.jobs.length>Math.min(nextId-1,32768))return {section:{mode:'literal'}};
 const rows=residentOwnerArray379<Job>(),upserted:Job[]=[],seen=new Set<number>(),escrows=new Set<object>();
 for(const raw of source.jobs){
  if(!raw||typeof raw!=='object')return {section:{mode:'literal'}};
  const id=Object.getOwnPropertyDescriptor(raw,'id')?.value,before=old?.rows[old.slots.get(id)??-1],read=ordinaryJob(raw,nextId,before);
  if(!read||seen.has(read.row.id)||escrows.has(read.escrow)||source.stock===read.escrow)return {section:{mode:'literal'}};
  seen.add(read.row.id);escrows.add(read.escrow);rows.push(read.row);if(read.row!==before)upserted.push(read.row);
 }
 const removed=(old?.rows??[]).filter(row=>!seen.has(row.id)).map(row=>row.id);
 let order:number[]|undefined;
 if(old&&(rows.length!==old.rows.length||rows.some((row,i)=>row.id!==old.rows[i]!.id))){
  const implicit=old.rows.filter(row=>seen.has(row.id)).map(row=>row.id);for(const row of upserted)if(!old.slots.has(row.id))implicit.push(row.id);
  if(implicit.length!==rows.length||implicit.some((id,i)=>id!==rows[i]!.id))order=rows.map(row=>row.id);
 }
 const held=heldJobs(rows,old);
 return {section:{mode:'rows',reset:!old,count:rows.length,removed,upserted,...order?{order}:{}},held};
}

/** Cold topology admission: exact owned cells are copied and checked once.
 * The actual geometry creators (thermal topology/reconciliation, the clone
 * for explosions, the roof transaction) replace the state/region/cell owner
 * and never edit a live cell list in place. Each region's separately created
 * cell array belongs only to the thermal owner; it is not a world zone. */
function freezeThermal(value:unknown,area:number):ThermalState|undefined {
 if(!exact(value,['regions'])||!dense(value.regions)||!value.regions.length||value.regions.length>area)return;
 const regions:ThermalRegion[]=[],seen=new Set<number>();let last=-1;
 for(const raw of value.regions){
  if(!exact(raw,['cells','temperature'])||!finiteTemperature(raw.temperature)||!dense(raw.cells)||!raw.cells.length||raw.cells.length>area||!integer(raw.cells[0],last+1,area-1))return;
  last=raw.cells[0];let previous=-1;const cells:number[]=[];
  for(const cell of raw.cells){if(!integer(cell,previous+1,area-1)||seen.has(cell))return;previous=cell;seen.add(cell);cells.push(cell);}
  const row:Data={};for(const key of Object.keys(raw))define(row,key,key==='cells'?Object.freeze(cells):raw.temperature);
  regions.push(Object.freeze(row) as unknown as ThermalRegion);
 }
 return Object.freeze({regions:Object.freeze(regions) as ThermalRegion[]});
}
function captureThermal(source:ThermalState|undefined,area:number,old?:ThermalCapture):{section:ThermalSection;held?:ThermalCapture} {
 if(!source||!exact(source,['regions'])||!Array.isArray(source.regions))return {section:{mode:'literal'}};
 let sameLayout=!!old&&old.generation===generation&&old.source===source&&source.regions.length===old.cells.length;
 if(sameLayout)for(let i=0;i<source.regions.length;i++){
  const row=source.regions[i]!,previous=old!.value.regions[i]!;
  if(!exact(row,['cells','temperature'])||!finiteTemperature(row.temperature)||row.cells!==old!.cells[i]||row.cells.length!==previous.cells.length||Object.keys(row).some((k,j)=>k!==Object.keys(previous)[j])){sameLayout=false;break;}
 }
 if(sameLayout){
  if(verifyTerrainWriteCaches||verifyResourceJournal)for(let i=0;i<source.regions.length;i++)if(source.regions[i]!.cells.some((cell,j)=>!Object.is(cell,old!.value.regions[i]!.cells[j])))throw Error('Unmarked thermal geometry write in retained Full');
  const changes:number[]=[],rows=old!.value.regions.slice();
  for(let i=0;i<rows.length;i++){const previous=rows[i]!,temperature=source.regions[i]!.temperature;if(Object.is(previous.temperature,temperature))continue;changes.push(i,temperature);rows[i]=Object.freeze({...previous,temperature});}
  const value=changes.length?Object.freeze({regions:Object.freeze(rows) as ThermalRegion[]}):old!.value;
  return {section:{mode:'regions',reset:false,count:rows.length,temperatures:new Float64Array(changes)},held:{...old!,value}};
 }
 const value=freezeThermal(source,area);if(!value)return {section:{mode:'literal'}};
 return {section:{mode:'regions',reset:true,count:value.regions.length,value},held:{value,source,cells:source.regions.map(r=>r.cells),generation}};
}
const header=(packet:Packet)=>({epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,checkpoint:packet.kind==='checkpoint',...packet.kind==='delta'?{baseRevision:packet.baseRevision}:{}});
function predecessor(packet:Packet,old:Held|undefined):boolean {return integer(packet.epoch,1)&&integer(packet.revision,1)&&integer(packet.world.tick)&&integer(packet.world.nextId,1)&&(packet.kind==='checkpoint'||!!old&&packet.epoch===old.epoch&&packet.baseRevision===old.revision&&packet.revision===old.revision+1&&packet.world.tick>=old.tick);}
export class ResidentFullRetainedEncoder379 {
 private current:ProducerHeld|undefined;
 constructor(private readonly sourceOwner:object){}
 clear():void {this.current=undefined;}
 prepare(packet:Packet,source:World|undefined):Captured {
  const previous=this.current;if(!predecessor(packet,previous))throw Error('Missing retained Full producer predecessor');
  const old=packet.kind==='checkpoint'?undefined:previous,world={...packet.world} as unknown as Data;
  // The fixed worker supplies the actual synchronously published world. A
  // packet alone, even one containing structurally identical rows, has no
  // closed source or topology proof. Public helper calls remain literal.
  const owned=!!source&&terrainJournalReadOwner()===this.sourceOwner;
  const jobs:{section:JobsSection;held?:JobsHeld}=owned&&source!.jobs===packet.world.jobs?captureJobs(source!,packet.world.nextId,old?.jobs):{section:{mode:'literal'}},
   thermal:{section:ThermalSection;held?:ThermalCapture}=owned&&source!.thermal===packet.world.thermal?captureThermal(source!.thermal,packet.world.width*packet.world.height,old?.thermalCapture):{section:{mode:'literal'}};
  if(jobs.section.mode==='rows')world.jobs=0;if(thermal.section.mode==='regions')world.thermal=0;
  const meta=header(packet),next={epoch:meta.epoch,revision:meta.revision,tick:meta.tick,jobs:jobs.held,thermal:thermal.held?.value,thermalCapture:thermal.held};
  return {publication:{...packet,world} as unknown as Packet,delta:{...meta,jobs:jobs.section,thermal:thermal.section},previous,next};
 }
 commit(captured:Captured):void {if(captured.previous!==this.current)throw Error('Lost retained Full producer predecessor');this.current=captured.next;}
}

function prepareJobs(raw:Data,old:JobsHeld|undefined,packet:Packet):JobsHeld|undefined {
 const nextId=packet.world.nextId;
 if(!exact(raw,own(raw,'order')?['mode','reset','count','removed','upserted','order']:['mode','reset','count','removed','upserted'])||raw.reset!==!old||!integer(raw.count,0,Math.min(nextId-1,32768))||!dense(raw.removed)||!dense(raw.upserted)||raw.upserted.length>32768||own(raw,'order')&&!dense(raw.order)||raw.reset&&(raw.removed.length||own(raw,'order')))return;
 const removed=new Set<number>(),writes=new Map<number,Job>(),escrows=new Set<object>();
 for(const id of raw.removed){if(!integer(id,1,nextId-1)||removed.has(id)||!old?.slots.has(id))return;removed.add(id);}
 for(const row of raw.upserted){const read=ordinaryJob(row,nextId);if(!read||removed.has(read.row.id)||writes.has(read.row.id)||escrows.has(read.escrow))return;escrows.add(read.escrow);writes.set(read.row.id,read.row);}
 let rows:Job[];
 if(old&&!removed.size&&!own(raw,'order')&&[...writes.keys()].every(id=>old.slots.has(id))){
  if(!writes.size)rows=old.rows;else{rows=residentOwnerArraySlice379(old.rows);for(const [id,row]of writes)rows[old.slots.get(id)!]=row;}
 }
 else{
  const byId=new Map<number,Job>();for(const row of old?.rows??[])if(!removed.has(row.id))byId.set(row.id,writes.get(row.id)??row);for(const [id,row]of writes)byId.set(id,row);
  rows=residentOwnerArray379<Job>();
  if(own(raw,'order')){const order=raw.order as unknown[];if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!integer(id,1,nextId-1)||!byId.has(id)))return;for(const id of order)rows.push(byId.get(id as number)!);}
  else for(const row of byId.values())rows.push(row);
 }
 const held=heldJobs(rows,old);return held.rows.length===raw.count&&held.maxId<nextId?held:undefined;
}
function prepareThermal(raw:Data,old:ThermalState|undefined,area:number):ThermalState|undefined {
 if(!integer(raw.count,1,area))return;
 if(raw.reset===true){if(!exact(raw,['mode','reset','count','value']))return;const value=freezeThermal(raw.value,area);return value?.regions.length===raw.count?value:undefined;}
 if(raw.reset!==false||!old||raw.count!==old.regions.length||!exact(raw,['mode','reset','count','temperatures']))return;
 const values=raw.temperatures;if(!(values instanceof Float64Array)||Object.getPrototypeOf(values)!==Float64Array.prototype||values.length%2||values.length>raw.count*2||Reflect.ownKeys(values).length!==values.length)return;
 const rows=old.regions.slice();let last=-1;
 for(let i=0;i<values.length;i+=2){const index=values[i],value=values[i+1];if(!integer(index,last+1,rows.length-1)||!finiteTemperature(value))return;last=index;rows[index]=Object.freeze({...rows[index]!,temperature:value});}
 return values.length?Object.freeze({regions:Object.freeze(rows) as ThermalRegion[]}):old;
}
/** Decode only before the public-shaped validator. No retained state becomes
 * current until the complete base/natural/auxiliary admission commits. */
export class ResidentFullRetainedFrameOwner379 {
 private current:Held|undefined;private readonly identity={};
 clear():void {this.current=undefined;}
 prepare(packet:Packet,raw:unknown):PreparedResidentFullRetained379|undefined {
  const previous=this.current,meta=header(packet),world={...packet.world} as unknown as Data,old=meta.checkpoint?undefined:previous;
  if(!predecessor(packet,previous)||!exact(raw,[...Object.keys(meta),'jobs','thermal'])||Object.keys(meta).some(k=>raw[k]!== (meta as unknown as Data)[k])||!fields(raw.jobs)||!fields(raw.thermal))return;
  const jobs=raw.jobs as Data,thermal=raw.thermal as Data;let heldJobs:JobsHeld|undefined,heldThermal:ThermalState|undefined;
  if(jobs.mode==='literal'){if(!exact(jobs,['mode'])||world.jobs===0)return;}
  else if(jobs.mode==='rows'){if(world.jobs!==0)return;heldJobs=prepareJobs(jobs,old?.jobs,packet);if(!heldJobs)return;world.jobs=heldJobs.rows;}
  else return;
  if(thermal.mode==='literal'){if(!exact(thermal,['mode'])||world.thermal===0)return;}
  else if(thermal.mode==='regions'){if(world.thermal!==0||!own(world,'thermal'))return;heldThermal=prepareThermal(thermal,old?.thermal,packet.world.width*packet.world.height);if(!heldThermal)return;world.thermal=heldThermal;}
  else return;
  return {owner:this.identity,packet:{...packet,world} as unknown as Packet,previous,next:{epoch:meta.epoch,revision:meta.revision,tick:meta.tick,jobs:heldJobs,thermal:heldThermal}};
 }
 canCommit(world:World,draft:PreparedResidentFullRetained379):boolean {return draft.owner===this.identity&&draft.previous===this.current&&(!draft.next.jobs||world.jobs===draft.next.jobs.rows)&&(!draft.next.thermal||world.thermal===draft.next.thermal);}
 commit(world:World,draft:PreparedResidentFullRetained379):void {if(!this.canCommit(world,draft))throw Error('Lost retained Full frame preparation');this.current=draft.next;}
}
