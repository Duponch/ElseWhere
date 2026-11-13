import {deathOnDownedChance320,deathOnDownedEligible320} from './population-intent-320.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {stopCapturedTravel297} from './movement.ts';
import {isSchema285OrLater} from './schema-compatibility-257.ts';
import {notifyKidnapLordHarm261} from './caravan-kidnap-lord-261.ts';
import {notifyBillWorkerUnavailable283} from './bill-worker-owners-283.ts';
import {cancelAlcoholSpatial265} from './alcohol-state-265.ts';
import {humanConditionMedicalFrontier256} from './human-condition-frontier-256.ts';
import {recoverHumanConfusion256} from './human-condition-mind-256.ts';
import {commitToxicDeath256,cancelToxicVomit256} from './toxic-buildup-256.ts';
import {toxicFalloutDue294,toxicFalloutExposure294,adoptFalloutClinicalMind294} from './toxic-fallout-dose-294.ts';
import {cancelCryptosleepVomit256} from './cryptosleep-sickness-256.ts';
import { notifyColonyLoss } from './colony-economy.ts';
import { finishMentalBreak } from './mental-state.ts';
import { playerInfectionFactor } from './game-profile.ts';
import { resetTactics } from './tactics-state.ts';
import { carrierOf } from './rescue-state.ts';
import { dropIncapacitatedEquipment } from './equipment-state.ts';
import type { BodyAssessment } from './body-capacities.ts';
import { advanceMedical } from './injury-evolution.ts';
import { addResolvedInjury,createMedicalRecord,medicalStatus } from './injury-state.ts';
import { pawnBody,medicallyStopped } from './health-rules.ts';
import { interruptWork,retryInterruptedCargo } from './interrupted-cargo.ts';
import type { BodyPartId } from './body-definition.ts';
import type { InjuryKind } from './injury-rules.ts';
import type { Pawn,World } from './types.ts';
import { malnutritionRate } from './malnutrition.ts';
import { humanAgeImmunityFactor } from './human-age.ts';
import { notifyPawnDeath } from './bereavement.ts';
import {markCorpseWornApparel284} from './apparel-provenance-284.ts';
import { currentMedicalBed,bedHealPerDay,bedImmunityFactor } from './hospital-medical-stats.ts';
import {coupleBed285} from './couple-bed-285.ts';
import {medicalCivilTick271,medicalElapsedTicks271} from './suspended-human-clock-271.ts';

export function healthRandom(world:Pick<World,'rng'>):number {let n=world.rng;n^=n<<13;n^=n>>>17;n^=n<<5;world.rng=n>>>0;return world.rng/0x100000000;}
function announce(world:World,message:string):void {world.events.push({tick:world.tick,type:'need',message});if(world.events.length>80)world.events.splice(0,world.events.length-80);}

/** Actions stop at this tick. A captured edge finishes as the fall's translation:
 * no new edge, work or ingestion is performed during it (documented 3D choice). */
export function reconcilePawnHealth(world:World,pawn:Pawn,body=pawnBody(pawn),externalViolence=false,retainTravellingCargo=false):void {
  if(!pawn.health)return;
  if(externalViolence)notifyKidnapLordHarm261(world,pawn);
  // Core CheckForStateChange (schema 320): a non-colony humanlike downed by
  // external violence dies with the population-intent chance.
  if(externalViolence&&pawn.state!=='downed'&&pawn.state!=='dead'&&!pawn.health.death&&deathOnDownedEligible320(world,pawn)
    &&medicalStatus(pawn.health,body)==='downed'&&healthRandom(world)<deathOnDownedChance320(world))
    pawn.health.death={tick:medicalCivilTick271(pawn.health),cause:'downed'};
  const status=medicalStatus(pawn.health,body);if(status==='dead')commitToxicDeath256(pawn.health,()=>healthRandom(world));
  if(status!=='mobile') {
    if(isCorePhysicalSchema297(Number(world.schemaVersion))&&pawn.state!==status)stopCapturedTravel297(world,pawn);
    if(pawn.state!==status||status==='dead'||!body.canBeAwake)cancelAlcoholSpatial265(pawn.health);
    cancelCryptosleepVomit256(pawn.health);if(pawn.state!==status||status==='dead'||!body.canBeAwake)cancelToxicVomit256(pawn.health);
    delete pawn.bombRefuge;
    if(pawn.mental?.crisis?.kind==='confused-wander')recoverHumanConfusion256(pawn);else finishMentalBreak(world,pawn,status!=='dead');
    delete pawn.draft;delete pawn.shooting;delete pawn.flee;delete pawn.melee;resetTactics(pawn);if(pawn.raid)pawn.raid.goal=null;delete pawn.stun;
    if(pawn.state!==status) {
      notifyKidnapLordHarm261(world,pawn);
      if(status==='dead'||externalViolence)notifyColonyLoss(world,pawn,status==='dead'?'died':'downed');
      const wasSleeping=pawn.state==='sleeping';
      const coupled=pawn.coupleTask285,physicalCoupleBed=isSchema285OrLater(world.schemaVersion)&&coupled&&!carrierOf(world,pawn.id)?coupleBed285(world,pawn):undefined;
      const bed=pawn.need?.kind==='sleep'&&pawn.need.phase==='sleep'&&pawn.need.bedId!==null?pawn.need
        :physicalCoupleBed&&coupled?{kind:'sleep' as const,phase:'sleep' as const,bedId:physicalCoupleBed.id,target:{x:pawn.x,z:pawn.z},
          ...coupled.roomRest?{roomRest:coupled.roomRest}:{},...coupled.medical?{medical:coupled.medical}:{}}:null;
      interruptWork(world,pawn,retainTravellingCargo);
      if(status==='downed'&&bed)pawn.need=bed;
      if(status==='downed'&&wasSleeping)pawn.medicalSleep=true;else delete pawn.medicalSleep;
      pawn.collapsePending=false;pawn.restZeroTicks=0;pawn.state=status;
        if(status==='dead'){
          if(world.schemaVersion>=256){delete pawn.mapBed;pawn.bedId=null;delete pawn.bedSlot;}
        if(world.structures.some(b=>b.id===pawn.bedId&&(b.kind==='double-bed'||b.kind==='sleeping-spot'))||(world.packed??[]).some(pack=>pack.building.id===pawn.bedId&&pack.building.kind==='double-bed')){pawn.bedId=null;delete pawn.bedSlot;}
        markCorpseWornApparel284(world.piles,pawn,world.schemaVersion);
        delete pawn.surgeryRequest;notifyPawnDeath(world,pawn);notifyBillWorkerUnavailable283(world,pawn.id);
      }
      announce(world,status==='dead'?`${pawn.name} est décédé.`:`${pawn.name} est à terre.`);
    }
    dropIncapacitatedEquipment(world,pawn);return;
  }
  if(pawn.state==='downed') {
    // Releases the medical use of a bed. Ordinary needs may seek it again.
    pawn.need=null;delete pawn.medicalSleep;pawn.state='idle';pawn.planCooldown=0;pawn.needCooldown=0;
    announce(world,`${pawn.name} peut de nouveau se relever.`);
  }
  if(world.schemaVersion>=265&&pawn.need?.kind==='eat'&&pawn.need.alcoholReason!==undefined&&(body.capacities.eating<=0||body.capacities.manipulation<=0))interruptWork(world,pawn,retainTravellingCargo);
  if(body.capacities.manipulation===0&&(pawn.hunting||pawn.research||pawn.equipmentTask||pawn.jobId!==null||pawn.ward||pawn.feed||pawn.tend||pawn.surgery||pawn.rescue||pawn.animalRescue||pawn.haul||pawn.cooking||pawn.recreation.task?.activity==='chess'||pawn.orders.active!==null||pawn.orders.queue.length||pawn.priorityWork))interruptWork(world,pawn,retainTravellingCargo);
  if(body.capacities.manipulation===0)delete pawn.shooting;
  dropIncapacitatedEquipment(world,pawn);
}
export function updatePawnHealth(world:World,pawn:Pawn,retainTravellingCargo=false):BodyAssessment|undefined {
  if((pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined))return pawn.health?pawnBody(pawn):undefined;
  if(world.schemaVersion>=84&&pawn.hunger<=0&&pawn.state!=='dead')pawn.health??=createMedicalRecord(Math.max(0,world.tick-1));
  const fallout=toxicFalloutDue294(world)?toxicFalloutExposure294(world,pawn,!carrierOf(world,pawn.id),pawn.health?medicalCivilTick271(pawn.health):Math.max(0,world.tick-1)):undefined;
  let record=pawn.health;if(!record){if(!fallout)return;record=createMedicalRecord(Math.max(0,world.tick-1));}
  if(record.death){if(!carrierOf(world,pawn.id)&&pawn.moveCooldown===0)retryInterruptedCargo(world,pawn);return;}
  if(!record.death) {
    const restingCandidate=pawn.moveCooldown===0&&(pawn.state==='sleeping'||pawn.state==='resting'||pawn.state==='downed');
    const carried=restingCandidate&&!!carrierOf(world,pawn.id);
    const resting=restingCandidate&&!carried;
    // Awake couple activity still owns its physical bed posture: natural
    // healing and both immunity factors do not depend on gaining sleep rest.
    const coupleBed=isSchema285OrLater(world.schemaVersion)&&pawn.coupleTask285&&!carrierOf(world,pawn.id)?coupleBed285(world,pawn):undefined;
    const bed=coupleBed??(resting?currentMedicalBed(world,pawn,carried):undefined);
    const nextInfection=record.infections?.nextId??1;
    const sky=pawn.moveCooldown===0&&pawn.state==='recreating'&&pawn.recreation.task?.activity==='skygaze'&&pawn.recreation.task.phase==='active';
    const actualPawn=fallout||record.toxicBuildup||(record.alcohol?.tolerance??0)>.45?pawn:undefined,actualRecord=pawn.health,actualRng=world.rng,actualTick=world.tick,actualActors=world.pawns;
    const actorBefore=actualPawn?JSON.stringify(actualPawn):undefined,privateRandom=actualPawn?{rng:world.rng}:undefined;
    if(actualPawn){
      if(!world.pawns.includes(actualPawn)||!Object.isExtensible(actualPawn)||Reflect.ownKeys(actualPawn).some(k=>{const d=Object.getOwnPropertyDescriptor(actualPawn,k)!;return !('value'in d)||!d.writable||!d.configurable;}))throw Error('Toxic clinical original is not a mutable actual map owner');
      pawn=structuredClone(actualPawn);record=pawn.health??=record;
      if(fallout)adoptFalloutClinicalMind294(pawn,world.schemaVersion,fallout);
    }
    const medicalDraw=privateRandom?()=>healthRandom(privateRandom):()=>healthRandom(world);
    const conditionFrontier=humanConditionMedicalFrontier256(pawn,record,world.tick,medicalDraw,{kind:'map',world},actualPawn);
    advanceMedical(record,medicalElapsedTicks271(record,world.tick),{civilTick:world.tick,phase:pawn.id%60,alcoholOwner:{id:pawn.id,spawned:!carrierOf(world,pawn.id),awake:pawn.state!=='sleeping'&&!pawn.medicalSleep&&!pawn.stun,inMentalState:!!pawn.mental?.crisis},toxicOwner:{id:pawn.id,spawned:!carrierOf(world,pawn.id),awake:pawn.state!=='sleeping'&&!pawn.medicalSleep&&!pawn.stun},...(fallout?{toxicFallout294:fallout}:{}),cryptosleepSicknessSpawned:!carrierOf(world,pawn.id),posture:bed?'bed':resting?'ground':'standing',starving:pawn.hunger<=0,malnutritionRate:world.schemaVersion>=84?malnutritionRate(pawn.id):undefined,infectionChanceFactor:playerInfectionFactor(world,pawn),
      hunger:pawn.hunger,rest:pawn.rest,restingBonus:!!bed||resting&&pawn.state!=='downed'||sky,infectionSeed:(world.seed^Math.imul(pawn.id,0x9e3779b1))>>>0,
      ageImmunityFactor:humanAgeImmunityFactor(pawn.age),...(bed?{bedHealPerDay:bedHealPerDay(bed),bedImmunityFactor:bedImmunityFactor(bed,world)}:{})},medicalDraw,conditionFrontier);
    if(actualPawn){
      if(world.tick!==actualTick||world.rng!==actualRng||world.pawns!==actualActors||!world.pawns.includes(actualPawn)||actualPawn.health!==actualRecord||JSON.stringify(actualPawn)!==actorBefore)throw Error('Stale actual toxic clinical owner');
      commitToxicDeath256(record,medicalDraw);
      for(const key of Object.keys(actualPawn))if(!Object.hasOwn(pawn,key))delete (actualPawn as unknown as Record<string,unknown>)[key];
      Object.assign(actualPawn,pawn);world.rng=privateRandom!.rng;pawn=actualPawn;
    }
    conditionFrontier?.commit();
    for(const infection of record.infections?.cases??[])if(infection.id>=nextInfection)announce(world,`${pawn.name} souffre d’une infection : consultez Santé et organisez des soins réguliers.`);
  }
  const body=pawnBody(pawn);reconcilePawnHealth(world,pawn,body,false,retainTravellingCargo);
  if(medicallyStopped(pawn)&&!carrierOf(world,pawn.id)&&pawn.moveCooldown===0)retryInterruptedCargo(world,pawn);
  return body;
}
/** Called by a damage producer after it has resolved hit selection/protection. */
export function injurePawn(world:World,pawn:Pawn,part:BodyPartId,kind:InjuryKind,severity:number):void {
  if(pawn.state==='dead')return;
  if(!pawn.health||medicalCivilTick271(pawn.health)<world.tick)updatePawnHealth(world,pawn);
  if(pawn.health?.death)return;
  pawn.health??=createMedicalRecord(world.tick);
  addResolvedInjury(pawn.health,part,kind,severity,()=>healthRandom(world));
  reconcilePawnHealth(world,pawn,undefined,true);
}
