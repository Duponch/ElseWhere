import {validatePackedFurnitureRecords} from './furniture-transfer-save.ts';
import {groupPackedMassGrams258} from './group-freight-mass-258.ts';
import type {CaravanPhysicalPawn256} from './group-animal-state-256.ts';
import type {Pawn,World} from './types.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {validBedrollBuilding256} from './bedroll-save-256.ts';
import { structureById } from './structure-navigation.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const integer=(v:unknown,min=0)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
export const BEDROLL_MASS_GRAMS_256=2500;
/** Inventory inner-building pose is not a position on the current map. The
 * actual package owner remains strictly bound to an original current member. */
export function validCaravanBedrollPacks256(value:unknown,members:readonly CaravanPhysicalPawn256[],nextId:number,version:number,tick:number=Number.MAX_SAFE_INTEGER):value is PackedFurniture[]|undefined {
 if(value===undefined)return true;
 if(version<256||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>nextId-1||Reflect.ownKeys(value).length!==value.length+1)return false;
 const owners=new Set(members.map(p=>p.id)),ids=new Set<number>();
 for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value')||!object(d.value))return false;const pack=d.value;
  if(Reflect.ownKeys(pack).length!==2||!Object.hasOwn(pack,'building')||!Object.hasOwn(pack,'owner')||!object(pack.building)||!object(pack.owner))return false;
  const b=pack.building,o=pack.owner;if((version<258?b.kind!=='bedroll'||!validBedrollBuilding256(b,version):groupPackedMassGrams258(pack as unknown as PackedFurniture,version)===undefined||validatePackedFurnitureRecords([pack as unknown as PackedFurniture],{width:1,height:1,tick,nextId},version,new Set()).length>0)||!integer(b.id,1)||Number(b.id)>=nextId||ids.has(Number(b.id))||!integer(b.x)||!integer(b.z)||Reflect.ownKeys(o).length!==2||o.type!=='inventory'||!integer(o.pawnId,1)||!owners.has(Number(o.pawnId)))return false;ids.add(Number(b.id));
 }
 return true;
}
export interface GroupBedrollDeparture256 {readonly atTick:number;readonly array:PackedFurniture[];readonly members:readonly CaravanPhysicalPawn256[];readonly packs:readonly PackedFurniture[];readonly stamps:readonly string[]}
/** Captures only packages already physically in member inventories. Ground
 * loading must use the real formation contact path before this operation. */
export function captureGroupBedrollDeparture256(w:World,members:readonly CaravanPhysicalPawn256[]):GroupBedrollDeparture256|undefined {
 if(w.schemaVersion<256||members.some(p=>'species'in p?!w.wildlife?.animals.includes(p):!w.pawns.includes(p)))return;
 const ids=new Set(members.map(p=>p.id)),packs=w.packed.filter(p=>p.owner.type==='inventory'&&ids.has(p.owner.pawnId));
 if(!validCaravanBedrollPacks256(packs,members,w.nextId,w.schemaVersion,w.tick))return;
 return {atTick:w.tick,array:w.packed,members:[...members],packs,stamps:packs.map(p=>JSON.stringify(p))};
}
export function groupBedrollDepartureCurrent256(w:World,c:GroupBedrollDeparture256):boolean {
 const ids=new Set(c.members.map(p=>p.id));return w.schemaVersion>=256&&w.tick===c.atTick&&w.packed===c.array&&c.members.every(p=>'species'in p?!!w.wildlife?.animals.includes(p):w.pawns.includes(p))&&c.packs.every((p,i)=>w.packed.includes(p)&&JSON.stringify(p)===c.stamps[i])&&w.packed.filter(p=>p.owner.type==='inventory'&&ids.has(p.owner.pawnId)).length===c.packs.length;
}
/** Invoke only inside the existing all-owner departure commit, after all
 * item/person/route preflights. No new Thing, ID or clone is created. */
export function detachGroupBedrollDeparture256(w:World,c:GroupBedrollDeparture256):PackedFurniture[] {
 if(!groupBedrollDepartureCurrent256(w,c))throw Error('Changed physical bedroll departure');const selected=new Set(c.packs);w.packed=w.packed.filter(p=>!selected.has(p));return [...c.packs];
}
/** Pure local-entry namespace preflight. Inner pose remains literal; package
 * inventory ownership follows the same actual person through entry. */
export function canReturnGroupBedrolls256(w:World,packs:readonly PackedFurniture[],members:readonly CaravanPhysicalPawn256[]):boolean {
 return w.schemaVersion>=256&&validCaravanBedrollPacks256(packs,members,w.nextId,w.schemaVersion,w.tick)&&packs.every(p=>!w.packed.some(q=>q.building.id===p.building.id)&&!(structureById(w,p.building.id)!==undefined));
}
