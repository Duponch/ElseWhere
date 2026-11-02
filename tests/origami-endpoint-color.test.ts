/** Regression contracts for endpoint color composition. The cold shader
 * inspector deliberately never initializes a graphics device or paint Canvas. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {float,uv,vec2,vec3} from 'three/tsl';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stubResidentPaintToSink} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
import {GraphicsStyleContext,applyOrigamiSurface,withGraphicsStyle} from '../src/render/graphics-style';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES as defaults} from '../src/ui3d/native-preferences';
type RGB=readonly[number,number,number];
const f=Math.fround;
function encode(value:number):number{return value<=.0031308?value*12.92:Math.pow(value,.41666)*1.055-.055;}
function decode(value:number):number{return value<=.04045?value*.0773993808:Math.pow(value*.9478672986+.0521327014,2.4);}
function encode32(value:number):number{const v=f(value);return v<=f(.0031308)?f(v*f(12.92)):f(f(f(Math.pow(v,f(.41666)))*f(1.055))-f(.055));}
function decode32(value:number):number{const v=f(value);return v<=f(.04045)?f(v*f(.0773993808)):f(Math.pow(f(f(v*f(.9478672986))+f(.0521327014)),f(2.4)));}
function originalEncodedComposite(pigment:RGB,paper:RGB,coverage:number):RGB{
 return pigment.map((p,index)=>decode(encode(paper[index]!)*(1-coverage)+encode(p)*coverage)) as unknown as RGB;
}
function endpointComposite(pigment:RGB,paper:RGB,coverage:number):RGB{
 if(coverage===1)return pigment;if(coverage===0)return paper;return originalEncodedComposite(pigment,paper,coverage);
}
function installedEndpointRoundTrip32(value:number):number{return decode32(encode32(value));}

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8'),hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function inertContext(impasto=0){const context=new GraphicsStyleContext({...defaults,style:'origami',impasto,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{});context.paintNode(uv(),float(0));return{context,flush};}
function snapshots(context:GraphicsStyleContext){const storage=context.debugPaintStorage();return[...storage.banks,storage.paper,storage.coverage,storage.lookup].map(({texture,data})=>({texture,source:texture.source,image:texture.image,data,buffer:data.buffer,bytes:new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice(),format:texture.format,colorSpace:texture.colorSpace,minFilter:texture.minFilter,magFilter:texture.magFilter,generateMipmaps:texture.generateMipmaps}));}

test('building endpoint graphs preserves the original physical paint data and texture identities',()=>{
 const {context,flush}=inertContext(),before=snapshots(context),material=new THREE.MeshStandardNodeMaterial();
 try{applyOrigamiSurface(material,vec3(.6,.4,.2),undefined,context,float(1),false,true,{opaqueColorEndpoints:true});const after=snapshots(context);expect(after).toHaveLength(before.length);
  before.forEach((row,index)=>{const next=after[index]!;for(const key of ['texture','source','image','data','buffer'] as const)expect(next[key]).toBe(row[key]);expect(next.bytes).toEqual(row.bytes);for(const key of ['format','colorSpace','minFilter','magFilter','generateMipmaps'] as const)expect(next[key]).toBe(row[key]);});
 }finally{material.dispose();flush.mockRestore();context.dispose();}
});

test('exact zero/one endpoints return input float values; the pinned installed transfer roundtrip error is explicitly bounded, not declared bit-identical',()=>{
 expect(hash(read('../node_modules/three/src/nodes/display/ColorSpaceFunctions.js'))).toBe('7e4bb9713bbb2d0746338a9ea07008611641b2180c9f00a63fde6d3066bbbea7');
 const values=[0,Math.fround(2**-120),.0031308-1e-8,.0031308,.0031308+1e-8,...Array.from({length:256},(_,value)=>value/255),1];
 let maxDelta=0;for(const value of values){const v=Math.fround(value),pigment:RGB=[v,.37,.81],paper:RGB=[.13,v,.07];expect(endpointComposite(pigment,paper,1)).toBe(pigment);expect(endpointComposite(pigment,paper,0)).toBe(paper);maxDelta=Math.max(maxDelta,Math.abs(v-installedEndpointRoundTrip32(v)));}
 expect(maxDelta).toBeLessThan(2e-5);expect(maxDelta).toBeGreaterThan(0);
 // The transfer's0.41666 exponent is not an exact1/2.4 inverse. This is a
 // float32 oracle bound only; Native must establish the framebuffer delta.
});

test('every fractional coverage retains the original encoded-sRGB mix exactly, including immediate float neighbors of both endpoints',()=>{
 const cases:readonly[RGB,RGB][]=[[[0,1,.2],[1,0,.8]],[[.0031307,.0031309,.5],[.81,.11,.0031308]],[[.012,.27,.999],[.76,.42,.002]]];
 for(const[pigment,paper]of cases)for(const coverage of [2**-24,...Array.from({length:254},(_,i)=>(i+1)/255),1-2**-24])expect(endpointComposite(pigment,paper,coverage)).toEqual(originalEncodedComposite(pigment,paper,coverage));
 const fractional=endpointComposite([0,1,.2],[1,0,.8],.5);expect(Math.abs(fractional[0]-.5)).toBeGreaterThan(.1);
});

interface Binding {name:string;isSampledTexture?:boolean;texture?:THREE.Texture}
interface Inspector {scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;build():unknown;fragmentShader:string;getBindings():{bindings:Binding[]}[]}
const Builder=THREE.WGSLNodeBuilder as unknown as new(object:THREE.Object3D,renderer:THREE.WebGPURenderer)=>Inspector;
function inspect(material:THREE.NodeMaterial,resourceAttributes=false){
 const renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}} as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No device in private CPU source inspection');});renderer.hasFeature=()=>false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
 Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const geometry=new THREE.BoxGeometry(2,1,1);
 if(resourceAttributes){
  const count=geometry.getAttribute('position').count,color=new Float32Array(count*3),paint=new Float32Array(count*4),root=new Float32Array(count*3),basis=new Float32Array(count*4);
  for(let i=0;i<count;i++){color.set([.6,.4,.2],i*3);paint.set([.6,.4,.2,1],i*4);root.set([0,0,.62],i*3);basis.set([0,1,0,1],i*4);}
  geometry.setAttribute('color',new THREE.BufferAttribute(color,3));geometry.setAttribute('origamiPaint',new THREE.BufferAttribute(paint,4));geometry.setAttribute('windRoot',new THREE.BufferAttribute(root,3));geometry.setAttribute('windBasis',new THREE.BufferAttribute(basis,4));
 }
 const mesh=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),hemisphere=new THREE.HemisphereLight(0xffffff,0x808080,2);scene.add(mesh,sun,hemisphere);camera.position.set(3,4,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 try{const builder=new Builder(mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,hemisphere]);builder.build();expect(init).not.toHaveBeenCalled();expect(Reflect.get(renderer,'_initialized')).toBe(false);return{shader:builder.fragmentShader,bindings:builder.getBindings().flatMap(group=>group.bindings)};}
 finally{geometry.dispose();init.mockRestore();}
 // Do not dispose a cold r186 renderer into its animation lifecycle.
}
function blockAt(shader:string,brace:number){if(shader[brace]!=='{')throw Error('Expected WGSL block');let depth=1,end=brace+1;for(;end<shader.length&&depth;end++){if(shader[end]==='{')depth++;else if(shader[end]==='}')depth--;}if(depth)throw Error('Unbalanced WGSL block');return{start:brace,end,text:shader.slice(brace+1,end-1)};}
function endpointChain(shader:string){
 const first=/if\s*\([^;{]*origamiEndpointCoverage[^;{]*\)\s*\{/.exec(shader);if(!first)throw Error('Expected exact endpoint condition');const one=blockAt(shader,first.index+first[0].lastIndexOf('{'));
 // Installed ConditionalNode emits ElseIf as else { if (...) { ... } },
 // while another legal builder may use else if. Accept both lexical forms.
 const direct=/^\s*else\s+if\s*\([^;{]*origamiEndpointCoverage[^;{]*\)\s*\{/.exec(shader.slice(one.end));let zero:ReturnType<typeof blockAt>,outer:ReturnType<typeof blockAt>|undefined;
 if(direct)zero=blockAt(shader,one.end+direct.index+direct[0].lastIndexOf('{'));
 else{const wrapper=/^\s*else\s*\{/.exec(shader.slice(one.end));if(!wrapper)throw Error('Expected endpoint Else wrapper');outer=blockAt(shader,one.end+wrapper[0].lastIndexOf('{'));const second=/^\s*if\s*\([^;{]*origamiEndpointCoverage[^;{]*\)\s*\{/.exec(shader.slice(outer.start+1));if(!second)throw Error('Expected second exact endpoint condition');zero=blockAt(shader,outer.start+1+second[0].lastIndexOf('{'));}
 const otherwise=/^\s*else\s*\{/.exec(shader.slice(zero.end));if(!otherwise)throw Error('Expected fractional Else');const partial=blockAt(shader,zero.end+otherwise.index+otherwise[0].lastIndexOf('{'));return{one,zero,partial,start:first.index,end:outer?.end??partial.end};
}
function samples(shader:string,bindings:Binding[],texture:THREE.Texture):{index:number;text:string}[]{
 const result:{index:number;text:string}[]=[];for(const name of new Set(bindings.filter(binding=>binding.isSampledTexture&&binding.texture===texture).map(binding=>binding.name))){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');for(const match of shader.matchAll(new RegExp('\\btexture(?:Sample(?:Bias|Grad|Level)?|Load)\\s*\\(\\s*'+escaped+'\\s*,','g')))result.push({index:match.index!,text:match[0]});}return result;
}
function basic(context:GraphicsStyleContext){const material=new THREE.MeshBasicNodeMaterial();material.toneMapped=false;material.colorNode=context.facePaintNode(uv().mul(vec2(3,1)),uv(),float(1),float(0),false,true).rgb;return material;}

test('actual color-only WGSL calls all original transfer functions only inside fractional Else; endpoint bodies contain no transfers or pow',()=>{
 const {context,flush}=inertContext(),material=basic(context);
 try{
  const{shader}=inspect(material),chain=endpointChain(shader),main=shader.indexOf('fn main(');expect(main).toBeGreaterThanOrEqual(0);
  const transfers=[...shader.slice(main).matchAll(/\bsRGBTransfer(?:OETF|EOTF)\s*\(/g)];expect(transfers).toHaveLength(3);
  for(const call of transfers){const index=main+call.index!;expect(index).toBeGreaterThan(chain.partial.start);expect(index).toBeLessThan(chain.partial.end);}
  for(const branch of[chain.one.text,chain.zero.text])expect(branch).not.toMatch(/sRGBTransfer|\bpow\s*\(/);
  // The named transfer definitions themselves contain pow outside main;
  // their call sites, not dead source definitions, establish execution scope.
  expect(chain.partial.text.match(/sRGBTransferOETF\s*\(/g)).toHaveLength(2);expect(chain.partial.text.match(/sRGBTransferEOTF\s*\(/g)).toHaveLength(1);
 }finally{material.dispose();flush.mockRestore();context.dispose();}
});

test('all P/K/M color samples execute before the first coverage If; neither endpoint nor fractional branch contains an implicit-derivative texture sample',()=>{
 const {context,flush}=inertContext(),material=basic(context);
 try{
  const storage=context.debugPaintStorage(),{shader,bindings}=inspect(material),chain=endpointChain(shader);
  expect(storage.banks.map(bank=>samples(shader,bindings,bank.texture).length)).toEqual([2,1,1,1,1,1,1,1]);expect(samples(shader,bindings,storage.paper.texture)).toHaveLength(1);expect(samples(shader,bindings,storage.coverage.texture)).toHaveLength(1);
  for(const{texture}of[...storage.banks,storage.paper,storage.coverage])for(const sample of samples(shader,bindings,texture))expect(sample.index).toBeLessThan(chain.start);
  expect(shader.slice(chain.start,chain.end)).not.toMatch(/\btexture(?:Sample(?:Bias|Grad|Level)?|Load)\s*\(/);
  expect(shader.slice(chain.start,chain.one.start)).toMatch(/==\s*1(?:\.0)?\b/);expect(shader.slice(chain.one.end,chain.zero.start)).toMatch(/==\s*0(?:\.0)?\b/);
 }finally{material.dispose();flush.mockRestore();context.dispose();}
});

test('actual Standard retains nine executed P/K/M reads near and three far, and Default/explicit-zero preserve their existing strict guards',()=>{
 const positive=inertContext(1),zero=inertContext(0),ordinary=new GraphicsStyleContext({...defaults,style:'default',impasto:0,wear:0}),materials:THREE.NodeMaterial[]=[];
 try{
  for(const{context}of[positive,zero]){
   const material=new THREE.MeshStandardNodeMaterial({flatShading:true});materials.push(material);applyOrigamiSurface(material,vec3(.6,.4,.2),undefined,context,float(1),false,true,{opaqueColorEndpoints:true});const storage=context.debugPaintStorage(),{shader,bindings}=inspect(material);
   if(context.reliefEnabled){
    expect(shader).not.toContain('origamiEndpointCoverage');
    const match=/if\s*\([^;{]*origamiGlobalReliefEnabled[^;{]*\)\s*\{/.exec(shader);expect(match).not.toBeNull();const gate=blockAt(shader,match!.index+match![0].lastIndexOf('{')),outside=shader.slice(0,gate.start)+shader.slice(gate.end);
    expect(storage.banks.map(bank=>samples(outside,bindings,bank.texture).length)).toEqual([2,1,1,1,1,1,1,1]);expect(storage.banks.map(bank=>samples(gate.text,bindings,bank.texture).length)).toEqual([4,2,2,2,2,2,2,2]);
    for(const{texture}of[storage.paper,storage.coverage]){expect(samples(outside,bindings,texture)).toHaveLength(1);expect(samples(gate.text,bindings,texture)).toHaveLength(2);}
   }else{
    expect(shader).toContain('origamiEndpointCoverage');
    expect(shader).not.toContain('origamiGlobalReliefEnabled');expect(material.normalNode).toBeNull();expect(material.normalMap).toBeNull();expect(material.bumpMap).toBeNull();expect(context.reliefLod).toBeUndefined();expect(Reflect.get(context,'edgeMaps')).toBeUndefined();
    expect(storage.banks.map(bank=>samples(shader,bindings,bank.texture).length)).toEqual([2,1,1,1,1,1,1,1]);expect(samples(shader,bindings,storage.paper.texture)).toHaveLength(1);expect(samples(shader,bindings,storage.coverage.texture)).toHaveLength(1);
   }
  }
  const plain=new THREE.MeshStandardNodeMaterial(),unchanged=vec3(.2,.3,.4);materials.push(plain);plain.colorNode=unchanged;applyOrigamiSurface(plain,vec3(1),undefined,ordinary);expect(plain.colorNode).toBe(unchanged);expect(Reflect.get(ordinary,'colorArray')).toBeUndefined();expect(ordinary.reliefLod).toBeUndefined();expect(ordinary.wearEnabled).toBe(false);expect(()=>ordinary.createWearMaterial(null)).toThrow('Disabled');
 }finally{for(const material of materials)material.dispose();for(const entry of[positive,zero]){entry.flush.mockRestore();entry.context.dispose();}ordinary.dispose();}
});


test('unselected zero-relief surfaces retain the original compositor without endpoint conditions',()=>{
 const {context,flush}=inertContext(0),material=new THREE.MeshStandardNodeMaterial({flatShading:true});
 try{applyOrigamiSurface(material,vec3(.6,.4,.2),undefined,context,float(1));const {shader}=inspect(material);expect(shader).not.toContain('origamiEndpoint');expect(shader).not.toContain('origamiGlobalReliefEnabled');expect(material.normalNode).toBeNull();expect(context.reliefLod).toBeUndefined();
  const main=shader.slice(shader.indexOf('fn main('));expect(main.match(/sRGBTransferOETF\s*\(/g)).toHaveLength(2);expect(main.match(/sRGBTransferEOTF\s*\(/g)).toHaveLength(1);
 }finally{material.dispose();flush.mockRestore();context.dispose();}
});

test('real ResourceLayer construction selects endpoints only for its zero-relief painted body and wind clone',()=>{
 for(const setting of[{style:'origami',impasto:0},{style:'origami',impasto:1},{style:'default',impasto:0}] as const){
  const entry=setting.style==='origami'?inertContext(setting.impasto):(()=>{const context=new GraphicsStyleContext({...defaults,style:'default',impasto:0,wear:0});return{context,flush:vi.spyOn(context,'flushPaint').mockImplementation(()=>{})};})(),{context,flush}=entry;
  const sourcePlain=new THREE.MeshLambertNodeMaterial({flatShading:true}),sourcePaint=new THREE.MeshStandardNodeMaterial({flatShading:true}),group=new THREE.Group();
  let layer:ResourceLayer|undefined;
  try{
   layer=withGraphicsStyle(context,()=>new ResourceLayer(group,sourcePlain,sourcePaint));
   const[plain,painted,windPlain,windPainted]=layer.compiledMaterials435();
   expect(windPainted!.colorNode).toBe(painted!.colorNode);expect(windPlain!.colorNode).toBe(plain!.colorNode);
   for(const[variant,material]of[['plain',plain!],['painted',painted!],['windPlain',windPlain!],['windPainted',windPainted!]] as const){
    const {shader}=inspect(material,true),selected=setting.style==='origami'&&setting.impasto===0&&(variant==='painted'||variant==='windPainted');
    if(selected){
     // Actual builder output from the constructor's private body materials.
     // Removing ResourceLayer's opt-in makes this branch fail, even though
     // all standalone compositor contracts above could still succeed.
     const chain=endpointChain(shader);expect(chain.one.text).toContain('origamiEndpointPigment');expect(chain.zero.text).toContain('origamiEndpointPaper');
     expect(chain.partial.text.match(/sRGBTransferOETF\s*\(/g)).toHaveLength(2);expect(chain.partial.text.match(/sRGBTransferEOTF\s*\(/g)).toHaveLength(1);
    }else expect(shader).not.toContain('origamiEndpoint');
    if(setting.impasto===0){expect(material.normalNode).toBeNull();expect(shader).not.toContain('origamiGlobalReliefEnabled');}
    else if(variant==='painted'||variant==='windPainted')expect(material.normalNode).not.toBeNull();
   }
   expect(context.wearEnabled).toBe(false);expect(Reflect.get(layer,'wearPlain')).toBeUndefined();expect(Reflect.get(layer,'wearWind')).toBeUndefined();
   if(setting.impasto===0)expect(context.reliefLod).toBeUndefined();else expect(context.reliefLod).toBeDefined();
   if(setting.style==='default'){expect(Reflect.get(context,'colorArray')).toBeUndefined();expect(Reflect.get(context,'edgeMaps')).toBeUndefined();expect(flush).not.toHaveBeenCalled();}
   else{const edge=Reflect.get(context,'edgeMaps') as {bump?:THREE.Texture;color?:THREE.Texture};expect(edge.bump).toBeUndefined();expect(edge.color).toBeUndefined();}
  }finally{layer?.dispose();sourcePlain.dispose();sourcePaint.dispose();flush.mockRestore();context.dispose();}
 }
});
