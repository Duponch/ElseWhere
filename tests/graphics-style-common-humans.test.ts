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

interface BuilderPort {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 build():void;vertexShader:string;fragmentShader:string;
 getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];
}
const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;
test('both graphic styles use the same human anatomy, rig, equipment streams and active parts while keeping separate surface owners',()=>{
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
  expect(Reflect.get(entries[0]!.layer,'origamiLineMesh')).toBeNull();expect(Reflect.get(entries[1]!.layer,'origamiLineMesh')).not.toBeNull();
  expect(Reflect.get(entries[0]!.context,'edgeMaps')).toBeUndefined();
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  for(const entry of entries){
   const mesh=body(entry.layer);scene.add(mesh);scene.updateMatrixWorld(true);
   const materials=['plainMaterial','texturedMaterial','nativePlainMaterial','nativeTexturedMaterial'].map(name=>Reflect.get(entry.layer,name) as THREE.NodeMaterial);
   expect(new Set(materials).size).toBe(4);
   for(const [i,material]of materials.entries()){
    if(!(material instanceof THREE.NodeMaterial))continue;
    const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
    const attributes=builder.getAttributesArray().map(n=>n.node?.attribute??mesh.geometry.getAttribute(n.name)).filter((v):v is THREE.BufferAttribute|THREE.InterleavedBufferAttribute=>!!v),buffers=new Set(attributes.map(v=>v instanceof THREE.InterleavedBufferAttribute?v.data:v));
    expect(attributes.length,entry.style+':attributes').toBeLessThanOrEqual(16);expect(buffers.size,entry.style+':buffers').toBeLessThanOrEqual(8);
    writeTestFileSync(`artifacts/common-human-${entry.style}-${i}-vertex.wgsl`,builder.vertexShader);
   }
   scene.remove(mesh);
  }
  expect(JSON.stringify(world)).toBe(before);expect(init).not.toHaveBeenCalled();
 }finally{for(const e of entries){e.layer.dispose();e.exploration.dispose();e.context.dispose();}init.mockRestore();}
},60000);
