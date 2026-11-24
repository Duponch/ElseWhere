import type {Cell,World} from '../sim/types';
import {isCarpetFloor355,type CarpetFloor355} from '../sim/carpet-355';
import {architectToolAvailable} from './architect-availability';
import {knownPosition256} from './exploration-readers-256';

/** Core's ordered pause/normal/fast/superfast controls, translated to the
 * existing Elsewhere speed multipliers. No new clock mode is introduced. */
export function stepGameSpeed(current:number,direction:-1|1):number {
 const speeds=[0,1,3,6],index=speeds.indexOf(current);return index<0?current:speeds[Math.max(0,Math.min(speeds.length-1,index+direction))]!;
}

/** Core DesignationDragger's square uses the dominant absolute delta in both
 * axes (zero points in the positive direction). Clip at the playable map
 * boundary: Elsewhere's rectangle authority requires both endpoints inside. */
export function squareDesignationEnd(from:Cell,to:Cell,width:number,height:number):Cell {
 const dx=to.x-from.x,dz=to.z-from.z,length=Math.max(Math.abs(dx),Math.abs(dz));
 return {x:Math.max(0,Math.min(width-1,from.x+(dx<0?-length:length))),z:Math.max(0,Math.min(height-1,from.z+(dz<0?-length:length)))};
}

/** Keyboard zoom follows the Core page-key size delta: 4 * 2.6 / 35 of
 * the current span. Retain the renderer's own limits and projection. */
export function pageKeyCameraSpan(span:number,direction:'in'|'out',minimum:number,maximum:number):number {
 return Math.max(minimum,Math.min(maximum,span*(1+(direction==='in'?-1:1)*4*2.6/35)));
}

/** Designator_Build's eyedropper is for a coloured floor dropdown, not a
 * generic building copy. Only a known, existing, available carpet qualifies. */
export function carpetEyedropper(world:World,current:unknown,cell:Cell):CarpetFloor355|undefined {
 if(!isCarpetFloor355(current)||!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height||!knownPosition256(world,cell))return;
 const floor=world.tiles[cell.z*world.width+cell.x]?.floor;
 return isCarpetFloor355(floor)&&architectToolAvailable(world,floor)?floor:undefined;
}
