import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createOpaqueAtlasMaterial,opaqueAtlasMipmaps} from '../src/render/origami/baked/material';
import {writeTestFileSync} from './test-output';

test('opaque mip colors are averaged in linear light and end at the admitted gutter level',()=>{
  const image=new Uint8Array([0,0,0,255,255,255,255,255,0,0,0,255,255,255,255,255]);
  const mip=opaqueAtlasMipmaps(image,2,2,2);
  expect(mip).toHaveLength(2);expect(mip[0]!.data).toBe(image);
  expect([...mip[1]!.data]).toEqual([188,188,188,255]);
  expect(()=>opaqueAtlasMipmaps(image,2,2,3)).toThrow('aligned');
  const transparent=image.slice();transparent[3]=254;expect(()=>opaqueAtlasMipmaps(transparent,2,2,1)).toThrow('transparency');
});

test('actual physical shader has one atlas lookup and no original paint compositor or contour transparency',()=>{
  const pixels=new Uint8Array(8*8*4).fill(255),atlas=createOpaqueAtlasMaterial(pixels,8,8,4);
  const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}} as HTMLCanvasElement});
  const init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('Cold inspection must not create a graphics device');});
  renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
  const geometry=new THREE.BoxGeometry();geometry.setAttribute('bakedUv',geometry.getAttribute('uv').clone());
  const mesh=new THREE.Mesh(geometry,atlas.material),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100);
  const sun=new THREE.DirectionalLight(0xffffff,3),ambient=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(mesh,sun,ambient);camera.position.set(3,4,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
  type Binding={name:string;texture?:THREE.Texture;isSampledTexture?:boolean};
  type Inspector={scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;build():unknown;fragmentShader:string;getBindings():{bindings:Binding[]}[]};
  const Builder=THREE.WGSLNodeBuilder as unknown as new(object:THREE.Object3D,renderer:THREE.WebGPURenderer)=>Inspector;
  try{
    const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=atlas.material;builder.lightsNode=new THREE.LightsNode().setLights([sun,ambient]);builder.build();
    const shader=builder.fragmentShader,bindings=builder.getBindings().flatMap(g=>g.bindings),color=bindings.filter(b=>b.isSampledTexture&&b.texture===atlas.texture);
    writeTestFileSync('artifacts/origami-baked-opaque-material.wgsl',shader);
    expect(color).toHaveLength(1);
    expect(shader.match(new RegExp('textureSample(?:Bias|Level|Grad)?\\(\\s*'+color[0]!.name+'\\s*,','g'))).toHaveLength(1);
    expect(shader).not.toMatch(/origamiEndpoint|origamiBrush|origamiGlobalRelief|origamiPaintProfile/);
    expect(atlas.material.transparent).toBe(false);expect(atlas.material.alphaTest).toBe(0);expect(atlas.material.depthWrite).toBe(true);
    expect(atlas.material.normalNode).toBeNull();expect(atlas.texture.generateMipmaps).toBe(false);expect(atlas.texture.mipmaps).toHaveLength(4);
    expect(atlas.bytes).toBe((64+16+4+1)*4);expect(init).not.toHaveBeenCalled();
  }finally{atlas.dispose();geometry.dispose();init.mockRestore();}
});
