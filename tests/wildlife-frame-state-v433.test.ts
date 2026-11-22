import {expect,test} from 'vitest';
import {InstancedBufferAttribute,type Mesh,type InstancedBufferGeometry} from 'three/webgpu';
import {animalStageDrawScale} from '../src/render/animal-stage-scale';
import {WildlifeBodyScale,WildlifeFrameState} from '../src/render/wildlife-frame-state';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {ANIMAL_SPECIES_IDS,animalSpecies} from '../src/sim/animal-species';
import {adultAgeTicks,bodySizeAtAge,juvenileAgeTicks} from '../src/sim/animal-life';
import {isAnimalSpecies256} from '../src/sim/animal-core-v256';
import {localTimeSeconds} from '../src/bridge/clock-rate';
import {animalCombatCamp} from './scenarios/animal-combat';

// Since the 22 November feedback the drawn scale follows Core's life-stage drawSize (animal-stage-scale.ts).
test('derived animal scale follows in-place species, age and growth writes without changing inputs',()=>{
 const cache=new WildlifeBodyScale(),owner={species:ANIMAL_SPECIES_IDS[0]! as (typeof ANIMAL_SPECIES_IDS)[number],ageTicks:0,growthTracker:undefined as {value:number}|undefined};
 for(const species of ANIMAL_SPECIES_IDS){owner.species=species;
  for(const age of [0,juvenileAgeTicks(species)-1,juvenileAgeTicks(species),adultAgeTicks(species)-1,adultAgeTicks(species)]){
   owner.ageTicks=age;owner.growthTracker=undefined;const before=structuredClone(owner),expected=animalStageDrawScale(species,age);
   expect(cache.read(owner)).toBe(expected);expect(cache.read(owner)).toBe(expected);expect(owner).toEqual(before);
  }
  if(isAnimalSpecies256(species)){owner.growthTracker={value:0};for(const value of [0,.25,.75,1,.25]){owner.growthTracker.value=value;expect(cache.read(owner)).toBe(animalStageDrawScale(species,owner.ageTicks,value));}}
 }
});

test('carried frame capture rereads mutable streams, clears changed tails and distinguishes owner paths',()=>{
 const state=new WildlifeFrameState(),stream=new InstancedBufferAttribute(new Float32Array([1,2,3,4]),4);
 const carried=()=>state.begin(7,1).value(1024).value(true).value(1030).value(1032).stream(stream,0).unchanged();
 expect(carried()).toBe(false);expect(carried()).toBe(true);
 stream.setZ(0,9);expect(carried()).toBe(false);expect(carried()).toBe(true);
 expect(state.begin(7,2).value(1024).value(true).value(1030).value(1032).stream(stream,0).unchanged()).toBe(false);
 expect(carried()).toBe(false);expect(carried()).toBe(true);
 expect(state.begin(7,1).value(1024).value(true).value(1030).value(1032).stream(undefined,0).unchanged()).toBe(false);
 expect(carried()).toBe(false);expect(carried()).toBe(true);state.clear();expect(carried()).toBe(false);
 // Preserve the previous string-key numeric equivalences.
 expect(state.begin(8,0).value(NaN).value(-0).unchanged()).toBe(false);
 expect(state.begin(8,0).value(NaN).value(0).unchanged()).toBe(true);
});

test('real resident wildlife preserves streams between edges and observes mutable growth and same-tick adoption',()=>{
 const world=animalCombatCamp(),animal=world.wildlife!.animals[0]!;world.wildlife!.animals=[animal];world.piles=[];world.tick=101;
 const edge={from:{x:10,z:10},to:{x:11,z:10},start:100,end:104};Object.assign(animal,{x:11,z:10,state:'moving',motion:edge,ageTicks:adultAgeTicks(animal.species)});delete animal.growthTracker;
 const timeline=new MotionTimeline();timeline.tick=101;timeline.tracks.set(animal.id,[edge]);const layer=new WildlifeLayer();
 try{
  layer.update(world,timeline,true);const mesh=layer.mesh.children.find(m=>m.name===`Wild ${animal.species} — GPU rig`) as Mesh<InstancedBufferGeometry>;
  const g=mesh.geometry,travel=g.getAttribute('aTravel'),state=g.getAttribute('aAnimal'),scale=g.getAttribute('aScale');
  const stream=()=>['aFrom','aTo','aTravel','aAnimal','aScale','aBodyBlood','aAbsent','aCarrier','aCorpseHandoff','aCorpseFrom','aCorpseTo'].map(name=>{const a=g.getAttribute(name);return Array.from({length:a.itemSize},(_,i)=>a.getComponent(0,i));});
  const initial=stream(),version='data'in state?state.data.version:state.version,before=JSON.stringify(world);
  for(const tick of [101,101.5,103.99]){timeline.tick=tick;layer.update(world,timeline);expect(stream()).toEqual(initial);expect('data'in state?state.data.version:state.version).toBe(version);}
  expect(JSON.stringify(world)).toBe(before);expect(state.getX(0)).toBe(1);
  timeline.tick=104;layer.update(world,timeline);expect(state.getX(0)).toBe(0);expect(travel.getX(0)).toBeCloseTo(localTimeSeconds(100));
  animal.ageTicks=0;layer.update(world,timeline);expect(scale.getX(0)).toBe(Math.fround(bodySizeAtAge(animal.species,0)/animalSpecies(animal.species).bodySize));
  animal.ageTicks=adultAgeTicks(animal.species);layer.update(world,timeline);expect(scale.getX(0)).toBe(1);
  const adopted=structuredClone(world);adopted.wildlife!.animals[0]!.state='sleeping';delete adopted.wildlife!.animals[0]!.motion;timeline.tracks.clear();
  layer.update(adopted,timeline);expect(state.getZ(0)).toBe(1);expect(state.getX(0)).toBe(0);expect(mesh.geometry).toBe(g);
 }finally{layer.dispose();}
});
