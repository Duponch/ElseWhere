import {structureFamily379} from './structure-family-379.ts';
import { footprintCells,footprintContains,STRUCTURE_DEFINITIONS } from './definitions.ts';
import { isPowerActive } from './power-rules.ts';
import type { ThermalLayout } from './thermal-topology.ts';
import type { Cell,CommandResult,Orientation,Structure,World } from './types.ts';

export interface CoolerState {target:number;high:boolean}
export const newCoolerState=():CoolerState=>({target:21,high:false});
/** Orientation 0 faces south (+z), shared with furniture and the 3D preview. */
export function coolerFaces(s:Cell&{orientation?:Orientation}):{cold:Cell;hot:Cell} {
  const [x,z]=[[0,1],[1,0],[0,-1],[-1,0]][s.orientation??0]!;
  return {cold:{x:s.x+x!,z:s.z+z!},hot:{x:s.x-x!,z:s.z-z!}};
}
export function coolerFaceBlocked(w:World,c:Cell,plans=false):boolean {
  if(!Number.isInteger(c.x)||!Number.isInteger(c.z)||c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)return true;
  if(w.tiles[c.z*w.width+c.x]!.terrain==='rock')return true;
  const solid=(s:{kind:string})=>s.kind in STRUCTURE_DEFINITIONS&&STRUCTURE_DEFINITIONS[s.kind as keyof typeof STRUCTURE_DEFINITIONS].blocksMovement;
  return w.structures.some(s=>solid(s)&&footprintContains(s,c))||plans&&w.jobs.some(s=>solid(s)&&footprintContains(s,c));
}
export function setCoolerTarget(w:World,id:number,target:number):CommandResult {
  const s=w.structures.find(s=>s.id===id&&s.kind==='cooler');
  if(!s?.cooler||!Number.isFinite(target)||target < -273.15||target>1000)return {ok:false,code:'invalid-command',reason:'Climatiseur ou température cible invalide.'};
  s.cooler.target=target;return {ok:true};
}
/** Relative clicks are resolved on the worker, never from a delayed UI snapshot. */
export function adjustCoolerTarget(w:World,id:number,offset:unknown):CommandResult {
  const s=w.structures.find(s=>s.id===id&&s.kind==='cooler');
  if(!s?.cooler||offset!==null&&(typeof offset!=='number'||![-10,-1,1,10].includes(offset)))return {ok:false,code:'invalid-command',reason:'Réglage de thermostat invalide.'};
  return setCoolerTarget(w,id,offset===null?21:Math.max(-273.15,Math.min(1000,s.cooler.target+Number(offset))));
}
/** Continuous integration like our other heat sources, in 10-Core-tick steps.
 * Exhaust uses the requested energy even on the step clamped by the thermostat.
 * No region => outdoor reservoir. A closed door is not an impassable face. */
export function advanceCoolers(w:World,layout:ThermalLayout,outside:number):void {
  const regions=w.thermal?.regions??[];
  // One synchronous thermal step only changes cooler mode and room air. Its
  // structure footprints stay fixed, so all powered coolers can share this
  // short-lived capture without retaining geometry across world mutations.
  let solids:Set<number>|undefined;
  const faceBlocked=(c:Cell):boolean=>{
    if(!Number.isInteger(c.x)||!Number.isInteger(c.z)||c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)return true;
    const index=c.z*w.width+c.x;
    if(w.tiles[index]!.terrain==='rock')return true;
    if(!solids){
      solids=new Set<number>();
      for(const structure of w.structures)if(STRUCTURE_DEFINITIONS[structure.kind].blocksMovement)
        for(const cell of footprintCells(structure))solids.add(cell.z*w.width+cell.x);
    }
    return solids.has(index);
  };
  for(const s of structureFamily379(w,'coolers',kind=>kind==='cooler')){
    if(s.kind!=='cooler'||!s.cooler)continue;
    s.cooler.high=false;if(!isPowerActive(s))continue;
    const {cold,hot}=coolerFaces(s);
    if(faceBlocked(cold)||faceBlocked(hot))continue;
    const a=regions[layout.indices[cold.z*w.width+cold.x]!],b=regions[layout.indices[hot.z*w.width+hot.x]!];
    const coldT=a?.temperature??outside,hotT=b?.temperature??outside;
    const energy=21/6*Math.max(0,1-Math.max(hotT-coldT,hotT-40)/130);
    // Outdoor cells cannot retain controlled air, including the cold face.
    if(!a||coldT<=s.cooler.target||energy===0)continue;
    a.temperature=Math.max(s.cooler.target,coldT-energy/a.cells.length);
    if(b)b.temperature=Math.min(1000,b.temperature+energy*1.25/b.cells.length);
    s.cooler.high=true;
  }
}
export function validateCoolers(w:World,version:number):string[]{
  const errors:string[]=[];
  for(const s of [...w.structures,...(w.packed??[]).map(p=>p.building),...w.jobs]){
    const c=(s as Structure).cooler;
    if(s.kind!=='cooler'||'status' in s){if(c!==undefined)errors.push('Unexpected cooler state.');continue;}
    if(version<75||!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['target','high'].includes(k))||!Number.isFinite(c.target)||c.target < -273.15||c.target>1000||typeof c.high!=='boolean')errors.push('Invalid cooler state.');
  }return errors;
}
