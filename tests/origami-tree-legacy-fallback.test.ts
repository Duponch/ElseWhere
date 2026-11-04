/** Real ResourceLayer geometry/material/range boundary. Synthetic Canvas pixels
 * only; no renderer/device, atlas raster, gameplay or visual-fidelity claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-paint-library',async original=>{const stub=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stub.stubReferenceBakeToSink};});
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const stub=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>{const stub=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stub.stubCheckpointPaintToSink,replayCheckpointMaskR8:stub.stubReplayCheckpointMaskR8};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {TREE_SPECIES} from '../src/render/origami/baked/trees/recipe';
import type {TreeAssetCatalog} from '../src/render/origami/baked/trees/types';
import type {TextureSurfaceSlot} from '../src/render/surfaces/TextureSurface';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import * as edgeWear from '../src/render/origami/reference-edges';
import type {ResourceRangeData} from '../src/render/StaticGeometry';
import type {Resource} from '../src/sim/types';

function fixture(){const resources:Resource[]=TREE_SPECIES.map((species,i)=>({id:1000+i,kind:'tree',species,x:5+i,z:8,amount:1,growth:.8}));resources.push({id:1100,kind:'tree',x:7,z:12,amount:1,growth:.8},{id:1101,kind:'tree',species:'oak',x:9,z:12,amount:1,growth:.8,blight:{since:0,severity:.5,lastHarmTick:0,nextCheck:200,rng:1}},{id:1200,kind:'rock',x:11,z:12,amount:1});return{width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},resources,structures:[],pawns:[{id:7,x:4,z:8,state:'working',jobId:91}],jobs:[{id:91,kind:'chop',x:5,z:8,status:'active',reservedBy:7,progress:0}]};}
type Input=ReturnType<typeof fixture>;
function update(layer:ResourceLayer,input:Input){const before=JSON.stringify(input);Reflect.apply(layer.update,layer,[input,true,undefined,undefined,{read:(r:Resource)=>({size:r.growth??1,ripe:true,leafless:false}),harvestable:()=>false}]);expect(JSON.stringify(input)).toBe(before);}
function meshes(group:THREE.Group,kind?:string){const out:THREE.Mesh[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh&&(kind?o.userData.referenceCompanion===kind:!o.userData.referenceCompanion))out.push(o);});return out;}
function stream(group:THREE.Group,id:number,field:string){const out:number[]=[];for(const mesh of meshes(group)){const ranges=mesh.userData.resourceRanges as ResourceRangeData|undefined,a=mesh.geometry.getAttribute(field);if(!ranges||!a)continue;for(const range of ranges.ranges)if(range.id===id||range.id===-id*2)for(let i=range.start;i<range.start+range.count;i++)for(let c=0;c<a.itemSize;c++)out.push(a.getComponent(ranges.original[i]!,c));}return out;}
function compareTuple(a:readonly number[],b:readonly number[]){for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]!-b[i]!;return a.length-b.length;}
/** Compare the same opaque triangle multiset without assuming canonical-shape
 * batches retain resource-part order. Each corner keeps position+normal+RGB
 * together. Only cyclic rotations are admitted: never reverse its winding or
 * sort the scalar components independently. Duplicated triangles stay counted. */
function logicalTriangles(group:THREE.Group,id:number):number[][]{
 const triangles:number[][]=[];
 for(const mesh of meshes(group)){
  const data=mesh.userData.resourceRanges as ResourceRangeData|undefined;if(!data)continue;
  const attrs=['position','normal','color'].map(name=>mesh.geometry.getAttribute(name));if(attrs.some(a=>!a||a.itemSize!==3))throw Error('Joint Source position/normal/RGB3 streams required');
  for(const range of data.ranges)if(range.id===id||range.id===-id*2){
   expect(range.count%3).toBe(0);
   for(let i=range.start;i<range.start+range.count;i+=3){const corners=[0,1,2].map(k=>attrs.flatMap(a=>[a.getX(data.original[i+k]!),a.getY(data.original[i+k]!),a.getZ(data.original[i+k]!)])),rotations=[0,1,2].map(k=>[...corners[k]!,...corners[(k+1)%3]!,...corners[(k+2)%3]!]);rotations.sort(compareTuple);triangles.push(rotations[0]!);}
  }
 }
 return triangles.sort(compareTuple);
}
function make(context:GraphicsStyleContext){const group=new THREE.Group(),plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshStandardNodeMaterial({vertexColors:true}),environment=new EnvironmentLighting(),pastel=createStylizedSurfaceTexture('vegetation');plain.userData.rendererOwned=paint.userData.rendererOwned=true;environment.configure(plain);environment.configure(paint);const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint,undefined,{pastelTexture:pastel,configure:environment.configure}));return{group,layer,environment,dispose(){layer.dispose();plain.dispose();paint.dispose();pastel.dispose();environment.dispose();}};}

test('all tree models stay common before or after complete-bank refusal while positive effects retain their explicit Source graph and tree-only wear',()=>{
 const input=fixture(),originalInput=JSON.stringify(input),treeIds=input.resources.filter(r=>r.kind==='tree').map(r=>r.id),legacyContext=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default'}),legacy=make(legacyContext),expected=new Map<number,number[][]>();
 try{update(legacy.layer,input);for(const id of treeIds){expected.set(id,logicalTriangles(legacy.group,id));expect(expected.get(id)!.length).toBeGreaterThan(0);}}finally{legacy.dispose();legacyContext.dispose();}
 const wearFactory=vi.spyOn(edgeWear,'createPhysicalEdgeWearGeometry');
 try{for(const mode of ['not-prepared','catalog-missing-model','positive-effects'] as const){
  const positive=mode==='positive-effects',context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:positive?1:0,wear:positive?.75:0,edges:positive?.5:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6}),actual=make(context),depth=mode==='catalog-missing-model'?13:2,texture=new THREE.DataArrayTexture(new Uint8Array(2*2*4*depth),2,2,depth),beforeWear=wearFactory.mock.calls.length;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  try{
   update(actual.layer,input);
   const demand=actual.layer.treeBakeDemand();expect(demand.models.length).toBe(positive?0:14);
   if(mode==='catalog-missing-model'){
    const models=demand.models.slice(0,-1),slots:TextureSurfaceSlot[]=Array.from({length:64},()=>({layer:0,paletteBaked:false}));models.forEach((m,i)=>{slots[m.surfaceSlot]={layer:i,paletteBaked:true};});const missing:TreeAssetCatalog={revision:1,texture,pageCount:models.length,modelKeys:models.map(m=>m.key),slots,assertCurrent:()=>{}},before=meshes(actual.group).map(m=>({mesh:m,geometry:m.geometry,material:m.material,attrs:Object.values(m.geometry.attributes).map(a=>[a,a.array])})),programs=actual.layer.compiledMaterials435(),dirty=vi.fn();actual.layer.compiledMaterialsChanged435=dirty;
    expect(()=>actual.layer.setTreeAssetCatalog(missing,actual.environment.configure)).toThrow('Complete compatible tree texture bank');expect(dirty).not.toHaveBeenCalled();expect(actual.layer.compiledMaterials435()).toEqual(programs);for(const r of before){expect(r.mesh.geometry).toBe(r.geometry);expect(r.mesh.material).toBe(r.material);Object.values(r.geometry.attributes).forEach((a,i)=>{expect(a).toBe(r.attrs[i]![0]);expect(a.array).toBe(r.attrs[i]![1]);});}
   }
   expect(actual.layer.bakedTreeStatus()).toMatchObject({ready:0,fallback:treeIds.length,total:treeIds.length});
   for(const id of treeIds)expect(logicalTriangles(actual.group,id),mode+':joint-position-normal-color-triangles:'+id).toEqual(expected.get(id));
   const body=meshes(actual.group),ink=meshes(actual.group,'lines'),wear=meshes(actual.group,'wear'),ownsTree=(mesh:THREE.Mesh)=>{const d=mesh.userData.resourceRanges as ResourceRangeData|undefined;return d?.ranges.some(r=>treeIds.some(id=>r.id===id||r.id===-id*2))??false;},treeBodies=body.filter(ownsTree),treeInk=ink.filter(ownsTree);expect(treeBodies.length).toBeGreaterThan(0);expect(treeBodies.every(m=>m.geometry.hasAttribute('bakedUv')===!positive)).toBe(true);expect(treeInk.length>0).toBe(positive);
   if(!positive)for(const mesh of treeBodies){expect(mesh.material).toBeInstanceOf(THREE.MeshLambertNodeMaterial);const uv=mesh.geometry.getAttribute('bakedUv');expect(uv.itemSize).toBe(3);expect((mesh.material as THREE.NodeMaterial).normalNode).toBeNull();const data=mesh.userData.resourceRanges as ResourceRangeData;for(const range of data.ranges){const id=range.id<0?Math.floor(-range.id/2):range.id,resource=input.resources.find(r=>r.id===id)!,model=demand.models.find(m=>m.species===resource.species)!;for(let i=range.start;i<range.start+range.count;i++)expect(uv.getZ(data.original[i]!)).toBe(model.surfaceSlot);}}
   if(positive)expect(actual.layer.bakedTreeStatus().fallbackReason).toBe('positive-effects-not-yet-in-shared-texture-compiler');
   for(const mesh of body){expect(mesh.geometry.hasAttribute('origamiPaint')).toBe(true);expect(Array.isArray(mesh.material)).toBe(false);const material=mesh.material as THREE.NodeMaterial;expect(material.colorNode).not.toBeNull();expect(material.normalNode!==null).toBe(positive);}
   for(const mesh of ink){expect(Array.isArray(mesh.material)).toBe(false);expect((mesh.material as THREE.NodeMaterial).userData.origamiContour).toBe(true);if(ownsTree(mesh))expect(mesh.geometry.getAttribute('windRoot')).toBeDefined();}
   if(positive){expect(wearFactory.mock.calls.length).toBeGreaterThan(beforeWear);expect(wear.length).toBeGreaterThan(0);const worn=new Set<number>();for(const mesh of wear){expect(mesh.geometry.getAttribute('origamiWearExpand')).toBeDefined();expect(mesh.geometry.getAttribute('windRoot')).toBeDefined();const data=mesh.userData.resourceRanges as ResourceRangeData;for(const range of data.ranges){expect(range.id).not.toBe(1200);expect(range.id).not.toBe(-2400);for(const id of treeIds)if(range.id===id||range.id===-id*2)worn.add(id);}}expect([...worn].sort((a,b)=>a-b)).toEqual([...treeIds].sort((a,b)=>a-b));}
   else{expect(wearFactory.mock.calls.length).toBe(beforeWear);expect(wear).toHaveLength(0);}
   const geometryOwners=body.map(m=>m.geometry),first=treeIds[0]!,before=stream(actual.group,first,'position'),colors=treeIds.map(id=>stream(actual.group,id,'color'));
   actual.layer.setTargetPreview(new Set([first]));actual.layer.clearTargetPreview();expect(treeIds.map(id=>stream(actual.group,id,'color'))).toEqual(colors);expect(body.map(m=>m.geometry)).toEqual(geometryOwners);
   actual.layer.setWind(1,.6,.8);actual.layer.presentWind(123.25);expect(stream(actual.group,first,'position')).toEqual(before);
   const phase=7*1.7-1.5*Math.PI;let tick=2;while(Math.floor((11*tick/6+phase)/(2*Math.PI))===Math.floor((11*(tick-1)/6+phase)/(2*Math.PI)))tick++;const previous=structuredClone(input),next=structuredClone(input);previous.tick=tick-1;next.tick=tick;next.jobs[0]!.progress=1;const at=(Math.floor((11*tick/6+phase)/(2*Math.PI))*2*Math.PI-phase)/11;Reflect.apply(actual.layer.adoptChopWork,actual.layer,[previous,next]);actual.layer.presentChop(at+.09);expect(stream(actual.group,first,'position')).not.toEqual(before);actual.layer.clearChopRecoil();expect(stream(actual.group,first,'position')).toEqual(before);
   expect(JSON.stringify(input)).toBe(originalInput);
  }finally{actual.dispose();texture.dispose();context.dispose();}
 }}finally{wearFactory.mockRestore();}
});
