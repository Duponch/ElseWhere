import {it,expect} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction';
import {roofSurfaceCells,roofSlabGeometry} from '../src/render/RoofLayer';
import {EnvironmentLightField} from '../src/render/EnvironmentLightField';
import {designationPreviewIconInstances} from '../src/render/DesignationIconLayer';
import {roofCoverage,roofKindAt} from '../src/sim/roof-rules';
import {mapHoverLines} from '../src/ui/map-hover-readout';
const prepared=()=>{const w=deconstructionCamp();w.roofing={constructed:[],build:[],remove:[],cursor:0,natural:{thin:[330],thick:[331]}};return w;};
it('draws both real natural types through the same continuous slab without an interior wall',()=>{
 const w=prepared();expect(roofCoverage(w)).toEqual([330,331]);expect(roofSurfaceCells(w)).toEqual([{x:10,z:10},{x:11,z:10}]);
 const old=roofSlabGeometry([{x:10,z:10},{x:11,z:10}],2),current=roofSlabGeometry(roofSurfaceCells(w),2,c=>roofKindAt(w,c.z*w.width+c.x));
 expect(current.getAttribute('position').count).toBe(old.getAttribute('position').count);expect(Array.from(current.getAttribute('color').array)).not.toEqual(Array.from(old.getAttribute('color').array));old.dispose();current.dispose();
 // Core RoofRockThin / RoofRockThick labels (interactions note).
 expect(mapHoverLines(w,{x:10,z:10},0)).toContain('Toit de roche mince');expect(mapHoverLines(w,{x:11,z:10},0)).toContain('Montagne au-dessus');
});
it('reconciles light coverage from real primitive changes including same-array edits',()=>{
 const w=prepared(),field=new EnvironmentLightField();expect(field.update(w)).toBe(true);expect(field.data[330*4+1]).toBe(255);expect(field.data[331*4+1]).toBe(255);
 w.roofing!.natural!.thin.length=0;expect(field.update(w)).toBe(true);expect(field.data[330*4+1]).toBe(0);expect(field.data[331*4+1]).toBe(255);
});
it('offers remove preview for thin, never for natural-thick, without removing either roof',()=>{
 const w=prepared(),before=JSON.stringify(w.roofing),icons=designationPreviewIconInstances(w,'remove-roof',[330,331]);expect(icons).toHaveLength(1);expect(icons[0]).toMatchObject({x:10,z:10});expect(JSON.stringify(w.roofing)).toBe(before);
});
