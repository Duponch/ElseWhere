import {describe,expect,it,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {buildNativePanel} from '../src/ui3d/native-panels';
import {buildNativeFactions} from '../src/ui3d/native-world';
import {createNativeSaveManager} from '../src/ui3d/native-saves';
import {NAMED_SAVE_KEYS} from '../src/ui/save-slots';
import {layoutNativePage,nativeTableRowScroll} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import type {World} from '../src/sim/types';

let epoch=612600;
function fixture(){
 const world=createWorld(++epoch,16,16),state:NativeUiState={world,epoch,panel:'menu',category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:false}},speed:0,hasGame:true,busy:false,saves:[]};
 let page:NativePage;const noop=()=>{};
 const actions:NativeUiActions={readState:()=>state,command:vi.fn(async()=>({ok:true})),showPage:next=>{page=next;},refresh:noop,panel:vi.fn(),category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:vi.fn(),save:vi.fn(),exportSave:vi.fn(),openOptions:vi.fn(),openHelp:vi.fn()};
 const menu=()=>{state.panel='menu';page=buildNativePanel(state,actions)!;};
 const factions=()=>{state.panel=null;page=buildNativeFactions(state,actions);};menu();
 return{world,state,actions,menu,factions,get page(){return page;}};
}
function control(page:NativePage,id:string):NativeControl{
 const found=[...(page.actions??[]),...page.rows.flatMap(row=>row.controls??[])].find(value=>value.id===id);expect(found,'Missing '+id).toBeDefined();return found!;
}
function registry(world:World){
 const tiles=Array.from({length:128},(_,i)=>({biome:'temperate-forest' as const,hilliness:'flat' as const,neighbours:[(i+127)%128,(i+1)%128]}));
 const generated=generateForeignWorldFactions256({version:world.schemaVersion,tick:world.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:world.nextId,random:new WorldGenerationRandom(821)});
 if(!generated.ok)throw Error(generated.reason);
 const completed=completeWorldFactionRegistry256({version:world.schemaVersion,draft:generated.draft,playerDef:'PlayerColony',name:'Camp UI',postWorldRandom:new WorldGenerationRandom(821)});
 if(!completed.ok)throw Error(completed.reason);world.worldFactions=completed.registry;world.nextId=generated.nextThingId;return completed.registry;
}

describe('Factions and Menu compact navigation keeps the existing authorities',()=>{
 it('opens the real named-save manager directly and retains Options and help callbacks ahead of optional metadata',async()=>{
  const f=fixture(),key=NAMED_SAVE_KEYS[0]!;f.state.saves=[{key,label:'Avant la pluie',kind:'named',detail:'Métadonnées témoins seulement.'}];
  const manager=createNativeSaveManager({readSaves:()=>f.state.saves,refresh:async()=>{},save:async()=>{await f.actions.save();},saveNamed:async()=>{},deleteSave:async()=>{},load:async()=>{},exportSave:async()=>{},show:f.actions.showPage,close:()=>{},blocked:()=>false});
  f.actions.openSaveManager=vi.fn(()=>manager.open());f.menu();const before=structuredClone(f.world);
  expect(f.page.width).toBe(450);expect(f.page.rows.some(row=>row.id==='menu-save-'+key)).toBe(false);
  await control(f.page,'native-manage-saves').onActivate();expect(f.page.id).toBe('native-saves');expect(f.page.rows.some(row=>row.id==='native-save-name')).toBe(true);
  f.menu();await control(f.page,'native-options').onActivate();expect(f.actions.openOptions).toHaveBeenCalledTimes(1);
  await control(f.page,'native-help').onActivate();expect(f.actions.openHelp).toHaveBeenCalledTimes(1);
  await control(f.page,'menu-copies-toggle').onActivate();expect(f.page.rows.find(row=>row.id==='menu-save-'+key)?.label).toBe('Avant la pluie');
  expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();manager.dispose();
 });

 it('folds old-format activations without executing one and refuses stale or busy controls while retaining fault save guards',async()=>{
  const f=fixture();delete f.world.climate;delete f.world.raids;delete f.world.gameProfile;delete f.world.heatwaves;f.menu();
  expect(f.page.rows.some(row=>row.id==='legacy-climate')).toBe(false);
  const staleOptions=control(f.page,'native-options');await control(f.page,'menu-legacy-toggle').onActivate();
  expect(f.page.rows.some(row=>row.id==='legacy-climate')).toBe(true);expect(f.actions.command).not.toHaveBeenCalled();
  const adoption=control(f.page,'legacy-climate-adopt');f.state.busy=true;await adoption.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  f.state.busy=false;f.state.epoch!++;f.menu();await staleOptions.onActivate();expect(f.actions.openOptions).not.toHaveBeenCalled();
  expect(f.page.rows.some(row=>row.id==='legacy-climate')).toBe(false);
  await control(f.page,'menu-legacy-toggle').onActivate();await control(f.page,'legacy-climate-adopt').onActivate();
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'climate-adopt'});
  f.state.fault='Arrêt témoin';f.menu();expect(control(f.page,'menu-save').disabled).toBe(true);expect(control(f.page,'menu-export').disabled).toBe(true);expect(control(f.page,'menu-resume').disabled).toBe(true);
  await control(f.page,'menu-save').onActivate();expect(f.actions.save).not.toHaveBeenCalled();
 });

 it('compares visible faction facts in compact rows, searches accents and establishments, and sorts only the presentation',async()=>{
  const f=fixture(),r=registry(f.world),foreign=r.factions.find(value=>!value.hidden&&value.id!==r.playerFactionId&&r.settlements.some(settlement=>settlement.factionId===value.id))!;
  foreign.name='Écume du levant';const settlement=r.settlements.find(value=>value.factionId===foreign.id);expect(settlement).toBeDefined();settlement!.name='Havre des iris';
  f.factions();const before=structuredClone(f.world),all=r.factions.filter(value=>!value.hidden);
  expect(f.page.layout).toBe('table');expect(f.page.tableProfile).toBe('factions');expect(f.page.rows.filter(row=>/^faction-\d+$/.test(row.id))).toHaveLength(all.length);
  const geometry=layoutNativePage(f.page,{width:1280,height:900},false,(text,size)=>text.length*size*.55),heading=geometry.rows.find(row=>row.row.id==='factions-heading')!,search=geometry.rows.find(row=>row.row.id==='factions-search')!,bodyRow=geometry.rows.find(row=>row.row.id==='faction-'+foreign.id)!;
  expect(search.row.region).toBe('details');expect(geometry.tableHeader!.y).toBeGreaterThanOrEqual(geometry.regions.details!.y+geometry.regions.details!.height);expect(geometry.body.y).toBeGreaterThanOrEqual(geometry.tableHeader!.y+geometry.tableHeader!.height);
  expect(nativeTableRowScroll(geometry,heading.row,80)).toBe(0);expect(nativeTableRowScroll(geometry,bodyRow.row,80)).toBe(80);expect(geometry.regions.navigation!.y).toBe(geometry.body.y);
  expect(f.page.rows.some(row=>row.id.startsWith('faction-settlement-'))).toBe(false);
  const facts=f.page.rows.find(row=>row.id==='faction-'+foreign.id)!.controls!.map(value=>value.label);
  expect(facts).toContain(r.leaders.find(value=>value.factionId===foreign.id)!.pawn.name);expect(facts).toContain(String(r.settlements.filter(value=>value.factionId===foreign.id).length));
  for(const hidden of r.factions.filter(value=>value.hidden))expect(f.page.rows.some(row=>row.id==='faction-'+hidden.id)).toBe(false);
  await f.page.rows.find(row=>row.id==='factions-search')!.input!.onCommit('ecume');expect(f.page.rows.filter(row=>/^faction-\d+$/.test(row.id)).map(row=>row.id)).toEqual(['faction-'+foreign.id]);
  await f.page.rows.find(row=>row.id==='factions-search')!.input!.onCommit('havre des iris');expect(f.page.rows.filter(row=>/^faction-\d+$/.test(row.id)).map(row=>row.id)).toEqual(['faction-'+foreign.id]);
  await f.page.rows.find(row=>row.id==='factions-search')!.input!.onCommit('');await control(f.page,'factions-sort-settlements').onActivate();
  const counts=f.page.rows.filter(row=>/^faction-\d+$/.test(row.id)).map(row=>Number(row.controls![3]!.label));expect(counts).toEqual([...counts].sort((a,b)=>b-a));
  expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('opens only the chosen faction settlements and resolves the original target again before the existing globe route',async()=>{
  const f=fixture(),r=registry(f.world),target=r.settlements.find(value=>r.factions.some(faction=>faction.id===value.factionId&&!faction.hidden))!;
  f.factions();await control(f.page,'faction-'+target.factionId+'-field-5').onActivate();expect(f.page.id).toBe('faction-detail-'+target.factionId);
  expect(f.page.rows.filter(row=>row.id.startsWith('faction-settlement-'))).toHaveLength(r.settlements.filter(value=>value.factionId===target.factionId).length);
  const stale=control(f.page,'faction-settlement-'+target.id+'-view'),staleBack=control(f.page,'faction-detail-back'),staleClose=f.page.onClose!;
  f.state.epoch!++;f.menu();await stale.onActivate();await staleBack.onActivate();staleClose();expect(f.page.id).toBe('menu');
  f.factions();await control(f.page,'faction-'+target.factionId+'-field-5').onActivate();const inspect=control(f.page,'faction-settlement-'+target.id+'-view');
  const index=r.settlements.indexOf(target);r.settlements.splice(index,1);await inspect.onActivate();expect(f.page.id).toBe('faction-detail-'+target.factionId);
  r.settlements.splice(index,0,target);await inspect.onActivate();expect(f.page.id).toBe('world');expect(f.actions.command).not.toHaveBeenCalled();
 });
});
