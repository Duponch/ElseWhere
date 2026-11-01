import {describe,expect,it,vi} from 'vitest';
import {applyCommand,createWorld} from '../src/sim/index';
import type {Command,Structure} from '../src/sim/types';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {buildNativePanel,buildNativeToolPalette} from '../src/ui3d/native-panels';
import {buildNativeInspector} from '../src/ui3d/native-inspector';

let epoch=611010;
function control(page:NativePage,id:string):NativeControl {
  const found=[...page.rows.flatMap(row=>row.controls??[]),...(page.actions??[])].find(control=>control.id===id);
  expect(found,`Contrôle natif absent : ${id}`).toBeDefined();return found!;
}
function fixture(){
  const world=createWorld(++epoch,16,16);
  const result=applyCommand(world,{type:'allowed-area-create',label:'Refuge'});
  expect(result.ok).toBe(true);
  for(const tile of world.tiles)delete tile.fogged;
  const state:NativeUiState={world,epoch,panel:'assign',category:'zones',tool:'select',orientation:0,
    selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},
    speed:0,hasGame:true,busy:false,saves:[]};
  const noop=()=>{};let page:NativePage;
  const commands=vi.fn(async(command:Command)=>applyCommand(world,command)),tool=vi.fn(),paint=vi.fn(),preview=vi.fn();
  const actions:NativeUiActions={command:commands,panel:noop,category:noop,tool,selectPawn:noop,speed:noop,rotate:noop,
    material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:next=>{page=next;},refresh:noop,
    readState:()=>state,paintAllowedArea:paint,previewAllowedArea:preview};
  return {world,state,actions,commands,tool,paint,preview,get area(){return world.allowedAreas![0]!;},get page(){return page;},
    show(next:NativePage){page=next;},async activate(id:string){await control(page,id).onActivate();}};
}
async function manage(f:ReturnType<typeof fixture>,origin:'zones'|'assign'){
  f.show(origin==='zones'?buildNativeToolPalette(f.state,f.actions,'zones'):buildNativePanel(f.state,f.actions)!);
  await f.activate(origin==='zones'?'zones-areas-open':'areas-manage');expect(f.page.id).toBe('allowed-areas');
}

describe('remaining Zones journeys preserve real owners and commands',()=>{
  it('opens management from Zones without repurposing the existing designation callbacks',async()=>{
    const f=fixture(),before=JSON.stringify(f.world);
    f.show(buildNativeToolPalette(f.state,f.actions,'zones'));
    // Existing tools remain map designations, independent of management UI.
    for(const id of ['stockpile','growing','build-roof','remove-roof','ignore-roof','home','remove-home']){
      await f.activate(`tool-${id}-select`);expect(f.tool).toHaveBeenLastCalledWith(id);
    }
    // The generated UI fixture has no snow owner; both snow tools correctly stay hidden.
    expect(f.world.snow).toBeUndefined();
    expect(f.page.rows.flatMap(row=>row.controls??[]).some(c=>c.id==='tool-snow-clear-select'||c.id==='tool-remove-snow-clear-select')).toBe(false);
    await f.activate('zones-areas-open');
    await f.activate(`area-${f.area.id}-expand`);expect(f.paint).toHaveBeenLastCalledWith(f.area.id,true);
    await f.activate(`area-${f.area.id}-shrink`);expect(f.paint).toHaveBeenLastCalledWith(f.area.id,false);
    await f.activate('allowed-areas-back');expect(f.page).toMatchObject({id:'map-tools-zones',palette:'zones'});
    expect(f.commands).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
  });

  it('cancels nested edits and confirmations into the manager, then returns to each opening context',async()=>{
    for(const origin of ['zones','assign'] as const){
      const f=fixture(),before=JSON.stringify(f.world),id=f.area.id;
      await manage(f,origin);
      await f.activate(`area-${id}-rename`);
      await f.page.rows.find(row=>row.id===`area-rename-${id}-input`)!.input!.onCommit('Brouillon non appliqué');
      await f.page.onClose!();expect(f.page.id).toBe('allowed-areas');
      await f.activate(`area-${id}-color`);await f.activate('area-color-8eb0bd');
      await f.activate(`area-color-${id}-back`);expect(f.page.id).toBe('allowed-areas');
      await f.activate(`area-${id}-paint`);
      await f.page.rows.find(row=>row.id==='from-x')!.input!.onCommit('4');
      await f.activate(`area-paint-${id}-back`);expect(f.page.id).toBe('allowed-areas');
      await f.activate(`area-${id}-delete`);await f.page.onClose!();expect(f.page.id).toBe('allowed-areas');
      await f.activate('allowed-areas-back');expect(f.page.id).toBe(origin==='zones'?'map-tools-zones':'assign');
      expect(f.commands).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
    }
  });

  it('keeps palette and precise hex local until Apply, refuses invalid hex, then commits its exact RGB',async()=>{
    const f=fixture(),id=f.area.id,before=JSON.stringify(f.world);
    await manage(f,'zones');await f.activate(`area-${id}-color`);
    await f.activate('area-color-8ca77b');
    expect(control(f.page,'area-color-current').color).toBe('#8ca77b');
    await f.activate(`area-color-${id}-back`);expect(f.commands).not.toHaveBeenCalled();
    await f.activate(`area-${id}-color`);
    await f.page.rows.find(row=>row.id==='area-color-input')!.input!.onCommit('#12GG34');
    await expect(f.activate('area-color-apply')).rejects.toThrow('Six chiffres hexadécimaux');
    expect(f.commands).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
    await f.page.rows.find(row=>row.id==='area-color-input')!.input!.onCommit('#0aB3F0');
    expect(f.commands).not.toHaveBeenCalled();
    await f.activate('area-color-apply');
    expect(f.commands).toHaveBeenCalledExactlyOnceWith({type:'allowed-area-settings',areaId:id,color:0x0ab3f0});
    expect(f.area.color).toBe(0x0ab3f0);expect(f.area.label).toBe('Refuge');expect(f.page.id).toBe('allowed-areas');
  });

  it('shows localized ground and basin choices, counts cells, and commits one crop with the fresh sow/cut policy',async()=>{
    const f=fixture(),zone={id:f.world.nextId++,cells:[119,120,135],plant:'rice' as const,allowSow:true,allowCut:false};
    f.world.growingZones=[zone];f.state.selectedObjects=[{kind:'growing',id:zone.id}];
    f.show(buildNativeInspector(f.state,f.actions)!);
    expect(f.page.rows.find(row=>row.id==='growing-size')?.value).toBe('3 cases');
    const select=control(f.page,'special-crop-select').select!;
    expect(select.value).toBe('rice');expect(select.options.find(option=>option.value==='potato')?.label).toBe('Pommes de terre');
    expect(select.options.some(option=>option.value==='corn')).toBe(true);
    await select.onChange('not-a-real-crop');expect(f.commands).not.toHaveBeenCalled();
    // A checkbox may have changed after this menu was painted; the crop action
    // must preserve the confirmed flags at activation, not its stale row snapshot.
    f.world.growingZones[0]!.allowSow=false;f.world.growingZones[0]!.allowCut=true;
    await select.onChange('potato');
    expect(f.commands).toHaveBeenCalledExactlyOnceWith({type:'growing-policy',zoneId:zone.id,plant:'potato',allowSow:false,allowCut:true});
    expect(f.world.growingZones[0]).toMatchObject({plant:'potato',allowSow:false,allowCut:true,cells:zone.cells});
    const basin:Structure={id:f.world.nextId++,kind:'hydroponics-basin',x:7,z:7,orientation:0,footprint:'standard'};
    f.world.structures.push(basin);f.world.growingZones[0]!.basinId=basin.id;
    f.state.selectedObjects=[{kind:'structure',id:basin.id}];f.show(buildNativeInspector(f.state,f.actions)!);
    const hydro=control(f.page,'special-crop-select').select!;
    expect(f.page.rows.find(row=>row.id==='special-crop-size')?.value).toBe('3 cases');
    expect(hydro.options.find(option=>option.value==='potato')?.label).toBe('Pommes de terre');
    expect(hydro.options.some(option=>option.value==='corn'||option.value==='haygrass')).toBe(false);
    await hydro.onChange('corn');expect(f.commands).toHaveBeenCalledTimes(1);
  });

  it('previews through hover/focus producers without commands, rejects stale entry and always cleans stale exit',async()=>{
    const f=fixture(),before=JSON.stringify(f.world),admittedEpoch=f.state.epoch;
    await manage(f,'zones');f.preview.mockClear();
    // Pointer hover and keyboard focus share this producer contract. The Stage
    // lifecycle itself is qualified separately by Root, outside these tests.
    for(const id of [`area-${f.area.id}-rename`,`area-${f.area.id}-color`]){
      const hover=control(f.page,id).onHover;expect(hover).toBeTypeOf('function');
      hover!(true);expect(f.preview).toHaveBeenLastCalledWith(f.area.id);
      hover!(false);expect(f.preview).toHaveBeenLastCalledWith(undefined);
    }
    const oldHover=control(f.page,`area-${f.area.id}-rename`).onHover!;
    f.state.epoch=(admittedEpoch??0)+1;f.preview.mockClear();
    oldHover(true);expect(f.preview).not.toHaveBeenCalled();
    oldHover(false);expect(f.preview).toHaveBeenCalledExactlyOnceWith(undefined);
    f.state.epoch=admittedEpoch;f.state.world=createWorld(f.world.seed+1,16,16);f.preview.mockClear();
    oldHover(true);expect(f.preview).not.toHaveBeenCalled();
    oldHover(false);expect(f.preview).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(f.commands).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
  });
});
