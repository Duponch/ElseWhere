import * as THREE from 'three/webgpu';
import {expect,test,vi} from 'vitest';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{
  const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');
  return {...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};
});
import {FurniturePaint,furnitureTileForNormal,furnitureSurfaceDesign} from '../src/render/furniture-surface-design';
import {createPaintedSurfaceAtlas,encodeSurfaceDesign,surfaceDesignedGeometry,surfaceDesignUv,fittedSurfaceDesignUv,surfaceDesignAspectBucket,surfaceDesignEffectiveTile,SURFACE_DESIGN_ASPECTS,SURFACE_DESIGN_LAYOUT_SCALE,paintedSurfaceAtlasPixels,surfaceVariantId,SURFACE_DESIGN_BAKE_UV} from '../src/render/painted-surface-atlas';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import {BoxBatches} from '../src/render/BoxBatches';
import {DoorLayer} from '../src/render/DoorLayer';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {PREPARED_SURFACE_VARIANT} from '../src/render/origami/baked/surfaces/PreparedSurfaceOwner';
import {camp,expected,mesh,structure} from './furniture-resident-fixtures';
import type {Placement} from '../src/render/primitives';
import {paintFurnitureSurfaceDesign} from '../src/render/furniture-surface-design';
import {createItemGeometry} from '../src/render/item-geometry';

test('exact face aspect fits physically rasterized reference art without clipping complete layouts',()=>{
  for(const [width,height] of [[1,3],[3,1],[.42,1.7],[1.5,.3],[.1,1],[10,1],[1,1]] as const){
    const bucket=surfaceDesignAspectBucket(width,height),reference=SURFACE_DESIGN_ASPECTS[bucket]!;
    const lo=fittedSurfaceDesignUv(FurniturePaint.door,0,0,width,height),hi=fittedSurfaceDesignUv(FurniturePaint.door,1,1,width,height);
    // One physical millimetre corresponds to the same motif distance on both
    // axes, after the authored reference's width is taken into account.
    expect((hi[0]-lo[0])*reference/width).toBeCloseTo((hi[1]-lo[1])/height,12);
    const margin=(1-SURFACE_DESIGN_LAYOUT_SCALE)/2;
    expect(lo[0]).toBeLessThanOrEqual(margin+1e-12);expect(lo[1]).toBeLessThanOrEqual(margin+1e-12);
    expect(hi[0]).toBeGreaterThanOrEqual(1-margin-1e-12);expect(hi[1]).toBeGreaterThanOrEqual(1-margin-1e-12);
    expect(surfaceDesignEffectiveTile(FurniturePaint.door,width,height)).toBe(FurniturePaint.door);
  }
  expect(surfaceDesignEffectiveTile(FurniturePaint.door,30,1)).toBe(0);
  // The screw uses equal physical radii, rather than a flattened old bitmap.
  expect(paintFurnitureSurfaceDesign(FurniturePaint.metal,.11,.11,1/3)).toBeCloseTo(paintFurnitureSurfaceDesign(FurniturePaint.metal,.1,.11+.01/3,1/3),12);
});

test('private bake UVs use each actual face scale and preserve shape-specific clothes',()=>{
  const source=new THREE.BoxGeometry(),baked=surfaceDesignedGeometry(source,()=>FurniturePaint.metal,[1,3,.5]);
  const shirt=createItemGeometry('item-shirt'),shirtBake=surfaceDesignedGeometry(shirt,()=>32,[1,3,.5]);
  try{
    for(const [base,prepared,design] of [[source,baked,FurniturePaint.metal],[shirt,shirtBake,32]] as const){
      const n=base.getAttribute('normal'),raw=base.getAttribute('uv'),got=prepared.getAttribute(SURFACE_DESIGN_BAKE_UV);
      for(let i=0;i<got.count;i++){
        const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),width=1*(1-nx)+.5*nx,height=3*(1-ny)+.5*ny;
        const expected=surfaceDesignUv(design,...fittedSurfaceDesignUv(design,raw.getX(i),raw.getY(i),width,height),width/height);
        expect([got.getX(i),got.getY(i)]).toEqual(expected.map(Math.fround));
        if(design===32)expect(fittedSurfaceDesignUv(design,raw.getX(i),raw.getY(i),width,height)).toEqual([raw.getX(i),raw.getY(i)]);
      }
    }
  }finally{source.dispose();baked.dispose();shirt.dispose();shirtBake.dispose();}
});

test('disabled personalized texture has identical layout and pigment without semantic marks',()=>{
  const on=paintedSurfaceAtlasPixels(true),off=paintedSurfaceAtlasPixels(false);
  expect(off).toHaveLength(on.length);expect(off).toBe(paintedSurfaceAtlasPixels(false));
  let dark=0;
  for(let i=0;i<off.length;i+=4){expect(off[i+3]).toBe(255);if(on[i+3]!<255){dark++;expect(off[i]).toBeGreaterThanOrEqual(on[i]!);}}
  expect(dark).toBeGreaterThan(1000);
});

test('the single texture preserves the original generic pixels and contains semantic marks with a distinct neutral Gouache mask',()=>{
  const atlas=createPaintedSurfaceAtlas(),another=createPaintedSurfaceAtlas(),generic=createStylizedSurfaceTexture();
  const data=atlas.image.data as Uint8Array,old=generic.image.data as Uint8Array;
  try{
    expect(atlas.image.width).toBe(512);expect(atlas.image.height).toBe(512);
    expect(data.byteLength).toBe(1048576);expect(another.image.data).toBe(data);
    expect(data).not.toBe(old);
    for(let y=0;y<64;y++)expect(data.subarray(y*512*4,y*512*4+64*4)).toEqual(old.subarray(y*64*4,(y+1)*64*4));
    const mask=(tile:number,u:number,v:number)=>{
      const fit=(x:number)=>.5+(x-.5)*SURFACE_DESIGN_LAYOUT_SCALE;
      const [x,y]=surfaceDesignUv(tile,tile>0&&tile<31?fit(u):u,tile>0&&tile<31?fit(v):v);
      return data[(Math.floor(y*512)*512+Math.floor(x*512))*4+3]!;
    };
    for(const tile of Object.values(FurniturePaint)){
      const samples=Array.from({length:26*26},(_,i)=>mask(tile,(i%26)/25,Math.floor(i/26)/25));
      expect(Math.min(...samples),`tile ${tile}`).toBeLessThan(180);
      expect(Math.max(...samples),`tile ${tile}`).toBe(255);
    }
    expect(mask(FurniturePaint.tabletop,.5,.51)).toBeLessThan(150);
    expect(mask(FurniturePaint.blanket,.5,.73)).toBeLessThan(180);
    expect(mask(FurniturePaint.grille,.5,.46)).toBeLessThan(130);
    expect(mask(FurniturePaint.door,.16,.25)).toBeLessThan(180);
    expect(mask(0,.5,.5)).toBe(255);
    expect(mask(31,.5,.5)).toBe(255);
  }finally{generic.dispose();atlas.dispose();another.dispose();}
});

test('specific furniture charts are selected only for meaningful authored parts and face axes',()=>{
  const large:Placement={x:0,y:.5,z:0,sx:1.5,sy:.1,sz:.8};
  expect(furnitureSurfaceDesign(large,'table','wood')).toBe(FurniturePaint.tabletop);
  expect(furnitureSurfaceDesign(large,'table','steel')).toBe(FurniturePaint.worktop);
  expect(furnitureSurfaceDesign(large,'bed','wood')).toBe(FurniturePaint.blanket);
  expect(furnitureSurfaceDesign({...large,sx:.6,sz:.28},'bed','wood')).toBe(FurniturePaint.pillow);
  expect(furnitureSurfaceDesign({...large,sy:.6,sz:.08},'dining-chair','wood')).toBe(FurniturePaint.panel);
  expect(furnitureSurfaceDesign({...large,sy:.7,sz:1.9},'dresser','wood')).toBe(FurniturePaint.dresser);
  expect(furnitureSurfaceDesign({...large,sy:.7,sz:.54},'heater','steel')).toBe(FurniturePaint.grille);
  expect(furnitureSurfaceDesign({...large,color:0x345673},'solar-generator','steel')).toBe(FurniturePaint.solar);
  expect(furnitureSurfaceDesign({...large,sx:.04,sy:.04,sz:.8},'table','wood')).toBe(0);
  expect(furnitureSurfaceDesign({...large,color:0x4f7a55},'billiards-table','wood')).toBe(0);
  expect(furnitureTileForNormal(FurniturePaint.tabletop,0,1,0)).toBe(FurniturePaint.tabletop);
  expect(furnitureTileForNormal(FurniturePaint.tabletop,0,-1,0)).toBe(0);
  expect(furnitureTileForNormal(FurniturePaint.door,0,0,-1)).toBe(FurniturePaint.door);
  expect(furnitureTileForNormal(FurniturePaint.door,1,0,0)).toBe(0);
  expect(furnitureTileForNormal(FurniturePaint.dresser,-1,0,0)).toBe(FurniturePaint.dresser);
  const world=camp(),parts=expected(world);
  expect(parts.some(p=>p.targetId===101&&p.surfaceDesign===FurniturePaint.tabletop)).toBe(true);
  expect(parts.some(p=>p.targetId===104&&p.surfaceDesign===FurniturePaint.blanket)).toBe(true);
  expect(parts.filter(p=>p.targetId===102).every(p=>p.surfaceDesign===undefined)).toBe(true);
});

test('prepared bake UVs are on private canonical copies while the live shared box retains its original geometry',()=>{
  const source=new THREE.BoxGeometry(1,1,1),baked=surfaceDesignedGeometry(source,(x,y,z)=>furnitureTileForNormal(FurniturePaint.tabletop,x,y,z));
  try{
    expect(source.hasAttribute(SURFACE_DESIGN_BAKE_UV)).toBe(false);
    expect(baked.index!.array).toEqual(source.index!.array);
    expect(baked.getAttribute('position').array).toEqual(source.getAttribute('position').array);
    const uv=baked.getAttribute(SURFACE_DESIGN_BAKE_UV),n=source.getAttribute('normal'),raw=source.getAttribute('uv');
    for(let i=0;i<uv.count;i++){
      const expected=surfaceDesignUv(n.getY(i)>0?FurniturePaint.tabletop:0,n.getY(i)>0?raw.getX(i):.5,n.getY(i)>0?raw.getY(i):.5);
      expect([uv.getX(i),uv.getY(i)]).toEqual(expected.map(Math.fround));
    }
    for(const tile of [3,6,30,63]){
      const packed=Math.fround(encodeSurfaceDesign(262143,tile));
      expect(surfaceVariantId(packed)).toBe(262143);
      expect((packed-surfaceVariantId(packed))*64).toBe(tile);
    }
    expect(()=>encodeSurfaceDesign(262144,3)).toThrow();
  }finally{source.dispose();baked.dispose();}
});

test('furniture patches and door animation reuse the existing instance attribute and canonical variant receipts',()=>{
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',wear:0,impasto:0});
  const flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{});
  const boxes=withGraphicsStyle(context,()=>new BoxBatches()),doors=withGraphicsStyle(context,()=>new DoorLayer()),group=new THREE.Group();
  try{
    const world=camp(),parts=expected(world);
    boxes.set(group,'furniture',parts);
    const box=mesh(group),geometry=box.geometry,material=box.material,attr=geometry.getAttribute(PREPARED_SURFACE_VARIANT);
    const row=parts.findIndex(p=>p.surfaceDesign===FurniturePaint.tabletop),old=attr.getX(row);
    expect((old-surfaceVariantId(old))*64).toBe(FurniturePaint.tabletop);
    expect(boxes.patchFurniture(group,'furniture',row,[{...parts[row]!,surfaceDesign:FurniturePaint.worktop}],parts.length,boxes.furnitureStamp()!)).toBe(true);
    const value=attr.getX(row);
    expect((value-surfaceVariantId(value))*64).toBe(FurniturePaint.worktop);
    expect(surfaceVariantId(value)).not.toBe(surfaceVariantId(old));
    expect(box.geometry).toBe(geometry);expect(box.material).toBe(material);expect(box.activeCount).toBe(parts.length);
    const closed={open:false,changedAt:0,from:0,holdOpen:false,forbidden:false,closeAt:null,lastTouch:0};
    world.structures=[
      {...structure('door',201,8,8),door:{...closed}},
      {...structure('fence-gate',202,12,12),door:{...closed}},
      {...structure('autodoor',203,14,14),material:'steel',door:{...closed}},
    ];
    doors.update(world,false,true);
    expect(doors.mesh.activeCount).toBe(6);
    const design=doors.mesh.geometry.getAttribute(PREPARED_SURFACE_VARIANT) as THREE.InstancedBufferAttribute;
    const ids=Array.from({length:6},(_,i)=>{const packed=design.getX(i);return (packed-surfaceVariantId(packed))*64;});
    expect(ids).toEqual([30,30,29,29,11,11]);
    const version=design.version;
    doors.present(5);doors.present(15);
    expect(design.version).toBe(version);
    const boxMap=Reflect.get(boxes,'decorationTexture') as THREE.DataTexture,doorMap=Reflect.get(doors,'paint') as THREE.DataTexture;
    const boxMatrices=box.instanceMatrix,doorMatrices=doors.mesh.instanceMatrix,boxAttributes=Object.keys(box.geometry.attributes),doorAttributes=Object.keys(doors.mesh.geometry.attributes);
    const settings={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default' as const,wear:0,impasto:0};
    context.update({...settings,personalizedTextures:false});
    expect(boxMap.image.data).toBe(paintedSurfaceAtlasPixels(false));expect(doorMap.image.data).toBe(paintedSurfaceAtlasPixels(false));
    context.update({...settings,personalizedTextures:true});
    expect(boxMap.image.data).toBe(paintedSurfaceAtlasPixels(true));expect(doorMap.image.data).toBe(paintedSurfaceAtlasPixels(true));
    expect(box.instanceMatrix).toBe(boxMatrices);expect(doors.mesh.instanceMatrix).toBe(doorMatrices);
    expect(Object.keys(box.geometry.attributes)).toEqual(boxAttributes);expect(Object.keys(doors.mesh.geometry.attributes)).toEqual(doorAttributes);
    expect(design.version).toBe(version);expect(doors.mesh.activeCount).toBe(6);
  }finally{boxes.dispose();doors.dispose();context.dispose();flush.mockRestore();}
});

