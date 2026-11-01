import{createSurfaceMaterial}from'./SurfaceMaterials';
import {currentGraphicsStyle,applyOrigamiSurface} from './graphics-style';
import {solidExplorationMaterial256} from './ExplorationMask256';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';
import * as THREE from 'three/webgpu';
import { attribute, texture, uv } from 'three/tsl';
import { material } from './primitives';
import type { Placement } from './primitives';
import { BoxMesh, configureBoxMaterial } from './BoxMesh';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { instancedBoxPatternUv } from './texture-variation';
import { chunkContour, configureChunkMaterial, createChunkGeometry, isSmallChunk } from './chunk-shape';
import { chunkPaintUv, createChunkSurfacePaint } from './chunk-surface-paint';
import { InstanceTargetTint } from './instance-target-tint';
import {ZONE_FILL_OPACITY} from './zone-surface-presentation';
import {ITEM_SHAPES,type ItemShape} from './item-geometry';
import {ItemMeshAtlas} from './item-mesh-atlas';
import {createSandbagGeometry} from './sandbag-parts';
import {createOrigamiContour,ItemContourAtlas,type OrigamiContourBinding} from './origami/contours';

const object = new THREE.Object3D(), color = new THREE.Color();
type Style = 'solid' | 'overlay' | 'wire' | 'storage' | 'storage-home' | 'border';

/** Shared pipelines and authored shape; changing quantity never creates a material.
 * Each logical batch retains its GPU allocation, including when emptied.
 * Capacity grows geometrically only when content exceeds its high-water mark.
 */
export class BoxBatches {
  private readonly graphicsStyle=currentGraphicsStyle();
  private readonly contours=new Map<BoxMesh,OrigamiContourBinding>();
  private itemContourAtlas?:ItemContourAtlas;
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly roundedRockGeometry = createChunkGeometry();
  private readonly smallRockGeometry = createChunkGeometry(true);
  private readonly sandbagGeometry = createSandbagGeometry();
  private readonly surfaceTexture = createStylizedSurfaceTexture();
  private readonly rockTexture = createChunkSurfacePaint();
  private readonly texturedSolid = currentGraphicsStyle()?.origami?createSurfaceMaterial('physical',0xffffff):createSurfaceMaterial('diffuse',0xffffff);
  private readonly plainRock = createSurfaceMaterial('diffuse',0xffffff);
  private readonly texturedRock = currentGraphicsStyle()?.origami?createSurfaceMaterial('physical',0xffffff):createSurfaceMaterial('diffuse',0xffffff);
  private readonly materials: Record<Style, THREE.NodeMaterial> = {
    solid: createSurfaceMaterial('diffuse',0xffffff),
    // An unlit surface stays legible at midday; grass shares the same tint.
    storage: new THREE.MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: ZONE_FILL_OPACITY, depthWrite: false }),
    'storage-home': new THREE.MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }),
    border: new THREE.MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
    overlay: new THREE.MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.48, depthWrite: false }),
    wire: new THREE.MeshBasicNodeMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.65, depthWrite: false }),
  };
  private readonly batches = new Map<string, BoxMesh>();
  private readonly itemAtlas=new ItemMeshAtlas();
  private readonly plainItem=createSurfaceMaterial('diffuse',0xffffff);
  private readonly texturedItem=this.graphicsStyle?.origami?createSurfaceMaterial('physical',0xffffff):createSurfaceMaterial('diffuse',0xffffff);
  private readonly itemBatchKeys=new Set<string>();
  private readonly targetBatches = new Map<BoxMesh, { ids: (number | undefined)[]; tint: InstanceTargetTint }>();
  private readonly targetGroups = new Map<THREE.Group, ReadonlySet<number>>();
  private furnitureRevision: object | undefined;
  furnitureStamp(): object | undefined { return this.furnitureRevision; }
  private texturesEnabled = true;
  private roundedRockWarm = false;

  constructor(configure?: (material: THREE.NodeMaterial) => void,private readonly ownedProducer435?:OwnedOpaqueProducer435) {
    solidExplorationMaterial256(this.materials.solid);solidExplorationMaterial256(this.texturedSolid);
    configure?.(this.materials.solid);
    configure?.(this.texturedSolid);
    configure?.(this.plainRock);
    configure?.(this.texturedRock);
    configure?.(this.plainItem);configure?.(this.texturedItem);
    this.plainItem.userData.rendererOwned=this.texturedItem.userData.rendererOwned=true;
    this.itemAtlas.configure(this.plainItem);this.itemAtlas.configure(this.texturedItem,this.surfaceTexture);
    applyOrigamiSurface(this.texturedItem,attribute('boxColor','vec3'),this.itemAtlas.paintUvNode(),this.graphicsStyle);
    this.geometry.userData.rendererOwned = true;
    this.roundedRockGeometry.userData.rendererOwned = true;
    this.smallRockGeometry.userData.rendererOwned = true;
    this.sandbagGeometry.userData.rendererOwned = true;
    for (const mat of Object.values(this.materials)) { mat.userData.rendererOwned = true; configureBoxMaterial(mat); }
    this.texturedSolid.userData.rendererOwned = true;
    configureBoxMaterial(this.texturedSolid);
    const graphics=currentGraphicsStyle();
    this.texturedSolid.colorNode = attribute('boxColor', 'vec3').mul(texture(this.surfaceTexture, instancedBoxPatternUv()).rgb);
    applyOrigamiSurface(this.texturedSolid,attribute('boxColor','vec3'),uv(),graphics);
    for (const mat of [this.plainRock, this.texturedRock]) {
      mat.userData.rendererOwned = true;
      configureChunkMaterial(mat);
    }
    this.texturedRock.colorNode = attribute('boxColor', 'vec3').mul(texture(this.rockTexture, chunkPaintUv()).rgb);
    applyOrigamiSurface(this.texturedRock,attribute('boxColor','vec3'),uv(),graphics);
  }

  /** Select a resident pipeline. The plain one has no texture node or map, so
   * disabled surfaces do no texture sampling and need no per-frame work. */
  setTexturesEnabled(enabled: boolean): void {
    if (enabled === this.texturesEnabled) return;
    this.texturesEnabled = enabled;
    const chosen = enabled ? this.texturedSolid : this.materials.solid;
    for (const mesh of this.batches.values()) {
      const previous=mesh.material;
      if (mesh.material === this.texturedSolid || mesh.material === this.materials.solid) mesh.material = chosen;
      else if (mesh.material === this.texturedRock || mesh.material === this.plainRock) mesh.material = enabled ? this.texturedRock : this.plainRock;
      else if(mesh.material===this.texturedItem||mesh.material===this.plainItem)mesh.material=enabled?this.texturedItem:this.plainItem;
      if(mesh.material!==previous)mesh.commitOwnedOpaque435();
      this.contours.get(mesh)?.sync();
    }
  }

  setTargetPreview(group: THREE.Group, ids: ReadonlySet<number>): void {
    if (ids.size === 0) { this.clearTargetPreview(group); return; }
    this.targetGroups.set(group, new Set(ids));
    for (const child of group.children) this.targetBatches.get(child as BoxMesh)?.tint.setTargets(ids);
  }

  clearTargetPreview(group?: THREE.Group): void {
    if (group) {
      this.targetGroups.delete(group);
      for (const child of group.children) this.targetBatches.get(child as BoxMesh)?.tint.clear();
    } else {
      this.targetGroups.clear();
      for (const state of this.targetBatches.values()) state.tint.clear();
    }
  }

  set(group: THREE.Group, key: string, items: Placement[], style: Style = 'solid', shadows = true): void {
    // Barricades own one resident mesh and the ordinary solid material. Their
    // authored cushions never promote unrelated furniture into the item atlas.
    if(key==='sandbags'&&style==='solid'){
      this.setGeometry(group,key,items,this.sandbagGeometry,style,shadows);return;
    }
    if(style==='solid'&&(key.startsWith('pile:')||this.itemBatchKeys.has(key)||items.some(p=>p.shape&&(ITEM_SHAPES as readonly string[]).includes(p.shape)))){
      this.itemBatchKeys.add(key);this.warmRoundedRocks(group,key,shadows);
      const ordinary:Placement[]=[],complex:Placement[]=[],rocks:Placement[]=[],small:Placement[]=[];
      for(const p of items){if(p.shape==='rounded-rock')(isSmallChunk(p.key,p.sx)?small:rocks).push(p);else(this.itemAtlas.isSmall(p.shape as ItemShape|undefined)?ordinary:complex).push(p);}
      this.setGeometry(group,key,ordinary,this.itemAtlas.smallGeometry,style,shadows);
      if(complex.length||this.batches.has(`${key}:complex`))this.setGeometry(group,`${key}:complex`,complex,this.itemAtlas.geometry,style,shadows);
      if(rocks.length||small.length||this.batches.has(`${key}:rounded-rock`)){
        this.setGeometry(group,`${key}:rounded-rock`,rocks,this.roundedRockGeometry,style,shadows);
        this.setGeometry(group,`${key}:small-rock`,small,this.smallRockGeometry,style,shadows);
      }
      return;
    }
    this.setHistorical(group,key,items,style,shadows);
  }
  private warmRoundedRocks(group:THREE.Group,key:string,shadows:boolean):void {
    if(key.startsWith('pile:')&&!this.roundedRockWarm){
      // Two resident, empty sentinels warm both rock geometries even on a map
      // without fragments. They are shared across the spatial map chunks.
      for(const [suffix,geometry] of [['rounded-rock',this.roundedRockGeometry],['small-rock',this.smallRockGeometry]] as const){
        const warm = new BoxMesh(geometry, this.texturesEnabled ? this.texturedRock : this.plainRock, 1,this.ownedProducer435);
        this.allocateRockContour(warm);
        warm.name = `pile-${suffix}-warm`;
        warm.castShadow = shadows; warm.receiveShadow = true; warm.activeCount = 0;
        this.ownedProducer435?.register(warm,[this.plainRock,this.texturedRock],[this.rockTexture]);
        group.add(warm); this.batches.set(warm.name, warm);
        this.syncContour(warm,geometry,false);
      }
      this.roundedRockWarm = true;
    }
  }
  private setHistorical(group: THREE.Group, key: string, items: Placement[], style: Style, shadows: boolean): void {
    if(style==='solid')this.warmRoundedRocks(group,key,shadows);
    if (style === 'solid' && (items.some(item=>item.shape==='rounded-rock') || this.batches.has(`${key}:rounded-rock`))) {
      this.setGeometry(group,key,items.filter(item=>item.shape!=='rounded-rock'),this.geometry,style,shadows);
      const rocks=items.filter(item=>item.shape==='rounded-rock');
      this.setGeometry(group,`${key}:rounded-rock`,rocks.filter(item=>!isSmallChunk(item.key,item.sx)),this.roundedRockGeometry,style,shadows);
      this.setGeometry(group,`${key}:small-rock`,rocks.filter(item=>isSmallChunk(item.key,item.sx)),this.smallRockGeometry,style,shadows);
      return;
    }
    this.setGeometry(group,key,items,this.geometry,style,shadows);
  }

  /** Replace an already-owned, constant-length furniture contribution in the
   * existing batch. Full uploads and the historical ordered sphere fold are
   * retained; only unchanged instance transforms avoid recomputation. */
  patchFurniture(group: THREE.Group, key: string, start: number, items: Placement[], totalCount: number, stamp: object): boolean {
    return this.patchFurnitureBatch(group,key,[{start,items}],totalCount,stamp);
  }

  patchFurnitureBatch(group: THREE.Group, key: string, patches: readonly {start:number;items:Placement[]}[], totalCount: number, stamp: object): boolean {
    const mesh=this.batches.get(key);
    if(key!=='furniture'||stamp!==this.furnitureRevision||!mesh||mesh.parent!==group||mesh.activeCount!==totalCount
      ||patches.length===0||mesh.geometry.hasAttribute('chunkContour')||mesh.itemShapeBuffer)return false;
    let last=0;
    for(const patch of patches){
      if(!Number.isSafeInteger(patch.start)||patch.start<last||patch.start+patch.items.length>totalCount)return false;
      last=patch.start+patch.items.length;
    }
    const targets=this.targetBatches.get(mesh);
    targets?.tint.restore();
    for(const patch of patches)for(let offset=0;offset<patch.items.length;offset++){
      const item=patch.items[offset]!,i=patch.start+offset;
      object.position.set(item.x,item.y,item.z);object.rotation.set(0,item.ry??0,0);
      object.scale.set(item.sx??1,item.sy??1,item.sz??1);object.updateMatrix();
      mesh.setMatrixAt(i,object.matrix);mesh.setColorAt(i,color.setHex(item.color??0xffffff));
      if(targets)targets.ids[i]=item.targetId;
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.colorBuffer.needsUpdate=true;
    mesh.computeBoundingSphere();
    if(targets)targets.tint.setInstances(mesh.colorBuffer,targets.ids);
    mesh.commitOwnedOpaque435();
    this.contours.get(mesh)?.sync();
    return true;
  }

  private setGeometry(group: THREE.Group, key: string, items: Placement[], geometry: THREE.BufferGeometry, style: Style, shadows: boolean): void {
    if(key==='furniture')this.furnitureRevision={};
    let mesh = this.batches.get(key);
    if(mesh)this.targetBatches.get(mesh)?.tint.restore();
    const rock=geometry===this.roundedRockGeometry||geometry===this.smallRockGeometry;
    const atlas=geometry===this.itemAtlas.geometry||geometry===this.itemAtlas.smallGeometry;
    const chosen = style==='solid'&&atlas?(this.texturesEnabled?this.texturedItem:this.plainItem):style === 'solid' && rock
      ? (this.texturesEnabled ? this.texturedRock : this.plainRock)
      : style === 'solid' && this.texturesEnabled ? this.texturedSolid : this.materials[style];
    if (!mesh) {
      mesh = new BoxMesh(geometry, chosen, Math.max(256, 2 ** Math.ceil(Math.log2(items.length || 1))),style==='solid'?this.ownedProducer435:undefined);
      if(rock)this.allocateRockContour(mesh);
      mesh.name = key;
      mesh.castShadow = style === 'solid' && shadows; mesh.receiveShadow = true;
      if(style==='solid')this.ownedProducer435?.register(mesh,
        atlas?[this.plainItem,this.texturedItem]:rock?[this.plainRock,this.texturedRock]:[this.materials.solid,this.texturedSolid],
        atlas?[this.itemAtlas.data,this.surfaceTexture]:rock?[this.rockTexture]:[this.surfaceTexture]);
      group.add(mesh); this.batches.set(key, mesh);
    } else if (items.length > mesh.instanceMatrix.count||atlas!==!!mesh.itemShapeBuffer) {
      // Release the old per-instance buffers before replacing their capacity.
      const capacity = Math.max(mesh.instanceMatrix.count,2 ** Math.ceil(Math.log2(items.length||1)));
      mesh.allocate(geometry, capacity);
      if(rock)this.allocateRockContour(mesh);
    }
    if (mesh.material !== chosen) mesh.material = chosen;
    mesh.activeCount = items.length;
    const ids:(number|undefined)[]=[];
    const patternIndices=atlas?new Map<number,number>():undefined;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      object.position.set(item.x, item.y, item.z); object.rotation.set(0, item.ry ?? 0, 0);
      object.scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1); object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix); mesh.setColorAt(i, color.setHex(item.color ?? 0xffffff));
      ids.push(item.targetId);
      if(atlas){const slot=this.itemAtlas.slot(item.shape as ItemShape|undefined),ordinal=patternIndices!.get(slot)??0;mesh.setItemShapeAt(i,slot,ordinal);patternIndices!.set(slot,ordinal+1);}
      if(rock)(mesh.geometry.getAttribute('chunkContour') as THREE.InstancedBufferAttribute).setXYZW(i,...chunkContour(item.key));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.colorBuffer.needsUpdate = true;
    if(mesh.itemShapeBuffer)mesh.itemShapeBuffer.needsUpdate=true;
    if(rock)mesh.geometry.getAttribute('chunkContour').needsUpdate=true;
    mesh.computeBoundingSphere();
    let targets=this.targetBatches.get(mesh);
    if(!targets){const ownedMesh=mesh;targets={ids,tint:new InstanceTargetTint(()=>ownedMesh.commitOwnedOpaque435())};this.targetBatches.set(mesh,targets);}
    else targets.ids=ids;
    targets.tint.setInstances(mesh.colorBuffer,ids);
    const selected=this.targetGroups.get(group);if(selected)targets.tint.setTargets(selected);
    mesh.commitOwnedOpaque435();
    if(style==='solid')this.syncContour(mesh,geometry,atlas);
  }

  private syncContour(mesh:BoxMesh,geometry:THREE.BufferGeometry,atlas:boolean):void {
    const context=this.graphicsStyle;if(!context?.origami)return;
    let binding=this.contours.get(mesh);
    if(!binding){
      if(atlas){
        const source=this.itemContourAtlas??=new ItemContourAtlas();
        binding=createOrigamiContour(mesh,context,source.positionNode(),geometry===this.itemAtlas.smallGeometry?source.smallGeometry:source.geometry,source.paintUvNode());
      }else binding=createOrigamiContour(mesh,context,(mesh.material as THREE.NodeMaterial).positionNode,geometry);
      mesh.add(binding.line);this.contours.set(mesh,binding);
    }
    binding.sync(mesh);
  }

  private allocateRockContour(mesh: BoxMesh): void {
    mesh.geometry.setAttribute('chunkContour',new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*4),4).setUsage(THREE.StaticDrawUsage));
  }

  clear(): void {
    for(const binding of this.contours.values())binding.dispose();this.contours.clear();
    for (const state of this.targetBatches.values()) state.tint.dispose();
    this.targetBatches.clear();this.targetGroups.clear();
    for (const mesh of this.batches.values()) { mesh.removeFromParent(); mesh.dispose(); }
    this.batches.clear();
    this.itemBatchKeys.clear();
    this.furnitureRevision=undefined;
    this.roundedRockWarm = false;
  }

  /** Empty batches otherwise miss the real shadow pass. Expose one degenerate
   * instance only during loading, restoring the exact resident data afterwards. */
  prepareEmptyShadows(): () => void {
    const empty=[...this.batches.values()].filter(mesh=>mesh.activeCount===0);
    const saved=empty.map(mesh=>({attribute:mesh.instanceMatrix,first:mesh.instanceMatrix.array.slice(0,16),version:mesh.instanceMatrix.version+1}));
    for(const mesh of empty) {
      mesh.instanceMatrix.array.fill(0,0,16);mesh.instanceMatrix.array[15]=1;
      mesh.instanceMatrix.needsUpdate=true;mesh.activeCount=1;
      mesh.commitOwnedOpaque435();
    }
    return ()=>{empty.forEach((mesh,i)=>{
      const state=saved[i]!;
      // Snapshot adoption may run while the GPU queue is draining. Never
      // overwrite a newer logical batch, even when its count is also one.
      if(mesh.instanceMatrix!==state.attribute||mesh.instanceMatrix.version!==state.version)return;
      mesh.activeCount=0;mesh.instanceMatrix.array.set(state.first,0);mesh.instanceMatrix.needsUpdate=true;
      mesh.commitOwnedOpaque435();
    });};
  }

  dispose(): void {
    this.clear(); this.geometry.dispose(); this.roundedRockGeometry.dispose();this.smallRockGeometry.dispose();this.sandbagGeometry.dispose();
    this.itemAtlas.dispose();this.plainItem.dispose();this.texturedItem.dispose();
    this.itemContourAtlas?.dispose();this.itemContourAtlas=undefined;
    for (const mat of Object.values(this.materials)) mat.dispose();
    this.texturedSolid.dispose(); this.plainRock.dispose(); this.texturedRock.dispose(); this.surfaceTexture.dispose();this.rockTexture.dispose();
  }
}
