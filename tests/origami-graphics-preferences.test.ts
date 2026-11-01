import {afterEach,expect,test,vi} from 'vitest';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,GRAPHICS_STYLE_PREFERENCE_KEY,normalizeGraphicsStylePreferences,parseGraphicsStylePreferences,type GraphicsStylePreferences} from '../src/ui3d/native-preferences';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';

afterEach(()=>vi.unstubAllGlobals());

test('graphics preferences default safely for absent, corrupt and invalid enum storage',()=>{
  expect(GRAPHICS_STYLE_PREFERENCE_KEY).toBe('elsewhere.graphics-style.v1');
  for(const raw of [null,'','not-json','null','true','[]','"origami"','{}','{"style":"other"}'])expect(parseGraphicsStylePreferences(raw)).toEqual(DEFAULT_GRAPHICS_STYLE_PREFERENCES);
  expect(parseGraphicsStylePreferences('{"style":"origami","impasto":1e999,"edges":".2","wear":null,"contourImperfection":false}')).toEqual({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami'});
});

test('graphics settings clamp finite controls independently and round trip without changing their source',()=>{
  const input={style:'origami',impasto:99,edges:-1,wear:.123,contourImperfection:NaN},before={...input};
  const result=normalizeGraphicsStylePreferences(input);
  expect(result).toEqual({style:'origami',impasto:2.2,edges:0,wear:.123,contourImperfection:.6});
  expect(input).toEqual(before);expect(parseGraphicsStylePreferences(JSON.stringify(result))).toEqual(result);
  expect(normalizeGraphicsStylePreferences({...result,impasto:-Infinity,edges:Infinity,wear:NaN})).toEqual({...result,impasto:1,edges:.65,wear:.75});
});

function fixture(persist=true){
  vi.stubGlobal('window',{});
  let settings:GraphicsStylePreferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES},page:NativePage|undefined;
  const yes=()=>true,no=()=>false,noop=async()=>{};
  const change=vi.fn((value:GraphicsStylePreferences)=>{settings=normalizeGraphicsStylePreferences(value);return persist;});
  const options:FrontMenuOptions={onStart:noop,onLoad:noop,onResume:noop,
    getGraphicsStylePreferences:()=>({...settings}),onGraphicsStylePreferencesChange:change,
    getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,
    getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,
    getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,
    getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>.5,onSoundVolumeChange:yes,onTestSound:noop,
    getMusicEnabled:yes,onMusicEnabledChange:yes,getMusicVolume:()=>.5,onMusicVolumeChange:yes,
    getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport:noop};
  const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});menu.showOptions!();
  const control=(id:string):NativeControl=>{const value=[...page!.rows.flatMap(row=>row.controls??[]),...(page!.actions??[])].find(value=>value.id===id);if(!value)throw Error('Missing '+id);return value;};
  const click=async(id:string)=>control(id).onActivate();
  return {menu,options,change,control,click,get page(){return page!;},get settings(){return {...settings};}};
}

test('Graphismes offers default and Origami without changing any preference through local navigation',async()=>{
  const f=fixture();await f.click('option-section-graphics');
  expect(f.page.layout).toBe('setup');expect(f.page.rows.some(row=>row.id.startsWith('origami-'))).toBe(false);
  expect(f.control('graphics-style').select?.options).toEqual([{value:'default',label:'Par défaut'},{value:'origami',label:'Origami'}]);
  expect(f.change).not.toHaveBeenCalled();
  await f.control('graphics-style').select!.onChange('origami');
  expect(f.change).toHaveBeenCalledExactlyOnceWith({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami'});
  expect(f.page.rows.filter(row=>row.id.startsWith('origami-')).map(row=>[row.id,row.value])).toEqual([
    ['origami-impasto','100 %'],['origami-edges','65 %'],['origami-wear','75 %'],['origami-contourImperfection','60 %']]);
});

test('Origami ranges apply exact bounded settings through the backend and switching retains slider values',async()=>{
  const f=fixture();await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
  const input=(id:string)=>f.page.rows.find(row=>row.id===id)!.input!;
  await input('origami-impasto').onCommit('999');expect(f.settings.impasto).toBe(2.2);
  await input('origami-edges').onCommit('-5');expect(f.settings.edges).toBe(0);
  await input('origami-wear').onCommit('32');expect(f.settings.wear).toBe(.32);
  await input('origami-contourImperfection').onCommit('27');expect(f.settings.contourImperfection).toBe(.27);
  const before=f.change.mock.calls.length;expect(await input('origami-impasto').onCommit('Infinity')).toBe(false);expect(f.change).toHaveBeenCalledTimes(before);
  await f.control('graphics-style').select!.onChange('default');expect(f.page.rows.some(row=>row.id.startsWith('origami-'))).toBe(false);
  await f.control('graphics-style').select!.onChange('origami');expect(f.settings).toEqual({style:'origami',impasto:2.2,edges:0,wear:.32,contourImperfection:.27});
});

test('retained Origami controls refuse old renders, inactive style, other pages and busy operations',async()=>{
  const f=fixture();await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
  const old=f.page.rows.find(row=>row.id==='origami-wear')!.input!;
  await f.click('origami-edges-less');const before=f.change.mock.calls.length;
  expect(await old.onCommit('12')).toBe(false);expect(f.change).toHaveBeenCalledTimes(before);
  const fresh=f.page.rows.find(row=>row.id==='origami-wear')!.input!;
  f.menu.setBusy(true);expect(await fresh.onCommit('13')).toBe(false);f.menu.setBusy(false);
  await f.control('graphics-style').select!.onChange('default');expect(await fresh.onCommit('14')).toBe(false);
  const style=f.control('graphics-style');await f.click('front-back');await style.select!.onChange('origami');expect(f.change).toHaveBeenCalledTimes(before+1);
});

test('Origami applies immediately and reports unavailable browser persistence',async()=>{
  const f=fixture(false);await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
  expect(f.settings.style).toBe('origami');expect(f.page.rows.find(row=>row.id==='front-error')?.label).toContain('ce navigateur ne peut pas le conserver');
});

test('an async renderer switch blocks retained actions and reports failure while keeping the active style',async()=>{
  const f=fixture();await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
  const retained=f.page.rows.find(row=>row.id==='origami-wear')!.input!,otherCategory=f.control('option-section-audio');
  let refuse:(reason:Error)=>void=()=>{throw Error('Switch not started');};
  f.options.onGraphicsStylePreferencesChange=vi.fn(()=>new Promise<boolean>((_resolve,reject)=>{refuse=reject;}));
  const pending=f.control('graphics-style').select!.onChange('default');
  expect(f.page.rows.find(row=>row.id==='front-status')?.label).toContain('Application du style');
  expect(await retained.onCommit('11')).toBe(false);await otherCategory.onActivate();expect(f.page.rows.find(row=>row.id==='option-section-title')?.label).toBe('Graphismes');
  expect(f.options.onGraphicsStylePreferencesChange).toHaveBeenCalledOnce();
  refuse(Error('La préparation du rendu a échoué.'));await pending;
  expect(f.control('graphics-style').select?.value).toBe('origami');expect(f.page.rows.find(row=>row.id==='front-error')?.label).toBe('La préparation du rendu a échoué.');
  expect(f.control('graphics-style').disabled).toBe(false);
});

test('style measurement stays disabled without a paused-scene capability and retained actions recheck it',async()=>{
  const f=fixture();let allowed=false;const measure=vi.fn(async()=>{});
  f.options.onMeasureGraphicsStyle=measure;f.options.canMeasureGraphicsStyle=()=>allowed;f.menu.showOptions!();await f.click('option-section-graphics');
  expect(f.control('graphics-measure').label).toBe('Mesurer ce style (5 s)');expect(f.control('graphics-measure').disabled).toBe(true);
  await f.control('graphics-measure').onActivate();expect(measure).not.toHaveBeenCalled();
  expect(f.page.rows.find(row=>row.id==='graphics-measurement')?.label).toContain('GPU non mesuré');
  allowed=true;f.menu.showOptions!();const retained=f.control('graphics-measure');allowed=false;await retained.onActivate();expect(measure).not.toHaveBeenCalled();
});

test('measurement uses one guarded backend operation then reopens Graphismes with actual returned records',async()=>{
  const f=fixture();let release:()=>void=()=>{throw Error('Not measuring');},records='Aucune mesure.';
  f.options.canMeasureGraphicsStyle=()=>true;f.options.getGraphicsStyleMeasurement=()=>records;
  f.options.onMeasureGraphicsStyle=vi.fn(async()=>{f.menu.hide();await new Promise<void>(resolve=>{release=resolve;});records='Par défaut : 300 soumissions. Origami : non mesuré.';f.menu.showOptions!();});
  f.menu.showOptions!();await f.click('option-section-graphics');const retained=f.control('graphics-measure'),pending=retained.onActivate();
  expect(f.menu.isOpen()).toBe(false);await retained.onActivate();expect(f.options.onMeasureGraphicsStyle).toHaveBeenCalledOnce();
  release();await pending;expect(f.menu.isOpen()).toBe(true);expect(f.page.rows.find(row=>row.id==='option-section-title')?.label).toBe('Graphismes');
  expect(f.page.rows.find(row=>row.id==='graphics-measurement')?.label).toBe(records);expect(f.control('graphics-measure').disabled).toBe(false);
});

test('measurement failure reopens Options with its backend error and stale measurement controls cannot restart it',async()=>{
  const f=fixture();f.options.canMeasureGraphicsStyle=()=>true;f.options.onMeasureGraphicsStyle=vi.fn(async()=>{f.menu.hide();throw Error('La caméra a changé.');});
  f.menu.showOptions!();await f.click('option-section-graphics');const retained=f.control('graphics-measure');await retained.onActivate();
  expect(f.menu.isOpen()).toBe(true);expect(f.page.rows.find(row=>row.id==='front-error')?.label).toBe('La caméra a changé.');
  await retained.onActivate();expect(f.options.onMeasureGraphicsStyle).toHaveBeenCalledOnce();
});
