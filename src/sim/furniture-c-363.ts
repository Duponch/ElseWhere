import type { Cell } from './types.ts';

/** Schema 363: cheap, common Core RimWorld 1.6 furniture Elsewhere lacked
 * (ThingDefs_Buildings/Buildings_Furniture.xml):
 * - Table3x3c "table (3x3)": TableGatherSpotBase, 3×3 not rotatable,
 *   costStuffCount 100 Metallic/Woody/Stony, WorkToBuild 3300, MaxHitPoints
 *   175, Beauty 2, Mass 22, Flammability 1, quality, gathering spot, eat surface.
 * - BedrollDouble "double bedroll": BedWithQualityBase, 2×2, costStuffCount 85
 *   Fabric/Leathery, WorkToBuild 1100, MaxHitPoints absent (StatDef default
 *   100), Comfort 0.68, BedRestEffectiveness 0.95, ImmunityGainSpeedFactor
 *   1.05, bed_healPerDay 4, Mass 4.5, Standable, pathCost 14, no research.
 * - DoubleSleepingSpot "double sleeping spot": SleepingSpotBase, 2×2,
 *   WorkToBuild 0 (Designator_Build places it at once), no cost, no hit
 *   points, Comfort 0.4, BedRestEffectiveness absent (valueIfMissing 0.8),
 *   SurgerySuccessChanceFactor 0.7, Standable.
 * - WallLamp "wall lamp": LampBase, rotatable, costList Steel 15, WorkToBuild
 *   330, MaxHitPoints 35, Mass 2, Standable, pathCost 0, isEdifice false,
 *   isAttachment true, Placeworker_AttachedToWall, CompPowerTrader 30 W,
 *   CompGlower glowRadius 11 colour (214,148,94), Electricity research.
 * Below 363 none of these kinds exist; every older rule, list and draw stays. */
export const FURNITURE_C_SCHEMA_363=363 as const;
export const isFurnitureCSchema363=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=FURNITURE_C_SCHEMA_363;

export const FURNITURE_C_KINDS_363=['table-large','double-bedroll','double-sleeping-spot','wall-lamp'] as const;
export type FurnitureCKind363=typeof FURNITURE_C_KINDS_363[number];
export const isFurnitureCKind363=(value:unknown):value is FurnitureCKind363=>typeof value==='string'&&(FURNITURE_C_KINDS_363 as readonly string[]).includes(value);
/** The double sleeping spot has no construction: it is placed at once, like the sleeping spot. */
export const FURNITURE_C_JOB_KINDS_363=['table-large','double-bedroll','wall-lamp'] as const;

export const TABLE_LARGE_363=Object.freeze({defName:'Table3x3c',label:'Table 3 × 3',stuff:100,coreWork:3300,maxHitPoints:175,beauty:2,mass:22,seats:12} as const);
export const DOUBLE_BEDROLL_363=Object.freeze({defName:'BedrollDouble',label:'Sac de couchage double',stuff:85,coreWork:1100,maxHitPoints:100,comfort:.68,restEffectiveness:.95,immunityFactor:1.05,healPerDay:4,mass:4.5} as const);
export const DOUBLE_SLEEPING_SPOT_363=Object.freeze({defName:'DoubleSleepingSpot',label:'Couchage au sol double',comfort:.4,restEffectiveness:.8,surgeryFactor:.7} as const);
export const WALL_LAMP_363=Object.freeze({defName:'WallLamp',label:'Applique murale',steel:15,coreWork:330,maxHitPoints:35,mass:2,power:30,glowRadius:11,red:214,green:148,blue:94} as const);

/** Table3x3c is not rotatable; an odd Core size is centred on its position
 * (GenAdj.OccupiedRect), so the anchor is the middle cell. */
export function tableLargeCells363(anchor:Cell):Cell[] {
  const cells:Cell[]=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)cells.push({x:anchor.x+dx,z:anchor.z+dz});return cells;
}
export const tableLargeContains363=(anchor:Cell,cell:Cell):boolean=>Math.abs(cell.x-anchor.x)<=1&&Math.abs(cell.z-anchor.z)<=1;

const DIRECTIONS=[[0,1],[1,0],[0,-1],[-1,0]] as const;
/** Placeworker_AttachedToWall: the lamp occupies the adjacent cell (which
 * may also hold non-full furniture) and is drawn 0.9 cell towards its wall. */
export function wallLampWallCell363(lamp:Cell&{orientation?:number}):Cell {
  const d=DIRECTIONS[(((lamp.orientation??0)%4)+4)%4]!;return {x:lamp.x+d[0],z:lamp.z+d[1]};
}
