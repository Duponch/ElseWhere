import type {World} from '../sim/types';
import type {Placement} from './primitives';
import {WALL_APPLIANCE_BOTTOM,WALL_APPLIANCE_TOP} from './wall-appliance';

/** Original authored grille. Same resident boxes, no scene/material per vent.
 * A constant part count keeps real open/closed changes resident and visible. */
export function ventParts(world:Pick<World,'structures'>,cutaway=false):Placement[]{
  const out:Placement[]=[],height=WALL_APPLIANCE_TOP-WALL_APPLIANCE_BOTTOM,bottom=WALL_APPLIANCE_BOTTOM;
  if(cutaway)return out;
  for(const s of world.structures)if(s.kind==='vent'){
    const ry=s.orientation*Math.PI/2,cos=Math.cos(ry),sin=Math.sin(ry),open=s.vent?.open!==false;
    const part=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number)=>out.push({targetId:s.id,x:s.x+x*cos+z*sin,z:s.z+z*cos-x*sin,y:bottom+y,sx,sy,sz,ry,color});
    part(-.45,height/2,0,.10,height,.96,0x8b978f);part(.45,height/2,0,.10,height,.96,0x8b978f);
    part(0,.05,0,.8,.10,.96,0xaab0a0);part(0,height-.05,0,.8,.10,.96,0xaab0a0);
    part(0,height/2,0,.8,height-.2,open?.09:.7,open?0x526663:0x8c988f);
    for(const sign of [-1,1])for(let i=1;i<=4;i++)part(0,.08+(height-.16)*i/5,sign*.48,.8,.045,.045,0xbac1ad);
  }
  return out;
}
