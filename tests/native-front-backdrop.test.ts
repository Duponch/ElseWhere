import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {NativeFrontBackdrop} from '../src/ui3d/NativeFrontBackdrop';

function fixture(){
  const camera=new THREE.PerspectiveCamera(34,16/9,.1,220);
  const texture=new THREE.Texture({width:1672,height:941} as HTMLImageElement);
  const loader=new THREE.TextureLoader(),invalidate=vi.fn();
  let loaded:(texture:THREE.Texture<HTMLImageElement>)=>void=()=>{},failed:()=>void=()=>{};
  vi.spyOn(loader,'load').mockImplementation((_url,onLoad,_progress,onError)=>{
    loaded=onLoad!;failed=()=>onError!(new Error('Image unavailable'));return texture;
  });
  const backdrop=new NativeFrontBackdrop(camera,invalidate,loader);
  backdrop.resize(camera);
  return {camera,texture,backdrop,invalidate,load:()=>loaded(texture),fail:()=>failed()};
}

test.each([[1920,1080],[2560,1080],[1280,1024],[390,844]])('the background covers %s × %s without stretching or empty edges',(width,height)=>{
  const f=fixture();f.camera.aspect=width/height;f.camera.updateProjectionMatrix();f.backdrop.resize(f.camera);f.load();
  const {x,y}=f.texture.repeat;
  expect(x).toBeGreaterThan(0);expect(y).toBeGreaterThan(0);
  expect(x).toBeLessThanOrEqual(1);expect(y).toBeLessThanOrEqual(1);
  expect(Math.max(x,y)).toBe(1);
  expect(1672*x/(941*y)).toBeCloseTo(width/height,12);
  expect(f.texture.offset.x).toBeCloseTo((1-x)/2,12);
  expect(f.texture.offset.y).toBeCloseTo((1-y)/2,12);
  // Project the physical plane's two corners through the actual camera.
  f.camera.updateMatrixWorld(true);
  const corners=[new THREE.Vector3(-.5,-.5,0),new THREE.Vector3(.5,.5,0)];
  for(const [index,corner]of corners.entries()){
    const projected=f.backdrop.mesh.localToWorld(corner).project(f.camera);
    expect(projected.x).toBeCloseTo(index?1:-1,12);
    expect(projected.y).toBeCloseTo(index?1:-1,12);
  }
  f.backdrop.dispose();
});

test('loading is nonblocking and a late image stays hidden during gameplay',()=>{
  const f=fixture();expect(f.backdrop.diagnostics).toEqual({state:'loading',visible:false});
  f.backdrop.setVisible(false);f.load();
  expect(f.backdrop.diagnostics).toEqual({state:'ready',visible:false});
  expect(f.texture.colorSpace).toBe(THREE.SRGBColorSpace);
  f.backdrop.setVisible(true);expect(f.backdrop.mesh.visible).toBe(true);
  f.backdrop.setVisible(false);expect(f.backdrop.mesh.visible).toBe(false);
  expect(f.invalidate).toHaveBeenCalledOnce();f.backdrop.dispose();
});

test('a failed decorative image leaves the menus usable',()=>{
  const f=fixture();f.fail();f.backdrop.setVisible(true);
  expect(f.backdrop.diagnostics).toEqual({state:'failed',visible:false});
  expect(f.invalidate).toHaveBeenCalledOnce();f.backdrop.dispose();
});

test('closing during loading releases owned resources and ignores the late callback',()=>{
  const f=fixture(),geometry=vi.spyOn(f.backdrop.mesh.geometry,'dispose');
  const material=vi.spyOn(f.backdrop.mesh.material,'dispose'),texture=vi.spyOn(f.texture,'dispose');
  f.backdrop.dispose();f.load();f.fail();f.backdrop.setVisible(true);f.backdrop.dispose();
  expect(f.backdrop.mesh.parent).toBeNull();expect(f.backdrop.mesh.visible).toBe(false);
  expect(geometry).toHaveBeenCalledOnce();expect(material).toHaveBeenCalledOnce();expect(texture).toHaveBeenCalledOnce();
  expect(f.invalidate).not.toHaveBeenCalled();
});
