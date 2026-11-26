import {ANIMATION_PREFERENCE_KEY,parseAnimationSettings} from './animation-settings';
import {CLOUD_MASK_RADIUS_KEY} from './cloud-mask';
import {DECOR_OCCLUSION_KEY,decorOcclusionEnabled} from './decor-occlusion-settings';
import {DIORAMA_PREFERENCE_KEY,dioramaEnabled} from './diorama-settings';
import {LIGHTING_PREFERENCE_KEY,parseLightingSettings} from './lighting-settings';
import {ROOM_MASK_RADIUS_KEY} from './room-mask-settings';
import {ROOM_PREFERENCE_KEY,roomEnabled} from './room-settings';
import {SHADOW_PREFERENCE_KEY,parseShadowSettings} from './shadow-settings';
import {DESIGNATION_VISIBILITY_KEY,designationMinCellPixels} from '../ui/designation-visibility';
import {ITEM_LABEL_VISIBILITY_KEY,itemLabelMinCellPixels} from '../ui/item-label-visibility';
import {GRAPHICS_STYLE_PREFERENCE_KEY,parseGraphicsStylePreferences} from '../ui3d/native-preferences';

export const TEXTURE_PREFERENCE_KEY='lisiere.presentation.textures.v1';
export const GROUND_GRASS_PREFERENCE_KEY='lisiere.presentation.ground-grass.v1';

/** A detached set of rendering values, safe to clone to an independent
 * renderer. Each parser also supplies its canonical default or migration. */
export function readColonyGraphicsPreferences(get:(key:string)=>string|null) {
  const read=(key:string)=>{try{return get(key);}catch{return null;}};
  return {
    texturesEnabled:read(TEXTURE_PREFERENCE_KEY)!=='false',
    groundGrassEnabled:read(GROUND_GRASS_PREFERENCE_KEY)!=='false',
    dioramaEnabled:dioramaEnabled(read(DIORAMA_PREFERENCE_KEY)),
    roomEnabled:roomEnabled(read(ROOM_PREFERENCE_KEY)),
    decorOcclusion:decorOcclusionEnabled(read(DECOR_OCCLUSION_KEY),read(CLOUD_MASK_RADIUS_KEY),read(ROOM_MASK_RADIUS_KEY)),
    lighting:parseLightingSettings(read(LIGHTING_PREFERENCE_KEY)),
    shadows:parseShadowSettings(read(SHADOW_PREFERENCE_KEY)),
    animation:parseAnimationSettings(read(ANIMATION_PREFERENCE_KEY)),
    style:parseGraphicsStylePreferences(read(GRAPHICS_STYLE_PREFERENCE_KEY)),
    designationMinCellPixels:designationMinCellPixels(read(DESIGNATION_VISIBILITY_KEY)),
    itemLabelMinCellPixels:itemLabelMinCellPixels(read(ITEM_LABEL_VISIBILITY_KEY)),
  };
}

export type ColonyGraphicsPreferences=ReturnType<typeof readColonyGraphicsPreferences>;
