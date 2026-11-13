import {describe,it,expect} from 'vitest';
import {attachGeneratedAnimalGrowth256} from '../src/sim/animal-growth-runtime-256';
import {createAnimalMedicalRecord256} from '../src/sim/animal-clinical-age-v256';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256';
import {constructInitialWildAnimal256,constructFreshInitialWildAnimal256} from '../src/sim/initial-animal-constructor-256';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {initialWorldPawns256,type WorldPawnsState256,type WorldPawnOwner256} from '../src/sim/world-pawn-state-256';
import {validWorldPawnsEnvelope256,plainWorldPawnData256} from '../src/sim/world-pawn-save-256';
import {worldPawnSituation256} from '../src/sim/world-pawn-capture-256';
import {selectWorldAnimalToRedress256,prepareWorldAnimalRedress256} from '../src/sim/world-pawn-redress-256';
import {prepareWorldAnimalGeneration256} from '../src/sim/world-pawn-generation-256';
import {prepareWorldPawnLife256,prepareWorldPawnRemoval256} from '../src/sim/world-pawn-life-256';
import {WORLD_AUTO_TEND_QUALITY_256,autoTendWorldPawn256} from '../src/sim/world-pawn-auto-tend-256';
import {stepWorldPawnGC256,cancelWorldPawnGC256} from '../src/sim/world-pawn-gc-256';
import type {WildAnimal} from '../src/sim/wildlife-state';
/** Prepared native original records and scalar owner contexts. No played map,
 * acquired reserve, natural history, GC certificate or composed camp asserted. */
function row(id=17,atCore=1000,species:WildAnimal['species']='hare'):Extract<WorldPawnOwner256,{kind:'animal'}> {
 const a:WildAnimal={id,species,sex:'female',ageTicks:1000000,x:1,z:1,food:.1,rest:.8,state:'idle',path:[],nextDecision:atCore/10+1};
 attachGeneratedAnimalGrowth256(a,atCore,256);
 return {kind:'animal',actor:a,factionId:null,originMapId:0,context:{seed:7,width:32,height:32},clockCore:atCore,enteredAtAbsCore:100000+atCore,mode:'active',items:[],packed:[]};
}
const state=(rows:WorldPawnOwner256[],atCore=1000):WorldPawnsState256=>({revision:1,atCore,lastSuccessfulCore:0,currentRate:1,owners:rows});
const random=()=>({value:()=>0,float:(a:number,_b:number)=>Math.fround(a),integer:(a:number,_b:number)=>a});
const free=(r:WorldPawnOwner256)=>worldPawnSituation256(r)??'Free' as const;

describe('prospective WorldPawns real-owner nucleus (prepared records)',()=>{
 it('strictly refuses old/future/accessor/non-finite headers before reading owners',()=>{
  const s=state([row()]);expect(validWorldPawnsEnvelope256({worldPawns:s},256,1000,100)).toBe(true);
  expect(validWorldPawnsEnvelope256({worldPawns:s},255,1000,100)).toBe(false);
  expect(validWorldPawnsEnvelope256({worldPawns:undefined},256,1000,100)).toBe(false);
  let reads=0;const raw=Object.defineProperty({},'worldPawns',{enumerable:true,get(){reads++;throw Error('must not read');}});
  expect(validWorldPawnsEnvelope256(raw,256,1000,100)).toBe(false);expect(reads).toBe(0);
  const forged=structuredClone(s),forgedAnimal=forged.owners[0]!;if(forgedAnimal.kind!=='animal')throw Error('Prepared animal missing');forgedAnimal.actor.food=NaN;expect(validWorldPawnsEnvelope256({worldPawns:forged},256,1000,100)).toBe(false);
  expect(validWorldPawnsEnvelope256({worldPawns:{...s,owners:[s.owners[0]!,s.owners[0]!]}},256,1000,100)).toBe(false);
  const shared={value:1};expect(plainWorldPawnData256({a:shared,b:shared})).toBe(true);const cycle:{self?:object}={};cycle.self=cycle;expect(plainWorldPawnData256(cycle)).toBe(false);
 });
 it('never treats absent situation/relationship history as a favorable fresh request',()=>{
  const s=state([row()]);let draws=0;const r={...random(),value:()=>{draws++;return 0;}};
  expect(selectWorldAnimalToRedress256(s,INITIAL_ANIMAL_FACTS_256.Hare,r,()=>1,()=>undefined)).toMatchObject({status:'blocked'});expect(draws).toBe(0);
  expect(selectWorldAnimalToRedress256(s,INITIAL_ANIMAL_FACTS_256.Hare,r,()=>undefined,free)).toMatchObject({status:'blocked'});expect(draws).toBe(1);expect(s.owners).toHaveLength(1);
 });
 it('redresses the same healthy original without resetting age/growth or allocating an identity',()=>{
  const original=row(),s=state([original]),before=JSON.stringify(s),age=original.actor.ageTicks,growth=structuredClone(original.actor.growthTracker);
  const selected=selectWorldAnimalToRedress256(s,INITIAL_ANIMAL_FACTS_256.Hare,random(),()=>1,free);expect(selected).toMatchObject({status:'selected',row:original});
  const plan=prepareWorldAnimalRedress256(s,original,INITIAL_ANIMAL_FACTS_256.Hare,{tick:100,cell:{x:5,z:6},random:random(),situation:free});if(!plan.ok)throw Error(plan.reason);
  expect(JSON.stringify(s)).toBe(before);expect(plan.draft.id).toBe(original.actor.id);expect(plan.draft.ageTicks).toBe(age);expect(plan.draft.growthTracker).toEqual(growth);
  const actual=plan.commit();expect(actual).toBe(original.actor);expect(actual).toMatchObject({x:5,z:6});expect(s.owners).toEqual([]);expect(()=>plan.commit()).toThrow();
 });
 it('stages two cohort reuses, removes each from the next Free draw, then adopts both originals once',()=>{
  const a=row(17),b=row(18),s=state([a,b]),before=JSON.stringify(s),phase=prepareWorldAnimalGeneration256(s,{tick:100,nextId:100,situation:free,weight:()=>1,random:random()});
  expect(phase.generate(INITIAL_ANIMAL_FACTS_256.Hare,{x:7,z:7}).status).toBe('ready');expect(phase.generate(INITIAL_ANIMAL_FACTS_256.Hare,{x:8,z:7}).status).toBe('ready');
  expect(phase.nextId).toBe(100);expect(JSON.stringify(s)).toBe(before);const actual=phase.commit();expect(actual[0]).toBe(a.actor);expect(actual[1]).toBe(b.actor);expect(s.owners).toEqual([]);expect(()=>phase.commit()).toThrow();
 });
 it('preserves the exact fresh constructor draws after the separate Chance, including invalid-frontier refusal',()=>{
  const one=new WorldGenerationRandom(123),two=new WorldGenerationRandom(123),input={fact:INITIAL_ANIMAL_FACTS_256.Hare,id:100,cell:{x:1,z:1},tick:100};
  const old=constructInitialWildAnimal256({...input,random:one,unspawnedAnimals:[]});two.value();const fresh=constructFreshInitialWildAnimal256({...input,random:two});expect(fresh).toEqual(old);expect(two.state).toEqual(one.state);
  const bad=new WorldGenerationRandom(123),before=bad.state;expect(()=>constructInitialWildAnimal256({...input,id:0,random:bad,unspawnedAnimals:[]})).toThrow();expect(bad.state).toEqual(before);
 });
 it('tends without doctor/medicine RNG, and mothball advances age only while scars remain permanent',()=>{
  const owner=row(17,14990),a=owner.actor,h=a.health=createAnimalMedicalRecord256({schemaVersion:256,tick:1499},a);
  h.injuries.push({id:1,part:'torso',kind:'cut',severity:1000,bornAt:1499});h.nextInjuryId=2;expect(autoTendWorldPawn256(h,317)).toBe(1);expect(h.injuries[0]!.tended).toBe(WORLD_AUTO_TEND_QUALITY_256);
  h.injuries[0]!.scar={threshold:1000,pain:0};const permanent=JSON.stringify(h.injuries),s=state([owner],14990),rng={rng:123};
  const first=prepareWorldPawnLife256(s,15000,rng);if(!first.ok)throw Error(first.reason);first.commit();expect(owner.mode).toBe('mothballed');const age=a.ageTicks;
  const idle=prepareWorldPawnLife256(s,15010,rng);if(!idle.ok)throw Error(idle.reason);idle.commit();expect(a.ageTicks).toBe(age);expect(JSON.stringify(a.health!.injuries)).toBe(permanent);
  const returned=prepareWorldPawnRemoval256(owner,15010);if(!returned.ok)throw Error(returned.reason);if(returned.draft.kind!=='animal')throw Error('Prepared animal changed kind');expect(returned.draft.actor.ageTicks).toBe(age+1);expect(returned.draft.actor.health!.injuries).toEqual(h.injuries);expect(a.ageTicks).toBe(age);
 });
 it('refuses a missing off-map comp without advancing any earlier original or active RNG',()=>{
  const a=row(17),b=row(18,1000,'turkey');b.actor.eggLayer={progress:0,fertilizations:0};const s=state([a,b]),rng={rng:123},before=JSON.stringify(s);
  expect(prepareWorldPawnLife256(s,1010,rng)).toMatchObject({ok:false});expect(JSON.stringify(s)).toBe(before);expect(rng.rng).toBe(123);
 });
 it('keeps unresolved real critical history and persists GC cadence without drawing the gameplay stream',()=>{
  const original=row(17,14990),s=state([original],14990),rng={rng:123};let commits=0;
  const reader={facts:()=>({keep:[],unknown:['bond','active-tale'],relatedIds:[],memoryIds:[]}),planDiscard:(rows:readonly WorldPawnOwner256[])=>{expect(rows).toEqual([]);return {commit(){commits++;}};}};
  stepWorldPawnGC256(s,14999,reader);expect(commits).toBe(0);const beforeGC=prepareWorldPawnLife256(s,15000,rng);if(!beforeGC.ok)throw Error(beforeGC.reason);beforeGC.commit();stepWorldPawnGC256(s,15000,reader);expect(s.lastSuccessfulCore).toBe(0);cancelWorldPawnGC256(s);expect(s.currentRate).toBe(2);
  for(let core=15001;core<=15005;core++)stepWorldPawnGC256(s,core,reader);
  expect(commits).toBe(1);expect(s.owners[0]).toBe(original);expect(s.lastSuccessfulCore).toBeGreaterThanOrEqual(15001);expect(s.currentRate).toBe(1);const confirmed=prepareWorldPawnLife256(s,15010,rng);if(!confirmed.ok)throw Error(confirmed.reason);confirmed.commit();expect(validWorldPawnsEnvelope256({worldPawns:s},256,15010,100)).toBe(true);expect(structuredClone(s)).toEqual(s);expect(initialWorldPawns256()).toEqual({revision:1,atCore:0,lastSuccessfulCore:0,currentRate:1,owners:[]});expect(()=>initialWorldPawns256(1000)).toThrow();
 });
 it('never turns a failed closed GC iterator into a successful next-tick pass',()=>{
  const a=row(),s=state([a]);let attempts=0;
  const reader={facts:()=>({keep:[],unknown:[],relatedIds:[],memoryIds:[]}),planDiscard:()=>{attempts++;throw Error('Actual physical preflight refused');}};
  expect(()=>stepWorldPawnGC256(s,15000,reader)).toThrow('Actual physical preflight refused');expect(s.lastSuccessfulCore).toBe(0);expect(s.owners[0]).toBe(a);
  expect(()=>stepWorldPawnGC256(s,15001,reader)).toThrow('Actual physical preflight refused');expect(attempts).toBe(2);expect(s.lastSuccessfulCore).toBe(0);
 });
});
