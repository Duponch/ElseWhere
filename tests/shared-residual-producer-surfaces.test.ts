/** Actual remaining producers and pinned cold WGSL. Synthetic paint sinks
 * qualify lifecycle/graphs only; no GPU/pixel or performance claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {DoorLayer} from '../src/render/DoorLayer';
import {WindLayer} from '../src/render/WindLayer';
import {StartingArrivalLayer} from '../src/render/StartingArrivalLayer';
import {PodRescueLayer} from '../src/render/PodRescueLayer';
import {OrbitalDeliveryLayer} from '../src/render/OrbitalDeliveryLayer';
import {RoofLayer,roofSlabGeometry,roofSurfaceCells} from '../src/render/RoofLayer';
import {MechanoidLayer} from '../src/render/MechanoidLayer';
import {AnimalCargoLayer282} from '../src/render/AnimalCargoLayer282';
import {scytherCamp} from './scenarios/scyther-v213';
import {WORLD_SCALE} from '../src/world/scale';
import {SURFACE_STROKE_UV} from '../src/render/surfaces/NaturalSurfaceModels';
import {writeTestFileSync} from './test-output';

function fixture(){const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),layers=withGraphicsStyle(context,()=>({door:new DoorLayer(),wind:new WindLayer(),arrival:new StartingArrivalLayer(),rescue:new PodRescueLayer(),orbital:new OrbitalDeliveryLayer(),roof:new RoofLayer(),mech:new MechanoidLayer(),cargo:new AnimalCargoLayer282()})),{world}=scytherCamp();world.structures=[];world.roofing={constructed:[10*world.width+10,10*world.width+11],build:[],remove:[],cursor:0};layers.roof.updatePhysical(world);layers.mech.update(world,undefined,true);return{context,layers,world,close(){for(const layer of Object.values(layers))layer.dispose();context.dispose();}};}
function surfaces(owner:ReturnType<typeof fixture>){const{layers}=owner,mech=layers.mech.group.children.find(o=>o.userData.mechKind==='scyther'),cargo=layers.cargo.group.children.find(o=>o.name==='Animal cargo282 — pipeline preparation');if(!(mech instanceof THREE.Mesh)||!(cargo instanceof THREE.Mesh))throw Error('Actual mechanical or cargo body absent');return[['door',layers.door.mesh],['wind',layers.wind.mesh],['arrival',layers.arrival.mesh],['rescue',layers.rescue.mesh],['orbital',layers.orbital.mesh],['roof',layers.roof.mesh],['mech',mech],['cargo',cargo]] as const;}

test('all eight actual producers publish texture encoding without replacing models, poses, materials or creating painted companions',()=>{
 const owner=fixture(),before=JSON.stringify(owner.world);
 try{const actual=surfaces(owner),state=actual.map(([name,mesh])=>({name,mesh,geometry:mesh.geometry,material:mesh.material,position:(mesh.material as THREE.NodeMaterial).positionNode,color:(mesh.material as THREE.NodeMaterial).colorNode,attributes:{...mesh.geometry.attributes},index:mesh.geometry.index,children:[...mesh.children]}));
  for(const style of ['origami','default','origami','default'] as const){owner.context.update({...owner.context.preferences,style});for(const s of state){expect(s.mesh.geometry,s.name).toBe(s.geometry);expect(s.mesh.material,s.name).toBe(s.material);expect((s.mesh.material as THREE.NodeMaterial).positionNode,s.name).toBe(s.position);expect((s.mesh.material as THREE.NodeMaterial).colorNode,s.name).toBe(s.color);expect(s.mesh.geometry.index,s.name).toBe(s.index);for(const[name,a]of Object.entries(s.attributes))expect(s.mesh.geometry.getAttribute(name),s.name+':'+name).toBe(a);expect(s.mesh.children).toEqual(s.children);}}
  for(const[,mesh]of actual){expect(mesh.geometry.hasAttribute(SURFACE_STROKE_UV)).toBe(true);expect(mesh.children.some(c=>c instanceof THREE.Mesh&&(c.material as THREE.Material).userData.origamiBrush)).toBe(false);}expect(JSON.stringify(owner.world)).toBe(before);
 }finally{owner.close();}
},60000);

test('dynamic roof preserves its complete canonical triangles and restores temporary empty warmup after real adoption',()=>{
 const owner=fixture(),roof=owner.layers.roof,canonical=roofSlabGeometry(roofSurfaceCells(owner.world),WORLD_SCALE.wallHeight+.08,()=> 'constructed');
 try{for(const name of ['position','normal','color','uv'])expect(roof.mesh.geometry.getAttribute(name).array,name).toEqual(canonical.getAttribute(name).array);const node=Reflect.get(roof,'strokeBank').node;owner.world.roofing!.constructed=[];roof.updatePhysical(owner.world);const empty=roof.mesh.geometry,restore=roof.prepare();expect(roof.mesh.geometry).not.toBe(empty);expect(roof.mesh.geometry.getAttribute(SURFACE_STROKE_UV).itemSize).toBe(3);owner.world.roofing!.constructed=[11*owner.world.width+11];roof.updatePhysical(owner.world);const current=roof.mesh.geometry;restore();expect(roof.mesh.geometry).toBe(current);expect(Reflect.get(roof,'strokeBank').node).toBe(node);expect(Reflect.get(roof,'strokeBank').snapshot().regions).toBe(1);
 }finally{canonical.dispose();owner.close();}
},60000);

interface BuilderPort {scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];build():void;getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];}
test('all eight real common surfaces compile cold within device attribute, buffer and varying limits without inline-return warnings',()=>{
 const owner=fixture(),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No GPU in cold shared-surface contract');}),warning=vi.spyOn(console,'warn');renderer.hasFeature=()=>false;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort,scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 try{for(const[name,mesh]of surfaces(owner)){const parent=mesh.parent;scene.add(mesh);scene.updateMatrixWorld(true);const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=mesh.material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();const attributes=builder.getAttributesArray().flatMap(a=>{const value=a.node?.attribute??mesh.geometry.getAttribute(a.name);return value?[{name:a.name,value}]:[];}),buffers=new Set(attributes.map(({value:a})=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)),varyings=builder.varyings.filter(v=>v.needsInterpolation);writeTestFileSync(`artifacts/shared-residual-${name}-vertex.wgsl`,builder.vertexShader);writeTestFileSync(`artifacts/shared-residual-${name}-fragment.wgsl`,builder.fragmentShader);writeTestFileSync(`artifacts/shared-residual-${name}-limits.json`,JSON.stringify({attributes:attributes.map(a=>[a.name,a.value.itemSize]),buffers:buffers.size,varyings:varyings.map(v=>v.name)})+'\n');expect(attributes.length,name).toBeLessThanOrEqual(16);expect(buffers.size,name).toBeLessThanOrEqual(8);expect(varyings.length,name).toBeLessThanOrEqual(16);expect(builder.fragmentShader,name).toContain('textureSampleGrad');parent?.add(mesh);}
  expect(warning.mock.calls.filter(args=>args.some(a=>String(a).includes('Return statement used')))).toEqual([]);expect(init).not.toHaveBeenCalled();
 }finally{warning.mockRestore();init.mockRestore();owner.close();}
},120000);
