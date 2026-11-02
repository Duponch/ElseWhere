import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {origamiHumanGeometry,ORIGAMI_HUMAN_BIND,HUMAN_REFERENCE_SCALE} from '../src/render/origami/human-geometry';
import {ORIGAMI_WEAPON_BIND,ORIGAMI_EQUIPMENT_HAND,ORIGAMI_EQUIPMENT_BELT,ORIGAMI_EQUIPMENT_SLING,encodeOrigamiEquipment,origamiEquipmentPoint,origamiEquipmentFlags,origamiWeaponVisualSignal,type OrigamiWeaponKind,type OrigamiEquipmentState} from '../src/render/origami/equipment-pose';
import {RESIDENT_WEAPON_VISUALS269} from '../src/render/weapon-shape';
import {BODY_PROPORTIONS} from '../src/render/pawn-appearance-shape';
import {ActorAnimationCache} from '../src/render/ActorAnimationCache';
import {AnimationDetail} from '../src/render/AnimationDetail';
import {samplePawnRig} from '../src/render/actor-animation-sampling';
import {PAWN_MODEL_SCALE} from '../src/world/scale';

type Point=readonly [number,number,number];
const point=(p:Point)=>new THREE.Vector3(...p);
const gripBind=(kind:OrigamiWeaponKind):Point=>{const b=ORIGAMI_WEAPON_BIND[kind];return [.205+b.grip[2]/PAWN_MODEL_SCALE*b.sign,.68+b.grip[0]/PAWN_MODEL_SCALE*b.sign,b.grip[1]/PAWN_MODEL_SCALE];};
const state=(kind:OrigamiWeaponKind,ready=false,strike=false):OrigamiEquipmentState=>({pose:0,activity:0,cargo:0,reach:.63,recoil:.42,equipment:encodeOrigamiEquipment(RESIDENT_WEAPON_VISUALS269.find(v=>v.item===kind)!.equipment,ready,strike)});
const expectPoint=(actual:Point,expected:Point)=>{for(let i=0;i<3;i++)expect(actual[i]).toBeCloseTo(expected[i]!,8);};

test('render bits preserve every resident type and material, are idempotent, and only confirmed owned tools produce a strike signal',()=>{
 for(const visual of RESIDENT_WEAPON_VISUALS269)for(let material=0;material<8;material++)for(const ready of [false,true])for(const strike of [false,true]){
  const code=visual.equipment+material/8,encoded=encodeOrigamiEquipment(code,ready,strike);
  expect(Math.floor(encoded)).toBe(Math.floor(code));expect(Math.round((encoded%1)*8)).toBe(Math.round((code%1)*8));expect(encodeOrigamiEquipment(encoded,ready,strike)).toBe(encoded);
 }
 const pawn={state:'idle' as const};expect(origamiWeaponVisualSignal(pawn,'steel-longsword')).toEqual({ready:false,strike:false});
 expect(origamiWeaponVisualSignal({...pawn,draft:{lastActiveTick:100,target:null,queue:[]}},'steel-longsword')).toEqual({ready:true,strike:false});
 const melee={order:null,strike:{targetId:2,atCore:10,untilCore:100,tool:'right-fist' as const,outcome:'hit' as const}};
 expect(origamiWeaponVisualSignal({...pawn,melee},'steel-longsword')).toEqual({ready:false,strike:false});
 expect(origamiWeaponVisualSignal({...pawn,melee:{...melee,strike:{...melee.strike,tool:'knife-point'}}},'plasteel-knife')).toEqual({ready:true,strike:true});
 expect(origamiWeaponVisualSignal({...pawn,state:'dead',melee},'steel-longsword')).toEqual({ready:false,strike:false});
});

test('all seven real resident geometries keep the authored grip at the belt/sling or exactly at a nontrivial moving hand without scaling their parts',()=>{
 const geometry=origamiHumanGeometry(true,true,true,true),position=geometry.getAttribute('position'),dye=geometry.getAttribute('pawnRigTraits');
 const hand:Point=[.37,.81,.29],belt:Point=[.41,.58,-.07],sling:Point=[.13,.83,-.24];
 try{for(const visual of RESIDENT_WEAPON_VISUALS269){
  const kind=visual.item,b=ORIGAMI_WEAPON_BIND[kind],indices=Array.from({length:position.count},(_,i)=>i).filter(i=>dye.getY(i)===visual.dye);
  expect(indices.length).toBeGreaterThan(24);const a=indices[1]!,c=indices[13]!,pa:Point=[position.getX(a),position.getY(a),position.getZ(a)],pc:Point=[position.getX(c),position.getY(c),position.getZ(c)];
  for(const ready of [false,true])for(const pose of [0,7,8,15,17]){
   const s={...state(kind,ready,ready),pose,activity:kind==='longsword-family'?10:kind==='spear-family'?11:kind==='mace-family'?6:0};
   const anchor=b.sling?sling:belt,held=origamiEquipmentFlags(s).held;
   expectPoint(origamiEquipmentPoint(kind,gripBind(kind),hand,anchor,s),held?hand:anchor);
   const placedA=origamiEquipmentPoint(kind,pa,hand,anchor,s),placedC=origamiEquipmentPoint(kind,pc,hand,anchor,s);
   expect(point(placedA).distanceTo(point(placedC))).toBeCloseTo(point(pa).distanceTo(point(pc)),8);
  }
 }}finally{for(const key of ['origamiLines','origamiWear'])geometry.userData[key]?.dispose();geometry.dispose();}
});

test('actual cached arm coefficients across four morphologies put grips on the same source hand and crouch frame as the native rig',()=>{
 const geometry=origamiHumanGeometry(),cache=new ActorAnimationCache(new AnimationDetail());cache.ensureCapacity(1);
 for(const [name,size]of [['aMotion',4],['aFrom',4],['aCargo',4],['aShape',4],['aHairBlood',4]] as const)geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(size),size));
 const motion=geometry.getAttribute('aMotion'),shape=geometry.getAttribute('aShape'),hair=geometry.getAttribute('aHairBlood'),root={x:.4,y:.1,z:-.3,yaw:.47},time=.71,travel=.37,phase=.23;
 hair.setXYZW(0,.31,.22,.13,0);
 try{for(const body of [0,1,2,4])for(const pose of [0,7,8,17]){
  shape.setXYZW(0,body,0,0,0);motion.setXYZW(0,0,10,pose,phase);samplePawnRig(cache,0,geometry,root,time,travel);
  const shoulder=BODY_PROPORTIONS[body]![0],pivot=new THREE.Vector3(ORIGAMI_HUMAN_BIND.shoulderX*shoulder,ORIGAMI_HUMAN_BIND.shoulderY,0),hand=point(ORIGAMI_EQUIPMENT_HAND);hand.x*=shoulder;hand.sub(pivot);
  const reach=Math.sin(Math.min(1,Math.max(0,(travel-phase)*4))*Math.PI),fight=time*8+body*3.7+.31*7;
  const nativeAngle=pose===7?-1.54:pose===8?Math.sin(fight+Math.PI)*.29-.95-reach*.85:pose===17?reach*-.9-.2:Math.sin(phase)*0; // activity10 gives the ordinary working-arm contribution below.
  const ordinary=Math.sin(time*12+phase)*.35-.8;
  const angle=pose===0?ordinary:nativeAngle;
  expect(cache.get(0,11,0)).toBeCloseTo(Math.cos(angle),6);expect(cache.get(0,11,1)).toBeCloseTo(Math.sin(angle),6);
  hand.applyAxisAngle(new THREE.Vector3(1,0,0),angle).add(pivot);
  const cached=point(ORIGAMI_EQUIPMENT_HAND);cached.x*=shoulder;cached.sub(pivot);const y=cached.y,z=cached.z,c=cache.get(0,11,0),s=cache.get(0,11,1);cached.y=y*c-z*s;cached.z=y*s+z*c;cached.add(pivot);cached.y+=cache.get(0,11,2);cached.z+=cache.get(0,11,3);
  if(pose===8){const yOffset=Math.sin(fight*2)*.014,zOffset=Math.sin(fight)*.025;hand.y+=yOffset;hand.z+=zOffset;cached.y+=cache.get(0,19,0);cached.z+=cache.get(0,19,1);}
  if(pose===17){const convert=(p:THREE.Vector3)=>{const yy=p.y-ORIGAMI_HUMAN_BIND.hipY,zz=p.z;p.y=yy*.91-zz*.42+ORIGAMI_HUMAN_BIND.hipY-.12*(ORIGAMI_HUMAN_BIND.hipY-ORIGAMI_HUMAN_BIND.footY)/.5;p.z=yy*.42+zz*.91+.075*(ORIGAMI_HUMAN_BIND.hipY-ORIGAMI_HUMAN_BIND.footY)/.5;};convert(hand);convert(cached);}
  expect(hand.distanceTo(cached)).toBeLessThan(1e-6);
  const kind='longsword-family',sword={...state(kind,true,true),pose,activity:10,reach,recoil:0};
  expectPoint(origamiEquipmentPoint(kind,gripBind(kind),hand.toArray() as [number,number,number],ORIGAMI_EQUIPMENT_BELT,sword),hand.toArray() as [number,number,number]);
 }}finally{cache.dispose();for(const key of ['origamiLines','origamiWear'])geometry.userData[key]?.dispose();geometry.dispose();}
});

test('cargo, reserved tools, work, missing main arm and reclining retain stowed equipment; lying transforms apply once to its grip',()=>{
 const kind='longsword-family',base=state(kind,true,true),hand:Point=[.4,.9,.3],belt=ORIGAMI_EQUIPMENT_BELT;
 const lying=(p:Point):Point=>[p[0],p[2]+.19,ORIGAMI_HUMAN_BIND.hipY+.04*((ORIGAMI_HUMAN_BIND.hipY-ORIGAMI_HUMAN_BIND.footY)/.5)-p[1]];
 for(const patch of [{cargo:4},{cargo:-1},{activity:-31},{pose:11},{pose:14},{pose:16},{pose:18},{pose:19},{limbMask:2}]){
  const s={...base,...patch};expect(origamiEquipmentFlags(s).held).toBe(0);
  const grip=origamiEquipmentPoint(kind,gripBind(kind),hand,belt,s);expectPoint(grip,belt);expectPoint(lying(grip),lying(belt));
 }
 expectPoint(origamiEquipmentPoint(kind,gripBind(kind),hand,belt,{...base,equipment:encodeOrigamiEquipment(6,true,false),pose:8,reach:1}),hand);
 expect(origamiEquipmentFlags({...base,equipment:encodeOrigamiEquipment(6,true,false),pose:8,reach:1}).attack).toBe(0);
 expect(ORIGAMI_EQUIPMENT_SLING[2]).toBeLessThan(0);expect(HUMAN_REFERENCE_SCALE).toBeGreaterThan(0);
});
