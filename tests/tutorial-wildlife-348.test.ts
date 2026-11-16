import {expect,test} from 'vitest';
import {constructFreshInitialWildAnimal256} from '../src/sim/initial-animal-constructor-256.ts';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {commitScariaDeath261} from '../src/sim/animal-scaria-261.ts';
import {acceptableAnimalPrey,animalPreyCandidates} from '../src/sim/wildlife-predation.ts';
import {scariaRotChance347} from '../src/sim/game-profile.ts';
import {createWorld} from '../src/sim/index';
import {enableWildlife} from '../src/sim/wildlife.ts';
import type {World} from '../src/sim/types.ts';
import type {MedicalRecord} from '../src/sim/injury-types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

// Follow-ups of the tutorial profile (347) in the wildlife files of lot 348:
// Core's Easy scariaRotChance 0 and the tutorial's prey filter.
type Def=keyof typeof INITIAL_ANIMAL_FACTS_256;
function spawn(w:World,def:Def,x:number,z:number):WildAnimal|undefined {
  const made=constructFreshInitialWildAnimal256({fact:INITIAL_ANIMAL_FACTS_256[def],id:w.nextId,cell:{x,z},tick:w.tick,random:new WorldGenerationRandom(w.seed+w.nextId)});
  if(made.status!=='ready')return;
  w.nextId++;const a=made.animal;Object.assign(a,{state:'idle',path:[],nextDecision:w.tick+80});delete a.motion;w.wildlife!.animals.push(a);return a;
}
const profile=(w:World,storyteller:string,difficulty:string)=>{(w as {gameProfile?:unknown}).gameProfile={storyteller,difficulty};};

test('Easy scaria rot chance is 0 and spends no draw; Adventure Story keeps 0.333 and its draw',()=>{
  const w=createWorld(5,16,16);
  profile(w,'tutor','community-builder');expect(scariaRotChance347(w)).toBe(0);
  profile(w,'cassandra','adventure-story');expect(scariaRotChance347(w)).toBe(.333);
  const record=()=>({death:{tick:0},scaria261:{manhunterCore:0}}) as unknown as MedicalRecord;
  let draws=0;const draw=()=>{draws++;return 0;};
  const easy=record();commitScariaDeath261(easy,0,draw);
  expect(draws).toBe(0);expect(easy.scaria261!.deathRot).toBe(false);
  const medium=record();commitScariaDeath261(medium,.333,draw);
  expect(draws).toBe(1);expect(medium.scaria261!.deathRot).toBe(true);
});

test('in the tutorial a predator never takes a colony animal as prey; outside it still may',()=>{
  const w=createWorld(7,48,48);w.tiles=w.tiles.map(()=>({terrain:'grass'}));enableWildlife(w,0);w.wildlife!.animals=[];
  const wolf=spawn(w,'Wolf_Timber',10,10)!;
  let pet:WildAnimal|undefined;
  for(const def of Object.keys(INITIAL_ANIMAL_FACTS_256) as Def[]){
    const a=spawn(w,def,14,14);if(!a)continue;
    if(acceptableAnimalPrey(wolf,a)){pet=a;break;}
    w.wildlife!.animals.pop();
  }
  expect(pet,'a species the timber wolf may hunt').toBeDefined();
  pet!.domestic={since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+45000};
  profile(w,'cassandra','adventure-story');
  expect(animalPreyCandidates(w,wolf)).toContain(pet);
  profile(w,'tutor','community-builder');
  expect(animalPreyCandidates(w,wolf)).not.toContain(pet);
  delete pet!.domestic;
  expect(animalPreyCandidates(w,wolf)).toContain(pet);
});
