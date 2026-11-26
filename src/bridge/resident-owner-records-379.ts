/** Representation fact, NOT admission authority. The fixed browser Worker
 * listener observes genuine structured clones before application dispatch;
 * their ordinary record identities can never become Proxies subsequently.
 * Validators still recheck the CURRENT prototype and relevant own/inherited
 * keys on each read. A literal/public packet or a synthetic event receives no
 * enrollment. Neither this registry nor a new local record grants a native
 * receipt, replaces validation, or permits an ACK. */
const ordinary=new WeakSet<object>();
const ordinaryArrays=new WeakSet<object>();
export function isOrdinaryResidentOwnerRecord379(value:object):boolean {return ordinary.has(value);}
export function isOrdinaryResidentOwnerArray379(value:object):boolean {return ordinaryArrays.has(value);}

// A contiguous run may share a prototype check only while every operation is
// one of these non-reentrant intrinsics on privately known ordinary objects.
const ownerObjectPrototype=Object.prototype,ownerArrayPrototype=Array.prototype,nativeArray=Array;
const ownDescriptor=Object.getOwnPropertyDescriptor,prototypeOf=Object.getPrototypeOf,ownKeys=Reflect.ownKeys,apply=Reflect.apply;
const weakHas=Function.call.bind(WeakSet.prototype.has) as (set:WeakSet<object>,value:object)=>boolean;
const weakAdd=Function.call.bind(WeakSet.prototype.add) as (set:WeakSet<object>,value:object)=>unknown;
const setHas=Function.call.bind(Set.prototype.has) as (set:ReadonlySet<PropertyKey>,key:PropertyKey)=>boolean;
const hasOwn=Object.hasOwn,nativeSlice=Array.prototype.slice,nativeSpecies=ownDescriptor(Array,Symbol.species)?.get;

export type ResidentOwnerLeafRun379=(array:readonly unknown[],from:number,accept:(leaf:object)=>boolean)=>number;
/** Internal scanner capability, never a packet flag or admission receipt.
 * `accept` belongs to the scanner and only checks/updates its private memo.
 * Stop BEFORE any unknown object/array, accessor or relevant ownership lane;
 * strict traversal owns that entry and the next run rechecks prototypes. */
export function createResidentOwnerLeafRun379(keys:ReadonlySet<PropertyKey>):ResidentOwnerLeafRun379 {
 const relevant=new Set(keys);
 return (array,from,accept)=>{
  if(!weakHas(ordinaryArrays,array)||prototypeOf(array)!==ownerArrayPrototype||prototypeOf(ownerObjectPrototype)!==null)return from;
  const inherited=ownKeys(ownerObjectPrototype);for(let i=0;i<inherited.length;i++)if(setHas(relevant,inherited[i]!))return from;
  let at=from;
  for(;at<array.length;at++){
   const slot=ownDescriptor(array,at);if(!slot?.enumerable||!hasOwn(slot,'value'))break;
   const row=slot.value;
   if(!row||typeof row!=='object'||!weakHas(ordinary,row)||prototypeOf(row)!==ownerObjectPrototype)break;
   let leaf=true;const fields=ownKeys(row);for(let i=0;i<fields.length;i++)if(setHas(relevant,fields[i]!)){leaf=false;break;}
   if(!leaf||!accept(row))break;
  }
  return at;
 };
}

/** Own construction without another copy. An enrolled source can still have
 * a custom method/constructor/species: those retain the exact original call
 * and grant no result witness. With these data/native-getter descriptors the
 * native slice necessarily constructs an ordinary Array before reading rows. */
export function residentOwnerArraySlice379<T>(source:readonly T[],from?:number):T[] {
 const slice=ownDescriptor(ownerArrayPrototype,'slice'),constructor=ownDescriptor(ownerArrayPrototype,'constructor'),species=ownDescriptor(nativeArray,Symbol.species);
 if(weakHas(ordinaryArrays,source)&&prototypeOf(source)===ownerArrayPrototype
  &&!ownDescriptor(source,'slice')&&!ownDescriptor(source,'constructor')
  &&slice&&hasOwn(slice,'value')&&slice.value===nativeSlice
  &&constructor&&hasOwn(constructor,'value')&&constructor.value===nativeArray
  &&nativeSpecies&&species&&hasOwn(species,'get')&&species.get===nativeSpecies){
  const result=apply(nativeSlice,source,from===undefined?[]:[from]) as T[];weakAdd(ordinaryArrays,result);return result;
 }
 return from===undefined?source.slice():source.slice(from);
}
/** This literal is constructed here, never supplied by a caller. */
export function residentOwnerArray379<T>():T[] {const result:T[]=[];weakAdd(ordinaryArrays,result);return result;}

/** The returned object is constructed HERE by ordinary CopyDataProperties.
 * It cannot be a caller-supplied Proxy. Retained children do not inherit the
 * representation fact and still require their own checks. */
export function residentOwnerRecord379<A extends object,B extends object>(base:A,changes:B):A&B {
 const row={...base,...changes};ordinary.add(row);return row;
}

// Union of the two owner validator lane sets and the fixed transport wrappers.
// Deliberately omit tiles/geography/typed columns: neither owner validator
// traverses those graphs. Motion's copied-array construction separately uses
// ordinary identities to preserve its full Core extent proof at decode.
const lanes=new Set(['publication','auxiliary','actors','full','values','world','summary','map','maps','dynamic','campaign','secondarySite','worldMaps','sites','entries','worldGroups','groups','state','group','pending261','battlefield261','retained','groupLosses','animalLosses','losses','lost','abandoned','abandonedContents','abandonedPawns','contents','humans','animals','pawn','actor','human','animal','body','members','people','pawns','resources','structures','jobs','packed','building','items','piles','wildlife','animalOwners','worldPawns','owners','worldFactions','leaders','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','cryptosleep','shipCryptosleep277','occupant','visitors','podRescues','departed','banishedDepartures378','startingArrival','pods','scout','commercialTrip','civilianPost','campaignMap','wallDoor296','plan','upserted','orbital','ships','deliveries','cargo','pending','departures','raids','trade','prisonDepartures','arrivals','quests','worldSites263','tradeRequests284','requests','rewards','options','haul','orders','queue','constructionBatch379','haulOpportunity379','sources','destinations']);

function actualMessageReader():((event:MessageEvent<unknown>,source:Worker|MessagePort)=>unknown)|undefined {
 try{
  if(typeof Event!=='function'||typeof MessageEvent!=='function')return;
  const target=Object.getOwnPropertyDescriptor(Event.prototype,'currentTarget')?.get,data=Object.getOwnPropertyDescriptor(MessageEvent.prototype,'data')?.get;
  const trusted=Object.getOwnPropertyDescriptor(new MessageEvent('message'),'isTrusted')?.get??Object.getOwnPropertyDescriptor(Event.prototype,'isTrusted')?.get;
  if(!target||!data||!trusted)return;
  return (event,source)=>{try{return target.call(event)===source&&trusted.call(event)===true?data.call(event):undefined;}catch{return undefined;}};
 }catch{return;}
}
function enroll(root:unknown):void {
 const seen=new WeakMap<object,boolean>(),pending:unknown[]=[root],depths:boolean[]=[false];
 while(pending.length){
  const v=pending.pop(),deep=depths.pop()!;if(!v||typeof v!=='object')continue;
  const prior=seen.get(v);if(prior===true||prior===deep)continue;seen.set(v,deep);
  if(Array.isArray(v)){
   if(Object.getPrototypeOf(v)!==Array.prototype)continue;
   ordinaryArrays.add(v);
   for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,i);if(d?.enumerable&&Object.hasOwn(d,'value')){pending.push(d.value);depths.push(deep);}}
   continue;
  }
  if(Object.getPrototypeOf(v)!==Object.prototype)continue;
  ordinary.add(v);
  for(const key of Object.keys(v))if(deep||lanes.has(key)||key==='motion'){
   const d=Object.getOwnPropertyDescriptor(v,key);if(d?.enumerable&&Object.hasOwn(d,'value')){pending.push(d.value);depths.push(deep||key==='actors'||key==='motion');}
  }
 }
}

/** Register immediately after the fixed lane creates its private Worker and
 * before SimulationClient installs its application listener. Authentic native
 * getters reject fabricated receivers/events and stale dispatches. */
export function observeNativeResidentOwners379(source:Worker|MessagePort):()=>void {
 const read=actualMessageReader();
 const listener=(event:MessageEvent<unknown>)=>{
  const raw=read?.(event,source);if(!raw||typeof raw!=='object')return;
  try{
   const type=Object.getOwnPropertyDescriptor(raw,'type'),packet=Object.getOwnPropertyDescriptor(raw,'publication');
   if(type?.value!=='resident-publication'||!packet||!Object.hasOwn(packet,'value')||!packet.value||typeof packet.value!=='object')return;
   const kind=Object.getOwnPropertyDescriptor(packet.value,'type')?.value;
   if(kind==='snapshot'||kind==='campaign-only')enroll(raw);
  }catch{/* Representation optimization only: strict admission remains. */}
 };
 source.addEventListener('message',listener as EventListener);
 return ()=>source.removeEventListener('message',listener as EventListener);
}
