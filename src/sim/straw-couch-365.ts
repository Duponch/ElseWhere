import type { Cell } from './types.ts';

/** Schema 365: Core RimWorld 1.6 straw matting and couch.
 *
 * TerrainDefs/Terrain_Floors.xml StrawMatting (FloorBase): costList Hay 2,
 * WorkToBuild 120, Beauty -1, Cleanliness -0.1, FilthMultiplier 0.05,
 * Flammability 1.5, pathCost 1, no research, no constructionSkill, burnedDef
 * BurnedStrawMatting (Terrain_Floors_Burned.xml, BurnedFloorBase: Beauty -6,
 * pathCost 1). BuildableDef.resourcesFractionWhenDeconstructed 0.5
 * (GenLeaving.DoLeavingsFor(TerrainDef): RoundRandom(2 * 0.5) = 1 hay).
 * FilthMaker.CanMakeFilth: a new filth on a terrain whose FilthMultiplier is
 * below 1 is refused when Rand.Value > multiplier, unless the filth def sets
 * ignoreFilthMultiplierStat or a Natural placement mask.
 *
 * ThingDefs_Buildings/Buildings_Furniture.xml Couch
 * (FurnitureWithQualityBase): size (2,1), defaultPlacingRot South,
 * costStuffCount 200 Fabric/Leathery, WorkToBuild 20000, MaxHitPoints 160,
 * Mass 70, Flammability 1, Beauty 8, Comfort 0.85, pathCost 30, fillPercent
 * 0.4, constructionSkillPrerequisite 5, research ComplexFurniture,
 * isSittable and multiSittable (each of its two cells is a seat), quality,
 * minifiable (FurnitureBase MinifiedThing).
 * Below 365 neither exists; every older rule, list and random draw stays. */
export const STRAW_COUCH_SCHEMA_365=365 as const;
export const isStrawCouchSchema365=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=STRAW_COUCH_SCHEMA_365;

export const STRAW_MATTING_365=Object.freeze({defName:'StrawMatting',label:'Natte de paille',hay:2,coreWork:120,beauty:-1,cleanliness:-.1,filthMultiplier:.05,flammability:1.5,pathCost:1} as const);
export const BURNED_STRAW_MATTING_365=Object.freeze({defName:'BurnedStrawMatting',label:'Natte de paille brûlée',beauty:-6,pathCost:1} as const);
export const STRAW_FLOORS_365=['straw-matting','burned-straw-matting'] as const;
export type StrawFloor365=typeof STRAW_FLOORS_365[number];
export const isStrawFloor365=(v:unknown):v is StrawFloor365=>v==='straw-matting'||v==='burned-straw-matting';

export const COUCH_365=Object.freeze({defName:'Couch',label:'Canapé',stuff:200,coreWork:20000,maxHitPoints:160,mass:70,flammability:1,beauty:8,comfort:.85,constructionSkill:5,seats:2,pathCost:30,fillPercent:.4} as const);
export type CouchKind365='couch';
export const isCouchKind365=(v:unknown):v is CouchKind365=>v==='couch';

/** Core FilthMaker.CanMakeFilth: the filth defs Elsewhere deposits whose Core
 * def honours FilthMultiplier (no ignoreFilthMultiplierStat, no Natural mask):
 * Filth_Dirt, Filth_Trash, Filth_RubbleRock, Filth_RubbleBuilding,
 * Filth_Slime. Blood, ash, vomit, corpse bile and firefoam ignore it. */
export const filthHonoursMultiplier365=(kind:string):boolean=>kind==='dirt'||kind==='trash'||kind==='rock-rubble'||kind==='building-rubble'||kind==='slime';

/** Core Couch occupies (2,1): rotated like the tool cabinet, its second cell
 * lies to the side of the facing direction. Each cell is a seat. */
const DIRECTIONS=[[0,1],[1,0],[0,-1],[-1,0]] as const;
export function couchCells365(couch:Cell&{orientation?:number}):Cell[] {
  const d=DIRECTIONS[((couch.orientation??0)+1)%4]!;return [{x:couch.x,z:couch.z},{x:couch.x+d[0],z:couch.z+d[1]}];
}
export const couchContains365=(couch:Cell&{orientation?:number},cell:Cell):boolean=>{
  if(cell.x===couch.x&&cell.z===couch.z)return true;const d=DIRECTIONS[((couch.orientation??0)+1)%4]!;return cell.x===couch.x+d[0]&&cell.z===couch.z+d[1];
};
