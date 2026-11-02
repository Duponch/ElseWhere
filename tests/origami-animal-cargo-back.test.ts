// Product pure geometry and cached attachment contracts; no World or renderer.
import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {deriveAnimalCargoBack as deriveCargoBack,cargoBackPoint,compiledCargoBackPoint,cargoBackMetadata,fitAnimalCargoBack,type AnimalCargoBack as CargoBackProposal} from '../src/render/origami/animal-cargo-back';
import {BESTIARY_ANIMAL_SPECIES,bestiaryAnimalCargoBack,bestiaryAnimalCargoTorso,bestiaryAnimalGeometry} from '../src/render/origami/bestiary-registry';
import {ORIGAMI_ANIMAL_REFERENCES,origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {animalCoreProfile} from '../src/render/animal-shape';

describe('actual Origami torso cargo attachment',()=>{
 it('clips an oblique actual plane to the cargo rectangle instead of using the global AABB height',()=>{
  const plane=new Float32Array([-1,.3,-2,1,.9,-2,1,1.7,2,-1,.3,-2,1,1.7,2,-1,1.1,2]),before=plane.slice();
  const box=new THREE.Box3(new THREE.Vector3(-1,.3,-2),new THREE.Vector3(1,1.7,2)),back=deriveCargoBack({torsoTriangles:plane,torsoBounds:box,bodyBounds:box,bodyCenter:.9,widthFraction:.8,depthFraction:.5});
  expect(back?.width).toBeCloseTo(1.6);expect(back?.depth).toBeCloseTo(2);expect(back?.y).toBeCloseTo(1.44,6);expect(Array.from(plane)).toEqual(Array.from(before));
 });
 it('ignores a tall body feature outside the actual cargo footprint',()=>{
  const faces=new Float32Array([-1,1,-2,1,1,-2,1,1,2,-1,1,-2,1,1,2,-1,1,2,-.1,3,1.7,.1,3,1.7,0,3,1.9]);
  const box=new THREE.Box3(new THREE.Vector3(-1,0,-2),new THREE.Vector3(1,3,2)),back=deriveCargoBack({torsoTriangles:faces,torsoBounds:box,bodyBounds:box,bodyCenter:1,widthFraction:.8,depthFraction:.5});expect(back?.y).toBe(1);
 });
 it('reduces width and depth when AABB corners would extend beyond a diamond-shaped real back',()=>{
  const diamond=new Float32Array([-1,1,0,0,1,1,1,1,0,-1,1,0,1,1,0,0,1,-1]),bounds=new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,1,1));
  const back=deriveCargoBack({torsoTriangles:diamond,torsoBounds:bounds,bodyBounds:bounds,bodyCenter:.5});if(!back)throw Error('Diamond support absent');
  expect(back.footprintScale).toBeCloseTo(2/3,5);expect(back.width*.5+back.depth*.5).toBeLessThanOrEqual(1+1e-6);expect(back.y).toBe(1);
 });
 it('places small cargo on its actual oblique footprint rather than the highest point of the full permitted back',()=>{
  // Independent plane equation y=1+.3*x+.2*z. The small rectangle spans
  // x±.1,z±.2, so its actual maximum is1.07, not the full-back maximum1.51.
  const plane=new Float32Array([-1,.3,-2,1,.9,-2,1,1.7,2,-1,.3,-2,1,1.7,2,-1,1.1,2]),bounds=new THREE.Box3(new THREE.Vector3(-1,.3,-2),new THREE.Vector3(1,1.7,2)),surface=deriveCargoBack({torsoTriangles:plane,torsoBounds:bounds,bodyBounds:bounds,bodyCenter:.9});if(!surface)throw Error('Plane support absent');
  const base=cargoBackMetadata(surface),small=fitAnimalCargoBack(base,plane,.2,.4),large=fitAnimalCargoBack(base,plane,1.8,2.4),oversized=fitAnimalCargoBack(base,plane,4,8);if(!small||!large||!oversized)throw Error('Fitted support absent');
  expect(small[1]).toBeCloseTo(1.07,6);expect(large[1]).toBeCloseTo(1.51,6);expect(small[1]).toBeLessThan(large[1]-.4);
  expect(oversized[3]).toBeCloseTo(1.2,6);expect(oversized[4]).toBeCloseTo(2.4,6);expect(oversized[1]).toBeCloseTo(1.42,6);expect(base[1]).toBe(surface.y);expect(Object.isFrozen(small)).toBe(true);
 });
 it('matches the real resting quarter-roll followed by growth and nontrivial yaw exactly once',()=>{
  const back:CargoBackProposal={x:.17,y:1.44,z:-.23,width:.8,depth:1,bodyCenter:.9,restFloor:1.325,supportTriangles:2,footprintScale:1},pose={x:8.25,y:-.4,z:-9.1,yaw:.73};
  for(const growth of [.47,1,1.6])for(const resting of [false,true]){
   const expected=new THREE.Vector3(back.x,back.y+.025,back.z);if(resting)expected.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/2)).add(new THREE.Vector3(back.bodyCenter,back.restFloor,0));expected.multiplyScalar(growth).applyAxisAngle(new THREE.Vector3(0,1,0),pose.yaw).add(new THREE.Vector3(pose.x,pose.y,pose.z));
   expect(cargoBackPoint(back,pose,growth,resting).distanceTo(expected)).toBeLessThan(1e-10);
  }
 });
 it('reproduces the analytic cougar correction from the actual cached presentation template',()=>{
  const back=bestiaryAnimalCargoBack('cougar');if(!back)throw Error('Actual cougar attachment absent');expect(back).toHaveLength(8);expect(Object.isFrozen(back)).toBe(true);
  expect(back[1]).toBeCloseTo((.93648-.01)*1.22/1.36,6);
  const rings=animalCoreProfile('cougar').rings.filter(r=>r.headWeight===0),legacy=rings.reduce((a,b)=>Math.abs(a.z)<Math.abs(b.z)?a:b);
  expect(legacy.top-back[1]).toBeGreaterThan(.10);expect(legacy.top-back[1]).toBeLessThan(.12);
  const canonical=bestiaryAnimalGeometry(1,'cougar',false);try{expect(bestiaryAnimalCargoBack('cougar')===back,'canonical compile cannot replace the presentation attachment').toBe(true);}finally{canonical?.dispose();const wear:unknown=canonical?.userData.origamiWear;if(wear instanceof THREE.BufferGeometry)wear.dispose();}
 });
 it('caches exactly eight finite numbers for all42 and matches the actual SpeciesRig body centre/restFloor, never the old11',()=>{
  expect(BESTIARY_ANIMAL_SPECIES).toHaveLength(42);
  for(const id of BESTIARY_ANIMAL_SPECIES){const geometry=origamiAnimalPresentationGeometry(1,id);if(!geometry)throw Error('Actual body absent: '+id);
   try{const back=bestiaryAnimalCargoBack(id),torso=bestiaryAnimalCargoTorso(id);if(!back||!torso)throw Error('Actual rigid torso unsupported: '+id);expect(back.length,id).toBe(8);expect(back.every(Number.isFinite),id).toBe(true);expect(back[3],id).toBeGreaterThan(0);expect(back[4],id).toBeGreaterThan(0);expect(back[7],id).toBeGreaterThan(0);expect(back[7],id).toBeLessThanOrEqual(1);expect(geometry.userData.origamiCargoBack===back,id+' shares metadata').toBe(true);expect(bestiaryAnimalCargoBack(id)===back,id+' repeated access does not rebuild').toBe(true);
    expect(geometry.userData.origamiCargoTorso===torso,id+' shares original Float32 torso').toBe(true);expect(bestiaryAnimalCargoTorso(id)===torso,id+' source corners stay cached').toBe(true);
    const positions=geometry.getAttribute('position'),actual=new Set<string>();for(let i=0;i<positions.count;i++)actual.add(`${positions.getX(i)},${positions.getY(i)},${positions.getZ(i)}`);for(let i=0;i<torso.length;i+=3)if(!actual.has(`${torso[i]},${torso[i+1]},${torso[i+2]}`))throw Error(id+': cargo source corner absent from the actual body');
    geometry.computeBoundingBox();expect(back[6],id+' restFloor').toBe(.025-geometry.boundingBox!.min.x);expect(back[5],id+' pivot').toBe(geometry.userData.origamiBodyCenter);
   }finally{geometry.dispose();const wear:unknown=geometry.userData.origamiWear;if(wear instanceof THREE.BufferGeometry)wear.dispose();}
  }
  for(const id of Object.keys(ORIGAMI_ANIMAL_REFERENCES)){expect(bestiaryAnimalCargoBack(id),id+' protected branch').toBeUndefined();expect(bestiaryAnimalCargoTorso(id),id+' protected source').toBeUndefined();}
 },20000);
 it('uses the same cached values for an allocation-free transform at nontrivial growth/yaw/rest poses',()=>{
  const back:CargoBackProposal={x:.17,y:1.44,z:-.23,width:.8,depth:1,bodyCenter:.9,restFloor:1.325,supportTriangles:2,footprintScale:.8},metadata=cargoBackMetadata(back),target=new THREE.Vector3(),pose={x:8.25,y:-.4,z:-9.1,yaw:.73};
  for(const growth of [.47,1,1.6])for(const resting of [false,true]){const expected=cargoBackPoint(back,pose,growth,resting),actual=compiledCargoBackPoint(metadata,pose,growth,resting,target);expect(actual===target).toBe(true);expect(actual.distanceTo(expected)).toBeLessThan(1e-10);}
 });
});
