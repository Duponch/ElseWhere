import type * as Three from 'three/webgpu';
import type {ThreeAPI,BestiaryFactory,BestiaryGroup,BestiaryMesh,BestiaryMaterial,ReferenceSurfaceHit,RegisterMaterial,CreatePart} from './bestiary-types';
import {normalizeCutoutPaintUvs} from './face-paint-uv';
import {polishNewAnimalPresentation} from './bestiary-polish';
import {annotateSourceAnimal} from './bestiary-metadata';
interface EyePlan {readonly target:number;readonly eyes?:readonly number[]}
// New bestiary presentation adaptations, deliberately separate from literal recipes.
// Construction-time CPU work only. No product imports, renderer or frame work.
import {createBestiaryReference} from './bestiary-reference.literal';

const EYE_PLANS:Readonly<Record<string,EyePlan>>=Object.freeze({
 thrumbo:{target:1,eyes:[3,4]},boomalope:{target:0,eyes:[1,3]},boomrat:{target:0,eyes:[1,3]},
 megasloth:{target:0},megaspider:{target:0,eyes:[2,4]},spelopede:{target:0,eyes:[2,4]},
 warg:{target:0,eyes:[2,5]},grizzly:{target:0,eyes:[3,5]},polar_bear:{target:0,eyes:[3,5]},
 cougar:{target:0,eyes:[2,4]},panther:{target:0,eyes:[2,4]},lynx:{target:0,eyes:[2,4]},
 timber_wolf:{target:0,eyes:[3,6]},fennec:{target:0,eyes:[3,6]},
 bison:{target:0},yak:{target:0},rhino:{target:0},horse:{target:1},donkey:{target:1},alpaca:{target:1},
 caribou:{target:1,eyes:[3,6]},ibex:{target:0},boar:{target:0},
 ostrich:{target:1},emu:{target:1},cassowary:{target:1},turkey:{target:1},chicken:{target:1},duck:{target:1},
 tortoise:{target:0},iguana:{target:0},cobra:{target:0},
 capybara:{target:0},chinchilla:{target:0},raccoon:{target:0},squirrel:{target:0},guinea_pig:{target:0},
});

// A ray/triangle query in the geometry's own coordinates, independent of scene
// visibility and Box3 approximations. Flat paper faces stay authoritative.
export function referenceSurfaceHit(THREE:ThreeAPI,geometry:Three.BufferGeometry,axis:number,side:number,coordinates:Three.Vector3):ReferenceSurfaceHit{
 geometry.computeBoundingBox();const bounds=geometry.boundingBox;
 if(!bounds)throw Error('No reference surface bounds');
 const extent=new THREE.Vector3().subVectors(bounds.max,bounds.min),origin=coordinates.clone();
 origin.setComponent(axis,(side>0?bounds.max:bounds.min).getComponent(axis)+side*(extent.length()+1));
 const direction=new THREE.Vector3().setComponent(axis,-side),ray=new THREE.Ray(origin,direction);
 const p=geometry.getAttribute('position'),index=geometry.getIndex(),count=index?.count??p.count;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),point=new THREE.Vector3();
 let best=Infinity,result:ReferenceSurfaceHit|undefined;
 for(let at=0;at+2<count;at+=3){
  a.fromBufferAttribute(p,index?index.getX(at):at);
  b.fromBufferAttribute(p,index?index.getX(at+1):at+1);
  c.fromBufferAttribute(p,index?index.getX(at+2):at+2);
  if(!ray.intersectTriangle(a,b,c,false,point))continue;
  const distance=point.distanceToSquared(origin);if(distance>=best)continue;
  const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
  if(normal.dot(direction)>0)normal.negate();
  best=distance;result={point:point.clone(),normal};
 }
 if(!result)throw Error('Reference face ray missed; adaptation requires review');
 return result;
}

/** Adds or relocates two closed eye boxes onto the actual broad side faces.
 * Existing eye colours and dimensions are preserved; absent source eyes use
 * source charcoal. Parent mesh transforms/rig ownership are inherited exactly.
 * Standalone export permits the separately documented seven missing species. */
export function addSurfaceEyes(THREE:ThreeAPI,target:BestiaryMesh,material:BestiaryMaterial,existing:readonly BestiaryMesh[]=[]):BestiaryMesh[]{
 target.geometry.computeBoundingBox();const bounds=target.geometry.boundingBox;
 if(!bounds)throw Error('Missing eye carrier bounds');
 const size=new THREE.Vector3().subVectors(bounds.max,bounds.min),center=new THREE.Vector3().addVectors(bounds.max,bounds.min).multiplyScalar(.5);
 const h=Math.min(.06,Math.max(.025,size.y*.13)),depth=Math.min(.025,Math.max(.012,h*.42));
 const results:BestiaryMesh[]=[];
 for(const [slot,side] of [-1,1].entries()){
  const mesh=existing[slot]??new THREE.Mesh(new THREE.BoxGeometry(h,h,depth).toNonIndexed(),material);
  mesh.geometry.computeBoundingBox();const own=mesh.geometry.boundingBox!;
  const ownDepth=own.max.z-own.min.z;
  const sample=center.clone();sample.x+=size.x*.20;sample.y+=size.y*.12;
  const surface=referenceSurfaceHit(THREE,target.geometry,2,side,sample);
  mesh.removeFromParent();target.add(mesh);
  mesh.position.copy(surface.point).addScaledVector(surface.normal,ownDepth*.5+.001);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),surface.normal);
  mesh.name=side>0?'left-eye':'right-eye';
  mesh.userData.referencePresentationChange=existing[slot]?'eye-surface-anchor':'missing-source-eye-added';
  mesh.userData.referenceAnatomyRole=mesh.name;
  mesh.userData.referenceEyeSurface={point:surface.point.toArray(),normal:surface.normal.toArray(),clearance:.001};
  results.push(mesh);
 }
 return results;
}

function requireReferenceMesh(object:Three.Object3D|undefined):BestiaryMesh {
 if(!object||!('isMesh' in object)||object.isMesh!==true)throw Error('Expected source mesh');
 return object as BestiaryMesh;
}
function anchorIbexHorns(THREE:ThreeAPI,head:Three.Group,sourceChildren:readonly Three.Object3D[]){
 const carrier=requireReferenceMesh(sourceChildren[0]);carrier.updateMatrix();
 const changes=[];
 for(const [slot,side] of [-1,1].entries()){
  const horn=requireReferenceMesh(sourceChildren[slot+1]);

  // The source bar is retained. Its forward end becomes an embedded root;
  // the backwards end now rises away from the skull instead of floating.
  const surface=referenceSurfaceHit(THREE,carrier.geometry,1,1,new THREE.Vector3(-.02,0,side*.10));
  const anchor=surface.point.clone().addScaledVector(surface.normal,-.018).applyMatrix4(carrier.matrix);
  horn.rotation.set(side*.22,0,-.55);
  const root=new THREE.Vector3(.31,0,0).applyEuler(horn.rotation);
  horn.position.copy(anchor).sub(root);
  horn.name=side>0?'left-horn':'right-horn';
  horn.userData.referenceAnatomyRole=horn.name;
  horn.userData.referencePresentationChange='ibex-horn-root-anchor';
  horn.userData.referenceHornAnchor=anchor.toArray();
  changes.push({side,anchor:anchor.toArray(),sourcePartIndex:slot+1});
 }
 return changes;
}

export function createBestiaryPresentation(THREE:ThreeAPI,registerMaterial?:RegisterMaterial,createPart?:CreatePart,reference?:BestiaryFactory){
 function requireReferenceMesh(object:Three.Object3D|undefined):BestiaryMesh {
  if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.MeshBasicMaterial))throw Error('Expected one basic-material source mesh');
  return object as BestiaryMesh;
 }
 const canonical=reference??createBestiaryReference(THREE,registerMaterial,createPart);
 const charcoal=canonical.materialRecords.find(row=>row.key==='matCharcoalGouache')?.material;
 if(!charcoal)throw Error('Missing source charcoal material');
 const correctionManifest=Object.freeze({
  scope:'35 new mapped species plus two unbound source references; eleven existing identities excluded',
  eyes:'Two surface-anchored closed boxes; existing pigments/dimensions retained, absent source eyes added in source charcoal.',
  ibex:'Source horn bars retained, roots embedded .018 into the actual skull surface, bars directed backwards/upwards.',
  canonicalModified:false,productionIntegrated:true,
 });
 return Object.freeze({ids:canonical.ids,materialRecords:canonical.materialRecords,correctionManifest,
  build(id:string):BestiaryGroup{
   if(!Object.hasOwn(EYE_PLANS,id))throw Error('Not a new presentation reference: '+id);
   const root=canonical.build(id),head=root.userData.headGroup,plan=EYE_PLANS[id];
   if(!head)throw Error('Source head metadata missing: '+id);
   const sourceChildren=head.children.slice(),target=requireReferenceMesh(sourceChildren[plan.target]);

   annotateSourceAnimal(THREE,id,root,sourceChildren);
   let ordinal=0;root.traverse(object=>{if(object instanceof THREE.Mesh)object.userData.referenceSourcePartOrdinal=ordinal++;});
   const eyes=(plan.eyes??[]).map(at=>requireReferenceMesh(sourceChildren[at]));
   const eyePigments=new Set(['matCharcoalGouache','matBoomSacAmber','matCrimsonWattle']);
   if(eyes.some(mesh=>!eyePigments.has(mesh.material.userData.referencePaintKey)))throw Error('Source eye topology changed: '+id);
   const installed=addSurfaceEyes(THREE,target,charcoal,eyes);
   const horns=id==='ibex'?anchorIbexHorns(THREE,head,sourceChildren):[];
   const polish=polishNewAnimalPresentation(THREE,id,root,canonical.materialRecords,referenceSurfaceHit);
   root.traverse(object=>{if(object instanceof THREE.Mesh&&object.geometry.userData.paperCutout){const original=object.geometry;object.geometry=normalizeCutoutPaintUvs(original);original.dispose();}});
   root.userData.referencePresentation={id,eyesAdded:plan.eyes?0:2,eyesAnchored:2,horns,polish,canonicalSourceUnchanged:true};
   root.userData.referenceEyeMeshes=installed;
   return root;
  }
 });
}
