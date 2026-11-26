import {filterPileEntries} from './pile-identity-directory.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,heldCore297,captureOccupiedHeldCore297,suspensionDeltas297,type SuspensionClock297} from './core-phase-297.ts';
import {prepareShipCasketDespawn277,prepareShipCasketSpawn277} from './ship-casket-notifications-277.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isShipCasket277,newShipCasketHolder277,type ShipCasket277,type ShipCasketOccupant277} from './ship-casket-state-277.ts';
import {shipCasketInteraction277} from './ship-casket-geometry-277.ts';
import {shipCasketSubject277} from './ship-casket-carry-277.ts';
import {shipCasketActorCapable277,shipCasketLiving277} from './ship-casket-intent-277.ts';
import {prepareShipCasketResume277,prepareShipCasketPossessionsResume277} from './ship-casket-clock-277.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {planPawnDrops,releaseWork} from './work-release.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {cancelShooting} from './shooting-state.ts';
import {cancelMelee} from './melee-state.ts';
import {cancelMechanoidRanged} from './mechanoid-ranged-state.ts';
import {nearbyGround} from './ground-placement.ts';
import {canStandAt} from './furniture-travel.ts';
import {refreshStock} from './materials.ts';
import {reconcilePawnHealth} from './health.ts';
import {reconcileAnimalHealth} from './wildlife-health.ts';
import {createMedicalRecord} from './injury-state.ts';
import {cancelAlcoholSpatial265} from './alcohol-state-265.ts';
import {cancelToxicVomit256} from './toxic-buildup-256.ts';
import {cancelCryptosleepVomit256,addCryptosleepSickness256} from './cryptosleep-sickness-256.ts';
import {ancientCasketEjectionRandom256} from './ancient-casket-release-256.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import type {MaterialPile,World,Cell} from './types.ts';

export type ShipCasketTransferPlan277={ok:false;reason:string}|{ok:true;commit():boolean};
const fail=(reason:string):ShipCasketTransferPlan277=>({ok:false,reason});
const actor=(o:ShipCasketOccupant277)=>o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech;
const ref=(o:ShipCasketOccupant277)=>({kind:o.kind,id:actor(o).id});
const personal=(p:MaterialPile,id:number)=>['inventory','equipment','apparel'].includes(p.owner.type)&&'pawnId'in p.owner&&p.owner.pawnId===id;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const installed=(w:World,c:ShipCasket277)=>isSchema277OrLater(w.schemaVersion)&&isShipCasket277(c)&&w.structures.includes(c);
const stamp=(o:ShipCasketOccupant277,c:ShipCasket277)=>JSON.stringify([o,c.shipCryptosleep277.items,c.shipCryptosleep277.packed,c.id,c.x,c.z,c.orientation,c.footprint,c.material]);
function completedService277(w:World,c:ShipCasket277,o:ShipCasketOccupant277){
 const a=actor(o),worker=w.pawns.find(p=>{const t=p.shipCasketTask277;return t?.casketId===c.id&&t.phase==='closing'&&t.lastWorkedAt===w.tick&&t.progressCore===500&&(t.action==='enter'&&o.kind==='human'&&p===a||t.action==='carry'&&t.patient?.kind===o.kind&&t.patient.id===a.id);});
 if(!worker)return;const task=worker.shipCasketTask277!,text=JSON.stringify(task),cell=shipCasketInteraction277(c,c.orientation);
 const current=()=>w.pawns.includes(worker)&&worker.shipCasketTask277===task&&JSON.stringify(task)===text&&shipCasketActorCapable277(w,worker,task.action==='carry')&&same(worker,cell)&&worker.moveCooldown===0&&(worker.motion?.end??0)<=w.tick&&!worker.path.length;
 return current()?{current}:undefined;
}
/** Admission consumes the real completed500-Core service. All originals remain
 * on their old owner until this single synchronous commit. */
export function planShipCasketEntry277(w:World,c:ShipCasket277,o:ShipCasketOccupant277):ShipCasketTransferPlan277 {
 const preparedCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined;
 const a=actor(o),actual=shipCasketSubject277(w,ref(o));
 if(!installed(w,c)||c.shipCryptosleep277.occupant||!actual||actor(actual)!==a||!shipCasketLiving277(o))return fail('L’occupant doit être le véritable original local vivant.');
 if(o.kind!=='mechanical'&&a.health&&medicalCivilTick271(a.health)!==w.tick)return fail('La dernière étape médicale du patient doit être achevée.');
 if(o.kind==='animal'&&!a.health)return fail('Le patient animal doit conserver son véritable dossier clinique.');
 let notification:ReturnType<typeof prepareShipCasketDespawn277>;try{notification=prepareShipCasketDespawn277(w,o);}catch(error){return fail(String(error));}
 const service=completedService277(w,c,o);if(!service)return fail('La fermeture doit être achevée au contact du caisson.');
 const items=w.piles.filter(p=>personal(p,a.id)),packed=w.packed.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===a.id);
 if(o.kind==='mechanical'&&(items.length||packed.length))return fail('Le modèle mécanique actuel ne possède pas de cargaison.');
 const drops=o.kind==='human'?planPawnDrops(w,new Set([a.id])):undefined;if(drops===null)return fail('La cargaison de travail doit pouvoir être déposée.');
 const tick=w.tick,rng=w.rng,nextId=w.nextId,h=c.shipCryptosleep277,pawns=w.pawns,piles=w.piles,packs=w.packed,animals=w.wildlife?.animals,mechs=w.mechanoids,text=JSON.stringify([o,items,packed]),building=JSON.stringify([c.id,c.x,c.z,c.orientation,c.footprint,c.material]);let done=false;
 return {ok:true,commit(){
  if(done||isCorePhysicalSchema297(Number(w.schemaVersion))&&effectiveCore297(w)!==preparedCore297||!installed(w,c)||c.shipCryptosleep277!==h||h.occupant||w.tick!==tick||w.rng!==rng||w.nextId!==nextId||w.pawns!==pawns||w.piles!==piles||w.packed!==packs||w.wildlife?.animals!==animals||w.mechanoids!==mechs||JSON.stringify([o,items,packed])!==text||JSON.stringify([c.id,c.x,c.z,c.orientation,c.footprint,c.material])!==building||!service.current()||!notification.current())return false;
  const found=shipCasketSubject277(w,ref(o));if(!found||actor(found)!==a)return false;
  const nowItems=w.piles.filter(p=>personal(p,a.id)),nowPacks=w.packed.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===a.id);
  if(nowItems.length!==items.length||nowItems.some((p,i)=>p!==items[i])||nowPacks.length!==packed.length||nowPacks.some((p,i)=>p!==packed[i]))return false;
  if(o.kind==='human'){
   const p=o.pawn;if(!releaseWork(w,p,drops!,true))return false;clearQueuedOrders(w,p);delete p.priorityWork;
   if(p.health){cancelAlcoholSpatial265(p.health);cancelToxicVomit256(p.health);cancelCryptosleepVomit256(p.health);for(const illness of [p.health.foodPoisoning,p.health.flu,p.health.immuneDiseases?.malaria])if(illness)delete illness.vomit;}
   delete p.medicalSleep;delete p.draft;cancelShooting(p);cancelMelee(p);delete p.bombRefuge;delete p.heatRefuge;delete p.allowedAreaReturn;delete p.transitExit;
   p.moveCooldown=0;p.planCooldown=0;p.collapsePending=false;p.restZeroTicks=0;
  }else if(o.kind==='animal'){
   const p=o.animal;delete p.animalThermalRefuge288;delete p.animalAreaReturn287;delete p.haul;delete p.animalRest;delete p.meal;delete p.eggLay;delete p.mating;delete p.exitFlight;delete p.flight;delete p.exiting;delete p.flee;delete p.threat;delete p.retaliation;delete p.predation;delete p.hiveJob;
   if(p.wander)delete p.wander.job;if(p.health){cancelToxicVomit256(p.health);cancelCryptosleepVomit256(p.health);}p.nextDecision=tick;
  }else{cancelMechanoidRanged(o.mech);cancelMelee(o.mech);o.mech.moveCooldown=0;o.mech.planCooldown=0;for(const duty of [o.mech.raid,o.mech.temple,o.mech.site263])if(duty)duty.goal=null;}
  done=true;delete a.motion;a.path=[];if(a.state!=='downed')a.state='idle';a.shipCryptosleepHeldAt277=tick;
  c.shipCryptosleep277={revision:1,heldAt:tick,...isCorePhysicalSchema297(Number(w.schemaVersion))?captureOccupiedHeldCore297(w):{},occupant:o,items,packed};
  if(o.kind==='human')w.pawns=w.pawns.filter(p=>p!==a);else if(o.kind==='animal')w.wildlife!.animals=w.wildlife!.animals.filter(p=>p!==a);else w.mechanoids=w.mechanoids!.filter(p=>p!==a);
  w.piles=filterPileEntries(w.piles,p=>!items.includes(p));w.packed=w.packed.filter(p=>!packed.includes(p));if(!notification.commit())throw Error('Spatial casket despawn changed during synchronous commit');refreshStock(w);return true;
 }};
}
/** Ejection is actorless. Destruction uses the same original-owner preflight
 * but owns its separate injury/destruction operation and never gains sickness. */
export function planShipCasketRelease277(w:World,c:ShipCasket277,mode:'eject'|'deconstruct'|'kill-finalize'='eject'):ShipCasketTransferPlan277 {
 const preparedCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined;
 if(!installed(w,c)||!c.shipCryptosleep277.occupant)return fail('Un véritable caisson spatial occupé est requis.');
 const h=c.shipCryptosleep277,o=h.occupant!,a=actor(o),items=h.items,packed=h.packed;
 if(a.shipCryptosleepHeldAt277!==h.heldAt||shipCasketSubject277(w,ref(o))||w.piles.some(p=>items.some(q=>q.id===p.id))||w.packed.some(p=>packed.some(q=>q.building.id===p.building.id)))return fail('L’occupant ou ses vrais biens ont changé de propriétaire.');
 const occupied=(v:Cell)=>[...w.pawns,...w.wildlife?.animals??[],...w.mechanoids??[]].some(p=>same(p,v)||p.motion&&p.motion.end>effectiveLocal297(w)&&(same(p.motion.from,v)||same(p.motion.to,v)));
 const origin=mode==='eject'?shipCasketInteraction277(c,c.orientation):c,cell=nearbyGround(w,origin).find(v=>canStandAt(w,v)&&!occupied(v));
 if(!cell)return fail('Aucune case réelle ne permet de sortir l’occupant.');
 if(w.pawns.length>=w.width*w.height||w.piles.length+items.length>32768||w.packed.length+packed.length>32768||o.kind==='animal'&&!w.wildlife)return fail('La capacité de la carte ne permet pas cette sortie.');
 let notification:ReturnType<typeof prepareShipCasketSpawn277>;try{notification=prepareShipCasketSpawn277(w,o);}catch(error){return fail(String(error));}
 let clock:ReturnType<typeof prepareShipCasketResume277>,goods:ReturnType<typeof prepareShipCasketPossessionsResume277>;
 const physical297:SuspensionClock297|undefined=isCorePhysicalSchema297(Number(w.schemaVersion))?{version:297,heldAtCore297:heldCore297(h,297,h.heldAt),targetCore297:preparedCore297!}:undefined;
 try{clock=prepareShipCasketResume277(o,h.heldAt,w.tick,physical297);goods=prepareShipCasketPossessionsResume277(items,packed,w.tick-h.heldAt,physical297);}catch(error){return fail(String(error));}
 const tick=w.tick,rng=w.rng,nextId=w.nextId,text=stamp(o,c),pawns=w.pawns,piles=w.piles,packs=w.packed,animals=w.wildlife?.animals,mechs=w.mechanoids;let done=false;
 return {ok:true,commit(){
  if(done||isCorePhysicalSchema297(Number(w.schemaVersion))&&effectiveCore297(w)!==preparedCore297||!installed(w,c)||c.shipCryptosleep277!==h||h.occupant!==o||w.tick!==tick||w.rng!==rng||w.nextId!==nextId||w.pawns!==pawns||w.piles!==piles||w.packed!==packs||w.wildlife?.animals!==animals||w.mechanoids!==mechs||stamp(o,c)!==text||!clock.current()||!goods.current()||!notification.current()||occupied(cell)||!canStandAt(w,cell))return false;
  done=true;if(!clock.commit()||!goods.commit())throw Error('Spatial casket originals changed during synchronous commit');
  delete a.shipCryptosleepHeldAt277;Object.assign(a,cell);
  if(o.kind==='human')w.pawns=[...w.pawns,o.pawn];else if(o.kind==='animal')w.wildlife!.animals=[...w.wildlife!.animals,o.animal];else w.mechanoids=[...w.mechanoids??[],o.mech];
  w.piles=[...w.piles,...items];w.packed=[...w.packed,...packed];c.shipCryptosleep277=newShipCasketHolder277(tick);if(!notification.commit())throw Error('Spatial casket spawn changed during synchronous commit');
  if(mode==='eject'){
   if(o.kind!=='mechanical'){a.health??=createMedicalRecord(tick);addCryptosleepSickness256(a.health,ancientCasketEjectionRandom256(w),w.schemaVersion);}
   const feet=a.filthFeet??={carried:[]},slime=feet.carried.find(f=>f.kind==='slime');if(slime)slime.thickness=Math.min(5,slime.thickness+1);else feet.carried.push({kind:'slime',thickness:1});
  }
  if(o.kind==='human'){reconcilePawnHealth(w,o.pawn);notifyActualExplorationSpawn256(w,o.pawn);}else if(o.kind==='animal'){reconcileAnimalHealth(w,o.animal);notifyActualExplorationSpawn256(w,o.animal);}
  refreshStock(w);return true;
 }};
}
