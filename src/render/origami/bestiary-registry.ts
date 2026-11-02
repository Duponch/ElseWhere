import * as THREE from 'three/webgpu';
import {bestiaryPaintProfile} from './reference-profiles';
import {createBestiaryReference} from './bestiary-reference.literal';
import {createBestiaryPresentation} from './bestiary-presentation';
import {createBestiaryAdaptations,BESTIARY_ADAPTATION_MANIFEST,type BestiaryAdaptationId} from './bestiary-adaptations';
import {BESTIARY_NEW_SPECIES,compileBestiaryAnimalBody,type CompiledBestiaryGeometry} from './bestiary-geometry';
import type {BestiaryFactory,BestiaryGroup,RegisterMaterial} from './bestiary-types';
import type {CompiledAnimalCargoBack} from './animal-cargo-back';

export interface OrigamiAnimalReferenceInfo {
 readonly kind:'existing-reference'|'new-reference'|'explicit-adaptation';
 readonly status:'reference'|'origami';readonly referenceId:string;readonly sourceKey:string;
 readonly parent?:string;readonly variant?:string;readonly changes:readonly string[];readonly sourceSha256?:string;
}
const SOURCE_SHA='2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed';
const adaptationIds=Object.keys(BESTIARY_ADAPTATION_MANIFEST.species) as BestiaryAdaptationId[];
export const BESTIARY_ANIMAL_SPECIES:readonly string[]=Object.freeze([...Object.keys(BESTIARY_NEW_SPECIES),...adaptationIds]);
const information=new Map<string,OrigamiAnimalReferenceInfo>();
for(const [species,referenceId]of Object.entries(BESTIARY_NEW_SPECIES))information.set(species,Object.freeze({kind:'new-reference',status:'reference',referenceId,sourceKey:`best46:${referenceId}`,sourceSha256:SOURCE_SHA,
 changes:Object.freeze(['Présentation adaptée : yeux sur les faces, joints et détails autorisés ; recette canonique conservée.'])}));
for(const species of adaptationIds){const descriptor=BESTIARY_ADAPTATION_MANIFEST.species[species];information.set(species,Object.freeze({kind:'explicit-adaptation',status:'origami',referenceId:species,sourceKey:`best46:${descriptor.parent}`,parent:descriptor.parent,variant:species,sourceSha256:SOURCE_SHA,changes:descriptor.changes}));}
export function bestiaryAnimalReferenceInfo(species:string):OrigamiAnimalReferenceInfo|undefined{return information.get(species);}

let factories:{canonical:BestiaryFactory;presentation:BestiaryFactory;adapted:BestiaryFactory}|undefined;
function sourceFactories():NonNullable<typeof factories>{
 if(factories)return factories;
 const register:RegisterMaterial=(key,config)=>{
  const material=new THREE.MeshBasicMaterial({color:config.baseColor});
  material.userData.referencePaintIndex=bestiaryPaintProfile(key);
  material.userData.referencePaintProfileKey=`best46:${key}`;return material;
 };
 const canonical=createBestiaryReference(THREE,register),presentation=createBestiaryPresentation(THREE,undefined,undefined,canonical);
 factories={canonical,presentation,adapted:createBestiaryAdaptations(THREE,undefined,undefined,presentation)};return factories;
}
export function buildBestiaryAnimal(species:string,presentation=true):BestiaryGroup|undefined {
 if(!information.has(species))return;
 const sources=sourceFactories(),reference=BESTIARY_NEW_SPECIES[species];
 return reference?(presentation?sources.presentation:sources.canonical).build(reference):sources.adapted.build(species);
}

type CompiledBody=Omit<CompiledBestiaryGeometry,'brush'>;
const compiled=new Map<string,CompiledBody>();
function cached(species:string,presentation:boolean):CompiledBody|undefined {
 const key=`${species}:${presentation?'presentation':'canonical'}`,found=compiled.get(key);if(found)return found;
 const root=buildBestiaryAnimal(species,presentation);if(!root)return;
 try{
  const result=compileBestiaryAnimalBody(species,root,material=>{
   const profile:unknown=material.userData.referencePaintIndex;if(typeof profile!=='number')throw Error('Unregistered bestiary paint profile');return profile;
  });
  compiled.set(key,result);return result;
 }finally{root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});}
}
/** New attribute views share immutable compiled CPU arrays. Mutable wear gets
 * its own interleaved positions, exactly like the earlier reference path. No
 * brush graph is retained: SpeciesRig owns its single actual ribbon geometry. */
function instantiate(source:THREE.InstancedBufferGeometry,mutable=false):THREE.InstancedBufferGeometry {
 const geometry=new THREE.InstancedBufferGeometry(),buffers=new Map<THREE.InterleavedBuffer,THREE.InterleavedBuffer>();
 for(const [name,attribute]of Object.entries(source.attributes)){
  if(attribute instanceof THREE.InterleavedBufferAttribute){
   let buffer=buffers.get(attribute.data);if(!buffer){buffer=new THREE.InterleavedBuffer(mutable?attribute.data.array.slice():attribute.data.array,attribute.data.stride);buffers.set(attribute.data,buffer);}
   geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(buffer,attribute.itemSize,attribute.offset,attribute.normalized));
  }else geometry.setAttribute(name,new THREE.BufferAttribute(attribute.array,attribute.itemSize,attribute.normalized));
 }
 geometry.userData={...source.userData};geometry.instanceCount=0;return geometry;
}
export function bestiaryAnimalGeometry(capacity:number,species:string,presentation=true):THREE.InstancedBufferGeometry|undefined {
 const template=cached(species,presentation);if(!template)return;
 const geometry=instantiate(template.body),wear=instantiate(template.wear,true),instances=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*33),33).setUsage(THREE.StaticDrawUsage);
 for(const [name,size,offset]of [['aFrom',4,0],['aTo',4,4],['aTravel',4,8],['aAnimal',4,12],['aScale',1,16],['aBodyBlood',1,17],['aAbsent',1,18],['aCarrier',4,19],['aCorpseHandoff',2,23],['aCorpseFrom',4,25],['aCorpseTo',4,29],['aBiology',3,16]] as const){
  const attribute=new THREE.InterleavedBufferAttribute(instances,size,offset);geometry.setAttribute(name,attribute);wear.setAttribute(name,attribute);
 }
 geometry.userData.origamiWear=wear;geometry.userData.origamiReferenceInfo=information.get(species);return geometry;
}
export function bestiaryAnimalBodyCenter(species:string):number|undefined{return cached(species,true)?.body.userData.origamiBodyCenter;}
/** Borrow the eight immutable numbers from the presentation template. This
 * follows its existing lazy compile cache; it never instantiates actor buffers. */
export function bestiaryAnimalCargoBack(species:string):CompiledAnimalCargoBack|undefined{return cached(species,true)?.body.userData.origamiCargoBack;}
/** Shared read-only source corners for first adoption of each cargo variant. */
export function bestiaryAnimalCargoTorso(species:string):Float32Array|undefined{return cached(species,true)?.body.userData.origamiCargoTorso;}
