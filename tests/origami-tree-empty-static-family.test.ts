/** New435 boundary only: real compiler/arena + opaque array material, no
 * painter, World, device, renderer.init, frame measurement or GPU pixels. */
import {expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {attribute,texture} from 'three/tsl';
import {StaticSceneCompiler435,setStaticSceneSource435} from '../src/render/StaticSceneCompiler435';

function geometry(x:number,layer:number,baked:boolean):THREE.BufferGeometry{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x,0,0,x+1,0,0,x,1,0],3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(9).fill(.625),3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));
 g.setAttribute('origamiPaint',new THREE.Float32BufferAttribute([.5,.25,.125,4,.5,.25,.125,4,.5,.25,.125,4],4));
 if(baked)g.setAttribute('bakedUv',new THREE.Float32BufferAttribute([.125,.125,layer,.875,.125,layer,.125,.875,layer],3));
 g.setAttribute('windRoot',new THREE.Float32BufferAttribute([x,0,.62,x,0,.62,x,0,.62],3));g.setAttribute('windBasis',new THREE.Float32BufferAttribute([0,1,0,1,0,1,.5,.5,0,1,1,0],4));g.setIndex([0,1,2]);g.computeBoundingSphere();return g;
}
function corners(mesh:THREE.Mesh):number[][]{
 const g=mesh.geometry,index=g.index!,names=Object.keys(g.attributes).sort(),out:number[][]=[];
 for(let at=g.drawRange.start;at<Math.min(index.count,g.drawRange.start+g.drawRange.count);at++){
  const vertex=index.getX(at);out.push(names.flatMap(name=>{const a=g.getAttribute(name);if(!(a instanceof THREE.BufferAttribute))throw Error('This435 boundary requires separate Source BufferAttributes');return Array.from(new Uint32Array(a.array.buffer,a.array.byteOffset+vertex*a.itemSize*4,a.itemSize));}));
 }return out;
}
function effectiveVisible(object:THREE.Object3D){for(let p:THREE.Object3D|null=object;p;p=p.parent)if(!p.visible)return false;return true;}

it('empty larger native family cannot starve ready bakedUv3 array pages; rebuild/retained indices and root visibility keep actual corner bits and Source ownership',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),native=new THREE.MeshLambertNodeMaterial({vertexColors:true}),atlas=new THREE.DataArrayTexture(new Uint8Array(2*2*2*4).fill(255),2,2,2),opaque=new THREE.MeshLambertNodeMaterial();atlas.colorSpace=THREE.SRGBColorSpace;
 const baked=attribute('bakedUv','vec3');opaque.colorNode=texture(atlas,baked.xy).depth(baked.z).rgb;
 const empty:THREE.Mesh[]=[],ready:THREE.Mesh[]=[],owned=new Set<THREE.BufferGeometry>(),compiler=new StaticSceneCompiler435(scene);root.name='actual435-tree-boundary';scene.add(root);
 const add=(q:0|1|2|3,slot:number,isBaked:boolean)=>{const g=geometry(q*20+slot,isBaked?slot%2:0,isBaked);owned.add(g);const mesh=new THREE.Mesh(g,isBaked?opaque:native);mesh.matrixAutoUpdate=false;mesh.castShadow=mesh.receiveShadow=true;setStaticSceneSource435(mesh,`tree:${isBaked?'array':'native-empty'}:${q}:${slot}`,q);root.add(mesh);(isBaked?ready:empty).push(mesh);if(!isBaked)g.setDrawRange(0,0);return mesh;};
 try{
  // Without count0 admission exclusion the24empty choices win the sole4-way
  // partition and leave these8ready choices in original native draws.
  for(const q of [0,1,2,3] as const){for(let i=0;i<6;i++)add(q,i,false);for(let i=0;i<2;i++)add(q,i,true);}scene.updateMatrixWorld(true);
  const originalVisibility=new Map([...empty,...ready].map(m=>[m,m.visible]));compiler.reconcile([root],[native,opaque]);
  expect(compiler.meshes()).toHaveLength(4);expect(compiler.snapshot().pageObjects).toBeLessThanOrEqual(8);expect(compiler.snapshot().pages.map(p=>p.quadrant)).toEqual([0,1,2,3]);expect(compiler.snapshot().pages.every(p=>p.material===opaque.uuid)).toBe(true);expect(compiler.snapshot().sourceObjects).toBe(8);expect(compiler.snapshot().rejected).not.toHaveProperty('invalid-triangle-range');
  expect(compiler.meshes().flatMap(corners)).toEqual(ready.flatMap(corners));expect(new Set(ready.flatMap(m=>Array.from(m.geometry.getAttribute('bakedUv').array).filter((_,i)=>i%3===2)))).toEqual(new Set([0,1]));
  for(const m of ready){expect(m.layers.mask).toBe(0);expect(m.visible).toBe(originalVisibility.get(m));}for(const m of empty){expect(m.layers.mask).toBe(1);expect(m.visible).toBe(originalVisibility.get(m));}
  const pages=[...compiler.meshes()],arenas=pages.map(p=>p.geometry),positions=arenas.map(g=>g.getAttribute('position')),otherCorners=pages.slice(1).map(corners),changed=ready[0]!,oldGeometry=changed.geometry,oldUv=oldGeometry.getAttribute('bakedUv') as THREE.BufferAttribute;
  // Same producer source key/material/layout; only one Source geometry owner
  // is replaced. A distinct atlas layer is a real attribute value, not tint.
  changed.geometry=geometry(41,1,true);owned.add(changed.geometry);oldGeometry.dispose();owned.delete(oldGeometry);scene.updateMatrixWorld(true);const beforeReplacement=compiler.snapshot();compiler.reconcile([root],[native,opaque]);
  expect(compiler.meshes()).toEqual(pages);for(let i=0;i<pages.length;i++){expect(pages[i]!.geometry).toBe(arenas[i]);expect(pages[i]!.geometry.getAttribute('position')).toBe(positions[i]);}expect(pages.slice(1).map(corners)).toEqual(otherCorners);expect(compiler.snapshot().blockReplacements-beforeReplacement.blockReplacements).toBe(1);expect(pages.flatMap(corners)).toEqual(ready.flatMap(corners));
  const settled=compiler.snapshot().copiedBytes;oldUv.setZ(0,0);oldUv.needsUpdate=true;compiler.patchAttribute(oldUv,2,1);expect(compiler.snapshot().copiedBytes).toBe(settled);
  // Actual retained index/drawRange boundary: the all-empty native family
  // remains present while one ready source retires then returns.
  changed.geometry.setDrawRange(0,0);compiler.reconcile([root],[native,opaque]);expect(compiler.meshes()).toEqual(pages);expect(compiler.snapshot().compiledActiveTriangles).toBe(7);expect(changed.layers.mask).toBe(1);expect(pages.flatMap(corners)).toEqual(ready.flatMap(corners));
  changed.geometry.setDrawRange(0,Infinity);compiler.reconcile([root],[native,opaque]);expect(compiler.meshes()).toEqual(pages);expect(compiler.snapshot().compiledActiveTriangles).toBe(8);expect(changed.layers.mask).toBe(0);expect(pages.flatMap(corners)).toEqual(ready.flatMap(corners));
  const stable=compiler.snapshot();root.visible=false;compiler.syncVisibility();expect(pages.every(p=>!effectiveVisible(p))).toBe(true);root.visible=true;compiler.syncVisibility();expect(pages.every(effectiveVisible)).toBe(true);expect(compiler.snapshot().copiedBytes).toBe(stable.copiedBytes);expect(compiler.snapshot().rebuilds).toBe(stable.rebuilds);for(let i=0;i<pages.length;i++)expect(pages[i]!.geometry).toBe(arenas[i]);
  compiler.clear();expect(compiler.meshes()).toHaveLength(0);for(const m of [...empty,...ready]){expect(m.layers.mask).toBe(1);expect(m.visible).toBe(originalVisibility.get(m));}
 }finally{compiler.dispose();for(const g of owned)g.dispose();native.dispose();opaque.dispose();atlas.dispose();}
});
