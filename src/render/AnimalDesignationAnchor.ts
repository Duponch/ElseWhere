import type {Node} from 'three/webgpu';
import {Fn,If,attribute,cos,sin,float,vec3,instanceIndex} from 'three/tsl';
import {pawnPresentationPose,type PresentationPoseClock} from './pawn-presentation';
import type {ActorAnimationCacheNodes} from './ActorAnimationCache';
import {animalGesture} from './actor-idle-gestures';
import {TSL_GESTURE_OPS,gestureNode,tslNode} from './actor-idle-gestures-tsl';

/** Four marker vertices use the live head's bind point, the body's exact
 * trajectory and its existing retained animation cells. No CPU/frame anchor
 * or old simulation cell is ever substituted for the displayed animal. */
export function animalDesignationHeadAnchor(options:{clock:PresentationPoseClock;cache:ActorAnimationCacheNodes;time:Node<'float'>;rate:Node<'float'>;
 point:Node<'vec3'>;pivot:Node<'vec3'>;bodyCenter:Node<'float'>;restFloor:Node<'float'>;headCell:number;
 profile:{graze:Node<'float'>;peck:Node<'float'>;tailAmplitude:Node<'float'>;tailRate:Node<'float'>;shake:Node<'float'>;ruffle:Node<'float'>;look:Node<'float'>}}):Node<'vec3'> {
 const{clock,cache,time,rate,point,pivot,bodyCenter,restFloor,profile}=options;
 return Fn(()=>{
  const cached=cache.cached().toVar(),pose=pawnPresentationPose(clock,instanceIndex,cached),state=attribute('aAnimal','vec4');
  const phase=state.w.add(pose.xz.sub(attribute('aFrom','vec4').xz).length().mul(rate));
  const angle=float(0).toVar(),hc=float(1).toVar(),hs=float(0).toVar(),rc=float(1).toVar(),rs=float(0).toVar(),wc=float(1).toVar(),ws=float(0).toVar();
  const pitchC=float(1).toVar(),pitchS=float(0).toVar(),bob=float(0).toVar(),breathe=float(0).toVar();
  If(cached,()=>{const head=cache.cell(4),body=cache.cell(5),rest=cache.cell(6),rotation=cache.cell(options.headCell),height=cache.cell(3);
   hc.assign(head.x);hs.assign(head.y);rc.assign(body.z);rs.assign(body.w);wc.assign(rest.x);ws.assign(rest.y);pitchC.assign(rotation.x);pitchS.assign(rotation.y);bob.assign(height.x);breathe.assign(height.y);
  }).Else(()=>{
   const g=animalGesture(TSL_GESTURE_OPS,{moving:gestureNode(state.x),eating:gestureNode(state.y),posture:gestureNode(state.z),seed:gestureNode(state.w),carried:gestureNode(float(0)),t:gestureNode(time),travelTime:gestureNode(clock.travelTime),
    graze:gestureNode(profile.graze),peck:gestureNode(profile.peck),tailAmplitude:gestureNode(profile.tailAmplitude),tailRate:gestureNode(profile.tailRate),shake:gestureNode(profile.shake),ruffle:gestureNode(profile.ruffle),look:gestureNode(profile.look)});
   const attack=sin(clock.travelTime.sub(state.w).mul(10).clamp(0,Math.PI)).mul(.9);
   angle.assign(state.x.greaterThan(.5).select(sin(phase).mul(.06),state.y.greaterThan(1).select(attack,state.y.mul(sin(time.mul(5)).mul(.12).add(.48)))));
   If(state.x.lessThan(.5).and(state.y.lessThan(.5)).and(state.z.lessThan(.5)),()=>angle.assign(sin(time.add(state.w)).mul(.03)));
   angle.addAssign(tslNode(g.headPitch));pitchC.assign(cos(angle));pitchS.assign(sin(angle));hc.assign(cos(tslNode(g.headYaw)));hs.assign(sin(tslNode(g.headYaw)));
   rc.assign(cos(tslNode(g.roll)));rs.assign(sin(tslNode(g.roll)));wc.assign(cos(tslNode(g.wiggle)));ws.assign(sin(tslNode(g.wiggle)));bob.assign(sin(phase).abs().mul(.08).mul(state.x));
   If(state.x.lessThan(.5).and(state.y.lessThan(.5)).and(state.z.lessThan(.5)),()=>breathe.assign(sin(time.add(state.w)).mul(.006)));
  });
  const local=point.sub(pivot),x=local.x.mul(hc).add(local.z.mul(hs)),z=local.z.mul(hc).sub(local.x.mul(hs));
  const q=vec3(x,local.y.mul(pitchC).sub(z.mul(pitchS)),z.mul(pitchC).add(local.y.mul(pitchS))).add(pivot).toVar();
  const rollX=q.x.toVar(),rollY=q.y.sub(bodyCenter).toVar();q.x.assign(rollX.mul(rc).sub(rollY.mul(rs)));q.y.assign(rollX.mul(rs).add(rollY.mul(rc)).add(bodyCenter));
  If(state.z.greaterThan(.5),()=>{const rx=q.x.toVar(),ry=q.y.toVar();q.x.assign(bodyCenter.sub(ry));q.y.assign(rx.add(restFloor));const wx=q.x.toVar();q.x.assign(wx.mul(wc).add(q.z.mul(ws)));q.z.assign(q.z.mul(wc).sub(wx.mul(ws)));});
  q.y.addAssign(bob);q.y.addAssign(breathe);
  const cy=cache.yawNode(pose.w,'cos',instanceIndex,cached),sy=cache.yawNode(pose.w,'sin',instanceIndex,cached);
  return vec3(q.x.mul(cy).add(q.z.mul(sy)),q.y,q.z.mul(cy).sub(q.x.mul(sy))).mul(attribute('aScale','float')).add(pose.xyz).add(vec3(0,.5,0));
 })();
}
