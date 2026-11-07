import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import type {Resource} from '../src/sim/types';
import {WORLD_SCALE} from '../src/world/scale';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {SceneResourceIndex,readSceneResourceFrame} from '../src/render/scene-resource-index';
import type {NaturalPresentationChange} from '../src/render/NaturalResourcePresentation';
import type {ResourceRangeData} from '../src/render/StaticGeometry';

test('one natural birth rebuilds only its64cell resource partition, including indexed and raw paths',()=>{
  const c=WORLD_SCALE.resourceChunkSize;
  expect(c).toBe(64);expect(WORLD_SCALE.chunkSize).toBe(128);
  const world=createWorld(429,WORLD_SCALE.chunkSize+2,16);
  world.structures=[];world.jobs=[];world.tiles=world.tiles.map(()=>({terrain:'soil'}));
  world.resources=[{id:600001,kind:'tree',species:'oak',x:2,z:2,amount:25,growth:1},{id:600002,kind:'tree',species:'oak',x:c+2,z:2,amount:25,growth:1}];
  const groupA=new THREE.Group(),groupB=new THREE.Group(),material=new THREE.MeshStandardNodeMaterial({vertexColors:true});material.userData.rendererOwned=true;
  const raw=new ResourceLayer(groupA,material),indexed=new ResourceLayer(groupB,material),index=new SceneResourceIndex();
  try{
    const first=index.adopt(world);raw.update(world,true);indexed.update(world,true,undefined,first);
    expect(readSceneResourceFrame(first,world)!.chunksFor()!.changedChunks.map(chunk=>chunk.key)).toEqual(['0:0','1:0']);
    const groups=[groupA,groupB];
    const neighbors=groups.map(group=>group.children.find(child=>child.name==='Resources 1:0')!);
    expect(neighbors.every(Boolean)).toBe(true);
    const meshes=neighbors.map(group=>group.children as THREE.Mesh[]);
    const geometries=meshes.map(items=>items.map(mesh=>mesh.geometry));
    const attributes=meshes.map(items=>items.map(mesh=>mesh.geometry.getAttribute('position') as THREE.BufferAttribute));
    const versions=attributes.map(items=>items.map(attribute=>attribute.version));
    let neighborDisposals=0;for(const items of geometries)for(const geometry of items)geometry.addEventListener('dispose',()=>neighborDisposals++);
    const born:Resource={id:600003,kind:'wild-plant',species:'healroot-wild',x:3,z:3,amount:1,growth:.0001,growthTick:world.tick};
    const next={...world,resources:[...world.resources,born]},changes=new Map<number,NaturalPresentationChange>([[born.id,{resource:born,size:1}]]);
    const frame=index.adopt(next),access=readSceneResourceFrame(frame,next)!;
    expect(access.chunksFor(changes)!.changedChunks.map(chunk=>chunk.key)).toEqual(['0:0']);
    raw.update(next,false,changes);indexed.update(next,false,changes,frame);
    for(let i=0;i<groups.length;i++){
      expect(groups[i]!.children.find(child=>child.name==='Resources 1:0')).toBe(neighbors[i]);
      expect(meshes[i]!.map(mesh=>mesh.geometry)).toEqual(geometries[i]);
      expect(attributes[i]!.map(attribute=>attribute.version)).toEqual(versions[i]);
      // The birth is drawn within its own partition: the chunk or its companion.
      const targets=groups[i]!.children.filter(child=>child.name==='Resources 0:0'||child.name==='Resources 0:0+');
      expect(targets.some(target=>target.children.some(object=>(object as THREE.Mesh).userData.resourceRanges?.ranges.some((range:ResourceRangeData['ranges'][number])=>range.id===born.id)))).toBe(true);
    }
    expect(neighborDisposals).toBe(0);
  }finally{raw.dispose();indexed.dispose();material.dispose();}
});
