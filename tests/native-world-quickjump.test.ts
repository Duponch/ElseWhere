import {describe,expect,it,vi} from 'vitest';
import {buildNativeWorld,setNativeWorldTab} from '../src/ui3d/native-world';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {campaignPresentation} from '../src/sim/secondary-site-presentation';
import type {World} from '../src/sim/types';
import type {CampaignMapPresentation} from '../src/sim/world-map-state';
import {registryCamp,preparedMap} from './helpers/world-maps-v255';
import {reorganizationCamp256} from './helpers/group-reorganization-v256';

let epoch=613800;
function fixture(root:World){
 const view=campaignPresentation(root),state:NativeUiState={world:view,epoch:++epoch,panel:'world',category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 let page:NativePage;const noop=()=>{};
 const command=vi.fn<NativeUiActions['command']>(async()=>({ok:true}));
 const actions:NativeUiActions={readState:()=>state,command,showPage:next=>{page=next;},refresh:vi.fn(),panel:vi.fn(),category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
 const rebuild=()=>{page=buildNativeWorld(state,actions);};setNativeWorldTab('maps');rebuild();
 return{root,view,state,actions,command,rebuild,get page(){return page;}};
}
function control(page:NativePage,id:string):NativeControl{const value=[...page.rows.flatMap(row=>row.controls??[]),...(page.actions??[])].find(control=>control.id===id);expect(value,'Missing '+id).toBeDefined();return value!;}

describe('World quick jump keeps local selection separate from confirmed navigation',()=>{
 it('chooses a real map without a command, then sends only its recorded id and preserves send refusal',async()=>{
  const root=registryCamp();preparedMap(root);const mapId=root.worldMaps!.sites.find(map=>map.id!==root.worldMaps!.rootMapId)!.id;
  const f=fixture(root),before=JSON.stringify(root),pick=control(f.page,'world-jump-choice');
  expect(f.page.rows.find(row=>row.id==='world-quickjump')?.region).toBe('navigation');
  expect(pick.select!.options.some(option=>option.value==='map:'+mapId)).toBe(true);
  await pick.select!.onChange('map:'+mapId);expect(f.command).not.toHaveBeenCalled();expect(JSON.stringify(root)).toBe(before);
  expect(control(f.page,'world-jump-choice').select!.value).toBe('map:'+mapId);
  await control(f.page,'world-jump-go').onActivate();expect(f.command).toHaveBeenCalledExactlyOnceWith({type:'map-view',mapId});expect(JSON.stringify(root)).toBe(before);
  f.command.mockResolvedValueOnce({ok:false,reason:'refus déclaré quickjump'});
  await expect(control(f.page,'world-jump-go').onActivate()).rejects.toThrow('refus déclaré quickjump');expect(JSON.stringify(root)).toBe(before);
 });

 it('rechecks busy, fault, epoch, existence and actual map permission before a retained Go control',async()=>{
  const root=registryCamp();preparedMap(root);const mapId=root.worldMaps!.sites.find(map=>map.id!==root.worldMaps!.rootMapId)!.id,f=fixture(root);
  await control(f.page,'world-jump-choice').select!.onChange('map:'+mapId);let go=control(f.page,'world-jump-go');
  f.state.busy=true;await go.onActivate();f.state.busy=false;f.state.fault='Arrêt courant';await go.onActivate();delete f.state.fault;
  expect(f.command).not.toHaveBeenCalled();f.state.epoch!++;f.rebuild();await go.onActivate();expect(f.command).not.toHaveBeenCalled();
  await control(f.page,'world-jump-choice').select!.onChange('map:'+mapId);go=control(f.page,'world-jump-go');
  const maps=(f.view.campaignMap! as CampaignMapPresentation).maps,index=maps.findIndex(map=>map.id===mapId),[removed]=maps.splice(index,1);await go.onActivate();expect(f.command).not.toHaveBeenCalled();maps.splice(index,0,removed!);
  const permission=removed!.actions.view;removed!.actions.view={ok:false,reason:'Accès retiré'};await go.onActivate();expect(f.command).not.toHaveBeenCalled();removed!.actions.view=permission;
  await control(f.page,'world-jump-choice').select!.onChange('map:9007199254740991');expect(f.command).not.toHaveBeenCalled();
 });

 it('selects the real group and its existing dossier, and suppresses late navigation after a context replacement',async()=>{
  const {w,g}=reorganizationCamp256(),f=fixture(w),before=JSON.stringify(w);
  await control(f.page,'world-jump-choice').select!.onChange('group:'+g.id);expect(f.command).not.toHaveBeenCalled();
  await control(f.page,'world-jump-go').onActivate();expect(f.command).toHaveBeenCalledExactlyOnceWith({type:'group-select',groupId:g.id});expect(f.page.id).toBe('group-'+g.id);expect(JSON.stringify(w)).toBe(before);
  f.command.mockClear();f.state.epoch!++;setNativeWorldTab('maps');f.rebuild();await control(f.page,'world-jump-choice').select!.onChange('group:'+g.id);
  let release!:(result:unknown)=>void;const held=new Promise<unknown>(resolve=>{release=resolve;});f.command.mockImplementationOnce(()=>held);
  const go=control(f.page,'world-jump-go'),pending=go.onActivate();await go.onActivate();expect(f.command).toHaveBeenCalledTimes(1);
  f.state.epoch!++;setNativeWorldTab('maps');f.rebuild();const replacementPage=f.page;release({ok:true});await pending;
  expect(f.page).toBe(replacementPage);expect(f.page.id).toBe('world');expect(JSON.stringify(w)).toBe(before);
 });
});

it('keeps selected-tile facts first and closes a confirmed map jump only in its retained live context',async()=>{
 const root=registryCamp();preparedMap(root);const f=fixture(root),before=JSON.stringify(root),mapId=root.worldMaps!.sites.find(m=>m.id!==root.worldMaps!.rootMapId)!.id;
 const firstKey=f.page.contentKey;await f.page.rows.find(r=>r.id==='world-tile')!.input!.onCommit('52');
 expect(f.page.contentKey).not.toBe(firstKey);expect(f.page.layout).toBe('world');
 expect(f.page.rows.find(r=>r.id==='world-tabs')?.region).toBe('navigation');
 expect(f.page.rows.findIndex(r=>r.id==='world-selected-tile')).toBeLessThan(f.page.rows.findIndex(r=>/^map-\d+$/.test(r.id)));
 await control(f.page,'world-jump-choice').select!.onChange('map:'+mapId);
 // Explicitly publish only a confirmed host presentation for this navigation
 // contract; no engine command or campaign owner is changed by the spy.
 f.command.mockImplementationOnce(async()=>{const summary=structuredClone(f.state.world!.campaignMap! as CampaignMapPresentation);summary.activeMapId=mapId;for(const map of summary.maps)map.selected=map.id===mapId;f.state.world={...f.view,campaignMap:summary};return{ok:true};});
 await control(f.page,'world-jump-go').onActivate();expect(f.actions.panel).toHaveBeenCalledExactlyOnceWith(null);expect(JSON.stringify(root)).toBe(before);
 f.actions.panel=vi.fn();f.state.epoch!++;f.rebuild();await control(f.page,'world-jump-choice').select!.onChange('map:'+mapId);
 let release!:(result:unknown)=>void;const held=new Promise<unknown>(resolve=>{release=resolve;});f.command.mockImplementationOnce(()=>held);
 const pending=control(f.page,'world-jump-go').onActivate();f.state.epoch!++;f.rebuild();release({ok:true});await pending;
 expect(f.actions.panel).not.toHaveBeenCalled();expect(JSON.stringify(root)).toBe(before);
});
