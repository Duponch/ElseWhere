import {bedSheetColor} from './bed-sheet-color';
import { footprintCells } from '../sim/definitions';
import type { World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { buildingMaterialColor } from './building-material-color';
import type { Placement } from './primitives';

/** Original box model for the shared resident furniture batch. This projection
 * reads confirmed structures only; roles never imply a monitor or sterile room. */
export function hospitalBedParts(world:World):Placement[] {
  const parts:Placement[]=[];
  for(const bed of world.structures){
    if(bed.kind!=='hospital-bed')continue;
    const cells=footprintCells(bed),last=cells[cells.length-1]!;
    const cx=(bed.x+last.x)/2,cz=(bed.z+last.z)/2;
    const ry=bed.orientation*Math.PI/2,cos=Math.cos(ry),sin=Math.sin(ry);
    const frame=buildingMaterialColor(bed.material)??0x89999e;
    const width=WORLD_SCALE.bedWidth,length=WORLD_SCALE.bedLength,surface=WORLD_SCALE.bedSurfaceHeight;
    const add=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number)=>{
      parts.push({targetId:bed.id,key:bed.id,x:cx+x*cos+z*sin,y,z:cz+z*cos-x*sin,sx,sy,sz,ry,color});
    };
    add(0,.31,0,width-.02,.12,length-.02,frame);
    for(const x of [-1,1])for(const z of [-1,1])add(x*(width/2-.09),.16,z*(length/2-.14),.09,.32,.09,frame);
    // Mattress top coincides with the shared physical resting pose at 0.5.
    add(0,surface-.06,0,width-.08,.12,length-.12,0xe5dec8);
    add(0,surface+.017,.18,width-.10,.03,length-.62,bedSheetColor(bed));
    add(0,surface+.05,-length*.33,width-.23,.10,.27,0xf0e9d6);
    add(0,.35,-length/2+.07,width-.02,.70,.08,frame);
    add(0,.31,length/2-.07,width-.02,.54,.08,frame);
    for(const side of [-1,1]){
      const x=side*(width/2-.04);
      add(x,.66,.08,.05,.05,length-.68,frame);
      for(const z of [-.46,.46])add(x,.54,z,.05,.24,.05,frame);
    }
    // A quiet mint cross distinguishes the specialist frame from a role toggle.
    const badgeZ=length/2-.024;
    add(0,.42,badgeZ,.17,.04,.015,0x6d9f99);
    add(0,.42,badgeZ,.04,.17,.015,0x6d9f99);
  }
  return parts;
}
