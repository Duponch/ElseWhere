import * as THREE from 'three/webgpu';
import { Fn, If, attribute, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import type { AnimationDetail } from './AnimationDetail';
import { NaturalAnimationCache } from './natural-animation-cache';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Resource, World } from '../sim/types';
import { floraColor, floraSize, isClusterPlantSpecies } from './flora-presentation';
import { noise } from './StaticGeometry';
import type { NaturalPresentationChange } from './NaturalResourcePresentation';
import { ResourceTargetTint } from './resource-target-tint';
import { currentGraphicsStyle } from './graphics-style';
import { createOrigamiGroundTuftGeometry } from './origami/flora';
import {createInstancedOrigamiContour,type OrigamiContourBinding} from './origami/contours';

const BASE_STEMS = [
  { x: 0, z: 0, height: 1, leanX: .04, leanZ: -.025 },
  { x: -.13, z: .05, height: .78, leanX: -.10, leanZ: .035 },
  { x: .12, z: -.04, height: .86, leanX: .09, leanZ: -.04 },
  { x: -.05, z: -.13, height: .68, leanX: -.035, leanZ: -.10 },
  { x: .06, z: .14, height: .73, leanX: .045, leanZ: .11 },
  { x: -.17, z: -.10, height: .58, leanX: -.12, leanZ: -.07 },
  { x: .17, z: .09, height: .63, leanX: .13, leanZ: .065 },
] as const;

/** One low-poly 3D tuft shared by every physical grass plant. Stems are narrow,
 * upright tapered prisms; variation belongs to instance transforms and colors. */
export function createPlantClusterGeometry(): THREE.BufferGeometry {
  const parts = BASE_STEMS.map(({ x, z, height, leanX, leanZ }, index) => {
    // An open triangular prism gives the stem real volume for three side
    // triangles only. Seven stems therefore remain cheaper than one small
    // conventional cylinder per plant.
    const stem = new THREE.ConeGeometry(.024 + index % 3 * .003, height, 3, 1, true);
    stem.rotateX(leanZ);
    stem.rotateZ(-leanX);
    stem.translate(x, height * .5, z);
    return stem;
  });
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('Could not assemble plant cluster geometry');
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export interface PlantClusterPresentation {
  rotation: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  color: number;
}

/** Position/species alone determine the silhouette, so a reload cannot reshuffle
 * the field and presentation never consumes the simulation PRNG. */
export function plantClusterPresentation(world: World, resource: Resource, size = floraSize(world, resource)): PlantClusterPresentation {
  const turn = noise(resource.x, resource.z, resource.id + 311);
  const width = .78 + noise(resource.x, resource.z, resource.id + 503) * .34;
  const height = resource.species === 'tall-grass' ? .78 : .46;
  const base = new THREE.Color(floraColor(resource));
  base.offsetHSL((turn - .5) * .025, (noise(resource.x, resource.z, resource.id + 701) - .5) * .12, (turn - .5) * .10);
  return {
    rotation: turn * Math.PI * 2,
    scaleX: width * size,
    scaleY: height * (.88 + noise(resource.x, resource.z, resource.id + 887) * .24) * size,
    scaleZ: (1.12 - width * .12) * size,
    color: base.getHex(),
  };
}

/** A single resident instanced draw covers short and tall physical grasses.
 * Slots survive ordinary snapshots; only changed collections/growth stages upload. */
export class PlantClusterLayer {
  readonly group = new THREE.Group();
  private readonly graphicsStyle = currentGraphicsStyle();
  private readonly geometry = this.graphicsStyle?.origami ? createOrigamiGroundTuftGeometry() : createPlantClusterGeometry();
  private mesh: THREE.InstancedMesh;
  private contour?:OrigamiContourBinding;
  private readonly slots = new Map<number, { index: number; signature: string }>();
  private readonly free: number[] = [];
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly windTick=uniform(0);
  private readonly windStrength=uniform(0);
  private readonly windDirection=uniform(new THREE.Vector2(1,0));
  private readonly middleWind=new NaturalAnimationCache();
  private readonly windPlain:THREE.NodeMaterial;
  private readonly windTextured:THREE.NodeMaterial;
  private windYaw!:THREE.InstancedBufferAttribute;
  private windBasis!:THREE.InstancedBufferAttribute;
  // A growing envelope is conservative after removals and moves. Updating it
  // for a changed tuft costs O(1), unlike InstancedMesh.computeBoundingSphere()
  // which scans every resident slot, including the thousands left unchanged.
  private readonly bounds = new THREE.Box3();
  private readonly transformedBounds = new THREE.Box3();
  private used = 0;
  private readonly targetTint=new ResourceTargetTint();
  private targetPreviewIds=new Set<number>();

  constructor(private readonly plainMaterial:THREE.NodeMaterial,private readonly texturedMaterial:THREE.NodeMaterial=plainMaterial,private readonly detail?:AnimationDetail) {
    const windPosition=Fn(()=>{
      const deform=(tick:THREE.Node<'float'>)=>{
      const yaw=attribute('windYaw','float'),c=yaw.cos(),s=yaw.sin();
      const localX=this.windDirection.x.mul(c).sub(this.windDirection.y.mul(s));
      const localZ=this.windDirection.x.mul(s).add(this.windDirection.y.mul(c));
      const phase=tick.mul(2*Math.PI/18).add(yaw.mul(3.1));
      const bend=positionLocal.y.mul(positionLocal.y).mul(this.windStrength)
        .mul(sin(phase).mul(.075).add(.12));
      return positionLocal.add(vec3(localX.mul(bend),0,localZ.mul(bend)));
      };
      if(!detail)return deform(this.windTick);
      // positionLocal has received Three's instance transform at this point.
      const anchor=vec3(positionLocal.x.add(.5).floor(),0,positionLocal.z.add(.5).floor());
      const level=detail.level(anchor).toVar(),position=positionLocal.toVar();
      If(level.equal(0),()=>{position.assign(deform(this.windTick));})
        .ElseIf(level.equal(1),()=>{
          const basis=attribute('windBasis','vec4'),wind=this.middleWind.wind;
          const localX=wind.x.mul(basis.x).sub(wind.y.mul(basis.y));
          const localZ=wind.x.mul(basis.y).add(wind.y.mul(basis.x));
          const wave=this.middleWind.phaseA.x.mul(basis.w).add(this.middleWind.phaseA.y.mul(basis.z));
          const bend=positionLocal.y.mul(positionLocal.y).mul(wind.z).mul(wave.mul(.075).add(.12));
          position.assign(positionLocal.add(vec3(localX.mul(bend),0,localZ.mul(bend))));
        });
      return position;
    })();
    this.windPlain=plainMaterial.clone();
    this.windTextured=texturedMaterial.clone();
    this.windPlain.positionNode=this.windTextured.positionNode=windPosition;
    this.mesh = this.createMesh(128);
    this.group.name = 'plant-cluster-layer';
    this.group.add(this.mesh);
    if(this.graphicsStyle?.origami){this.contour=createInstancedOrigamiContour(this.mesh,this.graphicsStyle,windPosition);this.group.add(this.contour.line);}
  }
  private texturesEnabled=true;
  setTexturesEnabled(enabled:boolean):void {this.texturesEnabled=enabled;this.mesh.material=enabled?this.windTextured:this.windPlain;this.contour?.sync();}
  setTargetPreview(ids:ReadonlySet<number>):void {
    if(ids.size===this.targetPreviewIds.size&&[...ids].every(id=>this.targetPreviewIds.has(id)))return;
    this.targetTint.restore();this.targetPreviewIds=new Set(ids);this.tintTargets();
  }
  clearTargetPreview():void {this.targetTint.restore();this.targetPreviewIds.clear();}
  private tintTargets():void {
    if(!this.targetPreviewIds.size)return;
    const slots:number[]=[];
    for(const id of this.targetPreviewIds){const slot=this.slots.get(id);if(slot)slots.push(slot.index);}
    this.targetTint.applySlots(this.mesh.instanceColor!,slots);
  }

  setWind(strength:number,directionX:number,directionZ:number):void {
    this.windStrength.value=Number.isFinite(strength)?Math.max(0,Math.min(2,strength)):0;
    const length=Math.hypot(directionX,directionZ);
    if(length>0&&Number.isFinite(length))this.windDirection.value.set(directionX/length,directionZ/length);
  }
  presentWind(tick:number):void {
    this.windTick.value=((tick%7200)+7200)%7200;
    if(this.detail){const sample=this.windTick.value;
      this.middleWind.capture(this.detail,this.windDirection.value.x,this.windDirection.value.y,this.windStrength.value,sample*2*Math.PI/18);}
  }

  private createMesh(capacity: number): THREE.InstancedMesh {
    this.windYaw=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.StaticDrawUsage);
    this.windBasis=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.StaticDrawUsage);
    this.geometry.setAttribute('windYaw',this.windYaw);
    this.geometry.setAttribute('windBasis',this.windBasis);
    const mesh = new THREE.InstancedMesh(this.geometry, this.texturesEnabled?this.windTextured:this.windPlain, capacity);
    mesh.name = 'upright-plant-clusters';
    mesh.instanceMatrix = new THREE.StorageInstancedBufferAttribute(capacity, 16);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.count = 0;
    mesh.setColorAt(0, this.color.setHex(0x819356));
    mesh.instanceColor!.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  }

  private ensureCapacity(required: number): void {
    if (required <= this.mesh.instanceMatrix.count) return;
    const previous = this.mesh;
    const previousYaw=this.windYaw;
    const previousBasis=this.windBasis;
    const next = this.createMesh(2 ** Math.ceil(Math.log2(required)));
    next.instanceMatrix.array.set(previous.instanceMatrix.array);
    next.instanceColor!.array.set(previous.instanceColor!.array);
    this.windYaw.array.set(previousYaw.array);
    this.windBasis.array.set(previousBasis.array);
    next.count = previous.count;
    next.boundingSphere = previous.boundingSphere?.clone() ?? null;
    this.group.remove(previous);
    previous.dispose();
    this.mesh = next;
    this.group.add(next);
    this.contour?.sync(next);
  }

  prepareForCompile(): () => void {
    const count = this.mesh.count;
    this.mesh.count = Math.max(1, count);
    this.contour?.sync();
    return () => { this.mesh.count = count;this.contour?.sync(); };
  }

  update(world: World, reset: boolean, changes?: ReadonlyMap<number, NaturalPresentationChange>): void {
    const plainOutput=this.plainMaterial.outputNode;
    const texturedOutput=this.texturedMaterial.outputNode;
    if(this.windPlain.outputNode!==plainOutput)this.windPlain.outputNode=plainOutput;
    if(this.windTextured.outputNode!==texturedOutput)this.windTextured.outputNode=texturedOutput;
    if (reset) {
      this.middleWind.reset();
      this.clearTargetPreview();
      this.bounds.makeEmpty();
      this.slots.clear();
      this.free.length = 0;
      this.used = 0;
      this.mesh.count = 0;
    }
    const plants = !reset&&changes
      ? [...changes.values()].flatMap(({resource})=>resource&&isClusterPlantSpecies(resource.species)?[resource]:[])
      : world.resources.filter(resource => isClusterPlantSpecies(resource.species));
    const alive = !reset&&changes ? undefined : new Set(plants.map(resource => resource.id));
    if(changes&&!reset&&!plants.length&&![...changes.keys()].some(id=>this.slots.has(id)))return;
    this.targetTint.restore();
    let firstMatrix = Infinity, lastMatrix = -1;
    let firstColor = Infinity, lastColor = -1;
    const removed = alive
      ? [...this.slots].filter(([id])=>!alive.has(id))
      : [...changes!].filter(([id,{resource}])=>this.slots.has(id)&&(!resource||!isClusterPlantSpecies(resource.species)))
        .map(([id])=>[id,this.slots.get(id)!] as const);
    for (const [id, slot] of removed) {
      this.transform.scale.setScalar(0);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(slot.index, this.transform.matrix);
      this.includeTransformBounds();
      firstMatrix = Math.min(firstMatrix, slot.index);
      lastMatrix = Math.max(lastMatrix, slot.index);
      this.slots.delete(id);
      this.free.push(slot.index);
    }
    const additions=plants.reduce((count,plant)=>count+(this.slots.has(plant.id)?0:1),0);
    this.ensureCapacity(Math.max(1,this.used+Math.max(0,additions-this.free.length)));
    let visibleCount = removed.length ? 0 : this.mesh.count;
    for (const plant of plants) {
      let slot = this.slots.get(plant.id);
      if (slot === undefined) {
        slot = { index: this.free.pop() ?? this.used++, signature: '' };
        this.slots.set(plant.id, slot);
      }
      visibleCount = Math.max(visibleCount, slot.index + 1);
      // Only the four visible growth stages, species and position affect this
      // deterministic tuft. Other resource edits must not rewrite its buffers.
      const size=changes?.get(plant.id)?.size??floraSize(world,plant);
      const signature = `${plant.species}:${plant.x}:${plant.z}:${size}`;
      if (slot.signature === signature) continue;
      slot.signature = signature;
      const presentation = plantClusterPresentation(world, plant, size);
      this.transform.position.set(plant.x, .018, plant.z);
      this.transform.rotation.set(0, presentation.rotation, 0);
      this.transform.scale.set(presentation.scaleX, presentation.scaleY, presentation.scaleZ);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(slot.index, this.transform.matrix);
      this.windYaw.setX(slot.index,presentation.rotation);
      this.windBasis.setXYZW(slot.index,Math.cos(presentation.rotation),Math.sin(presentation.rotation),Math.sin(presentation.rotation*3.1),Math.cos(presentation.rotation*3.1));
      this.includeTransformBounds();
      this.mesh.setColorAt(slot.index, this.color.setHex(presentation.color));
      firstMatrix = Math.min(firstMatrix, slot.index);
      lastMatrix = Math.max(lastMatrix, slot.index);
      firstColor = Math.min(firstColor, slot.index);
      lastColor = Math.max(lastColor, slot.index);
    }
    if(removed.length)for(const slot of this.slots.values())visibleCount=Math.max(visibleCount,slot.index+1);
    this.mesh.count = visibleCount;
    if (lastMatrix >= 0 && visibleCount) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(firstMatrix * 16, (lastMatrix - firstMatrix + 1) * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
      this.windYaw.clearUpdateRanges();
      this.windYaw.addUpdateRange(firstMatrix,lastMatrix-firstMatrix+1);
      this.windYaw.needsUpdate=true;
      this.windBasis.clearUpdateRanges();
      this.windBasis.addUpdateRange(firstMatrix*4,(lastMatrix-firstMatrix+1)*4);
      this.windBasis.needsUpdate=true;
    }
    if (lastMatrix >= 0 || reset) {
      this.bounds.getBoundingSphere(this.mesh.boundingSphere ??= new THREE.Sphere());
      this.mesh.boundingSphere.radius+=.3;
    }
    if (lastColor >= 0 && visibleCount) {
      this.mesh.instanceColor!.clearUpdateRanges();
      this.mesh.instanceColor!.addUpdateRange(firstColor * 3, (lastColor - firstColor + 1) * 3);
      this.mesh.instanceColor!.needsUpdate = true;
    }
    this.tintTargets();
    this.contour?.sync();
  }

  private includeTransformBounds(): void {
    this.transformedBounds.copy(this.geometry.boundingBox!).applyMatrix4(this.transform.matrix);
    this.bounds.union(this.transformedBounds);
  }

  instanceCount(): number { return this.mesh.count; }

  dispose(): void {
    this.contour?.dispose();this.contour=undefined;
    this.clearTargetPreview();
    this.mesh.dispose();
    this.geometry.dispose();
    this.windPlain.dispose();this.windTextured.dispose();
  }
}
