import {expect,test} from 'vitest';
import {applyCommand} from '../src/sim/engine';
import {queryOrderOptions} from '../src/sim/player-orders';
import {advanceGeneralQueue378,orderedQueueBusy378} from '../src/sim/ordered-queue-378';
import {patientClaimed} from '../src/sim/care-access';
import {rescueClaim} from '../src/sim/rescue-state';
import {rescueProposal,rescueReason} from '../src/sim/rescue';
import {feedingProposal} from '../src/sim/feeding';
import {feedingReason} from '../src/sim/feeding-rules';
import {tendingReason} from '../src/sim/tending';
import {equipmentReason,beginAutomaticEquipment} from '../src/sim/equipment';
import {apparelReason} from '../src/sim/apparel';
import {stripTargetClaimed351,stripOrderIntent351,stripProposal351} from '../src/sim/strip-351';
import {burialClaim,burialReason} from '../src/sim/burial';
import {captureReason} from '../src/sim/capture';
import {arrestReason} from '../src/sim/arrest';
import {blockedCells,reachableCells} from '../src/sim/pathfinding';
import {addMaterial} from '../src/sim/materials';
import {feedingCamp} from './scenarios/feeding';
import {rescueCamp} from './scenarios/rescue';
import {equipmentCamp} from './scenarios/equipment';
import {controlledInjury} from './scenarios/health';
import {prisonerUiFixture} from './scenarios/prison-camp';
import {arrestCamp} from './helpers/arrest-v278';
import type {Pawn,World} from '../src/sim/types';

const reach=(w:World,p:Pawn)=>reachableCells(w,p,blockedCells(w),new Set());
const ok=(w:World,c:Parameters<typeof applyCommand>[1])=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});

test.each(['melee','shot'] as const)('civilian care menu and direct command agree during %s recovery, but Shift may wait',kind=>{
  const w=feedingCamp(1),doctor=w.pawns[0]!,patient=w.pawns[1]!,core=w.tick*10;
  controlledInjury(w,patient,'left-arm',5000,'cut');
  const option=(queue=false)=>queryOrderOptions(w,doctor.id,patient,queue).find(o=>o.tendPatientId===patient.id);
  expect(option()?.enabled).toBe(true);
  // Bounded admission fixture: the real strike/cooldown owner remains present
  // after its attack order has ended. The campaign exercises a played strike.
  if(kind==='melee')doctor.melee={order:null,strike:{targetId:null,atCore:core-10,untilCore:core+35,tool:'left-fist',outcome:'hit'}};
  else doctor.shooting={order:null,stance:{phase:'cooldown',startedAtCore:core-10,endsAtCore:core+45}};
  const reason=kind==='melee'?'Le colon récupère après sa frappe.':'Le colon récupère après son tir.';
  const direct={type:'order-tend' as const,pawnId:doctor.id,patientId:patient.id,queue:false};
  expect(option()).toMatchObject({enabled:false,reason});
  expect(applyCommand(w,direct)).toMatchObject({ok:false,reason});
  expect(doctor.tend).toBeUndefined();const owner=structuredClone(kind==='melee'?doctor.melee:doctor.shooting);
  expect(option(true)?.enabled).toBe(true);
  ok(w,{...direct,queue:true});
  expect(doctor.orderedQueue378).toEqual([direct]);expect(doctor.tend).toBeUndefined();
  expect(orderedQueueBusy378(w,doctor)).toBe(true);
  expect(advanceGeneralQueue378(w,doctor,c=>applyCommand(w,c))).toBe(false);
  expect(kind==='melee'?doctor.melee:doctor.shooting).toEqual(owner);
  // Admission only: the existing recovery simulation owns removal of this
  // state. Once absent, the normal real care provider activates the same FIFO.
  delete doctor.melee;delete doctor.shooting;
  expect(option()?.enabled).toBe(true);
  expect(advanceGeneralQueue378(w,doctor,c=>applyCommand(w,c))).toBe(true);
  expect(doctor.tend?.patientId).toBe(patient.id);expect(doctor.orderedQueue378).toBeUndefined();
});

test('accepted future feeding protects that patient from automatic feeding and tending while allowing its actor',()=>{
  const w=feedingCamp(2),doctor=w.pawns[0]!,other=w.pawns[2]!,first=w.pawns[1]!,patient=w.pawns[3]!;
  controlledInjury(w,patient,'left-arm',5000,'cut');
  expect(feedingProposal(w,other,patient,reach(w,other))).toBeDefined();expect(tendingReason(w,other,patient)).toBeUndefined();
  ok(w,{type:'order-feed',pawnId:doctor.id,patientId:first.id,queue:false});
  ok(w,{type:'order-feed',pawnId:doctor.id,patientId:patient.id,queue:true});
  expect(doctor.orderedQueue378?.[0]?.type).toBe('order-feed');
  expect(patientClaimed(w,patient.id,other)).toBe(true);expect(patientClaimed(w,patient.id,doctor)).toBe(false);
  expect(feedingReason(w,other,patient)).toMatch(/réservé/);expect(tendingReason(w,other,patient)).toMatch(/réservé/);
  expect(feedingProposal(w,other,patient,reach(w,other))).toBeUndefined();expect(feedingReason(w,doctor,patient)).toBeUndefined();
  expect(patient.need?.kind).toBe('sleep');expect(other.feed).toBeUndefined();expect(other.tend).toBeUndefined();
});

test('accepted queued rescue keeps the original claimant and prevents a second automatic rescue',()=>{
  const w=rescueCamp(2),actor=w.pawns[0]!,other=w.pawns[2]!,first=w.pawns[1]!,patient=w.pawns[3]!;
  expect(rescueProposal(w,other,patient,reach(w,other))).toBeDefined();
  ok(w,{type:'order-rescue',pawnId:actor.id,patientId:first.id,queue:false});
  ok(w,{type:'order-rescue',pawnId:actor.id,patientId:patient.id,queue:true});
  expect(rescueClaim(w,patient.id,other.id)).toBe(actor);expect(rescueClaim(w,patient.id,actor.id)).toBeUndefined();
  expect(rescueReason(w,other,patient)).toMatch(/réservé/);expect(rescueProposal(w,other,patient,reach(w,other))).toBeUndefined();
  expect(rescueReason(w,actor,patient)).toBeUndefined();expect(other.rescue).toBeUndefined();
});

test('queued wear protects the real garment from automatic equipment without reserving same-id human targets',()=>{
  const w=equipmentCamp(),actor=w.pawns[0]!,other=w.pawns[1]!;
  addMaterial(w,'apparel',1,{type:'ground',x:14,z:5},'cloth-shirt');const garment=w.piles.at(-1)!;
  expect(apparelReason(w,other,garment,'wear',false)).toBeUndefined();
  ok(w,{type:'order-equipment',pawnId:actor.id,itemId:w.piles[0]!.id,action:'equip',queue:false});
  ok(w,{type:'order-equipment',pawnId:actor.id,itemId:garment.id,action:'wear',queue:true});
  expect(equipmentReason(w,other,garment,'wear',true)).toMatch(/réservé/);expect(beginAutomaticEquipment(w,other,garment.id,'wear',reach(w,other))).toBe(false);
  expect(equipmentReason(w,actor,garment,'wear')).toBeUndefined();expect(patientClaimed(w,garment.id,other)).toBe(false);
  expect(garment.owner.type).toBe('ground');expect(other.equipmentTask).toBeUndefined();
});

test('accepted queued capture and arrest retain their human claimant in the direct service providers',()=>{
  for(const kind of ['order-capture','order-arrest'] as const){
    const fixture=kind==='order-arrest'?arrestCamp():prisonerUiFixture(),w=fixture.world;
    const actor=w.pawns.find(p=>p.id===fixture.actorId)!,patient=w.pawns.find(p=>p.id===fixture.patientId)!,other=w.pawns.find(p=>p!==actor&&p!==patient)!;
    w.structures.find(b=>b.id===fixture.bedId)!.prisoner=true;
    const reason=kind==='order-arrest'?arrestReason:captureReason;
    expect(reason(w,other,patient)).toBeUndefined();
    addMaterial(w,'weapon',1,{type:'ground',x:actor.x+1,z:actor.z},'revolver');const weapon=w.piles.at(-1)!;
    ok(w,{type:'order-equipment',pawnId:actor.id,itemId:weapon.id,action:'equip',queue:false});
    ok(w,{type:kind,pawnId:actor.id,patientId:patient.id,queue:true});
    expect(reason(w,other,patient)).toMatch(/réservé/);expect(reason(w,actor,patient)).toBeUndefined();
    expect(other.rescue).toBeUndefined();expect(patient.prisoner).toBeUndefined();
  }
});

test('queued equip protects the weapon from another immediate or automatic recovery order',()=>{
  const w=equipmentCamp(),actor=w.pawns[0]!,other=w.pawns[1]!;
  addMaterial(w,'weapon',1,{type:'ground',x:15,z:5},'revolver');const weapon=w.piles.at(-1)!;
  ok(w,{type:'order-equipment',pawnId:actor.id,itemId:w.piles[0]!.id,action:'equip',queue:false});
  ok(w,{type:'order-equipment',pawnId:actor.id,itemId:weapon.id,action:'equip',queue:true});
  expect(equipmentReason(w,other,weapon,'equip')).toMatch(/réservé/);expect(equipmentReason(w,actor,weapon,'equip')).toBeUndefined();
  expect(applyCommand(w,{type:'order-equipment',pawnId:other.id,itemId:weapon.id,action:'equip',queue:false}).ok).toBe(false);
  expect(weapon.owner.type).toBe('ground');
});

test('queued strip reserves the corpse pawn identity against automatic strip and burial, not just its pile',()=>{
  const w=equipmentCamp(3),actor=w.pawns[0]!,other=w.pawns[1]!,target=w.pawns[2]!;other.priorities.haul=1;
  addMaterial(w,'apparel',1,{type:'apparel',pawnId:target.id},'cloth-shirt');controlledInjury(w,target,'heart',15000);
  expect(target.state).toBe('dead');expect(stripOrderIntent351(w,other.id,target.id).ok).toBe(true);
  ok(w,{type:'order-equipment',pawnId:actor.id,itemId:w.piles[0]!.id,action:'equip',queue:false});
  ok(w,{type:'queue-order-378',order:{type:'order-strip',pawnId:actor.id,targetId:target.id}});
  expect(stripTargetClaimed351(w,target.id,other.id)).toBe(actor);expect(burialClaim(w,target.id,other.id)).toBe(actor);
  expect(stripOrderIntent351(w,other.id,target.id).ok).toBe(false);expect(burialReason(w,other,target)).toMatch(/réservée/);
  ok(w,{type:'strip-designate',targetId:target.id,enabled:true});
  expect(stripProposal351(w,other,reach(w,other),()=>true)).toBeUndefined();
  expect(stripOrderIntent351(w,actor.id,target.id).ok).toBe(true);expect(burialClaim(w,target.id,actor.id)).toBeUndefined();
});

test('future claims are schema-gated and keep human, animal and pile identity spaces distinct',()=>{
  const w=equipmentCamp(),actor=w.pawns[0]!,other=w.pawns[1]!,weapon=w.piles[0]!;
  actor.orderedQueue378=[{type:'order-rescue',pawnId:actor.id,patientId:weapon.id,queue:false},{type:'order-animal-378',pawnId:actor.id,animalId:other.id,action:'tame',queue:false}];
  expect(equipmentReason(w,other,weapon,'equip')).toBeUndefined();expect(patientClaimed(w,other.id,other)).toBe(false);
  expect(patientClaimed(w,weapon.id,other)).toBe(true);expect(rescueClaim(w,weapon.id,other.id)).toBe(actor);
  (w as {schemaVersion:number}).schemaVersion=377;
  expect(patientClaimed(w,weapon.id,other)).toBe(false);expect(rescueClaim(w,weapon.id,other.id)).toBeUndefined();expect(stripTargetClaimed351(w,weapon.id,other.id)).toBeUndefined();expect(burialClaim(w,weapon.id,other.id)).toBeUndefined();
});
