import type Node from 'three/src/nodes/core/Node.js';
import { attribute, float, mix, vec3 } from 'three/tsl';
import { BODY_PROPORTIONS } from './pawn-appearance-shape';
import {LONGSWORD_DYE270} from './longsword-parts270';
import {SPEAR_DYE272} from './spear-parts272';
import {MACE_DYE269} from './mace-parts269';

/** Original CPU aliases remain inspectable; the Origami shader spends one
 * vertex location on both traits, keeping real UVs within the device limit. */
export function pawnBoneNode(origami=false):Node<'float'> {
  return origami?attribute('pawnRigTraits','vec2').x:attribute('boneId','float');
}
export function pawnDyeNode(origami=false):Node<'float'> {
  return origami?attribute('pawnRigTraits','vec2').y:attribute('dye','float');
}

/** Applied equally to vertices and rigid-bone pivots, before pose animation. */
export function pawnMorph(point:Node<'vec3'>,origami=false) {
  const bone=pawnBoneNode(origami),dye=pawnDyeNode(origami),shape=attribute('aShape','vec4');
  // Tens encode corpse presentation stage in the existing appearance slot.
  const bodyType=shape.x.mod(10);
  const factor=(column:number)=>BODY_PROPORTIONS.reduce<Node<'float'>>((v,row,i)=>bodyType.equal(i).select(float(row[column]!),v),float(1));
  const shoulder=factor(0),waist=factor(1),hip=factor(2),depth=factor(3);
  const torso=mix(waist,shoulder,point.y.sub(.76).div(.20).clamp(0,1));
  const legs=bone.greaterThanEqual(4),arms=bone.greaterThanEqual(2).and(bone.lessThanEqual(3));
  const head=bone.equal(1),narrow=shape.y.mod(6).greaterThanEqual(3),jaw=shape.y.mod(3);
  const lower=point.y.lessThan(1.18);
  const headWidth=narrow.select(float(.87),float(1)).mul(shape.y.greaterThanEqual(6).select(float(.97),float(1)))
    .mul(lower.select(jaw.equal(1).select(float(.84),jaw.equal(2).select(float(1.12),float(1))),float(1)));
  const body=vec3(point.x.mul(legs.select(hip,arms.select(shoulder,torso))),point.y,point.z.mul(depth));
  const shaped=head.select(vec3(point.x.mul(headWidth),point.y,point.z),body);
  // Weapons preserve their dimensions, with only their holster shifted outwards.
  const weapon=dye.equal(-1).or(dye.equal(-4)).or(dye.equal(-5)).or(dye.equal(MACE_DYE269)).or(dye.equal(LONGSWORD_DYE270)).or(dye.equal(SPEAR_DYE272));
  const equipped=weapon.select(vec3(point.x.add(shoulder.sub(1).mul(.205)),point.y,point.z),shaped);
  if(!origami)return equipped;
  // -30/-31/-32 are the resident axe/pickaxe/sickle tags from pawn-geometry.
  // Keep each tool's dimensions rigid; only its grip follows the shaped hand.
  const workTool=dye.equal(-30).or(dye.equal(-31)).or(dye.equal(-32));
  return workTool.select(vec3(point.x.add(shoulder.sub(1).mul(.23)),point.y,point.z.add(depth.sub(1).mul(.05))),equipped);
}

export function hiddenAppearancePart(origami=false) {
  const dye=pawnDyeNode(origami),shape=attribute('aShape','vec4');
  const hair=dye.greaterThanEqual(100).and(dye.lessThan(200));
  const beard=dye.greaterThanEqual(200);
  const mask=hair.select(shape.z,shape.w),index=hair.select(dye.sub(100),dye.sub(200));
  // The indices are small exact integers; outside those parts use exponent zero.
  const visible=mask.div(float(2).pow(index.clamp(0,14))).floor().mod(2).greaterThan(.5);
  return hair.or(beard).and(visible.not());
}
