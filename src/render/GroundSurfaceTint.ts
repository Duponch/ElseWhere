import * as THREE from 'three/webgpu';
import {Fn,If,Loop,float,mix,renderGroup,texture,uniform,varying,vec2,vec3,vec4} from 'three/tsl';
import type {Placement} from './primitives';
import {ZONE_SELECTION_COLOR,ZONE_SELECTION_WIDTH,zoneBoundaryEdges} from './zone-surface-presentation';
import {groundOverlayAtlas,type GroundOverlayRect} from './ground-overlay-surfaces';

type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
const color=new THREE.Color();
/** Cell-sized static zone state plus analytic pointer bounds. No blade census.
 * The eligible preview mask is only its rectangle, and only changes on a gesture
 * or World update; a single-cell hover writes uniforms and never uploads a map. */
export class GroundSurfaceTint {
  readonly zones=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);
  readonly edges=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);
  readonly eligible=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);
  readonly overlayIndex=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);
  readonly overlayRecords=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);
  private readonly dimensions=uniform(new THREE.Vector2(1,1)).setGroup(renderGroup);
  private readonly zoneActive=uniform(0).setGroup(renderGroup);
  private readonly edgeActive=uniform(0).setGroup(renderGroup);
  private readonly hoverBounds=uniform(new THREE.Vector4(1,1,0,0)).setGroup(renderGroup);
  private readonly hoverColor=uniform(new THREE.Vector4()).setGroup(renderGroup);
  private readonly areaBounds=uniform(new THREE.Vector4(1,1,0,0)).setGroup(renderGroup);
  private readonly areaSize=uniform(new THREE.Vector2(1,1)).setGroup(renderGroup);
  private readonly areaColor=uniform(new THREE.Vector4()).setGroup(renderGroup);
  private readonly overlayBounds=uniform(new THREE.Vector4(0,0,-1,-1)).setGroup(renderGroup);
  private readonly overlayIndexSize=uniform(new THREE.Vector2(1,1)).setGroup(renderGroup);
  private readonly overlayRecordsSize=uniform(new THREE.Vector2(1,1)).setGroup(renderGroup);
  private readonly overlayActive=uniform(0).setGroup(renderGroup);
  private edgeKey='';
  private zoneKey='';
  private overlayKey='';
  constructor(){for(const map of [this.zones,this.edges,this.eligible,this.overlayIndex,this.overlayRecords]){map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;}}
  shade(base:THREE.Node,root:THREE.Node):THREE.Node {
    // A blade's four vertices share the authored root, before wind/shape. Sample
    // its cell and decide coverage once per vertex, not once per grass fragment.
    // Flat varyings retain that root-owned decision on both triangles, including
    // perspective views. Keep each colour operation below after lighting and in
    // its original order: precomposing an affine RGBA would reorder rounding.
    const p=vec2(root as ReturnType<typeof vec2>),cell=p.add(.5).floor(),local=p.sub(cell);
    const inside=p.x.greaterThanEqual(-.5).and(p.y.greaterThanEqual(-.5)).and(p.x.lessThan(this.dimensions.x.sub(.5))).and(p.y.lessThan(this.dimensions.y.sub(.5)));
    const hasZone=this.zoneActive.greaterThan(0).and(inside);
    const hasHover=this.hoverColor.w.greaterThan(0).and(p.x.greaterThanEqual(this.hoverBounds.x)).and(p.y.greaterThanEqual(this.hoverBounds.y))
      .and(p.x.lessThanEqual(this.hoverBounds.z)).and(p.y.lessThanEqual(this.hoverBounds.w));
    const hasArea=this.areaColor.w.greaterThan(0).and(cell.x.greaterThanEqual(this.areaBounds.x)).and(cell.y.greaterThanEqual(this.areaBounds.y))
      .and(cell.x.lessThanEqual(this.areaBounds.z)).and(cell.y.lessThanEqual(this.areaBounds.w)).and(local.x.abs().lessThanEqual(.43)).and(local.y.abs().lessThanEqual(.43));
    const tint=varying(Fn(()=>{
      const value=vec4(0).toVar();
      If(hasZone,()=>{value.assign(texture(this.zones,cell.add(.5).div(this.dimensions)).level(float(0)));});
      return value;
    })(),'groundZoneTint').setInterpolation(THREE.InterpolationSamplingType.FLAT,THREE.InterpolationSamplingMode.EITHER);
    const present=varying(Fn(()=>{
      const value=float(0).toVar();
      If(hasArea,()=>{value.assign(texture(this.eligible,cell.sub(this.areaBounds.xy).add(.5).div(this.areaSize)).level(float(0)).a);});
      return value;
    })(),'groundZoneEligible').setInterpolation(THREE.InterpolationSamplingType.FLAT,THREE.InterpolationSamplingMode.EITHER);
    const conditions=varying(Fn(()=>{
      const value=vec4(hasZone.select(1,0),hasHover.select(1,0),hasArea.select(1,0),0).toVar();
      If(this.edgeActive.greaterThan(0).and(inside),()=>{
        const edge=texture(this.edges,cell.add(.5).div(this.dimensions)).level(float(0));
        const onEdge=local.x.lessThan(-.5+ZONE_SELECTION_WIDTH).and(edge.r.greaterThan(0))
          .or(local.x.greaterThan(.5-ZONE_SELECTION_WIDTH).and(edge.g.greaterThan(0)))
          .or(local.y.lessThan(-.5+ZONE_SELECTION_WIDTH).and(edge.b.greaterThan(0)))
          .or(local.y.greaterThan(.5-ZONE_SELECTION_WIDTH).and(edge.a.greaterThan(0)));
        value.w.assign(onEdge.select(1,0));
      });
      return value;
    })(),'groundZoneConditions').setInterpolation(THREE.InterpolationSamplingType.FLAT,THREE.InterpolationSamplingMode.EITHER);
    // Producers expose their actual top faces and colours. Evaluate only the
    // small ordered list touching this root's cell; thin corners and .8/.86
    // plates retain their geometry rather than becoming whole-cell stains.
    const overlays=(phase:0|1)=>varying(Fn(()=>{
      const value=vec4(0).toVar();
      const covered=this.overlayActive.greaterThan(0).and(cell.x.greaterThanEqual(this.overlayBounds.x)).and(cell.y.greaterThanEqual(this.overlayBounds.y))
        .and(cell.x.lessThanEqual(this.overlayBounds.z)).and(cell.y.lessThanEqual(this.overlayBounds.w));
      If(covered,()=>{
        // Nearest samples at texel centres retain the exact atlas words. Avoid
        // textureLoad: Three's flipY setup injects textureSize into its UV node,
        // which can escape these vertex-only reads into the fragment stage.
        const header=texture(this.overlayIndex,cell.sub(this.overlayBounds.xy).add(.5).div(this.overlayIndexSize)).level(float(0));
        const range=phase===0?header.xy:header.zw;
        Loop({start:0,end:range.y.toInt(),type:'int'},({i})=>{
          const record=range.x.add(float(i)).mul(2);
          const texel=vec2(record.mod(this.overlayRecordsSize.x),record.div(this.overlayRecordsSize.x).floor());
          const bounds=texture(this.overlayRecords,texel.add(.5).div(this.overlayRecordsSize)).level(float(0));
          const rgba=texture(this.overlayRecords,texel.add(vec2(1.5,.5)).div(this.overlayRecordsSize)).level(float(0));
          If(p.x.greaterThanEqual(bounds.x).and(p.y.greaterThanEqual(bounds.y)).and(p.x.lessThanEqual(bounds.z)).and(p.y.lessThanEqual(bounds.w)),()=>{
            value.assign(vec4(value.rgb.mul(float(1).sub(rgba.a)).add(rgba.rgb.mul(rgba.a)),value.a.mul(float(1).sub(rgba.a)).add(rgba.a)));
          });
        });
      });
      return value;
    })(),phase===0?'groundBeforePreview':'groundAfterPreview').setInterpolation(THREE.InterpolationSamplingType.FLAT,THREE.InterpolationSamplingMode.EITHER);
    const before=overlays(0),after=overlays(1);
    return Fn(()=>{
      const result=vec4(base as ReturnType<typeof vec4>).toVar();
      If(conditions.x.greaterThan(0),()=>{
        result.assign(vec4(result.rgb.mul(float(1).sub(tint.a)).add(tint.rgb),result.a));
      });
      If(before.a.greaterThan(0),()=>{result.assign(vec4(result.rgb.mul(float(1).sub(before.a)).add(before.rgb),result.a));});
      If(conditions.y.greaterThan(0),()=>{
        result.assign(vec4(mix(result.rgb,this.hoverColor.xyz,this.hoverColor.w),result.a));
      });
      If(conditions.z.greaterThan(0),()=>{
        result.assign(vec4(mix(result.rgb,this.areaColor.xyz,this.areaColor.w.mul(present)),result.a));
      });
      If(after.a.greaterThan(0),()=>{result.assign(vec4(result.rgb.mul(float(1).sub(after.a)).add(after.rgb),result.a));});
      If(conditions.w.greaterThan(0),()=>{
        const selected=new THREE.Color(ZONE_SELECTION_COLOR);
        result.assign(vec4(vec3(selected.r,selected.g,selected.b),result.a));
      });
      return result;
    })();
  }
  /** Independent semantic layers: clearing a pointer does not erase a selected
   * deposit/contour, and hidden hints never survive an interrupted gesture. */
  setOverlays(width:number,height:number,before:readonly GroundOverlayRect[],after:readonly GroundOverlayRect[]):void {
    const key=JSON.stringify([width,height,before,after]);if(key===this.overlayKey)return;this.overlayKey=key;
    this.dimensions.value.set(width,height);
    const atlas=groundOverlayAtlas(width,height,before,after),update=(map:THREE.DataTexture,data:Float32Array,w:number,h:number)=>{
      if(map.image.width!==w||map.image.height!==h)map.dispose();map.image={data,width:w,height:h};map.needsUpdate=true;
    };
    update(this.overlayIndex,atlas.index,atlas.width,atlas.height);update(this.overlayRecords,atlas.records,atlas.recordsWidth,atlas.recordsHeight);
    const b=atlas.bounds;this.overlayBounds.value.set(b.minX,b.minZ,b.maxX,b.maxZ);this.overlayIndexSize.value.set(atlas.width,atlas.height);this.overlayRecordsSize.value.set(atlas.recordsWidth,atlas.recordsHeight);
    this.overlayActive.value=Number(b.maxX>=b.minX&&b.maxZ>=b.minZ);
  }
  /** `always` (schema 369 plans) keeps a layer when the zones are hidden. */
  setZones(width:number,height:number,layers:readonly {placements:readonly Placement[];opacity:number;always?:boolean}[],visible:boolean):void {
    const shown=(layer:{always?:boolean})=>visible||!!layer.always;
    const key=`${width}:${height}:${visible}:`+layers.map(layer=>shown(layer)?`${layer.opacity}:${layer.placements.map(p=>`${p.x},${p.z},${p.color??0xffffff}`).join(';')}`:'').join('|');
    if(key===this.zoneKey)return;this.zoneKey=key;
    const resized=this.zones.image.width!==width||this.zones.image.height!==height;
    const data=new Float32Array(width*height*4);
    let present=false;
    for(const layer of layers)if(shown(layer))for(const p of layer.placements){
      if(p.x<0||p.z<0||p.x>=width||p.z>=height)continue;
      const i=(p.z*width+p.x)*4,a=layer.opacity;color.setHex(p.color??0xffffff);
      data[i]=data[i]!*(1-a)+color.r*a;data[i+1]=data[i+1]!*(1-a)+color.g*a;data[i+2]=data[i+2]!*(1-a)+color.b*a;data[i+3]=data[i+3]!*(1-a)+a;present=true;
    }
    if(resized)this.zones.dispose();this.zones.image={data,width,height};this.zones.needsUpdate=true;
    this.dimensions.value.set(width,height);this.zoneActive.value=Number(present);
  }
  setSelection(width:number,height:number,cells:readonly number[],visible:boolean):void {
    const key=`${width}:${height}:${visible?cells.join(','):''}`;if(key===this.edgeKey)return;this.edgeKey=key;
    const data=new Uint8Array(width*height*4),edges=visible?zoneBoundaryEdges(width,cells):new Map<number,number>();
    for(const [cell,mask]of edges)for(let bit=0;bit<4;bit++)if(mask&(1<<bit))data[cell*4+bit]=255;
    if(this.edges.image.width!==width||this.edges.image.height!==height)this.edges.dispose();
    this.edges.image={data,width,height};this.edges.needsUpdate=true;this.edgeActive.value=Number(edges.size>0);
  }
  setHover(x:number,z:number,sx:number,sz:number,hex:number,opacity:number):void {
    this.hoverBounds.value.set(x-sx*.48,z-sz*.48,x+sx*.48,z+sz*.48);color.setHex(hex);this.hoverColor.value.set(color.r,color.g,color.b,opacity);this.areaColor.value.w=0;
  }
  setArea(width:number,bounds:Bounds,cells:readonly number[],hex:number,opacity=.48):void {
    const w=bounds.maxX-bounds.minX+1,h=bounds.maxZ-bounds.minZ+1,data=new Uint8Array(w*h*4);
    for(const i of cells){const x=i%width-bounds.minX,z=Math.floor(i/width)-bounds.minZ;if(x>=0&&z>=0&&x<w&&z<h)data[(z*w+x)*4+3]=255;}
    if(this.eligible.image.width!==w||this.eligible.image.height!==h)this.eligible.dispose();
    this.eligible.image={data,width:w,height:h};this.eligible.needsUpdate=true;
    this.areaBounds.value.set(bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ);this.areaSize.value.set(w,h);color.setHex(hex);this.areaColor.value.set(color.r,color.g,color.b,opacity);
  }
  clearPreview():void {this.hoverColor.value.w=0;this.areaColor.value.w=0;}
  dispose():void {this.zones.dispose();this.edges.dispose();this.eligible.dispose();this.overlayIndex.dispose();this.overlayRecords.dispose();}
}
