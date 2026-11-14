import {expect,test} from 'vitest';
import {animalCombatCamp} from './scenarios/animal-combat.ts';
import {beginAnimalEggLay256,initializeAnimalEggLayer256} from '../src/sim/animal-egg-local-v256.ts';
import {validAnimalEggState256} from '../src/sim/animal-egg-save-v256.ts';
import {adultAgeTicks} from '../src/sim/animal-life.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';

/** Found by the Atterrissage campaign (day 12.6): a duck already standing on
 * its laying cell got a route of zero steps, and the lay job copied the whole
 * animal record into its target. The save stopped validating. */
test('an animal laying where it stands targets its own cell, and its save stays valid',()=>{
  const w=animalCombatCamp();w.piles=[];w.resources=[];w.structures=[];w.jobs=[];w.pawns=[];
  for(const t of w.tiles)t.terrain='soil';
  const a=w.wildlife!.animals[0]!;w.wildlife!.animals=[a];
  a.species='turkey';a.sex='female';a.ageTicks=adultAgeTicks('turkey');a.x=10;a.z=10;a.state='idle';a.path=[];delete a.motion;delete a.health;
  initializeAnimalEggLayer256(a);a.eggLayer!.progress=1;
  expect(beginAnimalEggLay256(w as World,a,()=>[])).toBe(true);
  expect(a.eggLay).toEqual({target:{x:10,z:10},progress:0});
  expect(validAnimalEggState256(a,SCHEMA_VERSION,w)).toBe(true);
});
