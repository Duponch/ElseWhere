import { plantLeafless } from '../sim/plant-life';
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPlantGrowthReader, plantGrowth } from '../sim/plants';
import { BLIGHT_COLOR, RESIDENT_CROP_KINDS, type ResidentCropKind } from './flora-presentation';
import type { Resource, World } from '../sim/types';
import { CropPresentationPartition } from './crop-presentation-partition';
import { readHydroponicCells } from '../sim/hydroponics';
import { HYDROPONIC_SUPPORT_HEIGHT } from './hydroponics-parts';
import { ResourceTargetTint } from './resource-target-tint';
import {markResidentAttributeRange} from './resident-attribute-range';
import {PreparedCropPresentation,type PreparedCropChange} from './prepared-crop-presentation';
import {CropResidentBounds} from './crop-resident-bounds';
import type {SceneResourceFrame} from './scene-resource-index';
import {currentGraphicsStyle,type GraphicsStyleContext} from './graphics-style';
import {attribute,instanceColor,texture,uv,vec3} from 'three/tsl';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';
import {compileNaturalSurfaceModels,naturalStroke,type NaturalSurfaceModels} from './surfaces/NaturalSurfaceModels';
import {createStylizedSurfaceTexture} from './stylized-surfaces';

/** Dedicated resident instancing: sowing never rebuilds forest/rock geometry. */
export function cropGeometry(kind:ResidentCropKind):THREE.BufferGeometry {
  let parts:THREE.BufferGeometry[];
  if(kind==='corn') {
    const stalk=new THREE.CylinderGeometry(.045,.065,1.5,5).translate(0,.75,0);
    const leaves=[-.25,.25].map((x,i)=>new THREE.ConeGeometry(.16,.7,3).rotateZ(x<0?-.7:.7).translate(x,.68+i*.34,0));
    const tassel=new THREE.ConeGeometry(.1,.28,4).translate(0,1.64,0);
    parts=[stalk,...leaves,tassel];
  } else if(kind==='hops') {
    // A compact climbing vine with broad leaves and pale hop cones. Its
    // silhouette is authored once, using the existing resident crop material.
    parts=[new THREE.CylinderGeometry(.035,.05,1.1,5).translate(0,.55,0)];
    for(let i=0;i<5;i++){
      const a=i*2.4,x=Math.cos(a)*.19,z=Math.sin(a)*.19,y=.24+i*.17;
      parts.push(new THREE.OctahedronGeometry(.19).scale(1,.38,1.2).rotateY(a).translate(x,y,z));
      if(i>1)parts.push(new THREE.ConeGeometry(.09,.22,5).rotateZ(Math.PI).translate(x*.85,y-.08,z*.85));
    }
    // Octahedron leaves are non-indexed; expand only this vine's indexed
    // stems/cones, preserving their position, normal and uv attributes.
    parts=parts.map(part=>{
      if(part.index===null)return part;
      const expanded=part.toNonIndexed();part.dispose();return expanded;
    });
  } else if(kind==='haygrass') {
    // Blade bends are authored once in the resident mesh. Ordinary snapshots
    // still transform one whole plant, never individual stems or seed heads.
    parts=Array.from({length:9},(_,i)=>{
      const angle=i*2.4,radius=i===8?0:.13+(i%2)*.08,height=1.02+(i%3)*.15;
      return new THREE.ConeGeometry(.052,height,3).rotateZ((i%2?1:-1)*.16)
        .rotateY(angle).translate(Math.cos(angle)*radius,height*.49,Math.sin(angle)*radius);
    });
  } else if(kind==='potato') {
    parts=[[-.2,.1],[.2,.1],[0,-.2],[0,.25]].map(([x,z],i)=>new THREE.OctahedronGeometry(.25).scale(1,.6,1).translate(x!,.18+(i%2)*.11,z!));
  } else {
    // Keep both existing silhouettes and their triangle counts unchanged.
    parts=[-.22,0,.22].map((x,i)=>kind==='rice'
      ?new THREE.ConeGeometry(.11,.8,3).translate(x,.4,(i%2)*.22-.1)
      :new THREE.OctahedronGeometry(.22).scale(1,1.25,1).translate(x,.36+(i%2)*.15,(i%2)*.26-.13));
  }
  const geometry=mergeGeometries(parts);
  parts.forEach(g=>g.dispose());
  if(!geometry)throw new Error(`Could not assemble crop geometry: ${kind}`);
  return geometry;
}

type CropCapture={x:number;z:number;growth:number;leafless:boolean;blighted:boolean;supported:boolean};

class CropBatch {
  private mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly ownsGeometry:boolean;
  private readonly slots = new Map<number, number>();
  private readonly free: number[] = [];
  private used = 0;
  private version = 0;
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly green = new THREE.Color(0x80a24a);
  private readonly ripe = new THREE.Color(0xcfb665);
  private readonly targetTint=new ResourceTargetTint();
  private targetPreviewIds=new Set<number>();
  private readonly captures=new Map<number,CropCapture>();
  private preparedTracking=false;
  private readonly liveSlots=new Set<number>();
  private readonly insertionOrder=new Map<number,number>();
  private nextInsertion=0;
  private readonly residentBounds:CropResidentBounds;
  constructor(private readonly group:THREE.Group,readonly kind:ResidentCropKind,private material: THREE.Material,graphicsStyle:GraphicsStyleContext|undefined,sharedGeometry?:THREE.BufferGeometry) {
    if(kind==='cotton')this.ripe.setHex(0xf0ead7);
    if(kind==='potato')this.ripe.setHex(0x83964a);
    if(kind==='hops'){this.green.setHex(0x72966a);this.ripe.setHex(0xaabd78);}
    if(kind==='haygrass'){this.green.setHex(0x80934e);this.ripe.setHex(0xc6b56b);}
    this.geometry=sharedGeometry??cropGeometry(kind);this.ownsGeometry=!sharedGeometry;
    this.residentBounds=new CropResidentBounds(this.geometry);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.geometry.getAttribute('position').count * 3).fill(1), 3));
    this.mesh = this.createMesh(128); this.group.add(this.mesh);
    void graphicsStyle;
  }
  setMaterial(material:THREE.Material):void {this.material=material;this.mesh.material=material;}
  setTargetPreview(ids:ReadonlySet<number>):void {
    if(ids.size===this.targetPreviewIds.size&&[...ids].every(id=>this.targetPreviewIds.has(id)))return;
    this.targetTint.restore();this.targetPreviewIds=new Set(ids);this.tintTargets();
  }
  clearTargetPreview():void {this.targetTint.restore();this.targetPreviewIds.clear();}
  private tintTargets():void {
    if(!this.targetPreviewIds.size)return;
    const slots:number[]=[];
    for(const id of this.targetPreviewIds){const slot=this.slots.get(id);if(slot!==undefined)slots.push(slot);}
    this.targetTint.applySlots(this.mesh.instanceColor!,slots);
  }
  private createMesh(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    // A runtime-sized storage array keeps the same shader when capacity grows.
    // Three's small uniform-matrix path otherwise specializes it to each size.
    mesh.instanceMatrix = new THREE.StorageInstancedBufferAttribute(capacity, 16);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage); mesh.count = 0;
    // Allocate colors before pipeline warmup, including maps with no crops yet.
    mesh.setColorAt(0, this.green); mesh.instanceColor!.setUsage(THREE.StaticDrawUsage); mesh.receiveShadow = true;
    return mesh;
  }
  prepareForCompile(): () => void {
    const mesh=this.mesh,count=mesh.count,version=this.version;mesh.count=Math.max(1,count);
    return () => { if(this.mesh===mesh&&this.version===version)mesh.count=count; };
  }
  update(world: World, reset: boolean, crops: readonly Resource[],hydroponicCells:ReadonlyMap<number,number>,readGrowth?:(crop:Resource)=>number): void {
    this.preparedTracking=false;
    if(readGrowth){this.updateResident(world,reset,crops,hydroponicCells,readGrowth);return;}
    // Public mutable readers retain their literal pass and complete uploads.
    this.captures.clear();
    if(reset)this.clearTargetPreview();else this.targetTint.restore();
    this.version++;
    if (reset) { this.slots.clear(); this.free.length = 0; this.used = 0; this.mesh.count = 0; }
    const alive = new Set(crops.map(r => r.id));
    for (const [id, slot] of this.slots) if (!alive.has(id)) {
      this.transform.scale.setScalar(0); this.transform.updateMatrix(); this.mesh.setMatrixAt(slot, this.transform.matrix);
      this.slots.delete(id); this.free.push(slot);
    }
    // One plant per map cell is a proven upper bound. Historical batches reserve
    // on loading; haygrass reserves when its first real plant creates the batch.
    const required = Math.max(crops.length, reset && this.kind!=='hops' ? world.width * world.height : 0);
    if (required > this.mesh.instanceMatrix.count) {
      const old = this.mesh, mesh = this.createMesh(2 ** Math.ceil(Math.log2(required)));
      mesh.instanceMatrix.array.set(old.instanceMatrix.array); mesh.instanceColor!.array.set(old.instanceColor!.array);
      this.group.remove(old); old.dispose(); this.mesh = mesh; this.group.add(mesh);
    }
    let visibleCount = 0;
    for (const crop of crops) {
      let slot = this.slots.get(crop.id);
      if (slot === undefined) { slot = this.free.pop() ?? this.used++; this.slots.set(crop.id, slot); }
      visibleCount = Math.max(visibleCount, slot + 1);
      const growth = plantGrowth(world, crop), scale = .14 + .86 * Math.sqrt(growth);
      this.transform.position.set(crop.x, .025+(hydroponicCells.has(crop.z*world.width+crop.x)?HYDROPONIC_SUPPORT_HEIGHT:0), crop.z);
      this.transform.rotation.y = (crop.id % 7) * .9;
      this.transform.scale.set(scale, plantLeafless(world,crop)?scale*.4:scale, scale); this.transform.updateMatrix();
      this.mesh.setMatrixAt(slot, this.transform.matrix);
      this.color.copy(this.green).lerp(this.ripe, Math.max(0, (growth - .65) / .35)); if(plantLeafless(world,crop))this.color.setHex(0x8f7b58);if(crop.blight)this.color.setHex(BLIGHT_COLOR);this.mesh.setColorAt(slot, this.color);
    }
    this.mesh.count = visibleCount;
    if (visibleCount) {
      this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, visibleCount * 16);
      this.mesh.instanceColor!.clearUpdateRanges(); this.mesh.instanceColor!.addUpdateRange(0, visibleCount * 3);
      this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true;
    }
    this.mesh.computeBoundingSphere();
    this.tintTargets();
  }
  /** Exact prepared values only. No resource partition, alive Set, growth or
   * all-instance sphere calculation runs on this admitted path. */
  updatePrepared(world:World,reset:boolean,changes:ReadonlyMap<number,PreparedCropChange>,cropCount:number,last:Resource|undefined):void {
    const wasTracking=this.preparedTracking;
    if(!wasTracking){
      this.preparedTracking=true;this.liveSlots.clear();this.insertionOrder.clear();this.nextInsertion=0;this.residentBounds.clear();this.captures.clear();
      for(const [id,slot]of this.slots){this.liveSlots.add(slot);this.insertionOrder.set(id,this.nextInsertion++);}
    }
    if(reset)this.clearTargetPreview();else this.targetTint.restore();this.version++;
    if(reset){this.slots.clear();this.free.length=0;this.used=0;this.mesh.count=0;this.captures.clear();this.liveSlots.clear();this.insertionOrder.clear();this.nextInsertion=0;this.residentBounds.clear();}
    let firstMatrix=Infinity,lastMatrix=-1,firstColor=Infinity,lastColor=-1,boundsChanged=reset||!wasTracking;
    const removed:number[]=[];
    if(!wasTracking){
      // The first prepared read is complete, but its new consumer knows no
      // tombstones for a prior public RAW. Reconcile those public memberships
      // exactly ONCE, preserving their Map/free-stack and zero-matrix order.
      const present=new Set<number>();for(const [id,{resource}]of changes)if(resource?.kind===this.kind)present.add(id);
      if(present.size!==cropCount)throw Error('Prepared crop entry requires complete membership');
      for(const id of this.slots.keys())if(!present.has(id))removed.push(id);
    }else for(const [id,{resource}]of changes)if(this.slots.has(id)&&resource?.kind!==this.kind)removed.push(id);
    // Literal Map iteration order governs free-stack order, even when several
    // deaths and births occur together. Numerical stamps avoid scanning slots.
    removed.sort((a,b)=>this.insertionOrder.get(a)!-this.insertionOrder.get(b)!);
    for(const id of removed){
      const slot=this.slots.get(id)!;this.transform.scale.setScalar(0);this.transform.updateMatrix();this.mesh.setMatrixAt(slot,this.transform.matrix);
      firstMatrix=Math.min(firstMatrix,slot);lastMatrix=Math.max(lastMatrix,slot);this.slots.delete(id);this.captures.delete(id);this.insertionOrder.delete(id);this.liveSlots.delete(slot);this.free.push(slot);this.residentBounds.remove(slot);boundsChanged=true;
    }
    const required=Math.max(cropCount,reset&&this.kind!=='hops'?world.width*world.height:0),resized=required>this.mesh.instanceMatrix.count;
    if(resized){const old=this.mesh,mesh=this.createMesh(2**Math.ceil(Math.log2(required)));mesh.instanceMatrix.array.set(old.instanceMatrix.array);mesh.instanceColor!.array.set(old.instanceColor!.array);mesh.count=old.count;this.group.remove(old);old.dispose();this.mesh=mesh;this.group.add(mesh);}
    let visibleCount=this.mesh.count;
    // Producer changes are already sorted by CURRENT source ordinal.
    for(const [id,{resource:crop,appearance}]of changes){
      if(!crop||crop.kind!==this.kind)continue;if(!appearance)throw Error('Missing crop numerical appearance');
      let slot=this.slots.get(id);
      if(slot===undefined){slot=this.free.pop()??this.used++;this.slots.set(id,slot);this.liveSlots.add(slot);this.insertionOrder.set(id,this.nextInsertion++);}
      visibleCount=Math.max(visibleCount,slot+1);
      const {growth,leafless,blighted,supported}=appearance,old=this.captures.get(id),matrixChanged=!old||old.x!==crop.x||old.z!==crop.z||old.growth!==growth||old.leafless!==leafless||old.supported!==supported,
        colorChanged=!old||old.growth!==growth||old.leafless!==leafless||old.blighted!==blighted;
      if(!old||old.x!==crop.x||old.z!==crop.z){this.residentBounds.set(slot,id,crop.x,crop.z);boundsChanged=true;}
      if(matrixChanged){const scale=.14+.86*Math.sqrt(growth);this.transform.position.set(crop.x,.025+(supported?HYDROPONIC_SUPPORT_HEIGHT:0),crop.z);this.transform.rotation.y=(id%7)*.9;this.transform.scale.set(scale,leafless?scale*.4:scale,scale);this.transform.updateMatrix();this.mesh.setMatrixAt(slot,this.transform.matrix);firstMatrix=Math.min(firstMatrix,slot);lastMatrix=Math.max(lastMatrix,slot);}
      if(colorChanged){this.color.copy(this.green).lerp(this.ripe,Math.max(0,(growth-.65)/.35));if(leafless)this.color.setHex(0x8f7b58);if(blighted)this.color.setHex(BLIGHT_COLOR);this.mesh.setColorAt(slot,this.color);firstColor=Math.min(firstColor,slot);lastColor=Math.max(lastColor,slot);}
      if(matrixChanged||colorChanged){if(old){old.x=crop.x;old.z=crop.z;old.growth=growth;old.leafless=leafless;old.blighted=blighted;old.supported=supported;}else this.captures.set(id,{x:crop.x,z:crop.z,growth,leafless,blighted,supported});}
    }
    while(visibleCount&&!this.liveSlots.has(visibleCount-1))visibleCount--;this.mesh.count=visibleCount;
    // The old full loop leaves this tail position/yaw for the NEXT removal's
    // zero-scale matrices. Preserve those otherwise invisible buffer bits.
    if(last){const value=this.captures.get(last.id);if(!value)throw Error('Lost crop tail capture');this.transform.position.set(last.x,.025+(value.supported?HYDROPONIC_SUPPORT_HEIGHT:0),last.z);this.transform.rotation.y=(last.id%7)*.9;}
    if(lastMatrix>=firstMatrix)markResidentAttributeRange(this.mesh.instanceMatrix,firstMatrix*16,(lastMatrix-firstMatrix+1)*16);
    if(lastColor>=firstColor)markResidentAttributeRange(this.mesh.instanceColor!,firstColor*3,(lastColor-firstColor+1)*3);
    if(boundsChanged||resized)this.residentBounds.writeSphere(this.mesh.boundingSphere??=new THREE.Sphere());this.tintTargets();
  }
  private updateResident(world:World,reset:boolean,crops:readonly Resource[],hydroponicCells:ReadonlyMap<number,number>,readGrowth:(crop:Resource)=>number):void {
    if(reset)this.clearTargetPreview();else this.targetTint.restore();
    this.version++;
    if(reset){this.slots.clear();this.free.length=0;this.used=0;this.mesh.count=0;this.captures.clear();}
    let firstMatrix=Infinity,lastMatrix=-1,firstColor=Infinity,lastColor=-1;
    const alive=new Set(crops.map(crop=>crop.id));
    for(const [id,slot]of this.slots)if(!alive.has(id)){
      this.transform.scale.setScalar(0);this.transform.updateMatrix();this.mesh.setMatrixAt(slot,this.transform.matrix);
      firstMatrix=Math.min(firstMatrix,slot);lastMatrix=Math.max(lastMatrix,slot);
      this.slots.delete(id);this.captures.delete(id);this.free.push(slot);
    }
    const required=Math.max(crops.length,reset&&this.kind!=='hops'?world.width*world.height:0),resized=required>this.mesh.instanceMatrix.count;
    if(resized){
      const old=this.mesh,mesh=this.createMesh(2**Math.ceil(Math.log2(required)));
      mesh.instanceMatrix.array.set(old.instanceMatrix.array);mesh.instanceColor!.array.set(old.instanceColor!.array);
      this.group.remove(old);old.dispose();this.mesh=mesh;this.group.add(mesh);
    }
    let visibleCount=0;
    for(const crop of crops){
      let slot=this.slots.get(crop.id);
      if(slot===undefined){slot=this.free.pop()??this.used++;this.slots.set(crop.id,slot);}
      visibleCount=Math.max(visibleCount,slot+1);
      const growth=readGrowth(crop),leafless=plantLeafless(world,crop),blighted=!!crop.blight,supported=hydroponicCells.has(crop.z*world.width+crop.x);
      const old=this.captures.get(crop.id),matrixChanged=!old||old.x!==crop.x||old.z!==crop.z||old.growth!==growth||old.leafless!==leafless||old.supported!==supported;
      const colorChanged=!old||old.growth!==growth||old.leafless!==leafless||old.blighted!==blighted;
      if(matrixChanged){
        const scale=.14+.86*Math.sqrt(growth);
        this.transform.position.set(crop.x,.025+(supported?HYDROPONIC_SUPPORT_HEIGHT:0),crop.z);
        this.transform.rotation.y=(crop.id%7)*.9;this.transform.scale.set(scale,leafless?scale*.4:scale,scale);this.transform.updateMatrix();
        this.mesh.setMatrixAt(slot,this.transform.matrix);firstMatrix=Math.min(firstMatrix,slot);lastMatrix=Math.max(lastMatrix,slot);
      }
      if(colorChanged){
        this.color.copy(this.green).lerp(this.ripe,Math.max(0,(growth-.65)/.35));if(leafless)this.color.setHex(0x8f7b58);if(blighted)this.color.setHex(BLIGHT_COLOR);
        this.mesh.setColorAt(slot,this.color);firstColor=Math.min(firstColor,slot);lastColor=Math.max(lastColor,slot);
      }
      if(matrixChanged||colorChanged){
        if(old){old.x=crop.x;old.z=crop.z;old.growth=growth;old.leafless=leafless;old.blighted=blighted;old.supported=supported;}
        else this.captures.set(crop.id,{x:crop.x,z:crop.z,growth,leafless,blighted,supported});
      }
    }
    // Removal historically zeros the last crop transform, including its
    // translation. Preserve those unused-slot bits and conservative bounds
    // even when that last crop needed no matrix write on this adoption.
    const last=crops.at(-1);
    if(last){const value=this.captures.get(last.id)!;this.transform.position.set(last.x,.025+(value.supported?HYDROPONIC_SUPPORT_HEIGHT:0),last.z);this.transform.rotation.y=(last.id%7)*.9;}
    const countChanged=this.mesh.count!==visibleCount;this.mesh.count=visibleCount;
    if(lastMatrix>=firstMatrix)markResidentAttributeRange(this.mesh.instanceMatrix,firstMatrix*16,(lastMatrix-firstMatrix+1)*16);
    if(lastColor>=firstColor)markResidentAttributeRange(this.mesh.instanceColor!,firstColor*3,(lastColor-firstColor+1)*3);
    if(lastMatrix>=firstMatrix||countChanged||resized||reset)this.mesh.computeBoundingSphere();
    this.tintTargets();
  }
  dispose(): void {this.clearTargetPreview();this.residentBounds.clear();this.liveSlots.clear();this.insertionOrder.clear();this.captures.clear();this.mesh.dispose();if(this.ownsGeometry)this.geometry.dispose();}
}

/** Historical shapes and the small hops batch are prewarmed even empty.
 * Haygrass becomes resident only when present. CPU work is on snapshots; old crop geometry is retained. */
export class CropLayer {
  readonly group=new THREE.Group();
  private readonly graphicsStyle=currentGraphicsStyle();
  private readonly batches:CropBatch[];
  private haygrassBatch:CropBatch|undefined;
  private texturesEnabled=true;
  private readonly surfaceModels:NaturalSurfaceModels|undefined;
  private readonly sharedTextured:THREE.NodeMaterial|undefined;
  private readonly ownedPastel:THREE.DataTexture|undefined;
  private readonly partition=new CropPresentationPartition();
  private readonly prepared=new PreparedCropPresentation();
  constructor(private readonly plainMaterial:THREE.Material,private readonly texturedMaterial:THREE.Material=plainMaterial,pastelSource?:THREE.Texture){
    if(this.graphicsStyle&&texturedMaterial instanceof THREE.NodeMaterial){
      const originals=RESIDENT_CROP_KINDS.map(kind=>cropGeometry(kind));
      try{this.surfaceModels=compileNaturalSurfaceModels(originals);}finally{for(const geometry of originals)geometry.dispose();}
      this.sharedTextured=new THREE.MeshLambertNodeMaterial({flatShading:true});this.sharedTextured.userData.rendererOwned=true;
      const borrowed=pastelSource??Reflect.get(texturedMaterial,'map') as THREE.Texture|undefined,pastel=borrowed??(this.ownedPastel=createStylizedSurfaceTexture('vegetation')),stroke=naturalStroke(this.graphicsStyle,this.surfaceModels.stroke);
      applySharedPaintSurface(this.sharedTextured,{context:this.graphicsStyle,base:attribute('color','vec3'),pastel:attribute('color','vec3').mul(texture(pastel,uv()).rgb),gouacheTransform:body=>body.mul(instanceColor),stroke:body=>stroke(body).div(instanceColor.max(vec3(.000001)))});
    }
    this.batches=RESIDENT_CROP_KINDS.filter(kind=>kind!=='haygrass').map(kind=>this.createBatch(kind));
  }
  private createBatch(kind:ResidentCropKind):CropBatch{return new CropBatch(this.group,kind,this.texturesEnabled?(this.sharedTextured??this.texturedMaterial):this.plainMaterial,this.graphicsStyle,this.surfaceModels?.geometries[RESIDENT_CROP_KINDS.indexOf(kind)]);}
  private syncSurfaceLighting():void{if(!this.sharedTextured||!(this.texturedMaterial instanceof THREE.NodeMaterial))return;this.sharedTextured.outputNode=this.texturedMaterial.outputNode;this.sharedTextured.maskNode=this.texturedMaterial.maskNode;this.sharedTextured.maskShadowNode=this.texturedMaterial.maskShadowNode;}
  setTexturesEnabled(enabled:boolean):void {this.texturesEnabled=enabled;for(const batch of this.batches)batch.setMaterial(enabled?(this.sharedTextured??this.texturedMaterial):this.plainMaterial);}
  setTargetPreview(ids:ReadonlySet<number>):void {for(const batch of this.batches)batch.setTargetPreview(ids);}
  clearTargetPreview():void {for(const batch of this.batches)batch.clearTargetPreview();}
  prepareForCompile():()=>void {this.syncSurfaceLighting();const restore=this.batches.map(b=>b.prepareForCompile());return()=>restore.forEach(f=>f());}
  hasPreparedFrameChange(world:World):boolean {return this.prepared.hasFrameChange(world);}
  update(world:World,reset:boolean,immutableSnapshot=false,index?:SceneResourceFrame):void {
    this.syncSurfaceLighting();
    const prepared=immutableSnapshot?this.prepared.readScene(world,reset,index):undefined;
    if(prepared){
      if(!prepared.changed)return;let created:CropBatch|undefined;
      if(!this.haygrassBatch&&this.prepared.count('haygrass')){created=this.haygrassBatch=this.createBatch('haygrass');this.batches.push(created);}
      for(const batch of this.batches)batch.updatePrepared(world,reset||batch===created,this.prepared.changes,this.prepared.count(batch.kind),this.prepared.last(batch.kind));return;
    }
    this.prepared.clear();
    const crops=this.partition.read(world,reset,immutableSnapshot);
    const hydroponicCells=readHydroponicCells(world);
    // One unchanged synchronous evaluation, discarded before the next World.
    const readGrowth=immutableSnapshot?createPlantGrowthReader(world):undefined;
    let created:CropBatch|undefined;
    if(!this.haygrassBatch&&crops.haygrass.length){
      created=this.haygrassBatch=this.createBatch('haygrass');
      this.batches.push(created);
    }
    for(const batch of this.batches)batch.update(world,reset||batch===created,crops[batch.kind],hydroponicCells,readGrowth);
  }
  dispose():void {this.prepared.clear();for(const batch of this.batches)batch.dispose();this.sharedTextured?.dispose();this.surfaceModels?.dispose();this.ownedPastel?.dispose();}
}
