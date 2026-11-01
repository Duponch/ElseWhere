import {validPartyMemoryField292} from './party-memories-292.ts';
import {isSchema285OrLater} from './schema-compatibility-257.ts';
import {bedSlotCell} from './bed-slots.ts';
import {coupleAdult285} from './couple-rules-285.ts';
import {validCoupleMemoryField285} from './couple-memories-285.ts';
import {ROOM_MEMORY_DURATION} from './room-impressiveness.ts';
import type {CoupleClock285,CoupleTask285} from './couple-state-285.ts';
import type {Pawn,Structure,World} from './types.ts';

const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const invalid=Symbol('invalid couple field');
/** Inspect every descriptor before reading any data value. */
function exact(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown> {
 if(!plain(v))return false;
 const keys=Reflect.ownKeys(v);
 return required.every(k=>Object.hasOwn(v,k))&&optional.every(k=>!(k in v)||Object.hasOwn(v,k))&&keys.every(k=>{
  if(typeof k!=='string'||!required.includes(k)&&!optional.includes(k))return false;
  const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable===true&&Object.hasOwn(d,'value');
 });
}
function field(raw:object,key:string):unknown {
 const d=Object.getOwnPropertyDescriptor(raw,key);
 if(!d)return key in raw?invalid:undefined;
 return d.enumerable===true&&Object.hasOwn(d,'value')&&d.value!==undefined?d.value:invalid;
}
const dates=(version:number,tick:number,civilTick:number)=>int(version,2,301)&&int(tick)&&int(civilTick,tick,Math.floor(Number.MAX_SAFE_INTEGER/10));

export function validCoupleClock285(value:unknown,civilTick:number):value is CoupleClock285 {
 return int(civilTick,0,Math.floor(Number.MAX_SAFE_INTEGER/10))&&exact(value,['revision','rng'],['lastAttemptAtCore','nextAllowedAtCore'])
  &&value.revision===1&&int(value.rng,1,0xffffffff)
  &&(!Object.hasOwn(value,'lastAttemptAtCore')||int(value.lastAttemptAtCore,0,civilTick*10))
  &&(!Object.hasOwn(value,'nextAllowedAtCore')||int(value.nextAllowedAtCore));
}
export function validCoupleTask285(value:unknown,tick:number):value is CoupleTask285 {
 if(!int(tick,0,Math.floor(Number.MAX_SAFE_INTEGER/10))||!exact(value,['revision','otherId','initiatorId','bedId','slot','enteredAtCore','endsAtCore'],['roomRest','medical'])
  ||value.revision!==1||!int(value.otherId,1)||!int(value.initiatorId,1)||!int(value.bedId,1)||(value.slot!==0&&value.slot!==1)
  ||!int(value.enteredAtCore,0,tick*10)||value.enteredAtCore%10!==0||!int(value.endsAtCore,tick*10+1)
  ||value.endsAtCore-value.enteredAtCore<250||value.endsAtCore-value.enteredAtCore>2750
  ||Object.hasOwn(value,'medical')&&value.medical!=='patient'&&value.medical!=='bedrest')return false;
 if(Object.hasOwn(value,'roomRest')){
  const rest=value.roomRest;
  if(!exact(rest,['nextAt','applied'])||typeof rest.applied!=='boolean'||!int(rest.nextAt,tick+1,tick+(rest.applied?ROOM_MEMORY_DURATION:1000)))return false;
 }
 return true;
}

/** Shape only. Historical absence is literal: inherited, explicitundefined,
 * accessor and hidden fields never become an absent prospective tracker. */
export function validCouplePawnShape285(raw:unknown,version:number,tick:number,civilTick=tick):boolean {
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!dates(version,tick,civilTick)||!validPartyMemoryField292(raw,version,tick,civilTick))return false;
 const clock=field(raw,'coupleClock285'),task=field(raw,'coupleTask285');
 if(clock===invalid||task===invalid||!validCoupleMemoryField285(raw,version,tick,civilTick))return false;
 if(!isSchema285OrLater(version))return clock===undefined&&task===undefined;
 return (clock===undefined||validCoupleClock285(clock,civilTick))&&(task===undefined||validCoupleTask285(task,tick));
}

export interface CoupleMapContext285 {
 readonly pawns:ReadonlyMap<number,Pawn>;
 readonly structures:ReadonlyMap<number,Structure>;
 readonly partners:ReadonlyMap<number,ReadonlySet<number>>;
 readonly valid:boolean;
}
/** One local index per actual map; never captures a campaign or repairs data.
 * Global bed-owner/exclusivity guards remain the enclosing reader's authority. */
export function captureCoupleMapContext285(map:Pick<World,'pawns'|'structures'|'relationships'>):CoupleMapContext285 {
 const pawns=new Map(map.pawns.map(p=>[p.id,p])),structures=new Map(map.structures.map(s=>[s.id,s]));
 const partners=new Map<number,Set<number>>();
 for(const link of map.relationships?.links??[])if(link.kind==='lover'||link.kind==='spouse'){
  for(const [a,b] of [[link.aId,link.bId],[link.bId,link.aId]] as const){const ids=partners.get(a)??new Set<number>();ids.add(b);partners.set(a,ids);}
 }
 return {pawns,structures,partners,valid:pawns.size===map.pawns.length&&structures.size===map.structures.length};
}
export interface CouplePawnContext285 {
 readonly version:number;
 readonly tick:number;
 readonly civilTick?:number;
 readonly nextId:number;
 readonly knownHumanIds:ReadonlySet<number>;
 /** Absent for away, terminal, archived and physically suspended holders. */
 readonly map?:CoupleMapContext285;
}

// Actual service fields cleared by clearReleasedPawnAssignments259, plus
// competing movement/combat providers used by the main pawn dispatcher.
// Stun, stagger, surgeryRequest and bodily capacities are not admission here.
export const COUPLE_EXCLUSIVE_FIELDS285:readonly (keyof Pawn)[]=[
 'brewing','orbitalTrade','deepWork','animalHandling','animalCare','animalFeed','burial','cleaning','trade','firefighting','ward','heatRefuge','research','tend','feed','medicalSleep','equipmentTask',
 'shipCasketTask277','cryptosleepTask','rescue','animalRescue','surgery','hunting','openCasket','transitExit','allowedAreaReturn',
 'burning','tactics','melee','flee','draft','bombRefuge','shooting','priorityWork','interruptedCargo',
];
function available(p:Pawn,tick:number):boolean {
 return coupleAdult285(p)&&(p.faction??'colony')==='colony'&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue
  &&p.cryptosleepHeldAt271===undefined&&p.shipCryptosleepHeldAt277===undefined
  &&(p.state==='idle'||p.state==='downed')&&!p.health?.death
  &&p.jobId===null&&p.haul===null&&p.cooking===null&&p.need===null&&p.recreation.task===null&&p.orders.active===null
  &&!p.mental?.crisis&&!p.social?.fight&&!COUPLE_EXCLUSIVE_FIELDS285.some(key=>p[key]!==undefined)
  &&p.path.length===0&&p.moveCooldown===0&&(p.motion?.end??0)<=tick;
}
function namespace(p:Pawn,c:CouplePawnContext285):boolean {
 if(!int(p.id,1,c.nextId-1)||!c.knownHumanIds.has(p.id))return false;
 const other=(id:number)=>int(id,1,c.nextId-1)&&id!==p.id&&c.knownHumanIds.has(id);
 return (p.coupleMemories285??[]).every(m=>other(m.otherId))
  &&(!p.coupleTask285||other(p.coupleTask285.otherId)&&int(p.coupleTask285.bedId,1,c.nextId-1)
    &&(p.coupleTask285.initiatorId===p.id||p.coupleTask285.initiatorId===p.coupleTask285.otherId));
}

/** Called after the ordinary Pawn/health/age/bed shape guards. Validates
 * existing facts only: no clinical re-admission, PRNG, cleanup or migration. */
export function validCouplePawnContext285(p:Pawn,c:CouplePawnContext285):boolean {
 if(!int(c.nextId,1)||!validCouplePawnShape285(p,c.version,c.tick,c.civilTick??c.tick)||!namespace(p,c))return false;
 const acquired=p.coupleClock285!==undefined||p.coupleMemories285!==undefined||p.coupleTask285!==undefined;
 if(acquired&&!coupleAdult285(p))return false;
 const task=p.coupleTask285;if(!task)return true;
 const map=c.map;
 if(!map?.valid||map.pawns.get(p.id)!==p||!available(p,c.tick)||!p.coupleClock285)return false;
 const other=map.pawns.get(task.otherId),bed=map.structures.get(task.bedId);
 if(!other||other===p||!validCouplePawnShape285(other,c.version,c.tick,c.civilTick??c.tick)||!namespace(other,c)
  ||!available(other,c.tick)||!other.coupleClock285||!map.partners.get(p.id)?.has(other.id))return false;
 const reciprocal=other.coupleTask285;
 if(!reciprocal||reciprocal.otherId!==p.id||reciprocal.initiatorId!==task.initiatorId||reciprocal.bedId!==task.bedId
  ||reciprocal.slot===task.slot||reciprocal.enteredAtCore!==task.enteredAtCore||reciprocal.endsAtCore!==task.endsAtCore)return false;
 if(!bed||bed.kind!=='double-bed'||bed.medical||bed.prisoner||p.bedId!==bed.id||other.bedId!==bed.id||p.bedSlot!==task.slot||other.bedSlot!==reciprocal.slot)return false;
 const a=bedSlotCell(bed,task.slot),b=bedSlotCell(bed,reciprocal.slot);
 return !!a&&!!b&&p.x===a.x&&p.z===a.z&&other.x===b.x&&other.z===b.z;
}
