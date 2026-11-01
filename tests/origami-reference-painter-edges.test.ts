import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {GouacheCardboardPainter} from '../src/render/origami/reference-painter';
import {applyReferenceWearScale,createReferenceEdgeGeometry,referenceEdgeVisuals} from '../src/render/origami/reference-edges';

const hash=(s:string)=>createHash('sha256').update(s.replace(/\s+/g,'')).digest('hex');

describe('literal Atelier gouache and physical edge reference',()=>{
  it('keeps the entire supplied painter algorithm byte-identical apart from types and whitespace',()=>{
    let source=readFileSync(new URL('../src/render/origami/reference-painter.ts',import.meta.url),'utf8');
    // The optional capture side channel only reads existing canvases. Remove
    // exactly its three declared hooks; keep the original source hash oracle.
    for(const hook of [
      "        referencePaintCapture.get(this)?.('paper', colorCanvas, bumpCanvas); // Read-only separation hook.",
      "        referencePaintCapture.get(this)?.('pigment', paintCanvas, paintBumpCanvas); // Read-only separation hook.",
      "          referencePaintCapture.get(this)?.('coverage', maskCanvas); // Read-only separation hook.",
    ]){expect(source.split(hook)).toHaveLength(2);source=source.replace(`${hook}\n`,'');}
    source=source.slice(source.indexOf('export class GouacheCardboardPainter {'))
      .replace('export class GouacheCardboardPainter {','class GouacheCardboardPainter {')
      .replace('      seed: number;\n','').replace('      edgeWearAmount: number;\n','').replace('      fillImperfectionAmount: number;\n','')
      .replace('randRange(min: number, max: number)','randRange(min, max)')
      .replace('varyColor(hexColor: string, hueShift','varyColor(hexColor, hueShift')
      .replace('drawGouacheStroke(ctx: CanvasRenderingContext2D, bumpCtx: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, angle: number, colorHex: string, options: ReferenceStrokeOptions = {})','drawGouacheStroke(ctx, bumpCtx, x, y, length, width, angle, colorHex, options = {})')
      .replace('createGouacheMaterialSet(config: ReferencePaintConfig)','createGouacheMaterialSet(config)')
      .replaceAll(".getContext('2d')!;",".getContext('2d');");
    expect(hash(source)).toBe('48ebae84f54c06c4578048d098439f1b01b85bab331990f7f50fd4390e280e5d');
  });

  it('keeps the original physical skirt arithmetic and triangle/UV emission',()=>{
    let source=readFileSync(new URL('../src/render/origami/reference-edges.ts',import.meta.url),'utf8');
    source=source.slice(source.indexOf('export function createPhysicalEdgeWearGeometry('),source.indexOf('      return wearGeo;'))
      .replace('export function createPhysicalEdgeWearGeometry(nonIndexedGeo: THREE.BufferGeometry, edgesGeo: THREE.BufferGeometry, wearScale = 0.75): THREE.BufferGeometry | null','function createPhysicalEdgeWearMesh(nonIndexedGeo, edgesGeo)')
      .replace('const vKey = (x: number, y: number, z: number)','const vKey = (x, y, z)')
      .replace('const eKey = (k1: string, k2: string)','const eKey = (k1, k2)')
      .replace('      for (let i = 0; i < livePosArray.length; i++) {','      const wearScale = currentEdgeWearPct / 100;\n      for (let i = 0; i < livePosArray.length; i++) {');
    expect(hash(source)).toBe('641758573a929ef8861aa658039afa3e46b2fb3aa4dc862ae87c22e03c76b310');
  });

  it('retains reference RNG initialization without a global random source',()=>{
    const painter=new GouacheCardboardPainter();
    expect(painter.seed).toBe(1337);
    expect(painter.edgeWearAmount).toBe(.75);
    expect(painter.fillImperfectionAmount).toBe(.60);
    const first=painter.random();
    expect(painter.seed).toBe(1337+0x6d2b79f5);
    painter.seed=1337;
    expect(painter.random()).toBe(first);
  });

  it('emits six face-coplanar wear vertices per sharp face edge, without triangulation diagonals',()=>{
    const input=new THREE.BoxGeometry(1,1,1);
    const {surface,lines,wear}=createReferenceEdgeGeometry(input);
    expect(lines.getAttribute('position').count).toBe(24);
    expect(wear).not.toBeNull();
    expect(wear!.getAttribute('position').count).toBe(144);
    const {basePosArray,expandDirArray}=wear!.userData as {basePosArray:Float32Array;expandDirArray:Float32Array};
    const normals=wear!.getAttribute('normal');
    for(let i=0;i<normals.count;i++){
      expect(expandDirArray[i*3]*normals.getX(i)+expandDirArray[i*3+1]*normals.getY(i)+expandDirArray[i*3+2]*normals.getZ(i)).toBeCloseTo(0,7);
    }
    applyReferenceWearScale(wear!,0);
    expect(Array.from(wear!.getAttribute('position').array)).toEqual(Array.from(basePosArray));
    applyReferenceWearScale(wear!,1);
    for(let i=0;i<basePosArray.length;i++)expect(wear!.getAttribute('position').array[i]).toBeCloseTo(basePosArray[i]+expandDirArray[i],6);
    surface.dispose();lines.dispose();wear!.dispose();input.dispose();
  });

  it('uses the exact reference edge/fill coupling and percentage visibility thresholds',()=>{
    const v=referenceEdgeVisuals();
    expect(v.contourSpan).toBeCloseTo(.6675,10);
    expect(v.lineOpacity).toBeCloseTo(.65*(1-.6675*.45),10);
    expect(v.wearOpacity).toBeCloseTo(.65*1.25*.69,10);
    expect(v.showLines).toBe(true);expect(v.showWear).toBe(true);
    expect(referenceEdgeVisuals(.01,1,1).showLines).toBe(false);
    expect(referenceEdgeVisuals(1,.01,1).showWear).toBe(false);
    expect(referenceEdgeVisuals(1,1,.01).showWear).toBe(false);
    expect(referenceEdgeVisuals(1,1,0).contourSpan).toBe(.2);
  });
});
