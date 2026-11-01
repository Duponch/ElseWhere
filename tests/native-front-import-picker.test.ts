import {afterEach,expect,test,vi} from 'vitest';
import {createNativeFrontMenu} from '../src/ui3d/native-front.ts';
import type {FrontMenuOptions} from '../src/ui/front-menu.ts';
import type {NativePage} from '../src/ui3d/native-contract.ts';

afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 // Explicit browser-DOM service model: real EventTarget/listeners and a rooted
 // node collection; no layout, real file chooser, file parser or World exists.
 const mounted=new Set<Picker>(),clicks:{connected:boolean;hidden:boolean}[]=[],created:Picker[]=[];
 class Picker extends EventTarget {
  type='';accept='';hidden=false;files:File[]|null=null;
  get isConnected(){return mounted.has(this);}
  click(){clicks.push({connected:this.isConnected,hidden:this.hidden});}
  remove(){mounted.delete(this);}
 }
 vi.stubGlobal('window',{});vi.stubGlobal('document',{body:{append:(node:Picker)=>mounted.add(node)},createElement:(tag:string)=>{if(tag!=='input')throw Error('Only browser import picker allowed');const p=new Picker();created.push(p);return p;}});
 const yes=()=>true,no=()=>false,noop=async()=>{},onImport=vi.fn(async(_file:File)=>{});
 const options:FrontMenuOptions={onStart:noop,onLoad:noop,onResume:noop,getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>0,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>0,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport};
 let page:NativePage|undefined;const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});menu.showLoad();
 const open=async()=>{const c=page?.actions?.find(c=>c.id==='import');if(!c||c.disabled)throw Error('Actual import control missing');await c.onActivate();return created.at(-1)!;};
 return {open,onImport,mounted,clicks,created,menu,get page(){return page;}};
}

test('actual NativeFront roots the hidden input before browser click and imports the selected File once, then removes it',async()=>{
 const f=fixture(),picker=await f.open(),file=new File(['fixture-format-only'],'declared.json',{type:'application/json'});
 expect(f.clicks).toEqual([{connected:true,hidden:true}]);expect(picker.isConnected).toBe(true);expect(picker.type).toBe('file');expect(picker.accept).toBe('.json,application/json');
 picker.files=[file];picker.dispatchEvent(new Event('change'));await Promise.resolve();await Promise.resolve();
 expect(f.onImport).toHaveBeenCalledExactlyOnceWith(file);expect(picker.isConnected).toBe(false);expect(f.mounted.size).toBe(0);
 picker.dispatchEvent(new Event('change'));picker.dispatchEvent(new Event('cancel'));expect(f.onImport).toHaveBeenCalledOnce();
});

test('cancel removes the picker without importing; retry uses a fresh node and preserves the actual import failure UI',async()=>{
 const f=fixture(),first=await f.open();first.dispatchEvent(new Event('cancel'));expect(f.mounted.size).toBe(0);expect(f.onImport).not.toHaveBeenCalled();
 const file=new File(['not-parsed-by-this-model'],'retry.json',{type:'application/json'});first.files=[file];first.dispatchEvent(new Event('change'));expect(f.onImport).not.toHaveBeenCalled();
 f.onImport.mockRejectedValueOnce(new Error('Declared import validation failure'));const second=await f.open();expect(second).not.toBe(first);expect(second.isConnected).toBe(true);second.files=[file];second.dispatchEvent(new Event('change'));await Promise.resolve();await Promise.resolve();
 expect(f.onImport).toHaveBeenCalledExactlyOnceWith(file);expect(f.mounted.size).toBe(0);expect(f.menu.isOpen()).toBe(true);expect(f.page?.rows.find(r=>r.id==='front-error')?.label).toBe('Declared import validation failure');
});
