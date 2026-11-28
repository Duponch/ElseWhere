import { floraSize,floraColor,floraIdentity,hydroponicFloraHeight,isClusterPlantSpecies,isMedicinalPlant,isResidentCrop } from './flora-presentation';
import { plantLeafless } from '../sim/plant-life';
import { stoneColor } from './stone-palette';
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { World, Resource } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { noise } from './StaticGeometry';
import { clearGroup } from './primitives';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import type { NaturalPresentationChange } from './NaturalResourcePresentation';
import type {NaturalAppearanceReader} from './natural-appearance-pass';
import { syncTerrainPaintUvs } from './TerrainLayer';
import { OverviewBatch,configureOverviewMaterial } from './OverviewBatch';

type OverviewKind='tree'|'berries'|'wild-plant'|'rock';
const overviewKind=(r:Resource):OverviewKind=>r.kind==='healroot'||r.kind==='tinctoria'?'wild-plant':r.kind as OverviewKind;

/** Resident distant representation. Switching zoom never rebuilds geometry.
 * Terrain keeps its exact heights/colors. Tiny fruit/branches yield to silhouettes. */
export class OverviewLayer {
  readonly group=new THREE.Group();
  private readonly terrain=new THREE.Group();
  private readonly vegetation=new THREE.Group();
  private readonly batches=new Map<OverviewKind,OverviewBatch>();
  private readonly slots=new Map<number,{kind:OverviewKind;slot:number;signature:string}>();
  private readonly used=new Map<OverviewKind,number>();
  private readonly free=new Map<OverviewKind,number[]>();
  private readonly transform=new THREE.Object3D();
  private readonly tint=new THREE.Color();
  private readonly paint=createStylizedSurfaceTexture();
  private readonly surface=new THREE.MeshStandardNodeMaterial({roughness:0.95,vertexColors:true,map:this.paint});
  private readonly plainSurface=new THREE.MeshStandardNodeMaterial({roughness:0.95,vertexColors:true});
  private texturesEnabled=true;
  private foliage=true;
  private revision=0;
  constructor(configure?: (material: THREE.MeshStandardNodeMaterial) => void){for(const mat of [this.surface,this.plainSurface]){configure?.(mat);configureOverviewMaterial(mat);mat.userData.rendererOwned=true;}this.group.add(this.terrain,this.vegetation);this.group.visible=false;}
  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;
    for(const mesh of this.batches.values())mesh.material=enabled?this.surface:this.plainSurface;
  }
  rebuildTerrain(source:THREE.Group):void {
    clearGroup(this.terrain);source.updateMatrixWorld(true);
    const grouped=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const child of source.children) if(child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const parts=grouped.get(child.material)??[];
      parts.push(child.geometry.clone().applyMatrix4(child.matrixWorld));grouped.set(child.material,parts);
    }
    for(const [material,parts] of grouped) {
      // The slab uses a different layout; material groups keep layouts compatible.
      const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();
      if(geometry) {const mesh=new THREE.Mesh(geometry,material.userData.rendererOwned?material:material.clone());mesh.receiveShadow=false;this.terrain.add(mesh);}
    }
  }
  setTerrainMaterial(previous:THREE.Material,next:THREE.Material,world:Pick<World,'width'|'height'>,painted:boolean):void {
    for(const child of this.terrain.children)if(child instanceof THREE.Mesh&&child.material===previous)child.material=next;
    syncTerrainPaintUvs(world,this.terrain,next,painted);
  }
  setFoliageVisible(visible:boolean):void {this.foliage=visible;const trees=this.batches.get('tree');if(trees)trees.geometry.setDrawRange(0,visible?Infinity:trees.geometry.userData.trunkIndices);}
  private createBatch(geometry:THREE.BufferGeometry,capacity:number):OverviewBatch {
    const mesh=new OverviewBatch(geometry,this.texturesEnabled?this.surface:this.plainSurface,capacity);
    geometry.dispose();return mesh;
  }
  private releaseSlot(id:number,dirty:Set<OverviewKind>):void {
    const previous=this.slots.get(id);if(!previous)return;
    this.transform.scale.set(0,0,0);this.transform.updateMatrix();
    this.batches.get(previous.kind)!.setMatrixAt(previous.slot,this.transform.matrix);
    this.free.get(previous.kind)!.push(previous.slot);this.slots.delete(id);dirty.add(previous.kind);
  }
  private claimSlot(kind:OverviewKind,area:number,dirty:Set<OverviewKind>):number {
    const free=this.free.get(kind)!,used=this.used.get(kind)!,slot=free.pop()??used;
    if(slot===used)this.used.set(kind,used+1);
    const mesh=this.batches.get(kind)!;
    if(slot>=mesh.instanceMatrix.count){
      const matrices=mesh.instanceMatrix.array,colors=mesh.colorBuffer.array,count=mesh.activeCount;
      mesh.allocate(mesh.geometry,Math.min(area,2**Math.ceil(Math.log2(slot+1))));
      mesh.instanceMatrix.array.set(matrices);mesh.colorBuffer.array.set(colors);mesh.activeCount=count;
    }
    mesh.activeCount=Math.max(mesh.activeCount,slot+1);dirty.add(kind);return slot;
  }
  update(world:World,reset:boolean,changes?:ReadonlyMap<number,NaturalPresentationChange>,appearance?:NaturalAppearanceReader):void {
    this.revision++;
    if(reset) {
      for(const mesh of this.batches.values())mesh.dispose();
      this.vegetation.clear();this.slots.clear();this.batches.clear();this.used.clear();this.free.clear();
      for(const kind of ['tree','berries','wild-plant','rock'] as const) {
        const count=world.resources.filter(r=>!isResidentCrop(r)&&!isClusterPlantSpecies(r.species)&&overviewKind(r)===kind).length;
        const paint=(g:THREE.BufferGeometry,color:number)=>{const c=new THREE.Color(color),data=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<data.length;i+=3)data.set([c.r,c.g,c.b],i);g.setAttribute('color',new THREE.BufferAttribute(data,3));return g;};
        const trunk=kind==='tree'?paint(new THREE.CylinderGeometry(.1,.16,.5,4).translate(0,-.25,0),0x70573e):null;
        const crown=kind==='tree'?paint((world.site?new THREE.IcosahedronGeometry(1,0).scale(1,.4,1):new THREE.ConeGeometry(1,.8,4)).translate(0,.1,0),0x5f7c52):null;
        // PolyhedronGeometry is unindexed; the cylinder/cone use indices.
        // Identity indices keep its flat normals and the trunk-only draw range.
        if(crown&&!crown.index)crown.setIndex(Array.from({length:crown.getAttribute('position').count},(_,i)=>i));
        const geometry=trunk&&crown?mergeGeometries([trunk,crown],false)!:paint(new THREE.OctahedronGeometry(1),0xffffff);
        if(trunk){geometry.userData.trunkIndices=trunk.index!.count;trunk.dispose();crown!.dispose();}
        // Three r186 uploads DynamicDrawUsage attributes on every render even
        // when their version is unchanged. These matrices change on snapshots
        // only; StaticDrawUsage still uploads each explicit needsUpdate below.
        const capacity=Math.min(world.width*world.height,2**Math.ceil(Math.log2(Math.max(16,count))));
        const mesh=this.createBatch(geometry,capacity);
        mesh.name=`overview-${kind}`;
        this.used.set(kind,0);this.free.set(kind,[]);
        this.batches.set(kind,mesh);this.vegetation.add(mesh);
      }
    }
    // Births claim/reuse slots in their existing batch. They must not rebuild
    // unrelated vegetation when a medicinal crop is actually sown.
    const delta = !reset ? changes : undefined;
    const changedResources = delta
      ? [...delta.values()].flatMap(({resource})=>resource&&!isResidentCrop(resource)&&!isClusterPlantSpecies(resource.species)?[resource]:[])
      : world.resources.filter(r=>!isResidentCrop(r)&&!isClusterPlantSpecies(r.species));
    const dirty=new Set<OverviewKind>();
    if(delta){
      for(const [id,{resource}] of delta){const previous=this.slots.get(id);
        if(previous&&(!resource||isResidentCrop(resource)||isClusterPlantSpecies(resource.species)||previous.kind!==overviewKind(resource)))this.releaseSlot(id,dirty);
      }
    }else if(!reset){
      const present=new Map(changedResources.map(r=>[r.id,r]));
      for(const [id,previous] of this.slots){const r=present.get(id);if(!r||previous.kind!==overviewKind(r))this.releaseSlot(id,dirty);}
    }
    for(const r of changedResources) {
      const observation=appearance?.read(r),signature=floraIdentity(world,r,observation),previous=this.slots.get(r.id);
      const kind=overviewKind(r),slot=previous?.slot??this.claimSlot(kind,world.width*world.height,dirty);
      if(!reset&&previous?.signature===signature)continue;
      dirty.add(kind);
      const mesh=this.batches.get(kind)!,n=noise(r.x,r.z,77),medicinal=isMedicinalPlant(r);
      const height=r.kind==='tree'?WORLD_SCALE.treeMinHeight+n*(WORLD_SCALE.treeMaxHeight-WORLD_SCALE.treeMinHeight):r.kind==='rock'?0.7:medicinal?((observation?.leafless??plantLeafless(world,r))?.12:.38):0.75;
      const width=r.kind==='tree'?0.8+n*0.32:medicinal?.3:0.45,size=observation?.size??floraSize(world,r);
      const support=hydroponicFloraHeight(world,r);
      this.transform.position.set(r.x,support?height*size/2+support:height*size/2,r.z);this.transform.rotation.set(0,n*Math.PI*2,0);this.transform.scale.set(width*size,height*size,width*size);this.transform.updateMatrix();
      mesh.setMatrixAt(slot,this.transform.matrix);this.tint.setHex((r.species||medicinal||r.kind==='tinctoria')&&r.kind!=='tree'?floraColor(r):r.kind==='tree'?0xffffff:r.kind==='rock'?(r.stone?stoneColor(r.stone):0x92998d):0x697b55);mesh.setColorAt(slot,this.tint);
      this.slots.set(r.id,{kind,slot,signature});
    }
    for(const kind of dirty) {const mesh=this.batches.get(kind)!;mesh.instanceMatrix.needsUpdate=true;mesh.colorBuffer.needsUpdate=true;mesh.computeBoundingSphere();}
    this.setFoliageVisible(this.foliage);
  }
  prepareForCompile():()=>void {
    const revision=this.revision;
    const states=[...this.batches.values()].map(mesh=>{
      const geometry=mesh.geometry,count=mesh.activeCount,visible=mesh.visible;
      const sphere=mesh.boundingSphere.clone(),first=mesh.instanceMatrix.array.slice(0,16);
      if(count===0){mesh.setMatrixAt(0,new THREE.Matrix4());mesh.activeCount=1;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
      mesh.visible=true;
      return {mesh,geometry,count,visible,sphere,first};
    });
    return ()=>{
      if(this.revision!==revision)return;
      for(const {mesh,geometry,count,visible,sphere,first} of states){
        if(mesh.geometry!==geometry)continue;
        if(count===0){mesh.instanceMatrix.array.set(first,0);mesh.instanceMatrix.needsUpdate=true;}
        mesh.activeCount=count;mesh.visible=visible;mesh.boundingSphere.copy(sphere);
      }
    };
  }
  dispose():void {clearGroup(this.terrain);for(const mesh of this.batches.values())mesh.dispose();this.vegetation.clear();this.surface.dispose();this.plainSurface.dispose();this.paint.dispose();}
}
