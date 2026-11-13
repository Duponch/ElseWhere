import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import {validCapturedCoreMove297} from './core-move-save-297.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {isColonist} from './affiliation.ts';
import {pawnBody} from './health-rules.ts';
import {medicalStatus} from './injury-state.ts';
import {consumeActivityValid} from './consuming.ts';
import {validForcedConsumePawnShape} from './consume-save.ts';
import {travelEnd,validSlowIntervals,validStunIntervals} from './travel-timing.ts';
import {validCapturedTravelDelay} from './captured-travel-delay.ts';
import {MIN_PAWN_SPEED_V87,maxPawnDelay318,maxPawnSpeedFactor307 } from './travel-validation.ts';
import {reservedSourcesByPile} from './materials.ts';
import {captureStandability} from './furniture-travel.ts';
import {validDiningPlace} from './dining.ts';
import {serviceCell} from './service-reservations.ts';
import {bedSlotCell} from './bed-slots.ts';
import {isCookingOrder} from './order-types.ts';
import {urgentTreatment} from './care-rules.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import type {AlcoholReason265} from './alcohol-state-265.ts';
import type {Cell,MaterialPile,NeedTask,Pawn,World} from './types.ts';

type Eat=Extract<NeedTask,{kind:'eat'}>;
const reasons:readonly AlcoholReason265[]=['joy','scheduled','addiction','ordered','binge','inventory'];
const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
 &&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)
 &&Reflect.ownKeys(v).every(k=>typeof k==='string'&&!!Object.getOwnPropertyDescriptor(v,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const closed=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>data(v)&&Reflect.ownKeys(v).every(k=>keys.includes(k as string));
const int=(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const cell=(v:unknown,w:Pick<World,'width'|'height'>):v is Cell=>closed(v,['x','z'])&&Object.hasOwn(v,'x')&&Object.hasOwn(v,'z')&&int(v.x,0,w.width-1)&&int(v.z,0,w.height-1);
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const distance=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
const step=(a:Cell,b:Cell)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z));
/** Presence includes inherited/undefined markers, so an old packet cannot hide
 * a future task behind a false value. Unmarked historical meals are untouched. */
export function hasAlcoholConsumeMarker265(pawn:{need?:unknown}):boolean {return !!pawn.need&&typeof pawn.need==='object'&&'alcoholReason'in pawn.need;}
export function validAlcoholConsumePawnShape265(pawn:{need?:unknown;orders?:unknown;draft?:unknown},version:number,w:Pick<World,'width'|'height'|'nextId'|'tick'>):boolean {
 if(!hasAlcoholConsumeMarker265(pawn))return true;
 const t=pawn.need;
 if(!isSchema265OrLater(version)||!closed(t,['kind','alcoholReason','forced','phase','sourcePileId','carryPileId','quantity','progress','workRemainder','dining'])
  ||!['kind','alcoholReason','phase','sourcePileId','carryPileId','quantity','progress','dining'].every(k=>Object.hasOwn(t,k))
  ||t.kind!=='eat'||!reasons.includes(t.alcoholReason as AlcoholReason265)||!['pickup','choose-spot','travel','ingest'].includes(t.phase as string)
  ||!int(t.sourcePileId,1,w.nextId-1)||!int(t.quantity,1,t.alcoholReason==='inventory'?3:1)||!int(t.progress,0,49))return false;
 if(t.alcoholReason==='ordered'?!Object.hasOwn(t,'forced')||t.forced!==true||!validForcedConsumePawnShape(pawn,version,w):'forced'in t)return false;
 if(t.phase==='pickup'?t.carryPileId!==null:!int(t.carryPileId,1,w.nextId-1))return false;
 if(t.phase!=='ingest'&&(t.progress!==0||Object.hasOwn(t,'workRemainder'))||Object.hasOwn(t,'workRemainder')&&!int(t.workRemainder,1,9999))return false;
 if(t.alcoholReason==='inventory'&&t.phase!=='pickup')return false;
 if(t.phase==='pickup'||t.phase==='choose-spot')return t.dining===null;
 const d=t.dining;
 return closed(d,['target','seatId','tableId'])&&['target','seatId','tableId'].every(k=>Object.hasOwn(d,k))&&cell(d.target,w)
  &&(d.seatId===null||int(d.seatId,1,w.nextId-1))&&(d.tableId===null||int(d.tableId,1,w.nextId-1));
}
function validTravel(p:Pawn,w:World):boolean {
 if(!Number.isFinite(p.moveCooldown)||p.moveCooldown<0||p.moveCooldown>maxPawnDelay318(w.schemaVersion))return false;
 const m=p.motion;if(m==null)return p.moveCooldown===0;
 return !!m&&typeof m==='object'&&!('stop297'in m)&&cell(m.from,w)&&cell(m.to,w)&&same(m.to,p)&&step(m.from,m.to)===1
  &&Number.isFinite(m.start)&&Number.isFinite(m.end)&&m.start>=0&&m.start<=effectiveLocal297(w)
  &&validCapturedCoreMove297(m,w.schemaVersion)&&validStunIntervals(m.stuns,w.schemaVersion,m.start,w.tick,isCorePhysicalSchema297(w.schemaVersion)?effectiveCore297(w):undefined)&&validSlowIntervals(m.stagger,w.schemaVersion,m.start,w.tick,isCorePhysicalSchema297(w.schemaVersion)?effectiveCore297(w):undefined)
  &&(m.speedFactor===undefined||Number.isFinite(m.speedFactor)&&m.speedFactor>=MIN_PAWN_SPEED_V87&&m.speedFactor<=maxPawnSpeedFactor307(w.schemaVersion))
  &&validCapturedTravelDelay(m.terrainDelay,w.schemaVersion)&&Math.abs(m.end-travelEnd(m))<=1e-7
  &&Math.abs(p.moveCooldown-Math.max(0,m.end-effectiveLocal297(w)))<=1e-7;
}
function actorValid(p:Pawn,w:World,t:Eat):boolean {
 if(!isColonist(p)||p.prisoner||p.visitor||p.raid||p.podRescue||p.health?.body!==undefined||p.health?.death||p.health&&medicalStatus(p.health)!=='mobile')return false;
 const body=pawnBody(p);if(!body.canBeAwake||body.capacities.eating<=0||body.capacities.manipulation<=0)return false;
 if(t.alcoholReason==='ordered')return consumeActivityValid(w,p);
 if(p.orders.active!==null||p.draft||p.priorityWork||p.interruptedCargo||p.medicalSleep||p.jobId!==null||p.haul||p.cooking||p.brewing
  ||p.research||p.orbitalTrade||p.deepWork||p.animalHandling||p.animalCare||p.animalFeed||p.animalRescue||p.rescue||p.tend||p.feed||p.ward||p.surgery
  ||p.hunting||p.burial||p.cleaning||p.firefighting||p.trade||p.equipmentTask||p.recreation.task||p.openCasket||p.transitExit
  ||p.burning||p.bombRefuge||p.heatRefuge||p.flee||p.melee||p.shooting)return false;
 if(p.mental?.crisis&&(p.mental.crisis.kind!=='drug-binge'||t.alcoholReason!=='binge')||t.alcoholReason==='binge'&&p.mental?.crisis?.kind!=='drug-binge')return false;
 return t.phase==='ingest'?p.state==='eating':p.state==='moving';
}
/** One local map after ordinary collection/owner guards. The caller validates
 * foreign/frozen task absence from its existing campaign-owner capture. No
 * terrain census, route search or persistent cache; indexes are built only if
 * a marked task exists and discarded before the next mutation. */
export function validAlcoholConsumeTransport265(w:World,knownConsumers?:readonly Pawn[]):boolean {
 try {
 const consumers=knownConsumers??w.pawns.filter(hasAlcoholConsumeMarker265);if(!consumers.length)return true;
 if(!isSchema265OrLater(w.schemaVersion))return false;
 const key=(c:Cell)=>c.z*w.width+c.x;
 const piles=new Map<number,MaterialPile>(),carried=new Map<number,MaterialPile[]>(),actors=new Map<number,Pawn>();
 const services=new Map<number,Set<number>>(),patients=new Set<number>(),unavailable=new Set<number>();
 const buildings=new Map(w.structures.map(b=>[b.id,b]));
 const claim=(c:Cell,id:number)=>{let s=services.get(key(c));if(!s){s=new Set();services.set(key(c),s);}s.add(id);};
 if(w.group&&'memberIds'in w.group)for(const id of w.group.memberIds)unavailable.add(id);
 if(w.scout&&(w.scout.phase==='loading'||w.scout.phase==='leaving'))unavailable.add(w.scout.pawnId);
 if(w.commercialTrip&&'pawnId'in w.commercialTrip)unavailable.add(w.commercialTrip.pawnId);
 for(const pack of w.packed)if(pack.owner.type==='pawn')unavailable.add(pack.owner.pawnId);
 for(const p of w.piles){if(piles.has(p.id))return false;piles.set(p.id,p);if(p.owner.type==='pawn'){const list=carried.get(p.owner.pawnId)??[];list.push(p);carried.set(p.owner.pawnId,list);}}
 for(const p of w.pawns){
  if(actors.has(p.id))return false;actors.set(p.id,p);
  const visit=p.recreation.task,skip=visit?.activity==='visit-sick'&&w.pawns.some(q=>q.id===visit.patientId&&urgentTreatment(q));
  const s=skip?null:serviceCell(p,w);if(s)claim(s,p.id);
  if(p.feed?.paste&&(p.feed.phase==='pickup'||p.feed.phase==='collect'))claim(p.feed.spot,p.id);
  for(const o of p.orders.queue)if(isCookingOrder(o))claim(o.cooking.spot,p.id);
  for(const t of [p.tend,p.feed,p.ward,p.surgery,p.rescue])if(t)patients.add(t.patientId);
  if(p.rescue){const bed=buildings.get(p.rescue.bedId),target=bed?.kind==='double-bed'&&p.rescue.bedSlot!==undefined?bedSlotCell(bed,p.rescue.bedSlot):bed;if(target)claim(target,p.id);}
  if(p.animalRescue){const target=buildings.get(p.animalRescue.spotId);if(target)claim(target,p.id);}
 }
 const reserved=reservedSourcesByPile(w),standable=captureStandability(w);
 const areas=new Map((w.allowedAreas??[]).filter(a=>a.cells.length).map(a=>[a.id,new Set(a.cells)]));
 const inArea=(p:Pawn,c:Cell)=>!!p.draft||p.allowedAreaId===undefined||!areas.has(p.allowedAreaId)||areas.get(p.allowedAreaId)!.has(key(c));
 const free=(p:Pawn,c:Cell)=>{const owners=services.get(key(c));return !owners||owners.size===1&&owners.has(p.id);};
 for(const p of consumers){
  if(actors.get(p.id)!==p||unavailable.has(p.id)||patients.has(p.id)||!validAlcoholConsumePawnShape265(p,w.schemaVersion,w))return false;
  const t=p.need;if(t?.kind!=='eat'||!hasAlcoholConsumeMarker265(p)||!actorValid(p,w,t)||!cell({x:p.x,z:p.z},w)||!validTravel(p,w)||!Array.isArray(p.path)||p.path.length>w.width*w.height)return false;
  let previous:Cell=p;for(const c of p.path){if(!cell(c,w)||step(previous,c)!==1)return false;previous=c;}
  const held=carried.get(p.id)??[],pile=piles.get((t.phase==='pickup'?t.sourcePileId:t.carryPileId)??-1);
  if(!pile||pile.kind!=='beer'||pile.item!=='beer'||!int(pile.id,1,w.nextId-1)||!int(pile.quantity,1,ITEM_DEFINITIONS.beer.stackLimit)||t.quantity>pile.quantity)return false;
  const moving=p.moveCooldown>0||(p.motion?.end??0)>w.tick;
  if(t.phase==='pickup'){
   if(held.length)return false;
   if(pile.owner.type==='inventory'){
    if(t.alcoholReason==='inventory'||t.alcoholReason==='ordered'||pile.owner.pawnId!==p.id||p.path.length||moving)return false;
   }else {
    if(pile.owner.type!=='ground'||!cell({x:pile.owner.x,z:pile.owner.z},w)||t.alcoholReason!=='binge'&&!inArea(p,pile.owner)||!int(reserved.get(pile.id),t.quantity,pile.quantity))return false;
    const end=p.path.at(-1)??p;if(!standable(end)||distance(end,pile.owner)>1)return false;
    if(t.alcoholReason==='ordered'&&!free(p,end))return false;
   }
  }else {
   if(held.length!==1||held[0]!==pile||pile.owner.type!=='pawn'||pile.owner.pawnId!==p.id||pile.quantity!==1)return false;
   if(t.phase==='choose-spot'){if(p.path.length||moving)return false;continue;}
   const d=t.dining;if(!d||!validDiningPlace(w,d)||!inArea(p,d.target)||!free(p,d.target))return false;
   if(p.path.length?!same(p.path.at(-1)!,d.target):!same(p,d.target))return false;
   if(t.phase==='ingest'&&(moving||p.path.length||!same(p,d.target)))return false;
   if(p.draft&&(moving||p.path.length||d.seatId!==null||!same(p,d.target)))return false;
  }
 }
 return true;
 }catch{return false;}
}
