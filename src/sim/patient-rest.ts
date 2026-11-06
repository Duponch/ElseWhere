import {claimLocalActorBed256,captureActorBeds256,localBedClaimAvailable256} from './actor-bed-local-256.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import {isTherapeuticCaptiveSurgery280} from './prisoner-surgery-rules-280.ts';
import { isBedKind } from './bed-kinds.ts';
import { bedSlotCell,pawnBedSlot } from './bed-slots.ts';
import { lyingBlocked } from './disturbance-state.ts';
import { isAdmittedGuest } from './affiliation.ts';
import { advanceRoomRest } from './room-experience.ts';
import { treatmentTarget,medicalRestNeeded,urgentTreatment } from './care-rules.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { rescueBedAvailable,rescueBedPlaces,medicalBedPreference } from './medical-beds.ts';
import { routeToCell,type Reachability } from './pathfinding.ts';
import { updatePawnHealth } from './health.ts';
import { releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { BedSlot,Cell,Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface PatientRestProposal {work:'patient'|'bedrest';bedId:number;path:Cell[];bedSlot?:BedSlot}

/** Only callers with the actual world's version admit prospective captive
 * operations. Standalone legacy readers keep their existing priority rules. */
export function captiveSurgeryRest280(p:Pawn,version:number|undefined):boolean {
  const request=p.surgeryRequest;
  return !!request&&request.removeArtificial273===undefined&&version!==undefined
    &&isTherapeuticCaptiveSurgery280(p,request.part,{version,...request.implant?{implant:request.implant}:{}});
}
export function patientWork(p:Pawn,version?:number):'patient'|'bedrest'|undefined {
  if(captiveSurgeryRest280(p,version))return 'patient';
  if(p.surgeryRequest)return workPriority(p,'patient')>0?'patient':workPriority(p,'bedrest')>0?'bedrest':undefined;
  if(treatmentTarget(p)&&(p.prisoner||isAdmittedGuest(p)||workPriority(p,'patient')>0))return 'patient';
  if((medicalRestNeeded(p)||treatmentTarget(p))&&(p.prisoner||isAdmittedGuest(p)||workPriority(p,'bedrest')>0))return 'bedrest';
}
export function patientProposal(world:World,pawn:Pawn,reach:Reachability):PatientRestProposal|undefined {
  if(lyingBlocked(world,pawn))return;
  let work=patientWork(pawn,world.schemaVersion);if(!work)return;
  const bedOwners=world.schemaVersion>=256?captureActorBeds256(world):undefined;
  if(work==='patient'&&!pawn.surgeryRequest&&!urgentTreatment(pawn)&&!world.pawns.some(p=>p!==pawn&&workPriority(p,'doctor')>0&&!medicalWorkRefusal(p)&&p.state!=='sleeping'&&p.state!=='resting'&&!p.medicalSleep&&!(p.need?.kind==='sleep'&&p.need.phase==='sleep')&&routeToCell(world,p,reach)!==null)){
    if(!pawn.prisoner&&!isAdmittedGuest(pawn)&&workPriority(pawn,'bedrest')===0)return;work='bedrest';
  }
  const beds=world.structures.flatMap(b=>rescueBedPlaces(world,b,pawn,pawn.id).filter(place=>allowedAreaAllows(world,pawn,place.cell)&&localBedClaimAvailable256(world,b,pawn,place.bedSlot,bedOwners)).map(place=>({bed:b,cell:place.cell,slot:place.bedSlot})))
    .sort((a,b)=>medicalBedPreference(a.bed)-medicalBedPreference(b.bed)||Number(a.bed.id!==pawn.bedId)-Number(b.bed.id!==pawn.bedId)
      ||(a.cell.x-pawn.x)**2+(a.cell.z-pawn.z)**2-(b.cell.x-pawn.x)**2-(b.cell.z-pawn.z)**2||a.bed.id-b.bed.id||(a.slot??0)-(b.slot??0));
  // An actual occupied bed remains the service until it becomes invalid.
  const current=pawn.need;
  if(current?.kind==='sleep'&&current.phase==='sleep'&&pawn.moveCooldown===0){
    const occupied=beds.find(b=>b.bed.id===current.bedId&&pawn.x===b.cell.x&&pawn.z===b.cell.z);
    if(occupied)return {work,bedId:occupied.bed.id,path:[],...(occupied.slot!==undefined?{bedSlot:occupied.slot}:{})};
  }
  for(const {bed,cell,slot} of beds){const path=routeToCell(world,cell,reach);if(path)return {work,bedId:bed.id,path,...(slot!==undefined?{bedSlot:slot}:{})};}
}
export function startPatientRest(world:World,pawn:Pawn,proposal:PatientRestProposal):void {
  const bed=structureById(world,proposal.bedId)!;
  if(bed.kind==='double-bed'&&(proposal.bedSlot===undefined||!!pawn.surgeryRequest||!rescueBedAvailable(world,bed,pawn,pawn.id,false,proposal.bedSlot)))return;
  const target=bed.kind==='double-bed'&&proposal.bedSlot!==undefined?bedSlotCell(bed,proposal.bedSlot):bed;
  if(!target)return;
  if(!bed.medical)claimLocalActorBed256(world,pawn,bed,bed.kind==='double-bed'?proposal.bedSlot:undefined);
  pawn.need={kind:'sleep',phase:'travel',bedId:bed.id,target:{x:target.x,z:target.z},medical:proposal.work};
  pawn.path=proposal.path;pawn.state='moving';pawn.planCooldown=0;
}
/** Finishing this round of treatment must not release and reclaim the actual
 * bed when enabled recuperation still applies between later treatments. */
function continueRecuperation(pawn:Pawn):void {
  const task=pawn.need;
  if(task?.kind==='sleep'&&task.medical==='patient'&&!pawn.surgeryRequest&&!treatmentTarget(pawn)&&(pawn.prisoner||isAdmittedGuest(pawn)||workPriority(pawn,'bedrest')>0)&&medicalRestNeeded(pawn))task.medical='bedrest';
}
/** Lying awake is separate from sleeping. Hunger retains the normal physical
 * meal path; disabled patients will later require the feeding work provider. */
export function processPatientRest(world:World,pawn:Pawn,context:NeedContext):boolean {
  if(!allowedAreaServicesAllowed(world,pawn)){context.release();return false;}
  const task=pawn.need;if(task?.kind!=='sleep'||!task.medical)return false;
  continueRecuperation(pawn);
  const bed=world.structures.find(b=>b.id===task.bedId&&isBedKind(b.kind));
  const slot=bed?.kind==='double-bed'?pawnBedSlot(pawn,bed):undefined,cell=bed?.kind==='double-bed'&&slot!==undefined?bedSlotCell(bed,slot):undefined;
  const wanted=!!pawn.surgeryRequest||treatmentTarget(pawn)||(task.medical==='bedrest'&&medicalRestNeeded(pawn));
  if(!bed||bed.kind==='double-bed'&&(!!pawn.surgeryRequest||!cell||task.target.x!==cell.x||task.target.z!==cell.z)
    ||!rescueBedAvailable(world,bed,pawn,pawn.id,false,slot)||!wanted||!pawn.prisoner&&!isAdmittedGuest(pawn)&&workPriority(pawn,task.medical)===0){context.release();return true;}
  if(pawn.x!==task.target.x||pawn.z!==task.target.z){context.move(task.target,true);return true;}
  if((bed.kind==='double-bed'||bed.kind==='sleeping-spot')&&(pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick))return true;
  if(task.phase==='travel'){
    if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
    task.phase='sleep';context.event(`${pawn.name} s'allonge pour ${task.medical==='patient'?'recevoir des soins':'récupérer de son état de santé'}.`);
  }
  pawn.path=[];pawn.state='resting';advanceRoomRest(world,pawn);return true;
}
export function reconcilePatientRest(world:World):void {
  for(const p of world.pawns)if(p.need?.kind==='sleep'&&p.need.medical){
    // Incapacity keeps the physical bed service independently of voluntary
    // Patient/Bed rest work, just as if the patient had been rescued into it.
    if(p.state==='downed'){delete p.need.medical;continue;}
    continueRecuperation(p);
    const work=p.need.medical;
    const bed=world.structures.find(b=>b.id===(p.need?.kind==='sleep'?p.need.bedId:null));
    if(!p.prisoner&&!isAdmittedGuest(p)&&workPriority(p,work)===0||!bed||bed.kind==='double-bed'&&!!p.surgeryRequest||(!p.surgeryRequest&&!treatmentTarget(p)&&!(work==='bedrest'&&medicalRestNeeded(p))))releaseWork(world,p);
  }
}
