import { attribute, float, Fn, If, mix, sin, vec3, varying } from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';

/** Six visible regions, two bits each. This is a snapshot projection, not a
 * persistent blood deposit or a new clinical rule. Internal bleeding alone
 * cannot paint the skin. Existing open wounds retain a dry mark after tending
 * and death; healed scars and consumed/absent parts do not. */
export {bodyBloodRegion,bodyBloodWord} from './body-blood-word-297';

/** Bind coordinates are explicitly carried into the fragment stage. Drawing
 * paint inside the existing material keeps marks attached through every rig
 * pose and requires neither a texture sample nor another draw. */
export function bodyBloodPigment(base:Node<'vec3'>,region:Node<'float'>,scale=1,eligible?:Node<'float'>,packedWord:Node<'float'>=attribute('aBodyBlood','float'),bind?:Node<'vec4'>) {
  return Fn(()=>{
    const pigment=base.toVar(),word=packedWord;
    If(word.greaterThan(0),()=>{
      // Complex painted actors reuse one named bind/region stream. Creating
      // anonymous varyings inside nested shader functions can reserve the same
      // data repeatedly. Existing callers retain their original construction.
      const local=(bind?bind.xyz:varying(attribute('position','vec3'))).mul(scale),r=bind?bind.w:varying(region);
      const strength=word.div(float(4).pow(r)).floor().mod(4).div(3);
      const broad=sin(local.y.mul(7).add(local.z.mul(5)).add(r.mul(2.3)))
        .mul(sin(local.z.mul(6).sub(local.x.mul(8)).add(r))).mul(.5).add(.5);
      const scratches=sin(local.y.mul(61).add(local.x.mul(23)).add(r)).abs();
      const ink=broad.smoothstep(float(.80).sub(strength.mul(.32)),float(.91).sub(strength.mul(.22)))
        .mul(scratches.mul(.25).add(.75)).mul(strength.greaterThan(0).select(1,0)).mul(eligible??float(1));
      pigment.assign(mix(pigment,vec3(.30,.022,.032),ink.mul(.92)));
    });
    return pigment;
  })();
}
