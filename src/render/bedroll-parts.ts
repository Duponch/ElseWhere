import {bedSheetColor} from './bed-sheet-color';
import {footprintCells} from '../sim/definitions';
import type {Structure,World} from '../sim/types';
import {buildingMaterialColor} from './building-material-color';
import type {Placement} from './primitives';
export const BEDROLL_SURFACE_HEIGHT=.14;
/** Original cloth/leather silhouette, built only with the existing resident
 * furniture boxes. The head anchor and four orientations follow the real bed
 * footprint; there is no per-frame geometry or new attribute/material. */
export function bedrollPartsForStructure(bed:Structure):Placement[] {
 if(bed.kind!=='bedroll')return [];
 const cells=footprintCells(bed),tail=cells.at(-1)!,x=(bed.x+tail.x)/2,z=(bed.z+tail.z)/2,ry=bed.orientation*Math.PI/2,c=Math.cos(ry),s=Math.sin(ry);
 const cloth=buildingMaterialColor(bed.material,0xb5a384)??0xb5a384,edge=bedSheetColor(bed);
 const part=(dx:number,y:number,dz:number,sx:number,sy:number,sz:number,color:number):Placement=>({targetId:bed.id,x:x+dx*c+dz*s,y,z:z+dz*c-dx*s,sx,sy,sz,ry,color});
 return [part(0,.06,0,.82,.12,1.86,edge),part(0,.12,.10,.72,.08,1.62,cloth),part(0,.15,-.67,.66,.12,.36,0xe0d4b6),
  part(0,.17,.70,.73,.09,.18,cloth),part(-.34,.17,.13,.025,.02,1.15,edge),part(.34,.17,.13,.025,.02,1.15,edge)];
}
/** Schema 363 double bedroll: the same boxes, two bedding widths side by side
 * on the real 2×2 footprint, one pillow per slot. */
export function doubleBedrollPartsForStructure(bed:Structure):Placement[] {
 if(bed.kind!=='double-bedroll')return [];
 const cells=footprintCells(bed),x=cells.reduce((n,c)=>n+c.x,0)/cells.length,z=cells.reduce((n,c)=>n+c.z,0)/cells.length,ry=bed.orientation*Math.PI/2,c=Math.cos(ry),s=Math.sin(ry);
 const cloth=buildingMaterialColor(bed.material,0xb5a384)??0xb5a384,edge=bedSheetColor(bed);
 const part=(dx:number,y:number,dz:number,sx:number,sy:number,sz:number,color:number):Placement=>({targetId:bed.id,x:x+dx*c+dz*s,y,z:z+dz*c-dx*s,sx,sy,sz,ry,color});
 return [part(0,.06,0,1.82,.12,1.86,edge),part(0,.12,.10,1.70,.08,1.62,cloth),part(-.5,.15,-.67,.66,.12,.36,0xe0d4b6),part(.5,.15,-.67,.66,.12,.36,0xe0d4b6),
  part(0,.17,.70,1.72,.09,.18,cloth),part(0,.17,.13,.025,.02,1.15,edge)];
}
export const bedrollParts=(world:Pick<World,'structures'>):Placement[]=>world.structures.flatMap(s=>s.kind==='double-bedroll'?doubleBedrollPartsForStructure(s):bedrollPartsForStructure(s));
/** Same packed building ID/material/quality/damage remains the simulation
 * owner. This small faceted roll only replaces the ordinary parcel drawing. */
export function packedBedrollParts(bed:Structure,x:number,z:number,y=0,scale=1):Placement[] {
 if(bed.kind!=='bedroll')return [];
 const cloth=buildingMaterialColor(bed.material,0xb5a384)??0xb5a384;
 const part=(dx:number,dy:number,sx:number,sy:number,sz:number,color:number):Placement=>({targetId:bed.id,x:x+dx*scale,y:y+dy*scale,z,sx:sx*scale,sy:sy*scale,sz:sz*scale,color});
 return [part(0,.19,.72,.24,.46,cloth),part(0,.19,.72,.36,.30,cloth),
  part(-.21,.19,.055,.39,.48,0x677567),part(.21,.19,.055,.39,.48,0x677567)];
}
