/** Exact shared paint residency and coverage-only repaint; full authored raster retained. */
import * as THREE from 'three/webgpu';
import {uniform,texture,uv,vec2,vec3,vec4,ivec2,float,Fn,If,varying,mix,smoothstep,workingToColorSpace,colorSpaceToWorking} from 'three/tsl';
import {metadataTexel} from './surfaces/MetadataTexel';
import {SharedSurfacePreparationRegistry} from './surfaces/SharedSurfacePreparation';
import {PreparedFaceStrokes} from './surfaces/PreparedFaceStrokes';
import {REFERENCE_PAINTER_SOURCE_SHA256} from './origami/reference-painter';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,normalizeGraphicsStylePreferences,graphicsStylePipelineKey,type GraphicsStylePreferences,type GraphicsStylePipelineKey} from '../ui3d/native-preferences';
import {packReferencePaintPixels,type ReferenceEdgePixels,type ReferencePaintDescriptor} from './origami/reference-paint-library';
import {referenceEdgeVisuals,type ReferenceEdgeVisuals} from './origami/reference-edges';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,PROTECTED_REFERENCE_PAINT_DESCRIPTORS,humanBaseProfileIds,humanVariantDescriptor,GENERIC_REFERENCE_PROFILE} from './origami/reference-profiles';
import {physicalPaintMetric,applyPhysicalPaintMetric,referencePaintBumpNormal} from './origami/paint-metric';
import {updateOrigamiBrushGeometry} from './origami/brush-geometry';
import {VirtualPaintPool,type VirtualPaintDescriptor,type PaintAdmissionPlan} from './origami/virtual-paint-pool';
import {bakeResidentPaintToSink} from './origami/reference-resident-paint-library';

import {GAME_USED_BESTIARY_VIRTUAL_IDS,GAME_REQUIRED_VIRTUAL_IDS78} from './origami/game-paint-residency';
import {referenceCoverageKey} from './origami/reference-coverage';
import {bakeCheckpointPaintToSink,replayCheckpointMaskR8} from './origami/checkpoint-paint-baker';
import {createGlobalReliefLod,installGlobalReliefLod,type GlobalReliefLod} from './origami/relief-lod';

interface CoverageCheckpoint {readonly coverageSeed:number;readonly kraft:boolean;readonly signature:string}

/** Synchronous construction scope; each renderer owns its textures/settings. */
let constructing:GraphicsStyleContext|undefined;
export function currentGraphicsStyle():GraphicsStyleContext|undefined{return constructing;}
export function withGraphicsStyle<T>(context:GraphicsStyleContext,create:()=>T):T{const previous=constructing;constructing=context;try{return create();}finally{constructing=previous;}}
const LAYERS_PER_BANK=256,MAX_BANKS=8,PIXELS_PER_LAYER=512*512*4;
function arrayTexture(data:Uint8Array,depth:number,size=512):THREE.DataArrayTexture {
 const map=new THREE.DataArrayTexture(data,size,size,depth);map.format=THREE.RGBAFormat;map.colorSpace=THREE.SRGBColorSpace;
 map.flipY=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}
function flipRows(data:Uint8Array,width:number,height:number):Uint8Array{const result=new Uint8Array(data.length),stride=width*4;for(let y=0;y<height;y++)result.set(data.subarray(y*stride,(y+1)*stride),(height-1-y)*stride);return result;}
function edgeTexture(data:Uint8Array,color=false):THREE.DataTexture {
 const map=new THREE.DataTexture(flipRows(data,512,128),512,128,THREE.RGBAFormat);map.flipY=false;map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.ClampToEdgeWrapping;
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}
export interface HumanPaintAppearance {skin:number;hair:number;shirt:number;outerwear?:number;pants?:number;hat?:number;vest?:number;reconArmor?:number;plate?:number}
export interface GraphicsStyleContextOptions {staticDescriptors?:readonly VirtualPaintDescriptor[]}

/** Independent source 512² color/height layers preserve the authored brushwork,
 * UVs, seeds and mips while sharing one material across a batch. */
export class GraphicsStyleContext {
 readonly surfacePreparation=new SharedSurfacePreparationRegistry();
 readonly preparedStrokes:PreparedFaceStrokes;
 preferences:GraphicsStylePreferences;
 pipelineKey:GraphicsStylePipelineKey;
 reliefEnabled:boolean;
 reliefLod:GlobalReliefLod|undefined;
 readonly impasto=uniform(1);readonly edges=uniform(.65);readonly wear=uniform(.75);readonly contour=uniform(.60);
 /** Image encoding is data shared by every surface. It never selects models,
  * renderer instances or a second family of material/lighting programs. */
 readonly surfaceEncoding=uniform(0);
 readonly contourSpan=uniform(.6675);readonly lineOpacity=uniform(.45475625);readonly wearOpacity=uniform(.560625);
 /** Both edge looks share one geometry and draw. Black takes precedence at
  * equal intensity; reducing it progressively reveals the original kraft. */
 readonly blackEdges=uniform(.45475625);readonly lineColor=uniform(new THREE.Color(0));
 readonly edgeWidth=uniform(1);
 readonly strokeImperfection=uniform(.45);
 readonly brushColor=uniform(new THREE.Color(0x241c18));
 edgeVisuals:ReferenceEdgeVisuals=referenceEdgeVisuals();
 private colorArray?:THREE.DataArrayTexture;private readonly banks:THREE.DataArrayTexture[]=[];
 private paperArray?:THREE.DataArrayTexture;private coverageArray?:THREE.DataArrayTexture;
 private paperHeightArray?:THREE.DataArrayTexture;
 private faceProfilesTexture?:THREE.DataTexture;
 private readonly paintPool:VirtualPaintPool;
 private readonly activeBankCount=uniform(0);private readonly genericFaceLayer=uniform(0);
 private lastPaintVersion=-1;private admissionDepth=0;private repaintRequested=false;
 private atlasPaintEpoch=0;
 private protectedDemandDeclared=false;
 /** All game-static pigments are requested before the first Gouache flush,
  * ahead of dynamic human profiles. Physical assignments never move. A
  * specialized producer may therefore bind bank0 without eight alternatives;
  * prove this at publication, never by rescanning during ordinary rendering. */
 private assertGameStaticPigmentBank(plan:PaintAdmissionPlan):void{
  const incoming=new Map(plan.entries.map(entry=>[entry.virtualId,entry.pigmentLayer]));
  for(const id of GAME_REQUIRED_VIRTUAL_IDS78){const layer=incoming.get(id)??this.paintPool.resolve(id)?.[0];if(layer===undefined||layer<0||layer>=LAYERS_PER_BANK)throw Error('Game-static pigment escaped its admitted bank0 domain');}
 }
 private edgeMaps?:{color?:THREE.DataTexture;alpha:THREE.DataTexture;bump?:THREE.DataTexture};
 private edgePixelsPrepared=false;
 private readonly sharedSurfaceRefreshers=new Set<()=>void>();
 private readonly sharedPaintSettingsRefreshers=new Set<()=>void>();
 private bakedRefreshed=false;private coverageCheckpoints=new Map<number,CoverageCheckpoint>();
 private lastReplayMode:'none'|'full'|'mask'='none';
 private bakedFill=-1;private fillTimer?:ReturnType<typeof setTimeout>;
 private readonly wearGeometries=new Set<THREE.BufferGeometry>();
 private readonly brushGeometries=new Map<object,{geometry:THREE.BufferGeometry;owners:Set<THREE.BufferGeometry>;width:number;roughness:number}>();
 private readonly brushOwners=new Map<THREE.BufferGeometry,()=>void>();
 private readonly edgeObjects=new Map<THREE.Object3D,'line'|'wear'>();
 private readonly geometryPaintIds=new WeakMap<THREE.BufferGeometry,{attribute:THREE.BufferAttribute|THREE.InterleavedBufferAttribute;version:number;ids:readonly number[]}>();
 private readonly humanIds=humanBaseProfileIds();private readonly appearanceRows=new Map<string,number>();
 private rowsData?:Float32Array;private rowsTexture?:THREE.DataTexture;
 constructor(settings:GraphicsStylePreferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES},options:GraphicsStyleContextOptions={}) {
  this.paintPool=new VirtualPaintPool(PROTECTED_REFERENCE_PAINT_DESCRIPTORS);for(const descriptor of BASE_REFERENCE_PAINT_DESCRIPTORS.slice(PROTECTED_REFERENCE_PAINT_DESCRIPTORS.length))this.paintPool.register(descriptor);for(const descriptor of options.staticDescriptors??[])this.paintPool.register(descriptor);this.paintPool.sealStaticCatalog();
  this.preferences=normalizeGraphicsStylePreferences(settings);this.pipelineKey=graphicsStylePipelineKey(this.preferences);
  this.preparedStrokes=new PreparedFaceStrokes(this.surfacePreparation,()=>this.preferences);
  this.reliefEnabled=this.preferences.impasto>0;
  this.reliefLod=createGlobalReliefLod(this.reliefEnabled);this.update(settings);
 }
 private ensureRows():THREE.DataTexture{if(!this.rowsTexture){this.rowsData=new Float32Array(12*4096);this.rowsData.set(this.paintPool.humanRowsData());this.rowsTexture=new THREE.DataTexture(this.rowsData,12,4096,THREE.RedFormat,THREE.FloatType);this.rowsTexture.minFilter=this.rowsTexture.magFilter=THREE.NearestFilter;this.rowsTexture.needsUpdate=true;}return this.rowsTexture;}
 /** Binding objects only. No Canvas, raster, source painter or bulk palette. */
 private ensurePaintBindings():void{
  if(this.admissionDepth)throw Error('Material construction during paint discovery; discover first, then flush, then construct.');
  if(this.colorArray)return;
  for(let bank=0;bank<MAX_BANKS;bank++)this.banks.push(arrayTexture(new Uint8Array(4),1,1));this.colorArray=this.banks[0];
  this.paperArray=arrayTexture(new Uint8Array([0,0,0,255]),1,1);this.paperArray.wrapS=this.paperArray.wrapT=THREE.ClampToEdgeWrapping;
  this.coverageArray=new THREE.DataArrayTexture(new Uint8Array([255]),1,1,1);this.coverageArray.format=THREE.RedFormat;this.coverageArray.wrapS=this.coverageArray.wrapT=THREE.ClampToEdgeWrapping;this.coverageArray.magFilter=THREE.LinearFilter;this.coverageArray.minFilter=THREE.LinearMipmapLinearFilter;this.coverageArray.generateMipmaps=true;this.coverageArray.needsUpdate=true;
  this.faceProfilesTexture=new THREE.DataTexture(this.paintPool.ensureMetadataData(),256,256,THREE.RGFormat,THREE.FloatType);this.faceProfilesTexture.colorSpace=THREE.NoColorSpace;this.faceProfilesTexture.minFilter=this.faceProfilesTexture.magFilter=THREE.NearestFilter;this.faceProfilesTexture.generateMipmaps=false;this.faceProfilesTexture.needsUpdate=true;
 }
 profileId(key:string):number{return this.paintPool.id(key);}
 requirePaint(owner:string,virtualIds:readonly number[]):void{this.paintPool.requireProfiles(owner,virtualIds);}
 requireHumanPaintRow(owner:string,row:number):void{this.paintPool.requireHumanRow(owner,row);}
 releasePaint(owner:string):void{this.paintPool.release(owner);}
 declareSpeciesPaint(species:string,virtualIds:readonly number[]):void{this.paintPool.declareSpecies(species,virtualIds);}
 requireSpeciesPaint(owner:string,actualSpecies:readonly string[]):void{this.paintPool.requireSpecies(owner,actualSpecies);}
 /** Called for ACTIVE rigs in WildlifeLayer.update, never from prepare().
  * animalPaint is RGB+virtual profile, hence component.w (not component.x). */
 requireAnimalPaintGeometry(owner:string,geometry:THREE.BufferGeometry):void{
  const attribute=geometry.getAttribute('animalPaint');if(!attribute)return;
  const version=attribute instanceof THREE.InterleavedBufferAttribute?attribute.data.version:attribute.version;let cached=this.geometryPaintIds.get(geometry);
  if(!cached||cached.attribute!==attribute||cached.version!==version){const used=new Set<number>(),stride=geometry.userData.animalSurfaceProfileStride as number|undefined;for(let vertex=0;vertex<attribute.count;vertex++){const word=attribute.getComponent(vertex,3),id=stride===undefined?word:word%stride;if(!Number.isSafeInteger(id)||id<0)throw Error('Invalid virtual animal paint ID');used.add(id);}cached={attribute,version,ids:[...used].sort((a,b)=>a-b)};this.geometryPaintIds.set(geometry,cached);}
  this.paintPool.requireProfiles(owner,cached.ids);
 }
 paintResidency(){return this.paintPool.stats();}
 /** Discovery must NOT construct materials or compile. Flush once, then build
  * the shaders/rigs, then publish the cohort. Owner schedules this before draw. */
 preparePaintBatch<T,R>(discover:()=>T,construct:(discovery:T)=>R):R{
  if(this.admissionDepth)throw Error('Nested paint admission batch');this.admissionDepth++;
  let discovery:T;try{discovery=discover();}finally{this.admissionDepth--;}
  this.flushPaint();const result=construct(discovery!);this.assertPaintReadyForDraw();return result;
 }
 /** Explicit gallery/qualification scope, NEVER the normal wildlife prepare. */
 prepareAllStaticPaintForCatalog(owner='explicit-catalog-all'):()=>void{
  this.requirePaint(owner,Array.from({length:this.paintPool.stats().staticVirtualCount},(_,id)=>id));this.flushPaint();return()=>this.releasePaint(owner);
 }
 assertPaintReadyForDraw():void{
  if(!this.origami||this.lastPaintVersion===this.paintPool.version)return;
  if(this.paintPool.plan().entries.length)throw Error('Unprepared paint demand; admit the cohort before publishing it.');
  // Owner/row bookkeeping may change without introducing a new resident ID.
  this.lastPaintVersion=this.paintPool.version;
 }
 get origami():boolean{return this.preferences.style==='origami';}
 get wearEnabled():boolean{return this.preferences.wear>0;}
 /** Feature changes rebuild nodes on the same material; image changes do not.
  * Callers release their registration when that material is disposed. */
 trackSharedSurfaceRefresh(refresh:()=>void):()=>void{this.sharedSurfaceRefreshers.add(refresh);return()=>{this.sharedSurfaceRefreshers.delete(refresh);};}
 get preparedPaintRevision():number{return this.atlasPaintEpoch;}
 genericPaintSemanticKey():string{const source=PROTECTED_REFERENCE_PAINT_DESCRIPTORS[0]!,seed=this.bakedRefreshed?(source.refreshSeed??source.seed):source.seed;return JSON.stringify(['P0-separated512-v1',REFERENCE_PAINTER_SOURCE_SHA256,source.key,source.config,seed,this.preferences.contourImperfection]);}
 trackSharedPaintSettingsRefresh(refresh:()=>void):()=>void{this.sharedPaintSettingsRefreshers.add(refresh);return()=>{this.sharedPaintSettingsRefreshers.delete(refresh);};}
 update(settings:GraphicsStylePreferences):void {
  const previousPaintSettings=JSON.stringify(this.preferences),next=normalizeGraphicsStylePreferences(settings);
  const previousContourSpan=this.contourSpan.value;
  const key=graphicsStylePipelineKey(next),featuresChanged=key!==this.pipelineKey,reliefChanged=this.reliefEnabled!==(next.impasto>0);
  this.pipelineKey=key;this.reliefEnabled=next.impasto>0;
  if(reliefChanged){this.reliefLod=createGlobalReliefLod(this.reliefEnabled);this.repaintRequested=true;if(!this.reliefEnabled){this.paperHeightArray?.dispose();this.paperHeightArray=undefined;}}
  if(featuresChanged){this.edgePixelsPrepared=false;if(next.wear===0&&this.edgeMaps){this.edgeMaps.color?.dispose();this.edgeMaps.bump?.dispose();delete this.edgeMaps.color;delete this.edgeMaps.bump;}}
  this.preferences=next;this.impasto.value=this.preferences.impasto;this.edges.value=this.preferences.edges;this.wear.value=this.preferences.wear;this.contour.value=this.preferences.contourImperfection;
  this.surfaceEncoding.value=this.origami?1:0;
  // Prepare all game pigments before play; an arriving species never starts a Canvas bake.
  if(this.origami&&!this.protectedDemandDeclared){this.paintPool.requireProfiles('protected-core43',Array.from({length:PROTECTED_REFERENCE_PAINT_DESCRIPTORS.length},(_,id)=>id));this.protectedDemandDeclared=true;}
  if(this.origami)this.requirePaint('all-game-best35',GAME_USED_BESTIARY_VIRTUAL_IDS);
  if(this.edgeMaps&&this.origami)this.ensureEdgeMaps();
  this.edgeVisuals=referenceEdgeVisuals(this.preferences.edges,this.preferences.wear,this.preferences.contourImperfection);
  this.contourSpan.value=this.edgeVisuals.contourSpan;this.wearOpacity.value=this.edgeVisuals.wearOpacity;
  this.blackEdges.value=this.preferences.blackEdges;
  this.edgeWidth.value=this.preferences.edgeWidth;
  this.strokeImperfection.value=this.preferences.strokeImperfection;
  const legacy=this.edgeVisuals.showLines?this.edgeVisuals.lineOpacity:0,black=this.preferences.blackEdges,alpha=Math.max(legacy,black);
  const ink=alpha>0?black/alpha:0;
  this.lineOpacity.value=alpha;this.lineColor.value.set(0xd7b384).multiplyScalar(1-ink);
  this.brushColor.value.set(0xd7b384).lerp(new THREE.Color(0x241c18),ink);
  for(const entry of this.brushGeometries.values())if(entry.width!==this.preferences.edgeWidth||entry.roughness!==this.preferences.strokeImperfection){this.refreshBrushGeometry(entry.geometry);entry.width=this.preferences.edgeWidth;entry.roughness=this.preferences.strokeImperfection;}
  if(this.wearEnabled&&this.contourSpan.value!==previousContourSpan)for(const geometry of this.wearGeometries)this.expandWear(geometry);for(const [object,kind]of this.edgeObjects)this.refreshEdgeObject(object,kind);
  if(this.bakedFill>=0&&this.bakedFill!==this.preferences.contourImperfection){if(this.fillTimer)clearTimeout(this.fillTimer);this.fillTimer=setTimeout(()=>{this.fillTimer=undefined;this.repaintRequested=true;this.flushPaint();},60);}
  if(featuresChanged)for(const refresh of this.sharedSurfaceRefreshers)refresh();
  if(previousPaintSettings!==JSON.stringify(this.preferences)){this.surfacePreparation.invalidate();for(const refresh of this.sharedPaintSettingsRefreshers)refresh();}
 }
 private expandWear(geometry:THREE.BufferGeometry):void {
  const base=geometry.userData.referenceWearBasePositions as Float32Array|undefined,expand=geometry.userData.referenceWearExpandDirections as Float32Array|undefined;if(!base||!expand)return;
  const position=geometry.getAttribute('position');for(let i=0;i<position.count;i++)position.setXYZ(i,base[i*3]!+expand[i*3]!*this.contourSpan.value,base[i*3+1]!+expand[i*3+1]!*this.contourSpan.value,base[i*3+2]!+expand[i*3+2]!*this.contourSpan.value);
  position.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 trackWearGeometry(geometry:THREE.BufferGeometry):()=>void{if(!this.wearEnabled)throw Error('Disabled Origami wear must not allocate or register geometry');this.wearGeometries.add(geometry);this.expandWear(geometry);return()=>this.untrackWearGeometry(geometry);}
 untrackWearGeometry(geometry:THREE.BufferGeometry):void{this.wearGeometries.delete(geometry);}
 prepareBrushGeometry(geometry:THREE.BufferGeometry):()=>void {
  const previous=this.brushOwners.get(geometry);if(previous)return previous;
  const key=(geometry.userData.referenceBrushPositionStorage as object|undefined)??geometry;
  let entry=this.brushGeometries.get(key);if(!entry){entry={geometry,owners:new Set(),width:this.preferences.edgeWidth,roughness:this.preferences.strokeImperfection};this.brushGeometries.set(key,entry);this.refreshBrushGeometry(geometry);}
  entry.owners.add(geometry);let active=true;
  const release=()=>{if(!active)return;active=false;geometry.removeEventListener('dispose',release);this.brushOwners.delete(geometry);entry!.owners.delete(geometry);if(!entry!.owners.size)this.brushGeometries.delete(key);else if(entry!.geometry===geometry)entry!.geometry=entry!.owners.values().next().value!;};
  this.brushOwners.set(geometry,release);geometry.addEventListener('dispose',release);return release;
 }
 refreshBrushGeometry(geometry:THREE.BufferGeometry,startVertex=0,vertexCount=Infinity):void {const sphere=geometry.userData.referenceBrushConservativeSphere as THREE.Sphere|undefined;updateOrigamiBrushGeometry(geometry,this.preferences.edgeWidth,this.preferences.strokeImperfection,startVertex,vertexCount);if(sphere)geometry.boundingSphere=(geometry.boundingSphere??new THREE.Sphere()).copy(sphere);}
 trackEdgeObject(object:THREE.Object3D,kind:'line'|'wear'):()=>void{this.edgeObjects.set(object,kind);this.refreshEdgeObject(object,kind);return()=>this.untrackEdgeObject(object);}
 untrackEdgeObject(object:THREE.Object3D):void{this.edgeObjects.delete(object);}
 refreshEdgeObject(object:THREE.Object3D,kind=this.edgeObjects.get(object)):void{if(kind)object.visible=this.surfaceEncoding.value>0&&object.userData.origamiOwnerVisible!==false&&(kind==='line'?this.lineOpacity.value>0:this.edgeVisuals.showWear&&object.userData.origamiTexturesEnabled!==false);}
 /** Flush pending palette work before returning material texture bindings. */
 flushPaint():void {
  if(!this.origami)return;if(this.admissionDepth)throw Error('Raster requested during paint discovery; discover all IDs before preparing.');
  const fill=this.fillTimer?this.bakedFill:this.preferences.contourImperfection;
  const repaint=this.repaintRequested||(this.bakedFill<0&&fill!==.60)||(this.bakedFill>=0&&this.bakedFill!==fill);
  if(this.lastPaintVersion===this.paintPool.version&&!repaint)return;
  const plan=this.paintPool.plan(repaint);
  this.assertGameStaticPigmentBank(plan);
  if(!plan.entries.length){this.lastPaintVersion=this.paintPool.version;return;}
  this.ensurePaintBindings();
  const oldFaceDepth=this.paperArray!.image.width===512?this.paperArray!.image.depth:0;
  const maskOnly=repaint&&this.bakedRefreshed&&plan.refreshed&&oldFaceDepth===plan.faceDepth&&plan.entries.every(entry=>{
   const checkpoint=this.coverageCheckpoints.get(entry.faceLayer);return !entry.newlyResident&&checkpoint!==undefined&&Number.isSafeInteger(checkpoint.coverageSeed)&&checkpoint.signature===referenceCoverageKey(entry.descriptor);
  });
  if(maskOnly){
   const coveragePixels=new Uint8Array(plan.faceDepth*512*512),done=new Set<number>();
   for(const entry of plan.entries){if(done.has(entry.faceLayer))continue;const checkpoint=this.coverageCheckpoints.get(entry.faceLayer)!;
    coveragePixels.set(replayCheckpointMaskR8(checkpoint.coverageSeed,fill,checkpoint.kraft),entry.faceLayer*512*512);done.add(entry.faceLayer);
   }
   // Every mask and the final capacity check succeed before any live byte,
   // pool or fill changes. Existing Texture/Source/buffer identity is retained.
   const destination:unknown=this.coverageArray!.image.data;
   if(!(destination instanceof Uint8Array)||destination.length!==coveragePixels.length||this.coverageArray!.image.width!==512||this.coverageArray!.image.height!==512)throw Error('Prepared mask destination capacity changed');
   const paperDestination:unknown=this.paperArray!.image.data;
   if(!(paperDestination instanceof Uint8Array)||paperDestination.length!==coveragePixels.length*4)throw Error('Prepared paper/coverage destination capacity changed');
   this.paintPool.commit(plan);destination.set(coveragePixels);this.coverageArray!.needsUpdate=true;
   for(let pixel=0;pixel<coveragePixels.length;pixel++)paperDestination[pixel*4+3]=coveragePixels[pixel]!;
   this.paperArray!.needsUpdate=true;
   this.bakedFill=fill;this.bakedRefreshed=plan.refreshed;this.repaintRequested=false;this.lastPaintVersion=this.paintPool.version;this.lastReplayMode='mask';this.atlasPaintEpoch++;this.surfacePreparation.invalidate();for(const refresh of this.sharedPaintSettingsRefreshers)refresh();return;
  }
  const faceDirty=repaint||plan.faceDepth!==oldFaceDepth;
  const nextCheckpoints=new Map<number,CoverageCheckpoint>(repaint?undefined:this.coverageCheckpoints);
  const paperPixels=faceDirty?new Uint8Array(plan.faceDepth*PIXELS_PER_LAYER):undefined,coveragePixels=faceDirty?new Uint8Array(plan.faceDepth*512*512).fill(255):undefined,
   paperHeightPixels=faceDirty&&this.reliefEnabled?new Uint8Array(plan.faceDepth*512*512):undefined;
  if(faceDirty&&!repaint&&oldFaceDepth){paperPixels!.set(this.paperArray!.image.data as Uint8Array);coveragePixels!.set(this.coverageArray!.image.data as Uint8Array);if(paperHeightPixels&&this.paperHeightArray?.image.width===512)paperHeightPixels.set(this.paperHeightArray.image.data as Uint8Array);}
  const touched=new Set(plan.entries.map(entry=>Math.floor(entry.pigmentLayer/LAYERS_PER_BANK)));
  const uploads=new Map<number,{data:Uint8Array;size:1|512;depth:number}>();
  for(let bank=0;bank<MAX_BANKS;bank++){
   const shape=plan.bankShapes[bank]!,old=this.banks[bank]!;
   if(!touched.has(bank)&&old.image.width===shape.size&&old.image.depth===shape.depth)continue;
   const data=new Uint8Array(shape.size*shape.size*shape.depth*4);
   if(!repaint&&old.image.width===shape.size)data.set(old.image.data as Uint8Array);
   uploads.set(bank,{...shape,data});
  }
  const capturedFaces=new Set<number>(),scratch=new Uint8Array(PIXELS_PER_LAYER);
  bakeCheckpointPaintToSink(plan.entries.map(entry=>entry.descriptor),fill,(index,color,bump,face)=>{
   const entry=plan.entries[index]!,bank=Math.floor(entry.pigmentLayer/LAYERS_PER_BANK),upload=uploads.get(bank);
   if(!upload)throw Error('Paint admission destination missing');
   packReferencePaintPixels(color,bump,512,512,1,scratch);upload.data.set(scratch,(entry.pigmentLayer%LAYERS_PER_BANK)*PIXELS_PER_LAYER);
   const signature=referenceCoverageKey(entry.descriptor),existing=nextCheckpoints.get(entry.faceLayer);
   if(Number.isSafeInteger(face.coverageSeed)){
    if(existing&&(existing.coverageSeed!==face.coverageSeed||existing.signature!==signature))throw Error('Shared face checkpoint disagrees across RGB variants');
    nextCheckpoints.set(entry.faceLayer,{coverageSeed:face.coverageSeed,kraft:entry.descriptor.config.kraftEdgeWear??true,signature});
   }
   if(faceDirty&&!capturedFaces.has(entry.faceLayer)&&(repaint||entry.faceLayer>=oldFaceDepth)){
    packReferencePaintPixels(face?.paperColorRgba??color,face?.paperBumpRgba??bump,512,512,1,scratch);paperPixels!.set(scratch,entry.faceLayer*PIXELS_PER_LAYER);
    if(face)for(let y=0;y<512;y++)for(let x=0;x<512;x++)coveragePixels![entry.faceLayer*512*512+(511-y)*512+x]=face.coverageRgba[(y*512+x)*4+3]!;
    for(let pixel=0;pixel<512*512;pixel++){const target=entry.faceLayer*512*512+pixel,rgba=target*4;if(paperHeightPixels)paperHeightPixels[target]=paperPixels![rgba+3]!;paperPixels![rgba+3]=coveragePixels![target]!;}
    capturedFaces.add(entry.faceLayer);
   }
  },{includeHeight:this.reliefEnabled});
  // No live texture or lookup is changed before all Canvas/copy work succeeds.
  // Publication is synchronous between owner render calls, not a GPU fence.
  this.paintPool.commit(plan);
  for(const [bank,{data,size,depth}]of uploads){const map=this.banks[bank]!;map.dispose();map.image={data,width:size,height:size,depth};map.needsUpdate=true;}
  if(faceDirty){
   this.paperArray!.dispose();this.paperArray!.image={data:paperPixels!,width:512,height:512,depth:plan.faceDepth};this.paperArray!.needsUpdate=true;
   this.coverageArray!.dispose();this.coverageArray!.image={data:coveragePixels!,width:512,height:512,depth:plan.faceDepth};this.coverageArray!.needsUpdate=true;
   if(paperHeightPixels){const map=this.ensurePaperHeightBinding();map.dispose();map.image={data:paperHeightPixels,width:512,height:512,depth:plan.faceDepth};map.needsUpdate=true;}
  }
  this.faceProfilesTexture!.needsUpdate=true;this.genericFaceLayer.value=this.paintPool.resolve(0)?.[1]??0;
  this.activeBankCount.value=Math.max(...plan.bankShapes.map((shape,index)=>shape.size===512?index+1:0));
  this.coverageCheckpoints=nextCheckpoints;this.bakedRefreshed=plan.refreshed;this.lastReplayMode='full';this.bakedFill=fill;this.repaintRequested=false;this.lastPaintVersion=this.paintPool.version;this.atlasPaintEpoch++;this.surfacePreparation.invalidate();for(const refresh of this.sharedPaintSettingsRefreshers)refresh();
 }
 private ensurePaperHeightBinding():THREE.DataArrayTexture{
  if(!this.reliefEnabled)throw Error('Zero relief has no height texture binding');
  if(!this.paperHeightArray){const map=new THREE.DataArrayTexture(new Uint8Array([0]),1,1,1);map.format=THREE.RedFormat;map.colorSpace=THREE.NoColorSpace;map.flipY=false;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;this.paperHeightArray=map;}return this.paperHeightArray;
 }
 /** Placeholders let a Pastel surface compile once without invoking Canvas.
  * They are replaced in-place before Gouache image data is published. */
 private ensureEdgeBindings():void{
  if(!this.edgeMaps){const map=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);map.flipY=false;map.colorSpace=THREE.NoColorSpace;map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.ClampToEdgeWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;this.edgeMaps={alpha:map};}
  const placeholder=(color:boolean)=>{const map=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat);map.flipY=false;map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.ClampToEdgeWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;};
  if(this.wearEnabled&&!this.edgeMaps.color)this.edgeMaps.color=placeholder(true);
  if(this.wearEnabled&&this.reliefEnabled&&!this.edgeMaps.bump)this.edgeMaps.bump=placeholder(false);
 }
 private ensureEdgeMaps():void{
  this.ensureEdgeBindings();if(!this.origami||this.edgePixelsPrepared)return;
  const {edge}=bakeResidentPaintToSink([],{includeEdge:true,includeHeight:this.reliefEnabled,edgeChannels:{color:this.wearEnabled,height:this.wearEnabled&&this.reliefEnabled},edgeSeed:1337,fillImperfection:this.preferences.contourImperfection},()=>{});
  if(!edge)throw Error('Edge painter did not return source maps');this.setEdgeMaps(edge);
 }
 private setEdgeMaps(edge:ReferenceEdgePixels):void{
  if(this.wearEnabled&&!edge.colorRgba)throw Error('Enabled edge wear requires its source color pixels');
  if(this.wearEnabled&&this.reliefEnabled&&!edge.bumpRgba)throw Error('Enabled relief requires its source edge height pixels');
  this.ensureEdgeBindings();const publish=(key:'alpha'|'color'|'bump',pixels:Uint8Array,color=false)=>{const next=edgeTexture(pixels,color),live=this.edgeMaps![key];if(live){live.dispose();live.image=next.image;live.needsUpdate=true;next.dispose();}else this.edgeMaps![key]=next;};
  publish('alpha',edge.alphaRgba);if(this.wearEnabled)publish('color',edge.colorRgba!,true);if(this.wearEnabled&&this.reliefEnabled)publish('bump',edge.bumpRgba!);this.edgePixelsPrepared=true;
 }
 /** Explicit gradients permit sampling inside the bounded opaque-edge branch.
  * No derivative or implicit sample is evaluated in nonuniform control flow. */
 sampleStrokePigment(coordinates:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>):THREE.Node<'vec3'>{
  this.flushPaint();this.ensurePaintBindings();return texture(this.banks[0]!,coordinates).depth(float(0)).grad(dx,dy).rgb;
 }
 sampleStrokeDry(coordinates:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>):THREE.Node<'float'>{this.ensureEdgeMaps();return texture(this.edgeMaps!.alpha,coordinates).grad(dx,dy).g;}
 get paint():THREE.DataArrayTexture{this.flushPaint();this.ensurePaintBindings();return this.colorArray!;}
 /** Read-only diagnostics use original Canvas2D row order. */
 paintLayerData(profileId:number):Uint8Array{this.paintPool.assertResident([profileId]);const local=this.paintPool.resolve(profileId)![0],bank=this.banks[Math.floor(local/LAYERS_PER_BANK)]!,layer=local%LAYERS_PER_BANK,data=bank.image.data as Uint8Array;return flipRows(data.subarray(layer*PIXELS_PER_LAYER,(layer+1)*PIXELS_PER_LAYER),512,512);}
 paintNode(coordinates:THREE.Node<'vec2'>,profile:THREE.Node<'float'>):THREE.Node<'vec4'>{
  this.flushPaint();
  this.ensurePaintBindings();const banks=this.banks,active=this.activeBankCount;
  return Fn(()=>{
   const preparedUv=vec2(0).toVar(),preparedProfile=float(0).toVar(),result=vec4(0).toVar();
   // TSL nodes are lazy: sharing a coordinate expression between bank branches
   // can emit its metric/UV initializer only in the first branch that builds it.
   // Explicit statements must dominate EVERY bank read, while this whole Fn
   // remains inside its caller's Gouache branch (Pastel does no paint work).
   preparedUv.assign(coordinates);preparedProfile.assign(profile);
   If(active.equal(1),()=>{result.assign(texture(banks[0]!,preparedUv).depth(preparedProfile));}).Else(()=>{
    for(let bank=0;bank<MAX_BANKS;bank++)If(active.greaterThan(bank).and(preparedProfile.greaterThanEqual(bank*LAYERS_PER_BANK)).and(preparedProfile.lessThan((bank+1)*LAYERS_PER_BANK)),()=>{
     result.assign(texture(banks[bank]!,preparedUv).depth(preparedProfile.mod(LAYERS_PER_BANK)));
    });
   });return result;
  })();
 }
 resolvedPaintIdsNode(profile:THREE.Node<'float'>):THREE.Node<'vec2'>{this.flushPaint();this.ensurePaintBindings();return metadataTexel(this.faceProfilesTexture!,ivec2(profile.mod(256).toInt(),profile.div(256).floor().toInt())).rg;}
 faceProfileNode(profile:THREE.Node<'float'>):THREE.Node<'float'>{return this.resolvedPaintIdsNode(profile).y;}
 genericPaintIdsNode(fillCoverage=true):THREE.Node<'vec2'>{this.requirePaint('generic-surfaces',[GENERIC_REFERENCE_PROFILE]);return vec2(GENERIC_REFERENCE_PROFILE,fillCoverage?this.genericFaceLayer:float(0));}
 /** Only a producer whose profile is intrinsically virtual generic0 may use
  * this capability. VirtualPaintPool reserves physical0 for that identity even
  * when generic0 is admitted after more than256 unrelated resident pigments.
  * Explicit-profile producers retain the complete eight-bank graph. */
 private surfacePigmentNode(coordinates:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,genericOnly:boolean,gameStaticBank0=false):THREE.Node<'vec4'>{
  if(!genericOnly&&!gameStaticBank0)return this.paintNode(coordinates,profile);
  this.flushPaint();this.ensurePaintBindings();return texture(this.banks[0]!,coordinates).depth(genericOnly?float(0):profile);
 }
 facePaintNode(pigmentUv:THREE.Node<'vec2'>,faceUv:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,faceProfile:THREE.Node<'float'>,includeHeight=true,opaqueColorEndpoints=false,genericOnly=false,gameStaticBank0=false,coverageOverride?:THREE.Node<'float'>):THREE.Node<'vec4'>{
  if(opaqueColorEndpoints&&!this.reliefEnabled)return this.facePaintOpaqueEndpoints(pigmentUv,faceUv,profile,faceProfile,includeHeight,genericOnly,gameStaticBank0,coverageOverride);
  const pigment=this.surfacePigmentNode(pigmentUv,profile,genericOnly,gameStaticBank0).toVar(),paper=texture(this.paperArray!,faceUv).depth(faceProfile).toVar(),coverage=coverageOverride??paper.a;
  // Source Canvas composition uses encoded sRGB. The opaque repeating
  // pigment never contains a paper frame; only this raw face mask exposes it.
  // ColorSpaceNode is a raw node class in r186: wrap it before swizzling.
  const paperEncoded=vec4(workingToColorSpace(vec4(paper.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb,pigmentEncoded=vec4(workingToColorSpace(vec4(pigment.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb;
  const color=vec4(colorSpaceToWorking(vec4(mix(paperEncoded,pigmentEncoded,coverage),1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb;
  return vec4(color,includeHeight&&this.reliefEnabled?mix(texture(this.ensurePaperHeightBinding(),faceUv).depth(faceProfile).r,pigment.a,coverage):float(0));
 }
 private facePaintOpaqueEndpoints(pigmentUv:THREE.Node<'vec2'>,faceUv:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,faceProfile:THREE.Node<'float'>,includeHeight:boolean,genericOnly:boolean,gameStaticBank0:boolean,coverageOverride?:THREE.Node<'float'>):THREE.Node<'vec4'>{
  const pigment=this.surfacePigmentNode(pigmentUv,profile,genericOnly,gameStaticBank0).toVar(),paper=texture(this.paperArray!,faceUv).depth(faceProfile).toVar(),coverage=(coverageOverride??paper.a).toVar();
  const color=Fn(()=>{
   // Preserve implicit derivatives: every texture read precedes the varying
   // coverage condition. Only redundant endpoint color conversions are skipped.
   const sampledPigment=pigment.toVar('origamiEndpointPigment'),sampledPaper=paper.toVar('origamiEndpointPaper'),sampledCoverage=coverage.toVar('origamiEndpointCoverage'),result=vec3(0).toVar('origamiEndpointColor');
   If(sampledCoverage.equal(1),()=>{result.assign(sampledPigment.rgb);})
   .ElseIf(sampledCoverage.equal(0),()=>{result.assign(sampledPaper.rgb);})
   .Else(()=>{
    const paperEncoded=vec4(workingToColorSpace(vec4(sampledPaper.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb,pigmentEncoded=vec4(workingToColorSpace(vec4(sampledPigment.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb;
    result.assign(vec4(colorSpaceToWorking(vec4(mix(paperEncoded,pigmentEncoded,sampledCoverage),1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb);
   });
   return result;
  })();
  return vec4(color,includeHeight&&this.reliefEnabled?mix(texture(this.ensurePaperHeightBinding(),faceUv).depth(faceProfile).r,pigment.a,coverage):float(0));
 }
 faceHeightNode(pigmentUv:THREE.Node<'vec2'>,faceUv:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,faceProfile:THREE.Node<'float'>,genericOnly=false,gameStaticBank0=false,coverageOverride?:THREE.Node<'float'>):THREE.Node<'float'>{if(!this.reliefEnabled)return float(0);return mix(texture(this.ensurePaperHeightBinding(),faceUv).depth(faceProfile).r,this.surfacePigmentNode(pigmentUv,profile,genericOnly,gameStaticBank0).a,coverageOverride??texture(this.paperArray!,faceUv).depth(faceProfile).a);}
 /** Exact original KM coverage sample, also used by true-polygon tree masks. */
 faceCoverageNode(coordinates:THREE.Node<'vec2'>,faceProfile:THREE.Node<'float'>,levelZero=false):THREE.Node<'float'>{this.flushPaint();this.ensurePaintBindings();const sample=texture(this.paperArray!,coordinates).depth(faceProfile);return levelZero?sample.level(float(0)).a:sample.a;}
 /** Canonical reference adapter only. Product contours are painted triangles. */
 createLineMaterial(positionNode:THREE.Node|null):THREE.LineBasicNodeMaterial {const material=new THREE.LineBasicNodeMaterial({transparent:true});material.userData.origamiContour=true;material.userData.origamiUnlitContour=true;material.colorNode=this.lineColor;material.positionNode=positionNode;material.opacityNode=this.lineOpacity;return material;}
 createBrushMaterial(positionNode:THREE.Node|null,coordinates:THREE.Node<'vec2'>=uv()):THREE.MeshStandardNodeMaterial {
  const material=new THREE.MeshStandardNodeMaterial({transparent:true,depthWrite:false,depthTest:true,alphaTest:.012,flatShading:true,roughness:.94,metalness:0,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  material.name='Origami — painted gouache brush strokes';material.userData.origamiContour=true;material.userData.origamiBrush=true;material.positionNode=positionNode;
  applyOrigamiSurface(material,this.brushColor.rgb,coordinates,this,undefined,false,false);
  this.ensureEdgeMaps();
  const edge=this.edgeMaps!,raw=varying(coordinates,'v_origamiBrushUv');
  const dry=texture(edge.alpha,raw).g,soft=smoothstep(0,.035,raw.y).mul(float(1).sub(smoothstep(.90,1,raw.y)));
  material.opacityNode=this.lineOpacity.mul(soft).mul(mix(float(1),dry.mul(.65).add(.35),this.strokeImperfection));
  return material;
 }
 createWearMaterial(positionNode:THREE.Node|null,coordinates:THREE.Node<'vec2'>=uv()):THREE.MeshStandardNodeMaterial {
  if(!this.wearEnabled)throw Error('Disabled Origami wear must not allocate a material');
  this.ensureEdgeMaps();const edge=this.edgeMaps!,material=new THREE.MeshStandardNodeMaterial({roughness:.94,metalness:0,flatShading:true,transparent:true,alphaTest:.06,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const metric=physicalPaintMetric(coordinates).toVar(),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal();
  const paintUv=applyPhysicalPaintMetric(coordinates,metric,density).mul(vec2(1,4)).toVar();
  material.positionNode=positionNode;material.colorNode=texture(edge.color!,paintUv).rgb;material.opacityNode=texture(edge.alpha,coordinates).g.mul(this.wearOpacity);
  if(this.reliefEnabled){
   const dx=applyPhysicalPaintMetric(coordinates.dFdx(),metric,density).mul(vec2(1,4)),dy=applyPhysicalPaintMetric(coordinates.dFdy(),metric,density).mul(vec2(1,4)),height=texture(edge.bump!,paintUv).r;
   material.normalNode=referencePaintBumpNormal(height,texture(edge.bump!,paintUv.add(dx)).r,texture(edge.bump!,paintUv.add(dy)).r,this.impasto.mul(.045));
   installGlobalReliefLod(material,this.reliefLod);
  }else{material.normalNode=null;material.normalMap=null;material.bumpMap=null;}
  return material;
 }
 registerHumanAppearance(appearance:HumanPaintAppearance):number {
  const colors=[appearance.skin,appearance.shirt,appearance.outerwear??appearance.shirt,appearance.pants??0x3c424a,appearance.hair,appearance.hat??appearance.shirt],extra=[appearance.vest??0x626c60,appearance.reconArmor??0x647d86,appearance.plate??0x7c8186],key=[...colors,...extra].join(':');const old=this.appearanceRows.get(key);if(old!==undefined){this.paintPool.requireHumanRow(`human-row:${old}`,old);return old;}
  const local=(descriptor:ReferencePaintDescriptor):number=>this.paintPool.registerHumanProfile(descriptor);
  const ids=colors.map((color,category)=>local(humanVariantDescriptor(category,color)));ids.push(...this.humanIds.slice(6),...extra.map(color=>local(humanVariantDescriptor(2,color))));
  const row=this.paintPool.registerHumanRow(ids);if(this.rowsData){this.rowsData.set(ids,row*12);this.rowsTexture!.needsUpdate=true;}this.appearanceRows.set(key,row);this.paintPool.requireHumanRow(`human-row:${row}`,row);return row;
 }
 humanProfileNode(baseProfile:THREE.Node<'float'>,row:THREE.Node<'float'>,dye?:THREE.Node<'float'>):THREE.Node<'float'> {
  let category:THREE.Node<'float'>=float(8);for(let i=7;i>=0;i--)category=baseProfile.equal(this.humanIds[i]!).select(float(i),category);
  if(dye)category=dye.equal(-2).and(baseProfile.equal(this.humanIds[2]!)).select(float(9),dye.equal(-42).and(baseProfile.equal(this.humanIds[2]!)).select(float(10),dye.equal(-11).select(float(11),category)));
  // Palette metadata is resolved in the vertex stage. Its UVs must never be
  // replaced by the three paint-UV probes used by the normal/bump sub-build.
  return metadataTexel(this.ensureRows(),ivec2(category.toInt(),row.toInt())).r;
 }
 /** Borrowed upload-order pixels; valid only while the captured paint epoch
  * remains current. Reading never creates a paint or uploads a GPU bank. */
 private readPaintProfile(virtualId:number){this.paintPool.assertResident([virtualId]);const [physicalLayer,faceLayer]=this.paintPool.resolve(virtualId)!;
  const pigment=this.banks[Math.floor(physicalLayer/256)]!.image.data as Uint8Array,paper=this.paperArray!.image.data as Uint8Array,coverage=this.coverageArray!.image.data as Uint8Array;
  return{physicalLayer,faceLayer,pigment:pigment.subarray((physicalLayer%256)*PIXELS_PER_LAYER,(physicalLayer%256+1)*PIXELS_PER_LAYER),paper:paper.subarray(faceLayer*PIXELS_PER_LAYER,(faceLayer+1)*PIXELS_PER_LAYER),coverage:coverage.subarray(faceLayer*512*512,(faceLayer+1)*512*512),orientation:'upload-bottom-up' as const};
 }
 /** Called only under the renderer's exclusive preparation gate. Finish the
  * requested fill before lending pixels across asynchronous GPU preparation. */
 prepareAtlasPaint(){
  if(!this.origami||this.reliefEnabled||this.wearEnabled)throw Error('Opaque atlas requires Origami with relief and wear disabled');
  if(this.fillTimer){clearTimeout(this.fillTimer);this.fillTimer=undefined;this.repaintRequested=true;}
  this.flushPaint();this.ensureEdgeMaps();
  const epoch=this.atlasPaintEpoch,settings=JSON.stringify(this.preferences),alpha=this.edgeMaps!.alpha,data=alpha.image.data;
  if(!(data instanceof Uint8Array))throw Error('Prepared brush alpha pixels missing');
  const isCurrent=():boolean=>this.atlasPaintEpoch===epoch&&JSON.stringify(this.preferences)===settings&&this.edgeMaps?.alpha===alpha&&!this.fillTimer&&!this.repaintRequested;
  const assertCurrent=()=>{if(!isCurrent())throw Error('Prepared atlas paint changed before publication');};
  return{fingerprint:`paint-v1:${epoch}:${settings}`,isCurrent,assertCurrent,paint:{readProfile:(id:number)=>{assertCurrent();return this.readPaintProfile(id);},edgeAlpha:{data,width:alpha.image.width,height:alpha.image.height},brushColorLinear:[this.brushColor.value.r,this.brushColor.value.g,this.brushColor.value.b] as const,lineOpacity:this.lineOpacity.value,strokeImperfection:this.strokeImperfection.value}};
 }
 /** Diagnostic borrowed bytes; diagnostics never cause a bake. */
 debugPaintProfile(virtualId:number){return this.readPaintProfile(virtualId);}
 /** Complete a surface-data transaction while presentation is held by Core.
  * Pastel construction remains raster-free. Bindings keep their identities so
  * every existing material sees the newly prepared pixels on the next draw. */
 prepareSharedSurfaceAssets():readonly THREE.Texture[]{
  if(this.fillTimer){clearTimeout(this.fillTimer);this.fillTimer=undefined;this.repaintRequested=true;}
  if(this.origami){this.flushPaint();this.ensureEdgeMaps();this.assertPaintReadyForDraw();}
  const textures:THREE.Texture[]=[...this.banks];
  for(const map of [this.paperArray,this.paperHeightArray,this.faceProfilesTexture,this.rowsTexture,...Object.values(this.edgeMaps??{})])if(map)textures.push(map);
  // coverageArray is a CPU checkpoint container. Coverage is uploaded in the
  // paper's alpha channel and never needs a separate GPU allocation.
  return Object.freeze([...new Set(textures)]);
 }
 debugPaintStorage(){if(!this.colorArray)throw Error('Paint is not prepared');return{banks:this.banks.map(texture=>({texture,data:texture.image.data as Uint8Array})),paper:{texture:this.paperArray!,data:this.paperArray!.image.data as Uint8Array},coverage:{texture:this.coverageArray!,data:this.coverageArray!.image.data as Uint8Array},lookup:{texture:this.faceProfilesTexture!,data:this.faceProfilesTexture!.image.data as Float32Array},rows:this.rowsData};}
 paintReplayState(){return{mode:this.lastReplayMode,refreshed:this.bakedRefreshed,checkpointCount:this.coverageCheckpoints.size,bakedFill:this.bakedFill};}
 dispose():void{this.surfacePreparation.dispose();this.preparedStrokes.dispose();this.sharedSurfaceRefreshers.clear();this.sharedPaintSettingsRefreshers.clear();this.paperHeightArray?.dispose();this.paperHeightArray=undefined;this.coverageCheckpoints.clear();if(this.fillTimer)clearTimeout(this.fillTimer);for(const release of [...this.brushOwners.values()])release();this.brushGeometries.clear();for(const bank of this.banks)bank.dispose();this.banks.length=0;for(const map of Object.values(this.edgeMaps??{}))map?.dispose();this.paperArray?.dispose();this.coverageArray?.dispose();this.faceProfilesTexture?.dispose();this.rowsTexture?.dispose();this.paintPool.dispose();this.appearanceRows.clear();this.wearGeometries.clear();this.edgeObjects.clear();this.colorArray=undefined;this.edgeMaps=undefined;this.rowsTexture=undefined;this.rowsData=undefined;this.paperArray=undefined;this.coverageArray=undefined;this.faceProfilesTexture=undefined;}
}

/** Only textured pipelines call this. Exact profiles contain authored color;
 * vertexColors must be false, avoiding the old dark-green multiplication. */
/** Select during material construction; no per-frame or distance decision. */
export interface OrigamiSurfaceOptions {opaqueColorEndpoints?:boolean}
export function applyOrigamiSurface(material:THREE.NodeMaterial,base:THREE.Node<'vec3'>,coordinates:THREE.Node<'vec2'>=uv(),context=currentGraphicsStyle(),profile?:THREE.Node<'float'>,includeGeneric=false,fillCoverage=true,options?:OrigamiSurfaceOptions):void {
 if(!context?.origami)return;material.vertexColors=false;
 // All banks and enabled bump probes share the same interpolated UV stream.
 // Implicit attribute transports would be recreated by isolated normal builds.
 const rawUv=varying(coordinates,'v_origamiPaintUv'),ids=profile?varying(context.resolvedPaintIdsNode(profile),'v_origamiPaintProfile').setInterpolation('flat'):context.genericPaintIdsNode(fillCoverage),id=ids.x,faceId=ids.y;
 const metric=physicalPaintMetric(rawUv).toVar(),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal();
 const paintUv=applyPhysicalPaintMetric(rawUv,metric,density).toVar(),sample=(fillCoverage?context.facePaintNode(paintUv,rawUv,id,faceId,context.reliefEnabled,options?.opaqueColorEndpoints===true):context.paintNode(paintUv,id)).toVar();
 // Actor profiles are all authored (>0). Keeping their unreachable generic
 // branch would compile the entire old appearance graph and its varyings.
 material.colorNode=profile&&!includeGeneric?sample.rgb:sample.rgb.mul(id.equal(GENERIC_REFERENCE_PROFILE).select(base,vec3(1)));
 if(context.reliefEnabled){
  const dx=applyPhysicalPaintMetric(rawUv.dFdx(),metric,density),dy=applyPhysicalPaintMetric(rawUv.dFdy(),metric,density);
  const hx=fillCoverage?context.faceHeightNode(paintUv.add(dx),rawUv.add(rawUv.dFdx()),id,faceId):context.paintNode(paintUv.add(dx),id).a,hy=fillCoverage?context.faceHeightNode(paintUv.add(dy),rawUv.add(rawUv.dFdy()),id,faceId):context.paintNode(paintUv.add(dy),id).a;
  material.normalNode=referencePaintBumpNormal(sample.a,hx,hy,context.impasto.mul(.035));
  installGlobalReliefLod(material,context.reliefLod);
 }else{
  // This branch is chosen while constructing the material, never per pixel.
  // Null also excludes any inherited stock normal/bump-map fallback.
  material.normalNode=null;Reflect.set(material,'normalMap',null);Reflect.set(material,'bumpMap',null);
 }
 if(material instanceof THREE.MeshStandardNodeMaterial){material.roughness=.88;material.metalness=.02;}
}
