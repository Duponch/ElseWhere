import {isDoubleBedKind} from './bed-kinds.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import { tendingReason,tendingPlaceValid } from './tending.ts';
import { draftedTendingReason,draftedTendingPlaceValid } from './drafted-tending.ts';
import { serviceCell } from './service-reservations.ts';
import { bedSlotCell } from './bed-slots.ts';
import { validateMedicalRecord } from './injury-validation.ts';
import { medicalStatus } from './injury-state.ts';
import { isAdmittedGuest } from './affiliation.ts';
import { treatmentTarget,medicalRestNeeded } from './care-rules.ts';
import { isMedicine } from './medicine-rules.ts';
import { medicineTaskValid } from './medicine-logistics.ts';
import type { ItemId } from './items.ts';
import type { Pawn,World } from './types.ts';

export function validTendShape(value:unknown,version:number,w:Pick<World,'width'|'height'|'nextId'>):boolean {
  if(version<47||!value||typeof value!=='object'||Array.isArray(value))return false;
  const t=value as Record<string,unknown>;
  // Inspect prospective field descriptors before reading any mode payload.
  if('drafted' in t&&(Object.getPrototypeOf(t)!==Object.prototype&&Object.getPrototypeOf(t)!==null
    ||Reflect.ownKeys(t).some(k=>!Object.hasOwn(Object.getOwnPropertyDescriptor(t,k)!,'value'))))return false;
  const s=t.spot as Record<string,unknown>;
  const int=(n:unknown,min:number,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
  // A tactical mode is durable and never inferred from the actor's draft state.
  if('drafted' in t){
    const flag=Object.getOwnPropertyDescriptor(t,'drafted');
    if(version<233||!flag||!Object.hasOwn(flag,'value')||!flag.enumerable||flag.value!==true
      ||Reflect.ownKeys(t).some(k=>typeof k!=='string'||!['drafted','patientId','spot','phase','progress','duration'].includes(k))
      ||Reflect.ownKeys(t).some(k=>!Object.hasOwn(Object.getOwnPropertyDescriptor(t,k)!,'value'))
      ||!['patientId','spot','phase','progress'].every(k=>Object.hasOwn(t,k))
      ||!(t.phase==='approach'||t.phase==='tend')||!int(t.patientId,1,w.nextId-1)
      ||!s||Array.isArray(s)||Object.keys(s).length!==2)return false;
  }
  const m=t.medicine as Record<string,unknown>|undefined;
  if(t.useMedicine!==undefined&&(version<51||t.useMedicine!==true))return false;
  if(m!==undefined&&(version<51||!m||typeof m!=='object'||Array.isArray(m)||t.useMedicine!==true
    ||Object.keys(m).some(k=>!['item','sourcePileId','carryPileId','quantity'].includes(k))||!isMedicine(m.item as ItemId)
    ||!int(m.sourcePileId,1,w.nextId-1)||!int(m.quantity,1,25)||(t.phase==='pickup'?m.carryPileId!==null:!int(m.carryPileId,1,w.nextId-1))))return false;
  if(t.phase==='pickup'&&!m||t.phase==='find-medicine'&&(version<51||t.useMedicine!==true||m!==undefined))return false;
  return Object.keys(t).every(k=>['patientId','spot','phase','progress','duration','urgent','useMedicine','medicine',...(version>=233?['drafted']:[])].includes(k))&&int(t.patientId,1)
    &&(t.urgent===undefined||version>=50&&t.urgent===true)
    &&!!s&&typeof s==='object'&&Object.keys(s).every(k=>k==='x'||k==='z')&&int(s.x,0,w.width-1)&&int(s.z,0,w.height-1)
    &&(t.phase==='approach'||t.phase==='tend'||version>=51&&(t.phase==='pickup'||t.phase==='find-medicine'))&&int(t.progress,0,5999)
    &&(t.duration===undefined?t.phase!=='tend'&&t.phase!=='find-medicine'&&t.progress===0:int(t.duration,1,6000)&&Number(t.progress)<Number(t.duration));
}
export function validateCare(world:World,onlyBedIds?:ReadonlySet<number>,onlyPatientIds?:ReadonlySet<number>):string[] {
  const errors:string[]=[],patients=new Set<number>();
  let field=false;
  for(const d of world.pawns){
    if(onlyPatientIds&&!onlyPatientIds.has(d.id)&&!(d.tend&&onlyPatientIds.has(d.tend.patientId)))continue;
    if(hasDraftedTendingMarker(d)||d.draft&&d.tend)field=true;
    if(onlyBedIds&&!(d.need?.kind==='sleep'&&onlyBedIds.has(d.need.bedId??0))
      &&!(d.tend&&world.pawns.some(p=>p.id===d.tend!.patientId&&p.need?.kind==='sleep'&&onlyBedIds.has(p.need.bedId??0))))continue;
    if(d.state==='resting'&&!(d.need?.kind==='sleep'&&d.need.medical&&d.need.phase==='sleep'))errors.push('Medical rest without a physical bed service.');
    if(d.need?.kind==='sleep'&&d.need.medical&&(d.need.bedId===null||!d.prisoner&&!isAdmittedGuest(d)&&d.priorities[d.need.medical]===0))errors.push('Invalid medical bed intent.');
    if(d.need?.kind==='sleep'&&d.need.medical&&!d.surgeryRequest&&!treatmentTarget(d)&&!(d.need.medical==='bedrest'&&medicalRestNeeded(d)))errors.push('Medical rest without an eligible condition.');
    if(!d.tend)continue;
    const t=d.tend,p=world.pawns.find(p=>p.id===t.patientId);
    const drafted=t.drafted===true;
    if((drafted?draftedTendingReason(world,d,p,true):tendingReason(world,d,p,true))||!drafted&&d.priorities.doctor===0&&d.orders.active!=='tend'||patients.has(t.patientId))errors.push('Invalid or duplicate tending reservation.');
    patients.add(t.patientId);
    if(!p||!(drafted?draftedTendingPlaceValid(world,d,p,t):tendingPlaceValid(world,d,p,t)))errors.push('Tending place is not accessible at the bedside or self-treatment cell.');
    if(p&&!medicineTaskValid(world,d,p,t))errors.push('Invalid medicine permission, reservation or ownership.');
    if(t.phase==='tend'?(d.state!=='working'||d.moveCooldown>0||d.x!==t.spot.x||d.z!==t.spot.z||d.path.length):d.state!=='moving')errors.push('Invalid tending phase/position.');
    if(d.recreation.task||d.ward||d.feed||d.rescue||d.need||d.haul||d.cooking||d.jobId!==null)errors.push('Tending conflicts with another activity.');
  }
  if(!onlyBedIds&&field&&!validDraftedTendingTransport(world))errors.push('Invalid drafted tending transport or concurrent patient reservation.');
  return errors;
}

/** Marker inspection is cheap and reusable in the Decoder's existing pawn loop.
 * Inherited/accessor markers are still prospective fields and fail the shape. */
export function hasDraftedTendingMarker(pawn:Pick<Pawn,'tend'>):boolean {
  return !!pawn.tend&&typeof pawn.tend==='object'&&'drafted' in pawn.tend;
}

/** Validate only the newly admitted clinical domain, never all legacy care.
 * The Decoder calls this after reconstructing next and before publishing it.
 * Patient/service indexes live for this single adoption; no tile census. */
export function validDraftedTendingTransport(world:World):boolean {
  try {
    const doctors=world.pawns.filter(p=>hasDraftedTendingMarker(p)||!!p.draft&&!!p.tend);
    if(!doctors.length)return true;
    if(world.schemaVersion<233)return false;
    const byId=new Map<number,Pawn>(),patients=new Map<number,Set<number>>(),spots=new Map<number,Set<number>>();
    const claim=(map:Map<number,Set<number>>,key:number,actor:number)=>{
      let owners=map.get(key);if(!owners){owners=new Set<number>();map.set(key,owners);}owners.add(actor);
    };
    let beds:Map<number,World['structures'][number]>|undefined;
    for(const actor of world.pawns){
      if(byId.has(actor.id))return false;byId.set(actor.id,actor);
      for(const task of [actor.tend,actor.feed,actor.ward,actor.surgery,actor.rescue])if(task)claim(patients,task.patientId,actor.id);
      const spot=serviceCell(actor,world);if(spot)claim(spots,spot.z*world.width+spot.x,actor.id);
      if(actor.rescue){
        beds??=new Map(world.structures.map(b=>[b.id,b]));
        const bed=beds.get(actor.rescue.bedId),target=isDoubleBedKind(bed?.kind)&&actor.rescue.bedSlot!==undefined?bedSlotCell(bed,actor.rescue.bedSlot):bed;
        if(target)claim(spots,target.z*world.width+target.x,actor.id);
      }
    }
    const carried=new Set<number>();
    for(const pile of world.piles)if(pile.owner.type==='pawn')carried.add(pile.owner.pawnId);
    const records=new Set<Pawn>();
    for(const doctor of doctors){
      if(carried.has(doctor.id)||!validTendShape(doctor.tend,world.schemaVersion,world))return false;
      const draft=doctor.draft;
      if(!draft||Object.keys(draft).some(k=>!['lastActiveTick','target','queue','holdFire'].includes(k))
        ||!Number.isSafeInteger(draft.lastActiveTick)||draft.lastActiveTick<0||draft.lastActiveTick>world.tick
        ||draft.target!==null||!Array.isArray(draft.queue)||draft.queue.length||draft.holdFire!==undefined&&draft.holdFire!==true
        ||!doctor.orders||Object.keys(doctor.orders).some(k=>!['active','queue'].includes(k))
        ||doctor.orders.active!=='tend'||!Array.isArray(doctor.orders.queue)||doctor.orders.queue.length)return false;
      const task=doctor.tend!,patient=byId.get(task.patientId);
      if(!patient||draftedTendingReason(world,doctor,patient,true)||!draftedTendingPlaceValid(world,doctor,patient,task))return false;
      if(patients.get(patient.id)?.size!==1||!patients.get(patient.id)?.has(doctor.id))return false;
      const owners=spots.get(task.spot.z*world.width+task.spot.x);
      if(owners?.size!==1||!owners.has(doctor.id))return false;
      if(doctor.jobId!==null||doctor.haul||doctor.cooking||doctor.rescue||doctor.feed||doctor.ward||doctor.surgery
        ||doctor.research||doctor.animalCare||doctor.animalFeed||doctor.animalHandling||doctor.animalRescue
        ||doctor.equipmentTask||doctor.hunting||doctor.burial||doctor.cleaning||doctor.firefighting||doctor.trade
        ||doctor.orbitalTrade||doctor.deepWork||doctor.recreation.task||doctor.priorityWork||doctor.interruptedCargo
        ||doctor.melee||doctor.shooting||doctor.tactics||doctor.flee||doctor.burning||doctor.stun||doctor.bombRefuge||doctor.transitExit)return false;
      if(task.phase==='tend'){
        if(doctor.state!=='working'||doctor.moveCooldown!==0||(doctor.motion?.end??0)>world.tick
          ||doctor.x!==task.spot.x||doctor.z!==task.spot.z||doctor.path.length)return false;
      }else if(doctor.state!=='moving'||doctor.path.length&&(doctor.path.at(-1)!.x!==task.spot.x||doctor.path.at(-1)!.z!==task.spot.z)
        ||!doctor.path.length&&(doctor.x!==task.spot.x||doctor.z!==task.spot.z)
          &&(!(doctor.motion&&(doctor.motion.end>world.tick||doctor.moveCooldown>0))||doctor.motion.to.x!==task.spot.x||doctor.motion.to.z!==task.spot.z))return false;
      records.add(doctor);records.add(patient);
    }
    // Only actual participants acquire this isolated anatomical/clock guard.
    for(const pawn of records){
      const record=pawn.health;
      if(!record){if(pawn.state==='downed'||pawn.state==='dead')return false;continue;}
      if(record.body!==undefined||record.death||medicalCivilTick271(record)!==world.tick
        ||validateMedicalRecord(record,true,true,true,true,false,false,true,true,true,true,true,world.schemaVersion,world.schemaVersion>=127)!==null)return false;
      const status=medicalStatus(record);
      if(status==='mobile'?pawn.state==='downed'||pawn.state==='dead':pawn.state!==status)return false;
    }
    return true;
  }catch{return false;}
}
