/** Shared resource ownership. No GPU API, frame work or implicit key quantisation.
 * A builder returns an exclusively owned resource. Demand includes its PEAK preparation
 * scratch/output/allocation; returned byte counts describe retained ownership only.
 * Pending acquires cannot be cancelled: every successful lease must be released.
 * Builders clean up their own failures before returning a resource. A disposer is
 * attempted once: exceptions quarantine the resource AND its accounted bytes.
 */
export interface AtlasKey {
 recipe:string; form:string; palette:string;
 settings:Readonly<Record<string,string|number|boolean>>;
}
export interface AtlasBytes {readonly cpuBytes:number;readonly gpuBytes:number}
export interface AtlasResource extends AtlasBytes {dispose():void}
export interface AtlasLease<T extends AtlasResource> {readonly resource:T;readonly key:string;release():void}
/** Preparation may discover its exact GPU peak after CPU geometry planning.
 * Admit it BEFORE allocating. Growth is monotonic, bounded by the caller's
 * declared ceiling, and valid only while this builder is pending. */
export interface AtlasPreparationReservation {reservePeak(bytes:AtlasBytes):void}
/** A builder could not prove that its failed preparation was fully released. */
export class AtlasBuildQuarantineError extends Error {
 constructor(readonly preparationError:unknown){super('Atlas preparation cleanup failed; peak reservation quarantined');this.name='AtlasBuildQuarantineError';}
}
type Builder<T> = (reservation:AtlasPreparationReservation)=>T|Promise<T>;
interface Entry<T> {
 key:string;declared:AtlasBytes;bytes:AtlasBytes;refs:number;stamp:number;
 state:'pending'|'ready'|'retiring'|'quarantined';promise:Promise<T>;resource?:T;dispose?:()=>void;unknownBytes?:boolean;
}
const validBytes=(v:AtlasBytes)=>Number.isSafeInteger(v.cpuBytes)&&v.cpuBytes>=0&&Number.isSafeInteger(v.gpuBytes)&&v.gpuBytes>=0;
export function exactAtlasKey(key:AtlasKey):string {
 for(const value of [key.recipe,key.form,key.palette])if(typeof value!=='string'||!value.length)throw new Error('Atlas recipe/form/palette fingerprints are required');
 const settings=Object.keys(key.settings).sort().map(name=>{
  const value=key.settings[name];
  if(typeof value==='number'){
   if(!Number.isFinite(value))throw new Error('Atlas settings require finite numbers');
   return[name,'number',Object.is(value,-0)?'-0':String(value)];
  }
  if(typeof value!=='string'&&typeof value!=='boolean')throw new Error('Atlas settings require explicit scalar values');
  return[name,typeof value,value];
 });
 return JSON.stringify([key.recipe,key.form,key.palette,settings]);
}

export class AtlasCache<T extends AtlasResource> {
 private readonly entries=new Map<string,Entry<T>>();
 private readonly owned=new WeakSet<object>();
 private readonly limits:AtlasBytes;
 private cpu=0;private gpu=0;private clock=0;private closed=false;
 constructor(limits:AtlasBytes){if(!validBytes(limits))throw new Error('Invalid atlas budget');this.limits={...limits};}
 snapshot(){
  let pending=0,ready=0,quarantined=0,unknownBytes=false,leases=0;
  for(const e of this.entries.values()){if(e.state==='pending')pending++;else if(e.state==='ready')ready++;else quarantined++;unknownBytes ||= !!e.unknownBytes;leases+=e.refs;}
  return{cpuBytes:this.cpu,gpuBytes:this.gpu,pending,ready,quarantined,unknownBytes,leases,closed:this.closed};
 }
 private remove(e:Entry<T>){
  e.state='retiring';
  try{e.dispose?.();}catch(error){e.state='quarantined';e.refs=0;throw error;}
  this.entries.delete(e.key);this.cpu-=e.bytes.cpuBytes;this.gpu-=e.bytes.gpuBytes;
 }
 private reserve(bytes:AtlasBytes){
  const fits=(cpu:number,gpu:number)=>cpu+bytes.cpuBytes<=this.limits.cpuBytes&&gpu+bytes.gpuBytes<=this.limits.gpuBytes;
  let cpu=this.cpu,gpu=this.gpu;const victims:Entry<T>[]=[];
  if(!fits(cpu,gpu))for(const e of [...this.entries.values()].filter(e=>e.state==='ready'&&e.refs===0).sort((a,b)=>a.stamp-b.stamp)){
   victims.push(e);cpu-=e.bytes.cpuBytes;gpu-=e.bytes.gpuBytes;if(fits(cpu,gpu))break;
  }
  if(!fits(cpu,gpu))throw new Error('Atlas peak budget refused; live and pending owners are protected');
  for(const e of victims)this.remove(e);
  if(!fits(this.cpu,this.gpu))throw new Error('Atlas budget changed during disposal');
  this.cpu+=bytes.cpuBytes;this.gpu+=bytes.gpuBytes;
 }
 async acquire(key:AtlasKey,demand:AtlasBytes,build:Builder<T>,initialDemand:AtlasBytes=demand):Promise<AtlasLease<T>> {
  if(this.closed)throw new Error('Atlas cache is disposed');
  if([...this.entries.values()].some(e=>e.unknownBytes))throw new Error('Atlas allocation refused: quarantined byte counts are unknown');
  if(!validBytes(demand))throw new Error('Invalid atlas reservation');
  if(!validBytes(initialDemand)||initialDemand.cpuBytes>demand.cpuBytes||initialDemand.gpuBytes>demand.gpuBytes)throw new Error('Initial atlas reservation exceeds its declared ceiling');
  const id=exactAtlasKey(key),declared={...demand};let e=this.entries.get(id);
  if(e){
   if(e.state!=='pending'&&e.state!=='ready')throw new Error('Atlas resource is retiring or quarantined');
   if(e.declared.cpuBytes!==declared.cpuBytes||e.declared.gpuBytes!==declared.gpuBytes)throw new Error('Conflicting reservation for the same atlas key');
   e.refs++;e.stamp=++this.clock;
  }else{
   this.reserve(initialDemand);
   e={key:id,declared,bytes:{...initialDemand},refs:1,stamp:++this.clock,state:'pending',promise:undefined as unknown as Promise<T>};
   const pending=e;this.entries.set(id,pending);
   const reservation:AtlasPreparationReservation=Object.freeze({reservePeak:(bytes:AtlasBytes)=>{
    if(this.closed||pending.state!=='pending'||this.entries.get(id)!==pending)throw new Error('Atlas preparation reservation is no longer pending');
    if([...this.entries.values()].some(entry=>entry.unknownBytes))throw new Error('Atlas allocation refused: quarantined byte counts are unknown');
    if(!validBytes(bytes)||bytes.cpuBytes>declared.cpuBytes||bytes.gpuBytes>declared.gpuBytes)throw new Error('Planned atlas peak exceeds its declared ceiling');
    const next={cpuBytes:Math.max(pending.bytes.cpuBytes,bytes.cpuBytes),gpuBytes:Math.max(pending.bytes.gpuBytes,bytes.gpuBytes)};
    const extra={cpuBytes:next.cpuBytes-pending.bytes.cpuBytes,gpuBytes:next.gpuBytes-pending.bytes.gpuBytes};
    this.reserve(extra);pending.bytes=next;
   }});
   pending.promise=Promise.resolve().then(()=>build(reservation)).then(resource=>{
    if(!resource)throw new Error('Builder did not return an owned atlas resource');
    if(this.owned.has(resource))throw new Error('Builder reused an already owned atlas resource');
    this.owned.add(resource);
    pending.resource=resource;
    let dispose:()=>void;
    try{dispose=resource.dispose;}catch(error){pending.state='quarantined';pending.refs=0;pending.unknownBytes=true;throw error;}
    if(typeof dispose!=='function'){
     pending.state='quarantined';pending.refs=0;pending.unknownBytes=true;throw new Error('Builder returned an atlas without a disposer');
    }
    pending.dispose=()=>dispose.call(resource);
    let actual:AtlasBytes;
    try{actual={cpuBytes:resource.cpuBytes,gpuBytes:resource.gpuBytes};}catch(error){
     pending.unknownBytes=true;try{this.remove(pending);}catch(disposal){throw new AggregateError([error,disposal],'Atlas byte read and disposal failed');}throw error;
    }
    const admitted=pending.bytes;
    if(validBytes(actual)){
     this.cpu+=actual.cpuBytes-pending.bytes.cpuBytes;this.gpu+=actual.gpuBytes-pending.bytes.gpuBytes;pending.bytes=actual;
    }else pending.unknownBytes=true;
    if(!validBytes(actual)||actual.cpuBytes>admitted.cpuBytes||actual.gpuBytes>admitted.gpuBytes){
     const error=new Error('Atlas result exceeds its admitted peak reservation');
     try{this.remove(pending);}catch(disposal){throw new AggregateError([error,disposal],'Atlas result rejection and disposal failed');}throw error;
    }
    pending.state='ready';return resource;
   }).catch(error=>{
    if(error instanceof AtlasBuildQuarantineError){pending.state='quarantined';pending.refs=0;pending.unknownBytes=true;}
    if(pending.state==='quarantined')pending.refs=0;
    else if(this.entries.get(id)===pending){this.entries.delete(id);this.cpu-=pending.bytes.cpuBytes;this.gpu-=pending.bytes.gpuBytes;}
    throw error;
   });
  }
  const entry=e,resource=await entry.promise;let released=false;
  return Object.freeze({key:id,resource,release:()=>{if(released)return;released=true;entry.refs--;entry.stamp=++this.clock;}});
 }
 /** Explicit reclamation never evicts a pending build or a published owner. */
 evictUnused(){
  let count=0;const errors:unknown[]=[];
  for(const e of [...this.entries.values()])if(e.state==='ready'&&e.refs===0){try{this.remove(e);count++;}catch(error){errors.push(error);}}
  if(errors.length)throw new AggregateError(errors,'Atlas disposal failed');return count;
 }
 dispose(){
  if(this.closed){if(this.entries.size)throw new Error('Disposed atlas cache retains quarantined allocations');return;}
  if([...this.entries.values()].some(e=>e.refs>0||e.state==='pending'))throw new Error('Release atlas owners and settle pending builds before disposing the cache');
  this.closed=true;this.evictUnused();
  if(this.entries.size)throw new Error('Atlas cache retains quarantined allocations');
 }
}

/** One publication point for asynchronous option changes. Newer requests supersede
 * older ones; a refusal/failure leaves the currently published lease untouched. */
export class AtlasSlot<T extends AtlasResource> {
 private live?:AtlasLease<T>;private epoch=0;private closed=false;
 constructor(private readonly cache:AtlasCache<T>){}
 get resource():T|undefined{return this.live?.resource;}
 async replace(key:AtlasKey,demand:AtlasBytes,build:Builder<T>):Promise<T>{
  if(this.closed)throw new Error('Atlas slot is disposed');
  const ticket=++this.epoch,next=await this.cache.acquire(key,demand,build);
  if(ticket!==this.epoch||this.closed){next.release();throw new Error('Atlas request superseded before publication');}
  const old=this.live;this.live=next;old?.release();return next.resource;
 }
 dispose(){if(this.closed)return;this.closed=true;this.epoch++;this.live?.release();this.live=undefined;}
}
