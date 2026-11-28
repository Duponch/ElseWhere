import type { Structure,World } from './types.ts';
import {isBarricadeMaterial382,barricadeStuff382,BARRICADE_382} from './barricade-382.ts';

const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=new Set(['id','kind','x','z','orientation','footprint','material','damage']);

/** New-content guard shared by save and bridge; full construction/material and
 * service reservations remain under the ordinary save validators. */
export function validSandbagsState(w:World,version:number):boolean {
  const shape=(s:Structure)=>s.kind==='sandbags'?version>=189&&s.material==='cloth'&&s.orientation===0&&s.footprint==='standard'
    &&Object.keys(s).every(k=>keys.has(k))&&(s.damage===undefined||integer(s.damage,1,299)):s.kind==='barricade'?version>=382&&isBarricadeMaterial382(s.material)&&s.orientation===0&&s.footprint==='standard'&&Object.keys(s).every(k=>keys.has(k))&&(s.damage===undefined||integer(s.damage,1,Math.round(BARRICADE_382.maxHp*barricadeStuff382(s.material)!.hp)-1)):true;
  for(const s of w.structures)if(!shape(s))return false;
  for(const p of w.packed??[])if(p.building.kind==='sandbags'||p.building.kind==='barricade')return false;
  for(const j of w.jobs){
    if(j.kind==='sandbags'&&(version<189||j.material!=='cloth'||j.orientation!==0||j.footprint!=='standard'))return false;
    if(j.furniture?.kind==='sandbags')return false;
    if(j.deconstruction?.kind==='sandbags'&&(version<189||j.deconstruction.material!=='cloth'||j.orientation!==0||j.footprint!=='standard'))return false;
    if(j.kind==='barricade'&&(version<382||!isBarricadeMaterial382(j.material)||j.orientation!==0||j.footprint!=='standard')||j.furniture?.kind==='barricade'||j.deconstruction?.kind==='barricade'&&(version<382||!isBarricadeMaterial382(j.deconstruction.material)||j.orientation!==0||j.footprint!=='standard'))return false;
  }
  const ledger=w.deconstructed as unknown as Record<string,unknown>|undefined;
  if(ledger===undefined)return version<24;
  if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))return false;
  const textiles=ledger.lostTextiles;
  if(Object.hasOwn(ledger,'lostTextiles')&&(version<189||!textiles||typeof textiles!=='object'||Array.isArray(textiles)||!Object.keys(textiles).length
    ||Object.entries(textiles).some(([item,n])=>item!=='cloth'&&item!=='light-leather'||!integer(n,1))))return false;
  return true;
}
