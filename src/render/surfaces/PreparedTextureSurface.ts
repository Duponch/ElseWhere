/** A small final format graph shared by named RGBA assets and generic B/I.
 * Source remains an explicit JS representation, never a hidden shader branch.
 * Construction happens before first Pastel; publication borrows textures only. */
import * as THREE from 'three/webgpu';
import {Fn,If,mix,texture,varying,vec2,vec3} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import {copyPastelTextureToArray} from './TextureSurface';
import {createOwnedMaterialResources435,type OwnedMaterialResourceSnapshot435} from '../OwnedMaterialResources435';

export interface PreparedTextureAddress {
 readonly uv:THREE.Node<'vec2'>;
 readonly bodyLayer:THREE.Node<'float'>;
 readonly inkLayer:THREE.Node<'float'>;
 /** Exact format discriminator, constant over each triangle: 0=RGBA, 1=B/I. */
 readonly format:THREE.Node<'float'>;
}
export interface PreparedTextureSurfaceOptions {
 readonly context:GraphicsStyleContext;
 readonly sourceMaterial:THREE.NodeMaterial;
 readonly pastelTexture:THREE.DataTexture;
 readonly pastelSize?:64|256;
 readonly pastelUv:THREE.Node<'vec2'>;
 readonly pastelFromSample:(sample:THREE.Node<'vec4'>)=>THREE.Node<'vec3'>;
 readonly tint:THREE.Node<'vec3'>;
 readonly inkTint?:THREE.Node<'vec3'>;
 readonly address:()=>PreparedTextureAddress;
 /** The real resident uv already holds the currently published Pastel/atlas
  * coordinates. The owner restores/resolves it under the preparation hold.
  * No legacy coordinate branch, address book or extra attribute is retained. */
 readonly preResolvedUv?:boolean;
 readonly resources?:Partial<OwnedMaterialResourceSnapshot435>;
 readonly configure?:(material:THREE.NodeMaterial)=>void;
}
export interface PreparedTextureAsset {readonly texture:THREE.Texture;assertCurrent():void}

export class PreparedTextureSurface {
 readonly material:THREE.NodeMaterial;
 private readonly pastel:THREE.DataArrayTexture;
 private readonly body:THREE.TextureNode;
 private readonly ink:THREE.TextureNode;
 private readonly pureColor:THREE.Node<'vec3'>;
 private readonly journal:ReturnType<typeof createOwnedMaterialResources435>;
 private readonly unsubscribe:()=>void;
 private current:PreparedTextureAsset|undefined;
 private representation:'pure'|'source'='pure';
 private closed=false;
 constructor(private readonly options:PreparedTextureSurfaceOptions){
  let ownedPastel:THREE.DataArrayTexture|undefined,ownedMaterial:THREE.NodeMaterial|undefined,ownedJournal:ReturnType<typeof createOwnedMaterialResources435>|undefined;
  try{
  this.pastel=ownedPastel=copyPastelTextureToArray(options.pastelTexture,options.pastelSize??64);
  const material=ownedMaterial=options.sourceMaterial.clone();this.material=material;material.userData={...options.sourceMaterial.userData,rendererOwned:true};
  const address=options.address(),encoding=options.context.surfaceEncoding,
   coordinates=varying(options.preResolvedUv?address.uv:mix(options.pastelUv,address.uv,encoding),'v_preparedSurfaceUv'),
   bodyLayer=varying(address.bodyLayer.mul(encoding),'v_preparedSurfaceBodyLayer').setInterpolation('flat','first'),
   inkLayer=varying(address.inkLayer,'v_preparedSurfaceInkLayer').setInterpolation('flat','first'),
   format=varying(address.format,'v_preparedSurfaceFormat').setInterpolation('flat','first'),
   tint=varying(options.tint,'v_preparedSurfaceTint'),inkTint=options.inkTint?varying(options.inkTint,'v_preparedSurfaceInkTint'):vec3(1);
  this.body=texture(this.pastel,coordinates).depth(bodyLayer);
  // B/I body alpha stores conservative occupancy of STORED ink RGB, per mip.
  // Its value is not opacity. Legacy Body.a=1 remains a safe always-read path.
  this.ink=texture(this.pastel,coordinates).depth(inkLayer);
  const sample=this.body as unknown as THREE.Node<'vec4'>;
  this.pureColor=Fn(()=>{
   const result=vec3(0).toVar('preparedSurfaceColor');result.assign(vec3(0));
   If(encoding.equal(0),()=>{
    // Preserve the original Pastel sampler/algebra, with no Gouache gradients.
    const sampled=sample.toVar();result.assign(options.pastelFromSample(sampled));
   }).Else(()=>{
    // Both samples need exactly the same filter footprint/LOD. Explicit
    // assignments dominate the pixel-varying occupancy/format branch.
    const dx=vec2(0).toVar('preparedSurfaceDx'),dy=vec2(0).toVar('preparedSurfaceDy');
    dx.assign(coordinates.dFdx());dy.assign(coordinates.dFdy());
    const sampled=this.body.grad(dx,dy).toVar('preparedGouacheBody');
    result.assign(sampled.rgb.mul(tint));
    If(format.equal(1).and(sampled.a.greaterThan(0)),()=>{
     result.addAssign(this.ink.grad(dx,dy).rgb.mul(inkTint));
    });
   });return result;
  })();
  this.journal=ownedJournal=createOwnedMaterialResources435(material,this.resources(this.pastel));
   if(options.configure){
    const keys=['positionNode','maskNode','maskShadowNode','outputNode','castShadowPositionNode','receivedShadowPositionNode'] as const,source=keys.map(key=>material[key]);
    // Original producer callbacks may register their exact configured clone in
    // a WeakSet. Let them do that once without wrapping borrowed output twice,
    // then restore the canonical Source references byte-for-byte by identity.
    material.outputNode=null;material.maskNode=null;material.maskShadowNode=null;
    try{options.configure(material);}finally{material.copy(options.sourceMaterial);material.userData={...options.sourceMaterial.userData,rendererOwned:true};for(let i=0;i<keys.length;i++)material[keys[i]!]=source[i]!;}
   }
   material.vertexColors=false;material.colorNode=this.pureColor;material.normalNode=null;Reflect.set(material,'normalMap',null);Reflect.set(material,'bumpMap',null);this.unsubscribe=options.context.trackSharedPaintSettingsRefresh(()=>this.refresh());
  }
  catch(error){const failures=[error];try{ownedJournal?.dispose();}catch(cleanup){failures.push(cleanup);}for(const resource of[ownedMaterial,ownedPastel])if(resource)try{resource.dispose();}catch(cleanup){failures.push(cleanup);}throw failures.length===1?error:new AggregateError(failures,'Prepared final surface construction cleanup');}
 }
 private resources(map:THREE.Texture):OwnedMaterialResourceSnapshot435{
  const extra=this.options.resources;return{textures:[map,...(extra?.textures??[])],arrayTextures:[map,...(extra?.arrayTextures??[])],sharedGroups:extra?.sharedGroups??[],storage:extra?.storage??[],objectUniforms:[this.options.context.surfaceEncoding,...(extra?.objectUniforms??[])]};
 }
 private refresh():void{
  if(this.closed)return;const map=this.options.context.origami&&this.current?this.current.texture:this.pastel;
  this.body.value=map;this.ink.value=map;this.journal.publish(this.resources(map));
 }
 get assets():PreparedTextureAsset|undefined{return this.current;}
 syncResources():void{if(this.closed)throw Error('Prepared final surface closed');this.journal.publish(this.resources(this.body.value));}
 setAssets(assets:PreparedTextureAsset|undefined):void{
  if(this.closed)throw Error('Prepared final surface closed');assets?.assertCurrent();
  if(assets){const t=assets.texture,image=t.image as{width?:number;height?:number;depth?:number};if(!(t.isArrayTexture||t instanceof THREE.DataArrayTexture)||t.format!==THREE.RGBAFormat||t.type!==THREE.UnsignedByteType||t.colorSpace!==THREE.SRGBColorSpace||t.flipY||!Number.isSafeInteger(image?.depth)||Number(image?.depth)<1||t.magFilter!==THREE.LinearFilter||t.minFilter!==THREE.LinearMipmapLinearFilter)throw Error('Prepared final bank must be the filtered RGBA8 sRGB array');}
  this.current=assets;this.refresh();
 }
 /** Hold/compile boundary only. The pure graph owns no Source paint kernel. */
 selectRepresentation(representation:'pure'|'source'):void{
  if(this.closed)throw Error('Prepared final surface closed');
  if(representation==='pure'&&(this.options.context.reliefEnabled||this.options.context.wearEnabled))throw Error('Positive effects require the complete Source representation');
  const source=this.options.sourceMaterial;let changed=this.representation!==representation;
  for(const key of ['positionNode','maskNode','maskShadowNode','outputNode','castShadowPositionNode','receivedShadowPositionNode'] as const)if(this.material[key]!==source[key]){this.material[key]=source[key];changed=true;}
  if(this.representation===representation&&representation==='pure'){if(changed)this.material.needsUpdate=true;return;}
  if(this.material.colorNode!==(representation==='pure'?this.pureColor:source.colorNode)||this.material.normalNode!==(representation==='pure'?null:source.normalNode))changed=true;
  this.material.colorNode=representation==='pure'?this.pureColor:source.colorNode;
  this.material.normalNode=representation==='pure'?null:source.normalNode;
  Reflect.set(this.material,'normalMap',representation==='pure'?null:Reflect.get(source,'normalMap'));
  Reflect.set(this.material,'bumpMap',representation==='pure'?null:Reflect.get(source,'bumpMap'));
  this.material.vertexColors=representation==='pure'?false:source.vertexColors;if(changed)this.material.needsUpdate=true;this.representation=representation;
 }
 assertReady():void{if(this.closed||this.representation==='pure'&&this.options.context.origami&&(!this.current||this.options.context.reliefEnabled||this.options.context.wearEnabled))throw Error('Prepared final surface must publish or explicitly choose Source before draw');this.current?.assertCurrent();}
 snapshot(){return{representation:this.representation,material:this.material.uuid,assets:this.current,boundTexture:this.body.value.uuid,journalRevision:this.journal.declaration.revision,closed:this.closed};}
 dispose():void{if(this.closed)return;const failures:unknown[]=[];for(const close of[this.unsubscribe,()=>this.journal.dispose(),()=>this.material.dispose(),()=>this.pastel.dispose()])try{close();}catch(error){failures.push(error);}if(failures.length)throw new AggregateError(failures,'Prepared final surface close quarantine');this.closed=true;this.current=undefined;}
}
