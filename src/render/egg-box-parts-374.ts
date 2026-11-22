import type {World} from '../sim/types';
import type {Placement} from './primitives';
import {buildingMaterialColor} from './building-material-color';

/** Schema 374 egg box: original low open crate in the shared resident furniture
 * batch (Core fillPercent 0.3), in the colour of its stuff, with a straw lining.
 * Its content is read in the inspector; the model does not change with it. */
export function eggBoxParts374(world:World):Placement[]{
  const parts:Placement[]=[];
  for(const s of world.structures){
    if(s.kind!=='egg-box')continue;
    const color=buildingMaterialColor(s.material,0xa38559)??0xa38559;
    const add=(x:number,y:number,z:number,sx:number,sy:number,sz:number,c:number)=>parts.push({targetId:s.id,key:s.id,x:s.x+x,y,z:s.z+z,sx,sy,sz,ry:0,color:c});
    add(0,.03,0,.78,.06,.78,color);
    for(const side of [-1,1]){add(side*.36,.17,0,.06,.28,.78,color);add(0,.17,side*.36,.66,.28,.06,color);}
    add(0,.2,0,.66,.08,.66,0xd8b86a);
    add(-.12,.25,.08,.2,.05,.24,0xe6cc84);add(.14,.25,-.1,.24,.05,.18,0xcdb062);
  }
  return parts;
}
