import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
import {StartingArrivalLayer} from '../src/render/StartingArrivalLayer';
import {PodRescueLayer} from '../src/render/PodRescueLayer';
import {OrbitalDeliveryLayer} from '../src/render/OrbitalDeliveryLayer';
import {DoorLayer} from '../src/render/DoorLayer';
import {WindLayer} from '../src/render/WindLayer';
import {RoofLayer} from '../src/render/RoofLayer';
import {TimberCladdingLayer} from '../src/render/TimberCladdingLayer';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

/** Real retained renderers only: no World, simulation admission or GPU device. */
function layers(){return [new StartingArrivalLayer(),new PodRescueLayer(),new OrbitalDeliveryLayer(),new DoorLayer(),new WindLayer(),new RoofLayer(),new TimberCladdingLayer()] as const;}
function root(layer:ReturnType<typeof layers>[number]):THREE.Group{return layer instanceof RoofLayer?layer.surface:layer.group;}
function isBrush(object:THREE.Object3D):object is THREE.Mesh {
 if(!(object instanceof THREE.Mesh))return false;
 const materials=Array.isArray(object.material)?object.material:[object.material];return materials.some(material=>material.userData.origamiContour===true);
}
function brushes(group:THREE.Group):THREE.Mesh[]{return group.children.filter(isBrush);}

test('independent retained solid renderers allocate no contours in the default style',()=>{
 const context=new GraphicsStyleContext(),created=withGraphicsStyle(context,layers);
 try{for(const layer of created)expect(brushes(root(layer))).toHaveLength(0);}finally{for(const layer of created)layer.dispose();context.dispose();}
});

test('extra Origami solids use real face-ribbon meshes with the body pose, masks and resident instance streams',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',edges:0,blackEdges:.6}),created=withGraphicsStyle(context,layers);
 try{
  for(const layer of created){
   const group=root(layer),bodies=group.children.filter((object):object is THREE.Mesh=>object instanceof THREE.Mesh&&!isBrush(object)),contours=brushes(group);
   expect(contours.length).toBe(bodies.length);
   for(let i=0;i<bodies.length;i++){
    const body=bodies[i]!,line=contours[i]!,bodyMaterial=body.material as THREE.NodeMaterial,lineMaterial=line.material as THREE.NodeMaterial;
    expect(line).not.toBeInstanceOf(THREE.LineSegments);
    expect(lineMaterial.positionNode).toBe(bodyMaterial.positionNode);
    expect(lineMaterial.maskNode).toBe(bodyMaterial.maskNode??null);expect(lineMaterial.maskShadowNode).toBe(bodyMaterial.maskShadowNode??null);
    expect(lineMaterial.outputNode).toBeNull();
    expect(lineMaterial.userData.origamiContour).toBe(true);
    expect(line.castShadow).toBe(false);
    expect(line.geometry.userData.origamiBrushPrebuilt).toBe(true);
    expect(line.geometry.getAttribute('position').count%3).toBe(0);
    for(const key of ['referenceBrushBasePositions','referenceBrushWidthOffsets','referenceBrushRoughOffsets'])expect(line.geometry.userData[key]).toHaveLength(line.geometry.getAttribute('position').count*3);
    for(const [name,attribute]of Object.entries(body.geometry.attributes)){
     const instanced=attribute instanceof THREE.InstancedBufferAttribute||attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data instanceof THREE.InstancedInterleavedBuffer;
     if(instanced)expect(line.geometry.getAttribute(name)).toBe(attribute);
    }
   }
  }
  // Force the real capsule instances visible through their explicit preview
  // seam; this does not create a durable arrival or an incident.
  for(const layer of created)if(layer instanceof StartingArrivalLayer||layer instanceof PodRescueLayer||layer instanceof OrbitalDeliveryLayer){
   layer.mesh.activeCount=1;layer.syncContours();const line=brushes(layer.group)[0]!;
   expect((line.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1);expect(line.visible).toBe(true);
   context.update({...context.preferences,blackEdges:0});expect(line.visible).toBe(false);
   context.update({...context.preferences,blackEdges:.6});expect(line.visible).toBe(true);
   layer.mesh.activeCount=0;layer.syncContours();expect(line.visible).toBe(false);
  }
 }finally{for(const layer of created)layer.dispose();context.dispose();}
});

test('capsule ribbon width and irregularity change only model-space positions while retaining the source mesh and fade graph',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',strokeImperfection:0}),layer=withGraphicsStyle(context,()=>new StartingArrivalLayer());
 try{
  layer.mesh.activeCount=1;layer.syncContours();const brush=brushes(layer.group)[0]!,geometry=brush.geometry,position=geometry.getAttribute('position');
  const base=geometry.userData.referenceBrushBasePositions as Float32Array,width=geometry.userData.referenceBrushWidthOffsets as Float32Array,rough=geometry.userData.referenceBrushRoughOffsets as Float32Array;
  const bodyPosition=layer.mesh.geometry.getAttribute('position'),bodyBefore=Array.from({length:bodyPosition.count*3},(_,i)=>bodyPosition.getComponent(Math.floor(i/3),i%3));
  const material=brush.material as THREE.NodeMaterial,pose=material.positionNode,opacity=material.opacityNode;
  expect(position.count).toBeGreaterThan(0);expect(width.some(value=>value!==0)).toBe(true);expect(rough.some(value=>value!==0)).toBe(true);
  for(const [scale,amount]of [[.5,0],[5,.8],[1,0]] as const){
   context.update({...context.preferences,edgeWidth:scale,strokeImperfection:amount});
   for(let i=0;i<position.count*3;i++)expect(position.getComponent(Math.floor(i/3),i%3)).toBe(Math.fround(base[i]!+scale*(width[i]!+amount*rough[i]!)));
   expect(brush.geometry).toBe(geometry);expect(material.positionNode).toBe(pose);expect(material.opacityNode).toBe(opacity);
  }
  expect(Array.from({length:bodyPosition.count*3},(_,i)=>bodyPosition.getComponent(Math.floor(i/3),i%3))).toEqual(bodyBefore);
 }finally{layer.dispose();context.dispose();}
});

test('door capacity replacement rebinds brush instance streams and retires the obsolete ribbon geometry',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami'}),layer=withGraphicsStyle(context,()=>new DoorLayer());
 try{
  const brush=brushes(layer.group)[0]!,previous=brush.geometry,retired=vi.spyOn(previous,'dispose');
  // Exercise the producer's real capacity seam without admitting a World.
  layer.mesh.allocate(Reflect.get(layer,'base') as THREE.BufferGeometry,512);
  Reflect.apply(Reflect.get(layer,'allocateAttributes'),layer,[512]);layer.mesh.activeCount=300;
  layer.setTexturesEnabled(false);
  expect(brush.geometry).not.toBe(previous);expect(retired).toHaveBeenCalledOnce();
  expect((brush.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(300);
  for(const name of ['boxMatrix0','boxMatrix1','boxMatrix2','boxMatrix3','doorCurrent','doorPrevious','doorShift'])expect(brush.geometry.getAttribute(name)).toBe(layer.mesh.geometry.getAttribute(name));
  expect(brush.geometry.userData.origamiBrushPrebuilt).toBe(true);expect(brush.geometry.getAttribute('position').count).toBeGreaterThan(0);
 }finally{layer.dispose();context.dispose();}
});
