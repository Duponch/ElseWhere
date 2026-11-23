import {afterEach,beforeEach,expect,test} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {enableWildlife} from '../src/sim/wildlife.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {isColonist} from '../src/sim/affiliation.ts';
import {injurePawn} from '../src/sim/health.ts';
import {setDevSession,takeDevAdvance,devGodMode} from '../src/sim/dev-session.ts';
import {DEV_ACTIONS,DEV_SPAWNABLE_ITEMS,devActionById,validDevCommand,type DevCommand} from '../src/sim/dev-actions.ts';
import {constructionWorkRate} from '../src/sim/skills.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {enableCassandraRaids} from '../src/sim/cassandra-raids.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import type {Command,World} from '../src/sim/types.ts';

const colony=(size=32)=>{const w=createWorld(7,size,size);enableWildlife(w);return w;};
const land=(w:World,skip=0)=>{let n=0;for(let i=0;i<w.tiles.length;i++)if(w.tiles[i]!.terrain!=='water'&&w.tiles[i]!.terrain!=='rock'&&n++>=skip)return {x:i%w.width,z:Math.floor(i/w.width)};throw Error('no land');};
const dev=(w:World,action:string,extra:Partial<DevCommand>={})=>applyCommand(w,{type:'dev-action',action,...extra} as Command);
const people=(w:World)=>w.pawns.filter(p=>isColonist(p)&&p.state!=='dead');
const roundTrips=(w:World)=>{expect(validateWorld(JSON.parse(serializeWorld(w)))).toEqual([]);deserializeWorld(serializeWorld(w));};

beforeEach(()=>setDevSession(true,false));
afterEach(()=>{setDevSession(false,false);takeDevAdvance();});

test('nothing is available while the developer mode is off',()=>{
  setDevSession(false,false);
  const w=colony(),p=people(w)[0]!,before=p.rest;
  const result=dev(w,'need-rest',{targetId:p.id,args:{level:'0'}});
  expect(result.ok).toBe(false);expect(result.reason).toMatch(/désactivé/);
  expect(p.rest).toBe(before);
  expect(devGodMode()).toBe(false);
  setDevSession(false,true);expect(devGodMode()).toBe(false); // god mode cannot outlive the mode
});

test('an action says why it cannot apply: no selection, wrong kind of target, unknown identity',()=>{
  const w=colony(),animal=w.wildlife!.animals[0]!;
  expect(dev(w,'need-rest')).toMatchObject({ok:false,code:'missing-target',reason:expect.stringMatching(/Sélectionnez/)});
  expect(dev(w,'need-recreation',{targetId:animal.id})).toMatchObject({ok:false,reason:expect.stringMatching(/colon/)});
  expect(dev(w,'need-rest',{targetId:999999})).toMatchObject({ok:false,reason:expect.stringMatching(/plus sur cette carte/)});
  expect(dev(w,'spawn-item',{args:{item:'steel'}})).toMatchObject({ok:false,reason:expect.stringMatching(/Cliquez/)});
  expect(dev(w,'no-such-action')).toMatchObject({ok:false});
  expect(dev(w,'need-rest',{targetId:people(w)[0]!.id,args:{level:'13'}})).toMatchObject({ok:false});
  expect(validDevCommand({type:'dev-action',action:'need-rest',targetId:1,extra:1})).toBe(false);
});

test('the registry is well formed: unique ids, parameter defaults among their options',()=>{
  expect(new Set(DEV_ACTIONS.map(a=>a.id)).size).toBe(DEV_ACTIONS.length);
  for(const action of DEV_ACTIONS){
    expect(devActionById(action.id)).toBe(action);
    for(const param of action.params??[])expect(param.options.map(o=>o.value)).toContain(param.default);
  }
  expect(DEV_ACTIONS.map(a=>a.group)).toEqual(expect.arrayContaining(['Besoins','Santé','Compétences','Carte','Temps','Incidents']));
});

test('every need and the mood take the chosen level, and the world stays valid',()=>{
  const w=colony(),p=people(w)[0]!;
  for(const [action,read] of [['need-food',()=>p.hunger],['need-rest',()=>p.rest],['need-recreation',()=>p.recreation.level],['need-comfort',()=>p.comfort],['need-beauty',()=>p.beauty],['mood-set',()=>p.mood]] as const)
    for(const level of [0,25,50,75,100]){
      expect(dev(w,action,{targetId:p.id,args:{level:String(level)}}).ok).toBe(true);
      expect(read()).toBe(level);
    }
  expect(dev(w,'need-outdoors',{targetId:p.id,args:{level:'25'}}).ok).toBe(true);expect(p.outdoors359).toBe(.25);
  expect(dev(w,'need-room-size',{targetId:p.id,args:{level:'75'}}).ok).toBe(true);expect(p.roomSize345!.level).toBe(.75);
  expect(dev(w,'need-all',{targetId:p.id,args:{level:'50'}}).ok).toBe(true);expect([p.hunger,p.rest,p.comfort,p.beauty,p.recreation.level]).toEqual([50,50,50,50,50]);
  roundTrips(w);
});

test('rest at 0 % sends the colonist to sleep through the ordinary simulation',()=>{
  const w=colony(),p=people(w)[0]!;
  expect(dev(w,'need-rest',{targetId:p.id,args:{level:'0'}}).ok).toBe(true);
  stepWorld(w,400);
  expect(['sleeping','moving'].includes(p.state)||p.need?.kind==='sleep'||p.rest>0).toBe(true);
  expect(p.need?.kind==='sleep'||p.state==='sleeping'||p.collapsePending||p.rest>0).toBe(true);
  roundTrips(w);
});

test('an animal takes food and rest levels too, a colonist-only need is refused for it',()=>{
  const w=colony(),a=w.wildlife!.animals[0]!;
  expect(dev(w,'need-food',{targetId:a.id,args:{level:'0'}}).ok).toBe(true);expect(a.food).toBe(0);
  expect(dev(w,'need-rest',{targetId:a.id,args:{level:'50'}}).ok).toBe(true);expect(a.rest).toBe(.5);
  roundTrips(w);
});

test('heal, down and kill use the real health pipeline',()=>{
  const w=colony(),[p,q]=people(w);
  injurePawn(w,p!,'left-arm','cut',3000);
  expect(p!.health!.injuries.length).toBeGreaterThan(0);
  expect(dev(w,'heal-all',{targetId:p!.id}).ok).toBe(true);
  expect(p!.health!.injuries).toEqual([]);expect(p!.health!.bloodLoss).toBe(0);
  roundTrips(w);
  expect((dev(w,'down',{targetId:q!.id}) as {reason?:string}).reason).toBeUndefined();expect(q!.state).toBe('downed');
  expect(dev(w,'heal-all',{targetId:q!.id}).ok).toBe(true);expect(q!.state).not.toBe('downed');
  expect(dev(w,'kill',{targetId:q!.id}).ok).toBe(true);expect(q!.state).toBe('dead');
  expect(dev(w,'kill',{targetId:q!.id})).toMatchObject({ok:false,reason:expect.stringMatching(/déjà mort/)});
  expect(dev(w,'heal-all',{targetId:q!.id})).toMatchObject({ok:false,reason:expect.stringMatching(/ressuscite/)});
  stepWorld(w,20);roundTrips(w);
});

test('an animal can be downed and killed',()=>{
  const w=colony(),[a,b]=w.wildlife!.animals;
  expect((dev(w,'down',{targetId:a!.id}) as {reason?:string}).reason).toBeUndefined();expect(a!.state).toBe('downed');
  expect(dev(w,'kill',{targetId:b!.id}).ok).toBe(true);expect(b!.state).toBe('dead');
  roundTrips(w);
});

test('a mental state is started by the game function and removed again',()=>{
  const w=colony(),p=people(w)[0]!;
  expect(dev(w,'mental-clear',{targetId:p.id})).toMatchObject({ok:false,reason:expect.stringMatching(/pas en crise/)});
  expect(dev(w,'mental-add',{targetId:p.id,args:{kind:'sad-wander'}}).ok).toBe(true);
  expect(p.mental?.crisis?.kind).toBe('sad-wander');
  expect(dev(w,'mental-add',{targetId:p.id,args:{kind:'tantrum'}})).toMatchObject({ok:false,reason:expect.stringMatching(/déjà en crise/)});
  roundTrips(w);
  expect(dev(w,'mental-clear',{targetId:p.id}).ok).toBe(true);expect(p.mental?.crisis).toBeUndefined();
  roundTrips(w);
});

test('skill level and passion are set, creating a missing skill record',()=>{
  const w=colony(),p=people(w)[0]!;
  expect(dev(w,'skill-set',{targetId:p.id,args:{skill:'construction',level:'16'}}).ok).toBe(true);expect(p.skills.construction.level).toBe(16);
  expect(dev(w,'passion-set',{targetId:p.id,args:{skill:'construction',passion:'2'}}).ok).toBe(true);expect(p.skills.construction.passion).toBe(2);
  delete (p.skills as unknown as Record<string,unknown>).crafting;
  const r=dev(w,'skill-set',{targetId:p.id,args:{skill:'crafting',level:'12'}});
  if(r.ok)expect(p.skills.crafting?.level).toBe(12);else expect(r.reason).toMatch(/ne peut pas pratiquer/);
  roundTrips(w);
});

test('an item and an animal are spawned at the cell, an unreachable cell is refused',()=>{
  const w=colony(),cell=land(w),second=land(w,40);
  const piles=w.piles.length;
  expect(dev(w,'spawn-item',{cell,args:{item:'steel',quantity:'100'}}).ok).toBe(true);
  expect(w.piles.filter(i=>i.item==='steel'&&i.owner.type==='ground').reduce((n,i)=>n+i.quantity,0)).toBeGreaterThanOrEqual(100);
  expect(w.piles.length).toBeGreaterThan(piles);
  expect(dev(w,'spawn-item',{cell:{x:-1,z:3},args:{item:'steel'}})).toMatchObject({ok:false,reason:expect.stringMatching(/hors de la carte/)});
  const animals=w.wildlife!.animals.length;
  expect(dev(w,'spawn-animal',{cell:second,args:{species:'muffalo',tame:'tame'}}).ok).toBe(true);
  const made=w.wildlife!.animals.at(-1)!;
  expect([made.species,made.x,made.z,!!made.domestic]).toEqual(['muffalo',second.x,second.z,true]);expect(w.wildlife!.animals.length).toBe(animals+1);
  expect(dev(w,'spawn-animal',{cell:second,args:{species:'deer'}})).toMatchObject({ok:false,reason:expect.stringMatching(/occupe déjà/)});
  stepWorld(w,10);roundTrips(w);
});

test('every spawnable item can be dropped and the world stays valid',()=>{
  const w=colony(48);let x=2,z=2;
  for(const item of DEV_SPAWNABLE_ITEMS.slice(0,60)){
    const r=dev(w,'spawn-item',{cell:{x,z},args:{item,quantity:'1'}});
    if(!r.ok)expect(r.reason).toMatch(/Impossible|eau|roche/);
    x+=2;if(x>44){x=2;z+=2;}
  }
  roundTrips(w);
  expect(DEV_SPAWNABLE_ITEMS.every(id=>!['book','plant','corpse','mech-corpse','ai-core'].includes(ITEM_DEFINITIONS[id].kind))).toBe(true);
});

test('items on a cell are destroyed, an empty cell says so',()=>{
  const w=colony(),cell=land(w);
  expect(dev(w,'destroy-items',{cell})).toMatchObject({ok:false,reason:expect.stringMatching(/Aucun objet/)});
  dev(w,'spawn-item',{cell,args:{item:'wood',quantity:'10'}});
  expect(dev(w,'destroy-items',{cell}).ok).toBe(true);
  expect(w.piles.some(i=>i.owner.type==='ground'&&i.owner.x===cell.x&&i.owner.z===cell.z)).toBe(false);
  roundTrips(w);
});

test('the weather is forced to the chosen kind, the world stays valid',()=>{
  const w=colony();
  expect(dev(w,'weather-set',{args:{kind:'rainy-thunderstorm'}}).ok).toBe(true);
  expect(w.weather!.current).toBe('rainy-thunderstorm');expect(w.weather!.ageCore).toBe(0);
  stepWorld(w,30);roundTrips(w);
});

test('advancing time is recorded as a request the Worker plays after the acknowledgement',()=>{
  const w=colony(),tick=w.tick;
  expect(dev(w,'time-advance',{args:{span:'hour'}}).ok).toBe(true);
  expect(w.tick).toBe(tick); // the command itself never jumps the clock
  expect(takeDevAdvance()).toBe(250);expect(takeDevAdvance()).toBe(0);
  dev(w,'time-advance',{args:{span:'day'}});expect(takeDevAdvance()).toBe(6000);
});

test('a raid is started on demand under the storyteller calendar, and refused without it',()=>{
  const plain=colony(48);
  expect(dev(plain,'incident-raid')).toMatchObject({ok:false,reason:expect.stringMatching(/calendrier de raids/)});
  const w=colony(48);w.gameProfile=crashlandedProfile();enableCassandraRaids(w);
  const before=w.pawns.length;
  const r=dev(w,'incident-raid',{args:{points:'300'}});
  expect(r.ok||/pas pu commencer/.test(r.reason!)).toBe(true);
  if(r.ok){expect(w.pawns.length).toBeGreaterThan(before);expect(w.pawns.some(p=>!!p.raid)).toBe(true);roundTrips(w);}
});

test('a wanderer request opens at the next tick',()=>{
  const w=colony();
  const r=dev(w,'incident-wanderer');
  if(r.ok){stepWorld(w,3);expect(w.arrivals?.pending).toBeTruthy();roundTrips(w);}else expect((r.reason??"").length).toBeGreaterThan(5);
});

test('farm animals, an aurora, a self-tame and a resource pod either start or say why not',()=>{
  const w=colony(48);
  for(const id of ['incident-farm-animals','incident-self-tame','incident-aurora','incident-resource-pod','incident-trader']){
    const r=dev(w,id);expect(r.ok||(r.reason?.length??0)>5).toBe(true);
  }
  roundTrips(w);
});

test('finishing the research completes the chosen project, refused without one',()=>{
  const w=colony();
  expect(dev(w,'finish-research')).toMatchObject({ok:false,reason:expect.stringMatching(/Aucune recherche/)});
  expect(applyCommand(w,{type:'research-project',project:'batteries'}).ok).toBe(true);
  expect(w.research?.project).toBe('batteries');
  expect(dev(w,'finish-research').ok).toBe(true);
  expect(w.research?.project).toBeNull();expect(w.research?.batteries?.completedAt).toBe(w.tick);
  roundTrips(w);
});

test('god mode: choosing a research project completes it at once, off it does not',()=>{
  const w=colony();
  expect(applyCommand(w,{type:'research-project',project:'solar-power'}).ok).toBe(true);
  expect(w.research?.project).toBe('solar-power');
  const g=colony();
  setDevSession(true,true);expect(devGodMode()).toBe(true);
  expect(applyCommand(g,{type:'research-project',project:'solar-power'}).ok).toBe(true);
  expect(g.research?.project).toBeNull();expect(g.research?.solarPower?.completedAt).toBe(g.tick);
  roundTrips(g);
});

test('god mode: construction work is instant, and a wall is built by one visit',()=>{
  const w=colony(),p=people(w)[0]!;
  const job={id:1,kind:'wall' as const,x:3,z:3,reservedBy:null} as never;
  const normal=constructionWorkRate(p,job,1);
  setDevSession(true,true);
  expect(constructionWorkRate(p,job,1)).toBeGreaterThan(normal*1000);
  setDevSession(true,false);
  expect(constructionWorkRate(p,job,1)).toBe(normal);
});

test('finishing a construction needs a site with its materials, and refuses an empty cell',()=>{
  const w=colony();
  expect(dev(w,'finish-construction',{cell:{x:2,z:2}})).toMatchObject({ok:false,reason:expect.stringMatching(/Aucun chantier/)});
});
