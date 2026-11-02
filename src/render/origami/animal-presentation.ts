import * as THREE from 'three/webgpu';
import {buildOrigamiAnimalReference,type OrigamiAnimalReference} from './animal-reference';
import {normalizeCutoutPaintUvs} from './face-paint-uv';

type Part=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
type Point=readonly [number,number,number];
interface Ring {point:Point;width:number;depth?:number;tangent?:Point}

/** Explicit user corrections to the product presentation. The supplied source
 * builder and its independent fixture remain unchanged and separately callable.
 * All adjustments happen once before the existing actor batch is compiled. */
export function buildOrigamiAnimalPresentation(kind:OrigamiAnimalReference):THREE.Group {
 const root=buildOrigamiAnimalReference(kind);
 if(kind==='dog')correctDog(root);else if(kind==='elephant')correctElephant(root);else if(kind==='hare')correctHare(root);
 root.userData.presentationCorrections=kind==='dog'?['single-ear','no-collar','ochre-rear']:kind==='elephant'?['continuous-trunk','continuous-tusks','attached-ear-hinges']:kind==='hare'?['inset-pink-ear-face']:[];
 root.updateMatrixWorld(true);return root;
}
function parts(root:THREE.Object3D,name:string):Part[]{const found:Part[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name===name)found.push(object as Part);});return found;}
function replace(part:Part,geometry:THREE.BufferGeometry):void {part.geometry.dispose();part.geometry=geometry;}
function remove(part:Part):void {part.removeFromParent();part.geometry.dispose();}

/** Closed four-sided loft with shared geometric section boundaries, no caps
 * between segments and no overlapping boxes. Each longitudinal side has one
 * continuous UV interval over the whole chain. Flat normals keep the low-poly
 * surface; duplicated face corners share exactly the same boundary positions. */
export function connectedAnimalLoft(rings:readonly Ring[]):THREE.BufferGeometry {
 if(rings.length<2)throw new Error('Animal loft requires at least two sections');
 const centers=rings.map(r=>new THREE.Vector3(...r.point)),sections:THREE.Vector3[][]=[],lengths=[0];
 for(let i=1;i<rings.length;i++)lengths.push(lengths[i-1]!+centers[i]!.distanceTo(centers[i-1]!));
 for(let i=0;i<rings.length;i++){
  const ring=rings[i]!,tangent=ring.tangent?new THREE.Vector3(...ring.tangent):centers[Math.min(i+1,rings.length-1)]!.clone().sub(centers[Math.max(0,i-1)]!);
  tangent.normalize();const across=new THREE.Vector3(-tangent.y,tangent.x,0).normalize(),depth=new THREE.Vector3().crossVectors(tangent,across).normalize();
  sections.push([[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>centers[i]!.clone().addScaledVector(across,u!*ring.width*.5).addScaledVector(depth,v!*(ring.depth??ring.width)*.5)));
 }
 const positions:number[]=[],uvs:number[]=[];
 const emit=(point:THREE.Vector3,u:number,v:number)=>{positions.push(point.x,point.y,point.z);uvs.push(u,v);};
 for(let i=0;i<rings.length-1;i++)for(let side=0;side<4;side++){
  const a=sections[i]![side]!,b=sections[i]![(side+1)%4]!,c=sections[i+1]![(side+1)%4]!,d=sections[i+1]![side]!,v0=lengths[i]!/lengths.at(-1)!,v1=lengths[i+1]!/lengths.at(-1)!;
  emit(a,0,v0);emit(b,1,v0);emit(c,1,v1);emit(a,0,v0);emit(c,1,v1);emit(d,0,v1);
 }
 for(const [ring,order]of [[0,[0,3,2,0,2,1]],[rings.length-1,[0,1,2,0,2,3]]] as const)for(const corner of order){const point=sections[ring]![corner]!;emit(point,corner===1||corner===2?1:0,corner>=2?1:0);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
 geometry.userData.presentationLoftRings=sections.map(section=>section.map(point=>point.toArray()));return geometry;
}

function correctDog(root:THREE.Group):void {
 const chest=parts(root,'chest')[0]!,waist=parts(root,'waist')[0]!;waist.material=chest.material;
 for(const collar of parts(root,'collar'))remove(collar);
 for(const flap of parts(root,'earFlap'))remove(flap);
 for(const ear of parts(root,'earBase')){
  const side=Math.sign(ear.position.z),shape=new THREE.Shape();shape.moveTo(-.08,0);shape.lineTo(.08,0);shape.lineTo(.025,.24);shape.closePath();
  const indexed=new THREE.ExtrudeGeometry(shape,{depth:.05,bevelEnabled:false,steps:1});indexed.translate(0,0,-.025);
  const geometry=indexed.index?indexed.toNonIndexed():indexed;geometry.computeVertexNormals();if(geometry!==indexed)indexed.dispose();const painted=normalizeCutoutPaintUvs(geometry);geometry.dispose();replace(ear,painted);
  ear.position.set(.02,.215,side*.17);ear.rotation.set(side*.12,0,-.12);ear.scale.set(1,1,1);
 }
}
function correctElephant(root:THREE.Group):void {
 const trunk=parts(root,'tSeg1')[0]!;
 replace(trunk,connectedAnimalLoft([
  {point:[.015,-.02,0],width:.24,tangent:[1,0,0]},
  {point:[.08,-.36,0],width:.21},
  {point:[.13,-.68,0],width:.17},
  {point:[.27,-.88,0],width:.12},
 ]));trunk.position.set(0,0,0);trunk.rotation.set(0,0,0);trunk.scale.set(1,1,1);
 for(const name of ['tSeg2','tSeg3'])for(const part of parts(root,name))remove(part);
 for(const tusk of parts(root,'tusk1')){
  const side=Math.sign(tusk.position.z),geometry=connectedAnimalLoft([
   {point:[.34,-.235,side*.22],width:.09,tangent:[1,0,0]},
   {point:[.61,-.34,side*.25],width:.07},
   {point:[.82,-.22,side*.28],width:.006},
  ]);geometry.translate(0,0,-side*.22);replace(tusk,geometry);
  // The mesh origin retains its real side for the existing clinical owner
  // mapper; geometry is otherwise expressed in the same head-local frame.
  tusk.position.set(0,0,side*.22);tusk.rotation.set(0,0,0);tusk.scale.set(1,1,1);
 }
 for(const part of parts(root,'tusk2'))remove(part);
 for(const ear of parts(root,'earPlate')){
  const pivot=ear.parent!,side=Math.sign(pivot.position.z),geometry=ear.geometry.clone();geometry.computeBoundingBox();const bounds=geometry.boundingBox!,position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++){const u=(position.getX(i)-bounds.min.x)/(bounds.max.x-bounds.min.x);position.setY(i,position.getY(i)*(.78+.22*u));}
  position.needsUpdate=true;geometry.computeVertexNormals();replace(ear,normalizeCutoutPaintUvs(geometry));geometry.dispose();
  // Centered source cutout X=-.25 is its hinge. Rotation maps its broad XY
  // face into head YZ; mirroring the rotation makes both ears open outward.
  pivot.position.set(.06,-.02,side*.335);pivot.rotation.set(0,-side*.18,0);
  ear.position.set(0,0,side*.25);ear.rotation.set(0,-side*Math.PI*.5,0);ear.scale.set(1,1,1);
 }
}
function correctHare(root:THREE.Group):void {
 for(const inner of parts(root,'earInner')){
  const pivot=inner.parent!,side=Math.sign(pivot.position.z),positions:number[]=[],uvs:number[]=[];
  const low=.065,high=.37,corner=(right:boolean,y:number)=>{const progress=(y+.02)/.48,halfWidth=.06-.033*progress-(y===low?.018:.014),halfDepth=.025-.01*progress;return new THREE.Vector3((right?1:-1)*halfWidth,y,side*(halfDepth+.0015));};
  const points=[corner(false,low),corner(true,low),corner(true,high),corner(false,high)],order=side>0?[0,1,2,0,2,3]:[0,2,1,0,3,2];
  for(const i of order){positions.push(...points[i]!.toArray());uvs.push(i===1||i===2?1:0,i>=2?1:0);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();replace(inner,geometry);
  inner.position.set(0,0,0);inner.rotation.set(0,0,0);inner.scale.set(1,1,1);
 }
}
