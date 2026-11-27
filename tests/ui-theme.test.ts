import {afterEach,expect,test,vi} from 'vitest';
import {DEFAULT_UI_THEME,UI_THEME_PRESETS,applyDomUiTheme,normalizeUiTheme,parseUiTheme,readableUiInk,uiContrast} from '../src/ui3d/ui-theme';
import {applyNativeInkTheme,NATIVE_INK} from '../src/ui3d/native-ui-scale';
import {applyCardboardUiTheme,PALETTE} from '../src/ui3d/prototype-art';
import {NATIVE_TEXT_STYLES} from '../src/ui3d/native-rich-text';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativePage} from '../src/ui3d/native-contract';

afterEach(()=>{applyNativeInkTheme(DEFAULT_UI_THEME);applyCardboardUiTheme(DEFAULT_UI_THEME);vi.unstubAllGlobals();});

test('UI colors are normalized exactly, persisted outside a save and safely restored',()=>{
 for(const raw of [null,'','true','null','not-json','[]','{"background":"url(x)","text":"#fff"}'])expect(parseUiTheme(raw)).toEqual(DEFAULT_UI_THEME);
 const custom={background:'#29304f',text:'#e8c4a1'};
 expect(normalizeUiTheme({background:'29304F',text:'  #E8C4A1 '})).toEqual(custom);
 expect(parseUiTheme(JSON.stringify(custom))).toEqual(custom);
});

test('both chosen inks and semantic UI roles remain legible on arbitrary paper; reset is exact',()=>{
 const initial={...NATIVE_INK},paper={...PALETTE};
 for(const background of ['#ffffff','#000000','#777777','#202b40','#ffe37d','#bf397c','#185c31'])for(const text of ['#ffffff','#000000','#777777','#552fb8']){
  const theme={background,text};applyNativeInkTheme(theme);applyCardboardUiTheme(theme);
  expect(PALETTE.creamPaper).toBe(background);expect(NATIVE_INK.text).toBe(readableUiInk(text,background));
  for(const role of ['text','sectionTitle','subtle','none','disabled','positive','negative','painMedium','painSevere','good','red','enhanced'] as const)expect(uiContrast(NATIVE_INK[role],background)).toBeGreaterThanOrEqual(4.5);
  for(const style of Object.values(NATIVE_TEXT_STYLES))expect(uiContrast(style.color,background)).toBeGreaterThanOrEqual(4.5);
  for(const surface of [PALETTE.kraftLight,PALETTE.ochre,PALETTE.sageMountain,PALETTE.kraftBase])expect(uiContrast(PALETTE.inkDark,surface)).toBeGreaterThanOrEqual(4.5);
 }
 applyNativeInkTheme(DEFAULT_UI_THEME);applyCardboardUiTheme(DEFAULT_UI_THEME);expect(NATIVE_INK).toEqual(initial);expect(PALETTE).toEqual(paper);
});

test('DOM uses the same theme only at the settings boundary, and clearing restores the default CSS',()=>{
 const vars=new Map<string,string>(),attributes=new Map<string,string>(),root={style:{setProperty:(key:string,value:string)=>vars.set(key,value),removeProperty:(key:string)=>vars.delete(key)},setAttribute:(key:string,value:string)=>attributes.set(key,value),removeAttribute:(key:string)=>attributes.delete(key)}as unknown as HTMLElement;
 const theme=UI_THEME_PRESETS[1]!.theme;applyDomUiTheme(theme,root);
 expect(vars.get('--paper')).toBe(theme.background);expect(vars.get('--ink')).toBe(theme.text);expect(vars.get('color-scheme')).toBe('dark');
 expect(uiContrast(vars.get('--ink')!,vars.get('--sky-soft')!)).toBeGreaterThanOrEqual(4.5);
 applyDomUiTheme(DEFAULT_UI_THEME,root);expect(vars.size).toBe(0);expect(attributes.size).toBe(0);
});

test('native Interface settings applies two independent colors, presets, validation and journal visibility',async()=>{
 vi.stubGlobal('window',{});let theme={...DEFAULT_UI_THEME},bubbles=true,page:NativePage|undefined;
 const yes=()=>true,noop=async()=>{};
 const change=vi.fn(value=>{theme=value;return true;});
 const options:FrontMenuOptions={onStart:noop,onLoad:noop,onResume:noop,getUiTheme:()=>({...theme}),onUiThemeChange:change,getJournalBubblesEnabled:()=>bubbles,onJournalBubblesEnabledChange:value=>{bubbles=value;return true;},getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:yes,onSoundEnabledChange:yes,getSoundVolume:()=>.5,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:yes,onMusicEnabledChange:yes,getMusicVolume:()=>.5,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport:noop};
 const menu=createNativeFrontMenu(options,value=>{page=value??undefined;});menu.showOptions!();
 const button=(id:string)=>page!.rows.flatMap(row=>row.controls??[]).find(control=>control.id===id)!;
 await button('option-section-interface').onActivate();
 const input=(id:string)=>page!.rows.find(row=>row.id===id)!.input!;
 expect(await input('ui-theme-background').onCommit('oops')).toBe(false);expect(change).not.toHaveBeenCalled();
 expect(await input('ui-theme-background').onCommit('#112233')).toBe(true);expect(theme).toEqual({background:'#112233',text:DEFAULT_UI_THEME.text});
 expect(await input('ui-theme-text').onCommit('EDF6EE')).toBe(true);expect(theme.text).toBe('#edf6ee');
 await button('ui-theme-preset-1').onActivate();expect(theme).toEqual(UI_THEME_PRESETS[1]!.theme);
 await button('journal-bubbles').onActivate();expect(bubbles).toBe(false);
 const old=input('ui-theme-text');await button('option-section-graphics').onActivate();expect(await old.onCommit('#fff111')).toBe(false);
});
