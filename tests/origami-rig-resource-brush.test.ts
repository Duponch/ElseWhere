import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createRigBrushGeometry} from '../src/render/origami/rig-brush';
import {createOrigamiBrushGeometry,updateOrigamiBrushGeometry} from '../src/render/origami/brush-geometry';
import {mergedInstances,resourceBrushData,type ResourceRangeData} from '../src/render/StaticGeometry';
import {ResourceLayer} from '../src/render/ResourceLayer';

test('rig ribbons keep one static buffer and alias the exact owner instance streams without changing canonical vertices',()=>{
  const box=new THREE.BoxGeometry(1,1,1),source=new THREE.InstancedBufferGeometry();for(const [name,a]of Object.entries(box.attributes))source.setAttribute(name,a);source.setIndex(box.index);
  const trajectory=new THREE.InstancedBufferAttribute(new Float32Array(12),4);source.setAttribute('aFrom',trajectory);source.instanceCount=3;
  const before=Array.from(source.getAttribute('position').array),ribbon=createRigBrushGeometry(source);
  try{
    expect(ribbon.getAttribute('aFrom')).toBe(trajectory);expect(ribbon.instanceCount).toBe(3);
    const staticBuffers=new Set(Object.values(ribbon.attributes).filter(a=>!(a instanceof THREE.InstancedBufferAttribute)).map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a));expect(staticBuffers.size).toBe(1);
    expect(ribbon.getAttribute('position').count%3).toBe(0);expect(ribbon.getAttribute('position').count).toBeGreaterThan(24);
    updateOrigamiBrushGeometry(ribbon,4,1);expect(Array.from(source.getAttribute('position').array)).toEqual(before);
  }finally{ribbon.dispose();source.dispose();box.dispose();}
});

function resourceRibbon(){
  const box=new THREE.BoxGeometry(1,1,1),source=createOrigamiBrushGeometry(box),metadata=resourceBrushData(source)!;
  const original={base:metadata.base.slice(),width:metadata.width.slice(),rough:metadata.rough.slice()},material=new THREE.MeshStandardMaterial();material.userData.rendererOwned=true;
  const group=new THREE.Group(),mesh=mergedInstances(group,[{geometry:source,items:[{x:4,y:0,z:6,sx:2,sy:3,sz:.7,ry:.42,key:41}]}],material,false,true,true)!;box.dispose();
  return {mesh,material,original};
}

test('resource merging transforms base points and paint-width vectors separately without extra GPU attributes',()=>{
  const {mesh,material,original}=resourceRibbon(),position=mesh.geometry.getAttribute('position'),metadata=resourceBrushData(mesh.geometry)!,transform=new THREE.Matrix4().makeTranslation(4,0,6).multiply(new THREE.Matrix4().makeRotationY(.42)).multiply(new THREE.Matrix4().makeScale(2,3,.7));
  try{
    updateOrigamiBrushGeometry(mesh.geometry,2,.7);
    for(let i=0;i<position.count;i++){
      const expected=new THREE.Vector3().fromArray(original.base,i*3).addScaledVector(new THREE.Vector3().fromArray(original.width,i*3),2).addScaledVector(new THREE.Vector3().fromArray(original.rough,i*3),1.4).applyMatrix4(transform),actual=new THREE.Vector3().fromBufferAttribute(position,i);
      expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
    }
    expect(mesh.geometry.hasAttribute('referenceBrushWidthOffsets')).toBe(false);expect(metadata.width).not.toBe(original.width);
    expect((mesh.userData.resourceRanges as ResourceRangeData).ranges.map(range=>range.id)).toEqual([41]);
  }finally{mesh.geometry.dispose();material.dispose();}
});

test('changing brush preferences during recoil preserves the painted surface pose',()=>{
  const {mesh,material}=resourceRibbon(),data=mesh.userData.resourceRanges as ResourceRangeData,source=data.originalBrush!,range=data.ranges[0]!,angle=.17;
  const layer=Object.create(ResourceLayer.prototype) as ResourceLayer;
  Reflect.set(layer,'treeParts',new Map([[41,[{mesh,range,positions:data.originalPositions,normals:new Float32Array(mesh.geometry.getAttribute('normal').array),brush:source,upload:{start:0,count:range.vertexCount*3}}]]]));
  Reflect.set(layer,'graphicsStyle',{refreshBrushGeometry:(geometry:THREE.BufferGeometry,start:number,count:number)=>updateOrigamiBrushGeometry(geometry,2,.7,start,count)});
  const hit={x:4,z:6,axisX:1,axisZ:0,angle:0};
  try{
    Reflect.apply(Reflect.get(layer,'poseTree'),layer,[41,hit,angle]);updateOrigamiBrushGeometry(mesh.geometry,4,1);
    const transform=new THREE.Matrix4().makeTranslation(4,0,6).multiply(new THREE.Matrix4().makeRotationX(angle)).multiply(new THREE.Matrix4().makeTranslation(-4,0,-6)),position=mesh.geometry.getAttribute('position');
    for(let i=0;i<position.count;i++){
      const expected=new THREE.Vector3().fromArray(source.base,i*3).addScaledVector(new THREE.Vector3().fromArray(source.width,i*3),4).addScaledVector(new THREE.Vector3().fromArray(source.rough,i*3),4).applyMatrix4(transform);
      expect(expected.distanceTo(new THREE.Vector3().fromBufferAttribute(position,i))).toBeLessThan(1e-6);
    }
  }finally{mesh.geometry.dispose();material.dispose();}
});
