/** Cold shader and synthetic linear-domain bounds only. No device, stored
 * Source bytes, perceptual quality or performance are inferred. */
import{expect,test,vi}from'vitest';
import*as THREE from'three/webgpu';
import{attribute,uniform,varying,vec4}from'three/tsl';
import{preparedScalarInkBasis,inkOccupancyPackingNode}from'../src/render/surfaces/InkOccupancyPacking';
import{writeTestFileSync}from'./test-output';
import{unboundWgslTextureResources}from'./wgsl-resource-bindings';
const clamp=(x:number)=>Math.min(1,Math.max(0,x)),dot=(a:readonly number[],b:readonly number[])=>a.reduce((n,v,i)=>n+v*b[i]!,0);

test('scalar ink basis comes from the real dense f32 lease colour; unsupported/degenerate optional inputs preserve BI',()=>{
 const input=[.017641954,.011612245,.009134059],basis=preparedScalarInkBasis(true,input);expect(basis?.color).toEqual([Math.fround(input[0]!),Math.fround(input[1]!),Math.fround(input[2]!)]);expect(Object.isFrozen(basis)).toBe(true);expect(Object.isFrozen(basis!.color)).toBe(true);expect(basis!.color).not.toBe(input);
 for(const color of[undefined,[],Array(3),[1,1],[1,1,1,1],[NaN,.1,.2],[Infinity,.1,.2],[-.1,.1,.2],[1.1,.1,.2],[0,0,0],[1e-30,1e-30,1e-30]])expect(preparedScalarInkBasis(true,color)).toBeUndefined();expect(preparedScalarInkBasis(false,input)).toBeUndefined();
});

test('per-channel projection+clipping+UNORM error bounds survive nonnegative bilinear/trilinear weights independently of body tint',()=>{
 const k=preparedScalarInkBasis(true,[.02,.015,.01])!.color,values=[[0,0,0],[.014,.004,.011],[.003,.004,.001],[.025,.018,.012]],weights=[.125,.25,.375,.25],norm=dot(k,k),records=values.map(i=>{const raw=dot(i,k)/norm,s=clamp(raw),quant=Math.round(s*255)/255,original=i.map((value,c)=>value-k[c]!*s),error=i.map((value,c)=>Math.abs(value-k[c]!*quant)),bound=original.map((value,c)=>Math.abs(value)+k[c]!/(2*255));for(let c=0;c<3;c++)expect(error[c]!).toBeLessThanOrEqual(bound[c]!+1e-15);return{i,raw,s,quant,error,bound};});
 expect(records[1]!.error.some(v=>v>0)).toBe(true);expect(records[3]!.raw).toBeGreaterThan(1);expect(records[3]!.s).toBe(1);
 for(let c=0;c<3;c++){const filteredI=records.reduce((n,r,i)=>n+r.i[c]!*weights[i]!,0),filteredA=records.reduce((n,r,i)=>n+r.quant*weights[i]!,0),limit=Math.max(...records.map(r=>r.bound[c]!));expect(Math.abs(filteredI-k[c]!*filteredA)).toBeLessThanOrEqual(limit+1e-15);for(const tint of[0,.03,.6,1]){const body=.31*tint;expect(Math.abs((body+filteredI)-(body+k[c]!*filteredA))).toBeLessThanOrEqual(limit+1e-15);}}
 // This algebraic bound includes chromatic residual and clipping. It does
 // NOT establish an imperceptible error or bound the final lighting pipeline.
});

interface Binding{name:string;visibility:number;isSampledTexture?:boolean;isSampler?:boolean;isStorageBuffer?:boolean;texture?:THREE.Texture}
interface Builder{scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{needsInterpolation:boolean}[];build():void;getBindings():{bindings:Binding[]}[];getAttributesArray():{name:string}[]}
test('actual scalar packing reads B/I RGB at each exact mip, keeps Body.rgb and stores a clamped LS coefficient without filtered sampling or alpha shortcut',()=>{
 const r=new THREE.WebGPURenderer({canvas:{width:128,height:128,style:{}}as HTMLCanvasElement}),init=vi.spyOn(r,'init').mockImplementation(()=>{throw Error('No device in scalar-ink cold contract');});r.hasFeature=()=>false;r.outputColorSpace=THREE.LinearSRGBColorSpace;Reflect.set(r.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(r.backend,'renderer',r);
 const bank=new THREE.DataArrayTexture(new Uint8Array(4),128,128,2);bank.colorSpace=THREE.SRGBColorSpace;bank.flipY=false;bank.minFilter=THREE.LinearMipmapLinearFilter;bank.magFilter=THREE.LinearFilter;bank.generateMipmaps=false;bank.mipmaps=Array.from({length:4},(_,level)=>({data:new Uint8Array(0),width:128/2**level,height:128/2**level}));const basis=preparedScalarInkBasis(true,[.02,.015,.01])!,geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),Ctor=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Builder;
 try{for(let level=0;level<4;level++){const n=128/2**level,m=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false});m.vertexNode=vec4(attribute('position','vec3'),1);m.fragmentNode=inkOccupancyPackingNode(bank,uniform(0),uniform(1),level,[n,n],varying(attribute('uv','vec2')),basis.color);const mesh=new THREE.Mesh(geometry,m);scene.add(mesh);scene.updateMatrixWorld(true);const b=new Ctor(mesh,r);b.scene=scene;b.camera=camera;b.material=m;b.lightsNode=new THREE.LightsNode();
  try{b.build();const fs=b.fragmentShader,bindings=b.getBindings().flatMap(g=>g.bindings),samplers=bindings.filter(v=>v.isSampler&&!v.isSampledTexture);writeTestFileSync('artifacts/scalar-ink-mip-'+level+'-vertex.wgsl',b.vertexShader);writeTestFileSync('artifacts/scalar-ink-mip-'+level+'-fragment.wgsl',fs);writeTestFileSync('artifacts/scalar-ink-mip-'+level+'-bindings.json',JSON.stringify(bindings.map(v=>({name:v.name,visibility:v.visibility,texture:v.texture?.id,sampled:!!v.isSampledTexture,sampler:!!v.isSampler&&!v.isSampledTexture,storage:!!v.isStorageBuffer})),null,2)+'\n');expect(bindings.filter(v=>v.isSampledTexture&&v.texture===bank)).toHaveLength(1);expect(samplers).toHaveLength(1);expect(samplers[0]!.texture).toBe(bank);expect(fs.match(new RegExp('\\b'+samplers[0]!.name+'\\b','g'))).toHaveLength(1);expect(bindings.filter(v=>v.isStorageBuffer)).toHaveLength(0);expect(fs.match(/\btextureLoad\s*\(/g)).toHaveLength(2);expect(fs).not.toMatch(/\b(?:textureSample\w*|dpdx|dpdy)\s*\(/);expect(fs).not.toMatch(/\.w\b/);expect(fs).toContain('dot(');expect(fs).toContain('clamp(');expect(fs).toContain('.xyz');expect(unboundWgslTextureResources(fs)).toEqual([]);expect(unboundWgslTextureResources(b.vertexShader)).toEqual([]);expect(b.getBindings().length).toBeLessThanOrEqual(4);expect(b.getAttributesArray().length).toBeLessThanOrEqual(16);expect(b.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);
  }finally{mesh.removeFromParent();m.dispose();}}
  expect(init).not.toHaveBeenCalled();
 }finally{geometry.dispose();bank.dispose();init.mockRestore();}
},60000);
