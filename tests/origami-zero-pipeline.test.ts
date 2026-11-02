import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {attribute,float,uv} from 'three/tsl';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,applyOrigamiSurface} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES as defaults,graphicsStylePipelineKey,requiresGraphicsStyleRebuild} from '../src/ui3d/native-preferences';

test('only style or an enabled-effect boundary requires a new display preparation',()=>{
 const original={...defaults,style:'origami' as const};
 expect(defaults.impasto).toBe(1);expect(defaults.wear).toBe(.75);
 for(const [previous,next,rebuild]of [
  [original,{...original,impasto:2.2},false],
  [original,{...original,wear:.01},false],
  [original,{...original,impasto:0},true],
  [{...original,impasto:0},{...original,impasto:.01},true],
  [original,{...original,wear:0},true],
  [{...original,wear:0},{...original,wear:.01},true],
  [{...original,impasto:0,wear:0},{...original,impasto:0,wear:0,blackEdges:0,edges:0,contourImperfection:0},false],
  [defaults,{...defaults,impasto:0,wear:0},false],
  [defaults,original,true],
 ] as const)expect(requiresGraphicsStyleRebuild(previous,next)).toBe(rebuild);
 expect(graphicsStylePipelineKey({...original,impasto:-0,wear:0})).toBe('origami:flat:no-wear');
 expect(graphicsStylePipelineKey({...original,impasto:NaN,wear:Infinity})).toBe('origami:relief:wear');
 expect(graphicsStylePipelineKey({...original,impasto:-1,wear:-1})).toBe('origami:flat:no-wear');
});

test('a rejected effect boundary cannot partially change preferences, uniforms or pending paint demand',()=>{
 const context=new GraphicsStyleContext({...defaults,style:'origami'});
 try{
  context.update({...context.preferences,impasto:.01,wear:.01});
  const preferences=context.preferences,paint=context.paintResidency(),values=[context.impasto.value,context.wear.value,context.contour.value];
  for(const patch of [{impasto:0},{wear:0},{style:'default' as const}]){
   expect(()=>context.update({...preferences,...patch})).toThrow('nouvelle préparation');
   expect(context.preferences).toBe(preferences);expect(context.paintResidency()).toEqual(paint);
   expect([context.impasto.value,context.wear.value,context.contour.value]).toEqual(values);
  }
 }finally{context.dispose();}
});

test('disabled wear refuses material and geometry admission before allocating its maps or touching geometry',()=>{
 const context=new GraphicsStyleContext({...defaults,style:'origami',wear:0}),geometry=new THREE.BufferGeometry();
 const bounds=vi.spyOn(geometry,'computeBoundingBox');
 try{
  expect(context.wearEnabled).toBe(false);
  expect(()=>context.createWearMaterial(null)).toThrow('must not allocate');
  expect(()=>context.trackWearGeometry(geometry)).toThrow('must not allocate');
  expect(Reflect.get(context,'edgeMaps')).toBeUndefined();expect(bounds).not.toHaveBeenCalled();
  expect(Reflect.get(context,'wearGeometries').size).toBe(0);
  context.update({...context.preferences,impasto:1.5,blackEdges:.4});
  expect(bounds).not.toHaveBeenCalled();
 }finally{geometry.dispose();context.dispose();}
});

interface InspectionBinding {name:string;isSampledTexture?:boolean;texture?:THREE.Texture}
interface InspectionBuilder {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 build():unknown;fragmentShader:string;
 getBindings():{bindings:InspectionBinding[]}[];
}
const Builder=THREE.WGSLNodeBuilder as unknown as new(object:THREE.Object3D,renderer:THREE.WebGPURenderer)=>InspectionBuilder;
const sampleCalls=(source:string)=>[...source.matchAll(/\btextureSample(?:Bias|Grad|Level)?\s*\(/g)].length;
function expectRgbEqual(actual:Uint8Array,expected:Uint8Array,label:string):void{
 expect(actual.length,label).toBe(expected.length);let firstMismatch=-1;
 for(let at=0;at<actual.length;at++)if(at%4!==3&&actual[at]!==expected[at]){firstMismatch=at;break;}
 expect(firstMismatch,label).toBe(-1);
}
interface TraversalBuilder {context:object}
interface TraversalNode {
 getChildren?:()=>Iterable<TraversalNode>;getOutputNode?:(builder:TraversalBuilder)=>TraversalNode;
 jsFunc?:unknown;call?:()=>TraversalNode;isTextureNode?:boolean;value?:unknown;uvNode?:unknown;name?:string;
}
function colorSamples(root:unknown):TraversalNode[]{
 const geometry=new THREE.BufferGeometry(),material=new THREE.MeshStandardNodeMaterial(),mesh=new THREE.Mesh(geometry,material);
 const Constructor=THREE.NodeBuilder as unknown as new(object:THREE.Mesh)=>TraversalBuilder,builder=new Constructor(mesh);builder.context={};
 const pending=[root as TraversalNode],seen=new Set<TraversalNode>();
 try{
  while(pending.length){const node=pending.pop()!;if(!node||seen.has(node))continue;seen.add(node);
   // Inspect texture addressing without expanding the derivative-built UV.
   if(node.isTextureNode)continue;
   if(node.getOutputNode){pending.push(node.getOutputNode(builder));continue;}
   if(typeof node.jsFunc==='function'&&node.call){pending.push(node.call());continue;}
   if(node.getChildren)for(const child of node.getChildren())pending.push(child);
  }
  return [...seen].filter(node=>node.isTextureNode);
 }finally{geometry.dispose();material.dispose();}
}
function expectFaceColorAddresses(context:GraphicsStyleContext,root:unknown):void{
 const storage=context.debugPaintStorage(),samples=colorSamples(root),pigments=samples.filter(node=>storage.banks.some(bank=>bank.texture===node.value)),paper=samples.filter(node=>node.value===storage.paper.texture),coverage=samples.filter(node=>node.value===storage.coverage.texture);
 expect(pigments.length).toBeGreaterThan(0);expect(paper.length).toBeGreaterThan(0);expect(coverage.length).toBeGreaterThan(0);
 const face=paper[0]!.uvNode as TraversalNode;expect(face.name).toBe('v_origamiPaintUv');
 for(const node of [...paper,...coverage])expect(node.uvNode).toBe(face);
 for(const node of pigments)expect(node.uvNode).not.toBe(face);
}

/** Actual r186 WGSL generation with an inert CPU boundary. This never calls
 * init/compileAsync/render/requestDevice and makes no pixel or GPU-time claim.
 * Stub pixels only support graph/ownership contracts; Native must compare the
 * actual authored source colors, fills, lines and wear separately. */
test('zero relief removes height sampling while retaining RGB sampling, face masks and contour alpha sampling',()=>{
 const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}} as HTMLCanvasElement});
 const initialization=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No device in a CPU shader contract');});
 renderer.hasFeature=()=>false;
 Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const positive=new GraphicsStyleContext({...defaults,style:'origami'}),zero=new GraphicsStyleContext({...defaults,style:'origami',impasto:0});
 const geometry=new THREE.BoxGeometry(2,1,1);geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*3).fill(1),3));
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),hemisphere=new THREE.HemisphereLight(0xffffff,0x808080,2),materials:THREE.NodeMaterial[]=[];
 camera.position.set(3,4,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();scene.add(sun,hemisphere);
 const inspect=(material:THREE.NodeMaterial)=>{
  const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);scene.updateMatrixWorld(true);
  try{const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,hemisphere]);builder.build();return {shader:builder.fragmentShader,bindings:builder.getBindings().flatMap(group=>group.bindings)};}finally{scene.remove(mesh);}
 };
 const colorOnly=(source:THREE.MeshStandardNodeMaterial)=>{
  const material=new THREE.MeshBasicNodeMaterial({transparent:source.transparent,alphaTest:source.alphaTest,depthWrite:source.depthWrite,depthTest:source.depthTest,side:source.side,polygonOffset:source.polygonOffset,polygonOffsetFactor:source.polygonOffsetFactor,polygonOffsetUnits:source.polygonOffsetUnits});
  material.colorNode=source.colorNode;material.opacityNode=source.opacityNode;material.positionNode=source.positionNode;materials.push(material);return inspect(material).shader;
 };
 const body=(context:GraphicsStyleContext)=>{const material=new THREE.MeshStandardNodeMaterial();applyOrigamiSurface(material,attribute('color','vec3'),uv(),context,float(1));return material;};
 try{
  for(const [name,make]of [
   ['body',body],
   ['painted contour',(context:GraphicsStyleContext)=>context.createBrushMaterial(null)],
   ['physical wear',(context:GraphicsStyleContext)=>context.createWearMaterial(null)],
  ] as const){
   const full=make(positive),disabled=make(zero);materials.push(full,disabled);
   expect(full.normalNode,name).not.toBeNull();expect(disabled.normalNode,name).toBeNull();expect(disabled.normalMap,name).toBeNull();expect(disabled.bumpMap,name).toBeNull();
   const fullGraph=inspect(full),zeroGraph=inspect(disabled);
   expect(sampleCalls(fullGraph.shader),name).toBeGreaterThan(sampleCalls(zeroGraph.shader));
   // The color pipeline keeps the same sample workload and real source data.
   // Full WGSL cannot be compared literally: its unused intermediate alpha
   // height is intentionally replaced by zero. This is NOT a pixel or shader
   // byte-identity claim; real RGB/alpha output is qualified separately Native.
   expect(sampleCalls(colorOnly(disabled)),`${name}: color/alpha sampling`).toBe(sampleCalls(colorOnly(full)));
   if(name==='body'){expectFaceColorAddresses(positive,full.colorNode);expectFaceColorAddresses(zero,disabled.colorNode);}
   if(name==='physical wear'){
    const maps=Reflect.get(zero,'edgeMaps') as {color?:THREE.Texture;alpha:THREE.Texture;bump?:THREE.Texture};
    expect(maps.color).toBeDefined();expect(maps.bump).toBeUndefined();
   }
  }
  const material=body(positive);materials.push(material);const normal=material.normalNode,color=material.colorNode;
  positive.update({...positive.preferences,impasto:2.2,wear:.25});
  expect(material.normalNode).toBe(normal);expect(material.colorNode).toBe(color);expect(positive.impasto.value).toBe(2.2);
  const p=positive.debugPaintStorage(),z=zero.debugPaintStorage();
  expect(z.banks.length).toBe(p.banks.length);for(let bank=0;bank<p.banks.length;bank++)expectRgbEqual(z.banks[bank]!.data,p.banks[bank]!.data,`pigment bank ${bank}`);
  expectRgbEqual(z.paper.data,p.paper.data,'paper');expect(z.coverage.data.length).toBe(p.coverage.data.length);expect(z.coverage.data.every((value,at)=>value===p.coverage.data[at])).toBe(true);
  expect(initialization).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);
 }finally{
  for(const material of materials)material.dispose();geometry.dispose();positive.dispose();zero.dispose();initialization.mockRestore();
  // r186 cold renderer.dispose() initializes its animation loop even for null.
  // No device was admitted and no renderer lifecycle is entered by this test.
 }
});

test('a contour may own shared ink alpha at wear zero, but no dedicated wear color or height map',()=>{
 const context=new GraphicsStyleContext({...defaults,style:'origami',wear:0});let material:THREE.MeshStandardNodeMaterial|undefined;
 try{material=context.createBrushMaterial(null);const maps=Reflect.get(context,'edgeMaps') as {color?:THREE.Texture;alpha:THREE.Texture;bump?:THREE.Texture};expect(maps.alpha).toBeInstanceOf(THREE.Texture);expect(maps.color).toBeUndefined();expect(maps.bump).toBeUndefined();}finally{material?.dispose();context.dispose();}
});
