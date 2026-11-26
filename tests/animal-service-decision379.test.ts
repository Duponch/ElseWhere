import {afterEach,expect,it} from 'vitest';
import {animalClaimed,animalCarrier,animalCarriedOrClaimed} from '../src/sim/animal-rest-state';
import {beginSourceReservationCandidates379,animalServiceDecisionCandidates379} from '../src/sim/source-reservation-candidates-379';
import {createAnimalSpotRead379,animalSpotAvailable} from '../src/sim/animal-rest';
import {captureActorBeds256} from '../src/sim/actor-bed-local-256';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {createWorld} from '../src/sim/engine';
import {animalHaulingCamp459} from './scenarios/animal-hauling-v459';
import {fixtureBuilding} from './scenarios/deconstruction';
import type {Pawn} from '../src/sim/types';

afterEach(()=>setTerrainWriteCacheVerification(false));

it('animal service candidate scope enrolls the active turn before any task starts, observes releases and preserves carrier precedence',()=>{
 const w=createWorld(379,16,16),[first,second,third]=w.pawns;expect(first&&second&&third).toBeTruthy();const id=987654;
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope({},()=>{const scope=beginSourceReservationCandidates379(w);try{
  scope.human(first!);expect(animalServiceDecisionCandidates379(w)).toEqual([first]);expect(animalClaimed(w,id)).toBe(false);
  first!.animalRescue={animalId:id,spotId:1,phase:'carry'};expect(animalCarrier(w,id)).toBe(first);expect(animalClaimed(w,id,first!.id)).toBe(false);expect(animalCarriedOrClaimed(w,id)).toBe(true);
  scope.human(second!);second!.shipCasketTask277={casketId:2,action:'carry',patient:{kind:'animal',id},phase:'carry',progressCore:0,lastWorkedAt:w.tick};
  expect(animalCarrier(w,id)).toBe(second);expect(animalClaimed(w,id,first!.id)).toBe(true);delete second!.shipCasketTask277;expect(animalCarrier(w,id)).toBe(first);
  scope.human(third!);expect(animalServiceDecisionCandidates379(w)).toEqual([first,third]);delete first!.animalRescue;expect(animalCarrier(w,id)).toBeUndefined();expect(animalClaimed(w,id)).toBe(false);
  third!.animalHandling={animalId:id,kind:'lead',phase:'interact',ropees:[id+1],gatherId:id+2} as NonNullable<Pawn['animalHandling']>;
  expect(animalClaimed(w,id+1)).toBe(true);expect(animalClaimed(w,id+2)).toBe(true);
  second!.animalRescue={animalId:id+3,spotId:1,phase:'carry'};
  expect(()=>animalClaimed(w,id+3)).toThrow('Source reservation ownership changed outside');delete second!.animalRescue;
 }finally{scope.close();}});
 expect(animalServiceDecisionCandidates379(w)).toBeUndefined();
 second!.animalRescue={animalId:id+3,spotId:1,phase:'carry'};expect(animalCarrier(w,id+3)).toBe(second);
});

it('a local spot read shares current bed/occupant identities and observes a released alias while preserving the physical bed capture',()=>{
 const f=animalHaulingCamp459(),w=f.world,a=f.animal,original=w.structures.find(s=>s.id===f.spotId)!;
 const second=fixtureBuilding(w,'animal-sleeping-spot',4,4),other=structuredClone(a);other.id=w.nextId++;other.x=second.x;other.z=second.z;
 other.domestic!.bedId=second.id;other.animalRest={spotId:second.id,phase:'sleep'};other.state='sleeping';w.wildlife!.animals.push(other);
 const before=captureActorBeds256(w);setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope({},()=>{
  const after=captureActorBeds256(w);expect(after.refs).toEqual(before.refs);expect(after.actors).toEqual(before.actors);
  const read=createAnimalSpotRead379(w),testSpots=()=>{for(const spot of [original,second])expect(animalSpotAvailable(w,spot,a,undefined,undefined,read)).toBe(animalSpotAvailable(w,spot,a));};
  testSpots();testSpots();expect(read.claimed(second,a)).toBe(true);expect(read.foreignBed(second,a)).toBe(true);expect(read.occupiedAnimal(second,a)).toBe(true);
  delete other.animalRest;delete other.domestic!.bedId;expect(read.claimed(second,a)).toBe(false);expect(read.foreignBed(second,a)).toBe(false);expect(read.occupiedAnimal(second,a)).toBe(true);testSpots();
 });
});
