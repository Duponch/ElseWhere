import {createHash} from 'node:crypto';
import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubResidentPaintToSink} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
import {origamiAnimalPresentationGeometry,origamiAnimalCachedWearBytes,ORIGAMI_ANIMAL_SPECIES} from '../src/render/origami/animal-geometry';
import {origamiHumanGeometry} from '../src/render/origami/human-geometry';
import {createReferenceEdgeGeometry} from '../src/render/origami/reference-edges';
import {createRigBrushGeometry} from '../src/render/origami/rig-brush';
import {growPawnBuffers} from '../src/render/pawn-buffers';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {PawnLayer} from '../src/render/PawnLayer';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {buildBestiaryAnimal} from '../src/render/origami/bestiary-registry';
import {compileBestiaryAnimalBody} from '../src/render/origami/bestiary-geometry';

function digest(geometry:THREE.BufferGeometry):string {
 const hash=createHash('sha256');
 for(const name of Object.keys(geometry.attributes).sort()){
  const attribute=geometry.getAttribute(name);
  if(attribute instanceof THREE.InstancedBufferAttribute||attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data instanceof THREE.InstancedInterleavedBuffer)continue;
  hash.update(`${name}:${attribute.itemSize}:${attribute.count}:${attribute.normalized};`);
  const values=new Float32Array(attribute.count*attribute.itemSize);
  for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=attribute.getComponent(i,c);
  hash.update(new Uint8Array(values.buffer));
 }
 if(geometry.index)hash.update(new Uint8Array(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength));
 return hash.digest('hex');
}
function disposeGeometry(geometry:THREE.BufferGeometry):void {
 for(const key of ['origamiLines','origamiWear']){const companion:unknown=geometry.userData[key];if(companion instanceof THREE.BufferGeometry)companion.dispose();}
 geometry.dispose();
}
function invoke(target:object,name:string,...args:unknown[]):unknown {
 const method:unknown=Reflect.get(target,name);if(typeof method!=='function')throw Error('Missing presentation seam '+name);
 return Reflect.apply(method,target,args);
}

describe('zero wear omits actor work at construction, not only visibility',()=>{
 it('adds positive wear to an already compiled body without compiling/copying its body or cargo arrays again',()=>{
  const root=buildBestiaryAnimal('alpaca')!;
  const profile=(material:THREE.MeshBasicMaterial):number=>material.userData.referencePaintIndex;
  const zero=compileBestiaryAnimalBody('alpaca',root,profile,false),before=digest(zero.body),torso=zero.body.userData.origamiCargoTorso;
  const positive=compileBestiaryAnimalBody('alpaca',root,profile,true,zero.body);
  try{
   expect(positive.body).toBe(zero.body);expect(positive.wear).toBeInstanceOf(THREE.InstancedBufferGeometry);
   expect(digest(positive.body)).toBe(before);expect(positive.body.userData.origamiCargoTorso).toBe(torso);
   expect(Object.hasOwn(zero.body.userData,'origamiWear')).toBe(false);
  }finally{positive.wear?.dispose();zero.body.dispose();root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});}
 });
 it('keeps autonomous canonical defaults while explicitly omitting physical wear at the edge generator',()=>{
  const source=new THREE.BoxGeometry(1,1,1),on=createReferenceEdgeGeometry(source),off=createReferenceEdgeGeometry(source,22,false);
  try{expect(on.wear).toBeInstanceOf(THREE.BufferGeometry);expect(off.wear).toBeNull();expect(digest(off.surface)).toBe(digest(on.surface));expect(digest(off.lines)).toBe(digest(on.lines));}
  finally{source.dispose();for(const result of [on,off]){result.surface.dispose();result.lines.dispose();result.wear?.dispose();}}
 });
 it('omits wear for every53 species while replacing dedicated cached wear and preserving shared bodies/ribbons',()=>{
  expect(ORIGAMI_ANIMAL_SPECIES).toHaveLength(53);
  for(const species of ORIGAMI_ANIMAL_SPECIES){
   const zero=origamiAnimalPresentationGeometry(2,species,false)!,positive=origamiAnimalPresentationGeometry(2,species)!;
   expect(origamiAnimalCachedWearBytes(species),species).toBeGreaterThan(0);
   const again=origamiAnimalPresentationGeometry(2,species,false)!;
   const zeroBrush=createRigBrushGeometry(zero),positiveBrush=createRigBrushGeometry(positive);
   try{
    expect(Object.hasOwn(zero.userData,'origamiWear'),species).toBe(false);expect(Object.hasOwn(again.userData,'origamiWear'),species).toBe(false);
    expect(origamiAnimalCachedWearBytes(species),`${species}: no cache retains dedicated wear`).toBe(0);
    expect(positive.userData.origamiWear,species).toBeInstanceOf(THREE.InstancedBufferGeometry);
    const a=zero.getAttribute('position') as THREE.InterleavedBufferAttribute,b=positive.getAttribute('position') as THREE.InterleavedBufferAttribute,c=again.getAttribute('position') as THREE.InterleavedBufferAttribute;
    expect(a.data.array,species).toBe(b.data.array);expect(c.data.array,species).toBe(b.data.array);
    expect(digest(zero),species).toBe(digest(positive));expect(digest(again),species).toBe(digest(positive));expect(digest(zeroBrush),species).toBe(digest(positiveBrush));
    expect(zeroBrush.userData.referenceWearBasePositions,species).toBeUndefined();
    const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(zero,material);
    try{growPawnBuffers([mesh],513);expect(mesh.geometry.getAttribute('aFrom').count,species).toBeGreaterThanOrEqual(513);expect(Object.hasOwn(mesh.geometry.userData,'origamiWear'),species).toBe(false);}
    finally{mesh.geometry.dispose();material.dispose();}
   }finally{zeroBrush.dispose();positiveBrush.dispose();for(const geometry of [zero,positive,again])disposeGeometry(geometry);}
  }
 },60_000);
 it('drops only cache ownership across off/rollback/on while older positive rigs remain valid and independent',()=>{
  // Original, directly sourced new and adapted recipes exercise both caches.
  for(const species of ['muffalo','alpaca','elk']){
   const before=origamiAnimalPresentationGeometry(2,species,true)!,oldWear=before.userData.origamiWear as THREE.InstancedBufferGeometry,bodyHash=digest(before),wearHash=digest(oldWear),metadata=before.userData;
   const oldPosition=oldWear.getAttribute('position'),oldArray=oldPosition instanceof THREE.InterleavedBufferAttribute?oldPosition.data.array:oldPosition.array;
   const disposal=vi.spyOn(oldWear,'dispose');let off:THREE.InstancedBufferGeometry|undefined,rollback:THREE.InstancedBufferGeometry|undefined,finalOff:THREE.InstancedBufferGeometry|undefined;
   try{
    expect(origamiAnimalCachedWearBytes(species),species).toBeGreaterThan(0);
    off=origamiAnimalPresentationGeometry(2,species,false)!;
    expect(origamiAnimalCachedWearBytes(species),species).toBe(0);
    expect(disposal,species).not.toHaveBeenCalled();expect(before.userData).toBe(metadata);expect(before.userData.origamiWear).toBe(oldWear);
    expect(digest(before),species).toBe(bodyHash);expect(digest(oldWear),species).toBe(wearHash);
    // A replacement that is abandoned before publication must not invalidate
    // an older displayed rig. A subsequent preparation can rebuild the wear.
    disposeGeometry(off);off=undefined;
    rollback=origamiAnimalPresentationGeometry(2,species,true)!;
    const newWear=rollback.userData.origamiWear as THREE.InstancedBufferGeometry,newPosition=newWear.getAttribute('position'),newArray=newPosition instanceof THREE.InterleavedBufferAttribute?newPosition.data.array:newPosition.array;
    expect(newWear,species).not.toBe(oldWear);expect(newArray,species).not.toBe(oldArray);expect(digest(newWear),species).toBe(wearHash);expect(digest(rollback),species).toBe(bodyHash);
    const originalX=oldPosition.getX(0),nextX=newPosition.getX(0);newPosition.setX(0,nextX+.125);expect(oldPosition.getX(0),species).toBe(originalX);newPosition.setX(0,nextX);
    finalOff=origamiAnimalPresentationGeometry(2,species,false)!;
    expect(origamiAnimalCachedWearBytes(species),species).toBe(0);
    expect(Object.hasOwn(finalOff.userData,'origamiWear'),species).toBe(false);expect(digest(oldWear),species).toBe(wearHash);expect(digest(newWear),species).toBe(wearHash);expect(disposal,species).not.toHaveBeenCalled();
   }finally{disposal.mockRestore();for(const geometry of [before,off,rollback,finalOff])if(geometry)disposeGeometry(geometry);}
  }
 },60_000);
 it('keeps all human anatomy/apparel/tool streams and ribbons exact while allocating no wear geometry or wear ranges',()=>{
  const zero=origamiHumanGeometry(true,true,true,true,false),positive=origamiHumanGeometry(true,true,true,true),a=createRigBrushGeometry(zero),b=createRigBrushGeometry(positive);
  try{
   expect(Object.hasOwn(zero.userData,'origamiWear')).toBe(false);expect(Object.hasOwn(zero.userData,'origamiHumanWearParts')).toBe(false);
   expect(positive.userData.origamiWear).toBeInstanceOf(THREE.InstancedBufferGeometry);expect(positive.userData.origamiHumanWearParts.length).toBeGreaterThan(0);
   expect(digest(zero)).toBe(digest(positive));expect(digest(a)).toBe(digest(b));expect(zero.userData.origamiHumanParts).toEqual(positive.userData.origamiHumanParts);expect(zero.userData.origamiHumanLineParts).toEqual(positive.userData.origamiHumanLineParts);
  }finally{a.dispose();b.dispose();disposeGeometry(zero);disposeGeometry(positive);}
 });
 it('constructs a real zero-wear PawnLayer, extends equipment and prepares pipelines without a wear material, mesh, track or compile',async()=>{
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',wear:0});
  // Lifecycle/geometry contract only: skip Canvas admission, keep real factories,
  // node graphs and source geometry. No renderer/device/World is constructed.
  const flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),create=vi.spyOn(context,'createWearMaterial'),track=vi.spyOn(context,'trackWearGeometry');
  const layer=withGraphicsStyle(context,()=>new PawnLayer());
  const compiled:THREE.Object3D[]=[];
  const compiler={compileAsync:async(object:THREE.Object3D)=>{compiled.push(object);}};
  try{
   invoke(layer,'createPawnMesh',2);
   expect(Reflect.get(layer,'origamiWearMesh')).toBeNull();
   const first=Reflect.get(layer,'pawnMesh') as THREE.Mesh;
   expect(Object.hasOwn(first.geometry.userData,'origamiWear')).toBe(false);
   invoke(layer,'extendResidentGeometry',true,true,true,true);
   const body=Reflect.get(layer,'pawnMesh') as THREE.Mesh;
   expect(Object.hasOwn(body.geometry.userData,'origamiWear')).toBe(false);expect(Reflect.get(layer,'origamiWearMesh')).toBeNull();
   expect(Reflect.get(layer,'origamiLineMesh')).toBeInstanceOf(THREE.Mesh);
   await layer.prepareBodyPipelines(compiler as unknown as THREE.WebGPURenderer,new THREE.Scene(),[new THREE.OrthographicCamera()],async()=>{});
   expect(compiled.length).toBeGreaterThan(0);expect(compiled.every(object=>!object.name.includes('physical edge wear'))).toBe(true);
   expect(create).not.toHaveBeenCalled();expect(track).not.toHaveBeenCalled();expect(Reflect.get(context,'wearGeometries').size).toBe(0);
  }finally{layer.dispose();context.dispose();create.mockRestore();track.mockRestore();flush.mockRestore();}
 });
 it('constructs all real resident animal rigs without dedicated wear meshes/materials/registration',()=>{
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',wear:0});
  const flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),create=vi.spyOn(context,'createWearMaterial'),track=vi.spyOn(context,'trackWearGeometry');
  const layer=withGraphicsStyle(context,()=>new WildlifeLayer());
  try{
   const rigs=Reflect.get(layer,'rigs') as {mesh:THREE.Mesh;origamiLines?:THREE.Mesh;origamiWear?:THREE.Mesh}[];
   expect(rigs).toHaveLength(53);
   for(const rig of rigs){expect(rig.origamiWear).toBeUndefined();expect(rig.origamiLines).toBeInstanceOf(THREE.Mesh);expect(Object.hasOwn(rig.mesh.geometry.userData,'origamiWear')).toBe(false);}
   const restore=layer.prepare();restore();layer.setTexturesEnabled(false);layer.setTexturesEnabled(true);
   expect(create).not.toHaveBeenCalled();expect(track).not.toHaveBeenCalled();expect(Reflect.get(context,'wearGeometries').size).toBe(0);
  }finally{layer.dispose();context.dispose();create.mockRestore();track.mockRestore();flush.mockRestore();}
 },60_000);
});
