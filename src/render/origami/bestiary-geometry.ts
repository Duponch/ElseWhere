// Additional bestiary compilation. The legacy eleven-reference branch remains
// separate. This consumes real anatomy/shape recipes, never World.
import * as THREE from 'three/webgpu';
import {animalCore256,isAnimalSpecies256} from '../../sim/animal-core-v256';
import {CORE_ANIMAL_BODIES_256} from '../../sim/animal-anatomy-data-v256';
import {animalPartId256,type AnimalBodyFact256} from '../../sim/animal-anatomy-v256';
import type {BodyPartId} from '../../sim/body-definition';
import {animalParts} from '../animal-shape';
import {corpseVisualPartBit} from '../corpse-presentation';
import {bodyBloodRegion} from '../body-blood-word-297';
import {createReferenceEdgeGeometry} from './reference-edges';
import {createRigBrushGeometry} from './rig-brush';
import {deriveAnimalCargoBack,cargoBackMetadata} from './animal-cargo-back';
import type {BestiaryGroup,BestiaryMesh,BestiaryMaterial,Triple} from './bestiary-types';

export const BESTIARY_NEW_SPECIES:Readonly<Record<string,string>>=Object.freeze({
 boomalope:'boomalope',boomrat:'boomrat',megasloth:'megasloth',megaspider:'megaspider',spelopede:'spelopede',warg:'warg',
 'grizzly-bear':'grizzly','polar-bear':'polar_bear',cougar:'cougar',panther:'panther',lynx:'lynx','timber-wolf':'timber_wolf','fennec-fox':'fennec',
 bison:'bison',yak:'yak',rhinoceros:'rhino',horse:'horse',donkey:'donkey',alpaca:'alpaca',caribou:'caribou',ibex:'ibex','wild-boar':'boar',
 ostrich:'ostrich',emu:'emu',cassowary:'cassowary',turkey:'turkey',duck:'duck',tortoise:'tortoise',iguana:'iguana',cobra:'cobra',
 capybara:'capybara',chinchilla:'chinchilla',raccoon:'raccoon',squirrel:'squirrel','guinea-pig':'guinea_pig',
});
const ADAPTED_SPECIES=new Set(['cat','megascarab','elk','arctic-fox','monkey','rat','arctic-wolf']);
const LEG_DEFS=new Set(['Leg','InsectLeg','BirdLeg','TurtleLeg']);
const FOOT_DEFS=new Set(['Paw','Hoof','Foot','Hand','BirdFoot','TurtleFoot','InsectClaw']);
export interface NativeSourcePart {
 readonly mesh:BestiaryMesh;readonly visualRole:string;readonly nativePart:BodyPartId;readonly nativeRecordIndex:number;
 readonly maskBit:number;readonly bloodRegion:number;readonly bone:number;readonly pivot:THREE.Vector3;readonly eyeMark:number;
 readonly sourceLimbOrdinal:number|null;readonly clinicalProjection:'exact'|'native-ancestor';
}
export interface BestiaryCompilationPlan {
 readonly species:string;readonly parts:readonly NativeSourcePart[];readonly scale:number;readonly floor:number;readonly bodyCenter:number;
 readonly referenceLength:number;readonly nativeLimbCount:number;readonly sourceLimbCount:number;readonly torsoBounds:THREE.Box3;
}
function belongs(object:THREE.Object3D,ancestor:THREE.Object3D|undefined):boolean {
 for(let node:THREE.Object3D|null=object;node;node=node.parent)if(node===ancestor)return true;return false;
}
function isMesh(object:THREE.Object3D):object is BestiaryMesh {return object instanceof THREE.Mesh&&object.material instanceof THREE.MeshBasicMaterial;}
function sideOf(object:THREE.Object3D):'left'|'right' {return object.getWorldPosition(new THREE.Vector3()).z>0?'left':'right';}
export function convertBestiaryPoint(point:THREE.Vector3,plan:Pick<BestiaryCompilationPlan,'scale'|'floor'>):THREE.Vector3 {
 return point.set(-point.z*plan.scale,(point.y-plan.floor)*plan.scale,point.x*plan.scale);
}

export function describeBestiaryAnimal(species:string,root:BestiaryGroup):BestiaryCompilationPlan {
 if(!Object.hasOwn(BESTIARY_NEW_SPECIES,species)&&!ADAPTED_SPECIES.has(species))throw Error('Protected or unbound species cannot enter new compilation: '+species);
 if(!isAnimalSpecies256(species))throw Error('No native game anatomy: '+species);
 const body=animalCore256(species).race.body,rows:readonly AnimalBodyFact256[]=CORE_ANIMAL_BODIES_256[body],nativeShape=animalParts(species);
 const nativeRoot=rows.find(row=>row.parent===null);if(!nativeRoot)throw Error('No native body root');
 const nativeHead=rows.find(row=>['Head','HeadWithEarHoles','SnakeHead','TurtleHead','InsectHead'].includes(row.defId));
 if(!nativeHead)throw Error('No native head record: '+species);
 root.updateMatrixWorld(true);
 const sourceLimbs=root.userData.legs,nativeLimbs=rows.filter(row=>row.depth==='outside'&&(LEG_DEFS.has(row.defId)||row.defId==='Arm'));
 if(sourceLimbs.length!==nativeLimbs.length)throw Error(`Native/source limb mismatch ${species}: ${nativeLimbs.length}/${sourceLimbs.length}`);
 const limbRows=new Map<THREE.Object3D,AnimalBodyFact256>();
 for(const kind of ['leg','arm'] as const)for(const side of ['left','right'] as const){
  const native=nativeLimbs.filter(row=>(row.defId==='Arm'?'arm':'leg')===kind).filter((row,index)=>(row.side??(index%2===0?'left':'right'))===side);
  const source=sourceLimbs.filter(limb=>(String(limb.userData.referenceLimbKind??'leg').includes('arm')?'arm':'leg')===kind&&sideOf(limb)===side)
   .sort((a,b)=>b.getWorldPosition(new THREE.Vector3()).x-a.getWorldPosition(new THREE.Vector3()).x);
  if(native.length!==source.length)throw Error(`Sided ${kind} mismatch: ${species}/${side}`);
  source.forEach((limb,index)=>limbRows.set(limb,native[index]));
 }
 const torsoBounds=new THREE.Box3(),head=root.userData.headGroup;
 for(const child of root.children)if(isMesh(child)&&!sourceLimbs.includes(child)&&!['tail','neck','left-wing','right-wing'].includes(String(child.userData.referenceAnatomyRole)))torsoBounds.union(new THREE.Box3().setFromObject(child));
 const authored=root.userData.referenceAdaptation?.torsoBounds;
 if(authored){torsoBounds.min.fromArray(authored.min);torsoBounds.max.fromArray(authored.max);}
 const referenceLength=torsoBounds.max.x-torsoBounds.min.x,adultLength=nativeShape[0]?.size[2];
 if(!Number.isFinite(referenceLength)||referenceLength<=0||!Number.isFinite(adultLength)||adultLength<=0)throw Error('Invalid measured adult trunk scale: '+species);
 const bounds=new THREE.Box3().setFromObject(root),floor=bounds.min.y,scale=adultLength/referenceLength;
 if(!Number.isFinite(floor)||!Number.isFinite(scale)||scale<=0)throw Error('Invalid new reference bounds: '+species);
 const headPivot=convertBestiaryPoint(head.getWorldPosition(new THREE.Vector3()),{scale,floor});
 const visualRow=(row:AnimalBodyFact256):AnimalBodyFact256=>{
  let current=row;while(!corpseVisualPartBit(animalPartId256(body,current.index),species)&&current.parent!==null)current=rows[current.parent];
  if(!corpseVisualPartBit(animalPartId256(body,current.index),species))throw Error('No visible native ancestor: '+species+'/'+row.defId);
  return current;
 };
 const findRole=(role:string,mesh:BestiaryMesh):AnimalBodyFact256=>{
  const sided=/^(left|right)-(eye|ear|wing|tusk)$/.exec(role);
  if(sided){const def=sided[2][0].toUpperCase()+sided[2].slice(1);return rows.find(row=>row.defId===def&&row.side===sided[1])
   ??(sided[2]==='tusk'?rows.find(row=>row.defId==='AnimalJaw'):undefined)??(sided[2]==='wing'?nativeRoot:nativeHead);}
  const defs:Readonly<Record<string,readonly string[]>>={head:[nativeHead.defId],neck:['Neck','TurtleNeck'],jaw:['AnimalJaw','SnakeMouth','TurtleBeak','InsectMouth','Beak'],beak:['Beak','TurtleBeak'],nose:['Nose','InsectNostril'],tail:['Tail'],horn:['Horn'],tusk:['Tusk'],pronotum:['Pronotum'],shell:['Shell','TurtleShell','Shell'],torso:[nativeRoot.defId]};
  const wanted=defs[role]??(belongs(mesh,head)?[nativeHead.defId]:[nativeRoot.defId]);
  return rows.find(row=>wanted.includes(row.defId))??(belongs(mesh,head)?nativeHead:nativeRoot);
 };
 const parts:NativeSourcePart[]=[];
 root.traverse(object=>{
  if(!isMesh(object)||!object.visible)return;
  const limb=sourceLimbs.find(candidate=>belongs(object,candidate)),role=String(object.userData.referenceAnatomyRole??(belongs(object,head)?'head':belongs(object,root.userData.tailGroup)?'tail':'torso'));
  let owner:AnimalBodyFact256,bone=belongs(object,head)?3:0,pivot=bone===3?headPivot.clone():new THREE.Vector3();
  if(limb){
   const row=limbRows.get(limb);if(!row)throw Error('Unbound source limb: '+species);
   const isFoot=/paw|hoof|foot|hand/.test(role)||['hand','foot'].includes(object.name)||(!isMesh(limb)&&limb.children.length===3&&limb.children[2]===object);
   owner=isFoot?(rows.find(child=>child.parent===row.index&&FOOT_DEFS.has(child.defId))??row):row;
   const pose=nativeShape.find(part=>part.bodyPart===animalPartId256(body,row.index));if(!pose)throw Error('Native shape has no limb pose: '+species+'/'+row.index);
   bone=pose.bone;const sourcePivot=limb.getWorldPosition(new THREE.Vector3());
   if(isMesh(limb)){limb.geometry.computeBoundingBox();const local=new THREE.Vector3(0,limb.geometry.boundingBox!.max.y,0);sourcePivot.copy(local.applyMatrix4(limb.matrixWorld));}
   pivot=convertBestiaryPoint(sourcePivot,{scale,floor});
  }else owner=findRole(role,object);
  const clinical=visualRow(owner),nativePart=animalPartId256(body,clinical.index),maskBit=corpseVisualPartBit(nativePart,species);
  object.userData.referenceNativePart=nativePart;object.userData.referenceNativeRecordIndex=clinical.index;
  parts.push({mesh:object,visualRole:role,nativePart,nativeRecordIndex:clinical.index,maskBit,bloodRegion:bodyBloodRegion(nativePart,true),bone,pivot,
   eyeMark:/^(left|right)-eye$/.test(role)?0:-1,sourceLimbOrdinal:limb?sourceLimbs.indexOf(limb):null,clinicalProjection:owner.index===clinical.index?'exact':'native-ancestor'});
 });
 return{species,parts,scale,floor,bodyCenter:(torsoBounds.getCenter(new THREE.Vector3()).y-floor)*scale,referenceLength,nativeLimbCount:nativeLimbs.length,sourceLimbCount:sourceLimbs.length,torsoBounds};
}

export type ProfileForBestiaryMaterial=(material:BestiaryMaterial)=>number;
export interface CompiledBestiaryGeometry {readonly body:THREE.InstancedBufferGeometry;readonly brush:THREE.InstancedBufferGeometry;readonly wear:THREE.InstancedBufferGeometry;readonly receipt:{readonly species:string;readonly referenceLength:number;readonly scale:number;readonly sourceLimbCount:number;readonly nativeLimbCount:number;readonly parts:readonly {nativePart:BodyPartId;bone:number;pivot:Triple;maskBit:number;eyeMark:number}[]}}

/** Compiles one static source into the existing17-float actor format. Instance
 * attributes are intentionally not fabricated here: the future SpeciesRig
 * owner will attach its original33-float stream to all three geometries. */
export function compileBestiaryAnimalBody(species:string,root:BestiaryGroup,profileFor:ProfileForBestiaryMaterial):Omit<CompiledBestiaryGeometry,'brush'> {
 const plan=describeBestiaryAnimal(species,root),bodyValues:number[]=[],bodyUv:number[]=[],wearValues:number[]=[],wearUv:number[]=[],wearBase:number[]=[],wearDirections:number[]=[],cargoTorso:number[]=[];
 function append(geometry:THREE.BufferGeometry,part:NativeSourcePart,profile:number,values:number[],uvs:number[],matrix:THREE.Matrix4,mark=part.eyeMark):void {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),index=geometry.getIndex(),count=index?.count??p.count;
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),point=new THREE.Vector3(),normal=new THREE.Vector3(),color=part.mesh.material.color;
  const collectCargo=values===bodyValues&&mark===part.eyeMark&&part.bone===0&&part.sourceLimbOrdinal===null&&['torso','shell','pronotum','hump'].includes(part.visualRole);
  for(let at=0;at<count;at++){
   const vertex=index?index.getX(at):at;point.fromBufferAttribute(p,vertex).applyMatrix4(matrix);convertBestiaryPoint(point,plan);
   // Collect only original rigid torso corners during this existing pass.
   // Head, limbs, tail, death-eye marks and expanded wear cannot support cargo.
   if(collectCargo)cargoTorso.push(Math.fround(point.x),Math.fround(point.y),Math.fround(point.z));
   normal.fromBufferAttribute(n,vertex).applyNormalMatrix(normalMatrix);normal.set(-normal.z,normal.y,normal.x);
   values.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,color.r,color.g,color.b,profile,part.bone,part.maskBit,part.bloodRegion,mark,part.pivot.x,part.pivot.y,part.pivot.z);
   uvs.push(uv?.getX(vertex)??0,uv?.getY(vertex)??0);
  }
 }
 for(const part of plan.parts){
  const mesh=part.mesh,profile=profileFor(mesh.material);if(!Number.isSafeInteger(profile)||profile<0)throw Error('Invalid admitted paint profile');
  append(mesh.geometry,part,profile,bodyValues,bodyUv,mesh.matrixWorld);
  const edges=createReferenceEdgeGeometry(mesh.geometry,mesh.userData.referenceEdgeAngle??22);
  if(edges.wear){
   const geometry=edges.wear,base=geometry.userData.basePosArray as Float32Array,directions=geometry.userData.expandDirArray as Float32Array;
   // Source wear positions are at their unexpanded bases. The context later
   // applies its exact wear amount from these transformed CPU vectors.
   geometry.setAttribute('position',new THREE.BufferAttribute(base,3));append(geometry,part,profile,wearValues,wearUv,mesh.matrixWorld);
   const linear=new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld),point=new THREE.Vector3(),direction=new THREE.Vector3();
   for(let i=0;i<base.length;i+=3){point.fromArray(base,i).applyMatrix4(mesh.matrixWorld);convertBestiaryPoint(point,plan);direction.fromArray(directions,i).applyMatrix3(linear);direction.set(-direction.z*plan.scale,direction.y*plan.scale,direction.x*plan.scale);wearBase.push(...point.toArray());wearDirections.push(...direction.toArray());}
  }
  edges.surface.dispose();edges.lines.dispose();edges.wear?.dispose();
  if(part.eyeMark===0){
   mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
   for(const roll of [-Math.PI/4,Math.PI/4]){
    const indexed=new THREE.BoxGeometry(Math.min(size.x,size.y)*.31,Math.max(size.x,size.y)*1.17,Math.max(.004,size.z*.35)),cross=indexed.toNonIndexed();indexed.dispose();
    cross.rotateZ(roll);cross.translate(0,0,size.z*.5+.004);append(cross,part,profile,bodyValues,bodyUv,mesh.matrixWorld,1);cross.dispose();
   }
  }
 }
 function stream(values:number[],coordinates:number[]):THREE.InstancedBufferGeometry {
  const geometry=new THREE.InstancedBufferGeometry(),buffer=new THREE.InterleavedBuffer(new Float32Array(values),17),uv=new THREE.Float32BufferAttribute(coordinates,2);
  for(const [name,size,offset]of [['position',3,0],['normal',3,3],['color',3,6],['animalPaint',4,6],['boneId',1,10],['corpsePartMask',1,11],['bloodRegion',1,12],['eyeMark',1,13],['animalPart',4,10],['bindPivot',3,14]] as const)geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(buffer,size,offset));
  geometry.setAttribute('uv',uv);geometry.setAttribute('animalPaintUv',uv);geometry.instanceCount=0;return geometry;
 }
 const body=stream(bodyValues,bodyUv),wear=stream(wearValues,wearUv);
 wear.userData.referenceWearBasePositions=new Float32Array(wearBase);wear.userData.referenceWearExpandDirections=new Float32Array(wearDirections);
 body.userData.origamiWear=wear;body.userData.origamiReference=`best46:${species}`;body.userData.origamiBodyCenter=plan.bodyCenter;
 body.userData.origamiReferenceScale=plan.scale;body.userData.origamiReferenceFloor=plan.floor;body.userData.origamiReferenceLength=plan.referenceLength;
 // Source conversion and clipping happen once per immutable compiled template,
 // never during adoption/present(). Registry keeps canonical/presentation apart.
 body.computeBoundingBox();const torsoBounds=new THREE.Box3(),corner=new THREE.Vector3();
 for(const x of [plan.torsoBounds.min.x,plan.torsoBounds.max.x])for(const y of [plan.torsoBounds.min.y,plan.torsoBounds.max.y])for(const z of [plan.torsoBounds.min.z,plan.torsoBounds.max.z])torsoBounds.expandByPoint(convertBestiaryPoint(corner.set(x,y,z),plan));
 const torsoTriangles=new Float32Array(cargoTorso),cargoBack=deriveAnimalCargoBack({torsoTriangles,torsoBounds,bodyBounds:body.boundingBox!,bodyCenter:plan.bodyCenter});
 if(cargoBack){body.userData.origamiCargoBack=cargoBackMetadata(cargoBack);body.userData.origamiCargoTorso=torsoTriangles;}
 return{body,wear,receipt:{species,referenceLength:plan.referenceLength,scale:plan.scale,sourceLimbCount:plan.sourceLimbCount,nativeLimbCount:plan.nativeLimbCount,
  parts:plan.parts.map(part=>({nativePart:part.nativePart,bone:part.bone,pivot:part.pivot.toArray(),maskBit:part.maskBit,eyeMark:part.eyeMark}))}};
}

/** Full static companion API for CPU/component qualification. Runtime rigs call
 * compileBestiaryAnimalBody so SpeciesRig constructs its brush only once. */
export function compileBestiaryAnimalGeometry(species:string,root:BestiaryGroup,profileFor:ProfileForBestiaryMaterial):CompiledBestiaryGeometry {
 const compiled=compileBestiaryAnimalBody(species,root,profileFor),brush=createRigBrushGeometry(compiled.body);
 compiled.body.userData.origamiLines=brush;return{...compiled,brush};
}
