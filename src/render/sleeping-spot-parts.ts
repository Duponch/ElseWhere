import { bedSlotBodyCenter } from '../sim/bed-slots';
import type { Structure,World } from '../sim/types';
import type { Placement } from './primitives';

/** A thin chalk outline and head marker on the real two-cell footprint.
 * Finished object, placement ghost and portrait share these authored pieces. */
export function sleepingSpotPartsForStructure(spot:Structure):Placement[] {
  if(spot.kind!=='sleeping-spot')return [];
  const center=bedSlotBodyCenter(spot,0);if(!center)return [];
  const ry=spot.orientation*Math.PI/2,c=Math.cos(ry),s=Math.sin(ry);
  const color=spot.medical?0x72b9c4:0xdacdac;
  const part=(x:number,z:number,sx:number,sz:number):Placement=>({targetId:spot.id,
    x:center.x+x*c+z*s,z:center.z+z*c-x*s,y:.018,sx,sy:.016,sz,color,ry});
  const parts:Placement[]=[];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(
    part(x*.27,z*.88,.30,.045),part(x*.40,z*.73,.045,.30));
  // The head end remains legible without drawing a pillow or mattress.
  parts.push(part(0,-.70,.30,.045));
  if(spot.medical)parts.push(part(0,0,.28,.07),part(0,0,.07,.28));
  return parts;
}
/** Schema 363 double sleeping spot: one chalk outline around both slots and a
 * head marker in front of each real sleeping head. */
export function doubleSleepingSpotPartsForStructure(spot:Structure):Placement[] {
  if(spot.kind!=='double-sleeping-spot')return [];
  const a=bedSlotBodyCenter(spot,0),b=bedSlotBodyCenter(spot,1);if(!a||!b)return [];
  const cx=(a.x+b.x)/2,cz=(a.z+b.z)/2,ry=spot.orientation*Math.PI/2,c=Math.cos(ry),s=Math.sin(ry);
  const color=spot.medical?0x72b9c4:0xdacdac;
  const part=(x:number,z:number,sx:number,sz:number):Placement=>({targetId:spot.id,x:cx+x*c+z*s,z:cz+z*c-x*s,y:.018,sx,sy:.016,sz,color,ry});
  const parts:Placement[]=[];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(x*.74,z*.88,.34,.045),part(x*.90,z*.73,.045,.30));
  for(const x of [-.5,.5])parts.push(part(x,-.70,.30,.045));
  return parts;
}
export const sleepingSpotParts=(world:Pick<World,'structures'>):Placement[]=>world.structures.flatMap(s=>s.kind==='double-sleeping-spot'?doubleSleepingSpotPartsForStructure(s):sleepingSpotPartsForStructure(s));
