import {setStaticSceneSource435} from './StaticSceneCompiler435';
import { appendFlora,floraSize,hydroponicFloraHeight,isClusterPlantSpecies,isMedicinalPlant,isResidentCrop } from './flora-presentation';
import { plantLeafless } from '../sim/plant-life';
import { stoneColor } from './stone-palette';
import { harvestable } from '../sim/plants';
import { workProgress } from '../sim/work-progress';
import * as THREE from 'three/webgpu';
import { Fn, If, attribute, positionLocal, renderGroup, sin, texture, uniform, uv, vec3 } from 'three/tsl';
import type { AnimationDetail, AnimationSampleHandle } from './AnimationDetail';
import { NaturalAnimationCache } from './natural-animation-cache';
import { TICKS_PER_SECOND, type World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { clearGroup } from './primitives';
import type { Placement } from './primitives';
import { mergedInstances,noise,resourceBrushData,type ResourceBrushData,type ResourceRange,type ResourceRangeData } from './StaticGeometry';
import type { NaturalPresentationChange } from './NaturalResourcePresentation';
import type {NaturalAppearanceReader} from './natural-appearance-pass';
import {readSceneResourceFrame,type SceneResourceFrame} from './scene-resource-index';
import {ResourceTargetTint} from './resource-target-tint';
import {ResourceRangeBounds} from './resource-range-bounds';
import {currentGraphicsStyle,type GraphicsStyleContext} from './graphics-style';
import {createPhysicalEdgeWearGeometry} from './origami/reference-edges';
import {ReferenceFloraLibrary} from './origami/resource-flora';
import {GENERIC_REFERENCE_PROFILE} from './origami/reference-profiles';
import {isTreeSpecies} from './origami/baked/trees/recipe';
import type {TreeAssetCatalog,TreeSpecies} from './origami/baked/trees/types';
import {TreeModels,treeModelVariant,type TreeModel} from './models/TreeModels';
import {FixedTreeCohorts,type FixedTreeCohortPlan} from './models/FixedTreeCohort';
import type {TreeBakeDemand} from './origami/TreeBakeOwner';
import {FixedTreeTextureSurface,fixedTreePaintKey} from './surfaces/FixedTreeTextureSurface';
import {copyPastelTextureToArray,createTextureSurface,validateTextureSurfaceAssets,TEXTURE_SURFACE_SLOT_COUNT,type TextureSurfaceAssets} from './surfaces/TextureSurface';
import {createStylizedSurfaceTexture} from './stylized-surfaces';
import {createResourceSurfaceModels} from './models/ResourceSurfaceModels';
import {applySharedPaintSurface,type SharedPaintSurfaceOptions} from './surfaces/SharedPaintSurface';
import {naturalStroke} from './surfaces/NaturalSurfaceModels';
import {LEGACY_TREE_PAINT_TABLE} from './origami/baked/trees/palette';
import {ResourcePreparedAtlas} from './surfaces/ResourcePreparedAtlas';

const resourceIdentity=(world:World,resource:World['resources'][number]):string=>{
  const support=hydroponicFloraHeight(world,resource);
  return `${resource.kind}:${resource.x}:${resource.z}:${resource.stone??''}:${resource.species??''}${support?`:support=${support}`:''}`;
};
const rangeResourceId=(id:number):number=>id<0?Math.floor(-id/2):id;
const CHOP_RECOIL_SECONDS = .55;
type ResourceObject=THREE.Mesh|THREE.LineSegments;
type TreePart = { mesh:ResourceObject; range:ResourceRange; positions:Float32Array; normals:Float32Array; expansions?:Float32Array; brush?:ResourceBrushData;upload:{start:number;count:number} };
type TreeHit = { at:number; x:number; z:number; axisX:number; axisZ:number; angle:number; sample?:AnimationSampleHandle; pendingPose?:boolean };
export interface TreeSurfaceSource {readonly pastelTexture:THREE.DataTexture;readonly configure:(material:THREE.NodeMaterial)=>void}
function disposeTreeResources(resources:readonly{dispose():void}[],message:string):void{const errors:unknown[]=[];for(const resource of resources)try{resource.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,message);}
export interface TreeAssetPublication {commit():void;rollback():void}
export interface PreparedTreeCatalogStage {readonly warmup:readonly THREE.Mesh[];publish():TreeAssetPublication;dispose():void}

/** Creases of the existing fallback primitives, with their original placements
 * and visibility/growth identities. Exact source recipes supply separate lines. */
export function resourceFallbackLineParts(parts:readonly {geometry:THREE.BufferGeometry;items:Placement[]}[]):{geometry:THREE.BufferGeometry;items:Placement[]}[] {
  return parts.filter(part=>part.items.length>0).map(part=>{
    const geometry=new THREE.EdgesGeometry(part.geometry,22),count=geometry.getAttribute('position').count;
    const normals=new Float32Array(count*3);for(let i=1;i<normals.length;i+=3)normals[i]=1;
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2),2));
    return {geometry,items:part.items};
  });
}

/** A short strike and damped return about the tree's base, in confirmed scene time. */
export function chopRecoilAngle(age:number):number {
  if(age<0||age>=CHOP_RECOIL_SECONDS)return 0;
  const phase=age/CHOP_RECOIL_SECONDS;
  return .20*Math.sin(phase*Math.PI*2.35)*Math.exp(-phase*3.5)*(1-phase);
}

/** Removal compacts only the existing index buffer; vertices, mesh and material
 * stay resident. Original ranges also permit checkpoint restoration of an ID.
 * Addition/movement of a resource rebuilds only that spatial chunk.
 */
function retainResources(group: THREE.Group, alive: Set<number>): void {
  for (const object of group.children) {
    const mesh = object as THREE.Mesh;
    const data=mesh.userData.resourceRanges as ResourceRangeData|undefined;
    if (!data) continue;
    const index = mesh.geometry.index!; let count = 0;
    for (const range of data.ranges) if (alive.has(range.id)) {
      (index.array as Uint16Array | Uint32Array).set(data.original.subarray(range.start, range.start + range.count), count); count += range.count;
    }
    index.needsUpdate = true; mesh.geometry.setDrawRange(0, count);
    // The original sphere remains a conservative bound after removal.
  }
}

/** Reapply a resource's visible size from the immutable merged positions.
 * This avoids cumulative float drift and keeps index-mask ranges stable. */
function resizeResources(world:World,group:THREE.Group,resources:ReadonlyMap<number,World['resources'][number]>,originalSizes:Map<number,number>,currentSizes:Map<number,number>,nextSizes:Map<number,number>,bounds:WeakMap<THREE.BufferGeometry,ResourceRangeBounds>,graphics?:GraphicsStyleContext):void {
  const changed=new Set<number>();
  for(const [id,size] of nextSizes)if(currentSizes.get(id)!==size&&originalSizes.has(id))changed.add(id);
  if(!changed.size)return;
  for(const object of group.children) {
    const mesh=object as THREE.Mesh,data=mesh.userData.resourceRanges as ResourceRangeData|undefined;
    if(!data)continue;
    const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;let touched=false;
    const brush=resourceBrushData(mesh.geometry);
    const retained=bounds.get(mesh.geometry);let bounded=!!retained;
    for(let rangeIndex=0;rangeIndex<data.ranges.length;rangeIndex++) {
      const range=data.ranges[rangeIndex]!;
      const id=rangeResourceId(range.id);if(!changed.has(id))continue;
      const resource=resources.get(id),initial=originalSizes.get(id),target=nextSizes.get(id);if(!resource||initial===undefined||target===undefined)continue;
      const ratio=target/initial,support=hydroponicFloraHeight(world,resource);
      const expansion=mesh.geometry.getAttribute('origamiWearExpand') as THREE.BufferAttribute|undefined;
      for(let vertex=range.vertexStart;vertex<range.vertexStart+range.vertexCount;vertex++){
        const offset=vertex*3;
        position.array[offset]=resource.x+(data.originalPositions[offset]!-resource.x)*ratio;
        position.array[offset+1]=support?support+(data.originalPositions[offset+1]!-support)*ratio:data.originalPositions[offset+1]!*ratio;
        position.array[offset+2]=resource.z+(data.originalPositions[offset+2]!-resource.z)*ratio;
        if(expansion&&data.originalWearExpandDirections){expansion.array[offset]=data.originalWearExpandDirections[offset]!*ratio;expansion.array[offset+1]=data.originalWearExpandDirections[offset+1]!*ratio;expansion.array[offset+2]=data.originalWearExpandDirections[offset+2]!*ratio;}
        if(brush&&data.originalBrush){
          const original=data.originalBrush;
          brush.base[offset]=resource.x+(original.base[offset]!-resource.x)*ratio;brush.base[offset+1]=support?support+(original.base[offset+1]!-support)*ratio:original.base[offset+1]!*ratio;brush.base[offset+2]=resource.z+(original.base[offset+2]!-resource.z)*ratio;
          for(const key of ['width','rough'] as const)for(let component=0;component<3;component++)brush[key][offset+component]=original[key][offset+component]!*ratio;
        }
      }
      if(brush)graphics?.refreshBrushGeometry(mesh.geometry,range.vertexStart,range.vertexCount);
      if(retained&&!retained.update(rangeIndex,position.array))bounded=false;
      position.addUpdateRange(range.vertexStart*3,range.vertexCount*3);
      if(expansion)expansion.addUpdateRange(range.vertexStart*3,range.vertexCount*3);
      touched=true;
    }
    if(touched){
      position.needsUpdate=true;
      const expansion=mesh.geometry.getAttribute('origamiWearExpand');if(expansion)expansion.needsUpdate=true;
      const padding=(data.ranges.some(range=>resources.get(rangeResourceId(range.id))?.kind==='tree')?4:0)+((mesh.userData.referenceCompanion==='wear'||Boolean(brush))?0.5:0);
      if(bounded){
        mesh.geometry.boundingSphere??=new THREE.Sphere();
        retained!.writeSphere(mesh.geometry.boundingSphere,padding);
      }else{
        bounds.delete(mesh.geometry);mesh.geometry.computeBoundingSphere();
        if(padding&&mesh.geometry.boundingSphere)mesh.geometry.boundingSphere.radius+=padding;
      }
      if(brush&&mesh.geometry.boundingSphere)mesh.geometry.userData.referenceBrushConservativeSphere=mesh.geometry.boundingSphere.clone();
    }
  }
  for(const id of changed)currentSizes.set(id,nextSizes.get(id)!);
}

function visibleResourceKeys(world:World,r:World['resources'][number],appearance?:NaturalAppearanceReader):number[]{
  if(r.kind!=='berries'&&!r.species&&!isMedicinalPlant(r))return [r.id];
  return [r.id,...((appearance?.read(r).leafless??plantLeafless(world,r))?[]:[-r.id*2]),...((appearance?appearance.harvestable(r):harvestable(world,r))?[-r.id*2-1]:[])];
}

export class ResourceLayer {
  private readonly graphicsStyle=currentGraphicsStyle();
  private get treeTextureCompatible():boolean{return !this.graphicsStyle?.reliefEnabled&&!this.graphicsStyle?.wearEnabled;}
  private readonly treeModels=new TreeModels();
  private readonly treeCohorts=new FixedTreeCohorts(this.treeModels);
  private readonly referenceFlora=new ReferenceFloraLibrary(false,false);
  private readonly surfaceModels=createResourceSurfaceModels(this.treeModels,this.referenceFlora);
  private readonly bodyTextured:THREE.NodeMaterial;
  private readonly preparedResources:ResourcePreparedAtlas|undefined;
  private get bodyPlain():THREE.NodeMaterial{return this.staticMaterial;}
  private wearPlain:THREE.NodeMaterial|undefined;
  private wearWind:THREE.NodeMaterial|undefined;
  private readonly treeBankReady=uniform(0);
  private releaseSurfaceRefresh:()=>void=()=>{};
  private makeWindPosition!:(base:THREE.Node<'vec3'>)=>THREE.Node<'vec3'>;
  private wearFlora:ReferenceFloraLibrary|undefined;
  private wearTemplates:Map<THREE.BufferGeometry,THREE.BufferGeometry>|undefined;
  compiledMaterials435():readonly THREE.NodeMaterial[]{return[...new Set([this.bodyPlain,this.bodyTextured,this.windTextured,this.windPlain,this.treeSurface.material])];}
  compiledAttributeChanged435:((attribute:THREE.BufferAttribute,start:number,count:number)=>void)|undefined;
  compiledMaterialsChanged435:(()=>void)|undefined;
  private readonly targetTint=new ResourceTargetTint((attribute,start,count)=>this.compiledAttributeChanged435?.(attribute,start,count));
  private readonly rangeBounds=new WeakMap<THREE.BufferGeometry,ResourceRangeBounds>();
  private targetPreviewIds=new Set<number>();
  private readonly chunks=new Map<string,{signature:string;group:THREE.Group;identities:Map<number,string>;originalSizes:Map<number,number>;currentSizes:Map<number,number>;visibleKeys:Set<number>;treeIds:number[];treeModels:readonly TreeModel[];treeCount:number;anonymousTreeCount:number}>();
  private readonly resourceChunks=new Map<number,string>();
  private readonly treeParts=new Map<number,TreePart[]>();
  private readonly treeHits=new Map<number,TreeHit>();
  private readonly treeCells=new Map<number,number>();
  private treeCellsPending:World|undefined;
  private foliageVisible = true;
  private texturesEnabled = true;
  private readonly windTick=uniform(0).setGroup(renderGroup);
  private readonly windStrength=uniform(0).setGroup(renderGroup);
  private readonly windDirection=uniform(new THREE.Vector2(1,0)).setGroup(renderGroup);
  private readonly middleWind=new NaturalAnimationCache();
  private readonly windPlain:THREE.NodeMaterial;
  private readonly windTextured:THREE.NodeMaterial;
  private readonly growing = new Map<number,World['resources'][number]>();
  private treeCatalog:TreeAssetCatalog|undefined;
  private readonly treeSurface:ReturnType<typeof createTextureSurface>;
  private readonly fixedTreeSurface:FixedTreeTextureSurface|undefined;
  private treeDirectFallback:{key:string;paintKey:string;reason:string}|undefined;
  private fixedTreeAtlasAvailable=true;
  private pendingFixedCohort:{plan:FixedTreeCohortPlan;applied:boolean}|undefined;
  private applyingFixedWorld:FixedTreeCohortPlan|undefined;
  private readonly pastelTreeAssets:TextureSurfaceAssets;
  private readonly fallbackPastel:THREE.DataTexture|undefined;
  private readonly sharedTreeMeshes=new WeakSet<THREE.Mesh>();
  private readonly sharedTreeCanopies=new WeakSet<THREE.Mesh>();
  private treeRecipeEpoch=0;
  private treeDemandEpoch=0;
  /** Updated only by actual chunk/preview writers; never by RAF or a read. */
  private graphicsComparisonRevision=0;
  /* Bounded chunk rebuilds. A full chunk rebuild (merge + optional wear) costs
   * tens of ms; rebuilding every affected chunk in one publication produced
   * 70-290 ms frames on forest maps. With a finite budget, chunks beyond it
   * keep their previous geometry and are rebuilt by later updates or by
   * flushDeferredChunks() on following frames. Infinity keeps the original
   * synchronous behavior (tests, paused views). */
  private readonly deferredChunks=new Set<string>();
  private chunkRebuildBudgetMs=Infinity;
  setChunkRebuildBudget(ms:number):void{this.chunkRebuildBudgetMs=ms;}
  get hasDeferredChunks():boolean{return this.deferredChunks.size>0;}
  /** Rebuild deferred chunks within the current budget; true if geometry changed. */
  flushDeferredChunks():boolean{
    if(!this.deferredChunks.size)return false;
    const cached=this.cachedTreeUpdate;if(!cached||this.disposed){this.deferredChunks.clear();return false;}
    const before=this.graphicsComparisonRevision;
    this.updateWorldChunks(cached.world,false,new Map(),undefined,cached.appearance);
    return this.graphicsComparisonRevision!==before;
  }
  private treeSpecies:readonly TreeSpecies[]=Object.freeze([]);
  private treeSpeciesKey='[]';
  private demandedTreeModels:readonly TreeModel[]=Object.freeze([]);
  private anonymousTreeCount=0;
  private cachedTreeUpdate:{world:World;appearance:NaturalAppearanceReader|undefined}|undefined;
  private disposed=false;
  updateGrowth(world: World): void {
    for(const plant of this.growing.values())if(harvestable(world,plant)){this.update(world,false);break;}
  }
  constructor(readonly group: THREE.Group, private readonly staticMaterial: THREE.NodeMaterial, private readonly texturedMaterial: THREE.NodeMaterial=staticMaterial,private readonly detail?:AnimationDetail,treeSource?:TreeSurfaceSource) {
    const originalMap=(Reflect.get(texturedMaterial,'map') as THREE.DataTexture|undefined)??treeSource?.pastelTexture;
    this.fallbackPastel=originalMap?undefined:createStylizedSurfaceTexture('vegetation');
    const pastel=originalMap??this.fallbackPastel!,paint=attribute('origamiPaint','vec4'),profile=paint.w.mod(128),surface=attribute('surfaceUv','vec4'),slot=paint.w.div(128).floor().mod(32),face=paint.w.div(4096).floor();
    const options:SharedPaintSurfaceOptions={context:this.graphicsStyle,base:attribute('color','vec3'),pastel:attribute('color','vec3').mul(texture(pastel,uv()).rgb),faceUv:surface.xy,profile,includeGeneric:true,pigmentDomain:'game-static78',
      gouacheTransform:body=>body.mul(profile.greaterThan(0).select(attribute('color','vec3').div(paint.xyz.max(vec3(.00001))),vec3(1))),
      stroke:naturalStroke(this.graphicsStyle,this.surfaceModels.stroke,face,slot.lessThan(31).select(surface.xy,surface.zw)),
      coverage:(raw,faceProfile,probe)=>this.surfaceModels.coverage(this.graphicsStyle!,raw,faceProfile,face,surface.zw,probe)};
    // One resident textured Lambert owns generic, continuous and named tree
    // surfaces. Texture addressing is per-face data, never a material family.
    const makeWindPosition=(base:THREE.Node<'vec3'>)=>Fn(()=>{
      const root=attribute('windRoot','vec3');
      const deform=(tick:THREE.Node<'float'>)=>{
      const height=base.y.div(4).clamp(0,1);
      const wave=sin(tick.mul(2*Math.PI/48).add(root.x.mul(.47)).add(root.y.mul(.31)));
      const bend=height.mul(height).mul(root.z).mul(this.windStrength).mul(wave.mul(.43).add(.63));
      const leaves=root.z.greaterThan(.8).select(1,0);
      const flutter=sin(tick.mul(2*Math.PI/15).add(base.x.mul(1.3)).add(base.z.mul(1.7)))
        .mul(leaves).mul(height).mul(this.windStrength).mul(.11);
      return base.add(vec3(
        this.windDirection.x.mul(bend).sub(this.windDirection.y.mul(flutter)),
        0,
        this.windDirection.y.mul(bend).add(this.windDirection.x.mul(flutter)),
      ));
      };
      if(!detail)return deform(this.windTick);
      const level=detail.level(vec3(root.x,0,root.y)).toVar(),position=base.toVar();
      If(level.equal(0),()=>{position.assign(deform(this.windTick));})
        .ElseIf(level.equal(1),()=>{
          // Spatial sine/cosine bases are built with the resident geometry.
          // Middle vertices do no temporal trigonometry or phase quantisation.
          const basis=attribute('windBasis','vec4'),wind=this.middleWind.wind;
          const wave=this.middleWind.phaseA.x.mul(basis.y).add(this.middleWind.phaseA.y.mul(basis.x));
          const flutterWave=this.middleWind.phaseB.x.mul(basis.w).add(this.middleWind.phaseB.y.mul(basis.z));
          const height=base.y.div(4).clamp(0,1);
          const bend=height.mul(height).mul(root.z).mul(wind.z).mul(wave.mul(.43).add(.63));
          const flutter=flutterWave.mul(root.z.greaterThan(.8).select(1,0)).mul(height).mul(wind.z).mul(.11);
          position.assign(base.add(vec3(wind.x.mul(bend).sub(wind.y.mul(flutter)),0,wind.y.mul(bend).add(wind.x.mul(flutter)))));
        });
      return position;
    })();
    this.makeWindPosition=makeWindPosition;
    const windPosition=makeWindPosition(positionLocal);
    // Generic resources carry zero-weight wind records so their ordinary
    // attribute layout can share the exact tree material and435 pages.
    // Texture ownership is separate from the model library and from materials.
    // Old isolated callers obtain the same tiny Source map, never a flat tint.
    const pastelArray=copyPastelTextureToArray(pastel);
    this.pastelTreeAssets={texture:pastelArray,uvAddress:'raw',slots:Object.freeze(Array.from({length:TEXTURE_SURFACE_SLOT_COUNT},()=>Object.freeze({layer:0,paletteBaked:false})))};
    const surfaceOptions={positionNode:windPosition,chartUv:vec3(surface.zw,slot),castShadowPositionNode:texturedMaterial.castShadowPositionNode,receivedShadowPositionNode:texturedMaterial.receivedShadowPositionNode,configure:treeSource?.configure};
    try{this.fixedTreeSurface=this.graphicsStyle?new FixedTreeTextureSurface(this.graphicsStyle,this.pastelTreeAssets,surfaceOptions):undefined;this.treeSurface=this.fixedTreeSurface?.surface??createTextureSurface(this.pastelTreeAssets,surfaceOptions);}catch(error){pastelArray.dispose();throw error;}
    // Fixed named trees keep the final one-fetch graph from their first Pastel
    // draw. Continuous/generic resources own a separate complete Source graph.
    const direct=new THREE.MeshLambertNodeMaterial({flatShading:true,vertexColors:false});direct.userData.rendererOwned=true;direct.positionNode=windPosition;direct.castShadowPositionNode=texturedMaterial.castShadowPositionNode;direct.receivedShadowPositionNode=texturedMaterial.receivedShadowPositionNode;treeSource?.configure(direct);
    this.bodyTextured=direct;this.windPlain=this.treeSurface.plainMaterial;
    applySharedPaintSurface(direct,options);
    this.preparedResources=this.graphicsStyle?new ResourcePreparedAtlas({key:group.uuid,context:this.graphicsStyle,sourceMaterial:direct,pastel,stroke:this.surfaceModels.stroke,bodyOptions:()=>options,catalog:()=>this.treeCatalog,hasNamedTrees:()=>this.demandedTreeModels.length>0,hasAnonymousTrees:()=>this.anonymousTreeCount>0,changed:()=>{},patchAttribute:(attribute,start,count)=>this.compiledAttributeChanged435?.(attribute,start,count),sourceCoverageCpuBytes:()=>this.surfaceModels.coverageCpuBytes,sourceCoverageGpuBytes:()=>this.surfaceModels.coverageGpuBytes,sourceCoverageTexture:()=>this.surfaceModels.legacyCoverage.texture}):undefined;
    this.windTextured=this.preparedResources?.material??direct;
    const refresh=()=>{this.refreshOptionalWear();this.refreshFixedTreeMaterials();};
    refresh();this.releaseSurfaceRefresh=this.graphicsStyle?.trackSharedSurfaceRefresh(refresh)??(()=>{});
  }

  /** Optional wear owns only its companion geometry. Body models and material
   * identities survive every feature boundary, including strict zero. */
  private refreshOptionalWear():void{
    for(const [id,parts]of this.treeParts)this.treeParts.set(id,parts.filter(part=>!part.mesh.userData.referenceCompanion));
    for(const chunk of this.chunks.values())for(const object of [...chunk.group.children])if(object.userData.referenceCompanion==='wear'){
      object.userData.origamiEdgeCleanup?.();chunk.group.remove(object);(object as THREE.Mesh).geometry.dispose();
    }
    this.wearPlain?.dispose();this.wearWind?.dispose();this.wearPlain=this.wearWind=undefined;
    this.wearFlora?.dispose();this.wearFlora=undefined;
    if(this.wearTemplates)for(const geometry of this.wearTemplates.values())geometry.dispose();this.wearTemplates=undefined;
    const context=this.graphicsStyle;
    if(context?.wearEnabled){
      this.wearFlora=new ReferenceFloraLibrary(true,true);this.wearTemplates=new Map();
      const position=positionLocal.add(attribute('origamiWearExpand','vec3').mul(context.contourSpan));
      this.wearPlain=context.createWearMaterial(position,uv());this.wearWind=context.createWearMaterial(this.makeWindPosition(position),uv());
      this.wearPlain.userData.rendererOwned=this.wearWind.userData.rendererOwned=true;
      const world=this.cachedTreeUpdate?.world;
      if(world){let byId:Map<number,World['resources'][number]>|undefined;const resourcesById=()=>byId??=new Map(world.resources.map(r=>[r.id,r]));
        for(const chunk of this.chunks.values())this.appendOptionalWear(chunk.group,world,chunk.originalSizes,chunk.currentSizes,chunk.currentSizes,true,resourcesById);}
    }
    this.refreshTreeCensus();this.compiledMaterialsChanged435?.();
  }
  /** `resourcesById` is the same complete id map for this World; callers that
   * rebuild many chunks in one pass share it instead of re-indexing every chunk. */
  private appendOptionalWear(group:THREE.Group,world:World,initialSizes:Map<number,number>,_currentSizes:Map<number,number>,targetSizes:Map<number,number>,registerTrees=true,resourcesById?:()=>ReadonlyMap<number,World['resources'][number]>):void{
    if(!this.wearPlain||!this.graphicsStyle)return;
    const staging=new THREE.Group(),resources=resourcesById?.()??new Map(world.resources.map(r=>[r.id,r]));
    const templates:{geometry:THREE.BufferGeometry;items:Placement[];canopy:boolean}[]=[],treeParts=new Map<THREE.BufferGeometry,{geometry:THREE.BufferGeometry;items:Placement[];canopy:boolean}>(),flora=this.wearFlora!.createBatch();
    // Discover optional wear only while enabled. At zero there is no wear
    // placement census, template cache, reference library or retained metadata.
    for(const [id,size]of initialSizes){const resource=resources.get(id);if(!resource)continue;const turn=noise(resource.x,resource.z,77)*Math.PI*2;
      if(resource.kind!=='tree'){flora.append(world,resource,turn,size);continue;}
      if(resource.species!==undefined&&!isTreeSpecies(resource.species))throw Error('Unsupported actual tree model species');
      const model=this.treeModels.get(resource.species,treeModelVariant(world));
      for(const {part,item}of model.place(resource,turn,size)??[]){
        let geometry=this.wearTemplates!.get(part.primitive);
        if(!geometry){const source=part.primitive.index?part.primitive.toNonIndexed():part.primitive.clone();let edges:THREE.EdgesGeometry|undefined;try{edges=new THREE.EdgesGeometry(source);const generated=createPhysicalEdgeWearGeometry(source,edges,0);if(!generated)throw Error('Resource physical-wear source has no edges');generated.setAttribute('origamiWearExpand',new THREE.BufferAttribute(generated.userData.expandDirArray as Float32Array,3));geometry=generated;this.wearTemplates!.set(part.primitive,geometry);}finally{edges?.dispose();source.dispose();}}
        let batch=treeParts.get(geometry);if(!batch){batch={geometry,items:[],canopy:part.canopy};treeParts.set(geometry,batch);}batch.items.push(item);
      }
    }
    templates.push(...treeParts.values());
    for(const canopy of [false,true]){
      const parts=[...templates.filter(p=>p.canopy===canopy&&p.items.length).map(p=>({geometry:p.geometry.clone(),items:p.items})),...flora.parts(canopy,'wear')];
      const mesh=mergedInstances(staging,parts,this.wearPlain,false,true,true);if(!mesh)continue;
      mesh.userData.referenceCompanion='wear';mesh.receiveShadow=true;mesh.userData.origamiOwnerVisible=!canopy||this.foliageVisible;mesh.userData.origamiTexturesEnabled=this.texturesEnabled;
      if(canopy)mesh.name='tree-canopy';mesh.userData.origamiEdgeCleanup=this.graphicsStyle.trackEdgeObject(mesh,'wear');
    }
    resizeResources(world,staging,resources,initialSizes,new Map(initialSizes),targetSizes,this.rangeBounds,this.graphicsStyle);
    const alive=new Set([...targetSizes.keys()].flatMap(id=>{const r=resources.get(id);return r?visibleResourceKeys(world,r,this.cachedTreeUpdate?.appearance):[];}));retainResources(staging,alive);
    for(const object of [...staging.children]){
      const mesh=object as THREE.Mesh,data=mesh.userData.resourceRanges as ResourceRangeData,position=mesh.geometry.getAttribute('position'),windRoot=new Float32Array(position.count*3),windBasis=new Float32Array(position.count*4),positions=Float32Array.from(position.array),normals=new Float32Array(mesh.geometry.getAttribute('normal').array),expand=mesh.geometry.getAttribute('origamiWearExpand'),expansions=new Float32Array(expand.array);
      for(const range of data.ranges){const id=rangeResourceId(range.id),resource=resources.get(id);if(resource?.kind!=='tree')continue;
        const weight=resource.species==='saguaro'?.14:mesh.name==='tree-canopy'?1:.62;
        for(let vertex=range.vertexStart;vertex<range.vertexStart+range.vertexCount;vertex++){windRoot[vertex*3]=resource.x;windRoot[vertex*3+1]=resource.z;windRoot[vertex*3+2]=weight;}
        if(registerTrees){const parts=this.treeParts.get(id)??[];parts.push({mesh,range,positions,normals,expansions,upload:{start:range.vertexStart*3,count:range.vertexCount*3}});this.treeParts.set(id,parts);const hit=this.treeHits.get(id);if(hit)hit.angle=NaN;}
      }
      for(let vertex=0;vertex<position.count;vertex++){const rootPhase=windRoot[vertex*3]!*.47+windRoot[vertex*3+1]!*.31,flutterPhase=position.getX(vertex)*1.3+position.getZ(vertex)*1.7;windBasis[vertex*4]=Math.sin(rootPhase);windBasis[vertex*4+1]=Math.cos(rootPhase);windBasis[vertex*4+2]=Math.sin(flutterPhase);windBasis[vertex*4+3]=Math.cos(flutterPhase);}
      mesh.geometry.setAttribute('windRoot',new THREE.BufferAttribute(windRoot,3));mesh.geometry.setAttribute('windBasis',new THREE.BufferAttribute(windBasis,4));mesh.material=this.wearWind!;
      if(mesh.geometry.boundingSphere)mesh.geometry.boundingSphere.radius+=4.5;group.add(mesh);
    }
  }
  private refreshTreeCensus():void{
    this.anonymousTreeCount=0;for(const chunk of this.chunks.values())this.anonymousTreeCount+=chunk.anonymousTreeCount;
    const models=new Map<string,TreeModel>();for(const chunk of this.chunks.values())for(const model of chunk.treeModels)models.set(model.key,model);
    const next=[...models.values()].sort((a,b)=>a.surfaceSlot-b.surfaceSlot),key=JSON.stringify(next.map(model=>model.key));
    if(key!==this.treeSpeciesKey){this.demandedTreeModels=Object.freeze(next);this.treeSpecies=Object.freeze([...new Set(next.flatMap(model=>model.species?[model.species]:[]))].sort());this.treeSpeciesKey=key;this.treeDemandEpoch++;}
    // The common bank must cover the complete drawn cohort. Never accidentally
    // sample a different species for a newly introduced stable model slot.
    this.treeBankReady.value=this.treeTextureCompatible&&!!this.treeCatalog&&next.every(model=>this.treeCatalog!.modelKeys.includes(model.key))?1:0;
  }
  treeBakeDemand(){const epoch=this.treeDemandEpoch;return{key:this.treeSpeciesKey,species:this.treeSpecies,models:this.treeTextureCompatible?this.demandedTreeModels:Object.freeze([] as TreeModel[]),isCurrent:()=>!this.disposed&&this.treeDemandEpoch===epoch};}
  bakedTreeStatus(){
    const pending=this.demandedTreeModels.filter(model=>!this.treeCatalog?.modelKeys.includes(model.key));let trees=0;for(const chunk of this.chunks.values())trees+=chunk.treeCount;
    const anonymous=[...this.chunks.values()].reduce((n,chunk)=>n+chunk.anonymousTreeCount,0),ready=this.treeBankReady.value?trees-anonymous:0,fallback=trees-ready;
    return{revision:this.treeCatalog?.revision??null,species:this.treeSpecies,pending:pending.map(model=>model.species??'anonymous'),ready,fallback,total:trees,texturePages:this.treeCatalog?.pageCount??0,geometryVariant:this.cachedTreeUpdate?.world.site?'legacy-broadleaf':'legacy-conical',fallbackReason:!fallback?null:!this.treeTextureCompatible?'optional-effects-use-source-face-paint':anonymous===fallback?'continuous-proportions-use-source-face-paint':'source-face-paint-until-bank-ready',scope:'Common models and Lambert surfaces; direct opaque face paint preserves continuously varied proportions and is the complete Gouache fallback.'};
  }
  /** Existing epochs and owners only: no frame census or geometry hashing. */
  graphicsComparisonMetadata(){this.treeCatalog?.assertCurrent();return{revision:this.graphicsComparisonRevision,recipeEpoch:this.treeRecipeEpoch,demandEpoch:this.treeDemandEpoch,speciesKey:this.treeSpeciesKey,catalogRevision:this.treeCatalog?.revision??null,textures:this.texturesEnabled,foliage:this.foliageVisible,materials:[...new Set([this.treeSurface.material.uuid,this.treeSurface.plainMaterial.uuid,this.bodyTextured.uuid,this.windTextured.uuid])]};}
  preparedResourceStatus(){return this.preparedResources?.status();}
  attachPreparedResourceGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{const actual=new Set(geometries);this.group.traverse(object=>{if(object instanceof THREE.Mesh)actual.add(object.geometry);});this.preparedResources?.attachGpuRetirement(actual);}
  private treeMaterial():THREE.NodeMaterial{return!this.texturesEnabled?this.treeSurface.plainMaterial:this.preparedResources?.material??(!this.fixedTreeAtlasAvailable||!this.treeTextureCompatible||this.treeDirectFallback?this.bodyTextured:this.treeSurface.material);}
  setFixedTreeAtlasAvailable(available:boolean):void{if(this.fixedTreeAtlasAvailable===available)return;this.fixedTreeAtlasAvailable=available;this.refreshFixedTreeMaterials();}
  private refreshFixedTreeMaterials():void{let changed=false;const material=this.treeMaterial();for(const chunk of this.chunks.values())for(const object of chunk.group.children)if(object instanceof THREE.Mesh&&this.sharedTreeMeshes.has(object)&&object.material!==material){object.material=material;changed=true;}if(changed)this.compiledMaterialsChanged435?.();}
  inspectFixedTreeCohort(world:World,reset=false,immutableSnapshot=false):FixedTreeCohortPlan{return this.treeCohorts.inspect(world,{reset,immutableSnapshot});}
  confirmProjectedWorld(plan:FixedTreeCohortPlan):void{if(this.pendingFixedCohort?.plan!==plan||this.treeBakeDemand().key!==plan.key)throw Error('Applied tree models differ from admitted cohort');this.pendingFixedCohort.applied=true;}
  beginFixedWorldApplication(world:World,plan:FixedTreeCohortPlan|undefined,reset:boolean,immutableSnapshot:boolean):void{if(this.applyingFixedWorld)throw Error('Tree World application already active');const next=this.pendingFixedCohort?.plan??(plan?.isCurrent()?plan:this.treeCohorts.inspect(world,{reset,immutableSnapshot}));if(next.world!==world)throw Error('Tree admission belongs to a different World');this.applyingFixedWorld=next;}
  abortFixedWorldApplication():void{this.applyingFixedWorld=undefined;}
  completeFixedWorld(world:World,plan:FixedTreeCohortPlan|undefined,immutableSnapshot:boolean):void{try{if(this.pendingFixedCohort){this.confirmProjectedWorld(this.pendingFixedCohort.plan);return;}if(!this.treeCohorts.isCommittedWorld(world)){const next=this.applyingFixedWorld?.world===world?this.applyingFixedWorld:plan?.isCurrent()?plan:this.treeCohorts.inspect(world,{immutableSnapshot});if(next.key!==this.treeBakeDemand().key)throw Error('Presented World tree cohort differs from its actual models');this.treeCohorts.commit(next);}this.synchronizeFixedTreeCohort();}finally{this.applyingFixedWorld=undefined;}}
  fixedTreeNeedsAdmission(plan:FixedTreeCohortPlan):boolean{if(!this.fixedTreeAtlasAvailable||!this.graphicsStyle?.origami||!this.treeTextureCompatible||!this.texturesEnabled||!plan.models.length)return false;const paintKey=fixedTreePaintKey(this.graphicsStyle);if(this.treeDirectFallback?.key===plan.key&&this.treeDirectFallback.paintKey===paintKey)return false;return!this.treeCatalog||this.treeCatalog.paintKey!==paintKey||plan.models.some(model=>!this.treeCatalog!.modelKeys.includes(model.key));}
  assertFixedTreeDrawReady():void{if(!this.fixedTreeAtlasAvailable||!this.graphicsStyle?.origami||!this.treeTextureCompatible||!this.texturesEnabled||this.treeDirectFallback)return;const demand=this.treeBakeDemand();if(this.fixedTreeSurface?.status().cohort!==demand.key)throw Error('Actual named tree cohort has not been admitted');this.fixedTreeSurface.assertDrawable();}
  /** Direct is a separate complete Source representation, selected only for
   * positive effects or an explicit pre-GPU admission refusal. No owner retires. */
  setTreeDirectFallback(reason:string,demand:TreeBakeDemand=this.treeBakeDemand()):TreeAssetPublication{
    if(!this.graphicsStyle||!this.fixedTreeSurface)throw Error('Shared tree context required');
    const previous=this.treeDirectFallback,oldCatalog=this.treeCatalog,oldReady=this.treeBankReady.value,metadata=this.fixedTreeSurface.prepare(undefined,{key:'[]',species:[],models:[],isCurrent:()=>demand.isCurrent()},()=>{}),prospective='world'in demand?demand as FixedTreeCohortPlan:undefined;let settled=false;
    const publication:TreeAssetPublication={commit:()=>{if(settled)return;if(prospective&&!this.pendingFixedCohort?.applied)throw Error('Prospective direct tree World must be applied before commit');metadata.commit();if(prospective)this.treeCohorts.commit(prospective);this.pendingFixedCohort=undefined;metadata.dispose();settled=true;},rollback:()=>{if(settled)return;metadata.rollback();this.pendingFixedCohort=undefined;this.treeCatalog=oldCatalog;this.treeBankReady.value=oldReady;this.treeDirectFallback=previous;settled=true;try{this.refreshFixedTreeMaterials();}finally{metadata.dispose();}}};
    try{metadata.publish();this.treeCatalog=undefined;this.treeBankReady.value=0;this.treeDirectFallback={key:demand.key,paintKey:fixedTreePaintKey(this.graphicsStyle),reason};if(prospective)this.pendingFixedCohort={plan:prospective,applied:false};this.refreshFixedTreeMaterials();return publication;}
    catch(error){try{publication.rollback();}catch(cleanup){throw new AggregateError([error,cleanup],'Direct tree publication rollback failed');}throw error;}
  }

  /** Warm the existing graph, then atomically exchange texture data only.
   * No model/template, material family, chunk or435 page is rebuilt here. */
  prepareTreeAssetCatalog(catalog:TreeAssetCatalog|undefined,_configureFresh?:(material:THREE.NodeMaterial)=>void,prospectiveDemand?:TreeBakeDemand):PreparedTreeCatalogStage{
    if(this.disposed)throw Error('Resource layer disposed');const demand=prospectiveDemand??this.treeBakeDemand(),startEpoch=this.treeRecipeEpoch;
    if(catalog){catalog.assertCurrent();if(!this.treeTextureCompatible||!Number.isSafeInteger(catalog.revision)||catalog.revision<0||!catalog.modelKeys.length||catalog.pageCount!==Math.max(2,catalog.modelKeys.length)||Number((catalog.texture.image as {depth?:number}).depth)!==catalog.pageCount||new Set(catalog.modelKeys).size!==catalog.modelKeys.length||demand.models.some(model=>{const layer=catalog.modelKeys.indexOf(model.key),row=catalog.slots[model.surfaceSlot];return layer<0||!row?.paletteBaked||row.layer!==layer;}))throw Error('Complete compatible tree texture bank required');}
    if(!this.fixedTreeSurface||!this.graphicsStyle)throw Error('Shared tree texture context required');
    if(catalog&&!catalog.paintKey)throw Error('Prepared tree bank requires its captured paint key');
    const assets:TextureSurfaceAssets=catalog?{texture:catalog.texture,uvAddress:'chart',slots:catalog.slots,assertCurrent:()=>catalog.assertCurrent()}:this.pastelTreeAssets;
    // Validate off the live binding. A borrowed bank is never retired by this
    // layer; the external owner transfers its lifetime after publication.
    validateTextureSurfaceAssets(assets);
    const part=demand.models[0]?.parts[0],warmup:THREE.Mesh[]=[];let geometry:THREE.BufferGeometry|undefined;
    if(part){
      const source=this.surfaceModels.map(part.geometry).clone(),group=new THREE.Group(),species=demand.models[0]!.species,role=part.primitiveKind==='cactus'?'cactus':part.canopy?'canopy':'trunk',profile=species===undefined?0:LEGACY_TREE_PAINT_TABLE[species].roles[role]??0;
      const mesh=mergedInstances(group,[{geometry:source,items:[{...part.canonicalPlacement,referenceColor:part.canonicalPlacement.color,profile}]}],this.treeSurface.material,true,true,false,true);
      if(mesh){geometry=mesh.geometry;const count=geometry.getAttribute('position').count;geometry.setAttribute('windRoot',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('windBasis',new THREE.Float32BufferAttribute(new Float32Array(count*4),4));
        for(const material of [this.treeSurface.material,this.treeSurface.plainMaterial]){const view=new THREE.Mesh(geometry,material);view.frustumCulled=false;view.castShadow=view.receiveShadow=true;warmup.push(view);}
      }
    }
    let metadata:ReturnType<FixedTreeTextureSurface['prepare']>;try{metadata=this.fixedTreeSurface.prepare(catalog?{catalog,paintKey:catalog.paintKey!}:undefined,demand,()=>{});}catch(error){geometry?.dispose();throw error;}
    let closed=false,published=false,settled=false;let publication:TreeAssetPublication|undefined;
    return{warmup:Object.freeze(warmup),publish:()=>{
      if(closed||published||this.disposed||startEpoch!==this.treeRecipeEpoch||!demand.isCurrent())throw Error('Tree texture staging superseded');catalog?.assertCurrent();
      const old=this.treeCatalog,oldReady=this.treeBankReady.value,oldFallback=this.treeDirectFallback;metadata.publish();this.treeCatalog=catalog;this.treeBankReady.value=catalog?1:0;this.treeDirectFallback=undefined;const publicationEpoch=++this.treeRecipeEpoch;published=true;
      const prospective='world'in demand?demand as FixedTreeCohortPlan:undefined;if(prospective)this.pendingFixedCohort={plan:prospective,applied:false};
      publication={rollback:()=>{if(settled)return;if(this.treeCatalog!==catalog||this.treeRecipeEpoch!==publicationEpoch)throw Error('Newer tree publication owns the layer');metadata.rollback();this.treeCatalog=old;this.treeBankReady.value=oldReady;this.treeDirectFallback=oldFallback;this.pendingFixedCohort=undefined;this.treeRecipeEpoch++;settled=true;try{this.refreshFixedTreeMaterials();}finally{metadata.dispose();}},commit:()=>{if(settled)return;if(prospective&&!this.pendingFixedCohort?.applied)throw Error('Prospective tree World must be applied before commit');metadata.commit();if(prospective)this.treeCohorts.commit(prospective);this.pendingFixedCohort=undefined;metadata.dispose();settled=true;}};try{this.refreshFixedTreeMaterials();}catch(error){try{publication.rollback();}catch(cleanup){throw new AggregateError([error,cleanup],'Tree metadata publication rollback failed');}throw error;}return publication;
    },dispose:()=>{if(closed)return;closed=true;const errors:unknown[]=[];try{if(published&&!settled)publication!.rollback();else if(!published)metadata.dispose();}catch(error){errors.push(error);}try{geometry?.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Tree publication staging cleanup failed');}};
  }
  setTreeAssetCatalog(catalog:TreeAssetCatalog|undefined,configureFresh?:(material:THREE.NodeMaterial)=>void):TreeAssetPublication{const stage=this.prepareTreeAssetCatalog(catalog,configureFresh);let publication:TreeAssetPublication;try{publication=stage.publish();}catch(error){stage.dispose();throw error;}return{commit:()=>{try{publication.commit();}finally{stage.dispose();}},rollback:()=>{try{publication.rollback();}finally{stage.dispose();}}};}

  /** One uniform update for the whole forest; no vertex buffer is rewritten. */
  setWind(strength:number,directionX:number,directionZ:number):void {
    this.windStrength.value=Number.isFinite(strength)?Math.max(0,Math.min(2,strength)):0;
    const length=Math.hypot(directionX,directionZ);
    if(length>0&&Number.isFinite(length))this.windDirection.value.set(directionX/length,directionZ/length);
  }
  presentWind(tick:number):void {
    this.windTick.value=((tick%7200)+7200)%7200;
    if(this.detail){const sample=this.windTick.value;
      this.middleWind.capture(this.detail,this.windDirection.value.x,this.windDirection.value.y,this.windStrength.value,sample*2*Math.PI/48,sample*2*Math.PI/15);}
  }
  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;
    this.group.traverse(object=>{
      if(object.userData.referenceCompanion){object.userData.origamiTexturesEnabled=enabled;this.graphicsStyle?.refreshEdgeObject(object);}
      else if(object instanceof THREE.Mesh)object.material=this.sharedTreeMeshes.has(object)?this.treeMaterial():object.geometry.hasAttribute('windRoot')
        ?enabled?this.windTextured:this.windPlain:enabled?this.bodyTextured:this.bodyPlain;
    });
  }
  setFoliageVisible(visible: boolean): void {
    this.foliageVisible = visible;
    this.group.traverse(object => { if (object.name === 'tree-canopy') {
      object.userData.origamiOwnerVisible=visible;
      if(object.userData.referenceCompanion)this.graphicsStyle?.refreshEdgeObject(object);
      else object.visible=visible;
    } });
  }
  /** Caller supplies already eligible target IDs, not a rectangle-position mask.
   * Only their existing spatial chunks/ranges are visited on selection changes. */
  setTargetPreview(ids:ReadonlySet<number>):void {
    if(ids.size===this.targetPreviewIds.size&&[...ids].every(id=>this.targetPreviewIds.has(id)))return;
    this.graphicsComparisonRevision++;
    const keys=new Set<string>();for(const id of [...this.targetPreviewIds,...ids]){const key=this.resourceChunks.get(id);if(key)keys.add(key);}
    this.targetTint.restore();this.targetPreviewIds=new Set(ids);
    for(const key of keys){const chunk=this.chunks.get(key);if(chunk)this.targetTint.apply(chunk.group,this.targetPreviewIds);}
  }
  clearTargetPreview():void {if(this.targetPreviewIds.size)this.graphicsComparisonRevision++;this.targetTint.restore();this.targetPreviewIds.clear();}
  clear(): void { this.middleWind.reset();this.clearTargetPreview();this.preparedResources?.clear();clearGroup(this.group); this.chunks.clear(); this.resourceChunks.clear(); this.growing.clear(); this.treeParts.clear(); this.treeHits.clear(); this.treeCells.clear();this.treeCellsPending=undefined;this.cachedTreeUpdate=undefined;this.treeDemandEpoch++;this.refreshTreeCensus(); }
  dispose():void {if(this.disposed)return;this.releaseSurfaceRefresh();this.attachPreparedResourceGpuRetirement([]);const resources:{dispose():void}[]=[...[this.wearPlain,this.wearWind,this.referenceFlora,this.wearFlora,this.fallbackPastel,...(this.wearTemplates?.values()??[])].filter((r):r is NonNullable<typeof r>=>r!==undefined),...(this.fixedTreeSurface?[this.fixedTreeSurface]:[this.treeSurface]),this.bodyTextured,this.pastelTreeAssets.texture,this.surfaceModels,this.treeCohorts,this.treeModels];const errors:unknown[]=[];try{this.preparedResources?.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Prepared resource owner close quarantined');try{this.clear();}catch(error){errors.push(error);}try{disposeTreeResources(resources,'Resource material cleanup failed');}catch(error){errors.push(error);}this.treeCatalog=undefined;if(errors.length)throw new AggregateError(errors,'Resource layer cleanup failed');this.disposed=true;}

  /** Only a confirmed increase in a reserved chopping job can produce a hit.
   * The contact phase is the forward reach of the existing 11 rad/s arm pose. */
  adoptChopWork(previous:World|undefined,world:World,reset=false,frame?:SceneResourceFrame):void {
    if(reset||!previous||world.tick<previous.tick){this.clearChopRecoil();return;}
    if(!world.jobs.some(job=>job.kind==='chop'&&job.status==='active')){if(this.treeHits.size)this.clearChopRecoil();return;}
    const indexed=readSceneResourceFrame(frame,world);
    if(!indexed&&this.treeCellsPending){
      const pending=this.treeCellsPending;this.treeCells.clear();
      for(const resource of pending.resources)if(resource.kind==='tree'&&!isResidentCrop(resource)&&!isClusterPlantSpecies(resource.species))
        this.treeCells.set(resource.z*pending.width+resource.x,resource.id);
      this.treeCellsPending=undefined;
    }
    const previousJobs=new Map(previous.jobs.map(job=>[job.id,job]));
    const previousPawns=new Map(previous.pawns.map(pawn=>[pawn.id,pawn]));
    const workingTrees=new Set<number>();
    for(const job of world.jobs){
      if(job.kind!=='chop'||job.reservedBy===null||job.status!=='active')continue;
      const pawn=world.pawns.find(candidate=>candidate.id===job.reservedBy);
      const oldPawn=previousPawns.get(job.reservedBy),oldJob=previousJobs.get(job.id);
      const cell=job.z*world.width+job.x,treeId=indexed?indexed.treeAt(cell):this.treeCells.get(cell);
      if(treeId===undefined||!pawn||pawn.jobId!==job.id||pawn.state!=='working'||pawn.stun)continue;
      workingTrees.add(treeId);
      if(!oldJob||oldJob.kind!=='chop'||oldJob.reservedBy!==pawn.id||!oldPawn||oldPawn.jobId!==job.id||oldPawn.state!=='working'||workProgress(job)<=workProgress(oldJob))continue;
      const phase=pawn.id*1.7-1.5*Math.PI;
      const priorCycle=Math.floor((11*previous.tick/TICKS_PER_SECOND+phase)/(2*Math.PI));
      const cycle=Math.floor((11*world.tick/TICKS_PER_SECOND+phase)/(2*Math.PI));
      if(cycle<=priorCycle)continue;
      const at=(cycle*2*Math.PI-phase)/11;
      const dx=job.x-pawn.x,dz=job.z-pawn.z,length=Math.hypot(dx,dz)||1;
      const priorHit=this.treeHits.get(treeId);
      const held=!!priorHit&&!!this.detail&&this.detail.classify(job.x,0,job.z)===2;
      if(priorHit&&!held)this.poseTree(treeId,priorHit,0);
      // The first positive lobe leans away from the worker, as if struck.
      this.treeHits.set(treeId,{at,x:job.x,z:job.z,axisX:dz/length,axisZ:-dx/length,
        angle:held?priorHit!.angle:0,sample:held?priorHit!.sample:undefined,pendingPose:held});
    }
    for(const [id,hit] of this.treeHits)if(!workingTrees.has(id)){
      this.poseTree(id,hit,0);this.treeHits.delete(id);
    }
  }

  /** The same confirmed presentation clock as the pawn arm controls recoil. */
  presentChop(timeSeconds:number):void {
    for(const [id,hit] of this.treeHits){
      let sampleSeconds=timeSeconds;
      if(this.detail){
        hit.sample??=this.detail.createHandle();
        const due=this.detail.shouldSample(hit.sample,hit.x,0,hit.z);
        if(hit.sample.level===2){if(hit.angle!==0)this.poseTree(id,hit,0);if(timeSeconds-hit.at>=CHOP_RECOIL_SECONDS)this.treeHits.delete(id);continue;}
        if(!due&&hit.sample.level!==1)continue;
      }
      const angle=chopRecoilAngle(sampleSeconds-hit.at);
      if(angle!==hit.angle||hit.pendingPose){this.poseTree(id,hit,angle);hit.pendingPose=false;}
      if(sampleSeconds-hit.at>=CHOP_RECOIL_SECONDS)this.treeHits.delete(id);
    }
  }

  clearChopRecoil():void {
    for(const [id,hit] of this.treeHits)this.poseTree(id,hit,0);
    this.treeHits.clear();
  }

  private poseTree(id:number,hit:TreeHit,angle:number):void {
    const parts=this.treeParts.get(id);if(!parts)return;
    const sine=Math.sin(angle),cosine=Math.cos(angle),complement=1-cosine;
    for(const {mesh,range,positions,normals,expansions,brush,upload} of parts){
      const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const normal=mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
      const out=position.array as Float32Array,outNormal=normal.array as Float32Array;
      const expand=mesh.geometry.getAttribute('origamiWearExpand') as THREE.BufferAttribute|undefined;
      const currentBrush=resourceBrushData(mesh.geometry);
      for(let vertex=range.vertexStart;vertex<range.vertexStart+range.vertexCount;vertex++){
        const i=vertex*3;
        const x=positions[i]!-hit.x,y=positions[i+1]!,z=positions[i+2]!-hit.z;
        const dot=hit.axisX*x+hit.axisZ*z;
        out[i]=hit.x+x*cosine-hit.axisZ*y*sine+hit.axisX*dot*complement;
        out[i+1]=y*cosine+(hit.axisZ*x-hit.axisX*z)*sine;
        out[i+2]=hit.z+z*cosine+hit.axisX*y*sine+hit.axisZ*dot*complement;
        const nx=normals[i]!,ny=normals[i+1]!,nz=normals[i+2]!,normalDot=hit.axisX*nx+hit.axisZ*nz;
        outNormal[i]=nx*cosine-hit.axisZ*ny*sine+hit.axisX*normalDot*complement;
        outNormal[i+1]=ny*cosine+(hit.axisZ*nx-hit.axisX*nz)*sine;
        outNormal[i+2]=nz*cosine+hit.axisX*ny*sine+hit.axisZ*normalDot*complement;
        if(expand&&expansions){
          const ex=expansions[i]!,ey=expansions[i+1]!,ez=expansions[i+2]!,dot=hit.axisX*ex+hit.axisZ*ez;
          expand.array[i]=ex*cosine-hit.axisZ*ey*sine+hit.axisX*dot*complement;
          expand.array[i+1]=ey*cosine+(hit.axisZ*ex-hit.axisX*ez)*sine;
          expand.array[i+2]=ez*cosine+hit.axisX*ey*sine+hit.axisZ*dot*complement;
        }
        if(currentBrush&&brush){
          for(const key of ['base','width','rough'] as const){const translated=key==='base',bx=brush[key][i]!-(translated?hit.x:0),by=brush[key][i+1]!,bz=brush[key][i+2]!-(translated?hit.z:0),dot=hit.axisX*bx+hit.axisZ*bz;
            currentBrush[key][i]=(translated?hit.x:0)+bx*cosine-hit.axisZ*by*sine+hit.axisX*dot*complement;currentBrush[key][i+1]=by*cosine+(hit.axisZ*bx-hit.axisX*bz)*sine;currentBrush[key][i+2]=(translated?hit.z:0)+bz*cosine+hit.axisX*by*sine+hit.axisZ*dot*complement;
          }
        }
      }
      if(currentBrush)this.graphicsStyle?.refreshBrushGeometry(mesh.geometry,range.vertexStart,range.vertexCount);
      // Reuse the range descriptor: WebGPU uploads only this tree's vertices,
      // instead of the whole 64-cell chunk on every animated frame.
      upload.start=range.vertexStart*3;upload.count=range.vertexCount*3;
      // A hidden or camera-culled chunk may not upload this frame. Keep only
      // its latest pending range, rather than accumulating one per RAF.
      if(!position.updateRanges.includes(upload))position.updateRanges.push(upload);
      if(!normal.updateRanges.includes(upload))normal.updateRanges.push(upload);
      if(expand&&!expand.updateRanges.includes(upload))expand.updateRanges.push(upload);
      position.needsUpdate=true;normal.needsUpdate=true;
      if(expand)expand.needsUpdate=true;
      this.compiledAttributeChanged435?.(position,upload.start,upload.count);this.compiledAttributeChanged435?.(normal,upload.start,upload.count);
      if(expand)this.compiledAttributeChanged435?.(expand,upload.start,upload.count);
    }
    hit.angle=angle;
  }

  private refreshTreeBases(ids:readonly number[]):void {
    const copies=new Map<ResourceObject,Float32Array>(),expansions=new Map<ResourceObject,Float32Array>(),brushes=new Map<ResourceObject,ResourceBrushData>();
    for(const id of ids)for(const part of this.treeParts.get(id)??[]){
      let positions=copies.get(part.mesh);
      if(!positions){positions=new Float32Array((part.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array);copies.set(part.mesh,positions);}
      part.positions=positions;
      const expand=part.mesh.geometry.getAttribute('origamiWearExpand');
      if(expand){let copy=expansions.get(part.mesh);if(!copy){copy=new Float32Array(expand.array as Float32Array);expansions.set(part.mesh,copy);}part.expansions=copy;}
      const brush=resourceBrushData(part.mesh.geometry);if(brush){let copy=brushes.get(part.mesh);if(!copy){copy={base:brush.base.slice(),width:brush.width.slice(),rough:brush.rough.slice()};brushes.set(part.mesh,copy);}part.brush=copy;}
    }
  }
  update(world: World, newMap: boolean, changes?: ReadonlyMap<number,NaturalPresentationChange>,frame?:SceneResourceFrame,appearance?:NaturalAppearanceReader): void {
    const pending=this.pendingFixedCohort,projection=pending?.plan??this.applyingFixedWorld??this.treeCohorts.inspect(world,{reset:newMap,immutableSnapshot:!!frame});
    this.updateWorldChunks(world,newMap,changes,frame,appearance);
    if(pending||this.applyingFixedWorld)return;
    this.treeCohorts.commit(projection);
    this.synchronizeFixedTreeCohort();
  }
  private synchronizeFixedTreeCohort():void{
    const demand=this.treeBakeDemand(),paintKey=this.graphicsStyle?fixedTreePaintKey(this.graphicsStyle):undefined;
    if(this.treeDirectFallback&&(this.treeDirectFallback.key!==demand.key||this.treeDirectFallback.paintKey!==paintKey))this.treeDirectFallback=undefined;
    if(this.fixedTreeSurface&&this.graphicsStyle&&!this.treeDirectFallback&&this.treeTextureCompatible&&(!this.graphicsStyle.origami||this.treeCatalog?.paintKey===paintKey&&demand.models.every(model=>this.treeCatalog!.modelKeys.includes(model.key)))&&this.fixedTreeSurface.status().cohort!==demand.key){
      const bank=this.treeCatalog?.paintKey===paintKey?this.treeCatalog:undefined,stage=this.fixedTreeSurface.prepare(bank?{catalog:bank,paintKey:bank.paintKey!}:undefined,demand,()=>{});try{stage.publish();stage.commit();}finally{stage.dispose();}
    }
    this.refreshFixedTreeMaterials();
  }
  private updateWorldChunks(world: World, newMap: boolean, changes?: ReadonlyMap<number,NaturalPresentationChange>,frame?:SceneResourceFrame,appearance?:NaturalAppearanceReader): void {
    if(this.disposed)throw new Error('Resource layer disposed');this.cachedTreeUpdate={world,appearance};this.treeCatalog?.assertCurrent();
    const size=(r:World['resources'][number])=>appearance?.read(r).size??floraSize(world,r);
    const ripe=(r:World['resources'][number])=>appearance?appearance.harvestable(r):harvestable(world,r);
    const leafless=(r:World['resources'][number])=>appearance?.read(r).leafless??plantLeafless(world,r);
    const identity=(r:World['resources'][number])=>resourceIdentity(world,r)+(r.kind==='tree'?`:tree-shape:${treeModelVariant(world)}:blight:${r.blight?1:0}`:'');
    // One complete id index per application, shared by every rebuilt chunk's
    // optional wear (previously rebuilt from all World resources per chunk).
    let resourceIndex:Map<number,World['resources'][number]>|undefined;
    const resourcesById=()=>resourceIndex??=new Map(world.resources.map(r=>[r.id,r]));
    // ColonyRenderer configures the shared materials after constructing this
    // layer. Copy its lighting node before the first tree shader is compiled.
    const plainOutput=this.staticMaterial.outputNode;
    const texturedOutput=this.texturedMaterial.outputNode;
    if(this.windPlain.outputNode!==plainOutput)this.windPlain.outputNode=plainOutput;
    if(this.windTextured.outputNode!==texturedOutput)this.windTextured.outputNode=texturedOutput;
    for(const material of [this.bodyTextured,this.wearPlain,this.wearWind])if(material){
      const source=this.texturedMaterial;
      material.outputNode=source.outputNode;
      material.maskShadowNode=source.maskShadowNode;
      const original=material.userData.referenceOriginalMask as THREE.Node<'bool'>|undefined;
      if(material.userData.referenceMaskSource!==source.maskNode){
        material.maskNode=source.maskNode?(original?new THREE.OperatorNode('&&',source.maskNode,original):source.maskNode):original??null;
        material.userData.referenceMaskSource=source.maskNode;material.needsUpdate=true;
      }
    }
    this.windPlain.maskNode=this.bodyPlain.maskNode;this.windTextured.maskNode=this.bodyTextured.maskNode;
    this.windPlain.maskShadowNode=this.bodyPlain.maskShadowNode;this.windTextured.maskShadowNode=this.bodyTextured.maskShadowNode;
    for(const material of [this.treeSurface.material,this.treeSurface.plainMaterial]){material.outputNode=this.staticMaterial.outputNode;material.maskNode=this.staticMaterial.maskNode;material.maskShadowNode=this.staticMaterial.maskShadowNode;}
    if (newMap) { this.deferredChunks.clear();this.middleWind.reset();this.clearTargetPreview();this.preparedResources?.clear();clearGroup(this.group); this.chunks.clear(); this.resourceChunks.clear(); this.growing.clear(); this.treeParts.clear(); this.treeHits.clear();this.treeDemandEpoch++; }
    const indexed=readSceneResourceFrame(frame,world);
    if(indexed)this.treeCellsPending=world;
    else{
      this.treeCellsPending=undefined;this.treeCells.clear();
      for(const resource of world.resources)if(resource.kind==='tree')this.treeCells.set(resource.z*world.width+resource.x,resource.id);
    }
    let chunks:ReadonlyMap<string,readonly World['resources'][number][]>;
    const partial=!!changes&&!newMap;
    const affected=new Set<string>(),nextKeys=new Map<number,string|undefined>();
    if (partial) {
      for (const [id,change] of changes) {
        const oldKey=this.resourceChunks.get(id);
        if(oldKey)affected.add(oldKey);
        const resource=change.resource;
        const key=resource&&!isResidentCrop(resource)&&!isClusterPlantSpecies(resource.species)
          ?`${Math.floor(resource.x/WORLD_SCALE.resourceChunkSize)}:${Math.floor(resource.z/WORLD_SCALE.resourceChunkSize)}`:undefined;
        nextKeys.set(id,key);
        if(key)affected.add(key);
        this.growing.delete(id);
        if(resource?.kind==='berries'&&!ripe(resource))this.growing.set(id,resource);
      }
      for(const key of this.deferredChunks)affected.add(key);
      if(!affected.size)return;
    } else {
      this.deferredChunks.clear();
      this.growing.clear();
      this.resourceChunks.clear();
    }
    const indexedChunks=indexed?.chunksFor(partial?changes:undefined,partial?affected:undefined);
    if(indexedChunks){
      const collected=new Map<string,readonly World['resources'][number][]>();
      for(const chunk of indexedChunks.changedChunks){
        collected.set(chunk.key,chunk.resources);
        if(!partial)for(const resource of chunk.resources){
          this.resourceChunks.set(resource.id,chunk.key);
          if(resource.kind==='berries'&&!ripe(resource))this.growing.set(resource.id,resource);
        }
      }
      chunks=collected;
    }else{
      const collected=new Map<string,World['resources']>();
      // Visit the world in its original order so ranges inside a changed chunk
      // remain identical to a complete update, even after deletion or movement.
      for (const resource of world.resources) {
        if(!partial&&(isResidentCrop(resource)||isClusterPlantSpecies(resource.species)))continue;
        const key=partial
          ?nextKeys.has(resource.id)?nextKeys.get(resource.id):this.resourceChunks.get(resource.id)
          :`${Math.floor(resource.x/WORLD_SCALE.resourceChunkSize)}:${Math.floor(resource.z/WORLD_SCALE.resourceChunkSize)}`;
        if(!key||partial&&!affected.has(key))continue;
        if(!partial)this.resourceChunks.set(resource.id,key);
        const chunk=collected.get(key);
        if(chunk)chunk.push(resource);else collected.set(key,[resource]);
        if(!partial&&resource.kind==='berries'&&!ripe(resource))this.growing.set(resource.id,resource);
      }
      chunks=collected;
    }
    if(partial)for(const [id,key] of nextKeys) {
      if(key)this.resourceChunks.set(id,key);else this.resourceChunks.delete(id);
    }
    for (const [key, previous] of this.chunks) if ((!partial||affected.has(key))&&!chunks.has(key) && previous.signature !== '') {
      this.graphicsComparisonRevision++;
      this.preparedResources?.forgetContribution(key);
      retainResources(previous.group, new Set()); previous.visibleKeys.clear(); previous.signature = '';
      for(const id of previous.treeIds){this.treeParts.delete(id);this.treeHits.delete(id);}
      previous.treeIds=[];
      previous.treeModels=[];previous.treeCount=0;previous.anonymousTreeCount=0;
    }
    const rebuildStarted=performance.now();let rebuilt=0;
    for (const [key, chunk] of chunks) {
      const previous = this.chunks.get(key);
      const models=new Map<string,TreeModel>();let treeCount=0,anonymousTreeCount=0;
      const signature=chunk.map(resource=>{if(resource.kind==='tree'){treeCount++;if(resource.species===undefined)anonymousTreeCount++;if(resource.species!==undefined){if(!isTreeSpecies(resource.species))throw Error('Unsupported actual tree model species');const model=this.treeModels.get(resource.species,treeModelVariant(world));models.set(model.key,model);}}return`${resource.id}:${identity(resource)}:${size(resource)}:${resource.kind==='berries'&&ripe(resource)?1:0}:${leafless(resource)}`;}).join('|');
      if(previous?.signature===signature){this.deferredChunks.delete(key);continue;}
      this.graphicsComparisonRevision++;
      const sizes=new Map(chunk.map(resource=>[resource.id,size(resource)]));
      const visibleKeys=new Set(chunk.flatMap(r=>visibleResourceKeys(world,r,appearance)));
      if (previous&&chunk.every(r => previous.identities.get(r.id) === identity(r))) {
        const treeSizeChanged=previous.treeIds.some(id=>previous.currentSizes.get(id)!==sizes.get(id));
        if(treeSizeChanged)this.clearChopRecoil();
        resizeResources(world,previous.group,new Map(chunk.map(resource=>[resource.id,resource])),previous.originalSizes,previous.currentSizes,sizes,this.rangeBounds,this.graphicsStyle);
        if(treeSizeChanged)this.refreshTreeBases(previous.treeIds);
        // Growth changes vertex positions, not the selected original ranges.
        // Keep their index version stable until actual membership changes;
        // otherwise the static compiler remaps/uploads the same triangles.
        if(visibleKeys.size!==previous.visibleKeys.size||[...visibleKeys].some(id=>!previous.visibleKeys.has(id))){
          retainResources(previous.group,visibleKeys);previous.visibleKeys=visibleKeys;
        }
        previous.signature=signature;previous.treeModels=[...models.values()];previous.treeCount=treeCount;previous.anonymousTreeCount=anonymousTreeCount;this.deferredChunks.delete(key);continue;
      }
      // Full rebuild: at least one per call (progress), then only within budget.
      if(partial&&rebuilt>0&&performance.now()-rebuildStarted>=this.chunkRebuildBudgetMs){this.deferredChunks.add(key);continue;}
      rebuilt++;this.deferredChunks.delete(key);
      if(previous)for(const id of previous.treeIds)this.treeParts.delete(id);
      const group = previous?.group ?? new THREE.Group();
      if (previous) {this.preparedResources?.forgetContribution(key);this.targetTint.restore(group);clearGroup(group);} else this.group.add(group);
      group.name = `Resources ${key}`;
      const trunks: Placement[] = [], crowns: Placement[] = [], upperCrowns: Placement[] = [];
      const rocks: Placement[] = [], bushes: Placement[] = [], berries: Placement[] = [];
      const cones:Placement[]=[],blades:Placement[]=[],cacti:Placement[]=[];
      const origamiParts=this.referenceFlora?.createBatch();
      const sharedTreeIds=new Set<number>(),treeClones=new Set<THREE.BufferGeometry>();
      const treeBodies=new Map<THREE.BufferGeometry,{geometry:THREE.BufferGeometry;items:Placement[]}>(),treeCanopies=new Map<THREE.BufferGeometry,{geometry:THREE.BufferGeometry;items:Placement[]}>();
      const continuousBodies=new Map<THREE.BufferGeometry,{geometry:THREE.BufferGeometry;items:Placement[]}>(),continuousCanopies=new Map<THREE.BufferGeometry,{geometry:THREE.BufferGeometry;items:Placement[]}>();
      try{
      for (const resource of chunk) {
        const { x, z } = resource;
        const parts = [trunks, crowns, upperCrowns, rocks, bushes, berries];
        const lengths = parts.map(items => items.length);
        const n = noise(x, z, 77), turn = n * Math.PI * 2;
        if(resource.kind==='tree'){
          if(resource.species!==undefined&&!isTreeSpecies(resource.species))throw Error('Unsupported actual tree model species');
          const model=this.treeModels.get(resource.species,treeModelVariant(world)),placed=model.place(resource,turn,size(resource));
          if(!placed?.length)throw Error('Shared tree model has no actual placements');
          for(const {part,item}of placed){
            const target=model.species===undefined?(part.canopy?continuousCanopies:continuousBodies):(part.canopy?treeCanopies:treeBodies);let batch=target.get(part.geometry);
            if(!batch){const geometry=this.surfaceModels.map(part.geometry).clone();if(model.species===undefined)geometry.deleteAttribute('bakedUv');treeClones.add(geometry);geometry.addEventListener('dispose',()=>treeClones.delete(geometry));batch={geometry,items:[]};target.set(part.geometry,batch);}
            const role=part.primitiveKind==='cactus'?'cactus':part.canopy?'canopy':'trunk',profile=resource.species===undefined?0:LEGACY_TREE_PAINT_TABLE[resource.species].roles[role]??0;
            batch.items.push({...item,referenceColor:part.canonicalPlacement.color,profile});
          }
          sharedTreeIds.add(resource.id);continue;
        }
        if(origamiParts?.append(world,resource,turn,size(resource)))continue;
        if(resource.species||isMedicinalPlant(resource)){appendFlora({trunks,crowns,cones,blades,cacti,bushes,fruit:berries},world,resource,turn,size(resource));continue;}
        if (resource.kind === 'rock') {
          rocks.push({ x: x - 0.1, y: 0.3, z, sx: 0.46 + n * 0.14, sy: 0.35 + n * 0.15, sz: 0.43, ry: turn, color: resource.stone ? stoneColor(resource.stone) : 0x92998d, pigment:'stone' });
          rocks.push({ x: x + 0.3, y: 0.15, z: z + 0.2, sx: 0.25, sy: 0.24, sz: 0.25, ry: -turn, color: resource.stone ? stoneColor(resource.stone) : 0xa8ad9c, pigment:'stone' });
        } else {
          trunks.push({x,y:.13,z,sx:.6,sy:.28,sz:.6,ry:turn});
          bushes.push({ x, y: 0.3, z, sx: 0.44, sy: 0.39, sz: 0.4, ry: turn, color: 0x697b55 });
          for (let i = 0; i < 5; i++) {
            const angle = i * 2.4 + turn;
            berries.push({ x: x + Math.sin(angle) * 0.25, y: 0.42 + (i % 2) * 0.09, z: z + Math.cos(angle) * 0.25 });
          }
        }
        parts.forEach((items, i) => { for (let j = lengths[i]!; j < items.length; j++) items[j]!.key = i === 5 ? -resource.id*2-1 : i===4 ? -resource.id*2 : resource.id; });
      }
      for (const trunk of trunks) trunk.color ??= 0x70573e;
      for (const berry of berries) berry.color = 0xb96f63;
      for(const items of [trunks,crowns,upperCrowns,rocks,bushes,berries,cones,blades,cacti])for(const item of items)item.profile??=GENERIC_REFERENCE_PROFILE;
      const mapper=(g:THREE.BufferGeometry)=>this.surfaceModels.map(g),origamiBodies=origamiParts?.parts(false,'surface',mapper)??[],origamiCanopies=origamiParts?.parts(true,'surface',mapper)??[];
      const fallbackBodies=[
        { geometry:this.surfaceModels.get('trunk').clone(),items:trunks },
        { geometry:this.surfaceModels.get('rock').clone(),items:rocks },
        { geometry:this.surfaceModels.get('blade').clone(),items:blades },
        { geometry:this.surfaceModels.get('cactus').clone(),items:cacti },
        { geometry:this.surfaceModels.get('bush').clone(),items:bushes },
        { geometry:this.surfaceModels.get('berry').clone(),items:berries },
      ];
      const fallbackCanopies=[{geometry:this.surfaceModels.get(world.site?'broadleaf':'conical').clone(),items:[...crowns,...upperCrowns]},{geometry:this.surfaceModels.get('conical').clone(),items:cones}];
      const preparedIds=new Set<number>(),preparedIdentity=this.preparedResources?{identity:(geometry:THREE.BufferGeometry,item:Placement)=>{if(item.key!==undefined&&sharedTreeIds.has(rangeResourceId(item.key)))return-1;const size=item.key===undefined?1:sizes.get(rangeResourceId(item.key))??1,id=this.preparedResources!.capture(geometry,item,Math.max(1,1/Math.max(size,1e-9)));if(id>=0)preparedIds.add(id);return id;}}:undefined;
      mergedInstances(group,[...fallbackBodies,...origamiBodies,...continuousBodies.values()],this.texturesEnabled?this.bodyTextured:this.bodyPlain,true,true,false,true,preparedIdentity);
      const canopy=mergedInstances(group,[...fallbackCanopies,...origamiCanopies,...continuousCanopies.values()],this.texturesEnabled?this.bodyTextured:this.bodyPlain,true,true,false,true,preparedIdentity);
      this.preparedResources?.setContribution(key,preparedIds);
      if(canopy){canopy.name='tree-canopy';canopy.visible=this.foliageVisible;}
      for(const [parts,isCanopy]of [[treeBodies,false],[treeCanopies,true]] as const){
        const mesh=mergedInstances(group,[...parts.values()],this.treeMaterial(),true,true,false,true);
        if(!mesh)continue;this.sharedTreeMeshes.add(mesh);
        if(isCanopy){this.sharedTreeCanopies.add(mesh);mesh.name='tree-canopy';mesh.visible=this.foliageVisible;}
      }
      this.appendOptionalWear(group,world,new Map(sizes),new Map(sizes),new Map(sizes),false,resourcesById);
      retainResources(group,visibleKeys);
      const trees=new Map(chunk.filter(r=>r.kind==='tree').map(r=>[r.id,r] as const));
      const treeIds=[...trees.keys()],treeSet=new Set(treeIds);
      for(const object of group.children){
        const mesh=object as ResourceObject,source=mesh.userData.resourceRanges as ResourceRangeData|undefined;
        if(!source)continue;
        const [chunkX,chunkZ]=key.split(':').map(Number);
        const east=chunkX!*WORLD_SCALE.resourceChunkSize+WORLD_SCALE.resourceChunkSize*.5>=world.width*.5,south=chunkZ!*WORLD_SCALE.resourceChunkSize+WORLD_SCALE.resourceChunkSize*.5>=world.height*.5;
        const quadrant=south?(east?3:2):(east?1:0);
        if(mesh instanceof THREE.Mesh&&!mesh.userData.referenceCompanion)setStaticSceneSource435(mesh,`resource:${key}:${this.sharedTreeMeshes.has(mesh)?this.sharedTreeCanopies.has(mesh)?'prepared-tree-canopy':'prepared-tree-body':mesh===canopy?'canopy':'body'}`,quadrant);
        const retained=ResourceRangeBounds.capture((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array,source.ranges);
        if(retained)this.rangeBounds.set(mesh.geometry,retained);
        const ranges=source.ranges.filter(range=>treeSet.has(rangeResourceId(range.id)));
        // Optional wear retains its original static/wind ownership. Ordinary
        // opaque resources always get the common eight-buffer wind layout.
        if(!ranges.length&&mesh.userData.referenceCompanion)continue;
        if(ranges.length){
        const normals=new Float32Array((mesh.geometry.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array);
        const expand=mesh.geometry.getAttribute('origamiWearExpand');
        const expansions=expand?new Float32Array(expand.array as Float32Array):undefined;
        for(const range of ranges){
          const id=rangeResourceId(range.id),parts=this.treeParts.get(id)??[];
          parts.push({mesh,range,positions:source.originalPositions,normals,expansions,brush:source.originalBrush,upload:{start:range.vertexStart*3,count:range.vertexCount*3}});this.treeParts.set(id,parts);
        }
        // Tilted crowns remain inside the conservative camera/shadow bounds.
        if(mesh.geometry.boundingSphere)mesh.geometry.boundingSphere.radius+=4;
        if(resourceBrushData(mesh.geometry)&&mesh.geometry.boundingSphere)mesh.geometry.userData.referenceBrushConservativeSphere=mesh.geometry.boundingSphere.clone();
        }
        const windRoot=new Float32Array((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).count*3);
        for(const range of ranges){
          const resource=trees.get(rangeResourceId(range.id));
          if(!resource)continue;
          const weight=resource.species==='saguaro'?.14:mesh.name==='tree-canopy'?1:.62;
          for(let vertex=range.vertexStart;vertex<range.vertexStart+range.vertexCount;vertex++){
            const offset=vertex*3;windRoot[offset]=resource.x;windRoot[offset+1]=resource.z;windRoot[offset+2]=weight;
          }
        }
        const windBasis=new Float32Array(windRoot.length/3*4),position=mesh.geometry.getAttribute('position');
        // Weight0 makes every deformation term exactly zero. No trigonometry
        // or fake owner coordinates are needed for non-tree resource vertices.
        if(ranges.length)for(let vertex=0;vertex<position.count;vertex++){
          const rootPhase=windRoot[vertex*3]!*.47+windRoot[vertex*3+1]!*.31;
          const flutterPhase=position.getX(vertex)*1.3+position.getZ(vertex)*1.7;
          windBasis[vertex*4]=Math.sin(rootPhase);windBasis[vertex*4+1]=Math.cos(rootPhase);
          windBasis[vertex*4+2]=Math.sin(flutterPhase);windBasis[vertex*4+3]=Math.cos(flutterPhase);
        }
        const preparedIds=mesh.geometry.userData.preparedResourceVariantIds as Float32Array|undefined;
        if(preparedIds)for(let vertex=0;vertex<position.count;vertex++)if(windRoot[vertex*3+2]===0&&preparedIds[vertex]!>=0)windBasis[vertex*4]=preparedIds[vertex]!;
        mesh.geometry.setAttribute('windRoot',new THREE.BufferAttribute(windRoot,3));
        mesh.geometry.setAttribute('windBasis',new THREE.BufferAttribute(windBasis,4));
        mesh.material=mesh.userData.referenceCompanion==='wear'?this.wearWind!:mesh instanceof THREE.Mesh&&this.sharedTreeMeshes.has(mesh)?this.treeMaterial():this.texturesEnabled?this.windTextured:this.windPlain;
      }
      for(const id of treeIds){const hit=this.treeHits.get(id);if(hit)hit.angle=NaN;}
      // Every new actual resident geometry needs address publication, even
      // when its canonical variant set reuses an existing admitted texture.
      this.preparedResources?.setResidents(key,group.children.flatMap(object=>object instanceof THREE.Mesh&&!object.userData.referenceCompanion?[object.geometry]:[]));
      this.chunks.set(key,{signature,group,identities:new Map(chunk.map(r=>[r.id,identity(r)])),originalSizes:new Map(sizes),currentSizes:new Map(sizes),visibleKeys,treeIds,treeModels:[...models.values()],treeCount,anonymousTreeCount});
      if(this.targetPreviewIds.size&&chunk.some(r=>this.targetPreviewIds.has(r.id)))this.targetTint.apply(group,this.targetPreviewIds);
      }finally{disposeTreeResources([...treeClones],'Unconsumed prepared tree template cleanup failed');}
    }
    this.refreshTreeCensus();
  }

}
