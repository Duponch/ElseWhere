import {expect,test} from 'vitest';
import {animalHaulingCamp459} from './scenarios/animal-hauling-v459.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {serializeWorld} from '../src/sim/serialization.ts';
import {constructFreshInitialWildAnimal256} from '../src/sim/initial-animal-constructor-256.ts';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {setAnimalTrainingWanted282,nextTrainable282,completeAnimalTraining282,advanceAnimalTraining282,animalCarryLimit282} from '../src/sim/animal-training-282.ts';
import {createAnimalHaulingPass282,interruptAnimalHaul282} from '../src/sim/animal-hauling-282.ts';
import {reservedSource,reservedSourcesByPile,refreshStock,addMaterial} from '../src/sim/materials.ts';
import {haulReservations} from '../src/sim/haul-reservations.ts';
import {storageCapacity,createGroundCapacityReader} from '../src/sim/ground-placement.ts';
import {animalNavigation} from '../src/sim/wildlife-navigation.ts';
import {readyAnimalHaulDoorEntry282} from '../src/sim/doors.ts';
import {newDoorState,doorMotionTicks,doorOpenness} from '../src/sim/door-rules.ts';
import {TAMENESS_DECAY} from '../src/sim/animal-handling.ts';
import type {AnimalStorageHaul282} from '../src/sim/animal-hauling-state-282.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';
import type {MaterialPile,Structure,World} from '../src/sim/types.ts';

type Camp459=ReturnType<typeof animalHaulingCamp459>;
const must=<T>(value:T|undefined,message:string):T=>{if(value===undefined)throw Error(message);return value;};
const wood=(f:Camp459)=>must(f.world.piles.find(p=>p.id===f.woodId),'Declared wood is missing');

/** These are bounded transaction tests, not a played training/clinical-age
 * campaign. Skill preparation calls the actual tracker helpers on authored
 * scalar clocks; no service, food acquisition or animal walking is claimed.
 * The separate engine scenario proves the real lessons and movement. */
function prepareUnitHauler(f:Camp459,a:WildAnimal=f.animal):void {
 expect(setAnimalTrainingWanted282(f.world,a.id,'haul',true)).toMatchObject({ok:true});
 for(const skill of ['obedience','haul'] as const)for(let i=0;i<(skill==='obedience'?3:7);i++){
  if(a.training!.lastAttemptCore!==undefined)f.world.tick=Math.max(f.world.tick,Math.ceil((a.training!.lastAttemptCore+15000)/10));
  advanceAnimalTraining282(f.world,a);
  expect(nextTrainable282(f.world,a)).toBe(skill);
  expect(completeAnimalTraining282(f.world,a,skill,true,f.handler.id)).toBe(true);
 }
}
/** A second original continues the actual first constructor frontier. It is
 * neither a cloned animal identity nor a restarted/reseeded generation draw. */
function secondOriginal(f:Camp459):WildAnimal {
 const w=f.world,random=WorldGenerationRandom.fromState(f.preparation.constructorState);
 const made=constructFreshInitialWildAnimal256({fact:INITIAL_ANIMAL_FACTS_256.LabradorRetriever,
  id:w.nextId,cell:{x:13,z:12},tick:w.tick,random});
 if(made.status!=='ready')throw Error('Second original constructor refused without retry: '+made.reason);
 const a=made.animal;w.nextId++;
 a.domestic={since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+TAMENESS_DECAY};
 w.wildlife!.animals.push(a);return a;
}
function pickup(w:World,source:MaterialPile,stockpileId:number,quantity:number):AnimalStorageHaul282 {
 return {sourcePileId:source.id,quantity,phase:'pickup',destination:{type:'stockpile',stockpileId},carryPileId:null,startedAtCore:w.tick*10};
}
function sharedClaims(){
 const f=animalHaulingCamp459(),a2=secondOriginal(f),p=wood(f),zone=f.world.stockpiles[0]!;
 zone.capacity=20;zone.filters={wood:true,food:false};
 f.handler.haul=pickup(f.world,p,zone.id,7);a2.haul=pickup(f.world,p,zone.id,4);
 return {...f,a2,source:p,zone};
}

test('human and two original animals share source reservations and self-exclusion without taking or inventing goods',()=>{
 const f=sharedClaims(),{world:w,animal:a,a2,handler:p,source,zone}=f;
 a.haul=pickup(w,source,zone.id,6);
 expect(new Set([p.id,a.id,a2.id]).size).toBe(3);
 expect(w.wildlife!.animals).toEqual([a,a2]);expect(reservedSource(w,source.id)).toBe(17);
 expect(reservedSourcesByPile(w).get(source.id)).toBe(17);
 expect(reservedSource(w,source.id,a.id)).toBe(11);expect(reservedSourcesByPile(w,a.id).get(source.id)).toBe(11);
 expect(reservedSource(w,source.id,p.id)).toBe(10);expect(reservedSource(w,source.id,a2.id)).toBe(13);
 expect(haulReservations(w)).toEqual([p.haul,a.haul,a2.haul]);
 expect(haulReservations(w,a.id)).toEqual([p.haul,a2.haul]);
 expect(source.quantity).toBe(20);expect(source.owner).toEqual({type:'ground',x:8,z:15});
 expect(w.piles.filter(q=>q.item==='wood')).toEqual([source]);
});

test('destination capacity accounts for the same human and both animals, and holding reserves neither source nor destination',()=>{
 const f=sharedClaims(),{world:w,animal:a,a2,handler:p,source,zone}=f;
 a.haul=pickup(w,source,zone.id,6);
 expect(storageCapacity(w,zone,source)).toBe(3);
 expect(storageCapacity(w,zone,source,a.id)).toBe(9);
 expect(storageCapacity(w,zone,source,p.id)).toBe(10);
 expect(storageCapacity(w,zone,source,a2.id)).toBe(7);
 const facts=createGroundCapacityReader(w),claims=facts.reservations.get(zone.z*w.width+zone.x)!;
 expect(claims.map(c=>[c.pawnId,c.quantity])).toEqual([[p.id,7],[a.id,6],[a2.id,4]]);
 // The held pile is real inventory property; a failed Near cleanup grants no
 // ongoing reservation on the old source or on a storage cell.
 source.quantity-=6;const held:MaterialPile={...source,id:w.nextId++,quantity:6,owner:{type:'inventory',pawnId:a.id}};
 w.piles.push(held);a.haul={phase:'holding',carryPileId:held.id,sinceCore:w.tick*10};refreshStock(w);
 expect(reservedSource(w,source.id)).toBe(11);expect(storageCapacity(w,zone,source)).toBe(9);
 expect(haulReservations(w)).toEqual([p.haul,a2.haul]);
 expect(createGroundCapacityReader(w).reservations.get(zone.z*w.width+zone.x)!.map(c=>c.pawnId)).toEqual([p.id,a2.id]);
});

test('autonomous admission takes only the nine unreserved units fitting storage, on one frontier per real opportunity',()=>{
 const f=sharedClaims(),{world:w,animal:a,source,zone}=f;prepareUnitHauler(f);
 // Only this ordinary wood cell is eligible in the authored transaction.
 for(const z of w.stockpiles)if(z.id!==zone.id)z.filters={wood:false,food:false};
 const beforeRng=w.rng,beforeWildRng=w.wildlife!.rng,pass=createAnimalHaulingPass282(w);let calls=0,started=false;
 // Follow the fixed node's successive native-length opportunities, retaining
 // failed checks; no seed search, rewind or health/gameplay RNG replacement.
 for(let opportunity=0;opportunity<32&&!started;opportunity++){
  if(opportunity)w.tick+=250;
  const beforeCalls=calls;
  started=pass.start(a,animalNavigation(w),()=>{calls++;return true;});
  expect(calls-beforeCalls).toBe(1);expect(a.training!.lastHaulCheckCore).toBe(w.tick*10);
  if(!started){const oldCalls=calls;expect(pass.start(a,animalNavigation(w),()=>{calls++;return true;})).toBe(false);expect(calls).toBe(oldCalls);}
 }
 expect(started).toBe(true);expect(a.haul).toMatchObject({phase:'pickup',sourcePileId:source.id,quantity:9,destination:{type:'stockpile',stockpileId:zone.id}});
 expect(reservedSource(w,source.id)).toBe(20);expect(storageCapacity(w,zone,source)).toBe(0);
 expect(source.quantity).toBe(20);expect(w.rng).toBe(beforeRng);expect(w.wildlife!.rng).toBe(beforeWildRng);
});

test('split pickup and deposit preserve condition and total quantity while releasing only the completed animal claims',()=>{
 const f=sharedClaims(),{world:w,animal:a,source,zone}=f;prepareUnitHauler(f);
 source.damage=4;a.haul=pickup(w,source,zone.id,6);a.x=8;a.z=15;a.path=[];
 const originalNextId=w.nextId,pass=createAnimalHaulingPass282(w);
 expect(pass.process(a,animalNavigation(w),()=>true,()=>{throw Error('Already on source: no movement should run');})).toBe(true);
 expect(source.quantity).toBe(14);expect(source.damage).toBe(4);expect(a.haul).toMatchObject({phase:'deliver',carryPileId:originalNextId,quantity:6,pickupCell:{x:8,z:15}});
 const carry=must(w.piles.find(q=>q.id===originalNextId),'Physical split missing');
 expect(carry).toMatchObject({quantity:6,damage:4,owner:{type:'inventory',pawnId:a.id}});
 expect(reservedSource(w,source.id)).toBe(11);expect(storageCapacity(w,zone,source)).toBe(3);
 // Authored arrival at the existing destination, not a claim of walking.
 a.x=zone.x;a.z=zone.z;w.tick+=3;
 expect(pass.process(a,animalNavigation(w),()=>true,()=>{throw Error('Already on destination');})).toBe(true);
 expect(a.haul).toBeUndefined();expect(carry.id).toBe(originalNextId);
 expect(carry).toMatchObject({quantity:6,damage:4,owner:{type:'ground',x:zone.x,z:zone.z}});
 expect(w.piles.filter(q=>q.item==='wood').reduce((n,q)=>n+q.quantity,0)).toBe(20);
 expect(reservedSource(w,source.id)).toBe(11);expect(storageCapacity(w,zone,source)).toBe(3);
 expect(w.nextId).toBe(originalNextId+1);
});

test.each([378,379])('schema %i pickup rechecks current volume and preserves every original unit',version=>{
 for(const item of ['wood','silver'] as const){
  const f=animalHaulingCamp459();if(version===378){f.world=JSON.parse(asOldSchema(serializeWorld(f.world),version)) as World;f.handler=f.world.pawns[0]!;}const w=f.world,a=w.wildlife!.animals[0]!;prepareUnitHauler(f,a);
  const source=wood(f),zone=w.stockpiles[0]!;
  // Explicit initial transaction input, never newly manufactured by Haul.
  source.kind=item;source.item=item;source.quantity=57;zone.filters={wood:false,food:false,[item]:true};zone.capacity=500;
  a.x=8;a.z=15;a.path=[];a.haul=pickup(w,source,zone.id,57);
  const beforeId=w.nextId,result=createAnimalHaulingPass282(w).process(a,animalNavigation(w),()=>true,()=>{throw Error('OnCell pickup should not move');});
  if(item==='wood'&&version<379){
   expect(animalCarryLimit282(a,item)).toBe(56);expect(result).toBe(false);expect(a.haul).toBeUndefined();
   expect(source.owner).toEqual({type:'ground',x:8,z:15});
  }else if(item==='silver'){
   expect(animalCarryLimit282(a,item)).toBe(500);expect(result).toBe(true);expect(a.haul).toMatchObject({phase:'deliver',carryPileId:source.id,quantity:57});
   expect(source.owner).toEqual({type:'inventory',pawnId:a.id});
  }else{
   expect(result).toBe(true);expect(a.haul).toMatchObject({phase:'deliver',carryPileId:beforeId,quantity:56});
   expect(source).toMatchObject({quantity:1,owner:{type:'ground',x:8,z:15}});
   const carry=w.piles.find(p=>p.id===beforeId)!;expect(carry).toMatchObject({quantity:56,owner:{type:'inventory',pawnId:a.id}});
   expect(w.nextId).toBe(beforeId+1);expect(reservedSource(w,source.id)).toBe(0);
  }
  expect(w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0)).toBe(57);
  if(item==='silver'||version<379){expect(source.quantity).toBe(57);expect(w.nextId).toBe(beforeId);}
 }
});

test('interruption preserves an engaged edge and failed Near contents, then recovers the same physical pile without old claims',()=>{
 const f=animalHaulingCamp459(),{world:w,animal:a}=f;prepareUnitHauler(f);
 const source=wood(f),zone=w.stockpiles[0]!,started=w.tick;
 source.owner={type:'inventory',pawnId:a.id};a.haul={...pickup(w,source,zone.id,20),phase:'deliver',carryPileId:source.id,pickupCell:{x:8,z:15}};
 a.x=13;a.z=12;a.state='moving';a.path=[{x:14,z:12}];
 a.motion={from:{x:12,z:12},to:{x:13,z:12},start:started,end:started+5};
 const segment=structuredClone(a.motion),beforeId=w.nextId;
 // A wholly blocked authored local placement domain forces honest holding;
 // it is not saved or claimed as a played geographical map.
 w.tiles=w.tiles.map(()=>({terrain:'water'}));
 interruptAnimalHaul282(w,a);
 expect(a.motion).toEqual(segment);expect(a.path).toEqual([]);
 expect(a.haul).toEqual({phase:'holding',carryPileId:source.id,sinceCore:started*10});
 expect(source.owner).toEqual({type:'inventory',pawnId:a.id});expect(source.quantity).toBe(20);
 expect(haulReservations(w)).toEqual([]);expect(reservedSource(w,source.id)).toBe(0);expect(storageCapacity(w,zone,source)).toBe(0);
 w.tick=started+25+(a.id%25-(started+25)%25+25)%25;
 const pass=createAnimalHaulingPass282(w);pass.recover(a);
 expect(a.haul?.phase).toBe('holding');expect(source.owner.type).toBe('inventory');
 w.tiles[a.z*w.width+a.x]={terrain:'grass'};pass.invalidate();pass.recover(a);
 expect(a.haul).toBeUndefined();expect(source.owner).toEqual({type:'ground',x:a.x,z:a.z});
 expect(w.piles.filter(q=>q.id===source.id)).toEqual([source]);expect(w.nextId).toBe(beforeId);
 expect(source.quantity).toBe(20);
});

test('Haul reaches the actual chunk cell with OnCell while full impassability still blocks its target',()=>{
 const f=animalHaulingCamp459(),{world:w,animal:a}=f;
 a.x=12;a.z=12;a.path=[];
 const target={x:13,z:12};addMaterial(w,'chunk',1,{type:'ground',...target},'granite-chunk');
 const nav=animalNavigation(w),search=nav.haulSearch(a);
 expect(nav.free(target)).toBe(false);expect(search.canReach(target)).toBe(true);
 expect(search.pathTo(target)?.at(-1)).toEqual(target);expect(nav.haulStep(a,target)).toBe(true);
 w.structures.push({id:w.nextId++,kind:'wall',material:'granite-blocks',...target,orientation:0,footprint:'standard'});
 const blocked=animalNavigation(w);
 expect(blocked.haulSearch(a).canReach(target)).toBe(false);expect(blocked.haulStep(a,target)).toBe(false);
});

test('a real domestic hauler plans a closed door but waits for its timed opening before physical entry; forbidden stays closed to it',()=>{
 const f=animalHaulingCamp459(),{world:w,animal:a}=f;
 a.x=12;a.z=12;a.path=[{x:13,z:12}];
 const target={x:13,z:12},door:Structure={id:w.nextId++,kind:'door',material:'wood',...target,orientation:0,footprint:'standard',door:newDoorState(w.tick)};
 w.structures.push(door);
 const before={x:a.x,z:a.z,path:structuredClone(a.path)},nav=animalNavigation(w);
 expect(nav.haulSearch(a).canReach(target)).toBe(true);expect(nav.haulStep(a,target)).toBe(false);
 expect(readyAnimalHaulDoorEntry282(w,a,target)).toBe(false);
 expect(door.door!.open).toBe(true);expect(doorOpenness(door,w.tick)).toBe(0);
 expect({x:a.x,z:a.z,path:a.path}).toEqual(before);expect(a.motion).toBeUndefined();
 w.tick+=Math.ceil(doorMotionTicks(door));
 expect(readyAnimalHaulDoorEntry282(w,a,target)).toBe(true);expect(doorOpenness(door,w.tick)).toBe(1);
 expect(animalNavigation(w).haulStep(a,target)).toBe(true);expect({x:a.x,z:a.z,path:a.path}).toEqual(before);
 door.door!.forbidden=true;
 expect(readyAnimalHaulDoorEntry282(w,a,target)).toBe(false);
 expect(animalNavigation(w).haulSearch(a).canReach(target)).toBe(false);
 expect(animalNavigation(w).haulStep(a,target)).toBe(false);
});
