import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {deconstructionCamp} from './scenarios/deconstruction';
import {bridgePartsForCell} from '../src/render/bridge-parts';
import {HygieneLayer} from '../src/render/HygieneLayer';
import type {BoxBatches} from '../src/render/BoxBatches';
import type {Placement} from '../src/render/primitives';
import {FLOOR_SURFACE_Y,surfaceHeightAtCell} from '../src/render/surface-height';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {pawnWorkPose,WORK_POSE} from '../src/render/work-presentation';
import {terrainInspection} from '../src/ui/terrain-inspection';
import {mapHoverLines} from '../src/ui/map-hover-readout';
import {mapObjectsAt} from '../src/ui/map-object-selection';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {ARCHITECT_ICON_URLS,ARCHITECT_ICON_MAPPING} from '../src/ui/architect-icons';
import {placementMaterial} from '../src/ui/construction-controls';
import {buildJobMarkers} from '../src/render/JobLayer';
import {ConstructionGhosts} from '../src/render/construction-ghosts';
import type {Job} from '../src/sim/types';

test('V387 original continuous deck stays inside its cell and shares the floor support height',()=>{
  const parts=bridgePartsForCell(8,8);expect(parts).toHaveLength(6);
  for(const p of parts){expect([p.x,p.y,p.z,p.sx,p.sy,p.sz].every(Number.isFinite)).toBe(true);
    expect(p.x-p.sx!/2).toBeGreaterThanOrEqual(7.5);expect(p.x+p.sx!/2).toBeLessThanOrEqual(8.5);
    expect(p.z-p.sz!/2).toBeGreaterThanOrEqual(7.5);expect(p.z+p.sz!/2).toBeLessThanOrEqual(8.5);
    expect(p.y+p.sy!/2).toBeLessThanOrEqual(FLOOR_SURFACE_Y+.000001);}
  const boards=parts.slice(0,4);expect(boards.reduce((n,p)=>n+p.sx!,0)).toBe(1);
  for(const p of boards)expect(p.y+p.sy!/2).toBeCloseTo(FLOOR_SURFACE_Y,10);
});

test('V387 changed tile snapshots update the existing resident surface batch and clear it on removal',()=>{
  const w=deconstructionCamp(0),i=8*w.width+8;w.tiles[i]={terrain:'marsh'};
  const calls:{name:string;parts:Placement[]}[]=[],sink={set(_g:THREE.Group,name:string,parts:Placement[]){calls.push({name,parts});}};
  const layer=new HygieneLayer();layer.update(w,sink as unknown as BoxBatches,true);
  calls.length=0;const bridged={...w,tiles:[...w.tiles]};bridged.tiles[i]={terrain:'marsh',bridge:true};
  layer.update(bridged,sink as unknown as BoxBatches);
  expect(calls).toEqual([{name:'hygiene-floors',parts:bridgePartsForCell(8,8)}]);
  expect(surfaceHeightAtCell(bridged,8,8)).toBe(FLOOR_SURFACE_Y);
  calls.length=0;layer.update(bridged,sink as unknown as BoxBatches);expect(calls).toEqual([]);
  layer.update({...w,tiles:[...w.tiles]},sink as unknown as BoxBatches);
  expect(calls).toEqual([{name:'hygiene-floors',parts:[]}]);expect(surfaceHeightAtCell(w,8,8)).toBe(0);layer.dispose();
});

test('V387 bridge hover keeps the underlying marsh, fertility and light-only support without selecting terrain',()=>{
  const w=deconstructionCamp(0);w.tiles[8*w.width+8]={terrain:'marsh',bridge:true};
  const before=JSON.stringify(w),lines=mapHoverLines(w,{x:8,z:8},1).join(' · ');
  // Core MouseoverReadout: the bridge terrain, its walk speed, no fertility
  // line when it is 0 (interactions note); the marsh stays in the inspection.
  expect(lines).toContain('Pont (vitesse de marche 100 %)');expect(lines).not.toContain('fert.');
  expect(lines).not.toContain('Support');expect(terrainInspection(w.tiles[8*w.width+8]!)).toContain('Marais'.toLowerCase());
  expect(mapObjectsAt(w,{x:8,z:8})).toEqual([]);expect(JSON.stringify(w)).toBe(before);
});

test('V387 preview and terrain work stay in existing boxes; schema and icon admission retain boundaries',()=>{
  const w=deconstructionCamp(1),pawn=w.pawns[0]!;w.tiles[8*w.width+8]={terrain:'marsh'};
  const build=constructionPreviewParts(w,[{kind:'build-bridge',x:8,z:8,key:77}]);
  expect(build.boxes).toEqual(bridgePartsForCell(8,8).map(p=>({...p,key:77})));
  const removal=constructionPreviewParts(w,[{kind:'remove-bridge',x:8,z:8,key:78}]);
  expect(removal.boxes).toHaveLength(8);expect(removal.timberWalls).toEqual([]);
  const historical=structuredClone(w);(historical as {schemaVersion:number}).schemaVersion=246;
  for(const kind of ['build-bridge','remove-bridge'] as const){
    expect(architectToolAvailable(historical,kind)).toBe(false);
    const available=structuredClone(w);(available as {schemaVersion:number}).schemaVersion=247;expect(architectToolAvailable(available,kind)).toBe(true);
    expect(ARCHITECT_ICON_URLS[kind]).toContain('data:image/svg+xml');expect(ARCHITECT_ICON_MAPPING[kind]).toBeDefined();
    const job={id:55,kind,x:8,z:8,orientation:0,progress:0,status:'active',construction:'blueprint',footprint:'standard'} as Job;
    expect(pawnWorkPose({...pawn,state:'working'},job)).toBe(WORK_POSE.ground);
    // 22 November: a bridge to build is its ghost (the cursor's planks); a removal keeps its cross only.
    const batches=new Map<string,Placement[]>(),ghosts=new ConstructionGhosts();
    try{
      buildJobMarkers({...w,jobs:[job]},new THREE.Group(),false,{set(_g:THREE.Group,name:string,parts:Placement[]){batches.set(name,parts);}} as unknown as BoxBatches,ghosts);
      expect([...batches.keys()]).toEqual(['job-orders','job-solids']);
      if(kind==='build-bridge'){expect(batches.get('job-orders')).toEqual([]);expect(ghosts.allParts()).toEqual(bridgePartsForCell(8,8).map(p=>({...p,key:55})));}
      else{expect(batches.get('job-orders')).toHaveLength(1);expect(ghosts.allParts()).toEqual([]);expect(batches.get('job-solids')).toHaveLength(2);}
    }finally{ghosts.dispose();}
  }
  expect(placementMaterial('build-bridge','steel')).toBeUndefined();
});
