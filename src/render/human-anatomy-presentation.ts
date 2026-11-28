import {artificialPartCovering} from '../sim/artificial-parts-rules';
import { partMissing } from '../sim/injury-state';
import { humanConsumedPartAbsent382 } from '../sim/corpse-anatomy';
import type { Pawn } from '../sim/types';

/** Bind-space convention matches the authored left hair/temple pieces: left
 * is negative X, irrespective of camera/yaw. The eight rigid bones include
 * sleeves and hands in 2/3, thighs in 4/5, calves and shoes in 6/7. */
export const HUMAN_LIMB_VISUALS=Object.freeze([
  Object.freeze({part:'left-arm' as const,bit:1,bones:Object.freeze([2])}),
  Object.freeze({part:'right-arm' as const,bit:2,bones:Object.freeze([3])}),
  Object.freeze({part:'left-leg' as const,bit:4,bones:Object.freeze([4,6])}),
  Object.freeze({part:'right-leg' as const,bit:8,bones:Object.freeze([5,7])}),
]);

/** Snapshot-adoption projection only. Missing parents (e.g. shoulder) hide
 * their limb subtree; a missing hand/foot never removes its present parent. */
export function humanLimbVisualMask(pawn:Pick<Pawn,'health'|'body'>):number {
  if(pawn.body?.consumedParts382)return HUMAN_LIMB_VISUALS.reduce((mask,{part,bit})=>mask+(humanConsumedPartAbsent382(pawn,part)||!!pawn.health&&partMissing(pawn.health,part)&&!artificialPartCovering(pawn.health,part)?bit:0),0);
  return pawn.health?HUMAN_LIMB_VISUALS.reduce((mask,{part,bit})=>mask+(partMissing(pawn.health!,part)&&!artificialPartCovering(pawn.health!,part)?bit:0),0):0;
}

/** One small exact float32 word in the existing aShape.x stream. Body morph
 * keeps its units digit, corpse appearance its tens, anatomical mask hundreds. */
export const packHumanShape=(bodyType:number,rotStage:number,mask:number):number=>bodyType+10*rotStage+100*mask;

/** The portrait uses the same authored bones and derived absence as the GPU.
 * No per-frame clinical query, geometry mutation or persistent visual state. */
export function humanBoneAbsent(mask:number,bone:number):boolean {
  return HUMAN_LIMB_VISUALS.some(limb=>limb.bones.includes(bone)&&Math.floor(mask/limb.bit)%2===1);
}
