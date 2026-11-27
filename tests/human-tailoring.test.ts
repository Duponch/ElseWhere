import {describe,expect,it} from 'vitest';
import {origamiHumanGeometry,HUMAN_REFERENCE_SCALE} from '../src/render/origami/human-geometry';
import {createHumanTailoringTexture,humanTailoringPixels,humanChartTone,humanDetailChart,humanDetailUv,HUMAN_PAINT_CHARTS,TSHIRT_PAINT_OUTFIT} from '../src/render/human-tailoring';
import {copyPastelTextureToArray} from '../src/render/surfaces/TextureSurface';
import {apparelAppearance} from '../src/render/character-apparel';
import {newApparelState,type ApparelItem} from '../src/sim/apparel-rules';
import type {MaterialPile} from '../src/sim/types';
import {portraitDataUrl,setPortraitPersonalizedTextures} from '../src/ui/pawn-portrait';
import type {PawnAppearance} from '../src/sim/pawn-appearance';
import {BEARD_STYLES} from '../src/sim/pawn-appearance';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

const outfit=(item:ApparelItem)=>{
  const pile:MaterialPile={id:1,kind:'apparel',item,quantity:1,owner:{type:'apparel',pawnId:1},apparel:newApparelState(item)};
  return apparelAppearance([pile]);
};
const identity:PawnAppearance={version:1,sex:'male',bodyType:'Hulk',headType:'Male_AverageWide',hair:'Lackland',beard:BEARD_STYLES.find(style=>style.shape==='none')!.id,skinColor:0xc28e68,hairColor:0x3b271b};

describe('shared low-poly human tailoring charts',()=>{
  it('uses equal physical density for generic skin/hair washes while preserving all tailored silhouettes',()=>{
    const front=[0,0,1] as const,side=[1,0,0] as const,top=[0,1,0] as const;
    for(const chart of ['plain','skin','hair'] as const){
      const origin=humanDetailUv(chart,[0,0],[0,.4,0],front),right=humanDetailUv(chart,[1,0],[.1,.4,0],front),up=humanDetailUv(chart,[0,1],[0,.5,0],front);
      expect(right[0]-origin[0]).toBeCloseTo(up[1]-origin[1],12);
      const narrow=humanDetailUv(chart,[1,0],[.025,.4,0],front);
      expect(right[0]-origin[0]).toBeCloseTo(4*(narrow[0]-origin[0]),12);
      expect(humanDetailUv(chart,[1,1],[0,.4,.1],side)).toEqual(humanDetailUv(chart,[1,1],[.1,.4,0],front));
      const crown=humanDetailUv(chart,[0,0],[.1,1.3,.1],top);
      expect(crown[0]).toBeCloseTo(crown[1],12);
    }
    const uv=[.14,.91] as const;
    for(const chart of Object.keys(HUMAN_PAINT_CHARTS) as (keyof typeof HUMAN_PAINT_CHARTS)[]){
      if(chart==='plain'||chart==='skin'||chart==='hair')continue;
      expect(humanDetailUv(chart,uv,[.03,1.2,.2],front),chart+' must keep its collar/pocket/face chart').toBe(uv);
    }
  });
  it('disables personalized marks in the same-size atlas while retaining the generic brush wash',()=>{
    const on=humanTailoringPixels(true),off=humanTailoringPixels(false);
    expect(off.byteLength).toBe(on.byteLength);
    let changed=0,brush=0,nonNeutral=0;
    for(let i=0;i<off.length;i+=4){
      if(off[i+1]!==255||off[i+2]!==255||off[i+3]!==255)nonNeutral++;
      if(off[i]!==on[i])changed++;
      if(off[i]!<255)brush++;
    }
    expect(nonNeutral).toBe(0);expect(changed).toBeGreaterThan(1000);expect(brush).toBeGreaterThan(1000);
    expect(humanTailoringPixels(false)).toBe(off);
  });
  it('updates an existing human texture at the renderer setting boundary and releases its subscription on disposal',()=>{
    const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,impasto:0,wear:0});
    const map=withGraphicsStyle(context,()=>createHumanTailoringTexture()),image=map.image,version=map.version;
    try{
      expect(image.data).toBe(humanTailoringPixels(true));
      context.update({...context.preferences,personalizedTextures:false});
      expect(map.image).toBe(image);expect(map.image.data).toBe(humanTailoringPixels(false));expect(map.version).toBeGreaterThan(version);
      context.update({...context.preferences,personalizedTextures:true});expect(map.image.data).toBe(humanTailoringPixels(true));
      map.dispose();const disposedVersion=map.version;
      context.update({...context.preferences,personalizedTextures:false});expect(map.version).toBe(disposedVersion);
    }finally{map.dispose();context.dispose();}
  });
  it('keeps the same texel scale on actual rectangular skin and hair faces of the shared rig',()=>{
    const g=origamiHumanGeometry(false,false,false,false,false,false),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('origamiPaintUv'),d=g.getAttribute('dye'),b=g.getAttribute('boneId');
    let edges=0;
    try{
      for(let first=0;first<p.count;first+=3){
        const normal=[n.getX(first),n.getY(first),n.getZ(first)] as const;
        if(Math.max(...normal.map(Math.abs))<.999999)continue;
        const point=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)] as const;
        const chart=humanDetailChart(d.getX(first),b.getX(first),0,...point(first),...normal);
        if(chart!=='skin'&&chart!=='hair')continue;
        const a=point(first),au=humanDetailUv(chart,[uv.getX(first),uv.getY(first)],a,normal);
        for(let j=1;j<3;j++){
          const vertex=first+j,c=point(vertex),cu=humanDetailUv(chart,[uv.getX(vertex),uv.getY(vertex)],c,normal),length=Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
          if(length<1e-7)continue;
          expect(Math.hypot(cu[0]-au[0],cu[1]-au[1])*2*HUMAN_REFERENCE_SCALE).toBeCloseTo(length,6);edges++;
        }
      }
      expect(edges).toBeGreaterThan(100);
    }finally{g.dispose();}
  });
  it('puts the placket and buttons only on shirt faces, with distinct coat and T-shirt drawings',()=>{
    expect(humanChartTone('shirtFront',.53,.36)).toBeLessThan(.61);
    expect(humanChartTone('tshirtFront',.53,.36)).toBe(1);
    expect(humanChartTone('shirtBack',.53,.36)).toBe(1);
    expect(humanChartTone('parkaFront',.54,.49)).toBeLessThan(.61);
    expect(humanChartTone('parkaBack',.54,.49)).toBeGreaterThan(.7);
    expect(humanChartTone('dusterRight',.25,.38)).not.toBe(humanChartTone('dusterLeft',.25,.38));
    expect(humanChartTone('trouser',.15,.68)).toBeLessThan(.83);
    expect(humanChartTone('face',.5,.215)).toBeLessThan(.9);
    expect(humanChartTone('plain',.1,.1)).toBe(1);
  });
  it('keeps every face in one chart even on tapered garments and split trousers, with no new geometry',()=>{
    const g=origamiHumanGeometry(true,true,true,true,false,false,true),d=g.getAttribute('dye'),b=g.getAttribute('boneId'),p=g.getAttribute('position'),n=g.getAttribute('normal');
    const select=(v:number,look:number)=>humanDetailChart(d.getX(v),b.getX(v),look,p.getX(v),p.getY(v),p.getZ(v),n.getX(v),n.getY(v),n.getZ(v));
    try{
      const seen=new Set<string>();
      for(let look=0;look<8;look++)for(let v=0;v<p.count;v+=3){
        const chart=select(v,look);expect(select(v+1,look),`triangle ${v/3} outfit ${look}`).toBe(chart);expect(select(v+2,look),`triangle ${v/3} outfit ${look}`).toBe(chart);
        seen.add(chart);
      }
      expect([...seen].sort()).toEqual(Object.keys(HUMAN_PAINT_CHARTS).sort());
    }finally{g.dispose();}
  });
  it('packs both neutral tonal channels into one resident 256-square texture with copied atlas-compatible mip contract',()=>{
    const original=createHumanTailoringTexture(),other=createHumanTailoringTexture(),array=copyPastelTextureToArray(original,256);
    try{
      expect(original.image.data).toBe(other.image.data);
      expect(original.image.data!.byteLength).toBe(256*256*4);
      expect(array.image.data!.byteLength).toBe(2*256*256*4);
      expect(array.image.data!.subarray(0,original.image.data!.byteLength)).toEqual(original.image.data);
      const address=(chart:number,x:number,y:number)=>((Math.floor(chart/8)*32+y)*256+(chart%8)*32+x)*4;
      for(let y=0;y<32;y++)for(let x=0;x<32;x++)expect(original.image.data![address(HUMAN_PAINT_CHARTS.plain,x,y)+1]).toBe(255);
      const shirt=HUMAN_PAINT_CHARTS.shirtFront;
      expect(original.image.data![address(shirt,16,12)+1]).toBeLessThan(210);
      expect(array.generateMipmaps).toBe(true);
    }finally{original.dispose();other.dispose();array.dispose();}
  });
  it('selects real T-shirt, shirt, duster and parka appearance in the same cached portrait pipeline',()=>{
    expect(outfit('cloth-tshirt').silhouette).toBe(TSHIRT_PAINT_OUTFIT);
    for(const [item,chart]of [['cloth-shirt','shirtFront'],['cloth-tshirt','tshirtFront'],['cloth-duster','dusterRight'],['cloth-parka','parkaFront']]as const){
      const look=outfit(item);
      const url=portraitDataUrl(identity,look),svg=decodeURIComponent(url.slice(url.indexOf(',')+1));
      expect(svg).toContain(`href="#paint-${chart}"`);
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(portraitDataUrl(identity,look)).toBe(url);
    }
  });
  it('switches portrait details live and caches both variants without changing its actual rig or colors',()=>{
    const look=outfit('cloth-shirt'),decode=(url:string)=>decodeURIComponent(url.slice(url.indexOf(',')+1));
    try{
      setPortraitPersonalizedTextures(true);const on=portraitDataUrl(identity,look);
      setPortraitPersonalizedTextures(false);const off=portraitDataUrl(identity,look),svg=decode(off);
      expect(svg).not.toContain('href="#paint-');expect(off).not.toBe(on);
      const polygons=(value:string)=>[...decode(value).matchAll(/<polygon points="[^"]+" fill="[^"]+" stroke="[^"]+" stroke-width=".2"\/>/g)].map(match=>match[0]);
      expect(polygons(off)).toEqual(polygons(on));
      setPortraitPersonalizedTextures(true);expect(portraitDataUrl(identity,look)).toBe(on);
    }finally{setPortraitPersonalizedTextures(true);}
  });
});
