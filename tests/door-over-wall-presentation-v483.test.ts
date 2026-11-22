import {beforeAll,expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {applyCommand} from '../src/sim/engine';
import type {Command,World} from '../src/sim/types';
import {BoxBatches} from '../src/render/BoxBatches';
import type {BoxMesh} from '../src/render/BoxMesh';
import {ConfirmedJobMarkers} from '../src/render/JobLayer';
import {ConstructionGhosts} from '../src/render/construction-ghosts';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {createClosedMainMapIntentReader} from '../src/render/closed-main-map-intents';
import type {ConfirmedIntentFields} from '../src/render/confirmed-intent-fields';
import {mapObjectsAt,nextMapObject,mapObjectExists} from '../src/ui/map-object-selection';
import {mapObjectGroupCells} from '../src/ui/map-object-group-selection';
import {mapObjectActions} from '../src/ui/map-object-actions';
import {selectedMapJob296} from '../src/ui/wall-door-selection-296';
import {buildNativeInspector} from '../src/ui3d/native-inspector';
import type {NativeUiState,NativeUiActions,NativePage} from '../src/ui3d/native-contract';
import {buildDoorOverWallScenario483,copyDoorOverWall483,planDoorOverWall483} from './scenarios/door-over-wall-v483';

let paid:ReturnType<typeof buildDoorOverWallScenario483>;
beforeAll(()=>{paid=buildDoorOverWallScenario483();});
const fixture=()=>copyDoorOverWall483(paid);
const command=(world:World,value:Command)=>{const result=applyCommand(world,value);expect(result.ok,JSON.stringify(result)).toBe(true);};
test('native wall inspection reaches its future plan and returns without changing either intention or losing outside dismissal',()=>{
  const f=fixture(),{planId}=planDoorOverWall483(f),world=f.world,before=JSON.stringify(world),noop=()=>{};
  const state:NativeUiState={world,epoch:483,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[{kind:'structure',id:f.ids.wallId}],constructionMaterial:'steel',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  const actions:NativeUiActions={command:async()=>{throw Error('Inspection cannot send a simulation command');},panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:noop,readState:()=>state,
    selectObject:target=>{state.selectedObjects=[target];},clearSelection:()=>{state.selectedObjects=[];}};
  const find=(page:NativePage,id:string)=>page.rows.flatMap(row=>row.controls??[]).find(c=>c.id===id);
  const wall=buildNativeInspector(state,actions)!;expect(wall.id).toBe('inspect-structure-'+f.ids.wallId);
  const choose=find(wall,'wall-door-inspect-job-'+planId);expect(choose).toBeDefined();choose!.onActivate!();
  const plan=buildNativeInspector(state,actions)!;expect(plan.id).toBe('inspect-job-'+planId);expect(plan.actions?.some(c=>c.id==='object-action-cancel')).toBe(true);
  find(plan,'wall-door-inspect-structure-'+f.ids.wallId)!.onActivate!();expect(state.selectedObjects).toEqual([{kind:'structure',id:f.ids.wallId}]);expect(JSON.stringify(world)).toBe(before);
  buildNativeInspector(state,actions)!.onClose!();expect(state.selectedObjects).toEqual([]);expect(JSON.stringify(world)).toBe(before);
  command(world,{type:'cancel-job',jobId:planId});state.selectedObjects=[{kind:'structure',id:f.ids.wallId}];choose!.onActivate!();expect(state.selectedObjects).toEqual([{kind:'structure',id:f.ids.wallId}]);
});
function mesh(group:THREE.Group,key:string):BoxMesh {
  const value=group.getObjectByName(key);if(!value)throw Error(`Missing resident batch ${key}`);return value as BoxMesh;
}
function presentation(){
  const boxes=new BoxBatches(),group=new THREE.Group(),markers=new ConfirmedJobMarkers(),writes=vi.spyOn(boxes,'set'),ghosts=new ConstructionGhosts();
  const parts=(key:string)=>writes.mock.calls.filter(call=>call[1]===key).at(-1)?.[2]??[];
  // 22 November: the future door's frame around the wall is drawn in the ghost layer.
  const plans=()=>ghosts.allParts(),plan=()=>ghosts.layer.group.children[0] as BoxMesh;
  const render=(physical:World,intentions:World=physical)=>{
    const beforePhysical=structuredClone(physical),beforeIntentions=structuredClone(intentions);
    markers.updatePhysical(physical,false);markers.updateIntentions(intentions.jobs,false,physical);markers.present(group,boxes,ghosts);
    expect(physical).toEqual(beforePhysical);expect(intentions).toEqual(beforeIntentions);
  };
  return {boxes,group,markers,parts,plans,plan,ghosts,render,dispose(){writes.mockRestore();boxes.dispose();ghosts.dispose();}};
}
function sceneBridge(physical:World){
  const view=presentation(),reader=createClosedMainMapIntentReader();
  const scene=Object.assign(Object.create(SceneRenderCore.prototype) as Record<string,unknown>,{
    confirmedIntents:reader.admit!(physical),confirmedJobMarkers:view.markers,jobGroup:view.group,wallCutaway:false,boxes:view.boxes,constructionGhosts:view.ghosts,
  }) as unknown as {confirmedIntents:ConfirmedIntentFields;buildJobs(world:World):void};
  return {...view,reader,scene};
}

test('the unpaid future door is visible around its paid standing wall and owns three selectable placements in the resident plan batch',()=>{
  const f=fixture(),{job,planId}=planDoorOverWall483(f),view=presentation(),before=structuredClone(f.world);
  try{
    view.render(f.world);
    expect(f.world.structures.find(s=>s.id===f.ids.wallId)?.kind).toBe('wall');
    expect(view.group.children.map(child=>child.name)).toEqual(['job-orders','job-solids']);
    expect(view.plans()).toHaveLength(3);
    expect(view.plans().every(p=>p.key===planId)).toBe(true);
    expect(view.plans().some(p=>p.x<f.cells.wall.x)).toBe(true);
    expect(view.plans().some(p=>p.x>f.cells.wall.x)).toBe(true);
    expect(view.plans().every(p=>(p.sy??0)>0)).toBe(true);
    expect(view.parts('job-orders')).toEqual([]);expect(view.parts('job-solids')).toEqual([]);
    const resident=view.plan(),geometry=resident.geometry,material=resident.material;
    view.render(f.world);view.render(f.world);
    expect(view.plan()).toBe(resident);expect(resident.geometry).toBe(geometry);expect(resident.material).toBe(material);
    expect(resident.activeCount).toBe(3);expect(job.escrow).toEqual({wood:0,food:0});expect(f.world).toEqual(before);
  }finally{view.dispose();}
});

test('manual promotion adds a separate wall mark without changing the prospective target or supplying a construction frame',()=>{
  const f=fixture(),{job,planId}=planDoorOverWall483(f),view=presentation();
  try{
    view.render(f.world);const resident=view.plan(),geometry=resident.geometry,material=resident.material;
    command(f.world,{type:'designate',kind:'deconstruct',targetId:f.ids.wallId,...f.cells.wall});view.render(f.world);
    expect(f.world.jobs).toHaveLength(1);expect(job.wallDoor296?.manual).toBe(true);
    expect(view.plans().map(p=>p.key)).toEqual([planId,planId,planId]);
    expect(view.parts('job-orders')).toEqual([]); // Deconstruction already has its own designation pictogram.
    expect(view.parts('job-solids')).toHaveLength(2);expect(view.parts('job-solids').every(p=>p.targetId===job.id)).toBe(true);
    expect(resident.geometry).toBe(geometry);expect(resident.material).toBe(material);
    command(f.world,{type:'cancel-job',jobId:job.id});view.render(f.world);
    expect(view.parts('job-orders')).toEqual([]);expect(view.parts('job-solids')).toEqual([]);
    expect(view.plans().map(p=>p.key)).toEqual([planId,planId,planId]);
  }finally{view.dispose();}
});

test('confirmed cancellation of the prospective ID remains visible when the older executed World still has both intentions',()=>{
  const f=fixture(),{job,planId}=planDoorOverWall483(f);
  command(f.world,{type:'designate',kind:'deconstruct',...f.cells.wall});
  const physical=structuredClone(f.world),future=structuredClone(f.world),view=sceneBridge(physical),before=structuredClone(physical);
  try{
    view.scene.buildJobs(physical);const resident=view.plan(),geometry=resident.geometry,material=resident.material;
    expect(resident.activeCount).toBe(3);
    command(future,{type:'cancel-job',jobId:planId});view.scene.confirmedIntents=view.reader.admit!(future);
    view.scene.buildJobs(physical);view.scene.buildJobs(physical);
    expect(resident.activeCount).toBe(0);expect(view.parts('job-orders')).toEqual([]);
    expect(view.parts('job-solids').every(p=>p.targetId===job.id)).toBe(true);
    expect(view.parts('job-solids')).toHaveLength(2);expect(resident.geometry).toBe(geometry);expect(resident.material).toBe(material);
    expect(physical).toEqual(before);expect(selectedMapJob296(future,planId)).toBeUndefined();expect(selectedMapJob296(future,job.id)).toBeDefined();
  }finally{view.reader.clear();view.dispose();}
});

test('confirmed whole-cell cancellation hides both marks while captured implicit work continues in the older physical World',()=>{
  const f=fixture(),{job,planId}=planDoorOverWall483(f);
  command(f.world,{type:'order-job',pawnId:f.ids.builderId,jobId:job.id,queue:false});
  command(f.world,{type:'designate',kind:'deconstruct',...f.cells.wall});
  const physical=structuredClone(f.world),future=structuredClone(f.world),view=sceneBridge(physical),before=structuredClone(physical);
  try{
    view.scene.buildJobs(physical);expect(view.plan().activeCount).toBe(3);
    command(future,{type:'cancel',...f.cells.wall});expect(future.jobs[0]?.wallDoor296).toEqual({manual:false,fromBlueprint:true});
    view.scene.confirmedIntents=view.reader.admit!(future);view.scene.buildJobs(physical);view.scene.buildJobs(physical);
    for(const key of ['job-orders','job-solids'])expect(mesh(view.group,key).activeCount).toBe(0);
    expect(view.plan().activeCount).toBe(0);
    expect(future.pawns.find(p=>p.id===f.ids.builderId)?.jobId).toBe(job.id);
    expect(mapObjectExists(future,{kind:'job',id:job.id})).toBe(false);expect(mapObjectExists(future,{kind:'job',id:planId})).toBe(false);
    expect(physical).toEqual(before);
  }finally{view.reader.clear();view.dispose();}
});

test('selection cycles through the real wall and separate plan, and each inspector action cancels only its own authority',()=>{
  const f=fixture(),w=f.world,{job,planId}=planDoorOverWall483(f),wall={kind:'structure' as const,id:f.ids.wallId},plan={kind:'job' as const,id:planId};
  expect(mapObjectsAt(w,f.cells.wall)).toEqual([wall,plan]);expect(nextMapObject(w,f.cells.wall,wall)).toEqual(plan);expect(nextMapObject(w,f.cells.wall,plan)).toEqual(wall);
  expect(mapObjectGroupCells(w,[wall,plan,{kind:'job',id:job.id}])).toEqual([[f.cells.wall],[f.cells.wall],[]]);
  expect(selectedMapJob296(w,planId)).toMatchObject({id:planId,kind:'door',material:'steel',construction:'blueprint'});
  const promote=mapObjectActions(w,wall).find(a=>a.id==='deconstruct')!;expect(promote.command).toBeDefined();command(w,promote.command!);
  expect(job.wallDoor296?.manual).toBe(true);expect(mapObjectsAt(w,f.cells.wall)).toEqual([wall,{kind:'job',id:job.id},plan]);
  expect(mapObjectGroupCells(w,[wall,plan,{kind:'job',id:job.id}])).toEqual([[f.cells.wall],[f.cells.wall],[f.cells.wall]]);
  const cancelWall=mapObjectActions(w,wall).find(a=>a.id==='cancel')!,cancelPlan=mapObjectActions(w,plan).find(a=>a.id==='cancel')!;
  expect(cancelWall.command).toEqual({type:'cancel-job',jobId:job.id});expect(cancelPlan.command).toEqual({type:'cancel-job',jobId:planId});
  command(w,cancelPlan.command!);expect(selectedMapJob296(w,planId)).toBeUndefined();expect(selectedMapJob296(w,job.id)).toBe(job);
  expect(w.structures.find(s=>s.id===f.ids.wallId)).toBeDefined();command(w,cancelWall.command!);expect(w.jobs).toEqual([]);
});

test('same-tick same-array intention reads detect plan identity, kind, material and manual changes without editing their input',()=>{
  const f=fixture(),w=f.world,{job}=planDoorOverWall483(f),reader=createClosedMainMapIntentReader(),jobs=w.jobs,tick=w.tick;
  const read=()=>{const before=structuredClone(w),signature=reader.read(w);expect(w).toEqual(before);expect(w.jobs).toBe(jobs);expect(w.tick).toBe(tick);return signature;};
  try{
    const signatures=[read()];expect(read()).toBe(signatures[0]);
    // Presentation-only source variations deliberately retain the same array,
    // parent record and clock; no runtime outcome is claimed for these edits.
    job.wallDoor296!.plan!.material='wood';signatures.push(read());
    job.wallDoor296!.manual=true;signatures.push(read());
    job.wallDoor296!.plan!.kind='autodoor';signatures.push(read());
    job.wallDoor296!.plan!.id=w.nextId++;signatures.push(read());
    delete job.wallDoor296!.plan;signatures.push(read());
    expect(new Set(signatures).size).toBe(signatures.length);expect(read()).toBe(signatures.at(-1));
  }finally{reader.clear();}
});
