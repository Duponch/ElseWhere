import {expect,test,vi} from 'vitest';
import {BoxGeometry,Frustum,Group,Matrix4,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene} from 'three/webgpu';
import {WorldCoordinateGroup,worldCoordinateChild} from '../src/render/WorldCoordinateGroup';
import {retainFixedLocalMatrix,withPreparedSceneMatrices} from '../src/render/scene-matrix-pass';

function fixture(closed:boolean){
 const scene=new Scene(),parent=new Group(),root=closed?new WorldCoordinateGroup():new Group(),chunk=worldCoordinateChild(root),mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial());
 scene.matrixAutoUpdate=false;parent.matrixAutoUpdate=false;
 mesh.position.set(3,2,1);mesh.rotation.set(.17,.31,-.22);mesh.scale.set(.4,.9,.7);
 scene.add(parent);parent.add(root);root.add(chunk);chunk.add(mesh);
 return{scene,parent,root,chunk,mesh,dispose(){mesh.geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();}};
}
function compare(a:ReturnType<typeof fixture>,b:ReturnType<typeof fixture>){
 withPreparedSceneMatrices(a.scene,()=>{});withPreparedSceneMatrices(b.scene,()=>{});
 for(const key of ['parent','root','chunk','mesh']as const)expect(b[key].matrixWorld.elements).toEqual(a[key].matrixWorld.elements);
}

test('fixed producer branches skip clean matrix traversals while preserving every world matrix',()=>{
 const native=fixture(false),closed=fixture(true);try{
  compare(native,closed);const leaf=vi.spyOn(closed.mesh,'updateMatrixWorld'),local=vi.spyOn(closed.mesh,'updateMatrix');
  for(let frame=0;frame<20;frame++)compare(native,closed);
  expect(leaf).not.toHaveBeenCalled();expect(local).not.toHaveBeenCalled();
  expect((closed.root as WorldCoordinateGroup).matrixMetrics()).toMatchObject({nativeTraversals:1,reusedTraversals:20,admissions:1});
 }finally{native.dispose();closed.dispose();}
});

test('deferred replacement and additions after the last landscape refresh settle at the actual producer',()=>{
 const native=fixture(false),closed=fixture(true);try{
  compare(native,closed);
  const oldN=native.mesh,oldC=closed.mesh;native.chunk.remove(oldN);closed.chunk.remove(oldC);
  const n=new Mesh(oldN.geometry,oldN.material),c=new Mesh(oldC.geometry,oldC.material);n.position.set(9,4,7);c.position.copy(n.position);n.rotation.y=c.rotation.y=.77;
  native.chunk.add(n);closed.chunk.add(c);
  const lateN=new Group(),lateC=worldCoordinateChild(closed.root);lateN.position.set(4,6,8);lateC.position.copy(lateN.position);lateN.updateMatrix();lateC.updateMatrix();
  native.root.add(lateN);closed.root.add(lateC);
  // A second async owner contributes to an already-admitted chunk later.
  const tailN=new Group(),tailC=new Group();tailN.position.set(-1,3,5);tailC.position.copy(tailN.position);lateN.add(tailN);lateC.add(tailC);
  withPreparedSceneMatrices(native.scene,()=>{});withPreparedSceneMatrices(closed.scene,()=>{});
  expect(c.matrixWorld.elements).toEqual(n.matrixWorld.elements);expect(tailC.matrixWorld.elements).toEqual(tailN.matrixWorld.elements);
  const leaf=vi.spyOn(c,'updateMatrixWorld');withPreparedSceneMatrices(closed.scene,()=>{});expect(leaf).not.toHaveBeenCalled();
 }finally{native.dispose();closed.dispose();}
});

test('ancestor motion, reparenting and direct world queries cannot consume pending leaf propagation',()=>{
 const native=fixture(false),closed=fixture(true);try{
  compare(native,closed);
  native.parent.matrixAutoUpdate=closed.parent.matrixAutoUpdate=true;native.parent.position.set(7,5,-3);closed.parent.position.copy(native.parent.position);compare(native,closed);
  native.parent.position.x=11;closed.parent.position.x=11;
  // A picking/compile query updates roots before the ordinary frame pass.
  native.chunk.updateWorldMatrix(true,false);closed.chunk.updateWorldMatrix(true,false);compare(native,closed);
  native.parent.matrixAutoUpdate=closed.parent.matrixAutoUpdate=false;
  const pN=new Group(),pC=new Group();pN.position.set(-6,8,2);pC.position.copy(pN.position);pN.rotation.z=pC.rotation.z=.43;
  native.scene.add(pN);closed.scene.add(pC);native.scene.updateMatrixWorld();closed.scene.updateMatrixWorld();pN.add(native.root);pC.add(closed.root);compare(native,closed);
  pN.remove(native.root);pC.remove(closed.root);native.root.updateMatrixWorld();closed.root.updateMatrixWorld();expect(closed.mesh.matrixWorld.elements).toEqual(native.mesh.matrixWorld.elements);
 }finally{native.dispose();closed.dispose();}
});

test('owner invalidation handles an explicit local pose and automatic roots remain fully native',()=>{
 const native=fixture(false),closed=fixture(true);try{
  compare(native,closed);native.mesh.position.x=closed.mesh.position.x=13;(closed.chunk as WorldCoordinateGroup).invalidateWorldMatrices();
  // Explicit producer invalidation reaches enclosing closed branches too.
  compare(native,closed);
  native.root.matrixAutoUpdate=closed.root.matrixAutoUpdate=true;native.root.position.y=closed.root.position.y=7;compare(native,closed);
  native.root.position.y=closed.root.position.y=9;compare(native,closed);
 }finally{native.dispose();closed.dispose();}
});

test('culling and real geometry changes retain the native result independently of matrix reuse',()=>{
 const native=fixture(false),closed=fixture(true);try{
  const camera=new PerspectiveCamera(50,1,.1,100),frustum=new Frustum(),projection=new Matrix4();camera.position.set(0,4,20);camera.lookAt(3,2,1);
  for(let frame=0;frame<8;frame++){
   camera.position.x=frame*7;camera.lookAt(3,2,1);camera.updateMatrixWorld();projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
   if(frame===3){native.mesh.geometry.translate(17,0,0);closed.mesh.geometry.translate(17,0,0);native.mesh.geometry.computeBoundingSphere();closed.mesh.geometry.computeBoundingSphere();}
   compare(native,closed);expect(closed.mesh.intersectsFrustum(frustum)).toBe(native.mesh.intersectsFrustum(frustum));
  }
 }finally{native.dispose();closed.dispose();}
});

test('ordinary public containers keep native child transform semantics and retained local flags compose',()=>{
 const publicRoot=new Group(),child=worldCoordinateChild(publicRoot);expect(child.constructor).toBe(Group);
 const root=retainFixedLocalMatrix(new WorldCoordinateGroup()),mesh=new Group();mesh.position.set(1,2,3);root.add(mesh);root.updateMatrixWorld();root.updateMatrixWorld();
 expect(mesh.matrixWorld.elements).toEqual(new Matrix4().makeTranslation(1,2,3).elements);
});
