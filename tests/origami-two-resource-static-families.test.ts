/** New435 selection boundary only: real compiler/arena and actual tree UV3
 * colour-node ABI. No painter, renderer/device, Worker/World or GPU pixels. */
import {expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {StaticSceneCompiler435,setStaticSceneSource435} from '../src/render/StaticSceneCompiler435';
import {treeArrayColorNode} from '../src/render/origami/baked/trees/array-uv';

type Quadrant=0|1|2|3;
function geometry(q:Quadrant,slot:number,baked:boolean):THREE.BufferGeometry{
 const x=(q%2)*100+slot*3,z=Math.floor(q/2)*100,g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([x,0,z,x+1,0,z,x+1,1,z,x,1,z],3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute([0,-0,1,0,0,1,0,0,1,0,0,1],3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(12).fill(.625),3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
 g.setAttribute('origamiPaint',new THREE.Float32BufferAttribute([.5,.25,.125,4,.5,.25,.125,4,.5,.25,.125,4,.5,.25,.125,4],4));
 g.setAttribute('windRoot',new THREE.Float32BufferAttribute([x,z,.62,x,z,.62,x,z,.62,x,z,.62],3));
 g.setAttribute('windBasis',new THREE.Float32BufferAttribute([0,1,0,1,0,1,.5,.5,0,1,1,-0,0,1,.25,.75],4));
 if(baked)g.setAttribute('bakedUv',new THREE.Float32BufferAttribute([.125,.125,slot%2,.875,.125,slot%2,.875,.875,slot%2,.125,.875,slot%2],3));
 g.setIndex([0,1,2,0,2,3]);g.computeBoundingSphere();return g;
}
function corners(meshes:readonly THREE.Mesh[]):number[][]{
 const result:number[][]=[];for(const mesh of meshes){const g=mesh.geometry,index=g.index!,names=Object.keys(g.attributes).sort();
  for(let i=g.drawRange.start;i<Math.min(index.count,g.drawRange.start+g.drawRange.count);i++){const vertex=index.getX(i);result.push(names.flatMap(name=>{const a=g.getAttribute(name);if(!(a instanceof THREE.BufferAttribute)||!(a.array instanceof Float32Array))throw Error('This435 contract requires actual ordinary float fields');return Array.from(new Uint32Array(a.array.buffer,a.array.byteOffset+vertex*a.itemSize*4,a.itemSize));}));}}
 return result;
}
function visible(object:THREE.Object3D){for(let p:THREE.Object3D|null=object;p;p=p.parent)if(!p.visible)return false;return true;}
function frameAt(x:number){const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,500);camera.position.set(x+.5,.5,10);camera.lookAt(x+.5,.5,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),THREE.WebGLCoordinateSystem);}

it('two real resource families keep four spatial pages each inside8; excess family stays native, with exact UV3/corner/bounds and stable ownership through retirement',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),sourceMaterial=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02}),bakedMaterial=new THREE.MeshLambertNodeMaterial(),excessMaterial=new THREE.MeshLambertNodeMaterial(),atlas=new THREE.DataArrayTexture(new Uint8Array(2*2*2*4).fill(255),2,2,2),compiler=new StaticSceneCompiler435(scene);
 atlas.colorSpace=THREE.SRGBColorSpace;bakedMaterial.colorNode=treeArrayColorNode(atlas);root.name='two-resource-family-boundary';scene.add(root);
 const source:THREE.Mesh[]=[],baked:THREE.Mesh[]=[],excess:THREE.Mesh[]=[],all:THREE.Mesh[]=[],sourceDisposals=new Map<THREE.BufferGeometry,number>();
 const add=(family:'source'|'baked'|'excess',q:Quadrant,slot:number)=>{const g=geometry(q,slot,family==='baked'),m=new THREE.Mesh(g,family==='source'?sourceMaterial:family==='baked'?bakedMaterial:excessMaterial);m.castShadow=m.receiveShadow=true;m.matrixAutoUpdate=false;setStaticSceneSource435(m,`${family}:${q}:${slot}`,q);root.add(m);all.push(m);(family==='source'?source:family==='baked'?baked:excess).push(m);sourceDisposals.set(g,0);g.addEventListener('dispose',()=>sourceDisposals.set(g,sourceDisposals.get(g)!+1));};
 try{
  for(const q of[0,1,2,3]as const){for(let i=0;i<2;i++)add('source',q,i);for(let i=0;i<2;i++)add('baked',q,i);add('excess',q,0);}
  scene.updateMatrixWorld(true);const originalChildren=[...root.children],sourceCorners=corners(source),bakedCorners=corners(baked),originals=all.map(m=>({mesh:m,geometry:m.geometry,index:m.geometry.index,indexArray:m.geometry.index!.array,indexValues:Array.from(m.geometry.index!.array),attributes:Object.entries(m.geometry.attributes).map(([name,a])=>({name,attribute:a,array:a.array,bits:Array.from(new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length))})),layers:m.layers.mask,visible:m.visible}));
  const reconcile=()=>compiler.reconcile([root],[sourceMaterial,bakedMaterial,excessMaterial]);reconcile();
  const initial=compiler.snapshot(),pages=[...compiler.meshes()],sourcePages=pages.filter(p=>p.material===sourceMaterial),bakedPages=pages.filter(p=>p.material===bakedMaterial);
  expect(initial).toMatchObject({pageObjects:8,sourceObjects:16,eligibleObjects:20,unmergedNativeObjects:4,sourceActiveTriangles:32,compiledActiveTriangles:32});expect(sourcePages).toHaveLength(4);expect(bakedPages).toHaveLength(4);expect(root.children).toEqual(originalChildren);
  expect(initial.pages.filter(p=>p.material===sourceMaterial.uuid).map(p=>p.quadrant)).toEqual([0,1,2,3]);expect(initial.pages.filter(p=>p.material===bakedMaterial.uuid).map(p=>p.quadrant)).toEqual([0,1,2,3]);
  expect(corners(sourcePages)).toEqual(sourceCorners);expect(corners(bakedPages)).toEqual(bakedCorners);expect(bakedPages.every(p=>p.geometry.getAttribute('bakedUv').itemSize===3)).toBe(true);expect(sourcePages.every(p=>p.geometry.getAttribute('uv').itemSize===2&&!p.geometry.hasAttribute('bakedUv'))).toBe(true);
  expect(new Set(bakedPages.flatMap(p=>{const a=p.geometry.getAttribute('bakedUv'),index=p.geometry.index!,values:number[]=[];for(let i=0;i<p.geometry.drawRange.count;i++)values.push(a.getZ(index.getX(i)));return values;}))).toEqual(new Set([0,1]));
  for(const m of[...source,...baked]){expect(m.layers.mask).toBe(0);expect(m.visible).toBe(true);}for(const m of excess){expect(m.layers.mask).toBe(1);expect(m.visible).toBe(true);}
  for(const family of[sourcePages,bakedPages])for(let q=0;q<4;q++)for(const m of(family===sourcePages?source:baked).slice(q*2,q*2+2)){const a=m.geometry.boundingSphere!,b=family[q]!.geometry.boundingSphere!;expect(b.center.distanceTo(a.center)+a.radius).toBeLessThanOrEqual(b.radius+1e-6);}
  const geometries=pages.map(p=>p.geometry),positions=pages.map(p=>p.geometry.getAttribute('position')),stable=compiler.snapshot();
  for(let i=0;i<3;i++)reconcile();expect(compiler.meshes()).toEqual(pages);expect(compiler.snapshot().copiedBytes).toBe(stable.copiedBytes);expect(compiler.snapshot().rebuilds).toBe(stable.rebuilds);expect(compiler.snapshot().indexSourceRemaps).toBe(stable.indexSourceRemaps);
  for(let i=0;i<pages.length;i++){expect(pages[i]!.geometry).toBe(geometries[i]);expect(pages[i]!.geometry.getAttribute('position')).toBe(positions[i]);}
  scene.updateMatrixWorld(true);const left=frameAt(0),right=frameAt(100);for(const family of[sourcePages,bakedPages]){expect(left.intersectsObject(family[0]!)).toBe(true);expect(left.intersectsObject(family[1]!)).toBe(false);expect(right.intersectsObject(family[0]!)).toBe(false);expect(right.intersectsObject(family[1]!)).toBe(true);}
  root.visible=false;compiler.syncVisibility();expect(pages.every(p=>!visible(p))).toBe(true);root.visible=true;compiler.syncVisibility();expect(pages.every(visible)).toBe(true);expect(compiler.snapshot().copiedBytes).toBe(stable.copiedBytes);
  // Free one whole family. Its Source authority survives; its four arenas
  // retire once, and the formerly-native family can use the released budget.
  const retired=new Map(bakedPages.map(p=>[p.geometry,0]));for(const g of retired.keys())g.addEventListener('dispose',()=>retired.set(g,retired.get(g)!+1));root.remove(...baked);reconcile();
  expect(compiler.meshes()).toHaveLength(8);expect(compiler.meshes().filter(p=>p.material===sourceMaterial)).toEqual(sourcePages);expect(compiler.meshes().filter(p=>p.material===excessMaterial)).toHaveLength(4);expect([...retired.values()]).toEqual([1,1,1,1]);for(const m of baked){expect(m.parent).toBeNull();expect(m.layers.mask).toBe(1);}expect(corners(compiler.meshes().filter(p=>p.material===excessMaterial))).toEqual(corners(excess));
  root.add(...baked);reconcile();expect(compiler.meshes()).toHaveLength(8);expect(compiler.meshes().filter(p=>p.material===sourceMaterial)).toEqual(sourcePages);expect(compiler.meshes().filter(p=>p.material===bakedMaterial)).toHaveLength(4);for(const m of excess)expect(m.layers.mask).toBe(1);expect(corners(compiler.meshes().filter(p=>p.material===bakedMaterial))).toEqual(bakedCorners);
  compiler.clear();expect(compiler.meshes()).toHaveLength(0);
  for(const original of originals){const m=original.mesh;expect(m.geometry).toBe(original.geometry);expect(m.geometry.index).toBe(original.index);expect(m.geometry.index!.array).toBe(original.indexArray);expect(Array.from(m.geometry.index!.array)).toEqual(original.indexValues);expect(m.layers.mask).toBe(original.layers);expect(m.visible).toBe(original.visible);expect(sourceDisposals.get(m.geometry)).toBe(0);for(const field of original.attributes){expect(m.geometry.getAttribute(field.name)).toBe(field.attribute);expect(m.geometry.getAttribute(field.name).array).toBe(field.array);expect(Array.from(new Uint32Array(field.array.buffer,field.array.byteOffset,field.array.length))).toEqual(field.bits);}}
 }finally{compiler.dispose();for(const m of all)m.geometry.dispose();sourceMaterial.dispose();bakedMaterial.dispose();excessMaterial.dispose();atlas.dispose();}
});
