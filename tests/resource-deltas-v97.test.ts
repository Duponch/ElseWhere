import { expect,test } from 'vitest';
import * as THREE from 'three/webgpu';
import { createWorld } from '../src/sim/index';
import type { Resource,World } from '../src/sim/types';
import { ResourceLayer } from '../src/render/ResourceLayer';
import { NaturalResourcePresentation } from '../src/render/NaturalResourcePresentation';
import { isClusterPlantSpecies } from '../src/render/flora-presentation';
import { WORLD_SCALE } from '../src/world/scale';

function appearance(group:THREE.Group) {
  return group.children.map(chunk=>({
    name:chunk.name,
    meshes:chunk.children.map(object=>{
      const mesh=object as THREE.Mesh,geometry=mesh.geometry;
      const range=mesh.userData.resourceRanges as {ranges:{id:number;start:number;count:number;vertexStart:number;vertexCount:number}[];original:Uint16Array|Uint32Array;originalPositions:Float32Array};
      return {
        name:mesh.name,visible:mesh.visible,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,
        drawRange:{...geometry.drawRange},ranges:range.ranges.map(item=>({...item})),
        index:Array.from(geometry.index!.array),originalIndex:Array.from(range.original),
        positions:Array.from(geometry.getAttribute('position').array),originalPositions:Array.from(range.originalPositions),
        normals:Array.from(geometry.getAttribute('normal').array),colors:Array.from(geometry.getAttribute('color').array),
      };
    }),
  }));
}

/** Visible triangles per resource range and mesh role (name, visibility,
 * shadows): what is drawn, independent of how ranges are grouped in chunks.
 * Additions may live in a chunk's companion (`Resources x:z+`). */
function drawn(group:THREE.Group):Map<string,number[][]> {
  const out=new Map<string,number[][]>();
  for(const chunk of group.children)for(const object of chunk.children){
    const mesh=object as THREE.Mesh,data=mesh.userData.resourceRanges as {ranges:{id:number;vertexStart:number;vertexCount:number}[]}|undefined;
    if(!data)continue;
    const geometry=mesh.geometry,index=geometry.index!.array,count=Math.min(index.length,geometry.drawRange.count);
    const attributes=['position','normal','color'].map(name=>geometry.getAttribute(name) as THREE.BufferAttribute);
    const owner=(v:number)=>data.ranges.find(r=>v>=r.vertexStart&&v<r.vertexStart+r.vertexCount)!.id;
    for(let i=0;i<count;i+=3){
      const key=`${owner(index[i]!)}@${mesh.name}@${mesh.visible}@${mesh.castShadow}@${mesh.receiveShadow}`;
      const triangle:number[]=[];
      for(let j=0;j<3;j++){const v=index[i+j]!;for(const a of attributes)for(let k=0;k<a.itemSize;k++)triangle.push(a.array[v*a.itemSize+k] as number);}
      let list=out.get(key);if(!list){list=[];out.set(key,list);}list.push(triangle);
    }
  }
  for(const list of out.values())list.sort((a,b)=>{for(let i=0;i<a.length;i++){const d=Math.round(a[i]!*1e3)-Math.round(b[i]!*1e3);if(d)return d;}return 0;});
  return out;
}
/** Same drawn triangles; vertex values within 1e-4 (a resized member keeps
 * the positions rescaled from its original build). */
function expectSameDrawn(a:THREE.Group,b:THREE.Group):void {
  const x=drawn(a),y=drawn(b);
  expect([...x.keys()].sort()).toEqual([...y.keys()].sort());
  for(const [key,list] of x){const other=y.get(key)!;expect(list.length,key).toBe(other.length);
    for(let i=0;i<list.length;i++)for(let j=0;j<list[i]!.length;j++)expect(Math.abs(list[i]![j]!-other[i]![j]!),key).toBeLessThanOrEqual(1e-4);}
}

test('resource deltas match full chunk updates across growth, masks, replacement and chunk moves',()=>{
  const chunkSize=WORLD_SCALE.resourceChunkSize;
  const world:World=createWorld(42,chunkSize+8,chunkSize+8);
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));
  world.resources=[
    {id:1,kind:'tree',species:'oak',x:2,z:2,amount:20,growth:.01,growthTick:0},
    {id:2,kind:'berries',x:3,z:2,amount:10,growth:.64,growthTick:world.tick},
    {id:3,kind:'rock',stone:'granite',x:chunkSize+1,z:2,amount:20},
    {id:4,kind:'tree',species:'pine',x:2,z:chunkSize+2,amount:20},
    {id:5,kind:'tree',species:'oak',x:chunkSize+2,z:chunkSize+2,amount:20},
    {id:6,kind:'wild-plant',species:'grass',x:5,z:2,amount:2},
  ];
  const presentation=new NaturalResourcePresentation();
  const incrementalGroup=new THREE.Group(),fullGroup=new THREE.Group();
  const material=new THREE.MeshStandardNodeMaterial();material.userData.rendererOwned=true;
  const incremental=new ResourceLayer(incrementalGroup,material),full=new ResourceLayer(fullGroup,material);
  const visible=(view:World):World=>({...view,resources:view.resources.filter(r=>!isClusterPlantSpecies(r.species))});
  const initial=visible(presentation.read(world,true)!);
  incremental.update(initial,true,presentation.changes);full.update(initial,true);
  expect(appearance(incrementalGroup)).toEqual(appearance(fullGroup));
  const stableChunkName=`Resources ${Math.floor(world.resources[4]!.x/chunkSize)}:${Math.floor(world.resources[4]!.z/chunkSize)}`;
  const stable=incrementalGroup.children.find(chunk=>chunk.name===stableChunkName)!;
  const stableMeshes=stable.children as THREE.Mesh[];
  const stableGeometries=stableMeshes.map(mesh=>mesh.geometry);
  const stableVersions=stableMeshes.map(mesh=>[mesh.geometry.index!.version,(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).version]);
  const check=()=>{
    const view=presentation.read(world);
    expect(view).toBeDefined();
    const rendering=visible(view!);
    const rng=world.rng;
    incremental.update(rendering,false,presentation.changes);
    full.update(rendering,false);
    expect(world.rng).toBe(rng);
    expectSameDrawn(incrementalGroup,fullGroup);
    expect(incrementalGroup.children.find(chunk=>chunk.name===stableChunkName)).toBe(stable);
    expect(stableMeshes.map(mesh=>mesh.geometry)).toEqual(stableGeometries);
    expect(stableMeshes.map(mesh=>[mesh.geometry.index!.version,(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).version])).toEqual(stableVersions);
  };
  try {
    world.resources[5]!.growth=.4;check(); // cluster-only delta never touches a resource chunk
    world.resources[0]!.growth=.5;check();
    world.resources[1]!.growth=.66;check();
    world.resources[0]!.plantLife={since:world.tick,age:0,darkTicks:0,leaflessAt:world.tick,nextCheck:world.tick+100};check();
    delete world.resources[0]!.plantLife;check();
    const berry=world.resources[1]!;world.resources=world.resources.filter(r=>r.id!==berry.id);check();
    world.resources.splice(1,0,berry);check();
    Object.assign(world.resources[2]!,{x:0,z:chunkSize+2});check(); // old chunk becomes empty
    world.resources[2]!.stone='marble';check();
    Object.assign(world.resources[2]!,{kind:'tree',species:'birch'} satisfies Partial<Resource>);check();
    incremental.setFoliageVisible(false);full.setFoliageVisible(false);
    world.resources.push({id:7,kind:'tree',species:'saguaro',x:chunkSize+2,z:3,amount:10});check();
    incremental.setFoliageVisible(true);full.setFoliageVisible(true);
    world.resources=world.resources.filter(r=>r.id!==7);check();
  } finally {incremental.clear();full.clear();material.dispose();}
});
