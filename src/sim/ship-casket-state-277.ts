import {SCHEMA_VERSION} from './types.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {heldCore297,validationCore297,type PhaseWorld297} from './core-phase-297.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import type {MaterialPile,Pawn,Structure} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Mechanoid} from './mechanoid-state.ts';
import type {PackedFurniture} from './furniture-rules.ts';

export type ShipCasketPatient277={kind:'human'|'animal'|'mechanical';id:number};
export type ShipCasketOccupant277={kind:'human';pawn:Pawn}|{kind:'animal';animal:WildAnimal}|{kind:'mechanical';mech:Mechanoid};
/** One actual original and its possessions. This distinct holder never
 * widens the ordinary271 casket's admission or opening contract. */
export interface ShipCasketHolder277 {revision:1;heldAt:number;heldAtCore297?:number;occupant:ShipCasketOccupant277|null;items:MaterialPile[];packed:PackedFurniture[]}
export type ShipCasket277=Omit<Structure,'kind'>&{kind:'ship-cryptosleep-casket';shipCryptosleep277:ShipCasketHolder277};
export type ShipCasketCommand277=
 |{type:'order-enter-ship-casket';pawnId:number;casketId:number}
 |{type:'order-carry-ship-casket';pawnId:number;patient:ShipCasketPatient277;casketId:number}
 |{type:'eject-ship-casket';casketId:number};
export interface ShipCasketTask277 {casketId:number;action:'enter'|'carry';phase:'approach'|'carry'|'closing';patient?:ShipCasketPatient277;progressCore:number;lastWorkedAt:number}
export const SHIP_CASKET_ENTER_CORE_277=500;
export const newShipCasketHolder277=(tick:number):ShipCasketHolder277=>{
 if(!Number.isSafeInteger(tick)||tick<0)throw Error('Invalid actual spatial casket construction tick');
 return {revision:1,heldAt:tick,occupant:null,items:[],packed:[]};
};
const descriptor=(v:object,k:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export const isShipCasket277=(v:unknown):v is ShipCasket277=>!!v&&typeof v==='object'&&descriptor(v,'kind')?.value==='ship-cryptosleep-casket';
export function shipCasketActor277(h:ShipCasketHolder277):Pawn|WildAnimal|Mechanoid|null {
 const o=h.occupant;return o===null?null:o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech;
}
export const shipCasketOccupantId277=(h:ShipCasketHolder277):number|null=>shipCasketActor277(h)?.id??null;
/** Reference resolution only; this never registers a second owner or makes
 * an unspawned occupant available for physical work or combat. */
export function findShipCasketActor277(w:{structures:readonly unknown[]},patient:ShipCasketPatient277):Pawn|WildAnimal|Mechanoid|undefined {
 for(const s of w.structures)if(isShipCasket277(s)){
  const h=s.shipCryptosleep277;if(h.occupant?.kind===patient.kind){const actor=shipCasketActor277(h);if(actor?.id===patient.id)return actor;}
 }
}

function actualData277(value:unknown):boolean {
 let budget=150000;const active=new Set<object>();
 const walk=(v:unknown,depth:number):boolean=>{
  if(--budget<0||depth>24)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);if(typeof v!=='object'||active.has(v))return false;
  const array=Array.isArray(v);if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))return false;
  const keys=Reflect.ownKeys(v);if(array&&keys.length!==v.length+1)return false;active.add(v);
  for(const key of keys){
   const d=Object.getOwnPropertyDescriptor(v,key);
   if(typeof key!=='string'||!d||!Object.hasOwn(d,'value')||!d.enumerable&&!(array&&key==='length'))return false;
   if(array&&key==='length')continue;
   if(array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=v.length)||!walk(d.value,depth+1))return false;
  }
  active.delete(v);return true;
 };return walk(value,0);
}
/** Sparse descriptor-first field boundary. The owner guard owns complete
 * actors, clocks, namespace, bed bindings and personal possessions. */
export function validShipCasketField277(v:unknown,version:number,tick:number,coreNow297?:number):boolean {
 if(!plain(v)||!integer(version,1,SCHEMA_VERSION)||!integer(tick))return false;
 const kind=descriptor(v,'kind');if('kind'in v&&!kind)return false;
 if(kind?.value!=='ship-cryptosleep-casket')return !('shipCryptosleep277'in v);
 const field=descriptor(v,'shipCryptosleep277');
 if(!isSchema277OrLater(version)||!field||!actualData277(field.value)||!plain(field.value))return false;
 const h=field.value;
 if(Reflect.ownKeys(h).length!==5+(isCorePhysicalSchema297(version)&&Object.hasOwn(h,'heldAtCore297')?1:0)||!Number.isSafeInteger(heldCore297(h,version,Number(h.heldAt)))||('heldAtCore297'in h&&(h.occupant===null||heldCore297(h,version,Number(h.heldAt))>validationCore297(version,tick,coreNow297)||!Number.isSafeInteger(validationCore297(version,tick,coreNow297))))||!['revision','heldAt','occupant','items','packed'].every(k=>descriptor(h,k))||h.revision!==1||!integer(h.heldAt,0,tick)
  ||!Array.isArray(h.items)||h.items.length>32768||!Array.isArray(h.packed)||h.packed.length>32768)return false;
 if(h.occupant===null)return h.items.length===0&&h.packed.length===0;
 const o=h.occupant;if(!plain(o)||Reflect.ownKeys(o).length!==2)return false;
 const tag=descriptor(o,'kind')?.value,key=tag==='human'?'pawn':tag==='animal'?'animal':tag==='mechanical'?'mech':undefined;
 return key!==undefined&&!!descriptor(o,key)&&plain(o[key])&&(tag!=='mechanical'||h.items.length===0&&h.packed.length===0);
}
export function captureShipCasketHumans277(w:{schemaVersion:number;tick:number;phaseCore297?:number;structures:readonly unknown[]}) {
 const rows:{pawn:Pawn;kind:'ship-casket';simulation:'frozen';place:{kind:'ship-casket';casketId:number};validationTick:number;items:readonly MaterialPile[];packed:readonly PackedFurniture[]}[]=[];
 for(const s of w.structures){if(!isShipCasket277(s)&&!(s&&typeof s==='object'&&'shipCryptosleep277'in s))continue;
  if(!validShipCasketField277(s,w.schemaVersion,w.tick,isCorePhysicalSchema297(w.schemaVersion)?w.tick*10+Number(w.phaseCore297):undefined))throw Error('Invalid actual spatial casket before human capture');
  const c=s as ShipCasket277,h=c.shipCryptosleep277;if(h.occupant?.kind==='human')rows.push({pawn:h.occupant.pawn,kind:'ship-casket',simulation:'frozen',place:{kind:'ship-casket',casketId:c.id},validationTick:h.heldAt,items:h.items,packed:h.packed});
 }return rows;
}
export function captureShipCasketAnimals277(w:{schemaVersion:number;tick:number;phaseCore297?:number;structures:readonly unknown[]}) {
 const rows:{animal:WildAnimal;casket:ShipCasket277;validationTick:number;items:readonly MaterialPile[];packed:readonly PackedFurniture[]}[]=[];
 for(const s of w.structures){if(!isShipCasket277(s)&&!(s&&typeof s==='object'&&'shipCryptosleep277'in s))continue;
  if(!validShipCasketField277(s,w.schemaVersion,w.tick,isCorePhysicalSchema297(w.schemaVersion)?w.tick*10+Number(w.phaseCore297):undefined))throw Error('Invalid actual spatial casket before animal capture');
  const c=s as ShipCasket277,h=c.shipCryptosleep277;if(h.occupant?.kind==='animal')rows.push({animal:h.occupant.animal,casket:c,validationTick:h.heldAt,items:h.items,packed:h.packed});
 }return rows;
}

export function captureShipCasketMechanoids277(w:{schemaVersion:number;tick:number;phaseCore297?:number;structures:readonly unknown[]}) {
 const rows:{mech:Mechanoid;casket:ShipCasket277;validationTick:number}[]=[];for(const s of w.structures){if(!isShipCasket277(s)&&!(s&&typeof s==='object'&&'shipCryptosleep277'in s))continue;if(!validShipCasketField277(s,w.schemaVersion,w.tick,isCorePhysicalSchema297(w.schemaVersion)?w.tick*10+Number(w.phaseCore297):undefined))throw Error('Invalid actual spatial casket before mechanical capture');const c=s as ShipCasket277,h=c.shipCryptosleep277;if(h.occupant?.kind==='mechanical')rows.push({mech:h.occupant.mech,casket:c,validationTick:h.heldAt});}return rows;
}
