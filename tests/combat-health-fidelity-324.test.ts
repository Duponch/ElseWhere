import {expect,test} from 'vitest';
import {resolveUnarmoredBullet} from '../src/sim/bullet-impact.ts';
import {resolveUnarmoredMelee} from '../src/sim/melee-impact.ts';
import {addResolvedInjury,createMedicalRecord} from '../src/sim/injury-state.ts';
import {PART_INJURY_RULES} from '../src/sim/injury-rules.ts';
import {meleeTools} from '../src/sim/melee-statistics.ts';
import {autoTendWorldPawn256,worldAutoTendQuality324} from '../src/sim/world-pawn-auto-tend-256.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {equipmentCamp} from './scenarios/equipment.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {World} from '../src/sim/types.ts';

const hare=()=>({...createMedicalRecord(0),body:'hare' as const});
const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};

test('a hit of 10 or more on a small creature also lands on the parent of the last part touched',()=>{
  // Hare: health scale 0.4, paw 4 HP, leg 12 HP. The paw is destroyed, then
  // the leg takes the full 12 again and is preserved at 11.
  const shot=resolveUnarmoredBullet(hare(),{damage:12,part:'left-front-paw'},()=>.5,undefined,true);
  expect(shot.layers.map(l=>[l.part,l.severity])).toEqual([['left-front-paw',12000],['left-front-leg',11000]]);
  expect(resolveUnarmoredBullet(hare(),{damage:12,part:'left-front-paw'},()=>.5).layers.map(l=>l.part)).toEqual(['left-front-paw']);
  expect(resolveUnarmoredBullet(hare(),{damage:9,part:'left-front-paw'},()=>.5,undefined,true).layers.map(l=>l.part)).toEqual(['left-front-paw']);
  // A human (health scale 1) never propagates.
  expect(resolveUnarmoredBullet(createMedicalRecord(0),{damage:30,part:'left-hand'},()=>.5,undefined,true).layers.map(l=>l.part)).toEqual(['left-hand']);
  const bite=resolveUnarmoredMelee(hare(),{damage:12,kind:'bite',part:'left-front-paw'},()=>.5,undefined,true);
  expect(bite.layers.map(l=>[l.part,l.severity])).toEqual([['left-front-paw',12000],['left-front-leg',11000]]);
  expect(resolveUnarmoredMelee(hare(),{damage:12,kind:'bite',part:'left-front-paw'},()=>.5).layers.map(l=>l.part)).toEqual(['left-front-paw']);
});

test('fists and teeth hit as hard as their injured parts allow, the head butt keeps 0.4',()=>{
  const w=equipmentCamp(2),p=w.pawns[0]!;
  p.health=createMedicalRecord(w.tick);
  for(const finger of ['pinky','ring-finger','middle-finger','index-finger','thumb'] as const)addResolvedInjury(p.health,`left-${finger}`,'cut',4000,()=>.99);
  addResolvedInjury(p.health,'head','crush',20000,()=>.99);
  const tool=(id:string)=>meleeTools(w,p).find(t=>t.id===id);
  // Fingers at 4/8 HP: efficiency (0.5-0.1)/0.9 on an outside part.
  expect(tool('left-fist')!.damage).toBeCloseTo(8.2*(.4/.9),12);
  expect(tool('right-fist')!.damage).toBe(8.2);
  expect(tool('head')!.damage).toBeCloseTo(5*.4,12);
  expect(tool('left-fist')!.penetration).toBeCloseTo(8.2*(.4/.9)*.015,12);
  setVersion(w,323);
  expect(tool('left-fist')!.damage).toBe(8.2);expect(tool('head')!.damage).toBe(5);
});

test('the tongue does not bleed',()=>{
  expect(PART_INJURY_RULES.tongue.bleed).toBe(0);
  expect(PART_INJURY_RULES.jaw.bleed).toBe(0);
  expect(PART_INJURY_RULES.neck.bleed).toBe(4);
});

test('world pawns get the random band of a tend without medicine',()=>{
  expect(worldAutoTendQuality324(()=>.5)).toBe(225);
  expect(worldAutoTendQuality324(()=>0)).toBe(0);
  expect(worldAutoTendQuality324(()=>.999)).toBe(475);
  const record=()=>{const h=createMedicalRecord(0);addResolvedInjury(h,'torso','cut',5000,()=>.99);return h;};
  const a=record();expect(autoTendWorldPawn256(a,324,()=>.9)).toBe(1);expect(a.injuries[0]!.tended).toBe(425);
  const b=record();expect(autoTendWorldPawn256(b,323,()=>.9)).toBe(1);expect(b.injuries[0]!.tended).toBe(225);
});

test('a schema 323 save migrates to 324 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,323)))).toBe(current);
});
