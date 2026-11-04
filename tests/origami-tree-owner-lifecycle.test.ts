/** Real shared models + real Gouache recipe views + real array admission/copy.
 * Page raster/ink compiler and renderer ports are explicit TEST metadata only.
 * No Canvas, World, device, pixels or performance proof. */
import {afterEach,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {TreeModels,type TreeModel} from '../src/render/models/TreeModels';
import {TreeBakeOwner,type TreeBakeDemand} from '../src/render/origami/TreeBakeOwner';
import type {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import type {TreeRecipe,TreeRecipePreparation,TreeSpecies,TreePaintLease} from '../src/render/origami/baked/trees';
const MiB=1024*1024,PAGE=2048*2048*4*(1+1/4+1/16+1/64);
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
type State={recipes:TreeRecipe[];borrowed:TreeModel[];preparations:TreeRecipePreparation[];recipeDisposed:(TreeSpecies|undefined)[];prepDisposed:(TreeSpecies|undefined)[];bakes:(TreeSpecies|undefined)[];sourceTargets:THREE.RenderTarget[];arrayTargets:THREE.RenderTarget[];disposedTargets:Set<THREE.RenderTarget>;deferBake:number;entered:ReturnType<typeof deferred>;gate:ReturnType<typeof deferred>;failPrep?:TreeSpecies;readyCalled:number};
const seam=vi.hoisted(()=>({state:undefined as State|undefined}));
vi.mock('../src/render/origami/baked/trees',async original=>{
 const actual=await original<typeof import('../src/render/origami/baked/trees')>();const state=()=>{if(!seam.state)throw Error('Missing explicit TEST boundary');return seam.state;};
 return{...actual,
  compileLegacyTreeRecipe:(...args:Parameters<typeof actual.compileLegacyTreeRecipe>)=>{const s=state();if(!args[2])throw Error('Texture owner reconstructed a model instead of borrowing');const r=actual.compileLegacyTreeRecipe(...args),dispose=r.dispose.bind(r);s.borrowed.push(args[2]);s.recipes.push(r);r.dispose=()=>{s.recipeDisposed.push(r.species);dispose();};return r;},
  createReadyTreeRecipe:()=>{state().readyCalled++;throw Error('Texture-only owner must never manufacture ready/render geometry');},
  planTreeRecipeAtlas:(recipe:TreeRecipe):TreeRecipePreparation=>{const s=state();let closed=false;
   const preparation:TreeRecipePreparation={key:recipe.key,width:2048,height:2048,levels:4,get cpuBytes(){return closed?0:32768;},preparationCpuBytes:3*MiB,preparationPeakGpuBytes:240*MiB,
    async bake(_renderer,assert){assert();s.bakes.push(recipe.species);const target=new THREE.RenderTarget(2048,2048,{depthBuffer:false,stencilBuffer:false,colorSpace:THREE.SRGBColorSpace,generateMipmaps:false,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter});target.texture.flipY=false;target.texture.mipmaps=Array.from({length:4},(_,l)=>({data:new Uint8Array(0),width:2048/2**l,height:2048/2**l}));s.sourceTargets.push(target);target.addEventListener('dispose',()=>s.disposedTargets.add(target));let delivered=false,retired=false;
     try{if(s.bakes.length===s.deferBake){s.entered.resolve();await s.gate.promise;}assert();delivered=true;return{texture:target.texture,cpuBytes:256,gpuBytes:PAGE,stats:{TEST:'metadata page, not raster'},dispose(){if(retired)return;retired=true;target.dispose();}};}finally{if(!delivered)target.dispose();}
    },dispose(){if(closed)return;closed=true;s.prepDisposed.push(recipe.species);if(s.failPrep!==undefined&&s.failPrep===recipe.species)throw Error('TEST preparation cleanup '+recipe.species);}};s.preparations.push(preparation);return preparation;
  },
 };
});
afterEach(()=>{seam.state=undefined;vi.restoreAllMocks();});
function fixture(gpuBytes=512*MiB){
 const state:State={recipes:[],borrowed:[],preparations:[],recipeDisposed:[],prepDisposed:[],bakes:[],sourceTargets:[],arrayTargets:[],disposedTargets:new Set(),deferBake:0,entered:deferred(),gate:deferred(),readyCalled:0};seam.state=state;
 const library=new TreeModels(),owner=new TreeBakeOwner({cpuBytes:128*MiB,gpuBytes}),flags={paused:true,paint:true,cohort:true},graphics={preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0}} as GraphicsStyleContext;
 const paint:TreePaintLease={fingerprint:'TEST-existing-paint-epoch',isCurrent:()=>flags.paint,assertCurrent(){if(!flags.paint)throw Error('TEST independent paint epoch changed');},paint:{} as TreePaintLease['paint']};
 const renderer={initRenderTarget:vi.fn((target:THREE.RenderTarget)=>{state.arrayTargets.push(target);target.addEventListener('dispose',()=>state.disposedTargets.add(target));}),copyTextureToTexture:vi.fn()} as unknown as THREE.WebGPURenderer;
 const demand=(models:readonly TreeModel[],suffix=''):TreeBakeDemand=>({key:JSON.stringify(models.map(m=>m.key))+suffix,species:[],models,isCurrent:()=>flags.cohort});
 const current=()=>{if(!flags.paused)throw Error('TEST actual pause resumed');},prepare=(d:TreeBakeDemand)=>owner.prepare(renderer,graphics,d,paint,current);
 return{state,library,owner,flags,renderer,paint,demand,prepare,dispose(){try{owner.dispose();}catch{/* injected failures asserted above */}for(const p of state.preparations)try{p.dispose();}catch{}for(const r of state.recipes)try{r.dispose();}catch{}for(const t of[...state.sourceTargets,...state.arrayTargets])if(!state.disposedTargets.has(t))try{t.dispose();}catch{}library.dispose();}};
}
function retiredViews(s:State){expect(s.readyCalled).toBe(0);expect(s.recipeDisposed).toHaveLength(s.recipes.length);expect(s.prepDisposed).toHaveLength(s.preparations.length);}

it('returns only complete textures and stable64slot rows, releases every recipe before return and never replaces or retires borrowed named/anonymous models',async()=>{
 const f=fixture(),models=[f.library.get('poplar','conical'),f.library.get(undefined,'conical')],d=f.demand(models),geometries=[...new Set(models.flatMap(m=>m.parts.map(p=>p.geometry)))];let modelDisposed=0;for(const g of geometries)g.addEventListener('dispose',()=>modelDisposed++);const refs=geometries.map(g=>({g,uv:g.getAttribute('bakedUv'),array:g.getAttribute('bakedUv').array,words:new Uint32Array(g.getAttribute('bakedUv').array.buffer.slice(0))}));
 try{const candidate=await f.prepare(d);expect(candidate).toBeDefined();expect(f.state.borrowed).toEqual(models);expect(f.state.recipes.map(r=>r.model)).toEqual(models);retiredViews(f.state);expect(f.library.snapshot().leases).toBe(0);expect(modelDisposed).toBe(0);expect(f.owner.snapshot().ready).toBe(0);
  expect(candidate!.pageCount).toBe(2);expect(candidate!.modelKeys).toEqual(models.map(m=>m.key));expect(candidate!.slots).toHaveLength(64);for(let layer=0;layer<models.length;layer++)expect(candidate!.slots[models[layer]!.surfaceSlot]).toEqual({layer,paletteBaked:true});expect(Reflect.has(candidate!,'readReady')).toBe(false);expect(Reflect.has(candidate!,'parts')).toBe(false);expect(Reflect.has(candidate!,'models')).toBe(false);expect(candidate!.cpuBytes).toBeLessThan(64*1024);
  f.owner.adopt(candidate!);f.flags.paint=false;expect(()=>candidate!.assertCurrent()).not.toThrow();expect(f.owner.needsPreparation(f.demand(models,'-same-models-new-header'))).toBe(false);expect(f.owner.needsPreparation(f.demand([models[0]!],'-shrink'))).toBe(false);
  for(const p of refs){expect(p.g.getAttribute('bakedUv')).toBe(p.uv);expect(p.uv.array).toBe(p.array);expect(new Uint32Array(p.array.buffer)).toEqual(p.words);}f.owner.invalidate();expect(modelDisposed).toBe(0);for(const m of models)expect(()=>m.assertCurrent()).not.toThrow();expect(f.state.arrayTargets.every(t=>f.state.disposedTargets.has(t))).toBe(true);
 }finally{f.dispose();}
});

it('pause/paint cancellation and preparation-cleanup failure retire all unpublished texture/view owners while preserving the Layer model catalogue',async()=>{
 for(const cause of['resume','paint-epoch','cleanup'] as const){const f=fixture(),models=[f.library.get('poplar'),f.library.get('pine')],d=f.demand(models);let modelDisposed=0;for(const m of models)for(const p of m.parts)p.geometry.addEventListener('dispose',()=>modelDisposed++);
  try{if(cause==='cleanup'){f.state.failPrep='poplar';await expect(f.prepare(d)).rejects.toThrow(AggregateError);}else{f.state.deferBake=2;const pending=f.prepare(d);await Promise.race([f.state.entered.promise,pending.then(()=>{throw Error('Expected second page await');})]);expect(f.state.sourceTargets).toHaveLength(2);expect(f.state.arrayTargets).toHaveLength(1);if(cause==='resume')f.flags.paused=false;else f.flags.paint=false;f.state.gate.resolve();await expect(pending).rejects.toThrow(cause==='resume'?'pause resumed':'paint epoch changed');expect(f.owner.snapshot().demand).toBeNull();expect(f.owner.needsPreparation(d)).toBe(true);}
   retiredViews(f.state);expect(f.library.snapshot().leases).toBe(0);expect(modelDisposed).toBe(0);expect(f.owner.snapshot().ready).toBe(0);for(const t of[...f.state.sourceTargets,...f.state.arrayTargets])expect(f.state.disposedTargets.has(t)).toBe(true);for(const m of models)expect(()=>m.assertCurrent()).not.toThrow();
  }finally{f.dispose();}
 }
});

it('counts actual duplicated single-model array and old-live/new/builder peak before baking, preserves old texture and settles only the refused model set',async()=>{
 const f=fixture(300*MiB),poplar=f.library.get('poplar'),pine=f.library.get('pine'),first=f.demand([poplar]),expanded=f.demand([poplar,pine]);
 try{const old=await f.prepare(first);expect(old).toBeDefined();expect(old!.pageCount).toBe(2);expect(old!.gpuBytes).toBe(2*PAGE);f.owner.adopt(old!);expect(f.owner.snapshot()).toMatchObject({ready:2,models:1});const target=f.state.arrayTargets[0]!,before=f.state.bakes.length;
  // New2page42.5+builder240 fits300; adding LIVE42.5 reaches325 and must refuse.
  await expect(f.prepare(expanded)).rejects.toThrow('old-live/new/preparation peak');expect(f.state.bakes).toHaveLength(before);expect(f.state.arrayTargets).toHaveLength(1);expect(f.state.disposedTargets.has(target)).toBe(false);expect(()=>old!.assertCurrent()).not.toThrow();expect(old!.modelKeys).toEqual([poplar.key]);expect(f.owner.snapshot().refusal).toContain('old-live/new/preparation peak');for(let i=0;i<5;i++)expect(f.owner.needsPreparation(expanded)).toBe(false);expect(f.owner.needsPreparation(f.demand([poplar],'-header-only'))).toBe(false);expect(f.owner.needsPreparation(f.demand([pine]))).toBe(true);retiredViews(f.state);expect(f.library.snapshot().leases).toBe(0);
  f.owner.invalidate();expect(f.state.disposedTargets.has(target)).toBe(true);expect(f.owner.needsPreparation(expanded)).toBe(true);expect(()=>poplar.assertCurrent()).not.toThrow();expect(()=>pine.assertCurrent()).not.toThrow();
 }finally{f.dispose();}
});
