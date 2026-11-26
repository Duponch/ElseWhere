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
import {resourceBrushData,type ResourceBrushData} from '../src/render/StaticGeometry';
import {SceneResourceIndex} from '../src/render/scene-resource-index';
import {createWorld} from '../src/sim/engine';
import {harness} from './resident-presentation-fixtures-v427';
import type {Resource,World} from '../src/sim/types';
import type {NaturalPresentationChange} from '../src/render/NaturalResourcePresentation';

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
   expect(snapshot(b.parts[i]!.lines!),name).toEqual(snapshot(a.parts[i]!.lines!));
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

test('chunk-local wear and resident recoil bases preserve complete indexed geometry across growth, reset, birth and removal',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',wear:0.5,impasto:0,edges:1});
 const world=createWorld(379,24,24);world.structures=[];world.jobs=[];world.resources=[];world.tiles=world.tiles.map(()=>({terrain:'soil'}));
 const tree=(x:number,z:number,species:Resource['species'],growth:number):Resource=>({id:world.nextId++,kind:'tree',species,x,z,amount:25,growth,growthTick:world.tick});
 const a=tree(3,4,'oak',.25),b=tree(7,8,'pine',.7);
 world.resources=[a,b,{id:world.nextId++,kind:'berries',x:8,z:8,amount:3,growth:.4,growthTick:world.tick}];
 const h=harness(world),index=new SceneResourceIndex(),plain=new THREE.MeshLambertNodeMaterial(),paint=new THREE.MeshStandardNodeMaterial();plain.userData.rendererOwned=paint.userData.rendererOwned=true;
 const raw=new THREE.Group(),native=new THREE.Group(),literal=withGraphicsStyle(context,()=>new ResourceLayer(raw,plain,paint)),candidate=withGraphicsStyle(context,()=>new ResourceLayer(native,plain,paint));
 type Part={mesh:THREE.Mesh;positions:Float32Array;expansions?:Float32Array;brush?:ResourceBrushData};
 const parts=(layer:ResourceLayer)=>Reflect.get(layer,'treeParts') as Map<number,Part[]>;
 // Independent reference of the historical whole-mesh resting-base copy.
 Reflect.set(literal,'refreshTreeBases',(ids:readonly number[])=>{
  const copies=new Map<THREE.Mesh,Float32Array>(),expansions=new Map<THREE.Mesh,Float32Array>(),brushes=new Map<THREE.Mesh,ResourceBrushData>();
  for(const id of ids)for(const part of parts(literal).get(id)??[]){
   let positions=copies.get(part.mesh);if(!positions){positions=new Float32Array(part.mesh.geometry.getAttribute('position').array);copies.set(part.mesh,positions);}part.positions=positions;
   const expand=part.mesh.geometry.getAttribute('origamiWearExpand');if(expand){let copy=expansions.get(part.mesh);if(!copy){copy=new Float32Array(expand.array);expansions.set(part.mesh,copy);}part.expansions=copy;}
   const brush=resourceBrushData(part.mesh.geometry);if(brush){let copy=brushes.get(part.mesh);if(!copy){copy={base:brush.base.slice(),width:brush.width.slice(),rough:brush.rough.slice()};brushes.set(part.mesh,copy);}part.brush=copy;}
  }
 });
 const surfaces=(group:THREE.Group)=>group.children.map(chunk=>({name:chunk.name,items:chunk.children.filter(obj=>obj instanceof THREE.Mesh).map(mesh=>({name:mesh.name,visible:mesh.visible,companion:mesh.userData.referenceCompanion,geometry:snapshot((mesh as THREE.Mesh).geometry)}))}));
 const check=()=>expect(surfaces(native)).toEqual(surfaces(raw));
 const appearance={read:(r:Resource)=>({size:r.kind==='rock'?1:r.growth??1,ripe:(r.growth??1)>.5,leafless:false}),harvestable:(r:Resource)=>r.kind==='berries'&&(r.growth??1)>.5};
 let previous:World|undefined;
 const apply=(reset=false)=>{
  const w=h.send(),changes=new Map<number,NaturalPresentationChange>();
  for(const r of w.resources)changes.set(r.id,{resource:r,size:appearance.read(r).size});for(const r of previous?.resources??[])if(!w.resources.some(next=>next.id===r.id))changes.set(r.id,{resource:undefined,size:0});
  literal.update(w,reset,changes,undefined,appearance);candidate.update(w,reset,changes,index.adopt(w,reset),appearance);previous=w;check();
 };
 const hit=(r:Resource,angle:number)=>{for(const layer of [literal,candidate]){
  const pose={at:0,x:r.x,z:r.z,axisX:1,axisZ:0,angle:NaN};Reflect.get(layer,'treeHits').set(r.id,pose);Reflect.apply(Reflect.get(layer,'poseTree'),layer,[r.id,pose,angle]);
 }check();};
 try{
  apply(true);expect(native.children.some(chunk=>chunk.children.some(obj=>obj.userData.referenceCompanion==='wear'))).toBe(true);
  hit(b,.12);a.growth=.42;apply();const resting=parts(candidate).get(a.id)!.map(p=>p.positions);
  hit(a,-.04);b.growth=.82;apply();expect(parts(candidate).get(a.id)!.map((p,i)=>p.positions===resting[i])).toEqual(resting.map(()=>true));
  hit(a,.15);hit(b,-.08);for(const layer of [literal,candidate])layer.clearChopRecoil();check();
  const born=tree(5,5,'birch',.4);world.resources.push(born);apply();hit(born,.18);born.growth=.55;apply();
  delete world.resources[0]!.growth;world.resources.shift();apply();world.resources.unshift(a);a.growth=.61;apply();hit(a,.16);check();
 }finally{candidate.dispose();literal.dispose();context.dispose();plain.dispose();paint.dispose();index.clear();}
});
