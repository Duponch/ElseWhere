import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createLearningHelper,GESTURE_CONCEPTS,LEARNING_HELPER_STORAGE_KEY,parseLearningKnowledge,serializeLearningKnowledge,type LearningConcept} from '../src/ui/learning-helper';
import {LEARNING_CONCEPTS} from '../src/ui/learning-concepts';
import {digestLearningWorld,learningFromCommand,learningFromObservation,learningOpportunities} from '../src/ui/learning-triggers';
import {createLearningRuntime} from '../src/ui/learning-runtime';
import {FIRST_GESTURES_STORAGE_KEY} from '../src/ui/first-gestures-learning';
import {createGuidanceCardSession,guidanceTabLabel,readGuidanceCard} from '../src/ui/guidance-card';
import {createNativeGuidance} from '../src/ui3d/native-guidance-card';
import {PrototypeCardboardArt,type CardboardPiece} from '../src/ui3d/prototype-art';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import {stepWorld,serializeWorld} from '../src/sim/index';
import {enableRaids} from '../src/sim/raids';
import {injurePawn} from '../src/sim/health';
import {HP_UNIT} from '../src/sim/injury-rules';
import type {World} from '../src/sim/types';
import {deconstructionCamp} from './scenarios/deconstruction';
import {fireCamp,woodFire} from './scenarios/fire';

// Interface lot: the learning helper reads confirmed worlds and player
// gestures; it never writes a World, a save or the simulation's random streams.
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

const self=(id:string,priority:number):LearningConcept=>({id,core:'Test',group:'self-show',title:id,text:`${id} text`,priority,needsOpportunity:false,opportunityDecays:true});
const chance=(id:string,decays=true):LearningConcept=>({id,core:'Test',group:'opportunistic',title:id,text:`${id} text`,priority:50,needsOpportunity:true,opportunityDecays:decays});
function helper(concepts:readonly LearningConcept[],stored?:Record<string,number>,enabled=true){
  const storage=new Map<string,string>();
  if(stored)storage.set(LEARNING_HELPER_STORAGE_KEY,JSON.stringify({version:1,enabled,knowledge:stored}));
  const h=createLearningHelper({concepts,read:()=>storage.get(LEARNING_HELPER_STORAGE_KEY)??null,write:value=>{storage.set(LEARNING_HELPER_STORAGE_KEY,value);}});
  const run=(steps:number,menuOpen=false)=>{for(let i=0;i<steps;i++)h.update(.25,{playing:true,menuOpen});};
  return {h,storage,run};
}

describe('learning helper · Core rules',()=>{
  it('computes desire as (priority + opportunity × 0.6) × (1 − knowledge), by hand',()=>{
    const {h}=helper([self('s1',95),self('s2',94),self('s3',93),self('s4',92),self('b',40),chance('c'),chance('n',false)],{b:.25});
    expect(h.desire('s1')).toBe(95);expect(h.desire('b')).toBe(30);   // 40 × 0.75
    expect(h.desire('c')).toBe(0);                                       // needs an opportunity
    expect(h.relaxDesire).toBeCloseTo(100-10000/9,9);                    // first lesson at once
    // Four shown (Critical bypasses every limit), so GoodToKnow only records its value.
    for(const id of ['s1','s2','s3','s4'])expect(h.teachOpportunity(id,'critical')).toBe(true);
    expect(h.teachOpportunity('b','good-to-know')).toBe(false);expect(h.teachOpportunity('c','good-to-know')).toBe(false);
    expect(h.active).toEqual(['s1','s2','s3','s4']);expect(h.desire('s1')).toBe(0);   // shown
    expect(h.opportunity('b')).toBe(60);expect(h.desire('b')).toBeCloseTo((40+36)*.75,9);   // 57
    expect(h.desire('c')).toBeCloseTo(50+36,9);                                              // 86
    h.teachOpportunity('n','good-to-know');
    // Ten real seconds of checks: opportunities lose 0.4 per second unless they do not decay.
    for(let i=0;i<40;i++)h.update(.25,{playing:true,menuOpen:false});
    expect(h.opportunity('c')).toBeCloseTo(56,9);expect(h.desire('c')).toBeCloseTo(50+56*.6,9);   // 83.6
    expect(h.opportunity('n')).toBe(60);
    expect(h.knowledge('b')).toBeCloseTo(.25-.00015*10,9);
  });

  it('waits 8 s after a load, follows the relax timer, shows three at most and pauses with the Menu',()=>{
    const {h,run}=helper([self('a',95),self('b',94),self('c',93),self('d',92)]);
    h.levelLoaded();run(31);expect(h.active).toEqual([]);   // 7.75 s
    run(1);expect(h.active).toEqual(['a']);                  // 8 s: relax −1011 < 95
    // b (94) waits until 100 − t/9 < 94, i.e. more than 54 s.
    run(216);expect(h.active).toEqual(['a']);expect(h.secondsSinceLesson).toBe(54);
    run(1);expect(h.active).toEqual(['a','b']);
    run(252);expect(h.active).toEqual(['a','b']);run(1);expect(h.active).toEqual(['a','b','c']);   // 63 s
    // Three shown: the fourth never comes and the timer restarts at each check.
    run(2000);expect(h.active).toEqual(['a','b','c']);expect(h.secondsSinceLesson).toBe(0);
    h.markLearned('a');expect(h.active).toEqual(['b','c']);
    // The Menu stops the checks but not the timer; closing it shows d at once.
    run(400,true);expect(h.active).toEqual(['b','c']);expect(h.secondsSinceLesson).toBe(100);
    run(1);expect(h.active).toEqual(['b','c','d']);
    // Not playing (front menu, loading): neither checks nor timer.
    h.markLearned('d');const t=h.secondsSinceLesson;h.update(5,{playing:false,menuOpen:false});expect(h.secondsSinceLesson).toBe(t);
  });

  it('shows Important and Critical at once, GoodToKnow under four, skips known notions and the Off switch',()=>{
    const {h,run}=helper([self('known',99),chance('x'),chance('y'),chance('z'),chance('w'),chance('v')],{known:.5});
    h.levelLoaded();
    expect(h.teachOpportunity('x','critical')).toBe(true);expect(h.teachOpportunity('y','important')).toBe(true);   // during the grace
    expect(h.teachOpportunity('z','good-to-know')).toBe(true);expect(h.teachOpportunity('w','good-to-know')).toBe(true);
    expect(h.active).toEqual(['x','y','z','w']);
    expect(h.teachOpportunity('v','good-to-know')).toBe(false);expect(h.opportunity('v')).toBe(60);
    expect(h.desire('known')).toBeCloseTo(99*.5,9);
    // 1000 s later the relax timer allows anything: known (> 0.15) is still
    // skipped, and v's opportunity ran out after 150 s (60 / 0.4).
    h.markLearned('x');h.markLearned('y');run(4000);
    expect(h.knowledge('known')).toBeCloseTo(.5-.00015*992.25,9);expect(h.opportunity('v')).toBe(0);expect(h.active).toEqual(['z','w']);
    expect(h.teachOpportunity('known','critical')).toBe(true);expect(h.active).toEqual(['z','w','known']);
    expect(h.teachOpportunity('w','critical')).toBe(false);   // already shown: no second entry
    h.setEnabled(false);expect(h.shown).toEqual([]);expect(h.teachOpportunity('v','critical')).toBe(false);
    h.setEnabled(true);expect(h.shown.map(row=>row.id)).toEqual(['z','w','known']);
  });

  it('forgets 0.00015 per real second, never a learned notion, and demonstrations count even when off',()=>{
    const {h,run,storage}=helper([self('a',10),self('done',9),chance('c')],{a:.5,done:1});
    run(400);   // 100 s
    expect(h.knowledge('a')).toBeCloseTo(.5-.015,9);expect(h.knowledge('done')).toBe(1);expect(h.isComplete('done')).toBe(true);
    h.setEnabled(false);
    h.demonstrate('a','specific');expect(h.knowledge('a')).toBeCloseTo(.885,9);
    h.demonstrate('a','frame-displayed',20);expect(h.knowledge('a')).toBeCloseTo(.965,9);   // 0.004 × 20 frames
    h.demonstrate('a','frame-displayed',10);expect(h.knowledge('a')).toBe(1);expect(h.isComplete('a')).toBe(true);
    expect(parseLearningKnowledge(storage.get(LEARNING_HELPER_STORAGE_KEY)!)?.knowledge.a).toBe(1);
    run(400);expect(h.knowledge('a')).toBe(1);
  });

  it('removes a notion from the list when demonstrated or marked learned (Compris)',()=>{
    const {h,storage}=helper([chance('c'),chance('d')]);
    h.teachOpportunity('c','critical');h.teachOpportunity('d','critical');expect(h.active).toEqual(['c','d']);
    h.demonstrate('c','specific');h.demonstrate('c','specific');expect(h.active).toEqual(['c','d']);   // 0.8
    h.demonstrate('c','specific');expect(h.active).toEqual(['d']);expect(h.opportunity('c')).toBe(0);
    h.markLearned('d');expect(h.active).toEqual([]);expect(h.knowledge('d')).toBe(1);
    expect(h.teachOpportunity('d','critical')).toBe(false);
    expect(storage.get(LEARNING_HELPER_STORAGE_KEY)).toBe('{"version":1,"enabled":true,"knowledge":{"c":1,"d":1}}');
  });

  it('shows a modal notion once, outside the list, even with the helper off',()=>{
    const {h}=helper([{...self('note',-1000),group:'modal'},self('a',95)],{},false);expect(h.enabled).toBe(false);
    expect(h.modalIfNotKnown('note')?.id).toBe('note');expect(h.modalIfNotKnown('note')).toBeUndefined();
    expect(h.modalIfNotKnown('a')).toBeUndefined();expect(h.active).toEqual([]);
  });
});

describe('learning helper · browser storage',()=>{
  it('keeps a strict small record and migrates the four first gestures once',()=>{
    expect(parseLearningKnowledge(null)).toEqual({version:1,enabled:true,knowledge:{}});
    for(const bad of ['{','[]','{"version":2,"enabled":true,"knowledge":{}}','{"version":1,"enabled":"yes","knowledge":{}}','{"version":1,"enabled":true,"knowledge":{"a":1.5}}',
      '{"version":1,"enabled":true,"knowledge":{"a":-0.1}}','{"version":1,"enabled":true,"knowledge":{"A B":0.1}}','{"version":1,"enabled":true,"knowledge":{},"extra":1}','x'.repeat(16385)])
      expect(parseLearningKnowledge(bad)).toBeUndefined();
    expect(serializeLearningKnowledge({version:1,enabled:false,knowledge:{b:.123456789,a:1,z:0}})).toBe('{"version":1,"enabled":false,"knowledge":{"a":1,"b":0.12346}}');
    const storage=new Map<string,string>([[FIRST_GESTURES_STORAGE_KEY,JSON.stringify({version:1,enabled:false,learned:{work:'confirmed',beds:'declared',storage:'confirmed',cultivation:'declared'}})]]);
    const io={read:(key:string)=>storage.get(key)??null,write:(key:string,value:string)=>{storage.set(key,value);}};
    const h=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>io.read(LEARNING_HELPER_STORAGE_KEY),write:value=>io.write(LEARNING_HELPER_STORAGE_KEY,value),readGestures:()=>io.read(FIRST_GESTURES_STORAGE_KEY)});
    expect(Object.values(GESTURE_CONCEPTS).sort()).toEqual(['beds','growing','stockpiles','work-tab']);
    for(const id of Object.values(GESTURE_CONCEPTS))expect(h.isComplete(id)).toBe(true);
    expect(storage.get(LEARNING_HELPER_STORAGE_KEY)).toBe('{"version":1,"enabled":true,"knowledge":{"beds":1,"growing":1,"stockpiles":1,"work-tab":1}}');
    // The gestures record is unchanged; a reset never imports it again.
    expect(JSON.parse(storage.get(FIRST_GESTURES_STORAGE_KEY)!).learned.work).toBe('confirmed');
    h.reset();expect(h.knowledge('work-tab')).toBe(0);
    const again=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>io.read(LEARNING_HELPER_STORAGE_KEY),write:value=>io.write(LEARNING_HELPER_STORAGE_KEY,value),readGestures:()=>io.read(FIRST_GESTURES_STORAGE_KEY)});
    expect(again.knowledge('work-tab')).toBe(0);
    // An unreadable record grants nothing, keeps the helper on, and says it.
    storage.set(LEARNING_HELPER_STORAGE_KEY,'{oops');
    const broken=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>io.read(LEARNING_HELPER_STORAGE_KEY),write:()=>false,readGestures:()=>io.read(FIRST_GESTURES_STORAGE_KEY)});
    expect(broken.saved).toBe(false);expect(broken.knowledge('work-tab')).toBe(0);expect(broken.enabled).toBe(true);
    // Unknown identifiers from another version are kept when the record is rewritten.
    storage.set(LEARNING_HELPER_STORAGE_KEY,'{"version":1,"enabled":true,"knowledge":{"later-notion":0.5}}');
    const kept=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>io.read(LEARNING_HELPER_STORAGE_KEY),write:value=>io.write(LEARNING_HELPER_STORAGE_KEY,value)});
    kept.markLearned('pause');expect(JSON.parse(storage.get(LEARNING_HELPER_STORAGE_KEY)!).knowledge).toEqual({'later-notion':.5,pause:1});
  });

  it('turns the helper off and resets it from the native Options, with a confirmation',async()=>{
    vi.stubGlobal('window',{});
    const storage=new Map<string,string>();
    const h=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>storage.get(LEARNING_HELPER_STORAGE_KEY)??null,write:value=>{storage.set(LEARNING_HELPER_STORAGE_KEY,value);}});
    h.markLearned('pause');h.markLearned('camera-zoom');
    let limit:1|2|3|4|5=1,page:NativePage|undefined;
    const noop=async()=>{},yes=()=>true;
    const options:FrontMenuOptions={onStart:noop,onLoad:noop,onResume:noop,
      getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,
      getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:yes,onSoundEnabledChange:yes,getSoundVolume:()=>1,onSoundVolumeChange:yes,onTestSound:noop,
      getMusicEnabled:yes,onMusicEnabledChange:yes,getMusicVolume:()=>1,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport:noop,
      getMaxSettlements:()=>limit,onMaxSettlementsChange:async value=>{limit=value;return true;},
      getLearningHelperEnabled:()=>h.enabled,onLearningHelperEnabledChange:value=>h.setEnabled(value),onLearningHelperReset:()=>h.reset(),
      learningNotice:id=>{const concept=h.modalIfNotKnown(id);return concept&&{title:concept.title,text:concept.text};}};
    const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
    const control=(id:string):NativeControl=>{const found=[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])].find(item=>item.id===id);if(!found)throw Error('Missing '+id);return found;};
    menu.showOptions!();
    const row=()=>page!.rows.find(entry=>entry.id==='learning-helper')!;
    expect(row().value).toBe('Activé');expect(row().hint).toContain('navigateur');
    await control('learning-helper').onActivate();
    expect(h.enabled).toBe(false);expect(row().value).toBe('Désactivé');expect(JSON.parse(storage.get(LEARNING_HELPER_STORAGE_KEY)!).enabled).toBe(false);
    await control('learning-helper').onActivate();expect(h.enabled).toBe(true);
    // Reset asks first; cancelling keeps everything.
    await control('learning-helper-reset').onActivate();expect(page!.id).toBe('front-confirm');expect(page!.title).toBe('Réinitialiser l’assistant');expect([page!.layout,page!.width,page!.height]).toEqual(['message',640,460]);
    await control('confirm-cancel').onActivate();expect(h.isComplete('pause')).toBe(true);
    await control('learning-helper-reset').onActivate();await control('confirm-accept').onActivate();
    expect(h.knowledge('pause')).toBe(0);expect(h.knowledge('camera-zoom')).toBe(0);expect(storage.get(LEARNING_HELPER_STORAGE_KEY)).toBe('{"version":1,"enabled":true,"knowledge":{}}');
    // Raising the colony limit above one shows its one-time note (Core MaxNumberOfPlayerSettlements).
    await control('settlements').select!.onChange('2');expect(limit).toBe(2);expect(page!.id).toBe('front-learning-notice');expect(page!.title).toBe('Plusieurs colonies');
    await control('learning-notice-accept').onActivate();expect(page!.id).toBe('front-options');
    await control('settlements').select!.onChange('3');expect(page!.id).toBe('front-options');
  });
});

describe('learning helper · events and gestures of the game',()=>{
  function runtime(world:()=>World|undefined){
    const storage=new Map<string,string>();let now=0;const activated=vi.fn();
    const rt=createLearningRuntime({read:key=>storage.get(key)??null,write:(key,value)=>{storage.set(key,value);},world,epoch:()=>0,playing:()=>true,arrivalPending:()=>false,menuOpen:()=>false,
      observe:()=>({}),now:()=>now,activated});
    return {rt,storage,activated,tick:(ms=250)=>{now+=ms;rt.tick();}};
  }
  // Each adopted snapshot is a fresh object in MAIN.
  const adopt=(world:World)=>structuredClone(world);

  it('a raid on a stepped world asks to equip weapons and to draft, without touching the World',()=>{
    const sim=deconstructionCamp(3);let snapshot=adopt(sim);
    const f=runtime(()=>snapshot);f.tick(0);
    enableRaids(sim);sim.raids!.nextCheck=sim.tick+1;stepWorld(sim);
    expect(sim.pawns.some(p=>p.raid)).toBe(true);
    snapshot=adopt(sim);const before=serializeWorld(snapshot);f.tick();
    expect(f.rt.helper.active).toEqual(expect.arrayContaining(['equipping-weapons','drafting']));
    expect(f.activated).toHaveBeenCalled();expect(serializeWorld(snapshot)).toBe(before);
    // Drafting demonstrated by the real command, which also raises QueueOrders.
    const id=sim.pawns.find(p=>!p.raid)!.id;
    f.rt.command({type:'draft',pawnIds:[id],enabled:true},JSON.stringify({ok:true}),snapshot);
    expect(f.rt.helper.knowledge('drafting')).toBeCloseTo(.4,9);expect(f.rt.helper.opportunity('queue-orders')).toBe(60);
  });

  it('a colonist downed asks for rescue (Critical), a downed raider for capture (Important)',()=>{
    const sim=deconstructionCamp(3);enableRaids(sim);sim.raids!.nextCheck=sim.tick+1;stepWorld(sim);
    let snapshot=adopt(sim);const f=runtime(()=>snapshot);f.tick(0);
    for(const id of ['equipping-weapons','drafting'])f.rt.helper.markLearned(id);
    const colonist=sim.pawns.find(p=>!p.raid)!;
    injurePawn(sim,colonist,'left-leg','crush',40*HP_UNIT);injurePawn(sim,colonist,'right-leg','crush',40*HP_UNIT);stepWorld(sim);
    expect(colonist.state).toBe('downed');
    // Shown at once; the following check already took 0.4 × 0.25 s off the opportunity.
    snapshot=adopt(sim);f.tick();expect(f.rt.helper.active).toContain('rescuing');expect(f.rt.helper.opportunity('rescuing')).toBeCloseTo(99.9,9);
    const raider=sim.pawns.find(p=>p.raid)!;
    injurePawn(sim,raider,'left-leg','bruise',30000);injurePawn(sim,raider,'right-leg','bruise',30000);stepWorld(sim);
    expect(raider.state).toBe('downed');
    snapshot=adopt(sim);f.tick();expect(f.rt.helper.active).toContain('capturing');expect(f.rt.helper.opportunity('capturing')).toBeCloseTo(79.9,9);
  });

  it('a fire raises the home area (Important); a loaded world is only a baseline',()=>{
    const sim=fireCamp(2);let snapshot=adopt(sim);const f=runtime(()=>snapshot);f.tick(0);
    const p=sim.pawns[0]!;woodFire(sim,{x:p.x+4,z:p.z},.6);stepWorld(sim);
    snapshot=adopt(sim);f.tick();expect(f.rt.helper.active).toContain('home-area');
    // The same fire in a world seen for the first time raises nothing.
    const fresh=adopt(sim),open=()=>true;
    expect(learningOpportunities(undefined,digestLearningWorld(fresh,open),fresh)).toEqual([]);
    expect(f.rt.helper.knowledge('home-area')).toBe(0);
    f.rt.command({type:'area',action:'home',from:{x:1,z:1},to:{x:3,z:3}},JSON.stringify({ok:true,affected:9}),snapshot);
    expect(f.rt.helper.isComplete('home-area')).toBe(true);expect(f.rt.helper.active).not.toContain('home-area');
  });

  it('commands and interface gestures demonstrate the notions they teach',()=>{
    const ok=JSON.stringify({ok:true,affected:4}),none=JSON.stringify({ok:true,affected:0}),refused=JSON.stringify({ok:false,reason:'x'});
    const area=(action:'stockpile'|'growing'|'mine')=>({type:'area' as const,action,from:{x:0,z:0},to:{x:1,z:1}});
    expect(learningFromCommand(area('stockpile'),ok).demonstrations).toEqual([{concept:'stockpiles',amount:'total'}]);
    expect(learningFromCommand(area('stockpile'),none).demonstrations).toEqual([]);
    expect(learningFromCommand(area('growing'),refused).demonstrations).toEqual([]);
    expect(learningFromCommand({type:'designate',kind:'door',x:1,z:1,material:'granite-blocks'},ok).opportunities).toEqual([{concept:'door-speed',type:'important'}]);
    expect(learningFromCommand({type:'designate',kind:'door',x:1,z:1,material:'wood'},ok).opportunities).toEqual([]);
    expect(learningFromCommand({type:'power-flick',structureId:1,on:false},ok).modal).toBe('flick-warning');
    expect(learningFromCommand({type:'order-rescue',pawnId:1,patientId:2,queue:true},ok).demonstrations).toEqual([{concept:'rescuing',amount:'total'},{concept:'queue-orders',amount:'note-taught'}]);
    const world=deconstructionCamp(1),pawn=world.pawns[0]!;
    const same=pawn.priorities.haul;
    expect(learningFromCommand({type:'priority',pawnId:pawn.id,work:'haul',value:same},ok,world).demonstrations).toEqual([]);
    expect(learningFromCommand({type:'priority',pawnId:pawn.id,work:'haul',value:same===1?2:1},ok,world).demonstrations).toEqual([{concept:'work-tab',amount:'specific'}]);
    // Displayed information is credited per frame of real time (0.25 s = 15 frames).
    const seen=learningFromObservation({hoveredId:'hud:alert:fire',pageId:'inspect-bills-12',cameraDolly:true,tileInspector:true},{},.25);
    expect(seen.demonstrations).toEqual([{concept:'alerts',amount:'frame-displayed',frames:15},{concept:'bills',amount:'frame-displayed',frames:15},
      {concept:'camera-dolly',amount:'frame-interaction',frames:15},{concept:'tile-inspector',amount:'tiny',frames:15}]);
    expect(learningFromObservation({panel:'world'},{panel:null},.25).opportunities).toEqual([{concept:'form-caravan',type:'important'}]);
    expect(learningFromObservation({panel:'world'},{panel:'world'},.25).opportunities).toEqual([]);
    // Speed controls: pause button and Space are Pause, a speed is TimeControls.
    const f=runtime(()=>undefined);f.rt.speed(0);f.rt.speed(3,true);f.rt.speed(3);
    expect(f.rt.helper.knowledge('pause')).toBeCloseTo(.8,9);expect(f.rt.helper.knowledge('time-controls')).toBeCloseTo(.4,9);
  });

  it('every notion is French, distinct and carries Core group and priority',()=>{
    const ids=LEARNING_CONCEPTS.map(concept=>concept.id);
    expect(new Set(ids).size).toBe(ids.length);expect(LEARNING_CONCEPTS.filter(concept=>concept.group!=='modal').length).toBeGreaterThanOrEqual(45);
    for(const concept of LEARNING_CONCEPTS){
      expect(concept.text.length).toBeGreaterThan(40);expect(concept.text.length).toBeLessThan(260);
      if(concept.group==='opportunistic')expect([concept.priority,concept.needsOpportunity]).toEqual([50,true]);
      if(concept.group==='modal')expect(concept.priority).toBe(-1000);
      if(concept.group==='self-show')expect(concept.priority).toBeGreaterThan(0);
    }
    const core=Object.fromEntries(LEARNING_CONCEPTS.map(concept=>[concept.core,concept]));
    expect([core.CameraDolly!.priority,core.Stockpiles!.priority,core.WorkTab!.priority,core.AnimalTaming!.priority,core.SpoilageAndFreezers!.priority]).toEqual([95,40,20,10.1,6.5]);
    expect([core.BillsTab!.opportunityDecays,core.Shelves!.opportunityDecays,core.Drafting!.opportunityDecays]).toEqual([false,false,true]);
  });
});

describe('learning helper · advice card',()=>{
  function stubCanvas():void {
    const methods=new Set(['clearRect','fillRect','strokeRect','save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','translate','rotate','scale','fillText','strokeText','drawImage','setLineDash','quadraticCurveTo','bezierCurveTo']);
    vi.stubGlobal('document',{createElement:(tag:string)=>{
      if(tag!=='canvas')throw Error(`Unexpected element ${tag}`);
      const state=new Map<PropertyKey,unknown>();
      const ctx=new Proxy({},{get(_target,key){if(key==='measureText')return (text:string)=>({width:text.length*7});if(typeof key==='string'&&methods.has(key))return()=>undefined;return state.get(key);},set(_target,key,value){state.set(key,value);return true;}});
      return {width:0,height:0,getContext:()=>ctx};
    }});
  }
  it('shows the notions with Compris first in the card and opens the card for a new notion',()=>{
    stubCanvas();
    const storage=new Map<string,string>();
    const h=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>storage.get(LEARNING_HELPER_STORAGE_KEY)??null,write:value=>{storage.set(LEARNING_HELPER_STORAGE_KEY,value);}});
    const art=new PrototypeCardboardArt(),root=new THREE.Group(),anchors={topLeft:new THREE.Group(),topRight:new THREE.Group()};root.add(anchors.topLeft,anchors.topRight);
    const session=createGuidanceCardSession(),world=deconstructionCamp(3);
    const guidance=createNativeGuidance(art,anchors,{session,learning:()=>undefined,world:()=>world,blocked:()=>false,sections:()=>[],now:()=>0,openHelp:()=>{},guide:()=>{},
      concepts:()=>h.shown,markConcept:id=>h.markLearned(id)});
    guidance.card.setViewport(1440,1000,.01,820);guidance.card.setHudVisible(true);
    const find=(id:string):CardboardPiece|undefined=>{let found:CardboardPiece|undefined;root.traverse(object=>{if(object.userData.nativeId===id)found=object as CardboardPiece;});return found;};
    try{
      session.loadedColony();guidance.sync();expect(find('hud:guidance:tab')).toBeDefined();
      h.teachOpportunity('drafting','critical');session.attention();guidance.sync();
      expect(session.mode).toBe('expanded');expect(find('hud:guidance:concept:drafting')).toBeDefined();
      expect(String(find('hud:guidance:concept:drafting')!.userData.tooltip)).toContain('mobilisez-les');
      const model=readGuidanceCard({concepts:h.shown});expect(model.concepts.map(row=>row.title)).toEqual(['Mobiliser']);
      expect(guidanceTabLabel(model.gesture,2)).toBe('Conseils · 2 notions à lire');
      find('hud:guidance:concept:drafting:learned')!.userData.onClick?.();
      expect(h.isComplete('drafting')).toBe(true);expect(find('hud:guidance:concept:drafting')).toBeUndefined();
      // A closed card reopens for a new notion; a pending arrival keeps waiting.
      session.close();h.teachOpportunity('rescuing','critical');session.attention();expect(session.mode).toBe('expanded');
      session.newColony();session.attention();expect(session.mode).toBe('closed');
    }finally{guidance.card.dispose();art.dispose();}
  });
});
