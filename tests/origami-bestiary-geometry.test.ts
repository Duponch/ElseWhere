import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import {animalParts} from '../src/render/animal-shape';
import {corpseVisualPartBit} from '../src/render/corpse-presentation';
import {animalCore256} from '../src/sim/animal-core-v256';
import {CORE_ANIMAL_BODIES_256} from '../src/sim/animal-anatomy-data-v256';
import {animalPartId256} from '../src/sim/animal-anatomy-v256';
import {growPawnBuffers} from '../src/render/pawn-buffers';
import {animalVisualParts256} from '../src/render/animal-visual-parts-v256';
import {createRigBrushGeometry} from '../src/render/origami/rig-brush';
import {ORIGAMI_ANIMAL_SPECIES,ORIGAMI_ANIMAL_REFERENCES,origamiAnimalPresentationGeometry,origamiAnimalReferenceInfo} from '../src/render/origami/animal-geometry';
import {createBestiaryReference} from '../src/render/origami/bestiary-reference.literal';
import {BESTIARY_NEW_SPECIES} from '../src/render/origami/bestiary-geometry';
import {referencePaintProfiles,PROTECTED_REFERENCE_PAINT_DESCRIPTORS} from '../src/render/origami/reference-profiles';
import type {BestiaryFactory,BestiaryGroup,ThreeAPI} from '../src/render/origami/bestiary-types';

const original=readFileSync(new URL('./fixtures/origami-bestiary46-source.js-fragment.txt',import.meta.url),'utf8');
// Only the independently extracted geometry factory is evaluated, never the
// HTML's DOM, painter, renderer, listeners, animation loop or script bootstrap.
const createOriginal=new Function(original.replace('export function createBestiaryReference','return function createBestiaryReference'))() as (api:ThreeAPI)=>BestiaryFactory;
function disposeSource(root:THREE.Object3D):void{root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});}
function disposeGeometry(geometry:THREE.InstancedBufferGeometry):void{(geometry.userData.origamiWear as THREE.BufferGeometry|undefined)?.dispose();(geometry.userData.origamiLines as THREE.BufferGeometry|undefined)?.dispose();geometry.dispose();}
function snapshot(root:BestiaryGroup){
 root.updateMatrixWorld(true);const rows:unknown[]=[];
 root.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const material=object.material;if(Array.isArray(material))throw Error('Unexpected array material');
  const attributes=Object.fromEntries(['position','normal','uv'].map(name=>{const attr=object.geometry.getAttribute(name);return[name,Array.from({length:attr.count*attr.itemSize},(_,i)=>attr.getComponent(Math.floor(i/attr.itemSize),i%attr.itemSize))];}));
  rows.push({matrix:object.matrixWorld.toArray(),attributes,paint:material.userData.referencePaintConfig});
 });return rows;
}

describe('additional bestiary joins the real resident species geometry',()=>{
 it('pins the independent literal and ports35 canonical recipes without changing source vertices/UV/palettes',()=>{
  expect(createHash('sha256').update(original).digest('hex')).toBe('425b69a408fdea62b7bd8ca61b80abe04de1146a81790025f659f01c4a781780');
  const source=createOriginal(THREE),port=createBestiaryReference(THREE);expect(Object.keys(BESTIARY_NEW_SPECIES)).toHaveLength(35);
  for(const id of Object.values(BESTIARY_NEW_SPECIES)){const a=source.build(id),b=port.build(id);try{expect(snapshot(b),id).toEqual(snapshot(a));}finally{disposeSource(a);disposeSource(b);}}
 });
 it('covers all53 current species while distinguishing35 source recipes,7 adaptations and11 protected identities',()=>{
  expect([...ORIGAMI_ANIMAL_SPECIES].sort()).toEqual([...ANIMAL_SPECIES_IDS].sort());expect(new Set(ORIGAMI_ANIMAL_SPECIES).size).toBe(53);
  expect(Object.keys(ORIGAMI_ANIMAL_REFERENCES)).toHaveLength(11);
  const kinds=ORIGAMI_ANIMAL_SPECIES.map(species=>origamiAnimalReferenceInfo(species)!.kind);
  expect(kinds.filter(kind=>kind==='existing-reference')).toHaveLength(11);expect(kinds.filter(kind=>kind==='new-reference')).toHaveLength(35);expect(kinds.filter(kind=>kind==='explicit-adaptation')).toHaveLength(7);
  for(const species of ['thrumbo','chicken','not-a-species']){expect(origamiAnimalReferenceInfo(species)).toBeUndefined();expect(origamiAnimalPresentationGeometry(1,species)).toBeUndefined();}
 });
 it('binds42 new product assets to real native masks and bone sets, finite UVs and a shared33-float owner stream',()=>{
  for(const species of ORIGAMI_ANIMAL_SPECIES.filter(species=>!ORIGAMI_ANIMAL_REFERENCES[species])){
   const geometry=origamiAnimalPresentationGeometry(16,species)!;
   try{
    expect(geometry.userData.origamiLines).toBeUndefined(); // runtime has no unused prebuilt second brush
    const wear=geometry.userData.origamiWear as THREE.InstancedBufferGeometry,position=geometry.getAttribute('position'),part=geometry.getAttribute('animalPart'),uv=geometry.getAttribute('animalPaintUv');
    const from=geometry.getAttribute('aFrom') as THREE.InterleavedBufferAttribute;expect(from.data).toBeInstanceOf(THREE.InstancedInterleavedBuffer);expect(from.data.stride).toBe(33);expect(from.count).toBe(16);
    expect(wear.getAttribute('aFrom')).toBe(from);expect(wear.getAttribute('aBiology')).toBe(geometry.getAttribute('aBiology'));expect(geometry.instanceCount).toBe(0);expect(wear.instanceCount).toBe(0);
    const actualBones=new Set<number>(),allowed=new Set(animalVisualParts256(species)!.map((_,index)=>2**index));let open=0,closed=0;
    for(let at=0;at<position.count;at++){
     expect(Number.isFinite(position.getX(at)+position.getY(at)+position.getZ(at)+uv.getX(at)+uv.getY(at))).toBe(true);
     expect(allowed.has(part.getY(at)),`${species}/${at}`).toBe(true);actualBones.add(part.getX(at));if(part.getW(at)===0)open++;if(part.getW(at)===1)closed++;
    }
    expect([...actualBones].sort()).toEqual([...new Set(animalParts(species).map(part=>part.bone))].sort());expect(open).toBeGreaterThan(0);expect(closed).toBeGreaterThan(0);
    expect(Number.isFinite(geometry.userData.origamiReferenceLength)&&geometry.userData.origamiReferenceLength>0).toBe(true);expect(geometry.userData.origamiBodyCenter).toBeGreaterThan(0);
    expect(wear.userData.referenceWearBasePositions.length).toBe(wear.getAttribute('position').count*3);
    const paint=geometry.getAttribute('animalPaint');for(let at=0;at<paint.count;at++){const id=paint.getW(at);expect(id).toBeGreaterThanOrEqual(PROTECTED_REFERENCE_PAINT_DESCRIPTORS.length);expect(referencePaintProfiles()[id].key).toMatch(/^best46:/);}
   }finally{disposeGeometry(geometry);}
  }
 });
 it('keeps clinical static vertices and all owner aliases through genuine resident buffer growth',()=>{
  const source=origamiAnimalPresentationGeometry(16,'megaspider')!,brush=createRigBrushGeometry(source),wear=source.userData.origamiWear as THREE.InstancedBufferGeometry;
  const material=new THREE.MeshBasicMaterial(),meshes=[source,brush,wear].map(geometry=>new THREE.Mesh(geometry,material));
  const staticPositions=Array.from((source.getAttribute('position') as THREE.InterleavedBufferAttribute).data.array),parts=source.getAttribute('animalPart'),masks=Array.from({length:parts.count},(_,index)=>parts.getY(index));
  (source.getAttribute('aFrom') as THREE.InterleavedBufferAttribute).setXYZW(0,9,8,7,6);source.instanceCount=brush.instanceCount=wear.instanceCount=16;
  growPawnBuffers(meshes,130);
  try{
   const main=meshes[0].geometry,from=main.getAttribute('aFrom');expect(from.count).toBe(256);expect([from.getX(0),from.getY(0),from.getZ(0),from.getW(0)]).toEqual([9,8,7,6]);
   for(const mesh of meshes){const attribute=mesh.geometry.getAttribute('aFrom') as THREE.InterleavedBufferAttribute;expect(attribute.data).toBe((from as THREE.InterleavedBufferAttribute).data);expect(mesh.geometry.getAttribute('aBiology').count).toBe(256);}
   const position=main.getAttribute('position') as THREE.InterleavedBufferAttribute;expect(Array.from(position.data.array)).toEqual(staticPositions);const next=main.getAttribute('animalPart');expect(Array.from({length:next.count},(_,index)=>next.getY(index))).toEqual(masks);
  }finally{for(const mesh of meshes)mesh.geometry.dispose();material.dispose();}
 });
 it('keeps the iguana tail and both independent boar tusks on their actual clinical records',()=>{
  const iguana=origamiAnimalPresentationGeometry(1,'iguana')!,part=iguana.getAttribute('animalPart'),position=iguana.getAttribute('position');
  try{let rear=0;for(let at=1;at<position.count;at++)if(position.getZ(at)<position.getZ(rear))rear=at;expect(part.getY(rear)).toBe(corpseVisualPartBit('tail','iguana'));}finally{disposeGeometry(iguana);}
  const boar=origamiAnimalPresentationGeometry(1,'wild-boar')!;
  try{const body=animalCore256('wild-boar').race.body,rows=CORE_ANIMAL_BODIES_256[body],tuples=rows.filter(row=>row.defId==='Tusk'),bits=new Set(Array.from({length:boar.getAttribute('animalPart').count},(_,at)=>boar.getAttribute('animalPart').getY(at)));
   expect(tuples).toHaveLength(2);const expected=tuples.map(row=>corpseVisualPartBit(animalPartId256(body,row.index),'wild-boar'));expect(new Set(expected).size).toBe(2);for(const bit of expected)expect(bits.has(bit)).toBe(true);
  }finally{disposeGeometry(boar);}
 });
});
