/** Source is an explicit representation fallback, never a hidden uniform
 * branch in the admitted material. */
import * as THREE from 'three/webgpu';
import {Fn,If,attribute,buffer,float,instanceColor,int,mix,texture,uint,uniform,uniformGroup,varying,vec3} from 'three/tsl';
import type {GraphicsStyleContext} from '../../../graphics-style';
import type {SurfaceBudgetInventory} from '../../../surfaces/SurfaceBudgetInventory';
import type {FaceStrokeData} from '../../../surfaces/FaceStrokeTable';
import {SURFACE_STROKE_FACE,SURFACE_STROKE_UV} from '../../../surfaces/NaturalSurfaceModels';
import {copyPastelTextureToArray} from '../../../surfaces/TextureSurface';
import {validatePreparedScalarInk} from '../../../surfaces/PreparedTextureSurface';
import {PlantAtlasAdmissionRefusal,planPlantAtlas,packPlantFaceBins,PLANT_PAGE_BYTES,type PlantAtlasPlan} from './PlantAtlasPlan';
import {preparePlantAtlasGpu,type PlantAtlasGpuResult} from './PlantAtlasGpu';
export interface PreparedPlantAtlasStage {commit():void;rollback():void;dispose():void}
type PaintLease=ReturnType<GraphicsStyleContext['prepareAtlasPaint']>;
export class PlantAtlasSurface {
 readonly plan:PlantAtlasPlan;readonly material:THREE.MeshLambertNodeMaterial;
 private readonly assets=uniformGroup('plantAtlasAssets',0,null);
 private readonly scalarInkEnabled=uniform(0).setName('plantScalarInkEnabled').setGroup(this.assets);
 private readonly scalarInkColor=uniform(new THREE.Vector3(0,0,0)).setName('plantScalarInkColor').setGroup(this.assets);
 private readonly pastel:THREE.DataArrayTexture;
 private readonly body:THREE.TextureNode;private readonly ink:THREE.TextureNode;
 private current:{key:string;value:PlantAtlasGpuResult}|undefined;
 private readonly owned=new Set<PlantAtlasGpuResult>();
 private budgetPreparing=false;private refused:string|undefined;private closed=false;private staging=false;private pendingStage=false;
 private readonly releaseSettings:()=>void;
 private fingerprint():string{const p=this.context.preferences;return JSON.stringify(['plant-BI16-source512-scalar-ink-v3',this.context.genericPaintSemanticKey(),p.edges,p.blackEdges,p.edgeWidth,p.strokeImperfection,p.contourImperfection]);}
 private eligible():boolean{return!this.context.reliefEnabled&&!this.context.wearEnabled;}
 constructor(private readonly context:GraphicsStyleContext,geometry:THREE.BufferGeometry,private readonly stroke:FaceStrokeData,private readonly sourceMaterial:THREE.NodeMaterial,pastel:THREE.DataTexture,private readonly changed:()=>void){
  this.plan=planPlantAtlas(geometry,{maxCpuBytes:32*1024*1024,maxPeakGpuBytes:416*1024*1024,existingLiveGpuBytes:43688});this.pastel=copyPastelTextureToArray(pastel);
  const rows=buffer(this.plan.addressRows,'vec4',this.plan.addressRows.length/4).setGroup(this.assets),lookup=rows as typeof rows&{element(index:THREE.Node<'int'>):THREE.Node<'vec4'>},face=attribute(SURFACE_STROKE_FACE,'float').toInt(),packed=attribute('plantAtlasBins','uvec2'),word=face.lessThan(8).select(packed.x,packed.y),bin=word.shiftRight(face.mod(8).toUint().mul(uint(4))).bitAnd(uint(15)).toInt(),base=lookup.element(face),row=int(this.plan.faces.length).add(face.mul(16).add(bin).mul(2)),tile=lookup.element(row),layer=lookup.element(row.add(1)).x,raw=attribute(SURFACE_STROKE_UV,'vec2');
  const physicalLayer=Fn(()=>{const actual=float(0).toVar('plantPhysicalBodyLayer');actual.assign(layer);If(context.surfaceEncoding.greaterThan(0).and(this.scalarInkEnabled.equal(2)),()=>{actual.mulAssign(.5);});return actual;})(),
   coords=varying(mix(raw,tile.xy.add(raw.sub(base.xy).mul(base.zw).mul(tile.zw)),context.surfaceEncoding),'v_plantAtlasUv'),depth=varying(physicalLayer.mul(context.surfaceEncoding),'v_plantAtlasLayer').setInterpolation('flat','first');
  const sampled=texture(this.pastel,coords);this.body=sampled.depth(depth);this.ink=sampled.depth(depth.add(1));
  this.material=new THREE.MeshLambertNodeMaterial({flatShading:true,vertexColors:false});this.material.positionNode=sourceMaterial.positionNode;this.syncLighting();
  this.material.colorNode=Fn(()=>{const result=vec3(0).toVar();If(context.surfaceEncoding.greaterThan(0),()=>{
   // Both filtered terms use IDENTICAL explicit gradients. Their nonnegative
   // footprint makes zero occupancy a proof that the matching Ink RGB is zero.
   const dx=coords.dFdx().toVar('plantAtlasDx'),dy=coords.dFdy().toVar('plantAtlasDy'),sampled=this.body.grad(dx,dy).toVar('plantAtlasBody');
   result.assign(sampled.rgb);
   If(this.scalarInkEnabled.greaterThan(0),()=>{
    result.addAssign(this.scalarInkColor.mul(sampled.a).div(instanceColor.max(vec3(.000001))));
   });
   If(this.scalarInkEnabled.equal(0).and(sampled.a.greaterThan(0)),()=>{
    // Three multiplies instanceColor after colorNode. Keep Source's exact
    // independently tinted body and untinted ink, including target previews.
    result.addAssign(this.ink.grad(dx,dy).rgb.div(instanceColor.max(vec3(.000001))));
   });
  }).Else(()=>{result.assign(this.body.rgb);});return result;})();
  this.releaseSettings=context.trackSharedPaintSettingsRefresh(()=>this.refresh());
 }
 syncLighting():void{
  this.material.outputNode=this.sourceMaterial.outputNode;this.material.maskNode=this.sourceMaterial.maskNode;this.material.maskShadowNode=this.sourceMaterial.maskShadowNode;
  this.material.castShadowPositionNode=this.sourceMaterial.castShadowPositionNode;this.material.receivedShadowPositionNode=this.sourceMaterial.receivedShadowPositionNode;
 }
 private admitted():boolean{return this.eligible()&&this.current?.key===this.fingerprint();}
 selectedMaterial():THREE.NodeMaterial{return this.eligible()&&(!this.context.origami||this.admitted())?this.material:this.sourceMaterial;}
 refresh():void{if(this.closed)return;const admitted=this.context.origami&&this.admitted(),value=admitted?this.current!.value:undefined,scalar=validatePreparedScalarInk(value?.scalarInk),map=value?.texture??this.pastel,
  color=scalar?.color??[0,0,0]as const,enabled=scalar?(scalar.compact?2:1):0,changed=this.scalarInkEnabled.value!==enabled||this.scalarInkColor.value.x!==color[0]||this.scalarInkColor.value.y!==color[1]||this.scalarInkColor.value.z!==color[2];
  // The flag follows the actual bound bank, not current preferences. A bank
  // whose alpha is a coefficient can never fall through to occupancy sampling.
  this.scalarInkColor.value.set(...color);this.scalarInkEnabled.value=enabled;if(changed)this.assets.needsUpdate=true;
  this.body.value=map;this.ink.value=map;this.changed();}
 bins(scale:readonly[number,number,number]):readonly[number,number]{return packPlantFaceBins(this.plan,scale);}
 needsPreparation():boolean{return!this.closed&&this.context.origami&&this.eligible()&&this.current?.key!==this.fingerprint()&&this.refused!==this.fingerprint();}
 private retire(value:PlantAtlasGpuResult):void{if(!this.owned.has(value))return;try{value.dispose();this.owned.delete(value);}catch(error){throw new AggregateError([error],'Plant atlas owner retirement quarantine');}}
 /** Publish before scene compile; retire only on commit. Old and new remain
  * owned throughout every await, rollback and renderer-drain boundary. */
 async stage(renderer:THREE.WebGPURenderer,source:PaintLease,assertExclusive:()=>void):Promise<PreparedPlantAtlasStage|undefined>{
  if(!this.needsPreparation())return;if(this.staging||this.pendingStage)throw Error('Plant atlas preparation already active');this.staging=true;
  const key=this.fingerprint(),old=this.current,assert=()=>{assertExclusive();source.assertCurrent();if(this.closed||key!==this.fingerprint()||!this.context.origami||!this.eligible())throw Error('Plant atlas preparation superseded');};let candidate:PlantAtlasGpuResult|undefined;
  try{
   assert();const plan=planPlantAtlas(this.plan.geometry,{maxCpuBytes:32*1024*1024,maxPeakGpuBytes:416*1024*1024,existingLiveGpuBytes:43688+[...this.owned].reduce((n,owner)=>n+owner.gpuBytes,0)});
   if(plan.addressRows.some((value,index)=>value!==this.plan.addressRows[index]))throw Error('Plant atlas layout changed after model construction');
   candidate=await this.budgetedPreparation(()=>preparePlantAtlasGpu(renderer,plan,source,this.stroke,{edgeWidth:this.context.preferences.edgeWidth,scalarInkEnabled:this.eligible()&&this.context.preferences.edges===0},assert));this.owned.add(candidate);
   if(candidate.scalarInk){const scalar=validatePreparedScalarInk(candidate.scalarInk)!;if(!this.eligible()||this.context.preferences.edges!==0||![0,1,2].every(i=>Object.is(scalar.color[i],Math.fround(source.paint.brushColorLinear[i]!))))throw Error('Plant scalar ink must use the current supported paint lease');if(scalar.compact&&((candidate.texture.image as{depth?:number}).depth!==plan.pages||candidate.gpuBytes!==plan.pages*PLANT_PAGE_BYTES))throw Error('Actual compact Plant bank must retain exactly one physical layer per logical page');}
   assert();
   const published=candidate;this.current={key,value:published};this.refresh();candidate=undefined;this.pendingStage=true;let settled=false,rolledBack=false,closed=false;
   const rollback=()=>{if(settled)throw Error('Committed plant atlas cannot be rolled back');if(rolledBack)return;this.current=old;this.refresh();rolledBack=true;};
   return{commit:()=>{if(settled||rolledBack)return;settled=true;this.pendingStage=false;this.refused=undefined;if(old)this.retire(old.value);},rollback,dispose:()=>{if(closed)return;closed=true;try{if(!settled){if(!rolledBack)rollback();this.retire(published);}}finally{this.pendingStage=false;}}};
  }catch(error){if(error instanceof PlantAtlasAdmissionRefusal){assert();this.refused=key;this.refresh();console.warn('Plant atlas retained exact direct Source after pre-GPU admission refusal',error);return;}throw error;}
  finally{this.staging=false;if(candidate){if(this.current?.value===candidate){this.current=old;this.refresh();}this.retire(candidate);}}
 }
 /** Fixed-size resource identities only, never atlas rows or a paint census. */
 /** All still-owned banks, including staged old/new and retirement failures. */
 surfaceBudget():SurfaceBudgetInventory{const textures=new Set<THREE.Texture>([this.pastel]);let cpuBytes=this.plan.addressRows.byteLength;for(const owner of this.owned){textures.add(owner.texture);cpuBytes+=owner.cpuBytes;}return{textures:[...textures],gpuBufferBytes:this.plan.addressRows.byteLength,cpuBytes,complete:!this.closed&&!this.budgetPreparing,scope:'All Plant owned/staged atlas textures and copied Pastel; addressRows nominal CPU/GPU bytes. Source geometry/canonical stroke and original Pastel are bridged separately; texture pixels measured once by caller. In-flight GPU is incomplete.'};}
 private async budgetedPreparation(make:()=>Promise<PlantAtlasGpuResult>):Promise<PlantAtlasGpuResult>{this.budgetPreparing=true;try{return await make();}finally{this.budgetPreparing=false;}}
 comparisonMetadata(){return{representation:this.selectedMaterial()===this.material?'atlas':'direct',ready:this.admitted(),pending:this.staging||this.pendingStage,preparedTexture:this.current?.value.texture.uuid??null,boundTexture:this.body.value.uuid,refused:!!this.refused};}
 stats(){return{pipeline:this.selectedMaterial()===this.material?(this.scalarInkEnabled.value?'scalar-ink-BI-atlas':'occupancy-gated-BI-atlas'):'direct-source',ready:this.admitted(),refused:!!this.refused,bins:16,pages:this.plan.pages,scalarInkEnabled:this.scalarInkEnabled.value,scalarInkColor:this.scalarInkEnabled.value?this.current?.value.scalarInk?.color:null,nominalRetainedGpuBytes:this.current?.value.gpuBytes??0,worstRestMetricError:this.plan.worstRestMetricError,windTextureAttachment:'bind-pose metric; Source vertex wind retained',quality:'Source512 with bounded approximate aspect bins; scalar ink needs Native residual/quality admission'};}
 dispose():void{if(this.closed)return;if(this.staging)throw Error('Wait for plant atlas preparation before disposal');this.closed=true;this.releaseSettings();const errors:unknown[]=[];for(const owner of [...this.owned])try{this.retire(owner);}catch(error){errors.push(error);}for(const owner of [this.material,this.pastel])try{owner.dispose();}catch(error){errors.push(error);}this.current=undefined;if(errors.length)throw new AggregateError(errors,'Plant atlas final ownership cleanup');}
}
