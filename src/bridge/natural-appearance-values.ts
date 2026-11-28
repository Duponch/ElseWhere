import {plantGrowth} from '../sim/plants';
import type {Resource,World} from '../sim/types';

/** Shared literal presentation values. No geometry, DOM or Three dependency. */
export const RESIDENT_CROP_KINDS=['rice','potato','corn','cotton','haygrass','hops','devilstrand'] as const;
export type ResidentCropKind=typeof RESIDENT_CROP_KINDS[number];
export const isResidentCrop=(r:Pick<Resource,'kind'>):boolean=>(RESIDENT_CROP_KINDS as readonly string[]).includes(r.kind);
export const isMedicinalPlant=(r:Pick<Resource,'kind'|'species'>):boolean=>r.kind==='healroot'||r.species==='healroot-wild';
/** The original four visible steps, with the original arithmetic order. */
export const floraSize=(world:World,r:Resource,readGrowth?:()=>number):number=>!r.species&&!isMedicinalPlant(r)&&r.kind!=='tinctoria'?1:(r.growth??1)===1?1:.3+.7*Math.ceil((readGrowth?readGrowth():plantGrowth(world,r))*4)/4;

export interface NaturalVisualUpsert {
  readonly id:number;
  /** Ordinal in this publication's complete resource collection. */
  readonly ordinal:number;
  readonly size:number;
  /** Historical berry-only shape flag. */
  readonly ripe:boolean;
  readonly leafless:boolean;
  /** Literal public harvestability, also for non-berry natural plants. */
  readonly harvestable:boolean;
}
export interface NaturalVisualDelta {
  readonly epoch:number;
  readonly revision:number;
  /** Omitted on a complete checkpoint, present on an adjacent delta. */
  readonly baseRevision?:number;
  readonly tick:number;
  readonly checkpoint:boolean;
  readonly upsert:readonly NaturalVisualUpsert[];
  readonly removed:readonly number[];
  /** Exact crop stream at this same publication boundary, with separate pages. */
  readonly crops?:CropVisualDelta;
}
/** The current producer always sends the extension. Its absence is the old
 * closed V430/V2 form, which grants no prepared-crop capability. */
export interface CropNaturalVisualDelta extends NaturalVisualDelta {readonly crops:CropVisualDelta}
export interface TypedCropNaturalVisualDelta extends NaturalVisualDelta {readonly crops:TypedCropVisualDelta}
export interface CropVisualUpsert {
 readonly id:number;readonly ordinal:number;readonly growth:number;
 readonly leafless:boolean;readonly blighted:boolean;readonly supported:boolean;
}
export interface ObjectCropVisualDelta {readonly upsert:readonly CropVisualUpsert[];readonly removed:readonly number[]}
export interface TypedCropVisualDelta {
 readonly format:'columns-v1';readonly ids:Float64Array;readonly ordinals:Uint32Array;
 readonly growth:Float64Array;readonly flags:Uint8Array;readonly removed:Float64Array;
}
export type CropVisualDelta=ObjectCropVisualDelta|TypedCropVisualDelta;
