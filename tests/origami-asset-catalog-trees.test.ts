/** Real gallery adapter, TreeBakeOwner, ResourceLayer, recipes and page
 * admission. Only Canvas pixels, GPU page raster/copy/compile are TEST metadata.
 * No DOM page, native device, World, visual quality or performance proof. */
import {afterEach,expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
import type {TreeRecipe} from '../src/render/origami/baked/trees/types';
import type {TreeRecipePreparation} from '../src/render/origami/baked/trees/preparation';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
const seam=vi.hoisted(()=>({bakes:0,fail:false,targets:[] as THREE.RenderTarget[],retired:new Set<THREE.RenderTarget>()}));
vi.mock('../src/render/origami/baked/trees',async original=>{
 const actual=await original<typeof import('../src/render/origami/baked/trees')>();
 return{...actual,planTreeRecipeAtlas:(recipe:TreeRecipe):TreeRecipePreparation=>({key:recipe.key,width:2048,height:2048,levels:4,cpuBytes:1024,preparationCpuBytes:1024,preparationPeakGpuBytes:220*1024*1024,
  async bake(_renderer,assert){assert();seam.bakes++;if(seam.fail)throw Error('TEST page refusal');const target=new THREE.RenderTarget(2048,2048,{depthBuffer:false,colorSpace:THREE.SRGBColorSpace,generateMipmaps:false,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter});target.texture.flipY=false;target.texture.mipmaps=Array.from({length:4},(_,level)=>({data:new Uint8Array(0),width:2048/2**level,height:2048/2**level}));target.addEventListener('dispose',()=>seam.retired.add(target));seam.targets.push(target);let closed=false;return{texture:target.texture,gpuBytes:2048**2*4*1.328125,cpuBytes:0,stats:{scope:'TEST metadata, no raster'},dispose(){if(closed)return;closed=true;target.dispose();}};},dispose(){},
 })};
});
import {createCatalogTreePreparation} from '../src/dev/asset-catalog-environment';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import type {Resource} from '../src/sim/types';

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
afterEach(()=>{vi.restoreAllMocks();for(const t of seam.targets)if(!seam.retired.has(t))t.dispose();seam.targets=[];seam.retired.clear();seam.bakes=0;seam.fail=false;});
test('gallery tree preparation waits before publication/destruction, cancels safely, refreshes metadata, and reuses/refuses the real owner without retries',async()=>{
 expect(DEFAULT_GRAPHICS_STYLE_PREFERENCES).toMatchObject({impasto:1,wear:.75});
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0}),group=new THREE.Group(),plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshStandardNodeMaterial();plain.userData.rendererOwned=paint.userData.rendererOwned=true;
 const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint)),input={width:32,height:32,tick:0,seed:123,resources:[{id:1001,kind:'tree',species:'poplar',x:8,z:8,amount:1,growth:1},{id:1002,kind:'tree',species:'birch',x:9,z:8,amount:1,growth:1}] as Resource[],structures:[],site:{biome:'temperate-forest'}};
 Reflect.apply(layer.update,layer,[input,true,undefined,undefined,{read:()=>({size:1,ripe:true,leafless:false}),harvestable:()=>false}]);context.flushPaint();
 const refresh=vi.fn(()=>layer.bakedTreeStatus().ready),adapter=createCatalogTreePreparation(context,layer,refresh),renderer=new THREE.WebGPURenderer({canvas:{width:32,height:32,style:{}} as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No device in this contract');});
 vi.spyOn(renderer,'initRenderTarget').mockImplementation(target=>{seam.targets.push(target);target.addEventListener('dispose',()=>seam.retired.add(target));});vi.spyOn(renderer,'copyTextureToTexture').mockImplementation(()=>{});
 const gate=deferred(),entered=deferred();let valid=true,pauseCompile=true;const compile=vi.spyOn(renderer,'compileAsync').mockImplementation(async(warmup,_camera,scene)=>{expect(scene).toBe(lights);expect(warmup.children).toHaveLength(3);expect(layer.bakedTreeStatus().ready).toBe(0);if(pauseCompile){entered.resolve();await gate.promise;}}),camera=new THREE.PerspectiveCamera(),lights=new THREE.Scene();lights.add(new THREE.HemisphereLight(),new THREE.DirectionalLight());const assertCurrent=()=>{if(!valid)throw Error('TEST gallery closed');};
 try{
  const pending=adapter.prepareTrees(renderer,camera,lights,assertCurrent);await entered.promise;expect(adapter.preparing).toBe(true);expect(()=>adapter.invalidatePreparedTrees()).toThrow('still preparing');expect(()=>adapter.dispose()).toThrow('Wait');expect(layer.bakedTreeStatus().ready).toBe(0);
  valid=false;gate.resolve();await expect(pending).rejects.toThrow('TEST gallery closed');expect(adapter.preparing).toBe(false);expect(layer.bakedTreeStatus().ready).toBe(0);expect(refresh).not.toHaveBeenCalled();for(const t of seam.targets)expect(seam.retired.has(t)).toBe(true);
  valid=true;pauseCompile=false;adapter.invalidatePreparedTrees();context.update({...context.preferences,edgeWidth:2.1});await adapter.prepareTrees(renderer,camera,lights,assertCurrent);expect(layer.bakedTreeStatus()).toMatchObject({ready:2,texturePages:2});expect(refresh.mock.results.at(-1)?.value).toBe(2);expect(adapter.treeStatus().cache).toMatchObject({ready:2,refusal:null});
  const preparedBakes=seam.bakes,compiled=compile.mock.calls.length;await adapter.prepareTrees(renderer,camera,lights,assertCurrent);expect(seam.bakes).toBe(preparedBakes);expect(compile).toHaveBeenCalledTimes(compiled);
  adapter.invalidatePreparedTrees();expect(layer.bakedTreeStatus().ready).toBe(0);expect(refresh.mock.results.at(-1)?.value).toBe(0);for(const t of seam.targets)expect(seam.retired.has(t)).toBe(true);
  seam.fail=true;await adapter.prepareTrees(renderer,camera,lights,assertCurrent);expect(adapter.treeStatus().reason).toBe('TEST page refusal');expect(layer.bakedTreeStatus().ready).toBe(0);const refusedBakes=seam.bakes;await adapter.prepareTrees(renderer,camera,lights,assertCurrent);expect(seam.bakes).toBe(refusedBakes);
  seam.fail=false;adapter.invalidatePreparedTrees();await adapter.prepareTrees(renderer,camera,lights,assertCurrent);expect(layer.bakedTreeStatus().ready).toBe(2);const order:string[]=[];for(const material of layer.compiledMaterials435())if(material.userData.origamiBakedTree)material.addEventListener('dispose',()=>order.push('material'));for(const target of seam.targets)if(!seam.retired.has(target))target.addEventListener('dispose',()=>order.push('page'));
  layer.dispose();adapter.dispose();expect(order.slice(0,3)).toEqual(['material','material','material']);expect(order.at(-1)).toBe('page');for(const t of seam.targets)expect(seam.retired.has(t)).toBe(true);expect(init).not.toHaveBeenCalled();
 }finally{gate.resolve();layer.dispose();adapter.dispose();context.dispose();plain.dispose();paint.dispose();}
});
