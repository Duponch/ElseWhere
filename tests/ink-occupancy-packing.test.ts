/** Actual preparation shader, synthetic byte-domain algebra and structural
 * texture declarations only. No device, raster bytes or performance claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {attribute,float,uniform,varying,vec4} from 'three/tsl';
import {inkOccupancyPackingNode,registerInkOccupancyPreparationWitness,inkOccupancyPreparationWitness} from '../src/render/surfaces/InkOccupancyPacking';
import {writeTestFileSync} from './test-output';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';

interface Binding{name:string;visibility:number;isSampledTexture?:boolean;isSampler?:boolean;isStorageBuffer?:boolean;texture?:THREE.Texture}
interface BuilderPort{scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{needsInterpolation:boolean}[];build():void;getBindings():{bindings:Binding[]}[];getAttributesArray():{name:string}[]}

function assertPackingSamplerAndMask(bindings:Binding[],fs:string,bank:THREE.Texture):void {
 // r186 WGSLNodeBuilder.getUniformFromNode declares a sampler for EVERY
 // filterable texture even when TextureNode.sampler=false. This one is unused:
 // require its exact bank identity and declaration-only occurrence, not a
 // filtered textureSample operation or an increased runtime binding budget.
 const samplers=bindings.filter(x=>x.isSampler&&!x.isSampledTexture);expect(samplers).toHaveLength(1);
 expect(samplers[0]!.texture).toBe(bank);expect(samplers[0]!.name).toMatch(/^\w+$/);
 expect(fs.match(new RegExp('\\b'+samplers[0]!.name+'\\b','g'))).toHaveLength(1);
 // TSL.select(1,0) emits an if/else in this actual r186 graph. Assert the
 // actual RGB predicate and exact0/1 assignments to the SAME output variable.
 const mask=fs.match(/if\s*\(\s*\(\s*max\(\s*max\(\s*(\w+)\.x,\s*\1\.y\s*\),\s*\1\.z\s*\)\s*>\s*0\.0\s*\)\s*\)\s*\{\s*(\w+)\s*=\s*1\.0;\s*\}\s*else\s*\{\s*\2\s*=\s*0\.0;\s*\}/);
 expect(mask).not.toBeNull();expect(fs).toContain('.xyz, '+mask![2]+' );');
}

test('the actual occupancy shader loads stored RGB at each exact mip without filtered sampling, derivatives, Source kernel or alpha shortcut',()=>{
 const r=new THREE.WebGPURenderer({canvas:{width:128,height:128,style:{}}as HTMLCanvasElement}),init=vi.spyOn(r,'init').mockImplementation(()=>{throw Error('No device in occupancy cold contract');});r.hasFeature=()=>false;r.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(r.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(r.backend,'renderer',r);
 // Extent/format declaration only: these four bytes are not an uploaded image.
 const bank=new THREE.DataArrayTexture(new Uint8Array(4),128,128,4);bank.colorSpace=THREE.SRGBColorSpace;bank.flipY=false;bank.minFilter=THREE.LinearMipmapLinearFilter;bank.magFilter=THREE.LinearFilter;bank.generateMipmaps=false;bank.mipmaps=Array.from({length:4},(_,level)=>({data:new Uint8Array(0),width:128/2**level,height:128/2**level}));
 const g=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>BuilderPort;
 try{
  for(let level=0;level<4;level++){
   const n=128/2**level,m=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false}),bodyLayer=uniform(2),inkLayer=uniform(3);m.vertexNode=vec4(attribute('position','vec3'),1);m.fragmentNode=inkOccupancyPackingNode(bank,bodyLayer,inkLayer,level,[n,n],varying(attribute('uv','vec2')));const mesh=new THREE.Mesh(g,m);scene.add(mesh);scene.updateMatrixWorld(true);const b=new Builder(mesh,r);b.scene=scene;b.camera=camera;b.material=m;b.lightsNode=new THREE.LightsNode();
   try{b.build();const bindings=b.getBindings().flatMap(group=>group.bindings),fs=b.fragmentShader;writeTestFileSync('artifacts/ink-occupancy-mip-'+level+'-fragment.wgsl',fs);writeTestFileSync('artifacts/ink-occupancy-mip-'+level+'-bindings.json',JSON.stringify({scope:'Cold shader only; Native stored-byte roundtrip still required',level,size:n,bindings:bindings.map(x=>({name:x.name,visibility:x.visibility,sampled:!!x.isSampledTexture,sampler:!!x.isSampler&&!x.isSampledTexture,storage:!!x.isStorageBuffer,texture:x.texture?.id}))},null,2)+'\n');expect(bindings.filter(x=>x.isSampledTexture&&x.texture===bank)).toHaveLength(1);assertPackingSamplerAndMask(bindings,fs,bank);expect(bindings.filter(x=>x.isStorageBuffer)).toHaveLength(0);expect(fs.match(/\btextureLoad\s*\(/g)).toHaveLength(2);expect(fs).not.toMatch(/\b(?:textureSample\w*|dpdx|dpdy)\s*\(/);expect(fs).toMatch(/\bmax\s*\(\s*max\s*\(/);expect(fs).not.toMatch(/\.w\b/);expect(fs).toContain('.xyz');expect(unboundWgslTextureResources(fs)).toEqual([]);expect(unboundWgslTextureResources(b.vertexShader)).toEqual([]);expect(b.getAttributesArray().length).toBeLessThanOrEqual(16);expect(b.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);const groups=[...fs.matchAll(/@group\(\s*(\d+)\s*\)/g),...b.vertexShader.matchAll(/@group\(\s*(\d+)\s*\)/g)].map(x=>Number(x[1]));expect(Math.max(0,...groups)).toBeLessThan(4);}
   finally{mesh.removeFromParent();m.dispose();}
  }
  expect(init).not.toHaveBeenCalled();
  expect(()=>inkOccupancyPackingNode(bank,float(0),float(1),1,[128,128],attribute('uv','vec2'))).toThrow(/exact mip/);bank.colorSpace=THREE.NoColorSpace;expect(()=>inkOccupancyPackingNode(bank,float(0),float(1),0,[128,128],attribute('uv','vec2'))).toThrow(/RGBA8 sRGB/);
 }finally{g.dispose();bank.dispose();init.mockRestore();}
},60000);

test('preparation witnesses are explicit renderer-local leases and unregister safely without enabling product readback',()=>{
 const a=new THREE.WebGPURenderer({canvas:{width:1,height:1,style:{}}as HTMLCanvasElement}),b=new THREE.WebGPURenderer({canvas:{width:1,height:1,style:{}}as HTMLCanvasElement}),one=vi.fn(),two=vi.fn();expect(inkOccupancyPreparationWitness(a)).toBeUndefined();expect(inkOccupancyPreparationWitness(b)).toBeUndefined();const close=registerInkOccupancyPreparationWitness(a,one);expect(inkOccupancyPreparationWitness(a)).toBe(one);expect(inkOccupancyPreparationWitness(b)).toBeUndefined();expect(()=>registerInkOccupancyPreparationWitness(a,two)).toThrow('already owns');close();close();const closeTwo=registerInkOccupancyPreparationWitness(a,two);close();expect(inkOccupancyPreparationWitness(a)).toBe(two);closeTwo();expect(inkOccupancyPreparationWitness(a)).toBeUndefined();expect(one).not.toHaveBeenCalled();expect(two).not.toHaveBeenCalled();
});
