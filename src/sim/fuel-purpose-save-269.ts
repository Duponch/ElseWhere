import {isSchema269OrLater} from './schema-compatibility-257.ts';
import {carryQuantityBound379} from './carry-quantity-379.ts';
import {fuelCapacity,REFUEL_WORK_TICKS} from './fuel.ts';
import {reservedSource} from './materials.ts';
import {withoutQueuedOrder} from './haul-reservations.ts';
import {footprintCells} from './definitions.ts';
import type {World,Pawn,HaulTask} from './types.ts';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,lo=1,hi=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const marked=(v:unknown):v is Record<string,unknown>=>record(v)&&Object.hasOwn(v,'forCrafting');
/** Absence preserves the literal historical purpose contract. */
export function validCraftingFuelDestination269(value:Record<string,unknown>,version:number):boolean {
 if(!marked(value))return true;
 return isSchema269OrLater(version)&&value.type==='fuel'&&value.forCrafting===true&&!Object.hasOwn(value,'forCooking')&&int(value.structureId)
  &&Object.keys(value).every(k=>['type','structureId','forCrafting','forced'].includes(k))&&(!Object.hasOwn(value,'forced')||value.forced===true);
}
/** Only the new purpose acquires these shared file/Decoder checks. Existing
 * hauling keeps its own validators and never gains a terrain/owner census. */
export function validCraftingFuelTransport269(w:World,version:number):boolean {
 try{
  if(!w.pawns.some(p=>marked(p.haul?.destination)||p.orders?.queue?.some(o=>record(o)&&marked(o.destination))))return true;
  if(!isSchema269OrLater(version))return false;
  const cell=(v:unknown)=>record(v)&&Object.keys(v).every(k=>k==='x'||k==='z')&&int(v.x,0,w.width-1)&&int(v.z,0,w.height-1);
  const valid=(raw:unknown,pawn:Pawn,queued:boolean):boolean=>{
   if(!record(raw)||!marked(raw.destination))return true;
   const d=raw.destination;if(!validCraftingFuelDestination269(d,version))return false;
   const target=w.structures.find(s=>s.id===d.structureId),pile=w.piles.find(p=>p.id===(raw.phase==='pickup'?raw.sourcePileId:raw.carryPileId));
   if(target?.kind!=='fueled-smithy'||!target.fuel||!pile||pile.item!=='wood'
    ||Object.keys(raw).some(k=>!['sourcePileId','quantity','phase','destination','carryPileId',...queued?[]:['pickupCell','serviceProgress']].includes(k))
    ||!int(raw.sourcePileId,1,w.nextId-1)||!int(raw.quantity,1,carryQuantityBound379({schemaVersion:version},pile.item))||!['pickup','deliver'].includes(String(raw.phase))
    ||queued&&(raw.phase!=='pickup'||d.forced!==true)
    ||!queued&&(d.forced===true?pawn.orders.active!=='haul':pawn.orders.active!==null)
    ||Object.hasOwn(raw,'pickupCell')&&!cell(raw.pickupCell)
    ||Object.hasOwn(raw,'serviceProgress')&&(raw.phase!=='deliver'||!int(raw.serviceProgress,1,REFUEL_WORK_TICKS-1)))return false;
   if(raw.phase==='pickup'?(raw.carryPileId!==null||pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity)
    :(!int(raw.carryPileId,1,w.nextId-1)||pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||pile.quantity!==raw.quantity))return false;
   if(raw.serviceProgress!==undefined&&(pawn.state!=='working'||pawn.path.length||(pawn.motion?.end??0)>w.tick||pawn.moveCooldown>0||!footprintCells(target).some(c=>Math.abs(c.x-pawn.x)+Math.abs(c.z-pawn.z)<=1)))return false;
   // A waiting order excludes only itself; every other waiting/active service,
   // including the same actor's, still owns its workstation reservation.
   const view=queued?withoutQueuedOrder(w,raw as unknown as HaulTask):w;
   return fuelCapacity(view,target.id,queued?undefined:pawn.id,d.forced===true)>=raw.quantity;
  };
  for(const p of w.pawns){if(!valid(p.haul,p,false))return false;for(const q of p.orders.queue)if(!valid(q,p,true))return false;}
  return true;
 }catch{return false;}
}
