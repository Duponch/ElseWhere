import {describe,expect,it,vi} from 'vitest';
import {NATIVE_UI_SCALE_LIMITS,normalizeNativeUiScale,parseNativeUiScale} from '../src/ui3d/native-preferences';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativePage} from '../src/ui3d/native-contract';

async function optionsFixture(persist=true){
  let scale=1,page:NativePage|undefined;
  const yes=()=>true,no=()=>false,asyncNoop=async()=>{};
  const change=vi.fn((value:number)=>{scale=normalizeNativeUiScale(value);return persist;});
  const options:FrontMenuOptions={onStart:asyncNoop,onLoad:asyncNoop,onResume:asyncNoop,
    getUiScale:()=>scale,onUiScaleChange:change,
    getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,
    getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,
    getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,
    getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>0,onSoundVolumeChange:yes,onTestSound:asyncNoop,
    getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>0,onMusicVolumeChange:yes,
    getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:asyncNoop,onImport:asyncNoop};
  const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});menu.showOptions!();
  await page!.rows.find(row=>row.id==='option-section-interface')!.controls![0]!.onActivate();expect(change).not.toHaveBeenCalled();
  return {change,get page(){return page!;},get scale(){return scale;}};
}

describe('native interface scale preference',()=>{
  it('defaults to100% for missing, malformed and nonnumeric browser data',()=>{
    for(const raw of [null,'','not-json','null','true','"2"','{}','[]','1e999'])expect(parseNativeUiScale(raw)).toBe(1);
    expect(parseNativeUiScale('1')).toBe(NATIVE_UI_SCALE_LIMITS.default);
  });
  it('round trips allowed sizes and bounds unsupported stored scales',()=>{
    for(const value of [.75,1,1.25,1.5,1.75,2])expect(parseNativeUiScale(JSON.stringify(value))).toBe(value);
    expect(normalizeNativeUiScale(.1)).toBe(.75);expect(normalizeNativeUiScale(9)).toBe(2);
    expect(normalizeNativeUiScale(1.13)).toBe(1.15);expect(normalizeNativeUiScale(NaN)).toBe(1);expect(normalizeNativeUiScale(Infinity)).toBe(1);
  });
  it('offers native controls and applies200% through the same preference callback',async()=>{
    const f=await optionsFixture();let row=f.page.rows.find(row=>row.id==='ui-scale')!;
    expect(row.value).toBe('100 %');expect(row.input?.value).toBe('100');
    expect(await row.input!.onCommit('200')).not.toBe(false);
    expect(f.change).toHaveBeenLastCalledWith(2);expect(f.scale).toBe(2);
    row=f.page.rows.find(row=>row.id==='ui-scale')!;expect(row.value).toBe('200 %');
    expect(row.controls?.find(control=>control.id==='ui-scale-more')?.disabled).toBe(true);
    await row.controls!.find(control=>control.id==='ui-scale-less')!.onActivate();
    expect(f.change).toHaveBeenLastCalledWith(1.95);expect(f.page.rows.find(row=>row.id==='ui-scale')?.value).toBe('195 %');
  });
  it('keeps the immediate size change and reports a browser persistence failure',async()=>{
    const f=await optionsFixture(false),row=f.page.rows.find(row=>row.id==='ui-scale')!;
    await row.input!.onCommit('150');expect(f.scale).toBe(1.5);
    expect(f.page.rows.find(row=>row.id==='front-error')?.label).toContain('ce navigateur ne peut pas le conserver');
  });
});
