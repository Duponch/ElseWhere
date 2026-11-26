import {SCHEMA_VERSION,type World} from './types.ts';
import {validConstructionMarkers379} from './construction-state-379.ts';
import {isConstruction} from './construction-rules.ts';
import {validConstructionBatchShape379,validateConstructionBatches379} from './construction-batch-379.ts';
import {validHaulOpportunityShape379,validateHaulOpportunities379} from './haul-opportunity-379.ts';
import {groundOccupancyAllows,storageOccupancyAllows} from './occupancy.ts';
import type {StorageGeometry} from './ground-placement.ts';
const lanes=['world','summary','map','maps','dynamic','campaign','secondarySite','worldMaps','sites','entries','worldGroups','groups','state','group','pending261','battlefield261','retained','groupLosses','animalLosses','losses','lost','abandoned','abandonedContents','abandonedPawns','contents','humans','animals','pawn','actor','human','animal','body','members','people','pawns','resources','structures','jobs','packed','building','items','piles','wildlife','animalOwners','worldPawns','owners','worldFactions','leaders','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','cryptosleep','shipCryptosleep277','occupant','visitors','podRescues','departed','banishedDepartures378','startingArrival','pods','scout','commercialTrip','civilianPost','campaignMap','wallDoor296','plan','upserted','orbital','ships','deliveries','cargo','pending','departures','raids','trade','prisonDepartures','arrivals','quests','worldSites263','tradeRequests284','requests','rewards','options','haul','orders','queue','constructionBatch379','haulOpportunity379','sources','destinations'] as const;
const relevantKeys=new Set<PropertyKey>([...lanes,'forbidden379','tailorSteel379']);
type TransportCheck=(raw:unknown,version:number)=>boolean;
type OrdinaryLeafRun379=(array:readonly unknown[],from:number,accept:(leaf:object)=>boolean)=>number;
type ImmutableTransportMemo379={read:(value:object,version:number,role:number)=>number|undefined;remember:(value:object,version:number,role:number,features:number)=>void;begin:()=>void;end:()=>void;array?:(values:readonly unknown[],visit:(value:unknown)=>boolean)=>boolean|undefined};
const memoGet379=Function.call.bind(WeakMap.prototype.get) as (map:WeakMap<object,number>,key:object)=>number|undefined;
const memoSet379=Function.call.bind(WeakMap.prototype.set) as (map:WeakMap<object,number>,key:object,value:number)=>unknown;
const activeHas379=Function.call.bind(WeakSet.prototype.has) as (set:WeakSet<object>,key:object)=>boolean;
/** Inspect original owner descriptors before spread/clone or migration can
 * normalize a future marker; grids and relation-reference lists are omitted. */
export function validConstructionTransport379(raw:unknown,version:number):boolean {
 return constructionTransport379(raw,version);
}
function constructionTransport379(raw:unknown,version:number,ordinaryLeaf?:((value:object)=>boolean),ordinaryRun?:OrdinaryLeafRun379,immutable?:ImmutableTransportMemo379):boolean {
 immutable?.begin();
 try{
  if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
  // The four traversal roles have independent results. A bit mask keeps the
  // original per-role memo without allocating a Set for every resource leaf.
  const active=new WeakSet<object>(),done=new WeakMap<object,number>();
  const visit=(v:unknown,role?:'job'|'building'|'plan'):boolean=>{
   if(!v||typeof v!=='object')return true;const flag=role==='job'?2:role==='building'?4:role==='plan'?8:1;
   if(active.has(v))return false;if((done.get(v)??0)&flag)return true;
   if(immutable?.read(v,version,flag)!==undefined){done.set(v,(done.get(v)??0)|flag);return true;}
   const array=Array.isArray(v);
   // An actually ordinary record with no relevant own/inherited lane cannot
   // recurse or own a role-sensitive marker. Recheck that proof now, then
   // retain only this call's exact role result; no persistent shape cache.
   if(!array&&ordinaryLeaf?.(v)){done.set(v,(done.get(v)??0)|flag);immutable?.remember(v,version,flag,0);return true;}
   active.add(v);
   if(array){
    const projected=immutable?.array?.(v,child=>visit(child,role));
    if(projected!==undefined){if(!projected)return false;}
    else {
    if(Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)return false;
    const acceptLeaf=(leaf:object):boolean=>{
     if(activeHas379(active,leaf))return false;
     memoSet379(done,leaf,(memoGet379(done,leaf)??0)|flag);return true;
    };
    for(let i=0;i<v.length;){
     const through=ordinaryRun?.(v,i,acceptLeaf)??i;
     if(through>i){i=through;continue;}
     const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')||!visit(d.value,role))return false;i++;
    }
    }
   }else{
    if('forbidden379'in v&&role!=='job'&&role!=='plan'||'tailorSteel379'in v&&role!=='job'&&role!=='building')return false;
    if(!validConstructionMarkers379(v,version)||!validConstructionBatchShape379(v,version)||!validHaulOpportunityShape379(v,version))return false;
    for(const k of lanes){const d=Object.getOwnPropertyDescriptor(v,k);if(!d){if(k in v)return false;continue;}const childRole=k==='jobs'?'job':k==='structures'||k==='building'?'building':k==='plan'?'plan':k==='upserted'?role:undefined;if(!d.enumerable||!Object.hasOwn(d,'value')||!visit(d.value,childRole))return false;}
   }
   active.delete(v);done.set(v,(done.get(v)??0)|flag);immutable?.remember(v,version,flag,0);return true;
  };return visit(raw);
 }catch{return false;}finally{immutable?.end();}
}
export function validateConstructionForbid379(w:World,version:number):string[] {
 return constructionWorld379(w,version,validConstructionTransport379);
}
function constructionWorld379(w:World,version:number,transport:TransportCheck,storageGeometry?:StorageGeometry):string[] {
 if(!transport(w,version))return ['Invalid or future construction permission/material provenance.'];
 const errors:string[]=[...validateConstructionBatches379(w,version),...validateHaulOpportunities379(w,version,storageGeometry)];
 for(const job of w.jobs){
  if(job.forbidden379&&!isConstruction(job))errors.push('Non-construction job has a construction permission.');
  if(!job.forbidden379)continue;
  if(w.pawns.some(p=>p.jobId===job.id&&!job.clearance||p.haul?.destination.type==='job'&&p.haul.destination.jobId===job.id))errors.push('Forbidden construction retains active execution or delivery.');
 }
 return errors;
}

/** Closed native-adoption lane. The read-only witness certifies that an object
 * is ordinary (never a Proxy); it certifies NO field, descriptor or prototype.
 * All negative field/prototype facts below are read again at each visit, after
 * the witness callback, so callbacks elsewhere cannot stale a proof.
 * Public save/transport validation above never selects this lane. */
export function createConstructionValidators379(isOrdinary:(value:object)=>boolean):{
 transport:TransportCheck;world:(w:World,version:number)=>string[];
} {
 return constructionValidators379(isOrdinary);
}
/** Fixed MAIN composition only. The supplied capability proves a contiguous
 * native/local Array run without calling input code; generic/public readers
 * never select it. Its callback only updates this invocation's role memo. */
export function createResidentConstructionValidators379(isOrdinary:(value:object)=>boolean,makeRun:(keys:ReadonlySet<PropertyKey>)=>OrdinaryLeafRun379,makeImmutable?:(keys:ReadonlySet<PropertyKey>,negativeKeys:ReadonlySet<PropertyKey>)=>ImmutableTransportMemo379):{
 transport:TransportCheck;world:(w:World,version:number)=>string[];
} {
 // Marker shapes can inspect these local fields in addition to recursive
 // lanes. The owner may retain a result only when all dependencies survive.
 const dependencies=new Set<PropertyKey>([...relevantKeys,'construction','kind','revision','id','material','sourcePileId','quantity','phase','destination','carryPileId','pickupCell']);
 return constructionValidators379(isOrdinary,makeRun(relevantKeys),makeImmutable?.(dependencies,relevantKeys));
}
function constructionValidators379(isOrdinary:(value:object)=>boolean,run?:OrdinaryLeafRun379,immutable?:ImmutableTransportMemo379):{
 transport:TransportCheck;world:(w:World,version:number)=>string[];
} {
 const leaf=(value:object):boolean=>{
  if(!isOrdinary(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.getPrototypeOf(Object.prototype)!==null)return false;
  for(const key of Reflect.ownKeys(value))if(relevantKeys.has(key))return false;
  for(const key of Reflect.ownKeys(Object.prototype))if(relevantKeys.has(key))return false;
  return true;
 };
 const transport:TransportCheck=(raw,version)=>constructionTransport379(raw,version,leaf,run,immutable);
 return {transport,world:(w,version)=>constructionWorld379(w,version,transport,run ? {
   // One adopted Full generally asks about one destination. Its structures
   // array is newly received; indexing every footprint here buys no reuse.
   groundAllows:cell=>groundOccupancyAllows(w,cell),
   storageAllows:cell=>storageOccupancyAllows(w,cell),
 } : undefined)};
}
