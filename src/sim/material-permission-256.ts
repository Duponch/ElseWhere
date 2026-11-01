import {isSchema256Or257} from './schema-compatibility-257.ts';
import {isColonist} from './affiliation.ts';
import {eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import type {MaterialPile,World} from './types.ts';
type PermissionPile256=Pick<MaterialPile,'apparel'|'weapon'|'eggForbidden'>&{forbidden?:true};
/** One actual permission source per item. Existing apparel/weapon/egg fields
 * retain their historical representation; the new field serves other Things. */
export function materialAllowedForPlayer256(pile:PermissionPile256):boolean {
 return pile.forbidden!==true&&pile.eggForbidden!==true&&pile.apparel?.forbidden!==true&&pile.weapon?.forbidden!==true;
}
export function setMaterialForbidden256(pile:MaterialPile,forbidden:boolean):void {
 if(pile.apparel){if(forbidden)pile.apparel.forbidden=true;else delete pile.apparel.forbidden;return;}
 if(pile.weapon){if(forbidden)pile.weapon.forbidden=true;else delete pile.weapon.forbidden;return;}
 if(eggSpeciesForItem256(pile.item)){if(forbidden)pile.eggForbidden=true;else delete pile.eggForbidden;return;}
 if(forbidden)pile.forbidden=true;else delete pile.forbidden;
}
export function validMaterialPermission256(pile:unknown,version:number):boolean {
 if(!pile||typeof pile!=='object')return false;
 const d=Object.getOwnPropertyDescriptor(pile,'forbidden');if(!d)return !('forbidden'in pile);
 if(!isSchema256Or257(version)||!d.enumerable||!Object.hasOwn(d,'value')||d.value!==true)return false;
 for(const key of ['apparel','weapon','eggForbidden','egg'])if(Object.hasOwn(pile,key))return false;
 const item=Object.getOwnPropertyDescriptor(pile,'item');if(!item||!Object.hasOwn(item,'value')||eggSpeciesForItem256(item.value))return false;
 return true;
}
export type MaterialPermissionCommand256={type:'material-forbid';pileId:number;forbidden:boolean};
/** Shared live owner/forced guard for single-item and rectangle transactions. */
export function materialPermissionRefusal256(world:World,pile:MaterialPile,forbidden:boolean):string|undefined {
 const o=pile.owner,owned=o.type==='ground'||(o.type==='pawn'||o.type==='inventory'||o.type==='apparel'||o.type==='equipment')&&world.pawns.some(p=>p.id===o.pawnId&&isColonist(p));
 if(!owned)return 'Bien hors de portée de la colonie.';
 if(forbidden&&pile.apparel?.forced)return 'Retirer la protection du vêtement porté avant de l’interdire.';
 return undefined;
}
/** A player's actual ground/carried Thing. Birth holders cannot be unlocked
 * through an invented ground location or a projection of their contents. */
export function applyMaterialPermission256(world:World,command:MaterialPermissionCommand256):{ok:true}|{ok:false;reason:string} {
 if(!command||typeof command!=='object'||Reflect.ownKeys(command).length!==3||Reflect.ownKeys(command).some(k=>typeof k!=='string'||!['type','pileId','forbidden'].includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(command,k)!,'value')||!Object.getOwnPropertyDescriptor(command,k)!.enumerable))return {ok:false,reason:'Réglage de bien invalide.'};
 if(command.type!=='material-forbid'||!isSchema256Or257(world.schemaVersion)||!Number.isSafeInteger(command.pileId)||typeof command.forbidden!=='boolean')return {ok:false,reason:'Réglage de bien invalide.'};
 const pile=world.piles.find(p=>p.id===command.pileId);if(!pile)return {ok:false,reason:'Bien indisponible.'};
 const reason=materialPermissionRefusal256(world,pile,command.forbidden);if(reason)return {ok:false,reason};
 setMaterialForbidden256(pile,command.forbidden);return {ok:true};
}
