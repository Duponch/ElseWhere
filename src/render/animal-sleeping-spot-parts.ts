import {bedSheetColor} from './bed-sheet-color';
import type { World } from '../sim/types';
import type { Placement } from './primitives';

/** A floor outline with a paw, or a medical cross: never a padded bed. */
export function animalSleepingSpotParts(world:World):Placement[] {
  const parts:Placement[]=[];
  for(const s of world.structures)if(s.kind==='animal-sleeping-spot'){
    const color=bedSheetColor(s);
    for(const x of [-1,1])for(const z of [-1,1]){
      parts.push({targetId:s.id,x:s.x+x*.30,z:s.z+z*.42,y:.032,sx:.27,sy:.022,sz:.045,color},
        {targetId:s.id,x:s.x+x*.42,z:s.z+z*.30,y:.032,sx:.045,sy:.022,sz:.27,color});
    }
    if(s.medical)parts.push({targetId:s.id,x:s.x,z:s.z,y:.038,sx:.30,sy:.022,sz:.09,color},
      {targetId:s.id,x:s.x,z:s.z,y:.038,sx:.09,sy:.022,sz:.30,color});
    else {
      parts.push({targetId:s.id,x:s.x,z:s.z+.075,y:.038,sx:.19,sy:.022,sz:.16,color,ry:Math.PI/4});
      for(const [dx,dz] of [[-.135,-.045],[-.045,-.13],[.045,-.13],[.135,-.045]])
        parts.push({targetId:s.id,x:s.x+dx!,z:s.z+dz!,y:.038,sx:.065,sy:.022,sz:.08,color,ry:Math.PI/4});
    }
  }
  return parts;
}
