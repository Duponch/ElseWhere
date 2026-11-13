import {readFileSync} from 'node:fs';
import {asOldSchema} from './scenarios/old-schema.ts';
import {expect,test} from 'vitest';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {animalWanderWaitEnd304,ANIMAL_WANDER_WAIT_MAX_CORE304} from '../src/sim/animal-idle-wander-304.ts';
import {idleHashOffset300} from '../src/sim/idle-wander-300.ts';
import {validateWildlife} from '../src/sim/wildlife-save.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import {navigationCosts,lazyAnimalNavigationCosts} from '../src/sim/furniture-travel.ts';
import {captureStructureNavigation} from '../src/sim/structure-navigation.ts';
import {withPileIndexScope} from '../src/sim/pile-index.ts';

// Les Éclaircies: a real geographic colony with tame and wild animals.
const PATH='public/test-saves/v419/les-eclaircies.json';
let text:string|undefined;
const load=():World=>deserializeWorld(text??=readFileSync(PATH,'utf8'));
const LONG=600_000;

test('a wander wait ends at the animal\'s first TickInterval tick inside the expiry hash window',()=>{
 for(let id=1;id<=300;id++)for(const expiry of [120,121,150,199,240]){
  const start=17300+id*7,end=animalWanderWaitEnd304(id,start,expiry),hash=idleHashOffset300(id);
  const fits=(t:number)=>{const phase=((t|0)+hash)|0;return phase%15===0&&Math.abs(phase%expiry)<15;};
  expect(end).toBeGreaterThanOrEqual(start+expiry);
  expect(fits(end)).toBe(true);
  for(let t=start+expiry;t<end;t++)expect(fits(t)).toBe(false);
  // Between 120 and 480 ticks for the animal nodes' 120~240 range.
  expect(end-start).toBeLessThanOrEqual(2*expiry+30);
 }
});

test('idle animals alternate a wait of 120 to 510 Core ticks and a walk, on the real Éclaircies colony',()=>{
 const w=load();expect(w.schemaVersion).toBe(SCHEMA_VERSION);
 const animals=(w.wildlife?.animals??[]).filter(a=>a.wander&&a.species!=='duck');
 expect(animals.length).toBeGreaterThan(0);
 const last=new Map<number,{kind:string;key:string}>(),kinds=new Map<number,string[]>();let waits=0,walks=0;
 // A job present at load was given by the older rule (kept by the migration):
 // the alternation is checked from the first job given under schema 304.
 const keyOf=(job:NonNullable<NonNullable<typeof animals[number]['wander']>['job']>)=>job.kind==='wait'?`wait:${job.untilCore}`:`goto:${job.destination.x},${job.destination.z}`;
 const inherited=new Map(animals.filter(a=>a.wander?.job).map(a=>[a.id,keyOf(a.wander!.job!)]));
 for(let i=0;i<400;i++){
  stepWorld(w);const core=w.tick*10;
  for(const a of animals){
   const job=a.wander?.job;if(!job||a.state==='dead')continue;
   const key=keyOf(job),before=last.get(a.id);
   if(before?.key===key)continue;last.set(a.id,{kind:job.kind,key});
   if(inherited.get(a.id)===key){inherited.delete(a.id);continue;}
   const list=kinds.get(a.id)??[];list.push(job.kind);kinds.set(a.id,list);
   if(job.kind==='wait'){waits++;const length=job.untilCore-core;
    // A new wait starts this tick: an expiry window, or ErroredPather's 250.
    expect(length===250||length>=110&&length<=ANIMAL_WANDER_WAIT_MAX_CORE304).toBe(true);}
   else walks++;
  }
 }
 expect(waits).toBeGreaterThan(0);expect(walks).toBeGreaterThan(0);
 // Two walks are always separated by a wait (nextMoveOrderIsWait).
 for(const list of kinds.values())for(let k=1;k<list.length;k++)expect(list[k]==='goto'&&list[k-1]==='goto').toBe(false);
},LONG);

test('a reloaded colony continues the idle wander exactly like the uninterrupted one',()=>{
 const w=load();for(let i=0;i<60;i++)stepWorld(w);
 const saved=serializeWorld(w);
 for(let i=0;i<120;i++)stepWorld(w);
 const reloaded=deserializeWorld(saved);for(let i=0;i<120;i++)stepWorld(reloaded);
 const a=serializeWorld(w),b=serializeWorld(reloaded);
 expect(a===b,`continuous ${a.length} bytes, reloaded ${b.length} bytes`).toBe(true);
},LONG);

test('schema 304 admits a wander wait up to 500 Core ticks; schema 303 keeps its 200',()=>{
 const w=load(),a=(w.wildlife?.animals??[]).find(x=>x.wander&&x.state!=='dead')!;
 a.wander!.job={kind:'wait',untilCore:w.tick*10+450};
 expect(validateWildlife(w,304,new Set())).toEqual([]);
 expect(validateWildlife(w,303,new Set()).length).toBeGreaterThan(0);
 a.wander!.job={kind:'wait',untilCore:w.tick*10+ANIMAL_WANDER_WAIT_MAX_CORE304+1};
 expect(validateWildlife(w,304,new Set()).length).toBeGreaterThan(0);
},LONG);

test('a schema 303 save migrates to 304 by its number only',()=>{
 // Freshly loaded: no state yet that only schema 304 admits.
 const w=load();
 const current=serializeWorld(w);expect(current.startsWith(`{"schemaVersion":${SCHEMA_VERSION},`)).toBe(true);
 const old=asOldSchema(current,303);
 expect(serializeWorld(deserializeWorld(old))).toBe(current);
 // The old schema is validated strictly first: a wait longer than its 200.
 const a=(w.wildlife?.animals??[]).find(x=>x.wander&&x.state!=='dead')!;
 a.wander!.job={kind:'wait',untilCore:w.tick*10+450};
 const tooLong=asOldSchema(serializeWorld(w),303);
 expect(()=>deserializeWorld(tooLong)).toThrow(/Invalid version303 save/);
},LONG);

test('the on-demand navigation costs of the wander equal the full capture on every cell',()=>{
 const w=load();for(let i=0;i<30;i++)stepWorld(w);
 withPileIndexScope(()=>{
  const g=captureStructureNavigation(w),full=navigationCosts(w,undefined,undefined,g,true),lazy=lazyAnimalNavigationCosts(w,undefined,g);
  expect(lazy.costs?.maximum).toBe(full.costs?.maximum);expect(lazy.floors.maximum).toBe(full.floors.maximum);
  let differences=0;
  for(let i=0;i<w.width*w.height;i++)if(lazy.costs?.get(i)!==full.costs?.get(i)||lazy.costs?.has(i)!==full.costs?.has(i)||lazy.floors.get(i)!==full.floors.get(i)
   ||lazy.floors.has(i)!==full.floors.has(i)||lazy.repeaters.has(i)!==full.repeaters.has(i)||lazy.stops.has(i)!==full.stops.has(i))differences++;
  expect(differences).toBe(0);
 });
},LONG);
