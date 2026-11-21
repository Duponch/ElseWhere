import {expect,test,vi} from 'vitest';

/* The inspirations of Core RimWorld 1.6 (schema 360). The own stream of the
 * inspiration check is a pure function of seed, pawn and tick; a few tests
 * script the draws of one check (as Rand.PushState would), every other check
 * keeps the real stream. */
const hook=vi.hoisted(()=>({forced:new Map<string,number[]>(),calls:[] as string[]}));
vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));
vi.mock('../src/sim/inspiration-stream-360.ts',async importOriginal=>{
  const real=await importOriginal<typeof import('../src/sim/inspiration-stream-360.ts')>();
  return {inspirationStream360:(seed:number,id:number,tick:number)=>{
    hook.calls.push(`${id}@${tick}`);
    const scripted=hook.forced.get(`${id}@${tick}`);
    if(!scripted)return real.inspirationStream360(seed,id,tick);
    const queue=[...scripted];return ()=>queue.length?queue.shift()!:0;
  }};
});

import {stepWorld,applyCommand} from '../src/sim/index.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {groupPawnInterval256} from '../src/sim/group-core-cadence-256.ts';
import {pawnBody} from '../src/sim/health-rules.ts';
import {campaignLetters352,stackLetters352} from '../src/sim/letters-352.ts';
import {startSadWander} from '../src/sim/mental-break.ts';
import {craftingQuality} from '../src/sim/crafting-quality.ts';
import {WEAPON_QUALITIES} from '../src/sim/equipment-rules.ts';
import {smoothingSpeed281} from '../src/sim/smooth-floor-281.ts';
import {medicalSurgerySpeed,surgerySuccessChance} from '../src/sim/surgery-rules.ts';
import {humanMoveSpeedFactor297} from '../src/sim/human-move-speed-297.ts';
import {shootingAccuracy} from '../src/sim/ranged-statistics.ts';
import {tradeImprovement} from '../src/sim/trade-negotiator.ts';
import {quoteTrade,tradeGoods} from '../src/sim/trade-goods.ts';
import {tradingAtContact} from '../src/sim/trade-contact.ts';
import {tradeUnitPrice} from '../src/sim/trade-prices.ts';
import {addGroundMaterial,addMaterial,refreshStock} from '../src/sim/materials.ts';
import {PRODUCTION_RECIPES} from '../src/sim/production-recipes.ts';
import {applyTaming,handlingProposal,handlingWanted,processHandling,startHandling} from '../src/sim/animal-handling.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {releaseWork} from '../src/sim/work-release.ts';
import {prepareSuspendedHumanResume271} from '../src/sim/suspended-human-clock-271.ts';
import {colonistBarState346} from '../src/ui/colonist-bar-state-346.ts';
import {
  INSPIRATIONS_360,INSPIRATION_DURATION_360,inspirationCanOccur360,inspirationCommonality360,inspirationMtbDays360,
  inspirationInspectLine360,mtbEventOccurs360,randomAvailableInspiration360,startInspiration360,tickInspiration360,useInspiration360,
} from '../src/sim/inspirations-360.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import {recruitmentUiFixture} from './scenarios/prison-camp.ts';
import {visitorTradeFixture} from './scenarios/visitors.ts';
import {createWorld} from '../src/sim/index.ts';
import {enableWildlife} from '../src/sim/wildlife.ts';
import {legacyHumanAge} from '../src/sim/human-age.ts';
import {SCHEMA_VERSION,type Pawn,type Structure,type World} from '../src/sim/types.ts';

const colonists=(w:World)=>w.pawns.filter(p=>(p.faction??'colony')==='colony'&&!p.prisoner&&!p.visitor&&p.state!=='dead');
/** The first local tick from `from` holding the pawn's hashed 100-tick check. */
function nextCheck(id:number,from:number):number {for(let t=Math.max(1,from);;t++)if(groupPawnInterval256(id,(t-1)*10+1,100,10))return t;}
let baseJson:string|undefined;
/** A Crashlanded colony after the arrival, at the current schema. */
function colony():World {
  if(!baseJson){
    const w=createScenarioWorld(42,64,'crashlanded');
    for(let i=0;i<3000&&(colonists(w).length<3||w.startingArrival);i++)stepWorld(w);
    expect(colonists(w).length).toBe(3);
    baseJson=serializeWorld(w);
  }
  return deserializeWorld(baseJson);
}
const skilled=(p:Pawn)=>{delete p.background;for(const skill of ['social','animals','medicine','shooting','artistic','construction','crafting'] as const)p.skills[skill]={level:8,xp:0,dailyXp:0,passion:0};};

test('Core constants: 8 days, 100-tick checks, MTB from 210 days at 50 % mood to 10 days at 100 %',()=>{
  expect(INSPIRATIONS_360.map(d=>d.def)).toEqual(['Frenzy_Work','Frenzy_Go','Frenzy_Shoot','Inspired_Trade','Inspired_Recruitment','Inspired_Taming','Inspired_Surgery','Inspired_Creativity']);
  expect(INSPIRATION_DURATION_360).toBe(48000);
  expect(inspirationMtbDays360(.49)).toBeUndefined();
  expect(inspirationMtbDays360(.5)).toBe(210);expect(inspirationMtbDays360(.75)).toBe(110);expect(inspirationMtbDays360(1)).toBe(10);
  // MTB 10 days: 100/600000 >= 1e-4, one draw compared with it.
  expect(mtbEventOccurs360(10,60000,100,()=>.000166)).toBe(true);
  expect(mtbEventOccurs360(10,60000,100,()=>.000167)).toBe(false);
  // MTB 50 days: chance 3.3e-5 is gated by 1/8 first, then compared with 2.67e-4.
  const draws=[.2,0];expect(mtbEventOccurs360(50,60000,100,()=>draws.shift()!)).toBe(false);expect(draws).toEqual([0]);
  const pass=[.1,.0002];expect(mtbEventOccurs360(50,60000,100,()=>pass.shift()!)).toBe(true);
});

test('a happy colonist is inspired through real ticks at its hashed check, with a PositiveEvent letter',()=>{
  const w=colony(),c=colonists(w)[0]!;skilled(c);c.mood=95;
  const at=nextCheck(c.id,w.tick+1);
  // MTB gate, MTB chance, then the weighted draw: Range(0, 2) >= 1 picks the
  // go frenzy over the work frenzy, the later admitted kinds keep it.
  hook.forced.set(`${c.id}@${at}`,[0,0,.9,0,0,0,0,0,0]);hook.calls=[];
  while(w.tick<at-1){stepWorld(w);c.mood=Math.max(c.mood,95);}
  expect(c.inspiration360).toBeUndefined();
  stepWorld(w);
  hook.forced.clear();
  expect(hook.calls).toContain(`${c.id}@${at}`);
  // Only the pawn's interval ticks draw, never the ticks between.
  expect(hook.calls.filter(k=>k.startsWith(`${c.id}@`)).every(k=>groupPawnInterval256(c.id,(Number(k.split('@')[1])-1)*10+1,100,10))).toBe(true);
  expect(c.inspiration360).toEqual({kind:'go-frenzy',start:at,until:at+48000});
  const letter=stackLetters352(campaignLetters352(w)).at(-1)!;
  expect(letter).toMatchObject({cls:'positive',title:`Frénésie de mouvement : ${c.name}`,targets:[{kind:'actor',id:c.id}]});
  expect(letter.text).toContain('40 % plus vite');
  expect(validateWorld(w)).toEqual([]);
  // Inspector line and colonist bar mark.
  expect(inspirationInspectLine360(w,c)).toMatchObject({label:'Inspiration : frénésie de mouvement',value:'expire dans 8,0 jours'});
  expect(colonistBarState346(w,c).icons.at(-1)).toEqual({kind:'inspired',label:'Frénésie de mouvement'});
});

test('no inspiration under 50 % mood, nor for a pawn that cannot be awake; a downed pawn never gets the go frenzy',()=>{
  const w=colony(),c=colonists(w)[0]!;skilled(c);
  // Sad (a broken pawn is sad too: Core has no mental-state test of its own).
  c.mood=40;const at=nextCheck(c.id,w.tick+1);
  hook.forced.set(`${c.id}@${at}`,[0,0,0,0,0,0,0,0,0]);hook.calls=[];
  while(w.tick<at){stepWorld(w);c.mood=Math.min(c.mood,40);}
  expect(hook.calls).not.toContain(`${c.id}@${at}`);
  expect(c.inspiration360).toBeUndefined();
  // Cannot be awake (CheckStartRandomInspiration: !CanBeAwake).
  c.mood=100;const next=nextCheck(c.id,w.tick+1);w.tick=next;
  hook.forced.set(`${c.id}@${next}`,[0,0,0,0,0,0,0,0,0]);hook.calls=[];
  tickInspiration360(w,c,{...pawnBody(c),canBeAwake:false});
  expect(hook.calls).toEqual([]);expect(c.inspiration360).toBeUndefined();
  // Downed: every kind but the go frenzy stays admitted (allowedOnDownedPawns).
  c.state='downed';
  expect(inspirationCanOccur360(c,'go-frenzy')).toBe(false);
  expect(inspirationCanOccur360(c,'work-frenzy')).toBe(true);
  const draws=[.9,0,0,0,0,0,0];
  expect(randomAvailableInspiration360(c,()=>draws.shift()!)).toBe('shoot-frenzy');
  c.state='idle';
  const upright=[.9,0,0,0,0,0,0];
  expect(randomAvailableInspiration360(c,()=>upright.shift()!)).toBe('go-frenzy');
  hook.forced.clear();
});

test('admission and weights follow each InspirationDef: skills, work types, capacities, age, passions',()=>{
  const w=colony(),c=colonists(w)[0]!;delete c.background;
  for(const skill of ['social','animals','medicine','artistic','construction','crafting'] as const)c.skills[skill]={level:2,xp:0,dailyXp:0,passion:0};c.skills.shooting.passion=0;
  expect(INSPIRATIONS_360.filter(d=>inspirationCanOccur360(c,d.kind)).map(d=>d.kind)).toEqual(['work-frenzy','go-frenzy','shoot-frenzy']);
  c.skills.social={level:3,xp:0,dailyXp:0,passion:2};c.skills.artistic={level:3,xp:0,dailyXp:0,passion:1};
  expect(INSPIRATIONS_360.filter(d=>inspirationCanOccur360(c,d.kind)).map(d=>d.kind)).toEqual(['work-frenzy','go-frenzy','shoot-frenzy','trade','recruitment','creativity']);
  // CommonalityFor: base 1 × the best passion of the associated skills.
  expect(INSPIRATIONS_360.map(d=>inspirationCommonality360(c,d.kind))).toEqual([1,1,1,5,5,1,1,2.5]);
  // Age: the trade needs 6 years, the surgery and the creativity 13.
  c.skills.medicine={level:5,xp:0,dailyXp:0,passion:0};
  const years=(n:number)=>({...c.age!,biologicalTicks:n*60*6000});
  if(c.age){c.age=years(12);expect(inspirationCanOccur360(c,'surgery')).toBe(false);expect(inspirationCanOccur360(c,'trade')).toBe(true);c.age=years(30);}
  expect(inspirationCanOccur360(c,'surgery')).toBe(true);
  // Not a free colonist: no inspiration (allowedOnNonColonists false).
  c.prisoner={} as never;expect(inspirationCanOccur360(c,'work-frenzy')).toBe(false);delete c.prisoner;
});

test('each kind changes its Core consumer: work, move, shooting, trade, surgery and created quality',()=>{
  const w=colony(),c=colonists(w)[0]!;skilled(c);
  const with360=(kind:Pawn['inspiration360'] extends infer T?T extends {kind:infer K}?K:never:never,read:()=>number)=>{delete c.inspiration360;const before=read();c.inspiration360={kind,start:w.tick,until:w.tick+48000};const after=read();delete c.inspiration360;return after/before;};
  // Frenzy_Work: WorkSpeedGlobal ×1.8 (smoothing, operation speed…).
  expect(with360('work-frenzy',()=>smoothingSpeed281(c,1))).toBeCloseTo(1.8,12);
  expect(with360('work-frenzy',()=>medicalSurgerySpeed(c,1))).toBeCloseTo(1.8,12);
  // Frenzy_Go: MoveSpeed ×1.4.
  expect(with360('go-frenzy',()=>humanMoveSpeedFactor297(w,c))).toBeCloseTo(1.4,12);
  // Frenzy_Shoot: ShootingAccuracyPawn +8 before the curve.
  expect(shootingAccuracy(6,1,1,8).perCell).toBe(shootingAccuracy(14,1,1).perCell);
  // Inspired_Trade: TradePriceImprovement +0.18 under the 0.395 cap.
  const base=tradeImprovement(c);expect(base).toBeCloseTo(.12,12);
  expect(tradeImprovement(c,.18)).toBeCloseTo(.30,12);
  c.skills.social={level:20,xp:0,dailyXp:0,passion:0};expect(tradeImprovement(c,.18)).toBe(.395);
  // Inspired_Surgery: success ×2 before ClampToRange(0, 0.98).
  const input={doctor:c,medicine:'herbal-medicine' as const,patientGlow:1,roomCleanliness:0,outdoors:false};
  const plain=surgerySuccessChance(input);
  expect(surgerySuccessChance({...input,inspired:true})).toBeCloseTo(Math.min(.98,plain*2),12);
  c.skills.medicine={level:20,xp:0,dailyXp:0,passion:0};
  expect(surgerySuccessChance({...input,inspired:true})).toBe(.98);
  // Inspired_Creativity: two levels more, at most legendary.
  for(const level of [0,5,10,20])for(let seed=1;seed<40;seed++){
    const sequence=(s:number)=>{let x=s;return ()=>{x=(Math.imul(x,1103515245)+12345)>>>0;return x/0x100000000;};};
    const normal=WEAPON_QUALITIES.indexOf(craftingQuality(level,sequence(seed)));
    expect(WEAPON_QUALITIES.indexOf(craftingQuality(level,sequence(seed),true))).toBe(Math.min(6,normal+2));
  }
  expect(craftingQuality(20,()=>.999999,true)).toBe('legendary');
});

test('an inspired artist makes the sculpture two levels better through real ticks and spends it; a work frenzy makes it sooner',()=>{
  // The art-production arena (createWorld 32², one artist, an art bench and 50 wood).
  const run=(inspired:boolean|'work-frenzy')=>{
    const w=createWorld(104,32,32);w.tiles=w.tiles.map(()=>({terrain:'grass'}));
    w.resources=[];w.jobs=[];w.structures=[];w.piles=[];w.stockpiles=[];w.packed=[];w.pawns=w.pawns.slice(0,1);if(w.wildlife)w.wildlife.animals=[];
    delete w.arrivals;delete w.raids;
    const artist=w.pawns[0]!;delete artist.background;Object.assign(artist,{x:8,z:8});artist.schedule.fill('work');
    for(const work of Object.keys(artist.priorities) as (keyof Pawn['priorities'])[])artist.priorities[work]=0;
    artist.priorities.art=1;artist.priorities.haul=1;artist.skills.construction.level=8;
    artist.skills.artistic={level:8,xp:0,dailyXp:0,passion:0};
    const bench:Structure={id:w.nextId++,kind:'art-bench',x:12,z:12,orientation:0,footprint:'standard',material:'wood',bills:[]};w.structures.push(bench);
    addGroundMaterial(w,'wood',50,{x:7,z:12},'wood');refreshStock(w);
    expect(applyCommand(w,{type:'bill-add',structureId:bench.id,recipe:'small-sculpture'})).toMatchObject({ok:true});
    const entry=bench.bills!.at(-1)!,filters=Object.fromEntries(PRODUCTION_RECIPES['small-sculpture'].inputs.map(item=>[item,item==='wood']));
    expect(applyCommand(w,{type:'bill-update',structureId:bench.id,billId:entry.id,settings:{...entry,filters,destination:'drop'}})).toMatchObject({ok:true});
    if(inspired)expect(startInspiration360(w,artist,inspired===true?'creativity':inspired)).toBe(true);
    const made=()=>w.packed.find(p=>p.building.kind==='small-sculpture');
    for(let n=0;n<4000&&!made();n++){artist.hunger=100;artist.rest=100;artist.recreation.level=100;artist.mood=Math.min(artist.mood,45);stepWorld(w);}
    expect(made()).toBeDefined();
    return {w,artist,quality:made()!.building.quality!,tick:w.tick};
  };
  const plain=run(false),inspired=run(true),frenzy=run('work-frenzy');
  // WorkSpeedGlobal ×1.8 on the bench work; hauling and walking are unchanged.
  expect(frenzy.tick).toBeLessThan(plain.tick);expect(frenzy.artist.inspiration360?.kind).toBe('work-frenzy');
  expect(WEAPON_QUALITIES.indexOf(inspired.quality)).toBe(Math.min(6,WEAPON_QUALITIES.indexOf(plain.quality)+2));
  expect(inspired.artist.inspiration360).toBeUndefined();
  expect(inspired.w.events.some(e=>e.message===`L’inspiration de ${inspired.artist.name} prend fin (créativité inspirée).`)).toBe(true);
  expect(validateWorld(inspired.w)).toEqual([]);
});

test('an inspired warden recruits a resisting prisoner set to recruit and spends it; reduce-only keeps it',()=>{
  const run=(inspired:boolean,mode:'recruit'|'reduce')=>{
    const q=recruitmentUiFixture(),w=q.world,warden=w.pawns.find(p=>p.id===q.actorId)!,prisoner=w.pawns.find(p=>p.id===q.patientId)!;
    delete warden.background;warden.skills.social={level:10,xp:0,dailyXp:0,passion:0};warden.priorities.warden=1;
    prisoner.prisoner!.resistance=15;prisoner.prisoner!.mode=mode;
    if(inspired)expect(startInspiration360(w,warden,'recruitment')).toBe(true);
    for(let i=0;i<260&&!prisoner.recruitment;i++)stepWorld(w);
    return {w,warden,prisoner};
  };
  const inspired=run(true,'recruit');
  expect(inspired.prisoner.recruitment).toBeDefined();expect(inspired.prisoner.prisoner).toBeUndefined();
  expect(inspired.warden.inspiration360).toBeUndefined();
  expect(inspired.w.events.some(e=>e.message===`L’inspiration de ${inspired.warden.name} prend fin (recrutement inspiré).`)).toBe(true);
  expect(validateWorld(inspired.w)).toEqual([]);
  const plain=run(false,'recruit');
  expect(plain.prisoner.recruitment).toBeUndefined();expect(plain.prisoner.prisoner!.resistance).toBeLessThan(15);
  const reduceOnly=run(true,'reduce');
  expect(reduceOnly.prisoner.recruitment).toBeUndefined();expect(reduceOnly.prisoner.prisoner!.resistance).toBeLessThan(15);
  expect(reduceOnly.warden.inspiration360?.kind).toBe('recruitment');
});

test('an inspired handler tames at the final attempt without a draw and spends it',()=>{
  const run=(inspired:boolean)=>{
    // The hunting arena of the handling tests, without its stockpile command.
    const w=createWorld(81733,32,32);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.jobs=[];w.structures=[];w.piles=[];w.stockpiles=[];w.growingZones=[];w.pawns=w.pawns.slice(0,1);
    const p=w.pawns[0]!;p.age=legacyHumanAge();delete p.health;Object.assign(p,{hunger:100,rest:100});p.recreation.level=100;p.schedule.fill('work');p.bedId=null;
    for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
    p.priorities.handle=1;w.resources.push({id:w.nextId++,kind:'berries',x:10,z:10,amount:10,growth:1,growthTick:w.tick});enableWildlife(w,1);const a=w.wildlife!.animals[0]!;
    delete p.background;p.skills.animals={level:8,xp:0,dailyXp:0,passion:0};p.x=4;p.z=10;
    a.x=5;a.z=10;a.path=[];a.state='idle';a.food=0;a.motion=undefined;a.nextDecision=w.tick+80;
    addMaterial(w,'food',2,{type:'ground',x:p.x,z:p.z},'berries');
    if(inspired)expect(startInspiration360(w,p,'taming')).toBe(true);
    expect(applyTaming(w,{type:'tame',animalId:a.id,enabled:true})).toEqual({ok:true});
    expect(handlingWanted(w,p)).toBe(true);
    startHandling(p,handlingProposal(w,p,reachableCells(w,p,blockedCells(w),new Set()))!);
    const act=()=>{processHandling(w,p,{search:()=>null,candidates:()=>null,blocked:()=>new Uint8Array(),move:()=>{throw Error('no move');},release:()=>releaseWork(w,p),event:()=>{}});refreshStock(w);w.tick++;};
    while(p.animalHandling?.step!==5)act();
    const before=w.rng;
    while(p.animalHandling)act();
    return {w,p,a,before};
  };
  const inspired=run(true);
  expect(inspired.a.domestic).toBeDefined();
  // Core: chance 1, Rand.Chance(1) draws nothing.
  expect(inspired.w.rng).toBe(inspired.before);
  expect(inspired.p.inspiration360).toBeUndefined();
  // The same attempt uninspired rolls its chance.
  const plain=run(false);expect(plain.w.rng).not.toBe(plain.before);
});

test('an inspired negotiator trades at +0.18 and spends it once the deal is done',()=>{
  const f=visitorTradeFixture(1),{world:w,pawnId,traderId}=f,p=w.pawns.find(x=>x.id===pawnId)!,t=w.pawns.find(x=>x.id===traderId)!;
  delete p.background;p.skills.social={level:5,xp:0,dailyXp:0,passion:0};
  expect(applyCommand(w,{type:'area',action:'home',from:{x:0,z:0},to:{x:w.width-1,z:w.height-1}})).toMatchObject({ok:true});
  addMaterial(w,'silver',500,{type:'ground',x:2,z:3},'silver');
  expect(applyCommand(w,{type:'order-trade',pawnId,traderId})).toMatchObject({ok:true});
  for(let i=0;i<1200&&!tradingAtContact(w,p,t);i++)stepWorld(w);
  expect(tradingAtContact(w,p,t)).toBe(true);
  const good=tradeGoods(w,p,t).goods.find(g=>g.side==='buy'&&g.pile.item==='medicine')!;
  expect(startInspiration360(w,p,'trade')).toBe(true);
  const inspired=tradeGoods(w,p,t).goods.find(g=>g.pile.id===good.pile.id)!;
  expect(inspired.unitPrice).toBe(tradeUnitPrice(good.pile,'buy',tradeImprovement(p)+.18));
  expect(inspired.unitPrice!).toBeLessThan(good.unitPrice!);
  const lines=[{pileId:good.pile.id,quantity:1}],q=quoteTrade(w,pawnId,traderId,lines);
  expect(q.ok).toBe(true);if(!q.ok)return;
  expect(applyCommand(w,{type:'trade-execute',pawnId,traderId,lines,quote:q.signature,acceptShortfall:false})).toMatchObject({ok:true});
  expect(p.inspiration360).toBeUndefined();
  expect(w.events.at(-1)!.message).toBe(`L’inspiration de ${p.name} prend fin (commerce inspiré).`);
  expect(validateWorld(w)).toEqual([]);
});

test('it ends at its expiry through real ticks with a journal line; a dead pawn loses it silently; a mental break keeps it',()=>{
  const w=colony(),[c,d]=colonists(w) as [Pawn,Pawn];skilled(c);skilled(d);
  expect(startInspiration360(w,c,'work-frenzy')).toBe(true);
  expect(startInspiration360(w,c,'trade')).toBe(false);
  // As Core, a mental break neither blocks nor ends an inspiration.
  c.mood=20;expect(startSadWander(w,c)).toBe(true);
  stepWorld(w);expect(c.inspiration360?.kind).toBe('work-frenzy');
  c.inspiration360!.until=w.tick+3;
  stepWorld(w);stepWorld(w);expect(c.inspiration360).toBeDefined();
  stepWorld(w);expect(c.inspiration360).toBeUndefined();
  expect(w.events.some(e=>e.tick===w.tick&&e.message===`L’inspiration de ${c.name} prend fin (frénésie de travail).`)).toBe(true);
  // useInspiration360 only spends the kind asked for.
  expect(startInspiration360(w,d,'creativity')).toBe(true);
  expect(useInspiration360(w,d,'surgery')).toBe(false);expect(d.inspiration360?.kind).toBe('creativity');
  const events=w.events.length;d.state='dead';
  tickInspiration360(w,d);
  expect(d.inspiration360).toBeUndefined();expect(w.events.length).toBe(events);
});

test('save and reload keep an active inspiration exactly; the field is validated strictly',()=>{
  const w=colony(),c=colonists(w)[0]!;skilled(c);
  expect(startInspiration360(w,c,'creativity')).toBe(true);
  const json=serializeWorld(w),loaded=deserializeWorld(json);
  expect(loaded).toEqual(w);
  for(let i=0;i<30;i++){stepWorld(w);stepWorld(loaded);}
  expect(loaded).toEqual(w);
  const bad=(edit:(p:Record<string,unknown>)=>void)=>{const raw=JSON.parse(json);edit(raw.pawns.find((p:{id:number})=>p.id===c.id));return validateWorld(raw);};
  expect(bad(p=>{(p.inspiration360 as {kind:string}).kind='wild';}).length).toBeGreaterThan(0);
  expect(bad(p=>{(p.inspiration360 as {until:number}).until-=1;}).length).toBeGreaterThan(0);
  expect(bad(p=>{(p.inspiration360 as Record<string,unknown>).extra=1;}).length).toBeGreaterThan(0);
  expect(bad(p=>{(p.inspiration360 as {start:number}).start=w.tick+100;(p.inspiration360 as {until:number}).until=w.tick+48100;}).length).toBeGreaterThan(0);
  expect(bad(()=>{}).length).toBe(0);
});

test('cryptosleep does not age an inspiration: its expiry moves by the held time',()=>{
  const w=colony(),c=colonists(w)[0]!;skilled(c);
  expect(startInspiration360(w,c,'work-frenzy')).toBe(true);
  const held=structuredClone(c);delete held.health;const until=held.inspiration360!.until;
  const plan=prepareSuspendedHumanResume271(held,w.tick,w.tick+700);
  expect(plan.commit()).toBe(true);
  expect(held.inspiration360!.until).toBe(until+700);
});

test('below 360 nothing is drawn or started, and the consumers stay neutral',()=>{
  const w=colony(),c=colonists(w)[0]!;skilled(c);c.mood=100;
  Object.assign(w,{schemaVersion:359});
  const at=nextCheck(c.id,w.tick+1);
  hook.forced.set(`${c.id}@${at}`,[0,0,0,0,0,0,0,0,0]);hook.calls=[];
  while(w.tick<at+50)stepWorld(w);
  hook.forced.clear();
  expect(hook.calls).toEqual([]);
  expect(w.pawns.some(p=>p.inspiration360)).toBe(false);
  expect(startInspiration360(w,c,'work-frenzy')).toBe(false);
  expect(stackLetters352(campaignLetters352(w)).some(l=>l.title.startsWith('Frénésie'))).toBe(false);
});

test('migration 359 -> 360 by number only; a 359 save holding an inspiration is refused',()=>{
  const w=colony(),json=serializeWorld(w);
  const migrated=deserializeWorld(asOldSchema(json,359));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  expect(serializeWorld(migrated)).toBe(asNumberOnly(json,359));
  expect(migrated.pawns.some(p=>p.inspiration360)).toBe(false);
  const c=colonists(w)[0]!;skilled(c);expect(startInspiration360(w,c,'trade')).toBe(true);
  const raw=JSON.parse(serializeWorld(w));raw.schemaVersion=359;
  expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/inspiration/i);
});
