import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Real prospective Mineable identity above the existing Tile representation.
 * Only creation/explicit removal owns these transitions; never migration. */
import type {Tile,World} from './types.ts';
import {isStoneKind,type StoneKind} from './geology.ts';
import {NATURAL_TERRAIN_DEFINITIONS_256} from './local-terrain-definitions-256.ts';
import type {LocalOre256} from './local-ore-scattering-256.ts';
import type {NaturalTerrainId256} from './local-terrain-definitions-256.ts';
export const NATURAL_MINEABLE_DEFS_256={granite:'Granite',limestone:'Limestone',marble:'Marble',sandstone:'Sandstone',slate:'Slate'} as const satisfies Record<StoneKind,string>;
export const ORE_MINEABLE_DEFS_256={steel:'MineableSteel',silver:'MineableSilver',gold:'MineableGold',uranium:'MineableUranium',plasteel:'MineablePlasteel',jade:'MineableJade',machinery:'MineableComponentsIndustrial'} as const satisfies Record<LocalOre256,string>;
export type MineableDef256=typeof NATURAL_MINEABLE_DEFS_256[StoneKind]|typeof ORE_MINEABLE_DEFS_256[LocalOre256];
export interface LocalMineableOwner256 {id:number;def:MineableDef256;terrain:NaturalTerrainId256}
export type MineableTile256=Tile&{mineable?:LocalMineableOwner256};
export type MineableWorld256=Pick<World,'width'|'height'>&{schemaVersion:number;site?:{revision:number};tiles:MineableTile256[]};
export function actualMineableDef256(tile:Pick<Tile,'stone'|'ore'>):MineableDef256|undefined {
 if(tile.ore!==undefined)return ORE_MINEABLE_DEFS_256[tile.ore];
 return tile.stone===undefined?undefined:NATURAL_MINEABLE_DEFS_256[tile.stone];
}
/** Pure target projection: no yield, RNG, roof/claims/notification mutation.
 * The caller performs its real transaction (mining/destruction/generation). */
export function removedMineableTile256(tile:MineableTile256,expectedId:number):Tile|undefined {
 const owner=tile.mineable;if(tile.terrain!=='rock'||tile.collapsedRock||!owner||!Number.isSafeInteger(owner.id)||owner.id<1||owner.id!==expectedId||!isStoneKind(tile.stone)||!Object.hasOwn(NATURAL_TERRAIN_DEFINITIONS_256,owner.terrain)||owner.def!==actualMineableDef256(tile))return undefined;
 const next:MineableTile256={...tile,terrain:owner.terrain};
 delete next.mineable;delete next.ore;delete next.miningDamage;delete next.miningYield;delete next.smoothedWall367;
 if(owner.terrain!=='rough-stone')delete next.stone;
 return next;
}
/** Generation-only preflight for ClearSpace/roads. Real positive ID only;
 * commit succeeds only while this exact original owner remains at its cell.
 * Never use this no-product Vanish as an alias for paid/player mining. */
export function planVanishMineable256(world:MineableWorld256,cell:number,expectedId:number,mapInitializing:true):{id:number;commit():void}|null {
 if(mapInitializing!==true||!isSchema256Or257(world.schemaVersion)||world.site?.revision!==3||!Number.isSafeInteger(cell)||cell<0||cell>=world.width*world.height||!Number.isSafeInteger(expectedId)||expectedId<1)return null;
 const source=world.tiles[cell],next=source&&removedMineableTile256(source,expectedId);if(!source||!next)return null;
 const owner=source.mineable!,def=owner.def,terrain=owner.terrain;
 return {id:expectedId,commit(){if(world.tiles[cell]!==source||source.mineable!==owner||owner.id!==expectedId||owner.def!==def||owner.terrain!==terrain)throw Error('Actual Mineable changed after Vanish preflight');const current=removedMineableTile256(source,expectedId);if(!current)throw Error('Actual Mineable definition changed after Vanish preflight');world.tiles[cell]=current;markTerrainCellChanged(world.tiles,cell);}};
}
/** Synchronous Vanish entry for ROOT's genuine fresh phase390 adapter.
 * Same preflight as ClearSpace, no product/RNG/clock or fake World required.
 * Caller owns creation-only admission and physical support notifications. */
export function vanishNaturalMineable256(world:MineableWorld256,cell:number,expectedId:number):boolean {
 const plan=planVanishMineable256(world,cell,expectedId,true);if(!plan)return false;plan.commit();return true;
}
