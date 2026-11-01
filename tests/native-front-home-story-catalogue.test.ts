import {afterEach,expect,test,vi} from 'vitest';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import type {TestColony} from '../src/ui/test-colonies';

// Private source-to-real-producer contracts. Root supplies the composed source
// tree including native-front-presentation; no copy of presentation/guard logic.
// All callbacks are UI service spies. No Engine, map, campaign, save payload,
// generation or accepted gameplay ACK is constructed or exercised.
afterEach(()=>vi.unstubAllGlobals());
function fixture(){
  const tests:TestColony[]=[
    {id:'eclaircies',release:'v419',label:'Éclaircies',description:'Jardin et réserve',filename:'les-eclaircies.json',pawns:3,colonists:3,width:128,height:128,tick:1725,focus:['Travail'],steps:['Inspecter les provisions.'],prepared:true,provenance:'Métadonnée synthétique UI A',sha256:'a'.repeat(64)},
    {id:'bastion',release:'v419',label:'Bastion',description:'Murs et cuisine',filename:'le-bastion.json',pawns:5,colonists:5,width:250,height:250,tick:2500,focus:['Cuisine'],steps:['Inspecter les murs.'],prepared:false,provenance:'Métadonnée synthétique UI B',sha256:'b'.repeat(64)},
  ];
  const link={href:'',download:'',click:vi.fn()},createElement=vi.fn((tag:string)=>{if(tag!=='a')throw Error('Only the browser download service may create a node in this fixture');return link;});
  vi.stubGlobal('window',{});vi.stubGlobal('document',{createElement});
  // A fixed entropy service makes only the ordinary pure roster creation
  // reproducible; no candidate data or favorable World is injected.
  vi.stubGlobal('crypto',{getRandomValues:(array:Uint32Array)=>{array[0]=6111201;return array;}});
  const yes=()=>true,no=()=>false,noop=async()=>{};
  const options:FrontMenuOptions={onStart:vi.fn(noop),onLoad:vi.fn(noop),onResume:vi.fn(noop),
    getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,
    getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>.5,onSoundVolumeChange:yes,onTestSound:noop,
    getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>.5,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:vi.fn(async()=>tests),onLoadTest:vi.fn(noop),onImport:vi.fn(noop),
    getWorldCreationPlayer:()=>({scenario:'crashlanded',playerDef:'PlayerColony',playerName:'UI contract only'}),
    worldCreation:{generate:vi.fn(async()=>{throw Error('Generation must not be invoked by these UI contracts');}),confirmSite:vi.fn(async()=>{throw Error('No site generation in this contract');}),start:vi.fn(async()=>{throw Error('No start in this contract');})}};
  let page:NativePage|undefined;const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
  const controls=()=>[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])];
  const control=(id:string):NativeControl=>{const found=controls().find(control=>control.id===id);if(!found)throw Error('Missing native control '+id);return found;};
  const click=async(id:string)=>{const found=control(id);expect(found.disabled).not.toBe(true);await found.onActivate();};
  const untouchedBackend=()=>{expect(options.onStart).not.toHaveBeenCalled();expect(options.worldCreation!.generate).not.toHaveBeenCalled();expect(options.worldCreation!.confirmSite).not.toHaveBeenCalled();expect(options.worldCreation!.start).not.toHaveBeenCalled();};
  return{menu,options,tests,link,createElement,control,click,untouchedBackend,get page(){return page!;}};
}

test('Home and Scenario keep distinct navigation controls, unavailable scenarios and the Options return path',async()=>{
  const f=fixture();f.menu.showHome(false);
  expect(f.page).toMatchObject({id:'front-home',layout:'setup',setupAnchor:'right',width:480});expect(f.page.rows.some(row=>row.id==='resume')).toBe(false);
  await f.click('options');expect(f.page.id).toBe('front-options');await f.click('front-back');expect(f.page.id).toBe('front-home');expect(f.options.onResume).not.toHaveBeenCalled();
  f.menu.showHome(true);await f.click('options');await f.click('front-back');expect(f.page.id).toBe('front-home');expect(f.control('resume').disabled).not.toBe(true);expect(f.options.onResume).not.toHaveBeenCalled();
  await f.click('new-game');expect(f.page).toMatchObject({id:'front-scenario',layout:'setup',setupCatalogueWidth:250});
  const choices=f.page.rows.filter(row=>row.region==='catalogue');expect(choices).toHaveLength(6);expect(choices[0]?.controls?.[0]).toMatchObject({id:'crashlanded',label:'Atterrissage forcé',active:true});
  for(const row of choices.slice(1)){const unavailable=row.controls![0]!;expect(unavailable.disabled).toBe(true);await unavailable.onActivate();expect(f.page.id).toBe('front-scenario');}
  expect(f.page.rows.find(row=>row.id==='supplies')?.region).toBe('details');expect(f.page.rows.find(row=>row.id==='knowledge')?.region).toBe('details');
  const retainedNext=f.control('scenario-next');f.menu.setBusy(true);await retainedNext.onActivate();expect(f.page.id).toBe('front-scenario');f.menu.setBusy(false);
  await f.click('scenario-next');expect(f.page.id).toBe('front-story');f.untouchedBackend();expect(f.options.onLoad).not.toHaveBeenCalled();
});

test('Story keeps the supported difficulty and save-mode guards before World, including retained callbacks during busy',async()=>{
  const f=fixture();f.menu.showCreation();await f.click('scenario-next');
  expect(f.page).toMatchObject({id:'front-story',layout:'setup',setupCatalogueWidth:220});expect(f.page.rows.find(row=>row.id==='narrator-choice')?.region).toBe('catalogue');
  expect(f.control('story-next').disabled).toBe(true);await f.control('story-next').onActivate();expect(f.page.id).toBe('front-story');
  const unsupported=f.control('difficulty-Pacifique');expect(unsupported.disabled).toBe(true);await unsupported.onActivate();expect(f.control('story-next').disabled).toBe(true);
  await f.click('difficulty-Récit d’aventure');expect(f.control('story-next').disabled).toBe(true);
  const commitment=f.control('commitment');expect(commitment.disabled).toBe(true);await commitment.onActivate();expect(f.control('story-next').disabled).toBe(true);
  await f.click('reloadable');expect(f.control('story-next').disabled).not.toBe(true);
  expect(f.page.rows.filter(row=>row.id.startsWith('difficulty-choice-')).every(row=>row.region==='details'&&row.setupColumn===0)).toBe(true);
  expect(f.page.rows.filter(row=>row.id.startsWith('saving-choice-')).every(row=>row.region==='details'&&row.setupColumn===1)).toBe(true);
  const retained=f.control('story-next');f.menu.setBusy(true);await retained.onActivate();expect(f.page.id).toBe('front-story');f.menu.setBusy(false);
  await f.click('story-next');expect(f.page.id).toBe('front-world');f.untouchedBackend();
  await f.click('front-back');expect(f.page.id).toBe('front-story');expect(f.control('difficulty-Récit d’aventure').active).toBe(true);expect(f.control('reloadable').active).toBe(true);
});

test('Test catalogue searches and inspects separately, keeping the original exact Load and Download handlers',async()=>{
  const f=fixture(),before=JSON.stringify(f.tests);f.menu.showLoad();await f.click('test-colonies');
  expect(f.page).toMatchObject({id:'front-tests',layout:'setup',setupCatalogueWidth:460});expect(f.options.getTestColonies).toHaveBeenCalledOnce();
  expect(f.page.rows.find(row=>row.id==='test-current-details')?.label).toBe('Éclaircies');expect(f.options.onLoadTest).not.toHaveBeenCalled();
  for(const item of f.tests){const row=f.page.rows.find(row=>row.id==='test-'+item.id)!;expect(row.region).toBe('catalogue');expect(row.controls?.map(control=>control.id)).toEqual(['inspect-test-'+item.id,'load-test-'+item.id,'download-test-'+item.id]);}
  await f.click('inspect-test-bastion');const detail=f.page.rows.find(row=>row.id==='test-current-details')!;expect(detail.label).toBe('Bastion');for(const text of [f.tests[1]!.description,...f.tests[1]!.focus,...f.tests[1]!.steps,f.tests[1]!.provenance])expect(detail.detail).toContain(text);
  expect(f.options.onLoadTest).not.toHaveBeenCalled();expect(f.link.click).not.toHaveBeenCalled();
  await f.page.rows.find(row=>row.id==='test-catalogue-search')!.input!.onCommit('ECLAIR');expect(f.page.rows.filter(row=>row.region==='catalogue'&&row.id.startsWith('test-')).map(row=>row.id)).toEqual(['test-eclaircies']);
  expect(f.page.rows.find(row=>row.id==='test-catalogue-count')?.label).toBe('1 / 2 colonies');expect(f.options.onLoadTest).not.toHaveBeenCalled();
  await f.click('download-test-eclaircies');expect(f.createElement).toHaveBeenCalledExactlyOnceWith('a');expect(f.link).toMatchObject({href:'/test-saves/v419/les-eclaircies.json',download:'les-eclaircies.json'});expect(f.link.click).toHaveBeenCalledOnce();expect(f.options.onLoadTest).not.toHaveBeenCalled();
  await f.page.rows.find(row=>row.id==='test-catalogue-search')!.input!.onCommit('');await f.click('load-test-bastion');expect(f.options.onLoadTest).toHaveBeenCalledExactlyOnceWith(f.tests[1]);expect(f.options.onLoad).not.toHaveBeenCalled();expect(JSON.stringify(f.tests)).toBe(before);f.untouchedBackend();
  await f.click('front-back');expect(f.page.id).toBe('front-load');
});

test('Pending catalogue load blocks retained inspect, download, search and duplicate loading callbacks',async()=>{
  const f=fixture();f.menu.showLoad();await f.click('test-colonies');await f.click('inspect-test-bastion');
  const inspect=f.control('inspect-test-eclaircies'),download=f.control('download-test-eclaircies'),load=f.control('load-test-bastion'),search=f.page.rows.find(row=>row.id==='test-catalogue-search')!.input!;
  let release:()=>void=()=>{throw Error('Declared load spy was not called');};f.options.onLoadTest=vi.fn(async()=>{await new Promise<void>(resolve=>{release=resolve;});});
  const pending=load.onActivate();await Promise.resolve();expect(f.options.onLoadTest).toHaveBeenCalledExactlyOnceWith(f.tests[1]);
  await inspect.onActivate();await download.onActivate();await load.onActivate();expect(await search.onCommit('eclair')).toBe(false);f.menu.showHome(false);
  expect(f.page.id).toBe('front-tests');expect(f.page.rows.find(row=>row.id==='test-current-details')?.label).toBe('Bastion');expect(f.page.rows.find(row=>row.id==='test-catalogue-search')?.input?.value).toBe('');
  expect(f.link.click).not.toHaveBeenCalled();expect(f.options.onLoadTest).toHaveBeenCalledOnce();release();await pending;expect(f.options.onLoadTest).toHaveBeenCalledOnce();f.untouchedBackend();
});
