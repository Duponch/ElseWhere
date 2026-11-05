import * as THREE from 'three/webgpu';
import type { World } from '../sim/types';
import { ROCK_INDICES, ROCK_VERTICES } from './RockSurface';
import {RockSurfaceModel,ROCK_SURFACE_UV,ROCK_SURFACE_VERTICES} from './models/RockSurfaceModel';
import {RockStrokeTable,type RockStrokePatch} from './surfaces/RockStrokeTable';
import {faceStrokeVertexHeaders,createFaceStrokeNode} from './surfaces/FaceStrokeTable';
import {preparedAffineInteriorCircleVertex} from './surfaces/AffineStrokeKernel';
import {rockBodyColorNode,rockFinalAffineAlbedoNode,rockStonePaintUvNode} from './surfaces/RockFinalSource';
import { WORLD_SCALE } from '../world/scale';
import { STONE_KINDS } from '../sim/geology';
import { material } from './primitives';
import { opaqueRockExplorationMaterial256 } from './ExplorationMask256';
import { foggedCell256 } from '../sim/exploration-state-256';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import {attribute,positionLocal} from 'three/tsl';
import {currentGraphicsStyle} from './graphics-style';
import {RockFinalSurface} from './surfaces/RockFinalSurface';
import {RockFinalOwner} from './surfaces/RockFinalOwner';
import {createRockFinalRuntimeOptions,type RockFinalRuntimeConfiguration} from './surfaces/RockFinalRuntime';
import {collectRockFinalInput} from './surfaces/RockFinalInput';
import type {RockFinalPublication} from './surfaces/RockFinalRuntimeTypes';
import type {SharedSurfacePreparationStage} from './surfaces/SharedSurfacePreparation';

/** One resident surface shared by close/distant views, including the map slab.
 * Cell slots survive excavation/restoration. Only affected vertices are uploaded;
 * the small active index list is compacted in-place, without reallocating buffers.
 * Keep default StaticDrawUsage: r186 otherwise uploads unchanged attributes on
 * every frame. Mining marks exact ranges and increments needsUpdate explicitly. */
export class RockLayer {
  private readonly graphicsStyle=currentGraphicsStyle();
  private readonly stroke=new RockStrokeTable();
  private readonly strokeFaces=new Set<number>();private strokeWorldRevision=0;
  private boundStrokeMode='';
  private model:RockSurfaceModel|undefined;
  private previousModel:RockSurfaceModel|undefined;
  private pendingSlab=false;
  private closed=false;
  readonly group=new THREE.Group();
  readonly mesh:THREE.Mesh;
  readonly stats={updatedCells:0,indexCount:0,bufferBytes:0,contourBufferBytes:0};
  private slots=new Map<number,{slot:number;indices:number[]}>();
  private rockMask=new Uint8Array(0);
  private tiles:World['tiles']|undefined;
  private capacity=0;
  private seed=0;
  private width=0;
  private height=0;
  private readonly local=new THREE.Group();
  private readonly chunks=new Map<string,{cells:Set<number>;mesh:THREE.Mesh;bodyMesh:THREE.Mesh;capacity:number}>();
  private readonly finalSurface:RockFinalSurface;private finalOwner:RockFinalOwner|undefined;private finalWorldRevision=0;private finalPartitionRevision='';
  private finalPublication:RockFinalPublication={route:'source',style:'default'};
  private distantPrepared:THREE.Mesh|undefined;private distantBody:THREE.Mesh|undefined;private distantSlab:THREE.Mesh|undefined;
  compiledMaterialsChanged435?:()=>void;
  private distant=false;
  private texturesEnabled=true;
  private readonly stonePaint=createStylizedSurfaceTexture('stone');
  // Clean dedicated materials: shared props already have exploration masks.
  private readonly plainMaterial=opaqueRockExplorationMaterial256(material(0xffffff,{vertexColors:true}));
  private readonly texturedMaterial=opaqueRockExplorationMaterial256(material(0xffffff,{vertexColors:true}));
  compiledMaterials435():readonly THREE.NodeMaterial[]{return[this.plainMaterial,this.texturedMaterial,this.finalSurface.preparedMaterial,this.finalSurface.bodyMaterial];}
  constructor(configure?: (material:THREE.MeshStandardNodeMaterial)=>void) {
    // Coordinates come from the existing world-space position attribute, so
    // even a vast continuous cliff adds no UV buffer, vertices or draw calls.
    // The varying moves coordinate arithmetic out of the fragment stage.
    // A full repeat spans roughly 38 world cells. Top faces use x/z directly;
    // height gently offsets side faces without introducing a visible cell grid.
    this.bindSurface();
    configure?.(this.plainMaterial);configure?.(this.texturedMaterial);
    // Both final materials exist before the first Pastel draw. Their Standard
    // properties, light/mask fields and shared Source attributes stay identical.
    this.finalSurface=new RockFinalSurface(this.texturedMaterial,this.stonePaint,configure);
    this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.texturedMaterial);
    this.mesh.name='Continuous rock surface';this.mesh.castShadow=true;this.mesh.receiveShadow=true;
    this.mesh.matrixAutoUpdate=false;
    this.group.add(this.mesh,this.local);this.setDistant(false);
  }
  /** Install once during Core construction, before initial preparation. The
   * ledger provider is explicit; missing bytes refuse allocation into Source. */
  configureRockFinalRuntime(options:RockFinalRuntimeConfiguration):void {
    if(this.finalOwner||this.closed||!this.graphicsStyle)throw Error('One live renderer-local Rock final configuration required');
    const self=this;
    this.finalOwner=new RockFinalOwner({...createRockFinalRuntimeOptions({...options,stonePaint:this.stonePaint,lookupStageUpperBytes:span=>this.finalSurface.lookupStageUpperBytes(span)}),host:{context:this.graphicsStyle,texturesEnabled:()=>this.texturesEnabled,collect:assertCurrent=>collectRockFinalInput({get geometry(){return self.mesh.geometry;},stroke:this.stroke,slots:this.slots,get width(){return self.width;},get height(){return self.height;},revision:()=>`${self.strokeWorldRevision}:${self.finalWorldRevision}:${self.stroke.stats.patches}`},assertCurrent),stage:binding=>this.stageRockFinalPublication(binding)}});
  }
  rockFinalStatus(){return this.finalOwner?.status()??{ready:false,representation:'source',refusal:'Runtime ledger/adapter not installed'};}
  requestRockFinalQualityRoute(route:'source'|'prepared'|undefined):void{if(!this.finalOwner)throw Error('Rock final runtime not installed');this.finalOwner.requestQualityRoute(route);}
  rockFinalNominalOwnership(){return{lookupCpuBytes:this.finalSurface.lookupCpuBytes,lookupGpuBytes:this.finalSurface.lookupGpuBytes,owner:this.finalOwner?.status()??null};}
  rockFinalCanonicalTable(){return this.stroke;}
  /** Canonical current/inactive/retired buffers are a conservative potentially
   * uploaded bound. Affines are supplied separately by their actual manager. */
  rockFinalSourceInventory(){const model=this.model,rawCpu=model?model.rawPosition.byteLength+model.rawColor.byteLength+(model.stock.index?.array.byteLength??0)+model.capacity*(6+14*4):0,stoneCpu=ArrayBuffer.isView(this.stonePaint.image.data)?this.stonePaint.image.data.byteLength:0;return{textures:[this.stonePaint],gpuBufferBytes:this.stroke.cpuBytes,cpuBytes:this.stroke.cpuBytes+rawCpu+stoneCpu,complete:!this.previousModel,scope:'Rock canonical current/inactive/retired storage, Source stone pixels and non-scene stock/raw model CPU; excludes separately inventoried prepared affines, atlas/lookup and deduplicated live Scene geometry'};}
  rockFinalLookupStageUpperBytes(faceSpan:number){return this.finalSurface.lookupStageUpperBytes(faceSpan);}
  rockFinalRequiresAsyncClose():boolean{const state=this.finalOwner?.status();return!!state&&!state.closed&&(state.gpuBytes>0||state.pending||state.quarantined>0);}
  async closeRockFinalTextures():Promise<void>{await this.finalOwner?.close();}
  private stageRockFinalPublication(binding:RockFinalPublication):SharedSurfacePreparationStage {
    const surface=this.finalSurface.stage(binding),before=this.finalPublication,oldRevision=this.finalPartitionRevision,changes:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[];data?:Uint32Array;count:number}[]=[];
    const partition=binding.input&&binding.input.revision()!==this.finalPartitionRevision;
    const bodyFaces=new Set<number>();if(partition){const input=binding.input!,counts=new Map<number,number>();for(let i=0;i<input.arrays.faceId.length;i++){const panel=input.arrays.facePanel[i]!;counts.set(panel,(counts.get(panel)??0)+input.arrays.faceHeader[i*8+1]!);}for(let i=0;i<input.arrays.faceId.length;i++)if(counts.get(input.arrays.facePanel[i]!)===0)bodyFaces.add(input.arrays.faceId[i]!);}
    const next: {mesh:THREE.Mesh;data:Uint32Array}[]=[];
    for(const chunk of this.chunks.values()){
      for(const mesh of[chunk.mesh,chunk.bodyMesh])changes.push({mesh,material:mesh.material,data:partition?(mesh.geometry.index!.array as Uint32Array).slice(0,mesh.geometry.drawRange.count):undefined,count:mesh.geometry.drawRange.count});
      if(partition){const ink:number[]=[],body:number[]=[],raw=this.mesh.geometry.getAttribute(ROCK_SURFACE_UV);for(const cell of chunk.cells)for(let at=0,indices=this.slots.get(cell)!.indices;at<indices.length;at+=3)(bodyFaces.has(raw.getZ(indices[at]!))?body:ink).push(indices[at]!,indices[at+1]!,indices[at+2]!);next.push({mesh:chunk.mesh,data:Uint32Array.from(ink)},{mesh:chunk.bodyMesh,data:Uint32Array.from(body)});}
    }
    for(const mesh of[this.distantPrepared,this.distantBody])if(mesh)changes.push({mesh,material:mesh.material,data:partition?(mesh.geometry.index!.array as Uint32Array).slice(0,mesh.geometry.drawRange.count):undefined,count:mesh.geometry.drawRange.count});
    if(partition&&this.distantPrepared&&this.distantBody){const ink:number[]=[],body:number[]=[],raw=this.mesh.geometry.getAttribute(ROCK_SURFACE_UV);for(const record of this.slots.values())for(let at=0;at<record.indices.length;at+=3)(bodyFaces.has(raw.getZ(record.indices[at]!))?body:ink).push(record.indices[at]!,record.indices[at+1]!,record.indices[at+2]!);next.push({mesh:this.distantPrepared,data:Uint32Array.from(ink)},{mesh:this.distantBody,data:Uint32Array.from(body)});}
    let published=false,committed=false,disposed=false;
    const write=(mesh:THREE.Mesh,data:Uint32Array)=>{const index=mesh.geometry.index!;if(data.length>index.count)throw Error('Rock partition exceeds actual retained chunk capacity');(index.array as Uint32Array).set(data);index.clearUpdateRanges();if(data.length)index.addUpdateRange(0,data.length);index.needsUpdate=true;mesh.geometry.setDrawRange(0,data.length);};
    const materials=(value:RockFinalPublication)=>{const source=this.texturesEnabled?this.texturedMaterial:this.plainMaterial;for(const chunk of this.chunks.values()){chunk.mesh.material=value.route==='source'?source:this.finalSurface.preparedMaterial;chunk.bodyMesh.material=value.route==='source'?source:this.finalSurface.bodyMaterial;}for(const child of this.local.children)if(child instanceof THREE.Mesh&&!Array.from(this.chunks.values()).some(c=>c.mesh===child||c.bodyMesh===child))child.material=source;if(this.distantSlab)this.distantSlab.material=source;if(this.distantPrepared)this.distantPrepared.material=this.finalSurface.preparedMaterial;if(this.distantBody)this.distantBody.material=this.finalSurface.bodyMaterial;};
    const rollback=()=>{if(committed)throw Error('Transferred Rock publication cannot roll back');if(!published)return;for(const row of changes){if(row.data)write(row.mesh,row.data);row.mesh.material=row.material;}surface.rollback();this.finalPublication=before;this.finalPartitionRevision=oldRevision;this.setDistant(this.distant);this.compiledMaterialsChanged435?.();published=false;};
    return{publish:()=>{if(disposed||published)throw Error('Rock publication unavailable');published=true;surface.publish();for(const row of next)write(row.mesh,row.data);materials(binding);this.finalPublication=binding;if(binding.input)this.finalPartitionRevision=binding.input.revision();this.setDistant(this.distant);this.compiledMaterialsChanged435?.();},commit:()=>{if(!published)throw Error('Publish Rock routes before commit');surface.commit();committed=true;},rollback,dispose:()=>{if(disposed)return;if(!committed)rollback();surface.dispose();disposed=true;},stats:{partitionChanged:!!partition,commonAttributes:true,rawUvUnchanged:true,slabSource:true,distantPreparedViews:true}};
  }
  private bindSurface():void {
    const paintedUv=rockStonePaintUvNode(positionLocal);
    // Source rocks use this same stone pigment in both texture styles. Only
    // their ink changes: a face-fill painting here would replace the original
    // broad stone map with a new kraft frame on every small cliff facet.
    // Include vertex pigment before the ink, so it cannot tint the ink twice.
    const context=this.graphicsStyle,base=attribute('color','vec3'),surface=attribute(ROCK_SURFACE_UV,'vec3');
    const prepared=context?.preparedStrokes.acquire(this.stroke,{faceIds:()=>[...this.strokeFaces],revision:()=>`${this.strokeWorldRevision}:${this.stroke.stats.patches}`,isLinear:()=>this.stroke.representationKey==='single',interiorCircle:true,onRepresentationChange:()=>this.bindSurface()}),headerTable=prepared?.headerTable()??this.stroke,read=prepared?.readRow??this.stroke.readRow;
    const headers=context?faceStrokeVertexHeaders({table:headerTable,faceId:surface.z,enabled:context.surfaceEncoding,opacity:context.lineOpacity,readRow:read},'v_rockStrokeHeader'):undefined;
    const common=context?{faceId:surface.z,headers,faceUv:surface.xy,enabled:context.surfaceEncoding,opacity:context.lineOpacity,brushColor:context.brushColor.rgb,samplePigment:(p:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>)=>context.sampleStrokePigment(p,dx,dy),sampleDry:(p:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>)=>context.sampleStrokeDry(p,dx,dy)}:undefined;
    const interiorCircle=context&&prepared?preparedAffineInteriorCircleVertex({owner:prepared,faceId:surface.z,enabled:context.surfaceEncoding,opacity:context.lineOpacity}):undefined;
    const ink=(body:THREE.Node<'vec3'>)=>!context?body:prepared?rockFinalAffineAlbedoNode(body,{...common!,owner:prepared,interiorCircle}):createFaceStrokeNode(body,{...common!,table:this.stroke,width:context.edgeWidth,irregularity:context.strokeImperfection,readRow:this.stroke.readRow});
    this.texturedMaterial.vertexColors=this.plainMaterial.vertexColors=false;
    this.texturedMaterial.colorNode=ink(rockBodyColorNode(base,this.stonePaint,paintedUv));
    // Source contours also remain visible when surface textures are disabled.
    // Neither rock body ever had an optional relief or physical-wear graph;
    // all ink settings are shared uniforms and need no feature refresh owner.
    this.plainMaterial.colorNode=ink(base);
    this.boundStrokeMode=this.stroke.representationKey;
    this.plainMaterial.needsUpdate=true;this.texturedMaterial.needsUpdate=true;
  }
  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;
    const chosen=enabled?this.texturedMaterial:this.plainMaterial;
    this.mesh.material=chosen;
    this.local.traverse(object=>{if(object instanceof THREE.Mesh)object.material=chosen;});
    this.finalOwner?.texturesChanged();
  }
  setDistant(distant:boolean):void {
    this.distant=distant;const final=distant&&this.finalPublication.route!=='source'&&!!this.distantPrepared;this.mesh.visible=distant&&!final;this.mesh.castShadow=false;this.local.visible=!distant;for(const mesh of[this.distantPrepared,this.distantBody,this.distantSlab])if(mesh)mesh.visible=final;
  }
  private clearDistantViews():void{for(const mesh of[this.distantPrepared,this.distantBody,this.distantSlab])if(mesh){mesh.removeFromParent();mesh.geometry.dispose();}this.distantPrepared=this.distantBody=this.distantSlab=undefined;}
  private resetDistantViews():void{this.clearDistantViews();const box=this.mesh.geometry.boundingBox!.clone(),capacity=this.mesh.geometry.index!.count,create=(name:string,indices:Uint32Array,material:THREE.Material|THREE.Material[])=>{const mesh=new THREE.Mesh(this.viewGeometry(indices,box.clone()),material);mesh.name=name;mesh.matrixAutoUpdate=false;mesh.receiveShadow=true;mesh.castShadow=false;mesh.visible=false;this.group.add(mesh);return mesh;};this.distantPrepared=create('Distant rock final panels',new Uint32Array(capacity),this.finalSurface.preparedMaterial);this.distantBody=create('Distant rock zero-stroke panels',new Uint32Array(capacity),this.finalSurface.bodyMaterial);this.distantPrepared.geometry.setDrawRange(0,0);this.distantBody.geometry.setDrawRange(0,0);this.distantSlab=create('Distant rock Source slab',(this.mesh.geometry.index!.array as Uint32Array).slice(0,36),this.mesh.material);this.distantSlab.geometry.setDrawRange(0,36);}
  private clearLocal():void {for(const object of this.local.children)if(object instanceof THREE.Mesh)object.geometry.dispose();this.local.clear();this.chunks.clear();}
  private viewGeometry(indices:Uint32Array,box:THREE.Box3):THREE.BufferGeometry {
    const geometry=new THREE.BufferGeometry();
    for(const[name,a]of Object.entries(this.mesh.geometry.attributes))geometry.setAttribute(name,a);
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
    geometry.boundingBox=box;geometry.boundingSphere=box.getBoundingSphere(new THREE.Sphere());return geometry;
  }
  private updateLocal(dirty:Set<number>,reset:boolean):void {
    const size=WORLD_SCALE.chunkSize,keys=new Set<string>();
    if(reset) {
      this.clearLocal();
      this.resetDistantViews();
      const slab=this.viewGeometry((this.mesh.geometry.index!.array as Uint32Array).slice(0,36),new THREE.Box3(new THREE.Vector3(-.6,-1,-.6),new THREE.Vector3(this.width-.4,0,this.height-.4)));
      const mesh=new THREE.Mesh(slab,this.mesh.material);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;this.local.add(mesh);
    }
    for(const i of dirty) {
      const cx=Math.floor(i%this.width/size),cz=Math.floor(Math.floor(i/this.width)/size),key=`${cx}:${cz}`;keys.add(key);
      let chunk=this.chunks.get(key);
      if(!chunk) {
        const bounds=new THREE.Box3(new THREE.Vector3(cx*size-.8,-.01,cz*size-.8),new THREE.Vector3((cx+1)*size+.3,4,(cz+1)*size+.3));
        const mesh=new THREE.Mesh(this.viewGeometry(new Uint32Array(0),bounds),this.mesh.material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;
        const bodyMesh=new THREE.Mesh(this.viewGeometry(new Uint32Array(0),bounds.clone()),this.mesh.material);bodyMesh.castShadow=true;bodyMesh.receiveShadow=true;bodyMesh.matrixAutoUpdate=false;
        chunk={cells:new Set(),mesh,bodyMesh,capacity:0};this.chunks.set(key,chunk);this.local.add(mesh,bodyMesh);
      }
      chunk.cells.add(i);
    }
    for(const key of keys) {
      const c=this.chunks.get(key)!;
      if(c.cells.size>c.capacity) {c.capacity=2**Math.ceil(Math.log2(c.cells.size));c.mesh.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(c.capacity*ROCK_INDICES),1));c.bodyMesh.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(c.capacity*ROCK_INDICES),1));}
      const indices=c.mesh.geometry.index!;let count=0;
      for(const cell of c.cells){const faces=this.slots.get(cell)!.indices;(indices.array as Uint32Array).set(faces,count);count+=faces.length;}
      c.mesh.geometry.setDrawRange(0,count);indices.clearUpdateRanges();indices.addUpdateRange(0,count);indices.needsUpdate=true;
      c.bodyMesh.geometry.setDrawRange(0,0);c.mesh.material=this.mesh.material;c.bodyMesh.material=this.mesh.material;this.finalPartitionRevision='';
    }
    this.stats.bufferBytes = Object.values(this.mesh.geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0) + this.mesh.geometry.index!.array.byteLength + this.local.children.reduce((sum,m)=>sum+(m as THREE.Mesh).geometry.index!.array.byteLength,0);
    this.setDistant(this.distant);
  }
  private allocate(world:World,capacity:number,reset:boolean):void {
    this.capacity=capacity;
    if(this.previousModel)throw Error('Previous rock model was not retired after its sparse publication');
    const next=new RockSurfaceModel(world.width,world.height,capacity);if(reset){this.stroke.reset(world.width,world.height);this.pendingSlab=true;}this.stroke.bindModel(next);
    this.previousModel=this.model;this.model=next;if(!this.previousModel)this.mesh.geometry.dispose();this.mesh.geometry=next.geometry;
    this.stats.bufferBytes=(24+capacity*ROCK_SURFACE_VERTICES)*48+(36+capacity*ROCK_INDICES)*4;
  }
  update(world:World,reset=false,changedTiles?:readonly number[]):void {
    this.stats.updatedCells=0;
    if(!reset&&this.tiles===world.tiles)return;
    reset ||= world.width!==this.width||world.height!==this.height||world.seed!==this.seed;
    const changed:number[]=[];
    if(reset) {this.strokeFaces.clear();this.strokeWorldRevision++;this.slots.clear();this.rockMask=new Uint8Array(world.tiles.length);this.width=world.width;this.height=world.height;this.seed=world.seed;}
    const inspect=reset?undefined:changedTiles;
    for(let n=0;n<(inspect?.length??world.tiles.length);n++) {
      const i=inspect?inspect[n]!:n;
      const tile=world.tiles[i]!;
      const fogged=foggedCell256(world,i);
      const rock=tile.terrain==='rock'?(fogged?1:tile.ore?tile.ore==='machinery'?9:tile.ore==='gold'?10:tile.ore==='plasteel'?11:tile.ore==='uranium'?12:tile.ore==='jade'?13:8:tile.stone?2+STONE_KINDS.indexOf(tile.stone):1):0;
      const state=rock+(rock&&fogged?16:0);
      if(state!==this.rockMask[i]) {changed.push(i);this.rockMask[i]=state;}
      if(rock&&!this.slots.has(i))this.slots.set(i,{slot:this.slots.size,indices:[]});
    }
    let reallocated=false;
    if(reset||this.slots.size>this.capacity) {this.allocate(world,Math.max(16,2**Math.ceil(Math.log2(Math.max(1,this.slots.size)))),reset);reallocated=true;}
    const dirty=new Set<number>();
    if(reallocated)for(const i of this.slots.keys())dirty.add(i);
    else for(const i of changed)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
      const x=i%world.width+dx,z=Math.floor(i/world.width)+dz;
      if(x>=0&&z>=0&&x<world.width&&z<world.height&&this.slots.has(z*world.width+x))dirty.add(z*world.width+x);
    }
    if(dirty.size||reallocated) {
      const model=this.model!,g=model.geometry,position=g.getAttribute('position') as THREE.BufferAttribute,normal=g.getAttribute('normal') as THREE.BufferAttribute,color=g.getAttribute('color') as THREE.BufferAttribute,paint=g.getAttribute(ROCK_SURFACE_UV) as THREE.BufferAttribute,geometric=new Set<number>();
      for(const attribute of [position,normal,color,paint])attribute.clearUpdateRanges();
      for(const i of dirty) {
        const record=this.slots.get(i)!,v=model.vertex(record.slot),oldModel=reset?undefined:this.previousModel??model,oldIndices=record.indices,raw=record.slot*ROCK_VERTICES*3,old=oldModel&&record.slot<oldModel.capacity?oldModel.rawPosition.slice(raw,raw+ROCK_VERTICES*3):undefined;
        this.stroke.bindCell(model,record.slot);record.indices=model.writeCell(world,i,record.slot);
        if(!old||oldIndices.length!==record.indices.length||oldIndices.some((value,at)=>value!==record.indices[at])||old.some((value,at)=>!Object.is(value,model.rawPosition[raw+at])))geometric.add(i);
        for(const attribute of [position,normal,color,paint])attribute.addUpdateRange(v*3,ROCK_SURFACE_VERTICES*3);
      }
      let offset=36;const indices=g.index!;
      for(const {indices:active} of this.slots.values()){(indices.array as Uint32Array).set(active,offset);offset+=active.length;}
      indices.clearUpdateRanges();indices.addUpdateRange(0,offset);indices.needsUpdate=true;g.setDrawRange(0,offset);
      for(const attribute of [position,normal,color,paint])attribute.needsUpdate=true;
      // Positions keep their original3x3 footprint. A neighbour's third
      // corner can change a shared fold without moving this cell, so scalar
      // stroke patches include the additional bounded ring (at most5x5).
      const strokeDirty=new Set<number>();for(const i of geometric)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const x=i%world.width+dx,z=Math.floor(i/world.width)+dz;if(x>=0&&z>=0&&x<world.width&&z<world.height&&this.slots.has(z*world.width+x))strokeDirty.add(z*world.width+x);}
      const patches:RockStrokePatch[]=[];if(this.pendingSlab)patches.push(this.stroke.prepareSlab(model));
      for(const i of strokeDirty){const neighbours:{slot:number;count:number}[]=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const x=i%world.width+dx,z=Math.floor(i/world.width)+dz;if(x>=0&&z>=0&&x<world.width&&z<world.height){const record=this.slots.get(z*world.width+x);if(record)neighbours.push({slot:record.slot,count:record.indices.length});}}patches.push(this.stroke.prepareCell(model,this.slots.get(i)!.slot,neighbours));}
      this.stroke.commit(patches);this.pendingSlab=false;for(const patch of patches)for(const face of patch.faces)this.strokeFaces.add(face);
      this.graphicsStyle?.preparedStrokes.refresh(this.stroke,reset?undefined:[...new Set(patches.flatMap(patch=>[...patch.faces]))]);
      this.stats.updatedCells=dirty.size;this.stats.indexCount=offset;
      this.updateLocal(dirty,reallocated);
      this.finalWorldRevision++;this.finalOwner?.changed(dirty,patches.flatMap(p=>[...p.faces]),reset||reallocated);
      this.previousModel?.dispose();this.previousModel=undefined;
    }
    // Representation changes only at actual World reset/admission. New Fn
    // nodes are mandatory so TSL cannot reuse an old single/paged graph.
    if(!this.graphicsStyle&&this.boundStrokeMode!==this.stroke.representationKey)this.bindSurface();
    this.tiles=world.tiles;
  }
  sharedSurfaceStatus(){return{pipeline:'shared-paint',sourceRibbons:false,modelVertices:this.mesh.geometry.getAttribute('position')?.count??0,stroke:this.stroke.snapshot()};}
  /** The435 owner supplies its actual compiled geometries at terminal close. */
  attachSurfaceGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{const actual=[...geometries];this.stroke.attachGpuRetirement(actual);this.graphicsStyle?.preparedStrokes.attachGpuRetirement(this.stroke,actual);this.finalSurface.attachGpuRetirement(actual);}
  dispose():void {if(this.closed)return;if(this.rockFinalRequiresAsyncClose())throw Error('Await closeRockFinalTextures before Rock model/material and renderer disposal');this.finalOwner?.closeEmpty();const actual=[this.mesh.geometry,...this.local.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh).map(o=>o.geometry),...[this.distantPrepared,this.distantBody,this.distantSlab].flatMap(m=>m?[m.geometry]:[])];this.finalSurface.attachGpuRetirement(actual);this.graphicsStyle?.preparedStrokes.release(this.stroke,actual);this.closed=true;this.stroke.attachGpuRetirement(actual);this.clearLocal();this.clearDistantViews();if(this.model)this.model.dispose();else this.mesh.geometry.dispose();this.previousModel?.dispose();this.previousModel=undefined;this.finalSurface.dispose();this.plainMaterial.dispose();this.texturedMaterial.dispose();this.stonePaint.dispose();this.stroke.dispose();}
}
