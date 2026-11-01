import * as THREE from 'three/webgpu';
import {uniform,texture,uv,vec2,vec3,vec4,float,Fn,If,varying,mix,smoothstep,workingToColorSpace,colorSpaceToWorking} from 'three/tsl';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,normalizeGraphicsStylePreferences,type GraphicsStylePreferences} from '../ui3d/native-preferences';
import {bakeReferencePaintLayersToSink,packReferencePaintPixels,type ReferenceEdgePixels,type ReferencePaintDescriptor} from './origami/reference-paint-library';
import {referenceEdgeVisuals,type ReferenceEdgeVisuals} from './origami/reference-edges';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,humanBaseProfileIds,humanVariantDescriptor,GENERIC_REFERENCE_PROFILE} from './origami/reference-profiles';
import {physicalPaintMetric,applyPhysicalPaintMetric,referencePaintBumpNormal} from './origami/paint-metric';
import {updateOrigamiBrushGeometry} from './origami/brush-geometry';
import {referenceCoverageKey} from './origami/reference-coverage';

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

/** Independent source 512² color/height layers preserve the authored brushwork,
 * UVs, seeds and mips while sharing one material across a batch. */
export class GraphicsStyleContext {
 preferences:GraphicsStylePreferences;
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
 private faceProfilesTexture?:THREE.DataTexture;private faceProfileData?:Float32Array;
 private readonly coverageKeys=new Map<string,number>();
 private readonly descriptors:ReferencePaintDescriptor[]=[...BASE_REFERENCE_PAINT_DESCRIPTORS];
 private readonly localIds=new Map(BASE_REFERENCE_PAINT_DESCRIPTORS.map((_,i)=>[i,i]));
 private readonly localKeys=new Map(BASE_REFERENCE_PAINT_DESCRIPTORS.map((d,i)=>[d.key,i]));
 private readonly activeBankCount=uniform(1);private refreshed=false;private bakedRefreshed=false;
 private edgeMaps?:{color:THREE.DataTexture;alpha:THREE.DataTexture;bump:THREE.DataTexture};
 private bakedCount=0;private bakedFill=-1;private fillTimer?:ReturnType<typeof setTimeout>;
 private readonly wearGeometries=new Set<THREE.BufferGeometry>();
 private readonly brushGeometries=new Map<object,{geometry:THREE.BufferGeometry;owners:Set<THREE.BufferGeometry>;width:number;roughness:number}>();
 private readonly brushOwners=new Map<THREE.BufferGeometry,()=>void>();
 private readonly edgeObjects=new Map<THREE.Object3D,'line'|'wear'>();
 private readonly humanIds=humanBaseProfileIds();private readonly appearanceRows=new Map<string,number>();
 private rowsData?:Float32Array;private rowsTexture?:THREE.DataTexture;
 constructor(settings:GraphicsStylePreferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES}) {this.preferences=normalizeGraphicsStylePreferences(settings);this.update(settings);}
 private ensureRows():THREE.DataTexture{if(!this.rowsTexture){this.rowsData=new Float32Array(12*4096);this.rowsTexture=new THREE.DataTexture(this.rowsData,12,4096,THREE.RedFormat,THREE.FloatType);this.rowsTexture.minFilter=this.rowsTexture.magFilter=THREE.NearestFilter;this.rowsTexture.needsUpdate=true;}return this.rowsTexture;}
 get origami():boolean{return this.preferences.style==='origami';}
 update(settings:GraphicsStylePreferences):void {
  this.preferences=normalizeGraphicsStylePreferences(settings);this.impasto.value=this.preferences.impasto;this.edges.value=this.preferences.edges;this.wear.value=this.preferences.wear;this.contour.value=this.preferences.contourImperfection;
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
  for(const geometry of this.wearGeometries)this.expandWear(geometry);for(const [object,kind]of this.edgeObjects)this.refreshEdgeObject(object,kind);
  if(this.colorArray&&this.bakedFill!==this.preferences.contourImperfection){if(this.fillTimer)clearTimeout(this.fillTimer);this.fillTimer=setTimeout(()=>{this.fillTimer=undefined;this.refreshed=true;this.flushPaint();},60);}
 }
 private expandWear(geometry:THREE.BufferGeometry):void {
  const base=geometry.userData.referenceWearBasePositions as Float32Array|undefined,expand=geometry.userData.referenceWearExpandDirections as Float32Array|undefined;if(!base||!expand)return;
  const position=geometry.getAttribute('position');for(let i=0;i<position.count;i++)position.setXYZ(i,base[i*3]!+expand[i*3]!*this.contourSpan.value,base[i*3+1]!+expand[i*3+1]!*this.contourSpan.value,base[i*3+2]!+expand[i*3+2]!*this.contourSpan.value);
  position.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 trackWearGeometry(geometry:THREE.BufferGeometry):()=>void{this.wearGeometries.add(geometry);this.expandWear(geometry);return()=>this.untrackWearGeometry(geometry);}
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
 /** Snapshot preparation only. RGB is source sRGB; alpha is its lossless linear
  * grayscale height. Banks retain independent 512² layers, including mipmaps.
  * Only palettes used by this renderer are resident, never past colonies. */
 flushPaint():void {
  if(!this.origami)return;const descriptors=this.descriptors,fill=this.fillTimer?this.bakedFill:this.preferences.contourImperfection;
  if(this.bakedCount===0&&fill!==.60)this.refreshed=true;
  if(this.bakedCount===descriptors.length&&this.bakedFill===fill&&this.bakedRefreshed===this.refreshed)return;
  if(descriptors.length>LAYERS_PER_BANK*MAX_BANKS)throw new Error('Origami : la scène dépasse 2048 pigments distincts.');
  const sameFill=this.bakedFill===fill&&this.bakedRefreshed===this.refreshed&&this.colorArray,start=sameFill?this.bakedCount:0;
  const requests=descriptors.slice(start).map(d=>this.refreshed?{...d,seed:d.refreshSeed??d.seed}:d);
  // Appearance colors reuse the source recipe's paper and fill template.
  // No mask/substrate is duplicated for each new colonist pigment palette.
  if(!this.faceProfileData){this.faceProfileData=new Float32Array(LAYERS_PER_BANK*MAX_BANKS);this.faceProfilesTexture=new THREE.DataTexture(this.faceProfileData,this.faceProfileData.length,1,THREE.RedFormat,THREE.FloatType);this.faceProfilesTexture.minFilter=this.faceProfilesTexture.magFilter=THREE.NearestFilter;}
  for(let i=0;i<descriptors.length;i++){const key=referenceCoverageKey(descriptors[i]!);let layer=this.coverageKeys.get(key);if(layer===undefined){layer=this.coverageKeys.size;if(layer>=256)throw new Error('Origami : plus de256 gabarits de remplissage distincts.');this.coverageKeys.set(key,layer);}this.faceProfileData[i]=layer;}
  const faceDepth=this.coverageKeys.size,oldFaceDepth=this.paperArray?.image.depth??0,faceDirty=!sameFill||faceDepth!==oldFaceDepth;
  const paperPixels=faceDirty?new Uint8Array(faceDepth*PIXELS_PER_LAYER):undefined,coveragePixels=faceDirty?new Uint8Array(faceDepth*512*512).fill(255):undefined;
  if(sameFill&&faceDirty&&this.paperArray&&this.coverageArray){paperPixels!.set(this.paperArray.image.data as Uint8Array);coveragePixels!.set(this.coverageArray.image.data as Uint8Array);}
  const capturedFaces=new Set<number>();
  const blank=new Uint8Array(4);
  const uploads:{bank:number;first:number;count:number;depth:number;data:Uint8Array;old:THREE.DataArrayTexture|undefined}[]=[];
  for(let bank=0;bank<MAX_BANKS;bank++){
   const first=bank*LAYERS_PER_BANK,count=Math.max(0,Math.min(LAYERS_PER_BANK,descriptors.length-first)),depth=Math.max(1,count),old=this.banks[bank];
   if(old&&(count===0||(sameFill&&first+count<=start)))continue;
   const data=count?new Uint8Array(depth*PIXELS_PER_LAYER):blank;
   if(sameFill&&old&&count)data.set((old.image.data as Uint8Array).subarray(0,Math.min(data.length,(old.image.data as Uint8Array).length)));
   uploads.push({bank,first,count,depth,data,old});
  }
  const scratch=new Uint8Array(PIXELS_PER_LAYER);
  const baked=bakeReferencePaintLayersToSink(requests,{fillImperfection:fill,separateFill:true},(index,color,bump,face)=>{
   const local=start+index,bank=Math.floor(local/LAYERS_PER_BANK),upload=uploads.find(item=>item.bank===bank)!;
   packReferencePaintPixels(color,bump,512,512,1,scratch);upload.data.set(scratch,(local-upload.first)*PIXELS_PER_LAYER);
   const faceLayer=this.faceProfileData![local]!;
   if(faceDirty&&!capturedFaces.has(faceLayer)&&(!sameFill||faceLayer>=oldFaceDepth)){
    packReferencePaintPixels(face?.paperColorRgba??color,face?.paperBumpRgba??bump,512,512,1,scratch);paperPixels!.set(scratch,faceLayer*PIXELS_PER_LAYER);
    if(face)for(let y=0;y<512;y++)for(let x=0;x<512;x++)coveragePixels![faceLayer*512*512+(511-y)*512+x]=face.coverageRgba[(y*512+x)*4+3]!;
    capturedFaces.add(faceLayer);
   }
  });
  for(const {bank,count,depth,data,old}of uploads){if(old){old.dispose();old.image={data,width:512,height:512,depth};old.needsUpdate=true;}else this.banks[bank]=arrayTexture(data,depth,count?512:1);}
  this.colorArray=this.banks[0];this.activeBankCount.value=Math.ceil(descriptors.length/LAYERS_PER_BANK);
  if(faceDirty){
   if(this.paperArray){this.paperArray.dispose();this.paperArray.image={data:paperPixels!,width:512,height:512,depth:faceDepth};this.paperArray.needsUpdate=true;}else this.paperArray=arrayTexture(paperPixels!,faceDepth);
   this.paperArray.wrapS=this.paperArray.wrapT=THREE.ClampToEdgeWrapping;
   if(this.coverageArray){this.coverageArray.dispose();this.coverageArray.image={data:coveragePixels!,width:512,height:512,depth:faceDepth};}
   else{this.coverageArray=new THREE.DataArrayTexture(coveragePixels!,512,512,faceDepth);this.coverageArray.format=THREE.RedFormat;this.coverageArray.wrapS=this.coverageArray.wrapT=THREE.ClampToEdgeWrapping;this.coverageArray.magFilter=THREE.LinearFilter;this.coverageArray.minFilter=THREE.LinearMipmapLinearFilter;this.coverageArray.generateMipmaps=true;}
   this.coverageArray.needsUpdate=true;
  }
  this.faceProfilesTexture!.needsUpdate=true;
  if(!this.edgeMaps)this.setEdgeMaps(baked.edge);this.bakedCount=descriptors.length;this.bakedFill=fill;this.bakedRefreshed=this.refreshed;
 }
 private setEdgeMaps(edge:ReferenceEdgePixels):void{this.edgeMaps={color:edgeTexture(edge.colorRgba,true),alpha:edgeTexture(edge.alphaRgba),bump:edgeTexture(edge.bumpRgba)};}
 get paint():THREE.DataArrayTexture{this.flushPaint();return this.colorArray!;}
 /** Read-only diagnostics use original Canvas2D row order. */
 paintLayerData(profileId:number):Uint8Array{this.flushPaint();const local=this.localIds.get(profileId)??profileId,bank=this.banks[Math.floor(local/LAYERS_PER_BANK)]!,layer=local%LAYERS_PER_BANK,data=bank.image.data as Uint8Array;return flipRows(data.subarray(layer*PIXELS_PER_LAYER,(layer+1)*PIXELS_PER_LAYER),512,512);}
 paintNode(coordinates:THREE.Node<'vec2'>,profile:THREE.Node<'float'>):THREE.Node<'vec4'>{
  this.flushPaint();const banks=this.banks,active=this.activeBankCount;
  return Fn(()=>{const result=vec4(0).toVar();If(active.equal(1),()=>{result.assign(texture(banks[0]!,coordinates).depth(profile));}).Else(()=>{for(let bank=0;bank<MAX_BANKS;bank++)If(active.greaterThan(bank).and(profile.greaterThanEqual(bank*LAYERS_PER_BANK)).and(profile.lessThan((bank+1)*LAYERS_PER_BANK)),()=>{result.assign(texture(banks[bank]!,coordinates).depth(profile.mod(LAYERS_PER_BANK)));});});return result;})();
 }
 faceProfileNode(profile:THREE.Node<'float'>):THREE.Node<'float'>{this.flushPaint();return texture(this.faceProfilesTexture!,vec2(profile.add(.5).div(LAYERS_PER_BANK*MAX_BANKS),.5)).level(float(0)).context({forceUVContext:false}).r;}
 facePaintNode(pigmentUv:THREE.Node<'vec2'>,faceUv:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,faceProfile:THREE.Node<'float'>):THREE.Node<'vec4'>{
  const pigment=this.paintNode(pigmentUv,profile).toVar(),paper=texture(this.paperArray!,faceUv).depth(faceProfile).toVar(),coverage=texture(this.coverageArray!,faceUv).depth(faceProfile).r;
  // Source Canvas composition uses encoded sRGB. The opaque repeating
  // pigment never contains a paper frame; only this raw face mask exposes it.
  // ColorSpaceNode is a raw node class in r186: wrap it before swizzling.
  const paperEncoded=vec4(workingToColorSpace(vec4(paper.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb,pigmentEncoded=vec4(workingToColorSpace(vec4(pigment.rgb,1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb;
  const color=vec4(colorSpaceToWorking(vec4(mix(paperEncoded,pigmentEncoded,coverage),1),THREE.SRGBColorSpace) as unknown as THREE.Node<'vec4'>).rgb;
  return vec4(color,mix(paper.a,pigment.a,coverage));
 }
 faceHeightNode(pigmentUv:THREE.Node<'vec2'>,faceUv:THREE.Node<'vec2'>,profile:THREE.Node<'float'>,faceProfile:THREE.Node<'float'>):THREE.Node<'float'>{return mix(texture(this.paperArray!,faceUv).depth(faceProfile).a,this.paintNode(pigmentUv,profile).a,texture(this.coverageArray!,faceUv).depth(faceProfile).r);}
 /** Canonical reference adapter only. Product contours are painted triangles. */
 createLineMaterial(positionNode:THREE.Node|null):THREE.LineBasicNodeMaterial {const material=new THREE.LineBasicNodeMaterial({transparent:true});material.userData.origamiContour=true;material.userData.origamiUnlitContour=true;material.colorNode=this.lineColor;material.positionNode=positionNode;material.opacityNode=this.lineOpacity;return material;}
 createBrushMaterial(positionNode:THREE.Node|null,coordinates:THREE.Node<'vec2'>=uv()):THREE.MeshStandardNodeMaterial {
  const material=new THREE.MeshStandardNodeMaterial({transparent:true,depthWrite:false,depthTest:true,alphaTest:.012,flatShading:true,roughness:.94,metalness:0,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  material.name='Origami — painted gouache brush strokes';material.userData.origamiContour=true;material.userData.origamiBrush=true;material.positionNode=positionNode;
  applyOrigamiSurface(material,this.brushColor.rgb,coordinates,this,undefined,false,false);
  const edge=this.edgeMaps!,raw=varying(coordinates,'v_origamiBrushUv');
  const dry=texture(edge.alpha,raw).g,soft=smoothstep(0,.035,raw.y).mul(float(1).sub(smoothstep(.90,1,raw.y)));
  material.opacityNode=this.lineOpacity.mul(soft).mul(mix(float(1),dry.mul(.65).add(.35),this.strokeImperfection));
  return material;
 }
 createWearMaterial(positionNode:THREE.Node|null,coordinates:THREE.Node<'vec2'>=uv()):THREE.MeshStandardNodeMaterial {
  this.flushPaint();const edge=this.edgeMaps!,material=new THREE.MeshStandardNodeMaterial({roughness:.94,metalness:0,flatShading:true,transparent:true,alphaTest:.06,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const metric=physicalPaintMetric(coordinates).toVar(),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal();
  const paintUv=applyPhysicalPaintMetric(coordinates,metric,density).mul(vec2(1,4)).toVar();
  const dx=applyPhysicalPaintMetric(coordinates.dFdx(),metric,density).mul(vec2(1,4)),dy=applyPhysicalPaintMetric(coordinates.dFdy(),metric,density).mul(vec2(1,4));
  const height=texture(edge.bump,paintUv).r;
  material.positionNode=positionNode;material.colorNode=texture(edge.color,paintUv).rgb;material.opacityNode=texture(edge.alpha,coordinates).g.mul(this.wearOpacity);material.normalNode=referencePaintBumpNormal(height,texture(edge.bump,paintUv.add(dx)).r,texture(edge.bump,paintUv.add(dy)).r,float(.045));return material;
 }
 registerHumanAppearance(appearance:HumanPaintAppearance):number {
  const colors=[appearance.skin,appearance.shirt,appearance.outerwear??appearance.shirt,appearance.pants??0x3c424a,appearance.hair,appearance.hat??appearance.shirt],extra=[appearance.vest??0x626c60,appearance.reconArmor??0x647d86,appearance.plate??0x7c8186],key=[...colors,...extra].join(':');const old=this.appearanceRows.get(key);if(old!==undefined)return old;
  const row=this.appearanceRows.size;if(row>=4096)throw new Error('Origami: trop de palettes humaines simultanées');
  const local=(descriptor:ReferencePaintDescriptor):number=>{let id=this.localKeys.get(descriptor.key);if(id===undefined){id=this.descriptors.length;this.descriptors.push(descriptor);this.localKeys.set(descriptor.key,id);}return id;};
  this.ensureRows();const ids=colors.map((color,category)=>local(humanVariantDescriptor(category,color)));ids.push(...this.humanIds.slice(6),...extra.map(color=>local(humanVariantDescriptor(2,color))));this.rowsData!.set(ids,row*12);this.rowsTexture!.needsUpdate=true;this.appearanceRows.set(key,row);return row;
 }
 humanProfileNode(baseProfile:THREE.Node<'float'>,row:THREE.Node<'float'>,dye?:THREE.Node<'float'>):THREE.Node<'float'> {
  let category:THREE.Node<'float'>=float(8);for(let i=7;i>=0;i--)category=baseProfile.equal(this.humanIds[i]!).select(float(i),category);
  if(dye)category=dye.equal(-2).and(baseProfile.equal(this.humanIds[2]!)).select(float(9),dye.equal(-42).and(baseProfile.equal(this.humanIds[2]!)).select(float(10),dye.equal(-11).select(float(11),category)));
  // Palette metadata is resolved in the vertex stage. Its UVs must never be
  // replaced by the three paint-UV probes used by the normal/bump sub-build.
  return texture(this.ensureRows(),vec2(category.add(.5).div(12),row.add(.5).div(4096))).level(float(0)).context({forceUVContext:false}).r;
 }
 dispose():void{if(this.fillTimer)clearTimeout(this.fillTimer);for(const release of [...this.brushOwners.values()])release();this.brushGeometries.clear();for(const bank of this.banks)bank.dispose();this.banks.length=0;for(const map of Object.values(this.edgeMaps??{}))map.dispose();this.paperArray?.dispose();this.coverageArray?.dispose();this.faceProfilesTexture?.dispose();this.coverageKeys.clear();this.rowsTexture?.dispose();this.wearGeometries.clear();this.edgeObjects.clear();this.colorArray=undefined;this.edgeMaps=undefined;this.rowsTexture=undefined;this.rowsData=undefined;this.paperArray=undefined;this.coverageArray=undefined;this.faceProfilesTexture=undefined;this.faceProfileData=undefined;}
}

/** Only textured pipelines call this. Exact profiles contain authored color;
 * vertexColors must be false, avoiding the old dark-green multiplication. */
export function applyOrigamiSurface(material:THREE.NodeMaterial,base:THREE.Node<'vec3'>,coordinates:THREE.Node<'vec2'>=uv(),context=currentGraphicsStyle(),profile?:THREE.Node<'float'>,includeGeneric=false,fillCoverage=true):void {
 if(!context?.origami)return;material.vertexColors=false;
 // All banks and all three bump probes share the same interpolated UV stream.
 // Implicit attribute transports would be recreated by isolated normal builds.
 const rawUv=varying(coordinates,'v_origamiPaintUv'),ids=profile?varying(vec2(profile,fillCoverage?context.faceProfileNode(profile):float(0)),'v_origamiPaintProfile').setInterpolation('flat'):vec2(GENERIC_REFERENCE_PROFILE),id=ids.x,faceId=ids.y;
 const metric=physicalPaintMetric(rawUv).toVar(),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal();
 const paintUv=applyPhysicalPaintMetric(rawUv,metric,density).toVar(),sample=(fillCoverage?context.facePaintNode(paintUv,rawUv,id,faceId):context.paintNode(paintUv,id)).toVar();
 const dx=applyPhysicalPaintMetric(rawUv.dFdx(),metric,density),dy=applyPhysicalPaintMetric(rawUv.dFdy(),metric,density);
 // Actor profiles are all authored (>0). Keeping their unreachable generic
 // branch would compile the entire old appearance graph and its varyings.
 const hx=fillCoverage?context.faceHeightNode(paintUv.add(dx),rawUv.add(rawUv.dFdx()),id,faceId):context.paintNode(paintUv.add(dx),id).a,hy=fillCoverage?context.faceHeightNode(paintUv.add(dy),rawUv.add(rawUv.dFdy()),id,faceId):context.paintNode(paintUv.add(dy),id).a;
 material.colorNode=profile&&!includeGeneric?sample.rgb:sample.rgb.mul(id.equal(GENERIC_REFERENCE_PROFILE).select(base,vec3(1)));material.normalNode=referencePaintBumpNormal(sample.a,hx,hy,context.impasto.mul(.035));
 if(material instanceof THREE.MeshStandardNodeMaterial){material.roughness=.88;material.metalness=.02;}
}
