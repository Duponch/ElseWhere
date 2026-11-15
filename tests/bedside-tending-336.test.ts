import {expect,test} from 'vitest';
import {medicalCamp,controlledInjury} from './scenarios/health.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';
import {asMigratedCurrent,asOldSchema} from './scenarios/old-schema.ts';
import {bedSlotCell} from '../src/sim/bed-slots.ts';
import {bedInteractionCells336} from '../src/sim/care-access.ts';
import {tendingProposal,tendingPlaceValid} from '../src/sim/tending.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {notifyColonistKidnapped336,notifyColonyLoss} from '../src/sim/colony-economy.ts';
import {adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {loseThreatAdaptationForColonistLoss} from '../src/sim/threat-points.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {isColonist} from '../src/sim/affiliation.ts';
import type {Pawn,World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
const reach=(w:World,p:Pawn)=>reachableCells(w,p,blockedCells(w),new Set());
function layInBed(w:World,p:Pawn,bedId:number){
  const bed=w.structures.find(b=>b.id===bedId)!,head=bedSlotCell(bed,0)!;
  Object.assign(p,{...head,path:[],moveCooldown:0,motion:null,bedId,bedSlot:0});
  controlledInjury(w,p,'left-leg',30000);controlledInjury(w,p,'right-leg',30000);controlledInjury(w,p,'torso',9000,'cut');
  p.need={kind:'sleep',phase:'sleep',bedId,target:head};
}

/** Found by the Atterrissage campaign (day 13): three beds side by side
 * against a wall, the middle patient bleeding in bed, and no cell beside the
 * head free; the colonist bled to death untended. Core tends from the first
 * free cell of the bed's order, here beyond the foot. */
test('a patient between two beds against a wall is tended from beyond the foot',()=>{
  const w=medicalCamp(3,32),[patient,doctor,neighbour]=w.pawns as [Pawn,Pawn,Pawn];
  // Beds head at z=10, foot at z=11 (orientation 0), walls behind the heads.
  const beds=[9,10,11].map(x=>fixtureBuilding(w,'bed',x,10));
  for(const x of [8,9,10,11,12])fixtureBuilding(w,'wall',x,9);
  fixtureBuilding(w,'wall',8,10);fixtureBuilding(w,'wall',12,10);
  layInBed(w,patient,beds[1]!.id);
  Object.assign(neighbour,{x:20,z:20});Object.assign(doctor,{x:10,z:15});doctor.priorities.doctor=1;
  const cells=bedInteractionCells336(w,patient)!;
  expect(cells[0]).toEqual({x:10,z:12}); // beyond the foot (Core 2*South)
  const proposal=tendingProposal(w,doctor,patient,reach(w,doctor));
  expect(proposal?.task.spot).toEqual({x:10,z:12});
  expect(tendingPlaceValid(w,doctor,patient,proposal!.task)).toBe(true);
  // Before 336 only the four cells beside the head count: none is free.
  setVersion(w,335);
  expect(tendingProposal(w,doctor,patient,reach(w,doctor))).toBeUndefined();
});

test('a free-standing bed is tended from beside the head first, then the foot side, then beyond',()=>{
  const w=medicalCamp(2,32),[patient,doctor]=w.pawns as [Pawn,Pawn];
  const bed=fixtureBuilding(w,'bed',15,15);layInBed(w,patient,bed.id);
  Object.assign(doctor,{x:5,z:5});
  const cells=bedInteractionCells336(w,patient)!;
  // West/east of the head, west/east of the foot, beyond the head and its corners, beyond the foot and its corners.
  expect(cells.slice(0,4)).toEqual([{x:14,z:15},{x:16,z:15},{x:14,z:16},{x:16,z:16}]);
  expect(cells.slice(4,7)).toEqual([{x:15,z:14},{x:14,z:14},{x:16,z:14}]);
  expect(cells.slice(7,10)).toEqual([{x:15,z:17},{x:14,z:17},{x:16,z:17}]);
  // A doctor standing at the foot's side is a valid place from 336.
  expect(tendingPlaceValid(w,doctor,patient,{patientId:patient.id,spot:{x:14,z:16},phase:'approach',progress:0})).toBe(true);
  setVersion(w,335);
  expect(tendingPlaceValid(w,doctor,patient,{patientId:patient.id,spot:{x:14,z:16},phase:'approach',progress:0})).toBe(false);
});

test('a kidnapped colonist costs the adaptation of a lost colonist from 336',()=>{
  const w=createScenarioWorld(42,32,'crashlanded');adoptColonyEconomy(w);
  const colonists=w.pawns.filter(isColonist),victim=colonists[0]!;
  w.economy!.adaptationDays=10;
  notifyColonyLoss(w,victim,'downed');expect(w.economy!.pendingLosses).toHaveLength(1);
  notifyColonistKidnapped336(w,victim);
  expect(w.economy!.pendingLosses).toBeUndefined(); // the fall is replaced by the loss
  expect(w.economy!.adaptationDays).toBeCloseTo(loseThreatAdaptationForColonistLoss(10,colonists.length-1),10);
  const old=createScenarioWorld(42,32,'crashlanded');adoptColonyEconomy(old);old.economy!.adaptationDays=10;setVersion(old,335);
  notifyColonistKidnapped336(old,old.pawns.find(isColonist)!);expect(old.economy!.adaptationDays).toBe(10);
});

test('a schema 335 save migrates to 336 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,335)))).toBe(asMigratedCurrent(current));
});
