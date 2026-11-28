import {BEDROLL_TEXTILES_256,isBedrollTextile256,type BedrollTextile256} from './bedroll-textiles-256.ts';
import type { StoneKind } from './geology.ts';

export type BlockMaterial = `${StoneKind}-blocks`;
export type UpholsteryMaterial = BedrollTextile256;
export type ConstructionMaterial = 'wood' | 'steel' | 'jade' | 'silver' | 'gold' | 'plasteel' | 'uranium' | BlockMaterial | UpholsteryMaterial;
export const BLOCK_MATERIALS: readonly BlockMaterial[] = Object.freeze(['granite-blocks','limestone-blocks','marble-blocks','sandstone-blocks','slate-blocks']);
export const UPHOLSTERY_MATERIALS:readonly UpholsteryMaterial[]=Object.freeze(['cloth','light-leather']);
export const CONSTRUCTION_MATERIALS: readonly ConstructionMaterial[] = Object.freeze(['wood','steel','jade',...BLOCK_MATERIALS,...UPHOLSTERY_MATERIALS]);
export const isBlockMaterial = (value:unknown):value is BlockMaterial => typeof value==='string'&&(BLOCK_MATERIALS as readonly string[]).includes(value);
export const isUpholsteryMaterial=(value:unknown):value is UpholsteryMaterial=>isBedrollTextile256(value);
/** Core WorkToBuild is base × factor + offset, distinct from WorkToMake.
 * Only factors used by delivered gameplay belong here; HP/fire/beauty follow
 * with their actual systems, not inert statistics claiming implementation. */
export const BUILDING_MATERIALS = Object.freeze({
  ...BEDROLL_TEXTILES_256,
  jade:Object.freeze({workFactor:5,workOffset:0,restFactor:1}),
  wood:Object.freeze({workFactor:.7,workOffset:0,restFactor:1}),
  steel:Object.freeze({workFactor:1,workOffset:0,restFactor:1}),
  silver:Object.freeze({workFactor:1,workOffset:0,restFactor:1}),
  gold:Object.freeze({workFactor:.9,workOffset:0,restFactor:1}),
  plasteel:Object.freeze({workFactor:2.2,workOffset:0,restFactor:1}),
  uranium:Object.freeze({workFactor:1.9,workOffset:0,restFactor:1}),
  'granite-blocks':Object.freeze({workFactor:6,workOffset:140,restFactor:.9}),
  'limestone-blocks':Object.freeze({workFactor:6,workOffset:140,restFactor:.9}),
  'marble-blocks':Object.freeze({workFactor:5.5,workOffset:140,restFactor:.9}),
  'sandstone-blocks':Object.freeze({workFactor:5,workOffset:140,restFactor:.9}),
  'slate-blocks':Object.freeze({workFactor:6,workOffset:140,restFactor:.9}),
  cloth:Object.freeze({workFactor:1,workOffset:0,restFactor:1}),
  'light-leather':Object.freeze({workFactor:1,workOffset:0,restFactor:1}),
});
