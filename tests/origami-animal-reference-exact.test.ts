import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {buildOrigamiAnimalReference,type OrigamiAnimalReference,type ReferencePigment} from '../src/render/origami/animal-reference';
import {origamiAnimalGeometry,ORIGAMI_ANIMAL_REFERENCES} from '../src/render/origami/animal-geometry';

// This fixture is a literal extraction of the supplied HTML, from its original
// createCardboardPart through buildElephant. It is deliberately independent of
// the production port. The edge decorator is disabled for this body-geometry
// oracle only; the original position/normal/UV builders themselves are executed.
const original=readFileSync(new URL('./fixtures/origami-animal-source.html-fragment.txt',import.meta.url),'utf8');
const originalEdges=readFileSync(new URL('./fixtures/origami-edge-source.html-fragment.txt',import.meta.url),'utf8');
const createOriginalWear=new Function('THREE','physicalEdgeWearMaterial','currentEdgeWearPct','currentEdgeOpacityPct','allPhysicalEdgeMeshes',originalEdges+'\nreturn createPhysicalEdgeWearMesh;')(
  THREE,new THREE.MeshBasicMaterial(),75,65,[],
) as (geometry:THREE.BufferGeometry,edges:THREE.BufferGeometry)=>RefMesh|null;
const referenceBuilders=new Function('THREE','registerGouacheMat','kraftEdgeMaterial','allCardboardEdgeLines','createPhysicalEdgeWearMesh',original+
  '\nreturn {fox:buildFox,camel:buildCamel,hare:buildHare,dog:buildDog,buffalo:buildBuffalo,gazelle:buildGazelle,deer:buildDeer,elephant:buildElephant};')(
  THREE,(config:ReferencePigment)=>{const mat=new THREE.MeshBasicMaterial({color:config.baseColor});mat.userData.referencePaintConfig=config;return mat;},
  new THREE.LineBasicMaterial(),[],()=>null,
) as Record<OrigamiAnimalReference,()=>THREE.Group>;
type RefMesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
function meshes(group:THREE.Group):RefMesh[]{const result:RefMesh[]=[];group.updateMatrixWorld(true);group.traverse(o=>{if(o instanceof THREE.Mesh)result.push(o as RefMesh);});return result;}
function dispose(group:THREE.Group):void {group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments)o.geometry.dispose();});}

describe('Origami body artwork is the exact supplied animal reference',()=>{
  it('pins the independent literal source extraction',()=>{
    expect(createHash('sha256').update(originalEdges).digest('hex')).toBe('16d20a6c6d90eabb5fcb721bb55343493de363194c464884786fdcc3df6e9c8b');
    expect(createHash('sha256').update(original).digest('hex')).toBe('bde166b7591d7afafe309b21e881f0d9ea4c9278d0f5d42e07c54a79207c3d69');
  });
  for(const reference of ['fox','camel','hare','dog','buffalo','gazelle','deer','elephant'] as const){
    it(`${reference}: retains every original primitive, transform, material configuration and raw UV`,()=>{
      const expectedRoot=referenceBuilders[reference](),actualRoot=buildOrigamiAnimalReference(reference);
      const expected=meshes(expectedRoot),actual=meshes(actualRoot);
      expect(actual.length).toBe(expected.length);
      for(let part=0;part<expected.length;part++){
        expect(actual[part].matrixWorld.elements).toEqual(expected[part].matrixWorld.elements);
        expect(actual[part].material.userData.referencePaintConfig).toEqual(expected[part].material.userData.referencePaintConfig);
        expect(actual[part].material.color.toArray()).toEqual(expected[part].material.color.toArray());
        for(const attribute of ['position','normal','uv'])expect(Array.from(actual[part].geometry.getAttribute(attribute).array),`${reference} part ${part} ${attribute}`).toEqual(Array.from(expected[part].geometry.getAttribute(attribute).array));
      }
      dispose(expectedRoot);dispose(actualRoot);
    });
  }
  for(const [species,reference] of Object.entries(ORIGAMI_ANIMAL_REFERENCES)){
    it(`${species}: zero body vertex/normal/UV/color difference after the sole uniform scale and axis/origin transform`,()=>{
      const source=referenceBuilders[reference](),g=origamiAnimalGeometry(1,species)!;
      const scale=g.userData.origamiReferenceScale as number,floor=g.userData.origamiReferenceFloor as number;
      const expectedPosition:number[]=[],expectedNormal:number[]=[],expectedUV:number[]=[],expectedColor:number[]=[];
      const point=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix3();
      for(const mesh of meshes(source)){
        const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');matrix.getNormalMatrix(mesh.matrixWorld);
        for(let i=0;i<p.count;i++){
          point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);normal.fromBufferAttribute(n,i).applyNormalMatrix(matrix);
          expectedPosition.push(-point.z*scale,(point.y-floor)*scale,point.x*scale);
          expectedNormal.push(-normal.z,normal.y,normal.x);expectedUV.push(uv.getX(i),uv.getY(i));expectedColor.push(...mesh.material.color.toArray());
        }
      }
      const part=g.getAttribute('animalPart'),position=g.getAttribute('position'),normalAttr=g.getAttribute('normal'),uv=g.getAttribute('animalPaintUv'),paint=g.getAttribute('animalPaint');
      const actualPosition:number[]=[],actualNormal:number[]=[],actualUV:number[]=[],actualColor:number[]=[];
      for(let i=0;i<position.count;i++){
        // Crossed corpse eyes are the existing state-only overlay, invisible
        // for living animals; they are not counted as supplied body artwork.
        if(part.getW(i)===1)continue;
        actualPosition.push(position.getX(i),position.getY(i),position.getZ(i));actualNormal.push(normalAttr.getX(i),normalAttr.getY(i),normalAttr.getZ(i));actualUV.push(uv.getX(i),uv.getY(i));actualColor.push(paint.getX(i),paint.getY(i),paint.getZ(i));
        expect(Number.isInteger(paint.getW(i))).toBe(true);expect(paint.getW(i)).toBeGreaterThanOrEqual(0);
      }
      expect(actualPosition).toEqual(Array.from(new Float32Array(expectedPosition)));
      expect(actualNormal).toEqual(Array.from(new Float32Array(expectedNormal)));
      expect(actualUV).toEqual(Array.from(new Float32Array(expectedUV)));
      expect(actualColor).toEqual(Array.from(new Float32Array(expectedColor)));
      expect(g.userData.origamiParts).toBe(meshes(source).length);dispose(source);g.dispose();
    });
    it(`${species}: batches every original line endpoint and physical wear strip with shared actor attributes`,()=>{
      const source=referenceBuilders[reference](),g=origamiAnimalGeometry(2,species)!;
      const lines=g.userData.origamiLines as THREE.InstancedBufferGeometry,wear=g.userData.origamiWear as THREE.InstancedBufferGeometry;
      expect(lines.index).toBeNull();expect(wear.index).toBeNull();expect(lines.getAttribute('position').count%2).toBe(0);
      for(const companion of [lines,wear])for(const name of ['aFrom','aTo','aTravel','aAnimal','aBiology','aCarrier','aCorpseHandoff','aCorpseFrom','aCorpseTo'])expect(companion.getAttribute(name)).toBe(g.getAttribute(name));
      const scale=g.userData.origamiReferenceScale as number,floor=g.userData.origamiReferenceFloor as number;
      const endpoints:number[]=[],bases:number[]=[],directions:number[]=[],normals:number[]=[],uvs:number[]=[];
      const point=new THREE.Vector3(),direction=new THREE.Vector3(),normal=new THREE.Vector3();
      const toWorld=(p:THREE.Vector3)=>p.set(-p.z*scale,(p.y-floor)*scale,p.x*scale);
      let bodyVertex=0,lineVertex=0,wearVertex=0;
      for(const mesh of meshes(source)){
        const originalLine=mesh.children.find(o=>o instanceof THREE.LineSegments) as THREE.LineSegments;
        const edge=originalLine.geometry.getAttribute('position'),originalWear=createOriginalWear(mesh.geometry,originalLine.geometry)!;
        const base=originalWear.geometry.userData.basePosArray as Float32Array,expand=originalWear.geometry.userData.expandDirArray as Float32Array;
        const n=originalWear.geometry.getAttribute('normal'),uv=originalWear.geometry.getAttribute('uv'),linear=new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        for(let i=0;i<edge.count;i++){
          point.fromBufferAttribute(edge,i).applyMatrix4(mesh.matrixWorld);toWorld(point);endpoints.push(...point.toArray());
          expect(lines.getAttribute('animalPart').getX(lineVertex+i)).toBe(g.getAttribute('animalPart').getX(bodyVertex));expect(lines.getAttribute('animalPart').getY(lineVertex+i)).toBe(g.getAttribute('animalPart').getY(bodyVertex));expect(lines.getAttribute('animalPart').getW(lineVertex+i)).toBe(g.getAttribute('animalPart').getW(bodyVertex));
        }
        for(let i=0;i<base.length;i+=3){
          point.fromArray(base,i).applyMatrix4(mesh.matrixWorld);toWorld(point);bases.push(...point.toArray());
          direction.fromArray(expand,i).applyMatrix3(linear);directions.push(-direction.z*scale,direction.y*scale,direction.x*scale);
          normal.fromBufferAttribute(n,i/3).applyNormalMatrix(normalMatrix);normals.push(-normal.z,normal.y,normal.x);uvs.push(uv.getX(i/3),uv.getY(i/3));
          expect(wear.getAttribute('animalPart').getX(wearVertex+i/3)).toBe(g.getAttribute('animalPart').getX(bodyVertex));expect(wear.getAttribute('animalPart').getY(wearVertex+i/3)).toBe(g.getAttribute('animalPart').getY(bodyVertex));
          for(const companion of [wear])for(const name of ['bindPivot','animalPaint']){
            const attr=companion.getAttribute(name),body=g.getAttribute(name);expect(attr.getX(wearVertex+i/3)).toBe(body.getX(bodyVertex));expect(attr.getY(wearVertex+i/3)).toBe(body.getY(bodyVertex));expect(attr.getZ(wearVertex+i/3)).toBe(body.getZ(bodyVertex));
          }
        }
        lineVertex+=edge.count;wearVertex+=base.length/3;
        const eye=g.getAttribute('animalPart').getW(bodyVertex)===0;bodyVertex+=mesh.geometry.getAttribute('position').count+(eye?72:0);originalWear.geometry.dispose();
      }
      const xyz=(geometry:THREE.BufferGeometry,name:string)=>{const a=geometry.getAttribute(name);return Array.from({length:a.count},(_,i)=>[a.getX(i),a.getY(i),a.getZ(i)]).flat();};
      expect(xyz(lines,'position')).toEqual(Array.from(new Float32Array(endpoints)));
      expect(xyz(wear,'position')).toEqual(Array.from(new Float32Array(bases)));
      expect(Array.from(wear.userData.referenceWearBasePositions as Float32Array)).toEqual(Array.from(new Float32Array(bases)));
      expect(Array.from(wear.userData.referenceWearExpandDirections as Float32Array)).toEqual(Array.from(new Float32Array(directions)));
      expect(xyz(wear,'normal')).toEqual(Array.from(new Float32Array(normals)));
      expect(Array.from(wear.getAttribute('uv').array)).toEqual(Array.from(new Float32Array(uvs)));
      // The slider's mutable stream belongs to this renderer, so two settings
      // contexts cannot alter each other's base position storage.
      const other=origamiAnimalGeometry(2,species)!;expect((other.userData.origamiWear as THREE.BufferGeometry).getAttribute('position').array).not.toBe(wear.getAttribute('position').array);
      for(const body of [g,other]){(body.userData.origamiLines as THREE.BufferGeometry).dispose();(body.userData.origamiWear as THREE.BufferGeometry).dispose();body.dispose();}dispose(source);
    });
  }
});
