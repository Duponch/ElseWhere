import {treeVisualParts,type TreeVisualTraits} from './tree-presentation';
import {createItemGeometry} from './item-geometry';
import * as THREE from 'three/webgpu';
import { BoxMesh, configureBoxMaterial } from './BoxMesh';
import { constructionPreviewParts, type ConstructionPreviewParts, type ConstructionPreviewSpec } from './construction-preview-parts';
import { InstanceTargetTint } from './instance-target-tint';
import { createTimberGeometry } from './TimberCladdingLayer';
import {createSandbagGeometry} from './sandbag-parts';
import type { Placement } from './primitives';
import type { World } from '../sim/types';
import {EMPTY_GROUND_OVERLAYS,GROUND_OVERLAY_RENDER_ORDER,groundOverlayRect,type GroundOverlayRect} from './ground-overlay-surfaces';

const object = new THREE.Object3D(), color = new THREE.Color(), validTint = new THREE.Color(0x9de7c9), invalidTint = new THREE.Color(0xe46f58);
type PreviewPlacement = Placement & { rx?: number; rz?: number; tint?: number };

/** The authored construction models, allocated only when a placement changes.
 * One resident pipeline; no world writes, per-frame rebuilding or shadows.
 * The placement cursor draws over everything; the ghosts of placed
 * constructions (`placed`) use the same models, tint and opacity but are
 * hidden by what stands in front of them. */
export class ConstructionPreviewLayer {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshBasicNodeMaterial;
  private readonly targets: { tint: InstanceTargetTint; ids: (number | undefined)[] }[] = [];
  private targetIds: ReadonlySet<number> = new Set();
  private placedParts: ConstructionPreviewParts | undefined;
  /** Only real ground-height faces; furniture/roof models are not floor fills. */
  surfaces:readonly GroundOverlayRect[]=EMPTY_GROUND_OVERLAYS;
  private readonly bases = [new THREE.BoxGeometry(1, 1, 1), createTimberGeometry(false), createTimberGeometry(true), new THREE.BoxGeometry(1, 1, 1),createSandbagGeometry(),createItemGeometry('item-disc'),createItemGeometry('item-nugget'),createItemGeometry('trap-spike')];
  private readonly meshes: BoxMesh[];
  private revision = 0;
  private previousWorld:World|undefined;
  private previousSignature='';

  constructor(private readonly placed = false) {
    this.material = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: .48, depthWrite: false, depthTest: placed, vertexColors:true });
    configureBoxMaterial(this.material);
    this.group.name = placed ? 'Construction ghosts' : 'Construction ghost preview';
    this.meshes = this.bases.map((base, i) => {
      const mesh = new BoxMesh(base, this.material, 32);
      if(base.hasAttribute('color'))mesh.geometry.setAttribute('color',base.getAttribute('color').clone());
      mesh.name = `${placed ? 'construction-placed-ghost' : 'construction-ghost'}-${i}`; mesh.renderOrder = GROUND_OVERLAY_RENDER_ORDER.ghost; mesh.activeCount = 0;
      this.group.add(mesh); if (placed) this.targets.push({ tint: new InstanceTargetTint(), ids: [] }); return mesh;
    });
  }

  /** Ghosts of placed constructions: the parts are written once per change of
   * the placed set, all with the cursor's valid tint. */
  presentPlaced(parts: ConstructionPreviewParts): void {
    if (!this.placed) throw new Error('Only the placed ghost layer presents placed constructions');
    if (this.placedParts === parts) return;
    this.placedParts = parts; this.revision++;
    const arrays = [parts.boxes.filter(part => part.shape !== 'sandbag'), parts.timberWalls, parts.timberEaves, parts.rotatedBoxes, parts.boxes.filter(part => part.shape === 'sandbag')];
    for (let index = 0; index < this.meshes.length; index++) {
      const mesh = this.meshes[index]!, list = arrays[index] ?? [], target = this.targets[index]!;
      target.tint.restore();
      if (list.length > mesh.instanceMatrix.count) {
        const base = this.bases[index]!;
        mesh.allocate(base, 2 ** Math.ceil(Math.log2(list.length)));
        if (base.hasAttribute('color')) mesh.geometry.setAttribute('color', base.getAttribute('color').clone());
      }
      mesh.activeCount = list.length; target.ids = new Array(list.length);
      const matrices = mesh.instanceMatrix.array as Float32Array;
      for (let ordinal = 0; ordinal < list.length; ordinal++) {
        const part = list[ordinal]!;
        if (part.rx || part.rz) {
          object.position.set(part.x, part.y, part.z);
          object.rotation.set(part.rx ?? 0, part.ry ?? 0, part.rz ?? 0);
          object.scale.set(part.sx ?? 1, part.sy ?? 1, part.sz ?? 1); object.updateMatrix();
          mesh.setMatrixAt(ordinal, object.matrix);
        } else {
          // Translation, turn about Y and scale, written without an Object3D.
          const ry = part.ry ?? 0, c = Math.cos(ry), s = Math.sin(ry), sx = part.sx ?? 1, sy = part.sy ?? 1, sz = part.sz ?? 1, o = ordinal * 16;
          matrices[o] = c * sx; matrices[o + 1] = 0; matrices[o + 2] = -s * sx; matrices[o + 3] = 0;
          matrices[o + 4] = 0; matrices[o + 5] = sy; matrices[o + 6] = 0; matrices[o + 7] = 0;
          matrices[o + 8] = s * sz; matrices[o + 9] = 0; matrices[o + 10] = c * sz; matrices[o + 11] = 0;
          matrices[o + 12] = part.x; matrices[o + 13] = part.y; matrices[o + 14] = part.z; matrices[o + 15] = 1;
        }
        mesh.setColorAt(ordinal, color.setHex(part.color ?? 0xffffff).multiplyScalar(part.tint ?? 1).lerp(validTint, .35));
        target.ids[ordinal] = part.key;
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.colorBuffer.needsUpdate = true;
      mesh.computeBoundingSphere();
      target.tint.setInstances(mesh.colorBuffer, target.ids);
      if (this.targetIds.size) target.tint.setTargets(this.targetIds);
    }
  }

  /** Order preview (cancel rectangle): the ghosts of the targeted jobs. */
  setTargetPreview(ids: ReadonlySet<number>): void {
    if (!ids.size) { this.clearTargetPreview(); return; }
    this.targetIds = new Set(ids);
    for (const target of this.targets) target.tint.setTargets(this.targetIds);
  }
  clearTargetPreview(): void { this.targetIds = new Set(); for (const target of this.targets) target.tint.clear(); }

  update(world: World, valid: readonly ConstructionPreviewSpec[], invalid: readonly ConstructionPreviewSpec[], cutaway: boolean): void {
    const signature=JSON.stringify([world.tick,cutaway,valid,invalid]);
    if(this.previousWorld===world&&this.previousSignature===signature)return;
    this.revision++;
    const context = [...valid, ...invalid];
    const good = constructionPreviewParts(world, valid, cutaway, context);
    const bad = constructionPreviewParts(world, invalid, cutaway, context);
    const goodArrays = [good.boxes.filter(part=>part.shape!=='sandbag'), good.timberWalls, good.timberEaves, good.rotatedBoxes,good.boxes.filter(part=>part.shape==='sandbag')];
    const badArrays = [bad.boxes.filter(part=>part.shape!=='sandbag'), bad.timberWalls, bad.timberEaves, bad.rotatedBoxes,bad.boxes.filter(part=>part.shape==='sandbag')];
    const surfaces:GroundOverlayRect[]=[];
    const floorKeys=new Set(context.flatMap((spec,index)=>(spec.kind==='lay-floor'||spec.kind==='build-bridge'||spec.kind==='remove-bridge')?[spec.key??index]:[]));
    for (let index = 0; index < this.meshes.length; index++) {
      const mesh = this.meshes[index]!, goodParts = goodArrays[index]??[], badParts = badArrays[index]??[];
      const count = goodParts.length + badParts.length;
      if (count > mesh.instanceMatrix.count) {
        const base=this.bases[index]!;
        mesh.allocate(base, 2 ** Math.ceil(Math.log2(count)));
        if(base.hasAttribute('color'))mesh.geometry.setAttribute('color',base.getAttribute('color').clone());
      }
      mesh.activeCount = count;
      let ordinal = 0;
      const write = (parts: readonly PreviewPlacement[], valid: boolean): void => {
        for (const part of parts) {
          object.position.set(part.x, part.y, part.z);
          object.rotation.set(part.rx ?? 0, part.ry ?? 0, part.rz ?? 0);
          object.scale.set(part.sx ?? 1, part.sy ?? 1, part.sz ?? 1); object.updateMatrix();
          mesh.setMatrixAt(ordinal, object.matrix);
          color.setHex(part.color ?? 0xffffff).multiplyScalar(part.tint ?? 1).lerp(valid ? validTint : invalidTint, valid ? .35 : .8);
          mesh.setColorAt(ordinal++, color);
          if(index===0&&floorKeys.has(part.key!)){
            const x=Math.fround(part.x),z=Math.fround(part.z),sx=Math.fround(part.sx??1),sz=Math.fround(part.sz??1);
            surfaces.push(groundOverlayRect(x-sx/2,z-sz/2,x+sx/2,z+sz/2,color,this.material.opacity));
          }
        }
      };
      write(goodParts, true); write(badParts, false);
      mesh.instanceMatrix.needsUpdate = true; mesh.colorBuffer.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    this.surfaces=surfaces.length?surfaces:EMPTY_GROUND_OVERLAYS;
    this.previousWorld=world;this.previousSignature=signature;
  }

  /** Full planted silhouette from immutable source traits; no phantom Resource
   * or simulation entry is allocated for this one-cell intention. */
  updateTree(world:World,tree:TreeVisualTraits,cell:{x:number;z:number},valid:boolean):void {
    const signature=JSON.stringify(['tree',cell,valid,tree.species,tree.growth,!!tree.blight]);
    if(this.previousWorld===world&&this.previousSignature===signature)return;
    this.revision++;this.surfaces=EMPTY_GROUND_OVERLAYS;
    const parts=treeVisualParts(tree,false);
    for(let index=0;index<this.meshes.length;index++){
      const mesh=this.meshes[index]!,shape=index===5?'item-disc':index===6?'item-nugget':index===7?'trap-spike':undefined;
      const selected=shape?parts.filter(part=>part.shape===shape):[];mesh.activeCount=selected.length;
      for(let ordinal=0;ordinal<selected.length;ordinal++){
        const part=selected[ordinal]!;object.position.set(cell.x+part.x,part.y,cell.z+part.z);
        object.rotation.set(0,part.ry??0,0);object.scale.set(part.sx??1,part.sy??1,part.sz??1);object.updateMatrix();
        mesh.setMatrixAt(ordinal,object.matrix);color.setHex(part.color??0xffffff).lerp(valid?validTint:invalidTint,valid?.35:.8);mesh.setColorAt(ordinal,color);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.colorBuffer.needsUpdate=true;mesh.computeBoundingSphere();
    }
    this.previousWorld=world;this.previousSignature=signature;
  }
  hide(): void { this.surfaces=EMPTY_GROUND_OVERLAYS;this.revision++;this.previousWorld=undefined;this.previousSignature='';this.placedParts=undefined; for (const mesh of this.meshes) mesh.activeCount = 0; }

  prepareForCompile(): () => void {
    const revision = this.revision;
    const snapshots = this.meshes.map(mesh => {
      const state = { mesh, geometry: mesh.geometry, count: mesh.activeCount, visible: mesh.visible, culled: mesh.frustumCulled,
        sphere: mesh.boundingSphere.clone(), matrix: mesh.instanceMatrix.array.slice(0, 16), color: mesh.colorBuffer.array.slice(0, 3) };
      if (!mesh.activeCount) {
        object.position.set(0, -100, 0); object.rotation.set(0, 0, 0); object.scale.set(0, 0, 0); object.updateMatrix();
        mesh.setMatrixAt(0, object.matrix); mesh.setColorAt(0, color.setHex(0xffffff)); mesh.activeCount = 1;
        mesh.instanceMatrix.needsUpdate = true; mesh.colorBuffer.needsUpdate = true; mesh.computeBoundingSphere();
      }
      mesh.visible = true; mesh.frustumCulled = false; return state;
    });
    return () => {
      for (const state of snapshots) {
        const { mesh } = state; mesh.frustumCulled = state.culled;
        if (this.revision !== revision || mesh.geometry !== state.geometry) continue;
        mesh.instanceMatrix.array.set(state.matrix, 0); mesh.colorBuffer.array.set(state.color, 0);
        mesh.instanceMatrix.needsUpdate = true; mesh.colorBuffer.needsUpdate = true;
        mesh.activeCount = state.count; mesh.visible = state.visible; mesh.boundingSphere.copy(state.sphere);
      }
    };
  }

  dispose(): void {
    for (const target of this.targets) target.tint.dispose();
    this.group.removeFromParent();
    for (const mesh of this.meshes) mesh.dispose();
    for (const base of this.bases) base.dispose();
    this.material.dispose();
  }
}
