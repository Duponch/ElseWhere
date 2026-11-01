import {expect,test,vi,afterEach} from 'vitest';
import * as THREE from 'three/webgpu';
import {attribute,vec2,vec3,float} from 'three/tsl';
import {applyPaintMetric,paintMetricFromDerivatives,type PaintVector2,type PaintVector3} from '../src/render/origami/paint-metric';
import {stubReferenceBakeToSink} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:vi.fn((...args:Parameters<typeof stubReferenceBakeToSink>)=>stubReferenceBakeToSink(...args))}));
import {bakeReferencePaintLayersToSink as bakeReferencePaintLayers} from '../src/render/origami/reference-paint-library';
import {applyOrigamiSurface,currentGraphicsStyle,GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES as defaults} from '../src/ui3d/native-preferences';
import {BASE_REFERENCE_PAINT_DESCRIPTORS} from '../src/render/origami/reference-profiles';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
const folded=()=>new GraphicsStyleContext({...defaults,style:'origami'});

interface GraphBuilder {context:object}
interface GraphNode {
 getChildren?:()=>Iterable<GraphNode>;getOutputNode?:(builder:GraphBuilder)=>GraphNode;
 jsFunc?:unknown;call?:()=>GraphNode;isTextureNode?:boolean;value?:unknown;uvNode?:unknown;name?:string;
}
/** Follow actual deferred Fn outputs, never closure captures. No shader/device
 * is initialized and stub pixels are not promoted to a pixel fidelity proof. */
function textureNodes(root:unknown):GraphNode[]{
 const geometry=new THREE.BufferGeometry(),material=new THREE.MeshStandardNodeMaterial(),mesh=new THREE.Mesh(geometry,material);
 const Constructor=THREE.NodeBuilder as unknown as new(object:THREE.Mesh)=>GraphBuilder,builder=new Constructor(mesh);builder.context={};
 const pending=[root as GraphNode],seen=new Set<GraphNode>();
 try{while(pending.length){const node=pending.pop()!;if(!node||seen.has(node))continue;seen.add(node);
  // The texture's uvNode is the contract boundary inspected below. Expanding
  // that coordinate would invoke fragment position/derivative setup, which
  // belongs to the real WGSL builder contract rather than this graph visitor.
  if(node.isTextureNode)continue;
  if(node.getOutputNode){pending.push(node.getOutputNode(builder));continue;}
  if(typeof node.jsFunc==='function'&&node.call){pending.push(node.call());continue;}
  if(node.getChildren)for(const child of node.getChildren())pending.push(child);
 }return [...seen].filter(node=>node.isTextureNode);}finally{geometry.dispose();material.dispose();}
}

function expectFaceSampling(context:GraphicsStyleContext,root:unknown,pigmentUv:unknown,faceUv:unknown):void {
 const nodes=textureNodes(root),banks=Reflect.get(context,'banks') as THREE.DataArrayTexture[],paper=Reflect.get(context,'paperArray'),coverage=Reflect.get(context,'coverageArray');
 const p=nodes.filter(node=>banks.includes(node.value as THREE.DataArrayTexture)),k=nodes.filter(node=>node.value===paper),m=nodes.filter(node=>node.value===coverage);
 expect(p.length).toBeGreaterThan(0);expect(k.length).toBeGreaterThan(0);expect(m.length).toBeGreaterThan(0);
 for(const node of p)expect(node.uvNode).toBe(pigmentUv);
 for(const node of [...k,...m])expect(node.uvNode).toBe(faceUv);
 expect(pigmentUv).not.toBe(faceUv);
}
afterEach(()=>{vi.clearAllMocks();vi.useRealTimers();});

test('construction scopes restore the previous renderer even when nested creation throws',()=>{
 const initial=currentGraphicsStyle(),outer=folded(),inner=new GraphicsStyleContext();
 try{withGraphicsStyle(outer,()=>{expect(currentGraphicsStyle()).toBe(outer);expect(()=>withGraphicsStyle(inner,()=>{throw Error('creation');})).toThrow('creation');expect(currentGraphicsStyle()).toBe(outer);});expect(currentGraphicsStyle()).toBe(initial);}finally{outer.dispose();inner.dispose();}
});
test('Default does no Origami raster, palette texture or node replacement',()=>{
 const context=new GraphicsStyleContext(),material=new THREE.MeshLambertNodeMaterial(),color=vec3(.4,.5,.6);material.colorNode=color;
 try{applyOrigamiSurface(material,vec3(1),undefined,context);context.flushPaint();expect(material.colorNode).toBe(color);expect(bakeReferencePaintLayers).not.toHaveBeenCalled();expect(Reflect.get(context,'colorArray')).toBeUndefined();expect(Reflect.get(context,'rowsTexture')).toBeUndefined();}finally{material.dispose();context.dispose();}
});
test('reference profiles retain independent full resolution SRGB RGB and linear height alpha layers',()=>{
 const context=folded(),material=new THREE.MeshStandardNodeMaterial({vertexColors:true});
 try{applyOrigamiSurface(material,attribute('color','vec3'),undefined,context,float(1));const paint=context.paint;expect(paint.isDataArrayTexture).toBe(true);expect(paint.image).toMatchObject({width:512,height:512,depth:BASE_REFERENCE_PAINT_DESCRIPTORS.length});expect(paint.colorSpace).toBe(THREE.SRGBColorSpace);expect(paint.format).toBe(THREE.RGBAFormat);expect(paint.flipY).toBe(false);expect(material.vertexColors).toBe(false);expect(material.roughness).toBe(.88);expect(material.metalness).toBe(.02);expect(material.normalNode).not.toBeNull();expect(bakeReferencePaintLayers).toHaveBeenCalledTimes(1);}finally{material.dispose();context.dispose();}
});

test('real color and height graphs sample metric pigment separately from raw face kraft and coverage',()=>{
 const context=folded(),pigmentUv=vec2(1,.16666666666666666),faceUv=vec2(1/3,.5);
 try{
  context.flushPaint();
  expectFaceSampling(context,context.facePaintNode(pigmentUv,faceUv,float(1),float(0)),pigmentUv,faceUv);
  expectFaceSampling(context,context.faceHeightNode(pigmentUv,faceUv,float(1),float(0)),pigmentUv,faceUv);
  expect((Reflect.get(context,'paperArray') as THREE.DataArrayTexture).wrapS).toBe(THREE.ClampToEdgeWrapping);
  expect((Reflect.get(context,'coverageArray') as THREE.DataArrayTexture).wrapT).toBe(THREE.ClampToEdgeWrapping);
 }finally{context.dispose();}
});

test('the surface product graph keeps its source face varying on K/M while P receives a distinct metric mapping',()=>{
 const context=folded(),material=new THREE.MeshStandardNodeMaterial();
 try{
  applyOrigamiSurface(material,vec3(1),attribute('contractFaceUv','vec2'),context,float(1));
  const nodes=textureNodes(material.colorNode),banks=Reflect.get(context,'banks') as THREE.DataArrayTexture[],paper=Reflect.get(context,'paperArray'),coverage=Reflect.get(context,'coverageArray');
  const faceReads=nodes.filter(node=>node.value===paper||node.value===coverage),pigmentReads=nodes.filter(node=>banks.includes(node.value as THREE.DataArrayTexture));
  expect(faceReads.length).toBeGreaterThanOrEqual(2);expect(pigmentReads.length).toBeGreaterThan(0);
  const raw=faceReads[0]!.uvNode as GraphNode;expect(raw.name).toBe('v_origamiPaintUv');
  for(const node of faceReads)expect(node.uvNode).toBe(raw);
  for(const node of pigmentReads)expect(node.uvNode).not.toBe(raw);
 }finally{material.dispose();context.dispose();}
});

test('square rectangle shear and rotated triangle witnesses cannot place a coverage frame on an interior pigment period',()=>{
 const context=folded();
 const frame=(point:PaintVector2)=>{const cells=point.map(value=>Math.floor((value-Math.floor(value))*16));return cells.some(value=>value===0||value===15)?0:255;};
 const cases:readonly {name:string;raw:PaintVector2;dx:PaintVector3;dy:PaintVector3;ux:PaintVector2;uy:PaintVector2;expected:PaintVector2;period:boolean}[]=[
  {name:'square',raw:[.5,.5],dx:[1,0,0],dy:[0,1,0],ux:[1,0],uy:[0,1],expected:[.5,.5],period:false},
  {name:'rectangle9x1',raw:[1/3,.5],dx:[9,0,0],dy:[0,1,0],ux:[1,0],uy:[0,1],expected:[1,1/6],period:true},
  {name:'shear P=(2u+v,2v)',raw:[.6,.8],dx:[2,0,0],dy:[1,2,0],ux:[1,0],uy:[0,1],expected:[1,.8],period:true},
  {name:'rotated rectangle opposite triangle',raw:[2/3,.5],dx:[0,-9,0],dy:[1,0,0],ux:[-1,0],uy:[0,-1],expected:[2,1/6],period:true},
 ];
 try{context.flushPaint();for(const entry of cases){
  const metric=paintMetricFromDerivatives(entry.dx,entry.dy,entry.ux,entry.uy),mapped=applyPaintMetric(entry.raw,metric,1/Math.sqrt(metric[0]*metric[2]));
  expect(mapped[0],entry.name).toBeCloseTo(entry.expected[0],12);expect(mapped[1],entry.name).toBeCloseTo(entry.expected[1],12);
  const pigmentUv=vec2(...mapped),faceUv=vec2(...entry.raw);
  expectFaceSampling(context,context.facePaintNode(pigmentUv,faceUv,float(1),float(0)),pigmentUv,faceUv);
  expect(frame(entry.raw),entry.name).toBe(255);if(entry.period)expect(frame(mapped),`${entry.name}: deliberately wrong repeated-mask negative control`).toBe(0);
  // This is a known witness-mask address assertion, not a claim about pixels
  // produced by the stubbed source painter or the GPU compositor.
 }}finally{context.dispose();}
});
test('impasto and physical edge controls change existing state without repainting; fill repaints once after debounce',()=>{
 vi.useFakeTimers();const context=folded(),material=new THREE.MeshStandardNodeMaterial();
 try{applyOrigamiSurface(material,vec3(1),undefined,context);const paint=context.paint,color=material.colorNode,version=paint.version;context.update({...context.preferences,impasto:1.7,edges:.24,wear:.18});expect(context.impasto.value).toBe(1.7);expect(context.paint.version).toBe(version);expect(bakeReferencePaintLayers).toHaveBeenCalledTimes(1);context.update({...context.preferences,contourImperfection:.81});context.update({...context.preferences,contourImperfection:.83});expect(bakeReferencePaintLayers).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(60);expect(bakeReferencePaintLayers).toHaveBeenCalledTimes(2);expect(context.paint).toBe(paint);expect(material.colorNode).toBe(color);expect(paint.version).toBeGreaterThan(version);}finally{material.dispose();context.dispose();}
});
test('physical wear expands on preference edits, edge visibility follows the reference, and disposal releases ownership',()=>{
 const context=folded(),geometry=new THREE.BufferGeometry(),object=new THREE.Object3D();geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,2,3],3));geometry.userData.referenceWearBasePositions=new Float32Array([1,2,3]);geometry.userData.referenceWearExpandDirections=new Float32Array([2,0,0]);
 const untrack=context.trackWearGeometry(geometry),untrackObject=context.trackEdgeObject(object,'wear');
 try{expect(geometry.getAttribute('position').getX(0)).toBeCloseTo(1+2*.6675,6);expect(object.visible).toBe(true);context.update({...context.preferences,edges:0});expect(object.visible).toBe(false);context.update({...context.preferences,wear:0});expect(geometry.getAttribute('position').getX(0)).toBe(1);untrack();untrackObject();expect(Reflect.get(context,'wearGeometries').size).toBe(0);}finally{geometry.dispose();context.dispose();}
});
test('the legacy canonical line adapter keeps black ink and kraft independent without repainting',()=>{
 const context=folded(),lighting=new EnvironmentLighting(),line=new THREE.LineSegments(new THREE.BufferGeometry(),context.createLineMaterial(null));
 const untrack=context.trackEdgeObject(line,'line'),material=line.material,color=material.colorNode,opacity=material.opacityNode;
 try{
  lighting.configure(material);expect(material.outputNode).toBeNull();expect(material.maskNode).not.toBeNull();
  expect(context.lineColor.value.getHex()).toBe(0);expect(context.lineOpacity.value).toBeCloseTo(defaults.blackEdges);
  context.update({...context.preferences,edges:0,blackEdges:.8});expect(line.visible).toBe(true);expect(context.lineOpacity.value).toBe(.8);expect(context.lineColor.value.getHex()).toBe(0);
  context.update({...context.preferences,edges:.65,blackEdges:0});expect(context.lineOpacity.value).toBeCloseTo(.45475625);expect(context.lineColor.value.getHex()).toBe(0xd7b384);
  line.userData.origamiOwnerVisible=false;context.update({...context.preferences,blackEdges:1});expect(line.visible).toBe(false);
  line.userData.origamiOwnerVisible=true;context.update({...context.preferences,edges:0,blackEdges:0});expect(line.visible).toBe(false);
  expect(material.colorNode).toBe(color);expect(material.opacityNode).toBe(opacity);expect(bakeReferencePaintLayers).not.toHaveBeenCalled();
 }finally{untrack();line.geometry.dispose();material.dispose();lighting.dispose();context.dispose();}
});

test('product painted contours use physical surface shading and model positions without a screen vertex override',()=>{
 const context=folded(),lighting=new EnvironmentLighting(),material=context.createBrushMaterial(null);
 try{
  expect(material).toBeInstanceOf(THREE.MeshStandardNodeMaterial);expect(material.transparent).toBe(true);
  expect(material.vertexNode).toBeNull();expect(material.positionNode).toBeNull();expect(material.normalNode).not.toBeNull();
  expect(material.userData.origamiBrush).toBe(true);expect(material.userData.origamiUnlitContour).not.toBe(true);
  lighting.configure(material);expect(material.outputNode).not.toBeNull();expect(material.maskNode).not.toBeNull();
  const color=material.colorNode,normal=material.normalNode,paint=context.paint;
  context.update({...context.preferences,edgeWidth:3,strokeImperfection:0,blackEdges:0,edges:.65});
  expect(material.colorNode).toBe(color);expect(material.normalNode).toBe(normal);expect(material.vertexNode).toBeNull();
  expect(context.paint).toBe(paint);expect(bakeReferencePaintLayers).toHaveBeenCalledTimes(1);
 }finally{material.dispose();lighting.dispose();context.dispose();}
});
test('actual appearance palettes collect for one snapshot upload and material retirement cannot dispose shared maps',()=>{
 const context=folded(),a=new THREE.MeshStandardNodeMaterial(),b=new THREE.MeshStandardNodeMaterial();
 try{applyOrigamiSurface(a,vec3(1),undefined,context);applyOrigamiSurface(b,vec3(1),undefined,context);const paint=context.paint,disposed=vi.fn();paint.addEventListener('dispose',disposed);const appearance={skin:0xe0b18d,hair:0x4a3222,shirt:0x3b6e8c};expect(context.registerHumanAppearance(appearance)).toBe(context.registerHumanAppearance(appearance));context.registerHumanAppearance({...appearance,shirt:0x7f352a});expect(bakeReferencePaintLayers).toHaveBeenCalledTimes(1);context.flushPaint();expect(bakeReferencePaintLayers).toHaveBeenCalledTimes(2);expect(context.paint).toBe(paint);a.dispose();b.dispose();expect(disposed).toHaveBeenCalledTimes(1);context.dispose();expect(disposed).toHaveBeenCalledTimes(2);context.dispose();expect(disposed).toHaveBeenCalledTimes(2);}finally{context.dispose();}
});
test('a palette above 256 source layers uses bounded banks and a fresh renderer retains only its own palettes',()=>{
 const crowded=folded(),fresh=folded();
 try{
  for(let i=0;i<38;i++){const hue=0x410000+i*307;crowded.registerHumanAppearance({skin:hue,hair:hue+1,shirt:hue+2,outerwear:hue+3,pants:hue+4,hat:hue+5});}
  crowded.flushPaint();
  const banks=Reflect.get(crowded,'banks') as THREE.DataArrayTexture[];
  expect(banks.filter(bank=>bank.image.width===512).length).toBe(2);
  expect(banks.every(bank=>bank.image.depth<=256)).toBe(true);
  expect(banks[0]!.image.depth+banks[1]!.image.depth).toBeGreaterThan(256);
  fresh.flushPaint();expect(fresh.paint.image.depth).toBe(BASE_REFERENCE_PAINT_DESCRIPTORS.length);
  expect((Reflect.get(fresh,'banks') as THREE.DataArrayTexture[]).filter(bank=>bank.image.width===512)).toHaveLength(1);
 }finally{crowded.dispose();fresh.dispose();}
});
