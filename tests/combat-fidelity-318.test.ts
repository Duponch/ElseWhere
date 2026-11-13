import {expect,test} from 'vitest';
import {damageAnimalWithBullet} from '../src/sim/wildlife-health.ts';
import {combatTargetSize} from '../src/sim/combat-target.ts';
import {animalBodySize} from '../src/sim/animal-life.ts';
import {applyMeleeStun,meleeStunCore318} from '../src/sim/stun.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {animalCombatCamp} from './scenarios/animal-combat.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};

test('a colony animal downed by violence is never killed by the downing roll; a wild one still may be',()=>{
  const wild=new Set<string>(),tame=new Set<string>();
  for(let seed=1;seed<70;seed++){
    const w=animalCombatCamp(),a=w.wildlife!.animals[0]!;w.rng=seed*70019;
    damageAnimalWithBullet(w,a,{part:'spine',damage:10},w.tick*10,w.pawns[0]);wild.add(a.state);
    const v=animalCombatCamp(),b=v.wildlife!.animals[0]!;v.rng=seed*70019;
    b.domestic={since:v.tick,care:'herbal',tameness:4,nextDecay:v.tick+1000} as never;
    damageAnimalWithBullet(v,b,{part:'spine',damage:10},v.tick*10,v.pawns[0]);tame.add(b.state);
  }
  expect([...wild].sort()).toEqual(['dead','downed']);
  expect([...tame]).toEqual(['downed']);
});

test('an animal is as large a target as its body, not a fixed 0.2',()=>{
  const w=animalCombatCamp(),a=w.wildlife!.animals[0]!;
  expect(combatTargetSize(a,318)).toBe(animalBodySize(a));
  expect(combatTargetSize(a,317)).toBe(.2);
  expect(combatTargetSize(w.pawns[0]!,318)).toBe(1);
});

test('a bullet staggers an animal only if its body is not larger than the stopping power',()=>{
  const w=animalCombatCamp(),a=w.wildlife!.animals[0]!;
  // The hare (body 0.2) is staggered by a revolver bullet (stopping power 1).
  damageAnimalWithBullet(w,a,{part:'left-ear',damage:1,stoppingPower:1},w.tick*10);
  expect(a.stagger).toBeDefined();
  // An arrow without stopping power does not stagger a body larger than it.
  const v=animalCombatCamp(),b=v.wildlife!.animals[0]!;
  damageAnimalWithBullet(v,b,{part:'left-ear',damage:1,stoppingPower:0},v.tick*10);
  expect(b.stagger).toBeUndefined();
  // Schema 317 always staggered.
  const o=animalCombatCamp(),c=o.wildlife!.animals[0]!;setVersion(o,317);
  damageAnimalWithBullet(o,c,{part:'left-ear',damage:1,stoppingPower:0},o.tick*10);
  expect(c.stagger).toBeDefined();
});

test('a blunt stun lasts 120 Core ticks (2 s), as Core Blunt bluntStunDuration',()=>{
  expect(meleeStunCore318(318)).toBe(120);expect(meleeStunCore318(317)).toBe(45);
  const w=createScenarioWorld(42,32,'crashlanded'),p=w.pawns[0]!,core=w.tick*10;
  applyMeleeStun(w,p,core);expect(p.stun).toEqual({sinceCore:core,untilCore:core+120});
});

test('a schema 317 save migrates to 318 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,317)))).toBe(current);
});
