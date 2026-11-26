import {afterEach,expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {TemperatureView,temperatureAt,reconcileTemperature} from '../src/sim/temperature.ts';
import {createAnimalAirReader466} from '../src/sim/animal-thermal-air-v466.ts';
import {animalCarrier,animalCarriedOrClaimed,animalClaimed,pawnServesAnimal,createAnimalServiceReadPass379} from '../src/sim/animal-rest-state.ts';
import {animalById379} from '../src/sim/animal-identity-directory-379.ts';
import {foodRouting379} from '../src/sim/animal-food-routing-379.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';
import type {AnimalFood} from '../src/sim/wildlife-food.ts';
import type {Pawn,World} from '../src/sim/types.ts';
import type {ThermalLayout} from '../src/sim/thermal-topology.ts';

afterEach(()=>{setTerrainWriteCacheVerification(false);vi.restoreAllMocks();});
const animal=(id:number):WildAnimal=>({id,species:'hare',sex:'male',ageTicks:1000,x:4,z:4,food:.5,rest:.5,state:'idle',path:[],nextDecision:1});
function fixture():World {
 const world=createWorld(379,16,16);world.wildlife={profile:'temperate-hares-v1',rng:1,animals:[animal(20000),animal(20001),animal(20002),animal(20003)],eatenPlants:0,eatenNutrition:0,eatenItems:0};
 return world;
}

test('thermal ownership is shared while snapshot temperatures and live animal air retain their distinct timelines',()=>{
 const world=fixture(),owner={},cells=[68,69],other=[69,70];world.thermal={regions:[{cells,temperature:41},{cells:other,temperature:73}]};
 const iter=vi.spyOn(cells,Symbol.iterator),b=world.wildlife!.animals[0]!;
 withJournalTerrainReadScope(owner,()=>{
  const snapshot=new TemperatureView(world),air=createAnimalAirReader466(world);
  expect(snapshot.at(world,{x:5,z:4})).toBe(73);expect(air.atCell({x:5,z:4})).toBe(73);
  for(let i=0;i<25;i++){world.thermal!.regions[1]!.temperature=74+i;expect(new TemperatureView(world).at(world,{x:5,z:4})).toBe(74+i);expect(air.atCell({x:5,z:4})).toBe(74+i);}
  expect(snapshot.at(world,{x:5,z:4})).toBe(73);expect(iter).toHaveBeenCalledTimes(1);
  world.thermal={regions:[{cells,temperature:17},{cells:other,temperature:23}]};expect(air.atCell({x:5,z:4})).toBe(23);expect(iter).toHaveBeenCalledTimes(1);
  world.thermal={regions:[{cells:[68],temperature:-4}]};expect(air.atAnimal(b)).toBe(-4);
 });
 // The public constructor still observes edits to the same cell array.
 world.thermal!.regions[0]!.cells[0]=69;expect(new TemperatureView(world).at(world,{x:4,z:4})).toBe(temperatureAt(world,{x:4,z:4}));
});

test('closed thermal verification rejects an unobserved membership edit and malformed cell keys retain the public fallback',()=>{
 const world=fixture(),owner={};world.thermal={regions:[{cells:[68],temperature:41}]};
 withJournalTerrainReadScope(owner,()=>new TemperatureView(world));world.thermal.regions[0]!.cells[0]=69;setTerrainWriteCacheVerification(true);
 expect(()=>withJournalTerrainReadScope(owner,()=>new TemperatureView(world))).toThrow('Unobserved thermal cell ownership');
 setTerrainWriteCacheVerification(false);world.thermal={regions:[{cells:[.5],temperature:12}]};
 withJournalTerrainReadScope(owner,()=>{expect(new TemperatureView(world).at(world,{x:.5,z:0})).toBe(12);expect(createAnimalAirReader466(world).atCell({x:.5,z:0})).toBe(12);});
});

test('confirmed thermal geometry avoids repeated cell comparisons while new layouts and public edits still reconcile',()=>{
 const world=fixture(),owner={},cells=[68,69];world.thermal={regions:[{cells,temperature:41}]};
 const layout:ThermalLayout={rooms:[{cells:[68,69],unroofed:0,equalize:[]}],doors:[],indices:new Int32Array(world.width*world.height).fill(-1)};layout.indices[68]=layout.indices[69]=0;
 const compare=vi.spyOn(cells,'every');
 withJournalTerrainReadScope(owner,()=>{
  reconcileTemperature(world,layout);for(let i=0;i<30;i++){world.thermal!.regions[0]!.temperature=41+i;reconcileTemperature(world,layout);}
  expect(compare).toHaveBeenCalledTimes(1);expect(world.thermal!.regions[0]!.cells).toBe(cells);
  reconcileTemperature(world,{...layout});expect(compare).toHaveBeenCalledTimes(2);
 });
 cells[1]=70;const expected=structuredClone(world);reconcileTemperature(expected,layout);reconcileTemperature(world,layout);expect(world.thermal).toStrictEqual(expected.thermal);
});

test('animal service candidates preserve original carrier precedence and live releases without scanning unrelated owners',()=>{
 const world=fixture(),owner={},[a,b,c,d]=world.wildlife!.animals;
 while(world.pawns.length<5)world.pawns.push({...structuredClone(world.pawns[0]!),id:world.nextId++});
 const [rescuer,casket,release,carer,hunter]=world.pawns as [Pawn,Pawn,Pawn,Pawn,Pawn];
 rescuer.animalRescue={animalId:a!.id,spotId:1,phase:'carry'};
 casket.shipCasketTask277={casketId:2,action:'carry',patient:{kind:'animal',id:a!.id},phase:'carry',progressCore:0,lastWorkedAt:world.tick};
 release.animalHandling={kind:'release',animalId:b!.id,phase:'carry',progress:0} as NonNullable<Pawn['animalHandling']>;
 carer.animalCare={animalId:c!.id,phase:'approach'} as NonNullable<Pawn['animalCare']>;hunter.hunting={animalId:d!.id} as NonNullable<Pawn['hunting']>;
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope(owner,()=>{
  const services=createAnimalServiceReadPass379(world),compare=()=>{for(const a of world.wildlife!.animals){expect(services.carrier(a.id)).toBe(animalCarrier(world,a.id));expect(services.humanService(a.id)).toBe(world.pawns.some(p=>pawnServesAnimal(p,a.id)));expect(services.carriedOrClaimed(a.id)).toBe(animalCarriedOrClaimed(world,a.id));expect(services.claimed(a.id)).toBe(animalClaimed(world,a.id));}};
  compare();expect(services.carrier(a!.id)).toBe(casket);delete casket.shipCasketTask277;compare();expect(services.carrier(a!.id)).toBe(rescuer);
  delete rescuer.animalRescue;delete carer.animalCare;delete hunter.hunting;compare();
  carer.animalCare={animalId:29999,phase:'approach'} as NonNullable<Pawn['animalCare']>;
  expect(()=>services.humanService(29999)).toThrow('Animal service changed outside');
 });
});

test('closed animal identities retain first matching originals through append, splice and array replacement; public slots stay mutable',()=>{
 const world=fixture(),owner={},source=world.wildlife!.animals,a=source[0]!,added=animal(30000);
 withJournalTerrainReadScope(owner,()=>{
  expect(animalById379(world,a.id)).toBe(a);source.push(added);expect(animalById379(world,added.id)).toBe(added);
  source.splice(1,1);expect(animalById379(world,20001)).toBeUndefined();world.wildlife!.animals=source.slice().reverse();expect(animalById379(world,a.id)).toBe(a);
  world.wildlife!.animals.push({...a});expect(animalById379(world,a.id)).toBe(a);expect(animalById379(world,NaN)).toBeUndefined();
 });
 world.wildlife!.animals[world.wildlife!.animals.indexOf(a)]={...a,x:9};expect(animalById379(world,a.id)?.x).toBe(9);
});

test('food contact compilation preserves duplicate occurrence ties and preferred-source scores',()=>{
 const world={width:16,height:16},a={x:4,z:4},food:AnimalFood[]=[
  {id:1,kind:'plant',x:0,z:0,quantity:1},{id:2,kind:'plant',x:5,z:4,quantity:1},
  {id:3,kind:'pile',x:5,z:5,quantity:2,preference:7},{id:4,kind:'pile',x:5,z:5,quantity:3,preference:7},
  {id:5,kind:'pile',x:12,z:12,quantity:4,preference:100},
 ];
 const route=foodRouting379(world,a,food);expect(route.goals).toHaveLength(food.length*5);
 expect(route.goals.slice(0,5)).toStrictEqual([{x:0,z:0},{x:-1,z:0},{x:1,z:0},{x:0,z:-1},{x:0,z:1}]);
 for(const goal of route.goals)if(goal.x>=0&&goal.z>=0&&goal.x<16&&goal.z<16){
  const adjacent=food.filter(f=>Math.abs(f.x-goal.x)+Math.abs(f.z-goal.z)<=1),score=(f:AnimalFood)=>Math.abs(a.x-f.x)+Math.abs(a.z-f.z)-(f.preference??0);
  expect(route.rank!(goal)).toBe(Math.min(...adjacent.map(score)));expect(route.target(goal)).toBe(adjacent.sort((a,b)=>score(a)-score(b))[0]);
 }
 expect(route.target({x:5,z:5})!.id).toBe(3);
 const historical=foodRouting379(world,a,food.slice(0,2));expect(historical.rank).toBeUndefined();expect(historical.target({x:4,z:4})!.id).toBe(2);
});
