import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {shipReactorWorkshop275} from './scenarios/ship-reactor-v451.ts';
import {shipReactorCells275,shipReactorRect275} from '../src/sim/ship-reactor-content-275.ts';
import {shipReactorEndCore275} from '../src/sim/ship-reactor-state-275.ts';
import {shipReactorParts275} from '../src/render/ship-reactor-parts275';
import {electricalParts} from '../src/render/electrical-parts';
import {buildFurniture} from '../src/render/FurnitureLayer';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {buildJobMarkers} from '../src/render/JobLayer';
import {StructurePresentationSignature} from '../src/render/presentation-signatures';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';
import {captureWorldShotGrid} from '../src/sim/combat-world.ts';
import {canStandAt} from '../src/sim/furniture-travel.ts';
import {blockedCells} from '../src/sim/pathfinding.ts';
import {mapObjectsAt} from '../src/ui/map-object-selection';
import {shipReactorInspectionText275} from '../src/ui/ship-reactor-inspection-275';
import {ARCHITECT_ICON_URLS,ARCHITECT_ICON_MAPPING} from '../src/ui/architect-icons';
import {modelIconUrl} from '../src/ui/pictograms';
import {placementMaterial} from '../src/ui/construction-controls';
import {toolDefinitions} from '../src/ui/layout';
import type {BoxBatches} from '../src/render/BoxBatches';
import type {Placement} from '../src/render/primitives';
import type {Orientation,Structure} from '../src/sim/types.ts';

/** Authored-model fixtures only, independent of the real paid construction
 * test. No renderer, WebGPU device, screenshot or frame rate is asserted. */
function fixture(orientation:Orientation=1){
 const {w}=shipReactorWorkshop275();w.pawns=[];w.piles=[];w.packed=[];w.jobs=[];
 const reactor:Structure={id:w.nextId++,kind:'ship-reactor',x:20,z:20,orientation,footprint:'standard',material:'steel',power:{on:true,parentId:null}};w.structures=[reactor];
 return {w,reactor};
}
const shape=({key:_key,targetId:_target,...p}:Placement)=>p;

test.each([0,1,2,3] as const)('rotation%i shares bounded original opaque machinery, selection and full physical occupancy',orientation=>{
 const {w,reactor}=fixture(orientation),before=structuredClone(w),parts=shipReactorParts275(reactor),rect=shipReactorRect275(reactor,orientation);
 expect(parts.length).toBeGreaterThan(25);expect(parts.length).toBeLessThanOrEqual(40);
 for(const p of parts){
  expect(p.key).toBe(reactor.id);expect(p.targetId).toBe(reactor.id);
  for(const k of ['x','y','z','sx','sy','sz','ry'] as const)expect(Number.isFinite(p[k]??0)).toBe(true);
  const rx=Math.abs(Math.cos(p.ry??0))*(p.sx??1)/2+Math.abs(Math.sin(p.ry??0))*(p.sz??1)/2;
  const rz=Math.abs(Math.sin(p.ry??0))*(p.sx??1)/2+Math.abs(Math.cos(p.ry??0))*(p.sz??1)/2;
  expect(p.x-rx).toBeGreaterThanOrEqual(rect.x-.5);expect(p.x+rx).toBeLessThanOrEqual(rect.x+rect.width-.5);
  expect(p.z-rz).toBeGreaterThanOrEqual(rect.z-.5);expect(p.z+rz).toBeLessThanOrEqual(rect.z+rect.depth-.5);
 }
 expect(electricalParts(w)).toEqual(parts);
 const preview=constructionPreviewParts(w,[{kind:'ship-reactor',x:reactor.x,z:reactor.z,orientation,material:'steel'}]);
 expect(preview.boxes.map(shape)).toEqual(parts.map(shape));expect(preview.rotatedBoxes).toEqual([]);
 const calls:{name:string;parts:Placement[];style?:string}[]=[],group=new THREE.Group();
 buildFurniture(w,group,false,{set:(_group:THREE.Group,name:string,value:Placement[],style?:string)=>calls.push({name,parts:value,style})} as unknown as BoxBatches);
 const batch=calls.find(c=>c.name==='furniture')!;expect(batch.parts.filter(p=>p.targetId===reactor.id)).toEqual(parts);expect(batch.style??'solid').toBe('solid');expect(group.children).toHaveLength(0);
 const occupied=blockedCells(w),sight=captureWorldShotGrid(w);
 for(const c of shipReactorCells275(reactor,orientation)){
  expect(occupied[c.z*w.width+c.x]).toBe(1);expect(canStandAt(w,c)).toBe(false);expect(sight.blocksSight(c.x,c.z)).toBe(true);
  expect(mapObjectsAt(w,c)).toContainEqual({kind:'structure',id:reactor.id});
 }
 expect(w).toEqual(before);
});

test('confirmed phase alone changes the machinery and signatures; repeated presentation leaves immutable activation dates and world untouched',()=>{
 const {w,reactor}=fixture(),raw=new StructurePresentationSignature(),confirmed=new ConfirmedStructurePresentationSignature();
 const dormant=shipReactorParts275(reactor),a=raw.read(w.structures,'',''),b=confirmed.readConfirmed(w.structures,'','');expect(a).toBe(b);
 const startCore=w.tick*10,endCore=shipReactorEndCore275(startCore)!;reactor.shipReactor275={state:'starting',startCore,endCore};
 const started=shipReactorParts275(reactor),c=raw.read(w.structures,'',''),d=confirmed.readConfirmed(w.structures,'','',[0]);
 expect(started).toHaveLength(dormant.length);expect(started.map(({color:_color,...p})=>p)).toEqual(dormant.map(({color:_color,...p})=>p));expect(started).not.toEqual(dormant);expect(c).not.toBe(a);expect(c).toBe(d);
 const before=structuredClone(w);for(let i=0;i<3;i++){expect(shipReactorParts275(reactor)).toEqual(started);expect(raw.read(w.structures,'','')).toBe(c);expect(confirmed.readConfirmed(w.structures,'','',[])).toBe(d);}
 expect(w).toEqual(before);expect(reactor.shipReactor275).toEqual({state:'starting',startCore,endCore});
 // Independent presentation-only timing fixture: dates do not own a visual
 // rebuild while the confirmed phase, geometry and electrical inputs agree.
 const dateOnly=structuredClone(reactor);dateOnly.shipReactor275!.startCore+=10;dateOnly.shipReactor275!.endCore+=10;
 expect(raw.read([dateOnly],'','')).toBe(c);expect(confirmed.readConfirmed([dateOnly],'','',[0])).toBe(d);
 expect(shipReactorParts275(dateOnly)).toEqual(started);
 const running=structuredClone(reactor);running.shipReactor275!.state='running';
 expect(shipReactorParts275(running)).toHaveLength(started.length);expect(shipReactorParts275(running)).not.toEqual(started);
 expect(raw.read([running],'','')).not.toBe(c);expect(confirmed.readConfirmed([running],'','',[0])).toBe(raw.read([running],'',''));
});

test('the actual oriented42-cell plan marker, menu material, original icon and phase text expose the same reactor',()=>{
 const {w,reactor}=fixture();w.structures=[];
 w.jobs=[{id:w.nextId++,kind:'ship-reactor',x:reactor.x,z:reactor.z,orientation:reactor.orientation,footprint:'standard',material:'steel',construction:'blueprint',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}}];
 const captures=new Map<string,Placement[]>();buildJobMarkers(w,new THREE.Group(),false,{set:(_g:THREE.Group,name:string,value:Placement[])=>captures.set(name,value)} as unknown as BoxBatches);
 expect(captures.get('job-orders')).toHaveLength(42);expect(captures.get('job-plans')).toEqual([expect.objectContaining({x:20,z:19.5,y:1.55,sx:5.86,sy:3.10,sz:6.86,ry:Math.PI/2})]);
 expect(placementMaterial('ship-reactor','wood')).toBe('steel');expect(toolDefinitions.find(t=>t.id==='ship-reactor')).toMatchObject({category:'ship',title:'Réacteur stellaire'});
 const icon=modelIconUrl('ship-reactor');expect(icon).toBe(ARCHITECT_ICON_URLS['ship-reactor']);expect(icon).toBe('/assets/ui/elsewhere/pictograms-20261107/ship-reactor.svg');expect(ARCHITECT_ICON_MAPPING['ship-reactor']).toEqual(ARCHITECT_ICON_MAPPING['geothermal-generator']);
 expect(shipReactorInspectionText275(w,reactor)).toContain('veille');expect(shipReactorInspectionText275(w,reactor)).toContain('1 000 W');
 reactor.shipReactor275={state:'starting',startCore:w.tick*10,endCore:shipReactorEndCore275(w.tick*10)!};expect(shipReactorInspectionText275(w,reactor)).toContain('14,0 jours');
 reactor.shipReactor275.state='running';expect(shipReactorInspectionText275(w,reactor)).toContain('opérationnel');
});
