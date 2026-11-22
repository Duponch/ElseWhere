import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import type {Job,World} from '../src/sim/types';
import {jobDuration} from '../src/sim/farming';
import {BoxBatches} from '../src/render/BoxBatches';
import type {BoxMesh} from '../src/render/BoxMesh';
import {buildJobMarkers,ConfirmedJobMarkers} from '../src/render/JobLayer';
import {ConstructionGhosts} from '../src/render/construction-ghosts';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {createClosedMainMapIntentReader} from '../src/render/closed-main-map-intents';

function wall(world:World):Job {return {id:world.nextId++,kind:'wall',x:4,z:5,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};}
function mesh(group:THREE.Group,key:string):BoxMesh {const value=group.getObjectByName(key);if(!value)throw Error(`Missing resident batch ${key}`);return value as BoxMesh;}
function matrices(group:THREE.Group,key:string){const value=mesh(group,key);return Array.from(value.instanceMatrix.array.slice(0,value.activeCount*16));}

test('split production matches the public full-world marker output when both inputs are executed',()=>{
  const world=createWorld(426,16,16),job=wall(world);job.status='active';job.construction='frame';job.progress=jobDuration(world,job)*.35;world.jobs=[job];
  const a=new BoxBatches(),b=new BoxBatches(),ga=new THREE.Group(),gb=new THREE.Group(),markers=new ConfirmedJobMarkers(),before=structuredClone(world);
  const ghostsA=new ConstructionGhosts(),ghostsB=new ConstructionGhosts();
  try{
    const publicWrites=vi.spyOn(a,'set'),splitWrites=vi.spyOn(b,'set');
    buildJobMarkers(world,ga,false,a,ghostsA);markers.updatePhysical(world,false);markers.updateIntentions(world.jobs,false,world);markers.present(gb,b,ghostsB);
    expect(splitWrites.mock.calls.map(([,key,parts,style,shadows])=>({key,parts,style,shadows})))
      .toEqual(publicWrites.mock.calls.map(([,key,parts,style,shadows])=>({key,parts,style,shadows})));
    // 22 November: no plan box any more; the ghost is the same on both paths.
    expect(gb.children.map(child=>child.name)).toEqual(['job-orders','job-solids']);
    for(const key of ['job-orders','job-solids']){
      expect(mesh(gb,key).geometry.instanceCount).toBe(mesh(ga,key).geometry.instanceCount);
      expect(matrices(gb,key)).toEqual(matrices(ga,key));
    }
    expect(ghostsB.allParts().length).toBeGreaterThan(0);expect(ghostsB.allParts()).toEqual(ghostsA.allParts());
    expect(world).toEqual(before);
  }finally{vi.restoreAllMocks();a.dispose();b.dispose();ghostsA.dispose();ghostsB.dispose();}
});

test('new intentions never read future work status, construction phase, escrow or progress',()=>{
  const physical=createWorld(426,16,16),future=wall(physical),boxes=new BoxBatches(),group=new THREE.Group(),markers=new ConfirmedJobMarkers(),ghosts=new ConstructionGhosts();physical.jobs=[];
  for(const name of ['status','construction','escrow','progress'] as const)
    Object.defineProperty(future,name,{get(){throw Error(`Future physical field: ${name}`);},configurable:true});
  try{
    markers.updatePhysical(physical,false);markers.updateIntentions([future],false,physical);markers.present(group,boxes,ghosts);
    expect(ghosts.allParts().length).toBeGreaterThan(0);expect(ghosts.allParts().every(p=>p.key===future.id)).toBe(true);
    expect(mesh(group,'job-solids').activeCount).toBe(0);expect(mesh(group,'job-orders').activeCount).toBe(0);
  }finally{boxes.dispose();ghosts.dispose();}
});

test('the real scene job bridge preserves cancellation when an older physical World is applied again',()=>{
  const physical=createWorld(426,16,16),job=wall(physical);job.status='active';job.construction='frame';job.progress=jobDuration(physical,job)*.25;physical.jobs=[job];
  const future=structuredClone(physical);future.jobs=[];
  const reader=createClosedMainMapIntentReader(),boxes=new BoxBatches(),group=new THREE.Group(),markers=new ConfirmedJobMarkers(),ghosts=new ConstructionGhosts();
  const scene=Object.assign(Object.create(SceneRenderCore.prototype) as Record<string,unknown>,{
    confirmedIntents:reader.admit!(physical),confirmedJobMarkers:markers,jobGroup:group,wallCutaway:false,boxes,constructionGhosts:ghosts,
  }) as unknown as {confirmedIntents:ReturnType<NonNullable<typeof reader.admit>>;buildJobs(world:World):void};
  try{
    scene.buildJobs(physical);const solids=matrices(group,'job-solids'),ghost=ghosts.layer.group.children[0] as BoxMesh,geometry=ghost.geometry,material=ghost.material;
    expect(ghosts.allParts().length).toBeGreaterThan(0);
    scene.confirmedIntents=reader.admit!(future);scene.buildJobs(physical);
    expect(ghosts.allParts()).toEqual([]);expect(mesh(group,'job-orders').activeCount).toBe(0);
    expect(matrices(group,'job-solids')).toEqual(solids);expect(solids.length).toBeGreaterThan(0);
    scene.buildJobs(physical);expect(ghosts.allParts()).toEqual([]);
    expect(ghost.geometry).toBe(geometry);expect(ghost.material).toBe(material);
  }finally{boxes.dispose();ghosts.dispose();}
});

test('newly known future plans use the executed fog boundary, and become visible only after that boundary advances',()=>{
  const physical=createWorld(426,16,16);physical.site={revision:3,tileId:0,mapSeed:physical.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};physical.exploration={revision:1};
  const job=wall(physical),cell=job.z*physical.width+job.x;physical.tiles[cell]={terrain:'soil',fogged:true};physical.jobs=[];
  const boxes=new BoxBatches(),group=new THREE.Group(),markers=new ConfirmedJobMarkers(),ghosts=new ConstructionGhosts();
  try{
    markers.updatePhysical(physical,false);markers.updateIntentions([job],false,physical);markers.present(group,boxes,ghosts);
    expect(ghosts.allParts()).toEqual([]);
    const revealed=structuredClone(physical);delete revealed.tiles[cell]!.fogged;
    markers.updateIntentions([job],false,revealed);markers.present(group,boxes,ghosts);expect(ghosts.allParts().length).toBeGreaterThan(0);
  }finally{boxes.dispose();ghosts.dispose();}
});
