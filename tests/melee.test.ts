import { withoutResearch,withMigratedResearch } from './scenarios/legacy-skills';
import { expect,test } from 'vitest';
import { withoutPredatorFoodPolicies } from './scenarios/legacy-save';
import { applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld } from '../src/sim/index';
import { meleeHitChance,meleeDodgeChance,meleeTools } from '../src/sim/melee-statistics';
import { resolveUnarmoredMelee } from '../src/sim/melee-impact';
import { createMedicalRecord,remainingPartHealth } from '../src/sim/injury-state';
import { validateMedicalRecord } from '../src/sim/injury-validation';
import { meleeContact } from '../src/sim/melee-space';
import { applyMeleeStun } from '../src/sim/stun';
import { startTravel } from '../src/sim/movement';
import { travelPieces } from '../src/sim/travel-timing';
import { travelEnd,neutralTravelDuration,type TravelSegment } from '../src/sim/travel-timing';
import { MotionRecorder } from '../src/bridge/motion-tracks';
import { encounterCamp } from './scenarios/encounter';
import { fixtureBuilding } from './scenarios/deconstruction';

import { meleeCamp,meleeLoad } from './scenarios/melee';
const order=(w:ReturnType<typeof meleeCamp>)=>applyCommand(w,{type:'melee',pawnIds:[w.pawns[0].id],targetId:w.pawns[3].id});

test('adult hit/dodge curves, weighted tools and natural fallback after loss of hands',()=>{
  expect(meleeHitChance(8)).toBeCloseTo(.74);expect(meleeHitChance(20)).toBe(.9);expect(meleeHitChance(0,0,0)).toBe(.05);
  expect(meleeDodgeChance(8)).toBeCloseTo(.06);expect(meleeDodgeChance(20,.5)).toBeCloseTo(.12);expect(meleeDodgeChance(5)).toBe(0);
  const w=encounterCamp(),p=w.pawns[0],tools=meleeTools(w,p);
  expect(tools.filter(t=>['grip','barrel','barrel-poke'].includes(t.id)).map(t=>t.weight)).toEqual([.25,.25,.25]);
  expect(tools.find(t=>t.id==='left-fist')?.weight).toBe(.125);expect(tools.find(t=>t.id==='head')?.weight).toBe(0);
  w.piles=[];p.health=createMedicalRecord(w.tick);p.health.missing=[{part:'left-hand',bornAt:w.tick},{part:'right-hand',bornAt:w.tick}];
  const fallback=meleeTools(w,p);expect(fallback.map(t=>t.id)).toEqual(['teeth','head']);expect(fallback.find(t=>t.id==='head')?.weight).toBe(.75);expect(fallback.find(t=>t.id==='teeth')?.weight).toBe(.25);
});

test('blunt excess and inner bone split differ from poke; source record remains immutable and injuries remain valid',()=>{
  const record=createMedicalRecord(),before=structuredClone(record);
  const broken=resolveUnarmoredMelee(record,{damage:15,kind:'blunt',part:'left-index-finger'},()=>.99);
  expect(broken.layers.map(l=>[l.part,l.severity])).toEqual([['left-index-finger',15000],['left-hand',7000]]);
  expect(broken.record.missing.some(m=>m.part==='left-index-finger')).toBe(true);
  let draws=[0,0,0,.5,.99];const bone=resolveUnarmoredMelee(record,{damage:10,kind:'blunt',part:'torso'},()=>draws.shift()??.99);
  expect(bone.layers[0]).toMatchObject({part:'torso',severity:9000,kind:'bruise'});expect(bone.layers[1]).toMatchObject({kind:'crack',severity:3750});
  const poke=resolveUnarmoredMelee(record,{damage:15,kind:'poke',part:'left-index-finger'},()=>.99);
  expect(poke.layers).toHaveLength(1);expect(remainingPartHealth(poke.record,'left-index-finger')).toBe(1000);
  for(const r of [broken,bone,poke])expect(validateMedicalRecord(r.record)).toBeNull();expect(record).toEqual(before);
  expect(()=>resolveUnarmoredMelee(record,{damage:NaN,kind:'blunt'},()=>.5)).toThrow();
});

test('real approach → reciprocal melee → wounds, exact recovery, phase saves and incapacitation',()=>{
  const w=meleeCamp(),p=w.pawns[0],enemy=w.pawns[3];expect(order(w).ok).toBe(true);
  let strikes=0,last=-1,copy:typeof w|undefined;
  for(let i=0;i<600;i++){
    stepWorld(w);if(copy){stepWorld(copy);expect(copy).toEqual(w);}
    expect(validateWorld(w)).toEqual([]);
    const strike=p.melee?.strike;
    if(strike&&strike.atCore!==last){if(last>=0)expect(strike.atCore-last).toBeGreaterThanOrEqual(120);last=strike.atCore;strikes++;expect(p.moveCooldown).toBe(0);expect(meleeContact(w,p,enemy)).toBe(true);copy=deserializeWorld(serializeWorld(w));}
    if(p.state==='downed'||p.state==='dead'||enemy.state==='downed'||enemy.state==='dead')break;
  }
  expect(strikes).toBeGreaterThan(2);expect(p.skills.melee.dailyXp).toBeGreaterThan(0);expect(enemy.skills.melee.dailyXp).toBeGreaterThan(0);
  expect(w.pawns.filter(p=>p.health?.injuries.length||p.health?.missing.length).length).toBe(2);
});

test('orders are atomic; contact corners differ from walking; stop, undraft and retarget preserve recovery',()=>{
  const w=meleeCamp(),p=w.pawns[0],enemy=w.pawns[3];const before=serializeWorld(w);
  expect(applyCommand(w,{type:'melee',pawnIds:[p.id,w.pawns[1].id],targetId:enemy.id}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
  fixtureBuilding(w,'wall',7,10);expect(meleeContact(w,{x:6,z:10},{x:7,z:11})).toBe(true);
  fixtureBuilding(w,'wall',6,11);expect(meleeContact(w,{x:6,z:10},{x:7,z:11})).toBe(false);w.structures=[];
  expect(order(w).ok).toBe(true);for(let i=0;i<100&&!p.melee?.strike;i++)stepWorld(w);
  const until=p.melee!.strike!.untilCore;
  expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x:5,z:10},queue:false}).ok).toBe(true);
  expect(p.path).toEqual([]);expect(p.state).toBe('idle');expect(p.melee?.strike?.untilCore).toBe(until);
  expect(order(w).ok).toBe(true);expect(p.melee?.strike?.untilCore).toBe(until);expect(p.path).toEqual([]);
  expect(applyCommand(w,{type:'draft-stop',pawnIds:[p.id]}).ok).toBe(true);
  expect(p.melee?.order).toBeNull();expect(p.melee?.strike?.untilCore).toBe(until);
  applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:false});expect(p.melee?.strike?.untilCore).toBe(until);expect(validateWorld(w)).toEqual([]);
});

test('stun holds a moving pawn at its exact fraction, resumes continuously and saves the whole piecewise edge',()=>{
  const w=meleeCamp(),p=w.pawns[0];expect(startTravel(w,p,{x:7,z:10})).toBe(true);stepWorld(w);
  const old=p.motion!.end;applyMeleeStun(w,p,w.tick*10);
  const pieces=travelPieces(p.motion!);const hold=pieces.find(s=>s.fromFraction===s.toFraction)!;
  // Core Blunt stun: 120 Core ticks, 12 local ticks (schema 318).
  expect(hold.end-hold.start).toBe(12);expect(p.motion!.end).toBeCloseTo(old+12);expect(hold.fromFraction).toBeGreaterThan(0);
  const recorder=new MotionRecorder();recorder.capture(w);expect(recorder.snapshot().find(t=>t.id===p.id)!.segments.some(s=>s.fromFraction===s.toFraction)).toBe(true);
  const copy=deserializeWorld(serializeWorld(w));for(let i=0;i<20;i++){stepWorld(w);stepWorld(copy);expect(copy).toEqual(w);expect(validateWorld(w)).toEqual([]);}
});

test('stun and stagger share an edge without changing prior distances: independent small-step timing oracle',()=>{
  for(const diagonal of [false,true])for(const speed of [1,.128]) {
    const m:TravelSegment={from:{x:1,z:1},to:{x:2,z:diagonal?2:1},start:0,end:0,speedFactor:speed,terrainDelay:1.4,stagger:[{start:1,end:10.5}],stuns:[{start:2,end:6.5},{start:7,end:11.5}]};
    m.end=travelEnd(m);const duration=neutralTravelDuration(m),slow=Math.max(.17,duration/45),dt=.0001;let paid=0,t=0;
    while(paid<duration&&t<70){const sample=t+dt/2;paid+=dt*(m.stuns!.some(s=>sample>=s.start&&sample<s.end)?0:m.stagger!.some(s=>sample>=s.start&&sample<s.end)?slow:1);t+=dt;}
    expect(Math.abs(t-m.end)).toBeLessThan(.0003);const pieces=travelPieces(m);
    for(let i=1;i<pieces.length;i++){expect(pieces[i].start).toBeCloseTo(pieces[i-1].end,10);expect(pieces[i].fromFraction).toBeCloseTo(pieces[i-1].toFraction!,10);}
    expect(pieces.at(-1)!.toFraction).toBe(1);
  }
});

test('V58 migration adds neutral melee skill only; old schemas reject new states and new injury kinds',()=>{
  const w=meleeCamp(),old=withoutPredatorFoodPolicies(JSON.parse(serializeWorld(w)));(old.schemaVersion=58,withoutResearch(old));for(const p of old.pawns){delete p.skills.melee;if(p.draft)delete p.draft.holdFire;}
  const next=deserializeWorld(JSON.stringify(old));expect(next.pawns[0].skills.melee).toEqual({level:8,xp:0,dailyXp:0,passion:0});expect(next.tick).toBe(old.tick);
  old.pawns[0].stun={sinceCore:old.tick*10,untilCore:old.tick*10+45};expect(()=>deserializeWorld(JSON.stringify(old))).toThrow('version 58');
  const bad=JSON.parse(serializeWorld(w));bad.pawns[0].melee={order:null,strike:null};expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow();
});

test('thirty actors mix real melee, ranged retaliation, flight and excavation without resetting health',()=>{
  const {world:w}=meleeLoad(30),initialRocks=w.tiles.filter(t=>t.terrain==='rock').length;
  let strikes=0,flights=0,flee=false,working=false;
  for(let i=0;i<240;i++){
    stepWorld(w);strikes+=w.pawns.filter(p=>p.melee?.strike).length;flights+=w.projectiles?.length??0;
    flee ||=w.pawns.some(p=>!!p.flee);working ||=w.pawns.some(p=>p.state==='working'&&p.jobId!==null);
    if(i%40===0)expect(validateWorld(w)).toEqual([]);
  }
  expect(strikes).toBeGreaterThan(0);expect(flights).toBeGreaterThan(0);expect(flee).toBe(true);expect(working).toBe(true);
  expect(w.tiles.filter(t=>t.terrain==='rock').length).toBeLessThan(initialRocks);
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});
