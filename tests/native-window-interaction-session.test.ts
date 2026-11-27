import {afterEach,expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {NativeStage} from '../src/ui3d/NativeStage';
import {buildNativeInspector,resetNativeInspectorSession,setNativeInspectorTab} from '../src/ui3d/native-inspector';
import {createWorld,applyCommand} from '../src/sim/index';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
vi.mock('../src/ui/native-cardboard-cursors',()=>({setNativeCursor:vi.fn()}));
afterEach(()=>{resetNativeInspectorSession();vi.restoreAllMocks();});
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};

// Actual event/session methods; the page painter and device are explicit
// boundaries. These tests do not grant a browser/native rendering result.
function stageHost(){
  const stage=Object.assign(Object.create(NativeStage.prototype),{
    closed:false,frontVisible:false,worldVisible:true,activationSerial:0,focusIndex:-1,
    regionOffsets:{navigation:0,details:0,graph:0,toolbar:0},toolsDock:new THREE.Group(),
    options:{onEscape:vi.fn(),onError:vi.fn(),onCancelWorldInteraction:vi.fn()},
    hover:vi.fn(),clearHint:vi.fn(),closeDropdown:vi.fn(),rebuildPage:vi.fn(),layoutToolsDock:vi.fn(),refreshWorldReadout:vi.fn(),updateWorldReadoutVisibility:vi.fn(),syncEnvironmentHover:vi.fn(),invalidate:vi.fn(),gesture:vi.fn(),pagePieces:[],pageControls:[],hits:new Map(),
  });
  return stage;
}
test('changing a window retires an activation waiting on an editor even when the same window ID is reopened',async()=>{
  const stage=stageHost(),page:NativePage={id:'work',title:'Travail',rows:[]},action=vi.fn();stage.showPage(page);
  const piece=new THREE.Group(),hit={piece,control:{id:'same-control',label:'Appliquer',onActivate:action}};stage.pagePieces=[piece];stage.pageControls=[hit];
  let finish!:(value:boolean)=>void;stage.editor={};stage.finishEdit=()=>{stage.editor=undefined;return new Promise<boolean>(resolve=>{finish=resolve;});};
  stage.activate(hit);stage.focusIndex=0;stage.showPage(null);stage.showPage({...page});
  expect(stage.focusIndex).toBe(-1);finish(true);await flush();expect(action).not.toHaveBeenCalled();
});
test('a live repaint of the same window preserves a valid action waiting on its editor',async()=>{
  const stage=stageHost(),page:NativePage={id:'work',title:'Travail',rows:[]},action=vi.fn();stage.showPage(page);
  const piece=new THREE.Group(),hit={piece,control:{id:'same-control',label:'Appliquer',onActivate:action}};stage.pagePieces=[piece];stage.pageControls=[hit];
  let finish!:(value:boolean)=>void;stage.editor={};stage.finishEdit=()=>{stage.editor=undefined;return new Promise<boolean>(resolve=>{finish=resolve;});};
  stage.activate(hit);stage.showPage({...page,title:'Travail vivant'});finish(true);await flush();expect(action).toHaveBeenCalledOnce();
});
test('holding Escape closes one layer and leaves the newly restored parent open',()=>{
  const stage=stageHost(),parentClose=vi.fn(),parent:NativePage={id:'parent',title:'Parent',rows:[],onClose:parentClose};
  const childClose=vi.fn(()=>stage.showPage(parent));stage.showPage({id:'child',title:'Enfant',rows:[],onClose:childClose});
  const key=(repeat:boolean)=>({key:'Escape',repeat,preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()});
  stage.keyDown(key(false));stage.keyDown(key(true));expect(childClose).toHaveBeenCalledOnce();expect(parentClose).not.toHaveBeenCalled();expect(stage.page).toBe(parent);
});
test('a second pointer cannot release another pointer’s scrollbar, paint gesture or pressed control',()=>{
  const stage=stageHost(),event=(pointerId:number)=>({pointerId,clientX:0,clientY:0,preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()});
  for(const name of ['regionDrag','scrollbarDrag','globeDrag']){const drag={pointerId:17};stage[name]=drag;stage.pointerUp(event(18));expect(stage[name]).toBe(drag);stage[name]=undefined;}
  const paint=vi.fn(),drag={pointerId:17,indices:new Set([2,3]),onPaint:paint};stage.paintDrag=drag;stage.pointerUp(event(18));expect(stage.paintDrag).toBe(drag);expect(paint).not.toHaveBeenCalled();stage.pointerUp(event(17));expect(stage.paintDrag).toBeUndefined();expect(paint).toHaveBeenCalledExactlyOnceWith([2,3]);
  const down={pointerId:17};stage.down=down;stage.pointerUp(event(18));expect(stage.down).toBe(down);
  stage.cancelPointer(18);expect(stage.down).toBe(down);stage.cancelPointer(17);expect(stage.down).toBeNull();
});

function inspector(){
  resetNativeInspectorSession();const world=createWorld(7_271_127,16,16);
  const state:NativeUiState={world,epoch:7_271_127,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[world.pawns[0]!.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:2,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  let page:NativePage|null=null;
  const refresh=()=>{page=buildNativeInspector(state,actions);},noop=()=>{};
  const actions:NativeUiActions={command:vi.fn(async command=>applyCommand(world,command)),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:next=>{page=next;},refresh,readState:()=>state,clearSelection:()=>{state.selectedPawnIds=[];refresh();},closePage:refresh};
  refresh();return {world,state,actions,refresh,get page(){if(!page)throw Error('Missing inspector');return page;}};
}
const control=(page:NativePage,id:string):NativeControl=>{
  const item=[...page.actions??[],...page.rows.flatMap(row=>row.controls??[])].find(item=>item.id===id);if(!item)throw Error('Missing control '+id);return item;
};
const health=(page:NativePage)=>{const card=page.rows.find(row=>row.card?.type==='health')?.card;if(card?.type!=='health')throw Error('Missing health card');return card;};
test('closing/reopening Health resets Operations, and direct selection keeps Health with fresh overview',async()=>{
  const f=inspector();setNativeInspectorTab('health');f.refresh();await health(f.page).tabs.operations!.onActivate();expect(health(f.page).tab).toBe('operations');
  await control(f.page,'inspect-tab-close').onActivate();await control(f.page,'pawn-tab-health').onActivate();expect(health(f.page).tab).toBe('overview');
  await health(f.page).tabs.operations!.onActivate();f.state.selectedPawnIds=[f.world.pawns[1]!.id];f.refresh();expect(f.page.inspectTab?.id).toBe('health');expect(health(f.page).tab).toBe('overview');
});
test('a closed inspector starts without its previous tab and a saved control cannot command a different selection',async()=>{
  const f=inspector(),oldDraft=control(f.page,'draft-pawn');setNativeInspectorTab('health');f.refresh();await health(f.page).tabs.operations!.onActivate();
  f.page.onClose!();f.state.selectedPawnIds=[f.world.pawns[0]!.id];f.refresh();expect(f.page.inspectTab).toBeUndefined();
  const before=JSON.stringify(f.world);f.state.selectedPawnIds=[f.world.pawns[1]!.id];await oldDraft.onActivate();expect(f.actions.command).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
});
test('empty selection by another input path closes the primary tab too',()=>{
  const f=inspector();setNativeInspectorTab('bio');f.refresh();expect(f.page.inspectTab?.id).toBe('bio');
  f.state.selectedPawnIds=[];f.refresh();f.state.selectedPawnIds=[f.world.pawns[0]!.id];f.refresh();expect(f.page.inspectTab).toBeUndefined();
});
