/** Resource adapter over the SAME canonical-family owner/baker used by
 * rigid props. No additional queue, renderer, World copy or texture owner. */
import * as THREE from 'three/webgpu';
import {attribute,uniform} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import type {SharedPaintSurfaceOptions} from './SharedPaintSurface';
import type {FaceStrokeData} from './FaceStrokeTable';
import type {TreeAssetCatalog} from '../origami/baked/trees/types';
import type {Placement} from '../primitives';
import {PreparedSurfaceOwner} from '../origami/baked/surfaces/PreparedSurfaceOwner';
import {PreparedSurfaceAdmissionRefusal} from '../origami/baked/surfaces/PreparedSurfaceTypes';
import {canonicalPreparedSurfaceSource} from '../origami/baked/surfaces/PreparedSurfaceSource';
import {ResourcePreparedModels} from './ResourcePreparedModels';
import {prepareResourceBank} from './ResourcePreparedBank';
import {ResourceResolvedAddresses,resourceResolvedTextureInputs} from './ResourceResolvedAddresses';

export interface ResourcePreparedAtlasOptions {
 readonly key:string;
 readonly context:GraphicsStyleContext;
 readonly sourceMaterial:THREE.NodeMaterial;
 readonly pastel:THREE.DataTexture;
 readonly stroke:FaceStrokeData;
 readonly bodyOptions:()=>SharedPaintSurfaceOptions;
 readonly catalog:()=>TreeAssetCatalog|undefined;
 readonly hasNamedTrees:()=>boolean;
 readonly hasAnonymousTrees:()=>boolean;
 readonly changed:()=>void;
 readonly sourceCoverageCpuBytes?:()=>number;
 readonly sourceCoverageGpuBytes?:()=>number;
 /** Borrowed immutable Source mask, retained by ResourceSurfaceModels only. */
 readonly sourceCoverageTexture?:()=>THREE.Texture;
 readonly patchAttribute?:(attribute:THREE.BufferAttribute,start:number,count:number)=>void;
}
export class ResourcePreparedAtlas {
 readonly owner:PreparedSurfaceOwner;
 readonly models:ResourcePreparedModels;
 readonly material:THREE.NodeMaterial;
 readonly resolved:ResourceResolvedAddresses;
 private readonly treeLayerCount=uniform(0);
 private closed=false;private refusal:string|undefined;
 private readonly quarantined=new Set<{dispose():void}>();
 private readonly contributions=new Set<unknown>();
 constructor(private readonly options:ResourcePreparedAtlasOptions){
  const context=options.context,paint=attribute('origamiPaint','vec4'),slot=paint.w.div(128).floor().mod(32),face=paint.w.div(4096).floor(),surface=attribute('surfaceUv','vec4');
  this.resolved=new ResourceResolvedAddresses({changed:()=>this.owner.invalidate(),patch:options.patchAttribute??(()=>{}),publishTreeLayers:layers=>{this.treeLayerCount.value=layers;}});
  const source=canonicalPreparedSurfaceSource({key:'resource-canonical-static78-v1',context,stroke:options.stroke,bodyOptions:options.bodyOptions,faceId:face,strokeUv:slot.lessThan(31).select(surface.xy,surface.zw),unitBodyProven:true,profileDomain:'static78-separable',assertCurrent:()=>{
   if(this.closed)throw Error('Resource prepared adapter closed');if(this.refusal)throw new PreparedSurfaceAdmissionRefusal(this.refusal);
   if(options.hasAnonymousTrees())throw new PreparedSurfaceAdmissionRefusal('Continuous anonymous tree metrics preserve complete Resource Source');
   if(options.hasNamedTrees()&&!options.catalog())throw new PreparedSurfaceAdmissionRefusal('Named tree bank unavailable; complete Resource Source retained');
   options.catalog()?.assertCurrent();
  }});
  this.owner=new PreparedSurfaceOwner({key:'resources-common:'+options.key,context,source:()=>source,changed:options.changed,useAddressBook:false,
   stagePresentation:(presentation,_snapshot,assertCurrent)=>this.resolved.stage({...presentation,catalog:options.catalog()},assertCurrent),maxCellPixels:64,returnCellPixels:56,minPageSize:2048,maxCpuBytes:256*1024*1024,maxRetainedGpuBytes:384*1024*1024,maxPeakGpuBytes:1024*1024*1024,
   // The external texture identity is a borrowed-lease dependency, not a
   // model/World cache key. A retired tree-only borrowed bank cannot be reused
   // merely because a newly allocated bank has identical pixels/settings.
   cacheIdentity:()=>{const catalog=options.catalog();return JSON.stringify(['resources-external-v1',options.hasNamedTrees(),options.hasAnonymousTrees(),catalog?.paintKey??null,catalog?.modelKeys??[],catalog?.texture.uuid??null]);},
   hasExternalDemand:options.hasNamedTrees,
   externalGpuBytes:()=>{const catalog=options.catalog();return(catalog?.pageCount??0)*2048*2048*4*(1+1/4+1/16+1/64)+(options.sourceCoverageGpuBytes?.()??0);},
   externalCpuBytes:()=>this.models.stats().cpuBytes+this.resolved.status().originalCpuBytes+(options.sourceCoverageCpuBytes?.()??0),
   prepareGpu:(renderer,plan,_paint,assert,prepareDefault)=>prepareResourceBank(renderer,plan,options.catalog(),assert,prepareDefault,resource=>this.quarantined.add(resource)),
  });
  this.models=new ResourcePreparedModels(variant=>this.owner.registerVariant(variant));
  try{
   this.material=this.owner.addTarget({sourceMaterial:options.sourceMaterial,pastelTexture:options.pastel,...resourceResolvedTextureInputs(context,this.treeLayerCount),resources:{get textures(){const mask=options.sourceCoverageTexture?.();return mask?[mask]:[];},objectUniforms:[this.treeLayerCount]}});
  }catch(error){const errors=[error];try{this.models.dispose();}catch(cleanup){errors.push(cleanup);}try{this.owner.dispose();}catch(cleanup){errors.push(cleanup);}try{this.resolved.dispose();}catch(cleanup){errors.push(cleanup);}throw errors.length===1?error:new AggregateError(errors,'Resource prepared adapter construction cleanup');}
 }
 /** Existing merge writer only. Anonymous trees return -1 and retain Source. */
 capture(geometry:THREE.BufferGeometry,item:Placement,fullGrowthFactor:number):number{
  try{return this.models.capture(geometry,item,fullGrowthFactor);}catch(error){if(!(error instanceof PreparedSurfaceAdmissionRefusal))throw error;this.refusal=error.message;this.owner.invalidate();return-1;}
 }
 setResidents(key:unknown,geometries:readonly THREE.BufferGeometry[]):void{this.resolved.setResidents(key,geometries);}
 setContribution(key:unknown,ids:Iterable<number>):void{this.contributions.add(key);this.owner.setContribution(key,ids);}
 forgetContribution(key:unknown):void{this.resolved.forget(key);if(this.contributions.delete(key))this.owner.setContribution(key,[]);}
 clear():void{if(this.closed)return;this.resolved.clear();for(const key of this.contributions)this.owner.setContribution(key,[]);this.contributions.clear();this.refusal=undefined;this.owner.invalidate();}
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{this.owner.attachGpuRetirement(geometries);}
 status(){return{...this.owner.status(),canonical:this.models.stats(),resolvedAddresses:this.resolved.status(),quarantined:this.quarantined.size,refusal:this.refusal??null};}
 dispose():void{if(this.closed)return;const errors:unknown[]=[];try{this.owner.dispose();}catch(error){errors.push(error);}for(const resource of this.quarantined)try{resource.dispose();this.quarantined.delete(resource);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Resource prepared owner close quarantine');this.resolved.dispose();this.models.dispose();this.closed=true;}
}
