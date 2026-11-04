/** Source model/writer and ownership contracts, without renderer, device,
 * paint Canvas or simulation execution. Tiny Gouache pixels are TEST metadata,
 * not an atlas-quality or visual-fidelity oracle. */
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {positionLocal,vec3} from 'three/tsl';
import {FORESTRY_SPECIES_291} from '../src/sim/forestry-content-291';
import type {Resource,World} from '../src/sim/types';
import {WORLD_SCALE} from '../src/world/scale';
import {appendFlora,type FloraParts} from '../src/render/flora-presentation';
import type {Placement} from '../src/render/primitives';
import {mergedInstances,noise} from '../src/render/StaticGeometry';
import {TreeModels,TREE_MODEL_SPECIES,treeModelVariant,treePastelUv,type TreeModel,type TreePrimitiveKind,type TreeModelVariant} from '../src/render/models/TreeModels';
import {createTextureSurface,copyPastelTextureToArray,TEXTURE_SURFACE_SLOT_COUNT,type TextureSurfaceAssets,type TextureSurfaceSlot} from '../src/render/surfaces/TextureSurface';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';

type ExpectedPart={kind:TreePrimitiveKind;canopy:boolean;item:Placement};
// Deliberately independent of createTreePrimitive and treeModelPlacements.
function oldPrimitive(kind:TreePrimitiveKind,variant:TreeModelVariant):THREE.BufferGeometry {
 switch(kind){case 'trunk':return new THREE.CylinderGeometry(.1,.16,1,5);case 'crown':return variant==='broadleaf'?new THREE.IcosahedronGeometry(1,0):new THREE.ConeGeometry(1,1,6);case 'cone':return new THREE.ConeGeometry(1,1,6);case 'cactus':return new THREE.CylinderGeometry(.5,.5,1,5);}
}
function oldPlacements(world:World,r:Resource,turn:number,size:number,variant:TreeModelVariant):ExpectedPart[] {
 if(r.species!==undefined){
  const p:FloraParts={trunks:[],crowns:[],cones:[],bushes:[],blades:[],cacti:[],fruit:[]};appendFlora(p,world,r,turn,size);
  expect([p.bushes.length,p.blades.length,p.fruit.length]).toEqual([0,0,0]);
  return [...p.trunks.map(item=>({kind:'trunk' as const,canopy:false,item})),...p.crowns.map(item=>({kind:'crown' as const,canopy:true,item})),...p.cones.map(item=>({kind:'cone' as const,canopy:true,item})),...p.cacti.map(item=>({kind:'cactus' as const,canopy:false,item}))];
 }
 // Historical anonymous branch: continuous noise77, positive resource keys,
 // no size multiplier or blight tint. Preserve it rather than inventing growth.
 const n=noise(r.x,r.z,77),h=WORLD_SCALE.treeMinHeight+n*(WORLD_SCALE.treeMaxHeight-WORLD_SCALE.treeMinHeight),radius=.8+n*.32,broad=variant==='broadleaf';
 return [
  {kind:'trunk',canopy:false,item:{x:r.x,y:h*.25,z:r.z,sx:1.1,sy:h*.5,sz:1.1,ry:turn,color:0x70573e,key:r.id}},
  {kind:'crown',canopy:true,item:{x:r.x,y:h*(broad?.62:.53),z:r.z,sx:radius,sy:h*(broad?.21:.35),sz:radius,ry:turn,color:n>.65?0x657d56:0x526e50,key:r.id}},
  {kind:'crown',canopy:true,item:{x:r.x,y:h*(broad?.83:.70),z:r.z,sx:radius*.72,sy:h*(broad?.14:.34),sz:radius*.72,ry:turn+.3,color:n>.65?0x81925b:0x688557,key:r.id}},
 ];
}
function stream(g:THREE.BufferGeometry,name:string):number[] {
 const a=g.getAttribute(name),index=g.index,count=index?.count??a.count,out:number[]=[];
 for(let i=0;i<count;i++)for(let k=0;k<a.itemSize;k++)out.push(a.getComponent(index?.getX(i)??i,k));return out;
}
function rawStreams(g:THREE.BufferGeometry){return Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{attribute:a,array:a.array,bytes:new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength).slice()}]));}
function unchanged(g:THREE.BufferGeometry,before:ReturnType<typeof rawStreams>){expect(Object.keys(g.attributes)).toEqual(Object.keys(before));for(const[name,row]of Object.entries(before)){const a=g.getAttribute(name);expect(a).toBe(row.attribute);expect(a.array).toBe(row.array);expect(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)).toEqual(row.bytes);}}
function merged(parts:{geometry:THREE.BufferGeometry;items:Placement[]}[],material:THREE.Material):THREE.Mesh {
 const mesh=mergedInstances(new THREE.Group(),parts,material,true,true,false);if(!mesh)throw Error('Actual Source writer unexpectedly emitted no tree');return mesh;
}
function verifyPrimitive(model:TreeModel):void {
 for(const part of model.parts){const oracle=oldPrimitive(part.primitiveKind,model.variant);
  try{
   for(const name of ['position','normal','uv']){expect(Array.from(part.primitive.getAttribute(name).array)).toEqual(Array.from(oracle.getAttribute(name).array));expect(stream(part.geometry,name)).toEqual(stream(oracle,name));}
   expect(part.primitive.index?.array.constructor).toBe(oracle.index?.array.constructor);expect(Array.from(part.primitive.index?.array??[])).toEqual(Array.from(oracle.index?.array??[]));expect(part.geometry.index).toBeNull();
   const count=oracle.index?.count??oracle.getAttribute('position').count;expect(Array.from(part.sourceCorner)).toEqual(Array.from({length:count},(_,i)=>oracle.index?.getX(i)??i));
   const uv=part.geometry.getAttribute('modelSurfaceUv');expect(uv.itemSize).toBe(3);expect(uv.count).toBe(count);expect(Array.from(uv.array).every(Number.isFinite)).toBe(true);
   const baked=part.geometry.getAttribute('bakedUv');expect(baked?.itemSize).toBe(3);expect(baked?.count).toBe(count);for(let i=0;i<count;i++){expect(baked.getZ(i)).toBe(model.surfaceSlot);expect(baked.getX(i)).toBeGreaterThanOrEqual(0);expect(baked.getX(i)).toBeLessThanOrEqual(1);expect(baked.getY(i)).toBeGreaterThanOrEqual(0);expect(baked.getY(i)).toBeLessThanOrEqual(1);}
   const triangles:number[]=[];for(const face of part.faceSlots){expect(face.id).toBeGreaterThanOrEqual(0);for(const t of face.triangles){triangles.push(t);for(let k=0;k<3;k++)expect(uv.getZ(t*3+k)).toBe(face.id);}}
   expect(triangles.sort((a,b)=>a-b)).toEqual(Array.from({length:count/3},(_,i)=>i));
  }finally{oracle.dispose();}
 }
}

test('shared tree catalogue preserves all Source model variants, anonymous continuous placements and exact Pastel writer streams',()=>{
 const library=new TreeModels(),material=new THREE.MeshLambertNodeMaterial({vertexColors:true});material.userData.rendererOwned=true;
 const slots=new Set<number>(),models:TreeModel[]=[],cases=[{size:.23,turn:0,blight:false},{size:.73,turn:.81,blight:true},{size:1,turn:2.31,blight:false}];
 expect(TREE_MODEL_SPECIES).toEqual(FORESTRY_SPECIES_291);
 try{
  for(const variant of ['broadleaf','conical'] as const)for(const species of [...FORESTRY_SPECIES_291,undefined]){
   const model=library.get(species,variant),layout=model.createAtlasLayout();models.push(model);slots.add(model.surfaceSlot);expect(model.surfaceSlot).toBeGreaterThanOrEqual(0);expect(model.surfaceSlot).toBeLessThan(28);expect(layout.slot).toBe(model.surfaceSlot);expect(layout.charts.atlas.width).toBe(2048);expect(layout.charts.atlas.height).toBe(2048);verifyPrimitive(model);
   const parts=model.parts,sourceSnapshots=parts.map(p=>({primitive:rawStreams(p.primitive),geometry:rawStreams(p.geometry),index:p.primitive.index,indexArray:p.primitive.index?.array,indexBytes:p.primitive.index?.array.slice(),corners:p.sourceCorner.slice()}));
   for(const [at,c]of cases.entries())for(const offset of species===undefined?[0,11]:[0]){
    const r:Resource={id:413+at,kind:'tree',...(species===undefined?{}:{species}),x:7+offset,z:13+offset,amount:40,growth:c.size,...(c.blight?{blight:{since:0,severity:.5,lastHarmTick:0,nextCheck:200,rng:71}}:{})};
    // Renderer-only Source fixture, never an admitted/stepped simulation World.
    const world={seed:61103,rng:123456789,nextId:900,tick:0,resources:[r],structures:[],...(variant==='broadleaf'?{site:{biome:'temperate-forest'}}:{})} as unknown as World,before=JSON.stringify(world);
    expect(treeModelVariant(world)).toBe(variant);const expected=oldPlacements(world,r,c.turn,c.size,variant),placed=model.place(r,c.turn,c.size);if(!placed)throw Error('Actual model refused a Source tree placement');
    expect(placed).toHaveLength(expected.length);expect(placed.map(v=>v.item)).toEqual(expected.map(v=>v.item));expect(placed.map(v=>v.part.primitiveKind)).toEqual(expected.map(v=>v.kind));expect(placed.map(v=>v.part.canopy)).toEqual(expected.map(v=>v.canopy));
    const source=merged(expected.map(row=>({geometry:oldPrimitive(row.kind,variant),items:[row.item]})),material),actual=merged(placed.map(row=>({geometry:row.part.geometry.clone(),items:[row.item]})),material);
    try{
     for(const name of ['position','normal','color','uv'])expect(stream(actual.geometry,name)).toEqual(stream(source.geometry,name));
     // The dedicated UV helper must match the old transformed writer too,
     // including per-resource phases and every unquantized aspect ratio.
     let first=0;for(const row of placed){const uv=treePastelUv(row.part.geometry,row.item);expect(Array.from(uv)).toEqual(stream(source.geometry,'uv').slice(first,first+uv.length));first+=uv.length;}
     expect(first).toBe(stream(source.geometry,'uv').length);
     const sourceRanges=source.userData.resourceRanges,actualRanges=actual.userData.resourceRanges;expect(actualRanges.ranges.map((v:{id:number;start:number;count:number})=>[v.id,v.start,v.count])).toEqual(sourceRanges.ranges.map((v:{id:number;start:number;count:number})=>[v.id,v.start,v.count]));
    }finally{source.geometry.dispose();actual.geometry.dispose();}
    expect(JSON.stringify(world)).toBe(before);expect(library.get(species,variant)).toBe(model);expect(model.parts).toBe(parts);expect(model.createAtlasLayout()).toBe(layout);model.assertCurrent();
   }
   parts.forEach((part,i)=>{const before=sourceSnapshots[i]!;unchanged(part.primitive,before.primitive);unchanged(part.geometry,before.geometry);expect(part.primitive.index).toBe(before.index);expect(part.primitive.index?.array).toBe(before.indexArray);expect(part.primitive.index?.array).toEqual(before.indexBytes);expect(part.sourceCorner).toEqual(before.corners);});
  }
  expect(slots.size).toBe(28);expect(library.snapshot().models).toBe(28);library.dispose();for(const model of models)expect(()=>model.assertCurrent()).toThrow('retired');
 }finally{library.dispose();material.dispose();}
},45_000);

test('a real shared tree model swaps texture assets without replacing its material, geometry, poses, lighting or borrowed owners',()=>{
 const models=new TreeModels(),model=models.get('poplar','broadleaf'),resource:Resource={id:17,kind:'tree',species:'poplar',x:9,z:12,amount:40,growth:.73},placed=model.place(resource,.81,.73);if(!placed)throw Error('Real shared poplar is required');
 const source=createStylizedSurfaceTexture('vegetation'),pastel=copyPastelTextureToArray(source),gouache=new THREE.DataArrayTexture(new Uint8Array(2*2*4*3),2,2,3),environment=new EnvironmentLighting();
 gouache.colorSpace=THREE.SRGBColorSpace;gouache.magFilter=THREE.LinearFilter;gouache.minFilter=THREE.LinearMipmapLinearFilter;gouache.generateMipmaps=true;
 const rows=(layer:number,paletteBaked:boolean):TextureSurfaceSlot[]=>Array.from({length:TEXTURE_SURFACE_SLOT_COUNT},()=>({layer,paletteBaked})),pastelStage:TextureSurfaceAssets={texture:pastel,uvAddress:'raw',slots:rows(0,false)},gouacheRows=rows(0,false);gouacheRows[model.surfaceSlot]={layer:2,paletteBaked:true};
 // Exercise the actual model bakedUv address, not a private replacement UV.
 for(const part of model.parts){const baked=part.geometry.getAttribute('bakedUv');expect(baked?.itemSize).toBe(3);for(let i=0;i<baked.count;i++)expect(baked.getZ(i)).toBe(model.surfaceSlot);}
 const pose=positionLocal.add(vec3(.01,0,0)),surface=createTextureSurface(pastelStage,{positionNode:pose,castShadowPositionNode:pose,receivedShadowPositionNode:pose,color:vec3(.4,.6,.3),baseline:vec3(.4,.6,.3),configure:environment.configure}),group=new THREE.Group();
 for(const row of placed){const mesh=new THREE.Mesh(row.part.geometry,surface.material),p=row.item;mesh.position.set(p.x,p.y,p.z);mesh.scale.set(p.sx??1,p.sy??1,p.sz??1);mesh.rotation.y=p.ry??0;mesh.castShadow=mesh.receiveShadow=true;mesh.layers.set(3);group.add(mesh);}group.updateMatrixWorld(true);
 const meshes=group.children as THREE.Mesh[],state=meshes.map(mesh=>({mesh,geometry:mesh.geometry,index:mesh.geometry.index,streams:rawStreams(mesh.geometry),matrix:mesh.matrix.toArray(),world:mesh.matrixWorld.toArray(),mask:mesh.layers.mask})),mat=surface.material,uuid=mat.uuid,version=mat.version,sampler=surface.sampleNode,hooks={color:mat.colorNode,position:mat.positionNode,cast:mat.castShadowPositionNode,received:mat.receivedShadowPositionNode,output:mat.outputNode,mask:mat.maskNode,shadow:mat.maskShadowNode};let texturesDisposed=0,modelsDisposed=0,materialsDisposed=0;
 for(const t of [source,pastel,gouache])t.addEventListener('dispose',()=>texturesDisposed++);for(const p of model.parts)p.geometry.addEventListener('dispose',()=>modelsDisposed++);for(const m of [surface.material,surface.plainMaterial])m.addEventListener('dispose',()=>materialsDisposed++);
 try{
  for(const stage of [{texture:gouache,uvAddress:'chart' as const,slots:gouacheRows},pastelStage]){
   surface.setAssets(stage);expect(surface.assets.texture).toBe(stage.texture);expect(surface.sampleNode).toBe(sampler);expect(sampler.value).toBe(stage.texture);expect(surface.material).toBe(mat);expect(mat.uuid).toBe(uuid);expect(mat.version).toBe(version);expect(mat).toBeInstanceOf(THREE.MeshLambertNodeMaterial);expect(mat.colorNode).toBe(hooks.color);expect(mat.positionNode).toBe(hooks.position);expect(mat.castShadowPositionNode).toBe(hooks.cast);expect(mat.receivedShadowPositionNode).toBe(hooks.received);expect(mat.outputNode).toBe(hooks.output);expect(mat.maskNode).toBe(hooks.mask);expect(mat.maskShadowNode).toBe(hooks.shadow);
   for(const old of state){expect(old.mesh.geometry).toBe(old.geometry);expect(old.mesh.material).toBe(mat);expect(old.geometry.index).toBe(old.index);unchanged(old.geometry,old.streams);expect(old.mesh.matrix.toArray()).toEqual(old.matrix);expect(old.mesh.matrixWorld.toArray()).toEqual(old.world);expect(old.mesh.layers.mask).toBe(old.mask);expect([old.mesh.castShadow,old.mesh.receiveShadow]).toEqual([true,true]);}model.assertCurrent();
  }
  const current=surface.assets;expect(()=>surface.setAssets({texture:gouache,uvAddress:'chart',slots:gouacheRows,assertCurrent(){throw Error('expired texture owner');}})).toThrow('expired texture owner');expect(surface.assets).toBe(current);expect(sampler.value).toBe(pastel);
  surface.dispose();expect(materialsDisposed).toBe(2);expect(texturesDisposed).toBe(0);expect(modelsDisposed).toBe(0);model.assertCurrent();expect(models.get('poplar','broadleaf')).toBe(model);expect(()=>surface.setAssets(pastelStage)).toThrow('disposed');
 }finally{surface.dispose();models.dispose();source.dispose();pastel.dispose();gouache.dispose();environment.dispose();}
});
