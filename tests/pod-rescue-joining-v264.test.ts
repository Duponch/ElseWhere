import { expect,test } from 'vitest';
import { SnapshotDecoder,SnapshotEncoder } from '../src/bridge/snapshots.ts';
import { isCarePatient,isColonist } from '../src/sim/affiliation.ts';
import { medicalRestNeeded } from '../src/sim/care-rules.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import { reconcilePawnHealth } from '../src/sim/health.ts';
import { createMedicalRecord,medicalStatus } from '../src/sim/injury-state.ts';
import { HP_UNIT } from '../src/sim/injury-rules.ts';
import { startTravel } from '../src/sim/movement.ts';
import { advancePodRescues,exitPodRescue,reconcilePodRescueResults,resolveSelectedPodRescue } from '../src/sim/pod-rescue.ts';
import { podRescueIdentityRoll,podRescueOutdoorDanger,selectPodRescueOrigin } from '../src/sim/pod-rescue-joining.ts';
import { validatePodRescues } from '../src/sim/pod-rescue-save.ts';
import { createPrisonerState } from '../src/sim/prisoner-state.ts';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { enableAndInitializeWork } from '../src/sim/work-initialization.ts';
import { SCHEMA_VERSION,TICKS_PER_DAY,type Pawn,type World } from '../src/sim/types.ts';
import { fixtureBuilding } from './scenarios/deconstruction.ts';
import { medicalCamp } from './scenarios/health.ts';
import { withoutFodderDefaults } from './scenarios/legacy-skills.ts';

type Origin='independent'|'outlander';
function opened(origin:Origin|'historical'='independent') {
  const w=medicalCamp();
  expect(resolveSelectedPodRescue(w,187)).toBe(true);
  if(origin==='historical')delete w.podRescues!.pending!.origin;
  else w.podRescues!.pending!.origin=origin;
  w.tick=w.podRescues!.pending!.openAt;advancePodRescues(w);
  const p=w.pawns.find(p=>p.podRescue)!;
  expect(p).toBeDefined();return {w,p,incident:w.podRescues!.incidents[0]!};
}
/** Explicit post-treatment checkpoint. Existing pod-rescue-care tests exercise
 * the actual pickup, deposit and treatment; these cases isolate affiliation. */
function mobile(origin:Origin|'historical'='independent') {
  const fixture=opened(origin),{w,p}=fixture;
  p.podRescue!.admittedAt=w.tick;
  p.health=createMedicalRecord(w.tick);
  p.health.injuries.push({id:1,part:'torso',kind:'bruise',severity:HP_UNIT,bornAt:w.tick,tended:500});
  p.health.nextInjuryId=2;p.state='idle';p.need=null;p.bedId=null;
  expect(medicalStatus(p.health)).toBe('mobile');
  expect(medicalRestNeeded(p)).toBe(true);
  expect(podRescueOutdoorDanger(w,p)).toBe(false);
  return fixture;
}
/** Select an identity for a branch, without reproducing the hash algorithm. */
function identity(w:World,p:Pawn,outcome:'joined'|'left'):void {
  const previous=p.id;
  const id=Array.from({length:128},(_,i)=>w.nextId+i).find(id=>(podRescueIdentityRoll(id)<.5)===(outcome==='joined'));
  expect(id).toBeDefined();p.id=id!;w.nextId=Math.max(w.nextId,p.id+1);
  w.podRescues!.incidents[0]!.pawnId=p.id;
  for(const item of w.piles)if('pawnId' in item.owner&&item.owner.pawnId===previous)item.owner.pawnId=p.id;
}
function hot(w:World):void {
  w.heatwaves={profile:'camp-heat-v1',rng:1,nextAt:w.tick+10000,serial:1,
    active:{start:w.tick-1200,end:w.tick+1200}};
}
function cold(w:World):void {
  w.climate={revision:1,profile:'boreal-reference',adoptedAt:w.tick,calendarOrigin:50*TICKS_PER_DAY};
}
function ids(w:World):Set<number> {
  return new Set([...w.pawns.map(p=>p.id),...w.piles.map(p=>p.id),...w.structures.map(s=>s.id)]);
}

test('new capsule origin is local, deterministic and preserved through staging and opening',()=>{
  const seeds=Array.from({length:32},(_,i)=>i+1);
  expect(new Set(seeds.map(selectPodRescueOrigin))).toEqual(new Set(['independent','outlander']));
  const w=medicalCamp(),rng=w.rng;
  expect(resolveSelectedPodRescue(w,187)).toBe(true);
  const pending=structuredClone(w.podRescues!.pending!);
  expect(pending.origin).toBe(selectPodRescueOrigin(187));expect(w.rng).toBe(rng);
  const restored=deserializeWorld(serializeWorld(w));expect(restored.podRescues!.pending).toEqual(pending);
  w.tick=pending.openAt;restored.tick=pending.openAt;advancePodRescues(w);advancePodRescues(restored);
  expect(restored).toEqual(w);expect(w.podRescues!.incidents[0]!.origin).toBe(pending.origin);
  expect(w.rng).toBe(rng);
});

test('admission and a real physiological relèvement are required before automatic affiliation',()=>{
  const {w,p,incident}=opened();identity(w,p,'joined');
  reconcilePodRescueResults(w);expect(incident.decision).toBeUndefined();
  p.podRescue!.admittedAt=w.tick;reconcilePodRescueResults(w);
  expect(incident.decision).toBeUndefined();expect(p.state).toBe('downed');
  p.health=createMedicalRecord(w.tick);reconcilePawnHealth(w,p);
  expect(p.state).toBe('idle');reconcilePodRescueResults(w);
  expect(incident).toMatchObject({result:'joined',decision:{at:w.tick,outcome:'joined',admittedAt:w.tick}});
  expect(isColonist(p)).toBe(true);
});

test('a mobile independent person without a completed rescue remains foreign',()=>{
  const {w,p,incident}=mobile();identity(w,p,'joined');delete p.podRescue!.admittedAt;
  const rng=w.rng;reconcilePodRescueResults(w);
  expect(incident.decision).toBeUndefined();expect(p.faction).toBe('outlanders');expect(w.rng).toBe(rng);
});

test('joining preserves the actual person, possessions, personality and unfinished medical recovery',()=>{
  const {w,p,incident}=mobile();identity(w,p,'joined');
  const bed=fixtureBuilding(w,'bed',p.x,p.z);Object.assign(bed,{medical:true});
  p.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:p.x,z:p.z},medical:'bedrest'};p.state='resting';
  const need=p.need;
  const baseline=structuredClone(p),health=p.health,skills=p.skills,items=structuredClone(w.piles),nextId=w.nextId,rng=w.rng;
  // From schema 302 a joining human receives RimWorld's EnableAndInitialize
  // (six best work types and the always-active ones at 3), from its own
  // unchanged skills and background.
  const initialized=structuredClone(p);enableAndInitializeWork(initialized);
  const defaults=initialized.priorities;
  reconcilePodRescueResults(w);
  expect(w.pawns.find(q=>q.id===p.id)).toBe(p);expect(p.health).toBe(health);expect(p.skills).toBe(skills);
  expect(p.need).toBe(need);expect(p.need).toEqual(baseline.need);
  for(const field of ['id','name','age','appearance','background','traits','skills','health','hunger','rest','memories','schedule'] as const)
    expect(p[field]).toEqual(baseline[field]);
  expect(w.piles).toEqual(items);expect(w.nextId).toBe(nextId);expect(w.rng).toBe(rng);
  expect(p.priorities).toEqual(defaults);expect(p.podRescue).toBeUndefined();expect(p.faction).toBe('colony');
  expect(w.foodPolicies.some(policy=>policy.id===p.foodPolicyId)).toBe(true);
  expect(w.apparelPolicies!.some(policy=>policy.id===p.apparelPolicyId)).toBe(true);
  expect(p.apparelAutomation).toBe(true);expect(isCarePatient(p)).toBe(true);expect(medicalRestNeeded(p)).toBe(true);
  expect(incident.result).toBe('joined');expect(w.podRescues!.departed).toEqual([]);
  const committed=structuredClone(w);reconcilePodRescueResults(w);expect(w).toEqual(committed);
});

test('a refusal is final while existing care and physical departure remain available',()=>{
  const {w,p,incident}=mobile();identity(w,p,'left');
  reconcilePodRescueResults(w);
  expect(incident.decision).toEqual({at:w.tick,outcome:'left',admittedAt:w.tick});expect(incident.result).toBeUndefined();
  expect(p.faction).toBe('outlanders');expect(isCarePatient(p)).toBe(true);expect(medicalRestNeeded(p)).toBe(true);
  hot(w);expect(podRescueOutdoorDanger(w,p)).toBe(true);reconcilePodRescueResults(w);
  expect(incident.decision!.outcome).toBe('left');expect(p.faction).toBe('outlanders');
  // Prepared confirmed edge checkpoint: remaining wounds still block exit.
  p.x=0;p.z=1;p.path=[];expect(exitPodRescue(w,p)).toBe(false);
  p.health=createMedicalRecord(w.tick);expect(exitPodRescue(w,p)).toBe(true);
  expect(incident.result).toBe('departed');expect(incident.decision!.outcome).toBe('left');
  expect(w.podRescues!.departed).toHaveLength(1);
});

test('identity determines the safe-temperature outcome independently of world RNG and replay',()=>{
  const {w,p,incident}=mobile();identity(w,p,'left');
  const copy=structuredClone(w),rng=w.rng;copy.rng=(rng^0x13579bdf)>>>0||1;
  const copyRng=copy.rng;reconcilePodRescueResults(w);reconcilePodRescueResults(copy);
  expect(copy.podRescues!.incidents[0]!.decision).toEqual(incident.decision);
  expect(w.rng).toBe(rng);expect(copy.rng).toBe(copyRng);
});

test('dangerous exterior heat or cold lets an eligible identity join without a world RNG draw',()=>{
  for(const weather of [hot,cold]) {
    const {w,p,incident}=mobile();identity(w,p,'left');weather(w);
    expect(podRescueOutdoorDanger(w,p)).toBe(true);
    const rng=w.rng;reconcilePodRescueResults(w);
    expect(incident.decision!.outcome).toBe('joined');expect(p.faction).toBe('colony');expect(w.rng).toBe(rng);
  }
});

test('old capsules and foreign-faction capsules never acquire the new joining decision',()=>{
  for(const origin of ['historical','outlander'] as const) {
    const {w,p,incident}=mobile(origin);identity(w,p,'joined');hot(w);reconcilePodRescueResults(w);
    expect(incident.decision).toBeUndefined();expect(incident.result).toBeUndefined();
    expect(p.faction).toBe('outlanders');expect(p.podRescue).toBeDefined();
  }
  const old=withoutFodderDefaults(medicalCamp());
  for(const policy of old.foodPolicies)policy.allowed=policy.allowed.filter(item=>item!=='nutrient-paste-meal');
  old.schemaVersion=198 as World['schemaVersion'];
  expect(resolveSelectedPodRescue(old,187)).toBe(true);expect(old.podRescues!.pending!.origin).toBeUndefined();
  const migrated=deserializeWorld(JSON.stringify(old));expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  expect(migrated.podRescues).toEqual(old.podRescues);
});

test('death and captivity resolve their existing outcomes before any joining decision',()=>{
  for(const terminal of ['dead','captured'] as const) {
    const {w,p,incident}=mobile();identity(w,p,'joined');
    if(terminal==='dead'){p.state='dead';p.health!.death={tick:w.tick,cause:'trauma'};}
    else p.prisoner=createPrisonerState(w,p);
    reconcilePodRescueResults(w);
    expect(incident.result).toBe(terminal);expect(incident.decision).toBeUndefined();expect(p.faction).toBe('outlanders');
  }
});

test('carried people and unfinished captured movement cannot change affiliation mid-transport',()=>{
  const {w,p,incident}=mobile();identity(w,p,'joined');
  expect(startTravel(w,p,{x:p.x+1,z:p.z})).toBe(true);
  const carrier=w.pawns[0]!;carrier.rescue={patientId:p.id,bedId:1,phase:'carry'};
  reconcilePodRescueResults(w);expect(incident.decision).toBeUndefined();
  delete carrier.rescue;reconcilePodRescueResults(w);expect(incident.decision).toBeUndefined();
  w.tick=Math.ceil(p.motion!.end);p.moveCooldown=0;p.health!.tick=w.tick;
  reconcilePodRescueResults(w);expect(incident.result).toBe('joined');
});

test('save and load before and after the decision preserve a single identity and issue',()=>{
  for(const outcome of ['joined','left'] as const) {
    const {w,p,incident}=mobile();identity(w,p,outcome);
    const restored=deserializeWorld(serializeWorld(w));
    reconcilePodRescueResults(w);reconcilePodRescueResults(restored);expect(restored).toEqual(w);
    const after=deserializeWorld(serializeWorld(w)),committed=structuredClone(after);
    reconcilePodRescueResults(after);expect(after).toEqual(committed);
    expect(after.podRescues!.incidents[0]!.decision).toEqual(incident.decision);
    expect(after.pawns.filter(q=>q.id===p.id)).toHaveLength(1);
  }
});

test('the existing snapshot decoder applies the affiliation delta with the same actor and possessions',()=>{
  const {w,p,incident}=mobile();identity(w,p,'joined');
  const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  expect(decoder.adopt(structuredClone(encoder.encode(w,0,1))).status).toBe('applied');
  const items=structuredClone(w.piles);reconcilePodRescueResults(w);
  const result=decoder.adopt(structuredClone(encoder.encode(w,0,1)));
  expect(result.status).toBe('applied');
  if(result.status==='applied') {
    expect(result.world.pawns.find(q=>q.id===p.id)).toMatchObject({id:p.id,faction:'colony'});
    expect(result.world.pawns.find(q=>q.id===p.id)!.podRescue).toBeUndefined();
    expect(result.world.piles).toEqual(items);expect(result.world.podRescues!.incidents[0]).toEqual(incident);
  }
});

test('a joined incident is history and does not require its person to stay on this map',()=>{
  const {w,p,incident}=mobile();identity(w,p,'joined');reconcilePodRescueResults(w);
  const committed=structuredClone(incident);
  w.pawns=w.pawns.filter(q=>q!==p);w.piles=w.piles.filter(item=>!('pawnId' in item.owner&&item.owner.pawnId===p.id));
  expect(validatePodRescues(w,SCHEMA_VERSION,ids(w))).toEqual([]);
  reconcilePodRescueResults(w);expect(incident).toEqual(committed);
});

test('the joined person accepts colonial orders and continues through ordinary ticks after save/reload',()=>{
  const {w,p,incident}=mobile();identity(w,p,'joined');reconcilePodRescueResults(w);
  expect(applyCommand(w,{type:'priority',pawnId:p.id,work:'haul',value:1}).ok).toBe(true);
  expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
  const restored=deserializeWorld(serializeWorld(w));
  stepWorld(w,48);stepWorld(restored,48);expect(restored).toEqual(w);
  expect(validateWorld(w)).toEqual([]);expect(w.pawns.find(q=>q.id===p.id)).toBe(p);
  expect(p.faction).toBe('colony');expect(p.podRescue).toBeUndefined();
  expect(incident.result).toBe('joined');expect(w.podRescues!.departed).toEqual([]);
});
