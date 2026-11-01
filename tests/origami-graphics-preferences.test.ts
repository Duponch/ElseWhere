import {afterEach,expect,test,vi} from 'vitest';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,GRAPHICS_STYLE_PREFERENCE_KEY,ORIGAMI_STYLE_CONTROLS,normalizeGraphicsStylePreferences,parseGraphicsStylePreferences,formatOrigamiStyleValue,origamiStyleDisplayScale,type GraphicsStylePreferences} from '../src/ui3d/native-preferences';
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
  expect(result).toEqual({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:2.2,blackEdges:0,edges:0,wear:.123,contourImperfection:.6});
  expect(input).toEqual(before);expect(parseGraphicsStylePreferences(JSON.stringify(result))).toEqual(result);
  expect(normalizeGraphicsStylePreferences({...result,impasto:-Infinity,edges:Infinity,wear:NaN})).toEqual({...result,impasto:1,edges:.65,wear:.75});
});

test('legacy v1 preferences preserve their actual contour intensity once and then keep the black control independent',()=>{
  const legacy={style:'origami',impasto:1.3,edges:.8,wear:.25,contourImperfection:.4},raw=JSON.stringify(legacy),migrated=parseGraphicsStylePreferences(raw);
  expect(migrated.blackEdges).toBeCloseTo(legacy.edges*(1-Math.min(1,legacy.wear*(.2+legacy.contourImperfection*1.15))*.45),14);
  expect(migrated).toMatchObject(legacy);expect(JSON.stringify(legacy)).toBe(raw);
  const restored=parseGraphicsStylePreferences(JSON.stringify(migrated));
  expect(normalizeGraphicsStylePreferences({...restored,edges:0,wear:1,contourImperfection:1}).blackEdges).toBe(migrated.blackEdges);
  expect(parseGraphicsStylePreferences(JSON.stringify({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,blackEdges:undefined})).blackEdges).toBe(.45475625);
});

test('black contour settings have their own finite bounds and do not overwrite the original paper controls',()=>{
  const base={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami' as const,edges:.2,wear:.3,contourImperfection:.4};
  for(const [value,expected]of [[-2,0],[3,1],[.237,.237],[NaN,.45475625],[Infinity,.45475625],['.4',.45475625],[null,.45475625]] as const){
    const actual=normalizeGraphicsStylePreferences({...base,blackEdges:value});expect(actual.blackEdges).toBe(expected);expect(actual).toMatchObject({edges:.2,wear:.3,contourImperfection:.4});
  }
  expect(ORIGAMI_STYLE_CONTROLS.map(({key,label})=>[key,label])).toEqual([
    ['impasto','Relief empâtement gouache'],['blackEdges','Contours noirs'],['edges','Contours carton d’origine'],['edgeWidth','Épaisseur des contours'],['strokeImperfection','Irrégularité du trait'],['wear','Usure et écaillage des arêtes'],['contourImperfection','Imperfection du remplissage des contours'],
  ]);
});

test('contour width migrates v1 to a physical multiplier of one with finite independent bounds',()=>{
 const legacy={style:'origami',impasto:1.4,blackEdges:.33,edges:.8,wear:.2,contourImperfection:.4};
 expect(parseGraphicsStylePreferences(JSON.stringify(legacy))).toEqual({...legacy,edgeWidth:1,strokeImperfection:.45});
 for(const [value,expected]of [[-2,.5],[.5,.5],[2.4,2.4],[99,5],[NaN,1],[Infinity,1],['2',1],[null,1]] as const){
  expect(normalizeGraphicsStylePreferences({...legacy,edgeWidth:value})).toEqual({...legacy,edgeWidth:expected,strokeImperfection:.45});
 }
 const control=ORIGAMI_STYLE_CONTROLS.find(control=>control.key==='edgeWidth')!;
 expect(control).toMatchObject({label:'Épaisseur des contours',min:.5,max:5,step:.1,unit:'×'});
 expect(origamiStyleDisplayScale(control)).toBe(1);expect(formatOrigamiStyleValue(control,.5)).toBe('0.5 ×');expect(formatOrigamiStyleValue(control,2.4)).toBe('2.4 ×');
 const intensity=ORIGAMI_STYLE_CONTROLS.find(control=>control.key==='blackEdges')!;
 expect(origamiStyleDisplayScale(intensity)).toBe(100);expect(formatOrigamiStyleValue(intensity,.37)).toBe('37 %');
});

test('stroke imperfection migrates v1 independently and explicit zero preserves a regular stroke',()=>{
 const legacy={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami' as const,edgeWidth:2.4,blackEdges:.37,edges:.2,wear:.3,contourImperfection:.8};
 const {strokeImperfection:_,...oldV1}=legacy;
 expect(parseGraphicsStylePreferences(JSON.stringify(oldV1))).toEqual({...oldV1,strokeImperfection:.45});
 for(const [value,expected]of [[0,0],[-1,0],[3,1],[.237,.237],[NaN,.45],[Infinity,.45],['.2',.45],[null,.45]] as const){
  expect(normalizeGraphicsStylePreferences({...oldV1,strokeImperfection:value})).toEqual({...oldV1,strokeImperfection:expected});
 }
 const control=ORIGAMI_STYLE_CONTROLS.find(control=>control.key==='strokeImperfection')!;
 expect(control).toMatchObject({label:'Irrégularité du trait',min:0,max:1,step:.01,unit:'%'});
 expect(origamiStyleDisplayScale(control)).toBe(100);expect(formatOrigamiStyleValue(control,.45)).toBe('45 %');
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
    ['origami-impasto','100 %'],['origami-blackEdges','45 %'],['origami-edges','65 %'],['origami-edgeWidth','1 ×'],['origami-strokeImperfection','45 %'],['origami-wear','75 %'],['origami-contourImperfection','60 %']]);
  expect(f.page.rows.filter(row=>row.id.startsWith('origami-')).every(row=>row.compact&&row.dense&&row.region==='details')).toBe(true);
  expect(f.page.rows.find(row=>row.id==='origami-edges')!.label).toBe('Contours carton d’origine');
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
  await f.control('graphics-style').select!.onChange('origami');expect(f.settings).toEqual({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:2.2,edges:0,wear:.32,contourImperfection:.27});
});

test('native black contours remain independent and retain their value across styles',async()=>{
  const f=fixture();await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
  const input=(id:string)=>f.page.rows.find(row=>row.id===id)!.input!;
  expect(f.page.rows.find(row=>row.id==='origami-blackEdges')!.label).toBe('Contours noirs');
  await input('origami-blackEdges').onCommit('37');expect(f.settings.blackEdges).toBe(.37);
  const other={edges:f.settings.edges,wear:f.settings.wear,contourImperfection:f.settings.contourImperfection};
  expect(other).toEqual({edges:.65,wear:.75,contourImperfection:.6});
  await input('origami-edges').onCommit('0');await input('origami-wear').onCommit('0');await input('origami-contourImperfection').onCommit('100');
  expect(f.settings.blackEdges).toBe(.37);
  await f.control('graphics-style').select!.onChange('default');await f.control('graphics-style').select!.onChange('origami');
  expect(f.settings.blackEdges).toBe(.37);expect(input('origami-blackEdges').value).toBe('37');
});

test('native contour width commits physical multiplier units with a tenth step and preserves the other controls',async()=>{
 const f=fixture();await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
 const input=()=>f.page.rows.find(row=>row.id==='origami-edgeWidth')!.input!;
 const before={...f.settings};expect(input().value).toBe('1');
 await input().onCommit('2.4');expect(f.settings.edgeWidth).toBeCloseTo(2.4,12);expect(f.page.rows.find(row=>row.id==='origami-edgeWidth')!.value).toBe('2.4 ×');
 const {edgeWidth:_,...oldControls}=f.settings,{edgeWidth:__,...previousControls}=before;expect(oldControls).toEqual(previousControls);
 await input().onCommit('0');expect(f.settings.edgeWidth).toBe(.5);expect(f.page.rows.find(row=>row.id==='origami-edgeWidth')!.value).toBe('0.5 ×');
 await f.click('origami-edgeWidth-more');expect(f.settings.edgeWidth).toBeCloseTo(.6,12);
 await input().onCommit('99');expect(f.settings.edgeWidth).toBe(5);
 await f.control('graphics-style').select!.onChange('default');await f.control('graphics-style').select!.onChange('origami');expect(input().value).toBe('5');
});

test('native irregularity uses percent units independently of width and restores exact zero through the backend',async()=>{
 const f=fixture();await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
 const input=()=>f.page.rows.find(row=>row.id==='origami-strokeImperfection')!.input!;
 const before={...f.settings};expect(input().value).toBe('45');
 expect(f.page.rows.find(row=>row.id==='origami-strokeImperfection')!.label).toBe('Irrégularité du trait');
 await input().onCommit('27');expect(f.settings.strokeImperfection).toBe(.27);
 const {strokeImperfection:_,...other}=f.settings,{strokeImperfection:__,...previous}=before;expect(other).toEqual(previous);
 await input().onCommit('0');expect(f.settings.strokeImperfection).toBe(0);expect(f.page.rows.find(row=>row.id==='origami-strokeImperfection')!.value).toBe('0 %');
 await f.control('graphics-style').select!.onChange('default');await f.control('graphics-style').select!.onChange('origami');expect(input().value).toBe('0');
});

test('retained Origami controls refuse old renders, inactive style, other pages and busy operations',async()=>{
  const f=fixture();await f.click('option-section-graphics');await f.control('graphics-style').select!.onChange('origami');
  const old=f.page.rows.find(row=>row.id==='origami-blackEdges')!.input!;
  await f.click('origami-edges-less');const before=f.change.mock.calls.length;
  expect(await old.onCommit('12')).toBe(false);expect(f.change).toHaveBeenCalledTimes(before);
  const fresh=f.page.rows.find(row=>row.id==='origami-blackEdges')!.input!;
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
