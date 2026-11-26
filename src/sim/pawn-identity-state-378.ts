import type {Pawn,MaterialPile} from './types.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {schemaAtLeast} from './schema-range.ts';

/** Prospective edits only: loading an old name never invents its components. */
export interface PawnIdentity378 {revision:1;title?:string;banishedAt?:number}
/** A real departed original on an adapted map without a geographic WorldPawn
 * owner. This frozen archive owns the complete body and each retained item. */
export interface BanishDeparture378 {tick:number;mapId:number;pawn:Pawn;items:MaterialPile[];packed:PackedFurniture[]}
export type PawnIdentityCommand378=
 |{type:'pawn-rename';pawnId:number;nick:string;title:string}
 |{type:'pawn-banish';pawnId:number};
export const validPawnNameInput378=(v:unknown,max=16):v is string=>typeof v==='string'&&v.length<=max&&/^[\p{L}0-9 '\-.]*$/u.test(v);
const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
/** Raw field gate shared by EVERY actual owner; own-undefined is not absence. */
export function validPawnIdentity378(raw:unknown,version:number,clock:number):boolean {
 if(!raw||typeof raw!=='object')return false;
 const d=Object.getOwnPropertyDescriptor(raw,'identity378');if(!d)return !('identity378'in raw);
 if(!schemaAtLeast(378)(version)||!d.enumerable||!Object.hasOwn(d,'value')||!data(d.value))return false;
 const v=d.value;
 return v.revision===1&&Object.keys(v).length>=2&&Object.keys(v).every(k=>['revision','title','banishedAt'].includes(k))
  &&(!Object.hasOwn(v,'title')||validPawnNameInput378(v.title)&&v.title!=='')
  &&(!Object.hasOwn(v,'banishedAt')||Number.isSafeInteger(v.banishedAt)&&Number(v.banishedAt)>=0&&Number(v.banishedAt)<=clock);
}
