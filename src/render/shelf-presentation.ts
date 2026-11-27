import type {Structure} from '../sim/types';
import {footprintCells} from '../sim/definitions';
import type {Placement} from './primitives';

/** Three real stack supports per physical cell. These heights are shared by
 * the authored model, item poses, transfer endpoints and quantity labels. */
export const SHELF_LEVELS=Object.freeze([.14,.86,1.58]);
// A shelf changes support/slot only. The same stack keeps its ground size.
export const SHELF_ITEM_SCALE=1;
export function shelfParts(structure:Structure,body:number,trim:number):Placement[]{
  const cells=footprintCells(structure),x=cells.reduce((n,c)=>n+c.x,0)/cells.length,z=cells.reduce((n,c)=>n+c.z,0)/cells.length;
  const width=structure.kind==='shelf'?1.9:.9,ry=structure.orientation*Math.PI/2,c=Math.cos(ry),s=Math.sin(ry),parts:Placement[]=[];
  const add=(dx:number,y:number,dz:number,sx:number,sy:number,sz:number,color:number)=>parts.push({key:structure.id,targetId:structure.id,x:x+dx*c+dz*s,y,z:z+dz*c-dx*s,sx,sy,sz,ry,color});
  for(const y of SHELF_LEVELS)add(0,y-.035,0,width,.07,.84,body);
  for(const dx of [-width/2+.045,width/2-.045])for(const dz of [-.375,.375])add(dx,.96,dz,.07,1.92,.07,trim);
  add(0,1.875,-.39,width,.09,.06,trim);
  return parts;
}
