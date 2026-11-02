/** Exact shared paint residency and coverage-only repaint; full authored raster retained. */
import * as THREE from 'three/webgpu';
import {uniform,texture,uv,vec2,vec3,vec4,float,Fn,If,varying,mix,smoothstep,workingToColorSpace,colorSpaceToWorking} from 'three/tsl';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,normalizeGraphicsStylePreferences,graphicsStylePipelineKey,type GraphicsStylePreferences,type GraphicsStylePipelineKey} from '../ui3d/native-preferences';
import {packReferencePaintPixels,type ReferenceEdgePixels,type ReferencePaintDescriptor} from './origami/reference-paint-library';
import {referenceEdgeVisuals,type ReferenceEdgeVisuals} from './origami/reference-edges';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,PROTECTED_REFERENCE_PAINT_DESCRIPTORS,humanBaseProfileIds,humanVariantDescriptor,GENERIC_REFERENCE_PROFILE} from './origami/reference-profiles';
import {physicalPaintMetric,applyPhysicalPaintMetric,referencePaintBumpNormal} from './origami/paint-metric';
import {updateOrigamiBrushGeometry} from './origami/brush-geometry';
import {VirtualPaintPool,type VirtualPaintDescriptor} from './origami/virtual-paint-pool';
import {bakeResidentPaintToSink} from './origami/reference-resident-paint-library';

import {GAME_USED_BESTIARY_VIRTUAL_IDS} from './origami/game-paint-residency';
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
 preferences:GraphicsStylePreferences;
 readonly pipelineKey:GraphicsStylePipelineKey;
 readonly reliefEnabled:boolean;
 readonly reliefLod:GlobalReliefLod|undefined;
 readonly impasto=uniform(1);readonly edges=uniform(.65);readonly wear=uniform(.75);readonly contour=uniform(.60);
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
 private faceProfilesTexture?:THREE.DataTexture;
 private readonly paintPool:VirtualPaintPool;
 private readonly activeBankCount=uniform(0);private readonly genericFaceLayer=uniform(0);
 private lastPaintVersion=-1;private admissionDepth=0;private repaintRequested=false;
 private protectedDemandDeclared=false;
 private edgeMaps?:{color?:THREE.DataTexture;alpha:THREE.DataTexture;bump?:THREE.DataTexture};
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
  this.reliefEnabled=this.origami&&this.preferences.impasto>0;
  this.reliefLod=createGlobalReliefLod(this.reliefEnabled);this.update(settings);
 }
 private ensureRows():THREE.DataTexture{if(!this.rowsTexture){this.rowsData=new Float32Array(12*4096);this.rowsData.set(this.paintPool.humanRowsData());this.rowsTexture=new THREE.DataTexture(this.rowsData,12,4096,THREE.RedFormat,THREE.FloatType);this.rowsTexture.minFilter=this.rowsTexture.magFilter=THREE.NearestFilter;this.rowsTexture.needsUpdate=true;}return this.rowsTexture;}
 /** Binding objects only. No Canvas, raster, source painter or bulk palette. */
 private ensurePaintBindings():void{
  if(!this.origami)throw Error('Default materials must not request Origami texture bindings.');
  if(this.admissionDepth)throw Error('Material construction during paint discovery; discover first, then flush, then construct.');
  if(this.colorArray)return;
  for(let bank=0;bank<MAX_BANKS;bank++)this.banks.push(arrayTexture(new Uint8Array(4),1,1));this.colorArray=this.banks[0];
  this.paperArray=arrayTexture(new Uint8Array(4),1,1);this.paperArray.wrapS=this.paperArray.wrapT=THREE.ClampToEdgeWrapping;
  this.coverageArray=new THREE.DataArrayTexture(new Uint8Array([255]),1,1,1);this.coverageArray.format=THREE.RedFormat;this.coverageArray.wrapS=this.coverageArray.wrapT=THREE.ClampToEdgeWrapping;this.coverageArray.magFilter=THREE.LinearFilter;this.coverageArray.minFilter=THREE.LinearMipmapLinearFilter;this.coverageArray.generateMipmaps=true;this.coverageArray.needsUpdate=true;
  this.faceProfilesTexture=new THREE.DataTexture(this.paintPool.ensureMetadataData(),256,256,THREE.RGFormat,THREE.FloatType);this.faceProfilesTexture.colorSpace=THREE.NoColorSpace;this.faceProfilesTexture.minFilter=this.faceProfilesTexture.magFilter=THREE.NearestFilter;this.faceProfilesTexture.generateMipmaps=false;this.faceProfilesTexture.needsUpdate=true;
 }
 profileId(key:string):number{return this.paintPool.id(key);}
 requirePaint(owner:string,virtualIds:readonly number[]):void{if(this.origami)this.paintPool.requireProfiles(owner,virtualIds);}
 requireHumanPaintRow(owner:string,row:number):void{if(this.origami)this.paintPool.requireHumanRow(owner,row);}
 releasePaint(owner:string):void{this.paintPool.release(owner);}
 declareSpeciesPaint(species:string,virtualIds:readonly number[]):void{this.paintPool.declareSpecies(species,virtualIds);}
 requireSpeciesPaint(owner:string,actualSpecies:readonly string[]):void{if(this.origami)this.paintPool.requireSpecies(owner,actualSpecies);}
 /** Called for ACTIVE rigs in WildlifeLayer.update, never from prepare().
  * animalPaint is RGB+virtual profile, hence component.w (not component.x). */
 requireAnimalPaintGeometry(owner:string,geometry:THREE.BufferGeometry):void{
  if(!this.origami)return;const attribute=geometry.getAttribute('animalPaint');if(!attribute)return;
  const version=attribute instanceof THREE.InterleavedBufferAttribute?attribute.data.version:attribute.version;let cached=this.geometryPaintIds.get(geometry);
  if(!cached||cached.attribute!==attribute||cached.version!==version){const used=new Set<number>();for(let vertex=0;vertex<attribute.count;vertex++){const id=attribute.getComponent(vertex,3);if(!Number.isSafeInteger(id)||id<0)throw Error('Invalid virtual animal paint ID');used.add(id);}cached={attribute,version,ids:[...used].sort((a,b)=>a-b)};this.geometryPaintIds.set(geometry,cached);}
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
 get wearEnabled():boolean{return this.origami&&this.preferences.wear>0;}
 update(settings:GraphicsStylePreferences):void {
  const next=normalizeGraphicsStylePreferences(settings);
  if(graphicsStylePipelineKey(next)!==this.pipelineKey)throw Error('La modification des effets désactivés exige une nouvelle préparation de l’affichage.');
  this.preferences=next;this.impasto.value=this.preferences.impasto;this.edges.value=this.preferences.edges;this.wear.value=this.preferences.wear;this.contour.value=this.preferences.contourImperfection;
  // Prepare all game pigments before play; an arriving species never starts a Canvas bake.
  if(this.origami&&!this.protectedDemandDeclared){this.paintPool.requireProfiles('protected-core43',Array.from({length:PROTECTED_REFERENCE_PAINT_DESCRIPTORS.length},(_,id)=>id));this.protectedDemandDeclared=true;}
  if(this.origami)this.requirePaint('all-game-best35',GAME_USED_BESTIARY_VIRTUAL_IDS);
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
  if(this.wearEnabled)for(const geometry of this.wearGeometries)this.expandWear(geometry);for(const [object,kind]of this.edgeObjects)this.refreshEdgeObject(object,kind);
  if(this.bakedFill>=0&&this.bakedFill!==this.preferences.contourImperfection){if(this.fillTimer)clearTimeout(this.fillTimer);this.fillTimer=setTimeout(()=>{this.fillTimer=undefined;this.repaintRequested=true;this.flushPaint();},60);}
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
 refreshEdgeObject(object:THREE.Object3D,kind=this.edgeObjects.get(object)):void{if(kind)object.visible=object.userData.origamiOwnerVisible!==false&&(kind==='line'?this.lineOpacity.value>0:this.edgeVisuals.showWear&&object.userData.origamiTexturesEnabled!==false);}
 /** Flush pending palette work before returning material texture bindings. */
 flushPaint():void {
  if(!this.origami)return;if(this.admissionDepth)throw Error('Raster requested during paint discovery; discover all IDs before preparing.');
  const fill=this.fillTimer?this.bakedFill:this.preferences.contourImperfection;
  const repaint=this.repaintRequested||(this.bakedFill<0&&fill!==.60)||(this.bakedFill>=0&&this.bakedFill!==fill);
  if(this.lastPaintVersion===this.paintPool.version&&!repaint)return;
  const plan=this.paintPool.plan(repaint);
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
   this.paintPool.commit(plan);destination.set(coveragePixels);this.coverageArray!.needsUpdate=true;
   this.bakedFill=fill;this.bakedRefreshed=plan.refreshed;this.repaintRequested=false;this.lastPaintVersion=this.paintPool.version;this.lastReplayMode='mask';return;
  }
  const faceDirty=repaint||plan.faceDepth!==oldFaceDepth;
  const nextCheckpoints=new Map<number,CoverageCheckpoint>(repaint?undefined:this.coverageCheckpoints);
  const paperPixels=faceDirty?new Uint8Array(plan.faceDepth*PIXELS_PER_LAYER):undefined,coveragePixels=faceDirty?new Uint8Array(plan.faceDepth*512*512).fill(255):undefined;
  if(faceDirty&&!repaint&&oldFaceDepth){paperPixels!.set(this.paperArray!.image.data as Uint8Array);coveragePixels!.set(this.coverageArray!.image.data as Uint8Array);}
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
  }
  this.faceProfilesTexture!.needsUpdate=true;this.genericFaceLayer.value=this.paintPool.resolve(0)?.[1]??0;
  this.activeBankCount.value=Math.max(...plan.bankShapes.map((shape,index)=>shape.size===512?index+1:0));
  this.coverageCheckpoints=nextCheckpoints;this.bakedRefreshed=plan.refreshed;this.lastReplayMode='full';this.bakedFill=fill;this.repaintRequested=false;this.lastPaintVersion=this.paintPool.version;
 }
 private ensureEdgeMaps():void{
  if(!this.origami)throw Error('Default materials must not request Origami edge maps.');
  if(this.edgeMaps)return;
  const {edge}=bakeResidentPaintToSink([],{includeEdge:true,includeHeight:this.reliefEnabled,edgeChannels:{color:this.wearEnabled,height:this.wearEnabled&&this.reliefEnabled},edgeSeed:1337,fillImperfection:this.preferences.contourImperfection},()=>{});
  if(!edge)throw Error('Edge painter did not return source maps');this.setEdgeMaps(edge);
 }

 private setEdgeMaps(edge:ReferenceEdgePixels):void{
  if(this.wearEnabled&&!edge.colorRgba)throw Error('Enabled Origami wear requires its source color pixels');
  if(this.wearEnabled&&this.reliefEnabled&&!edge.bumpRgba)throw Error('Enabled Origami relief requires its source edge height pixels');
  this.edgeMaps={alpha:edgeTexture(edge.alphaRgba)};
  if(this.wearEnabled)this.edgeMaps.color=edgeTexture(edge.colorRgba!,true);
  if(this.wearEnabled&&this.reliefEnabled)this.edgeMaps.bump=edgeTexture(edge.bumpRgba!);
 }
 get paint():THREE.DataArrayTexture{this.flushPaint();this.ensurePaintBindings();return this.colorArray!;}
 /** Read-only diagnostics use original Canvas2D row order. */
 paintLayerData(profileId:number):Uint8Array{this.paintPool.assertResident([profileId]);const local=this.paintPool.resolve(profileId)![0],bank=this.banks[Math.floor(local/LAYERS_PER_BANK)]!,layer=local%LAYERS_PER_BANK,data=bank.image.data as Uint8Array;return flipRows(data.subarray(layer*PIXELS_PER_LAYER,(layer+1)*PIXELS_PER_LAYER),512,512);}
 paintNode(coordinates:THREE.Node<'vec2'>,profile:THREE.Node<'float'>):THREE.Node<'vec4'>{
  this.flushPaint();
  this.ensurePaintBindings();const banks=this.banks,active=this.activeBankCount;
  return Fn(()=>{const result=vec4(0).toVar();If(active.equal(1),()=>{result.assign(texture(banks[0]!,coordinates).depth(profile));}).Else(()=>{for(let bank=0;bank<MAX_BANKS;bank++)If(active.greaterThan(bank).and(profile.greaterThanEqual(bank*LAYERS_PER_BANK)).and(profile.lessThan((bank+1)*LAYERS_PER_BANK)),()=>{result.assign(texture(banks[bank]!,coordinates).depth(profile.mod(LAYERS_PER_BANK)));});});return result;})();
 }
 resolvedPaintIdsNode(profile:THREE.Node<'float'>):THREE.Node<'vec2'>{this.flushPaint();this.ensurePaintBindings();return texture(this.faceProfilesTexture!,vec2(profile.mod(256).add(.5).div(256),profile.div(256).floor().add(.5).div(256))).level(float(0)).context({forceUVContext:false}).rg;}
 faceProfileNode(profile:THREE.Node<'float'>):THREE.Node<'float'>{return this.resolvedPaintIdsNode(profile).y;}
 genericPaintIdsNode(fillCoverage=true):THREE.Node<'vec2'>{this.requirePaint('generic-surfaces',[GENERIC_REFERENCE_PROFILE]);return vec2(GENERIC_REFERENCE_PROFILE,fillCoverage?this.genericFaceLayer:float(0));}
 facePaintNode(pigmentUv:THREE.Node<'vec2'>,faceUv:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,faceProfile:THREE.Node<'float'>,includeHeight=true):THREE.Node<'vec4'>{
  const pigment=this.paintNode(pigmentUv,profile).toVar(),paper=texture(this.paperArray!,faceUv).depth(faceProfile).toVar(),coverage=texture(this.coverageArray!,faceUv).depth(faceProfile).r;
  // Source Canvas composition uses encoded sRGB. The opaque repeating
  // pigment never contains a paper frame; only this raw face mask exposes it.
  // ColorSpaceNode is a raw node class in r186: wrap it before swizzling.
  const paperEncoded=vec4(workingToColorSpace(vec4(paper.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb,pigmentEncoded=vec4(workingToColorSpace(vec4(pigment.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb;
  const color=vec4(colorSpaceToWorking(vec4(mix(paperEncoded,pigmentEncoded,coverage),1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb;
  return vec4(color,includeHeight?mix(paper.a,pigment.a,coverage):float(0));
 }
 faceHeightNode(pigmentUv:THREE.Node<'vec2'>,faceUv:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,faceProfile:THREE.Node<'float'>):THREE.Node<'float'>{return mix(texture(this.paperArray!,faceUv).depth(faceProfile).a,this.paintNode(pigmentUv,profile).a,texture(this.coverageArray!,faceUv).depth(faceProfile).r);}
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
  const colors=[appearance.skin,appearance.shirt,appearance.outerwear??appearance.shirt,appearance.pants??0x3c424a,appearance.hair,appearance.hat??appearance.shirt],extra=[appearance.vest??0x626c60,appearance.reconArmor??0x647d86,appearance.plate??0x7c8186],key=[...colors,...extra].join(':');const old=this.appearanceRows.get(key);if(old!==undefined){if(this.origami)this.paintPool.requireHumanRow(`human-row:${old}`,old);return old;}
  const local=(descriptor:ReferencePaintDescriptor):number=>this.paintPool.registerHumanProfile(descriptor);
  const ids=colors.map((color,category)=>local(humanVariantDescriptor(category,color)));ids.push(...this.humanIds.slice(6),...extra.map(color=>local(humanVariantDescriptor(2,color))));
  const row=this.paintPool.registerHumanRow(ids);if(this.rowsData){this.rowsData.set(ids,row*12);this.rowsTexture!.needsUpdate=true;}this.appearanceRows.set(key,row);if(this.origami)this.paintPool.requireHumanRow(`human-row:${row}`,row);return row;
 }
 humanProfileNode(baseProfile:THREE.Node<'float'>,row:THREE.Node<'float'>,dye?:THREE.Node<'float'>):THREE.Node<'float'> {
  let category:THREE.Node<'float'>=float(8);for(let i=7;i>=0;i--)category=baseProfile.equal(this.humanIds[i]!).select(float(i),category);
  if(dye)category=dye.equal(-2).and(baseProfile.equal(this.humanIds[2]!)).select(float(9),dye.equal(-42).and(baseProfile.equal(this.humanIds[2]!)).select(float(10),dye.equal(-11).select(float(11),category)));
  // Palette metadata is resolved in the vertex stage. Its UVs must never be
  // replaced by the three paint-UV probes used by the normal/bump sub-build.
  return texture(this.ensureRows(),vec2(category.add(.5).div(12),row.add(.5).div(4096))).level(float(0)).context({forceUVContext:false}).r;
 }
 /** diagnostic borrowed upload-order bytes; diagnostics never cause a bake. */
 debugPaintProfile(virtualId:number){this.paintPool.assertResident([virtualId]);const [physicalLayer,faceLayer]=this.paintPool.resolve(virtualId)!;
  const pigment=this.banks[Math.floor(physicalLayer/256)]!.image.data as Uint8Array,paper=this.paperArray!.image.data as Uint8Array,coverage=this.coverageArray!.image.data as Uint8Array;
  return{physicalLayer,faceLayer,pigment:pigment.subarray((physicalLayer%256)*PIXELS_PER_LAYER,(physicalLayer%256+1)*PIXELS_PER_LAYER),paper:paper.subarray(faceLayer*PIXELS_PER_LAYER,(faceLayer+1)*PIXELS_PER_LAYER),coverage:coverage.subarray(faceLayer*512*512,(faceLayer+1)*512*512),orientation:'upload-bottom-up' as const};
 }
 debugPaintStorage(){if(!this.colorArray)throw Error('Paint is not prepared');return{banks:this.banks.map(texture=>({texture,data:texture.image.data as Uint8Array})),paper:{texture:this.paperArray!,data:this.paperArray!.image.data as Uint8Array},coverage:{texture:this.coverageArray!,data:this.coverageArray!.image.data as Uint8Array},lookup:{texture:this.faceProfilesTexture!,data:this.faceProfilesTexture!.image.data as Float32Array},rows:this.rowsData};}
 paintReplayState(){return{mode:this.lastReplayMode,refreshed:this.bakedRefreshed,checkpointCount:this.coverageCheckpoints.size,bakedFill:this.bakedFill};}
 dispose():void{this.coverageCheckpoints.clear();if(this.fillTimer)clearTimeout(this.fillTimer);for(const release of [...this.brushOwners.values()])release();this.brushGeometries.clear();for(const bank of this.banks)bank.dispose();this.banks.length=0;for(const map of Object.values(this.edgeMaps??{}))map?.dispose();this.paperArray?.dispose();this.coverageArray?.dispose();this.faceProfilesTexture?.dispose();this.rowsTexture?.dispose();this.paintPool.dispose();this.appearanceRows.clear();this.wearGeometries.clear();this.edgeObjects.clear();this.colorArray=undefined;this.edgeMaps=undefined;this.rowsTexture=undefined;this.rowsData=undefined;this.paperArray=undefined;this.coverageArray=undefined;this.faceProfilesTexture=undefined;}
}

/** Only textured pipelines call this. Exact profiles contain authored color;
 * vertexColors must be false, avoiding the old dark-green multiplication. */
export function applyOrigamiSurface(material:THREE.NodeMaterial,base:THREE.Node<'vec3'>,coordinates:THREE.Node<'vec2'>=uv(),context=currentGraphicsStyle(),profile?:THREE.Node<'float'>,includeGeneric=false,fillCoverage=true):void {
 if(!context?.origami)return;material.vertexColors=false;
 // All banks and enabled bump probes share the same interpolated UV stream.
 // Implicit attribute transports would be recreated by isolated normal builds.
 const rawUv=varying(coordinates,'v_origamiPaintUv'),ids=profile?varying(context.resolvedPaintIdsNode(profile),'v_origamiPaintProfile').setInterpolation('flat'):context.genericPaintIdsNode(fillCoverage),id=ids.x,faceId=ids.y;
 const metric=physicalPaintMetric(rawUv).toVar(),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal();
 const paintUv=applyPhysicalPaintMetric(rawUv,metric,density).toVar(),sample=(fillCoverage?context.facePaintNode(paintUv,rawUv,id,faceId,context.reliefEnabled):context.paintNode(paintUv,id)).toVar();
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
