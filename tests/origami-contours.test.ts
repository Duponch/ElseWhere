import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
import {float,positionLocal} from 'three/tsl';
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {createOrigamiContour,createOrigamiContourGeometry,createInstancedOrigamiContour,ItemContourAtlas} from '../src/render/origami/contours';
import {StaticSceneCompiler435,staticSceneSourceLayers435} from '../src/render/StaticSceneCompiler435';

const context=()=>new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami'});
function overlaidCargo():THREE.InstancedBufferGeometry {
  const box=new THREE.BoxGeometry(1,1,1).toNonIndexed(),geometry=new THREE.InstancedBufferGeometry(),count=box.getAttribute('position').count;
  for(const name of ['position','normal','uv']){const source=box.getAttribute(name),values=new Float32Array(source.array.length*2);values.set(source.array);values.set(source.array,source.array.length);geometry.setAttribute(name,new THREE.BufferAttribute(values,source.itemSize));}
  geometry.setAttribute('cargoKind',new THREE.Float32BufferAttribute([...new Array(count).fill(4),...new Array(count).fill(17)],1));
  geometry.setAttribute('corpsePartMask',new THREE.Float32BufferAttribute([...new Array(count).fill(2),...new Array(count).fill(64)],1));
  geometry.userData.cargoRangesByKind={4:{start:0,count},17:{start:count,count}};geometry.groups.push({start:0,count:count*2,materialIndex:0});geometry.instanceCount=0;box.dispose();return geometry;
}
describe('Origami contours keep real source batches and masks',()=>{
  it('never welds superposed cargo identities or anatomical masks and follows selected groups',()=>{
    const source=overlaidCargo(),all=createOrigamiContourGeometry(source);expect(all.getAttribute('position').count).toBe(48);
    const identities=new Map<number,Set<number>>();for(let i=0;i<48;i++){const kind=all.getAttribute('cargoKind').getX(i),mask=all.getAttribute('corpsePartMask').getX(i);if(!identities.has(kind))identities.set(kind,new Set());identities.get(kind)!.add(mask);}
    expect([...identities]).toEqual([[4,new Set([2])],[17,new Set([64])]]);
    source.groups.splice(0,source.groups.length,{start:36,count:36,materialIndex:0});const selected=createOrigamiContourGeometry(source);expect(selected.getAttribute('position').count).toBe(24);const tags=selected.getAttribute('cargoKind');expect(new Set(Array.from({length:tags.count},(_,i)=>tags.getX(i)))).toEqual(new Set([17]));
    source.groups.length=0;const empty=createOrigamiContourGeometry(source);expect(empty.getAttribute('position').count).toBe(0);for(const geometry of [source,all,selected,empty])geometry.dispose();
  });
  it('aliases changing instance storage and warm counts, composes fade/masks without copying the lit output',()=>{
    const ctx=context(),geometry=overlaidCargo(),material=new THREE.MeshStandardNodeMaterial(),body=new THREE.Mesh(geometry,material);
    material.positionNode=positionLocal;material.opacityNode=float(.4);material.maskNode=float(1).equal(1);material.outputNode=float(.2);
    const instances=new THREE.InstancedBufferAttribute(new Float32Array(8),4);geometry.setAttribute('aCargo',instances);
    const binding=createOrigamiContour(body,ctx);expect(binding.line.geometry.getAttribute('aCargo')).toBe(instances);expect((binding.line.material as THREE.NodeMaterial).outputNode).toBeNull();expect((binding.line.material as THREE.NodeMaterial).maskNode).toBe(material.maskNode);
    expect(binding.line.visible).toBe(false);geometry.instanceCount=2;expect((binding.line.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(2);expect(binding.line.visible).toBe(true);
    const grown=new THREE.InstancedBufferAttribute(new Float32Array(32),4);geometry.setAttribute('aCargo',grown);geometry.groups.splice(0,geometry.groups.length,{start:36,count:36,materialIndex:0});binding.sync();expect(binding.line.geometry.getAttribute('aCargo')).toBe(grown);expect(binding.line.geometry.getAttribute('position').count).toBe(144);expect(binding.line.geometry.index?.count).toBe(288);
    body.visible=false;expect(binding.line.visible).toBe(false);body.visible=true;expect(binding.line.visible).toBe(true);ctx.update({...ctx.preferences,edges:0,blackEdges:0});expect(binding.line.visible).toBe(false);
    binding.dispose();geometry.dispose();material.dispose();ctx.dispose();
  });
  it('packs every static endpoint attribute into one buffer within the eight-buffer cargo budget',()=>{
    const ctx=context(),geometry=overlaidCargo(),material=new THREE.MeshStandardNodeMaterial();
    for(const name of ['aFrom','aTo','aTravel','aMotion','aCargo','aAppearance'])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(8),4));
    const body=new THREE.Mesh(geometry,material),binding=createOrigamiContour(body,ctx),buffers=new Set<unknown>();
    for(const attribute of Object.values(binding.line.geometry.attributes))buffers.add(attribute instanceof THREE.InterleavedBufferAttribute?attribute.data:attribute);
    const staticBuffers=new Set<unknown>();for(const name of ['position','normal','uv','cargoKind','corpsePartMask']){const attribute=binding.line.geometry.getAttribute(name);expect(attribute).toBeInstanceOf(THREE.InterleavedBufferAttribute);staticBuffers.add((attribute as THREE.InterleavedBufferAttribute).data);}
    expect(staticBuffers.size).toBe(1);expect(buffers.size).toBe(7);expect(buffers.size).toBeLessThanOrEqual(8);
    binding.dispose();geometry.dispose();material.dispose();ctx.dispose();
  });
  it('shares stock instance matrices but never instance tint, and transforms child/sibling exactly once',()=>{
    const ctx=context(),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardNodeMaterial(),body=new THREE.InstancedMesh(geometry,material,3);body.position.set(4,2,-3);body.count=2;body.setColorAt(0,new THREE.Color('red'));
    const binding=createInstancedOrigamiContour(body,ctx),root=new THREE.Group();root.add(body,binding.line);root.updateMatrixWorld(true);expect(binding.line.matrixWorld.elements).toEqual(body.matrixWorld.elements);expect(Reflect.get(binding.line,'instanceMatrix')).toBe(body.instanceMatrix);expect(Reflect.get(binding.line,'instanceColor')).toBeNull();expect(Reflect.get(binding.line,'count')).toBe(2);
    body.add(binding.line);root.updateMatrixWorld(true);expect(binding.line.matrixWorld.elements).toEqual(body.matrixWorld.elements);body.count=0;expect(binding.line.visible).toBe(false);body.count=3;expect(Reflect.get(binding.line,'count')).toBe(3);expect(binding.line.visible).toBe(true);
    binding.dispose();body.dispose();geometry.dispose();material.dispose();ctx.dispose();
  });
  it('keeps intended layers through static compiler suppression and removes that ownership on clear',()=>{
    const ctx=context(),scene=new THREE.Scene(),root=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardNodeMaterial();geometry.computeBoundingBox();geometry.computeBoundingSphere();scene.add(root);
    const a=new THREE.Mesh(geometry,material),b=new THREE.Mesh(geometry,material);a.layers.mask=b.layers.mask=3;root.add(a,b);scene.updateMatrixWorld(true);const line=createOrigamiContour(a,ctx);a.add(line.line);scene.updateMatrixWorld(true);
    const compiler=new StaticSceneCompiler435(scene);compiler.reconcile([root],[material]);expect(a.layers.mask).toBe(0);expect(staticSceneSourceLayers435(a)).toBe(3);line.sync();expect(line.line.layers.mask).toBe(3);
    a.layers.mask=4;expect(staticSceneSourceLayers435(a)).toBe(4);compiler.clear();expect(staticSceneSourceLayers435(a)).toBe(4);expect(b.layers.mask).toBe(3);a.layers.mask=0;expect(staticSceneSourceLayers435(a)).toBe(0);
    compiler.dispose();line.dispose();geometry.dispose();material.dispose();ctx.dispose();
  });
  it('uses a real triangle-ribbon atlas with paint UV and collapsed whole-triangle padding',()=>{
    const atlas=new ItemContourAtlas();expect(atlas.verticesPerSlot%3).toBe(0);expect(atlas.geometry.userData.origamiBrushPrebuilt).toBe(true);expect(atlas.geometry.getAttribute('position').count).toBe(atlas.verticesPerSlot);expect(atlas.positionNode()).toBeDefined();expect(atlas.paintUvNode()).toBeDefined();
    const values=(Reflect.get(atlas,'data') as THREE.StorageBufferAttribute).array;
    // Slot0 is the actual unit cube, independent of the implementation's edge
    // lookup. All24 face-edge strips must stay on its six surface planes.
    for(let i=0;i<288;i++){
      const point=Array.from(values.slice(i*8,i*8+3));expect(Math.max(...point.map(Math.abs))).toBeCloseTo(.5);expect(point.every(value=>Math.abs(value)<=.5)).toBe(true);
      expect([0,.5,1]).toContain(values[i*8+3]);expect([0,1]).toContain(values[i*8+7]);
    }
    for(let i=288;i<atlas.verticesPerSlot;i++){expect(Array.from(values.slice(i*8,i*8+4))).toEqual([0,0,0,0]);expect(values[i*8+7]).toBe(0);}
    expect(atlas.smallVertexLimit).toBeGreaterThanOrEqual(288);expect(atlas.smallGeometry.drawRange.count).toBe(atlas.smallVertexLimit);atlas.dispose();
  });
});
