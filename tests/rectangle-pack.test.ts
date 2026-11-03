/** Pure bounded packing contract. No tmp fixture, geometry, pixels or GPU. */
import {expect,test} from 'vitest';
import {packMaxRectsNoRotation,type PackRect,type MaxRectsResult} from '../src/render/origami/baked/rectangle-pack';

function assertLayout(input:readonly PackRect[],layout:MaxRectsResult,quantum:number):void{
  expect(layout.placements).toHaveLength(input.length);expect(new Set(layout.placements.map(r=>r.id)).size).toBe(input.length);
  for(const r of layout.placements){
    const original=input.find(s=>s.id===r.id);expect(original).toBeDefined();expect([r.width,r.height]).toEqual([original!.width,original!.height]);
    expect(r.x%quantum).toBe(0);expect(r.y%quantum).toBe(0);expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(layout.width);expect(r.y+r.height).toBeLessThanOrEqual(layout.height);
  }
  for(let i=0;i<layout.placements.length;i++)for(let j=0;j<i;j++){
    const a=layout.placements[i]!,b=layout.placements[j]!;
    expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);
  }
}

test('nonrotating fallback is bounded, deterministic and immutable; no-fit never returns a partial layout',()=>{
  const rectangles=Object.freeze([{id:0,width:16,height:32},{id:1,width:16,height:16},{id:2,width:16,height:16}].map(r=>Object.freeze(r))),before=JSON.stringify(rectangles),limits={width:32,height:32,quantum:8,maxPixels:1024};
  const result=packMaxRectsNoRotation(rectangles,limits);expect(result).toBeDefined();assertLayout(rectangles,result!,8);
  expect(result!.occupiedPixels).toBe(1024);expect(result!.facts).toMatchObject({heuristic:'best-short-side-fit',rotated:false,resized:false});expect(result!.facts.workChecks).toBeGreaterThan(result!.facts.candidateChecks);expect(result!.facts.workChecks).toBeLessThanOrEqual(8_000_000);
  expect(packMaxRectsNoRotation([...rectangles].reverse(),limits)?.placements).toEqual(result!.placements);expect(JSON.stringify(rectangles)).toBe(before);
  expect(()=>packMaxRectsNoRotation(rectangles,{...limits,maxPixels:1023})).toThrow(/budget/);
  expect(()=>packMaxRectsNoRotation([{id:0,width:10,height:8}],limits)).toThrow(/alignment/);
  expect(()=>packMaxRectsNoRotation([{id:0,width:40,height:8}],limits)).toThrow(/dimension/);
  expect(()=>packMaxRectsNoRotation([{id:0,width:8,height:8},{id:0,width:8,height:8}],limits)).toThrow(/duplicate/);
  expect(()=>packMaxRectsNoRotation(rectangles,{...limits,maxRectangles:2})).toThrow(/count/);
  expect(()=>packMaxRectsNoRotation(rectangles,{...limits,maxWorkChecks:1})).toThrow(/work/);
  expect(()=>packMaxRectsNoRotation(rectangles,{...limits,maxWorkChecks:8_000_001})).toThrow(/hard preparation/);
  expect(()=>packMaxRectsNoRotation([{id:0,width:8,height:8}],{...limits,maxExpandedFreeRectangles:1})).toThrow(/BEFORE prune/);
  // Each rectangle and the combined area fit, but these two shapes cannot
  // coexist without overlap. An area lower bound is not a packing proof.
  const impossible=Object.freeze([{id:0,width:24,height:24},{id:1,width:16,height:16}].map(r=>Object.freeze(r))),impossibleBefore=JSON.stringify(impossible);
  expect(packMaxRectsNoRotation(impossible,limits)).toBeUndefined();expect(JSON.stringify(impossible)).toBe(impossibleBefore);expect(JSON.stringify(rectangles)).toBe(before);
});
