import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {applyPaintMetric,paintMetricFromDerivatives,type PaintVector2,type PaintVector3} from '../src/render/origami/paint-metric';
import {buildOrigamiHumanReference} from '../src/render/origami/human-reference';
import {BODY_PROPORTIONS} from '../src/render/pawn-appearance-shape';

const tuple=(point:THREE.Vector3):PaintVector3=>[point.x,point.y,point.z];
const delta=(a:PaintVector2,b:PaintVector2):PaintVector2=>[a[0]-b[0],a[1]-b[1]];
function triangleMetric(points:THREE.Vector3[],uv:PaintVector2[]){return paintMetricFromDerivatives(tuple(points[1]!.clone().sub(points[0]!)),tuple(points[2]!.clone().sub(points[0]!)),delta(uv[1]!,uv[0]!),delta(uv[2]!,uv[0]!));}
function expectTriangleIsometry(points:THREE.Vector3[],uv:PaintVector2[],density=1):void {
  const metric=triangleMetric(points,uv),mapped=uv.map(point=>new THREE.Vector2(...applyPaintMetric(point,metric,density)));
  for(const [a,b]of [[0,1],[0,2],[1,2]])expect(mapped[a]!.distanceTo(mapped[b]!)).toBeCloseTo(points[a]!.distanceTo(points[b]!)*density,9);
  expect(mapped[1]!.clone().sub(mapped[0]!).dot(mapped[2]!.clone().sub(mapped[0]!))).toBeCloseTo(points[1]!.clone().sub(points[0]!).dot(points[2]!.clone().sub(points[0]!))*density*density,8);
}
function geometryTriangles(geometry:THREE.BufferGeometry,transform:(point:THREE.Vector3)=>THREE.Vector3):void {
  const position=geometry.getAttribute('position'),sourceUv=geometry.getAttribute('uv'),index=geometry.index;
  for(let at=0;at<(index?.count??position.count);at+=3){
    const vertices=[0,1,2].map(offset=>index?index.getX(at+offset):at+offset),points=vertices.map(vertex=>transform(new THREE.Vector3().fromBufferAttribute(position,vertex))),uv=vertices.map((vertex):PaintVector2=>[sourceUv.getX(vertex),sourceUv.getY(vertex)]);
    expectTriangleIsometry(points,uv);
  }
}

test('rectangular and sheared instance faces keep equal brush lengths in both directions',()=>{
  const box=new THREE.BoxGeometry(7,.2,2),before=Array.from(box.getAttribute('uv').array);
  const shear=new THREE.Matrix4().set(1,.7,.2,0,0,1,.3,0,0,0,1,0,0,0,0,1),transform=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.7,.8,.4)).multiply(shear).multiply(new THREE.Matrix4().makeScale(.4,3.2,1.7));
  try{geometryTriangles(box,point=>point.applyMatrix4(transform));expect(Array.from(box.getAttribute('uv').array)).toEqual(before);}finally{box.dispose();}
});

test('paint remains anchored under rigid actor and camera transformations',()=>{
  const uv:PaintVector2[]=[[.13,.2],[.91,.24],[.2,.89]],points=[new THREE.Vector3(2,3,4),new THREE.Vector3(3,3.1,4),new THREE.Vector3(2.3,5,4.7)];
  const before=triangleMetric(points,uv),transform=new THREE.Matrix4().makeTranslation(531,-92,119).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.1,.3,2.7)));
  const after=triangleMetric(points.map(point=>point.clone().applyMatrix4(transform)),uv);
  for(let i=0;i<3;i++)expect(after[i]).toBeCloseTo(before[i]!,10);
  const phase=applyPaintMetric([.37,.62],before);expect(applyPaintMetric([.37,.62],after)[0]).toBeCloseTo(phase[0],10);expect(applyPaintMetric([.37,.62],after)[1]).toBeCloseTo(phase[1],10);
});

test('all declared human torso proportions preserve metric lengths on the actual source triangles',()=>{
  const parts=buildOrigamiHumanReference(),torso=parts.find(part=>part.id==='reference-torso')!,uvBefore=Array.from(torso.geometry.getAttribute('uv').array);
  try{
    for(const [shoulder,waist,,depth]of BODY_PROPORTIONS)geometryTriangles(torso.geometry,point=>{
      point.add(new THREE.Vector3(...torso.at));const t=THREE.MathUtils.clamp((point.y-.76)/.44,0,1);point.x*=waist+(shoulder-waist)*t;point.z*=depth;return point;
    });
    expect(Array.from(torso.geometry.getAttribute('uv').array)).toEqual(uvBefore);
  }finally{for(const part of parts)part.geometry.dispose();}
});

test('degenerate UVs and collapsed surfaces return a finite stable fallback',()=>{
  for(const metric of [paintMetricFromDerivatives([1,0,0],[0,1,0],[0,0],[0,0]),paintMetricFromDerivatives([0,0,0],[0,0,0],[1,0],[0,1]),paintMetricFromDerivatives([Infinity,0,0],[0,1,0],[1,0],[0,1])])expect(metric).toEqual([1,0,1]);
  const metric=paintMetricFromDerivatives([2,0,0],[0,3,0],[1,0],[0,-1]);expectTriangleIsometry([new THREE.Vector3(),new THREE.Vector3(2,0,0),new THREE.Vector3(0,3,0)],[[0,0],[1,0],[0,-1]],1.75);expect(metric.every(Number.isFinite)).toBe(true);
});

test('area-normalized face density preserves angles and brush aspect while keeping one image area',()=>{
  const points=[new THREE.Vector3(),new THREE.Vector3(7,1.2,0),new THREE.Vector3(3,.2,1.8)],uv:PaintVector2[]=[[0,0],[1,0],[0,1]],metric=triangleMetric(points,uv),density=1/Math.sqrt(metric[0]*metric[2]);
  expectTriangleIsometry(points,uv,density);
  const u=applyPaintMetric([1,0],metric,density),v=applyPaintMetric([0,1],metric,density);
  expect(Math.abs(u[0]*v[1]-u[1]*v[0])).toBeCloseTo(1,12);
  expect(Math.hypot(...u)/Math.hypot(...v)).toBeCloseTo(points[1]!.length()/points[2]!.length(),12);
});
