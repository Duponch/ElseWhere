/** Real generic registry/owner/final surface; only device raster is mocked.
 * TEST lease metadata proves lifecycle/admission only, never Native pixels. */
import{expect,test}from'vitest';
import*as THREE from'three/webgpu';
import{attribute,float,uniform,uv,vec3,vec4}from'three/tsl';
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
  bakes:{plan:PreparedSurfacePlan;texture:THREE.DataArrayTexture;scalarInk:PreparedSurfaceScalarInk|undefined;pages:PreparedSurfaceGpuResult['pages'];disposed:number}[]=[];
 const layerBase=uniform(0);let color:Color=[.25,.5,.75],override:PreparedSurfaceScalarInk|undefined,force=false,epoch=0,compact=true,base=0,malformed=false,metadataMissing=false;
 const owner=new PreparedSurfaceOwner({key:'TEST-scalar-registry-owner',context,source:()=>source,changed:()=>{},useAddressBook:false,maxCellPixels:64,returnCellPixels:56,
  prepareGpu:async(_renderer,plan,paint,assertCurrent)=>{assertCurrent();const k=paint.paint.brushColorLinear,
   scalarInk=force?override:context.preferences.edges===0?Object.freeze({color:Object.freeze([Math.fround(k[0]),Math.fround(k[1]),Math.fround(k[2])]as const),...(compact?{compact:true as const}:{})}):undefined,
   pages:PreparedSurfaceGpuResult['pages']=scalarInk?.compact?plan.pages.map((p,i)=>({format:'scalar' as const,bodyLayer:base+i+(malformed&&i===0?1:0)})):plan.pages,texture=new THREE.DataArrayTexture(new Uint8Array(4),plan.size,plan.size,scalarInk?.compact?base+plan.pages.length:plan.layers);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
   const record={plan,texture,scalarInk:metadataMissing?undefined:scalarInk,pages,disposed:0};bakes.push(record);const gpu:PreparedSurfaceGpuResult={texture,pages,scalarInk:record.scalarInk,gpuBytes:plan.retainedGpuBytes,cpuBytes:scalarInk?32:0,stats:{scope:'TEST GPU callee only; no device/pixels'},assertCurrent(){if(record.disposed)throw Error('TEST bank retired');},dispose(){if(record.disposed)return;texture.dispose();record.disposed++;}};return gpu;
  }}),ids=[1,2].map((sx,i)=>owner.registerVariant({key:'TEST-scalar-box-'+i,model,linear:[sx,0,0,0,1,0,0,0,1],maxUniformScale:1,format:'bi'}));owner.setDemand([ids[0]!]);
 const material=owner.addTarget({sourceMaterial,pastelTexture:pastel,pastelUv:uv(),pastelFromSample:s=>s.rgb,tint:attribute('boxColor','vec3'),scalarInkLayerBase:layerBase,addressWithoutBook:()=>({uv:uv(),bodyLayer:layerBase,inkLayer:layerBase.add(1),format:float(1)})}),
  surface=(Reflect.get(owner,'surfaces')as Map<THREE.NodeMaterial,PreparedTextureSurface>).get(sourceMaterial)!;
 const snapshot=(style:'default'|'origami'):SharedSurfacePreparationSnapshot=>{context.update({...context.preferences,style});return{preferences:{...context.preferences},world:{}as NonNullable<SharedSurfacePreparationSnapshot['world']>,reset:false,reason:'settings',epoch:++epoch,renderer:{}as THREE.WebGPURenderer,paintRevision:context.preparedPaintRevision,paintSource:style==='origami'?{assertCurrent(){},paint:{brushColorLinear:color}}as NonNullable<SharedSurfacePreparationSnapshot['paintSource']>:undefined,density:{mode:'orthographic',physicalCellPixels:40}};},
  stage=(style:'default'|'origami')=>context.surfacePreparation.stage(snapshot(style),()=>{}),run=async(style:'default'|'origami')=>{const batch=await stage(style);try{batch.publish();batch.commit();}finally{batch.dispose();}context.surfacePreparation.assertReadyForDraw();},
  words=()=>{const enabled=Reflect.get(surface,'scalarInkEnabled')as{value:number},k=Reflect.get(surface,'scalarInkColor')as{value:THREE.Vector3};return{enabled:enabled.value,color:k.value.toArray()};},
  close=()=>{context.surfacePreparation.dispose();owner.dispose();sourceMaterial.dispose();pastel.dispose();natural.dispose();box.dispose();context.dispose();};
 return{context,owner,sourceMaterial,material,surface,geometry,ids,bakes,stage,run,words,close,setColor:(next:Color)=>{color=next;},setCompact:(next:boolean,offset=0)=>{compact=next;base=offset;layerBase.value=offset;},setMalformed:()=>{malformed=true;},hideMetadata:()=>{metadataMissing=true;},forceMetadata:(next:PreparedSurfaceScalarInk|undefined)=>{force=true;override=next;}};
}

test('compact scalar pages publish actual metadata while logical BI admission stays intact, and a cached P/G return retains the same result',async()=>{
 const f=fixture();try{f.setCompact(true,2);await f.run('default');await f.run('origami');const bank=f.bakes[0]!;
  expect(bank.plan.pages.every((p,i)=>p.format==='bi'&&p.bodyLayer===i*2&&p.inkLayer===i*2+1)).toBe(true);expect(bank.pages).toEqual(bank.plan.pages.map((_,i)=>({format:'scalar',bodyLayer:2+i})));expect(bank.texture.image.depth).toBe(2+bank.plan.pages.length);expect(f.words()).toEqual({enabled:2,color:[.25,.5,.75]});expect(f.owner.status()).toMatchObject({ready:true,scalarInkCompact:true,layers:bank.texture.image.depth});
  const assets=f.surface.snapshot().assets;expect(assets!.scalarInk).toBe(bank.scalarInk);await f.run('default');expect(f.words()).toEqual({enabled:0,color:[0,0,0]});expect(f.surface.snapshot().assets).toBeUndefined();await f.run('origami');expect(f.bakes).toHaveLength(1);expect(f.surface.snapshot().assets!.texture).toBe(bank.texture);expect(f.surface.snapshot().assets!.scalarInk).toBe(bank.scalarInk);expect(f.words().enabled).toBe(2);
 }finally{f.close();}
});

test('global compact-to-full candidate publication rolls texture, compact flag and basis back atomically without retiring the old result',async()=>{
 const f=fixture();try{await f.run('origami');const old=f.bakes[0]!,before=f.words();f.setCompact(false);f.setColor([.5,.25,.125]);f.owner.setDemand(f.ids);const batch=await f.stage('origami'),next=f.bakes[1]!;
  batch.publish();expect(f.surface.snapshot().assets!.texture).toBe(next.texture);expect(f.words()).toEqual({enabled:1,color:[.5,.25,.125]});expect(old.disposed).toBe(0);expect(next.disposed).toBe(0);batch.rollback();batch.dispose();expect(f.surface.snapshot().assets!.texture).toBe(old.texture);expect(f.surface.snapshot().assets!.scalarInk).toBe(old.scalarInk);expect(f.words()).toEqual(before);expect(old.disposed).toBe(0);expect(next.disposed).toBe(1);
 }finally{f.close();}
});

test('malformed compact page mappings or missing interpretation metadata reject before publication and retain the previous texture',async()=>{
 for(const missing of[false,true]){const f=fixture();try{await f.run('origami');const old=f.bakes[0]!,before=f.words();f.owner.setDemand(f.ids);if(missing)f.hideMetadata();else f.setMalformed();await expect(f.stage('origami')).rejects.toThrow(missing?'require compact scalar metadata':'dense physical pages');expect(f.bakes).toHaveLength(2);expect(old.disposed).toBe(0);expect(f.bakes[1]!.disposed).toBe(1);expect(f.surface.snapshot().assets!.texture).toBe(old.texture);expect(f.words()).toEqual(before);
  }finally{f.close();}}
});
