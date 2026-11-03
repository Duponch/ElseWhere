/** Actual complete product geometry + bounded layout, without paint pixels,
 * GPU, World, alternate model, private diagnostic or atlas-budget increase. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {indexExactStaticVertices} from '../src/render/origami/static-index';
import {compileBakedCharts,type BakedChartSet} from '../src/render/origami/baked/charts';
import {packMaxRectsNoRotation} from '../src/render/origami/baked/rectangle-pack';

vi.mock('../src/render/origami/baked/rectangle-pack',async importOriginal=>{
  const actual=await importOriginal<typeof import('../src/render/origami/baked/rectangle-pack')>();
  return{...actual,packMaxRectsNoRotation:vi.fn(actual.packMaxRectsNoRotation)};
});
type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const instanced=(a:Attribute)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
const bytes=(a:THREE.TypedArray)=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength).slice();
const options={texelsPerUnit:256,paddingTexels:8,mipLevels:4,maxAtlasSize:2048,maxAtlasPixels:2048*2048,maxOutputBytes:32*1024*1024,maxTriangles:20000,rawUvAttribute:'animalPaintUv'};
function rawFloatWord(a:Attribute,vertex:number,component:number):number{
  if(!(a.array instanceof Float32Array))throw Error('Actual animal static field must be Float32');
  const words=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length),stride=a instanceof THREE.InterleavedBufferAttribute?a.data.stride:a.itemSize,offset=a instanceof THREE.InterleavedBufferAttribute?a.offset:0;
  return words[vertex*stride+offset+component]!;
}

test('complete actual elephant fits2048 at256 density with all clinical/UV bits and all372 triangles retained',()=>{
  vi.mocked(packMaxRectsNoRotation).mockClear();
  const source=origamiAnimalPresentationGeometry(1,'elephant',false);if(!source)throw Error('Actual elephant presentation unavailable');
  const originalFields=new Map(Object.entries(source.attributes).map(([name,a])=>[name,{attribute:a,bytes:bytes(a.array)}]));
  let view:THREE.BufferGeometry|undefined,result:BakedChartSet|undefined;
  try{
    expect(source.userData.origamiReference).toBe('elephant');expect(source.userData.origamiWear).toBeUndefined();
    indexExactStaticVertices(source);const index=source.index!;expect(index.count).toBe(372*3);const indexBytes=bytes(index.array);
    // Exactly the product adapter's static view: owner slots remain on their
    // source; crossed eyes and absent-part families are NOT filtered out.
    view=new THREE.BufferGeometry();for(const[name,a]of Object.entries(source.attributes))if(!instanced(a))view.setAttribute(name,a);
    view.setIndex(index);view.setDrawRange(source.drawRange.start,source.drawRange.count);for(const group of source.groups)view.addGroup(group.start,group.count,group.materialIndex);
    result=compileBakedCharts(view,options);
    expect(result.atlas).toEqual({width:2048,height:2048,texelsPerUnit:256,paddingTexels:8,mipLevels:4});expect(result.triangles).toHaveLength(372);expect(result.charts).toHaveLength(206);
    expect(vi.mocked(packMaxRectsNoRotation)).toHaveBeenCalledTimes(1);expect(vi.mocked(packMaxRectsNoRotation).mock.calls[0]![1]).toMatchObject({width:2048,height:2048,quantum:8,maxPixels:2048*2048});
    expect([...result.sourceVertex]).toEqual([...index.array]);expect(result.geometry.index).toBeNull();
    for(const name of ['animalPart','corpsePartMask','bloodRegion','eyeMark','boneId','bindPivot','animalPaint','animalPaintUv','uv'])expect(result.geometry.hasAttribute(name)).toBe(true);
    const eye=result.geometry.getAttribute('eyeMark');expect(new Set(Array.from({length:eye.count},(_,v)=>eye.getX(v)))).toEqual(new Set([-1,0,1]));
    for(const[name,a]of Object.entries(view.attributes)){
      const copied=result.geometry.getAttribute(name);expect(copied.itemSize).toBe(a.itemSize);expect(copied.normalized).toBe(a.normalized);
      for(let vertex=0;vertex<copied.count;vertex++)for(let component=0;component<a.itemSize;component++)expect(rawFloatWord(copied,vertex,component)).toBe(rawFloatWord(a,result.sourceVertex[vertex]!,component));
    }
    for(const[name,before]of originalFields){expect(source.getAttribute(name)).toBe(before.attribute);expect(bytes(source.getAttribute(name).array)).toEqual(before.bytes);}
    expect(source.index).toBe(index);expect(bytes(index.array)).toEqual(indexBytes);
    const uv=result.geometry.getAttribute('bakedUv');
    // One normalized Float32 UV ULP at1.0, expressed in atlas pixels. This
    // accounts only for the stored float rounding, not a larger gutter error.
    const rounding=Math.max(result.atlas.width,result.atlas.height)*2**-24;
    for(const chart of result.charts){
      const r=chart.rect,c=chart.content;for(const value of [r.x,r.y,r.width,r.height])expect(value%8).toBe(0);
      expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(2048);expect(r.y+r.height).toBeLessThanOrEqual(2048);
      expect(c.x-r.x).toBe(8);expect(c.y-r.y).toBe(8);expect(r.x+r.width-c.x-c.width).toBeGreaterThanOrEqual(8);expect(r.y+r.height-c.y-c.height).toBeGreaterThanOrEqual(8);
      for(const triangleId of chart.triangles){
        expect(result.triangleChart[triangleId]).toBe(chart.id);const triangle=result.triangles[triangleId]!;
        for(const vertex of triangle.outputVertices){const x=uv.getX(vertex)*2048,y=uv.getY(vertex)*2048;
          expect(x).toBeGreaterThanOrEqual(c.x-rounding);expect(x).toBeLessThanOrEqual(c.x+c.width+rounding);expect(y).toBeGreaterThanOrEqual(c.y-rounding);expect(y).toBeLessThanOrEqual(c.y+c.height+rounding);
          expect(x).toBeGreaterThanOrEqual(r.x+8-rounding);expect(x).toBeLessThanOrEqual(r.x+r.width-8+rounding);expect(y).toBeGreaterThanOrEqual(r.y+8-rounding);expect(y).toBeLessThanOrEqual(r.y+r.height-8+rounding);
        }
      }
      for(const other of result.charts)if(other.id<chart.id){const b=other.rect;expect(r.x+r.width<=b.x||b.x+b.width<=r.x||r.y+r.height<=b.y||b.y+b.height<=r.y).toBe(true);}
    }
  }finally{
    result?.geometry.dispose();view?.dispose();source.dispose();for(const key of ['origamiLines','origamiWear']){const g=source.userData[key];if(g instanceof THREE.BufferGeometry)g.dispose();}
  }
});

test('small cube admitted by the original shelf never calls the fallback',()=>{
  vi.mocked(packMaxRectsNoRotation).mockClear();const source=new THREE.BoxGeometry();let result:BakedChartSet|undefined;
  try{result=compileBakedCharts(source,{...options,texelsPerUnit:16,maxAtlasSize:256,maxAtlasPixels:256*256,rawUvAttribute:'uv'});expect(result.charts).toHaveLength(6);expect(result.triangles).toHaveLength(12);expect(packMaxRectsNoRotation).not.toHaveBeenCalled();}
  finally{result?.geometry.dispose();source.dispose();}
});
