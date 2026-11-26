import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Pawn,Resource,World} from '../src/sim/types';
import type {WildAnimal} from '../src/sim/wildlife-state';
import {animalMealTarget,finishAnimalMeal} from '../src/sim/wildlife-food';
import {captureResourceJournal,markResourceArrayChanged,markResourceChanged,invalidateResourceJournal} from '../src/sim/resource-mutation-journal';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {reservedServiceCells,withWildlifeServiceReservationCandidates379} from '../src/sim/service-reservations';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';

afterEach(()=>setTerrainWriteCacheVerification(false));
function mealFixture(){
 const w=createWorld(42,16,16);w.structures=[];w.jobs=[];w.piles=[];w.tiles=w.tiles.map(()=>({terrain:'grass'}));
 w.resources=Array.from({length:128},(_,i):Resource=>({id:w.nextId++,kind:'haygrass',x:3,z:2,amount:18,growth:.65,growthTick:w.tick}));
 const target=w.resources.at(-1)!,a:WildAnimal={id:w.nextId++,species:'hare',sex:'female',x:2,z:2,ageTicks:1000,food:.15,rest:1,state:'eating',path:[],nextDecision:w.tick,meal:{kind:'plant',id:target.id,quantity:1,progress:0}};
 w.wildlife={profile:'temperate-hares-v1',rng:1,animals:[a],eatenPlants:0,eatenNutrition:0,eatenItems:0};return {w,a,target};
}
test('active meals borrow exact producer identities without rescanning resource slots; public calls and revoked joins stay live',()=>{
 const {w,a,target}=mealFixture(),owner={};captureResourceJournal(w.resources);
 withJournalTerrainReadScope(owner,()=>expect(animalMealTarget(w,a)).toBe(target));
 const before=w.resources;let visits=0;
 w.resources=new Proxy(before,{get(rows,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))visits++;return Reflect.get(rows,key,receiver);}});
 withJournalTerrainReadScope(owner,()=>{
  markResourceArrayChanged(w,before,[],[]);visits=0;
  for(let i=0;i<32;i++)expect(animalMealTarget(w,a)).toBe(target);expect(visits).toBe(0);
  target.x=4;markResourceChanged(w,target);expect(animalMealTarget(w,a)?.x).toBe(4);expect(visits).toBe(0);
 });
 expect(animalMealTarget(w,a)).toBe(target);expect(visits).toBeGreaterThanOrEqual(128);
 const old=w.resources;w.resources=old.filter(r=>r!==target);
 withJournalTerrainReadScope(owner,()=>{markResourceArrayChanged(w,old,[],[target]);expect(animalMealTarget(w,a)).toBeUndefined();});
 w.resources=[target,{...target,x:9}];captureResourceJournal(w.resources);invalidateResourceJournal(w);
 withJournalTerrainReadScope(owner,()=>expect(animalMealTarget(w,a)).toBe(target));
});
test('resident meal identity reads conserve complete partial grazing, removal and RNG state against the public path',()=>{
 const source=mealFixture().w,run=(closed:boolean)=>{
  const w=structuredClone(source),a=w.wildlife!.animals[0]!,owner={};captureResourceJournal(w.resources);
  const act=()=>{finishAnimalMeal(w,a);const r=w.resources.at(-1)!;r.growth=.65;r.growthTick=w.tick;markResourceChanged(w,r);a.food=0;a.meal={kind:'plant',id:r.id,quantity:1,progress:0};finishAnimalMeal(w,a);};
  if(closed)withJournalTerrainReadScope(owner,act);else act();return w;
 };
 expect(run(true)).toStrictEqual(run(false));
});
function peopleFixture():World {
 const w=createWorld(92,16,16),base=w.pawns[0]!;w.structures=[];w.piles=[];
 w.pawns=Array.from({length:40},(_,i):Pawn=>({...structuredClone(base),id:w.nextId++,orders:{active:null,queue:[]},recreation:{...structuredClone(base.recreation),task:null},need:null,cooking:null}));
 w.pawns[2]!.brewing={spot:{x:4,z:5}} as Pawn['brewing'];w.pawns[11]!.research={spot:{x:8,z:7}} as Pawn['research'];
 w.pawns[19]!.cooking={spot:{x:6,z:5}} as Pawn['cooking'];return w;
}
test('wildlife reservation candidates retain live task releases, insertion order, roster replacement and scope cleanup',()=>{
 const w=peopleFixture(),owner={},expectCurrent=()=>{const expected=reservedServiceCells({...w} as World);expect([...reservedServiceCells(w)]).toEqual([...expected]);};
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope(owner,()=>withWildlifeServiceReservationCandidates379(w,()=>{
  expectCurrent();delete w.pawns[2]!.brewing;w.pawns[11]!.research=undefined;expectCurrent();
  w.pawns[19]!.cooking=null;expectCurrent();
  const added={...structuredClone(w.pawns[0]!),id:w.nextId++,brewing:{spot:{x:10,z:9}} as Pawn['brewing']};w.pawns=w.pawns.concat(added);expectCurrent();
  expect(()=>withWildlifeServiceReservationCandidates379({...w},()=>{throw Error('scope sentinel');})).toThrow('scope sentinel');expectCurrent();
 }));
 w.pawns[0]!.brewing={spot:{x:1,z:2}} as Pawn['brewing'];expectCurrent();
});
test('a wildlife reservation read revisits possible owners rather than every unrelated human',()=>{
 const w=peopleFixture(),owner={},bystander=w.pawns[0]!;let reads=0;
 Object.defineProperty(bystander,'need',{configurable:true,enumerable:true,get(){reads++;return null;}});
 withJournalTerrainReadScope(owner,()=>withWildlifeServiceReservationCandidates379(w,()=>{
  const expected=[...reservedServiceCells(w)];reads=0;
  for(let i=0;i<24;i++)expect([...reservedServiceCells(w)]).toEqual(expected);expect(reads).toBe(0);
 }));
 reservedServiceCells(w);expect(reads).toBeGreaterThan(0);
});
