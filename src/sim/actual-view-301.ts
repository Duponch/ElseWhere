import type {Pawn,World} from './types.ts';
import {MAX_EXTENDED_MAP_SIZE} from './map-config.ts';
import type {CampaignState} from './world-map-state.ts';
import {boundWorldGroup,registeredCampaign,registeredMapId} from './world-map-context.ts';

export interface ActualView301 {readonly mapId:number;readonly minX:number;readonly minZ:number;readonly maxX:number;readonly maxZ:number;readonly zoomBand:0|1|2|3|4}
const views=new WeakMap<CampaignState,Readonly<ActualView301>>();
const keys=['mapId','minX','minZ','maxX','maxZ','zoomBand'] as const;
/** Closed own-data shape, bounded independently of any map or World. */
export function isActualView301(value:unknown):value is ActualView301 {
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length)return false;
 const data=value as Record<string,unknown>;
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='number'||!Number.isSafeInteger(d.value))return false;}
 return Number(data.mapId)>=0&&Number(data.mapId)<=0x7fffffff&&Number(data.minX)>=0&&Number(data.minZ)>=0&&Number(data.maxX)<MAX_EXTENDED_MAP_SIZE&&Number(data.maxZ)<MAX_EXTENDED_MAP_SIZE&&Number(data.maxX)>=Number(data.minX)&&Number(data.maxZ)>=Number(data.minZ)&&Number(data.zoomBand)>=0&&Number(data.zoomBand)<=4;
}
/** Never installs properties on the World. Cleared views are headless; invalid input is refused. */
export function setActualView301(input:CampaignState,view:ActualView301|null):boolean {
 const root=registeredCampaign(input);
 if(view===null){views.delete(root);return true;}
 if(!isActualView301(view))return false;
 const maps=root.worldMaps,local=root as World;
 const selected=maps?maps.selectedMapId:registeredMapId(local),width=maps?.mapSize.width??local.width,height=maps?.mapSize.height??local.height;
 if(view.mapId!==selected||maps&&!maps.sites.some(s=>s.id===view.mapId)||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||view.maxX>=width||view.maxZ>=height)return false;
 views.set(root,Object.freeze({...view}));return true;
}
/** One own pawn cell, no pile/map/census scans and no presentation interpolation. */
export function rateForPawn301(world:World,pawn:Pick<Pawn,'x'|'z'>):number {
 const root=registeredCampaign(world),view=views.get(root);
 if(!view||boundWorldGroup(world)||registeredMapId(world)!==view.mapId||root.worldMaps&&root.worldMaps.selectedMapId!==view.mapId)return 15;
 return pawn.x>=view.minX&&pawn.x<=view.maxX&&pawn.z>=view.minZ&&pawn.z<=view.maxZ?view.zoomBand+1:15;
}
