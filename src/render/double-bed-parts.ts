import { bedSlotBodyCenter,bedSlotCell } from '../sim/bed-slots';
import { buildingMaterialColor } from './building-material-color';
import { WORLD_SCALE } from '../world/scale';
import type { Structure,World } from '../sim/types';
import type { Placement } from './primitives';

/** One frame and mattress, two pillows aligned with the actual sleeping heads
 * (the single bed's pillow position, where a lying head rests).
 * The finished object, construction ghost and UI portrait share this builder. */
export function doubleBedPartsForStructure(bed:Structure):Placement[] {
  if(bed.kind!=='double-bed')return [];
  const a=bedSlotBodyCenter(bed,0)!,b=bedSlotBodyCenter(bed,1)!;
  const x=(a.x+b.x)/2,z=(a.z+b.z)/2,ry=bed.orientation*Math.PI/2;
  const length=WORLD_SCALE.bedLength,width=1.84,color=buildingMaterialColor(bed.material);
  const parts:Placement[]=[
    {x,z,y:WORLD_SCALE.bedFrameHeight/2+.04,sx:width,sy:WORLD_SCALE.bedFrameHeight,sz:length,color,ry},
    {x,z,y:WORLD_SCALE.bedSurfaceHeight-.045,sx:width-.06,sy:.14,sz:length-.10,color:0xe5d8b7,ry},
    {x:x+Math.sin(ry)*.22,z:z+Math.cos(ry)*.22,y:WORLD_SCALE.bedSurfaceHeight+.038,sx:width-.07,sy:.045,sz:length*.60,color:0x7a9c99,ry},
    {x:x-Math.sin(ry)*(length/2-.05),z:z-Math.cos(ry)*(length/2-.05),y:.35,sx:width,sy:.63,sz:.08,color,ry},
  ];
  for(const slot of [0,1] as const){const head=bedSlotCell(bed,slot)!;
    parts.push({x:head.x-Math.sin(ry)*.127,z:head.z-Math.cos(ry)*.127,y:WORLD_SCALE.bedSurfaceHeight+.07,sx:.66,sy:.12,sz:.28,color:0xf3e8d0,ry});
  }
  return parts.map(p=>({...p,targetId:bed.id}));
}
export const doubleBedParts=(world:Pick<World,'structures'>):Placement[]=>world.structures.flatMap(doubleBedPartsForStructure);
