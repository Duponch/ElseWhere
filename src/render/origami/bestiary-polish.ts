// New bestiary explicit presentation changes. Canonical functions remain untouched.
import type * as Three from 'three/webgpu';
import {animalCore256,isAnimalSpecies256} from '../../sim/animal-core-v256';
import {CORE_ANIMAL_BODIES_256} from '../../sim/animal-anatomy-data-v256';
import type {ThreeAPI,BestiaryGroup,BestiaryMesh,BestiaryMaterial,MaterialRecord,ReferenceSurfaceHit,Triple} from './bestiary-types';

type SurfaceProbe=(api:ThreeAPI,geometry:Three.BufferGeometry,axis:number,side:number,coordinates:Three.Vector3)=>ReferenceSurfaceHit;
const SPECIES:Readonly<Record<string,string>>={grizzly:'grizzly-bear',polar_bear:'polar-bear',timber_wolf:'timber-wolf',fennec:'fennec-fox',rhino:'rhinoceros',boar:'wild-boar',guinea_pig:'guinea-pig'};
const EAR_ADDITIONS=new Set(['capybara','chinchilla','raccoon','squirrel','guinea_pig','bison','yak','rhino','ibex','boar','megasloth']);
const TAIL_ADDITIONS=new Set(['capybara','chinchilla','raccoon','squirrel','guinea_pig','bison','yak','rhino']);
export interface PresentationPolishReceipt {readonly changes:readonly string[];readonly earsAdded:number;readonly tailsAdded:number;readonly addedPieces:number}

export function polishNewAnimalPresentation(THREE:ThreeAPI,id:string,root:BestiaryGroup,records:readonly MaterialRecord[],surface:SurfaceProbe):PresentationPolishReceipt {
 const species=SPECIES[id]??id,changes:string[]=[];let addedPieces=0,earsAdded=0,tailsAdded=0;
 const pigments=new Map(records.map(row=>[row.key,row.material]));
 const pigment=(key:string):BestiaryMaterial=>{const material=pigments.get(key);if(!material)throw Error('Missing complete source paint: '+key);return material;};
 const native=isAnimalSpecies256(species)?CORE_ANIMAL_BODIES_256[animalCore256(species).race.body]:[];
 const hasNative=(def:string)=>native.some(row=>row.depth==='outside'&&row.defId===def);
 const head=root.userData.headGroup;
 function mesh(object:Three.Object3D|undefined):BestiaryMesh {
  if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.MeshBasicMaterial))throw Error('Polish source topology changed: '+id);
  return object as BestiaryMesh;
 }
 function addBox(parent:Three.Object3D,size:Triple,material:BestiaryMaterial,position:Triple,name:string,role:string):BestiaryMesh {
  const indexed=new THREE.BoxGeometry(size[0],size[1],size[2]),geometry=indexed.toNonIndexed();indexed.dispose();
  const part=new THREE.Mesh(geometry,material) as BestiaryMesh;
  part.position.fromArray(position);part.name=name;part.castShadow=part.receiveShadow=true;
  part.userData.referenceEdgeAngle=22;part.userData.referenceAnatomyRole=role;part.userData.referenceAuthoredAdaptation=true;
  parent.add(part);addedPieces++;return part;
 }
 // The head face is an explicit source child, before any added appendage.
 const skull=mesh(head.children[0]);
 if(id==='megaspider'||id==='spelopede'){
  for(const limb of root.userData.legs){const bar=mesh(limb.children[0]);bar.position.z*=.55;bar.userData.referencePresentationChange='insect-leg-bar-connected-to-source-pivot';}
  changes.push('Six source leg bars moved inward to meet their existing six hip pivots; no limb removed or reparented.');
 }
 let hasSourceEars=false;head.traverse(object=>{const role:unknown=object.userData.referenceAnatomyRole;if(typeof role==='string'&&/^(left|right)-ear$/.test(role))hasSourceEars=true;});
 if(EAR_ADDITIONS.has(id)&&hasNative('Ear')&&!hasSourceEars){
  skull.geometry.computeBoundingBox();const bounds=skull.geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const width=Math.min(.15,Math.max(.055,size.x*.22)),height=Math.min(.19,Math.max(.055,size.y*.44)),depth=Math.min(.075,Math.max(.025,size.z*.13));
  for(const side of [-1,1]){
   const sample=new THREE.Vector3(center.x-size.x*.24,center.y,center.z+side*size.z*.30);
   const hit=surface(THREE,skull.geometry,1,1,sample),role=side>0?'left-ear':'right-ear';
   const outer=addBox(skull,[width,height,depth],skull.material,[hit.point.x,hit.point.y+height*.39,hit.point.z],`${role}-added`,role);
   outer.rotation.x=side*.12;
   addBox(outer,[width*.61,height*.63,.008],pigment('matPinkEarGouache'),[0,height*.06,side*(depth*.5+.004)],`${role}-inner-added`,role);
   outer.userData.referencePresentationChange='missing-source-ear-native-record-present';earsAdded++;
  }
  changes.push('Two ears anchored into actual skull faces, only because this species has native Ear records.');
 }
 if(TAIL_ADDITIONS.has(id)&&hasNative('Tail')&&(!root.userData.tailGroup||root.userData.tailGroup.children.length===0)){
  const torso=mesh(root.children.find(object=>object instanceof THREE.Mesh));torso.geometry.computeBoundingBox();const bounds=torso.geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3());
  const sample=bounds.getCenter(new THREE.Vector3());sample.y-=size.y*.10;
  const hit=surface(THREE,torso.geometry,0,-1,sample),tail=root.userData.tailGroup??new THREE.Group();
  // Reuse the source empty pivot where present; otherwise one rigid torso
  // appendage is anchored on the torso's actual rear face. No extra bone.
  if(!tail.parent)torso.add(tail);else {tail.removeFromParent();torso.add(tail);}
  tail.position.copy(hit.point);tail.name='tail-added';tail.userData.referenceAnatomyRole='tail';
  const length=id==='guinea_pig'?.055:Math.min(.28,size.x*.25),thickness=Math.min(.055,size.y*.14);
  addBox(tail,[length,thickness,thickness],torso.material,[-length*.46,0,0],'tail-stub-added','tail');
  root.userData.tailGroup=tail;tailsAdded++;changes.push('One small tail added at the actual rear face because a native Tail record exists.');
 }
 if(id==='duck'){
  const neck=mesh(head.children[0]),birdHead=mesh(head.children[1]);birdHead.material=pigment('matReptileGreen');
  neck.geometry.computeBoundingBox();const bounds=neck.geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3());
  addBox(neck,[size.x+.002,Math.min(.036,size.y*.15),size.z+.002],pigment('matCreamWhiteGouache'),[0,bounds.max.y-.018,0],'mallard-neck-collar','neck');
  changes.push('Mallard head uses complete source green paint; a cream collar follows its neck transform.');
 }
 if(id==='raccoon'){
  // Keep the complete authored amber eye paint legible over the charcoal
  // facial mask; changing material leaves the actual eye geometry, surface
  // clearance, orientation and clinical ownership untouched.
  head.traverse(object=>{if(object instanceof THREE.Mesh&&/^(left|right)-eye$/.test(String(object.userData.referenceAnatomyRole)))object.material=pigment('matBoomSacAmber');});
  // Two projected cheek patches use genuine source charcoal paint. UVs are
  // complete unit charts; the same fill/pigment metric pipeline applies.
  skull.geometry.computeBoundingBox();const bounds=skull.geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  for(const side of [-1,1]){
   const positions:number[]=[],normals:number[]=[],uv:number[]=[];
   const corners=[[-.32,-.10],[.42,-.10],[.42,.31],[-.32,.31]] as const;
   const hits=corners.map(([x,y])=>surface(THREE,skull.geometry,2,side,new THREE.Vector3(center.x+x*size.x,center.y+y*size.y,center.z)));
   const order=side>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],charts=[[0,0],[1,0],[1,1],[0,1]] as const;
   for(const at of order){const hit=hits[at],point=hit.point.clone().addScaledVector(hit.normal,.00035);positions.push(...point.toArray());normals.push(...hit.normal.toArray());uv.push(...charts[at]);}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   const mask=new THREE.Mesh(geometry,pigment('matCharcoalGouache')) as BestiaryMesh;mask.name=`raccoon-mask-${side}`;mask.userData.referenceAnatomyRole='head';mask.userData.referenceAuthoredAdaptation=true;mask.userData.referenceEdgeAngle=22;skull.add(mask);addedPieces++;
  }
  const tail=root.userData.tailGroup?.children.find(object=>object instanceof THREE.Mesh);
  if(tail){const carrier=mesh(tail);carrier.geometry.computeBoundingBox();const bounds=carrier.geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   for(let band=0;band<5;band++)addBox(carrier,[size.x+.001,size.y*.13,size.z+.001],pigment(band%2===0?'matCharcoalGouache':'matCreamWhiteGouache'),[center.x,bounds.min.y+size.y*(.12+band*.18),center.z],`raccoon-tail-band-${band}`,'tail');
  }
  changes.push('Two charcoal facial patches, contrasting source-amber eyes and five charcoal/cream tail bands use full source paint profiles. A visible source tail without a native Tail record remains torso-owned.');
 }
 return Object.freeze({changes:Object.freeze(changes),earsAdded,tailsAdded,addedPieces});
}
