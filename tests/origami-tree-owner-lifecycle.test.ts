/** Real TreeBakeOwner, real Legacy recipes/ready UVs and real array admission/
 * assembly. ONLY each page bake/ink-preparation boundary and renderer copy ports
 * are TEST metadata. No Canvas, World, device, GPU pixels or timing proof. */
import {afterEach,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {TreeBakeOwner,type TreeBakeDemand} from '../src/render/origami/TreeBakeOwner';
import type {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import type {TreeRecipe,ReadyTreeRecipe,TreeRecipePreparation,TreeSpecies,TreePaintLease} from '../src/render/origami/baked/trees';
const MiB=1024*1024,PAGE=2048*2048*4*(1+1/4+1/16+1/64);
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
type State={recipes:TreeRecipe[];ready:ReadyTreeRecipe[];preparations:TreeRecipePreparation[];recipeDisposed:TreeSpecies[];readyDisposed:TreeSpecies[];prepDisposed:TreeSpecies[];bakes:TreeSpecies[];sourceTargets:THREE.RenderTarget[];arrayTargets:THREE.RenderTarget[];disposedTargets:Set<THREE.RenderTarget>;deferBake:number;entered:ReturnType<typeof deferred>;gate:ReturnType<typeof deferred>;failPrep?:TreeSpecies;failReady?:TreeSpecies};
const seam=vi.hoisted(()=>({state:undefined as State|undefined}));
vi.mock('../src/render/origami/baked/trees',async original=>{
 const actual=await original<typeof import('../src/render/origami/baked/trees')>();
 const state=()=>{if(!seam.state)throw Error('No explicit TEST page boundary');return seam.state;};
 return{...actual,
  compileLegacyTreeRecipe:(...args:Parameters<typeof actual.compileLegacyTreeRecipe>)=>{const s=state(),r=actual.compileLegacyTreeRecipe(...args),dispose=r.dispose.bind(r);s.recipes.push(r);r.dispose=()=>{s.recipeDisposed.push(r.species);dispose();};return r;},
  createReadyTreeRecipe:(...args:Parameters<typeof actual.createReadyTreeRecipe>)=>{const s=state(),r=actual.createReadyTreeRecipe(...args),dispose=r.dispose.bind(r);s.ready.push(r);r.dispose=()=>{s.readyDisposed.push(r.species);dispose();if(s.failReady===r.species)throw Error('TEST ready cleanup '+r.species);};return r;},
  planTreeRecipeAtlas:(recipe:TreeRecipe):TreeRecipePreparation=>{
   const s=state();let closed=false;const p:TreeRecipePreparation={key:recipe.key,width:2048,height:2048,levels:4,get cpuBytes(){return closed?0:32*1024;},preparationCpuBytes:3*MiB,preparationPeakGpuBytes:240*MiB,
    async bake(_renderer,assert){assert();s.bakes.push(recipe.species);const target=new THREE.RenderTarget(2048,2048,{depthBuffer:false,stencilBuffer:false,colorSpace:THREE.SRGBColorSpace,generateMipmaps:false,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter});target.texture.flipY=false;target.texture.mipmaps=Array.from({length:4},(_,l)=>({data:new Uint8Array(0),width:2048/2**l,height:2048/2**l}));s.sourceTargets.push(target);target.addEventListener('dispose',()=>s.disposedTargets.add(target));let delivered=false,retired=false;
     try{if(s.bakes.length===s.deferBake){s.entered.resolve();await s.gate.promise;}assert();delivered=true;return{texture:target.texture,cpuBytes:256,gpuBytes:PAGE,stats:{scope:'TEST metadata page, no raster or pixels'},dispose(){if(retired)return;retired=true;target.dispose();}};}finally{if(!delivered)target.dispose();}
    },dispose(){if(closed)return;closed=true;s.prepDisposed.push(recipe.species);if(s.failPrep===recipe.species)throw Error('TEST preparation cleanup '+recipe.species);}};s.preparations.push(p);return p;
  },
 };
});
afterEach(()=>{seam.state=undefined;vi.restoreAllMocks();});
function fixture(gpuBytes=512*MiB){
 const state:State={recipes:[],ready:[],preparations:[],recipeDisposed:[],readyDisposed:[],prepDisposed:[],bakes:[],sourceTargets:[],arrayTargets:[],disposedTargets:new Set(),deferBake:0,entered:deferred(),gate:deferred()};seam.state=state;
 const owner=new TreeBakeOwner({cpuBytes:128*MiB,gpuBytes}),flags={paused:true,paint:true,cohort:true},graphics={preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0}} as GraphicsStyleContext;
 const paint:TreePaintLease={fingerprint:'TEST-existing-paint-epoch',isCurrent:()=>flags.paint,assertCurrent(){if(!flags.paint)throw Error('TEST independent paint epoch changed');},paint:{} as TreePaintLease['paint']};
 const renderer={initRenderTarget:vi.fn((target:THREE.RenderTarget)=>{state.arrayTargets.push(target);target.addEventListener('dispose',()=>state.disposedTargets.add(target));}),copyTextureToTexture:vi.fn()} as unknown as THREE.WebGPURenderer;
 const demand=(species:readonly TreeSpecies[],suffix=''):TreeBakeDemand=>({key:'TEST-cohort:'+species.join(',')+suffix,species,isCurrent:()=>flags.cohort});
 const current=()=>{if(!flags.paused)throw Error('TEST actual pause resumed');},prepare=(d:TreeBakeDemand)=>owner.prepare(renderer,graphics,d,paint,current);
 return{state,owner,flags,renderer,paint,demand,prepare,dispose(){try{owner.dispose();}catch{/* injected disposal errors are asserted before this terminal cleanup */}for(const p of state.preparations)try{p.dispose();}catch{}for(const r of state.ready)try{r.dispose();}catch{}for(const r of state.recipes)try{r.dispose();}catch{}for(const t of [...state.sourceTargets,...state.arrayTargets])if(!state.disposedTargets.has(t))t.dispose();}};
}
function allRetired(s:State){expect(s.readyDisposed.sort()).toEqual(s.ready.map(r=>r.species).sort());expect(s.recipeDisposed.sort()).toEqual(s.recipes.map(r=>r.species).sort());expect(s.prepDisposed.sort()).toEqual(s.preparations.map((_,i)=>s.recipes[i]!.species).sort());for(const t of [...s.sourceTargets,...s.arrayTargets])expect(s.disposedTargets.has(t)).toBe(true);}

it('resumed speed OR independent paint epoch during second page await rejects unpublished array and retires all real recipe/ready owners without settling the demand',async()=>{
 for(const cause of ['resume','paint-epoch'] as const){const f=fixture(),d=f.demand(['poplar','pine']);f.state.deferBake=2;
  try{const pending=f.prepare(d);await Promise.race([f.state.entered.promise,pending.then(()=>{throw Error('Expected second-page await');})]);expect(f.state.arrayTargets).toHaveLength(1);expect(f.state.sourceTargets).toHaveLength(2);expect(f.owner.snapshot().ready).toBe(0);
   if(cause==='resume')f.flags.paused=false;else f.flags.paint=false;f.state.gate.resolve();await expect(pending).rejects.toThrow(cause==='resume'?'pause resumed':'paint epoch changed');
   allRetired(f.state);expect(f.owner.snapshot().ready).toBe(0);expect(f.owner.snapshot().demand).toBeNull();expect(f.owner.needsPreparation(d)).toBe(true);expect(f.owner.snapshot().refusal).toBeNull();
  }finally{f.dispose();}
 }
});

it('cleanup failure before transfer OR on live retirement still attempts every other owner and texture, and never leaves a returned/active partial catalog',async()=>{
 for(const phase of ['transfer','catalog'] as const){const f=fixture(),d=f.demand(['poplar','pine']);
  try{if(phase==='transfer'){f.state.failPrep='poplar';f.state.failReady='poplar';await expect(f.prepare(d)).rejects.toThrow(AggregateError);expect(f.owner.snapshot().ready).toBe(0);}else{const catalog=await f.prepare(d);expect(catalog).toBeDefined();f.owner.adopt(catalog!);expect(f.owner.snapshot().ready).toBe(2);f.state.failReady='poplar';expect(()=>f.owner.invalidate()).toThrow(AggregateError);expect(f.owner.snapshot().ready).toBe(0);expect(()=>catalog!.assertCurrent()).toThrow('retired');}
   allRetired(f.state);expect(f.state.arrayTargets).toHaveLength(1);expect(f.state.sourceTargets).toHaveLength(2);
  }finally{f.dispose();}
 }
});

it('actual old-live plus new-array plus max-builder admission refuses before another bake, preserves the old catalog and settles only that exact demand',async()=>{
 const f=fixture(290*MiB),first=f.demand(['poplar']),expanded=f.demand(['poplar','pine']);
 try{const old=await f.prepare(first);expect(old).toBeDefined();f.owner.adopt(old!);expect(old!.gpuBytes).toBe(PAGE);expect(f.owner.snapshot().ready).toBe(1);const firstTarget=f.state.sourceTargets[0]!;
  expect(f.owner.needsPreparation(f.demand(['poplar'],'-removal-only-key-change'))).toBe(false);const before=f.state.bakes.length;
  // New2-page + maxbuilder alone is282.5MiB (<290); adding the live
  // first page21.25MiB reaches303.75MiB and MUST refuse before baking.
  await expect(f.prepare(expanded)).rejects.toThrow('old-live/new/preparation peak');expect(f.state.bakes).toHaveLength(before);expect(f.state.arrayTargets).toHaveLength(0);expect(f.state.disposedTargets.has(firstTarget)).toBe(false);expect(()=>old!.assertCurrent()).not.toThrow();expect(old!.readReady('poplar')).toBeDefined();expect(old!.readReady('pine')).toBeUndefined();
  expect(f.owner.snapshot().ready).toBe(1);expect(f.owner.snapshot().refusal).toContain('old-live/new/preparation peak');for(let i=0;i<5;i++)expect(f.owner.needsPreparation(expanded)).toBe(false);expect(f.state.bakes).toHaveLength(before);expect(f.owner.needsPreparation(f.demand(['birch']))).toBe(true);
  f.owner.invalidate();expect(f.state.disposedTargets.has(firstTarget)).toBe(true);expect(f.owner.needsPreparation(expanded)).toBe(true);expect(f.owner.snapshot().refusal).toBeNull();
 }finally{f.dispose();}
});
