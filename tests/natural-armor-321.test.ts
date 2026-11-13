import {expect,test} from 'vitest';
import {naturalArmor321,naturalArmorProtection321} from '../src/sim/natural-armor-321.ts';
import {damageAnimalWithBullet} from '../src/sim/wildlife-health.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {animalCombatCamp} from './scenarios/animal-combat.ts';
import {asOldSchema} from './scenarios/old-schema.ts';

test('tortoises and cave insects carry their Core natural armor; ordinary animals none',()=>{
  expect(naturalArmor321({species:'tortoise'} as never)).toEqual({sharp:.5,blunt:.35});
  expect(naturalArmor321({species:'megascarab'} as never)).toEqual({sharp:.72,blunt:.18});
  expect(naturalArmor321({species:'megaspider'} as never)).toEqual({sharp:.27,blunt:.18});
  expect(naturalArmor321({species:'spelopede'} as never)).toEqual({sharp:.18,blunt:.18});
  expect(naturalArmor321({species:'grizzly-bear'} as never)).toBeUndefined();
});

test('the natural armor roll deflects, halves or lets the hit through like worn armor',()=>{
  const armor={sharp:.72,blunt:.18},draws=(...v:number[])=>()=>v.shift()!;
  // Revolver bullet (penetration 0.18): effective 0.54.
  expect(naturalArmorProtection321(armor,'sharp',.18,draws(.2))('torso' as never,12)).toEqual({amount:0,converted:false});
  expect(naturalArmorProtection321(armor,'sharp',.18,draws(.4,.9))('torso' as never,12)).toEqual({amount:6,converted:true});
  expect(naturalArmorProtection321(armor,'sharp',.18,draws(.6))('torso' as never,12)).toEqual({amount:12,converted:false});
  // A penetration at or above the rating draws nothing.
  const none:number[]=[];expect(naturalArmorProtection321(armor,'blunt',.2,()=>{none.push(1);return .1;})('torso' as never,9)).toEqual({amount:9,converted:false});
  expect(none).toEqual([]);
});

test('an ordinary animal keeps its exact random draws when shot',()=>{
  const w=animalCombatCamp(),a=w.wildlife!.animals[0]!,copy=animalCombatCamp(),b=copy.wildlife!.animals[0]!;
  damageAnimalWithBullet(w,a,{part:'left-ear',damage:3,armorPenetration:.18},w.tick*10);
  damageAnimalWithBullet(copy,b,{part:'left-ear',damage:3},copy.tick*10);
  expect(w.rng).toBe(copy.rng);expect(a.health).toEqual(b.health);
});

test('a schema 320 save migrates to 321 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,320)))).toBe(current);
});
