import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {buildOrigamiFloraReference,compileOrigamiFloraReference,disposeOrigamiFloraReferenceParts,ORIGAMI_FLORA_REFERENCES,type OrigamiFloraReference} from '../src/render/origami/flora-reference';
import type {ReferencePaintConfig} from '../src/render/origami/reference-painter';

// Independent literal extraction of the supplied HTML: original part decorator,
// prism/cutout helpers, shared pink profile, eight flora profiles and all builders.
// Only the wear Mesh decoration is inert for this body-artwork oracle.
const original=readFileSync(new URL('./fixtures/origami-flora-source.html-fragment.txt',import.meta.url),'utf8');
const builders=new Function('THREE','registerGouacheMat','kraftEdgeMaterial','allCardboardEdgeLines','createPhysicalEdgeWearMesh',original+
  '\nreturn {poplar:buildPoplarTree,oak:buildOakTree,pine:buildPineTree,cactus:buildCactus,acacia:buildAcaciaTree,bush:buildBush};')(
  THREE,(config:ReferencePaintConfig)=>{const material=new THREE.MeshBasicMaterial({color:config.baseColor});material.userData.referencePaintConfig=config;return material;},new THREE.LineBasicMaterial(),[],()=>null,
) as Record<OrigamiFloraReference,()=>THREE.Group>;
type RefMesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
function meshes(group:THREE.Group):RefMesh[]{const result:RefMesh[]=[];group.updateMatrixWorld(true);group.traverse(o=>{if(o instanceof THREE.Mesh)result.push(o as RefMesh);});return result;}
function dispose(group:THREE.Group):void{group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments)o.geometry.dispose();});}
const counts:Record<OrigamiFloraReference,number>={poplar:9,oak:9,pine:5,cactus:6,acacia:7,bush:12};

describe('Origami flora retains every supplied part and authored surface',()=>{
  it('pins the independent source fragment',()=>{
    expect(createHash('sha256').update(original).digest('hex')).toBe('5714286d970b8235def9d986bace74aa41115d75b61a21a89309da60bef57825');
  });
  for(const name of ORIGAMI_FLORA_REFERENCES){
    it(name+': keeps every original primitive, transform, color, profile and raw UV',()=>{
      const expectedRoot=builders[name](),actualRoot=buildOrigamiFloraReference(name);
      const expected=meshes(expectedRoot),actual=meshes(actualRoot);
      expect(actual).toHaveLength(counts[name]);expect(actual).toHaveLength(expected.length);
      for(let i=0;i<expected.length;i++){
        expect(actual[i].matrixWorld.elements).toEqual(expected[i].matrixWorld.elements);
        expect(actual[i].material.color.toArray()).toEqual(expected[i].material.color.toArray());
        expect(actual[i].material.userData.referencePaintConfig).toEqual(expected[i].material.userData.referencePaintConfig);
        for(const attribute of ['position','normal','uv'])expect(Array.from(actual[i].geometry.getAttribute(attribute).array),name+' part '+i+' '+attribute).toEqual(Array.from(expected[i].geometry.getAttribute(attribute).array));
        const originalEdges=expected[i].children.find(o=>o instanceof THREE.LineSegments) as THREE.LineSegments<THREE.BufferGeometry>;
        const portEdges=new THREE.EdgesGeometry(actual[i].geometry,actual[i].userData.referenceEdgeAngle);
        expect(Array.from(portEdges.getAttribute('position').array)).toEqual(Array.from(originalEdges.geometry.getAttribute('position').array));
        portEdges.dispose();
      }
      dispose(expectedRoot);dispose(actualRoot);
    });

    it(name+': compiles source matrixWorld into batch geometry without changing UVs',()=>{
      const originalRoot=builders[name](),expected=meshes(originalRoot),actual=compileOrigamiFloraReference(name);
      expect(actual).toHaveLength(expected.length);
      for(let i=0;i<expected.length;i++){
        const transformed=expected[i].geometry.clone().applyMatrix4(expected[i].matrixWorld);
        expect(actual[i].id).toBe(name+':'+i);
        expect(actual[i].partMatrix.elements).toEqual(expected[i].matrixWorld.elements);
        expect(actual[i].baseColor).toBe(expected[i].material.color.getHex());
        expect(Number.isInteger(actual[i].profileId)).toBe(true);expect(actual[i].profileId).toBeGreaterThanOrEqual(0);
        for(const attribute of ['position','normal','uv']){
          expect(Array.from(actual[i].geometry.getAttribute(attribute).array)).toEqual(Array.from(transformed.getAttribute(attribute).array));
          expect(Array.from(actual[i].sourceGeometry.getAttribute(attribute).array)).toEqual(Array.from(expected[i].geometry.getAttribute(attribute).array));
        }
        transformed.dispose();
      }
      disposeOrigamiFloraReferenceParts(actual);dispose(originalRoot);
    });
  }

  it('separates real canopy and berries from bark and cactus body for existing visibility routing',()=>{
    const oak=compileOrigamiFloraReference('oak'),bush=compileOrigamiFloraReference('bush'),cactus=compileOrigamiFloraReference('cactus');
    expect(oak.filter(p=>p.canopy)).toHaveLength(5);expect(oak.filter(p=>!p.canopy)).toHaveLength(4);
    expect(bush.filter(p=>p.fruit)).toHaveLength(6);expect(bush.filter(p=>p.canopy)).toHaveLength(6);
    expect(cactus.filter(p=>p.profileKey==='matCactusGreen').every(p=>!p.canopy&&!p.fruit)).toBe(true);
    expect(cactus.find(p=>p.profileKey==='matPinkEarGouache')!.canopy).toBe(true);
    for(const parts of [oak,bush,cactus])disposeOrigamiFloraReferenceParts(parts);
  });
});
