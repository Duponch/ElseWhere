import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import {validCapturedCoreMove297} from './core-move-save-297.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import { validateMedicalRecord } from './injury-validation.ts';
import { medicalStatus } from './injury-state.ts';
import { travelEnd,validSlowIntervals,validStunIntervals } from './travel-timing.ts';
import { validCapturedTravelDelay } from './captured-travel-delay.ts';
import { MIN_PAWN_SPEED_V87,MAX_PAWN_DELAY_V226,maxPawnSpeedFactor307 } from './travel-validation.ts';
import { validDraftShape } from './drafting-save.ts';
import { consumeActivityValid } from './consuming.ts';
import { FOOD_ITEMS } from './food-policy.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { MAX_STACK,footprintCells } from './definitions.ts';
import { captureStandability } from './furniture-travel.ts';
import { isDiningSeat,isDiningTable } from './dining.ts';
import { serviceCell } from './service-reservations.ts';
import { bedSlotCell } from './bed-slots.ts';
import { isCookingOrder } from './order-types.ts';
import { reservedSourcesByPile } from './materials.ts';
import type { Cell,MaterialPile,Pawn,World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const distance=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
const stepDistance=(a:Cell,b:Cell)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z));
const dataRecord=(v:unknown):v is Record<string,unknown>=>record(v)
  &&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)
  &&Reflect.ownKeys(v).every(k=>typeof k==='string'&&!!Object.getOwnPropertyDescriptor(v,k)?.enumerable
    &&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const closed=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>dataRecord(v)&&Reflect.ownKeys(v).every(k=>keys.includes(k as string));
const cell=(v:unknown,w:Pick<World,'width'|'height'>):v is Cell=>closed(v,['x','z'])&&int(v.x,0,w.width-1)&&int(v.z,0,w.height-1);

/** Same captured segment arithmetic as the existing Pawn guard, without any
 * World census or navigation rebuild. A held task cannot fabricate stationarity. */
function validConsumeTravel(pawn:Pawn,world:World):boolean {
  if(!Number.isFinite(pawn.moveCooldown)||pawn.moveCooldown<0||pawn.moveCooldown>MAX_PAWN_DELAY_V226)return false;
  const m=pawn.motion;
  if(m==null)return pawn.moveCooldown===0;
  if(!record(m)||'stop297'in m||!cell(m.from,world)||!cell(m.to,world)||!same(m.to,pawn)||stepDistance(m.from,m.to)!==1
    ||!Number.isFinite(m.start)||!Number.isFinite(m.end)||m.start<0||m.start>effectiveLocal297(world))return false;
  return validCapturedCoreMove297(m,world.schemaVersion)&&validStunIntervals(m.stuns,world.schemaVersion,m.start,world.tick,isCorePhysicalSchema297(world.schemaVersion)?effectiveCore297(world):undefined)&&validSlowIntervals(m.stagger,world.schemaVersion,m.start,world.tick,isCorePhysicalSchema297(world.schemaVersion)?effectiveCore297(world):undefined)
    &&(m.speedFactor===undefined||Number.isFinite(m.speedFactor)&&m.speedFactor>=MIN_PAWN_SPEED_V87&&m.speedFactor<=maxPawnSpeedFactor307(world.schemaVersion))
    &&validCapturedTravelDelay(m.terrainDelay,world.schemaVersion)&&Math.abs(m.end-travelEnd(m))<=1e-7
    &&Math.abs(pawn.moveCooldown-Math.max(0,m.end-effectiveLocal297(world)))<=1e-7;
}
/** Presence, not truthiness: false/undefined/inherited markers remain future fields. */
export function hasForcedConsumeMarker(pawn:{need?:unknown}):boolean {
  return record(pawn.need)&&'forced' in pawn.need;
}
export function hasForcedConsumptionDomain(pawn:{need?:unknown;orders?:unknown;draft?:unknown}):boolean {
  return hasForcedConsumeMarker(pawn)||record(pawn.orders)&&pawn.orders.active==='consume'
    ||!!pawn.draft&&record(pawn.need)&&pawn.need.kind==='eat';
}
/** Closed new task only. Unmarked historical needs keep their existing guard. */
export function validForcedConsumeShape(value:unknown,version:number,w:Pick<World,'width'|'height'|'nextId'>):boolean {
  if(version<234||!closed(value,['kind','forced','phase','sourcePileId','carryPileId','quantity','progress','workRemainder','dining',...(isSchema265OrLater(version)?['alcoholReason']:[])])
    ||!['kind','forced','phase','sourcePileId','carryPileId','quantity','progress','dining'].every(k=>Object.hasOwn(value,k))
    ||value.kind!=='eat'||value.forced!==true||(typeof value.phase!=='string'||!['pickup','choose-spot','travel','ingest'].includes(value.phase))
    ||!int(value.sourcePileId,1,w.nextId-1)||!int(value.quantity,1,MAX_STACK)||!int(value.progress,0,49))return false;
  if('alcoholReason'in value&&(!isSchema265OrLater(version)||value.alcoholReason!=='ordered'||value.quantity!==1))return false;
  if(value.phase==='pickup'?value.carryPileId!==null:!int(value.carryPileId,1,w.nextId-1))return false;
  if(value.phase!=='ingest'&&(value.progress!==0||Object.hasOwn(value,'workRemainder'))
    ||Object.hasOwn(value,'workRemainder')&&!int(value.workRemainder,1,9999))return false;
  if(value.phase==='pickup'||value.phase==='choose-spot')return value.dining===null;
  const d=value.dining;
  return closed(d,['target','seatId','tableId'])&&['target','seatId','tableId'].every(k=>Object.hasOwn(d,k))
    &&cell(d.target,w)&&(d.seatId===null||int(d.seatId,1,w.nextId-1))&&(d.tableId===null||int(d.tableId,1,w.nextId-1));
}
export function validForcedConsumePawnShape(pawn:{need?:unknown;orders?:unknown;draft?:unknown},version:number,w:Pick<World,'width'|'height'|'nextId'|'tick'>):boolean {
  if(!hasForcedConsumptionDomain(pawn))return true;
  if(!hasForcedConsumeMarker(pawn)||!validForcedConsumeShape(pawn.need,version,w)
    ||!closed(pawn.orders,['active','queue'])||pawn.orders.active!=='consume'||!Array.isArray(pawn.orders.queue)||pawn.orders.queue.length)return false;
  if(pawn.draft){
    const d=pawn.draft;
    if(!closed(d,['lastActiveTick','target','queue','holdFire'])||!validDraftShape(d,version,w)
      ||Object.hasOwn(d,'holdFire')&&d.holdFire!==true||d.target!==null||!Array.isArray(d.queue)||d.queue.length)return false;
  }
  return true;
}
/** Outside-map records never receive this spatial task, even when no local user exists. */
export function validForcedConsumeOwners(world:World):boolean {
  try {
  const valid=(p:Pawn)=>!hasForcedConsumptionDomain(p);
  const scout=world.scout,trip=world.commercialTrip;
  if(scout&&'pawn' in scout&&!valid(scout.pawn)||trip&&'pawn' in trip&&!valid(trip.pawn))return false;
  if(world.startingArrival&&world.startingArrival.phase!=='opened')for(const pod of world.startingArrival.pods)if(!valid(pod.pawn))return false;
  if(world.group&&'members' in world.group)for(const p of world.group.members)if(!valid(p))return false;
  for(const loss of world.groupLosses??[])if(!valid(loss.pawn))return false;
  for(const departure of world.visitors?.departed??[])if(!valid(departure.pawn))return false;
  for(const departure of world.podRescues?.departed??[])if(!valid(departure.pawn))return false;
  return true;
  }catch{return false;}
}

/** One candidate adoption, including retained actors and piles. No full World
 * validator and no tile census; absent-domain callers avoid all indexes. */
export function validForcedConsumeTransport(world:World,knownConsumers?:readonly Pawn[]):boolean {
  try {
    if(!validForcedConsumeOwners(world))return false;
    const consumers=knownConsumers??world.pawns.filter(hasForcedConsumptionDomain);
    if(!consumers.length)return true;
    if(world.schemaVersion<234)return false;
    const travelling=new Set<number>();
    if(world.group&&'memberIds' in world.group)for(const id of world.group.memberIds)travelling.add(id);
    if(world.scout&&(world.scout.phase==='loading'||world.scout.phase==='leaving'))travelling.add(world.scout.pawnId);
    if(world.commercialTrip&&'pawnId' in world.commercialTrip)travelling.add(world.commercialTrip.pawnId);
    const areas=new Map((world.allowedAreas??[]).filter(a=>a.cells.length).map(a=>[a.id,new Set(a.cells)]));
    const inArea=(pawn:Pawn,target:Cell)=>pawn.draft||pawn.allowedAreaId===undefined||!areas.has(pawn.allowedAreaId)
      ||areas.get(pawn.allowedAreaId)!.has(target.z*world.width+target.x);
    const packedHeld=new Set<number>();
    for(const pack of world.packed)if(pack.owner.type==='pawn')packedHeld.add(pack.owner.pawnId);
    const piles=new Map<number,MaterialPile>(),carried=new Map<number,MaterialPile[]>(),actors=new Map<number,Pawn>();
    const services=new Map<number,Set<number>>(),patients=new Map<number,Set<number>>(),beds=new Map(world.structures.map(s=>[s.id,s]));
    const key=(c:Cell)=>c.z*world.width+c.x;
    const claim=(map:Map<number,Set<number>>,id:number,actor:number)=>{
      let owners=map.get(id);if(!owners){owners=new Set();map.set(id,owners);}owners.add(actor);
    };
    for(const pile of world.piles){
      if(piles.has(pile.id))return false;piles.set(pile.id,pile);
      if(pile.owner.type==='pawn'){const owned=carried.get(pile.owner.pawnId)??[];owned.push(pile);carried.set(pile.owner.pawnId,owned);}
    }
    for(const actor of world.pawns){
      if(actors.has(actor.id))return false;actors.set(actor.id,actor);
      const s=serviceCell(actor,world);if(s)claim(services,key(s),actor.id);
      if(actor.feed?.paste&&(actor.feed.phase==='pickup'||actor.feed.phase==='collect'))claim(services,key(actor.feed.spot),actor.id);
      for(const order of actor.orders?.queue??[])if(isCookingOrder(order))claim(services,key(order.cooking.spot),actor.id);
      for(const task of [actor.tend,actor.feed,actor.ward,actor.surgery,actor.rescue])if(task)claim(patients,task.patientId,actor.id);
      if(actor.rescue){const bed=beds.get(actor.rescue.bedId),target=bed?.kind==='double-bed'&&actor.rescue.bedSlot!==undefined?bedSlotCell(bed,actor.rescue.bedSlot):bed;if(target)claim(services,key(target),actor.id);}
      if(actor.animalRescue){const spot=beds.get(actor.animalRescue.spotId);if(spot)claim(services,key(spot),actor.id);}
    }
    const reserved=reservedSourcesByPile(world),standable=captureStandability(world);
    const free=(c:Cell,actor:number)=>{const owners=services.get(key(c));return !owners||owners.size===1&&owners.has(actor);};
    const food=(p:MaterialPile|undefined,beer:boolean):p is MaterialPile=>!!p&&(beer?isSchema265OrLater(world.schemaVersion)&&p.kind==='beer'&&p.item==='beer':p.kind==='food'&&FOOD_ITEMS.includes(p.item as typeof FOOD_ITEMS[number]))
      &&int(p.id,1,world.nextId-1)&&int(p.quantity,1,ITEM_DEFINITIONS[p.item].stackLimit);
    for(const pawn of consumers){
      if(travelling.has(pawn.id)||packedHeld.has(pawn.id)||actors.get(pawn.id)!==pawn||!validForcedConsumePawnShape(pawn,world.schemaVersion,world)||!consumeActivityValid(world,pawn))return false;
      if(patients.has(pawn.id))return false;
      const health=pawn.health;
      if(health&&(health.body!==undefined||health.death||medicalCivilTick271(health)>world.tick||medicalStatus(health)!=='mobile'
        ||validateMedicalRecord(health,true,true,true,true,false,false,true,true,true,true,true,world.schemaVersion,world.schemaVersion>=127)!==null))return false;
      const task=pawn.need;if(task?.kind!=='eat')return false;
      if(!Array.isArray(pawn.path)||pawn.path.length>world.width*world.height||!cell({x:pawn.x,z:pawn.z},world)||!validConsumeTravel(pawn,world))return false;
      let previous:Cell=pawn;
      for(const step of pawn.path){if(!cell(step,world)||stepDistance(previous,step)!==1)return false;previous=step;}
      const owned=carried.get(pawn.id)??[],pile=piles.get((task.phase==='pickup'?task.sourcePileId:task.carryPileId)??-1);
      if(!food(pile,task.alcoholReason==='ordered')||task.quantity>ITEM_DEFINITIONS[pile.item].maxIngest)return false;
      const moving=(pawn.motion?.end??0)>world.tick||pawn.moveCooldown>0;
      if(task.phase==='pickup'){
        if(owned.length||pile.owner.type!=='ground'||!inArea(pawn,pile.owner)||!int(reserved.get(pile.id),task.quantity,pile.quantity)||task.quantity>pile.quantity)return false;
        const end=pawn.path.at(-1)??pawn;
        if(!standable(end)||distance(end,pile.owner)>1)return false;
      }else{
        if(owned.length!==1||owned[0]!==pile||pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||pile.quantity!==task.quantity||moving&&task.phase==='choose-spot')return false;
        if(task.phase==='choose-spot'&&pawn.path.length)return false;
        const place=task.dining;
        if(place){
          if(!standable(place.target)||!inArea(pawn,place.target)||!free(place.target,pawn.id))return false;
          if(place.seatId!==null){const seat=beds.get(place.seatId);if(!seat||!isDiningSeat(seat.kind)||!same(seat,place.target)||place.tableId===null&&task.alcoholReason!=='ordered')return false;}
          if(place.tableId!==null){const table=beds.get(place.tableId);if(!table||!isDiningTable(table.kind)||!footprintCells(table).some(c=>distance(c,place.target)===1))return false;}
          if(pawn.path.length&&!same(pawn.path.at(-1)!,place.target)||!pawn.path.length&&!same(pawn,place.target))return false;
          if(task.phase==='ingest'&&(moving||pawn.path.length||!same(pawn,place.target)))return false;
          if(pawn.draft&&(moving||pawn.path.length||place.seatId!==null||!same(pawn,place.target)))return false;
        }
      }
    }
    return true;
  }catch{return false;}
}
export function validateForcedConsumption(world:World):string[] {
  return validForcedConsumeTransport(world)?[]:['Invalid forced consumption task, custody, source or dining reservation.'];
}
