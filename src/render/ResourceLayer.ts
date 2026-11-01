import {setStaticSceneSource435} from './StaticSceneCompiler435';
import { appendFlora,floraSize,hydroponicFloraHeight,isClusterPlantSpecies,isMedicinalPlant,isResidentCrop } from './flora-presentation';
import { plantLeafless } from '../sim/plant-life';
import { stoneColor } from './stone-palette';
import { harvestable } from '../sim/plants';
import { workProgress } from '../sim/work-progress';
import * as THREE from 'three/webgpu';
import { Fn, If, attribute, positionLocal, renderGroup, sin, uniform, uv, vec3 } from 'three/tsl';
import type { AnimationDetail, AnimationSampleHandle } from './AnimationDetail';
import { NaturalAnimationCache } from './natural-animation-cache';
import { TICKS_PER_SECOND, type World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { clearGroup } from './primitives';
import type { Placement } from './primitives';
import { mergedInstances,noise,resourceBrushData,type ResourceBrushData,type ResourceRange,type ResourceRangeData } from './StaticGeometry';
import type { NaturalPresentationChange } from './NaturalResourcePresentation';
import type {NaturalAppearanceReader} from './natural-appearance-pass';
import {readSceneResourceFrame,type SceneResourceFrame} from './scene-resource-index';
import {ResourceTargetTint} from './resource-target-tint';
import {ResourceRangeBounds} from './resource-range-bounds';
import {applyOrigamiSurface,currentGraphicsStyle,type GraphicsStyleContext} from './graphics-style';
import {createOrigamiBrushGeometry} from './origami/brush-geometry';
import {ReferenceFloraLibrary} from './origami/resource-flora';
import {GENERIC_REFERENCE_PROFILE} from './origami/reference-profiles';

const resourceIdentity=(world:World,resource:World['resources'][number]):string=>{
  const support=hydroponicFloraHeight(world,resource);
  return `${resource.kind}:${resource.x}:${resource.z}:${resource.stone??''}:${resource.species??''}${support?`:support=${support}`:''}`;
};
const rangeResourceId=(id:number):number=>id<0?Math.floor(-id/2):id;
const CHOP_RECOIL_SECONDS = .55;
type ResourceObject=THREE.Mesh|THREE.LineSegments;
type TreePart = { mesh:ResourceObject; range:ResourceRange; positions:Float32Array; normals:Float32Array; expansions?:Float32Array; brush?:ResourceBrushData;upload:{start:number;count:number} };
type TreeHit = { at:number; x:number; z:number; axisX:number; axisZ:number; angle:number; sample?:AnimationSampleHandle; pendingPose?:boolean };

/** Creases of the existing fallback primitives, with their original placements
 * and visibility/growth identities. Exact source recipes supply separate lines. */
export function resourceFallbackLineParts(parts:readonly {geometry:THREE.BufferGeometry;items:Placement[]}[]):{geometry:THREE.BufferGeometry;items:Placement[]}[] {
  return parts.filter(part=>part.items.length>0).map(part=>{
    const geometry=new THREE.EdgesGeometry(part.geometry,22),count=geometry.getAttribute('position').count;
    const normals=new Float32Array(count*3);for(let i=1;i<normals.length;i+=3)normals[i]=1;
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2),2));
    return {geometry,items:part.items};
  });
}

/** A short strike and damped return about the tree's base, in confirmed scene time. */
export function chopRecoilAngle(age:number):number {
  if(age<0||age>=CHOP_RECOIL_SECONDS)return 0;
  const phase=age/CHOP_RECOIL_SECONDS;
  return .20*Math.sin(phase*Math.PI*2.35)*Math.exp(-phase*3.5)*(1-phase);
}

/** Removal compacts only the existing index buffer; vertices, mesh and material
 * stay resident. Original ranges also permit checkpoint restoration of an ID.
 * Addition/movement of a resource rebuilds only that spatial chunk.
 */
function retainResources(group: THREE.Group, alive: Set<number>): void {
  for (const object of group.children) {
    const mesh = object as THREE.Mesh;
    const data=mesh.userData.resourceRanges as ResourceRangeData|undefined;
    if (!data) continue;
    const index = mesh.geometry.index!; let count = 0;
    for (const range of data.ranges) if (alive.has(range.id)) {
      (index.array as Uint16Array | Uint32Array).set(data.original.subarray(range.start, range.start + range.count), count); count += range.count;
    }
    index.needsUpdate = true; mesh.geometry.setDrawRange(0, count);
    // The original sphere remains a conservative bound after removal.
  }
}

/** Reapply a resource's visible size from the immutable merged positions.
 * This avoids cumulative float drift and keeps index-mask ranges stable. */
function resizeResources(world:World,group:THREE.Group,resources:Map<number,World['resources'][number]>,originalSizes:Map<number,number>,currentSizes:Map<number,number>,nextSizes:Map<number,number>,bounds:WeakMap<THREE.BufferGeometry,ResourceRangeBounds>,graphics?:GraphicsStyleContext):void {
  const changed=new Set<number>();
  for(const [id,size] of nextSizes)if(currentSizes.get(id)!==size&&originalSizes.has(id))changed.add(id);
  if(!changed.size)return;
  for(const object of group.children) {
    const mesh=object as THREE.Mesh,data=mesh.userData.resourceRanges as ResourceRangeData|undefined;
    if(!data)continue;
    const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;let touched=false;
    const brush=resourceBrushData(mesh.geometry);
    const retained=bounds.get(mesh.geometry);let bounded=!!retained;
    for(let rangeIndex=0;rangeIndex<data.ranges.length;rangeIndex++) {
      const range=data.ranges[rangeIndex]!;
      const id=rangeResourceId(range.id);if(!changed.has(id))continue;
      const resource=resources.get(id),initial=originalSizes.get(id),target=nextSizes.get(id);if(!resource||initial===undefined||target===undefined)continue;
      const ratio=target/initial,support=hydroponicFloraHeight(world,resource);
      const expansion=mesh.geometry.getAttribute('origamiWearExpand') as THREE.BufferAttribute|undefined;
      for(let vertex=range.vertexStart;vertex<range.vertexStart+range.vertexCount;vertex++){
        const offset=vertex*3;
        position.array[offset]=resource.x+(data.originalPositions[offset]!-resource.x)*ratio;
        position.array[offset+1]=support?support+(data.originalPositions[offset+1]!-support)*ratio:data.originalPositions[offset+1]!*ratio;
        position.array[offset+2]=resource.z+(data.originalPositions[offset+2]!-resource.z)*ratio;
        if(expansion&&data.originalWearExpandDirections){expansion.array[offset]=data.originalWearExpandDirections[offset]!*ratio;expansion.array[offset+1]=data.originalWearExpandDirections[offset+1]!*ratio;expansion.array[offset+2]=data.originalWearExpandDirections[offset+2]!*ratio;}
        if(brush&&data.originalBrush){
          const original=data.originalBrush;
          brush.base[offset]=resource.x+(original.base[offset]!-resource.x)*ratio;brush.base[offset+1]=support?support+(original.base[offset+1]!-support)*ratio:original.base[offset+1]!*ratio;brush.base[offset+2]=resource.z+(original.base[offset+2]!-resource.z)*ratio;
          for(const key of ['width','rough'] as const)for(let component=0;component<3;component++)brush[key][offset+component]=original[key][offset+component]!*ratio;
        }
      }
      if(brush)graphics?.refreshBrushGeometry(mesh.geometry,range.vertexStart,range.vertexCount);
      if(retained&&!retained.update(rangeIndex,position.array))bounded=false;
      position.addUpdateRange(range.vertexStart*3,range.vertexCount*3);
      if(expansion)expansion.addUpdateRange(range.vertexStart*3,range.vertexCount*3);
      touched=true;
    }
    if(touched){
      position.needsUpdate=true;
      const expansion=mesh.geometry.getAttribute('origamiWearExpand');if(expansion)expansion.needsUpdate=true;
      const padding=(data.ranges.some(range=>resources.get(rangeResourceId(range.id))?.kind==='tree')?4:0)+((mesh.userData.referenceCompanion==='wear'||Boolean(brush))?0.5:0);
      if(bounded){
        mesh.geometry.boundingSphere??=new THREE.Sphere();
        retained!.writeSphere(mesh.geometry.boundingSphere,padding);
      }else{
        bounds.delete(mesh.geometry);mesh.geometry.computeBoundingSphere();
        if(padding&&mesh.geometry.boundingSphere)mesh.geometry.boundingSphere.radius+=padding;
      }
      if(brush&&mesh.geometry.boundingSphere)mesh.geometry.userData.referenceBrushConservativeSphere=mesh.geometry.boundingSphere.clone();
    }
  }
  for(const id of changed)currentSizes.set(id,nextSizes.get(id)!);
}

function visibleResourceKeys(world:World,r:World['resources'][number],appearance?:NaturalAppearanceReader):number[]{
  if(r.kind!=='berries'&&!r.species&&!isMedicinalPlant(r))return [r.id];
  return [r.id,...((appearance?.read(r).leafless??plantLeafless(world,r))?[]:[-r.id*2]),...((appearance?appearance.harvestable(r):harvestable(world,r))?[-r.id*2-1]:[])];
}

export class ResourceLayer {
  private readonly graphicsStyle=currentGraphicsStyle();
  private readonly referenceFlora=this.graphicsStyle?.origami?new ReferenceFloraLibrary():undefined;
  private readonly origamiPlain:THREE.NodeMaterial|undefined;
  private readonly origamiTextured:THREE.NodeMaterial|undefined;
  private readonly linePlain:THREE.NodeMaterial|undefined;
  private readonly lineWind:THREE.NodeMaterial|undefined;
  private readonly wearPlain:THREE.NodeMaterial|undefined;
  private readonly wearWind:THREE.NodeMaterial|undefined;
  private get bodyPlain():THREE.NodeMaterial{return this.origamiPlain??this.staticMaterial;}
  private get bodyTextured():THREE.NodeMaterial{return this.origamiTextured??this.texturedMaterial;}
  compiledMaterials435():readonly THREE.NodeMaterial[]{return[this.bodyPlain,this.bodyTextured,this.windPlain,this.windTextured];}
  compiledAttributeChanged435:((attribute:THREE.BufferAttribute,start:number,count:number)=>void)|undefined;
  private readonly targetTint=new ResourceTargetTint((attribute,start,count)=>this.compiledAttributeChanged435?.(attribute,start,count));
  private readonly rangeBounds=new WeakMap<THREE.BufferGeometry,ResourceRangeBounds>();
  private targetPreviewIds=new Set<number>();
  private readonly chunks=new Map<string,{signature:string;group:THREE.Group;identities:Map<number,string>;originalSizes:Map<number,number>;currentSizes:Map<number,number>;visibleKeys:Set<number>;treeIds:number[]}>();
  private readonly resourceChunks=new Map<number,string>();
  private readonly treeParts=new Map<number,TreePart[]>();
  private readonly treeHits=new Map<number,TreeHit>();
  private readonly treeCells=new Map<number,number>();
  private treeCellsPending:World|undefined;
  private foliageVisible = true;
  private texturesEnabled = true;
  private readonly windTick=uniform(0).setGroup(renderGroup);
  private readonly windStrength=uniform(0).setGroup(renderGroup);
  private readonly windDirection=uniform(new THREE.Vector2(1,0)).setGroup(renderGroup);
  private readonly middleWind=new NaturalAnimationCache();
  private readonly windPlain:THREE.NodeMaterial;
  private readonly windTextured:THREE.NodeMaterial;
  private readonly growing = new Map<number,World['resources'][number]>();
  updateGrowth(world: World): void {
    for(const plant of this.growing.values())if(harvestable(world,plant)){this.update(world,false);break;}
  }
  constructor(readonly group: THREE.Group, private readonly staticMaterial: THREE.NodeMaterial, private readonly texturedMaterial: THREE.NodeMaterial=staticMaterial,private readonly detail?:AnimationDetail) {
    if(this.graphicsStyle?.origami){
      this.origamiPlain=staticMaterial.clone();this.origamiTextured=texturedMaterial.clone();
      Reflect.set(this.origamiPlain,'vertexColors',false);Reflect.set(this.origamiTextured,'vertexColors',false);
      this.origamiPlain.colorNode=attribute('color','vec3');
      applyOrigamiSurface(this.origamiTextured,attribute('color','vec3'),uv(),this.graphicsStyle,attribute('origamiPaint','vec4').w,true);
      // Exact profiles already contain their authored base color. Only live
      // blight/selection changes modulate that result, using the source baseline.
      const paint=attribute('origamiPaint','vec4'),ratio=attribute('color','vec3').div(paint.xyz.max(vec3(.00001)));
      const painted=this.origamiTextured.colorNode as THREE.Node<'vec3'>;
      // The shared paint sample must be evaluated outside profile branches.
      // A ConditionalNode around the complete graph can leave the cached Fn
      // result uninitialised when its first generated branch is not taken.
      this.origamiTextured.colorNode=painted.mul(paint.w.greaterThan(0).select(ratio,vec3(1)));
      this.origamiPlain.userData.rendererOwned=this.origamiTextured.userData.rendererOwned=true;
    }
    const makeWindPosition=(base:THREE.Node<'vec3'>)=>Fn(()=>{
      const root=attribute('windRoot','vec3');
      const deform=(tick:THREE.Node<'float'>)=>{
      const height=base.y.div(4).clamp(0,1);
      const wave=sin(tick.mul(2*Math.PI/48).add(root.x.mul(.47)).add(root.y.mul(.31)));
      const bend=height.mul(height).mul(root.z).mul(this.windStrength).mul(wave.mul(.43).add(.63));
      const leaves=root.z.greaterThan(.8).select(1,0);
      const flutter=sin(tick.mul(2*Math.PI/15).add(base.x.mul(1.3)).add(base.z.mul(1.7)))
        .mul(leaves).mul(height).mul(this.windStrength).mul(.11);
      return base.add(vec3(
        this.windDirection.x.mul(bend).sub(this.windDirection.y.mul(flutter)),
        0,
        this.windDirection.y.mul(bend).add(this.windDirection.x.mul(flutter)),
      ));
      };
      if(!detail)return deform(this.windTick);
      const level=detail.level(vec3(root.x,0,root.y)).toVar(),position=base.toVar();
      If(level.equal(0),()=>{position.assign(deform(this.windTick));})
        .ElseIf(level.equal(1),()=>{
          // Spatial sine/cosine bases are built with the resident geometry.
          // Middle vertices do no temporal trigonometry or phase quantisation.
          const basis=attribute('windBasis','vec4'),wind=this.middleWind.wind;
          const wave=this.middleWind.phaseA.x.mul(basis.y).add(this.middleWind.phaseA.y.mul(basis.x));
          const flutterWave=this.middleWind.phaseB.x.mul(basis.w).add(this.middleWind.phaseB.y.mul(basis.z));
          const height=base.y.div(4).clamp(0,1);
          const bend=height.mul(height).mul(root.z).mul(wind.z).mul(wave.mul(.43).add(.63));
          const flutter=flutterWave.mul(root.z.greaterThan(.8).select(1,0)).mul(height).mul(wind.z).mul(.11);
          position.assign(base.add(vec3(wind.x.mul(bend).sub(wind.y.mul(flutter)),0,wind.y.mul(bend).add(wind.x.mul(flutter)))));
        });
      return position;
    })();
    const windPosition=makeWindPosition(positionLocal);
    this.windPlain=this.bodyPlain.clone();
    this.windTextured=this.bodyTextured.clone();
    this.windPlain.positionNode=this.windTextured.positionNode=windPosition;
    this.windPlain.userData.rendererOwned=this.windTextured.userData.rendererOwned=true;
    if(this.graphicsStyle?.origami){
      const wearPosition=positionLocal.add(attribute('origamiWearExpand','vec3').mul(this.graphicsStyle.contourSpan));
      this.linePlain=this.graphicsStyle.createBrushMaterial(positionLocal,uv());
      this.lineWind=this.graphicsStyle.createBrushMaterial(windPosition,uv());
      this.wearPlain=this.graphicsStyle.createWearMaterial(wearPosition,uv());
      this.wearWind=this.graphicsStyle.createWearMaterial(makeWindPosition(wearPosition),uv());
      for(const material of [this.linePlain,this.lineWind,this.wearPlain,this.wearWind]){
        material.userData.rendererOwned=true;material.userData.referenceOriginalMask=material.maskNode;
      }
    }
  }
  /** One uniform update for the whole forest; no vertex buffer is rewritten. */
  setWind(strength:number,directionX:number,directionZ:number):void {
    this.windStrength.value=Number.isFinite(strength)?Math.max(0,Math.min(2,strength)):0;
    const length=Math.hypot(directionX,directionZ);
    if(length>0&&Number.isFinite(length))this.windDirection.value.set(directionX/length,directionZ/length);
  }
  presentWind(tick:number):void {
    this.windTick.value=((tick%7200)+7200)%7200;
    if(this.detail){const sample=this.windTick.value;
      this.middleWind.capture(this.detail,this.windDirection.value.x,this.windDirection.value.y,this.windStrength.value,sample*2*Math.PI/48,sample*2*Math.PI/15);}
  }
  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;
    this.group.traverse(object=>{
      if(object.userData.referenceCompanion){object.userData.origamiTexturesEnabled=enabled;this.graphicsStyle?.refreshEdgeObject(object);}
      else if(object instanceof THREE.Mesh)object.material=object.geometry.hasAttribute('windRoot')
        ?enabled?this.windTextured:this.windPlain:enabled?this.bodyTextured:this.bodyPlain;
    });
  }
  setFoliageVisible(visible: boolean): void {
    this.foliageVisible = visible;
    this.group.traverse(object => { if (object.name === 'tree-canopy') {
      object.userData.origamiOwnerVisible=visible;
      if(object.userData.referenceCompanion)this.graphicsStyle?.refreshEdgeObject(object);
      else object.visible=visible;
    } });
  }
  /** Caller supplies already eligible target IDs, not a rectangle-position mask.
   * Only their existing spatial chunks/ranges are visited on selection changes. */
  setTargetPreview(ids:ReadonlySet<number>):void {
    if(ids.size===this.targetPreviewIds.size&&[...ids].every(id=>this.targetPreviewIds.has(id)))return;
    this.targetTint.restore();this.targetPreviewIds=new Set(ids);
    const keys=new Set<string>();
    for(const id of ids){const key=this.resourceChunks.get(id);if(key)keys.add(key);}
    for(const key of keys){const chunk=this.chunks.get(key);if(chunk)this.targetTint.apply(chunk.group,this.targetPreviewIds);}
  }
  clearTargetPreview():void {this.targetTint.restore();this.targetPreviewIds.clear();}
  clear(): void { this.middleWind.reset();this.clearTargetPreview();clearGroup(this.group); this.chunks.clear(); this.resourceChunks.clear(); this.growing.clear(); this.treeParts.clear(); this.treeHits.clear(); this.treeCells.clear();this.treeCellsPending=undefined; }
  dispose():void {this.clear();this.windPlain.dispose();this.windTextured.dispose();this.origamiPlain?.dispose();this.origamiTextured?.dispose();this.linePlain?.dispose();this.lineWind?.dispose();this.wearPlain?.dispose();this.wearWind?.dispose();this.referenceFlora?.dispose();}

  /** Only a confirmed increase in a reserved chopping job can produce a hit.
   * The contact phase is the forward reach of the existing 11 rad/s arm pose. */
  adoptChopWork(previous:World|undefined,world:World,reset=false,frame?:SceneResourceFrame):void {
    if(reset||!previous||world.tick<previous.tick){this.clearChopRecoil();return;}
    if(!world.jobs.some(job=>job.kind==='chop'&&job.status==='active')){if(this.treeHits.size)this.clearChopRecoil();return;}
    const indexed=readSceneResourceFrame(frame,world);
    if(!indexed&&this.treeCellsPending){
      const pending=this.treeCellsPending;this.treeCells.clear();
      for(const resource of pending.resources)if(resource.kind==='tree'&&!isResidentCrop(resource)&&!isClusterPlantSpecies(resource.species))
        this.treeCells.set(resource.z*pending.width+resource.x,resource.id);
      this.treeCellsPending=undefined;
    }
    const previousJobs=new Map(previous.jobs.map(job=>[job.id,job]));
    const previousPawns=new Map(previous.pawns.map(pawn=>[pawn.id,pawn]));
    const workingTrees=new Set<number>();
    for(const job of world.jobs){
      if(job.kind!=='chop'||job.reservedBy===null||job.status!=='active')continue;
      const pawn=world.pawns.find(candidate=>candidate.id===job.reservedBy);
      const oldPawn=previousPawns.get(job.reservedBy),oldJob=previousJobs.get(job.id);
      const cell=job.z*world.width+job.x,treeId=indexed?indexed.treeAt(cell):this.treeCells.get(cell);
      if(treeId===undefined||!pawn||pawn.jobId!==job.id||pawn.state!=='working'||pawn.stun)continue;
      workingTrees.add(treeId);
      if(!oldJob||oldJob.kind!=='chop'||oldJob.reservedBy!==pawn.id||!oldPawn||oldPawn.jobId!==job.id||oldPawn.state!=='working'||workProgress(job)<=workProgress(oldJob))continue;
      const phase=pawn.id*1.7-1.5*Math.PI;
      const priorCycle=Math.floor((11*previous.tick/TICKS_PER_SECOND+phase)/(2*Math.PI));
      const cycle=Math.floor((11*world.tick/TICKS_PER_SECOND+phase)/(2*Math.PI));
      if(cycle<=priorCycle)continue;
      const at=(cycle*2*Math.PI-phase)/11;
      const dx=job.x-pawn.x,dz=job.z-pawn.z,length=Math.hypot(dx,dz)||1;
      const priorHit=this.treeHits.get(treeId);
      const held=!!priorHit&&!!this.detail&&this.detail.classify(job.x,0,job.z)===2;
      if(priorHit&&!held)this.poseTree(treeId,priorHit,0);
      // The first positive lobe leans away from the worker, as if struck.
      this.treeHits.set(treeId,{at,x:job.x,z:job.z,axisX:dz/length,axisZ:-dx/length,
        angle:held?priorHit!.angle:0,sample:held?priorHit!.sample:undefined,pendingPose:held});
    }
    for(const [id,hit] of this.treeHits)if(!workingTrees.has(id)){
      this.poseTree(id,hit,0);this.treeHits.delete(id);
    }
  }

  /** The same confirmed presentation clock as the pawn arm controls recoil. */
  presentChop(timeSeconds:number):void {
    for(const [id,hit] of this.treeHits){
      let sampleSeconds=timeSeconds;
      if(this.detail){
        hit.sample??=this.detail.createHandle();
        const due=this.detail.shouldSample(hit.sample,hit.x,0,hit.z);
        if(hit.sample.level===2){if(hit.angle!==0)this.poseTree(id,hit,0);if(timeSeconds-hit.at>=CHOP_RECOIL_SECONDS)this.treeHits.delete(id);continue;}
        if(!due&&hit.sample.level!==1)continue;
      }
      const angle=chopRecoilAngle(sampleSeconds-hit.at);
      if(angle!==hit.angle||hit.pendingPose){this.poseTree(id,hit,angle);hit.pendingPose=false;}
      if(sampleSeconds-hit.at>=CHOP_RECOIL_SECONDS)this.treeHits.delete(id);
    }
  }

  clearChopRecoil():void {
    for(const [id,hit] of this.treeHits)this.poseTree(id,hit,0);
    this.treeHits.clear();
  }

  private poseTree(id:number,hit:TreeHit,angle:number):void {
    const parts=this.treeParts.get(id);if(!parts)return;
    const sine=Math.sin(angle),cosine=Math.cos(angle),complement=1-cosine;
    for(const {mesh,range,positions,normals,expansions,brush,upload} of parts){
      const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const normal=mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
      const out=position.array as Float32Array,outNormal=normal.array as Float32Array;
      const expand=mesh.geometry.getAttribute('origamiWearExpand') as THREE.BufferAttribute|undefined;
      const currentBrush=resourceBrushData(mesh.geometry);
      for(let vertex=range.vertexStart;vertex<range.vertexStart+range.vertexCount;vertex++){
        const i=vertex*3;
        const x=positions[i]!-hit.x,y=positions[i+1]!,z=positions[i+2]!-hit.z;
        const dot=hit.axisX*x+hit.axisZ*z;
        out[i]=hit.x+x*cosine-hit.axisZ*y*sine+hit.axisX*dot*complement;
        out[i+1]=y*cosine+(hit.axisZ*x-hit.axisX*z)*sine;
        out[i+2]=hit.z+z*cosine+hit.axisX*y*sine+hit.axisZ*dot*complement;
        const nx=normals[i]!,ny=normals[i+1]!,nz=normals[i+2]!,normalDot=hit.axisX*nx+hit.axisZ*nz;
        outNormal[i]=nx*cosine-hit.axisZ*ny*sine+hit.axisX*normalDot*complement;
        outNormal[i+1]=ny*cosine+(hit.axisZ*nx-hit.axisX*nz)*sine;
        outNormal[i+2]=nz*cosine+hit.axisX*ny*sine+hit.axisZ*normalDot*complement;
        if(expand&&expansions){
          const ex=expansions[i]!,ey=expansions[i+1]!,ez=expansions[i+2]!,dot=hit.axisX*ex+hit.axisZ*ez;
          expand.array[i]=ex*cosine-hit.axisZ*ey*sine+hit.axisX*dot*complement;
          expand.array[i+1]=ey*cosine+(hit.axisZ*ex-hit.axisX*ez)*sine;
          expand.array[i+2]=ez*cosine+hit.axisX*ey*sine+hit.axisZ*dot*complement;
        }
        if(currentBrush&&brush){
          for(const key of ['base','width','rough'] as const){const translated=key==='base',bx=brush[key][i]!-(translated?hit.x:0),by=brush[key][i+1]!,bz=brush[key][i+2]!-(translated?hit.z:0),dot=hit.axisX*bx+hit.axisZ*bz;
            currentBrush[key][i]=(translated?hit.x:0)+bx*cosine-hit.axisZ*by*sine+hit.axisX*dot*complement;currentBrush[key][i+1]=by*cosine+(hit.axisZ*bx-hit.axisX*bz)*sine;currentBrush[key][i+2]=(translated?hit.z:0)+bz*cosine+hit.axisX*by*sine+hit.axisZ*dot*complement;
          }
        }
      }
      if(currentBrush)this.graphicsStyle?.refreshBrushGeometry(mesh.geometry,range.vertexStart,range.vertexCount);
      // Reuse the range descriptor: WebGPU uploads only this tree's vertices,
      // instead of the whole 64-cell chunk on every animated frame.
      upload.start=range.vertexStart*3;upload.count=range.vertexCount*3;
      // A hidden or camera-culled chunk may not upload this frame. Keep only
      // its latest pending range, rather than accumulating one per RAF.
      if(!position.updateRanges.includes(upload))position.updateRanges.push(upload);
      if(!normal.updateRanges.includes(upload))normal.updateRanges.push(upload);
      if(expand&&!expand.updateRanges.includes(upload))expand.updateRanges.push(upload);
      position.needsUpdate=true;normal.needsUpdate=true;
      if(expand)expand.needsUpdate=true;
      this.compiledAttributeChanged435?.(position,upload.start,upload.count);this.compiledAttributeChanged435?.(normal,upload.start,upload.count);
      if(expand)this.compiledAttributeChanged435?.(expand,upload.start,upload.count);
    }
    hit.angle=angle;
  }

  private refreshTreeBases(ids:readonly number[]):void {
    const copies=new Map<ResourceObject,Float32Array>(),expansions=new Map<ResourceObject,Float32Array>(),brushes=new Map<ResourceObject,ResourceBrushData>();
    for(const id of ids)for(const part of this.treeParts.get(id)??[]){
      let positions=copies.get(part.mesh);
      if(!positions){positions=new Float32Array((part.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array);copies.set(part.mesh,positions);}
      part.positions=positions;
      const expand=part.mesh.geometry.getAttribute('origamiWearExpand');
      if(expand){let copy=expansions.get(part.mesh);if(!copy){copy=new Float32Array(expand.array as Float32Array);expansions.set(part.mesh,copy);}part.expansions=copy;}
      const brush=resourceBrushData(part.mesh.geometry);if(brush){let copy=brushes.get(part.mesh);if(!copy){copy={base:brush.base.slice(),width:brush.width.slice(),rough:brush.rough.slice()};brushes.set(part.mesh,copy);}part.brush=copy;}
    }
  }
  update(world: World, newMap: boolean, changes?: ReadonlyMap<number,NaturalPresentationChange>,frame?:SceneResourceFrame,appearance?:NaturalAppearanceReader): void {
    const size=(r:World['resources'][number])=>appearance?.read(r).size??floraSize(world,r);
    const ripe=(r:World['resources'][number])=>appearance?appearance.harvestable(r):harvestable(world,r);
    const leafless=(r:World['resources'][number])=>appearance?.read(r).leafless??plantLeafless(world,r);
    // ColonyRenderer configures the shared materials after constructing this
    // layer. Copy its lighting node before the first tree shader is compiled.
    const plainOutput=this.staticMaterial.outputNode;
    const texturedOutput=this.texturedMaterial.outputNode;
    if(this.windPlain.outputNode!==plainOutput)this.windPlain.outputNode=plainOutput;
    if(this.windTextured.outputNode!==texturedOutput)this.windTextured.outputNode=texturedOutput;
    for(const material of [this.origamiPlain,this.origamiTextured,this.linePlain,this.lineWind,this.wearPlain,this.wearWind])if(material){
      const source=material===this.origamiPlain?this.staticMaterial:this.texturedMaterial;
      material.outputNode=source.outputNode;
      material.maskShadowNode=source.maskShadowNode;
      const original=material.userData.referenceOriginalMask as THREE.Node<'bool'>|undefined;
      if(material.userData.referenceMaskSource!==source.maskNode){
        material.maskNode=source.maskNode?(original?new THREE.OperatorNode('&&',source.maskNode,original):source.maskNode):original??null;
        material.userData.referenceMaskSource=source.maskNode;material.needsUpdate=true;
      }
    }
    this.windPlain.maskNode=this.bodyPlain.maskNode;this.windTextured.maskNode=this.bodyTextured.maskNode;
    this.windPlain.maskShadowNode=this.bodyPlain.maskShadowNode;this.windTextured.maskShadowNode=this.bodyTextured.maskShadowNode;
    if (newMap) { this.middleWind.reset();this.clearTargetPreview();clearGroup(this.group); this.chunks.clear(); this.resourceChunks.clear(); this.growing.clear(); this.treeParts.clear(); this.treeHits.clear(); }
    const indexed=readSceneResourceFrame(frame,world);
    if(indexed)this.treeCellsPending=world;
    else{
      this.treeCellsPending=undefined;this.treeCells.clear();
      for(const resource of world.resources)if(resource.kind==='tree')this.treeCells.set(resource.z*world.width+resource.x,resource.id);
    }
    let chunks:ReadonlyMap<string,readonly World['resources'][number][]>;
    const partial=!!changes&&!newMap;
    const affected=new Set<string>(),nextKeys=new Map<number,string|undefined>();
    if (partial) {
      for (const [id,change] of changes) {
        const oldKey=this.resourceChunks.get(id);
        if(oldKey)affected.add(oldKey);
        const resource=change.resource;
        const key=resource&&!isResidentCrop(resource)&&!isClusterPlantSpecies(resource.species)
          ?`${Math.floor(resource.x/WORLD_SCALE.resourceChunkSize)}:${Math.floor(resource.z/WORLD_SCALE.resourceChunkSize)}`:undefined;
        nextKeys.set(id,key);
        if(key)affected.add(key);
        this.growing.delete(id);
        if(resource?.kind==='berries'&&!ripe(resource))this.growing.set(id,resource);
      }
      if(!affected.size)return;
    } else {
      this.growing.clear();
      this.resourceChunks.clear();
    }
    const indexedChunks=indexed?.chunksFor(partial?changes:undefined,partial?affected:undefined);
    if(indexedChunks){
      const collected=new Map<string,readonly World['resources'][number][]>();
      for(const chunk of indexedChunks.changedChunks){
        collected.set(chunk.key,chunk.resources);
        if(!partial)for(const resource of chunk.resources){
          this.resourceChunks.set(resource.id,chunk.key);
          if(resource.kind==='berries'&&!ripe(resource))this.growing.set(resource.id,resource);
        }
      }
      chunks=collected;
    }else{
      const collected=new Map<string,World['resources']>();
      // Visit the world in its original order so ranges inside a changed chunk
      // remain identical to a complete update, even after deletion or movement.
      for (const resource of world.resources) {
        if(!partial&&(isResidentCrop(resource)||isClusterPlantSpecies(resource.species)))continue;
        const key=partial
          ?nextKeys.has(resource.id)?nextKeys.get(resource.id):this.resourceChunks.get(resource.id)
          :`${Math.floor(resource.x/WORLD_SCALE.resourceChunkSize)}:${Math.floor(resource.z/WORLD_SCALE.resourceChunkSize)}`;
        if(!key||partial&&!affected.has(key))continue;
        if(!partial)this.resourceChunks.set(resource.id,key);
        const chunk=collected.get(key);
        if(chunk)chunk.push(resource);else collected.set(key,[resource]);
        if(!partial&&resource.kind==='berries'&&!ripe(resource))this.growing.set(resource.id,resource);
      }
      chunks=collected;
    }
    if(partial)for(const [id,key] of nextKeys) {
      if(key)this.resourceChunks.set(id,key);else this.resourceChunks.delete(id);
    }
    for (const [key, previous] of this.chunks) if ((!partial||affected.has(key))&&!chunks.has(key) && previous.signature !== '') {
      retainResources(previous.group, new Set()); previous.visibleKeys.clear(); previous.signature = '';
      for(const id of previous.treeIds){this.treeParts.delete(id);this.treeHits.delete(id);}
      previous.treeIds=[];
    }
    for (const [key, chunk] of chunks) {
      const signature=chunk.map(resource=>`${resource.id}:${resourceIdentity(world,resource)}:${size(resource)}:${resource.kind==='berries'&&ripe(resource)?1:0}:${leafless(resource)}`).join('|');
      const previous = this.chunks.get(key);
      if (previous?.signature === signature) continue;
      const sizes=new Map(chunk.map(resource=>[resource.id,size(resource)]));
      const visibleKeys=new Set(chunk.flatMap(r=>visibleResourceKeys(world,r,appearance)));
      if (previous && chunk.every(r => previous.identities.get(r.id) === resourceIdentity(world,r))) {
        const treeSizeChanged=previous.treeIds.some(id=>previous.currentSizes.get(id)!==sizes.get(id));
        if(treeSizeChanged)this.clearChopRecoil();
        resizeResources(world,previous.group,new Map(chunk.map(resource=>[resource.id,resource])),previous.originalSizes,previous.currentSizes,sizes,this.rangeBounds,this.graphicsStyle);
        if(treeSizeChanged)this.refreshTreeBases(previous.treeIds);
        // Growth changes vertex positions, not the selected original ranges.
        // Keep their index version stable until actual membership changes;
        // otherwise the static compiler remaps/uploads the same triangles.
        if(visibleKeys.size!==previous.visibleKeys.size||[...visibleKeys].some(id=>!previous.visibleKeys.has(id))){
          retainResources(previous.group,visibleKeys);previous.visibleKeys=visibleKeys;
        }
        previous.signature = signature; continue;
      }
      if(previous)for(const id of previous.treeIds)this.treeParts.delete(id);
      const group = previous?.group ?? new THREE.Group();
      if (previous) {this.targetTint.restore(group);clearGroup(group);} else this.group.add(group);
      group.name = `Resources ${key}`;
      const trunks: Placement[] = [], crowns: Placement[] = [], upperCrowns: Placement[] = [];
      const rocks: Placement[] = [], bushes: Placement[] = [], berries: Placement[] = [];
      const cones:Placement[]=[],blades:Placement[]=[],cacti:Placement[]=[];
      const origamiParts=this.referenceFlora?.createBatch();
      for (const resource of chunk) {
        const { x, z } = resource;
        const parts = [trunks, crowns, upperCrowns, rocks, bushes, berries];
        const lengths = parts.map(items => items.length);
        const n = noise(x, z, 77), turn = n * Math.PI * 2;
        if(origamiParts?.append(world,resource,turn,size(resource)))continue;
        if(resource.species||isMedicinalPlant(resource)){appendFlora({trunks,crowns,cones,blades,cacti,bushes,fruit:berries},world,resource,turn,size(resource));continue;}
        if (resource.kind === 'tree') {
          const height = WORLD_SCALE.treeMinHeight + n * (WORLD_SCALE.treeMaxHeight - WORLD_SCALE.treeMinHeight);
          const radius = 0.8 + n * 0.32;
          const broadleaf=world.site!==undefined;
          trunks.push({ x, y: height * 0.25, z, sx: 1.1, sy: height * 0.5, sz: 1.1, ry: turn });
          crowns.push({ x, y: height * (broadleaf?.62:.53), z, sx: radius, sy: height * (broadleaf?.21:.35), sz: radius, ry: turn, color: n > 0.65 ? 0x657d56 : 0x526e50 });
          upperCrowns.push({ x, y: height * (broadleaf?.83:.70), z, sx: radius * .72, sy: height * (broadleaf?.14:.34), sz: radius * .72, ry: turn + .3, color: n > .65 ? 0x81925b : 0x688557 });
        } else if (resource.kind === 'rock') {
          rocks.push({ x: x - 0.1, y: 0.3, z, sx: 0.46 + n * 0.14, sy: 0.35 + n * 0.15, sz: 0.43, ry: turn, color: resource.stone ? stoneColor(resource.stone) : 0x92998d, pigment:'stone' });
          rocks.push({ x: x + 0.3, y: 0.15, z: z + 0.2, sx: 0.25, sy: 0.24, sz: 0.25, ry: -turn, color: resource.stone ? stoneColor(resource.stone) : 0xa8ad9c, pigment:'stone' });
        } else {
          trunks.push({x,y:.13,z,sx:.6,sy:.28,sz:.6,ry:turn});
          bushes.push({ x, y: 0.3, z, sx: 0.44, sy: 0.39, sz: 0.4, ry: turn, color: 0x697b55 });
          for (let i = 0; i < 5; i++) {
            const angle = i * 2.4 + turn;
            berries.push({ x: x + Math.sin(angle) * 0.25, y: 0.42 + (i % 2) * 0.09, z: z + Math.cos(angle) * 0.25 });
          }
        }
        parts.forEach((items, i) => { for (let j = lengths[i]!; j < items.length; j++) items[j]!.key = i === 5 ? -resource.id*2-1 : i===4 ? -resource.id*2 : resource.id; });
      }
      for (const trunk of trunks) trunk.color ??= 0x70573e;
      for (const berry of berries) berry.color = 0xb96f63;
      if(this.graphicsStyle?.origami)for(const items of [trunks,crowns,upperCrowns,rocks,bushes,berries,cones,blades,cacti])for(const item of items)item.profile??=GENERIC_REFERENCE_PROFILE;
      const origamiBodies=origamiParts?.parts(false)??[],origamiCanopies=origamiParts?.parts(true)??[];
      const fallbackBodies=[
        { geometry: new THREE.CylinderGeometry(0.1, 0.16, 1, 5), items: trunks },
        { geometry: new THREE.DodecahedronGeometry(1, 0), items: rocks },
        { geometry: new THREE.BoxGeometry(1,1,1), items: blades },
        { geometry: new THREE.CylinderGeometry(.5,.5,1,5), items: cacti },
        { geometry: new THREE.IcosahedronGeometry(1, 0), items: bushes },
        { geometry: new THREE.IcosahedronGeometry(0.055, 0), items: berries },
      ];
      const fallbackCanopies=[{geometry:world.site?new THREE.IcosahedronGeometry(1,0):new THREE.ConeGeometry(1,1,6),items:[...crowns,...upperCrowns]},{geometry:new THREE.ConeGeometry(1,1,6),items:cones}];
      const makeBrushParts=(parts:readonly {geometry:THREE.BufferGeometry;items:Placement[]}[])=>parts.filter(part=>part.items.length>0).map(part=>({geometry:createOrigamiBrushGeometry(part.geometry),items:part.items}));
      const bodyBrushParts=this.graphicsStyle?.origami?makeBrushParts([...fallbackBodies,...origamiBodies]):[],canopyBrushParts=this.graphicsStyle?.origami?makeBrushParts([...fallbackCanopies,...origamiCanopies]):[];
      mergedInstances(group,[...fallbackBodies,...origamiBodies],this.texturesEnabled?this.bodyTextured:this.bodyPlain,true,true,this.graphicsStyle?.origami===true);
      const canopy=mergedInstances(group,[...fallbackCanopies,...origamiCanopies],this.texturesEnabled?this.bodyTextured:this.bodyPlain,true,true,this.graphicsStyle?.origami===true);
      if (canopy) { canopy.name = 'tree-canopy'; canopy.visible = this.foliageVisible; }
      if(origamiParts)for(const isCanopy of [false,true]){
        const lineBody=mergedInstances(group,isCanopy?canopyBrushParts:bodyBrushParts,this.linePlain!,false,true,true);
        if(lineBody){
          const lines=lineBody;
          lines.matrixAutoUpdate=false;lines.userData.referenceCompanion='lines';
          if(isCanopy){lines.name='tree-canopy';lines.visible=this.foliageVisible;}
          lines.userData.origamiOwnerVisible=!isCanopy||this.foliageVisible;lines.userData.origamiTexturesEnabled=this.texturesEnabled;
          const releaseBrush=this.graphicsStyle!.prepareBrushGeometry(lines.geometry),releaseEdge=this.graphicsStyle!.trackEdgeObject(lines,'line');
          lines.userData.origamiEdgeCleanup=()=>{releaseEdge();releaseBrush();};
          lines.geometry.computeBoundingSphere();lines.geometry.boundingSphere!.radius+=.5;lines.geometry.userData.referenceBrushConservativeSphere=lines.geometry.boundingSphere!.clone();
        }
        const wear=mergedInstances(group,origamiParts.parts(isCanopy,'wear'),this.wearPlain!,false,true,true);
        if(wear){
          wear.userData.referenceCompanion='wear';wear.receiveShadow=true;
          // The shader expands the stored base by at most 0.115 source units;
          // reserve a conservative margin even for non-tree shrubs.
          if(wear.geometry.boundingSphere)wear.geometry.boundingSphere.radius+=.5;
          if(isCanopy){wear.name='tree-canopy';wear.visible=this.foliageVisible;}
          wear.userData.origamiOwnerVisible=!isCanopy||this.foliageVisible;wear.userData.origamiTexturesEnabled=this.texturesEnabled;
          wear.userData.origamiEdgeCleanup=this.graphicsStyle!.trackEdgeObject(wear,'wear');
        }
      }
      retainResources(group,visibleKeys);
      const trees=new Map(chunk.filter(r=>r.kind==='tree').map(r=>[r.id,r] as const));
      const treeIds=[...trees.keys()],treeSet=new Set(treeIds);
      for(const object of group.children){
        const mesh=object as ResourceObject,source=mesh.userData.resourceRanges as ResourceRangeData|undefined;
        if(!source)continue;
        const [chunkX,chunkZ]=key.split(':').map(Number);
        const east=chunkX!*WORLD_SCALE.resourceChunkSize+WORLD_SCALE.resourceChunkSize*.5>=world.width*.5,south=chunkZ!*WORLD_SCALE.resourceChunkSize+WORLD_SCALE.resourceChunkSize*.5>=world.height*.5;
        const quadrant=south?(east?3:2):(east?1:0);
        if(mesh instanceof THREE.Mesh&&!mesh.userData.referenceCompanion)setStaticSceneSource435(mesh,`resource:${key}:${mesh===canopy?'canopy':'body'}`,quadrant);
        const retained=ResourceRangeBounds.capture((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array,source.ranges);
        if(retained)this.rangeBounds.set(mesh.geometry,retained);
        const ranges=source.ranges.filter(range=>treeSet.has(rangeResourceId(range.id)));
        if(!ranges.length)continue;
        const normals=new Float32Array((mesh.geometry.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array);
        const expand=mesh.geometry.getAttribute('origamiWearExpand');
        const expansions=expand?new Float32Array(expand.array as Float32Array):undefined;
        for(const range of ranges){
          const id=rangeResourceId(range.id),parts=this.treeParts.get(id)??[];
          parts.push({mesh,range,positions:source.originalPositions,normals,expansions,brush:source.originalBrush,upload:{start:range.vertexStart*3,count:range.vertexCount*3}});this.treeParts.set(id,parts);
        }
        if(!ranges.some(range=>trees.has(rangeResourceId(range.id))))continue;
        // Tilted crowns remain inside the conservative camera/shadow bounds.
        if(mesh.geometry.boundingSphere)mesh.geometry.boundingSphere.radius+=4;
        if(resourceBrushData(mesh.geometry)&&mesh.geometry.boundingSphere)mesh.geometry.userData.referenceBrushConservativeSphere=mesh.geometry.boundingSphere.clone();
        const windRoot=new Float32Array((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).count*3);
        for(const range of ranges){
          const resource=trees.get(rangeResourceId(range.id));
          if(!resource)continue;
          const weight=resource.species==='saguaro'?.14:mesh.name==='tree-canopy'?1:.62;
          for(let vertex=range.vertexStart;vertex<range.vertexStart+range.vertexCount;vertex++){
            const offset=vertex*3;windRoot[offset]=resource.x;windRoot[offset+1]=resource.z;windRoot[offset+2]=weight;
          }
        }
        const windBasis=new Float32Array(windRoot.length/3*4),position=mesh.geometry.getAttribute('position');
        for(let vertex=0;vertex<position.count;vertex++){
          const rootPhase=windRoot[vertex*3]!*.47+windRoot[vertex*3+1]!*.31;
          const flutterPhase=position.getX(vertex)*1.3+position.getZ(vertex)*1.7;
          windBasis[vertex*4]=Math.sin(rootPhase);windBasis[vertex*4+1]=Math.cos(rootPhase);
          windBasis[vertex*4+2]=Math.sin(flutterPhase);windBasis[vertex*4+3]=Math.cos(flutterPhase);
        }
        mesh.geometry.setAttribute('windRoot',new THREE.BufferAttribute(windRoot,3));
        mesh.geometry.setAttribute('windBasis',new THREE.BufferAttribute(windBasis,4));
        mesh.material=mesh.userData.referenceCompanion==='lines'?this.lineWind!:mesh.userData.referenceCompanion==='wear'?this.wearWind!:this.texturesEnabled?this.windTextured:this.windPlain;
      }
      for(const id of treeIds){const hit=this.treeHits.get(id);if(hit)hit.angle=NaN;}
      this.chunks.set(key,{signature,group,identities:new Map(chunk.map(r=>[r.id,resourceIdentity(world,r)])),originalSizes:new Map(sizes),currentSizes:new Map(sizes),visibleKeys,treeIds});
      if(this.targetPreviewIds.size&&chunk.some(r=>this.targetPreviewIds.has(r.id)))this.targetTint.apply(group,this.targetPreviewIds);
    }
  }

}
