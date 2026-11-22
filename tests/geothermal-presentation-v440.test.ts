import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/index';
import type {Structure} from '../src/sim/types';
import {GEOTHERMAL_POWER_RESEARCH_COST} from '../src/sim/research';
import {geothermalParts264,harvestedGeyserIds264} from '../src/render/geothermal-parts264';
import {electricalParts} from '../src/render/electrical-parts';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {StructureVfxLayer} from '../src/render/StructureVfxLayer';
import {buildJobMarkers} from '../src/render/JobLayer';
import {ConstructionGhosts} from '../src/render/construction-ghosts';
import type {BoxBatches} from '../src/render/BoxBatches';
import type {Placement} from '../src/render/primitives';
import {researchProjects} from '../src/ui/research-projects';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {ARCHITECT_ICON_URLS,ARCHITECT_ICON_MAPPING} from '../src/ui/architect-icons';
import {modelIconUrl} from '../src/ui/pictograms';
import {placementMaterial} from '../src/ui/construction-controls';
import {geothermalPowerInspection} from '../src/ui/power-inspection';
import {mapObjectsAt} from '../src/ui/map-object-selection';
import {toolDefinitions} from '../src/ui/layout';

function fixture(){
 const world=createWorld(440,32,32);Object.assign(world,{schemaVersion:264});world.pawns=[];world.jobs=[];world.piles=[];world.packed=[];world.resources=[];
 const geyserId=world.nextId++;
 world.geysers={revision:1,atTick:world.tick,items:[{id:geyserId,x:12,z:12,ticksUntilSpray:0,sprayTicksLeft:240}]};
 const generator:Structure={id:world.nextId++,kind:'geothermal-generator',x:10,z:10,orientation:0,footprint:'standard',material:'steel',power:{on:true,parentId:null},geothermal:{geyserId,atTick:world.tick,ticksUntilSpray:0,sprayTicksLeft:240}};
 world.structures=[generator];return {world,generator,geyserId};
}

test('original model and construction preview share the opaque fixed 6×6 machinery',()=>{
 const {world,generator}=fixture(),parts=geothermalParts264(generator),before=JSON.stringify(world);
 expect(parts.length).toBeGreaterThan(25);expect(parts.every(p=>p.key===generator.id&&p.targetId===generator.id)).toBe(true);
 for(const p of parts){expect(p.x-(p.sx??1)/2).toBeGreaterThanOrEqual(generator.x-.5);expect(p.x+(p.sx??1)/2).toBeLessThanOrEqual(generator.x+5.5);expect(p.z-(p.sz??1)/2).toBeGreaterThanOrEqual(generator.z-.5);expect(p.z+(p.sz??1)/2).toBeLessThanOrEqual(generator.z+5.5);}
 expect(electricalParts(world).filter(p=>p.targetId===generator.id)).toEqual(parts);
 const preview=constructionPreviewParts(world,[{kind:'geothermal-generator',x:generator.x,z:generator.z,orientation:0,material:'steel'}]);
 expect(preview.boxes.map(({key,targetId,...p})=>p)).toEqual(parts.map(({key,targetId,...p})=>p));
 expect(JSON.stringify(world)).toBe(before);
});

test('research node, costs, menu icon and fixed material expose the complete generator',()=>{
 const {world}=fixture(),node=researchProjects.find(p=>p.id==='geothermal-power')!;
 expect(node.cost).toBe(3200);expect(node.detail).toContain('bureau simple');expect(node.progress(world)).toBeUndefined();
 expect(architectToolAvailable(world,'geothermal-generator')).toBe(false);
 world.research={points:0,project:null,geothermalPower:{points:GEOTHERMAL_POWER_RESEARCH_COST,completedAt:1}};
 expect(architectToolAvailable(world,'geothermal-generator')).toBe(true);
 expect(placementMaterial('geothermal-generator','wood')).toBe('steel');
 expect(toolDefinitions.find(t=>t.id==='geothermal-generator')?.hint).toContain('340 acier + 8 composants');
 expect(ARCHITECT_ICON_URLS['geothermal-generator']).toBe(modelIconUrl('geothermal-generator'));expect(ARCHITECT_ICON_MAPPING['geothermal-generator']).toBeDefined();
});

test('blueprint ghost uses the full footprint and correct machine height',()=>{
 const {world,generator}=fixture();world.structures=[];
 world.jobs=[{id:world.nextId++,kind:'geothermal-generator',x:generator.x,z:generator.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},material:'steel',construction:'blueprint'}];
 // 22 November: the placed generator is the cursor's ghost model, not a box.
 const captures=new Map<string,Placement[]>(),ghosts=new ConstructionGhosts();
 try{
  buildJobMarkers(world,new THREE.Group(),false,{set:(_g:THREE.Group,name:string,parts:Placement[])=>captures.set(name,parts)} as unknown as BoxBatches,ghosts);
  expect(captures.has('job-plans')).toBe(false);expect(captures.get('job-orders')).toEqual([]);
  const parts=ghosts.allParts(),lo=(f:(p:Placement)=>number)=>Math.min(...parts.map(f)),hi=(f:(p:Placement)=>number)=>Math.max(...parts.map(f));
  expect((lo(p=>p.x-(p.sx??1)/2)+hi(p=>p.x+(p.sx??1)/2))/2).toBeCloseTo(12.5,1);expect((lo(p=>p.z-(p.sz??1)/2)+hi(p=>p.z+(p.sz??1)/2))/2).toBeCloseTo(12.5,1);
  expect(hi(p=>p.y+(p.sy??1)/2)).toBeCloseTo(2.7,1);
 }finally{ghosts.dispose();}
});

test('confirmed geothermal steam replaces natural steam, survives outages, and freezes with the presented tick',()=>{
 const {world,generator,geyserId}=fixture(),layer=new StructureVfxLayer();
 try{
  expect(harvestedGeyserIds264(world).has(geyserId)).toBe(true);
  const choices=mapObjectsAt(world,{x:12,z:12});expect(choices[0]).toEqual({kind:'structure',id:generator.id});expect(choices).toContainEqual({kind:'geyser',id:geyserId});layer.adopt(world);
  expect(layer.smoke.geometry.instanceCount).toBe(12);
  const positions=layer.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute;
  expect(Array.from({length:12},(_,i)=>positions.getY(i)).every(y=>y>2.7)).toBe(true);
  const raw=Array.from(positions.array);layer.present(world.tick);layer.present(world.tick);expect(Array.from(positions.array)).toEqual(raw);
  generator.power!.on=false;generator.breakdown={brokenAt:world.tick};generator.emp={sinceCore:world.tick*10,untilCore:world.tick*10+100};layer.adopt(world);
  expect(layer.smoke.geometry.instanceCount).toBe(12);expect(geothermalPowerInspection(world,generator)).toContain('En panne');expect(geothermalPowerInspection(world,generator)).toContain('sans combustible');
  generator.geothermal!.sprayTicksLeft=0;generator.geothermal!.ticksUntilSpray=500;layer.adoptNative(world);
  expect(layer.smoke.geometry.instanceCount).toBe(0);
  const adopt=vi.spyOn(layer,'adopt');layer.adoptNative(world);expect(adopt).not.toHaveBeenCalled();
  world.structures=[];layer.adopt(world);expect(layer.smoke.geometry.instanceCount).toBe(10);expect(harvestedGeyserIds264(world).size).toBe(0);
 }finally{layer.dispose();}
});
