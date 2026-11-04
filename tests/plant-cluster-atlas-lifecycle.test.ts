/** Actual PlantAtlasSurface + actual Source tuft/planner/face table. GPU callee
 * alone is mocked; TEST lease/context carry no paint/Native/performance proof. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {uniform,positionLocal} from 'three/tsl';
const gpu=vi.hoisted(()=>({pending:[] as unknown[],calls:0}));
vi.mock('../src/render/origami/baked/plants/PlantAtlasGpu',()=>({preparePlantAtlasGpu:vi.fn(async()=>{gpu.calls++;if(!gpu.pending.length)throw Error('TEST GPU result was not queued');const next=gpu.pending.shift();if(next instanceof Error)throw next;return next;})}));
import {PlantAtlasSurface} from '../src/render/origami/baked/plants/PlantAtlasSurface';
import type {PlantAtlasGpuResult} from '../src/render/origami/baked/plants/PlantAtlasGpu';
import type {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {createOrigamiGroundTuftGeometry} from '../src/render/origami/flora';
import {compileNaturalSurfaceModels} from '../src/render/surfaces/NaturalSurfaceModels';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';

function image(name:string,failFirstDispose=false){
 const texture=new THREE.DataArrayTexture(new Uint8Array(8),1,1,2);texture.name='TEST lifecycle '+name;
 let attempts=0,closed=false;
 const value:PlantAtlasGpuResult={texture,gpuBytes:1024,cpuBytes:0,stats:{scope:'TEST GPU CALLEE result only; no rendering'},dispose(){attempts++;if(failFirstDispose&&attempts===1)throw Error('TEST candidate disposal failure');if(!closed){closed=true;texture.dispose();}}};
 return{value,attempts:()=>attempts,closed:()=>closed};
}
function fixture(){
 const source=createOrigamiGroundTuftGeometry(),models=compileNaturalSurfaceModels([source]),pastel=createStylizedSurfaceTexture('vegetation'),sourceMaterial=new THREE.MeshLambertNodeMaterial({flatShading:true});sourceMaterial.positionNode=positionLocal;
 const listeners=new Set<()=>void>(),context={preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami' as const,impasto:0,wear:0},genericPaintSemanticKey:()=> 'TEST-generic-p0-semantic',reliefEnabled:false,wearEnabled:false,surfaceEncoding:uniform(1),get origami(){return this.preferences.style==='origami';},trackSharedPaintSettingsRefresh(callback:()=>void){listeners.add(callback);return()=>{listeners.delete(callback);};}};
 let closing=false,changed=0;
 const owner=new PlantAtlasSurface(context as unknown as GraphicsStyleContext,models.geometries[0]!,models.stroke,sourceMaterial,pastel,()=>{changed++;});
 const lease={fingerprint:'TEST-only-immutable-lease',isCurrent:()=>true,assertCurrent(){},paint:{readProfile(){throw Error('TEST mocked GPU must not request paint');},edgeAlpha:{data:new Uint8Array(4),width:1,height:1},brushColorLinear:[0,0,0] as const,lineOpacity:.79,strokeImperfection:.15}} as ReturnType<GraphicsStyleContext['prepareAtlasPaint']>;
 const renderer={} as THREE.WebGPURenderer;
 const assertExclusive=()=>{if(closing)throw Error('TEST closing rejects new GPU work');};
 return{owner,context,lease,renderer,listeners,setClosing(){closing=true;},assertExclusive,changed:()=>changed,owned:()=>Reflect.get(owner,'owned') as Set<PlantAtlasGpuResult>,current:()=>(Reflect.get(owner,'current') as {key:string;value:PlantAtlasGpuResult}|undefined)?.value,closeBorrowed(){models.dispose();source.dispose();sourceMaterial.dispose();pastel.dispose();}};
}

test('published plant candidate abandoned by closing rolls back CPU ownership and disposes old and new targets exactly once',async()=>{
 const f=fixture(),old=image('old'),candidate=image('candidate');gpu.pending.push(old.value,candidate.value);const calls=gpu.calls;
 try{
  const first=await f.owner.stage(f.renderer,f.lease,f.assertExclusive);expect(first).toBeDefined();first!.commit();first!.dispose();expect(f.current()).toBe(old.value);expect(f.owned().has(old.value)).toBe(true);expect(old.attempts()).toBe(0);
  f.context.preferences.edgeWidth+=.1;const second=await f.owner.stage(f.renderer,f.lease,f.assertExclusive);expect(second).toBeDefined();expect(f.current()).toBe(candidate.value);expect(f.owned().has(old.value)).toBe(true);expect(f.owned().has(candidate.value)).toBe(true);
  // Core.close may cancel after publication but before the compile await ends.
  // Stage retirement must restore CPU bindings without requiring a live gate.
  f.setClosing();expect(()=>second!.dispose()).not.toThrow();expect(f.current()).toBe(old.value);expect(candidate.attempts()).toBe(1);expect(candidate.closed()).toBe(true);expect(old.attempts()).toBe(0);expect(f.owned().has(old.value)).toBe(true);expect(f.owned().has(candidate.value)).toBe(false);
  f.owner.dispose();expect(old.attempts()).toBe(1);expect(old.closed()).toBe(true);expect(candidate.attempts()).toBe(1);expect(f.owned().size).toBe(0);expect(f.listeners.size).toBe(0);expect(gpu.calls-calls).toBe(2);
 }finally{try{f.owner.dispose();}finally{f.closeBorrowed();gpu.pending.length=0;}}
});

test('failed plant rollback retirement retains the exact candidate owner for final cleanup retry',async()=>{
 const f=fixture(),old=image('old'),candidate=image('failed-retirement',true);gpu.pending.push(old.value,candidate.value);
 try{
  const first=await f.owner.stage(f.renderer,f.lease,f.assertExclusive);first!.commit();first!.dispose();
  f.context.preferences.edgeWidth+=.1;const second=await f.owner.stage(f.renderer,f.lease,f.assertExclusive);expect(second).toBeDefined();second!.rollback();expect(f.current()).toBe(old.value);
  expect(()=>second!.dispose()).toThrow();expect(candidate.attempts()).toBe(1);expect(candidate.closed()).toBe(false);expect(f.owned().has(candidate.value)).toBe(true);expect(f.owned().has(old.value)).toBe(true);expect(old.attempts()).toBe(0);
  f.owner.dispose();expect(candidate.attempts()).toBe(2);expect(candidate.closed()).toBe(true);expect(old.attempts()).toBe(1);expect(old.closed()).toBe(true);expect(f.owned().size).toBe(0);expect(f.listeners.size).toBe(0);
 }finally{try{f.owner.dispose();}finally{f.closeBorrowed();gpu.pending.length=0;}}
});

test('ordinary plant GPU preparation failure propagates and retains the prior published owner',async()=>{
 const f=fixture(),old=image('old'),failure=new Error('TEST actual GPU preparation failure');gpu.pending.push(old.value,failure);const calls=gpu.calls;
 try{
  const first=await f.owner.stage(f.renderer,f.lease,f.assertExclusive);expect(first).toBeDefined();first!.commit();first!.dispose();
  f.context.preferences.edgeWidth+=.1;
  await expect(f.owner.stage(f.renderer,f.lease,f.assertExclusive)).rejects.toBe(failure);
  expect(f.current()).toBe(old.value);expect(f.owned().size).toBe(1);expect(f.owned().has(old.value)).toBe(true);expect(old.attempts()).toBe(0);expect(gpu.calls-calls).toBe(2);
  f.owner.dispose();expect(old.attempts()).toBe(1);expect(old.closed()).toBe(true);expect(f.owned().size).toBe(0);expect(f.listeners.size).toBe(0);
 }finally{try{f.owner.dispose();}finally{f.closeBorrowed();gpu.pending.length=0;}}
});

test('compact plant resource metadata follows real image publication and rollback without including atlas layouts',async()=>{
 const f=fixture(),old=image('metadata-old'),candidate=image('metadata-new');gpu.pending.push(old.value,candidate.value);
 try{
  const before=f.owner.comparisonMetadata();expect(before.preparedTexture).toBeNull();expect(JSON.stringify(before).length).toBeLessThan(1024);
  const first=await f.owner.stage(f.renderer,f.lease,f.assertExclusive);expect(f.owner.comparisonMetadata()).toMatchObject({pending:true,preparedTexture:old.value.texture.uuid});first!.commit();first!.dispose();
  const stable=f.owner.comparisonMetadata();expect(stable).toMatchObject({ready:true,pending:false,preparedTexture:old.value.texture.uuid,boundTexture:old.value.texture.uuid});expect(f.owner.comparisonMetadata()).toEqual(stable);
  const width=f.context.preferences.edgeWidth;f.context.preferences.edgeWidth+=.1;const second=await f.owner.stage(f.renderer,f.lease,f.assertExclusive);
  expect(f.owner.comparisonMetadata()).toMatchObject({pending:true,preparedTexture:candidate.value.texture.uuid,boundTexture:candidate.value.texture.uuid});expect(f.owner.comparisonMetadata()).not.toEqual(stable);
  second!.rollback();second!.dispose();f.context.preferences.edgeWidth=width;f.owner.refresh();expect(f.owner.comparisonMetadata()).toEqual(stable);expect(JSON.stringify(f.owner.comparisonMetadata()).length).toBeLessThan(1024);
 }finally{try{f.owner.dispose();}finally{f.closeBorrowed();gpu.pending.length=0;}}
});
