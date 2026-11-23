import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index';
import {SCHEMA_VERSION} from '../src/sim/types';
import {domesticColony} from './scenarios/domestic-colony';
import {actionProgress} from '../src/render/action-feedback';

test('V105 is strictly validated before neutral migration to the current schema',()=>{
 const raw=JSON.parse(readFileSync('public/test-saves/v105/economie.json','utf8'));
 const restored=deserializeWorld(JSON.stringify(raw));
 expect(raw.schemaVersion).toBe(105);
 expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
 expect([restored.seed,restored.rng,restored.tick,restored.nextId]).toEqual([raw.seed,raw.rng,raw.tick,raw.nextId]);
 expect(restored.research).toEqual(raw.research);
 expect(restored.piles).toEqual(raw.piles);
 expect(restored.visitors?.groups).toEqual(raw.visitors.groups);
 expect(restored.visitors?.traveler).toEqual(raw.visitors.traveler);
 expect(restored.visitors?.visitor).toEqual(raw.visitors.visitor);
 expect(restored.visitors?.exotic?.pending.every(tick=>tick>restored.tick)).toBe(true);
 expect(restored.pawns.every(p=>p.priorities.handle===0)).toBe(true);
 expect(restored.pawns.map(p=>p.age)).toEqual(raw.pawns.map(()=>({biologicalTicks:10800000,chronologicalTicks:10800000})));
 expect(restored.pawns.every(p=>p.recreation.tolerance.cerebral===0&&p.recreation.bored.cerebral===false&&p.recreation.tolerance.social===0&&p.recreation.bored.social===false)).toBe(true);
 expect(restored.research?.autodoors).toBeUndefined();
 expect(validateWorld(restored)).toEqual([]);
 for(const corrupt of [()=>raw.pawns[0].priorities.handle=1,()=>{raw.pawns[0].skills.animals={level:8,xp:0,dailyXp:0,passion:0};}]){
  const before=JSON.stringify(raw);corrupt();expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow();Object.assign(raw,JSON.parse(before));
 }
});

test('import refuses malformed wildlife and veterinary duration without throwing in validator',()=>{
 const w=domesticColony();
 for(const value of [{animals:{}},{animals:[null]},null]){
  const bad={...w,wildlife:value};expect(()=>validateWorld(bad)).not.toThrow();expect(validateWorld(bad).length).toBeGreaterThan(0);
 }
 w.pawns[0].priorities.handle=0;
 for(let i=0;i<250&&w.pawns[0].animalCare?.phase!=='treat';i++)stepWorld(w);
 expect(w.pawns[0].animalCare?.phase).toBe('treat');expect(validateWorld(w)).toEqual([]);
 for(const patch of [{duration:6001},{duration:0},{duration:undefined},{phase:'approach',progress:0,duration:200},{phase:'pickup',progress:0,duration:200}]){
  const bad=structuredClone(w);Object.assign(bad.pawns[0].animalCare!,patch);expect(validateWorld(bad).length).toBeGreaterThan(0);
 }
});

test('all physical taming stages survive cold reload, with exact food and progress bounds',()=>{
 const w=domesticColony(),p=w.pawns[0],a=w.wildlife!.animals[0];p.priorities.doctor=0;w.rng=1;
 expect(applyCommand(w,{type:'tame',animalId:a.id,enabled:true}).ok).toBe(true);
 const stages=new Set<number>();
 for(let i=0;i<400&&!a.domestic;i++){
  stepWorld(w);const t=p.animalHandling;if(!t||t.phase!=='interact'||stages.has(t.step))continue;
  stages.add(t.step);expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  const total=t.step===2||t.step===4?45:t.step===5?35:27;
  // Core JobDriver_InteractAnimal draws no progress bar (interactions note).
  expect(actionProgress(w,p)).toBeUndefined();
  const bad=structuredClone(w);bad.pawns[0].animalHandling!.progress=total;expect(validateWorld(bad).length).toBeGreaterThan(0);
 }
 expect([...stages]).toEqual([0,1,2,3,4,5]);expect(a.domestic?.tameness).toBe(5);
});
