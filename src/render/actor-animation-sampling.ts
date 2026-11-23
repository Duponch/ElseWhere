import type {BufferGeometry} from 'three/webgpu';
import {ActorAnimationCache,type CachedActorPose} from './ActorAnimationCache';
import {HUMAN_GAIT_RADIANS_PER_UNIT} from './gait-presentation';
import {WORK_POSE} from './work-presentation';
import {animalIdleProfile,evaluateAnimalGesture,evaluateHumanGesture,restingAnimalGesture,restingHumanChest,type AnimalIdleProfile,type ScalarAnimalGesture} from './actor-idle-gestures';

const STILL_ANIMAL:Readonly<ScalarAnimalGesture>=Object.freeze({headPitch:0,headYaw:0,tail:0,wing:0,roll:0,breath:0,wiggle:0});
import {TICKS_PER_SECOND} from '../sim/types';
import {PAWN_MODEL_SCALE,WORLD_SCALE} from '../world/scale';

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

/** Dynamic coefficients only. Morphology, masks and authored bind geometry
 * stay in the resident graph. This function is never called for near actors. */
export function samplePawnRig(cache:ActorAnimationCache,slot:number,g:BufferGeometry,root:CachedActorPose,time:number,travelTime:number):void {
  const motion=g.getAttribute('aMotion'),from=g.getAttribute('aFrom'),cargo=g.getAttribute('aCargo');
  const shape=g.getAttribute('aShape'),hair=g.getAttribute('aHairBlood');
  const x=motion.getX(slot),activity=motion.getY(slot),pose=motion.getZ(slot),phase=motion.getW(slot);
  const packed=-x-1,transitionWalk=packed>8192,walking=x<-.5?(transitionWalk?1:0):x;
  let crouch=pose===WORK_POSE.ground||pose===WORK_POSE.groundMelee?1:0;
  if(x<-.5){const payload=transitionWalk?packed-8192:packed,start=(Math.floor(payload)-16)/(4*TICKS_PER_SECOND);
    const t=clamp((travelTime-start)/.28);crouch=lerp(payload-Math.floor(payload),crouch,t*t*(3-2*t));}
  const gait=phase+Math.hypot(root.x-from.getX(slot),root.z-from.getZ(slot))*HUMAN_GAIT_RADIANS_PER_UNIT;
  const idle=pose===0&&walking<.5&&activity===0,busy=pose===WORK_POSE.mine||pose===WORK_POSE.chop||pose===WORK_POSE.build||pose===WORK_POSE.craft||pose===WORK_POSE.ground;
  const brawl=pose===22||pose===8,fight=time*8+(shape.getX(slot)%10)*3.7+hair.getX(slot)*7;
  const reach=Math.sin(clamp((travelTime-phase)*4)*Math.PI),strike=pose===8?reach:0;
  const shooting=pose===7||pose===15,breath=Math.sin(time+phase),stroke=Math.sin(time*11+phase);
  const recoil=pose===15?clamp(1-(travelTime-phase)/.30):0;
  cache.set(slot,3,crouch,Math.sin(time+phase*1.97)>.994?1:0,recoil,reach);
  let height=pose===1||pose===18||pose===19?.28:pose===6?1.3:WORLD_SCALE.carriedHeight;
  if(pose>1.5&&pose<3.5)height=Math.sin(time*4+phase)*(activity===14?0:.08)+1.32;
  if(pose===3)height+=WORLD_SCALE.stoolHeight-.605*PAWN_MODEL_SCALE;
  cache.set(slot,4,height,pose,activity);
  // Sleepers and bodies (the static middle rigs resampled at middleHz) take a
  // scalar shortcut; a far actor (under farPixels on screen, sampled once)
  // keeps its plain pose: the gestures would not show at that size.
  const resting=pose===18||pose===19||cache.level(slot)===2;
  const gesture=resting?undefined:evaluateHumanGesture(activity,pose,walking,Math.abs(cargo.getX(slot)),time,phase,travelTime);
  const upper=!!gesture&&gesture.upper!==0&&crouch<=0,arms=!!gesture&&gesture.arms!==0&&crouch<=0;
  const lean=gesture?gesture.lean:0,headYaw=gesture?gesture.yaw:0,wiggle=gesture?gesture.wiggle:0;
  cache.set(slot,5,Math.cos(lean),Math.sin(lean),Math.cos(headYaw),Math.sin(headYaw));
  cache.set(slot,6,Math.cos(wiggle),Math.sin(wiggle),gesture?gesture.chest:restingHumanChest(pose,time,phase),0);
  for(let bone=0;bone<8;bone++){
    const sign=bone===3||bone===4||bone===6?-1:1;let angle=0;
    if(bone>1.5){
      angle=Math.sin(gait)*walking*sign*.65;
      if(bone<3.5){
        if(activity>0&&pose<10.5)angle+=Math.sin(time*12+phase)*.35-.8;
        if(Math.abs(cargo.getX(slot))>.5){angle=-.9+Math.sin(gait)*walking*.06;if(pose>1.5)angle=-1.3+Math.sin(time*4+phase)*.22;}
      }
    }
    if(busy&&bone===0)angle=stroke*(pose===WORK_POSE.mine||pose===WORK_POSE.chop?.13:.065);
    if(busy&&bone===1)angle=Math.sin(time*7+phase+.7)*.075;
    if(pose===WORK_POSE.mine&&bone>1.5&&bone<3.5)angle=stroke*.78-1.44;
    if(pose===WORK_POSE.chop&&bone>1.5&&bone<3.5)angle=bone===3?stroke*.95-1.25:-.64;
    if(pose===WORK_POSE.build&&bone>1.5&&bone<3.5)angle=bone===3?stroke*.53-.92:-.45;
    if(pose===WORK_POSE.craft&&bone>1.5&&bone<3.5){const cadence=activity===2?8:activity===3?5:11,breadth=activity===2?.62:activity===3?.33:.54;
      angle=Math.sin(time*cadence+phase+(bone===3?1.25:0))*breadth-(activity===3?.99:.87);}
    if(bone===1&&walking>.5)angle=Math.sin(gait)*.045;
    if(idle){if(bone===0)angle=breath*.018;else if(bone===1)angle=breath*.026;else if(bone>1.5&&bone<3.5)angle=breath*(bone===3?-.025:.025)+.035;}
    if(pose>2.5&&pose<3.5&&bone>3.5)angle=bone<5.5?-Math.PI/2:0;
    if(pose===WORK_POSE.groundMelee&&bone>1.5&&bone<3.5)angle=reach*-.9-.2;
    if(brawl&&bone>1.5&&bone<3.5)angle=Math.sin(fight+(bone===3?Math.PI:0))*.29-.95-strike*(bone===3?.85:.3);
    if(brawl&&(bone===0||bone===1))angle=Math.sin(fight)*(bone===0?.105:.06)-strike*.11;
    if(brawl&&bone>3.5)angle=Math.sin(fight+(bone===4||bone===6?0:Math.PI))*(bone<5.5?.12:.055);
    if(shooting&&bone>1.5&&bone<3.5)angle=bone===3?-1.54:-1.12;
    if(pose===4&&bone===3)angle=Math.sin(time*2+phase)*1.1-.35;
    if(crouch>0&&!brawl&&bone<3.5&&pose!==WORK_POSE.groundMelee){
      const low=bone===0?Math.sin(time*8+phase)*.085-.09:bone===1?Math.sin(time*8+phase+.7)*.055+.055:Math.sin(time*8+phase+(bone===3?2.1:0))*.39-.65;
      angle=lerp(angle,low,crouch);
    }
    if(crouch>0&&bone>3.5)angle=lerp(angle,Math.sin(time*8+phase+(bone===4||bone===6?0:Math.PI))*(bone<5.5?.045:.025),crouch);
    if(upper&&bone<1.5)angle=bone===0?gesture!.torso:gesture!.head;
    if(arms&&bone>1.5&&bone<3.5)angle=bone===2?gesture!.arm2:gesture!.arm3;
    if(bone===0)angle+=lean;
    let y=0,z=0;if(busy&&bone<3.5)y+=stroke*.012;if(idle&&bone<3.5){y+=breath*.007;z+=breath*.004;}
    // Pre-crouch offsets and post-crouch brawl offsets occupy separate cells.
    cache.set(slot,8+bone,Math.cos(angle),Math.sin(angle),y,z);
    cache.set(slot,16+bone,brawl&&bone<3.5?Math.sin(fight*2)*.014:0,brawl&&bone<3.5?Math.sin(fight)*.025:0);
  }
}

/** Wildlife's fractional shell influences are finite values authored in its
 * geometry. They are each sampled once, rather than trig per shell vertex. */
export function sampleAnimalRig(cache:ActorAnimationCache,slot:number,g:BufferGeometry,root:CachedActorPose,time:number,travelTime:number,rate:number,bones:readonly number[],profile:AnimalIdleProfile=animalIdleProfile('')):void {
  const state=g.getAttribute('aAnimal'),from=g.getAttribute('aFrom'),carrier=g.getAttribute('aCarrier');
  const moving=state.getX(slot),eating=state.getY(slot),posture=state.getZ(slot),seed=state.getW(slot);
  // As for people: lying or dead still animals take the scalar shortcut, far ones keep their plain pose.
  const gesture=cache.level(slot)===2?STILL_ANIMAL:restingAnimalGesture(moving,posture,seed,carrier.getX(slot),time,profile.tailAmplitude)??evaluateAnimalGesture(moving,eating,posture,seed,carrier.getX(slot),time,travelTime,profile);
  const {headYaw,tail,wing,roll,wiggle}=gesture;
  cache.set(slot,4,Math.cos(headYaw),Math.sin(headYaw),Math.cos(tail),Math.sin(tail));
  cache.set(slot,5,Math.cos(wing),Math.sin(wing),Math.cos(roll),Math.sin(roll));
  cache.set(slot,6,Math.cos(wiggle),Math.sin(wiggle),gesture.breath,0);
  const phase=seed+Math.hypot(root.x-from.getX(slot),root.z-from.getZ(slot))*rate;
  const pulse=Math.sin(phase),breath=Math.sin(time+seed);
  let height:number=WORLD_SCALE.carriedHeight;const carrierPose=carrier.getY(slot);
  if(carrierPose===1||carrierPose===18||carrierPose===19)height=.28;
  if(carrierPose>1.5&&carrierPose<3.5)height=Math.sin(time*4+carrier.getZ(slot))*.08+1.32;
  if(carrierPose===3)height+=WORLD_SCALE.stoolHeight-.605*PAWN_MODEL_SCALE;
  if(carrierPose===6)height=1.3;
  cache.set(slot,3,Math.abs(pulse)*.08*moving,moving<.5&&eating<.5&&posture<.5?breath*.006:0,height);
  for(let index=0;index<bones.length;index++){const bone=bones[index]!;
    let angle=0;if(bone===1)angle=pulse*.5*moving;else if(bone===2)angle=Math.sin(phase+Math.PI)*.6*moving;
    else if(bone>=3){angle=moving>.5?pulse*.06:eating>1?Math.sin(clamp((travelTime-seed)*10,0,Math.PI))*.9:eating*(Math.sin(time*5)*.12+.48);
      if(moving<.5&&eating<.5&&posture<.5)angle=breath*.03;angle+=gesture.headPitch;if(bone>=4)angle*=bone-4;}
    cache.set(slot,8+index,Math.cos(angle),Math.sin(angle));
  }
}

export function sampleMechRig(cache:ActorAnimationCache,slot:number,g:BufferGeometry,root:CachedActorPose,travelTime:number):void {
  const rig=g.getAttribute('aRig'),gait=g.getAttribute('aGait'),from=g.getAttribute('aFrom');
  const phase=gait.getX(slot)+Math.hypot(root.x-from.getX(slot),root.z-from.getZ(slot))*(2*Math.PI/1.12);
  const attack=Math.sin(clamp((travelTime-rig.getY(slot))/Math.max(.001,rig.getZ(slot)))*Math.PI);
  for(let bone=0;bone<8;bone++){
    let angle=0;
    if(bone===1||bone===2){angle=Math.sin(phase+(bone===2?Math.PI:0))*.14*rig.getX(slot);if(gait.getY(slot)===bone&&rig.getZ(slot)>0)angle+=attack*-1.1;}
    if(bone===3||bone===4||bone===6||bone===7){angle=Math.sin(phase+(bone===4||bone===6?Math.PI:0))*.48*rig.getX(slot);if(gait.getY(slot)===bone&&rig.getZ(slot)>0)angle+=attack*-.8;}
    if(bone===5&&gait.getY(slot)===9&&rig.getZ(slot)>0)angle=attack*.45;
    cache.set(slot,8+bone,Math.cos(angle),Math.sin(angle));
  }
}
