/** Finite geometry-only surface vocabulary. Every texture style uses these
 * same corners and UVs; continuous resource placement is kept by the caller. */
import * as THREE from 'three/webgpu';
import {TreeModels,TREE_MODEL_SPECIES} from './TreeModels';
import {ReferenceFloraLibrary} from '../origami/resource-flora';
import {compileNaturalSurfaceModels} from '../surfaces/NaturalSurfaceModels';
import {compileResourceLegacyCoverage,type ResourceLegacyCoverage,type ResourceLegacyModel} from '../surfaces/ResourceLegacyCoverage';
import type {GraphicsStyleContext} from '../graphics-style';

export function createResourceSurfaceModels(trees:TreeModels,flora:ReferenceFloraLibrary){
 const source=new Map<string,THREE.BufferGeometry>([
  ['trunk',new THREE.CylinderGeometry(.1,.16,1,5)],['rock',new THREE.DodecahedronGeometry(1,0)],
  ['blade',new THREE.BoxGeometry(1,1,1)],['cactus',new THREE.CylinderGeometry(.5,.5,1,5)],
  ['bush',new THREE.IcosahedronGeometry(1,0)],['berry',new THREE.IcosahedronGeometry(.055,0)],
  ['broadleaf',new THREE.IcosahedronGeometry(1,0)],['conical',new THREE.ConeGeometry(1,1,6)],
 ]),borrowed:THREE.BufferGeometry[]=[];
 for(const variant of ['broadleaf','conical'] as const)for(const species of [...TREE_MODEL_SPECIES,undefined]){
  const model=trees.get(species,variant);for(const p of model.parts)if(!borrowed.includes(p.geometry))borrowed.push(p.geometry);
 }
 for(const p of flora.recipe('bush').parts)borrowed.push(p.geometry);
 const all=[...source.values(),...borrowed];let bank:ReturnType<typeof compileNaturalSurfaceModels>|undefined,coverage:ResourceLegacyCoverage|undefined;
 try{
  bank=compileNaturalSurfaceModels(all);
  if(bank.stroke.faceCount>4096)throw Error('Resource surface vocabulary exceeds exact packed face domain');
  const bySource=new Map(all.map((g,i)=>[g,bank!.geometries[i]!])),byKind=new Map([...source.keys()].map((key,i)=>[key,bank!.geometries[i]!]));
  const maskModels:ResourceLegacyModel[]=[];
  for(const variant of ['broadleaf','conical']as const)for(const species of [...TREE_MODEL_SPECIES,undefined]){const layout=trees.get(species,variant).createAtlasLayout();for(const part of layout.canonicalParts){const mapped=bySource.get(part.geometry);if(!mapped)throw Error('Canonical tree fallback model was not mapped');maskModels.push({mapped,layout,triangleOffset:part.triangleOffset,triangleCount:part.geometry.getAttribute('position').count/3});}}
  coverage=compileResourceLegacyCoverage(maskModels,bank.stroke.faceCount);const masks=coverage;
  return{stroke:bank.stroke,cpuBytes:bank.cpuBytes+masks.cpuBytes,coverageCpuBytes:masks.cpuBytes,coverageGpuBytes:masks.gpuBytes,legacyCoverage:masks,
   coverage:(context:GraphicsStyleContext,raw:THREE.Node<'vec2'>,faceProfile:THREE.Node<'float'>,faceId:THREE.Node<'float'>,atlasUv:THREE.Node<'vec2'>,probe?:'x'|'y')=>masks.node(context,raw,faceProfile,faceId,atlasUv,probe),
   get(kind:string){const geometry=byKind.get(kind);if(!geometry)throw Error('Unknown resource primitive');return geometry;},
   map(geometry:THREE.BufferGeometry){const mapped=bySource.get(geometry);if(!mapped)throw Error('Resource model was not admitted in the finite surface vocabulary');return mapped;},
   dispose:()=>{const errors:unknown[]=[];try{masks.dispose();}catch(error){errors.push(error);}try{bank!.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Resource Source models/masks cleanup');}};
 }catch(error){coverage?.dispose();bank?.dispose();throw error;}finally{for(const g of source.values())g.dispose();}
}
