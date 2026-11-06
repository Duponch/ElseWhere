import {isSchema285OrLater} from './schema-compatibility-257.ts';
import {actualBedOwners256,captureActorBeds256} from './actor-bed-local-256.ts';
import {bedSlotCell,pawnBedSlot} from './bed-slots.ts';
import {coupleBed285,coupleBedBurning285} from './couple-bed-285.ts';
import {coupleClockDraft285,coupleCheckDue285,coupleOpportunityRoll285,coupleRandom285} from './couple-random-285.ts';
import {coupleAdult285,coupleBiologicalYears285,coupleDurationCore285,coupleHourlyChance285,coupleMtbHours285} from './couple-rules-285.ts';
import {prepareCoupleRelease285} from './couple-release-285.ts';
import {COUPLE_EXCLUSIVE_FIELDS285} from './couple-save-285.ts';
import {pawnBody} from './health-rules.ts';
import {carrierOf} from './rescue-state.ts';
import {medicalBleed,medicalPain} from './injury-state.ts';
import {removalWritesMutable259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
import {relationshipIndex} from './relationship-runtime.ts';
import {knownRomanceChanceFactor,romanceAgeFactor} from './relationship-state.ts';
import {advanceRoomRest,finishRoomRest} from './room-experience.ts';
import {opinionOf} from './social-state.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {registeredCampaign} from './world-map-context.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {CoupleTask285} from './couple-state-285.ts';
import type {Pawn,Structure,World} from './types.ts';
import { structureById } from './structure-navigation.ts';

const civilAdult=(p:Pawn)=>coupleAdult285(p)&&(p.faction??'colony')==='colony'&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue
 &&p.state!=='dead'&&!p.health?.death&&p.cryptosleepHeldAt271===undefined&&p.shipCryptosleepHeldAt277===undefined;
function lyingSleep(world:World,pawn:Pawn,bed?:Structure):Structure|undefined {
 const task=pawn.need;
 if(task?.kind!=='sleep'||task.phase!=='sleep'||task.bedId===null||pawn.moveCooldown!==0||(pawn.motion?.end??0)>world.tick
  ||!['sleeping','resting','downed'].includes(pawn.state))return;
 bed??=structureById(world,task.bedId);
 if(!bed||bed.kind!=='double-bed'||task.bedId!==bed.id||bed.medical||bed.prisoner)return;
 const slot=pawnBedSlot(pawn,bed),cell=slot===undefined?undefined:bedSlotCell(bed,slot);
 return cell&&pawn.x===cell.x&&pawn.z===cell.z&&task.target.x===cell.x&&task.target.z===cell.z?bed:undefined;
}
const unoccupiedByOtherTask=(p:Pawn)=>p.jobId===null&&p.haul===null&&p.cooking===null&&p.orders.active===null&&p.recreation.task===null
 &&!p.coupleTask285&&!p.mental?.crisis&&!p.social?.fight&&p.path.length===0
 &&!COUPLE_EXCLUSIVE_FIELDS285.some(key=>key!=='medicalSleep'&&p[key]!==undefined);
const partners=(world:World,a:Pawn,b:Pawn)=>relationshipIndex(world).kinds(a.id,b.id).some(k=>k==='lover'||k==='spouse');
const bled=(p:Pawn)=>p.health?medicalBleed(p.health)>0:false;
const apply=(writes:readonly MapRemovalWrite259[])=>{for(const w of writes){if(w.present){if(!Reflect.set(w.object,w.key,w.value))throw Error('Admitted couple start write failed');}
 else if(!Reflect.deleteProperty(w.object,w.key))throw Error('Admitted couple start deletion failed');}};

/** This entry point is reached only by an actual lying-down SIM decision.
 * The check date is factual even when no partner/MTB/giver is admitted. */
export function tryCoupleOpportunity285(world:World,pawn:Pawn,body?:BodyAssessment):boolean {
 // Common standing/single-bed actors never need biological-header validation
 // or a structure/relationship lookup for this lying-down-only opportunity.
 if(!isSchema285OrLater(world.schemaVersion)||pawn.coupleTask285||pawn.need?.kind!=='sleep'||pawn.need.phase!=='sleep'||pawn.bedSlot===undefined)return false;
 const bed=lyingSleep(world,pawn);if(!bed||!civilAdult(pawn))return false;
 const now=world.tick*10;if(!coupleCheckDue285(pawn.coupleClock285,now))return false;
 const clock=coupleClockDraft285(world.seed,pawn.id,pawn.coupleClock285);clock.lastAttemptAtCore=now;
 const record:MapRemovalWrite259={object:pawn,key:'coupleClock285',present:true,value:clock};
 if(!removalWritesMutable259([record]))return false;apply([record]);
 const other=world.pawns.find(p=>p!==pawn&&p.bedId===bed.id&&p.bedSlot!==pawn.bedSlot&&lyingSleep(world,p,bed)&&partners(world,pawn,p));
 if(!other||!civilAdult(other)||pawn.hunger<=0||other.hunger<=0||bled(pawn)||bled(other))return false;
 const aAge=coupleBiologicalYears285(pawn)!,bAge=coupleBiologicalYears285(other)!,index=relationshipIndex(world);
 const firstBody=body??pawnBody(pawn),otherBody=pawnBody(other);
 const person=(p:Pawn,q:Pawn,age:number,qAge:number,b:BodyAssessment)=>({ageYears:age,pain:p.health?medicalPain(p.health):0,
  consciousness:b.capacities.consciousness,opinion:opinionOf(p,q.id,world.tick,world),
  attraction:romanceAgeFactor(age,qAge)*knownRomanceChanceFactor(index,p.id,q.id)});
 const mtb=coupleMtbHours285(person(pawn,other,aAge,bAge,firstBody),person(other,pawn,bAge,aAge,otherBody));
 if(mtb===undefined||mtb<=0||!Number.isFinite(mtb)||coupleOpportunityRoll285(world.seed,pawn.id,now)>=coupleHourlyChance285(mtb))return false;
 // Giver checks follow the positive opportunity; neither cooldown nor an
 // insufficient awake capacity retroactively erases the recorded check.
 if((clock.nextAllowedAtCore??0)>now||(other.coupleClock285?.nextAllowedAtCore??0)>now||!firstBody.canBeAwake||!otherBody.canBeAwake
  ||!unoccupiedByOtherTask(pawn)||!unoccupiedByOtherTask(other)||carrierOf(world,pawn.id)||carrierOf(world,other.id)||!targetBuildingPlayerUse263(world,bed)||coupleBedBurning285(world,bed))return false;
 // The stricter local ownership scope also checks off-map original claimants,
 // once at this rare start boundary, never every frame/continuation.
 const owners=actualBedOwners256(captureActorBeds256(registeredCampaign(world)),bed.id);
 if(owners.some(p=>p!==pawn&&p!==other&&p.state!=='dead'&&!p.health?.death)
  ||world.pawns.some(p=>p!==pawn&&p!==other&&(p.rescue?.bedId===bed.id||p.need?.kind==='sleep'&&p.need.bedId===bed.id||p.coupleTask285?.bedId===bed.id)))return false;
 const firstClock=coupleClockDraft285(world.seed,pawn.id,clock),secondClock=coupleClockDraft285(world.seed,other.id,other.coupleClock285);
 const duration=coupleDurationCore285(coupleRandom285(firstClock))!;
 if(!Number.isSafeInteger(now+duration))throw Error('Couple activity clock exhausted');
 const writes:MapRemovalWrite259[]=[];
 for(const [p,q,personal] of [[pawn,other,firstClock],[other,pawn,secondClock]] as const){
  const old=p.need;if(old?.kind!=='sleep')throw Error('Couple lost its physical sleeping task');
  const task:CoupleTask285={revision:1,otherId:q.id,initiatorId:pawn.id,bedId:bed.id,slot:p.bedSlot!,enteredAtCore:now,endsAtCore:now+duration,
   ...old.roomRest?{roomRest:old.roomRest}:{},...old.medical?{medical:old.medical}:{}};
  const observed:Pawn={...p};finishRoomRest(world,observed);
  if(observed.roomMemories!==p.roomMemories)writes.push({object:p,key:'roomMemories',present:observed.roomMemories!==undefined,...observed.roomMemories?{value:observed.roomMemories}:{}});
  writes.push({object:p,key:'coupleTask285',present:true,value:task},{object:p,key:'coupleClock285',present:true,value:personal},
   {object:p,key:'need',present:true,value:null},{object:p,key:'medicalSleep',present:false},
   {object:p,key:'state',present:true,value:p.state==='downed'?'downed':'idle'});
 }
 if(!removalWritesMutable259(writes))return false;apply(writes);return true;
}

/** Reconcile before any dead/downed/stun dispatcher exit. Start-only famine
 * and bleeding rules are deliberately not reused as continuation failures. */
export function reconcileCouple285(world:World,pawn:Pawn,body?:BodyAssessment):void {
 const task=pawn.coupleTask285;if(!isSchema285OrLater(world.schemaVersion)||!task)return;
 const other=world.pawns.find(p=>p.id===task.otherId),peer=other?.coupleTask285;
 const bed=coupleBed285(world,pawn);
 const invalid=!other||!peer||peer.otherId!==pawn.id||peer.initiatorId!==task.initiatorId||peer.bedId!==task.bedId||peer.endsAtCore!==task.endsAtCore
  ||!civilAdult(pawn)||!civilAdult(other)||!bed||!coupleBed285(world,other)||!partners(world,pawn,other)
  ||!targetBuildingPlayerUse263(world,bed)||coupleBedBurning285(world,bed)
  ||!(body??pawnBody(pawn)).canBeAwake||!pawnBody(other).canBeAwake||carrierOf(world,pawn.id)||carrierOf(world,other.id)
  ||pawn.need!==null||other.need!==null||pawn.orders.active!==null||other.orders.active!==null
  ||pawn.jobId!==null||other.jobId!==null||pawn.haul!==null||other.haul!==null||pawn.cooking!==null||other.cooking!==null
  ||pawn.recreation.task!==null||other.recreation.task!==null||pawn.path.length!==0||other.path.length!==0
  ||pawn.mental?.crisis||other.mental?.crisis||pawn.social?.fight||other.social?.fight
  ||COUPLE_EXCLUSIVE_FIELDS285.some(k=>pawn[k]!==undefined||other[k]!==undefined);
 if(invalid)prepareCoupleRelease285(world,new Set([pawn.id])).commit();
 else if(world.tick*10>=task.endsAtCore)prepareCoupleRelease285(world,new Set([pawn.id]),{resumeAll:true}).commit();
}

export function processCouple285(world:World,pawn:Pawn):boolean {
 const task=pawn.coupleTask285;if(!isSchema285OrLater(world.schemaVersion)||!task)return false;
 if(world.tick*10>=task.endsAtCore){prepareCoupleRelease285(world,new Set([pawn.id]),{resumeAll:true}).commit();return false;}
 advanceRoomRest(world,pawn);return true;
}
