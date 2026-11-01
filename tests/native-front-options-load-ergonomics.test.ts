import {afterEach,expect,test,vi} from 'vitest';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions,FrontMenuSave} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';

afterEach(()=>vi.unstubAllGlobals());
function fixture(initial:FrontMenuSave[]=[]){
  // Metadata-only service fixture. No World, save bytes, parser, Engine or DOM layout.
  vi.stubGlobal('window',{});
  const writes=vi.fn((_key:string,_value:unknown)=>true),yes=()=>true,no=()=>false,noop=async()=>{};
  let saves=initial,page:NativePage|undefined;
  const options:FrontMenuOptions={onStart:noop,onLoad:vi.fn(noop),onResume:noop,
    getTexturesEnabled:yes,onTexturesEnabledChange:value=>writes('textures',value),
    getGroundGrassEnabled:yes,onGroundGrassEnabledChange:value=>writes('grass',value),
    getDioramaEnabled:yes,onDioramaEnabledChange:value=>writes('diorama',value),
    getRoomEnabled:yes,onRoomEnabledChange:value=>writes('room',value),
    getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:value=>writes('lighting',value),
    getSoundEnabled:no,onSoundEnabledChange:value=>writes('sound',value),getSoundVolume:()=>.5,onSoundVolumeChange:value=>writes('sound-volume',value),onTestSound:noop,
    getMusicEnabled:yes,onMusicEnabledChange:value=>writes('music',value),getMusicVolume:()=>.6,onMusicVolumeChange:value=>writes('music-volume',value),
    getSaves:()=>saves,getTestColonies:vi.fn(async()=>[]),onLoadTest:vi.fn(noop),onImport:vi.fn(noop),onExport:vi.fn(noop),
    getUiScale:()=>.75,onUiScaleChange:value=>writes('ui-scale',value),
    getAutosaveMinutes:()=>5,onAutosaveMinutesChange:value=>writes('autosave',value),
  };
  const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
  const all=()=>[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])];
  const control=(id:string):NativeControl=>{const value=all().find(value=>value.id===id);if(!value)throw Error('Missing '+id);return value;};
  const click=async(id:string)=>{const value=control(id);expect(value.disabled).not.toBe(true);await value.onActivate();};
  return{menu,writes,options,control,click,setSaves:(next:FrontMenuSave[])=>{saves=next;},get page(){return page!;}};
}
const examples=():FrontMenuSave[]=>[
  {key:'alpha',label:'Éclaircies',detail:'Trois personnes · jour4 ·325×325',kind:'named',savedAt:1000},
  {key:'beta',label:'Bastion',detail:'Deux personnes · jour12 ·250×250',kind:'auto',savedAt:2000},
];

test('Options uses real local categories without changing preferences, then preserves actual controls and busy refusal',async()=>{
  const f=fixture();f.menu.showOptions!();
  expect(f.page.layout).toBe('setup');expect(f.page.rows.filter(row=>row.region==='catalogue').map(row=>row.controls?.[0]?.label)).toEqual(['Jeu','Interface','Graphismes','Éclairage','Audio']);
  expect(f.page.rows.some(row=>row.id==='autosave')).toBe(true);
  await f.click('option-section-interface');expect(f.page.rows.some(row=>row.id==='ui-scale')).toBe(true);expect(f.page.rows.some(row=>row.id==='autosave')).toBe(false);
  expect(f.page.rows.every(row=>row.column===undefined)).toBe(true);expect(f.writes).not.toHaveBeenCalled();
  await f.click('ui-scale-more');expect(f.writes).toHaveBeenLastCalledWith('ui-scale',.8);
  await f.click('option-section-lighting');expect(f.page.rows.some(row=>row.id==='light-reset')).toBe(true);await f.click('light-sun-more');
  expect(f.writes).toHaveBeenLastCalledWith('lighting',{sun:1.05,moon:1,ambient:1});
  await f.click('option-section-audio');expect(f.page.rows.some(row=>row.id==='sound-volume')).toBe(true);expect(f.page.rows.some(row=>row.id==='light-reset')).toBe(false);
  const retainedCategory=f.control('option-section-graphics'),retainedVolume=f.control('sound-volume-more'),before=f.writes.mock.calls.length;
  f.menu.setBusy(true);await retainedCategory.onActivate();await retainedVolume.onActivate();
  expect(f.page.rows.find(row=>row.id==='option-section-title')?.label).toBe('Audio');expect(f.writes).toHaveBeenCalledTimes(before);
  expect(f.page.actions?.map(control=>control.id)).toEqual(['front-back']);
});

test('Load searches and selects metadata without opening a colony, preserving source order and available tools',async()=>{
  const saves=examples(),before=JSON.stringify(saves),f=fixture(saves);f.menu.showHome(true);f.menu.showLoad();
  expect(f.page.layout).toBe('setup');expect(f.control('load-selected').disabled).toBe(true);
  expect(f.page.actions?.map(control=>control.id)).toEqual(['front-back','test-colonies','import','export','load-selected']);
  await f.click('select-save-beta');expect(f.page.rows.find(row=>row.id==='selected-save-name')?.label).toBe('Bastion');
  expect(f.page.rows.find(row=>row.id==='selected-save-kind')?.value).toBe('Copie automatique');expect(f.options.onLoad).not.toHaveBeenCalled();
  const search=f.page.rows.find(row=>row.id==='load-search')?.input;expect(search).toBeDefined();await search!.onCommit('eclair');
  expect(f.page.rows.filter(row=>row.id.startsWith('save-')).map(row=>row.id)).toEqual(['save-alpha']);
  expect(f.control('load-selected').disabled).toBe(true);expect(f.options.onLoad).not.toHaveBeenCalled();expect(JSON.stringify(saves)).toBe(before);
});

test('Load rejects a retained different choice and the original handler still refuses a missing or newly disabled save',async()=>{
  const f=fixture(examples());f.menu.showLoad();await f.click('select-save-alpha');const old=f.control('load-selected');
  await f.click('select-save-beta');await old.onActivate();expect(f.options.onLoad).not.toHaveBeenCalled();
  expect(f.page.rows.find(row=>row.id==='front-error')?.label).toContain('choix de sauvegarde a changé');
  await f.click('select-save-alpha');const removed=f.control('load-selected');f.setSaves(examples().filter(save=>save.key!=='alpha'));await removed.onActivate();
  expect(f.options.onLoad).not.toHaveBeenCalled();expect(f.page.rows.find(row=>row.id==='front-error')?.label).toContain('sauvegarde n’est plus disponible');
  await f.click('select-save-beta');const disabled=f.control('load-selected');f.setSaves([{...examples()[1]!,disabled:true}]);await disabled.onActivate();
  expect(f.options.onLoad).not.toHaveBeenCalled();expect(f.page.rows.find(row=>row.id==='front-error')?.label).toContain('sauvegarde n’est plus disponible');
});

test('Load confirms the selected current key once and pending work blocks retained selection and search',async()=>{
  const f=fixture(examples());let release:()=>void=()=>{throw Error('Load not started');};
  f.options.onLoad=vi.fn(async()=>{await new Promise<void>(resolve=>{release=resolve;});});
  f.menu.showLoad();await f.click('select-save-alpha');const chosen=f.control('load-selected'),other=f.control('select-save-beta'),search=f.page.rows.find(row=>row.id==='load-search')!.input!;
  const pending=chosen.onActivate();await Promise.resolve();expect(f.options.onLoad).toHaveBeenCalledExactlyOnceWith('alpha');
  await other.onActivate();expect(await search.onCommit('bastion')).toBe(false);expect(f.page.rows.find(row=>row.id==='selected-save-name')?.label).toBe('Éclaircies');
  release();await pending;expect(f.options.onLoad).toHaveBeenCalledOnce();
});
