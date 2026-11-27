import {expect,test,vi} from 'vitest';
import {applyCommand} from '../src/sim/engine.ts';
import {serializeWorld} from '../src/sim/serialization.ts';
import {nativeBlueprintStoragePage380,nativeSpecialRows} from '../src/ui3d/native-special-inspection.ts';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract.ts';
import {blueprintStorageCamp380} from './scenarios/blueprint-storage-380.ts';

function control(page:NativePage,suffix:string):NativeControl {
 const found=[...(page.actions??[]),...page.rows.flatMap(row=>row.controls??[])].find(c=>c.id.endsWith('-'+suffix));expect(found,suffix).toBeDefined();return found!;
}
function fixture(){
 const world=blueprintStorageCamp380();expect(applyCommand(world,{type:'designate',kind:'small-shelf',x:17,z:18,orientation:0,material:'wood'}).ok).toBe(true);const job=world.jobs.at(-1)!;
 const state:NativeUiState={world,epoch:38001,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[{kind:'job',id:job.id}],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 let page:NativePage;const noop=()=>{},actions:NativeUiActions={command:vi.fn(async command=>applyCommand(world,command)),readState:()=>state,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:next=>{page=next;},refresh:vi.fn(),closePage:vi.fn()};
 page=nativeBlueprintStoragePage380(state,actions,job.id)!;return{world,job,state,actions,get page(){return page;}};
}

test('selected storage ghost offers native storage controls, drafts without mutating and applies by durable job identity',async()=>{
 const f=fixture(),before=serializeWorld(f.world);expect(f.page.layout).toBe('storage');
 expect(nativeSpecialRows(f.state,f.actions).some(row=>row.id==='special-blueprint-storage')).toBe(true);
 await control(f.page,'priority-select').select!.onChange('5');expect(serializeWorld(f.world)).toBe(before);expect(f.actions.command).not.toHaveBeenCalled();
 expect(control(f.page,'node-buildings-permission').disabled).toBe(true);expect(control(f.page,'node-chunks-permission').disabled).toBe(true);
 await control(f.page,'clear').onActivate();await control(f.page,'allow').onActivate();await control(f.page,'apply').onActivate();
 expect(f.actions.command).toHaveBeenCalledOnce();expect(f.actions.command).toHaveBeenCalledWith(expect.objectContaining({type:'blueprint-storage-policy',jobId:f.job.id,settings:expect.objectContaining({priority:5})}));
 expect(f.job.storage380!.priority).toBe(5);expect(f.job.storage380!.capacity).toBe(500);expect(f.job.storage380!.filters.furniture).toBeUndefined();expect(f.job.storage380!.filters.chunk).toBeUndefined();
 expect(f.actions.closePage).toHaveBeenCalledOnce();
});

test.each(['cancel','selection','map','policy']as const)('an old native storage draft refuses a changed %s owner instead of writing into its replacement',async change=>{
 const f=fixture();await control(f.page,'priority-select').select!.onChange('5');
 if(change==='cancel'){expect(applyCommand(f.world,{type:'cancel-job',jobId:f.job.id}).ok).toBe(true);expect(applyCommand(f.world,{type:'designate',kind:'small-shelf',x:17,z:18,orientation:0,material:'wood'}).ok).toBe(true);}
 else if(change==='selection')f.state.selectedObjects=[];
 else if(change==='map')f.state.epoch!++;
 else expect(applyCommand(f.world,{type:'blueprint-storage-policy',jobId:f.job.id,settings:{priority:2}}).ok).toBe(true);
 const before=serializeWorld(f.world);await expect(control(f.page,'apply').onActivate()).rejects.toThrow();expect(f.actions.command).not.toHaveBeenCalled();expect(serializeWorld(f.world)).toBe(before);expect(f.actions.closePage).not.toHaveBeenCalled();
});
