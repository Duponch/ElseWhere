/** Resource adapter over the SAME canonical-family owner/baker/book used by
 * rigid props. No additional queue, renderer, World copy or texture owner. */
import * as THREE from 'three/webgpu';
import {Fn,If,attribute,float,int,vec3,vec4} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import type {SharedPaintSurfaceOptions} from './SharedPaintSurface';
import type {FaceStrokeData} from './FaceStrokeTable';
import type {TreeAssetCatalog} from '../origami/baked/trees/types';
import type {Placement} from '../primitives';
import {PreparedSurfaceOwner} from '../origami/baked/surfaces/PreparedSurfaceOwner';
import {PreparedSurfaceAdmissionRefusal} from '../origami/baked/surfaces/PreparedSurfaceTypes';
import {canonicalPreparedSurfaceSource} from '../origami/baked/surfaces/PreparedSurfaceSource';
import {ResourcePreparedModels} from './ResourcePreparedModels';
import {prepareResourceBank,resourceBankAddresses} from './ResourcePreparedBank';

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
}
export class ResourcePreparedAtlas {
 readonly owner:PreparedSurfaceOwner;
 readonly models:ResourcePreparedModels;
 readonly material:THREE.NodeMaterial;
 private closed=false;private refusal:string|undefined;
 private readonly quarantined=new Set<{dispose():void}>();
 private readonly contributions=new Set<unknown>();
 constructor(private readonly options:ResourcePreparedAtlasOptions){
  const context=options.context,paint=attribute('origamiPaint','vec4'),slot=paint.w.div(128).floor().mod(32),face=paint.w.div(4096).floor(),surface=attribute('surfaceUv','vec4'),wind=attribute('windRoot','vec3'),basis=attribute('windBasis','vec4'),color=attribute('color','vec3'),generic=slot.equal(31).and(wind.z.equal(0)),profile=paint.w.mod(128);
  const source=canonicalPreparedSurfaceSource({key:'resource-canonical-static78-v1',context,stroke:options.stroke,bodyOptions:options.bodyOptions,faceId:face,strokeUv:slot.lessThan(31).select(surface.xy,surface.zw),unitBodyProven:true,profileDomain:'static78-separable',assertCurrent:()=>{
   if(this.closed)throw Error('Resource prepared adapter closed');if(this.refusal)throw new PreparedSurfaceAdmissionRefusal(this.refusal);
   if(options.hasAnonymousTrees())throw new PreparedSurfaceAdmissionRefusal('Continuous anonymous tree metrics preserve complete Resource Source');
   if(options.hasNamedTrees()&&!options.catalog())throw new PreparedSurfaceAdmissionRefusal('Named tree bank unavailable; complete Resource Source retained');
   options.catalog()?.assertCurrent();
  }});
  this.owner=new PreparedSurfaceOwner({key:'resources-common:'+options.key,context,source:()=>source,changed:options.changed,maxCellPixels:64,returnCellPixels:56,minPageSize:2048,maxCpuBytes:256*1024*1024,maxRetainedGpuBytes:384*1024*1024,maxPeakGpuBytes:1024*1024*1024,
   // The external texture identity is a borrowed-lease dependency, not a
   // model/World cache key. A retired tree-only borrowed bank cannot be reused
   // merely because a newly allocated bank has identical pixels/settings.
   cacheIdentity:()=>{const catalog=options.catalog();return JSON.stringify(['resources-external-v1',options.hasNamedTrees(),options.hasAnonymousTrees(),catalog?.paintKey??null,catalog?.modelKeys??[],catalog?.texture.uuid??null]);},
   hasExternalDemand:options.hasNamedTrees,
   externalGpuBytes:()=>{const catalog=options.catalog();return(catalog?.pageCount??0)*2048*2048*4*(1+1/4+1/16+1/64);},
   externalCpuBytes:()=>this.models.stats().cpuBytes,
   compileAddresses:(_plan,_ids,data)=>resourceBankAddresses(data,options.catalog()),
   prepareGpu:(renderer,plan,_paint,assert,prepareDefault)=>prepareResourceBank(renderer,plan,options.catalog(),assert,prepareDefault,resource=>this.quarantined.add(resource)),
  });
  this.models=new ResourcePreparedModels(variant=>this.owner.registerVariant(variant));
  try{
   this.material=this.owner.addTarget({sourceMaterial:options.sourceMaterial,pastelTexture:options.pastel,pastelUv:attribute('uv','vec2'),pastelFromSample:sample=>color.mul(sample.rgb),tint:generic.select(profile.greaterThan(0).select(color.div(paint.xyz.max(vec3(.00001))),color),color.div(paint.xyz.max(vec3(.00001)))),
    address:book=>{const packed=Fn(()=>{
     const result=vec4(0,0,0,-1).toVar();If(context.surfaceEncoding.greaterThan(0),()=>{If(generic,()=>{const a=book.address(context,basis.x,face,surface.zw);result.assign(vec4(a.uv,a.bodyLayer,a.inkLayer));}).Else(()=>{const treeAt=book.node.element(int(0)).y.toInt(),row=book.node.element(treeAt.add(slot.toInt()));result.assign(vec4(surface.zw,row.x,-1));});});return result;
    })();return{uv:packed.xy,bodyLayer:packed.z,inkLayer:packed.w.max(0),format:packed.w.lessThan(0).select(float(0),float(1))};},
   });
  }catch(error){const errors=[error];try{this.models.dispose();}catch(cleanup){errors.push(cleanup);}try{this.owner.dispose();}catch(cleanup){errors.push(cleanup);}throw errors.length===1?error:new AggregateError(errors,'Resource prepared adapter construction cleanup');}
 }
 /** Existing merge writer only. Anonymous trees return -1 and retain Source. */
 capture(geometry:THREE.BufferGeometry,item:Placement,fullGrowthFactor:number):number{
  try{return this.models.capture(geometry,item,fullGrowthFactor);}catch(error){if(!(error instanceof PreparedSurfaceAdmissionRefusal))throw error;this.refusal=error.message;this.owner.invalidate();return-1;}
 }
 setContribution(key:unknown,ids:Iterable<number>):void{this.contributions.add(key);this.owner.setContribution(key,ids);}
 forgetContribution(key:unknown):void{if(this.contributions.delete(key))this.owner.setContribution(key,[]);}
 clear():void{if(this.closed)return;for(const key of this.contributions)this.owner.setContribution(key,[]);this.contributions.clear();this.refusal=undefined;this.owner.invalidate();}
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{this.owner.attachGpuRetirement(geometries);}
 status(){return{...this.owner.status(),canonical:this.models.stats(),quarantined:this.quarantined.size,refusal:this.refusal??null};}
 dispose():void{if(this.closed)return;const errors:unknown[]=[];try{this.owner.dispose();}catch(error){errors.push(error);}for(const resource of this.quarantined)try{resource.dispose();this.quarantined.delete(resource);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Resource prepared owner close quarantine');this.models.dispose();this.closed=true;}
}
