import { resourceAt } from './farming.ts';
import {structureFamily379} from './structure-family-379.ts';
import { WindObstructionView,windClearance,windPowerOutput } from './wind-rules.ts';
import type { Cell,CommandResult,World } from './types.ts';

export interface WindState {revision:1;seed:number;originTick:number}
export interface WindTurbineState {autoCut:boolean;updateCounter:number;cachedWatts:number}
export const newWindState=(seed:number,tick=0):WindState=>({revision:1,seed:seed>>>0,originTick:tick});
export const newWindTurbineState=():WindTurbineState=>({autoCut:false,updateCounter:0,cachedWatts:0});
export function adoptWind(w:World):void {if(!w.wind)w.wind=newWindState(w.seed,w.tick);}
export function setWindAutoCut(w:World,id:number,enabled:unknown):CommandResult {
  const s=w.structures.find(s=>s.id===id&&s.kind==='wind-turbine');
  if(!s?.wind||typeof enabled!=='boolean')return {ok:false,code:'invalid-command',reason:'Éolienne ou coupe automatique invalide.'};
  s.wind.autoCut=enabled;return {ok:true};
}
/** The callback makes ordinary physical chop designations. It may change jobs,
 * never trees; clearance is not improved until their real removal. */
export function advanceWind(w:World,designateChop:(cell:Cell)=>void):void {
  let obstacles:WindObstructionView|undefined;
  for(const s of structureFamily379(w,'wind-turbines',kind=>kind==='wind-turbine')){
    const state=s.wind;if(s.kind!=='wind-turbine'||!state)continue;
    if(!s.power?.on){state.cachedWatts=0;}
    else if(++state.updateCounter>=25){state.updateCounter=0;obstacles??=new WindObstructionView(w);state.cachedWatts=Math.round(windPowerOutput(w,s,obstacles));}
    if(!state.autoCut||(w.tick+s.id)%200!==0)continue;
    for(const cell of windClearance(s)){
      if(cell.x<0||cell.z<0||cell.x>=w.width||cell.z>=w.height)continue;
      const tree=resourceAt(w,cell.z*w.width+cell.x);
      if(tree?.kind==='tree'&&!w.jobs.some(j=>j.x===cell.x&&j.z===cell.z&&j.kind==='chop'))designateChop(cell);
    }
  }
}
export function validateWind(w:World,version:number):string[]{
  const errors:string[]=[],state=w.wind;
  if(state!==undefined&&(version<87||!state||typeof state!=='object'||Array.isArray(state)||Object.keys(state).some(k=>!['revision','seed','originTick'].includes(k))||state.revision!==1||!Number.isSafeInteger(state.seed)||state.seed<0||state.seed>0xffffffff||!Number.isSafeInteger(state.originTick)||state.originTick<0||state.originTick>w.tick))errors.push('Invalid shared wind state.');
  for(const s of [...w.structures,...(w.packed??[]).map(p=>p.building),...w.jobs]){
    const v='wind' in s?s.wind:undefined;
    if(s.kind!=='wind-turbine'||'status' in s){if(v!==undefined)errors.push('Unexpected turbine state.');continue;}
    if(version<87||!state||!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['autoCut','updateCounter','cachedWatts'].includes(k))||typeof v.autoCut!=='boolean'||!Number.isSafeInteger(v.updateCounter)||v.updateCounter<0||v.updateCounter>=25||!Number.isSafeInteger(v.cachedWatts)||v.cachedWatts<0||v.cachedWatts>3450)errors.push('Invalid wind turbine state.');
  }return errors;
}
