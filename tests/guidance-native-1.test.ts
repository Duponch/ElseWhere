import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three/webgpu';
import {PALETTE,PrototypeCardboardArt,type CardboardPiece} from '../src/ui3d/prototype-art';
import {createNativeGuidance,GUIDANCE_READ_INTERVAL_MS} from '../src/ui3d/native-guidance-card';
import {createGuidanceCardSession,isHelpShortcut,readGuidanceCard,startingArrivalPending} from '../src/ui/guidance-card';
import {createFirstGesturesLearning,FIRST_GESTURES_STORAGE_KEY,LESSONS} from '../src/ui/first-gestures-learning';
import {readFirstDayGuide} from '../src/ui/first-day-guide';
import {buildNativeHelp} from '../src/ui3d/native-help';
import {buildNativeLaunchPage} from '../src/ui3d/native-launch';
import {createTipRotator,GAMEPLAY_TIPS,TIP_INTERVAL_MS} from '../src/ui3d/native-tips';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import {LaunchProgress} from '../src/ui/launch-progress';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import type {World} from '../src/sim/types';
import {deconstructionCamp} from './scenarios/deconstruction';

// Interface lot: the card, the help entry points and the loading tips. No
// command reaches a World; the colony is only read for the first-day facts.
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

function stubCanvas():void {
  const methods=new Set(['clearRect','fillRect','strokeRect','save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','translate','rotate','scale','fillText','strokeText','drawImage','setLineDash','quadraticCurveTo','bezierCurveTo']);
  vi.stubGlobal('document',{createElement:(tag:string)=>{
    if(tag!=='canvas')throw Error(`Unexpected native element ${tag}`);
    const state=new Map<PropertyKey,unknown>(),stack:Array<Map<PropertyKey,unknown>>=[];
    const ctx=new Proxy({},{get(_target,key){
      if(key==='measureText')return (text:string)=>({width:text.length*7});
      if(typeof key==='string'&&methods.has(key))return()=>{if(key==='save')stack.push(new Map(state));if(key==='restore'){state.clear();for(const[k,v]of stack.pop()??[])state.set(k,v);}};
      return state.get(key);
    },set(_target,key,value){state.set(key,value);return true;}});
    return {width:0,height:0,getContext:()=>ctx};
  }});
}
type Arrival={phase:'incoming'|'landed'|'opened'};
const withArrival=(world:World,phase:Arrival['phase']):World=>{(world as unknown as {startingArrival:Arrival}).startingArrival={phase};return world;};

function fixture(){
  stubCanvas();
  const storage=new Map<string,string>(),writes=vi.fn();
  const learning=createFirstGesturesLearning({read:()=>storage.get(FIRST_GESTURES_STORAGE_KEY)??null,write:value=>{writes(value);storage.set(FIRST_GESTURES_STORAGE_KEY,value);}});
  const art=new PrototypeCardboardArt(),root=new THREE.Group(),anchors={topLeft:new THREE.Group(),topRight:new THREE.Group()};
  root.add(anchors.topLeft,anchors.topRight);
  const session=createGuidanceCardSession(),state={world:undefined as World|undefined,blocked:false,now:0};
  const openHelp=vi.fn(),guide=vi.fn(),sections=vi.fn((world:World)=>readFirstDayGuide(world));
  const guidance=createNativeGuidance(art,anchors,{session,learning:()=>learning,world:()=>state.world,blocked:()=>state.blocked,sections,now:()=>state.now,openHelp,guide});
  guidance.card.setViewport(1440,1000,.01,820);guidance.card.setHudVisible(true);
  const find=(id:string):CardboardPiece|undefined=>{let found:CardboardPiece|undefined;root.traverse(object=>{if(object.userData.nativeId===id)found=object as CardboardPiece;});return found;};
  const shown=(id:string):boolean=>{const piece=find(id);if(!piece)return false;for(let node:THREE.Object3D|null=piece;node;node=node.parent)if(!node.visible)return false;return true;};
  const click=(id:string):void=>{if(!shown(id))throw Error(`Hidden or missing ${id}`);find(id)!.userData.onClick?.();};
  const label=(id:string):string=>(find(id)?.userData.label as {text:string}|undefined)?.text??'';
  return {storage,writes,learning,art,session,state,openHelp,guide,sections,guidance,card:guidance.card,sync:guidance.sync,find,shown,click,label,close:()=>{guidance.card.dispose();art.dispose();}};
}

describe('native advice card · Aide en partie (interface)',()=>{
  it('refreshes retained advice ink on a theme boundary without rereading gameplay or replacing its card',()=>{
    const f=fixture(),previous={...PALETTE};
    try{
      f.session.newColony();f.state.world=deconstructionCamp(3);f.sync();
      const panel=f.find('hud:guidance:card')!,version=panel.userData.texture.version,reads=f.sections.mock.calls.length;
      Object.assign(PALETTE,{inkDark:'#f8f8f8',creamPaper:'#20242a',kraftLight:'#30343a'});f.card.refreshTheme();
      expect(f.find('hud:guidance:card')).toBe(panel);expect(panel.userData.texture.version).toBeGreaterThan(version);
      expect(Reflect.get(f.card,'panelInk')).toContain('#f8f8f8');expect(f.sections).toHaveBeenCalledTimes(reads);
    }finally{Object.assign(PALETTE,previous);f.close();}
  });
  it('appears after the starting pods open in a new colony, never during the descent',()=>{
    const f=fixture();try{
      expect(startingArrivalPending(undefined)).toBe(false);
      f.session.newColony();f.state.world=withArrival(deconstructionCamp(3),'incoming');f.sync();
      expect(f.shown('hud:guidance:card')).toBe(false);expect(f.shown('hud:guidance:tab')).toBe(false);
      expect(f.card.reservedHeight).toBe(0);expect(f.sections).not.toHaveBeenCalled();
      expect(f.shown('hud:help')).toBe(true);
      withArrival(f.state.world,'landed');f.sync();expect(f.shown('hud:guidance:card')).toBe(false);
      withArrival(f.state.world,'opened');f.sync();
      expect(f.session.mode).toBe('expanded');expect(f.shown('hud:guidance:card')).toBe(true);
      expect(f.card.shownVariant).toBe('full');expect(f.card.reservedHeight).toBeGreaterThan(100);
      for(const section of readFirstDayGuide(f.state.world))expect(f.shown(`hud:guidance:check:${section.id}`)).toBe(true);
      expect(f.shown('hud:guidance:gesture-start')).toBe(true);expect(f.label('hud:guidance:gesture-start')).toBe('Commencer');
      // The card lies in the left column, above the given free bottom.
      const card=f.find('hud:guidance:card')!,bottom=-(card.userData.basePos.y-card.userData.h/2)*100;
      expect(bottom).toBeLessThanOrEqual(820-8);expect(bottom+card.userData.h*100).toBeGreaterThan(0);
      // Front menu or loading screen: hidden, then shown again in the same mode.
      f.state.blocked=true;f.sync();expect(f.shown('hud:guidance:card')).toBe(false);expect(f.card.reservedHeight).toBe(0);
      f.state.blocked=false;f.sync();expect(f.shown('hud:guidance:card')).toBe(true);
      // A colony without a starting arrival opens the card at once.
      f.session.newColony();f.state.world=deconstructionCamp(3);f.sync();expect(f.session.mode).toBe('expanded');
      // A loaded colony keeps a tab only.
      f.session.loadedColony();f.sync();expect(f.shown('hud:guidance:tab')).toBe(true);expect(f.shown('hud:guidance:card')).toBe(false);
    }finally{f.close();}
  });

  it('shows the same first-day facts as the help and routes their actions without a command',()=>{
    const f=fixture();try{
      const world=deconstructionCamp(3);world.stockpiles=[];world.growingZones=[];
      f.session.newColony();f.state.world=world;f.sync();
      const facts=readFirstDayGuide(world),model=readGuidanceCard({sections:facts});
      expect(model.checks.map(check=>check.id)).toEqual(facts.map(section=>section.id));
      expect(model.ready).toBe(facts.filter(section=>section.status==='ready').length);
      const storage=facts.find(section=>section.id==='storage')!;
      f.click('hud:guidance:check:storage');expect(f.guide).toHaveBeenLastCalledWith(storage.action);
      expect(String(f.find('hud:guidance:check:storage')!.userData.tooltip)).toContain(storage.detail);
      const before=JSON.stringify(world);f.sync(true);expect(JSON.stringify(world)).toBe(before);
      // Expanded: at most one reading per second of real time for a new snapshot.
      const reads=f.sections.mock.calls.length;f.state.world=structuredClone(world);f.sync();expect(f.sections.mock.calls.length).toBe(reads);
      f.state.now+=GUIDANCE_READ_INTERVAL_MS;f.sync();expect(f.sections.mock.calls.length).toBe(reads+1);
      // A short column keeps the unfinished facts, then only the tab.
      const full=f.card.reservedHeight-12;
      f.card.setViewport(1440,1000,.01,full+167);f.sync(true);expect(f.card.shownVariant).toBe('compact');
      expect(f.card.reservedHeight-12).toBeLessThan(full);expect(f.shown('hud:guidance:check:food')).toBe(true);expect(f.shown('hud:guidance:check:cultivation')).toBe(false);
      f.card.setViewport(1440,480,.01,260);f.sync(true);expect(f.card.shownVariant).toBe('tab');
    }finally{f.close();}
  });

  it('collapses, closes and reopens without touching the first-gestures memory',()=>{
    const f=fixture();try{
      f.learning.start();expect(f.learning.declareCurrentKnown()).toBe(true);
      const remembered=f.storage.get(FIRST_GESTURES_STORAGE_KEY),writes=f.writes.mock.calls.length;
      expect(remembered).toBeDefined();
      f.session.newColony();f.state.world=withArrival(deconstructionCamp(3),'opened');f.sync();
      expect(f.shown('hud:guidance:gesture-action')).toBe(true);expect(f.label('hud:guidance:gesture-action')).toBe('Choisir Réserve');
      f.click('hud:guidance:gesture-action');expect(f.guide).toHaveBeenLastCalledWith(LESSONS[1]!.action);
      const reads=f.sections.mock.calls.length;
      f.click('hud:guidance:collapse');
      expect(f.session.mode).toBe('collapsed');expect(f.shown('hud:guidance:card')).toBe(false);expect(f.shown('hud:guidance:tab')).toBe(true);
      expect(f.label('hud:guidance:tab')).toBe('Conseils · 1/4 gestes ›');expect(f.card.reservedHeight).toBe(40);
      f.state.now+=10*GUIDANCE_READ_INTERVAL_MS;f.state.world=structuredClone(f.state.world);f.sync();f.sync();
      expect(f.sections.mock.calls.length).toBe(reads);
      f.click('hud:guidance:tab');expect(f.session.mode).toBe('expanded');expect(f.shown('hud:guidance:card')).toBe(true);
      f.click('hud:guidance:close');
      expect(f.session.mode).toBe('closed');expect(f.shown('hud:guidance:card')).toBe(false);expect(f.shown('hud:guidance:tab')).toBe(false);
      expect(f.card.reservedHeight).toBe(0);expect(f.shown('hud:help')).toBe(true);
      // Closed in this session: a loaded colony keeps it closed until reopened.
      f.session.loadedColony();f.sync();expect(f.shown('hud:guidance:tab')).toBe(false);
      f.session.reopen();f.sync();expect(f.shown('hud:guidance:card')).toBe(true);
      expect(f.label('hud:guidance:gesture-action')).toBe('Choisir Réserve');
      // The tab's close button closes it too.
      f.click('hud:guidance:collapse');f.click('hud:guidance:tab-close');expect(f.session.mode).toBe('closed');
      expect(f.storage.get(FIRST_GESTURES_STORAGE_KEY)).toBe(remembered);expect(f.writes.mock.calls.length).toBe(writes);
      expect(f.learning.state.learned).toEqual({work:'declared'});
      // Only the explicit gesture button records knowledge.
      f.session.reopen();f.sync();f.click('hud:guidance:gesture-declare');
      expect(f.learning.state.learned).toEqual({work:'declared',storage:'declared'});expect(f.writes.mock.calls.length).toBe(writes+1);
      expect(f.label('hud:guidance:gesture-action')).toBe('Choisir Couchage au sol');
    }finally{f.close();}
  });

  it('opens the existing help from the HUD button, the card, the H key and keeps a way back to the card',()=>{
    const f=fixture();try{
      f.session.newColony();f.state.world=deconstructionCamp(3);f.sync();
      f.click('hud:help');f.click('hud:guidance:help');expect(f.openHelp).toHaveBeenCalledTimes(2);
      expect(String(f.find('hud:help')!.userData.tooltip)).toContain('(H)');
      for(const key of ['h','H'])expect(isHelpShortcut({key})).toBe(true);
      for(const event of [{key:'h',ctrlKey:true},{key:'h',altKey:true},{key:'h',metaKey:true},{key:'g'},{key:'?'}])expect(isHelpShortcut(event)).toBe(false);
      const toggle=vi.fn(),pages=buildNativeHelp({showPage:vi.fn(),panel:vi.fn(),category:vi.fn(),tool:vi.fn(),guidanceCard:{shown:false,toggle}});
      const control=pages[0]!.rows.find(row=>row.id==='help-card-link')!.controls![0]!;
      expect(control.label).toBe('Afficher la carte');void control.onActivate();expect(toggle).toHaveBeenCalledTimes(1);
      expect(buildNativeHelp({showPage:vi.fn(),panel:vi.fn(),category:vi.fn(),tool:vi.fn(),guidanceCard:{shown:true,toggle}})[0]!.rows.find(row=>row.id==='help-card-link')!.controls![0]!.label).toBe('Masquer la carte');
      expect(buildNativeHelp({showPage:vi.fn(),panel:vi.fn(),category:vi.fn(),tool:vi.fn()})[0]!.rows.some(row=>row.id==='help-card-link')).toBe(false);
      expect(pages.find(page=>page.id==='help-shortcuts')!.rows.find(row=>row.id==='key-help')).toMatchObject({label:'H'});
      // Real wiring in the play view: the key, the HUD button and the card.
      const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
      expect(main).toMatch(/if \(isHelpShortcut\(event\)\) \{ event\.preventDefault\(\); if \(!event\.repeat\) openHelp\(\); return; \}/);
      expect(main).toMatch(/createNativeGuidance\(nativeUi\.art,nativeUi\.anchors,\{session:guidanceSession,[^]*?openHelp,/);
      expect(main).toMatch(/guidanceCard:card,onGuideAction:performNativeGuideAction/);
      expect(main).toMatch(/if\(confirmedDraft\)guidanceSession\.newColony\(\);else guidanceSession\.loadedColony\(\);/);
    }finally{f.close();}
  });
});

describe('loading-screen tips · Aide en partie (interface)',()=>{
  it('keeps one random order and moves on every 17.5 s of real time or at a new loading screen',()=>{
    const tips=['a','b','c','d'],draws=[.9,.1,.5];let draw=0;
    const rotator=createTipRotator({tips,random:()=>draws[draw++]??0});
    const first=rotator.current(1000);
    expect(rotator.current(1000+TIP_INTERVAL_MS)).toBe(first);
    const second=rotator.current(1001+TIP_INTERVAL_MS);expect(second).not.toBe(first);
    rotator.reset();const third=rotator.current(1002+TIP_INTERVAL_MS);expect([first,second]).not.toContain(third);
    const fourth=rotator.current(1003+2*TIP_INTERVAL_MS);
    expect(new Set([first,second,third,fourth])).toEqual(new Set(tips));
    expect(rotator.current(1004+3*TIP_INTERVAL_MS)).toBe(first);expect(draw).toBe(3);
  });

  it('offers about forty distinct French tips sized for the loading screen',()=>{
    expect(GAMEPLAY_TIPS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(GAMEPLAY_TIPS).size).toBe(GAMEPLAY_TIPS.length);
    for(const tip of GAMEPLAY_TIPS){expect(tip.length).toBeLessThanOrEqual(160);expect(tip).toMatch(/[.!]$/);expect(tip).not.toMatch(/RimWorld/i);}
    expect(GAMEPLAY_TIPS.some(tip=>tip.startsWith('H ouvre le carnet de survie'))).toBe(true);
  });

  it('shows a tip below the progress of the colony loading screen',()=>{
    const model=new LaunchProgress('load',0,false);
    expect(buildNativeLaunchPage(model.view(1000)).rows.some(row=>row.id==='loading-tip')).toBe(false);
    const page=buildNativeLaunchPage(model.view(1000),undefined,GAMEPLAY_TIPS[0]);
    expect(page.rows.at(-1)).toMatchObject({id:'loading-tip',label:'Astuce',detail:GAMEPLAY_TIPS[0]});
    const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
    expect(main).toMatch(/buildNativeLaunchPage\(view,waiting,loadingTips\.current\(performance\.now\(\)\)\)/);
    expect(main).toMatch(/launchTicker=undefined;loadingTips\.reset\(\);/);
  });

  it('rotates tips during the planet generation of the native creation screens',async()=>{
    vi.useFakeTimers({toFake:['setInterval','clearInterval','setTimeout','clearTimeout','performance']});
    vi.stubGlobal('window',{});vi.stubGlobal('document',{createElement:()=>{throw Error('No DOM node in this contract');}});
    vi.stubGlobal('crypto',{getRandomValues:(array:Uint32Array)=>{array[0]=6111201;return array;}});
    const yes=()=>true,no=()=>false,noop=async()=>{};let pending:{reject:(error:Error)=>void}|undefined;
    const options:FrontMenuOptions={onStart:vi.fn(noop),onLoad:vi.fn(noop),onResume:vi.fn(noop),
      getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,
      getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>.5,onSoundVolumeChange:yes,onTestSound:noop,
      getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>.5,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:vi.fn(noop),onImport:vi.fn(noop),
      getWorldCreationPlayer:()=>({scenario:'crashlanded',playerDef:'PlayerColony',playerName:'UI contract only'}),
      worldCreation:{generate:vi.fn(()=>new Promise<never>((_resolve,reject)=>{pending={reject};})),confirmSite:vi.fn(async()=>{throw Error('No site in this contract');}),start:vi.fn(async()=>{throw Error('No start in this contract');})}};
    let page:NativePage|undefined;const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
    const control=(id:string):NativeControl=>{const found=[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])].find(item=>item.id===id);if(!found)throw Error('Missing native control '+id);return found;};
    const tip=()=>page?.rows.find(row=>row.id==='loading-tip')?.detail;
    menu.showCreation();await control('scenario-next').onActivate();
    await control('difficulty-Récit d’aventure').onActivate();await control('reloadable').onActivate();await control('story-next').onActivate();
    expect(page?.id).toBe('front-world');expect(tip()).toBeUndefined();
    void control('generate-world').onActivate();
    const first=tip();expect(GAMEPLAY_TIPS).toContain(first);
    expect(page!.rows.find(row=>row.id==='loading-tip')!.region).toBe('navigation');
    vi.advanceTimersByTime(TIP_INTERVAL_MS-1000);expect(tip()).toBe(first);
    vi.advanceTimersByTime(2000);const second=tip();expect(GAMEPLAY_TIPS).toContain(second);expect(second).not.toBe(first);
    await control('cancel-generation').onActivate();expect(tip()).toBeUndefined();
    pending?.reject(Error('cancelled'));expect(vi.getTimerCount()).toBe(0);
    expect(options.onStart).not.toHaveBeenCalled();expect(options.worldCreation!.confirmSite).not.toHaveBeenCalled();
  });
});
