import {isSchema285OrLater} from './schema-compatibility-257.ts';
import {memoryAge271,memoryExpiry271,memoryReadTick271,validSuspendedMemory271} from './suspended-memory-271.ts';
import {TICKS_PER_DAY} from './types.ts';
import type {MoodThought} from './mood.ts';

export interface CoupleMemory285 {otherId:number;at:number;suspendedTicks?:number}
/** The same person's own memories; no World, roster or relationship capture. */
export interface CoupleMemoryHolder285 {
 coupleMemories285?:CoupleMemory285[];
 cryptosleepHeldAt271?:number;
 shipCryptosleepHeldAt277?:number;
}
export interface CoupleMemoryPeople285 {get(id:number):{readonly name:string}|undefined}
export const COUPLE_MEMORY_DURATION_285=3*TICKS_PER_DAY;
export const COUPLE_MEMORY_LIMIT_285=10;
const f=Math.fround,MULTIPLIER=f(.6),empty:readonly CoupleMemory285[]=Object.freeze([]);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const frozen=(h:Readonly<CoupleMemoryHolder285>)=>h.cryptosleepHeldAt271!==undefined||h.shipCryptosleepHeldAt277!==undefined;
const expiry=(m:CoupleMemory285)=>memoryExpiry271(m,m.at+COUPLE_MEMORY_DURATION_285);
function memories(h:Readonly<CoupleMemoryHolder285>):readonly CoupleMemory285[] {
 const list=h.coupleMemories285??empty;
 if(list.length>COUPLE_MEMORY_LIMIT_285)throw Error('Couple memory limit exceeded');
 return list;
}
function active(h:Readonly<CoupleMemoryHolder285>,tick:number):{tick:number;list:CoupleMemory285[]} {
 tick=memoryReadTick271(h,tick);
 return {tick,list:memories(h).filter(m=>expiry(m)>tick)};
}

/** Local deadline convention, as for existing memories. No native150-Core
 * interval is simulated; factual dates never change on reading or expiry. */
export function expireCoupleMemories285(holder:CoupleMemoryHolder285,tick:number):void {
 if(!int(tick))throw Error('Invalid couple memory clock');
 if(frozen(holder))return;
 const list=memories(holder);if(!list.some(m=>expiry(m)<=tick))return;
 const next=list.filter(m=>expiry(m)>tick);
 if(next.length)holder.coupleMemories285=next;else delete holder.coupleMemories285;
}

/** Called only by a true activity finish. Adult eligibility, factual partner
 * identity and physical phase are the caller's authority. No merge/renewal:
 * native social memories add an event and evict the oldest active age globally. */
export function addCoupleMemory285(holder:CoupleMemoryHolder285,otherId:number,tick:number):void {
 if(!int(otherId,1)||!int(tick,0,Number.MAX_SAFE_INTEGER-COUPLE_MEMORY_DURATION_285)||frozen(holder))throw Error('Invalid couple memory acquisition');
 memories(holder);expireCoupleMemories285(holder,tick);
 const list=holder.coupleMemories285??=[];
 if(list.length===COUPLE_MEMORY_LIMIT_285){
  let oldest=0;
  for(let i=1;i<list.length;i++)if(memoryAge271(list[i]!,list[i]!.at,tick)>memoryAge271(list[oldest]!,list[oldest]!.at,tick))oldest=i;
  list.splice(oldest,1);
 }
 list.push({otherId,at:tick});
}

/** Thought_MemorySocial groups by the partner's identity, for mood as well
 * as opinion. Different people with equal names never share a stack. */
export function coupleMoodThoughts285(holder:Readonly<CoupleMemoryHolder285>,tick:number,people:CoupleMemoryPeople285):readonly MoodThought[] {
 const {list}=active(holder,tick),groups=new Map<number,CoupleMemory285[]>();
 for(const m of list){const group=groups.get(m.otherId)??[];group.push(m);groups.set(m.otherId,group);}
 return [...groups].map<MoodThought>(([otherId,group])=>{
  let weight=f(1),sum=f(0);
  for(let i=0;i<group.length;i++){sum=f(sum+weight);weight=f(weight*MULTIPLIER);}
  const name=people.get(otherId)?.name??'cette personne';
  return {id:`couple-${otherId}`,label:`Moment intime avec ${name}${group.length>1?` ×${group.length}`:''}`,
   offset:f(8*sum),kind:'memory',expiresAt:Math.min(...group.map(expiry)),
   description:'Souvenir partagé avec cette personne ; humeur et opinion ont des effets distincts.'};
 });
}

function opinion(m:CoupleMemory285,tick:number):number {
 const percent=f(memoryAge271(m,m.at,tick)/COUPLE_MEMORY_DURATION_285);
 const factor=Math.max(0,Math.min(1,f(f(percent-f(1))/f(f(.7)-f(1)))));
 return f(6*factor);
}
const roundEven=(value:number):number=>{const lo=Math.floor(value);return value-lo===.5?lo+lo%2:Math.round(value);};

/** The final30% fades opinion only. Youngest ACTIVE ages are weighted first;
 * suspension can reverse civil event ordering. Round the total, not each event. */
export function coupleOpinionOffset285(holder:Readonly<CoupleMemoryHolder285>,otherId:number,tick:number):number {
 const state=active(holder,tick),list=state.list.filter(m=>m.otherId===otherId&&opinion(m,state.tick)!==0)
  .sort((a,b)=>memoryAge271(a,a.at,state.tick)-memoryAge271(b,b.at,state.tick));
 let value=f(0),weight=f(1);
 for(const m of list){value=f(value+f(opinion(m,state.tick)*weight));weight=f(weight*MULTIPLIER);}
 return value>0?Math.max(1,roundEven(value)):0;
}

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const versionAllowed=(version:number)=>int(version,2,301);

/** Shape only: the enclosing actual-owner guard checks self/nextId/namespace.
 * Presence starts ONLY285. No future version is inferred from a lower bound. */
export function validCoupleMemories285(value:unknown,version:number,tick:number,civilTick=tick):value is CoupleMemory285[]|undefined {
 if(!versionAllowed(version)||!int(tick)||!int(civilTick,tick))return false;
 if(value===undefined)return true;
 if(!isSchema285OrLater(version)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||!value.length||value.length>COUPLE_MEMORY_LIMIT_285||Reflect.ownKeys(value).length!==value.length+1)return false;
 for(let i=0;i<value.length;i++){
  const slot=Object.getOwnPropertyDescriptor(value,String(i));if(!slot||!slot.enumerable||!Object.hasOwn(slot,'value')||!plain(slot.value))return false;
  const m=slot.value,keys=Reflect.ownKeys(m),suspended=Object.hasOwn(m,'suspendedTicks');
  if(keys.length!==(suspended?3:2)||!keys.every(k=>{
   const d=Object.getOwnPropertyDescriptor(m,k);return typeof k==='string'&&['otherId','at','suspendedTicks'].includes(k)&&d?.enumerable===true&&Object.hasOwn(d,'value');
  })||!int(m.otherId,1)||!int(m.at,0,Math.min(civilTick,Number.MAX_SAFE_INTEGER-COUPLE_MEMORY_DURATION_285))||!validSuspendedMemory271(m,version,tick,m.at))return false;
  const end=memoryExpiry271(m,m.at+COUPLE_MEMORY_DURATION_285);
  if(!int(end)||end<=Math.max(tick,m.at))return false;
 }
 return true;
}

/** Descriptor-first optional field: explicitundefined, inherited properties,
 * accessors and hidden fields are never treated as historical absence. */
export function validCoupleMemoryField285(raw:unknown,version:number,tick:number,civilTick=tick):boolean {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const d=Object.getOwnPropertyDescriptor(raw,'coupleMemories285');
 if(!d)return !('coupleMemories285'in raw)&&validCoupleMemories285(undefined,version,tick,civilTick);
 return d.enumerable===true&&Object.hasOwn(d,'value')&&d.value!==undefined&&validCoupleMemories285(d.value,version,tick,civilTick);
}
