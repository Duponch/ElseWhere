import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {footprintCells} from '../src/sim/definitions';
import {bedSlotBodyCenter,bedSlotCell} from '../src/sim/bed-slots';
import {applyCommand} from '../src/sim/engine';
import type {Structure,World} from '../src/sim/types';
import {sleepingSpotPartsForStructure} from '../src/render/sleeping-spot-parts';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {designationPreviewIconInstances} from '../src/render/DesignationIconLayer';
import {PawnLayer} from '../src/render/PawnLayer';
import {clearGroup} from '../src/render/primitives';
import {WORLD_SCALE} from '../src/world/scale';
import {readFirstDayGuide} from '../src/ui/first-day-guide';
import {mapObjectActions,mapObjectGroupActions} from '../src/ui/map-object-actions';
import {toolDefinitions} from '../src/ui/layout';
import {placementMaterial} from '../src/ui/construction-controls';
import {ARCHITECT_ICON_URLS} from '../src/ui/architect-icons';
import {deconstructionCamp} from './scenarios/deconstruction';

const spot=(w:World,orientation:0|1|2|3=0):Structure=>({id:w.nextId++,kind:'sleeping-spot',x:10,z:10,orientation,footprint:'standard'});
const beds=(w:World)=>readFirstDayGuide(w).find(row=>row.id==='beds')!;

test.each([0,1,2,3] as const)('floor marks and ghost stay on the actual two-cell footprint at orientation %i',orientation=>{
  const w=deconstructionCamp(),s=spot(w,orientation);w.structures=[s];
  const before=structuredClone(w),parts=sleepingSpotPartsForStructure(s),cells=footprintCells(s);
  expect(cells).toHaveLength(2);expect(parts.length).toBeLessThanOrEqual(11);expect(parts.length).toBeGreaterThan(0);
  for(const part of parts){
    const c=Math.abs(Math.cos(part.ry!)),sin=Math.abs(Math.sin(part.ry!));
    const hx=(c*part.sx!+sin*part.sz!)/2,hz=(sin*part.sx!+c*part.sz!)/2;
    expect(part.x-hx).toBeGreaterThanOrEqual(Math.min(...cells.map(cell=>cell.x))-.5);
    expect(part.x+hx).toBeLessThanOrEqual(Math.max(...cells.map(cell=>cell.x))+.5);
    expect(part.z-hz).toBeGreaterThanOrEqual(Math.min(...cells.map(cell=>cell.z))-.5);
    expect(part.z+hz).toBeLessThanOrEqual(Math.max(...cells.map(cell=>cell.z))+.5);
    expect(part.y-part.sy!/2).toBeGreaterThanOrEqual(0);expect(part.y+part.sy!/2).toBeLessThan(.04);
    expect(part.targetId).toBe(s.id);
  }
  const preview=constructionPreviewParts(w,[{kind:s.kind,x:s.x,z:s.z,orientation}]);
  const visual=({key:_key,targetId:_id,...value}:typeof parts[number])=>value;
  expect(preview.boxes.map(visual)).toEqual(parts.map(visual));expect(w).toEqual(before);
});

test.each([0,1,2,3] as const)('lying person remains at the real centre and ground height at orientation %i',orientation=>{
  const w=deconstructionCamp(),s=spot(w,orientation),p=w.pawns[0]!,head=bedSlotCell(s,0)!,center=bedSlotBodyCenter(s,0)!;
  w.structures=[s];Object.assign(p,head);p.bedId=s.id;p.motion=null;
  p.need={kind:'sleep',phase:'sleep',bedId:s.id,target:head};
  const layer=new PawnLayer();
  try {
    for(const state of ['sleeping','resting','downed'] as const){
      p.state=state;const before=structuredClone(w);layer.update(w,1,true);
      const to=layer.feedbackSource!.getAttribute('aTo') as THREE.InstancedBufferAttribute;
      expect(to.getX(0)).toBe(center.x);expect(to.getZ(0)).toBe(center.z);expect(to.getY(0)).toBe(0);
      expect(Math.sin(to.getW(0))).toBeCloseTo(Math.sin(orientation*Math.PI/2),6);
      expect(Math.cos(to.getW(0))).toBeCloseTo(Math.cos(orientation*Math.PI/2),6);expect(w).toEqual(before);
    }
    p.state='sleeping';s.kind='bed';layer.update(w,1,true);
    expect((layer.feedbackSource!.getAttribute('aTo') as THREE.InstancedBufferAttribute).getY(0)).toBeCloseTo(WORLD_SCALE.bedSurfaceHeight,6);
    w.structures=[];layer.update(w,1,true);
    expect((layer.feedbackSource!.getAttribute('aTo') as THREE.InstancedBufferAttribute).getY(0)).toBe(0);
  }finally{clearGroup(layer.group);}
});

test('civil floor places count without HP, exclude medical/prison roles and preserve the confirmed world',()=>{
  const w=deconstructionCamp(3);
  for(const x of [8,10,12])expect(applyCommand(w,{type:'designate',kind:'sleeping-spot',x,z:8,orientation:0}).ok).toBe(true);
  const before=structuredClone(w);expect(beds(w)).toMatchObject({status:'ready',detail:'3 place(s) civile(s) compatibles pour 3 colon(s).'});
  expect(beds(w).body).toContain('gratuits et immédiats');expect(beds(w).body).toContain('ne crée pas d’abri');expect(w).toEqual(before);
  w.structures[0]!.medical=true;w.structures[1]!.prisoner=true;
  expect(beds(w)).toMatchObject({status:'started',detail:'1 place(s) civile(s) compatibles pour 3 colon(s).'});
  w.pawns[0]!.faction='outlanders';w.pawns[0]!.bedId=w.structures[2]!.id;
  expect(beds(w)).toMatchObject({status:'missing',detail:'0 place(s) civile(s) compatibles pour 2 colon(s).'});
});

test('inspection removes exact floor owners immediately and groups mixed buildings honestly',()=>{
  const w=deconstructionCamp(),a=spot(w),b={...spot(w),x:14};w.structures=[a,b];
  const action=mapObjectActions(w,{kind:'structure',id:a.id}).find(action=>action.id==='deconstruct')!;
  expect(action.label).toBe('Retirer l’emplacement');expect(action.command).toBeDefined();expect(action.command).toMatchObject({type:'designate',kind:'deconstruct',targetId:a.id});
  const both=mapObjectGroupActions(w,[{kind:'structure',id:a.id},{kind:'structure',id:b.id}]);
  expect(both[0]!.label).toBe('Retirer l’emplacement');expect(both[0]!.commands).toHaveLength(2);
  b.kind='bed';expect(mapObjectGroupActions(w,[{kind:'structure',id:a.id},{kind:'structure',id:b.id}])[0]!.label).toBe('Déconstruire');
  const cells=footprintCells(a).map(c=>c.z*w.width+c.x);
  expect(designationPreviewIconInstances(w,'deconstruct',cells)).toEqual([]);
  expect(applyCommand(w,action.command!).ok).toBe(true);expect(w.structures.some(s=>s.id===a.id)).toBe(false);expect(w.jobs).toEqual([]);
});

test('Architecte offers an immediate human floor place with no material selector and its original model portrait',()=>{
  expect(toolDefinitions.find(tool=>tool.id==='sleeping-spot')).toMatchObject({title:'Couchage au sol',category:'furniture'});
  expect(placementMaterial('sleeping-spot','wood')).toBeUndefined();
  expect(ARCHITECT_ICON_URLS['sleeping-spot']).toBe('/assets/ui/elsewhere/pictograms-20261107/sleeping-spot.svg');
});
