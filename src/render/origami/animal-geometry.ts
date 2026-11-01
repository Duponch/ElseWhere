import * as THREE from 'three/webgpu';
import {animalParts} from '../animal-shape';
import {animalCore256,isAnimalSpecies256} from '../../sim/animal-core-v256';
import {CORE_ANIMAL_BODIES_256} from '../../sim/animal-anatomy-data-v256';
import {animalPartId256} from '../../sim/animal-anatomy-v256';
import type {BodyPartId} from '../../sim/body-definition';
import {corpseVisualPartBit} from '../corpse-presentation';
import {bodyBloodRegion} from '../body-blood-word-297';
import {buildOrigamiAnimalReference,type OrigamiAnimalReference} from './animal-reference';
import {createReferenceEdgeGeometry} from './reference-edges';

/** Existing clinical and gameplay identities select exact reference artwork.
 * All three real dog breeds use the source shepherd; muffalo uses the source
 * buffalo. No phenotype or colour adaptation changes the supplied asset. */
export const ORIGAMI_ANIMAL_REFERENCES:Readonly<Record<string,OrigamiAnimalReference>>=Object.freeze({
  'red-fox':'fox',dromedary:'camel',hare:'hare','snow-hare':'hare',
  'labrador-retriever':'dog',husky:'dog','yorkshire-terrier':'dog',
  muffalo:'buffalo',gazelle:'gazelle',deer:'deer',elephant:'elephant',
});
export const ORIGAMI_ANIMAL_SPECIES=Object.freeze(Object.keys(ORIGAMI_ANIMAL_REFERENCES));

type RefMesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
interface CompiledStream {vertices:Float32Array;paintUV:Float32Array}
interface CompiledAnimal extends CompiledStream {bodyCenter:number;reference:OrigamiAnimalReference;parts:number;referenceScale:number;referenceFloor:number;lines:CompiledStream;wear:CompiledStream;wearBase:Float32Array;wearDirections:Float32Array}
const compiledAnimals=new Map<string,CompiledAnimal>();
const ORIGIN=new THREE.Vector3();

/** The resident species rig is unchanged: one draw for the body, the same
 * packed anatomical masks and existing owner/cargo/interpolation attributes.
 * Transient reference meshes are flattened once, never retained per animal. */
export function origamiAnimalGeometry(capacity:number,species:string):THREE.InstancedBufferGeometry|undefined {
  const compiled=compileAnimal(species);if(!compiled)return;
  const g=streamGeometry(compiled);
  const instances=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*33),33).setUsage(THREE.StaticDrawUsage);
  for(const [name,size,offset] of [['aFrom',4,0],['aTo',4,4],['aTravel',4,8],['aAnimal',4,12],['aScale',1,16],['aBodyBlood',1,17],['aAbsent',1,18],['aCarrier',4,19],['aCorpseHandoff',2,23],['aCorpseFrom',4,25],['aCorpseTo',4,29]] as const)g.setAttribute(name,new THREE.InterleavedBufferAttribute(instances,size,offset));
  g.setAttribute('aBiology',new THREE.InterleavedBufferAttribute(instances,3,16));
  const lines=streamGeometry(compiled.lines),wear=streamGeometry(compiled.wear,true);
  for(const companion of [lines,wear]){
    for(const [name,attribute] of Object.entries(g.attributes))if(attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data===instances)companion.setAttribute(name,attribute);
    companion.instanceCount=0;
  }
  wear.userData.referenceWearBasePositions=compiled.wearBase;
  wear.userData.referenceWearExpandDirections=compiled.wearDirections;
  g.userData.origamiLines=lines;g.userData.origamiWear=wear;
  g.userData.origamiReference=compiled.reference;g.userData.origamiParts=compiled.parts;g.userData.origamiBodyCenter=compiled.bodyCenter;
  g.userData.origamiReferenceScale=compiled.referenceScale;g.userData.origamiReferenceFloor=compiled.referenceFloor;
  g.instanceCount=0;return g;
}

function streamGeometry(stream:CompiledStream,mutable=false):THREE.InstancedBufferGeometry {
  const g=new THREE.InstancedBufferGeometry(),v=new THREE.InterleavedBuffer(mutable?stream.vertices.slice():stream.vertices,17);
  if(mutable)v.setUsage(THREE.DynamicDrawUsage);
  for(const [name,size,offset] of [['position',3,0],['normal',3,3],['color',3,6],['animalPaint',4,6],['boneId',1,10],['bindPivot',3,14],['corpsePartMask',1,11],['bloodRegion',1,12],['eyeMark',1,13]] as const)g.setAttribute(name,new THREE.InterleavedBufferAttribute(v,size,offset));
  g.setAttribute('animalPart',new THREE.InterleavedBufferAttribute(v,4,10));
  // Original object UVs are copied verbatim, including metric extrusion UVs.
  // Repeating paint is sampled exactly as on each supplied source primitive.
  const paintUV=new THREE.BufferAttribute(stream.paintUV,2);
  g.setAttribute('animalPaintUv',paintUV);g.setAttribute('uv',paintUV);
  return g;
}

export function origamiAnimalBodyCenter(species:string):number|undefined {return compileAnimal(species)?.bodyCenter;}

function belongsTo(object:THREE.Object3D,ancestor:THREE.Object3D|undefined):boolean {
  if(!ancestor)return false;
  for(let node:THREE.Object3D|null=object;node;node=node.parent)if(node===ancestor)return true;
  return false;
}

function nativeOwner(species:string,part:BodyPartId):BodyPartId {
  if(!isAnimalSpecies256(species))return part;
  const body=animalCore256(species).race.body,rows=CORE_ANIMAL_BODIES_256[body];
  // Some real native bodies (including Elephant) have no independent Tail
  // record. Keep the reference's visible tail as part of the real torso,
  // rather than inventing clinical anatomy or emitting an unmasked bit zero.
  if(part==='tail'&&!rows.some(row=>row.defId==='Tail'))return 'torso';
  const limb=/^(left|right)-(front|rear)-(leg|paw|hoof)$/.exec(part);
  if(limb){
    const legs=rows.filter(row=>row.defId==='Leg'),index=(limb[2]==='rear'?2:0)+(limb[1]==='right'?1:0),leg=legs[index];
    const row=limb[3]==='leg'?leg:leg&&rows.find(row=>row.parent===leg.index&&['Paw','Hoof','Foot'].includes(row.defId));
    return row?animalPartId256(body,row.index):part;
  }
  const sided=/^(left|right)-(eye|ear|tusk)$/.exec(part);
  const defs:Record<string,readonly string[]>={torso:['Torso'],neck:['Neck'],head:['Head','HeadWithEarHoles'],jaw:['AnimalJaw'],nose:['Nose'],tail:['Tail'],trunk:['Trunk'],hump:['Hump']};
  const names=sided?[sided[2][0].toUpperCase()+sided[2].slice(1)]:defs[part];
  const row=names&&(rows.find(row=>names.includes(row.defId)&&(!sided||row.side===sided[1]))
    ??(sided?.[2]==='tusk'?rows.filter(row=>row.defId==='Tusk')[sided[1]==='left'?0:1]:undefined));
  return row?animalPartId256(body,row.index):part;
}

function referenceOwner(mesh:RefMesh,root:THREE.Group,world:THREE.Vector3,leg:THREE.Object3D|undefined):BodyPartId {
  const name=mesh.name.toLowerCase(),side=world.z>0?'left':'right';
  if(leg){
    const at=leg.getWorldPosition(new THREE.Vector3()),end=at.x>0?'front':'rear';
    return `${side}-${end}-${name==='hoofmesh'?'hoof':'leg'}`;
  }
  if(name==='frontleg')return `${side}-front-leg`;
  if(name==='frontfoot')return `${side}-front-paw`;
  if(name==='haunch')return `${side}-rear-leg`;
  if(name==='foot')return `${side}-rear-paw`;
  if(name.includes('eye'))return `${side}-eye`;
  if(name.includes('ear')&&!name.includes('quarters'))return `${side}-ear`;
  if(name.includes('tusk'))return `${side}-tusk` as BodyPartId;
  if(name==='nose')return 'nose';
  if(name==='snout'||name==='muzzle')return 'jaw';
  if(name.includes('neck')||name==='collar')return 'neck';
  if(name.includes('hump'))return 'hump';
  if(belongsTo(mesh,root.userData.trunkGroup))return 'trunk' as BodyPartId;
  if(belongsTo(mesh,root.userData.tailGroup))return 'tail';
  return belongsTo(mesh,root.userData.headGroup)?'head':'torso';
}

function compileAnimal(species:string):CompiledAnimal|undefined {
  const reference=ORIGAMI_ANIMAL_REFERENCES[species];if(!reference)return;
  const cached=compiledAnimals.get(species);if(cached)return cached;
  const root=buildOrigamiAnimalReference(reference);
  root.updateMatrixWorld(true);
  const original=animalParts(species),trunk=original[0],referenceLength={fox:1.32,camel:1.42,hare:.68,dog:1.26,buffalo:1.735,gazelle:1.06,deer:1.32,elephant:1.78}[reference];
  // Scale from the existing adult trunk length, independently of age/health;
  // the resident aBiology.x continues to own growth and body size effects.
  const scale=trunk.size[2]/referenceLength,bounds=new THREE.Box3().setFromObject(root),floor=bounds.min.y;
  const convert=(p:THREE.Vector3)=>p.set(-p.z*scale,(p.y-floor)*scale,p.x*scale);
  const data:number[]=[],paintUV:number[]=[],lineData:number[]=[],lineUV:number[]=[],wearData:number[]=[],wearUV:number[]=[],wearBase:number[]=[],wearDirections:number[]=[],point=new THREE.Vector3(),normal=new THREE.Vector3(),center=new THREE.Vector3(),matrix=new THREE.Matrix3();
  const legs=root.userData.legs as THREE.Object3D[],head=root.userData.headGroup as THREE.Object3D;
  const headPivot=convert(head.getWorldPosition(new THREE.Vector3()));
  let count=0;
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||!object.visible)return;
    const mesh=object as RefMesh;
    if(mesh.geometry.index){const indexed=mesh.geometry;mesh.geometry=indexed.toNonIndexed();indexed.dispose();}
    const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');
    mesh.getWorldPosition(center);matrix.getNormalMatrix(mesh.matrixWorld);
    // Hare front legs are already meshes in the original builder. Their pivot
    // is the hip, rather than the mesh centre used by the reference demo.
    const leg=legs.find(leg=>belongsTo(mesh,leg));
    let owner=referenceOwner(mesh,root,center,leg);
    const limb=owner.includes('-front-')||owner.includes('-rear-');
    const refPivot=leg?leg.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(center.x,.32,center.z);
    if(reference==='hare'&&limb)refPivot.set(owner.includes('front')?.22:-.16,owner.includes('front')?.35:.27,Math.sign(center.z)*(owner.includes('front')?.13:.19));
    let bone=belongsTo(mesh,head)?3:0,pivot=bone===3?headPivot:ORIGIN;
    if(limb){
      const front=center.x>0?1:-1,side=center.z>0?-1:1;
      bone=front===side?1:2;pivot=convert(refPivot);
      // The reference uses the same dark hoof boxes for fox/dog paws.
      if(['fox','dog'].includes(reference))owner=owner.replace('-hoof','-paw') as BodyPartId;
    }
    const medical=nativeOwner(species,owner),bit=corpseVisualPartBit(medical,species),region=bodyBloodRegion(medical,true),isEye=owner.endsWith('-eye');
    const color=mesh.material.color,profile=mesh.material.userData.referencePaintIndex as number;
    count++;
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);convert(point);
      normal.fromBufferAttribute(n,i).applyNormalMatrix(matrix);normal.set(-normal.z,normal.y,normal.x);
      data.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,color.r,color.g,color.b,profile,bone,bit,region,isEye?0:-1,pivot.x,pivot.y,pivot.z);
      paintUV.push(uv.getX(i),uv.getY(i));
    }
    const edges=createReferenceEdgeGeometry(mesh.geometry,mesh.userData.referenceEdgeAngle as number);
    const lp=edges.lines.getAttribute('position');
    for(let i=0;i<lp.count;i++){
      point.fromBufferAttribute(lp,i).applyMatrix4(mesh.matrixWorld);convert(point);
      lineData.push(point.x,point.y,point.z,0,1,0,color.r,color.g,color.b,profile,bone,bit,region,isEye?0:-1,pivot.x,pivot.y,pivot.z);lineUV.push(0,0);
    }
    if(edges.wear){
      const wn=edges.wear.getAttribute('normal'),wu=edges.wear.getAttribute('uv');
      const base=edges.wear.userData.basePosArray as Float32Array,directions=edges.wear.userData.expandDirArray as Float32Array;
      const linear=new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld),direction=new THREE.Vector3();
      for(let i=0;i<base.length;i+=3){
        point.fromArray(base,i).applyMatrix4(mesh.matrixWorld);convert(point);
        direction.fromArray(directions,i).applyMatrix3(linear);direction.set(-direction.z*scale,direction.y*scale,direction.x*scale);
        normal.fromBufferAttribute(wn,i/3).applyNormalMatrix(matrix);normal.set(-normal.z,normal.y,normal.x);
        wearData.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,color.r,color.g,color.b,profile,bone,bit,region,isEye?0:-1,pivot.x,pivot.y,pivot.z);
        wearUV.push(wu.getX(i/3),wu.getY(i/3));wearBase.push(point.x,point.y,point.z);wearDirections.push(direction.x,direction.y,direction.z);
      }
    }
    edges.surface.dispose();edges.lines.dispose();edges.wear?.dispose();
    // Death uses crossed eyes under the same anatomy bit and shader eyeMark
    // state as the existing renderer; the live pupil is not left on corpses.
    if(isEye){
      for(const roll of [-Math.PI/4,Math.PI/4]){
        const cross=new THREE.BoxGeometry(.025,.067,.010).toNonIndexed();
        cross.rotateZ(roll);cross.applyMatrix4(mesh.matrixWorld);
        const cp=cross.getAttribute('position'),cn=cross.getAttribute('normal'),cu=cross.getAttribute('uv');
        for(let i=0;i<cp.count;i++){
          point.fromBufferAttribute(cp,i);convert(point);normal.fromBufferAttribute(cn,i);normal.set(-normal.z,normal.y,normal.x);
          // Bring the cross just outside the original side-facing pupil.
          point.x+=Math.sign(point.x)*.017*scale;
          data.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,color.r,color.g,color.b,profile,bone,bit,region,1,pivot.x,pivot.y,pivot.z);
          paintUV.push(cu.getX(i),cu.getY(i));
        }
        cross.dispose();
      }
    }
  });
  const bodyCenter=({fox:.68,camel:1.24,hare:.42,dog:.74,buffalo:1.04,gazelle:.94,deer:1.08,elephant:1.28}[reference]-floor)*scale;
  root.traverse(object=>{if(object instanceof THREE.Mesh){const mesh=object as RefMesh;mesh.geometry.dispose();}});
  const compiled={vertices:new Float32Array(data),paintUV:new Float32Array(paintUV),bodyCenter,reference,parts:count,referenceScale:scale,referenceFloor:floor,
    lines:{vertices:new Float32Array(lineData),paintUV:new Float32Array(lineUV)},wear:{vertices:new Float32Array(wearData),paintUV:new Float32Array(wearUV)},wearBase:new Float32Array(wearBase),wearDirections:new Float32Array(wearDirections)};
  compiledAnimals.set(species,compiled);return compiled;
}
