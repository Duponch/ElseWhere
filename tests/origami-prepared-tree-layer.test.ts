/** Real ResourceLayer + actual Source recipes/placements, synthetic Canvas
 * boundary only. Renderer records below are deliberately NOT simulation Worlds.
 * No device, pixels, atlas raster, frame time or gameplay claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ResourceLayer,type PreparedTreeCatalogStage} from '../src/render/ResourceLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {compileLegacyTreeRecipe,createReadyTreeRecipe} from '../src/render/origami/baked/trees/recipe';
import type {TreeAssetCatalog,ReadyTreeRecipe} from '../src/render/origami/baked/trees/types';
import type {ResourceRangeData} from '../src/render/StaticGeometry';
import type {Resource} from '../src/sim/types';

const settings={impasto:0,wear:0,edges:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6};
function bodies(group:THREE.Group){const result:THREE.Mesh[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh&&!o.userData.referenceCompanion)result.push(o);});return result;}
function prepared(group:THREE.Group){return bodies(group).filter(o=>o.geometry.hasAttribute('bakedUv'));}
function stream(group:THREE.Group,id:number,attribute:string):number[]{
 const result:number[]=[];for(const mesh of bodies(group)){const d=mesh.userData.resourceRanges as ResourceRangeData|undefined;if(!d)continue;const a=mesh.geometry.getAttribute(attribute);for(const range of d.ranges)if(range.id===id||range.id===-id*2)for(let i=range.start;i<range.start+range.count;i++)for(let c=0;c<a.itemSize;c++)result.push(a.getComponent(d.original[i]!,c));}return result;
}
function record(){return{width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},resources:[{id:1001,kind:'tree',species:'poplar',x:8,z:8,amount:1,growth:1},{id:1002,kind:'tree',species:'poplar',x:9,z:8,amount:1,growth:1},{id:1003,kind:'rock',x:10,z:8,amount:1}] as Resource[],structures:[],pawns:[{id:7,x:7,z:8,state:'working',jobId:91}],jobs:[{id:91,kind:'chop',x:8,z:8,status:'active',reservedBy:7,progress:0}]};}
type RecordInput=ReturnType<typeof record>;
function update(layer:ResourceLayer,input:RecordInput,newMap:boolean,leafless:ReadonlySet<number>=new Set()){
 const before=JSON.stringify(input),appearance={read:(r:Resource)=>({size:r.growth??1,ripe:true,leafless:leafless.has(r.id)}),harvestable:()=>false};
 Reflect.apply(layer.update,layer,[input,newMap,undefined,undefined,appearance]);expect(JSON.stringify(input)).toBe(before);
}
function freshLegacy(input:RecordInput){const group=new THREE.Group(),material=new THREE.MeshLambertNodeMaterial({vertexColors:true});material.userData.rendererOwned=true;const layer=new ResourceLayer(group,material);try{update(layer,input,true);expect(layer.treeBakeDemand()).toMatchObject({key:'[]',species:[]});return new Map([1001,1002].map(id=>[id,{position:stream(group,id,'position'),normal:stream(group,id,'normal')} ]));}finally{layer.dispose();material.dispose();}}
function catalog(ready:ReadyTreeRecipe,texture:THREE.Texture,revision:number):TreeAssetCatalog{return{revision,texture,pageCount:1,readReady:species=>species==='poplar'?ready:undefined,assertCurrent:()=>ready.assertCurrent()};}

test('prepared trees publish cached chunks atomically, preserve real Legacy corners/wind/growth/ranges, and restore preview and failed staging owners',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',...settings}),environment=new EnvironmentLighting(),group=new THREE.Group(),plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshStandardNodeMaterial({vertexColors:true});
 plain.userData.rendererOwned=paint.userData.rendererOwned=true;environment.configure(plain);environment.configure(paint);
 const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint)),recipe=compileLegacyTreeRecipe('poplar',{paintGeneration:'TEST-layer-owned-metadata',settings,pageSize:2048,maxCpuBytes:8*1024*1024}),ready=createReadyTreeRecipe(recipe,0,1),texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),input=record(),masters=[...new Set(ready.parts.map(p=>p.geometry))];
 let masterDisposes=0,textureDisposes=0;for(const g of masters)g.addEventListener('dispose',()=>masterDisposes++);texture.addEventListener('dispose',()=>textureDisposes++);
 const masterBefore=masters.map(g=>Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,Array.from(a.array)]))),stages:PreparedTreeCatalogStage[]=[];
 try{
  update(layer,input,true);expect(layer.treeBakeDemand().species).toEqual(['poplar']);expect(layer.bakedTreeStatus()).toMatchObject({total:2,ready:0,fallbackReason:'atlas-not-prepared'});expect(stream(group,1001,'position').length/9).toBeGreaterThan(60);
  const expected=freshLegacy(input),sourcePrograms=layer.compiledMaterials435(),stage=layer.prepareTreeAssetCatalog(catalog(ready,texture,1),environment.configure);stages.push(stage);expect(stage.warmup).toHaveLength(3);expect(layer.compiledMaterials435()).toEqual(sourcePrograms);
  const newMaterials=stage.warmup.map(m=>m.material as THREE.MeshLambertNodeMaterial);let retired=0;for(const m of newMaterials)m.addEventListener('dispose',()=>retired++);
  const transaction=stage.publish();stage.dispose();transaction.commit();expect(retired).toBe(0);expect(layer.bakedTreeStatus()).toMatchObject({ready:2,fallback:0,texturePages:1});
  const meshes=prepared(group);expect(meshes).toHaveLength(2);const treePosition=Reflect.get(layer,'windTextured').positionNode;
  for(const mesh of meshes){expect(mesh.material).toBeInstanceOf(THREE.MeshLambertNodeMaterial);expect((mesh.material as THREE.NodeMaterial).positionNode).toBe(treePosition);expect((mesh.material as THREE.NodeMaterial).normalNode).toBeNull();for(const a of Object.values(mesh.geometry.attributes))expect(a).toBeInstanceOf(THREE.BufferAttribute);const uv=mesh.geometry.getAttribute('bakedUv');expect(uv.itemSize).toBe(3);for(let v=0;v<uv.count;v++)expect(uv.getZ(v)).toBe(0);}
  for(const id of [1001,1002]){expect(stream(group,id,'position')).toEqual(expected.get(id)!.position);expect(stream(group,id,'normal')).toEqual(expected.get(id)!.normal);expect(stream(group,id,'position')).toHaveLength(60*9);}
  // Every actual range keeps precisely its template UVs even under the true
  // nonuniform species scales and yaw; no physicalPatternSpan/crop is applied.
  const expectedUv=new Map<number,number[]>();for(const r of input.resources.filter(r=>r.kind==='tree')){const parts=ready.place(r,0,1)!;expectedUv.set(r.id,parts.flatMap(p=>Array.from(p.template.geometry.getAttribute('bakedUv').array)));}
  for(const id of [1001,1002])expect(stream(group,id,'bakedUv')).toEqual(expectedUv.get(id));
  const programRefs=meshes.map(m=>m.material),geometryRefs=meshes.map(m=>m.geometry),uvRefs=meshes.map(m=>m.geometry.getAttribute('bakedUv')),colors=meshes.map(m=>Array.from(m.geometry.getAttribute('color').array)),materialChanges=vi.fn();layer.compiledMaterialsChanged435=materialChanges;
  layer.setTargetPreview(new Set([1001]));expect(materialChanges).toHaveBeenCalledTimes(1);expect(meshes.every((m,i)=>m.material!==programRefs[i])).toBe(true);layer.setTargetPreview(new Set([1002]));expect(materialChanges).toHaveBeenCalledTimes(1);layer.clearTargetPreview();expect(materialChanges).toHaveBeenCalledTimes(2);expect(meshes.map(m=>m.material)).toEqual(programRefs);expect(meshes.map(m=>Array.from(m.geometry.getAttribute('color').array))).toEqual(colors);
  layer.setTexturesEnabled(false);expect(meshes.every(m=>(m.material as THREE.MeshLambertNodeMaterial).vertexColors)).toBe(true);layer.setTexturesEnabled(true);expect(meshes.map(m=>m.material)).toEqual(programRefs);
  const beforeWind=stream(group,1001,'position');layer.setWind(1,.7,.3);layer.presentWind(123);expect(stream(group,1001,'position')).toEqual(beforeWind);expect(meshes.map(m=>m.geometry)).toEqual(geometryRefs);
  input.resources[0]!.growth=.63;update(layer,input,false);const grown=freshLegacy(input);for(const id of [1001,1002]){const actual=stream(group,id,'position'),source=grown.get(id)!.position;expect(actual).toHaveLength(source.length);expect(Math.max(...actual.map((v,i)=>Math.abs(v-source[i]!)))).toBeLessThan(.000002);}expect(prepared(group).map(m=>m.geometry)).toEqual(geometryRefs);expect(meshes.map(m=>m.geometry.getAttribute('bakedUv'))).toEqual(uvRefs);
  const canopy=meshes.find(m=>m.name==='tree-canopy')!,index=canopy.geometry.index!,visible=canopy.geometry.drawRange.count;update(layer,input,false,new Set([1001]));expect(canopy.geometry.drawRange.count).toBe(visible/2);update(layer,input,false);expect(canopy.geometry.index).toBe(index);expect(canopy.geometry.drawRange.count).toBe(visible);
  // Actual producer recoil uses the final ready ranges and immutable bases;
  // renderer records exercise it without claiming simulation admission.
  const phase=7*1.7-1.5*Math.PI;let tick=2;while(Math.floor((11*tick/6+phase)/(2*Math.PI))===Math.floor((11*(tick-1)/6+phase)/(2*Math.PI)))tick++;
  input.tick=tick-1;const next=structuredClone(input);next.tick=tick;next.jobs[0]!.progress=1;const at=(Math.floor((11*tick/6+phase)/(2*Math.PI))*2*Math.PI-phase)/11,beforeChop=stream(group,1001,'position'),other=stream(group,1002,'position');Reflect.apply(layer.adoptChopWork,layer,[input,next]);layer.presentChop(at+.09);expect(stream(group,1001,'position')).not.toEqual(beforeChop);expect(stream(group,1002,'position')).toEqual(other);layer.clearChopRecoil();expect(stream(group,1001,'position')).toEqual(beforeChop);
  // Same IDs still rebuild at the explicit catalog epoch. Until commit, the
  // previous program remains owned for435 reconciliation or rollback.
  const second=layer.prepareTreeAssetCatalog(catalog(ready,texture,2),environment.configure);stages.push(second);const secondMaterials=second.warmup.map(m=>m.material as THREE.NodeMaterial);let secondRetired=0;secondMaterials.forEach(m=>m.addEventListener('dispose',()=>secondRetired++));const publication=second.publish();expect(prepared(group).every(m=>!geometryRefs.includes(m.geometry))).toBe(true);expect(retired).toBe(0);publication.rollback();publication.commit();second.dispose();expect(secondRetired).toBe(3);expect(layer.bakedTreeStatus().revision).toBe(1);
  // Failure after a candidate family is created restores Source/old-ready
  // contents. A failing warmup disposer must not skip any of its three mats.
  const badReady:ReadyTreeRecipe={...ready,place(){throw Error('TEST placement failed');}},failed=layer.prepareTreeAssetCatalog(catalog(badReady,texture,3),environment.configure);stages.push(failed);let attempts=0;failed.warmup.forEach(m=>(m.material as THREE.Material).addEventListener('dispose',()=>attempts++));failed.warmup[0]!.geometry.addEventListener('dispose',()=>{throw Error('TEST warmup cleanup failed');});expect(()=>failed.publish()).toThrow('TEST placement failed');expect(layer.bakedTreeStatus()).toMatchObject({revision:1,ready:2});expect(()=>failed.dispose()).toThrow(AggregateError);expect(attempts).toBe(3);expect(textureDisposes).toBe(0);
  input.resources[0]!.blight={since:0,severity:.5,lastHarmTick:0,nextCheck:200,rng:1};update(layer,input,false);expect(layer.bakedTreeStatus()).toMatchObject({ready:1,fallback:1,fallbackReason:'unsupported-species-or-blight-or-placement-mismatch'});expect(stream(group,1001,'position').length/9).toBeGreaterThan(60);delete input.resources[0]!.blight;update(layer,input,false);expect(layer.bakedTreeStatus().ready).toBe(2);expect(stream(group,1001,'position')).toHaveLength(60*9);
  expect(masters.map(g=>Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,Array.from(a.array)])))).toEqual(masterBefore);expect(masterDisposes).toBe(0);layer.dispose();expect(retired).toBe(3);expect(textureDisposes).toBe(0);expect(masterDisposes).toBe(0);
 }finally{for(const stage of stages)stage.dispose();layer.dispose();ready.dispose();recipe.dispose();texture.dispose();plain.dispose();paint.dispose();environment.dispose();context.dispose();}
});
