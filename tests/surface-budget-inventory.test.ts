import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {measureSurfaceBudget,nominalSurfaceTextureBytes} from '../src/render/surfaces/SurfaceBudgetInventory';
describe('preparation-only nominal resource inventory',()=>{
 it('counts shared/interleaved resources and four explicit mips once, including held textures absent from the Scene',()=>{
  const atlas=new THREE.DataArrayTexture(new Uint8Array(16*16*4*2),16,16,2);atlas.generateMipmaps=false;atlas.mipmaps=Array.from({length:4},(_,l)=>({data:new Uint8Array(0),width:16/2**l,height:16/2**l}));
  const geometry=new THREE.BufferGeometry(),data=new THREE.InterleavedBuffer(new Float32Array(18),6);
  geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,3));geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2]),1));
  const scene=new THREE.Group(),material=new THREE.MeshBasicMaterial({map:atlas});scene.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  const bytes=2*4*(256+64+16+4),result=measureSurfaceBudget(scene,[{textures:[atlas,atlas],gpuBufferBytes:32,cpuBytes:16,complete:true,scope:'all held test assets'}]);
  expect(nominalSurfaceTextureBytes(atlas)).toBe(bytes);expect(result.complete).toBe(true);expect(result.textureCount).toBe(1);expect(result.bufferCount).toBe(2);expect(result.gpuBytes).toBe(bytes+72+6+32);expect(result.cpuBytes).toBe(16*16*4*2+72+6+16);
 });
 it('keeps an incomplete declaration unknown and excludes the separately accounted Rock subtree',()=>{
  const root=new THREE.Group(),rock=new THREE.Group();root.add(rock);rock.add(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3)),new THREE.MeshBasicMaterial()));
  const complete=measureSurfaceBudget(root,[],new Set([rock]));expect(complete.complete).toBe(true);expect(complete.gpuBytes).toBe(0);
  const missing=measureSurfaceBudget(root,[{textures:[],gpuBufferBytes:0,cpuBytes:0,complete:false,scope:'in-flight bake'}],new Set([rock]));expect(missing.complete).toBe(false);expect(missing.gpuBytes).toBeNull();
  const unknown=new THREE.Texture();expect(nominalSurfaceTextureBytes(unknown)).toBeNull();
 });
});
