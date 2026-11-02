import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {buildOrigamiAnimalReference} from '../src/render/origami/animal-reference';
import {buildOrigamiAnimalPresentation} from '../src/render/origami/animal-presentation';
import {origamiAnimalGeometry,origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';

type Part=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
function named(root:THREE.Object3D,name:string):Part[]{const result:Part[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name===name)result.push(o as Part);});return result;}
function dispose(root:THREE.Object3D):void{root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
function closedSurface(geometry:THREE.BufferGeometry):void {
 const p=geometry.getAttribute('position'),edges=new Map<string,number>(),key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
 for(let i=0;i<p.count;i+=3)for(const [a,b]of [[i,i+1],[i+1,i+2],[i+2,i]]){const ends=[key(a!),key(b!)].sort();expect(ends[0]).not.toBe(ends[1]);const edge=ends.join('|');edges.set(edge,(edges.get(edge)??0)+1);}
 for(const count of edges.values())expect(count).toBe(2);
}
describe('explicit animal presentation corrections leave reference artwork callable',()=>{
 it('gives dogs one closed ear per side anchored in the head, no collar and the requested ochre rear',()=>{
  const source=buildOrigamiAnimalReference('dog'),product=buildOrigamiAnimalPresentation('dog');
  try{
   expect(named(source,'earFlap')).toHaveLength(2);expect(named(source,'collar')).toHaveLength(1);expect(named(product,'earFlap')).toHaveLength(0);expect(named(product,'collar')).toHaveLength(0);
   expect(named(product,'waist')[0]!.material).toBe(named(product,'chest')[0]!.material);expect(named(source,'waist')[0]!.material.color.getHex()).toBe(0x3b2d23);
   const skull=named(product,'skull')[0]!;skull.geometry.computeBoundingBox();const ears=named(product,'earBase');expect(ears).toHaveLength(2);
   for(const ear of ears){closedSurface(ear.geometry);const hinge=skull.worldToLocal(ear.localToWorld(new THREE.Vector3()));expect(skull.geometry.boundingBox!.containsPoint(hinge)).toBe(true);}
  }finally{dispose(source);dispose(product);}
 });
 it('makes elephant trunk and tusks closed continuous surfaces with no intermediate caps or duplicate segments',()=>{
  const product=buildOrigamiAnimalPresentation('elephant');
  try{
   expect(named(product,'tSeg1')).toHaveLength(1);expect(named(product,'tSeg2')).toHaveLength(0);expect(named(product,'tSeg3')).toHaveLength(0);expect(named(product,'tusk1')).toHaveLength(2);expect(named(product,'tusk2')).toHaveLength(0);
   for(const mesh of [...named(product,'tSeg1'),...named(product,'tusk1')]){closedSurface(mesh.geometry);const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');expect(p.count).toBeLessThanOrEqual(84);for(let i=0;i<uv.count;i++){expect(uv.getX(i)).toBeGreaterThanOrEqual(0);expect(uv.getX(i)).toBeLessThanOrEqual(1);expect(uv.getY(i)).toBeGreaterThanOrEqual(0);expect(uv.getY(i)).toBeLessThanOrEqual(1);}}
   expect(named(product,'tusk1').map(mesh=>Math.sign(mesh.position.z)).sort()).toEqual([-1,1]);
   const ears=named(product,'earPlate');expect(ears).toHaveLength(2);
   for(const ear of ears){const side=Math.sign(ear.parent!.position.z),hinge=ear.localToWorld(new THREE.Vector3(-.25,0,0));const head=product.userData.headGroup as THREE.Object3D;head.worldToLocal(hinge);expect(Math.abs(hinge.x-.06)).toBeLessThan(1e-7);expect(Math.abs(hinge.z-side*.335)).toBeLessThan(1e-7);const outer=ear.localToWorld(new THREE.Vector3(.29,0,0));head.worldToLocal(outer);expect(side*outer.z).toBeGreaterThan(.8);}
  }finally{dispose(product);}
 });
 it('places hare pink on the broad outside plane with a visible rim and positive clearance',()=>{
  const product=buildOrigamiAnimalPresentation('hare');
  try{for(const inner of named(product,'earInner')){const side=Math.sign(inner.parent!.position.z),p=inner.geometry.getAttribute('position');expect(p.count).toBe(6);for(let i=0;i<p.count;i++){const y=p.getY(i),v=(y+.02)/.48,outerHalfWidth=.06-.033*v,outerHalfDepth=.025-.01*v;expect(outerHalfWidth-Math.abs(p.getX(i))).toBeGreaterThan(.0139);expect(side*p.getZ(i)-outerHalfDepth).toBeCloseTo(.0015,7);expect(y).toBeGreaterThan(.06);expect(y).toBeLessThan(.38);}}}finally{dispose(product);}
 });
 it('compiles corrected product meshes through a separate cache while retaining canonical geometry and ownership',()=>{
  const canonical=origamiAnimalGeometry(1,'labrador-retriever')!,snapshot=Array.from(canonical.getAttribute('position').array),product=origamiAnimalPresentationGeometry(1,'labrador-retriever')!;
  try{expect(product.userData.origamiPresentationCorrections).toBe(true);expect(canonical.userData.origamiPresentationCorrections).toBe(false);expect(product.getAttribute('position').count).toBeLessThan(canonical.getAttribute('position').count);expect(Array.from(canonical.getAttribute('position').array)).toEqual(snapshot);for(const name of ['animalPart','animalPaint','bindPivot','aFrom','aAbsent','aBodyBlood'])expect(product.hasAttribute(name)).toBe(true);}finally{for(const geometry of [canonical,product]){(geometry.userData.origamiLines as THREE.BufferGeometry).dispose();(geometry.userData.origamiWear as THREE.BufferGeometry).dispose();geometry.dispose();}}
 });
});
