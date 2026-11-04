/** Existing independent composed-lighting owner contract, retained unchanged
 * when the obsolete product animal-atlas integration suite was retired. */
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {bool,positionLocal,vec3} from 'three/tsl';
import {actorExplorationMaterial256} from '../src/render/ExplorationMask256';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';

test('real lighting/exploration owners adopt only the already composed clone and bind it without changing its graphs',()=>{
 const lighting=new EnvironmentLighting(),source=actorExplorationMaterial256(new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true}));source.positionNode=positionLocal;lighting.configure(source);
 const clone=source.clone(),changed=source.clone(),wrongOwner=source.clone(),orphan=new THREE.MeshStandardNodeMaterial(),orphanClone=orphan.clone(),geometry=new THREE.BoxGeometry(1,1,1),scene=new THREE.Scene();
 try{
  clone.colorNode=vec3(.3,.4,.5);expect(source.outputNode).not.toBeNull();expect(lighting.adoptConfiguredClone(source,clone)).toBe(true);
  const graphs={position:clone.positionNode,normal:clone.normalNode,mask:clone.maskNode,shadow:clone.maskShadowNode,output:clone.outputNode},version=clone.version;
  scene.add(new THREE.Mesh(geometry,clone));lighting.exploration.bind(scene);lighting.configure(clone);expect(clone.version).toBe(version);
  expect(clone.positionNode).toBe(graphs.position);expect(clone.normalNode).toBe(graphs.normal);expect(clone.maskNode).toBe(graphs.mask);expect(clone.maskShadowNode).toBe(graphs.shadow);expect(clone.outputNode).toBe(graphs.output);
  changed.maskShadowNode=bool(false);expect(lighting.adoptConfiguredClone(source,changed)).toBe(false);changed.maskShadowNode=source.maskShadowNode;expect(lighting.adoptConfiguredClone(source,changed)).toBe(true);
  wrongOwner.userData.explorationActor=false;expect(lighting.adoptConfiguredClone(source,wrongOwner)).toBe(false);expect(lighting.adoptConfiguredClone(orphan,orphanClone)).toBe(false);
  // Restoring a role flag does not admit a changed pose graph either.
  wrongOwner.userData.explorationActor=true;wrongOwner.positionNode=positionLocal.add(vec3(0));expect(lighting.exploration.adoptConfiguredClone(source,wrongOwner)).toBe(false);
 }finally{geometry.dispose();for(const material of [source,clone,changed,wrongOwner,orphan,orphanClone])material.dispose();lighting.dispose();}
});
