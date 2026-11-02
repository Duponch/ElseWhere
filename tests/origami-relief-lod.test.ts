import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {texture,uv,vec3,float} from 'three/tsl';
import {referencePaintBumpNormal} from '../src/render/origami/paint-metric';
import {createGlobalReliefLod,GlobalReliefLod,installGlobalReliefLod,ORIGAMI_RELIEF_LOD_THRESHOLDS} from '../src/render/origami/relief-lod';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,applyOrigamiSurface} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES as defaults} from '../src/ui3d/native-preferences';

test('explicit relief zero admits no LOD owner and preserves a null normal graph',()=>{
 const gate=createGlobalReliefLod(false,{disableAt:20,enableAt:28}),material=new THREE.MeshStandardNodeMaterial();
 try{expect(gate).toBeUndefined();const version=material.version;installGlobalReliefLod(material,gate);expect(material.normalNode).toBeNull();expect(material.version).toBe(version);}finally{material.dispose();}
});

test('global orthographic hysteresis writes only on tier changes and perspective always preserves full relief',()=>{
 const gate=new GlobalReliefLod({disableAt:20,enableAt:28});let value=gate.enabled.value,writes=0;
 Object.defineProperty(gate.enabled,'value',{configurable:true,get:()=>value,set:(next:number)=>{value=next;writes++;}});
 expect(gate.tier).toBe('full');
 for(const [mode,pixels,changed,tier]of [
  ['orthographic',21,false,'full'],['orthographic',20,true,'flat'],
  ['orthographic',19,false,'flat'],['orthographic',27,false,'flat'],
  ['orthographic',28,true,'full'],['orthographic',1,true,'flat'],
  ['perspective',1,true,'full'],['perspective',1,false,'full'],
  ['orthographic',10,true,'flat'],['orthographic',NaN,true,'full'],
  ['orthographic',Infinity,false,'full'],['orthographic',-1,false,'full'],
 ] as const){expect(gate.update(mode,pixels)).toBe(changed);expect(gate.tier).toBe(tier);expect(gate.enabled.value).toBe(tier==='full'?1:0);}
 expect(writes).toBe(6);
 expect(()=>new GlobalReliefLod({disableAt:28,enableAt:20})).toThrow('ordered');
});

test('material admission preserves all non-normal graph identities and shares one wrapper per real source graph',()=>{
 const gate=new GlobalReliefLod({disableAt:20,enableAt:28}),a=new THREE.MeshStandardNodeMaterial(),b=new THREE.MeshStandardNodeMaterial();
 a.colorNode=vec3(.3,.5,.7);a.opacityNode=float(.8);a.normalNode=vec3(.1,.2,.9).normalize();
 const original=a.normalNode,color=a.colorNode,opacity=a.opacityNode; b.normalNode=original;
 try{installGlobalReliefLod(a,gate);installGlobalReliefLod(b,gate);expect(a.colorNode).toBe(color);expect(a.opacityNode).toBe(opacity);expect(a.normalNode).not.toBe(original);expect(a.normalNode).toBe(b.normalNode);expect(gate.wrapNormal(a.normalNode as THREE.Node<'vec3'>)).toBe(a.normalNode);expect(gate.wrapNormal(null)).toBeNull();const graph=a.normalNode;gate.update('orthographic',1);gate.update('orthographic',100);expect(a.normalNode).toBe(graph);}finally{a.dispose();b.dispose();}
});

test('real Origami surface, ink and wear factories share one gate while Default and explicit zero admit none',()=>{
 const active=new GraphicsStyleContext({...defaults,style:'origami'}),disabled=new GraphicsStyleContext({...defaults,style:'origami',impasto:0,wear:0}),ordinary=new GraphicsStyleContext({...defaults,style:'default'});
 // This is a graph-admission contract, not a raster/performance proof. Keep
 // real factories/nodes but prevent bulk Canvas/palette work at this boundary.
 const flushes=[active,disabled,ordinary].map(context=>vi.spyOn(context,'flushPaint').mockImplementation(()=>{})),gate=active.reliefLod!,wrap=vi.spyOn(gate,'wrapNormal'),materials:THREE.NodeMaterial[]=[];
 try{
  expect(ORIGAMI_RELIEF_LOD_THRESHOLDS).toEqual({disableAt:48,enableAt:64});
  expect(gate).toBeInstanceOf(GlobalReliefLod);expect(disabled.reliefLod).toBeUndefined();expect(ordinary.reliefLod).toBeUndefined();
  const body=new THREE.MeshStandardNodeMaterial();materials.push(body);applyOrigamiSurface(body,vec3(.6,.4,.2),undefined,active,float(1));
  const ink=active.createBrushMaterial(null),wear=active.createWearMaterial(null);materials.push(ink,wear);
  expect(wrap).toHaveBeenCalledTimes(3);for(const [index,material]of [body,ink,wear].entries())expect(material.normalNode).toBe(wrap.mock.results[index]!.value);
  const clone=body.clone();materials.push(clone);expect(clone.normalNode).toBe(body.normalNode);
  const states=[body,ink,wear,clone].map(material=>({material,normal:material.normalNode,color:material.colorNode,version:material.version}));
  // Fixed FullHD witness aim() defines a horizontal half-span: player has
  // 40 physical pixels/cell, close 106.667, rather than vertical-span values.
  expect(gate.update('orthographic',40)).toBe(true);expect(gate.tier).toBe('flat');
  expect(gate.update('orthographic',56)).toBe(false);expect(gate.tier).toBe('flat');
  expect(gate.update('orthographic',106.667)).toBe(true);expect(gate.tier).toBe('full');
  active.update({...active.preferences,impasto:1.5,wear:.5});expect(active.reliefLod).toBe(gate);
  for(const {material,normal,color,version}of states){expect(material.normalNode).toBe(normal);expect(material.colorNode).toBe(color);expect(material.version).toBe(version);}
  const zero=new THREE.MeshStandardNodeMaterial();materials.push(zero);applyOrigamiSurface(zero,vec3(.6,.4,.2),undefined,disabled,float(1));
  expect(zero.normalNode).toBeNull();expect(zero.normalMap).toBeNull();expect(zero.bumpMap).toBeNull();expect(disabled.reliefLod).toBeUndefined();expect(Reflect.get(disabled,'edgeMaps')).toBeUndefined();
 }finally{for(const material of materials)material.dispose();wrap.mockRestore();for(const flush of flushes)flush.mockRestore();for(const context of [active,disabled,ordinary])context.dispose();}
});

interface InspectBuilder {
 scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;
 build():unknown;fragmentShader:string;
 getBindings():{bindings:InspectBinding[]}[];
}
interface InspectBinding {name:string;isSampledTexture?:boolean;texture?:THREE.Texture}
const Builder=THREE.WGSLNodeBuilder as unknown as new(object:THREE.Object3D,renderer:THREE.WebGPURenderer)=>InspectBuilder;
function heightSamples(text:string,bindings:InspectBinding[],height:THREE.Texture):number{
 const names=new Set(bindings.filter(binding=>binding.isSampledTexture&&binding.texture===height).map(binding=>binding.name));
 let count=0;
 for(const name of names){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');count += [...text.matchAll(new RegExp('\\btexture(?:Sample(?:Bias|Grad|Level)?|Load)\\s*\\(\\s*'+escaped+'\\s*,','g'))].length;}
 return count;
}
function uniformGateBlock(shader:string):{start:number;end:number;text:string}{
 const match=/if\s*\([^;{]*origamiGlobalReliefEnabled[^;{]*\)\s*\{/.exec(shader);if(!match)throw Error('Expected the real global uniform condition in WGSL');
 const start=match.index+match[0].lastIndexOf('{');let depth=1,end=start+1;
 for(;end<shader.length&&depth;end++){if(shader[end]==='{')depth++;else if(shader[end]==='}')depth--;}
 if(depth)throw Error('Unbalanced WGSL branch');return{start,end,text:shader.slice(start+1,end-1)};
}

/** CPU-only WGSL source contract, deliberately no Canvas/device/Native. This
 * isolated height texture identifies its dedicated original bump probes by
 * binding, separately from the PBR DFG LUT. Real P/K/M and
 * source-color Fn scoping must additionally be qualified in ROOT's fixture. */
test('all dedicated height probes are lexically inside the shared uniform branch in actual pinned WGSL',()=>{
 const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}} as HTMLCanvasElement});
 const initialization=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No device in source-only inspection');});renderer.hasFeature=()=>false;
 Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const map=new THREE.DataTexture(new Uint8Array(4*4*4).fill(128),4,4);map.needsUpdate=true;
 const coordinates=uv(),h0=texture(map,coordinates).r,hx=texture(map,coordinates.add(coordinates.dFdx())).r,hy=texture(map,coordinates.add(coordinates.dFdy())).r;
 const original=referencePaintBumpNormal(h0,hx,hy,float(.035)),gate=new GlobalReliefLod({disableAt:20,enableAt:28}),full=new THREE.MeshStandardNodeMaterial({flatShading:true}),gated=new THREE.MeshStandardNodeMaterial({flatShading:true}),flat=new THREE.MeshStandardNodeMaterial({flatShading:true});
 for(const material of [full,gated,flat])material.colorNode=vec3(.5,.4,.3);full.normalNode=original;gated.normalNode=original;installGlobalReliefLod(gated,gate);
 const geometry=new THREE.BoxGeometry(2,1,1),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),hemisphere=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(sun,hemisphere);camera.position.set(3,4,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const inspect=(material:THREE.NodeMaterial)=>{const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);scene.updateMatrixWorld(true);try{const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,hemisphere]);builder.build();return{shader:builder.fragmentShader,bindings:builder.getBindings().flatMap(group=>group.bindings)};}finally{scene.remove(mesh);}};
 try{
  const complete=inspect(full),conditional=inspect(gated),noNormal=inspect(flat),block=uniformGateBlock(conditional.shader);
  // Standard r186 also owns a DFG LUT. Identify only the independently-owned
  // height map through actual bindings; a flat PBR shader is not texture-free.
  expect(complete.bindings.some(binding=>binding.isSampledTexture&&binding.texture===map)).toBe(true);
  expect(conditional.bindings.some(binding=>binding.isSampledTexture&&binding.texture===map)).toBe(true);
  expect(noNormal.bindings.some(binding=>binding.isSampledTexture&&binding.texture===map)).toBe(false);
  const probes=heightSamples(complete.shader,complete.bindings,map);
  expect(probes).toBeGreaterThan(0);expect(heightSamples(conditional.shader,conditional.bindings,map)).toBe(probes);
  expect(heightSamples(block.text,conditional.bindings,map)).toBe(probes);
  expect(heightSamples(conditional.shader.slice(0,block.start)+conditional.shader.slice(block.end),conditional.bindings,map)).toBe(0);
  expect(heightSamples(noNormal.shader,noNormal.bindings,map)).toBe(0);
  const node=gated.normalNode,version=gated.version;gate.update('orthographic',1);expect(gated.normalNode).toBe(node);expect(gated.version).toBe(version);expect(gate.enabled.value).toBe(0);gate.update('perspective',1);expect(gate.enabled.value).toBe(1);
  expect(initialization).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);
 }finally{for(const material of [full,gated,flat])material.dispose();geometry.dispose();map.dispose();initialization.mockRestore();}
 // A cold r186 renderer owns no GPU allocation; dispose() would initialize its
 // animation loop, so this inert inspection object never enters that lifecycle.
});
