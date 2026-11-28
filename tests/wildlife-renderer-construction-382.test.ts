import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{
 const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');
 return {...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};
});
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import type {SceneTextureLoader} from '../src/render/scene-render-ports';
import {ANIMAL_DESIGNATION_ATLAS_URL} from '../src/render/AnimalSlaughterMarker';

// A new map constructs all rigs before any visible animal is known. Checking
// only the newly generated fauna would miss a species that breaks creation
// for every map, even a map that does not contain that species at all.
test.each(['default','origami'] as const)('new-game wildlife construction covers the entire Core catalogue in %s style',style=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,impasto:0,wear:0});
 // Browser paint pixels require OffscreenCanvas. Keep the actual geometry,
 // shader graphs, resident rig and texture-owner construction under test.
 const paint=vi.spyOn(context,'flushPaint').mockImplementation(()=>{});
 const loaded=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),retired=vi.fn();loaded.addEventListener('dispose',retired);
 const loadTexture:SceneTextureLoader=vi.fn((url,accept)=>{expect(url).toBe(ANIMAL_DESIGNATION_ATLAS_URL);accept(loaded);});
 let layer:WildlifeLayer|undefined;
 try{
  layer=withGraphicsStyle(context,()=>new WildlifeLayer(undefined,loadTexture));
  expect(loadTexture).toHaveBeenCalledTimes(1);
  expect(layer.sharedSurfaceStatus().species.map(row=>row.species)).toEqual([...ANIMAL_SPECIES_IDS]);
  expect(layer.mesh.children).toHaveLength(ANIMAL_SPECIES_IDS.length*3);
  expect(layer.flames.children).toHaveLength(ANIMAL_SPECIES_IDS.length);
  const rigs=Reflect.get(layer,'rigs') as {species:string;mesh:THREE.Mesh<THREE.InstancedBufferGeometry>;selection:THREE.Mesh;slaughter:THREE.Mesh;flames:THREE.Mesh}[];
  expect(rigs.map(rig=>rig.species)).toEqual([...ANIMAL_SPECIES_IDS]);
  for(const {species,mesh,selection,slaughter,flames} of rigs){
   expect(mesh,species).toBeInstanceOf(THREE.Mesh);
   for(const attached of [mesh,selection,slaughter])expect(layer.mesh.children,species).toContain(attached);
   expect(layer.flames.children,species).toContain(flames);
   const geometry=mesh.geometry;
   expect(geometry.index?.count,species).toBeGreaterThan(0);
   expect(geometry.instanceCount,species).toBe(0);
   expect(geometry.getAttribute('animalSurfaceUv').itemSize,species).toBe(4);
   expect(geometry.getAttribute('aFrom').count,species).toBeGreaterThan(0);
  }
 }finally{layer?.dispose();context.dispose();paint.mockRestore();}
 expect(retired).toHaveBeenCalledTimes(1);
},60000);
