import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {pileById} from './pile-identity-directory.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {isColonist} from './affiliation.ts';
import {eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import type {MaterialPile,World} from './types.ts';
export const EMPTY_EGG_CONDITION_256=Object.freeze({});
export type EggPermissionCommand256={type:'egg-forbid';pileId:number;forbidden:boolean};
/** Permission is independent of owner, fertilization, damage and quantity. */
export const eggAllowedForPlayer256=(pile:Pick<MaterialPile,'eggForbidden'|'forbidden'|'apparel'|'weapon'>):boolean=>materialAllowedForPlayer256(pile);
export function applyEggPermission256(world:World,command:EggPermissionCommand256):{ok:true}|{ok:false;reason:string} {
 const pile=pileById(world,command.pileId);
 if(world.schemaVersion<256||typeof command.forbidden!=='boolean'||!pile||!eggSpeciesForItem256(pile.item))return {ok:false,reason:'Œuf indisponible.'};

 const owner=pile.owner;
 const owned=owner.type==='ground'||(owner.type==='pawn'||owner.type==='inventory')&&world.pawns.some(p=>p.id===owner.pawnId&&isColonist(p));
 if(!owned)return {ok:false,reason:'Œuf hors de portée de la colonie.'};
 if(command.forbidden)markPileContentWrite379(pile).eggForbidden=true;else delete markPileContentWrite379(pile).eggForbidden;
 return {ok:true};
}
/** Unequal permissions remain separate; only the destination owns parents. */
export function canMergeEggPile256(a:Pick<MaterialPile,'egg'|'eggForbidden'>,b:Pick<MaterialPile,'egg'|'eggForbidden'>):boolean {
 return a.eggForbidden===b.eggForbidden&&(!a.egg&&!b.egg||!!a.egg&&!!b.egg&&a.egg.atTick===b.egg.atTick&&(a.egg.temperatureDamage>=1)===(b.egg.temperatureDamage>=1));
}
