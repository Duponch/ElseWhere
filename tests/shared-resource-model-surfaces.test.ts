import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {TreeModels,TREE_MODEL_SPECIES} from '../src/render/models/TreeModels';
import {createResourceSurfaceModels} from '../src/render/models/ResourceSurfaceModels';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';

function triangleWords(g:THREE.BufferGeometry,name:string){const a=g.getAttribute(name),out=new Float32Array((g.index?.count??a.count)*a.itemSize);for(let i=0;i<out.length/a.itemSize;i++)for(let c=0;c<a.itemSize;c++)out[i*a.itemSize+c]=a.getComponent(g.index?.getX(i)??i,c);return new Uint32Array(out.buffer);}

test('finite resource surfaces retain both tree variants, continuous placements and exact source triangle/UV streams within packed domains',()=>{
 const trees=new TreeModels(),flora=new ReferenceFloraLibrary(false,false);let surface:ReturnType<typeof createResourceSurfaceModels>|undefined;
 try{
  surface=createResourceSurfaceModels(trees,flora);
  expect(surface.stroke.faceCount).toBeLessThanOrEqual(4096);expect(surface.cpuBytes).toBeLessThan(64*1024*1024);
  for(const variant of ['broadleaf','conical'] as const)for(const species of [...TREE_MODEL_SPECIES,undefined])for(const p of trees.get(species,variant).parts){
   const mapped=surface.map(p.geometry);for(const name of ['position','normal','uv','bakedUv'])expect(triangleWords(mapped,name),`${species}/${variant}/${p.slot}/${name}`).toEqual(triangleWords(p.geometry,name));
   expect(mapped.getAttribute('surfaceStrokeFace').count).toBe(mapped.getAttribute('position').count);
  }
  expect(trees.snapshot().models).toBe(28);expect(trees.snapshot().cpuBytes).toBeLessThan(8*1024*1024);
 }finally{surface?.dispose();flora.dispose();trees.dispose();}
});
