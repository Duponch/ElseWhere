import type {Pawn,World} from './types.ts';
import {validPawnIdentity378} from './pawn-identity-state-378.ts';
import {validateDetachedPawnRecordShape} from './pawn-record-save.ts';
import {validatePawnHealthRecord} from './health-save.ts';
import {validatePileRecordShape} from './material-record-save.ts';
import {validatePackedFurnitureRecords} from './furniture-transfer-save.ts';
import {validateHumanSocial} from './social-save.ts';
import {validateEquipmentOwners259} from './equipment-save.ts';
import {validateApparelOwners259} from './apparel-save.ts';
import {validateGroupPackedComponents258} from './group-packed-components-258.ts';
import {atMapEdge} from './raid-space.ts';
import {captureHumanOwners} from './human-owners.ts';
import {registeredMapId} from './world-map-context.ts';
import {schemaAtLeast} from './schema-range.ts';

const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const dense=(v:unknown):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));return !!d&&d.enumerable===true&&Object.hasOwn(d,'value');}).every(Boolean);
/** Historical boundary and shape preflight, before owner capture follows the
 * field. An own undefined field is rejected under every schema. */
export function validBanishedDeparturesHeader378(raw:unknown,version:number):boolean {
 if(!raw||typeof raw!=='object')return false;const d=Object.getOwnPropertyDescriptor(raw,'banishedDepartures378');if(!d)return !('banishedDepartures378'in raw);
 if(!schemaAtLeast(378)(version)||!d.enumerable||!Object.hasOwn(d,'value')||!dense(d.value)||!d.value.length)return false;
 return d.value.every(row=>data(row)&&Object.keys(row).length===5&&['tick','mapId','pawn','items','packed'].every(k=>Object.hasOwn(row,k))&&Number.isSafeInteger(row.tick)&&Number(row.tick)>=0&&Number.isSafeInteger(row.mapId)&&Number(row.mapId)>=0&&data(row.pawn)&&dense(row.items)&&dense(row.packed));
}
/** Registers every physical identity in the same ordinary namespace sink.
 * Already admitted frozen bodies are validated at their real exit date. */
export function validateBanishedDepartures378(w:World,version:number,ids:Set<number>):string[] {
 if(!validBanishedDeparturesHeader378(w,version))return ['Invalid or future complete banishment departure owner.'];
 const rows=w.banishedDepartures378;if(!rows)return [];
 const errors:string[]=[],known=new Set<number>();
 try{for(const id of captureHumanOwners(w).people.keys())known.add(id);}catch{errors.push('Duplicate banishment human owner.');}
 const add=(id:number)=>{if(!Number.isSafeInteger(id)||id<1||id>=w.nextId||ids.has(id))errors.push('Duplicate or invalid banishment Thing identity.');ids.add(id);};
 if(rows.length>w.nextId)errors.push('Too many banishment archives.');
 for(const d of rows){
  const p=d.pawn,c={...w,tick:d.tick},raw=p as unknown as Record<string,unknown>;
  if(!dense(raw.path)||!data(raw.orders)||!dense(raw.orders.queue)){errors.push('Invalid complete banishment departure body.');continue;}
  if(d.tick>w.tick||d.mapId!==registeredMapId(w)||!atMapEdge(w,p)||p.identity378?.banishedAt===undefined||p.identity378.banishedAt>d.tick||!validPawnIdentity378(p,version,d.tick)||p.faction!=='outlanders'||p.worldAffiliation259&&p.worldAffiliation259.factionId!==null||p.prisoner||p.visitor||p.raid||p.podRescue||p.state==='dead'||p.state==='downed'||p.path.length||p.motion||p.moveCooldown||p.need||p.jobId!==null||p.haul||p.cooking||p.rescue||p.animalRescue||p.bedId!==null||p.mapBed||p.orders.active!==null||p.orders.queue.length)errors.push('Invalid complete banishment departure body.');
  add(p.id);errors.push(...validateDetachedPawnRecordShape(raw,c,version,d.tick,d.tick*10),...validatePawnHealthRecord(p,c),...validateHumanSocial(p,version,d.tick,known,[]));
  if(d.items.some(item=>!data(item)||!data(item.owner))||d.packed.some(pack=>!data(pack)||!data(pack.owner)||!data(pack.building))){errors.push('Invalid retained banishment possession.');continue;}
  for(const item of d.items){add(item.id);const pile=item as unknown as World['piles'][number];if(pile.innerResource)add(pile.innerResource.id);if(!('pawnId'in pile.owner)||pile.owner.pawnId!==p.id||!['inventory','equipment','apparel'].includes(pile.owner.type))errors.push('Banishment item has no actual retained holder.');errors.push(...validatePileRecordShape(item as unknown as Record<string,unknown>,c,version,d.tick));}
  errors.push(...validateEquipmentOwners259([p],d.items),...validateApparelOwners259([p],d.items,version));
  const packedIds=new Set<number>();errors.push(...validatePackedFurnitureRecords(d.packed,c,version,packedIds),...validateGroupPackedComponents258(c,d.packed,version,d.tick,d.tick*10));for(const id of packedIds)add(id);
  for(const pack of d.packed){for(const id of pack.building.shelf?.cells??[])add(id);for(const bill of pack.building.bills??[])add(bill.id);}
  for(const pack of d.packed)if(pack.owner.type==='ground'||pack.owner.pawnId!==p.id)errors.push('Banishment furniture has no actual retained holder.');
 }
 return errors;
}
