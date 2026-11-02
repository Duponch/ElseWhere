import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {indexExactStaticVertices} from '../src/render/origami/static-index';
import {origamiHumanGeometry} from '../src/render/origami/human-geometry';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';

const instance=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
describe('exact immutable Origami body indexing',()=>{
 it('retains every triangle corner value and buffer identity across actual human and animal rigs',()=>{
  const geometries=[origamiHumanGeometry(true,true,true,true),...['elephant','husky','hare','deer','muffalo'].map(species=>origamiAnimalPresentationGeometry(2,species)!)];
  for(const g of geometries){
   const attrs={...g.attributes},before=g.index?Array.from(g.index.array):Array.from({length:g.getAttribute('position').count},(_,i)=>i),groups=g.groups.map(group=>({...group})),range={...g.drawRange};
   const facts=indexExactStaticVertices(g);expect(facts.indices).toBe(before.length);expect(facts.mergedVertices).toBeGreaterThan(0);expect(facts.referencedVertices).toBeLessThan(facts.vertices);
   expect(g.groups).toEqual(groups);expect(g.drawRange).toEqual(range);
   for(const [name,a]of Object.entries(attrs)){expect(g.getAttribute(name)).toBe(a);if(instance(a))continue;
    for(let corner=0;corner<before.length;corner++)for(let c=0;c<a.itemSize;c++)expect(a.getComponent(g.index!.getX(corner),c)).toBe(a.getComponent(before[corner]!,c));
   }
   g.dispose();
  }
 });
 it('keeps distinct normals, UV seams, clinical owners, bind pivots and signed zero',()=>{
  const g=new THREE.BufferGeometry(),positions=new Float32Array(8*3);positions[7*3]=-0;g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  for(const name of ['normal','uv','owner','bindPivot'])g.setAttribute(name,new THREE.BufferAttribute(new Float32Array(8),1));
  ['normal','uv','owner','bindPivot'].forEach((name,i)=>g.getAttribute(name).setX(i+2,1));
  const facts=indexExactStaticVertices(g);expect(facts.mergedVertices).toBe(2);expect(Array.from(g.index!.array)).toEqual([0,0,2,3,4,5,0,7]);g.dispose();
 });
 it('preserves indexed order, material groups and actor instance streams; refuses morph data',()=>{
  const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,0],3));g.setIndex([3,1,2,2,1,3]);g.addGroup(0,3,1);g.addGroup(3,3,0);g.setDrawRange(3,3);
  const owners=new THREE.InstancedBufferAttribute(new Float32Array([17,23]),1);g.setAttribute('ownerSlot',owners);g.instanceCount=2;
  indexExactStaticVertices(g);expect(Array.from(g.index!.array)).toEqual([0,1,2,2,1,0]);expect(g.instanceCount).toBe(2);expect(g.getAttribute('ownerSlot')).toBe(owners);expect(g.groups.map(group=>group.materialIndex)).toEqual([1,0]);expect(g.drawRange).toEqual({start:3,count:3});
  g.morphAttributes.position=[new THREE.Float32BufferAttribute(new Float32Array(12),3)];expect(()=>indexExactStaticVertices(g)).toThrow('morph');g.dispose();
 });
});
