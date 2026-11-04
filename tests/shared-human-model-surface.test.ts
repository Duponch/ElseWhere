import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {HumanModels} from '../src/render/models/HumanModels';
import {HumanCargoModel} from '../src/render/models/HumanCargoModel';
import {origamiHumanGeometry} from '../src/render/origami/human-geometry';
import {cargoGeometry,selectCargoGeometryKinds,prepareCargoGeometryForCompile} from '../src/render/pawn-geometry';

test('complete common human model retains each canonical triangle, clinical alias, authored paint UV and resident equipment',()=>{
 const features={smithing:true,mace:true,longsword:true,spear:true},models=new HumanModels(),canonical=origamiHumanGeometry(true,true,true,true,false,false),model=models.get(features),body=model.createGeometry(),other=model.createGeometry();let bodyRetired=false;
 try{
  expect(models.get(features)).toBe(model);expect(model.key).not.toMatch(/pastel|gouache|default|origami/);expect(body).not.toBe(other);expect(body.index!.count).toBe(canonical.index!.count);expect(body.getAttribute('pawnRigTraits').itemSize).toBe(4);
  const sourceIndex=canonical.index!,targetIndex=body.index!,fields=['position','normal','color','boneId','dye','origamiMaterialProfile','bindPivot','uv'] as const;
  let exact=true;for(let corner=0;corner<sourceIndex.count&&exact;corner++){const old=sourceIndex.getX(corner),next=targetIndex.getX(corner);for(const name of fields){const a=canonical.getAttribute(name),b=body.getAttribute(name);for(let component=0;component<a.itemSize;component++)if(a.getComponent(old,component)!==b.getComponent(next,component))exact=false;}}
  expect(exact,'all actual canonical triangle corners and aliases').toBe(true);
  const traits=body.getAttribute('pawnRigTraits');for(let vertex=0;vertex<traits.count;vertex++){expect(traits.getW(vertex)).toBe(model.strokes.faceIds[vertex]);expect(traits.getW(vertex)).toBeGreaterThanOrEqual(0);expect(traits.getW(vertex)).toBeLessThan(model.strokes.faceCount);}
  const staticBuffers=new Set(Object.values(body.attributes).map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a));expect(staticBuffers.size).toBe(1);expect(body.userData.origamiLines).toBeUndefined();expect(body.userData.origamiWear).toBeUndefined();expect(body.userData.origamiHumanParts).toEqual(canonical.userData.origamiHumanParts);
  body.dispose();bodyRetired=true;expect(()=>model.assertCurrent()).not.toThrow();expect(other.getAttribute('position').count).toBeGreaterThan(0);
 }finally{if(!bodyRetired)body.dispose();other.dispose();canonical.dispose();models.dispose();}
},60000);

test('carried and released items borrow one complete model and preserve real cargo ranges and preparation',()=>{
 const source=cargoGeometry(),model=new HumanCargoModel(),carried=model.createGeometry(),released=model.createGeometry();let carriedRetired=false;
 try{
  const actual=carried.index!,expected=source.getAttribute('position'),fields=['position','normal','color','cargoKind','corpsePartMask','uv'] as const;expect(actual.count).toBe(expected.count);let exact=true;
  for(let corner=0;corner<actual.count&&exact;corner++){const vertex=actual.getX(corner);for(const name of fields){const a=source.getAttribute(name),b=carried.getAttribute(name);for(let c=0;c<a.itemSize;c++)if(a.getComponent(corner,c)!==b.getComponent(vertex,c))exact=false;}}
  expect(exact,'all item placements, tints, source UVs and masks').toBe(true);expect(carried.userData.cargoRanges).toEqual(source.userData.cargoRanges);expect(carried.userData.cargoRangesByKind).toEqual(source.userData.cargoRangesByKind);expect(carried.groups).toEqual([]);expect(released.groups).toEqual([]);
  const buffers=new Set(Object.values(carried.attributes).map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a));expect(buffers.size).toBe(1);expect(model.strokes.edgeCount).toBeGreaterThan(0);
  selectCargoGeometryKinds(carried,new Set([4]));expect(carried.groups).toEqual([source.userData.cargoRangesByKind[4]]);expect(released.groups).toEqual([]);const restore=prepareCargoGeometryForCompile(released);expect(released.groups[0]).toEqual(source.userData.cargoRangesByKind[4]);restore();expect(released.groups).toEqual([]);
  carried.dispose();carriedRetired=true;expect(()=>model.strokes.assertCurrent()).not.toThrow();
 }finally{if(!carriedRetired)carried.dispose();source.dispose();released.dispose();model.dispose();}
},60000);
