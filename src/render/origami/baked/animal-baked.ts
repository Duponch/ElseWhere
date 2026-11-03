/** Species-level adapter with an explicitly supplied atlas compiler.
 * All living/dead/clinical geometry is retained. No World or individual atlas.
 * Preparation, admission, publication and ordinary owner disposal are explicit. */
import * as THREE from 'three/webgpu';
import {attribute,texture} from 'three/tsl';
import {origamiAnimalPresentationGeometry} from '../animal-geometry';
import {createRigBrushGeometry} from '../rig-brush';
import {updateOrigamiBrushGeometry} from '../brush-geometry';
import {indexExactStaticVertices} from '../static-index';
import {compileBakedCharts,type BakedChartOptions,type BakedChartSet} from './charts';
import {compileSourceInk,type AtlasPaintSource,type AtlasBakeOptions,type BakedInk} from './baker';
import {AtlasCache,AtlasBuildQuarantineError,type AtlasBytes,type AtlasLease,type AtlasResource,type AtlasPreparationReservation} from './atlas-cache';
import {BAKED_MEAN_ATTRIBUTE,bakedChartMeanColorNode} from './chart-mean';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const instanced=(a:Attribute):boolean=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
const requiredOwners=['aFrom','aTo','aTravel','aAnimal','aBiology','aCarrier','aCorpseHandoff','aCorpseFrom','aCorpseTo'] as const;
const ownedBuffers=(arrays:readonly THREE.TypedArray[]):number=>{const buffers=new Set<ArrayBufferLike>();let bytes=0;for(const array of arrays)if(!buffers.has(array.buffer)){buffers.add(array.buffer);bytes+=array.buffer.byteLength;}return bytes;};
const geometryArrays=(g:THREE.BufferGeometry):THREE.TypedArray[]=>[...Object.values(g.attributes).filter(a=>!instanced(a)).map(a=>a.array),...(g.index?[g.index.array]:[])];

/** Structurally compatible with GPU V6 GpuAtlasResult. The texture may be an
 * RT attachment: ONLY this owner's disposer releases it, never texture.dispose.
 * Counts describe RETAINED ownership; request.reservation covers peak work.
 * On rejection the compiler cleans its own partial allocations, or throws
 * AtlasBuildQuarantineError/AggregateError if cleanup cannot be proved. */
export interface AnimalAtlasCompilation extends AtlasBytes {
  readonly texture:THREE.Texture;
  readonly stats:Readonly<Record<string,unknown>>;
  readonly plan?:unknown;
  dispose():void;
}
export interface AnimalAtlasCompileInput {
  readonly species:string;
  /** Borrowed and stable until this compiler settles, including all GPU awaits. */
  readonly charts:BakedChartSet;
  readonly ink:BakedInk;
  readonly profile:AtlasPaintSource['profile'];
  readonly paint:Omit<AtlasPaintSource,'profile'>;
  readonly bakeOptions:AtlasBakeOptions|undefined;
  /** Shared preparation/paint epoch, NOT a single waiting owner's abort signal.
   * Pass this to GPU V6 assertExclusive along with its renderer lease guard. */
  assertCurrent():void;
  /** Admit the exact planned peak before allocating compiler resources. CPU
   * preparation was already reserved; this does not release that reservation. */
  reservePreparation:AtlasPreparationReservation['reservePeak'];
}
export type AnimalAtlasCompiler=(input:AnimalAtlasCompileInput)=>AnimalAtlasCompilation|Promise<AnimalAtlasCompilation>;

export interface AnimalBakeRequest {
  /** Exact source/presentation version and palette identity, supplied by owner. */
  recipeFingerprint:string;
  paletteFingerprint:string;
  /** Exact current P/K/M + edge-alpha/settings generation. Must change on
   * fill/coverage updates even when palette RGB and species do not change. */
  paintFingerprint:string;
  /** Explicit preparation owner; the product never selects a CPU fallback. */
  compiler:AnimalAtlasCompiler;
  /** Required identity separates compiler kernels and source versions. */
  compilerFingerprint:string;
  /** Cancellation of THIS waiting owner only. Shared pending work is retained
   * until the compiler settles, so other owners may still acquire its result. */
  signal?:AbortSignal;
  assertPreparationCurrent?:()=>void;
  impasto:0;
  wear:0;
  edgeWidth:number;
  strokeImperfection:number;
  chartOptions:BakedChartOptions;
  bakeOptions?:AtlasBakeOptions;
  /** Must already hold the actual requested profile pixels resident. */
  paint:Omit<AtlasPaintSource,'profile'>;
  maxInkTriangles?:number;
  /** Peak prep reservation, not merely final texture size. Includes coexistence
   * with old published resources; AtlasCache refuses before invoking builder. */
  reservation:AtlasBytes;
  /** Begin with the declared CPU reservation and no GPU allocation. The
   * explicit compiler MUST admit its actual GPU peak before allocating. */
  deferGpuReservation?:boolean;
}
export interface AnimalBakedResource extends AtlasResource {
  readonly species:string;
  /** Static immutable template; NEVER render or mutate it directly. */
  readonly geometry:THREE.BufferGeometry;
  readonly atlas:THREE.Texture;
  readonly atlasLayout:BakedChartSet['atlas'];
  readonly sourceVertex:Uint32Array;
  readonly triangleChart:Uint32Array;
  readonly profiles:readonly number[];
  readonly metadata:Readonly<Record<string,unknown>>;
  readonly facts:Readonly<Record<string,unknown>>;
}

function validateCompilation(result:AnimalAtlasCompilation,charts:BakedChartSet):void{
  if(!Number.isSafeInteger(result.cpuBytes)||result.cpuBytes<0||!Number.isSafeInteger(result.gpuBytes)||result.gpuBytes<0||typeof result.dispose!=='function')throw Error('Animal compiler returned invalid retained bytes/owner');
  const map=result.texture;if(!(map instanceof THREE.Texture))throw Error('Animal compiler did not return a texture owner');
  const image:unknown=map.image;
  if(map.colorSpace!==THREE.SRGBColorSpace||map.flipY||map.generateMipmaps||map.type!==THREE.UnsignedByteType||map.format!==THREE.RGBAFormat||map.minFilter!==THREE.LinearMipmapLinearFilter||map.magFilter!==THREE.LinearFilter||map.mipmaps.length!==charts.atlas.mipLevels||!image||typeof image!=='object'||Reflect.get(image,'width')!==charts.atlas.width||Reflect.get(image,'height')!==charts.atlas.height)throw Error('Animal compiler texture does not match the bounded opaque RGBA8 atlas contract');
  let minimum=0;for(let level=0;level<charts.atlas.mipLevels;level++)minimum+=(charts.atlas.width/2**level)*(charts.atlas.height/2**level)*4;
  if(result.gpuBytes<minimum)throw Error('Animal compiler undercounts its retained atlas texture');
  const mean=charts.geometry.getAttribute(BAKED_MEAN_ATTRIBUTE);
  if(mean){
    const position=charts.geometry.getAttribute('position');
    if(!(mean instanceof THREE.BufferAttribute)||instanced(mean)||!(mean.array instanceof Float32Array)||mean.normalized||mean.itemSize!==3||mean.count!==position.count||charts.atlas.mipLevels!==4)throw Error('Animal compiler generated an invalid static chart-mean RGB field');
    for(const value of mean.array)if(!Number.isFinite(value)||value<0||value>1)throw Error('Animal compiler generated invalid linear chart-mean RGB');
    const firstByChart=new Map<number,number>();
    for(const triangle of charts.triangles){
      const first=firstByChart.get(triangle.chartId)??triangle.outputVertices[0];firstByChart.set(triangle.chartId,first);
      for(const vertex of triangle.outputVertices)for(let channel=0;channel<3;channel++)if(!Object.is(mean.getComponent(vertex,channel),mean.getComponent(first,channel)))throw Error('Animal compiler generated nonconstant chart-mean RGB');
    }
  }
}

/** A static-only view avoids Three.toNonIndexed expanding instance attributes
 * into bogus per-vertex NaNs (which would change brush edge partitions). */
function staticView(source:THREE.InstancedBufferGeometry):THREE.BufferGeometry {
  if(source.userData.origamiBrushPrebuilt)throw Error('Animal bake refuses a prebuilt brush body: original producer provenance is required');
  const view=new THREE.BufferGeometry();
  for(const[name,a]of Object.entries(source.attributes))if(!instanced(a))view.setAttribute(name,a);
  if(source.index)view.setIndex(source.index);view.setDrawRange(source.drawRange.start,source.drawRange.count);
  for(const group of source.groups)view.addGroup(group.start,group.count,group.materialIndex);
  return view;
}

/** This is an ACTUAL product producer oracle, not a seed formula assertion.
 * WildlifeLayer calls createRigBrushGeometry after exact indexing and before
 * union filtering. Compare its complete ordered triangle references and every
 * static field against the tagged bake path, after the SAME width update. */
function assertStockBrush(stock:THREE.BufferGeometry,tagged:THREE.BufferGeometry):void {
  const names=Object.keys(stock.attributes).filter(name=>!instanced(stock.getAttribute(name))).sort();
  const other=Object.keys(tagged.attributes).filter(name=>!instanced(tagged.getAttribute(name))).sort();
  if(JSON.stringify(names)!==JSON.stringify(other))throw Error('Animal bake ribbon field set differs from actual stock producer');
  if(!stock.index||!tagged.index||stock.index.count!==tagged.index.count)throw Error('Animal bake ribbon topology differs from stock');
  for(let i=0;i<stock.index.count;i++)if(stock.index.getX(i)!==tagged.index.getX(i))throw Error('Animal bake changed the ordered stock ribbon index/seed domain');
  for(const name of names){const a=stock.getAttribute(name),b=tagged.getAttribute(name);if(a.count!==b.count||a.itemSize!==b.itemSize||a.normalized!==b.normalized||!(a.array instanceof Float32Array)||!(b.array instanceof Float32Array))throw Error('Animal bake ribbon layout mismatch '+name);
    const aw=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length),bw=new Uint32Array(b.array.buffer,b.array.byteOffset,b.array.length),as=a instanceof THREE.InterleavedBufferAttribute?a.data.stride:a.itemSize,bs=b instanceof THREE.InterleavedBufferAttribute?b.data.stride:b.itemSize,ao=a instanceof THREE.InterleavedBufferAttribute?a.offset:0,bo=b instanceof THREE.InterleavedBufferAttribute?b.offset:0;
    for(let v=0;v<a.count;v++)for(let c=0;c<a.itemSize;c++)if(aw[v*as+ao+c]!==bw[v*bs+bo+c])throw Error(`Animal bake ribbon bits differ from stock: ${name}/${v}/${c}`);
  }
}

async function prepareResource(species:string,request:AnimalBakeRequest,reservation:AtlasPreparationReservation):Promise<AnimalBakedResource>{
  if(request.impasto!==0||request.wear!==0)throw Error('Private animal atlas admits only explicit relief0/wear0');
  if(!Number.isFinite(request.edgeWidth)||request.edgeWidth<.5||request.edgeWidth>5||request.strokeImperfection!==request.paint.strokeImperfection)throw Error('Animal atlas settings differ from actual brush settings');
  const source=origamiAnimalPresentationGeometry(1,species,false);if(!source)throw Error('No actual Origami presentation for species '+species);
  let view:THREE.BufferGeometry|undefined,stock:THREE.InstancedBufferGeometry|undefined,charts:ReturnType<typeof compileBakedCharts>|undefined,ink:ReturnType<typeof compileSourceInk>|undefined,compiled:AnimalAtlasCompilation|undefined,delivered:AnimalBakedResource|undefined;
  try{
    request.assertPreparationCurrent?.();
    // SAME constructor order as SpeciesRig. Never consume its mutable union
    // index/drawRange, never remove crossed eyes or missing clinical parts.
    if(source.userData.origamiReference)indexExactStaticVertices(source);
    view=staticView(source);
    charts=compileBakedCharts(view,{...request.chartOptions,rawUvAttribute:'animalPaintUv'});
    stock=createRigBrushGeometry(source);updateOrigamiBrushGeometry(stock,request.edgeWidth,request.strokeImperfection);
    ink=compileSourceInk(charts,[{geometry:view,sourceTriangleOffset:0,partName:species+':actual-complete-product-body'}],{edgeWidth:request.edgeWidth,strokeImperfection:request.strokeImperfection,maxTriangles:request.maxInkTriangles});
    if(ink.geometries.length!==1)throw Error('Unexpected animal ribbon producer split');
    assertStockBrush(stock,ink.geometries[0]!);
    const profile=charts.geometry.getAttribute('animalPaint'),profiles=[...new Set(Array.from({length:profile.count},(_,v)=>profile.getW(v)))].sort((a,b)=>a-b);
    // Source geometry/stock ribbons/ink are owned by this frame across ALL
    // awaits. A compiler never receives responsibility for disposing them.
    try{compiled=await request.compiler({species,charts,ink,profile:{attribute:'animalPaint',component:3},paint:request.paint,bakeOptions:request.bakeOptions,assertCurrent:()=>request.assertPreparationCurrent?.(),reservePreparation:reservation.reservePeak});}
    catch(error){if(error instanceof AggregateError)throw new AtlasBuildQuarantineError(error);throw error;}
    request.assertPreparationCurrent?.();validateCompilation(compiled,charts);
    const geometry=charts.geometry,sourceVertex=charts.sourceVertex,triangleChart=charts.triangleChart;
    const metadata:Record<string,unknown>={};for(const key of ['origamiReference','origamiParts','origamiBodyCenter','origamiReferenceScale','origamiReferenceFloor','origamiPresentationCorrections','origamiReferenceInfo','origamiCargoBack'])if(Object.hasOwn(source.userData,key))metadata[key]=source.userData[key];
    const cpuBytes=ownedBuffers([...geometryArrays(geometry),sourceVertex,triangleChart])+compiled.cpuBytes,gpuBytes=compiled.gpuBytes;
    const facts={species,bodyTriangles:charts.triangles.length,charts:charts.charts.length,atlas:charts.atlas,profiles,stockRibbonTriangles:stock.index!.count/3,stockRibbonProducerExact:true,allLivingAndDeadEyesRetained:true,allClinicalPartsRetained:true,sourceVertexMappingRetained:true,ownedTypedArrayBytes:cpuBytes,atlasGpuBytesNominal:gpuBytes,compilerFingerprint:request.compilerFingerprint,compilerRetainedCpuBytes:compiled.cpuBytes,compilerPlan:compiled.plan,runtimeStaticBytesPerSpeciesRig:ownedBuffers(geometryArrays(geometry)),bake:compiled.stats,limits:'Bind-surface paint metric; actual bone/clinical/cargo shader is retained, but non-affine elephant bending still requires Native visual qualification. Nominal arrays/textures, not JS overhead or driver VRAM. No individual/pawn-slot content baked.'};
    let disposed=false;const textureOwner=compiled;
    const resource:AnimalBakedResource={species,geometry,atlas:textureOwner.texture,atlasLayout:charts.atlas,sourceVertex,triangleChart,profiles,metadata,facts,cpuBytes,gpuBytes,
      dispose(){if(disposed)return;disposed=true;const failures:unknown[]=[];for(const close of [()=>geometry.dispose(),()=>textureOwner.dispose()])try{close();}catch(error){failures.push(error);}if(failures.length)throw new AggregateError(failures,'Animal atlas resource cleanup failed');},
    };
    charts=undefined;compiled=undefined;delivered=resource;return resource;
  }finally{
    const failures:unknown[]=[],close:(()=>void)[]=[];
    if(compiled)close.push(()=>compiled!.dispose());if(charts)close.push(()=>charts!.geometry.dispose());if(ink)close.push(()=>ink!.dispose());if(stock)close.push(()=>stock!.dispose());if(view)close.push(()=>view!.dispose());close.push(()=>source.dispose());
    for(const key of ['origamiLines','origamiWear']){const companion=source.userData[key];if(companion instanceof THREE.BufferGeometry)close.push(()=>companion.dispose());}
    for(const dispose of close)try{dispose();}catch(error){failures.push(error);}
    if(failures.length){if(delivered)try{delivered.dispose();}catch(error){failures.push(error);}throw new AtlasBuildQuarantineError(new AggregateError(failures,'Animal preparation cleanup could not be proved'));}
  }
}

/** One library per renderer/scene owner; shared pending work and one atlas per
 * exact species/recipe/palette/settings key, independently of population size. */
export class BakedAnimalLibrary {
  private readonly cache:AtlasCache<AnimalBakedResource>;
  constructor(limits:AtlasBytes){this.cache=new AtlasCache(limits);}
  snapshot(){return this.cache.snapshot();}
  async acquire(species:string,request:AnimalBakeRequest):Promise<AtlasLease<AnimalBakedResource>>{
    const c=request.chartOptions,p=request.paint;
    if(!request.paintFingerprint)throw Error('Animal atlas needs an exact current paint/coverage fingerprint');
    if(typeof request.compiler!=='function')throw Error('Animal atlas requires an explicit compiler');
    if(typeof request.compilerFingerprint!=='string'||!request.compilerFingerprint.length)throw Error('Injected animal compiler requires a compilerFingerprint');
    const aborted=()=>{const error=new Error('Animal atlas waiting owner aborted');error.name='AbortError';return error;};
    if(request.signal?.aborted)throw aborted();
    const lease=await this.cache.acquire({recipe:species+':'+request.recipeFingerprint,form:'complete-product-presentation',palette:request.paletteFingerprint,settings:{compiler:request.compilerFingerprint,paintGeneration:request.paintFingerprint,impasto:request.impasto,wear:request.wear,width:request.edgeWidth,roughness:request.strokeImperfection,lineOpacity:p.lineOpacity,brushR:p.brushColorLinear[0],brushG:p.brushColorLinear[1],brushB:p.brushColorLinear[2],density:c.texelsPerUnit,padding:c.paddingTexels??2**((c.mipLevels??1)-1),mips:c.mipLevels??1,maxAtlas:c.maxAtlasSize??4096,maxPixels:c.maxAtlasPixels??16777216,maxOutputBytes:c.maxOutputBytes??134217728,maxTriangles:c.maxTriangles??200000,positionTolerance:c.positionTolerance??1e-7,uvTolerance:c.uvTolerance??1e-7,planeTolerance:c.planeTolerance??1e-6,maxInk:request.maxInkTriangles??100000,maxBakeBytes:request.bakeOptions?.maxAtlasBytes??16777216,maxScratch:request.bakeOptions?.maxScratchBytes??33554432}},request.reservation,reservation=>prepareResource(species,request,reservation),request.deferGpuReservation?{cpuBytes:request.reservation.cpuBytes,gpuBytes:0}:request.reservation);
    if(request.signal?.aborted){lease.release();this.cache.evictUnused();throw aborted();}return lease;
  }
  evictUnused(){return this.cache.evictUnused();}
  dispose(){this.cache.dispose();}
}

function assertSourceFields(resource:AnimalBakedResource,source:THREE.BufferGeometry,bakedClone=false):void{
  for(const[name,expected]of Object.entries(resource.geometry.attributes)){
    if(!bakedClone&&(name==='bakedUv'||name===BAKED_MEAN_ATTRIBUTE))continue;
    const actual=source.getAttribute(name);if(!actual||instanced(actual)||actual.itemSize!==expected.itemSize)throw Error('Animal source static field mismatch '+name);
    for(let v=0;v<expected.count;v++){const at=bakedClone?v:resource.sourceVertex[v]!;if(at>=actual.count)throw Error('Animal source vertex domain changed');for(let c=0;c<expected.itemSize;c++)if(!Object.is(actual.getComponent(at,c),expected.getComponent(v,c)))throw Error('Animal source/presentation epoch changed '+name);}
  }
}
// These aliases belong to the actor source/other live consumers, not to an
// independently retired atlas clone. Track identity, not just attribute names:
// a later binding-owned replacement must still be disposed normally.
const borrowedOwners=new WeakMap<THREE.InstancedBufferGeometry,ReadonlyMap<string,Attribute>>();
function disposeBindingGeometry(geometry:THREE.InstancedBufferGeometry):void{
  const borrowed=borrowedOwners.get(geometry);borrowedOwners.delete(geometry);
  if(borrowed)for(const[name,a]of borrowed)if(geometry.getAttribute(name)===a)geometry.deleteAttribute(name);
  geometry.dispose();
}
function bindOwners(geometry:THREE.InstancedBufferGeometry,source:THREE.InstancedBufferGeometry):void{
  for(const name of requiredOwners){const attr=source.getAttribute(name);if(!attr||!instanced(attr)||source.instanceCount>attr.count)throw Error('Actual animal owner stream missing/capacity too small '+name);}
  // Snapshot first: growth adoption may deliberately pass the SAME geometry.
  const aliases=new Map<string,Attribute>();for(const[name,a]of Object.entries(source.attributes))if(instanced(a))aliases.set(name,a);
  for(const[name,a]of borrowedOwners.get(geometry)??[])if(!aliases.has(name)&&geometry.getAttribute(name)===a)geometry.deleteAttribute(name);
  for(const[name,a]of aliases)geometry.setAttribute(name,a);
  borrowedOwners.set(geometry,aliases);
  geometry.instanceCount=source.instanceCount;geometry.userData.animationCache=source.userData.animationCache;
}
/** Exclusive GPU attribute wrappers per rig, shared immutable CPU arrays and
 * shared atlas per species. Three186 geometry disposal deletes its attributes,
 * so sharing BufferAttribute OBJECTS between separately disposed rigs is unsafe. */
function instantiate(resource:AnimalBakedResource,source:THREE.InstancedBufferGeometry):THREE.InstancedBufferGeometry{
  assertSourceFields(resource,source);const geometry=new THREE.InstancedBufferGeometry(),buffers=new Map<THREE.InterleavedBuffer,THREE.InterleavedBuffer>();
  for(const[name,a]of Object.entries(resource.geometry.attributes)){
    if(a instanceof THREE.InterleavedBufferAttribute){let data=buffers.get(a.data);if(!data){data=new THREE.InterleavedBuffer(a.data.array,a.data.stride).setUsage(a.data.usage);buffers.set(a.data,data);}geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(data,a.itemSize,a.offset,a.normalized));}
    else{const next=new THREE.BufferAttribute(a.array,a.itemSize,a.normalized).setUsage(a.usage);next.gpuType=a.gpuType;geometry.setAttribute(name,next);}
  }
  // Charts keep one stored record per original corner for sourceVertex checks.
  // Reuse only bit-identical complete records in the post-transform cache;
  // triangle order, seams and clinical tags stay exact. This rig owns its index
  // independently of the immutable resource and the other live atlas rigs.
  indexExactStaticVertices(geometry);
  geometry.userData={...resource.metadata};geometry.boundingBox=source.boundingBox?.clone()??null;geometry.boundingSphere=source.boundingSphere?.clone()??null;bindOwners(geometry,source);return geometry;
}

export interface AnimalAtlasPublication {
  isCurrent():boolean;
  /** Explicit caller capability: actual published resident blood words are
   * zero, current() rejects a blood change during warmup, and later blood
   * switches to the original source material before this clone is rendered.
   * Omit for generic callers which still require the supplied blood closure. */
  bloodFree?:true;
  /** Required to transfer existing Exploration/Environment configured WeakSets
   * without composing their graphs twice. Called BEFORE warmup/publication. */
  adoptConfiguredClone(source:THREE.MeshStandardNodeMaterial,next:THREE.MeshStandardNodeMaterial):boolean;
  warmup(binding:PreparedAnimalAtlas):Promise<void>;
  /** Atomic SpeciesRig seam: body/active textured material, unions and all
   * selection/fire/slaughter geometry users. No partially published state.
   * detach MUST remove every live reference before resource lease release;
   * it handles any grown geometry and other caller-owned geometry references.
   * Do NOT dispose binding.geometry/material: the binding owns those objects. */
  publish(binding:PreparedAnimalAtlas):{detach():void;isAttached():boolean};
  ribbons:THREE.Object3D;
  refreshRibbons?():void;
}
export interface PreparedAnimalAtlas {
  readonly geometry:THREE.InstancedBufferGeometry;
  readonly material:THREE.MeshStandardNodeMaterial;
  readonly resource:AnimalBakedResource;
  readonly sourceVertex:Uint32Array;
  syncInstances(source:THREE.InstancedBufferGeometry):void;
  /** After real growPawnBuffers; static values must still match. Ordinary rig
   * owns disposal of its previous clone. This registers the new shared owner
   * aliases for safe independent retirement. Reinstall union after this hook. */
  adoptGrownGeometry(next:THREE.InstancedBufferGeometry):void;
  /** Source setTexturesEnabled calls this after choosing active/plain material.
   * Keep atlas lease alive in plain mode because static arrays remain shared. */
  setAtlasEnabled(enabled:boolean):void;
  commit():Promise<void>;
  /** Must run before normal SpeciesRig/material/geometry teardown. */
  dispose():void;
}

/** Takes ownership of the passed lease on success AND failure. Generic callers
 * retain the supplied blood closure; only an explicit bloodFree capability
 * omits it. Never bake blood or absence. SpeciesRig must suspend
 * the fused material while blood is visible: compositing pigment over baked
 * ink would recolour ink that the source deliberately leaves untouched. */
export function prepareAnimalAtlasBinding(lease:AtlasLease<AnimalBakedResource>,source:THREE.InstancedBufferGeometry,sourceMaterial:THREE.MeshStandardNodeMaterial,withBlood:(base:THREE.Node<'vec3'>)=>THREE.Node<'vec3'>,port:AnimalAtlasPublication):PreparedAnimalAtlas{
  let geometry:THREE.InstancedBufferGeometry|undefined,material:THREE.MeshStandardNodeMaterial|undefined;
  try{
    if(!port.isCurrent()||sourceMaterial.normalNode!==null||Reflect.get(sourceMaterial,'normalMap')||Reflect.get(sourceMaterial,'bumpMap'))throw Error('Animal atlas binding requires a current explicit relief0 rig');
    geometry=instantiate(lease.resource,source);material=sourceMaterial.clone();
    for(const key of ['positionNode','normalNode','maskNode','maskShadowNode','outputNode'] as const)if(material[key]!==sourceMaterial[key])throw Error('Animal material clone changed a live pose/mask/light graph '+key);
    const color=geometry.hasAttribute(BAKED_MEAN_ATTRIBUTE)?bakedChartMeanColorNode(lease.resource.atlas):texture(lease.resource.atlas,attribute('bakedUv','vec2')).rgb;
    material.colorNode=port.bloodFree===true?color:withBlood(color);
    material.name=sourceMaterial.name+' — private species baked atlas';material.userData.privateBakedAnimalAtlas=true;material.userData.origamiBakedBloodFree=port.bloodFree===true;
    if(!port.adoptConfiguredClone(sourceMaterial,material))throw Error('Animal configured-material owner refused clone adoption');
    const nextMaterial=material;let currentGeometry=geometry,publication:ReturnType<AnimalAtlasPublication['publish']>|undefined,disposed=false,committed=false,warming=false,enabled=true;
    const oldVisible=port.ribbons.visible,hadOwner=Object.hasOwn(port.ribbons.userData,'origamiOwnerVisible'),oldOwner=port.ribbons.userData.origamiOwnerVisible;
    const showSource=()=>{if(hadOwner)port.ribbons.userData.origamiOwnerVisible=oldOwner;else delete port.ribbons.userData.origamiOwnerVisible;port.ribbons.visible=oldVisible;port.refreshRibbons?.();};
    const updateRibbons=()=>{if(committed&&enabled){port.ribbons.userData.origamiOwnerVisible=false;port.ribbons.visible=false;}else showSource();};
    const binding:PreparedAnimalAtlas={get geometry(){return currentGeometry;},material:nextMaterial,resource:lease.resource,sourceVertex:lease.resource.sourceVertex,
      syncInstances(next){if(disposed)throw Error('Disposed animal atlas binding');bindOwners(currentGeometry,next);},
      adoptGrownGeometry(next){if(disposed)throw Error('Disposed animal atlas binding');assertSourceFields(lease.resource,next,true);currentGeometry=next;bindOwners(next,next);},
      setAtlasEnabled(value){if(disposed)throw Error('Disposed animal atlas binding');enabled=value;updateRibbons();},
      async commit(){if(disposed||committed||warming||!port.isCurrent())throw Error('Animal atlas publication owner is stale/already warming');warming=true;try{await port.warmup(binding);if(disposed||!port.isCurrent())throw Error('Animal atlas superseded while warming');publication=port.publish(binding);if(!publication.isAttached())throw Error('Animal atlas publication did not attach its owner');committed=true;updateRibbons();}finally{warming=false;}},
      dispose(){if(disposed)return;if(publication?.isAttached()){publication.detach();if(publication.isAttached())throw Error('Animal atlas still has live users; lease/material kept resident');}disposed=true;committed=false;showSource();disposeBindingGeometry(currentGeometry);nextMaterial.dispose();lease.release();},
    };
    geometry=undefined;material=undefined;return binding;
  }catch(error){if(geometry)disposeBindingGeometry(geometry);material?.dispose();lease.release();throw error;}
}
