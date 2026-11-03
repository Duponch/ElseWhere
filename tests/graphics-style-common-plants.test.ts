/** Real render layers and snapshot writers; only Canvas painting uses synthetic
 * sink pixels. No GPU, atlas raster, gameplay or visual-fidelity claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {attribute} from 'three/tsl';
vi.mock('../src/render/origami/reference-paint-library',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:s.stubReferenceBakeToSink};});
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:s.stubResidentPaintToSink};});
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:s.stubCheckpointPaintToSink,replayCheckpointMaskR8:s.stubReplayCheckpointMaskR8};});
import {createWorld} from '../src/sim/index';
import type {Resource,World} from '../src/sim/types';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {PlantClusterLayer} from '../src/render/PlantClusterLayer';
import {CropLayer} from '../src/render/CropLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {createSurfaceMaterial} from '../src/render/SurfaceMaterials';
import {applyOrigamiSurface,GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import type {ResourceRangeData} from '../src/render/StaticGeometry';
import type {NaturalPresentationChange} from '../src/render/NaturalResourcePresentation';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';
import {createOrigamiGroundTuftGeometry} from '../src/render/origami/flora';

function fixture(){
 const world=createWorld(123,32,32);world.structures=[];
 const species=['bush','berry-bush','agave','moss','grass','tall-grass'] as const;
 world.resources=species.map((species,i):Resource=>({id:1000+i,kind:species==='berry-bush'?'berries':'wild-plant',species,x:3+i,z:5,amount:12,growth:.8}));
 for(const [i,kind]of (['rice','corn','cotton','potato','hops','haygrass'] as const).entries())world.resources.push({id:1100+i,kind,x:3+i,z:9,amount:12,growth:.8,growthTick:world.tick});
 return world;
}
function make(style:'default'|'origami'){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,impasto:0,wear:0,edges:.4,blackEdges:.79}),environment=new EnvironmentLighting(),group=new THREE.Group();
 const plain=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true}),texture=new THREE.DataTexture(new Uint8Array([190,210,150,255]),1,1),paint=style==='origami'?createSurfaceMaterial('physical',0xffffff,{vertexColors:false,roughness:.88,metalness:.02}):createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true,map:texture});
 plain.userData.rendererOwned=paint.userData.rendererOwned=true;applyOrigamiSurface(paint,attribute('color','vec3'),undefined,context);environment.configure(plain);environment.configure(paint);
 const layers=withGraphicsStyle(context,()=>({resources:new ResourceLayer(group,plain,paint),grass:new PlantClusterLayer(plain,paint),crops:new CropLayer(plain,paint)}));
 return{context,group,...layers,update(world:World,reset:boolean,leafless:ReadonlySet<number>,changes?:ReadonlyMap<number,NaturalPresentationChange>){
  layers.resources.update(world,reset,changes,undefined,{read:r=>({size:r.growth??1,ripe:true,leafless:leafless.has(r.id)}),harvestable:r=>r.kind==='berries'});
  layers.grass.update(world,reset,changes);layers.crops.update(world,reset);
 },dispose(){layers.resources.dispose();layers.grass.dispose();layers.crops.dispose();plain.dispose();paint.dispose();texture.dispose();environment.dispose();context.dispose();}};
}
function companions(group:THREE.Group){const result:THREE.Mesh[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh&&(o.userData.referenceCompanion||o.userData.origamiContour||(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.userData.origamiBrush)))result.push(o);});return result;}
function resourceStreams(group:THREE.Group){
 const result:{id:number;count:number;values:number[];paintUv?:number[]}[]=[];
 group.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.userData.referenceCompanion)return;const ranges=o.userData.resourceRanges as ResourceRangeData|undefined;if(!ranges)return;
  const g=o.geometry,index=g.index!,start=g.drawRange.start,end=Math.min(index.count,start+g.drawRange.count),active=new Set(Array.from({length:Math.max(0,end-start)},(_,i)=>index.getX(start+i)));
  for(const range of ranges.ranges){const values:number[]=[],paintUv:number[]=[];let count=0;
   for(let i=range.start;i<range.start+range.count;i++){const v=ranges.original[i]!;if(!active.has(v))continue;count++;for(const name of ['position','normal','color']){const a=g.getAttribute(name);for(let k=0;k<a.itemSize;k++)values.push(a.getComponent(v,k));}if([1000,1001,-2000,-2002,-2003].includes(range.id)){const a=g.getAttribute('uv');paintUv.push(a.getX(v),a.getY(v));}}
   result.push({id:range.id,count,values,...(paintUv.length?{paintUv}:{})});
  }
 });return result;
}
function instanced(group:THREE.Group){
 return group.children.filter((o):o is THREE.InstancedMesh=>o instanceof THREE.InstancedMesh&&!companions(group).includes(o)).map(mesh=>({
  count:mesh.count,attributes:Object.fromEntries(['position','normal','uv','color','windYaw','windBasis'].filter(name=>mesh.geometry.hasAttribute(name)).map(name=>{const a=mesh.geometry.getAttribute(name);return[name,{size:a.itemSize,array:Array.from(a.array)}];})),
  index:mesh.geometry.index?Array.from(mesh.geometry.index.array):null,matrix:Array.from(mesh.instanceMatrix.array),color:Array.from(mesh.instanceColor!.array),range:{...mesh.geometry.drawRange},
 }));
}
test('both appearances share real shrub, grass and crop models and their writers while only Origami prepares paint/ink',()=>{
 const world=fixture(),ordinary=make('default'),origami=make('origami'),bodyOnly=new ReferenceFloraLibrary(true,false),tuft=createOrigamiGroundTuftGeometry(),leafless=new Set<number>();
 const compare=()=>{expect(resourceStreams(ordinary.group)).toEqual(resourceStreams(origami.group));expect(instanced(ordinary.grass.group)).toEqual(instanced(origami.grass.group));expect(instanced(ordinary.crops.group)).toEqual(instanced(origami.crops.group));};
 try{
  const before=JSON.stringify(world);ordinary.update(world,true,leafless);origami.update(world,true,leafless);compare();expect(JSON.stringify(world)).toBe(before);
  for(const p of bodyOnly.recipe('bush').parts){expect(p.lines).toBeNull();expect(p.wear).toBeNull();}
  const ordinaryLibrary=Reflect.get(ordinary.resources,'referenceFlora') as ReferenceFloraLibrary;
  for(const p of ordinaryLibrary.recipe('bush').parts){expect(p.lines).toBeNull();expect(p.wear).toBeNull();}
  for(const resource of world.resources.filter(r=>r.species==='bush'||r.species==='berry-bush')){
   const expected=bodyOnly.recipe('bush').parts.filter(p=>!p.fruit||resource.kind==='berries').reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.getAttribute('position').count),0);
   const actual=resourceStreams(ordinary.group).filter(r=>(r.id<0?Math.floor(-r.id/2):r.id)===resource.id).reduce((n,r)=>n+r.count,0);
   expect(actual).toBe(expected);
  }
  const grassBody=ordinary.grass.group.children.find((o):o is THREE.InstancedMesh=>o instanceof THREE.InstancedMesh)!;
  expect(Array.from(grassBody.geometry.getAttribute('position').array)).toEqual(Array.from(tuft.getAttribute('position').array));
  expect(companions(ordinary.group)).toHaveLength(0);expect(companions(ordinary.grass.group)).toHaveLength(0);expect(companions(ordinary.crops.group)).toHaveLength(0);
  for(const group of [origami.group,origami.grass.group,origami.crops.group])expect(companions(group).length).toBeGreaterThan(0);
  const defaultMaterial=grassBody.material as THREE.NodeMaterial,inkMaterial=(origami.grass.group.children.find((o):o is THREE.InstancedMesh=>o instanceof THREE.InstancedMesh&&!companions(origami.grass.group).includes(o))!.material) as THREE.NodeMaterial;
  expect(defaultMaterial.colorNode).toBeNull();expect(defaultMaterial.normalNode).toBeNull();expect(inkMaterial.colorNode).not.toBeNull();
  const geometry=grassBody.geometry,matrix=grassBody.instanceMatrix,positions=geometry.getAttribute('position');
  for(const r of world.resources)r.growth=.45;
  const changed=new Map(world.resources.map(r=>[r.id,{resource:r,size:r.growth!}]));leafless.add(1000);leafless.add(1001);
  const growthInput=JSON.stringify(world);for(const layer of [ordinary,origami])layer.update(world,false,leafless,changed);compare();expect(JSON.stringify(world)).toBe(growthInput);
  expect(grassBody.geometry).toBe(geometry);expect(grassBody.instanceMatrix).toBe(matrix);expect(geometry.getAttribute('position')).toBe(positions);
  const saved=world.resources;world.resources=world.resources.filter(r=>r.id!==1005&&r.id!==1001&&r.id!==1102);
  for(const layer of [ordinary,origami])layer.update(world,false,leafless);compare();world.resources=saved;leafless.clear();
  for(const layer of [ordinary,origami]){layer.update(world,false,leafless);layer.resources.setTargetPreview(new Set([1000,1001]));layer.grass.setTargetPreview(new Set([1004]));layer.crops.setTargetPreview(new Set([1100]));}compare();
  for(const layer of [ordinary,origami]){layer.resources.clearTargetPreview();layer.grass.clearTargetPreview();layer.crops.clearTargetPreview();layer.resources.setTexturesEnabled(false);layer.grass.setTexturesEnabled(false);layer.crops.setTexturesEnabled(false);}compare();
  const beforeCompile=[instanced(ordinary.grass.group),instanced(ordinary.crops.group)];const restore=[ordinary.grass.prepareForCompile(),ordinary.crops.prepareForCompile(),origami.grass.prepareForCompile(),origami.crops.prepareForCompile()];compare();for(const release of restore)release();compare();expect([instanced(ordinary.grass.group),instanced(ordinary.crops.group)]).toEqual(beforeCompile);
 }finally{tuft.dispose();bodyOnly.dispose();origami.dispose();ordinary.dispose();}
},30000);
