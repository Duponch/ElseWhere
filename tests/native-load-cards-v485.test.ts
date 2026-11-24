import {afterEach,describe,expect,it,vi} from 'vitest';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import type {SavedColony} from '../src/ui/game-session';
import type {TestColony} from '../src/ui/test-colonies';
import {layoutNativePage} from '../src/ui3d/native-layout';

afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 let saves:SavedColony[]=[{key:'lisiere.manual.v1',kind:'manual',label:'Une longue colonie avec son nom entier',detail:'Jour 12 · 3 colons · 250 × 250',savedAt:42},{key:'lisiere.named.v1.1',kind:'named',label:'La halte du grand chêne',detail:'Jour 3 · 4 colons · 180 × 180',savedAt:84,revision:'opaque-one'}];
 const tests:TestColony[]=['first','second'].map((id,index)=>({id,release:'v419',label:`Colonie de test ${id}`,description:`Description complète ${id}.`,filename:`colony-${id}.json`,pawns:3,colonists:3,width:128,height:128,tick:1725+index,focus:['Travail','Provisions'],steps:['Observer la colonie.','Inspecter les mêmes biens.'],prepared:index===0,provenance:`Origine exacte ${id}`,sha256:String(index).repeat(64)}));
 const link={href:'',download:'',click:vi.fn()};vi.stubGlobal('window',{});vi.stubGlobal('document',{createElement:(tag:string)=>{if(tag!=='a')throw Error('Only browser download service may create a node');return link;}});
 const yes=()=>true,no=()=>false,noop=async()=>{};
 const options:FrontMenuOptions={onStart:vi.fn(noop),onLoad:vi.fn(noop),onResume:vi.fn(noop),getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>0,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>0,onMusicVolumeChange:yes,getSaves:()=>saves,getTestColonies:async()=>tests,onLoadTest:vi.fn(noop),onImport:vi.fn(noop)};
 let page:NativePage|undefined;const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
 const control=(id:string):NativeControl=>{const result=[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])].find(control=>control.id===id);if(!result)throw Error(`Missing native control ${id}`);return result;};
 const click=async(id:string)=>{const result=control(id);expect(result.disabled).not.toBe(true);await result.onActivate();};
 return {menu,options,tests,link,control,click,setSaves:(next:SavedColony[])=>{saves=next;},get saves(){return saves;},get page(){return page!;}};
}

describe('native file list with direct load actions',()=>{
 it('keeps every saved record and loads an explicitly clicked row action in one activation',async()=>{
  const f=fixture();f.menu.showLoad();const rows=f.page.rows.filter(row=>row.id.startsWith('save-'));
  expect(rows).toHaveLength(2);expect(f.page.actions?.some(control=>control.id==='load')).toBe(false);
  for(const [index,row]of rows.entries()){
   const save=f.saves[index]!;expect(row.label).toBe('');expect(row.fileEntry?.date).toBeTruthy();expect(row.controls).toHaveLength(2);
   expect(row.controls![0]).toMatchObject({id:'select-save-'+save.key,label:save.label});expect(row.controls![1]).toMatchObject({id:'load-save-'+save.key,label:'Charger'});
   for(const control of row.controls!){expect(control.hint).toContain(save.label);expect(control.hint).toContain(save.detail);}
  }
  const box=layoutNativePage(f.page,{width:1440,height:900},true,(text,size)=>text.length*size*.53);expect([box.width,box.height]).toEqual([620,700]);
  expect(box.rows.filter(row=>row.row.fileEntry).map(row=>[row.height,row.controls[1]!.width,row.controls[1]!.height])).toEqual([[40,100,36],[40,100,36]]);
  await f.click('select-save-'+f.saves[0]!.key);expect(f.options.onLoad).not.toHaveBeenCalled();expect(f.page.rows.find(row=>row.id==='selected-save-detail')?.detail).toBe(f.saves[0]!.detail);
  await f.click('load-save-'+f.saves[1]!.key);expect(f.options.onLoad).toHaveBeenCalledExactlyOnceWith(f.saves[1]!.key);expect(f.options.onStart).not.toHaveBeenCalled();
 });

 it('refuses a disappeared or disabled saved row even when its old callback is retained',async()=>{
  const f=fixture();f.menu.showLoad();const old=f.control('load-save-'+f.saves[0]!.key);f.setSaves([]);await old.onActivate();expect(f.options.onLoad).not.toHaveBeenCalled();expect(f.page.rows.find(row=>row.id==='front-error')?.label).toContain('plus disponible');
  const g=fixture();g.setSaves(g.saves.map(save=>({...save,disabled:true})));g.menu.showLoad();const disabled=g.control('load-save-'+g.saves[0]!.key);expect(disabled.disabled).toBe(true);await disabled.onActivate();expect(g.options.onLoad).not.toHaveBeenCalled();
 });
 it('shows a neutral metadata label for a legacy save without optional kind information',async()=>{
  const f=fixture();f.options.getSaves=()=>[{key:'legacy-key',label:'Colonie ancienne',detail:'Métadonnées historiques conservées'}];f.menu.showLoad();expect(f.page.rows.find(row=>row.id==='save-legacy-key')?.fileEntry).toMatchObject({date:'—',kind:'Colonie enregistrée'});expect(f.control('load-save-legacy-key').hint).toContain('Colonie enregistrée');await f.click('load-save-legacy-key');expect(f.options.onLoad).toHaveBeenCalledExactlyOnceWith('legacy-key');
 });

 it('serializes two activations of the same direct row while loading is pending',async()=>{
  const f=fixture();let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});f.options.onLoad=vi.fn(async()=>pending);f.menu.showLoad();const row=f.control('load-save-'+f.saves[0]!.key),first=row.onActivate();await Promise.resolve();await row.onActivate();expect(f.options.onLoad).toHaveBeenCalledOnce();release();await first;expect(f.options.onLoad).toHaveBeenCalledExactlyOnceWith(f.saves[0]!.key);
 });

 it('loads the clicked test record directly and retains its complete description and provenance',async()=>{
  const f=fixture();f.menu.showLoad();await f.click('test-colonies');
  for(const record of f.tests){const row=f.page.rows.find(row=>row.id==='test-'+record.id)!;expect(row.controlStyle).toBe('button');const load=row.controls!.find(control=>control.id==='load-test-'+record.id)!;expect(load.label).toBe('Charger');await f.click('inspect-test-'+record.id);const dossier=f.page.rows.find(row=>row.id==='test-current-details')!;expect(dossier.label).toBe(record.label);expect(dossier.value).toContain('3 colons · 128 × 128');for(const text of [record.description,...record.focus,...record.steps,record.provenance]){expect(dossier.detail).toContain(text);expect(load.hint).toContain(text);}}
  expect(f.page.actions?.some(control=>control.id==='load-test')).toBe(false);expect(f.page.rows.some(row=>row.controls?.some(control=>control.id.startsWith('choose-test-')))).toBe(false);
  await f.click('load-test-second');expect(f.options.onLoadTest).toHaveBeenCalledExactlyOnceWith(f.tests[1]);expect(f.options.onLoad).not.toHaveBeenCalled();
 });
 it('refuses a retained direct action once its file-list scope has been left or filtered',async()=>{
  const f=fixture();f.menu.showLoad();const retained=f.control('load-save-'+f.saves[0]!.key);
  await f.page.rows.find(row=>row.id==='load-search')!.input!.onCommit('halte');await retained.onActivate();expect(f.options.onLoad).not.toHaveBeenCalled();
  const visible=f.control('load-save-'+f.saves[1]!.key);f.menu.showHome();await visible.onActivate();expect(f.options.onLoad).not.toHaveBeenCalled();expect(f.page.id).toBe('front-home');
 });

 it('downloads the corresponding test record independently of loading or any selected row',async()=>{
  const f=fixture();f.menu.showLoad();await f.click('test-colonies');await f.click('download-test-second');expect(f.link.href).toBe('/test-saves/v419/colony-second.json');expect(f.link.download).toBe('colony-second.json');expect(f.link.click).toHaveBeenCalledOnce();expect(f.options.onLoadTest).not.toHaveBeenCalled();await f.click('front-back');expect(f.page.id).toBe('front-load');expect(f.page.rows.filter(row=>row.id.startsWith('save-'))).toHaveLength(2);
 });
});
