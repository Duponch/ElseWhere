import * as THREE from 'three/webgpu';
import { Fn, If, attribute, float, texture, uint, varying, vec2 } from 'three/tsl';
import { furnitureFaceMask, paintFurnitureSurfaceDesign } from './furniture-surface-design';
import { ITEM_GRAIN_DESIGNS, itemSurfaceDesignIsGrain, paintItemSurfaceDesign } from './item-surface-design';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import {instancedBoxFaceSpan} from './texture-variation';

const SIZE=512, TILE=32, GUTTER=3, INSIDE=TILE-GUTTER*2;
export const SURFACE_DESIGN_BAKE_UV='surfaceDesignBakeUv';

const GENERIC=0, NEUTRAL=31;
let atlasPixels:Uint8Array|undefined;
let neutralPixels:Uint8Array|undefined;
export const SURFACE_DESIGN_LAYOUT_SCALE=Math.SQRT1_2;
export const SURFACE_DESIGN_ASPECTS=Object.freeze([.125,.25,.5,1,2,4,8]);
export function surfaceDesignAspectBucket(width:number,height:number):number {
  return Math.max(0,Math.min(6,Math.round(Math.log2(Math.max(Math.abs(width),1e-6)/Math.max(Math.abs(height),1e-6)))+3));
}
export function surfaceDesignEffectiveTile(tile:number,width:number,height:number):number {
  const ratio=Math.max(Math.abs(width),1e-6)/Math.max(Math.abs(height),1e-6);
  return tile>0&&tile<31&&(ratio<.125*SURFACE_DESIGN_LAYOUT_SCALE||ratio>8/SURFACE_DESIGN_LAYOUT_SCALE)?0:tile;
}
/** First three rows leave a 96px square for the historical generic texture. */
function atlasCell(tile:number,bucket:number):readonly[number,number] {
  if(tile<3||tile===NEUTRAL)return [15,15];
  const ordinal=tile<32?(tile-3)*7+bucket:196+tile-32;
  return ordinal<39?[ordinal%13+3,Math.floor(ordinal/13)]:[(ordinal-39)%16,Math.floor((ordinal-39)/16)+3];
}

/** RGB contains Pastel pigment and authored marks. A is an independent
 * neutral multiplicative mask for offline Gouache preparation/close Source.
 * The first 64² pixels keep the old generic Pastel unchanged, with a duplicated
 * right/bottom border. Every authored chart has a three-pixel extruded gutter.
 * Seven reference aspects share one bounded 512² atlas. The exact live aspect
 * samples a centered crop; the complete semantic layout stays inside the
 * common safe area, so hems, handles and panels are never cut at a bucket edge. */
function buildPaintedSurfacePixels(personalized=true):Uint8Array {
  const base=createStylizedSurfaceTexture(),pigment=base.image.data as Uint8Array;
  const data=new Uint8Array(SIZE*SIZE*4).fill(255);
  try{
    for(let y=0;y<96;y++)for(let x=0;x<96;x++){
      const source=(Math.min(y,63)*64+Math.min(x,63))*4;
      data.set(pigment.subarray(source,source+4),(y*SIZE+x)*4);
    }
    for(let tile=3;tile<64;tile++)for(let bucket=0;bucket<(tile<31?7:1);bucket++){
      if(tile===NEUTRAL)continue;
      const [cx,cy]=atlasCell(tile,bucket),ox=cx*TILE,oy=cy*TILE,reference=SURFACE_DESIGN_ASPECTS[bucket]!;
      for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
        const px=Math.max(0,Math.min(INSIDE-1,x-GUTTER)),py=Math.max(0,Math.min(INSIDE-1,y-GUTTER));
        const u=(px+.5)/INSIDE,v=(py+.5)/INSIDE;
        const factor=personalized?(tile<32?paintFurnitureSurfaceDesign(tile,(u-.5)/SURFACE_DESIGN_LAYOUT_SCALE+.5,(v-.5)/SURFACE_DESIGN_LAYOUT_SCALE+.5,reference):paintItemSurfaceDesign(tile,u,v)):1;
        const longest=Math.max(reference,1),pu=tile<32?(u-.5)*reference/longest+.5:u,pv=tile<32?(v-.5)/longest+.5:v;
        const source=(Math.floor(pv*64)*64+Math.floor(pu*64))*4,at=((y+oy)*SIZE+x+ox)*4;
        for(let c=0;c<3;c++)data[at+c]=Math.round(pigment[source+c]!*factor);
        // The coarser Gouache brushwork needs a distinctly readable seam.
        // Keep the stronger ink in the existing alpha mask.
        data[at+3]=Math.round(255*factor*factor);
      }
    }
  }finally{base.dispose();}
  return data;
}
/** Owners still dispose their own GPU texture. The immutable CPU atlas is
 * baked once per module, including a gallery with several DoorLayers. */
export function createPaintedSurfaceAtlas():THREE.DataTexture {
  const map=new THREE.DataTexture(atlasPixels??=buildPaintedSurfacePixels(),SIZE,SIZE,THREE.RGBAFormat);
  map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
  map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.needsUpdate=true;
  map.name='painted-furniture-and-items512';
  return map;
}
export function paintedSurfaceAtlasPixels(personalized:boolean):Uint8Array {
  return personalized?(atlasPixels??=buildPaintedSurfacePixels()):(neutralPixels??=buildPaintedSurfacePixels(false));
}

/** Exact centered crop of physically drawn reference art. The shorter crop
 * remains >=sqrt(1/2), which contains the complete padded semantic layout.
 * Silhouette-specific loose apparel/hides/leaves keep their authored mapping. */
export function fittedSurfaceDesignUv(tile:number,u:number,v:number,width:number,height:number):readonly[number,number] {
  if(tile===0||(tile>=32&&!itemSurfaceDesignIsGrain(tile)))return [u,v];
  const reference=tile>=32?1:SURFACE_DESIGN_ASPECTS[surfaceDesignAspectBucket(width,height)]!,w=Math.max(Math.abs(width)/reference,1e-6),h=Math.max(Math.abs(height),1e-6),longest=Math.max(w,h);
  return [(u-.5)*w/longest+.5,(v-.5)*h/longest+.5];
}
/** Existing matrix columns already contain scale. Only vertex arithmetic is
 * added; rotation and uniform scaling cannot change the fitted composition. */
export function surfaceDesignFaceSpanNode(normal:THREE.Node<'vec3'>):THREE.Node<'vec2'> {
  return instancedBoxFaceSpan(normal);
}

export function surfaceDesignUv(tile:number,u:number,v:number,aspect=1):readonly[number,number]{
  if(tile===GENERIC)return[u*.125,v*.125];
  const [x,y]=atlasCell(tile,surfaceDesignAspectBucket(aspect,1));
  return[(x*TILE+GUTTER+.5+u*(INSIDE-1))/SIZE,(y*TILE+GUTTER+.5+v*(INSIDE-1))/SIZE];
}

/** IDs stay exact floats: 18 bits for a canonical prepared variant and six
 * fractional bits for an authored design. The existing GPU instance field is
 * used; no new buffer, draw, or actor-sized per-image updates. */
export function encodeSurfaceDesign(variant:number,tile:number):number {
  if(tile===GENERIC)return variant;
  if(!Number.isInteger(tile)||tile<0||tile>63||!Number.isInteger(variant)||variant<0||variant>=262144)throw Error('Surface design exceeds exact packed variant domain');
  return variant+tile/64;
}
export const surfaceVariantId=(encoded:number)=>Math.floor(encoded);
export function surfaceDesignOverrideNode():THREE.Node<'float'> {
  return attribute('preparedSurfaceVariant','float').max(0).fract().mul(64);
}

/** Vertex-only coordinate chart. Generic sampling keeps the physical crop and
 * per-instance seed. Specific charts instead follow the real face corner UV. */
export function surfaceDesignUvNode(tile:THREE.Node<'float'>,raw:THREE.Node<'vec2'>,generic:THREE.Node<'vec2'>,physicalSpan?:THREE.Node<'vec2'>):THREE.Node<'vec2'> {
  let fitted=raw;
  let bucket:THREE.Node<'float'>=float(3);
  if(physicalSpan){
    const ratio=physicalSpan.x.max(1e-6).div(physicalSpan.y.max(1e-6));
    const tooThin=ratio.lessThan(.125*SURFACE_DESIGN_LAYOUT_SCALE).or(ratio.greaterThan(8/SURFACE_DESIGN_LAYOUT_SCALE));
    tile=tile.greaterThan(0).and(tile.lessThan(31)).and(tooThin).select(float(0),tile);
    bucket=ratio.log2().round().add(3).clamp(0,6);
    const reference=float(2).pow(bucket.sub(3)),span=physicalSpan.div(vec2(reference,1)).max(1e-6),fit=raw.sub(.5).mul(span.div(span.x.max(span.y))).add(.5);
    const grainMask=ITEM_GRAIN_DESIGNS.reduce((mask,id)=>mask+2**(id-32),0),isGrain=tile.greaterThanEqual(32).and(uint(grainMask).bitAnd(uint(1).shiftLeft(tile.sub(32).max(0).toUint())).notEqual(0));
    const grainFit=raw.sub(.5).mul(physicalSpan.div(physicalSpan.x.max(physicalSpan.y).max(1e-6))).add(.5);
    fitted=tile.greaterThan(0).and(tile.lessThan(32)).select(fit,isGrain.select(grainFit,raw));
  }
  const ordinal=tile.lessThan(32).select(tile.sub(3).mul(7).add(bucket),tile.sub(32).add(196));
  const remainder=ordinal.sub(39),cell=ordinal.lessThan(39).select(vec2(ordinal.mod(13).add(3),ordinal.div(13).floor()),vec2(remainder.mod(16),remainder.div(16).floor().add(3)));
  const origin=tile.lessThan(3).or(tile.equal(NEUTRAL)).select(vec2(15),cell).mul(TILE);
  const chart=origin.add(GUTTER+.5).add(fitted.mul(INSIDE-1)).div(SIZE);
  return varying(tile.equal(GENERIC).select(generic.mul(.125),chart));
}
const masks=[1,2,4,8].map(face=>Array.from({length:32},(_,tile)=>(furnitureFaceMask(tile)&face)?2**tile:0).reduce((a,b)=>a+b,0));
/** The same finite semantic mask used by the bake geometry. A thin edge of
 * a pillow or tabletop remains generic instead of stretching the top art. */
export function furnitureSurfaceTileNode(design:THREE.Node<'float'>,normal:THREE.Node<'vec3'>):THREE.Node<'float'> {
  const mask=normal.x.abs().greaterThan(.5).select(
    uint(masks[0]!),normal.y.greaterThan(.5).select(
      uint(masks[1]!),normal.z.abs().greaterThan(.5).select(uint(masks[2]!),uint(masks[3]!))));
  return mask.bitAnd(uint(1).shiftLeft(design.toUint())).notEqual(0).select(design,float(0));
}

/** Direct Source (near/positive-effects) keeps the existing Gouache strokes.
 * A decorated face uses one small additional mask sample; generic ones use
 * none. Prepared bank compilation applies the identical transform offline. */
export function paintedSurfaceDecorator(body:THREE.Node<'vec3'>,map:THREE.Texture,coords:THREE.Node<'vec2'>):THREE.Node<'vec3'> {
  return Fn(()=>{
    const result=body.toVar(),dx=coords.dFdx().toVar(),dy=coords.dFdy().toVar();
    If(coords.x.greaterThan(.125).or(coords.y.greaterThan(.125)),()=>{
      result.mulAssign(texture(map,coords).grad(dx,dy).a);
    });
    return result;
  })();
}

/** A prepared variant can have another surface design on the same exact
 * canonical geometry. This private bake-only clone adds no live vertex field
 * or instance. It retains all original face/metric/stroke IDs for the atlas. */
export function surfaceDesignedGeometry(source:THREE.BufferGeometry,tileForNormal:(nx:number,ny:number,nz:number)=>number,scale:readonly[number,number,number]=[1,1,1]):THREE.BufferGeometry {
  const geometry=source.clone(),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
  const values=new Float32Array(uv.count*2);
  for(let i=0;i<uv.count;i++){
    const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),width=scale[0]*(1-nx)+scale[2]*nx,height=scale[1]*(1-ny)+scale[2]*ny;
    const tile=surfaceDesignEffectiveTile(tileForNormal(normal.getX(i),normal.getY(i),normal.getZ(i)),width,height);
    const fitted=fittedSurfaceDesignUv(tile,uv.getX(i),uv.getY(i),width,height);
    const chart=tile?surfaceDesignUv(tile,...fitted,width/Math.max(height,1e-6)):surfaceDesignUv(GENERIC,.5,.5);
    values.set(chart,i*2);
  }
  geometry.setAttribute(SURFACE_DESIGN_BAKE_UV,new THREE.BufferAttribute(values,2));
  return geometry;
}

/** Admission budget for the private geometry copies. No stable-frame query. */
export function surfaceDesignGeometryBytes(geometries:Iterable<THREE.BufferGeometry>):number {
  const arrays=new Set<ArrayBufferView>();
  for(const geometry of geometries){
    if(geometry.index)arrays.add(geometry.index.array);
    for(const a of Object.values(geometry.attributes))arrays.add(a.array);
  }
  return [...arrays].reduce((bytes,array)=>bytes+array.byteLength,0);
}

