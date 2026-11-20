import type {World} from '../sim/types';
import type {Placement} from './primitives';

/** Schema 355 tool cabinet: original rigid model in the shared resident
 * furniture batch, painted in Core's graphic colour (96,114,95). Local +X runs
 * along the 2 × 1 footprint, the doors face local -Z like the other cabinets. */
export function toolCabinetParts355(world:World):Placement[]{
  const parts:Placement[]=[];
  for(const s of world.structures){
    if(s.kind!=='tool-cabinet')continue;
    const ry=s.orientation*Math.PI/2,c=Math.cos(ry),n=Math.sin(ry);
    const add=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number)=>parts.push({targetId:s.id,key:s.id,x:s.x+x*c+z*n,y,z:s.z+z*c-x*n,sx,sy,sz,ry,color});
    add(.5,.06,0,1.78,.12,.58,0x3f4c40);
    add(.5,.55,0,1.84,.86,.62,0x60725f);
    add(.5,1.0,0,1.9,.06,.68,0x6f8270);
    for(const x of [.03,.97]){add(x,.56,-.315,.86,.74,.02,0x6c7f6b);add(x+(x<.5?.33:-.33),.56,-.33,.04,.16,.03,0xc9c3a6);}
    add(.5,.56,-.318,.03,.78,.02,0x3f4c40);
    add(.12,1.07,.05,.5,.06,.08,0x9a9d96);add(-.08,1.08,.05,.1,.1,.18,0x7b6a55);
    add(.95,1.06,-.02,.32,.05,.05,0xa6aaa2);add(1.12,1.06,-.02,.06,.05,.14,0xa6aaa2);
  }
  return parts;
}
