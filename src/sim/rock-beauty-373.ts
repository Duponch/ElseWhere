import {isStoneKind,type StoneKind} from './geology.ts';
import {smoothedWallBeauty367} from './smooth-wall-367.ts';
import type {Tile} from './types.ts';

/** Schema 373: the Beauty of rough natural rock walls (Core UglyRockBase and
 * its five stones, Various_Stone.xml) in the rooms they border, and the walls
 * bordering the visible room in perceived beauty (BeautyUtility). */
export const isRockBeautySchema373=(version:number):boolean=>Number.isSafeInteger(version)&&version>=373;

/** UglyRockBase statBases Beauty -2, inherited by Sandstone, Granite,
 * Limestone and Slate; Marble overrides it with -1. The ores (MineableSteel,
 * MineableSilver, ...) and CollapsedRocks derive from RockBase, which defines
 * no Beauty (StatDef Beauty defaultBaseValue 0). */
export const ROUGH_ROCK_BEAUTY_373:Readonly<Record<StoneKind,number>>=Object.freeze({granite:-2,limestone:-2,marble:-1,sandstone:-2,slate:-2});

/** A map cell as the beauty readers see it (a Tile, or the room input). */
type WallTile={terrain:string;stone?:string;ore?:string;collapsedRock?:unknown;smoothedWall367?:unknown};

/** Beauty of a rough natural rock at its cell (a full-fill building), from
 * schema 373. 0 for an ore, collapsed rocks, a smoothed wall (its own value),
 * a rock of an unknown historical stone, any other terrain, and below 373. */
export function roughRockBeauty373(tile:WallTile|undefined,version:number):number {
  if(!tile||!isRockBeautySchema373(version)||tile.terrain!=='rock'||tile.smoothedWall367!==undefined||tile.ore!==undefined||tile.collapsedRock)return 0;
  return isStoneKind(tile.stone)?ROUGH_ROCK_BEAUTY_373[tile.stone]:0;
}

/** A Beauty value as the inspector writes it (typographic minus sign). */
export const signedBeauty373=(value:number):string=>value<0?`−${-value}`:String(value);

/** Beauty of the natural rock wall at a cell: a smoothed wall (schema 367)
 * or, from schema 373, a rough rock. Below 373 a rough rock reads 0. */
export function naturalWallBeauty373(tile:WallTile,version:number):number {
  return tile.smoothedWall367?smoothedWallBeauty367(tile as Pick<Tile,'terrain'|'stone'>&{smoothedWall367?:unknown}):roughRockBeauty373(tile,version);
}
