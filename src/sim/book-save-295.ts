import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isNovelBook295} from './book-state-295.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;};
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>plain(v)&&required.every(k=>!!data(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&!!data(v,k));
const supported=(version:unknown):version is number=>int(version,1,299);

/** One physical exemplar, with the existing damage authority. A book is never
 * disguised as apparel/weapon, a construction deposit, or a corpse. */
export function validNovelPile295(value:unknown,version:number):boolean {
 try{
  if(!supported(version)||!plain(value))return false;
  const item=data(value,'item'),kind=data(value,'kind');
  const novel=item?.value==='novel'||kind?.value==='book';
  if(!novel)return !('book'in value);
  if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!keys(value,['id','kind','item','quantity','owner','book'],['damage','forbidden'])
    ||!int(value.id,1)||value.item!=='novel'||value.kind!=='book'||value.quantity!==1||!isNovelBook295(value.book)
    ||'damage'in value&&!int(value.damage,0,59)||'forbidden'in value&&value.forbidden!==true)return false;
  if(!plain(value.owner))return false;
  const owner=value.owner,type=data(owner,'type')?.value;
  if(type==='ground')return keys(owner,['type','x','z'])&&int(owner.x)&&int(owner.z);
  if(type==='pawn'||type==='inventory')return keys(owner,['type','pawnId'])&&int(owner.pawnId,1);
  const field=type==='orbital-ship'?'shipId':type==='orbital-cargo'?'deliveryId':type==='starting-pod'?'podId':type==='ancient-casket'?'casketId':type==='world-site263'?'siteId':null;
  if(field)return keys(owner,['type',field])&&int(owner[field],1);
  return type==='trade-request284'&&keys(owner,['type','requestId','optionId'])&&int(owner.requestId,1)&&int(owner.optionId,1,3);
 }catch{return false;}
}

/** The scalar job contract is also checked on historical/public envelopes.
 * Physical ownership and the actual map/seat are joined after sparse patches. */
export function validReadingTask295(value:unknown,version:number):boolean {
 try{
  if(!supported(version)||!plain(value))return false;
  const activity=data(value,'activity');
  if(activity?.value!=='read')return !('bookId'in value);
  if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!keys(value,['activity','bookId','stage','phase','target','buildingId','elapsed'],['manual','seatId'])
    ||!int(value.bookId,1)||!['pickup','seat','read','return'].includes(String(value.stage))||!['travel','active'].includes(String(value.phase))
    ||!keys(value.target,['x','z'])||!int(value.target.x)||!int(value.target.z)
    ||value.buildingId!==null&&!int(value.buildingId,1)||'seatId'in value&&!int(value.seatId,1)||'manual'in value&&value.manual!==true)return false;
  const duration=value.manual===true?500:800;
  if(!int(value.elapsed,0,duration))return false;
  if(value.stage==='pickup')return value.phase==='travel'&&value.elapsed===0&&value.buildingId===null&&!('seatId'in value);
  if(value.stage==='seat')return value.elapsed===0&&(value.phase!=='active'||value.buildingId===null&&!('seatId'in value));
  if(value.stage==='read')return value.phase==='active'&&value.elapsed<duration;
  return value.elapsed>0&&value.buildingId===null&&!('seatId'in value);
 }catch{return false;}
}

/** Optional neutral references/genre remain absent on load. The pair appears
 * only after a real gain; policy1 is interpreted by the runtime, never filled. */
export function validReadingPawnFields295(value:unknown,version:number):boolean {
 try{
  if(!supported(version)||!plain(value))return false;
  if('readingPolicy295'in value){const d=data(value,'readingPolicy295');if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!d||d.value!==1&&d.value!==2||!data(value,'recreation'))return false;}
  if(!('recreation'in value))return true;
  const joy=data(value,'recreation');if(!joy||!plain(joy.value))return false;
  const tolerance=data(joy.value,'tolerance'),bored=data(joy.value,'bored');
  if(tolerance&&plain(tolerance.value)&&bored&&plain(bored.value)){
   const hasTolerance='reading'in tolerance.value,hasBored='reading'in bored.value;
   if(hasTolerance!==hasBored)return false;
   if(hasTolerance){const t=data(tolerance.value,'reading'),b=data(bored.value,'reading');if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!t||!b||typeof t.value!=='number'||!Number.isFinite(t.value)||t.value<0||t.value>100||typeof b.value!=='boolean'||t.value>50&&!b.value||t.value<30&&b.value)return false;}
  }
  const task=data(joy.value,'task');
  if(task?.value!==null&&plain(task?.value)&&!validReadingTask295(task.value,version))return false;
  return true;
 }catch{return false;}
}

/** Closed owner lanes only: no tiles, resources, geography, health population,
 * or World validation is traversed by presentation admission. Descriptors are
 * checked before following a lane; no values are inferred or memoized. */
export function validNovelHistoricalTransport295(raw:unknown,version:unknown):boolean {
 try{
  if(!supported(version))return false;
  const active=new Set<object>();let budget=2_000_000;
  const lanes=['world','summary','dynamic','campaign','worldMaps','worldGroups','worldPawns','worldFactions','campaignMap','secondarySite','map','maps','sites','entries','groups','group','state','groupLosses','pending261','battlefield261','retained','people','pawns','wildlife','animals','piles','items','packed','building','structures','body','cryptosleep','shipCryptosleep277','occupant','human','pawn','animal','actor','contents','lost','abandoned','abandonedContents','abandonedPawns','humans','pods','animalLosses','losses','members','owners','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','upserted','orbital','ships','deliveries','cargo','pending','departures','commercialTrip','civilianPost','visitors','raids','trade','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','worldSites263','tradeRequests284','requests','rewards','options','stockpiles','filters','shelf','settings','policy','privatePolicy','linkedStorage286','policies','recreation','task','bought','sold','recent','lines','ledger','destroyed','stock'] as const;
  const visit=(v:unknown,lane:string):boolean=>{
   if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
   if(active.has(v))return false;active.add(v);
   if(Array.isArray(v)){
    if(v.length>100000||Reflect.ownKeys(v).length!==v.length+1)return false;
    for(let i=0;i<v.length;i++){const d=data(v,String(i));if(!d||!visit(d.value,lane))return false;}
   }else{
    if(!plain(v))return false;
    if('novel'in v){const d=data(v,'novel');if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!d)return false;}
    const novelItem=data(v,'item')?.value==='novel';
    if(novelItem&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))return false;
    if('book'in v){
     if(lane==='filters'){const d=data(v,'book');if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!d||typeof d.value!=='boolean')return false;}
     else if(!validNovelPile295(v,version))return false;
    }else if(data(v,'kind')?.value==='book'||novelItem&&('owner'in v||'id'in v||lane==='piles'||lane==='upserted'))return false;
    if(!validReadingPawnFields295(v,version))return false;
    if((data(v,'activity')?.value==='read'||'bookId'in v)&&!validReadingTask295(v,version))return false;
    for(const key of lanes)if(key in v){const d=data(v,key);if(!d||!visit(d.value,key))return false;}
   }
   active.delete(v);return true;
  };
  return visit(raw,'world');
 }catch{return false;}
}
