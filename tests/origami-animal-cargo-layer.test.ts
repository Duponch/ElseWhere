import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
// The contour renderer is outside these attachment contracts. Replace its
// raster/material construction only, leaving the real cargo batches/matrices.
vi.mock('../src/render/origami/contours',async()=>{
 const three=await import('three/webgpu');return{createOrigamiContour(){const geometry=new three.BufferGeometry(),material=new three.MeshBasicMaterial(),line=new three.Mesh(geometry,material);return{line,sync(){},rebuild(){},dispose(){line.removeFromParent();geometry.dispose();material.dispose();}};}};
});
import {AnimalCargoLayer282,type AnimalCargoSnapshot282} from '../src/render/AnimalCargoLayer282';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {SCHEMA_VERSION} from '../src/sim/types';
import type {WildAnimal} from '../src/sim/wildlife-state';
import type {AnimalSpeciesId} from '../src/sim/animal-species';
import {adultAgeTicks} from '../src/sim/animal-life';
import {WildlifeBodyScale} from '../src/render/wildlife-frame-state';
import {bestiaryAnimalCargoBack,bestiaryAnimalCargoTorso} from '../src/render/origami/bestiary-registry';
import {fitAnimalCargoBack} from '../src/render/origami/animal-cargo-back';
import {animalCoreProfile,animalParts} from '../src/render/animal-shape';

function actor(species:AnimalSpeciesId):WildAnimal{return{id:271,species,sex:'female',ageTicks:adultAgeTicks(species)*2,food:1,rest:1,state:'idle',path:[],x:4,z:7,nextDecision:100,domestic:{since:0,care:'best',tameness:1,nextDecay:500},haul:{phase:'holding',carryPileId:812,sinceCore:17}};}
function snapshot(animal:WildAnimal):AnimalCargoSnapshot282{return{schemaVersion:SCHEMA_VERSION,wildlife:{profile:'geographic-fauna-v3',rng:17892,animals:[animal],eatenPlants:0,eatenNutrition:0,eatenItems:0},piles:[{id:812,kind:'wood',item:'wood',quantity:8,owner:{type:'inventory',pawnId:animal.id}}]};}
const pose={x:6.25,y:.36,z:-4.75,yaw:.73};
function mesh(layer:AnimalCargoLayer282){const body=layer.group.children.find((object):object is THREE.InstancedMesh=>object instanceof THREE.InstancedMesh&&object.name==='Animal cargo282 — wood');if(!body)throw Error('Real wood batch absent');return body;}
function matrixClose(actual:THREE.Matrix4,expected:THREE.Matrix4){for(let i=0;i<16;i++)expect(Math.abs(actual.elements[i]!-expected.elements[i]!),`matrix component${i}`).toBeLessThan(2e-6);}

describe('real animal cargo batch attachment, typed record projection without simulation',()=>{
 it('matches bind roll/growth/yaw and item footprint for the two new carriers while Default and protected carriers keep historical matrices',()=>{
  const point=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),actual=new THREE.Matrix4(),expected=new THREE.Matrix4(),bodyScale=new WildlifeBodyScale();
  for(const style of ['default','origami'] as const)for(const species of ['cougar','megasloth','labrador-retriever','elephant'] as const){
   const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style}),layer=withGraphicsStyle(context,()=>new AnimalCargoLayer282()),animal=actor(species);
   try{
    for(const growth of [1,.57])for(const resting of [false,true]){
     animal.state=resting?'sleeping':'idle';animal.growthTracker={revision:1,value:Math.fround(growth),nextCheckCore:growth===1?null:240};const records=snapshot(animal),before=JSON.stringify(records);layer.update(records);layer.present({cpuPoseForId:()=>pose});const body=mesh(layer);body.getMatrixAt(0,actual);
     const base=style==='origami'?bestiaryAnimalCargoBack(species):undefined,torso=base?bestiaryAnimalCargoTorso(species):undefined,size=bodyScale.read(animal),bounds=body.geometry.boundingBox!,batchWidth=Math.max(.001,bounds.max.x-bounds.min.x),batchDepth=Math.max(.001,bounds.max.z-bounds.min.z),back=base&&torso?fitAnimalCargoBack(base,torso,batchWidth,batchDepth):undefined;
     let x=0,y:number,z:number,width:number,depth:number;
     if(back){
      // Independent affine matrix: start at the real compiled back, roll it
      // around the SpeciesRig trunk centre, then apply growth and root yaw.
      point.set(back[0],back[1]+.025,back[2]);if(resting)point.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/2)).add(new THREE.Vector3(back[5],back[6],0));width=back[3];depth=back[4];
     }else{
      const rings=animalCoreProfile(species).rings.filter(r=>r.headWeight===0),ring=rings.reduce((a,b)=>Math.abs(a.z)<Math.abs(b.z)?a:b),bodyCenter=animalParts(species)[0]!.center[1],restFloor=.025+Math.max(...rings.map(r=>r.halfWidth));
      x=resting?bodyCenter-ring.top-.025:0;y=resting?restFloor:ring.top+.025;z=ring.z;width=ring.halfWidth*1.8;depth=Math.max(.15,(Math.max(...rings.map(r=>r.z))-Math.min(...rings.map(r=>r.z)))*.6);point.set(x,y,z);
     }
     point.multiplyScalar(size).applyAxisAngle(new THREE.Vector3(0,1,0),pose.yaw).add(new THREE.Vector3(pose.x,pose.y,pose.z));const fit=size*Math.min(1,width/Math.max(.001,bounds.max.x-bounds.min.x),depth/Math.max(.001,bounds.max.z-bounds.min.z));
     rotation.setFromEuler(new THREE.Euler(0,pose.yaw,resting?Math.PI/2:0));expected.compose(point,rotation,scale.setScalar(fit));matrixClose(actual,expected);
     expect(layer.stats.activeCargo).toBe(1);expect(JSON.stringify(records)).toBe(before);const uploads=layer.stats.matrixUploads;expect(layer.present({cpuPoseForId:()=>pose})).toBe(false);expect(layer.stats.matrixUploads).toBe(uploads);expect(layer.stats.attachmentBuilds,'one clip per species/variant, independent of growth/rest and frame count').toBe(back?1:0);
    }
   }finally{layer.dispose();context.dispose();}
  }
 });
 it('retains true inventory/haul guards and restores compile counts without creating cargo for unrelated holders',()=>{
  const animal=actor('cougar'),records=snapshot(animal),layer=new AnimalCargoLayer282();
  try{
   records.piles[0]!.owner={type:'inventory',pawnId:animal.id+1};layer.update(records);expect(layer.stats.activeCargo).toBe(0);
   records.piles[0]!.owner={type:'inventory',pawnId:animal.id};layer.update(records);expect(layer.stats.activeCargo).toBe(1);layer.present({cpuPoseForId:()=>pose});const batch=mesh(layer);expect(batch.count).toBe(1);
   const restore=layer.prepareForCompile();restore();expect(batch.count).toBe(1);
   animal.state='dead';layer.update(records);expect(layer.stats.activeCargo).toBe(0);expect(batch.count).toBe(0);
  }finally{layer.dispose();}
 });
 it('caches each species/variant independently and keeps fitted attachments through batch capacity growth and handoffs',()=>{
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami'}),layer=withGraphicsStyle(context,()=>new AnimalCargoLayer282()),cougar=actor('cougar'),sloth=actor('megasloth'),records=snapshot(cougar);
  sloth.id=272;sloth.haul={phase:'holding',carryPileId:813,sinceCore:17};records.wildlife!.animals.push(sloth);records.piles.push({id:813,kind:'wood',item:'wood',quantity:8,owner:{type:'inventory',pawnId:sloth.id}});
  try{
   layer.update(records);layer.present({cpuPoseForId:()=>pose});expect(mesh(layer).count).toBe(2);expect(layer.stats.attachmentBuilds).toBe(2);
   layer.update(records);layer.present({cpuPoseForId:()=>pose});expect(layer.stats.attachmentBuilds).toBe(2);
   records.piles[0]!.quantity=16;layer.update(records);layer.present({cpuPoseForId:()=>pose});expect(layer.stats.attachmentBuilds).toBe(3);expect(layer.stats.geometryBuilds).toBe(2);
   records.piles[0]!.quantity=8;layer.update(records);layer.present({cpuPoseForId:()=>pose});expect(layer.stats.attachmentBuilds).toBe(3);expect(mesh(layer).count).toBe(2);
  }finally{layer.dispose();context.dispose();}
 });
});
