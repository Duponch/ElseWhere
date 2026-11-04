/** Actual common natural/prop models and cold shader layouts. No device,
 * Canvas pixels, Native quality or performance result is asserted here. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/index';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {compileNaturalSurfaceModels,interleaveNaturalSurfaceFields} from '../src/render/surfaces/NaturalSurfaceModels';
import {createChunkGeometry} from '../src/render/chunk-shape';
import {createSandbagGeometry} from '../src/render/sandbag-parts';
import {createItemGeometry,ITEM_SHAPES} from '../src/render/item-geometry';
import {createTimberGeometry,TimberCladdingLayer} from '../src/render/TimberCladdingLayer';
import {createOrigamiGroundTuftGeometry} from '../src/render/origami/flora';
import {cropGeometry,CropLayer} from '../src/render/CropLayer';
import {RESIDENT_CROP_KINDS} from '../src/render/flora-presentation';
import {mergedInstances,type ResourceRangeData} from '../src/render/StaticGeometry';
import {BoxBatches} from '../src/render/BoxBatches';
import {BoxMesh} from '../src/render/BoxMesh';
import {PlantClusterLayer} from '../src/render/PlantClusterLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {createSurfaceMaterial} from '../src/render/SurfaceMaterials';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import {writeTestFileSync} from './test-output';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
function words(g:THREE.BufferGeometry,name:string):Uint32Array{
 const a=g.getAttribute(name),count=g.index?.count??a.count,values=new Float32Array(count*a.itemSize);
 for(let corner=0;corner<count;corner++)for(let c=0;c<a.itemSize;c++)values[corner*a.itemSize+c]=a.getComponent(g.index?.getX(corner)??corner,c);
 return new Uint32Array(values.buffer);
}
function fields(g:THREE.BufferGeometry){return{geometry:g,index:g.index,indices:g.index?.array.slice(),attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{attribute:a,array:a.array,values:a.array.slice()}]))};}
function unchanged(g:THREE.BufferGeometry,before:ReturnType<typeof fields>){expect(g).toBe(before.geometry);expect(g.index).toBe(before.index);expect(g.index?.array).toEqual(before.indices);for(const[name,a]of Object.entries(before.attributes)){expect(g.getAttribute(name)).toBe(a.attribute);expect(g.getAttribute(name).array).toBe(a.array);expect(g.getAttribute(name).array).toEqual(a.values);}}

test('the complete prop/tuft/crop vocabulary preserves exact original triangle streams, UV phase inputs, groups and source ownership',()=>{
 const sources=[new THREE.BoxGeometry(),createChunkGeometry(),createChunkGeometry(true),createSandbagGeometry(),...ITEM_SHAPES.map(shape=>createItemGeometry(shape)),createTimberGeometry(false),createTimberGeometry(true),createOrigamiGroundTuftGeometry(),...RESIDENT_CROP_KINDS.map(kind=>cropGeometry(kind))],saved=sources.map(g=>({g,attributes:{...g.attributes},index:g.index,streams:Object.fromEntries(Object.keys(g.attributes).map(name=>[name,words(g,name)]))}));
 const models=compileNaturalSurfaceModels(sources);let sourceDisposed=0;for(const g of sources)g.addEventListener('dispose',()=>sourceDisposed++);
 try{
  expect(models.geometries).toHaveLength(sources.length);expect(models.stroke.faceCount).toBeGreaterThan(0);expect(models.stroke.edgeCount).toBeGreaterThan(0);
  for(const [i,g]of models.geometries.entries()){
   const original=saved[i]!;for(const[name,bits]of Object.entries(original.streams))expect(words(g,name),`${i}/${name}`).toEqual(bits);
   expect(g.groups).toEqual(original.g.groups);expect(g.drawRange).toEqual(original.g.drawRange);expect(g.getAttribute('surfaceStrokeFace').count).toBe(g.getAttribute('position').count);
   const uv=g.getAttribute('surfaceStrokeUv');for(let v=0;v<uv.count;v++)expect(Number.isFinite(uv.getX(v))&&Number.isFinite(uv.getY(v))).toBe(true);
   expect(original.g.index).toBe(original.index);for(const[name,a]of Object.entries(original.attributes))expect(original.g.getAttribute(name)).toBe(a);
  }
  const g=models.geometries[0]!,before=Object.fromEntries(Object.keys(g.attributes).map(name=>[name,words(g,name)]));interleaveNaturalSurfaceFields(g);
  expect(new Set(Object.values(g.attributes).map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)).size).toBe(1);for(const[name,bits]of Object.entries(before))expect(words(g,name)).toEqual(bits);
  const mesh=new BoxMesh(g,new THREE.MeshLambertNodeMaterial(),1);try{for(const[name,bits]of Object.entries(before))expect(words(mesh.geometry,name)).toEqual(bits);mesh.allocate(g,512);for(const[name,bits]of Object.entries(before))expect(words(mesh.geometry,name)).toEqual(bits);}finally{(mesh.material as THREE.Material).dispose();mesh.dispose();}
  models.dispose();expect(sourceDisposed).toBe(0);
 }finally{models.dispose();for(const g of sources)g.dispose();}
});

test('resource packed transport keeps original Pastel crop/phase and ranges while storing raw face, chart slot and stroke identity in two ordinary fields',()=>{
 const source=new THREE.BoxGeometry(),models=compileNaturalSurfaceModels([source]),master=models.geometries[0]!,uv=master.getAttribute('uv'),chart=new Float32Array(uv.count*3),mat=new THREE.MeshLambertNodeMaterial(),groups=[new THREE.Group(),new THREE.Group(),new THREE.Group()];
 for(let v=0;v<uv.count;v++)chart.set([uv.getX(v)*.7+.13,uv.getY(v)*.6+.21,17],v*3);master.setAttribute('bakedUv',new THREE.BufferAttribute(chart,3));
 const items=[{key:13,x:2.25,y:.13,z:8.5,sx:.31,sy:1.7,sz:.67,ry:.62,color:0x9d7645,referenceColor:0x8a6b45,profile:23},{key:17,x:8,y:.05,z:3,sx:1.83,sy:.43,sz:1.22,ry:-.32,color:0x41682d,profile:0,rawGeometry:true}];
 const plain=mergedInstances(groups[0]!,[{geometry:source.clone(),items}],mat,true,true)!,packed=mergedInstances(groups[1]!,[{geometry:master.clone(),items}],mat,true,true,false,true)!,ordinary=mergedInstances(groups[2]!,[{geometry:master.clone(),items}],mat,true,true)!;
 try{
  for(const name of ['position','normal','color','uv']){expect(words(packed.geometry,name),name).toEqual(words(plain.geometry,name));expect(words(ordinary.geometry,name),name).toEqual(words(plain.geometry,name));}
  expect(packed.geometry.hasAttribute('bakedUv')).toBe(false);expect(ordinary.geometry.hasAttribute('bakedUv')).toBe(true);expect(Object.values(packed.geometry.attributes).every(a=>a instanceof THREE.BufferAttribute&&!(a instanceof THREE.InstancedBufferAttribute))).toBe(true);
  const face=master.getAttribute('surfaceStrokeFace'),surface=packed.geometry.getAttribute('surfaceUv'),paint=packed.geometry.getAttribute('origamiPaint'),legacyPaint=ordinary.geometry.getAttribute('origamiPaint');
  for(let item=0;item<items.length;item++)for(let v=0;v<uv.count;v++){const at=item*uv.count+v,word=paint.getW(at);expect(word%128).toBe(items[item]!.profile);expect(Math.floor(word/128)%32).toBe(17);expect(Math.floor(word/4096)).toBe(face.getX(v));expect(legacyPaint.getW(at)).toBe(items[item]!.profile+face.getX(v)*128);expect([surface.getX(at),surface.getY(at),surface.getZ(at),surface.getW(at)]).toEqual([uv.getX(v),uv.getY(v),chart[v*3],chart[v*3+1]]);}
  const a=plain.userData.resourceRanges as ResourceRangeData,b=packed.userData.resourceRanges as ResourceRangeData;expect(b.ranges.map(({id,start,count})=>({id,start,count}))).toEqual(a.ranges.map(({id,start,count})=>({id,start,count})));
  for(const invalid of ['profile','face','slot'] as const){const g=master.clone(),copy=items.map(i=>({...i}));if(invalid==='profile')copy[0]!.profile=128;if(invalid==='face')g.getAttribute('surfaceStrokeFace').setX(0,4096);if(invalid==='slot')g.getAttribute('bakedUv').setZ(0,28);try{expect(()=>mergedInstances(new THREE.Group(),[{geometry:g,items:copy}],mat,true,true,false,true)).toThrow(/packed domain/);}finally{g.dispose();}}
 }finally{for(const mesh of [plain,packed,ordinary])mesh.geometry.dispose();mat.dispose();models.dispose();source.dispose();}
});

function owners(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),lighting=new EnvironmentLighting(),pastel=createStylizedSurfaceTexture('vegetation'),plain=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true}),paint=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true,map:pastel});lighting.configure(plain);lighting.configure(paint);
 const layers=withGraphicsStyle(context,()=>({boxes:new BoxBatches(lighting.configure),timber:new TimberCladdingLayer(lighting.configure),grass:new PlantClusterLayer(plain,paint,undefined,pastel),crops:new CropLayer(plain,paint,pastel)})),group=new THREE.Group();
 layers.boxes.set(group,'furniture',[{key:1,x:0,y:.4,z:0,sx:1.2,sy:.13,sz:.7,color:0xb89262}]);layers.boxes.set(group,'pile:fixture',[{key:2,x:2,y:.2,z:0,sx:.3,sy:.4,sz:.3,color:0x9a8e75,shape:'rounded-rock'},{key:3,x:3,y:.2,z:0,sx:.2,sy:.4,sz:.3,color:0xa39b75,shape:ITEM_SHAPES[0]}]);
 const roots=[group,layers.timber.group,layers.grass.group,layers.crops.group],meshes=()=>roots.flatMap(root=>{const result:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)result.push(o);});return result;});
 return{context,lighting,pastel,plain,paint,layers,roots,meshes,close(){layers.boxes.dispose();layers.timber.dispose();layers.grass.dispose();layers.crops.dispose();plain.dispose();paint.dispose();pastel.dispose();lighting.dispose();context.dispose();}};
}

test('real resident families change texture encoding without rebuilding their models, buffers, programs or body submissions and preserve later writer growth',()=>{
 const o=owners(),world=createWorld(643,16,16);world.structures=[{id:10,kind:'wall',material:'wood',x:4,z:4,orientation:0,footprint:'standard'}];world.resources=[{id:101,kind:'wild-plant',species:'grass',x:3,z:5,amount:12,growth:.8},{id:102,kind:'rice',x:5,z:5,amount:12,growth:.8,growthTick:world.tick}];
 const update=()=>{o.layers.timber.update(world,false);o.layers.grass.update(world,false);o.layers.crops.update(world,false);};
 try{
  update();const original=o.meshes().map(mesh=>({mesh,geometry:fields(mesh.geometry),material:mesh.material,matrix:mesh instanceof THREE.InstancedMesh?mesh.instanceMatrix:Reflect.get(mesh,'instanceMatrix'),color:mesh instanceof THREE.InstancedMesh?mesh.instanceColor:Reflect.get(mesh,'colorBuffer'),version:(mesh.material as THREE.Material).version,colorNode:(mesh.material as THREE.NodeMaterial).colorNode,positionNode:(mesh.material as THREE.NodeMaterial).positionNode}));
  const before=JSON.stringify(world);for(const style of ['origami','default','origami','default'] as const){o.context.update({...o.context.preferences,style});for(const row of original){expect(row.mesh.material).toBe(row.material);expect((row.mesh.material as THREE.Material).version).toBe(row.version);expect((row.mesh.material as THREE.NodeMaterial).colorNode).toBe(row.colorNode);expect((row.mesh.material as THREE.NodeMaterial).positionNode).toBe(row.positionNode);unchanged(row.mesh.geometry,row.geometry);}expect(o.meshes()).toEqual(original.map(r=>r.mesh));}
  expect(JSON.stringify(world)).toBe(before);for(const root of o.roots)root.traverse(mesh=>{expect(mesh.userData.origamiContour).toBeUndefined();expect(mesh.userData.referenceCompanion).toBeUndefined();if(mesh instanceof THREE.Mesh)expect((mesh.material as THREE.Material).transparent).toBe(false);});
  world.resources[0]!.growth=.25;world.resources[1]!.growth=.25;world.tick+=20;update();o.layers.grass.setTargetPreview(new Set([101]));o.layers.crops.setTargetPreview(new Set([102]));o.layers.grass.clearTargetPreview();o.layers.crops.clearTargetPreview();
  for(const row of original)expect(row.mesh.geometry).toBe(row.geometry.geometry);
  for(const layer of [o.layers.grass,o.layers.crops,o.layers.timber]){const restore=layer.prepareForCompile();restore();layer.setTexturesEnabled(false);layer.setTexturesEnabled(true);}
  expect(o.context.reliefLod).toBeUndefined();expect(o.meshes().every(mesh=>(mesh.material as THREE.NodeMaterial).normalNode===null)).toBe(true);
 }finally{o.close();}
},60_000);

interface Inspector {scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];build():unknown;getAttributesArray():{name:string;node?:{attribute?:Attribute}}[];getBindings():{bindings:{name:string;visibility:number;isSampledTexture?:boolean;texture?:THREE.Texture}[]}[];}
test('actual opaque natural and prop programs compile cold inside attribute, buffer and sampled-texture limits with no relief0 graph',()=>{
 const o=owners(),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No GPU allowed for cold source contract');});renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),hemisphere=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(...o.roots,sun,hemisphere);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);const Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Inspector,facts:unknown[]=[];
 try{
  const materials=new Set<THREE.Material>();for(const mesh of o.meshes()){const material=mesh.material as THREE.NodeMaterial;if(materials.has(material))continue;materials.add(material);const b=new Builder(mesh,renderer);b.scene=scene;b.camera=camera;b.material=material;b.lightsNode=new THREE.LightsNode().setLights([sun,hemisphere]);b.build();const attrs=b.getAttributesArray().flatMap(a=>{const attribute=a.node?.attribute??mesh.geometry.getAttribute(a.name);return attribute?[{name:a.name,attribute}]:[];}),buffers=new Set(attrs.map(({attribute:a})=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)),bindings=b.getBindings().flatMap(b=>b.bindings),sampled=bindings.filter(b=>b.isSampledTexture);expect(attrs.length,mesh.name).toBeLessThanOrEqual(16);expect(buffers.size,mesh.name).toBeLessThanOrEqual(8);for(const bit of [1,2])expect(sampled.filter(b=>(b.visibility&bit)!==0).length).toBeLessThanOrEqual(16);expect(b.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);expect(b.fragmentShader).not.toContain('origamiGlobalRelief');expect(material.normalNode).toBeNull();expect(material.transparent).toBe(false);expect(b.fragmentShader).toContain('textureSampleGrad');writeTestFileSync(`artifacts/shared-natural-${facts.length}-vertex.wgsl`,b.vertexShader);writeTestFileSync(`artifacts/shared-natural-${facts.length}-fragment.wgsl`,b.fragmentShader);facts.push({name:mesh.name,material:material.type,attributes:attrs.map(a=>[a.name,a.attribute.itemSize]),buffers:buffers.size,sampled:sampled.map(s=>s.name)});}
  expect(materials.size).toBeGreaterThanOrEqual(6);expect(init).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);writeTestFileSync('artifacts/shared-natural-surface-facts.json',JSON.stringify(facts,null,2)+'\n');
 }finally{o.close();init.mockRestore();}
},60_000);
