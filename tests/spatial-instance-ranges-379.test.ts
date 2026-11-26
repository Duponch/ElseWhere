import {describe,expect,test,vi} from 'vitest';
import {Box3,BufferGeometry,Float32BufferAttribute,Group,InstancedBufferGeometry,InstancedMesh,Mesh,MeshBasicMaterial,OrthographicCamera,Scene,Vector3,WebGPUCoordinateSystem} from 'three/webgpu';
import {SpatialInstanceRanges379} from '../src/render/SpatialInstanceRanges379.ts';

function camera(x:number,span=4){
  const c=new OrthographicCamera(-span,span,span,-span,.1,100);
  c.coordinateSystem=WebGPUCoordinateSystem;c.position.set(x,0,10);c.lookAt(x,0,0);c.updateProjectionMatrix();c.updateMatrixWorld();return c;
}
const cell=(x:number)=>new Box3(new Vector3(x-1,-1,-1),new Vector3(x+1,1,1));
function fixture(indexed:boolean,native:boolean){
  const geo=new InstancedBufferGeometry();
  geo.setAttribute('position',new Float32BufferAttribute([-1,0,0,1,0,0,0,1,0],3));
  if(indexed)geo.setIndex([0,1,2]);geo.instanceCount=6;
  const material=new MeshBasicMaterial(),scene=new Scene(),mesh=new Mesh(geo,material);
  const renderer={backend:{isWebGPUBackend:native,device:{features:new Set(native?['indirect-first-instance']:[])}},_attributes:{update:vi.fn(),delete:vi.fn()}};
  const gpu=renderer as unknown as Parameters<Mesh['onBeforeRender']>[0];
  const submit=(cam:OrthographicCamera)=>mesh.onBeforeRender(gpu,scene,cam,geo,material,null as unknown as Group);
  const ranges=[{first:0,count:2,bounds:cell(-12)},{first:2,count:3,bounds:cell(0)},{first:5,count:1,bounds:cell(12)}];
  const dispatch=new SpatialInstanceRanges379(mesh);
  expect(dispatch.setRanges(ranges)).toBe(true);
  return {geo,mesh,material,scene,gpu,submit,ranges,dispatch,renderer};
}
describe.each([true,false])('ordered source slots, indexed=%s',indexed=>{
  test('actual native arguments preserve firstInstance, full fallback and callbacks nested during a shadow',()=>{
    const h=fixture(indexed,true),main=camera(0),shadow=camera(12),stride=indexed?5:4;
    h.submit(main);const buffer=h.geo.indirect;expect(buffer).toBeTruthy();
    expect(h.geo.indirectOffset).toEqual([stride*4]);expect(Array.from(buffer!.array).slice(stride,2*stride)).toEqual(indexed?[3,3,0,0,2]:[3,3,0,2]);
    h.mesh.onBeforeShadow(h.gpu,h.scene,main,shadow,h.geo,h.material,null as unknown as Group);
    h.submit(main);expect(h.geo.indirectOffset).toEqual([2*stride*4]);
    h.mesh.onAfterShadow(h.gpu,h.scene,main,shadow,h.geo,h.material,null as unknown as Group);
    expect(h.geo.indirectOffset).toEqual([stride*4]);
    h.submit(camera(100));expect(h.geo.indirectOffset).toEqual([]);
    h.submit(camera(0,25));expect(h.geo.indirect).toBeNull();
    h.ranges[1]!.bounds.expandByScalar(.25);expect(h.dispatch.setRanges(h.ranges)).toBe(true);
    h.submit(main);expect(h.geo.indirect).toBe(buffer);expect(h.renderer._attributes.update).toHaveBeenCalledTimes(1);
    h.geo.instanceCount=3;h.submit(main);expect(h.geo.indirect).toBeNull();
    h.dispatch.dispose();expect(h.renderer._attributes.delete).toHaveBeenCalledOnce();expect(h.mesh.onBeforeRender).toBe(Mesh.prototype.onBeforeRender);
    h.geo.dispose();h.material.dispose();
  });
});
test('missing backend feature, unknown ranges and unsupported groups keep their literal geometry',()=>{
  const h=fixture(true,false),cam=camera(0);
  h.submit(cam);expect(h.geo.indirect).toBeNull();expect(h.renderer._attributes.update).not.toHaveBeenCalled();
  expect(h.dispatch.setRanges([h.ranges[1]!,h.ranges[2]!])).toBe(false);
  const geo=new BufferGeometry().setAttribute('position',h.geo.getAttribute('position'));
  const plants=new InstancedMesh(geo,h.material,6),state=new SpatialInstanceRanges379(plants);
  expect(state.setRanges(h.ranges)).toBe(true);
  geo.dispose();expect(state.metrics().ranges).toBe(0);state.dispose();h.dispatch.dispose();h.geo.dispose();h.material.dispose();
});

test('compiled source indices keep original firstIndex, winding and baseVertex on devices without firstInstance',()=>{
  const h=fixture(false,false),geometry=new BufferGeometry().setAttribute('position',h.geo.getAttribute('position'));
  geometry.setIndex([0,1,2,0,2,1,1,2,0,1,0,2,2,1,0]);geometry.setDrawRange(3,12);
  const mesh=new Mesh(geometry,h.material),ranges=new SpatialInstanceRanges379(mesh,'indices');
  expect(ranges.setRanges([{first:0,count:3,bounds:cell(-10)},{first:3,count:6,bounds:cell(0)},{first:9,count:3,bounds:cell(10)}])).toBe(true);
  h.renderer.backend.isWebGPUBackend=true;
  mesh.onBeforeRender(h.gpu,h.scene,camera(0),geometry,h.material,null as unknown as Group);
  expect(geometry.indirectOffset).toEqual([20]);expect(Array.from(geometry.indirect!.array).slice(5,10)).toEqual([6,1,6,0,0]);
  geometry.setDrawRange(6,6);mesh.onBeforeRender(h.gpu,h.scene,camera(0),geometry,h.material,null as unknown as Group);
  expect(geometry.indirect).toBeNull();ranges.dispose();h.dispatch.dispose();geometry.dispose();h.geo.dispose();h.material.dispose();
});
