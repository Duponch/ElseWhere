import {describe,it,expect,vi} from 'vitest';
import {applyCommand,createWorld} from '../src/sim/index';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {buildNativePanel} from '../src/ui3d/native-panels';
import {layoutNativePage,nativeMatrixColumns,nativeTableRowScroll} from '../src/ui3d/native-layout';
let sequence=980000;
type Kind='work'|'schedule'|'assign';
function fixture(kind:Kind='work',count=3){
 const world=createWorld(++sequence,16,16);for(const p of world.pawns)delete p.background;
 const sample=world.pawns[0]!;while(world.pawns.length<count){const p=structuredClone(sample);p.id=world.nextId++;p.name=`Colon ${p.id}`;world.pawns.push(p);}
 world.pawns[0]!.name='Étoile';world.pawns[1]!.name='Basile';
 let page:NativePage;
 const state:NativeUiState={world,epoch:sequence,panel:kind,category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 const noop=()=>{};
 const actions:NativeUiActions={command:vi.fn(async c=>applyCommand(world,c)),readState:()=>state,showPage:next=>{page=next;},refresh:noop,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
 const rebuild=()=>{page=buildNativePanel(state,actions)!;};rebuild();
 const control=(id:string):NativeControl=>{const c=[...(page.actions??[]),...page.rows.flatMap(r=>r.controls??[])].find(c=>c.id===id);if(!c)throw Error(`Missing ${id}`);return c;};
 return{world,state,actions,rebuild,control,get page(){return page;}};
}
const records=(page:NativePage)=>page.rows.filter(r=>/^(worker|schedule|assign)-\d+$/.test(r.id));
const measure=(text:string,size:number)=>text.length*size*.51;
describe('compact opt-in colonist management tables',()=>{
 it('searches each roster locally without changing World, ordering or commands and resets on a new scope',async()=>{
  for(const kind of ['work','schedule','assign'] as const){
   const f=fixture(kind,45),before=structuredClone(f.world),ids=records(f.page).map(r=>r.id),key=f.page.contentKey;
   expect(f.page.tableProfile).toBe('colonists');expect(records(f.page)).toHaveLength(45);
   await f.page.rows.find(r=>r.id===`${kind}-search`)!.input!.onCommit('etoile');
   expect(records(f.page).map(r=>r.label)).toEqual(['Étoile']);expect(f.page.contentKey).not.toBe(key);
   expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();
   await f.page.rows.find(r=>r.id===`${kind}-search`)!.input!.onCommit('');expect(records(f.page).map(r=>r.id)).toEqual(ids);
   await f.page.rows.find(r=>r.id===`${kind}-search`)!.input!.onCommit('Basile');
   f.state.epoch!++;f.rebuild();expect(records(f.page)).toHaveLength(45);expect(f.page.rows.find(r=>r.id===`${kind}-search`)!.input!.value).toBe('');
  }
 });
 it('keeps priority and schedule payloads tied to their true pawn and refuses stale retained table controls',async()=>{
  const f=fixture(),p=f.world.pawns[0]!,priority=f.control(`work-${p.id}-build`).select!;
  await priority.onChange('1');expect(p.priorities.build).toBe(1);expect(f.actions.command).toHaveBeenLastCalledWith({type:'priority',pawnId:p.id,work:'build',value:1});
  f.state.busy=true;await expect(Promise.resolve().then(()=>priority.onChange('3'))).rejects.toThrow('opération courante');f.state.busy=false;
  f.state.epoch!++;await expect(Promise.resolve().then(()=>priority.onChange('3'))).rejects.toThrow('autre carte');expect(f.actions.command).toHaveBeenCalledTimes(1);
  f.state.panel='schedule';f.rebuild();await f.control('brush-recreation').onActivate();f.rebuild();
  const hours=f.control(`hour-${p.id}-6`).paint!;await hours.onPaint([6,7,7,-1,24]);
  expect(f.actions.command).toHaveBeenLastCalledWith({type:'schedule-paint',pawnId:p.id,hours:[6,7],assignment:'recreation'});
  expect(p.schedule[6]).toBe('recreation');expect(p.schedule[7]).toBe('recreation');
  await f.control(`copy-${p.id}`).onActivate();const copied=[...p.schedule];f.rebuild();
  const target=f.world.pawns[1]!;await f.control(`paste-${target.id}`).onActivate();
  expect(target.schedule).toEqual(copied);expect(target.schedule).not.toBe(p.schedule);
  const oldPaste=f.control(`paste-${target.id}`);f.state.epoch!++;await expect(Promise.resolve().then(()=>oldPaste.onActivate())).rejects.toThrow('autre carte');
 });
 it('assigns policies directly in cells with current IDs and keeps policy management outside the scrolling roster',async()=>{
  const f=fixture('assign',40),p=f.world.pawns[0]!,before=structuredClone(f.world);
  expect(records(f.page)).toHaveLength(40);expect(f.page.actions?.map(c=>c.id)).toEqual(['assign-manage-food','assign-manage-apparel','assign-manage-drugs','areas-manage']);
  expect(f.page.rows.some(r=>r.id==='manage-food')).toBe(false);expect(f.world).toEqual(before);
  const food=f.control(`assign-food-${p.id}`).select!,response=f.control(`assign-response-${p.id}`).select!,area=f.control(`assign-area-${p.id}`).select!;
  await food.onChange(String(p.foodPolicyId));expect(f.actions.command).toHaveBeenLastCalledWith({type:'food-policy-assign',pawnId:p.id,policyId:p.foodPolicyId});
  await response.onChange('ignore');expect(f.actions.command).toHaveBeenLastCalledWith({type:'hostility-response',pawnId:p.id,response:'ignore'});
  await area.onChange('0');expect(f.actions.command).toHaveBeenLastCalledWith({type:'assign-allowed-area',pawnId:p.id,areaId:null});
  const count=vi.mocked(f.actions.command).mock.calls.length;await food.onChange('999999');await response.onChange('invalid');await area.onChange('-99');expect(f.actions.command).toHaveBeenCalledTimes(count);
  await f.control('assign-manage-food').onActivate();expect(f.page.id).toBe('assign-food-policies');expect(f.page.rows.find(r=>r.id==='manage-food')!.controls!.some(c=>c.id==='food-new')).toBe(true);expect(f.actions.command).toHaveBeenCalledTimes(count);
 });
 it('pins toolbar, headings and names with readable compact cells and preserves tables without the profile',()=>{
  for(const kind of ['work','schedule','assign'] as const){
   const f=fixture(kind,55),box=layoutNativePage(f.page,{width:1280,height:720},false,measure),head=box.rows.find(r=>r.row.columns)!,record=box.rows.find(r=>/^(worker|schedule|assign)-\d+$/.test(r.row.id))!;
   expect(box.tableHeader).toBeDefined();expect(box.regions.details!.contentHeight).toBe(box.regions.details!.height);expect(box.regions.navigation!.width).toBe(104);
   expect(box.body.y).toBeGreaterThanOrEqual(box.tableHeader!.y+box.tableHeader!.height);expect(box.contentHeight).toBeGreaterThan(box.body.height);
   expect(record.height).toBe(kind==='work'?44:34);expect(record.controls.every(c=>c.height>=24&&c.width>=24)).toBe(true);
   const cells=nativeMatrixColumns(head.row,head.x,head.width,head.row.columns!.length,head.matrixTail,box.matrixColumnWeights);expect(record.controls.map(c=>c.x)).toEqual(cells.map(c=>c.x));
   expect(box.header+head.top-nativeTableRowScroll(box,head.row,250)).toBe(box.tableHeader!.y);expect(box.header+record.top-nativeTableRowScroll(box,record.row,250)).toBe(box.body.y-250);
   const narrow=layoutNativePage(f.page,{width:700,height:720},false,measure);expect(narrow.regions.catalogue!.contentWidth).toBeGreaterThan(narrow.regions.catalogue!.width);expect(narrow.regions.navigation!.width).toBe(104);
   const old=layoutNativePage({...f.page,tableProfile:undefined},{width:1280,height:720},false,measure);expect(old.tableHeader).toBeUndefined();
  }
 });
});
