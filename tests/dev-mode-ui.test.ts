import {expect,test} from 'vitest';
import {createDeveloperMode,parseDeveloperMode,DEVELOPER_MODE_PREFERENCE_KEY} from '../src/ui/developer-mode.ts';
import {buildNativeDevPanel,devActionArgs,devTargetId,devTargetText,type DevPanelHost,type DevPanelView} from '../src/ui3d/native-dev-panel.ts';
import {devActionById,DEV_ACTIONS} from '../src/sim/dev-actions.ts';
import {createWorld} from '../src/sim/engine.ts';
import type {NativeUiState} from '../src/ui3d/native-contract.ts';

const memory=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},data};};

test('the developer mode is off by default and a browser preference, never a save',()=>{
  const store=memory(),sent:[boolean,boolean][]=[];
  const mode=createDeveloperMode(store,(e,g)=>sent.push([e,g]));
  expect(mode.enabled()).toBe(false);expect(mode.god()).toBe(false);expect(sent).toEqual([[false,false]]);
  expect(store.data.size).toBe(0); // nothing written until the player turns it on
  mode.setEnabled(true);expect(store.data.get(DEVELOPER_MODE_PREFERENCE_KEY)).toBe('{"enabled":true}');
  mode.setGod(true);expect(mode.god()).toBe(true);expect(sent.at(-1)).toEqual([true,true]);
  mode.setEnabled(false);expect(mode.god()).toBe(false);expect(sent.at(-1)).toEqual([false,false]); // god mode ends with the mode
  mode.setGod(true);expect(mode.god()).toBe(false);
  expect(createDeveloperMode(store,()=>undefined).enabled()).toBe(false);
  mode.setEnabled(true);
  const again=createDeveloperMode(store,()=>undefined);expect(again.enabled()).toBe(true);expect(again.god()).toBe(false); // god mode is not remembered
  expect(parseDeveloperMode('garbage')).toBe(false);expect(parseDeveloperMode(null)).toBe(false);
});

test('a browser that cannot keep the choice still applies it now',()=>{
  const mode=createDeveloperMode({getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}},()=>undefined);
  expect(mode.enabled()).toBe(false);expect(mode.setEnabled(true)).toBe(false);expect(mode.enabled()).toBe(true);
});

const state=(selected:number[]=[],animal?:number):NativeUiState=>({world:createWorld(7,32,32),panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:selected,selectedObjects:[],constructionMaterial:'wood',creationStorage:{} as never,speed:1,hasGame:true,busy:false,saves:[],...animal!==undefined?{selectedAnimalId:animal}:{}} as NativeUiState);
const host=(view:DevPanelView,calls:string[]):DevPanelHost=>({view,god:()=>false,setGod:on=>{calls.push(`god:${on}`);},run:(a,args)=>{calls.push(`run:${a.id}:${JSON.stringify(args)}`);},armed:()=>undefined,cancelArmed:()=>undefined,rebuild:()=>undefined,close:()=>undefined});

test('the window lists every action by group, filters by search and runs with the chosen parameters',()=>{
  const view:DevPanelView={search:'',args:{},collapsed:new Set()},calls:string[]=[];
  const page=buildNativeDevPanel(state(),host(view,calls));
  const ids=page.rows.map(r=>r.id);
  for(const action of DEV_ACTIONS)expect(ids).toContain(`dev-${action.id}`);
  expect(page.rows.filter(r=>r.id.startsWith('dev-group-')&&!r.id.startsWith('dev-group-toggle')).map(r=>r.label)).toEqual(expect.arrayContaining(['Besoins','Santé','Carte','Temps','Incidents']));
  const rest=page.rows.find(r=>r.id==='dev-need-rest')!;
  const select=rest.controls!.find(c=>c.select)!;select.select!.onChange('0');
  expect(view.args['need-rest']).toEqual({level:'0'});
  rest.controls!.find(c=>c.id==='dev-run-need-rest')!.onActivate();
  expect(calls).toEqual(['run:need-rest:{"level":"0"}']);
  view.search='météo';
  const filtered=buildNativeDevPanel(state(),host(view,calls));
  expect(filtered.rows.some(r=>r.id==='dev-weather-set')).toBe(true);expect(filtered.rows.some(r=>r.id==='dev-need-rest')).toBe(false);
  view.search='zzzz';expect(buildNativeDevPanel(state(),host(view,calls)).rows.some(r=>r.id==='dev-empty')).toBe(true);
});

test('actions on the selection find their target, and map actions wait for a cell',()=>{
  const w=createWorld(7,32,32),pawn=w.pawns[0]!;
  expect(devTargetText(state())).toMatch(/Aucune sélection/);
  expect(devTargetText({...state([pawn.id]),world:w})).toBe(`${pawn.name} (colon)`);
  expect(devTargetId({selectedPawnIds:[pawn.id]},'pawn')).toBe(pawn.id);
  expect(devTargetId({selectedPawnIds:[],selectedAnimalId:9},'creature')).toBe(9);
  expect(devTargetId({selectedPawnIds:[]},'pawn')).toBeUndefined();
  expect(devActionById('spawn-item')!.target).toBe('cell');
  expect(devActionArgs({search:'',args:{},collapsed:new Set()},devActionById('spawn-item')!)).toEqual({item:'steel',quantity:'50'});
});
