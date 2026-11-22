import { expect,test,vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { createWorld } from '../src/sim/engine';
import { ensureFireState } from '../src/sim/fire-rules';
import { AnimationDetail } from '../src/render/AnimationDetail';
import { FxAnimationCache } from '../src/render/FxAnimationCache';
import { FireLayer,attachedFireMesh,presentAttachedFire } from '../src/render/FireLayer';
import { ProjectileLayer } from '../src/render/ProjectileLayer';
import { ActionVfxLayer } from '../src/render/ActionVfxLayer';
import { StructureVfxLayer } from '../src/render/StructureVfxLayer';
import { WeatherPrecipitationLayer,precipitationHash,precipitationGlobalDetail,precipitationMapLayout } from '../src/render/WeatherPrecipitationLayer';

// Renderer-only cases below deliberately prepare projection records. They
// are not validated Engine Worlds, RAWs or Native/campaign authority. Pure
// cache/geometry assertions remain ordinary component contracts.
function iso(pixels=16):THREE.OrthographicCamera {
  const half=50/pixels,camera=new THREE.OrthographicCamera(-half,half,half,-half,.1,1000);
  camera.position.set(8,20,30);camera.lookAt(8,0,8);camera.updateProjectionMatrix();return camera;
}
function source(count:number):THREE.InstancedBufferGeometry {
  const result=new THREE.InstancedBufferGeometry();
  for(const name of ['aFrom','aTo','aTravel'])result.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(count*4),4));
  for(let slot=0;slot<count;slot++){(result.getAttribute('aFrom') as THREE.InstancedBufferAttribute).setXYZW(slot,8+slot,0,8,0);(result.getAttribute('aTo') as THREE.InstancedBufferAttribute).setXYZW(slot,8+slot,0,8,0);}
  return result;
}
function fireWorld(){const world=createWorld(331,32,32);ensureFireState(world).items=[{id:world.nextId++,x:8,z:8,size:.4,bornCore:world.tick*10,nextPulseCore:world.tick*10+15,complexCore:0,spreadCore:0}];return world;}

test.each([1,6])('medium FX preserve native classification with original flags and no CPU bake at x%i, including pause',(speed)=>{
  const detail=new AnimationDetail(),camera=iso(),cache=new FxAnimationCache(2,detail);let calls=0;
  const publish=()=>{calls++;cache.set(0,1,detail.frameTick);};
  detail.beginFrame(0,camera,100,100);expect(cache.sample(0,8,0,8,publish)).toBe(1);cache.flush();const initial=cache.get(0,1);expect(cache.get(0,0)).toBe(0);expect(calls).toBe(0);
  detail.beginFrame(40,camera,100,100+.24*speed);cache.sample(0,8,0,8,publish);expect(cache.get(0,1)).toBe(initial);
  detail.beginFrame(84,camera,100,100+.504*speed);expect(cache.sample(0,8,0,8,publish)).toBe(1);expect(cache.get(0,0)).toBe(0);expect(calls).toBe(0);
  const paused=cache.get(0,1);detail.beginFrame(168,camera,100,detail.frameTick);cache.sample(0,8,0,8,publish);expect(cache.get(0,1)).toBe(paused);expect(calls).toBe(0);
  detail.beginFrame(169,iso(5),100,detail.frameTick);expect(cache.sample(0,8,0,8,publish)).toBe(2);expect(cache.get(0,0)).toBe(2);expect(calls).toBe(0);
  detail.beginFrame(170,iso(50),100,detail.frameTick);expect(cache.sample(0,8,0,8,publish)).toBe(0);expect(cache.get(0,0)).toBe(0);expect(calls).toBe(0);
  detail.beginFrame(171,camera,100,detail.frameTick);expect(cache.sample(0,8,0,8,publish)).toBe(1);expect(cache.get(0,0)).toBe(0);expect(calls).toBe(0);cache.dispose();
});

test('far removes ground fire, precipitation and structural FX draws; complete detail restores current membership without changing World',()=>{
  const world=fireWorld(),before=structuredClone(world),detail=new AnimationDetail(),camera=iso(5),fire=new FireLayer(detail),structures=new StructureVfxLayer(detail),weather=new WeatherPrecipitationLayer(detail);
  const target=new THREE.Vector3(8,0,8),input={seed:world.seed,tick:world.tick,rainRate:1,snowRate:0,camera,target,strength:1,directionX:1,directionZ:0,daylight:1};
  try{
    detail.beginFrame(0,camera,100,world.tick);fire.adopt(world,true);structures.adopt(world,true);structures.setView(camera,target);fire.present(world.tick);structures.present(world.tick);weather.present(input);
    expect((fire.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(0);expect(fire.mesh.visible).toBe(false);expect(structures.smoke.geometry.instanceCount).toBe(0);expect(weather.mesh.geometry.instanceCount).toBe(0);
    detail.setSettings({...detail.settings,enabled:false});detail.beginFrame(1,camera,100,world.tick);fire.present(world.tick);structures.present(world.tick);weather.present(input);
    expect((fire.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1);expect(structures.smoke.geometry.instanceCount).toBeGreaterThan(0);expect(weather.mesh.geometry.instanceCount).toBeGreaterThan(0);expect(world).toEqual(before);
    ensureFireState(world).items=[];fire.adopt(world);structures.adopt(world);fire.present(world.tick);structures.present(world.tick);weather.present({...input,rainRate:0});
    expect((fire.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(0);expect(structures.smoke.geometry.instanceCount).toBe(0);expect(weather.mesh.geometry.instanceCount).toBe(0);
  }finally{fire.dispose();structures.dispose();weather.dispose();}
});

test('medium action FX update original pose streams before deadlines, hold unchanged uploads on pause and retract immediately',()=>{
  const world=createWorld(332,32,32);world.pawns.forEach(p=>{p.state='idle';});world.pawns[1]!.state='sleeping';
  const stream=source(world.pawns.length),detail=new AnimationDetail(),camera=iso(),clock={travelTime:uniform(0),blend:uniform(1)},layer=new ActionVfxLayer(clock,detail);
  try{
    detail.beginFrame(0,camera,100,100);layer.setView(camera);layer.update(world,stream);layer.present(100);
    const geometry=layer.mesh.geometry,slots=geometry.getAttribute('fxSlot');expect(geometry.instanceCount).toBe(1);expect(slots.getX(0)).toBe(1);
    const attr=geometry.getAttribute('aTo') as THREE.InstancedBufferAttribute,version=attr.version,point=Array.from(attr.array);
    (stream.getAttribute('aTo') as THREE.InstancedBufferAttribute).setX(1,10);(stream.getAttribute('aTo') as THREE.InstancedBufferAttribute).needsUpdate=true;
    const sourceAfter=Array.from(stream.getAttribute('aTo').array);
    detail.beginFrame(20,camera,100,101);layer.present(101);expect(attr.version).toBeGreaterThan(version);expect(Array.from(attr.array)).not.toEqual(point);
    expect(attr.getX(0)).toBe(10);expect(slots.getX(0)).toBe(1);expect(geometry.instanceCount).toBe(1);expect(Array.from(stream.getAttribute('aTo').array)).toEqual(sourceAfter);
    const movedVersion=attr.version,movedPoint=Array.from(attr.array);
    detail.beginFrame(40,camera,100,101);layer.present(101);expect(attr.version).toBe(movedVersion);expect(Array.from(attr.array)).toEqual(movedPoint);expect(slots.getX(0)).toBe(1);
    expect(layer.mesh.geometry).toBe(geometry);expect(geometry.getAttribute('aTo')).toBe(attr);expect(Array.from(stream.getAttribute('aTo').array)).toEqual(sourceAfter);
    world.pawns[1]!.state='idle';layer.update(world,stream);layer.present(101);expect(geometry.instanceCount).toBe(0);expect(layer.mesh.visible).toBe(false);expect(Array.from(stream.getAttribute('aTo').array)).toEqual(sourceAfter);
  }finally{layer.dispose();stream.dispose();}
});

test('attached flame compaction uses explicit pawn slots and leaves the shared actor source untouched',()=>{
  const detail=new AnimationDetail(),camera=iso(50),stream=source(3),clock={travelTime:uniform(0),blend:uniform(1)},mesh=attachedFireMesh(stream,clock,1,detail),fire=stream.getAttribute('aFire') as THREE.InstancedBufferAttribute;
  try{
    fire.setX(2,.5);fire.needsUpdate=true;const before=Array.from(fire.array);detail.beginFrame(0,camera,100,100);presentAttachedFire(mesh,stream,clock,detail);
    expect((mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1);expect(mesh.geometry.getAttribute('fxSlot').getX(0)).toBe(2);expect(mesh.geometry.getAttribute('aTo').getX(0)).toBe(10);expect(Array.from(fire.array)).toEqual(before);expect(mesh.geometry.getAttribute('aFire')).not.toBe(fire);
    detail.beginFrame(1,iso(5),100,100);presentAttachedFire(mesh,stream,clock,detail);expect((mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(0);expect(mesh.visible).toBe(false);
    fire.setX(2,0);fire.needsUpdate=true;detail.beginFrame(2,camera,100,100);presentAttachedFire(mesh,stream,clock,detail);expect((mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(0);
  }finally{mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();stream.dispose();}
});

test('attached-human fire stays below eight native vertex buffers during warm-up and compaction with exact Cone vertices',()=>{
  const stream=source(3),detail=new AnimationDetail(),clock={travelTime:uniform(0),blend:uniform(1)};
  stream.setAttribute('aMotion',new THREE.InstancedBufferAttribute(new Float32Array(12),4));
  const mesh=attachedFireMesh(stream,clock,1,detail),base=new THREE.ConeGeometry(.38,1.5,5,1);
  const bindings=()=>new Set(Object.values(mesh.geometry.attributes).map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a));
  try{
    expect(bindings().size).toBe(7);expect(mesh.geometry.getAttribute('aFrom')).toBe(stream.getAttribute('aFrom'));
    for(const name of ['position','normal','uv']){
      const a=mesh.geometry.getAttribute(name),b=base.getAttribute(name);expect(a.count).toBe(b.count);expect(a.itemSize).toBe(b.itemSize);
      for(let row=0;row<a.count;row++)for(let component=0;component<a.itemSize;component++)expect(a.getComponent(row,component)).toBe(b.getComponent(row,component));
    }
    expect(Array.from(mesh.geometry.index!.array)).toEqual(Array.from(base.index!.array));
    const fire=stream.getAttribute('aFire');fire.setX(1,.5);fire.needsUpdate=true;
    detail.beginFrame(0,iso(50),100,100);presentAttachedFire(mesh,stream,clock,detail);
    expect(bindings().size).toBe(7);expect((mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1);expect(mesh.geometry.getAttribute('fxSlot').getX(0)).toBe(1);
    expect(fire.getX(1)).toBe(.5);expect(mesh.geometry.getAttribute('aFire')).not.toBe(fire);
  }finally{base.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();stream.dispose();}
});

test('attached fire ignores a burning capacity tail after population shrink and resumes current actor ownership',()=>{
  const detail=new AnimationDetail(),stream=source(3),clock={travelTime:uniform(0),blend:uniform(1)},mesh=attachedFireMesh(stream,clock,1,detail);
  const geometry=mesh.geometry as THREE.InstancedBufferGeometry,fire=stream.getAttribute('aFire') as THREE.InstancedBufferAttribute;
  let releases=0;geometry.addEventListener('dispose',()=>{releases++;});
  try{
    fire.setX(2,.5);fire.needsUpdate=true;stream.instanceCount=0;detail.beginFrame(0,iso(50),100,100);presentAttachedFire(mesh,stream,clock,detail);
    expect(geometry.instanceCount).toBe(0);expect(mesh.visible).toBe(false);expect(releases).toBe(0);expect(geometry.getAttribute('aFrom')).toBe(stream.getAttribute('aFrom'));
    stream.instanceCount=3;detail.beginFrame(1,iso(50),100,100);presentAttachedFire(mesh,stream,clock,detail);
    expect(geometry.instanceCount).toBe(1);expect(geometry.getAttribute('fxSlot').getX(0)).toBe(2);expect(geometry.getAttribute('aTo').getX(0)).toBe(10);
    const owned=geometry.getAttribute('aFrom'),slots=geometry.getAttribute('fxSlot'),released=releases;
    stream.instanceCount=1;fire.setX(0,.25);fire.needsUpdate=true;detail.beginFrame(2,iso(50),100,100);presentAttachedFire(mesh,stream,clock,detail);
    expect(geometry.instanceCount).toBe(1);expect(slots.getX(0)).toBe(0);expect(geometry.getAttribute('aTo').getX(0)).toBe(8);expect(fire.getX(2)).toBe(.5);
    stream.instanceCount=0;detail.beginFrame(3,iso(50),100,100);presentAttachedFire(mesh,stream,clock,detail);
    expect(geometry.instanceCount).toBe(0);expect(mesh.visible).toBe(false);expect(geometry.getAttribute('aFrom')).toBe(owned);expect(releases).toBe(released);
    stream.instanceCount=3;detail.beginFrame(4,iso(50),100,100);presentAttachedFire(mesh,stream,clock,detail);
    expect(geometry.instanceCount).toBe(2);expect(mesh.visible).toBe(true);expect([slots.getX(0),slots.getX(1)]).toEqual([0,2]);expect(geometry.getAttribute('aTo').getX(1)).toBe(10);expect(geometry.getAttribute('aFrom')).toBe(owned);expect(owned).not.toBe(stream.getAttribute('aFrom'));
    expect([fire.getX(0),fire.getX(1),fire.getX(2)]).toEqual([.25,0,.5]);
  }finally{geometry.dispose();(mesh.material as THREE.Material).dispose();stream.dispose();}
});

test('projectile history owns primitive endpoints and expiry is independent of medium publication cadence',()=>{
  const world=createWorld(334,32,32),detail=new AnimationDetail(),layer=new ProjectileLayer(detail);
  // The presentation consumes only these confirmed primitive flight fields.
  world.tick=100;world.projectiles=[{id:1,emittedAtCore:1000,advancedAtCore:1000,weaponItem:'mini-turret-gun',flight:{origin:{x:8,z:8},destination:{x:10,z:8},speedPerCoreTick:1}} as NonNullable<typeof world.projectiles>[number]];
  try{
    detail.beginFrame(0,iso(),100,100);layer.adopt(world,true);layer.present(100.1);expect((layer.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1);
    world.projectiles[0]!.flight.origin.x=99;detail.beginFrame(20,iso(),100,100.2);layer.present(100.2);expect((layer.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(0);expect(layer.mesh.visible).toBe(false);
    const traces=(layer as unknown as {traces:Map<number,{from:{x:number}}>}).traces;expect(traces.get(1)!.from.x).toBe(8);
  }finally{layer.dispose();}
});

test('CPU precipitation facts reproduce the native unsigned PCG for wrap and signed seeds',()=>{
  const oracle=(seed:number)=>{const state=BigInt.asUintN(32,BigInt(seed>>>0)*747796405n+2891336453n),word=BigInt.asUintN(32,((state>>((state>>28n)+4n))^state)*277803737n),result=(word>>22n)^word;return Math.fround(Number(result)/4294967296);};
  for(const seed of [0,1,441,-1,0x7fffffff,0xffffffff])expect(precipitationHash(seed)).toBe(oracle(seed));
});

test('precipitation affine field bounds preserve per-anchor classification, zero far threshold and a plane crossing the camera',()=>{
  const detail=new AnimationDetail();
  const camera=(z:number,look:number,fov=50)=>{const c=new THREE.PerspectiveCamera(fov,1,.1,1000);c.position.set(16,12,z);c.lookAt(16,12,look);c.updateProjectionMatrix();return c;};
  for(const [c,viewport,expected] of [[camera(200,0),100,2],[camera(40,0,1),1000,0],[camera(-40,-80),100,2]] as const){
    detail.beginFrame(0,c,viewport,100);expect(precipitationGlobalDetail(detail,32,32)).toBe(expected);
    for(const x of [-.5,15.5,31.5])for(const z of [-.5,15.5,31.5])expect(detail.classify(x,12,z)).toBe(expected);
  }
  detail.setSettings({...detail.settings,farPixels:0});detail.beginFrame(1,camera(200,0),100,100);
  expect(precipitationGlobalDetail(detail,32,32)).toBe(-1);expect(detail.classify(16,12,16)).toBe(1);
  detail.setSettings({...detail.settings,farPixels:8});detail.beginFrame(2,camera(16,-40),100,100);
  // Both depth-extreme corners classify far, but the interior is near.
  // Rejecting solely because all corners are far would erase real particles.
  expect(detail.classify(16,12,-.5)).toBe(2);expect(detail.classify(16,12,31.5)).toBe(2);expect(detail.classify(16,12,15)).toBe(0);
  expect(precipitationGlobalDetail(detail,32,32)).toBe(-1);
});

test('precipitation OFF restores the full native prefix without per-particle classification, then resumes real near/far fields',()=>{
  const detail=new AnimationDetail(),layer=new WeatherPrecipitationLayer(detail),camera=new THREE.PerspectiveCamera(50,1,.1,1000),target=new THREE.Vector3(16,12,0);
  camera.position.set(16,12,40);camera.lookAt(target);camera.updateProjectionMatrix();
  const input={seed:331,tick:100,rainRate:1,snowRate:0,camera,target,strength:1,directionX:1,directionZ:0,daylight:1};
  const count=Math.round(precipitationMapLayout(32,32).capacity*.82),classify=vi.spyOn(detail,'classify');
  try{
    detail.beginFrame(0,camera,100,100);layer.present(input);expect(layer.mesh.geometry.instanceCount).toBeGreaterThan(0);expect(layer.mesh.geometry.instanceCount).toBeLessThan(count);
    detail.setSettings({...detail.settings,enabled:false});classify.mockClear();detail.beginFrame(20,camera,100,101);layer.present({...input,tick:101});
    expect(classify).not.toHaveBeenCalled();expect(layer.mesh.geometry.instanceCount).toBe(count);expect(layer.mesh.visible).toBe(true);
    const slots=layer.mesh.geometry.getAttribute('fxSlot') as THREE.InstancedBufferAttribute;for(let row=0;row<count;row++)expect(slots.getX(row)).toBe(row);
    const version=slots.version;detail.beginFrame(40,camera,100,102);layer.present({...input,tick:102});expect(classify).not.toHaveBeenCalled();expect(slots.version).toBe(version);
    detail.setSettings({...detail.settings,enabled:true});camera.position.z=200;camera.lookAt(target);detail.beginFrame(60,camera,100,103);classify.mockClear();layer.present({...input,tick:103});
    expect(classify).not.toHaveBeenCalled();expect(layer.mesh.geometry.instanceCount).toBe(0);expect(layer.mesh.visible).toBe(false);
    detail.setSettings({...detail.settings,farPixels:0});detail.beginFrame(80,camera,100,104);layer.present({...input,tick:104});expect(layer.mesh.geometry.instanceCount).toBe(count);
    camera.fov=1;camera.position.z=40;camera.lookAt(target);camera.updateProjectionMatrix();detail.beginFrame(100,camera,1000,105);classify.mockClear();layer.present({...input,tick:105});
    expect(classify).not.toHaveBeenCalled();expect(layer.mesh.geometry.instanceCount).toBe(count);expect(layer.mesh.visible).toBe(true);for(let row=0;row<count;row++)expect(slots.getX(row)).toBe(row);
  }finally{classify.mockRestore();layer.dispose();}
});
