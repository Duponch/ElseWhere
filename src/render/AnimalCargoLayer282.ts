import * as THREE from 'three/webgpu';
import type {ItemId} from '../sim/items';
import type {MaterialPile,World} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import {isSchema282OrLater} from '../sim/schema-compatibility-257';
import {animalCoreProfile,animalParts} from './animal-shape';
import {actorExplorationMaterial256} from './ExplorationMask256';
import {itemGeometry} from './item-presentation';
import {placementGeometry} from './item-portrait';
import type {MotionTimeline} from './MotionTimeline';
import {createSurfaceMaterial} from './SurfaceMaterials';
import {treeCargoKind} from './tree-presentation';
import {WildlifeBodyScale} from './wildlife-frame-state';
import type {WildlifeLayer} from './WildlifeLayer';
import {currentGraphicsStyle} from './graphics-style';
import {attribute} from 'three/tsl';
import {OwnedStrokeModel} from './surfaces/OwnedStrokeModel';
import {MutableFaceStrokeBank,type FaceStrokeBankRegion} from './surfaces/MutableFaceStrokeBank';
import {naturalStroke,SURFACE_STROKE_FACE} from './surfaces/NaturalSurfaceModels';
import {bestiaryAnimalCargoBack,bestiaryAnimalCargoTorso} from './origami/bestiary-registry';
import {compiledCargoBackPoint,fitAnimalCargoBack,type CompiledAnimalCargoBack} from './origami/animal-cargo-back';

type CargoMesh=THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshLambertNodeMaterial>;
type Member={animal:WildAnimal;scale:number;back:Back|CompiledAnimalCargoBack;shown?:boolean;last?:readonly [number,number,number,number,boolean]};
type Batch={mesh:CargoMesh;model:OwnedStrokeModel;region:FaceStrokeBankRegion;capacity:number;members:Member[];width:number;depth:number;backs:Map<string,CompiledAnimalCargoBack>};
type Back={y:number;z:number;width:number;depth:number;bodyCenter:number;restFloor:number};
/** Read-only presentation projection. Tests/previews can supply the actual
 * inventory/actor records without inventing an Engine or a complete World. */
export type AnimalCargoSnapshot282=Pick<World,'schemaVersion'|'wildlife'|'piles'>;
const backs=new Map<string,Back>();
function isCompiledBack(back:Back|CompiledAnimalCargoBack):back is CompiledAnimalCargoBack{return Array.isArray(back);}

function backFor(species:string):Back {
 let back=backs.get(species);if(back)return back;
 const rings=animalCoreProfile(species).rings.filter(r=>r.headWeight===0);
 const ring=rings.reduce((closest,r)=>Math.abs(r.z)<Math.abs(closest.z)?r:closest,rings[0]!);
 const halfWidth=Math.max(...rings.map(r=>r.halfWidth));
 back={y:ring.top,z:ring.z,width:ring.halfWidth*1.8,depth:Math.max(.15,(Math.max(...rings.map(r=>r.z))-Math.min(...rings.map(r=>r.z)))*.6),bodyCenter:animalParts(species)[0]!.center[1],restFloor:.025+halfWidth};
 backs.set(species,back);return back;
}

/** Original ground/portrait triangles, copied once per resident item variant.
 * Shared placement geometries belong to their existing cache, not this layer.
 * Quantity changes geometry only at adoption; no HP/quality or ground owner is
 * invented for the real inventory Thing. */
function carriedGeometry(item:ItemId,quantity:number,tree?:MaterialPile['innerResource']):THREE.BufferGeometry {
 const vertices:number[]=[],transform=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
 const rotation=new THREE.Quaternion(),point=new THREE.Vector3(),normal=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
 for(const p of itemGeometry(item,quantity,undefined,tree)){
  const source=placementGeometry(p),positions=source.getAttribute('position'),normals=source.getAttribute('normal'),index=source.getIndex(),tint=new THREE.Color(p.color??0xb8ac96);
  rotation.setFromAxisAngle(axis,p.ry??0);transform.compose(new THREE.Vector3(p.x,p.y,p.z),rotation,new THREE.Vector3(p.sx??1,p.sy??1,p.sz??1));normalMatrix.getNormalMatrix(transform);
  for(let i=0;i<(index?.count??positions.count);i++){
   const vertex=index?index.getX(i):i;
   point.fromBufferAttribute(positions,vertex).applyMatrix4(transform);normal.fromBufferAttribute(normals,vertex).applyMatrix3(normalMatrix).normalize();
   vertices.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,tint.r,tint.g,tint.b);
  }
 }
 const geometry=new THREE.BufferGeometry(),data=new THREE.InterleavedBuffer(new Float32Array(vertices),9);
 geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,3));geometry.setAttribute('color',new THREE.InterleavedBufferAttribute(data,3,6));
 if(vertices.length){geometry.computeBoundingBox();const b=geometry.boundingBox!;geometry.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);geometry.computeBoundingBox();}
 return geometry;
}

/** Actual Haul282 inventory only, never unrelated caravan freight. Membership
 * is reconciled on snapshots, with one instanced draw per resident item variant.
 * Only active carrier matrices are considered per frame. The original animal
 * root supplies travel/turn/LOD timing; the back attachment is a visual choice,
 * with no independent clock, shader, quantity label or simulation mutation. */
export class AnimalCargoLayer282 {
 readonly group=new THREE.Group();
 readonly stats={activeCargo:0,activeBatches:0,geometryBuilds:0,matrixUploads:0,attachmentBuilds:0};
 private readonly graphicsStyle=currentGraphicsStyle();
 private readonly material=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true});
 private readonly strokeBank=new MutableFaceStrokeBank();
 private readonly batches=new Map<string,Batch>();
 private readonly bodyScale=new WildlifeBodyScale();
 private readonly object=new THREE.Object3D();
 private active:Batch[]=[];
 private readonly warmup:Batch;
 constructor(configure?:(m:THREE.NodeMaterial)=>void){
  this.group.name='Animal cargo282 — real local inventory';
  configure?.(actorExplorationMaterial256(this.material));
  this.material.vertexColors=false;const publishStroke=()=>{this.material.colorNode=naturalStroke(this.graphicsStyle,this.strokeBank)(attribute('color','vec3'));};this.strokeBank.setPreparedRepresentationPublisher(()=>{publishStroke();this.material.needsUpdate=true;});publishStroke();
  // Zero-size instance compiles the same attribute/material pipeline under the
  // loading overlay even when no animal has acquired a carried item yet.
  this.warmup=this.makeBatch(carriedGeometry('wood',1),1);this.warmup.mesh.name='Animal cargo282 — pipeline preparation';
  this.object.scale.setScalar(0);this.object.updateMatrix();this.warmup.mesh.setMatrixAt(0,this.object.matrix);
 }
 private makeBatch(source:THREE.BufferGeometry,capacity:number):Batch {
  const model=new OwnedStrokeModel(source);let region:FaceStrokeBankRegion|undefined,geometry:THREE.BufferGeometry|undefined,mesh:CargoMesh|undefined;
  try{region=this.strokeBank.publish(model.stroke);geometry=model.geometry.clone();const faces=geometry.getAttribute(SURFACE_STROKE_FACE);
   for(let vertex=0;vertex<faces.count;vertex++)faces.setX(vertex,faces.getX(vertex)+region.faceOffset);
   geometry.setAttribute('aTo',new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage));
   mesh=new THREE.InstancedMesh(geometry,this.material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;
   this.group.add(mesh);const b=geometry.boundingBox;return {mesh,model,region,capacity,members:[],width:b?Math.max(.001,b.max.x-b.min.x):1,depth:b?Math.max(.001,b.max.z-b.min.z):1,backs:new Map()};
  }catch(error){mesh?.removeFromParent();mesh?.dispose();geometry?.dispose();region?.release();model.dispose();throw error;}
 }
 private referenceBack(batch:Batch,species:string):CompiledAnimalCargoBack|undefined {
  const cached=batch.backs.get(species);if(cached)return cached;
  const base=bestiaryAnimalCargoBack(species),torso=bestiaryAnimalCargoTorso(species);if(!base||!torso)return;
  const fitted=fitAnimalCargoBack(base,torso,batch.width,batch.depth);if(!fitted)return;
  batch.backs.set(species,fitted);this.stats.attachmentBuilds++;return fitted;
 }
 private disposeBatch(batch:Batch):void {batch.region.release();batch.mesh.removeFromParent();batch.mesh.dispose();batch.mesh.geometry.dispose();batch.model.dispose();}
 update(world:AnimalCargoSnapshot282,_timeline?:MotionTimeline,reset=false):void {
  if(reset){for(const batch of this.batches.values())this.disposeBatch(batch);this.batches.clear();this.active=[];}
  for(const batch of this.active){batch.members=[];batch.mesh.count=0;batch.mesh.visible=false;}
  this.active=[];this.stats.activeCargo=0;
  if(isSchema282OrLater(world.schemaVersion)){
   const carriers=new Map<number,WildAnimal>();
   for(const animal of world.wildlife?.animals??[]){const task=animal.haul;if(animal.domestic&&animal.state!=='dead'&&task&&task.phase!=='pickup'&&task.carryPileId!==null)carriers.set(task.carryPileId,animal);}
   // No all-piles lookup is repeated by present(), and ownership is checked
   // against both the original actor and its confirmed task reference.
   for(const pile of world.piles){
    const animal=carriers.get(pile.id);if(!animal||pile.owner.type!=='inventory'||pile.owner.pawnId!==animal.id||pile.quantity<=0)continue;
    const key=`${pile.item}:${pile.quantity}:${pile.item==='minified-tree'?treeCargoKind(pile.innerResource):0}`;
    let batch=this.batches.get(key);
    if(!batch){const geometry=carriedGeometry(pile.item,pile.quantity,pile.innerResource);if(!geometry.getAttribute('position').count){geometry.dispose();continue;}
     batch=this.makeBatch(geometry,1);batch.mesh.name=`Animal cargo282 — ${pile.item}`;this.batches.set(key,batch);this.stats.geometryBuilds++;}
    if(!batch.members.length)this.active.push(batch);
    const back=this.referenceBack(batch,animal.species)??backFor(animal.species),width=isCompiledBack(back)?back[3]:back.width,depth=isCompiledBack(back)?back[4]:back.depth;
    const scale=this.bodyScale.read(animal)*Math.min(1,width/batch.width,depth/batch.depth);
    batch.members.push({animal,scale,back});this.stats.activeCargo++;
   }
  }
  for(const batch of this.active){
   if(batch.members.length>batch.capacity){
    const previous=batch.mesh,geometry=previous.geometry.clone(),capacity=2**Math.ceil(Math.log2(batch.members.length));
    geometry.setAttribute('aTo',new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage));
    const mesh=new THREE.InstancedMesh(geometry,this.material,capacity);mesh.name=previous.name;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;
    this.group.add(mesh);previous.removeFromParent();previous.dispose();previous.geometry.dispose();batch.mesh=mesh;batch.capacity=capacity;
   }
   batch.mesh.count=batch.members.length;
   const owner=batch.mesh.geometry.getAttribute('aTo') as THREE.InstancedBufferAttribute;
   batch.members.forEach(({animal},i)=>owner.setXYZW(i,animal.x,0,animal.z,0));owner.needsUpdate=true;
  }
  // Quantity/tree variants stay resident across ordinary handoffs. Inactive
  // variants alone are evicted, bounding a long campaign's retained geometry.
  for(const [key,batch] of this.batches){if(this.batches.size<=64)break;if(!batch.members.length){this.disposeBatch(batch);this.batches.delete(key);}}
  this.stats.activeBatches=this.active.length;
 }
 present(wildlife:Pick<WildlifeLayer,'cpuPoseForId'>):boolean {
  let changed=false;
  for(const batch of this.active){
   let dirty=false;
   batch.members.forEach((member,i)=>{
    const {animal,scale,back}=member,pose=wildlife.cpuPoseForId(animal.id),last=member.last;
    if(!pose){if(member.shown!==false){this.object.scale.setScalar(0);this.object.updateMatrix();batch.mesh.setMatrixAt(i,this.object.matrix);member.shown=false;dirty=true;}return;}
    const resting=animal.state==='downed'||animal.state==='sleeping',growth=this.bodyScale.read(animal);
    let px:number,py:number,pz:number;
    if(isCompiledBack(back)){
     compiledCargoBackPoint(back,pose,growth,resting,this.object.position);px=this.object.position.x;py=this.object.position.y;pz=this.object.position.z;
    }else{
     // Keep Default and the protected eleven-reference attachment arithmetic.
     const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw),x=resting?(back.bodyCenter-back.y-.025)*growth:0,z=back.z*growth;
     px=pose.x+x*c+z*s;py=pose.y+(resting?back.restFloor:back.y+.025)*growth;pz=pose.z+z*c-x*s;
    }
    if(member.shown&&last&&last[0]===px&&last[1]===py&&last[2]===pz&&last[3]===pose.yaw&&last[4]===resting)return;
    this.object.position.set(px,py,pz);this.object.rotation.set(0,pose.yaw,resting?Math.PI/2:0);this.object.scale.setScalar(scale);this.object.updateMatrix();
    batch.mesh.setMatrixAt(i,this.object.matrix);member.shown=true;member.last=[px,py,pz,pose.yaw,resting];dirty=true;this.stats.matrixUploads++;
   });
   if(dirty){batch.mesh.instanceMatrix.needsUpdate=true;changed=true;}
   if(!batch.mesh.visible){batch.mesh.visible=true;changed=true;}
  }
  return changed;
 }
 prepareForCompile():()=>void {
  const mesh=this.warmup.mesh;mesh.count=1;mesh.visible=true;
  return ()=>{mesh.count=0;mesh.visible=false;};
 }
 dispose():void {for(const batch of this.batches.values())this.disposeBatch(batch);this.batches.clear();this.active=[];this.disposeBatch(this.warmup);this.material.dispose();this.strokeBank.dispose();}
}
