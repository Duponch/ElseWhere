import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {resourceFallbackLineParts} from '../src/render/ResourceLayer';
import {mergedInstances} from '../src/render/StaticGeometry';
import type {Placement} from '../src/render/primitives';
import {CropLayer} from '../src/render/CropLayer';
import {AnimalCargoLayer282} from '../src/render/AnimalCargoLayer282';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

test('fallback box contours expose twelve creases without triangle diagonals or source mutation',()=>{
  const source=new THREE.BoxGeometry(1,1,1),before=Array.from(source.getAttribute('position').array);
  const placements:Placement[]=[{x:0,y:0,z:0,key:41}],parts=resourceFallbackLineParts([{geometry:source,items:placements},{geometry:source,items:[]}]);
  try{
    expect(parts).toHaveLength(1);expect(parts[0]!.items).toBe(placements);
    const position=parts[0]!.geometry.getAttribute('position');expect(position.count).toBe(24);
    for(let i=0;i<position.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(position,i),b=new THREE.Vector3().fromBufferAttribute(position,i+1);expect(a.distanceTo(b)).toBe(1);}
    expect(Array.from(source.getAttribute('position').array)).toEqual(before);
    expect(parts[0]!.geometry.getAttribute('normal').count).toBe(position.count);
    expect(parts[0]!.geometry.getAttribute('uv').count).toBe(position.count);
  }finally{source.dispose();for(const part of parts)part.geometry.dispose();}
});

test('fallback contour ranges retain body, canopy and fruit identities with exact part transforms',()=>{
  const source=new THREE.BoxGeometry(1,1,1),placements:Placement[]=[{key:41,x:2,y:3,z:5,sx:2,sy:4,sz:6},{key:-82,x:9,y:3,z:5},{key:-83,x:12,y:3,z:5}];
  const lines=resourceFallbackLineParts([{geometry:source,items:placements}]),group=new THREE.Group(),material=new THREE.LineBasicMaterial();material.userData.rendererOwned=true;
  const mesh=mergedInstances(group,lines,material,false,true,true)!;
  try{
    const ranges=mesh.userData.resourceRanges.ranges as {id:number;vertexStart:number;vertexCount:number}[];expect(ranges.map(range=>range.id)).toEqual([41,-82,-83]);
    const position=mesh.geometry.getAttribute('position'),bounds=new THREE.Box3(),point=new THREE.Vector3();for(let i=0;i<ranges[0]!.vertexCount;i++)bounds.expandByPoint(point.fromBufferAttribute(position,i));
    expect(bounds.min.toArray()).toEqual([1,1,2]);expect(bounds.max.toArray()).toEqual([3,5,8]);
  }finally{source.dispose();mesh.geometry.dispose();material.dispose();}
});

function isPaintedContour(object:THREE.Object3D):object is THREE.Mesh {
  if(!(object instanceof THREE.Mesh))return false;
  return (Array.isArray(object.material)?object.material:[object.material]).some(material=>material.userData.origamiBrush===true);
}

test('empty crop painted bands share resident transforms and restore the public compile warmup counts',()=>{
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',edges:0,blackEdges:1});
  const material=new THREE.MeshLambertNodeMaterial(),layer=withGraphicsStyle(context,()=>new CropLayer(material));
  try{
    const bodies=layer.group.children.filter((object):object is THREE.InstancedMesh=>object instanceof THREE.InstancedMesh&&!isPaintedContour(object)),lines=layer.group.children.filter(isPaintedContour);
    expect(lines.length).toBe(bodies.length);expect(lines.length).toBeGreaterThan(0);
    for(const line of lines){
      expect(line).toBeInstanceOf(THREE.InstancedMesh);expect(line).not.toBeInstanceOf(THREE.LineSegments);
      expect(bodies.some(body=>Reflect.get(line,'instanceMatrix')===body.instanceMatrix)).toBe(true);
      expect(line.geometry.userData.origamiBrushPrebuilt).toBe(true);expect(line.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
    const restore=layer.prepareForCompile();expect(bodies.every(body=>body.count===1)).toBe(true);expect(lines.every(line=>Reflect.get(line,'count')===1)).toBe(true);
    restore();expect(bodies.every(body=>body.count===0)).toBe(true);expect(lines.every(line=>Reflect.get(line,'count')===0)).toBe(true);
  }finally{layer.dispose();material.dispose();context.dispose();}
});

test('animal cargo compile preparation restores its single opaque owner and common stroke addresses',()=>{
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',edges:0,blackEdges:1}),layer=withGraphicsStyle(context,()=>new AnimalCargoLayer282());
  try{
    const body=layer.group.children.find((object):object is THREE.InstancedMesh=>object instanceof THREE.InstancedMesh&&!isPaintedContour(object))!;
    const geometry=body.geometry,material=body.material,node=(body.material as THREE.NodeMaterial).colorNode;
    expect(body.children.filter(isPaintedContour)).toEqual([]);expect(geometry.hasAttribute('surfaceStrokeUv')).toBe(true);expect(geometry.hasAttribute('surfaceStrokeFace')).toBe(true);
    expect(node).toBeDefined();expect(body.visible).toBe(false);expect(body.count).toBe(0);
    const restore=layer.prepareForCompile();expect(body.visible).toBe(true);expect(body.count).toBe(1);
    restore();expect(body.visible).toBe(false);expect(body.count).toBe(0);
    context.update({...context.preferences,style:'default'});context.update({...context.preferences,style:'origami'});
    expect(body.geometry).toBe(geometry);expect(body.material).toBe(material);expect((body.material as THREE.NodeMaterial).colorNode).toBe(node);expect(body.children.filter(isPaintedContour)).toEqual([]);
  }finally{layer.dispose();context.dispose();}
});
