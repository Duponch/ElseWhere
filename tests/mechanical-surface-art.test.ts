import {describe, expect, it} from 'vitest';
import {createMechanicalSurfaceTexture, mechanicalPaint, mechanicalPaintUv} from '../src/render/mechanical-surface-art';
import {scytherGeometry, SCYTHER_VISUAL_PARTS} from '../src/render/scyther-geometry';
import {rangedMechGeometry, LANCER_VISUAL_PARTS, PIKEMAN_VISUAL_PARTS} from '../src/render/ranged-mech-geometry';
import {mechanoidPartIndex} from '../src/sim/mechanoid-presentation';

describe('authored mechanical panel paintings', () => {
  it('uses distinct guarded drawings, shared pixels, and normal disposable texture owners', () => {
    const first=createMechanicalSurfaceTexture(), second=createMechanicalSurfaceTexture();
    try {
      const {data,width,height}=first.image;
      expect([width,height,data?.length]).toEqual([128,128,128*128*4]);
      expect(data).toBe(second.image.data);
      const contents=new Set<string>();
      for(const chart of Object.values(mechanicalPaint)){
        const [a,b]=mechanicalPaintUv(chart,0,0),[c,d]=mechanicalPaintUv(chart,1,1);
        const x0=Math.floor(a*128),y0=Math.floor(b*128),x1=Math.floor(c*128),y1=Math.floor(d*128);
        expect(Math.floor(x0/32)).toBe(Math.floor(x1/32));
        expect(Math.floor(y0/32)).toBe(Math.floor(y1/32));
        const values:number[]=[];
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)values.push(data![(x+y*128)*4]!);
        expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(25);
        contents.add(values.join(','));
      }
      expect(contents.size).toBe(16);
      first.dispose();
      expect(second.image.data).toBe(data);
    }finally{first.dispose();second.dispose();}
  });

  it('addresses complete boxes on the three unchanged resident models', () => {
    for(const [kind,parts] of [
      ['scyther',SCYTHER_VISUAL_PARTS],['lancer',LANCER_VISUAL_PARTS],['pikeman',PIKEMAN_VISUAL_PARTS],
    ] as const){
      const index=(name:string)=>mechanoidPartIndex(kind,name);
      const geometry=kind==='scyther'?scytherGeometry(8,index):rangedMechGeometry(kind,8,index);
      try {
        const uv=geometry.getAttribute('uv'), positions=geometry.getAttribute('position');
        expect(positions.count).toBe(parts.length*36);
        expect(uv.count).toBe(positions.count);
        const charts=new Set<number>();
        for(let at=0;at<uv.count;at+=6){
          const faceChart=Math.floor(uv.getX(at)*4)+4*Math.floor(uv.getY(at)*4);
          for(let i=at;i<at+6;i++)expect(Math.floor(uv.getX(i)*4)+4*Math.floor(uv.getY(i)*4)).toBe(faceChart);
          charts.add(faceChart);
        }
        expect(charts.size).toBeGreaterThanOrEqual(6);
        expect(geometry.getAttribute('aFrom').count).toBe(8);
      }finally{geometry.dispose();}
    }
  });
});
