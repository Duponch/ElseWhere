import { attribute, instanceIndex,mix } from 'three/tsl';
import type {Node} from 'three/webgpu';
import type {ActorAnimationCache} from './ActorAnimationCache';
import type { PawnLayer } from './PawnLayer';
import { TURN_SECONDS } from './turn-presentation';

/** Shared by body, cargo and selection. XZ follows the authoritative edge;
 * only vertical presentation climbs furniture in its first/last third. */
export type PresentationClock=Pick<PawnLayer,'travelTime'|'blend'>&{readonly animationCache?:ActorAnimationCache};
/** The pose graph needs only the clocks and, when cached, the cache's shader reads. */
export type PresentationPoseClock=Pick<PawnLayer,'travelTime'|'blend'>&{readonly animationCache?:Pick<ActorAnimationCache,'poseNode'>};
export function pawnPresentationPose(clock:PresentationPoseClock,index:Node<'uint'>=instanceIndex,cached?:Node<'bool'>):Node<'vec4'> {
  const original=()=>originalPresentationPose(clock);
  return clock.animationCache?clock.animationCache.poseNode(original,index,cached):original();
}
function originalPresentationPose(clock:Pick<PawnLayer,'travelTime'|'blend'>) {
  const travel=attribute('aTravel','vec4'),from=attribute('aFrom','vec4'),to=attribute('aTo','vec4');
  const alpha=travel.y.sub(travel.x).greaterThan(0).select(clock.travelTime.sub(travel.x).div(travel.y.sub(travel.x).max(.0001)).clamp(0,1),clock.blend);
  const pose=mix(from,to,alpha).toVar();
  // Facing completes quickly even when a traversed edge lasts several ticks.
  // The same pose node is shared by bodies, cargo and selection markers.
  // On a stationary actor, aTravel.z carries the independent heading start
  // and aTravel.w=2 marks this mode. The approach still uses x/y. Both can
  // start at different confirmed ticks without rewinding the other motion.
  const stationary=travel.w.greaterThan(1);
  const turnStart=stationary.select(travel.z,travel.x);
  const turnAlpha=clock.travelTime.sub(turnStart).div(TURN_SECONDS).clamp(0,1);
  pose.w.assign(mix(from.w,to.w,stationary.or(travel.y.greaterThan(travel.x)).select(turnAlpha,clock.blend)));
  const distance=mix(travel.z,travel.w,alpha);
  const vertical=from.y.lessThan(to.y).select(distance.mul(3).clamp(0,1),from.y.greaterThan(to.y).select(distance.mul(3).sub(2).clamp(0,1),distance));
  pose.y.assign(mix(from.y,to.y,vertical));return pose;
}
