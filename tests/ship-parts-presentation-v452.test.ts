import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {miningCamp} from './scenarios/mining.ts';
import {shipPartCells276,shipPartRect276} from '../src/sim/ship-part-geometry-276.ts';
import {shipHullParts276,SHIP_HULL_MODEL_BOUNDS_276} from '../src/render/ship-hull-parts276';
import {electricalParts} from '../src/render/electrical-parts';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {buildFurniture} from '../src/render/FurnitureLayer';
import {buildJobMarkers} from '../src/render/JobLayer';
import {StructurePresentationSignature} from '../src/render/presentation-signatures';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';
import {modelIconUrl} from '../src/ui/pictograms';
import {ARCHITECT_ICON_MAPPING,ARCHITECT_ICON_URLS} from '../src/ui/architect-icons';
import {placementMaterial} from '../src/ui/construction-controls';
import {toolDefinitions} from '../src/ui/layout';
import type {Orientation,Structure} from '../src/sim/types.ts';
import type {Placement} from '../src/render/primitives';
import type {BoxBatches} from '../src/render/BoxBatches';

/** Authored presentation fixture only. No completed paid object, device,
 * WebGPU renderer, screenshot or FPS result is claimed by these CPU ports. */
function fixture(orientation:Orientation=0){
 const w=miningCamp();w.pawns=[];w.piles=[];w.packed=[];w.jobs=[];
 const beam:Structure={id:w.nextId++,kind:'ship-beam',x:10,z:10,orientation,footprint:'standard',material:'steel',power:{on:false,parentId:null}};
 const engine:Structure={id:w.nextId++,kind:'ship-engine',x:22,z:20,orientation,footprint:'standard',material:'steel',power:{on:false,parentId:null}};
 w.structures=[beam,engine];return {w,beam,engine};
}
const shape=({key:_key,targetId:_target,...p}:Placement)=>p;
test.each([0,1,2,3] as const)('original hull models in rotation%i use the same native center, preview and resident opaque furniture batch',orientation=>{
 const {w,beam,engine}=fixture(orientation),before=structuredClone(w),models:Placement[]=[];
 for(const part of [beam,engine]){
  if(part.kind!=='ship-beam'&&part.kind!=='ship-engine')throw Error('Hull presentation fixture');
  const parts=shipHullParts276(part),rect=shipPartRect276({...part,kind:part.kind}),bounds=SHIP_HULL_MODEL_BOUNDS_276[part.kind];
  expect(parts.length).toBeGreaterThan(12);expect(parts.length).toBeLessThanOrEqual(30);expect(shipPartCells276({...part,kind:part.kind})).toHaveLength(12);
  for(const p of parts){
   expect(p.key).toBe(part.id);expect(p.targetId).toBe(part.id);
   for(const key of ['x','y','z','sx','sy','sz','ry'] as const)expect(Number.isFinite(p[key]??0)).toBe(true);
   const rx=Math.abs(Math.cos(p.ry??0))*(p.sx??1)/2+Math.abs(Math.sin(p.ry??0))*(p.sz??1)/2;
   const rz=Math.abs(Math.sin(p.ry??0))*(p.sx??1)/2+Math.abs(Math.cos(p.ry??0))*(p.sz??1)/2;
   expect(p.x-rx).toBeGreaterThanOrEqual(rect.x-.5);expect(p.x+rx).toBeLessThanOrEqual(rect.x+rect.width-.5);
   expect(p.z-rz).toBeGreaterThanOrEqual(rect.z-.5);expect(p.z+rz).toBeLessThanOrEqual(rect.z+rect.depth-.5);
   expect(p.y+(p.sy??1)/2).toBeLessThanOrEqual(bounds.height+1e-12);
  }
  models.push(...parts);
 }
 expect(electricalParts(w)).toEqual(models);
 const preview=constructionPreviewParts(w,[{kind:'ship-beam',x:beam.x,z:beam.z,orientation,material:'steel'},{kind:'ship-engine',x:engine.x,z:engine.z,orientation,material:'steel'}]);
 expect(preview.boxes.map(shape)).toEqual(models.map(shape));expect(preview.rotatedBoxes).toEqual([]);
 const group=new THREE.Group(),calls=new Map<string,Placement[]>();buildFurniture(w,group,false,{set:(_g:THREE.Group,name:string,value:Placement[])=>calls.set(name,value)} as unknown as BoxBatches);
 expect(calls.get('furniture')).toEqual(models);expect(group.children).toHaveLength(0);expect(w).toEqual(before);
});
test('hull rendering and signatures depend on pose, not the clock, inventory or reactor lifecycle',()=>{
 const {w,beam}=fixture(),raw=new StructurePresentationSignature(),confirmed=new ConfirmedStructurePresentationSignature();
 const a=raw.read(w.structures,'',''),b=confirmed.readConfirmed(w.structures,'',''),model=shipHullParts276(beam);expect(a).toBe(b);
 const later=structuredClone(w);later.tick+=10;
 expect(raw.read(later.structures,'','')).toBe(a);expect(confirmed.readConfirmed(later.structures,'','',[])).toBe(b);expect(shipHullParts276(later.structures[0]!)).toEqual(model);
 later.structures[0]!.orientation=1;
 expect(raw.read(later.structures,'','')).not.toBe(a);expect(confirmed.readConfirmed(later.structures,'','',[0])).toBe(raw.read(later.structures,'',''));
 expect(shipHullParts276(later.structures[0]!)).not.toEqual(model);expect(beam).not.toHaveProperty('shipReactor275');
});
test('both12-cell paid-frame markers and original menu images retain the fixed material and historical UVs',()=>{
 const {w,beam,engine}=fixture();w.structures=[];
 w.jobs=[beam,engine].map(s=>({id:s.id,kind:s.kind as 'ship-beam'|'ship-engine',x:s.x,z:s.z,orientation:s.orientation,footprint:'standard' as const,material:'steel' as const,construction:'frame' as const,status:'pending' as const,reservedBy:null,progress:0,escrow:{wood:0,food:0}}));
 const calls=new Map<string,Placement[]>();buildJobMarkers(w,new THREE.Group(),false,{set:(_g:THREE.Group,name:string,value:Placement[])=>calls.set(name,value)} as unknown as BoxBatches);
 expect(calls.get('job-orders')).toHaveLength(24);expect(calls.get('job-plans')).toHaveLength(2);expect(calls.get('job-solids')).toHaveLength(8);
 for(const s of [beam,engine]){
  if(s.kind!=='ship-beam'&&s.kind!=='ship-engine')throw Error('Hull fixture');
  const rect=shipPartRect276({...s,kind:s.kind}),model=SHIP_HULL_MODEL_BOUNDS_276[s.kind];
  expect(calls.get('job-plans')!.find(p=>p.targetId===s.id)).toMatchObject({x:rect.x+(rect.width-1)/2,z:rect.z+(rect.depth-1)/2,sx:model.width,sy:model.height,sz:model.depth});
  expect(placementMaterial(s.kind,'wood')).toBe('steel');expect(toolDefinitions.find(t=>t.id===s.kind)).toMatchObject({category:'ship'});
  const icon=modelIconUrl(s.kind);expect(icon).toBe(ARCHITECT_ICON_URLS[s.kind]);expect(icon).toBe(`/assets/ui/elsewhere/pictograms-20261107/${s.kind}.svg`);
 }
 expect(modelIconUrl('ship-beam')).not.toBe(modelIconUrl('ship-engine'));expect(modelIconUrl('ship-engine')).not.toBe(modelIconUrl('ship-reactor'));
 expect(ARCHITECT_ICON_MAPPING['ship-beam']).toEqual(ARCHITECT_ICON_MAPPING.wall);expect(ARCHITECT_ICON_MAPPING['ship-engine']).toEqual(ARCHITECT_ICON_MAPPING['solar-generator']);
});
