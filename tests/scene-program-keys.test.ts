import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {sceneProgramKeys,hasNewProgramKey} from '../src/render/scene-program-keys';

// The gate of the mid-game whole-scene compilation: a new key only when a
// visible object brings a material state, geometry layout or object kind the
// scene did not have. Pure CPU data, no renderer.
function geometry(extra?:string):THREE.BufferGeometry {
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));
 g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(9),3));
 if(extra)g.setAttribute(extra,new THREE.BufferAttribute(new Float32Array(6),2));
 return g;
}
function scene(){
 const root=new THREE.Scene(),material=new THREE.MeshStandardNodeMaterial(),mesh=new THREE.Mesh(geometry(),material);
 root.add(mesh);return{root,material,mesh};
}

test('moving, hiding, duplicating an existing combination or changing buffer contents brings no new key',()=>{
 const {root,material,mesh}=scene(),known=sceneProgramKeys(root);
 expect(known.size).toBe(1);expect(hasNewProgramKey(known,undefined)).toBe(true);expect(hasNewProgramKey(known,known)).toBe(false);
 mesh.position.set(3,0,2);(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
 // Another object with the same material and the same layout, in a nested group.
 const group=new THREE.Group();group.add(new THREE.Mesh(geometry(),material));root.add(group);
 expect(hasNewProgramKey(sceneProgramKeys(root),known)).toBe(false);
 // A hidden subtree is not compiled, so it is not counted either.
 const hidden=new THREE.Group();hidden.visible=false;hidden.add(new THREE.Mesh(geometry('uv'),new THREE.MeshStandardNodeMaterial()));root.add(hidden);
 expect(hasNewProgramKey(sceneProgramKeys(root),known)).toBe(false);
 mesh.visible=false;expect(sceneProgramKeys(root).size).toBe(1);
});

test('a new material, a rebuilt material, a new layout or a new object kind is a new key',()=>{
 const base=scene(),known=sceneProgramKeys(base.root);
 const other=scene();other.root.add(new THREE.Mesh(geometry(),new THREE.MeshStandardNodeMaterial()));
 expect(hasNewProgramKey(sceneProgramKeys(other.root),sceneProgramKeys(scene().root))).toBe(true);
 // needsUpdate asks the renderer for a new program state.
 base.material.needsUpdate=true;expect(hasNewProgramKey(sceneProgramKeys(base.root),known)).toBe(true);
 const layout=scene(),before=sceneProgramKeys(layout.root);layout.mesh.geometry=geometry('uv');
 expect(hasNewProgramKey(sceneProgramKeys(layout.root),before)).toBe(true);
 const kind=scene(),plain=sceneProgramKeys(kind.root);kind.root.add(new THREE.InstancedMesh(geometry(),kind.material,4));
 expect(hasNewProgramKey(sceneProgramKeys(kind.root),plain)).toBe(true);
 const shadow=scene(),unlit=sceneProgramKeys(shadow.root);shadow.mesh.receiveShadow=true;
 expect(hasNewProgramKey(sceneProgramKeys(shadow.root),unlit)).toBe(true);
 const instanced=scene(),flat=sceneProgramKeys(instanced.root),g=geometry();g.setAttribute('offset',new THREE.InstancedBufferAttribute(new Float32Array(6),3));instanced.root.add(new THREE.Mesh(g,instanced.material));
 expect(hasNewProgramKey(sceneProgramKeys(instanced.root),flat)).toBe(true);
});

test('a key that disappeared and comes back is new again',()=>{
 const {root}=scene(),extra=new THREE.Mesh(geometry('uv'),new THREE.MeshStandardNodeMaterial());
 root.add(extra);const withExtra=sceneProgramKeys(root);
 extra.visible=false;const without=sceneProgramKeys(root);expect(hasNewProgramKey(without,withExtra)).toBe(false);
 extra.visible=true;expect(hasNewProgramKey(sceneProgramKeys(root),without)).toBe(true);
});
