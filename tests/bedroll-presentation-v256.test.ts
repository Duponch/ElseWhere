import {expect,test} from 'vitest';
import {bedrollPartsForStructure,packedBedrollParts,BEDROLL_SURFACE_HEIGHT} from '../src/render/bedroll-parts';
import {footprintCells} from '../src/sim/definitions';
import {modelIconUrl} from '../src/ui/pictograms';
import type {Structure} from '../src/sim/types';
test('bedroll follows actual head/tail footprint in all four orientations with a low sleep surface',()=>{
 for(const orientation of [0,1,2,3] as const){
  const bed={id:301,kind:'bedroll',orientation,footprint:'standard',x:11,z:13,material:'cloth',quality:'good',damage:5} as Structure;
  const before=structuredClone(bed),cells=footprintCells(bed),parts=bedrollPartsForStructure(bed);
  expect(cells).toHaveLength(2);expect(parts).toHaveLength(6);expect(parts.every(p=>p.targetId===bed.id&&p.ry===orientation*Math.PI/2)).toBe(true);
  expect(parts[0]!.x).toBeCloseTo(cells.reduce((n,c)=>n+c.x,0)/2);expect(parts[0]!.z).toBeCloseTo(cells.reduce((n,c)=>n+c.z,0)/2);
  expect(BEDROLL_SURFACE_HEIGHT).toBeLessThan(.2);expect(bed).toEqual(before);
 }
});
test('minified bedroll uses the same real ID, material and supplied shelf transform without mutation',()=>{
 const bed={id:302,kind:'bedroll',orientation:3,footprint:'standard',x:11,z:13,material:'cloth',quality:'excellent',damage:7} as Structure,before=structuredClone(bed);
 const parts=packedBedrollParts(bed,2,4,1,.5);expect(parts).toHaveLength(4);expect(parts.every(p=>p.targetId===302&&p.y>1&&p.sz!<=.24)).toBe(true);expect(bed).toEqual(before);
 expect(modelIconUrl('bedroll')).toBe('/assets/ui/elsewhere/pictograms-20261107/bedroll.svg');
});
