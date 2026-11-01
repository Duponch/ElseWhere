import {isActualView301,type ActualView301} from '../sim/actual-view-301.ts';
export interface ActualViewRequest301 {type:'actual-view-301';epoch:number;view:ActualView301|null}
/** Read no getter and accept no inherited/extra field, id or World command. */
export function isActualViewRequest301(value:unknown):value is ActualViewRequest301 {
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==3)return false;
 for(const key of ['type','epoch','view']){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return false;}
 const r=value as ActualViewRequest301;
 return r.type==='actual-view-301'&&Number.isSafeInteger(r.epoch)&&r.epoch>=1&&(r.view===null||isActualView301(r.view));
}
/** Immutable-key order: comparisons never depend on input property order. */
export function actualViewKey301(epoch:number,view:ActualView301|null):string {return view===null?epoch+':off':[epoch,view.mapId,view.minX,view.minZ,view.maxX,view.maxZ,view.zoomBand].join(':');}
