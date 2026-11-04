/** Actual shared human body/instance owners and cold Three shader generation.
 * Synthetic paint pixels support graph checks only; no GPU or quality claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {PawnLayer} from '../src/render/PawnLayer';
import {ExplorationMask256} from '../src/render/ExplorationMask256';
import {animalCombatCamp} from './scenarios/animal-combat';
import {writeTestFileSync} from './test-output';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';

interface BuilderPort {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 build():void;vertexShader:string;fragmentShader:string;
 varyings:{name:string;needsInterpolation:boolean}[];
 getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];
}
const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;
test('Pastel and Gouache share human models, rig, materials and opaque trait tables; style publication never replaces their owners',()=>{
 const world=animalCombatCamp(),before=JSON.stringify(world),entries:{style:string;context:GraphicsStyleContext;exploration:ExplorationMask256;layer:PawnLayer}[]=[];
 const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}} as HTMLCanvasElement});
 const init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No device in this common model contract');});
 renderer.hasFeature=()=>false;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 try{
  for(const style of ['default','origami'] as const){
   const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,impasto:0,wear:0}),exploration=new ExplorationMask256(),layer=withGraphicsStyle(context,()=>new PawnLayer(m=>exploration.configure(m)));
   const entry={style,context,exploration,layer};entries.push(entry);layer.update(world,0,true);
  }
  const body=(layer:PawnLayer)=>Reflect.get(layer,'pawnMesh') as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>;
  const a=body(entries[0]!.layer).geometry,b=body(entries[1]!.layer).geometry;
  for(const name of ['position','normal','color','uv','boneId','dye','bindPivot','pawnRigTraits'])expect(Array.from(a.getAttribute(name).array),name).toEqual(Array.from(b.getAttribute(name).array));
  expect(Array.from(a.index!.array)).toEqual(Array.from(b.index!.array));expect(a.drawRange).toEqual(b.drawRange);
  expect(a.userData.origamiHumanParts).toEqual(b.userData.origamiHumanParts);
  expect(a.userData.origamiHumanParts.some((p:{id:string})=>p.id==='reference-nose')).toBe(true);
  for(const name of ['aFrom','aTo','aTravel','aMotion','aCargo','aEquipment']){
   const x=a.getAttribute(name),y=b.getAttribute(name);expect(x.count,name).toBe(y.count);
   for(let i=0;i<x.count;i++)for(let c=0;c<x.itemSize;c++)expect(x.getComponent(i,c),name+':'+i+':'+c).toBe(y.getComponent(i,c));
  }
  for(let i=0;i<a.instanceCount;i++)expect(a.getAttribute('aShape').getW(i)%32).toBe(b.getAttribute('aShape').getW(i)%32);
  expect(a.userData.origamiLines).toBeUndefined();expect(a.userData.origamiWear).toBeUndefined();
  for(const entry of entries){expect(Reflect.get(entry.layer,'origamiLineMesh')).toBeUndefined();expect(Reflect.get(entry.layer,'wearEffect')).toBeUndefined();expect(entry.layer.group.children.some(child=>/painted edges|ribbon/.test(child.name))).toBe(false);}
  expect(Reflect.get(entries[0]!.context,'edgeMaps')).toBeUndefined();
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  for(const entry of entries){
   const mesh=body(entry.layer);scene.add(mesh);scene.updateMatrixWorld(true);
   const materials=['plainMaterial','texturedMaterial','nativePlainMaterial','nativeTexturedMaterial'].map(name=>Reflect.get(entry.layer,name) as THREE.NodeMaterial);
   expect(new Set(materials).size).toBe(4);
   for(const [i,material]of materials.entries()){
    if(!(material instanceof THREE.NodeMaterial))continue;
    const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
    // Preserve the generated failing stage too: limits alone do not establish
    // that every emitted texture reference has a declaration in that stage.
    writeTestFileSync(`artifacts/common-human-${entry.style}-${i}-vertex.wgsl`,builder.vertexShader);
    writeTestFileSync(`artifacts/common-human-${entry.style}-${i}-fragment.wgsl`,builder.fragmentShader);
    const attributes=builder.getAttributesArray().map(n=>n.node?.attribute??mesh.geometry.getAttribute(n.name)).filter((v):v is THREE.BufferAttribute|THREE.InterleavedBufferAttribute=>!!v),buffers=new Set(attributes.map(v=>v instanceof THREE.InterleavedBufferAttribute?v.data:v));
    expect(attributes.length,entry.style+':attributes').toBeLessThanOrEqual(16);expect(buffers.size,entry.style+':buffers').toBeLessThanOrEqual(8);
    const varyings=builder.varyings.filter(value=>value.needsInterpolation).map(value=>value.name);expect(varyings.length,`${entry.style}/${i}: ${varyings.join(',')}`).toBeLessThanOrEqual(16);
    expect(unboundWgslTextureResources(builder.vertexShader),`${entry.style}/${i}: vertex resource declarations`).toEqual([]);expect(unboundWgslTextureResources(builder.fragmentShader),`${entry.style}/${i}: fragment resource declarations`).toEqual([]);
    if(i%2===1){expect(builder.fragmentShader).toContain('textureSampleGrad');expect(builder.fragmentShader).toContain('for (');expect(builder.fragmentShader).toContain('var<storage, read>');}
   }
   const owners=entry.layer.group.children.map(child=>({child,geometry:Reflect.get(child,'geometry'),material:Reflect.get(child,'material')})),traits=mesh.geometry.getAttribute('pawnRigTraits'),staticBuffer=traits instanceof THREE.InterleavedBufferAttribute?traits.data:traits,staticVersion=staticBuffer.version,table=Reflect.get(entry.layer,'humanStroke'),tableVersion=table.buffer.version,index=mesh.geometry.index,indices=index!.array.slice(),drawRange={...mesh.geometry.drawRange};
   const beforeRow=mesh.geometry.getAttribute('aShape').array.slice();
   entry.context.update({...entry.context.preferences,style:entry.style==='default'?'origami':'default'});
   entry.context.update({...entry.context.preferences,style:entry.style as 'default'|'origami'});
   expect(entry.layer.group.children).toEqual(owners.map(owner=>owner.child));for(const owner of owners){expect(Reflect.get(owner.child,'geometry')).toBe(owner.geometry);expect(Reflect.get(owner.child,'material')).toBe(owner.material);}
   expect(mesh.geometry.getAttribute('pawnRigTraits')).toBe(traits);expect(staticBuffer.version).toBe(staticVersion);expect(Reflect.get(entry.layer,'humanStroke')).toBe(table);expect(table.buffer.version).toBe(tableVersion);expect(mesh.geometry.index).toBe(index);expect(index!.array).toEqual(indices);expect(mesh.geometry.drawRange).toEqual(drawRange);expect(mesh.geometry.getAttribute('aShape').array).toEqual(beforeRow);
   scene.remove(mesh);
  }
  expect(JSON.stringify(world)).toBe(before);expect(init).not.toHaveBeenCalled();
 }finally{for(const e of entries){e.layer.dispose();e.exploration.dispose();e.context.dispose();}init.mockRestore();}
},60000);

test('human physical wear is a source effect independent of style and is wholly retired at zero',()=>{
 const world=animalCombatCamp(),context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),layer=withGraphicsStyle(context,()=>new PawnLayer());
 try{
  layer.update(world,0,true);const mesh=Reflect.get(layer,'pawnMesh') as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>,geometry=mesh.geometry,material=mesh.material,stroke=Reflect.get(layer,'humanStroke'),sourceIndex=geometry.index;
  expect(Reflect.get(layer,'wearEffect')).toBeUndefined();expect(Reflect.get(context,'wearGeometries').size).toBe(0);
  context.update({...context.preferences,wear:.75,edges:.65});
  const effect=Reflect.get(layer,'wearEffect') as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>;
  expect(effect).toBeInstanceOf(THREE.Mesh);expect(effect.visible).toBe(false);expect(effect.geometry.getAttribute('pawnRigTraits').itemSize).toBe(4);expect(effect.geometry.userData.referenceWearBasePositions).toBeInstanceOf(Float32Array);
  for(const name of ['aFrom','aTo','aTravel','aShape','aEquipment','aHairBlood'])expect(effect.geometry.getAttribute(name),name).toBe(geometry.getAttribute(name));
  expect(effect.geometry.instanceCount).toBe(geometry.instanceCount);expect(effect.material.positionNode).toBe(mesh.material.positionNode);expect(effect.material.maskNode).toBe(mesh.material.maskNode);expect(effect.material.maskShadowNode).toBe(mesh.material.maskShadowNode);
  context.update({...context.preferences,style:'origami'});expect(Reflect.get(layer,'wearEffect')).toBe(effect);expect(effect.visible).toBe(true);
  context.update({...context.preferences,style:'default'});expect(Reflect.get(layer,'wearEffect')).toBe(effect);expect(effect.visible).toBe(false);
  let geometryDisposed=0,materialDisposed=0;effect.geometry.addEventListener('dispose',()=>geometryDisposed++);effect.material.addEventListener('dispose',()=>materialDisposed++);
  context.update({...context.preferences,wear:0});expect(Reflect.get(layer,'wearEffect')).toBeUndefined();expect(effect.parent).toBeNull();expect(geometryDisposed).toBe(1);expect(materialDisposed).toBe(1);expect(Reflect.get(context,'wearGeometries').size).toBe(0);expect([...Reflect.get(context,'edgeObjects').values()]).not.toContain('wear');
  expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect(Reflect.get(layer,'humanStroke')).toBe(stroke);expect(geometry.index).toBe(sourceIndex);
 }finally{layer.dispose();context.dispose();}
},60000);
