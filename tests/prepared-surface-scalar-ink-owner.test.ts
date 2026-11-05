/** Real generic registry/owner/final surface; only device raster is mocked.
 * TEST lease metadata proves lifecycle/admission only, never Native pixels. */
import{expect,test}from'vitest';
import*as THREE from'three/webgpu';
import{attribute,float,uv,vec3,vec4}from'three/tsl';
import{GraphicsStyleContext}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';
import{compileNaturalSurfaceModels,SURFACE_STROKE_FACE,SURFACE_STROKE_UV}from'../src/render/surfaces/NaturalSurfaceModels';
import{PreparedTextureSurface}from'../src/render/surfaces/PreparedTextureSurface';
import{PreparedSurfaceOwner}from'../src/render/origami/baked/surfaces/PreparedSurfaceOwner';
import type{PreparedSurfaceGpuResult,PreparedSurfacePlan,PreparedSurfaceScalarInk,PreparedSurfaceSource}from'../src/render/origami/baked/surfaces/PreparedSurfaceTypes';
import type{SharedSurfacePreparationSnapshot}from'../src/render/surfaces/SharedSurfacePreparation';
type Color=readonly[number,number,number];
function fixture(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0,edges:0}),box=new THREE.BoxGeometry(),natural=compileNaturalSurfaceModels([box]),geometry=natural.geometries[0]!,sourceMaterial=new THREE.MeshLambertNodeMaterial();sourceMaterial.colorNode=vec3(1);
 const pastel=new THREE.DataTexture(new Uint8Array(64*64*4),64,64);pastel.flipY=false;pastel.magFilter=THREE.LinearFilter;pastel.minFilter=THREE.LinearMipmapLinearFilter;pastel.generateMipmaps=true;
 const source:PreparedSurfaceSource={key:'TEST-real-scalar-natural',context,stroke:natural.stroke,buildTerms:()=>({body:vec3(1),ink:vec4(0)}),assertCurrent(){}},
  model={key:'TEST-scalar-natural-box',geometry,chartUvAttribute:SURFACE_STROKE_UV,faceId:(v:number)=>geometry.getAttribute(SURFACE_STROKE_FACE).getX(v),assertCurrent(){natural.stroke.assertCurrent();}},
  bakes:{plan:PreparedSurfacePlan;texture:THREE.DataArrayTexture;scalarInk:PreparedSurfaceScalarInk|undefined;disposed:number}[]=[];
 let color:Color=[.25,.5,.75],override:PreparedSurfaceScalarInk|undefined,force=false,epoch=0;
 const owner=new PreparedSurfaceOwner({key:'TEST-scalar-registry-owner',context,source:()=>source,changed:()=>{},useAddressBook:false,maxCellPixels:64,returnCellPixels:56,
  prepareGpu:async(_renderer,plan,paint,assertCurrent)=>{assertCurrent();const k=paint.paint.brushColorLinear,
   scalarInk=force?override:context.preferences.edges===0?Object.freeze({color:Object.freeze([Math.fround(k[0]),Math.fround(k[1]),Math.fround(k[2])]as const)}):undefined,
   texture=new THREE.DataArrayTexture(new Uint8Array(4),plan.size,plan.size,plan.layers);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
   const record={plan,texture,scalarInk,disposed:0};bakes.push(record);const gpu:PreparedSurfaceGpuResult={texture,pages:plan.pages,scalarInk,gpuBytes:plan.retainedGpuBytes,cpuBytes:scalarInk?32:0,stats:{scope:'TEST GPU callee only; no device/pixels'},assertCurrent(){if(record.disposed)throw Error('TEST bank retired');},dispose(){if(record.disposed)return;texture.dispose();record.disposed++;}};return gpu;
  }}),ids=[1,2].map((sx,i)=>owner.registerVariant({key:'TEST-scalar-box-'+i,model,linear:[sx,0,0,0,1,0,0,0,1],maxUniformScale:1,format:'bi'}));owner.setDemand([ids[0]!]);
 const material=owner.addTarget({sourceMaterial,pastelTexture:pastel,pastelUv:uv(),pastelFromSample:s=>s.rgb,tint:attribute('boxColor','vec3'),addressWithoutBook:()=>({uv:uv(),bodyLayer:float(0),inkLayer:float(1),format:float(1)})}),
  surface=(Reflect.get(owner,'surfaces')as Map<THREE.NodeMaterial,PreparedTextureSurface>).get(sourceMaterial)!;
 const snapshot=(style:'default'|'origami'):SharedSurfacePreparationSnapshot=>{context.update({...context.preferences,style});return{preferences:{...context.preferences},world:{}as NonNullable<SharedSurfacePreparationSnapshot['world']>,reset:false,reason:'settings',epoch:++epoch,renderer:{}as THREE.WebGPURenderer,paintRevision:context.preparedPaintRevision,paintSource:style==='origami'?{assertCurrent(){},paint:{brushColorLinear:color}}as NonNullable<SharedSurfacePreparationSnapshot['paintSource']>:undefined,density:{mode:'orthographic',physicalCellPixels:40}};},
  stage=(style:'default'|'origami')=>context.surfacePreparation.stage(snapshot(style),()=>{}),run=async(style:'default'|'origami')=>{const batch=await stage(style);try{batch.publish();batch.commit();}finally{batch.dispose();}context.surfacePreparation.assertReadyForDraw();},
  words=()=>{const enabled=Reflect.get(surface,'scalarInkEnabled')as{value:number},k=Reflect.get(surface,'scalarInkColor')as{value:THREE.Vector3};return{enabled:enabled.value,color:k.value.toArray()};},
  close=()=>{context.surfacePreparation.dispose();owner.dispose();sourceMaterial.dispose();pastel.dispose();natural.dispose();box.dispose();context.dispose();};
 return{context,owner,sourceMaterial,material,surface,geometry,ids,bakes,stage,run,words,close,setColor:(next:Color)=>{color=next;},forceMetadata:(next:PreparedSurfaceScalarInk|undefined)=>{force=true;override=next;}};
}

test('scalar basis from the actual admitted paint lease publishes without new layers, addresses, materials or canonical attributes',async()=>{
 const f=fixture();try{const attributes={...f.geometry.attributes};await f.run('default');expect(f.words()).toEqual({enabled:0,color:[0,0,0]});await f.run('origami');expect(f.bakes).toHaveLength(1);const bank=f.bakes[0]!;
  expect(bank.scalarInk).toEqual({color:[.25,.5,.75]});expect(f.words()).toEqual({enabled:1,color:[.25,.5,.75]});expect(f.owner.status()).toMatchObject({ready:true,lookupGpuUpperBytes:0,scalarInkCached:true,scalarInkColor:[.25,.5,.75]});expect(f.surface.snapshot().assets!.texture).toBe(bank.texture);
  expect(bank.texture.image.depth).toBe(bank.plan.pages.reduce((n,p)=>Math.max(n,p.bodyLayer+1,(p.inkLayer??-1)+1),0));expect(f.geometry.attributes).toEqual(attributes);expect(f.owner.materials[0]).toBe(f.material);
 }finally{f.close();}
});

test('cache hits keep the published bank basis and Pastel clears coefficient interpretation before a cached Gouache return',async()=>{
 const f=fixture();try{await f.run('origami');const bank=f.bakes[0]!,old=f.words();f.setColor([.5,.25,.125]);f.owner.invalidate();await f.run('origami');expect(f.bakes).toHaveLength(1);expect(f.words()).toEqual(old);
  await f.run('default');expect(f.words()).toEqual({enabled:0,color:[0,0,0]});expect(f.surface.snapshot().assets).toBeUndefined();await f.run('origami');expect(f.bakes).toHaveLength(1);expect(f.surface.snapshot().assets!.texture).toBe(bank.texture);expect(f.words()).toEqual(old);
 }finally{f.close();}
});

test('global rollback restores both the previous bank and its exact scalar basis while retaining it through candidate compilation',async()=>{
 const f=fixture();try{await f.run('origami');const old=f.bakes[0]!,words=f.words();f.setColor([.5,.25,.125]);f.owner.setDemand(f.ids);const batch=await f.stage('origami'),next=f.bakes[1]!;
  batch.publish();expect(f.surface.snapshot().assets!.texture).toBe(next.texture);expect(f.words()).toEqual({enabled:1,color:[.5,.25,.125]});expect(old.disposed).toBe(0);expect(next.disposed).toBe(0);batch.rollback();batch.dispose();expect(f.surface.snapshot().assets!.texture).toBe(old.texture);expect(f.words()).toEqual(words);expect(old.disposed).toBe(0);expect(next.disposed).toBe(1);
 }finally{f.close();}
});

test('a new unsupported carton setting publishes exact BI metadata absence instead of reinterpreting a previous scalar alpha',async()=>{
 const f=fixture();try{await f.run('origami');const first=f.bakes[0]!;f.context.update({...f.context.preferences,edges:.25});await f.run('origami');expect(f.bakes).toHaveLength(2);expect(f.bakes[1]!.scalarInk).toBeUndefined();expect(f.words()).toEqual({enabled:0,color:[0,0,0]});expect(f.owner.status()).toMatchObject({ready:true,scalarInkCached:false,scalarInkColor:null});expect(first.disposed).toBe(1);expect(f.owner.materials[0]).toBe(f.material);
 }finally{f.close();}
});

test('a sparse or wrong GPU basis is rejected before publication and only its unused candidate is retired',async()=>{
 for(const invalid of[{color:new Array(3)as unknown as Color},{color:[.5,.25,.125]as Color}]){
  const f=fixture();try{await f.run('origami');const old=f.bakes[0]!,words=f.words();f.owner.setDemand(f.ids);f.forceMetadata(invalid);await expect(f.stage('origami')).rejects.toThrow('f32 words');expect(f.bakes).toHaveLength(2);expect(old.disposed).toBe(0);expect(f.bakes[1]!.disposed).toBe(1);expect(f.surface.snapshot().assets!.texture).toBe(old.texture);expect(f.words()).toEqual(words);
  }finally{f.close();}
 }
});

test('advertising scalar metadata outside the no-carton domain rejects and preserves the previously published bank',async()=>{
 const f=fixture();try{await f.run('origami');const old=f.bakes[0]!,words=f.words();f.context.update({...f.context.preferences,edges:.25});f.forceMetadata({color:[.25,.5,.75]});await expect(f.stage('origami')).rejects.toThrow('no-carton');expect(old.disposed).toBe(0);expect(f.bakes[1]!.disposed).toBe(1);expect(f.surface.snapshot().assets!.texture).toBe(old.texture);expect(f.words()).toEqual(words);
 }finally{f.close();}
});
