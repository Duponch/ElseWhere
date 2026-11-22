// Options → « Textes de RimWorld »: the folder picked once (a fake picker
// here), kept as a handle, the permission asked again, the language, and the
// texts read into the lore lookup. Hand-made folder with invented words.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createRimWorldTexts,defaultGameLanguage,RIMWORLD_TEXTS_LANGUAGE_KEY,UNSUPPORTED_MESSAGE,type RimWorldFolderHandle,type RimWorldTextsHandleStore} from '../src/lore/rimworld-texts';
import {NOT_A_GAME_FOLDER} from '../src/lore/game-lore-browser';
import {gameLoreTexts,setGameLoreTexts,traitLabel} from '../src/lore/lore-text';
import {installedLoreSources} from '../src/lore/lore-installed';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import {TRAITS} from '../src/sim/traits';
import {fakeDirectory,handMadeRimWorld} from './helpers/hand-made-rimworld';

afterEach(()=>{setGameLoreTexts(undefined);vi.unstubAllGlobals();});

type Permission='granted'|'denied'|'prompt';
function folder(permission:Permission='granted',name='RimWorld',tree=handMadeRimWorld()):RimWorldFolderHandle&{query:ReturnType<typeof vi.fn>;request:ReturnType<typeof vi.fn>} {
 const base=fakeDirectory(name,tree),query=vi.fn(async()=>permission),request=vi.fn(async()=>{permission='granted';return permission;});
 return Object.assign(base,{queryPermission:query,requestPermission:request,query,request});
}
function memoryStore():RimWorldTextsHandleStore&{kept:RimWorldFolderHandle|undefined} {
 const store={kept:undefined as RimWorldFolderHandle|undefined,load:async()=>store.kept,save:async(handle:RimWorldFolderHandle)=>{store.kept=handle;},clear:async()=>{store.kept=undefined;}};
 return store;
}
function memoryPreferences(){const values=new Map<string,string>();return {values,get:(key:string)=>values.get(key)??null,set:(key:string,value:string)=>{values.set(key,value);},remove:(key:string)=>{values.delete(key);}};}

describe('« Textes de RimWorld » controller',()=>{
 it('chooses the language: the kept one, else French, else English, else the first',()=>{
  expect(defaultGameLanguage(['English','French (Français)','German (Deutsch)'])).toBe('French (Français)');
  expect(defaultGameLanguage(['English','German (Deutsch)'])).toBe('English');
  expect(defaultGameLanguage(['German (Deutsch)'])).toBe('German (Deutsch)');
  expect(defaultGameLanguage(['English','French (Français)'],'English')).toBe('English');
  expect(defaultGameLanguage(['English','French (Français)'],'Klingon')).toBe('French (Français)');
  expect(defaultGameLanguage([])).toBeUndefined();
 });

 it('opens the picker inside the click, keeps only the handle, reads the texts and changes language',async()=>{
  const handle=folder(),picker=vi.fn(async()=>handle),store=memoryStore(),preferences=memoryPreferences();
  const texts=createRimWorldTexts({picker,store,preferences}),seen:string[]=[];texts.subscribe(()=>seen.push(texts.state().status));
  expect(texts.state()).toMatchObject({status:'none',folder:undefined,loaded:0});
  const choosing=texts.choose();expect(picker).toHaveBeenCalledTimes(1);await choosing;
  expect(store.kept).toBe(handle);expect(preferences.values.size).toBe(0);
  expect(texts.state()).toMatchObject({status:'loaded',folder:'RimWorld',languages:['English','Other (Autre)','Zorgish (Zorg)'],language:'English',version:'9.9.9 rev1'});
  expect(texts.state().loaded).toBeGreaterThan(10);expect(texts.state().message).toContain('textes du jeu affichés');
  expect(seen).toContain('reading');expect(seen.at(-1)).toBe('loaded');
  expect(gameLoreTexts()?.label).toBe('RimWorld 9.9.9 rev1 · English');expect(traitLabel('optimist')).toBe('Sunny');
  await texts.setLanguage('Zorgish (Zorg)');
  expect(preferences.values.get(RIMWORLD_TEXTS_LANGUAGE_KEY)).toBe('Zorgish (Zorg)');expect(texts.state().language).toBe('Zorgish (Zorg)');expect(traitLabel('optimist')).toBe('Radieux');
  await texts.setLanguage('Klingon');expect(texts.state().language).toBe('Zorgish (Zorg)');
  // The lore page reads the same texts.
  const source=installedLoreSources().at(-1)!;expect(source.label).toBe('RimWorld 9.9.9 rev1 · Zorgish (Zorg)');expect((await source.load()).length).toBe(texts.state().loaded);
  await texts.forget();
  expect(store.kept).toBeUndefined();expect(gameLoreTexts()).toBeUndefined();expect(traitLabel('optimist')).toBe(TRAITS.optimist.label);
  expect(texts.state()).toMatchObject({status:'none',folder:undefined,languages:[]});
 });

 it('restores the kept folder: read at once when allowed, else asks again from a click',async()=>{
  const store=memoryStore(),preferences=memoryPreferences();preferences.set(RIMWORLD_TEXTS_LANGUAGE_KEY,'Zorgish (Zorg)');
  store.kept=folder('granted');
  const allowed=createRimWorldTexts({picker:async()=>{throw Error('unused');},store,preferences});await allowed.restore();
  expect(allowed.state()).toMatchObject({status:'loaded',language:'Zorgish (Zorg)'});expect(traitLabel('optimist','female')).toBe('Radieuse');
  setGameLoreTexts(undefined);
  const asking=folder('prompt');store.kept=asking;
  const later=createRimWorldTexts({picker:async()=>asking,store,preferences});await later.restore();
  expect(later.state()).toMatchObject({status:'permission',folder:'RimWorld'});expect(later.state().message).toContain('autorisation');expect(gameLoreTexts()).toBeUndefined();
  const allowing=later.allow();expect(asking.request).toHaveBeenCalledTimes(1);await allowing;
  expect(later.state().status).toBe('loaded');expect(traitLabel('optimist')).toBe('Radieux');
  setGameLoreTexts(undefined);
  store.kept=folder('denied');const refused=createRimWorldTexts({picker:async()=>asking,store,preferences});await refused.restore();
  expect(refused.state().status).toBe('denied');expect(gameLoreTexts()).toBeUndefined();
  const empty=createRimWorldTexts({picker:async()=>asking,store:memoryStore(),preferences});await empty.restore();expect(empty.state().status).toBe('none');
 });

 it('says so in French where the browser has no picker, and changes nothing on a wrong folder, a cancel or a failed read',async()=>{
  const none=createRimWorldTexts({picker:undefined,store:memoryStore()});
  expect(none.state()).toMatchObject({status:'unsupported',message:UNSUPPORTED_MESSAGE});await none.choose();await none.restore();expect(none.state().status).toBe('unsupported');
  const store=memoryStore(),wrong=folder('granted','Documents',{'notes.txt':'x'});
  const texts=createRimWorldTexts({picker:async()=>wrong,store});await texts.choose();
  expect(texts.state().message).toBe(NOT_A_GAME_FOLDER);expect(store.kept).toBeUndefined();expect(gameLoreTexts()).toBeUndefined();
  const cancelled=createRimWorldTexts({picker:async()=>{throw Object.assign(Error('cancelled'),{name:'AbortError'});},store});
  const before=cancelled.state();await cancelled.choose();expect(cancelled.state()).toBe(before);
  const failing=createRimWorldTexts({picker:async()=>folder(),store,read:async()=>{throw Error('Fichier illisible.');}});await failing.choose();
  expect(failing.state().status).toBe('error');expect(failing.state().message).toBe('Lecture impossible : Fichier illisible. Les textes d’Elsewhere restent affichés.');expect(gameLoreTexts()).toBeUndefined();
 });
});

describe('Options page',()=>{
 function fixture(texts?:ReturnType<typeof createRimWorldTexts>){
  vi.stubGlobal('window',{});
  const yes=()=>true,no=()=>false,noop=async()=>{};let page:NativePage|undefined;
  const options:FrontMenuOptions={onStart:noop,onLoad:noop,onResume:noop,getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,
   getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,
   getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>.5,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>.5,onMusicVolumeChange:yes,
   getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport:noop,onExport:noop,...(texts?{rimWorldTexts:texts}:{})};
  const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
  const control=(id:string):NativeControl=>{const found=[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])].find(value=>value.id===id);if(!found)throw Error('Missing '+id);return found;};
  return {menu,control,row:(id:string)=>page?.rows.find(row=>row.id===id),get page(){return page!;}};
 }
 it('shows the section only with its controller, picks the folder from the click and repaints when read',async()=>{
  const plain=fixture();plain.menu.showOptions!();
  expect(plain.page.rows.filter(row=>row.region==='catalogue').map(row=>row.controls?.[0]?.label)).not.toContain('Textes de RimWorld');
  const handle=folder(),picker=vi.fn(async()=>handle),texts=createRimWorldTexts({picker,store:memoryStore(),preferences:memoryPreferences()}),f=fixture(texts);
  f.menu.showOptions!();
  expect(f.page.rows.filter(row=>row.region==='catalogue').map(row=>row.controls?.[0]?.label)).toEqual(['Jeu','Interface','Graphismes','Éclairage','Audio','Textes de RimWorld']);
  expect(f.row('rimworld-texts-status')).toBeUndefined();
  await f.control('option-section-rimworld-texts').onActivate();
  expect(f.row('option-section-title')?.label).toBe('Textes de RimWorld');
  expect(f.row('rimworld-texts-status')?.value).toBe('Textes d’Elsewhere');expect(f.row('rimworld-texts-about')?.label).toContain('Rien n’est copié ni envoyé');
  expect(f.row('rimworld-texts-folder')?.value).toBe('Aucun');expect(f.row('rimworld-texts-language')).toBeUndefined();
  const choose=f.control('rimworld-texts-choose');expect(choose.label).toBe('Choisir le dossier…');
  const activation=choose.onActivate();expect(picker).toHaveBeenCalledTimes(1);await activation;
  await vi.waitFor(()=>expect(texts.state().status).toBe('loaded'));
  expect(f.row('rimworld-texts-status')?.value).toBe('Textes de RimWorld affichés');expect(f.row('rimworld-texts-folder')?.value).toBe('RimWorld');
  expect(f.control('rimworld-texts-choose').label).toBe('Changer de dossier…');
  const language=f.control('rimworld-texts-language');expect(language.select?.options.map(option=>option.value)).toEqual(['English','Other (Autre)','Zorgish (Zorg)']);
  expect(f.row('rimworld-texts-count')?.value).toBe(String(texts.state().loaded));
  await language.select!.onChange('Zorgish (Zorg)');expect(texts.state().language).toBe('Zorgish (Zorg)');expect(traitLabel('optimist')).toBe('Radieux');
  await f.control('rimworld-texts-forget').onActivate();expect(f.row('rimworld-texts-folder')?.value).toBe('Aucun');expect(gameLoreTexts()).toBeUndefined();
 });
 it('offers to allow the reading again when the browser asks',async()=>{
  const asking=folder('prompt'),store=memoryStore();store.kept=asking;
  const texts=createRimWorldTexts({picker:async()=>asking,store,preferences:memoryPreferences()});await texts.restore();
  const f=fixture(texts);f.menu.showOptions!();await f.control('option-section-rimworld-texts').onActivate();
  expect(f.row('rimworld-texts-status')?.value).toBe('Autorisation à renouveler');
  const allow=f.control('rimworld-texts-allow'),activation=allow.onActivate();expect(asking.request).toHaveBeenCalledTimes(1);await activation;
  expect(f.row('rimworld-texts-status')?.value).toBe('Textes de RimWorld affichés');
 });
});
