// Product bestiary adaptation contracts. ROOT alone executes qualification.
import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import * as THREE from 'three/webgpu';
import {createBestiaryReference} from '../src/render/origami/bestiary-reference.literal';
import {createBestiaryPresentation} from '../src/render/origami/bestiary-presentation';
import {createBestiaryAdaptations,BESTIARY_ADAPTATION_MANIFEST,type BestiaryAdaptationId} from '../src/render/origami/bestiary-adaptations';
import {createBestiaryAdaptations as createJsAdaptations} from './fixtures/bestiary-adaptations-original.js';
import {ADAPTATION_SOURCE_KEYS,ADAPTATION_PAINT_DESCRIPTORS} from '../src/render/origami/bestiary-adaptation-paint';
import {BESTIARY_PAINT_DESCRIPTORS} from '../src/render/origami/bestiary-paint-descriptors';
import type {BestiaryFactory,BestiaryGroup,BestiaryMesh,RegisterMaterial} from '../src/render/origami/bestiary-types';
import {describeBestiaryAnimal,compileBestiaryAnimalGeometry} from '../src/render/origami/bestiary-geometry';
import {animalCore256} from '../src/sim/animal-core-v256';
import {CORE_ANIMAL_BODIES_256} from '../src/sim/animal-anatomy-data-v256';
import type {AnimalBodyFact256} from '../src/sim/animal-anatomy-v256';
import {bestiaryPaintProfile} from '../src/render/origami/reference-profiles';

const ids=Object.keys(BESTIARY_ADAPTATION_MANIFEST.species) as BestiaryAdaptationId[];
const expectedParents=['cougar','spelopede','caribou','fennec','raccoon','guinea_pig','timber_wolf'];
const protectedIds=['hare','snow-hare','deer','muffalo','gazelle','dromedary','red-fox','labrador-retriever','husky','yorkshire-terrier','elephant','fox','camel','dog','buffalo'];
function meshes(root:THREE.Object3D):BestiaryMesh[]{const result:BestiaryMesh[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh)result.push(object as BestiaryMesh);});return result;}
function dispose(root:THREE.Object3D):void{for(const mesh of meshes(root))mesh.geometry.dispose();root.clear();}
function materials(factory:BestiaryFactory):void{for(const row of factory.materialRecords)row.material.dispose();}
function beneath(object:THREE.Object3D,ancestor:THREE.Object3D):boolean{for(let node:THREE.Object3D|null=object;node;node=node.parent)if(node===ancestor)return true;return false;}
function signature(root:BestiaryGroup):string{
 root.updateMatrixWorld(true);const hash=createHash('sha256');
 for(const mesh of meshes(root)){
  hash.update(JSON.stringify({name:mesh.name,matrix:mesh.matrixWorld.toArray(),materialKey:mesh.material.userData.referencePaintKey,color:mesh.material.color.getHex(),role:mesh.userData.referenceAnatomyRole,eye:mesh.userData.referenceEyeMark,surface:mesh.userData.referenceEyeSurface}));
  for(const [name,attribute]of Object.entries(mesh.geometry.attributes).sort(([a],[b])=>a.localeCompare(b))){
   hash.update(JSON.stringify([name,attribute.itemSize,attribute.normalized,attribute.count]));
   const values=attribute.array;hash.update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength));
  }
  if(mesh.geometry.index){const values=mesh.geometry.index.array;hash.update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength));}
 }
 const receipt=root.userData.referenceAdaptation;hash.update(JSON.stringify(receipt?{...receipt,productionIntegrated:undefined}:undefined));return hash.digest('hex');
}
function pointOnSurface(mesh:BestiaryMesh,point:THREE.Vector3):number{
 const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,total=index?.count??p.count;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),closest=new THREE.Vector3();let min=Infinity;
 for(let i=0;i<total;i+=3){a.fromBufferAttribute(p,index?.getX(i)??i);b.fromBufferAttribute(p,index?.getX(i+1)??i+1);c.fromBufferAttribute(p,index?.getX(i+2)??i+2);new THREE.Triangle(a,b,c).closestPointToPoint(point,closest);min=Math.min(min,closest.distanceTo(point));}
 return min;
}
interface PrivateContract {readonly name:string;run():void}
const ADAPTATION_CONTRACTS:readonly PrivateContract[]=[
 {name:'all seven builders call only their declared new parent and reject every protected existing identity',run(){
  const reference=createBestiaryReference(THREE),called:string[]=[];
  const guarded:BestiaryFactory={ids:reference.ids,materialRecords:reference.materialRecords,build(id){called.push(id);expect(protectedIds).not.toContain(id);return reference.build(id);}};
  const factory=createBestiaryAdaptations(THREE,undefined,undefined,guarded);
  try{expect(factory.ids).toEqual(ids);for(const id of ids){const group=factory.build(id);try{expect(group.userData.referenceAdaptation?.parent).toBe(BESTIARY_ADAPTATION_MANIFEST.species[id].parent);expect(group.userData.referenceAdaptation?.literalCopy).toBe(false);}finally{dispose(group);}}
   expect(called).toEqual(expectedParents);for(const id of protectedIds)expect(()=>factory.build(id)).toThrow('seven');expect(called).toEqual(expectedParents);
  }finally{materials(reference);}
 }},
 {name:'typed adaptation port retains every raw JS triangle input, material, transform, eye and bound for all seven parents',run(){
  const reference=createBestiaryReference(THREE),typed=createBestiaryAdaptations(THREE,undefined,undefined,reference),raw=createJsAdaptations(THREE,undefined,undefined,reference);
  try{for(const id of ids){const a=typed.build(id),b=raw.build(id);try{expect(signature(a)).toBe(signature(b));expect(a.userData.referenceAdaptation?.productionIntegrated).toBe(true);expect(b.userData.referenceAdaptation?.productionIntegrated).toBe(false);}finally{dispose(a);dispose(b);}}}finally{materials(reference);}
 }},
 {name:'two open eyes per adaptation lie on actual carrier triangles and project forward from their surface normals',run(){
  const reference=createBestiaryReference(THREE),factory=createBestiaryAdaptations(THREE,undefined,undefined,reference);
  try{for(const id of ids){const group=factory.build(id);try{
   const eyes=group.userData.referenceEyeMeshes??[];expect(eyes).toHaveLength(2);expect(new Set(eyes.map(eye=>eye.userData.referenceAnatomyRole))).toEqual(new Set(['left-eye','right-eye']));
   for(const eye of eyes){const parent=eye.parent;if(!(parent instanceof THREE.Mesh))throw Error('Eye has no physical head carrier');
    const surface=eye.userData.referenceEyeSurface;if(!surface)throw Error('Eye surface receipt absent');
    const point=new THREE.Vector3().fromArray(surface.point),normal=new THREE.Vector3().fromArray(surface.normal);expect(pointOnSurface(parent as BestiaryMesh,point)).toBeLessThan(1e-6);expect(normal.length()).toBeCloseTo(1,9);
    eye.geometry.computeBoundingBox();const depth=eye.geometry.boundingBox!.max.z-eye.geometry.boundingBox!.min.z;
    expect(eye.position.distanceTo(point.clone().addScaledVector(normal,depth*.5+surface.clearance))).toBeLessThan(1e-7);
    expect(new THREE.Vector3(0,0,1).applyQuaternion(eye.quaternion).distanceTo(normal)).toBeLessThan(1e-7);expect(eye.userData.referenceEyeMark).toBe(0);
    expect(beneath(eye,group.userData.headGroup)).toBe(true);expect(id==='monkey'?normal.x:Math.abs(normal.z)).toBeGreaterThan(.5);
   }
  }finally{dispose(group);}}}finally{materials(reference);}
 }},
 {name:'transformed bounds enclose actual vertices and retain distinct real head, limb and tail pivots',run(){
  const reference=createBestiaryReference(THREE),factory=createBestiaryAdaptations(THREE,undefined,undefined,reference);
  try{for(const id of ids){const group=factory.build(id);try{
   const data=group.userData.referenceAdaptation;if(!data)throw Error('Missing adaptation geometry receipt');
   const bound=new THREE.Box3(new THREE.Vector3().fromArray(data.bounds.min),new THREE.Vector3().fromArray(data.bounds.max)),exact=new THREE.Box3(),point=new THREE.Vector3();
   for(const mesh of meshes(group)){const positions=mesh.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);exact.expandByPoint(point);expect(bound.clone().expandByScalar(1e-6).containsPoint(point)).toBe(true);}}
   expect(bound.isEmpty()).toBe(false);for(const value of [...data.bounds.min,...data.bounds.max,...data.bounds.size])expect(Number.isFinite(value)).toBe(true);
   expect(exact.getSize(new THREE.Vector3()).length()).toBeGreaterThan(bound.getSize(new THREE.Vector3()).length()*.4);
   expect(data.trunkLengthX).toBeGreaterThan(0);expect(data.trunkLengthX).toBeLessThanOrEqual(data.bounds.size[0]!+1e-6);
   expect(data.legPivots).toHaveLength(BESTIARY_ADAPTATION_MANIFEST.species[id].legs);expect(new Set(data.legPivots.map(point=>JSON.stringify(point))).size).toBe(data.legPivots.length);
   expect(new THREE.Vector3().fromArray(data.headPivot!).distanceTo(group.userData.headGroup.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8);
   if(id==='rat'||id==='cat')expect(data.torsoBounds.min[0]!-data.bounds.min[0]!).toBeGreaterThan(.1);
  }finally{dispose(group);}}}finally{materials(reference);}
 }},
 {name:'mask ownership hints preserve six insect legs, four monkey limbs and head-only eye membership without adding gameplay parts',run(){
  const reference=createBestiaryReference(THREE),factory=createBestiaryAdaptations(THREE,undefined,undefined,reference);
  try{for(const id of ids){const group=factory.build(id);try{
   const legs=group.userData.legs;expect(legs).toHaveLength(BESTIARY_ADAPTATION_MANIFEST.species[id].legs);
   for(const limb of legs){expect(beneath(limb,group.userData.headGroup)).toBe(false);expect(meshes(limb).length).toBeGreaterThan(0);for(const part of meshes(limb))expect(part.userData.referenceEyeMark).toBeUndefined();}
   for(const eye of group.userData.referenceEyeMeshes??[])expect(legs.some(limb=>beneath(eye,limb))).toBe(false);
   if(id==='megascarab')expect(legs.map(limb=>limb.userData.referenceLimbOrdinal)).toEqual([0,1,2,3,4,5]);
   if(id==='monkey'){expect(legs.map(limb=>limb.userData.referenceLimbKind)).toEqual(['front-arm','front-arm','rear-leg','rear-leg']);expect(meshes(legs[0]!).some(part=>part.userData.referenceAnatomyRole==='front-paw')).toBe(true);expect(meshes(legs[2]!).some(part=>part.userData.referenceAnatomyRole==='rear-paw')).toBe(true);}
   expect(group.userData.referenceAdaptation?.productionIntegrated).toBe(true);
  }finally{dispose(group);}}}finally{materials(reference);}
 }},
 {name:'shared source pigments keep their authored configs and IDs; snowy models use the real snow profile object',run(){
  let next=300;const register:RegisterMaterial=(key,config)=>{const material=new THREE.MeshBasicMaterial({color:config.baseColor});material.userData.referencePaintIndex=next++;return material;};
  const reference=createBestiaryReference(THREE,register),factory=createBestiaryAdaptations(THREE,undefined,undefined,reference),before=reference.materialRecords.map(row=>({key:row.key,color:row.material.color.getHex(),profile:row.material.userData.referencePaintIndex,config:JSON.stringify(row.config)}));
  const admittedMaterials=new Set(reference.materialRecords.map(row=>row.material)),descriptorKeys=new Set<string>(ADAPTATION_SOURCE_KEYS);
  try{
   const selected=BESTIARY_PAINT_DESCRIPTORS.filter(row=>descriptorKeys.has(row.key));expect(ADAPTATION_PAINT_DESCRIPTORS).toHaveLength(13);ADAPTATION_PAINT_DESCRIPTORS.forEach((descriptor,index)=>expect(descriptor).toBe(selected[index]));
   for(const id of ids){const group=factory.build(id);try{for(const part of meshes(group)){expect(admittedMaterials.has(part.material)).toBe(true);const key=part.material.userData.referencePaintKey;if(typeof key!=='string')throw Error('Material profile provenance absent');expect(descriptorKeys.has(`best46:${key}`)).toBe(true);expect(Number.isInteger(part.material.userData.referencePaintIndex)).toBe(true);}
    if(id==='arctic-fox'||id==='arctic-wolf')expect(group.userData.primaryMaterial).toBe(reference.materialRecords.find(row=>row.key==='matSnowWhiteGouache')!.material);
   }finally{dispose(group);}}
   expect(reference.materialRecords.map(row=>({key:row.key,color:row.material.color.getHex(),profile:row.material.userData.referencePaintIndex,config:JSON.stringify(row.config)}))).toEqual(before);
  }finally{materials(reference);}
 }},
 {name:'all seven adaptations accept the separately corrected parent factory without stale source-eye indexing',run(){
  const literal=createBestiaryReference(THREE),corrected=createBestiaryPresentation(THREE,undefined,undefined,literal),factory=createBestiaryAdaptations(THREE,undefined,undefined,corrected);
  try{for(const id of ids){const root=factory.build(id);try{expect(root.userData.referenceEyeMeshes).toHaveLength(2);expect(root.userData.referenceAdaptation?.parent).toBe(BESTIARY_ADAPTATION_MANIFEST.species[id].parent);
   if(id==='rat'){const tail=root.userData.tailGroup;expect(tail?.parent).toBe(root);expect(tail?.position.toArray()).toEqual([-.36,.24,0]);}
  }finally{dispose(root);}}}finally{materials(literal);}
 }},
];

describe('seven explicitly adapted bestiary species, actual product factories',()=>{
 for(const contract of ADAPTATION_CONTRACTS)it(contract.name,contract.run);
 it('compiles real native masks for all seven, preserving two monkey Arms and Legs plus six scarab limbs across body/brush/wear',()=>{
  const source=createBestiaryReference(THREE),factory=createBestiaryAdaptations(THREE,undefined,undefined,source);
  try{for(const id of ids){const root=factory.build(id);let compiled:ReturnType<typeof compileBestiaryAnimalGeometry>|undefined;
   try{
    const plan=describeBestiaryAnimal(id,root),rows=CORE_ANIMAL_BODIES_256[animalCore256(id).race.body];
    expect(plan.sourceLimbCount).toBe(BESTIARY_ADAPTATION_MANIFEST.species[id].legs);expect(plan.nativeLimbCount).toBe(plan.sourceLimbCount);
    expect(plan.parts.filter(part=>part.eyeMark===0)).toHaveLength(2);
    for(const part of plan.parts){
     expect(Number.isSafeInteger(part.maskBit)).toBe(true);expect(part.maskBit).toBeGreaterThan(0);expect(part.maskBit&(part.maskBit-1)).toBe(0);
     expect(part.nativePart).toBe(part.mesh.userData.referenceNativePart);expect(part.nativeRecordIndex).toBe(part.mesh.userData.referenceNativeRecordIndex);
     if(part.sourceLimbOrdinal!==null){
      const wanted=id==='monkey'&&part.sourceLimbOrdinal<2?'Arm':id==='megascarab'?'InsectLeg':'Leg',ancestry:string[]=[];
      let record:AnimalBodyFact256|undefined=rows[part.nativeRecordIndex];
      while(record){ancestry.push(record.defId);if(record.parent===null)break;record=rows[record.parent];}
      expect(ancestry).toContain(wanted);
     }
    }
    const profileFor=(material:THREE.MeshBasicMaterial)=>{const record=source.materialRecords.find(row=>row.material===material);if(!record)throw Error('Unknown adaptation source material');return bestiaryPaintProfile(record.key);};
    compiled=compileBestiaryAnimalGeometry(id,root,profileFor);
    const masks=new Set(plan.parts.map(part=>part.maskBit)),bones=new Set(plan.parts.map(part=>part.bone));
    for(const geometry of [compiled.body,compiled.brush,compiled.wear]){
     const word=geometry.getAttribute('animalPart'),paint=geometry.getAttribute('animalPaint'),pivot=geometry.getAttribute('bindPivot');expect(word.itemSize).toBe(4);
     expect(word.count).toBeGreaterThan(0);for(let i=0;i<word.count;i++){
      if(!masks.has(word.getY(i))||!bones.has(word.getX(i))||![-1,0,1].includes(word.getW(i)))throw Error(`${id}: compiled anatomy word changed at vertex ${i}`);
      if(paint.getW(i)<43||paint.getW(i)>87||!Number.isInteger(paint.getW(i)))throw Error(`${id}: compiled paint left the admitted static source table`);
      if(![pivot.getX(i),pivot.getY(i),pivot.getZ(i)].every(Number.isFinite))throw Error(`${id}: non-finite compiled bind pivot`);
     }
    }
    expect(compiled.body.userData.origamiReference).toBe(`best46:${id}`);expect(compiled.receipt.nativeLimbCount).toBe(plan.nativeLimbCount);
   }finally{if(compiled)for(const geometry of [compiled.body,compiled.brush,compiled.wear])geometry.dispose();dispose(root);}
  }}finally{materials(source);}
 });
});
