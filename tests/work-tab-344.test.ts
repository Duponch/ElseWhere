import {describe,expect,it,vi} from 'vitest';
import {applyCommand,createWorld,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index';
import {SCHEMA_VERSION,type Pawn,type WorkType,type World} from '../src/sim/types';
import {createScenarioWorld} from '../src/sim/new-game';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {captureGeneratedGeography256} from '../src/sim/world-geography-owner-256';
import {createGeographicNewGame256} from '../src/sim/geographic-new-game-256';
import {ACTUAL_SHRINES_750_256} from '../src/sim/ancient-temple-orchestration-256';
import {createStartingCandidateRoster} from '../src/sim/starting-candidates';
import {startingOriginalRequestFromRoster256} from '../src/sim/starting-original-request-256';
import {workPriority,withWorkTabMode344} from '../src/sim/work-types';
import {nextCellPriority344,nextColumnPriority344,nextWorkSort344,simpleWorkTab344,sortWorkRows344,validSimpleWorkTab344,workSortValue344,relevantSkillAverage344} from '../src/sim/work-tab-344';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {buildNativePanel} from '../src/ui3d/native-panels';
import {asOldSchema} from './scenarios/old-schema';

/* The Core 1.6 Work tab (schema 344): MainTabWindow_Work, WidgetsWork,
 * PawnColumnWorker_WorkPriority, PawnColumnWorker and PawnTable sorting,
 * PlaySettings.useWorkPriorities and Pawn_WorkSettings.GetPriority. */

let seed=3440000;
const works=(p:Pawn)=>Object.keys(p.priorities) as WorkType[];
function camp(count=3):World {
 const w=createWorld(++seed,16,16);for(const p of w.pawns)delete p.background;
 const sample=w.pawns[0]!;while(w.pawns.length<count){const p=structuredClone(sample);p.id=w.nextId++;p.name=`Colon ${p.id}`;w.pawns.push(p);}
 return w;
}
const ok=(w:World,command:Parameters<typeof applyCommand>[1])=>{const r=applyCommand(w,command);expect(r,JSON.stringify(r)).toMatchObject({ok:true});return r;};
const refused=(w:World,command:unknown)=>{const before=JSON.stringify(w);const r=applyCommand(w,command as Parameters<typeof applyCommand>[1]);expect(r.ok).toBe(false);expect(JSON.stringify(w)).toBe(before);return r;};
const roundTrip=(w:World)=>deserializeWorld(serializeWorld(w));

function ui(world:World){
 let page:NativePage;
 const state:NativeUiState={world,epoch:++seed,panel:'work',category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 const noop=()=>{};
 const actions:NativeUiActions={command:vi.fn(async c=>applyCommand(world,c)),readState:()=>state,showPage:next=>{page=next;},refresh:noop,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
 const rebuild=()=>{page=buildNativePanel(state,actions)!;return page;};rebuild();
 const control=(id:string):NativeControl=>{const c=[...(page.actions??[]),...page.rows.flatMap(r=>[...(r.controls??[]),...(r.columns??[]).flatMap(col=>col.control?[col.control]:[])])].find(c=>c.id===id);if(!c)throw Error(`Missing ${id}`);return c;};
 const order=()=>page.rows.filter(r=>/^worker-\d+$/.test(r.id)).map(r=>Number(r.id.slice(7)));
 return {state,actions,rebuild,control,order,get page(){return page;}};
}

describe('the manual priorities toggle is a saved campaign setting (PlaySettings.useWorkPriorities)',()=>{
 it('goes through the command path, persists strictly and is refused when malformed',()=>{
  const w=camp(),before=w.pawns.map(p=>({...p.priorities}));
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);expect(simpleWorkTab344(w)).toBe(false);expect(Object.hasOwn(w,'simpleWorkTab344')).toBe(false);
  ok(w,{type:'work-tab-mode',manual:false});
  expect(w.simpleWorkTab344).toBe(true);expect(simpleWorkTab344(w)).toBe(true);expect(validateWorld(w)).toEqual([]);
  const loaded=roundTrip(w);expect(loaded.simpleWorkTab344).toBe(true);expect(serializeWorld(loaded)).toBe(serializeWorld(w));
  ok(w,{type:'work-tab-mode',manual:true});expect(Object.hasOwn(w,'simpleWorkTab344')).toBe(false);expect(roundTrip(w).simpleWorkTab344).toBeUndefined();
  ok(w,{type:'work-tab-mode',manual:true});expect(Object.hasOwn(w,'simpleWorkTab344')).toBe(false);
  expect(w.pawns.map(p=>({...p.priorities}))).toEqual(before);
  for(const bad of [{type:'work-tab-mode'},{type:'work-tab-mode',manual:1},{type:'work-tab-mode',manual:false,extra:true}])refused(w,bad);
  // Strict save: only an own, enumerable `true`.
  for(const value of [false,'true',1,null,{}]){const raw=JSON.parse(serializeWorld(w));raw.simpleWorkTab344=value;expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/Work tab mode/);}
  expect(validSimpleWorkTab344({simpleWorkTab344:true},SCHEMA_VERSION)).toBe(true);
  const hidden={};Object.defineProperty(hidden,'simpleWorkTab344',{value:true,enumerable:false});expect(validSimpleWorkTab344(hidden,SCHEMA_VERSION)).toBe(false);
 });
 it('a new game starts with the simple tab, as in Core; diagnostic scenarios keep manual priorities',()=>{
  // The player's "Nouvelle partie": a generated planet, a chosen tile, the real crash landing.
  const drain=<Y,T>(it:Generator<Y,T,void>):T=>{let step=it.next();while(!step.done)step=it.next();return step.value;};
  const draft=drain(generateGeographicWorldDraft256({seed:'Camp2274 preview 256 🌲',settings:{...defaultWorldGenerationSettings(),rainfall:4,temperature:2},tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'QA344'}));
  const geography=captureGeneratedGeography256(draft),roster=createStartingCandidateRoster(259017);
  const root=drain(createGeographicNewGame256({draft,geography,tile:50388,size:200,scenario:'crashlanded',startingParty:startingOriginalRequestFromRoster256(259017,roster)},{shrines750:ACTUAL_SHRINES_750_256}));
  expect(root.simpleWorkTab344).toBe(true);expect(simpleWorkTab344(root)).toBe(true);expect(validateWorld(root)).toEqual([]);
  expect(JSON.parse(serializeWorld(root)).simpleWorkTab344).toBe(true);
  // Scenario builders (diagnostics, prepared colonies) are not a new game.
  expect(Object.hasOwn(createScenarioWorld(++seed,32,'survivors'),'simpleWorkTab344')).toBe(false);
 },120000);
});

describe('cell clicks (WidgetsWork.DrawWorkBoxFor)',()=>{
 it('manual: left click 4 → 3 → 2 → 1 → off → 4, right click the reverse; simple: the checkbox stores 3 or 0',()=>{
  const cycle=(start:number,click:'primary'|'secondary',simple=false)=>{const out=[start];for(let i=0;i<5;i++)out.push(nextCellPriority344(out.at(-1)!,simple,click));return out;};
  expect(cycle(0,'primary')).toEqual([0,4,3,2,1,0]);
  expect(cycle(0,'secondary')).toEqual([0,1,2,3,4,0]);
  for(const click of ['primary','secondary'] as const){expect(nextCellPriority344(0,true,click)).toBe(3);expect(nextCellPriority344(3,true,click)).toBe(0);}
 });
 it('the native cells cycle through real priority commands in manual mode',async()=>{
  const w=camp(),p=w.pawns[0]!,f=ui(w),others=w.pawns.slice(1).map(o=>({...o.priorities}));
  p.priorities.build=0;f.rebuild();
  expect(f.control(`work-${p.id}-build`).select).toBeUndefined();expect(f.control(`work-${p.id}-build`).label).toBe('');
  const seen:number[]=[];
  for(let i=0;i<5;i++){await f.control(`work-${p.id}-build`).onActivate();seen.push(p.priorities.build);f.rebuild();}
  expect(seen).toEqual([4,3,2,1,0]);
  expect(f.actions.command).toHaveBeenNthCalledWith(1,{type:'priority',pawnId:p.id,work:'build',value:4});
  for(let i=0;i<5;i++){await f.control(`work-${p.id}-build`).onSecondary!();seen.push(p.priorities.build);f.rebuild();}
  expect(seen.slice(5)).toEqual([1,2,3,4,0]);
  p.priorities.build=2;f.rebuild();expect(f.control(`work-${p.id}-build`).label).toBe('2');expect(f.control(`work-${p.id}-build`).mark).toBeUndefined();
  expect(w.pawns.slice(1).map(o=>({...o.priorities}))).toEqual(others);
 });
 it('the native cells are checkboxes in simple mode: stored values stay hidden behind the check',async()=>{
  const w=camp(),p=w.pawns[0]!;ok(w,{type:'work-tab-mode',manual:false});p.priorities.build=2;p.priorities.mine=0;
  const f=ui(w),build=f.control(`work-${p.id}-build`);
  expect(build.mark).toBe('check');expect(build.label).toBe('Activé');expect(build.hint).toContain('activé');
  expect(f.control(`work-${p.id}-mine`).mark).toBeUndefined();
  await build.onActivate();expect(p.priorities.build).toBe(0);
  f.rebuild();await f.control(`work-${p.id}-build`).onSecondary!();expect(p.priorities.build).toBe(3);
  await f.control(`work-${p.id}-mine`).onActivate();expect(p.priorities.mine).toBe(3);
 });
 it('refuses a background incapacity and keeps the busy guard',async()=>{
  const w=camp(),p=w.pawns[0]!,f=ui(w);p.priorities.haul=3;f.rebuild();const cell=f.control(`work-${p.id}-haul`);
  f.state.busy=true;await expect(Promise.resolve().then(()=>cell.onActivate())).rejects.toThrow('opération courante');
  await expect(Promise.resolve().then(()=>cell.onSecondary!())).rejects.toThrow('opération courante');f.state.busy=false;
  expect(f.actions.command).not.toHaveBeenCalled();
  p.background={childhood:'school-child',adulthood:'researcher'};
  await expect(Promise.resolve().then(()=>cell.onActivate())).rejects.toThrow('Incapacité liée au passé');expect(p.priorities.haul).toBe(3);
  f.rebuild();const off=f.control(`work-${p.id}-haul`);expect(off.disabled).toBe(true);expect(off.label).toBe('');expect(off.hint).toContain('Priorité enregistrée : 3');
 });
});

describe('Shift-click on a column (PawnColumnWorker_WorkPriority.HeaderClicked)',()=>{
 it('follows Core in both modes and skips the pawns that cannot do the work',async()=>{
  expect([0,1,2,3,4].map(v=>nextColumnPriority344(v,false,'primary'))).toEqual([4,undefined,1,2,3]);
  expect([0,1,2,3,4].map(v=>nextColumnPriority344(v,false,'secondary'))).toEqual([undefined,2,3,4,0]);
  expect([0,3].map(v=>nextColumnPriority344(v,true,'primary'))).toEqual([3,undefined]);
  expect([0,3].map(v=>nextColumnPriority344(v,true,'secondary'))).toEqual([undefined,0]);
  const w=camp(4),[a,b,c,d]=w.pawns as [Pawn,Pawn,Pawn,Pawn],f=ui(w);
  a.priorities.haul=0;b.priorities.haul=1;c.priorities.haul=3;d.priorities.haul=2;d.background={childhood:'school-child',adulthood:'researcher'};
  const disabled=JSON.stringify(d.priorities);f.rebuild();
  const head=f.control('work-column-haul');
  await head.onActivate({shift:true});
  expect([a,b,c].map(p=>p.priorities.haul)).toEqual([4,1,2]);expect(JSON.stringify(d.priorities)).toBe(disabled);
  expect(f.actions.command).toHaveBeenLastCalledWith({type:'priority-column',work:'haul',pawnIds:[a.id,b.id,c.id,d.id],click:'primary'});
  f.rebuild();await f.control('work-column-haul').onSecondary!({shift:true});
  expect([a,b,c].map(p=>p.priorities.haul)).toEqual([0,2,3]);
  // Simple mode reads 3 for any enabled work: the stored 2 stays.
  ok(w,{type:'work-tab-mode',manual:false});b.priorities.haul=2;f.rebuild();
  await f.control('work-column-haul').onActivate({shift:true});
  expect([a,b,c].map(p=>p.priorities.haul)).toEqual([3,2,3]);
  f.rebuild();await f.control('work-column-haul').onSecondary!({shift:true});
  expect([a,b,c].map(p=>p.priorities.haul)).toEqual([0,0,0]);
  expect(JSON.stringify(d.priorities)).toBe(disabled);expect(validateWorld(w)).toEqual([]);
 });
 it('only lists the table rows (search) and refuses a malformed or stale list atomically',async()=>{
  const w=camp(3),[a,b,c]=w.pawns as [Pawn,Pawn,Pawn],f=ui(w);for(const p of w.pawns)p.priorities.cook=0;
  b.name='Basile';f.rebuild();await f.page.rows.find(r=>r.id==='work-search')!.input!.onCommit('basile');
  await f.control('work-column-cook').onActivate({shift:true});
  expect([a,b,c].map(p=>p.priorities.cook)).toEqual([0,4,0]);
  const base={type:'priority-column',work:'cook',click:'primary'};
  for(const pawnIds of [[],[a.id,a.id],[a.id,w.nextId+50],[1.5],'all'])refused(w,{...base,pawnIds});
  refused(w,{...base,pawnIds:[a.id],extra:1});refused(w,{...base,work:'dance',pawnIds:[a.id]});refused(w,{...base,click:'middle',pawnIds:[a.id]});
  c.prisoner={} as never;refused(w,{...base,pawnIds:[a.id,c.id]});
 });
});

describe('sorting by a work column (PawnColumnWorker.HeaderClicked, PawnTable.RecachePawns)',()=>{
 it('cycles like Core and orders by the relevant skill average, stably, incapable pawns at the low end',async()=>{
  expect(nextWorkSort344(undefined,'build','primary')).toEqual({work:'build',descending:true});
  expect(nextWorkSort344({work:'build',descending:true},'build','primary')).toEqual({work:'build',descending:false});
  expect(nextWorkSort344({work:'build',descending:false},'build','primary')).toBeUndefined();
  expect(nextWorkSort344(undefined,'build','secondary')).toEqual({work:'build',descending:false});
  expect(nextWorkSort344({work:'build',descending:false},'build','secondary')).toEqual({work:'build',descending:true});
  expect(nextWorkSort344({work:'build',descending:true},'build','secondary')).toBeUndefined();
  expect(nextWorkSort344({work:'mine',descending:false},'build','primary')).toEqual({work:'build',descending:true});
  const w=camp(4),[a,b,c,d]=w.pawns as [Pawn,Pawn,Pawn,Pawn],f=ui(w);
  a.skills.construction.level=5;b.skills.construction.level=12;c.skills.construction.level=5;d.skills.construction.level=20;
  d.background={childhood:'school-child',adulthood:'researcher'};
  expect(workSortValue344(d,'haul')).toBe(-1);expect(relevantSkillAverage344(a,'haul')).toBe(3);
  // Hunting averages Shooting and Animals (WorkTypes.xml).
  a.skills.shooting.level=8;a.skills.animals={level:2,xp:0,dailyXp:0,passion:0};expect(relevantSkillAverage344(a,'hunt')).toBe(5);
  f.rebuild();const natural=f.order();expect(natural).toEqual([a.id,b.id,c.id,d.id]);
  await f.control('work-column-build').onActivate();expect(f.order()).toEqual(sortWorkRows344([a,b,c,d],{work:'build',descending:true}).map(p=>p.id));
  expect(f.order()).toEqual([a.id,c.id,b.id,d.id]);
  await f.control('work-column-build').onActivate();expect(f.order()).toEqual([d.id,b.id,a.id,c.id]);
  await f.control('work-column-build').onActivate();expect(f.order()).toEqual(natural);
  await f.control('work-column-build').onSecondary!();expect(f.order()).toEqual([d.id,b.id,a.id,c.id]);
  // An incapable pawn compares at -1 (PawnColumnWorker_WorkPriority.GetValueToCompare).
  await f.control('work-column-haul').onActivate();expect(f.order()[0]).toBe(d.id);
  // Shift-click never sorts, and sorting sends no command.
  const calls=vi.mocked(f.actions.command).mock.calls.length,order=f.order();
  await f.control('work-column-build').onActivate({shift:true});f.rebuild();expect(f.order()).toEqual(order);
  expect(vi.mocked(f.actions.command).mock.calls.length).toBe(calls+1);
 });
});

describe('switching modes rewrites nothing; simple mode reads 3 (Pawn_WorkSettings.GetPriority)',()=>{
 it('keeps every stored priority and restores the manual values',async()=>{
  const w=camp(),p=w.pawns[0]!;p.priorities.build=1;p.priorities.mine=4;p.priorities.grow=0;
  const stored=w.pawns.map(o=>JSON.stringify(o.priorities));
  ok(w,{type:'work-tab-mode',manual:false});expect(w.pawns.map(o=>JSON.stringify(o.priorities))).toEqual(stored);
  expect(withWorkTabMode344(true,()=>[workPriority(p,'build'),workPriority(p,'mine'),workPriority(p,'grow')])).toEqual([3,3,0]);
  expect([workPriority(p,'build'),workPriority(p,'mine')]).toEqual([1,4]);
  const f=ui(w);await f.control(`work-${p.id}-grow`).onActivate();expect(p.priorities.grow).toBe(3);
  await f.control('work-manual-priorities').onActivate();expect(w.simpleWorkTab344).toBeUndefined();
  expect([p.priorities.build,p.priorities.mine,p.priorities.grow]).toEqual([1,4,3]);
  f.rebuild();expect(f.control(`work-${p.id}-build`).label).toBe('1');expect(f.control('work-manual-priorities').active).toBe(true);
 });
 it('the work giver order follows the mode: manual priority 1 chopping before Mining 4; simple, Mining (natural 600) before PlantCutting (500)',()=>{
  const job=(simple:boolean)=>{
   const w=createWorld(4242,40,40);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.jobs=[];w.structures=[];w.piles=[];w.stockpiles=[];w.pawns=w.pawns.slice(0,1);
   const p=w.pawns[0]!;delete p.background;Object.assign(p,{x:6,z:6,hunger:100,rest:100});p.schedule.fill('anything');
   for(const key of works(p))p.priorities[key]=0;p.priorities.mine=4;p.priorities.gather=1;
   w.tiles[6*40+9]={terrain:'rock',stone:'granite'};w.resources.push({id:w.nextId++,kind:'tree',x:3,z:6,amount:12});
   ok(w,{type:'designate',kind:'mine',x:9,z:6});ok(w,{type:'designate',kind:'chop',x:3,z:6});
   if(simple)ok(w,{type:'work-tab-mode',manual:false});
   for(let i=0;i<200&&p.jobId===null;i++)stepWorld(w);
   expect(validateWorld(w)).toEqual([]);expect(p.priorities.gather).toBe(1);
   return w.jobs.find(j=>j.id===p.jobId)?.kind;
  };
  expect(job(false)).toBe('chop');expect(job(true)).toBe('mine');
 });
});

describe('older schemas and migration 343 → 344',()=>{
 it('a 343 save migrates by number only and keeps manual priorities; a 343 save with the setting is refused',()=>{
  const w=camp();w.pawns[0]!.priorities.build=1;const json=serializeWorld(w);
  const migrated=deserializeWorld(asOldSchema(json,343));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(Object.hasOwn(migrated,'simpleWorkTab344')).toBe(false);expect(simpleWorkTab344(migrated)).toBe(false);
  expect(migrated.pawns.map(p=>p.priorities)).toEqual(w.pawns.map(p=>p.priorities));
  const simple=camp();ok(simple,{type:'work-tab-mode',manual:false});expect(simple.simpleWorkTab344).toBe(true);
  const old=deserializeWorld(asOldSchema(serializeWorld(simple),343));expect(Object.hasOwn(old,'simpleWorkTab344')).toBe(false);
  const raw=JSON.parse(serializeWorld(simple));raw.schemaVersion=343;expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/version343/);
 });
 it('nothing reads the setting below 344',()=>{
  expect(simpleWorkTab344({schemaVersion:343,simpleWorkTab344:true})).toBe(false);
  expect(validSimpleWorkTab344({simpleWorkTab344:true},343)).toBe(false);expect(validSimpleWorkTab344({},343)).toBe(true);
  const w=camp(),p=w.pawns[0]!;p.priorities.build=1;(w as {schemaVersion:number}).schemaVersion=343;
  refused(w,{type:'work-tab-mode',manual:false});refused(w,{type:'priority-column',work:'build',pawnIds:[p.id],click:'primary'});
  (w as {simpleWorkTab344?:true}).simpleWorkTab344=true;
  const stepped=withWorkTabMode344(false,()=>workPriority(p,'build'));expect(stepped).toBe(1);
  expect(applyCommand(w,{type:'priority',pawnId:p.id,work:'build',value:2}).ok).toBe(true);expect(p.priorities.build).toBe(2);
 });
});
