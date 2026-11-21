import {isIedTrapKind357} from '../sim/ied-traps-357';
import type {World} from '../sim/types';
import type {Placement} from './primitives';

/** Schema 357 IED traps: an original low model in the shared furniture batch
 * (also the ghost and portrait). Two olive shells stand half buried in a
 * packed-earth plate under a steel pressure bar; the band is ochre for the
 * high-explosive shells and red for the incendiary ones. No scene object per
 * trap and no animation: the wick is drawn by the existing structure effects. */
export function iedTrapParts357(world:World):Placement[]{
  const parts:Placement[]=[];
  for(const s of world.structures){
    if(!isIedTrapKind357(s.kind))continue;
    const band=s.kind==='ied-incendiary'?0xb4653b:0xd2a153,shell=0x7f8a63;
    const add=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,shape?:Placement['shape'])=>parts.push({key:s.id,targetId:s.id,x:s.x+x,y,z:s.z+z,sx,sy,sz,color,...shape?{shape}:{}});
    add(0,.035,0,.86,.07,.86,0x8a7558);
    for(const x of [-.19,.19]){
      add(x,.19,-.05,.22,.30,.22,shell,'item-disc');
      add(x,.37,-.05,.19,.13,.19,shell,'item-round');
      add(x,.21,-.05,.235,.06,.235,band,'item-disc');
    }
    add(0,.13,.25,.72,.05,.16,0x9a9d96);
    add(0,.18,.25,.07,.06,.07,0xc85a42,'item-round');
  }
  return parts;
}
