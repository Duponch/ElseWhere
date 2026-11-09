import {SCHEMA_VERSION} from './types.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {memoryAge271,memoryReadTick271,memoryExpiry271,validSuspendedMemory271} from './suspended-memory-271.ts';
import {partyInteger292 as integer,partyKeys292,partyDense292,partyPlain292} from './party-state-292.ts';
import type {MoodThought} from './mood.ts';
export interface PartyMemory292 {at:number;power:number;suspendedTicks?:number}
export interface PartyMemoryHolder292 {partyMemories292?:PartyMemory292[];cryptosleepHeldAt271?:number;shipCryptosleepHeldAt277?:number}
export const PARTY_MEMORY_DURATION_292=60000,PARTY_MEMORY_LIMIT_292=10;
const f=Math.fround;
const frozen=(h:PartyMemoryHolder292)=>h.cryptosleepHeldAt271!==undefined||h.shipCryptosleepHeldAt277!==undefined;
export function expirePartyMemories292(h:PartyMemoryHolder292,tick:number):void {
 if(!integer(tick))throw Error('Invalid party memory clock');if(frozen(h)||!h.partyMemories292)return;
 const next=h.partyMemories292.filter(m=>memoryAge271(m,m.at,tick)<=PARTY_MEMORY_DURATION_292);
 if(next.length===h.partyMemories292.length)return;if(next.length)h.partyMemories292=next;else delete h.partyMemories292;
}
export function addPartyMemory292(h:PartyMemoryHolder292,power:number,tick:number):void {
 if(!integer(tick,0,Number.MAX_SAFE_INTEGER-PARTY_MEMORY_DURATION_292)||!Number.isFinite(power)||power<=.0625||power>1||frozen(h))throw Error('Invalid party memory acquisition');
 expirePartyMemories292(h,tick);const list=h.partyMemories292??=[];
 if(list.length>PARTY_MEMORY_LIMIT_292)throw Error('Party memory limit exceeded');
 if(list.length===PARTY_MEMORY_LIMIT_292){let oldest=0;for(let i=1;i<list.length;i++)if(memoryAge271(list[i]!,list[i]!.at,tick)>memoryAge271(list[oldest]!,list[oldest]!.at,tick))oldest=i;
  // Core saturation renews age, retaining the old occurrence's power.
  list[oldest]={at:tick,power:list[oldest]!.power};
 }else list.push({at:tick,power:f(power)});
}
export function partyMoodThoughts292(h:Readonly<PartyMemoryHolder292>,tick:number):readonly MoodThought[]{
 tick=memoryReadTick271(h,tick);const list=h.partyMemories292?.filter(m=>memoryAge271(m,m.at,tick)<=PARTY_MEMORY_DURATION_292)??[];if(!list.length)return [];
 let sum=0,weight=1,weights=0;for(const m of list){sum=f(sum+f(f(8)*f(m.power)));weights=f(weights+weight);weight=f(weight*f(.75));}
 return [{id:'attended-party',label:`Participation à une fête${list.length>1?` ×${list.length}`:''}`,offset:f(f(sum/f(list.length))*weights),kind:'memory',expiresAt:Math.min(...list.map(m=>memoryExpiry271(m,m.at+PARTY_MEMORY_DURATION_292))),description:'Un bon moment partagé. Le souvenir est plus fort après une longue participation.'}];
}
export function validPartyMemoryField292(owner:unknown,version:number,tick:number,civilTick=tick,shapeOnly=false):boolean {
 try{
  if(!partyPlain292(owner)||!integer(version,1,SCHEMA_VERSION)||!integer(tick)||!integer(civilTick,tick))return false;
  const d=Object.getOwnPropertyDescriptor(owner,'partyMemories292');if(!d)return !('partyMemories292'in owner);
  if((version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))||!d.enumerable||!Object.hasOwn(d,'value')||!partyDense292(d.value)||d.value.length<1||d.value.length>10)return false;
  for(const m of d.value){if(!partyKeys292(m,['at','power'],['suspendedTicks'])||!integer(m.at,0,Math.min(civilTick,Number.MAX_SAFE_INTEGER-PARTY_MEMORY_DURATION_292))||typeof m.power!=='number'||!Number.isFinite(m.power)||m.power<=.0625||m.power>1||!validSuspendedMemory271(m,version,tick,m.at)||!shapeOnly&&memoryExpiry271(m,m.at+PARTY_MEMORY_DURATION_292)<Math.max(tick,m.at))return false;}
  return true;
 }catch{return false;}
}

/** Owner selectors use actual field presence; Party never needs a relationship namespace. */
export const hasPartyMemoryField292=(value:object):boolean=>'partyMemories292'in value;
