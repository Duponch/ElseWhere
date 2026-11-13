import {expect,test} from 'vitest';
import {asOldSchema} from './scenarios/old-schema.ts';
import {createWorld} from '../src/sim/engine.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {adoptWorldIncidents,advanceWorldIncidents,WORLD_FIRST_CHECK} from '../src/sim/cassandra-world.ts';
import {validWorldIncidents} from '../src/sim/cassandra-world-save.ts';
import {enableWildlife} from '../src/sim/wildlife.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {isColonist} from '../src/sim/affiliation.ts';
import {AURORA_FADE_CORE305,AURORA_MAX_DURATION_CORE305,AURORA_MIN_DURATION_CORE305,AURORA_REFIRE_TICKS305,celestialGlow305,eligibleAurora305,
  resolveSelectedAurora305,resolveSelectedFarmAnimals305,resolveSelectedSelfTame305,selfTameCandidates305} from '../src/sim/misc-incidents-305.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import {adoptMiscIncidents,MISC_FIRST_CHECK} from '../src/sim/cassandra-misc.ts';
import {validMiscIncidents} from '../src/sim/cassandra-misc-save.ts';
import {RESOURCE_POD_FALL_TICKS305,RESOURCE_POD_OPEN_TICKS305,advanceResourcePod305,resolveSelectedResourcePod305,resourcePodContents305,resourcePodKinds305} from '../src/sim/resource-pods-305.ts';

// World draws happen on check ticks (multiples of 100) from the first check.
const night=(w:World,from:number)=>{for(let t=Math.ceil(from/100)*100;t<from+12000;t+=100)if(celestialGlow305(w,t)<=.5&&celestialGlow305(w,t+500)<=.5)return t;throw Error('no night');};
const day=(w:World,from:number)=>{for(let t=from;t<from+6000;t++)if(celestialGlow305(w,t)>.5)return t;throw Error('no day');};
function colony(size=24,profile=true){const w=createWorld(305,size,size);if(profile){w.gameProfile=crashlandedProfile();delete w.heatwaves;adoptWorldIncidents(w);}return w;}
/** The World category drew this opportunity (as advanceWorldIncidents does). */
const opportunity=(w:World)=>{const s=w.worldIncidents!;s.opportunities++;s.checks++;s.nextCheck=(Math.floor(w.tick/100)+1)*100;};

test('an aurora starts only at night, lasts 0.125 to 0.35 day and gives +14 to a colonist under the open sky',()=>{
  const w=colony();w.tick=night(w,WORLD_FIRST_CHECK);
  expect(eligibleAurora305(w)).toBe(true);
  opportunity(w);expect(resolveSelectedAurora305(w,()=>.5)).toBe(true);
  const a=w.worldIncidents!.aurora!;
  expect(a.start).toBe(w.tick);expect(a.endCore-w.tick*10).toBe(Math.round((AURORA_MIN_DURATION_CORE305+AURORA_MAX_DURATION_CORE305)/2));
  w.tick++;
  const p=w.pawns.find(isColonist)!;
  expect(moodThoughts(w,p).find(t=>t.id==='aurora')?.offset).toBe(14);
  // A second aurora cannot start while one is active.
  expect(eligibleAurora305(w)).toBe(false);
  expect(validWorldIncidents(w.worldIncidents,SCHEMA_VERSION,w)).toBe(true);
  // Under a roof the aurora is not seen.
  const roofing=w.roofing;w.roofing={constructed:[p.z*w.width+p.x],build:[],remove:[],cursor:0};
  expect(moodThoughts(w,p).some(t=>t.id==='aurora')).toBe(false);
  w.roofing=roofing;
  // Absent from schema 304 saves.
  expect(validWorldIncidents(w.worldIncidents,304,w)).toBe(false);
});

test('an aurora cannot start in daylight, fades when daylight returns, then waits 15 days to return',()=>{
  const w=colony();w.tick=day(w,WORLD_FIRST_CHECK);
  expect(eligibleAurora305(w)).toBe(false);
  w.tick=night(w,w.tick);opportunity(w);resolveSelectedAurora305(w,()=>1);
  const start=w.tick;
  w.tick=day(w,w.tick);
  if(w.tick*10<w.worldIncidents!.aurora!.endCore){
    advanceWorldIncidents(w);
    expect(w.worldIncidents!.aurora!.endCore).toBe(w.tick*10+AURORA_FADE_CORE305);
    expect(validWorldIncidents(w.worldIncidents,SCHEMA_VERSION,w)).toBe(true);
  }
  w.tick+=100;advanceWorldIncidents(w);
  expect(w.worldIncidents!.aurora).toBeUndefined();
  w.tick=night(w,start+AURORA_REFIRE_TICKS305-6000);
  expect(eligibleAurora305(w)).toBe(w.tick-start>=AURORA_REFIRE_TICKS305);
  w.tick=night(w,start+AURORA_REFIRE_TICKS305);expect(eligibleAurora305(w)).toBe(true);
});

test('self-tame: one sane wild animal of the map joins the colony as if tamed',()=>{
  const w=colony(40,false);enableWildlife(w,6);
  const candidates=selfTameCandidates305(w);expect(candidates.length).toBeGreaterThan(0);
  const before=w.wildlife!.animals.filter(a=>a.domestic).length;
  expect(resolveSelectedSelfTame305(w,()=>0)).toBe(true);
  const tamed=candidates[0]!;
  expect(tamed.domestic).toMatchObject({since:w.tick,tameness:5});
  expect(w.wildlife!.animals.filter(a=>a.domestic).length).toBe(before+1);
  expect(validateWorld(w)).toEqual([]);
  // A manhunter or downed animal is never chosen.
  for(const a of w.wildlife!.animals)if(!a.domestic){a.state='downed';}
  expect(selfTameCandidates305(w)).toEqual([]);
  expect(resolveSelectedSelfTame305(w,()=>0)).toBe(false);
});

test('farm animals: two to ten tame animals of one farm kind arrive at the edge, a female and a male first',()=>{
  const w=colony(40,false);enableWildlife(w,0);
  const before=w.wildlife!.animals.length,nextId=w.nextId;
  let done=false;for(let seed=1;seed<40&&!done;seed++)done=resolveSelectedFarmAnimals305(w,seed);
  expect(done).toBe(true);
  const arrived=w.wildlife!.animals.slice(before);
  expect(arrived.length).toBeGreaterThanOrEqual(2);expect(arrived.length).toBeLessThanOrEqual(10);
  expect(new Set(arrived.map(a=>a.species)).size).toBe(1);
  expect(['dromedary','duck','yak','donkey','alpaca']).toContain(arrived[0]!.species);
  expect(arrived[0]!.sex).toBe('female');expect(arrived[1]!.sex).toBe('male');
  expect(arrived.every(a=>!!a.domestic&&a.id>=nextId)).toBe(true);
  expect(w.nextId).toBe(nextId+arrived.length);
  expect(validateWorld(w)).toEqual([]);
});

test('a schema 304 save migrates to 305 by its number only',()=>{
  const w=colony(24,false);const current=serializeWorld(w);
  expect(current.startsWith(`{"schemaVersion":${SCHEMA_VERSION},`)).toBe(true);
  const old=asOldSchema(current,304);
  expect(serializeWorld(deserializeWorld(old))).toBe(current);
});

test('resource pods: one sellable kind worth 150 to 600 silver in stacks of 20 to 40, seven at most',()=>{
  const kinds=resourcePodKinds305();
  expect(kinds.length).toBeGreaterThan(5);
  expect(kinds.every(k=>k.value>=1&&k.value<40)).toBe(true);
  for(let seed=1;seed<200;seed++){
    const {item,stacks}=resourcePodContents305(seed),value=kinds.find(k=>k.item===item)!.value;
    expect(stacks.length).toBeGreaterThan(0);expect(stacks.length).toBeLessThanOrEqual(7);
    expect(stacks.every(n=>n>0&&n<=40)).toBe(true);
    expect(stacks.reduce((n,c)=>n+c,0)*value).toBeLessThanOrEqual(600+1e-9);
  }
});

test('resource pods land on an open cell, open after their delay and leave the goods and a slag chunk',()=>{
  const w=colony(40);adoptMiscIncidents(w);
  // As drawn on the first Misc check (advanceMiscIncidents).
  const state=w.miscIncidents!;w.tick=MISC_FIRST_CHECK;state.nextCheck=w.tick+100;state.introDone=true;state.opportunities=1;state.checks=1;
  expect(resolveSelectedResourcePod305(w,1234)).toBe(true);
  const pod=state.resourcePod305!;expect(pod.openAt).toBe(w.tick+RESOURCE_POD_FALL_TICKS305+RESOURCE_POD_OPEN_TICKS305);
  expect(validMiscIncidents(state,SCHEMA_VERSION,w)).toBe(true);
  expect(validMiscIncidents(state,304,w)).toBe(false);
  // A second pod waits for the first.
  expect(resolveSelectedResourcePod305(w,99)).toBe(false);
  const piles=w.piles.length,{item,stacks}=resourcePodContents305(pod.seed);
  advanceResourcePod305(w);expect(w.piles.length).toBe(piles);
  w.tick=pod.openAt;advanceResourcePod305(w);
  expect(state.resourcePod305).toBeUndefined();
  const made=w.piles.slice(piles);
  expect(made.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0)).toBe(stacks.reduce((n,c)=>n+c,0));
  expect(made.filter(p=>p.item==='slag-steel-chunk')).toHaveLength(1);
  expect(made.every(p=>p.owner.type==='ground')).toBe(true);
});
