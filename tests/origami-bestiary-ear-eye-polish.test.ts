import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {buildBestiaryAnimal} from '../src/render/origami/bestiary-registry';
import {describeBestiaryAnimal} from '../src/render/origami/bestiary-geometry';
import {corpseVisualPartBit} from '../src/render/corpse-presentation';
import {bestiaryPaintProfile} from '../src/render/origami/reference-profiles';
import type {BestiaryMesh} from '../src/render/origami/bestiary-types';
function dispose(root:THREE.Object3D):void{root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});}
describe('bestiary Native ear and eye contrast corrections',()=>{
 it('adds one pair of real-ear-owned pieces to ibex, boar and megasloth without duplicating existing ears',()=>{
  for(const species of ['ibex','wild-boar','megasloth']){
   const root=buildBestiaryAnimal(species)!;
   try{
    const plan=describeBestiaryAnimal(species,root);
    for(const side of ['left','right'] as const){
     const ear=root.getObjectByName(`${side}-ear-added`) as BestiaryMesh;
     expect(ear).toBeDefined();const matches:THREE.Object3D[]=[];root.traverse(object=>{if(object.name===`${side}-ear-added`)matches.push(object);});expect(matches).toHaveLength(1);
     const part=plan.parts.find(part=>part.mesh===ear)!;expect(part.nativePart).toBe(`${side}-ear`);expect(part.maskBit).toBe(corpseVisualPartBit(`${side}-ear`,species));expect(part.maskBit).toBeGreaterThan(0);
    }
    expect(root.userData.referenceEyeMeshes).toHaveLength(2);
   }finally{dispose(root);}
  }
  const existing=buildBestiaryAnimal('warg')!;
  try{expect(existing.getObjectByName('left-ear-added')).toBeUndefined();expect(existing.getObjectByName('right-ear-added')).toBeUndefined();}finally{dispose(existing);}
 });
 it('uses a complete contrasting amber eye profile on the raccoon without changing its two eye surfaces or masks',()=>{
  const root=buildBestiaryAnimal('raccoon')!;
  try{
   const eyes=root.userData.referenceEyeMeshes!;expect(eyes).toHaveLength(2);const plan=describeBestiaryAnimal('raccoon',root);
   for(const eye of eyes){
    expect(eye.material.userData.referencePaintKey).toBe('matBoomSacAmber');expect(eye.material.userData.referencePaintIndex).toBe(bestiaryPaintProfile('matBoomSacAmber'));
    const surface=eye.userData.referenceEyeSurface!;expect(surface.clearance).toBe(.001);eye.geometry.computeBoundingBox();const depth=eye.geometry.boundingBox!.getSize(new THREE.Vector3()).z;
    const normal=new THREE.Vector3().fromArray(surface.normal),offset=eye.position.clone().sub(new THREE.Vector3().fromArray(surface.point));expect(offset.dot(normal)).toBeCloseTo(depth*.5+.001,9);
    const part=plan.parts.find(part=>part.mesh===eye)!;expect(part.eyeMark).toBe(0);expect(part.maskBit).toBe(corpseVisualPartBit(eye.name==='left-eye'?'left-eye':'right-eye','raccoon'));
   }
   for(const side of [-1,1]){const mask=root.getObjectByName(`raccoon-mask-${side}`) as BestiaryMesh;expect(mask.material.userData.referencePaintKey).toBe('matCharcoalGouache');expect(mask.material).not.toBe(eyes[0].material);}
  }finally{dispose(root);}
 });
});
