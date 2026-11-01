import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validConstructionMaterial} from './construction-materials.ts';
import type {World} from './types.ts';
import type {NumericMembershipSink} from './numeric-membership.ts';

type LaneIndex296={readonly keys:ReadonlySet<string>;readonly order:ReadonlyMap<string,number>};
const laneIndex296=(lanes:readonly string[]):LaneIndex296=>({keys:new Set(lanes),order:new Map<string,number>(lanes.map((key,index)=>[key,index] as const))});
const NO_RECOGNIZED_LANES296:readonly string[]=Object.freeze([]);
/** Re-read pollution on every invocation. Object.prototype has null prototype;
 * a null-prototype input never inherits these entries. Do not inspect values. */
function inheritedRecognizedKeys296(index:LaneIndex296):readonly string[] {
 let result:string[]|undefined;
 for(const key of Reflect.ownKeys(Object.prototype))if(typeof key==='string'&&index.keys.has(key))(result??=[]).push(key);
 return result??NO_RECOGNIZED_LANES296;
}
/** Enumerate present own lanes, including non-enumerable ones. Unknown fields
 * and symbols remain ignored exactly as in the old closed-lane walker. The
 * old descriptor read still decides enumerable/data and never invokes getters.
 * Rank sorting keeps the historical depth-first visit order and budget count. */
function ownRecognizedKeys296(value:object,index:LaneIndex296,inherited:readonly string[]):readonly string[]|false {
 if(inherited.length&&Object.getPrototypeOf(value)===Object.prototype)
  for(const key of inherited)if(!Object.hasOwn(value,key))return false;
 let result:string[]|undefined;
 for(const key of Object.getOwnPropertyNames(value))if(index.keys.has(key))(result??=[]).push(key);
 if(result&&result.length>1)result.sort((a,b)=>index.order.get(a)!-index.order.get(b)!);
 return result??NO_RECOGNIZED_LANES296;
}
const HISTORICAL_LANES296=['world','summary','dynamic','campaign','worldMaps','worldGroups','worldPawns','worldFactions','campaignMap','secondarySite','map','maps','sites','entries','groups','group','state','groupLosses','pending261','battlefield261','retained','people','pawns','resources','wildlife','animals','piles','items','packed','building','structures','jobs','deconstruction','wallDoor296','plan','body','cryptosleep','shipCryptosleep277','occupant','human','pawn','animal','actor','contents','lost','abandoned','abandonedContents','abandonedPawns','humans','pods','animalLosses','losses','members','owners','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','upserted','orbital','ships','deliveries','cargo','pending','departures','commercialTrip','civilianPost','visitors','raids','trade','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','worldSites263','tradeRequests284','requests','rewards','options','stockpiles','filters','shelf','settings','policy','privatePolicy','linkedStorage286','policies','recreation','task','bills','ledger','destroyed','stock'] as const;
const RESIDENT_LANES296=['pawns','resources','structures','jobs','piles','stockpiles','growingZones','packed','building','bills','wildlife','animals','filth','items','fires','embers','mechanoids','projectiles','bombWaves','departed','pawn','animal','human','actor','body','occupant','cryptosleep','shipCryptosleep277','contents','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','group','groups','members','animalOwners','groupLosses','abandonedContents','abandonedPawns','lost','losses','owners','retained','people','pending261','battlefield261','orbital','ships','pending','departures','cargo','visitors','raids','prisonDepartures','podRescues','startingArrival','pods','scout','commercialTrip','civilianPost','worldPawns','entries'] as const;
const HISTORICAL_LANE_INDEX296=laneIndex296(HISTORICAL_LANES296);
const RESIDENT_LANE_INDEX296=laneIndex296(RESIDENT_LANES296);

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;};
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const record=(v:unknown):v is Record<string,unknown>=>plain(v)&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&!!data(v,k));
const keys=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>record(v)&&required.every(k=>!!data(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k)));
const supported=(v:unknown):v is number=>integer(v,1,300);

/** Shape only. Neither a descriptor nor its containing Job can invoke a getter. */
export function validWallDoorJob296(value:unknown,version:number):boolean {
 try{
  if(!supported(version)||!plain(value))return false;
  if(!('wallDoor296'in value))return true;
  if((version!==296&&!isCorePhysicalSchema297(version))||!record(value)||value.kind!=='deconstruct'||!keys(value.wallDoor296,['manual'],['plan','fromBlueprint']))return false;
  const state=value.wallDoor296;
  if(typeof state.manual!=='boolean'||'fromBlueprint'in state&&state.fromBlueprint!==true)return false;
  if(!keys(value.deconstruction,['structureId','kind'],['material'])||value.deconstruction.kind!=='wall'||!integer(value.deconstruction.structureId,1))return false;
  if(value.footprint!=='standard'||value.construction!==undefined||value.clearance!==undefined||value.growingZoneId!==undefined||value.material!==undefined||!record(value.escrow)||Object.values(value.escrow).some(n=>n!==0))return false;
  if('plan'in state){
   const plan=state.plan;
   if(!keys(plan,['revision','id','kind','material'])||plan.revision!==1||!integer(plan.id,1)||plan.id===value.id||plan.id===value.deconstruction.structureId||(plan.kind!=='door'&&plan.kind!=='autodoor')||!validConstructionMaterial(plan.kind,plan.material,296))return false;
  }
  if(!state.manual&&!('plan'in state)&&state.fromBlueprint!==true)return false;
  return true;
 }catch{return false;}
}

/** Closed owner lanes: terrain, health populations and geography
 * are deliberately absent. Job records stay in their actual local owner lane. */
export function validWallDoorHistoricalTransport296(raw:unknown,version:unknown):boolean {
 try{
  if(!supported(version))return false;
  const inherited=inheritedRecognizedKeys296(HISTORICAL_LANE_INDEX296);const active=new Set<object>();let budget=2_000_000;
  const visit=(v:unknown,lane:string):boolean=>{
   if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
   if(Array.isArray(v)){
    if(active.has(v))return false;active.add(v);
    if(v.length>100000||Reflect.ownKeys(v).length!==v.length+1)return false;
    for(let i=0;i<v.length;i++){const d=data(v,String(i));if(!d||!visit(d.value,lane))return false;}
   }else{
    if(!plain(v))return false;
    if('wallDoor296'in v&&(lane!=='jobs'||!validWallDoorJob296(v,version)))return false;
    const present=ownRecognizedKeys296(v,HISTORICAL_LANE_INDEX296,inherited);if(present===false)return false;
    // An opaque leaf cannot be an ancestor of a recognized ownership cycle.
    // It still consumes the visit budget and passes the descriptor checks.
    if(!present.length)return true;
    if(active.has(v))return false;active.add(v);
    for(const key of present){const d=data(v,key);if(!d||!visit(d.value,key))return false;}
   }
   active.delete(v);return true;
  };
  return visit(raw,'world');
 }catch{return false;}
}

/** Physical join after sparse structures, inherited Jobs and current actors
 * have been reconstructed. A queued order alone never owns implicit work. */
export function validWallDoorWorld296(world:World):boolean {
 try{
  const version=Number(world.schemaVersion);if(!supported(version))return false;
  const ids=new Set<number>();
  for(const job of world.jobs){
   if(!validWallDoorJob296(job,version))return false;
   const state=job.wallDoor296;if(!state)continue;
   if(world.piles.some(p=>p.owner.type==='job'&&(p.owner.jobId===job.id||p.owner.jobId===state.plan?.id)))return false;
   const target=world.structures.find(s=>s.id===job.deconstruction!.structureId);
   if(!target||target.kind!=='wall'||target.footprint!=='standard'||target.material!==job.deconstruction!.material||target.x!==job.x||target.z!==job.z||target.orientation!==job.orientation||target.footprint!==job.footprint)return false;
   if(!state.manual&&state.fromBlueprint!==true&&world.pawns.some(p=>p.jobId===job.id))return false;
   if(state.fromBlueprint===true){
    const owners=world.pawns.filter(p=>p.jobId===job.id);
    if(owners.length!==1||owners[0]!.state==='dead'||owners[0]!.state==='downed'||owners[0]!.health?.death||owners[0]!.id!==job.reservedBy||job.status!=='active'||!['moving','working'].includes(owners[0]!.state))return false;
   }
   if(!state.manual&&!state.plan&&state.fromBlueprint!==true)return false;
   if(state.plan){if(state.plan.id>=world.nextId||ids.has(state.plan.id))return false;ids.add(state.plan.id);}
  }
  return true;
 }catch{return false;}
}

/** Exactly one identity registration per nested plan. The caller already
 * owns the ordinary local/campaign namespace, including retained owners. */
export function registerWallDoorPlanIds296(world:World,ids:NumericMembershipSink):string[] {
 const errors:string[]=[];
 for(const job of world.jobs){const plan=job.wallDoor296?.plan;if(!plan)continue;
  if(!integer(plan.id,1,world.nextId-1)||ids.has(plan.id))errors.push('Duplicate or invalid wall-door successor identity.');else ids.add(plan.id);
 }
 return errors;
}

/** Resident admission has no full RAW namespace pass. Check the inexpensive
 * owner lanes against the reserved IDs without traversing the terrain grid. */
export function validWallDoorResidentNamespace296(world:World):boolean {
 try{
  const ids=new Set(world.jobs.flatMap(j=>j.wallDoor296?.plan?[j.wallDoor296.plan.id]:[]));if(!ids.size)return true;
  const inherited=inheritedRecognizedKeys296(RESIDENT_LANE_INDEX296);const active=new Set<object>();
  const lanes=RESIDENT_LANES296;
  const visit=(v:unknown):boolean=>{
   if(v===null||typeof v!=='object')return true;
   if(Array.isArray(v)){if(active.has(v))return false;active.add(v);for(const row of v)if(!visit(row))return false;}
   else {
    if(!plain(v))return false;const id=data(v,'id');if(id&&ids.has(id.value))return false;
    const present=ownRecognizedKeys296(v,RESIDENT_LANE_INDEX296,inherited);if(present===false)return false;
    if(!present.length)return true;
    if(active.has(v))return false;active.add(v);
    for(const lane of present){const d=data(v,lane);if(!d||!visit(d.value))return false;}
   }
   active.delete(v);return true;
  };
  // Root identity is not a Thing. Follow owner lanes only.
  for(const lane of lanes)if(lane in world){const d=data(world,lane);if(!d||!visit(d.value))return false;}
  return true;
 }catch{return false;}
}
