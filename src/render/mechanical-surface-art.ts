import * as THREE from 'three/webgpu';
import {attribute, float, instanceIndex, uv, varying, vec2} from 'three/tsl';
import {paintUv} from './texture-aspect';
import {createStylizedSurfaceTexture} from './stylized-surfaces';

const SIZE = 128;
const TILE = 32;
const MARGIN = 2;

export const mechanicalPaint = {
  panel: 0, hatch: 1, vent: 2, rim: 3, glass: 4, sensor: 5,
  joint: 6, housing: 7, edge: 8, head: 9, limb: 10, cap: 11,
  cargo: 12, rescue: 13, landing: 14, weathered: 15,
} as const;
export type MechanicalPaintChart = typeof mechanicalPaint[keyof typeof mechanicalPaint];

/** The meaningful lids are drawn for their real rectangles, rather than a
 * square subsequently stretched over the capsule. Generic marks use square
 * material space and are cropped to the face's physical aspect. */
export function mechanicalPaintAspect(chart:MechanicalPaintChart):number {
  // These vertical seam/visor drawings were authored for the body part,
  // unlike the generic joint and material charts.
  if(chart===mechanicalPaint.limb)return .3;
  if(chart===mechanicalPaint.edge)return .2;
  if(chart===mechanicalPaint.head)return 1.2;
  if(chart===mechanicalPaint.glass)return .34/.60;
  if(chart===mechanicalPaint.landing)return .56/1.82;
  if(chart===mechanicalPaint.cargo)return .54/1.82;
  if(chart===mechanicalPaint.rescue||chart===mechanicalPaint.weathered)return .54/1.90;
  return 1;
}

export function mechanicalFacePaintUv(chart:MechanicalPaintChart,u:number,v:number,width:number,height:number):[number,number] {
  return mechanicalPaintUv(chart,...paintUv(u,v,width,height,mechanicalPaintAspect(chart)));
}

/** The same drawing vocabulary serves the authored boxes of capsules and
 * mechanical actors. Drawings are in panel space and keep the original tint.
 * Broken charcoal edges and subdued chalk marks remain legible at tile scale. */
function paintValue(chart: number, u: number, v: number, noise: number): number {
  const {panel,hatch,vent,rim,glass,sensor,joint,housing,edge,head,limb,cap,cargo,rescue,landing,weathered} = mechanicalPaint;
  const border = Math.min(u, v, 1-u, 1-v);
  const aspect=mechanicalPaintAspect(chart as MechanicalPaintChart);
  // Distances are in units of the short physical edge. Panels keep their
  // full authored silhouette; their screws and emblem remain circular/square.
  const metricU=Math.max(aspect,1),metricV=Math.max(1/aspect,1);
  const near = (a: number, b: number, width: number) => Math.abs(a-b) < width;
  const corners = Math.hypot(Math.min(Math.abs(u-.12),Math.abs(u-.88))*metricU,Math.min(Math.abs(v-.12),Math.abs(v-.88))*metricV);
  const wobble = Math.sin(u*23+v*11)*.009 + noise*.005;
  let shade = .93 + .045*Math.sin(u*7+v*4) + noise*.023;
  if (chart===glass||chart===sensor) {
    shade = .66 + .27*v + noise*.025;
    if (border<.075) shade *= .48;
    if (near(u+v*.25,.28,.065)) shade = .97;
    if(chart===sensor&&Math.hypot(u-.52,v-.52)<.18) shade = .98;
    return shade;
  }
  if (chart===joint||chart===cap) {
    const ring = Math.hypot(u-.5,v-.5);
    if (near(ring,.34,.05)||near(ring,.21,.028)) shade *= .57;
    if (ring<.12) shade *= .75;
  } else if (chart===vent||chart===housing) {
    if(u>.16&&u<.84&&v>.18&&v<.82) {
      const row = (v-.18)*8;
      const channel = row-Math.floor(row);
      shade *= channel<.46 ? .49 : channel<.64 ? .74 : .95;
    }
  } else if (chart===rim||chart===edge) {
    if (near(u,.18,.035)||near(u,.82,.035)) shade *= .62;
    if (chart===rim&&v>.35&&v<.65&&Math.floor((u+v*.45)*9)%2===0) shade *= .72;
    if (chart===edge&&u>.79) shade = .99;
  } else if (chart===head) {
    if (u>.15&&u<.85&&v>.40&&v<.65) shade *= .37;
    if (u>.25&&u<.75&&near(v,.69,.028)) shade = .98;
  } else if (chart===limb) {
    if (near(u,.18+wobble,.03)||near(u,.82-wobble,.03)||near(v,.74,.043)) shade *= .66;
    if(u>.31&&u<.69&&v>.22&&v<.30) shade *= .72;
  } else {
    if(near(border,.085+wobble,.025)) shade *= .59;
    if(near(v,.17+wobble,.022)&&u>.19&&u<.81) shade *= .68;
    if (chart===hatch||chart===cargo||chart===rescue||chart===landing||chart===weathered) {
      if(u>.18&&u<.82&&v>.19&&v<.81&&near(Math.max(Math.abs(u-.5),Math.abs(v-.5)),.28,.026)) shade *= .72;
      if(chart===rescue) {
        // Painted rescue emblem, on the broad lid face.
        if ((Math.abs(u-.5)*metricU<.082&&Math.abs(v-.5)*metricV<.23)||(Math.abs(v-.5)*metricV<.082&&Math.abs(u-.5)*metricU<.23)) shade *= .51;
      } else if(chart===cargo) {
        if(u>.30&&u<.70&&v>.38&&v<.62&&Math.floor(u*18)%2===0) shade *= .56;
      } else if(chart===landing) {
        if(near(Math.abs(u-.5)*metricU+Math.abs(v-.5)*metricV,.26,.045)) shade *= .52;
      } else if(chart===weathered) {
        if (near(u-v,.02,.055)||near(u+v,1,.055)) shade *= .57;
      } else if(u>.38&&u<.62&&near(v,.5,.045)) shade *= .49;
    } else if(chart===panel && u>.28&&u<.72&&near(v,.77,.037)) shade *= .71;
  }
  if (corners<.055) shade *= .55;
  if (border<.035) shade *= .78;
  return shade;
}

/** Shared immutable pixels. Each caller retains normal texture ownership;
 * no Canvas, texture generation or upload is performed during a draw. */
let pixels: Uint8Array | undefined;
let neutralPixels:Uint8Array|undefined;
/** Same neutral material grain as the original capsule map, retained inside
 * the same guarded chart allocation so switching adds no texture or sample. */
export function mechanicalSurfacePixels(personalized=true):Uint8Array {
  if(!personalized){
    if(!neutralPixels){
      neutralPixels=new Uint8Array(SIZE*SIZE*4);
      const original=createStylizedSurfaceTexture(),source=original.image.data as Uint8Array;
      for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
        const u=THREE.MathUtils.clamp((x%TILE-MARGIN)/(TILE-2*MARGIN-1),0,1),v=THREE.MathUtils.clamp((y%TILE-MARGIN)/(TILE-2*MARGIN-1),0,1);
        const chart=(Math.floor(x/TILE)+4*Math.floor(y/TILE)) as MechanicalPaintChart,aspect=mechanicalPaintAspect(chart);
        const originalU=(u-.5)*Math.min(aspect,1)+.5,originalV=(v-.5)*Math.min(1/aspect,1)+.5;
        const from=(Math.round(originalU*63)+Math.round(originalV*63)*64)*4;
        neutralPixels.set(source.subarray(from,from+4),(x+y*SIZE)*4);
      }
      original.dispose();
    }
    return neutralPixels;
  }
  if (!pixels) {
    pixels = new Uint8Array(SIZE*SIZE*4);
    for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
      const chart=Math.floor(x/TILE)+4*Math.floor(y/TILE);
      const u=THREE.MathUtils.clamp((x%TILE-MARGIN)/(TILE-2*MARGIN-1),0,1);
      const v=THREE.MathUtils.clamp((y%TILE-MARGIN)/(TILE-2*MARGIN-1),0,1);
      // The deterministic texture grain never uses game randomness.
      const noise=(Math.sin(x*91.713+y*37.173)*43758.5453)%1;
      const value=Math.round(THREE.MathUtils.clamp(paintValue(chart,u,v,noise),0,1)*255);
      const at=(x+y*SIZE)*4;
      pixels[at]=pixels[at+1]=pixels[at+2]=value;
      pixels[at+3]=255;
    }
  }
  return pixels;
}
export function createMechanicalSurfaceTexture(): THREE.DataTexture {
  const texture=new THREE.DataTexture(mechanicalSurfacePixels(),SIZE,SIZE,THREE.RGBAFormat);
  texture.name='Mechanical painted panels';
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

export function mechanicalPaintUv(chart: MechanicalPaintChart, u: number, v: number): [number,number] {
  return [(chart%4*TILE+MARGIN+.5+u*(TILE-2*MARGIN-1))/SIZE,
    (Math.floor(chart/4)*TILE+MARGIN+.5+v*(TILE-2*MARGIN-1))/SIZE];
}

/** Capsule parts already use a fixed instance ordering. Select the authored
 * drawing in the vertex stage using that ordering; the fragment reads once. */
export function capsulePaintUv(parts: 6 | 8, lid: MechanicalPaintChart) {
  const part=float(instanceIndex).mod(parts);
  const face=attribute('normal','vec3').y.abs().greaterThan(.5);
  const lidChart=face.select(lid,mechanicalPaint.rim);
  const chart=parts===8
    ? part.equal(0).select(mechanicalPaint.panel,
      part.equal(1).select(mechanicalPaint.rim,
        part.lessThan(4).select(mechanicalPaint.vent,
          part.lessThan(6).select(lidChart,mechanicalPaint.glass))))
    : part.equal(0).select(mechanicalPaint.panel,
      part.lessThan(3).select(mechanicalPaint.vent,
        part.equal(3).select(mechanicalPaint.rim,lidChart)));
  const tile=vec2(chart.mod(4),chart.div(4).floor()).mul(TILE);
  // These four capsule recipes have diagonal, positive scales in their
  // existing instance transforms. Read the original normal, before hinges
  // or yaw change normalLocal; BoxGeometry's U/V axes are Z/Y, X/Z, X/Y.
  const n=attribute('normal','vec3').abs(),sx=attribute('boxMatrix0','vec4').x,sy=attribute('boxMatrix1','vec4').y,sz=attribute('boxMatrix2','vec4').z;
  const width=n.x.greaterThan(.5).select(sz,sx),height=n.y.greaterThan(.5).select(sz,sy);
  const reference=chart.equal(lid).select(mechanicalPaintAspect(lid),parts===8?chart.equal(mechanicalPaint.glass).select(mechanicalPaintAspect(mechanicalPaint.glass),1):float(1));
  const relativeWidth=width.div(reference),longest=relativeWidth.max(height).max(1e-6);
  const span=vec2(relativeWidth,height).div(longest);
  const panelUv=uv().sub(.5).mul(span).add(.5);
  return varying(tile.add(MARGIN+.5).add(panelUv.mul(TILE-2*MARGIN-1)).div(SIZE));
}
