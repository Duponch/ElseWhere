/** Actual Resource canonical clones + generic Owner/planner. No GPU device,
 * Source raster or model factory is substituted. Preparation must not start. */
import{expect,test,vi}from'vitest';
import*as THREE from'three/webgpu';
import{attribute,vec3}from'three/tsl';
import{GraphicsStyleContext}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{compileNaturalSurfaceModels}from'../src/render/surfaces/NaturalSurfaceModels';
import{ResourcePreparedAtlas}from'../src/render/surfaces/ResourcePreparedAtlas';
import{PreparedSurfaceOwner}from'../src/render/origami/baked/surfaces/PreparedSurfaceOwner';
import{planPreparedSurfaces}from'../src/render/origami/baked/surfaces/PreparedSurfacePlan';
import type{PreparedSurfaceVariant}from'../src/render/origami/baked/surfaces/PreparedSurfaceTypes';
import type{SharedSurfacePreparationSnapshot}from'../src/render/surfaces/SharedSurfacePreparation';
const MiB=1024*1024;
function fixture(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),box=new THREE.BoxGeometry(),natural=compileNaturalSurfaceModels([box]),source=new THREE.MeshLambertNodeMaterial(),pastel=new THREE.DataTexture(new Uint8Array(64*64*4),64,64);pastel.flipY=false;pastel.minFilter=THREE.LinearMipmapLinearFilter;pastel.magFilter=THREE.LinearFilter;pastel.generateMipmaps=true;
 const atlas=new ResourcePreparedAtlas({key:'TEST-real-canonical-clones',context,sourceMaterial:source,pastel,stroke:natural.stroke,bodyOptions:()=>({context,base:vec3(1),pastel:vec3(1),faceUv:attribute('surfaceUv','vec4').xy,includeGeneric:true}),catalog:()=>undefined,hasNamedTrees:()=>false,hasAnonymousTrees:()=>false,changed:()=>{}}),id=atlas.capture(natural.geometries[0]!,{x:0,y:0,z:0,sx:.8,sy:.5,sz:.3,profile:0,color:0x886644},1),owner=atlas.owner;
 atlas.setContribution('TEST-existing-writer',[id]);const variant=(Reflect.get(owner,'byId')as Map<number,PreparedSurfaceVariant>).get(id)!;
 context.update({...context.preferences,style:'origami'});
 const snapshot:SharedSurfacePreparationSnapshot={preferences:{...context.preferences},world:{}as NonNullable<SharedSurfacePreparationSnapshot['world']>,reset:false,reason:'settings',epoch:1,renderer:{}as THREE.WebGPURenderer,paintRevision:context.preparedPaintRevision,paintSource:{assertCurrent(){}}as NonNullable<SharedSurfacePreparationSnapshot['paintSource']>,density:{mode:'orthographic',physicalCellPixels:40}};
 return{context,atlas,owner,variant,snapshot,close(){context.surfacePreparation.dispose();atlas.dispose();source.dispose();pastel.dispose();natural.dispose();box.dispose();context.dispose();}};
}
function retainedPlanBytes(owner:PreparedSurfaceOwner,variant:PreparedSurfaceVariant){return planPreparedSurfaces(owner.options.source(),[variant],{maxCpuBytes:1024*MiB,maxRetainedGpuBytes:512*MiB,maxPeakGpuBytes:1024*MiB,oldLiveGpuBytes:0,otherLiveGpuBytes:0,oldLiveCpuBytes:0,maxPages:256,maxFaces:65536},{maxPhysicalCellPixels:64,oversampling:4,paintKey:'TEST-budget-boundary',minPageSize:2048}).retainedCpuBytes;}

test('Resource declares its actual two retained canonical geometries before any atlas preparation',()=>{
 const f=fixture();try{const actual=f.atlas.models.stats().cpuBytes;expect(actual).toBeGreaterThan(0);expect(f.owner.options.externalCpuBytes?.()).toBe(actual);}finally{f.close();}
});

test('actual Resource clone bytes refuse admission before the GPU callback and preserve the Source material',async()=>{
 const f=fixture(),gpu=vi.spyOn(f.owner.options,'prepareGpu').mockImplementation(async()=>{throw Error('Resource GPU callback must not be taken');});
 try{const source=f.owner.materials[0],clones=f.atlas.models.stats().cpuBytes,limit=f.owner.status().cpuBytes+clones+retainedPlanBytes(f.owner,f.variant)-1;Reflect.set(f.owner.options,'maxCpuBytes',limit);const stage=await f.owner.stage(f.snapshot,()=>{});try{expect(stage.stats).toMatchObject({prepared:false,reason:'Actual canonical family retained budget exceeded'});stage.publish();stage.commit();expect(f.owner.status().representation).toBe('source');expect(f.owner.materials[0]).toBe(source);expect(gpu).not.toHaveBeenCalled();}finally{stage.dispose();}}finally{gpu.mockRestore();f.close();}
});

test('another family includes the same context Resource clones exactly once before its own GPU preparation',async()=>{
 const f=fixture(),gpu=vi.fn(async()=>{throw Error('Other family GPU callback must not be taken');}),other=new PreparedSurfaceOwner({key:'TEST-other-family',context:f.context,source:()=>f.owner.options.source(),changed:()=>{},maxCellPixels:64,returnCellPixels:56,minPageSize:2048,prepareGpu:gpu});
 try{const id=other.registerVariant(f.variant);other.setDemand([id]);const limit=f.owner.status().cpuBytes+other.status().cpuBytes+f.atlas.models.stats().cpuBytes+retainedPlanBytes(other,f.variant)-1;Reflect.set(other.options,'maxCpuBytes',limit);const stage=await other.stage(f.snapshot,()=>{});try{expect(stage.stats).toMatchObject({prepared:false,reason:'Actual canonical family retained budget exceeded'});stage.publish();stage.commit();expect(gpu).not.toHaveBeenCalled();}finally{stage.dispose();}}finally{other.dispose();f.close();}
});
