import {afterEach,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createNativeFrontMenu} from '../src/ui3d/native-front.ts';
import type {FrontMenuOptions} from '../src/ui/front-menu.ts';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract.ts';
import type {RimWorldImportJob,RimWorldImportResult} from '../src/ui/rimworld-import.ts';
import {runRwsImport,importProgress,type RwsImportOutcome,type RwsImportProgress} from '../src/import/rimworld/import-job.ts';

// « Charger une partie » → « Importer une sauvegarde RimWorld »: the native
// front's page over a controllable import job (the Worker is covered by
// rws-import-flow.test.ts). Real outcome of the small fixture colony.
const fixture=readFileSync(resolve('tests/fixtures/rws/petite-colonie.rws'),'utf8');
const converted=runRwsImport(fixture,'petite-colonie.rws');
const refusedText=fixture.replace('<li>ludeon.rimworld</li></modIds>','<li>ludeon.rimworld</li><li>ludeon.rimworld.biotech</li></modIds>').replace('<li>Core</li></modNames>','<li>Core</li><li>Biotech</li></modNames>');
const refused=runRwsImport(refusedText,'biotech.rws');

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function fixtureMenu(withImport=true){
 const mounted=new Set<object>(),pickers:Picker[]=[],links:{href:string;download:string;clicked:number}[]=[];
 class Picker extends EventTarget {type='';accept='';hidden=false;files:File[]|null=null;click(){}remove(){mounted.delete(this);}}
 vi.stubGlobal('window',{});
 vi.stubGlobal('document',{body:{append:(node:object)=>mounted.add(node)},createElement:(tag:string)=>{
  if(tag==='input'){const p=new Picker();pickers.push(p);return p;}
  if(tag==='a'){const link={href:'',download:'',clicked:0,click(){link.clicked++;},remove(){mounted.delete(link);}};links.push(link);return link;}
  throw Error(`Unexpected element ${tag}`);
 }});
 const blobs:Blob[]=[];
 vi.spyOn(URL,'createObjectURL').mockImplementation(blob=>{blobs.push(blob as Blob);return 'blob:report';});
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const jobs:{file:File;progress:(p:RwsImportProgress)=>void;settle:(r:RimWorldImportResult)=>void;cancelled:boolean}[]=[];
 const startRimWorldImport=vi.fn((file:File,progress:(p:RwsImportProgress)=>void):RimWorldImportJob=>{
  let settle!:(r:RimWorldImportResult)=>void;const done=new Promise<RimWorldImportResult>(r=>{settle=r;});
  const job={file,progress,settle,cancelled:false};jobs.push(job);
  return {done,cancel(){job.cancelled=true;settle({status:'cancelled'});}};
 });
 const yes=()=>true,no=()=>false,noop=async()=>{};
 let menu!:ReturnType<typeof createNativeFrontMenu>;
 // Main hides the menu once the colony is adopted (replaceColony).
 const onLoadConverted=vi.fn(async(_save:string)=>{menu.hide();});
 const options:FrontMenuOptions={onStart:noop,onLoad:noop,onResume:noop,getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>0,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>0,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport:noop,
  ...withImport?{startRimWorldImport,onLoadConverted}:{}};
 let page:NativePage|undefined;menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
 const all=()=>[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])];
 const control=(id:string):NativeControl=>{const found=all().find(c=>c.id===id);if(!found)throw Error(`Missing ${id} in ${page?.title}`);return found;};
 const click=async(id:string)=>{const c=control(id);expect(c.disabled).not.toBe(true);await c.onActivate();};
 const row=(id:string)=>page?.rows.find(r=>r.id===id);
 /** Picks a file in the browser picker opened by the RimWorld import button. */
 const choose=async(file:File)=>{await click('import-rimworld');const picker=pickers.at(-1)!;expect(picker.accept).toBe('.rws');picker.files=[file];picker.dispatchEvent(new Event('change'));};
 const settle=async(result:RwsImportOutcome)=>{jobs.at(-1)!.settle(result);await Promise.resolve();await Promise.resolve();};
 return {menu,options,jobs,links,blobs,mounted,startRimWorldImport,onLoadConverted,control,click,row,choose,settle,get page(){return page!;}};
}
const rws=(name='petite-colonie.rws')=>new File([fixture],name);

test('the load screen offers the RimWorld import only when the game provides it',()=>{
 const f=fixtureMenu();f.menu.showLoad();
 expect(f.page.actions?.map(c=>c.id)).toEqual(['front-back','test-colonies','import','import-rimworld','load-selected']);
 expect(f.control('import-rimworld').label).toBe('Importer une sauvegarde RimWorld');
 const without=fixtureMenu(false);without.menu.showLoad();
 expect(without.page.actions?.some(c=>c.id==='import-rimworld')).toBe(false);
});

test('a chosen .rws starts one job off the page and shows its progress with a cancel button',async()=>{
 const f=fixtureMenu();f.menu.showLoad();const file=rws();await f.choose(file);
 expect(f.startRimWorldImport).toHaveBeenCalledOnce();expect(f.jobs[0]!.file).toBe(file);expect(f.mounted.size).toBe(0);
 expect(f.page.title).toBe('Importer une sauvegarde RimWorld');expect(f.page.modal).toBe(true);expect(f.page.layout).toBe('setup');
 expect(f.row('rimworld-progress')?.meter).toMatchObject({value:0,label:'0 %'});
 expect(f.row('rimworld-file')?.value).toBe('petite-colonie.rws · 17 Ko');
 expect(f.page.actions?.map(c=>c.id)).toEqual(['rimworld-cancel']);expect(f.control('rimworld-cancel').disabled).toBeFalsy();
 f.jobs[0]!.progress(importProgress('colony',.5));
 expect(f.row('rimworld-progress')).toMatchObject({label:'Création de la colonie sur sa case…',meter:{value:importProgress('colony',.5).fraction}});
 // Annuler stops the job and returns to the load screen.
 await f.click('rimworld-cancel');
 expect(f.jobs[0]!.cancelled).toBe(true);expect(f.page.title).toBe('Charger une partie');
});

test('Escape cancels a running import; a late outcome of a cancelled job is ignored',async()=>{
 const f=fixtureMenu();f.menu.showLoad();await f.choose(rws());
 f.page.onClose!();
 expect(f.jobs[0]!.cancelled).toBe(true);expect(f.page.title).toBe('Charger une partie');
 f.jobs[0]!.progress(importProgress('reload'));expect(f.page.title).toBe('Charger une partie');
});

test('a refused save shows its French reason, the report and another choice',async()=>{
 const f=fixtureMenu();f.menu.showLoad();await f.choose(rws('biotech.rws'));await f.settle(refused);
 expect(f.row('rimworld-refused')?.label).toBe('Sauvegarde refusée');
 expect(f.page.rows.filter(r=>r.id.startsWith('rimworld-refusal-')).map(r=>r.label).join(' ')).toContain('Extensions non prises en charge : Biotech');
 expect(f.row('rimworld-fact-mods')?.value).toContain('Biotech');
 expect(f.page.actions?.map(c=>c.id)).toEqual(['front-back','rimworld-report','rimworld-other']);
 await f.click('rimworld-report');
 expect(f.links).toHaveLength(1);expect(f.links[0]).toMatchObject({href:'blob:report',download:'biotech-rapport-import.md',clicked:1});
 expect(await f.blobs[0]!.text()).toContain('Extensions non prises en charge : Biotech');
 f.page.onClose!();expect(f.page.title).toBe('Charger une partie');
});

test('a failure is explained in French and keeps the current colony',async()=>{
 const f=fixtureMenu();f.menu.showLoad();await f.choose(rws('faux.rws'));
 await f.settle({status:'failed',fileName:'faux.rws',message:'Ce fichier n’est pas une sauvegarde RimWorld lisible : Document XML vide.'});
 expect(f.row('rimworld-failed')?.label).toBe('Import impossible');expect(f.row('rimworld-failure')?.label).toContain('Document XML vide');
 expect(f.row('rimworld-failed-kept')?.label).toContain('conservées');
 expect(f.page.actions?.map(c=>c.id)).toEqual(['front-back','rimworld-other']);
});

test('a converted colony shows the summary and per-family report, then plays through the load path',async()=>{
 if(converted.status!=='converted')throw Error('fixture conversion failed');
 const f=fixtureMenu();f.menu.showLoad();await f.choose(rws());await f.settle(converted);
 expect(f.page.subtitle).toContain('Conversion réussie');
 expect(f.row('rimworld-colony')?.emphasis).toBe('heading');
 expect(f.row('rimworld-population')?.value).toBe('2 colons · 1 animal de la colonie');
 expect(f.row('rimworld-planet')?.value).toBe('Carte seule, sans planète');
 const buildings=converted.families.find(c=>c.family==='buildings')!;
 expect(f.row('rimworld-family-buildings')?.value).toMatch(new RegExp(`^${buildings.exact} repris · ${buildings.adapted} adaptés? · ${buildings.dropped+buildings.unknown} perdus?$`));
 expect(f.row('rimworld-losses-heading')?.label).toBe('Principales pertes');
 expect(f.page.rows.some(r=>r.id.startsWith('rimworld-loss-')&&r.label==='1'&&r.value?.includes('Thrumbo'))).toBe(true);
 expect(f.page.actions?.map(c=>c.id)).toEqual(['rimworld-cancel','rimworld-report','rimworld-play']);
 expect(f.control('rimworld-play').label).toBe('Jouer cette colonie');expect(f.control('rimworld-cancel').label).toBe('Annuler');
 // The family rail opens the full report of a family, scrollable in the dossier.
 const rail=f.page.rows.filter(r=>r.region==='catalogue').map(r=>r.controls![0]!.label);
 expect(rail[0]).toBe('Résumé');expect(rail).toContain('Animaux');
 await f.click('rimworld-view-animals');
 expect(f.row('rimworld-detail-heading')?.label).toBe('Animaux');
 expect(f.page.rows.some(r=>r.id.startsWith('rimworld-def-')&&r.label==='Husky (colonie)'&&r.value?.endsWith('repris'))).toBe(true);
 await f.click('rimworld-view-summary');expect(f.row('rimworld-colony')).toBeDefined();
 // « Jouer cette colonie » hands exactly the converted save to the load path once.
 await f.click('rimworld-play');
 expect(f.onLoadConverted).toHaveBeenCalledExactlyOnceWith(converted.save);
 expect(f.menu.isOpen()).toBe(false);
 // The converted save is dropped: reopening the screen starts afresh.
 f.menu.showLoad();expect(f.page.title).toBe('Charger une partie');
});

test('a refused adoption keeps the converted colony on screen with the error; Annuler drops it',async()=>{
 if(converted.status!=='converted')throw Error('fixture conversion failed');
 const f=fixtureMenu();f.menu.showLoad();await f.choose(rws());await f.settle(converted);
 f.onLoadConverted.mockRejectedValueOnce(new Error('Cette sauvegarde est illisible ou incompatible avec cette version. La colonie actuelle et vos sauvegardes sont conservées.'));
 await f.click('rimworld-play');
 expect(f.row('front-error')?.label).toContain('illisible');expect(f.row('rimworld-colony')).toBeDefined();
 await f.click('rimworld-cancel');expect(f.page.title).toBe('Charger une partie');
 expect(f.onLoadConverted).toHaveBeenCalledOnce();
});
