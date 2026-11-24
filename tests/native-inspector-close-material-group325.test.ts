import {expect,test} from 'vitest';
import {createWorld,applyCommand} from '../src/sim/index';
import {addMaterial} from '../src/sim/materials';
import {setMaterialForbidden256,materialAllowedForPlayer256} from '../src/sim/material-permission-256';
import {mapObjectGroupActions} from '../src/ui/map-object-actions';
import {buildNativeInspector} from '../src/ui3d/native-inspector';
import type {NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import type {World,Command} from '../src/sim/types';

// Component fixtures only. No Engine Core, campaign RAW, Native receipt or browser.
let epoch=325000;
function baseState(world:World):NativeUiState{return {world,epoch:++epoch,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:2,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};}
function host(state:NativeUiState,withClosePage=true){
 let custom:NativePage|undefined,shown:NativePage|null=null,clears=0,releases=0;
 const noop=()=>{},refresh=()=>{shown=custom??buildNativeInspector(state,actions);};
 const actions:NativeUiActions={command:async c=>applyCommand(state.world!,c),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:page=>{custom=page;shown=page;},refresh,readState:()=>state,clearSelection:()=>{clears++;state.selectedPawnIds=[];state.selectedObjects=[];state.selectedCell=undefined;refresh();},...withClosePage?{closePage:()=>{releases++;custom=undefined;refresh();}}:{}};
 refresh();return {actions,refresh,get page(){return shown;},get custom(){return custom;},get clears(){return clears;},get releases(){return releases;}};
}
async function storageFixture(withClosePage=true){
 const world=createWorld(325,16,16),pile:World['stockpiles'][number]={id:world.nextId++,x:7,z:8,priority:3,capacity:75,filters:{wood:true,food:true}};world.stockpiles=[pile];delete world.tiles[8*world.width+7]!.fogged;
 const state=baseState(world);state.selectedObjects=[{kind:'stockpile',id:pile.id}];const h=host(state,withClosePage);
 await h.page!.actions!.find(c=>c.id==='stockpile-settings')!.onActivate();expect(h.custom?.id).toBe('inspect-storage-'+pile.id);
 const rotten=h.page!.rows.find(r=>r.id==='rotten')!.controls![0]!;await rotten.onActivate();expect(pile.allowRotten).toBe(false);return {world,state,h};
}
test('storage inspector close releases the retained custom page after a real policy repaint',async()=>{
 for(const method of ['X/Escape','Fermer'] as const){const f=await storageFixture(),before=JSON.stringify(f.world);
  if(method==='X/Escape')f.h.page!.onClose!();else await f.h.page!.actions!.find(c=>c.id==='inspect-close')!.onActivate();
  expect(f.h.clears).toBe(1);expect(f.h.releases).toBe(1);expect(f.h.custom).toBeUndefined();expect(f.h.page).toBeNull();expect(f.state.selectedObjects).toEqual([]);expect(JSON.stringify(f.world)).toBe(before);
 }
});
test('inspector consumers without a custom-page close API keep the selection-only contract',async()=>{
 const f=await storageFixture(false);f.h.page!.onClose!();expect(f.h.clears).toBe(1);expect(f.h.releases).toBe(0);expect(f.state.selectedObjects).toEqual([]);
});
function permissionFixture(){
 const world=createWorld(326,16,16);world.piles=[];world.structures=[];
 for(let i=0;i<3;i++){world.tiles[5*world.width+4+i]={terrain:'soil'};addMaterial(world,'food',10,{type:'ground',x:4+i,z:5},'survival-meal');}
 const piles=world.piles.filter(p=>p.item==='survival-meal');expect(piles).toHaveLength(3);return {world,piles};
}
test('the Core mixed-group permission deactivates the allowed gizmos in both selection orders',()=>{
 for(const firstForbidden of [true,false]){const {world,piles}=permissionFixture();setMaterialForbidden256(piles[0]!,firstForbidden);setMaterialForbidden256(piles[1]!,!firstForbidden);setMaterialForbidden256(piles[2]!,firstForbidden);
  const before={tick:world.tick,rng:world.rng,nextId:world.nextId,rows:piles.map(p=>[p.id,p.quantity,{...p.owner}])},selection=piles.map(p=>({kind:'pile' as const,id:p.id})),group=mapObjectGroupActions(world,selection).find(a=>a.id==='material-permission')!;
  const eligible=piles.filter(materialAllowedForPlayer256);
  expect(group.label).toBe('Interdire');expect(group.commands).toEqual(eligible.map(p=>({type:'material-forbid',pileId:p.id,forbidden:true})));
  for(const command of group.commands)expect(applyCommand(world,command).ok).toBe(true);
  expect(piles.map(materialAllowedForPlayer256)).toEqual([false,false,false]);expect({tick:world.tick,rng:world.rng,nextId:world.nextId,rows:piles.map(p=>[p.id,p.quantity,{...p.owner}])}).toEqual(before);
 }
});
test('the real Native group waits for ACK and stops at refusal before touching a later pile',async()=>{
 const {world,piles}=permissionFixture();for(const p of piles)setMaterialForbidden256(p,true);const state=baseState(world);state.selectedObjects=piles.map(p=>({kind:'pile',id:p.id}));const h=host(state),calls:Command[]=[];let release!:()=>void;const ack=new Promise<void>(resolve=>{release=resolve;});
 h.actions.command=async command=>{calls.push(command);if(calls.length===1){await ack;return applyCommand(world,command);}return {ok:false,reason:'Declared second-pile refusal'};};h.refresh();const action=h.page!.actions!.find(c=>c.id==='group-action-material-permission')!;
 const pending=action.onActivate();expect(calls).toHaveLength(1);expect(piles.map(materialAllowedForPlayer256)).toEqual([false,false,false]);release();await pending;
 expect(calls).toHaveLength(2);expect(piles.map(materialAllowedForPlayer256)).toEqual([true,false,false]);expect(h.page?.rows.some(r=>r.label.includes('Declared second-pile refusal'))).toBe(true);
});
