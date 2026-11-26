import {test,expect,vi} from 'vitest';
import {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial,Vector3} from 'three/webgpu';
import {retainFixedLocalMatrix,withPreparedSceneMatrices} from '../src/render/scene-matrix-pass';

function fixture(){const scene=new Scene(),parent=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial());scene.add(parent);parent.add(mesh);return {scene,parent,mesh};}
function nativePass(scene:Scene,mesh:Mesh){if(scene.matrixWorldAutoUpdate)scene.updateMatrixWorld();return new Vector3().setFromMatrixPosition(mesh.matrixWorld).toArray();}
test('colour and nested shadow see the same freshly composed parent/child poses with one traversal',()=>{
 const {scene,parent,mesh}=fixture();parent.position.set(5,2,3);mesh.position.set(1,4,6);const update=vi.spyOn(scene,'updateMatrixWorld');
 const poses=withPreparedSceneMatrices(scene,()=>[nativePass(scene,mesh),nativePass(scene,mesh)]);
 expect(poses).toEqual([[6,6,9],[6,6,9]]);expect(update).toHaveBeenCalledTimes(1);expect(scene.matrixWorldAutoUpdate).toBe(true);
 parent.position.x=9;expect(withPreparedSceneMatrices(scene,()=>nativePass(scene,mesh))).toEqual([10,6,9]);expect(update).toHaveBeenCalledTimes(2);
});
test('automatic preparation after a draw remains live and a failed draw restores it',()=>{
 const {scene,parent,mesh}=fixture();
 expect(()=>withPreparedSceneMatrices(scene,()=>{throw Error('native draw failed');})).toThrow('native draw failed');
 expect(scene.matrixWorldAutoUpdate).toBe(true);parent.position.z=7;expect(nativePass(scene,mesh)).toEqual([0,0,7]);
});
test('manual scene ownership and nested entry retain the caller policy',()=>{
 const {scene,parent,mesh}=fixture();scene.updateMatrixWorld();scene.matrixWorldAutoUpdate=false;parent.position.x=9;
 const update=vi.spyOn(scene,'updateMatrixWorld');
 expect(withPreparedSceneMatrices(scene,()=>nativePass(scene,mesh))).toEqual([0,0,0]);expect(update).not.toHaveBeenCalled();expect(scene.matrixWorldAutoUpdate).toBe(false);
 scene.matrixWorldAutoUpdate=true;
 withPreparedSceneMatrices(scene,()=>{withPreparedSceneMatrices(scene,()=>expect(nativePass(scene,mesh)).toEqual([9,0,0]));expect(scene.matrixWorldAutoUpdate).toBe(false);});
 expect(update).toHaveBeenCalledTimes(1);expect(scene.matrixWorldAutoUpdate).toBe(true);
});

test('closed local matrices retain exact world transforms without recomposing static descendants on every draw',()=>{
 const old=fixture(),next=fixture();
 for(const {scene,parent,mesh} of [old,next]){
  scene.matrixAutoUpdate=false;parent.position.set(3,2,1);parent.rotation.y=.23;parent.scale.set(2,1,3);
  mesh.position.set(1,4,6);mesh.rotation.z=.71;mesh.scale.set(.5,.8,1.2);
 }
 retainFixedLocalMatrix(next.parent);retainFixedLocalMatrix(next.mesh);
 const local=vi.spyOn(next.mesh,'updateMatrix'),world=vi.spyOn(next.mesh.matrixWorld,'multiplyMatrices');
 const draw=()=>{old.scene.updateMatrixWorld();withPreparedSceneMatrices(next.scene,()=>{});expect(next.mesh.matrixWorld.elements).toEqual(old.mesh.matrixWorld.elements);};
 draw();expect(world).toHaveBeenCalledTimes(1);expect(local).not.toHaveBeenCalled();
 draw();draw();expect(world).toHaveBeenCalledTimes(1);
 // A moving sibling/descendant still uses native automatic composition.
 const movingA=new Group(),movingB=new Group();old.parent.add(movingA);next.parent.add(movingB);
 movingA.position.set(1,2,3);movingB.position.copy(movingA.position);draw();
 expect(movingB.matrixWorld.elements).toEqual(movingA.matrixWorld.elements);
 movingA.position.x=7;movingB.position.x=7;draw();expect(movingB.matrixWorld.elements).toEqual(movingA.matrixWorld.elements);
 // Reparent to a second, already prepared fixed local container.
 const otherA=new Group(),otherB=new Group();
 otherA.position.set(9,8,7);otherA.rotation.x=.44;otherB.position.copy(otherA.position);otherB.rotation.copy(otherA.rotation);
 old.scene.add(otherA);next.scene.add(retainFixedLocalMatrix(otherB));draw();
 otherA.add(old.mesh);otherB.add(next.mesh);draw();expect(world).toHaveBeenCalledTimes(2);
 draw();expect(world).toHaveBeenCalledTimes(2);expect(local).not.toHaveBeenCalled();
 otherA.remove(old.mesh);otherB.remove(next.mesh);old.mesh.updateMatrixWorld();next.mesh.updateMatrixWorld();
 expect(next.mesh.matrixWorld.elements).toEqual(old.mesh.matrixWorld.elements);
});

test('fixed local child follows motion of a normal automatic ancestor',()=>{
 const {scene,parent,mesh}=fixture();mesh.position.set(1,2,3);retainFixedLocalMatrix(mesh);
 parent.position.set(5,6,7);expect(withPreparedSceneMatrices(scene,()=>nativePass(scene,mesh))).toEqual([6,8,10]);
 parent.position.x=9;expect(withPreparedSceneMatrices(scene,()=>nativePass(scene,mesh))).toEqual([10,8,10]);
});
