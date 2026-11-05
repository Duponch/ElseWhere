/** Genuine Owner + producer/model/registry/surface transactions. Only the GPU
 * preparation callee is mocked. Its array advertises the true plan extent but
 * contains FOUR TEST bytes: never uploaded, sampled, or called pixel proof.
 * The paint input below is a checked TEST lease for that same GPU boundary;
 * reading its pixels is forbidden. No renderer/device initialization occurs. */
import{expect,test,vi}from'vitest';
import * as THREE from'three/webgpu';
const gpu=vi.hoisted(()=>({records:[]as{texture:import('three/webgpu').DataArrayTexture;attempts:number;failures:number;closed:boolean;faces:number;pages:number}[]}));
vi.mock('../src/render/origami/baked/actors/ActorAtlasGpu',async original=>{
 const actual=await original<typeof import('../src/render/origami/baked/actors/ActorAtlasGpu')>(),three=await import('three/webgpu');
 return{...actual,prepareActorAtlasGpu:vi.fn(async(...args:Parameters<typeof actual.prepareActorAtlasGpu>)=>{
  const[,plan,paint,,assertCurrent]=args;assertCurrent();paint.assertCurrent();const texture=new three.DataArrayTexture(new Uint8Array(4),plan.plan.size,plan.plan.size,plan.plan.pages);texture.type=three.UnsignedByteType;texture.format=three.RGBAFormat;texture.colorSpace=three.SRGBColorSpace;texture.flipY=false;texture.magFilter=three.LinearFilter;texture.minFilter=three.LinearMipmapLinearFilter;texture.wrapS=texture.wrapT=three.ClampToEdgeWrapping;texture.generateMipmaps=false;
  const record={texture,attempts:0,failures:0,closed:false,faces:plan.capture.source.faceCount,pages:plan.plan.pages};gpu.records.push(record);
  return{texture,gpuBytes:plan.plan.retainedGpuBytes,cpuBytes:0,stats:{scope:'TEST GPU boundary only; four bytes, no upload or pixel proof'},assertCurrent(){if(record.closed)throw Error('TEST atlas retired');},dispose(){record.attempts++;if(record.failures>0){record.failures--;throw Error('TEST atlas disposal failure');}if(record.closed)return;texture.dispose();record.closed=true;}};
 })};
});
import{GraphicsStyleContext,withGraphicsStyle}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{PawnLayer}from'../src/render/PawnLayer';
import{createWorld}from'../src/sim/engine';
import{ActorAtlasOwner,updateActorAtlasDensity,hasActorAtlasDensityGate}from'../src/render/origami/baked/actors/ActorAtlasOwner';
import type{ActorTextureAssets}from'../src/render/origami/baked/actors/ActorTextureSurface';
import type{SharedSurfacePreparationSnapshot,SharedSurfacePreparationBatch}from'../src/render/surfaces/SharedSurfacePreparation';
import{writeTestFileSync}from'./test-output';
type Surface={material:THREE.MeshStandardNodeMaterial;assets:ActorTextureAssets|undefined;snapshot():{representation:'pure'|'source';encoding:number;faceCount:number}};
const surfaces=(owner:ActorAtlasOwner)=>[...(Reflect.get(owner,'surfaces')as Map<THREE.MeshStandardNodeMaterial,Surface>).values()];
function fixture(){
 const first=gpu.records.length,context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),layer=withGraphicsStyle(context,()=>new PawnLayer()),world=createWorld(17,8,8);world.pawns=world.pawns.slice(0,1);world.piles=[];world.jobs=[];world.structures=[];world.resources=[];layer.update(world,0,true);
 const owner=Reflect.get(layer,'bodyAtlas')as ActorAtlasOwner;if(!(owner instanceof ActorAtlasOwner))throw Error('Actual wired ActorAtlasOwner required');const renderer=new THREE.WebGPURenderer({canvas:{width:64,height:64,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No GPU/device in owner transaction contract');});let epoch=0,closed=false;
 const lease=()=>{const preferences=JSON.stringify(context.preferences),isCurrent=()=>JSON.stringify(context.preferences)===preferences,assertCurrent=()=>{if(!isCurrent())throw Error('TEST GPU input lease superseded');};return{fingerprint:'TEST-unused-pixel-input:'+preferences,isCurrent,assertCurrent,paint:{readProfile:()=>{throw Error('TEST GPU mock must never read Source pixels');},edgeAlpha:{data:new Uint8Array(1),width:1,height:1},brushColorLinear:[1,1,1]as const,lineOpacity:context.lineOpacity.value,strokeImperfection:context.strokeImperfection.value}};};
 const snapshot=(style:'default'|'origami',pixels=40):SharedSurfacePreparationSnapshot&{density:{mode:'orthographic';physicalCellPixels:number}}=>{if(context.preferences.style!==style)context.update({...context.preferences,style});return{preferences:Object.freeze({...context.preferences}),world,reset:false,reason:'settings',epoch:++epoch,renderer,paintRevision:context.preparedPaintRevision,paintSource:style==='origami'?lease():undefined,density:{mode:'orthographic',physicalCellPixels:pixels}};};
 const stage=(style:'default'|'origami',pixels=40)=>context.surfacePreparation.stage(snapshot(style,pixels),()=>{});
 const run=async(style:'default'|'origami',pixels=40)=>{const batch=await stage(style,pixels);try{batch.publish();batch.commit();}finally{batch.dispose();}context.surfacePreparation.assertReadyForDraw();};
 const close=()=>{if(closed)return;context.surfacePreparation.dispose();layer.dispose();context.dispose();expect(init).not.toHaveBeenCalled();init.mockRestore();closed=true;};
 return{first,context,layer,owner,world,renderer,stage,run,close};
}

test('actual Owner routes P/G/P on one material, restores original64 encoding and reuses its cached atlas on G return',async()=>{
 const f=fixture();try{
  await f.run('default');const port=f.layer.bodySurfaceBakeSource()!,material=f.owner.selectedMaterial(port.sourceMaterial),pure=material.colorNode;expect(surfaces(f.owner)).toHaveLength(2);expect(surfaces(f.owner).every(surface=>surface.snapshot().encoding===0&&surface.snapshot().representation==='pure'&&!surface.assets)).toBe(true);
  await f.run('origami');writeTestFileSync('artifacts/owner-pgp-first-g.json',JSON.stringify({scope:'Actual CPU Owner/Surface only; fake never-uploaded GPU texture',status:f.owner.status()},null,2)+'\n');expect(f.owner.status().ready,f.owner.status().fallback??'').toBe(true);expect(gpu.records.length-f.first).toBe(1);const atlas=gpu.records.at(-1)!;expect(surfaces(f.owner).every(surface=>surface.snapshot().encoding===1&&surface.assets?.texture===atlas.texture)).toBe(true);expect(f.owner.selectedMaterial(port.sourceMaterial)).toBe(material);expect(material.colorNode).toBe(pure);
  await f.run('default');expect(f.owner.selectedMaterial(port.sourceMaterial)).toBe(material);expect(material.colorNode).toBe(pure);expect(surfaces(f.owner).every(surface=>surface.snapshot().encoding===0&&!surface.assets)).toBe(true);expect(atlas.closed).toBe(false);
  await f.run('origami');expect(f.owner.status().ready).toBe(true);expect(gpu.records.length-f.first).toBe(1);expect(f.owner.selectedMaterial(port.sourceMaterial)).toBe(material);expect(surfaces(f.owner).every(surface=>surface.assets?.texture===atlas.texture)).toBe(true);
 }finally{f.close();}
},60000);

test('actual density transition holds registry drawing until Source publication and returns to the same cached pure graph',async()=>{
 const f=fixture();try{
  await f.run('origami');expect(f.owner.status().ready,f.owner.status().fallback??'').toBe(true);const port=f.layer.bodySurfaceBakeSource()!,material=f.owner.selectedMaterial(port.sourceMaterial),pure=material.colorNode,count=gpu.records.length;expect(hasActorAtlasDensityGate(f.context)).toBe(true);
  expect(updateActorAtlasDensity(f.context,'orthographic',400)).toBe(true);expect(()=>f.context.surfacePreparation.assertReadyForDraw()).toThrow(/settle|preparation|drawing/i);const near=await f.stage('origami',400);try{expect(material.colorNode).toBe(pure);near.publish();expect(f.owner.status().representation).toBe('source');expect(material.colorNode).toBe(port.sourceMaterial.colorNode);expect(f.owner.selectedMaterial(port.sourceMaterial)).toBe(material);near.commit();}finally{near.dispose();}f.context.surfacePreparation.assertReadyForDraw();
  expect(updateActorAtlasDensity(f.context,'orthographic',40)).toBe(true);expect(()=>f.context.surfacePreparation.assertReadyForDraw()).toThrow();await f.run('origami',40);expect(f.owner.status().ready).toBe(true);expect(material.colorNode).toBe(pure);expect(gpu.records.length).toBe(count);expect(f.owner.selectedMaterial(port.sourceMaterial)).toBe(material);
 }finally{f.close();}
},60000);

test('a genuine HumanModel adoption changes complete face address domain on the SAME material before returning to Pastel',async()=>{
 const f=fixture();try{
  await f.run('origami');expect(f.owner.status().ready,f.owner.status().fallback??'').toBe(true);const old=f.layer.bodySurfaceBakeSource()!,material=f.owner.selectedMaterial(old.sourceMaterial),faces=old.model.strokes.faceCount,model=old.model,extend=Reflect.get(f.layer,'extendResidentGeometry')as(smithing:boolean,mace:boolean,longsword:boolean,spear:boolean)=>void;
  Reflect.apply(extend,f.layer,[true,true,false,false]);const next=f.layer.bodySurfaceBakeSource()!;expect(next.model).not.toBe(model);expect(next.model.strokes.faceCount).not.toBe(faces);expect(next.sourceMaterial).toBe(old.sourceMaterial);f.owner.invalidate();await f.run('origami');expect(f.owner.status().ready,f.owner.status().fallback??'').toBe(true);expect(f.owner.selectedMaterial(next.sourceMaterial)).toBe(material);expect(surfaces(f.owner).every(surface=>surface.snapshot().faceCount===next.model.strokes.faceCount)).toBe(true);expect(gpu.records.at(-1)!.faces).toBe(next.model.strokes.faceCount);
  await f.run('default');expect(f.owner.selectedMaterial(next.sourceMaterial)).toBe(material);expect(surfaces(f.owner).every(surface=>surface.snapshot().encoding===0)).toBe(true);
 }finally{f.close();}
},60000);

test('failed old-atlas retirement keeps both real owners reachable and terminal disposal retries the old resource once',async()=>{
 const f=fixture();let batch:SharedSurfacePreparationBatch|undefined;try{
  await f.run('origami');expect(f.owner.status().ready,f.owner.status().fallback??'').toBe(true);const old=gpu.records.at(-1)!;old.failures=1;f.context.update({...f.context.preferences,edgeWidth:Math.min(5,f.context.preferences.edgeWidth+.1)});batch=await f.stage('origami');batch.publish();expect(gpu.records.length-f.first).toBe(2);const current=gpu.records.at(-1)!;expect(()=>batch!.commit()).toThrow(/transfer|retirement|disposal|quarantin/i);batch.dispose();batch=undefined;expect(old.attempts).toBe(1);expect(old.closed).toBe(false);expect(current.closed).toBe(false);expect(()=>f.context.surfacePreparation.assertReadyForDraw()).toThrow();f.owner.dispose();expect(old.attempts).toBe(2);expect(old.closed).toBe(true);expect(current.attempts).toBe(1);expect(current.closed).toBe(true);
 }finally{batch?.dispose();f.close();}
},60000);
