import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import type {WorldPawnOwner256} from './world-pawn-state-256.ts';
import type {MaterialPile} from './types.ts';
import {isPerishable,rotAge,ROT_DAYS} from './food-preservation.ts';
import {TICKS_PER_DAY} from './types.ts';
/** Stable own physical suspension receipt; never the advancing row or root clock. */
export function worldPawnGoodsCore297(row:WorldPawnOwner256,version:number):number {
 const held=row.heldAtCore259;if(!Number.isSafeInteger(version)||version<1||version>299||!Number.isSafeInteger(held)||held!<0||held!%10)return NaN;
 if(!('heldGoodsCore297'in row))return held!;
 const d=Object.getOwnPropertyDescriptor(row,'heldGoodsCore297');return isCorePhysicalSchema297(version)&&!!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&typeof d.value==='number'&&Number.isSafeInteger(d.value)&&d.value>=held!&&d.value<=held!+9?d.value:NaN;
}
/** No active WorldObject owns these retained inventory comps. Seal once at
 * the TRUE transfer, preserving every Thing/holder/quantity and old receipt. */
export function suspendWorldPawnGoods259(row:WorldPawnOwner256,atCore:number,version=259,physicalCore297?:number):void {
 if(!row.items.length&&!row.packed.length)return;
 if(!isCorePhysicalSchema297(version)&&'heldGoodsCore297'in row)throw Error('Future retained goods clock before297');
 if(physicalCore297!==undefined&&(!isCorePhysicalSchema297(version)||!Number.isSafeInteger(physicalCore297)||Math.floor(physicalCore297/10)*10!==atCore))throw Error('Invalid actual owned retained-goods physical capture');
 if(!Number.isSafeInteger(atCore)||atCore<0||atCore%10)throw Error('Invalid actual held suspension frontier');
 row.heldAtCore259=atCore;if(isCorePhysicalSchema297(version)&&physicalCore297!==undefined)row.heldGoodsCore297=physicalCore297;
 for(const p of row.items)if(isPerishable(p.item)&&p.rot)p.rot={progress:rotAge(p,atCore/10),atTick:atCore/10,rate:0};
}
/** Checks one real suspended holder; no trial tick, ambient temperature,
 * frame-derived state or date normalization is part of this guard. */
export function validSuspendedWorldPawnGoods259(row:WorldPawnOwner256,atCore:number,version=259):boolean {
 if(!row.items.length&&!row.packed.length)return row.heldAtCore259===undefined&&!('heldGoodsCore297'in row);
 if(!isCorePhysicalSchema297(version)&&'heldGoodsCore297'in row)return false;
 if(isCorePhysicalSchema297(version)){const core=worldPawnGoodsCore297(row,version);if(!Number.isSafeInteger(core)||core>atCore)return false;}
 const held=row.heldAtCore259;if(!Number.isSafeInteger(held)||held!<0||held!%10||held!>atCore)return false;
 return row.items.every((p:MaterialPile)=>!isPerishable(p.item)||!!p.rot&&p.rot.rate===0&&p.rot.atTick===held!/10&&Number.isFinite(p.rot.progress)&&p.rot.progress>=0&&p.rot.progress<ROT_DAYS[p.item]*TICKS_PER_DAY);
}
