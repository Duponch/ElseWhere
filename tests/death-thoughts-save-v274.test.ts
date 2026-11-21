import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder} from '../src/bridge/snapshots.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import {validDeathThoughtsShape,validDeathThoughtsPawnShape,validDeathThoughtsTransport} from '../src/sim/death-thoughts-save.ts';
import {DEATH_THOUGHT_KINDS_364,DEATH_THOUGHT_RULES} from '../src/sim/death-thoughts-rules.ts';
import type {DeathThoughtKind,DeathThoughtMemory} from '../src/sim/death-thoughts-state.ts';
import {exitVisitor} from '../src/sim/visitors.ts';
import {visitorTradeFixture} from './scenarios/visitors.ts';
import {medicalCamp,controlledInjury} from './scenarios/health.ts';

function thoughtCamp(){
  const w=medicalCamp(2),[observer,deceased]=w.pawns;
  controlledInjury(w,deceased!,'heart',20000,'cut');
  observer!.deathThoughts=[{kind:'colonist-died',otherId:deceased!.id,at:w.tick}];
  return w;
}

test('schema208 migration is neutral and invents no perceived death or corpse exposure',()=>{
  const old=medicalCamp(2);old.schemaVersion=208 as World['schemaVersion'];
  const before=structuredClone(old),loaded=deserializeWorld(JSON.stringify(old));
  expect(loaded).toEqual({...before,schemaVersion:SCHEMA_VERSION});expect(old).toEqual(before);
  expect(loaded.pawns.every(p=>!Object.hasOwn(p,'deathThoughts'))).toBe(true);
});

test('perceived memories roundtrip independently of affiliation, traits and the surviving corpse Thing',()=>{
  const w=thoughtCamp(),observer=w.pawns[0]!;
  expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  observer.deathThoughts![0]!.kind='witnessed-bloodlust-death';observer.traits=[];
  expect(validDeathThoughtsTransport(w)).toBe(true);
  w.pawns[1]!.body={observedAt:w.tick,lostAt:w.tick};
  expect(validDeathThoughtsTransport(w)).toBe(true);
});

test('all seven kinds have exact per-kind caps and distinct targets, without merging identities',()=>{
  const all:DeathThoughtMemory[]=[];
  // The two schema 364 kinds (execution) are refused below 364.
  for(const kind of (Object.keys(DEATH_THOUGHT_RULES) as DeathThoughtKind[]).filter(kind=>!DEATH_THOUGHT_KINDS_364.includes(kind))){
    const rule=DEATH_THOUGHT_RULES[kind],rows=Array.from({length:rule.limit},(_,i)=>({kind,otherId:i+1,at:3000}));
    expect(validDeathThoughtsShape(rows,209,3000)).toBe(true);
    expect(validDeathThoughtsShape([...rows,{kind,otherId:100,at:3000}],209,3000)).toBe(false);
    expect(validDeathThoughtsShape([...rows,rows[0]],209,3000)).toBe(false);
    all.push(...rows);
  }
  expect(all).toHaveLength(25);expect(validDeathThoughtsShape(all,209,3000)).toBe(true);
  expect(validDeathThoughtsShape([...all,all[0]],209,3000)).toBe(false);
  for(const kind of DEATH_THOUGHT_KINDS_364){
    const rows=Array.from({length:DEATH_THOUGHT_RULES[kind].limit},(_,i)=>({kind,otherId:i+1,at:3000}));
    expect(validDeathThoughtsShape(rows,363,3000)).toBe(false);expect(validDeathThoughtsShape(rows,364,3000)).toBe(true);
    all.push(...rows);
  }
  expect(all).toHaveLength(35);expect(validDeathThoughtsShape(all,364,3000)).toBe(true);
});

test('raw shapes reject missing, extra, nonfinite, sparse and future-schema death memory fields',()=>{
  const row={kind:'observed-corpse',otherId:2,at:3000};
  for(const value of [[],null,{},new Array(1),[{...row,otherId:0}],[{...row,at:3001}],
    [{...row,at:NaN}],[{...row,kind:'unknown'}],[{...row,extra:true}],[{kind:row.kind,at:row.at}]])
    expect(validDeathThoughtsShape(value,209,3000)).toBe(false);
  expect(validDeathThoughtsShape([row],208,3000)).toBe(false);
  expect(validDeathThoughtsPawnShape({deathThoughts:undefined},209,3000)).toBe(false);
  expect(validDeathThoughtsPawnShape({deathThoughts:undefined},208,3000)).toBe(false);
  const old=thoughtCamp();old.schemaVersion=208 as World['schemaVersion'];
  expect(()=>deserializeWorld(JSON.stringify(old))).toThrow('Invalid version 208 save');
});

test('bindings reject self, living, missing and later-death references without throwing',()=>{
  const w=thoughtCamp();
  for(const otherId of [w.pawns[0]!.id,w.nextId+1]){
    const bad=structuredClone(w);bad.pawns[0]!.deathThoughts![0]!.otherId=otherId;
    expect(validDeathThoughtsTransport(bad)).toBe(false);expect(validateWorld(bad).length).toBeGreaterThan(0);
  }
  const living=structuredClone(w);delete living.pawns[1]!.health;living.pawns[1]!.state='idle';
  expect(validDeathThoughtsTransport(living)).toBe(false);
  const early=structuredClone(w);early.pawns[0]!.deathThoughts![0]!.at--;
  expect(validDeathThoughtsTransport(early)).toBe(false);
});

test('living clocks reject expired memories while a dead observer retains its frozen history',()=>{
  const rows=[{kind:'observed-corpse',otherId:2,at:50}];
  expect(validDeathThoughtsShape(rows,209,3050)).toBe(false);
  expect(validDeathThoughtsPawnShape({state:'dead',health:{death:{tick:100}},deathThoughts:rows},209,10000)).toBe(true);
  expect(validDeathThoughtsPawnShape({state:'dead',health:{death:{tick:49}},deathThoughts:rows},209,10000)).toBe(false);
});

test('same-tick in-place memory edits publish deeply and malformed deltas preserve the accepted world',()=>{
  const w=thoughtCamp(),encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  const first=decoder.adopt(structuredClone(encoder.encode(w,0,1)));expect(first.status).toBe('applied');
  if(first.status!=='applied')throw Error('checkpoint');const previous=structuredClone(first.world);
  w.pawns[0]!.deathThoughts![0]!.kind='witnessed-ally-death';
  const good=structuredClone(encoder.encode(w,0,1));expect(good.kind).toBe('delta');
  const invalid=structuredClone(good);invalid.world.pawns[0]!.deathThoughts![0]!.otherId=w.nextId+1;
  expect(decoder.adopt(invalid).status).toBe('resync');expect(first.world).toEqual(previous);
  const after=decoder.adopt(good);expect(after.status).toBe('applied');expect(first.world).toEqual(previous);
  if(after.status!=='applied')throw Error('delta');expect(after.world.pawns[0]!.deathThoughts![0]!.kind).toBe('witnessed-ally-death');
  const badCheckpoint=structuredClone(encoder.encode(w,0,1,true));badCheckpoint.world.pawns[0]!.deathThoughts![0]!.at++;
  expect(decoder.adopt(badCheckpoint).status).toBe('resync');
});

test('a real visitor departure retains its memory at the departure clock after world time advances',()=>{
  const {world:w,traderId}=visitorTradeFixture(2),trader=w.pawns.find(p=>p.id===traderId)!,deceased=w.pawns.find(p=>!p.visitor)!;
  controlledInjury(w,deceased,'heart',20000,'cut');
  trader.deathThoughts=[{kind:'observed-corpse',otherId:deceased.id,at:w.tick}];
  Object.assign(trader,{x:0,z:10,state:'idle',path:[],moveCooldown:0,planCooldown:0});delete trader.motion;
  trader.visitor!.phase='leaving';trader.visitor!.goal=null;
  expect(exitVisitor(w,trader)).toBe(true);const departure=w.visitors!.departed.at(-1)!;
  expect(validDeathThoughtsTransport(w)).toBe(true);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  w.tick+=3000;
  expect(validDeathThoughtsTransport(w)).toBe(true);
  departure.pawn.deathThoughts![0]!.at=departure.tick+1;
  expect(validDeathThoughtsTransport(w)).toBe(false);
});
