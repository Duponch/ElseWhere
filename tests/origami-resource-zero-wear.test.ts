import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';
import {ORIGAMI_FLORA_REFERENCES} from '../src/render/origami/flora-reference';
import {ResourceLayer} from '../src/render/ResourceLayer';

function snapshot(geometry:THREE.BufferGeometry){return{
 attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,{size:a.itemSize,normalized:a.normalized,array:Array.from(a instanceof THREE.InterleavedBufferAttribute?a.data.array:a.array)}])),
 index:geometry.index?Array.from(geometry.index.array):null,groups:geometry.groups,range:geometry.drawRange,
};}

test('all source flora omit wear at construction without changing their painted bodies, edges or transforms',()=>{
 const complete=new ReferenceFloraLibrary(),without=new ReferenceFloraLibrary(false);
 try{for(const name of ORIGAMI_FLORA_REFERENCES){
  const a=complete.recipe(name),b=without.recipe(name);expect(b.parts.length,name).toBe(a.parts.length);
  expect(a.parts.some(part=>part.wear!==null),name).toBe(true);
  for(let i=0;i<a.parts.length;i++){
   expect(b.parts[i]!.wear,name).toBeNull();
   expect(snapshot(b.parts[i]!.geometry),name).toEqual(snapshot(a.parts[i]!.geometry));
   expect(snapshot(b.parts[i]!.lines),name).toEqual(snapshot(a.parts[i]!.lines));
   expect(b.parts[i]!.partMatrix.toArray(),name).toEqual(a.parts[i]!.partMatrix.toArray());
   expect(b.parts[i]!.profileId,name).toBe(a.parts[i]!.profileId);
  }
 }}finally{complete.dispose();without.dispose();}
});

test('a real zero-wear resource layer never creates wear materials, meshes or registrations',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0,edges:1});
 const createWear=vi.spyOn(context,'createWearMaterial'),registerWear=vi.spyOn(context,'trackWearGeometry');
 const group=new THREE.Group(),plain=new THREE.MeshLambertNodeMaterial(),paint=new THREE.MeshStandardNodeMaterial();
 plain.userData.rendererOwned=paint.userData.rendererOwned=true;
 const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint));
 const record={width:32,height:32,tick:0,seed:123,resources:[{id:1001,kind:'tree',species:'oak',x:8,z:8,amount:1,growth:1}],structures:[],site:{biome:'temperate-forest'}};
 const before=JSON.stringify(record),appearance={read:()=>({size:1,ripe:true,leafless:false}),harvestable:()=>false};
 try{
  Reflect.apply(Reflect.get(layer,'update'),layer,[record,true,undefined,undefined,appearance]);
  const companions:unknown[]=[],bodies:THREE.Mesh[]=[],brushes:THREE.Mesh[]=[];
  group.traverse(object=>{if(!(object instanceof THREE.Mesh))return;companions.push(object.userData.referenceCompanion);if(object.userData.referenceCompanion==='lines')brushes.push(object);else if(!object.userData.referenceCompanion)bodies.push(object);});
  expect(createWear).not.toHaveBeenCalled();expect(registerWear).not.toHaveBeenCalled();expect(companions).not.toContain('wear');
  expect(brushes.length).toBeGreaterThan(0);expect(bodies.length).toBeGreaterThan(0);
  for(const mesh of [...bodies,...brushes])for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])expect((material as THREE.NodeMaterial).normalNode).toBeNull();
  expect(Reflect.get(context,'wearGeometries').size).toBe(0);expect(JSON.stringify(record)).toBe(before);
 }finally{layer.dispose();plain.dispose();paint.dispose();context.dispose();}
});
