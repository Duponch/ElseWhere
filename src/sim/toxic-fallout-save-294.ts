import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import type {CassandraMiscCalendar} from './cassandra-misc.ts';
import {TICKS_PER_DAY,type World} from './types.ts';
import {TOXIC_FALLOUT_FIRST_DAY294,TOXIC_FALLOUT_COOLDOWN_DAYS294,TOXIC_FALLOUT_MIN_CORE294,TOXIC_FALLOUT_MAX_CORE294} from './toxic-fallout-state-294.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;};
const keys=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>!!data(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&!!data(v,k));
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;

/** Explicit age actually added to this corpse. No condition or victim record
 * can stand in for this witness after a transfer or after the fallout ends. */
export function validToxicFalloutRotCredit294(rot:unknown,version:number,corpse:boolean):boolean {
 try{
  if(!int(version,1,301))return false;
  if(!rot||typeof rot!=='object'||!('fallout294'in rot))return true;
  const d=data(rot,'fallout294');
  return (version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))&&corpse&&!!d&&int(d.value,300)&&d.value%300===0;
 }catch{return false;}
}

/** Private per-call facts for the transport join. They authorize no mutation
 * and are never cached for a later, possibly changed public packet. */
export interface ToxicFalloutRotFacts294 {
 holders:{rot:Record<string,unknown>;holder:Record<string,unknown>;actor?:Record<string,unknown>;tick:unknown}[];
 humans:Map<number,Record<string,unknown>>;
}

/** This local condition is prospective. A historical save never gains a
 * calendar, a random draw, an environmental cursor or a past exposure. */
export function validToxicFalloutCalendar294(value:unknown,version:number,w:Pick<World,'tick'|'width'|'height'>,calendar:Pick<CassandraMiscCalendar,'adoptedAt'|'opportunities'>):boolean {
 try{
  if(!int(version,1,301))return false;
  if(value===undefined)return true;
  if((version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))||!keys(value,['adoptedAt','count'],['lastStart','active'])||!int(w.tick)||!int(w.tick*10)||!int(w.width,1)||!int(w.height,1)||!int(w.width*w.height,1)
   ||!int(calendar.adoptedAt,0,w.tick)||!int(calendar.opportunities)||!int(value.adoptedAt,calendar.adoptedAt,w.tick)||!int(value.count,0,calendar.opportunities))return false;
  if(value.count===0)return !Object.hasOwn(value,'lastStart')&&!Object.hasOwn(value,'active');
  const first=Math.ceil(Math.max(value.adoptedAt,TOXIC_FALLOUT_FIRST_DAY294*TICKS_PER_DAY)/100)*100;
  if(!int(value.lastStart,first,w.tick)||value.lastStart%100!==0||value.lastStart-first<(value.count-1)*TOXIC_FALLOUT_COOLDOWN_DAYS294*TICKS_PER_DAY)return false;
  const startCore=value.lastStart*10,nowCore=w.tick*10;
  if(!int(startCore))return false;
  if(Object.hasOwn(value,'active')){
   const a=value.active;
   return keys(a,['startCore','endCore','rng','cursor'])&&a.startCore===startCore&&int(a.endCore,nowCore)&&int(a.endCore-startCore,TOXIC_FALLOUT_MIN_CORE294,TOXIC_FALLOUT_MAX_CORE294)
    &&int(a.rng,1,0xffffffff)&&int(a.cursor,0,w.width*w.height-1);
  }
  // The native final Core tick still belongs to the condition.
  return nowCore>startCore+TOXIC_FALLOUT_MIN_CORE294;
 }catch{return false;}
}

/** Scan only owned campaign/map/transport and rot-holder envelopes, never terrain.
 * Descriptor checks precede value reads, including on historical packets. */
export function validToxicFalloutHistoricalTransport294(raw:unknown,version:unknown,facts?:ToxicFalloutRotFacts294):boolean {
 try{
  if(!int(version,1,301))return false;
  const active=new Set<object>();let budget=2000000;
  const lanes=['world','summary','dynamic','campaign','worldMaps','worldGroups','worldPawns','campaignMap','secondarySite','map','maps','sites','entries','groups','group','state','groupLosses','pending261','battlefield261','retained','people','pawns','wildlife','animals','piles','items','packed','building','structures','body','cryptosleep','shipCryptosleep277','occupant','human','pawn','animal','actor','contents','lost','abandoned','abandonedContents','abandonedPawns','humans','pods','animalLosses','losses','members','owners','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','upserted'] as const;
  const visit=(v:unknown,lane:string,context:Record<string,unknown>,corpseRot=false,holder?:Record<string,unknown>,actor?:Record<string,unknown>):boolean=>{
   if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
   if(Array.isArray(v)){
    if(active.has(v)||v.length>100000||Reflect.ownKeys(v).length!==v.length+1)return false;active.add(v);
    for(let i=0;i<v.length;i++){const d=data(v,String(i));if(!d||!visit(d.value,lane,context,corpseRot))return false;}
    active.delete(v);return true;
   }
   if(!plain(v)||active.has(v))return false;active.add(v);
   if((lane==='rot'||lane==='corpseRot')&&!validToxicFalloutRotCredit294(v,version,corpseRot))return false;
   if('fallout294'in v&&lane!=='rot'&&lane!=='corpseRot')return false;
   const local={...context};
   for(const key of ['tick','width','height'])if(key in v){const d=data(v,key);if(!d)return false;local[key]=d.value;}
   if(facts){
    // Frozen/abandoned physical owners use their actual retained frontier.
    for(const key of ['removedAt','clock','heldAt'])if(key in v){const d=data(v,key);if(!d||!int(d.value))return false;local.tick=d.value;}
    if('clockCore'in v){const d=data(v,'clockCore');if(!d||!int(d.value))return false;local.tick=d.value/10;}
    if('body'in v){const id=data(v,'id');if(id&&int(id.value,1))facts.humans.set(id.value,v);}
    if((lane==='rot'||lane==='corpseRot')&&'fallout294'in v){if(!holder)return false;facts.holders.push({rot:v,holder,...actor?{actor}:{},tick:local.tick});}
   }
   if('toxicFallout'in v&&lane!=='miscIncidents')return false;
   if(lane==='miscIncidents'&&'toxicFallout'in v){
    const d=data(v,'toxicFallout'),adopted=data(v,'adoptedAt'),opportunities=data(v,'opportunities');
    if((version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))||!d||d.value===undefined||!adopted||!opportunities||!validToxicFalloutCalendar294(d.value,version,local as unknown as Pick<World,'tick'|'width'|'height'>,{adoptedAt:adopted.value,opportunities:opportunities.value}))return false;
   }
   if('miscIncidents'in v){const d=data(v,'miscIncidents');if(!d||!visit(d.value,'miscIncidents',local))return false;}
   for(const key of ['rot','corpseRot'])if(key in v){const d=data(v,key);if(!d||!visit(d.value,key,local,key==='corpseRot'||lane==='body'||data(v,'kind')?.value==='corpse',v,key==='corpseRot'?v:actor))return false;}
   for(const key of lanes)if(key in v){const d=data(v,key);if(!d||!visit(d.value,key,local,false,undefined,key==='body'?v:undefined))return false;}
   active.delete(v);return true;
  };
  return visit(raw,'world',{});
 }catch{return false;}
}
