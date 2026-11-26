import {expect,test,vi} from 'vitest';
import {Group,Mesh,MeshStandardNodeMaterial,Scene} from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {WorldCoordinateGroup} from '../src/render/WorldCoordinateGroup';
import {withPreparedSceneMatrices} from '../src/render/scene-matrix-pass';

test('real resource deferred rebuilds settle their admitted matrices without a landscape refresh or stable-frame leaf visit',()=>{
 const world=createWorld(379,96,96);world.structures=[];world.jobs=[];world.resources=[
  {id:600001,kind:'tree',species:'oak',x:3,z:4,amount:25,growth:.7,growthTick:world.tick},
  {id:600002,kind:'tree',species:'pine',x:72,z:8,amount:25,growth:.7,growthTick:world.tick},
  {id:600003,kind:'tree',species:'birch',x:72,z:72,amount:25,growth:.7,growthTick:world.tick},
 ];
 const material=new MeshStandardNodeMaterial({vertexColors:true});material.userData.rendererOwned=true;
 const ordinary=new Group(),closed=new WorldCoordinateGroup(),a=new ResourceLayer(ordinary,material),b=new ResourceLayer(closed,material),sceneA=new Scene(),sceneB=new Scene();
 sceneA.matrixAutoUpdate=sceneB.matrixAutoUpdate=false;sceneA.add(ordinary);sceneB.add(closed);
 const capture=(group:Group)=>{const output:unknown[]=[];group.traverse(object=>{if(object instanceof Mesh)output.push({name:object.name,world:object.matrixWorld.elements.slice(),position:Array.from(object.geometry.getAttribute('position').array),index:Array.from(object.geometry.index!.array),range:{...object.geometry.drawRange}});});return output;};
 const compare=()=>{withPreparedSceneMatrices(sceneA,()=>{});withPreparedSceneMatrices(sceneB,()=>{});expect(capture(closed)).toEqual(capture(ordinary));};
 try{
  a.update(world,true);b.update(world,true);compare();expect(closed.children.every(object=>object instanceof WorldCoordinateGroup)).toBe(true);
  a.setChunkRebuildBudget(0);b.setChunkRebuildBudget(0);
  for(const resource of world.resources)resource.species='poplar';const changes=new Map(world.resources.map(resource=>[resource.id,{resource,size:.7}]));
  a.update(world,false,changes);b.update(world,false,changes);expect(a.hasDeferredChunks).toBe(true);expect(b.hasDeferredChunks).toBe(true);compare();
  let flushes=0;while(a.hasDeferredChunks||b.hasDeferredChunks){expect(++flushes).toBeLessThan(8);expect(b.flushDeferredChunks()).toBe(a.flushDeferredChunks());compare();}
  const spies:ReturnType<typeof vi.spyOn>[]=[];closed.traverse(object=>{if(object instanceof Mesh)spies.push(vi.spyOn(object,'updateMatrixWorld'));});
  compare();compare();expect(spies.length).toBeGreaterThan(0);for(const spy of spies)expect(spy).not.toHaveBeenCalled();
 }finally{a.dispose();b.dispose();material.dispose();}
});
