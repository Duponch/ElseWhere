import {SCHEMA_VERSION,type Pawn,type World} from '../sim/types.ts';
import {validPawnIdentity378} from '../sim/pawn-identity-state-378.ts';
import {validOrderedQueuePawn378,validateOrderedQueues378} from '../sim/ordered-queue-378.ts';
import {validBanishedDeparturesHeader378,validateBanishedDepartures378} from '../sim/pawn-banish-save-378.ts';
import {captureHumanOwners} from '../sim/human-owners.ts';
import {validateHunting} from '../sim/hunting-save.ts';
import {validDomesticTasksTransport} from '../sim/domestic-save.ts';
import {collapsedRockAt256} from '../sim/collapsed-rocks-256.ts';

// Physical owners only: never grids, climate definitions, relation references
// or the planet mesh. A sparse packet carries its dynamic Pawn owners in full.
const lanes=['world','summary','campaign','dynamic','map','secondarySite','campaignMap','worldMaps','sites','worldGroups','groups','group','state','pending261','groupLosses','losses','abandonedContents','humans','animals','members','people','pawn','actor','human','animal','pawns','structures','jobs','packed','building','items','piles','wildlife','animalOwners','worldPawns','owners','worldFactions','leaders','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','cryptosleep','shipCryptosleep277','occupant','visitors','podRescues','departed','banishedDepartures378','startingArrival','pods','scout','commercialTrip','upserted'] as const;
const inspectedKeys=new Set<string>([...lanes,'identity378','orderedQueue378','banishedDepartures378','hunting','animalHandling','animalCare','animalFeed','animalRescue']);
type ImmutableTransportMemo378={read:(value:object,version:number,role:number)=>number|undefined;remember:(value:object,version:number,role:number,features:number)=>void;begin:()=>void;end:()=>void;array?:(values:readonly unknown[],visit:(value:unknown)=>boolean)=>boolean|undefined};
/** The witness is supplied by the native-clone owner, never by packet data.
 * Both key sets are reread for every candidate: an own hidden/accessor field
 * or a newly inherited lane must still take the ordinary descriptor path. */
function ordinaryLeaf(v:object,isOrdinary:(value:object)=>boolean):boolean {
 return isOrdinary(v)&&Object.getPrototypeOf(v)===Object.prototype
  &&!Reflect.ownKeys(v).some(key=>typeof key==='string'&&inspectedKeys.has(key))
  &&!Reflect.ownKeys(Object.prototype).some(key=>typeof key==='string'&&inspectedKeys.has(key));
}
const field=(v:object,key:string):PropertyDescriptor|undefined|false=>{const d=Object.getOwnPropertyDescriptor(v,key);return d?d.enumerable&&Object.hasOwn(d,'value')?d:false:key in v?false:undefined;};
/** Before reconstruction: future fields, getters and sparse owner arrays must
 * not disappear through spread/clone normalization on any admission path. */
function inspectTransport(raw:unknown,version:number,isOrdinary?:(value:object)=>boolean,immutable?:ImmutableTransportMemo378):{valid:boolean;features:boolean} {
 let features=false,featureCount=0;
 const feature=()=>{features=true;featureCount++;};
 immutable?.begin();
 try{
  if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return {valid:false,features};
  const active=new WeakSet<object>(),done=new WeakMap<object,number>();
  const visit=(v:unknown):boolean=>{
   if(!v||typeof v!=='object')return true;if(active.has(v))return false;
   const prior=done.get(v);if(prior!==undefined){if(prior)feature();return true;}
   const retained=immutable?.read(v,version,1);if(retained!==undefined){done.set(v,retained);if(retained)feature();return true;}
   const start=featureCount;active.add(v);
   if(Array.isArray(v)){
    const projected=immutable?.array?.(v,visit);
    if(projected!==undefined){if(!projected)return false;}
    else {
    if(Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)return false;
    for(let i=0;i<v.length;i++){const d=field(v,String(i));if(!d||!visit(d.value))return false;}
    }
   }else if(!isOrdinary||!ordinaryLeaf(v,isOrdinary)){
    if(!validPawnIdentity378(v,version,Number.MAX_SAFE_INTEGER)||!validOrderedQueuePawn378(v,version)||!validBanishedDeparturesHeader378(v,version))return false;
    if(['identity378','orderedQueue378','banishedDepartures378'].some(key=>Object.hasOwn(v,key)))feature();
    for(const task of ['hunting','animalHandling'] as const){const d=field(v,task);if(d===false)return false;if(d?.value&&typeof d.value==='object'){
     const forced=field(d.value,'forced378');if(forced===false||forced&&(version<378||forced.value!==true||task==='animalHandling'&&!['tame','slaughter'].includes(d.value.kind)))return false;if(forced)feature();
    }}
    for(const task of ['animalCare','animalFeed','animalRescue'] as const){const d=field(v,task);if(d===false||d?.value&&typeof d.value==='object'&&'forced378'in d.value)return false;}
    for(const key of lanes){const d=field(v,key);if(d===false||d&&!visit(d.value))return false;}
   }
   const present=featureCount>start?1:0;active.delete(v);done.set(v,present);immutable?.remember(v,version,1,present);return true;
  };
  return {valid:visit(raw),features};
 }catch{return {valid:false,features};}finally{immutable?.end();}
}
export const validPersonalOrdersTransport378=(raw:unknown,version:number):boolean=>inspectTransport(raw,version).valid;

/** Optional owner-witnessed acceleration. The witness may return true only
 * for ordinary records created/observed by its trusted native clone lane;
 * public/raw callers retain the full descriptor and inherited-field checks. */
export function createPersonalOrdersTransportValidators378(isOrdinary:(value:object)=>boolean,makeImmutable?:(keys:ReadonlySet<PropertyKey>,negativeKeys:ReadonlySet<PropertyKey>)=>ImmutableTransportMemo378):{transport:(raw:unknown,version:number)=>boolean;projection:(world:World)=>boolean} {
 // Ordered queue eligibility also reads these local actor fields. Subgraphs
 // such as health/draft/orders are immutable and included by reference.
 const immutable=makeImmutable?.(new Set<PropertyKey>([...inspectedKeys,'id','faction','prisoner','state','health','draft','cryptosleepHeldAt271','shipCryptosleepHeldAt277']),inspectedKeys);
 return {
  transport:(raw,version)=>inspectTransport(raw,version,isOrdinary,immutable).valid,
  projection:world=>inspectProjection(world,isOrdinary,immutable),
 };
}

/** Owner clocks come from their actual containers. This runs for every
 * publication, including resident deltas between deep-validation intervals. */
export function validPersonalOrdersProjection378(w:World):boolean {
 return inspectProjection(w);
}
function inspectProjection(w:World,isOrdinary?:(value:object)=>boolean,immutable?:ImmutableTransportMemo378):boolean {
 try{
  const version=Number(w.schemaVersion),inspection=inspectTransport(w,version,isOrdinary,immutable);if(!inspection.valid)return false;
  // No new state means the existing historical/current projection contract.
  if(!inspection.features)return true;
  if(validateOrderedQueues378(w,version).length)return false;
  const check=(p:Pawn,clock:number,local=false)=>validPawnIdentity378(p,version,clock)&&validOrderedQueuePawn378(p,version)&&(local||!('orderedQueue378'in p)&&!p.hunting?.forced378&&!p.animalHandling?.forced378);
  const capture=captureHumanOwners(w);
  const campaign=w.campaignMap?.revision===2?w.campaignMap:undefined;
  for(const slot of capture.pawnOwners)if(slot.pawn&&!check(slot.pawn,slot.validationTick,slot.kind==='map'))return false;
  const group=(g:NonNullable<World['group']>)=>!('members'in g)||g.members.every(p=>check(p,g.lastPersonalTick));
  for(const g of campaign?.groups??[])if(!group(g.state))return false;
  for(const d of campaign?.groupLosses??[])if(!check(d.pawn,d.tick))return false;
  for(const row of w.worldPawns?.owners??[])if(row.kind==='human'&&!check(row.actor,row.clockCore/10))return false;
  for(const l of w.worldFactions?.leaders??[])if(!check(l.pawn,l.clock))return false;
  const building=(s:World['structures'][number],clock=w.tick):boolean=>{
   if(s.casket&&!s.casket.humans.every(p=>check(p,clock)))return false;
   if(s.cryptosleep?.human&&!check(s.cryptosleep.human,s.cryptosleep.heldAt))return false;
   if(s.shipCryptosleep277?.occupant?.kind==='human'&&!check(s.shipCryptosleep277.occupant.pawn,s.shipCryptosleep277.heldAt))return false;return true;
  };
  for(const row of w.worldPawns?.heldCaskets259??[])if(!building(row.casket,row.registeredAtCore/10))return false;
  for(const row of w.worldPawns?.heldPlayerCaskets271??[])if(!building(row.casket,row.registeredAtCore/10))return false;
  for(const row of w.worldPawns?.heldShipCaskets277??[])if(!building(row.casket,row.registeredAtCore/10))return false;
  if(w.pawns.some(p=>p.hunting?.forced378)&&validateHunting(w,version).length)return false;
  if(w.pawns.some(p=>p.animalHandling?.forced378)&&!validDomesticTasksTransport(w,version))return false;
  if(!w.banishedDepartures378)return true;
  const ids=new Set<number>(),add=(o:{id:number})=>ids.add(o.id),items=(a:readonly {id:number;innerResource?:{id:number}}[])=>{for(const p of a){add(p);if(p.innerResource)add(p.innerResource);}},packs=(a:readonly World['packed'][number][])=>{for(const p of a){add(p.building);for(const b of p.building.bills??[])add(b);for(const id of p.building.shelf?.cells??[])ids.add(id);}};
  for(const a of [w.pawns,w.structures,w.jobs,w.resources,w.piles,w.stockpiles,w.growingZones,w.wildlife?.animals??[],w.wildlife?.flyers??[],w.mechanoids??[],w.filth?.items??[],w.fires?.items??[],w.fires?.embers??[],w.projectiles??[],w.bombWaves??[]])for(const o of a)add(o);
  items(w.piles);packs(w.packed);for(const s of w.structures){for(const b of s.bills??[])add(b);for(const id of s.shelf?.cells??[])ids.add(id);}
  for(const slot of capture.slots)if(slot.kind!=='banished-departure'){ids.add(slot.id);items([...slot.items]);packs([...slot.packed]);}
  for(const l of w.worldFactions?.leaders??[]){add(l.pawn);items(l.items);packs(l.packed);}
  for(const r of w.worldPawns?.owners??[]){add(r.actor);items(r.items);packs(r.packed);}
  const reserveBuilding=(s:World['structures'][number])=>{
   add(s);if(s.casket){for(const p of s.casket.humans)add(p);for(const a of s.casket.animals)add(a);items(s.casket.items);}
   if(s.cryptosleep){if(s.cryptosleep.human)add(s.cryptosleep.human);items(s.cryptosleep.items);packs(s.cryptosleep.packed);}
   if(s.shipCryptosleep277){const h=s.shipCryptosleep277,o=h.occupant;if(o)add(o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech);items(h.items);packs(h.packed);}
  };
  for(const s of w.structures)reserveBuilding(s);for(const s of w.packed)reserveBuilding(s.building);
  for(const r of [...w.worldPawns?.heldCaskets259??[],...w.worldPawns?.heldPlayerCaskets271??[],...w.worldPawns?.heldShipCaskets277??[]])reserveBuilding(r.casket);
  for(const r of w.worldPawns?.discardedMechanical259??[])add(r);
  if(w.startingArrival&&w.startingArrival.phase!=='opened')for(const p of w.startingArrival.pods)add(p);
  for(const g of campaign?.groups??[])if('members'in g.state){for(const p of g.state.members)add(p);for(const a of g.state.animalOwners?.members??[])add(a);items(g.state.items);packs(g.state.packed??[]);}
  for(const l of campaign?.groupLosses??[]){add(l.pawn);items(l.items);packs(l.packed??[]);}
  for(const g of w.geysers?.items??[])add(g);for(const j of w.jobs)if(j.wallDoor296?.plan)add(j.wallDoor296.plan);
  for(const t of w.tiles){if(t.mineable)add(t.mineable);const rock=collapsedRockAt256(t);if(rock)add(rock);}
  for(const r of w.ancientShrineWarnings?.pairs??[]){if(r.triggerAlive)ids.add(r.triggerId);if(r.actionAlive)ids.add(r.actionId);}
  for(const s of w.worldSites263?.entries??[])if(s.kind==='item-stash')items(s.items);
  return validateBanishedDepartures378(w,version,ids).length===0;
 }catch{return false;}
}
