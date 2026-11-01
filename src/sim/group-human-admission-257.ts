import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {preparePartyRelease292} from './party-release-292.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {validStagger} from './stagger.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {projectedCapturePatient259} from './group-human-projection-259.ts';
import {prospectiveHuman259,captiveAdmission259,autoCapturePatient259,actualReform259,hostedCaptive259} from './group-human-admission-259.ts';
import {completeCapture} from './capture.ts';
import type {Cell,Pawn,World} from './types.ts';
import type {PreparingGroup} from './group-capture.ts';
import type {GroupAdmission257,GroupHumanPreparation257,GroupState} from './group-state.ts';
import {isColonist} from './affiliation.ts';
import {pawnBody} from './health-rules.ts';
import {medicalStatus} from './injury-state.ts';
import {scoutActiveTask} from './caravan-trip.ts';
import {planPawnDrops,releaseWork} from './work-release.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {localWorldGroups,pawnWorldGroup} from './world-map-context.ts';
import type {NeedContext} from './needs.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const settled=(w:World,p:Pawn)=>p.moveCooldown===0&&(p.motion?.end??0)<=w.tick;
export const groupFreeHuman257=(p:Pawn):boolean=>isColonist(p)&&!p.prisoner&&!p.visitor&&(!p.worldAffiliation259||p.worldAffiliation259.hostFactionId===null&&p.worldAffiliation259.guestStatus==='Guest')&&p.state!=='dead'&&!p.health?.death;
export const groupHumanMobile257=(p:Pawn):boolean=>p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&(!p.health||medicalStatus(p.health)==='mobile')&&pawnBody(p).capacities.moving>0;
export const groupHumanHandler257=(p:Pawn):boolean=>groupFreeHuman257(p)&&groupHumanMobile257(p)&&pawnBody(p).capacities.manipulation>0;
export const groupHasAdmission257=(g:GroupState|undefined):boolean=>g?.admission?.revision===1||g?.admission?.revision===2;
type HumanLine257=GroupHumanPreparation257['passengers'][number];
const rowIndexes=new WeakMap<GroupHumanPreparation257,{rows:HumanLine257[];length:number;byCarrier:Map<number,HumanLine257[]>;byPatient:Map<number,HumanLine257>}>();
/** Derived lookup only. It never owns a Pawn, claim or saved decision. */
function humanRows257(prep:GroupHumanPreparation257){
 let index=rowIndexes.get(prep);if(index?.rows===prep.passengers&&index.length===prep.passengers.length)return index;
 const byCarrier=new Map<number,HumanLine257[]>(),byPatient=new Map<number,HumanLine257>();
 for(const row of prep.passengers){const rows=byCarrier.get(row.carrierId)??[];rows.push(row);byCarrier.set(row.carrierId,rows);byPatient.set(row.pawnId,row);}
 index={rows:prep.passengers,length:prep.passengers.length,byCarrier,byPatient};rowIndexes.set(prep,index);return index;
}
export function groupHumanAdmissionReason257(w:World,p:Pawn,newIntent261=false):string|undefined {
 return groupHumanAdmissionReasonCore257(w,p,newIntent261,false);
}
function groupHumanAdmissionReasonCore257(w:World,p:Pawn,newIntent261:boolean,savedStagger297:boolean):string|undefined {
 if(!w.pawns.includes(p)||p.state==='dead'||p.health?.death)return 'Choisissez une personne vivante présente sur cette carte.';
 const captive=captiveAdmission259(w,p),capture=autoCapturePatient259(w,p);
 if(p.prisoner&&!captive&&!capture)return 'Le captif doit avoir un hôte réel et être sécurisé, ou relever du reformage de ce site.';
 if(!captive&&!capture&&(p.visitor||p.originQuestId!==undefined||!isColonist(p)))return 'Le transport des visiteurs et personnes de quête n’est pas disponible.';
 const group=p.draft?(pawnWorldGroup(w,p.id)?.state??w.group):undefined;
 const retainedDraft=(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))&&(newIntent261||!!group&&'manifest'in group&&!!group.humanPreparation?.undraftIds261?.includes(p.id));
 // Mobilisation by itself (including its ordinary movement queue) is allowed.
 // A drafted service/physical-care owner is outside this narrow admission.
 const draftedService=p.tend||p.feed||p.ward||p.surgery||p.surgeryRequest||p.rescue||p.animalRescue||p.animalHandling||p.animalCare||p.animalFeed||p.firefighting||p.haul||p.equipmentTask||p.orders.active;
 if(p.draft&&(!retainedDraft||!groupFreeHuman257(p)||draftedService)||p.mental?.crisis||p.social?.fight||p.burning||p.flee||p.tactics||p.melee||p.shooting?.order||p.shooting?.stance||p.bombRefuge||p.heatRefuge)return 'Terminez la réaction, le combat ou la mobilisation engagée avant la formation.';
 const h=p.health;
 if(h&&(h.foodPoisoning?.vomit||h.cryptosleepSickness?.vomit||h.flu?.vomit||h.immuneDiseases?.malaria?.vomit||h.toxicBuildup?.vomit||h.toxicBuildup?.vomitRequestedAt!==undefined))return 'L’épisode physique de vomissement doit se terminer.';
 if(p.surgery||p.surgeryRequest||p.rescue?.phase==='carry'||p.animalRescue?.phase==='carry'||w.pawns.some(q=>q!==p&&(q.rescue?.patientId===p.id||q.tend?.patientId===p.id||q.feed?.patientId===p.id||q.ward?.patientId===p.id||q.surgery?.patientId===p.id)))return 'Un soin ou transport physique encore engagé réserve cette personne.';
 if(p.collapsePending&&p.state!=='downed')return 'L’effondrement physique engagé doit se terminer avant la formation.';
 if(p.equipmentDropPending||p.interruptedCargo||p.transitExit||(p.stun?.untilCore??0)>w.tick*10||!savedStagger297&&(p.stagger?.untilCore??0)>w.tick*10)return 'Terminez la restitution ou la réaction physique en cours.';
 if(p.state!=='downed'&&!groupHumanMobile257(p))return 'La personne doit être autonome ou admise comme passager à terre.';
 return undefined;
}

/** Pure command preflight. Work cargos stay on the actual map and are never
 * inserted into a projected World or counted as future caravan inventory. */
export function previewGroupHumanPreparation257(w:World,members:readonly Pawn[],reachable:(p:Pawn,c:Cell)=>boolean,animalCarriers:readonly number[]=[]):{ok:true;preparation:GroupHumanPreparation257}|{ok:false;reason:string} {
 const handlers=members.filter(p=>groupHumanHandler257(p)&&!animalCarriers.includes(p.id));
 if(!members.some(p=>groupFreeHuman257(p)&&groupHumanMobile257(p)))return {ok:false,reason:'La formation doit conserver un colon libre capable de marcher.'};
 const ids=new Set(members.map(p=>p.id));
 for(const p of members){const reason=groupHumanAdmissionReason257(w,p,true);if(reason)return {ok:false,reason};}
 if(!planPawnDrops(w,ids))return {ok:false,reason:'La cargaison de travail ne peut pas être déposée sur la carte.'};
 const passengers:GroupHumanPreparation257['passengers']=[];
 for(const p of members.filter(p=>p.state==='downed')){
  const carrier=handlers.find(q=>q!==p&&reachable(q,p));
  if(!carrier)return {ok:false,reason:'Aucun colon libre ne peut rejoindre et porter cette personne à terre.'};
  passengers.push({pawnId:p.id,carrierId:carrier.id,phase:'approach',...autoCapturePatient259(w,p)?{captureOnPickup259:true as const}:{}});
 }
 const undraftIds=(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))?members.filter(p=>p.draft).map(p=>p.id):[];
 return {ok:true,preparation:{revision:1,...undraftIds.length?{undraftIds261:undraftIds}:{},releaseIds:members.filter(p=>undraftIds.includes(p.id)||scoutActiveTask(p)||p.deepWork||p.openCasket||p.medicalSleep||p.path.length||p.moveCooldown>0||(p.motion?.end??0)>w.tick||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)).map(p=>p.id),passengers}};
}

/** All selected edges finish before any ordinary work is interrupted. A new
 * obstruction cancels the intent while leaving all prior tasks untouched. */
export function releaseGroupHumanWork257(w:World,g:PreparingGroup,preflight:()=>boolean):'ready'|'waiting'|'refused' {
 const prep=g.humanPreparation;
 if(!prep?.releaseIds.length){
  const active=w.party292?.active,ids=new Set(g.memberIds);if(!active||!ids.has(active.organizerId)&&!active.members.some(m=>ids.has(m.pawnId)))return 'ready';
  try{const party=preparePartyRelease292(w,ids,{finish:ids.has(active.organizerId)});if(!preflight()||!party.current())return 'refused';party.commit();return 'ready';}catch{return 'refused';}
 }

 const members=prep.releaseIds.map(id=>w.pawns.find(p=>p.id===id));
 if(members.some(p=>!p))return 'refused';
 if(members.some(p=>!settled(w,p!)))return 'waiting';
 if(members.some(p=>groupHumanAdmissionReason257(w,p!)))return 'refused';
 const drops=planPawnDrops(w,new Set(prep.releaseIds));if(!drops)return 'refused';
 let party:ReturnType<typeof preparePartyRelease292>;try{party=preparePartyRelease292(w,new Set(g.memberIds),{finish:w.party292?.active!==undefined&&g.memberIds.includes(w.party292.active.organizerId)});}catch{return 'refused';}
 if(!preflight()||!party.current())return 'refused';party.commit();
 // Every drop and every task owner was preflighted before the first write.
 for(const p of members as Pawn[]){clearQueuedOrders(w,p);delete p.priorityWork;if(!releaseWork(w,p,drops))throw Error('Preflighted formation work release changed');p.planCooldown=0;p.needCooldown=0;}
 prep.releaseIds=[];return 'ready';
}

/** Body relationship only: both actual human owners remain on their map. */
export function syncGroupHumanPassenger257(w:World,carrier:Pawn):void {
 const g=pawnWorldGroup(w,carrier.id)?.state??w.group;if(!g||!('manifest'in g)||!g.humanPreparation)return;
 for(const row of humanRows257(g.humanPreparation).byCarrier.get(carrier.id)??[])if(row.phase==='carry'){
  const p=w.pawns.find(p=>p.id===row.pawnId);if(!p)continue;p.x=carrier.x;p.z=carrier.z;p.path=[];
  p.motion=carrier.motion?{...carrier.motion,from:{...carrier.motion.from},to:{...carrier.motion.to},...carrier.motion.stagger?{stagger:carrier.motion.stagger.map(s=>({...s}))}:{}}:null;
  if(p.motion)delete p.motion.snowEntryPending;p.moveCooldown=carrier.moveCooldown;
 }
}
export function releaseGroupHumanPassengers257(w:World,g:PreparingGroup):void {
 for(const row of g.humanPreparation?.passengers??[])if(row.phase==='carry'){
  const carrier=w.pawns.find(p=>p.id===row.carrierId);if(carrier)syncGroupHumanPassenger257(w,carrier);
  // The captured edge remains on BOTH bodies until its real end. Removing the
  // claim permits future care, never a return to the pickup position.
  row.phase='waiting';
 }
}
export function groupHumanCarrying257(w:World,id:number):boolean {const g=pawnWorldGroup(w,id)?.state??w.group;return !!g&&'manifest'in g&&!!g.humanPreparation&&(humanRows257(g.humanPreparation).byCarrier.get(id)??[]).some(row=>row.phase==='carry');}
export function groupHumanCarrierOf257(w:World,id:number):Pawn|undefined {const g=pawnWorldGroup(w,id)?.state??w.group;const row=g&&'manifest'in g&&g.humanPreparation?humanRows257(g.humanPreparation).byPatient.get(id):undefined;return row?.phase==='carry'?w.pawns.find(p=>p.id===row.carrierId):undefined;}
export function groupHumanPassenger257(w:World,id:number):boolean {const g=pawnWorldGroup(w,id)?.state??w.group;return !!g&&groupHasAdmission257(g)&&('manifest'in g?!!g.humanPreparation&&humanRows257(g.humanPreparation).byPatient.has(id):g.phase==='unloading'&&g.memberIds.includes(id));}
/** Only a real new259 passenger intent owns autonomous rest-start before pickup.
 * This is not carrierOf: pending bodies stay on their actual map and retain all
 * clinical evolution, needs and dangerous/medical preemption. No saved state. */
export function groupHumanPendingPassenger259(w:World,id:number):boolean {
 if(Number(w.schemaVersion)!==259&&Number(w.schemaVersion)!==260&&(Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion)))))return false;const g=pawnWorldGroup(w,id)?.state??w.group;
 if(!g||!('manifest'in g)||g.admission?.revision!==2||!g.humanPreparation)return false;
 const row=humanRows257(g.humanPreparation).byPatient.get(id);return !!row&&(row.phase==='approach'||row.phase==='waiting');
}
export function groupHumanCarryPairs257(w:World):readonly {carrierId:number;patientId:number}[] {
 const groups=localWorldGroups(w).map(r=>r.state);if(w.group&&!groups.includes(w.group))groups.push(w.group);
 return groups.flatMap(g=>'manifest'in g?g.humanPreparation?.passengers.filter(p=>p.phase==='carry').map(p=>({carrierId:p.carrierId,patientId:p.pawnId}))??[]:[]);
}

/** The ordinary ctx.move still owns weighted navigation and the shared budget.
 * A carrier may make several real trips; waiting patients never move with him. */
export function processGroupHumanCarry257(w:World,g:PreparingGroup,p:Pawn,ctx:NeedContext):'handled'|'none'|'refused' {
 const prep=g.humanPreparation;if(!prep)return 'none';
 for(const row of humanRows257(prep).byCarrier.get(p.id)??[]){
  const patient=w.pawns.find(q=>q.id===row.pawnId),carrier=w.pawns.find(q=>q.id===row.carrierId);
  if(!patient||!carrier||groupHumanAdmissionReason257(w,patient)||groupHumanAdmissionReason257(w,carrier)||!groupHumanHandler257(carrier))return 'refused';
  if(patient.state!=='downed'&&(row.phase!=='carry'||settled(w,carrier))){
   if(row.phase==='carry'){syncGroupHumanPassenger257(w,carrier);patient.motion=null;patient.moveCooldown=0;}
   prep.passengers=prep.passengers.filter(r=>r!==row);continue;
  }
 }
 if(p.state==='downed')return 'handled';
 if(g.phase!=='leaving')return 'none';
 const row=(humanRows257(prep).byCarrier.get(p.id)??[]).find(r=>r.phase!=='waiting');if(!row)return 'none';
 const patient=w.pawns.find(q=>q.id===row.pawnId)!,exit=g.exits.find(e=>e.pawnId===patient.id)?.cell;if(!exit)return 'refused';
 if(!settled(w,p))return 'handled';
 if(row.phase==='approach'){
  if(!settled(w,patient))return 'handled';
  if(Math.abs(p.x-patient.x)+Math.abs(p.z-patient.z)>1){ctx.move(patient,false);return 'handled';}
  if(row.captureOnPickup259&&!hostedCaptive259(w,patient)){if(!autoCapturePatient259(w,patient)||!completeCapture(w,patient,undefined,true))return 'refused';}
  row.phase='carry';p.path=[];p.motion=null;patient.path=[];syncGroupHumanPassenger257(w,p);
 }
 if(!same(p,exit)){ctx.move(exit,true);syncGroupHumanPassenger257(w,p);return 'handled';}
 p.path=[];p.state='idle';patient.path=[];patient.motion=null;patient.moveCooldown=0;row.phase='waiting';return 'handled';
}

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const fields=(v:Record<string,unknown>,keys:readonly string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const dense=(v:unknown):v is unknown[]=>Array.isArray(v)&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(i))!,'value')).every(Boolean);
/** Admissions survive number-only migrations within the supported closed
 * family; the original revision still controls the older formation rules. */
const supportsGroupAdmission257=(version:number):boolean=>version===257||version===258||version===259||version===260||version===261||version===262||isSchema263OrLater(version);
export function validGroupAdmission257(value:unknown,version:number):value is GroupAdmission257|undefined {return value===undefined||supportsGroupAdmission257(version)&&record(value)&&fields(value,['revision'])&&(value.revision===1||version>=259&&value.revision===2);}
/** Raw references are checked against the actual local owner array. This is
 * not a capability flag that can admit another map's human. */
/** A fine physical impact can follow the last civil admission reconciliation.
 * Only the save reader may retain its already-owned formation until the next
 * ordinary reconciliation. New commands and runtime admission keep every refusal. */
function savedStaggerInCurrentFineWindow297(w:World,p:Pawn,version:number):boolean {
 if(!isCorePhysicalSchema297(version)||Number(w.schemaVersion)!==version)return false;
 const stagger=p.stagger;if(!record(stagger)||!fields(stagger,['sinceCore','untilCore']))return false;
 let core:number;try{core=effectiveCore297(w);}catch{return false;}
 const macro=w.tick*10;
 return core>macro&&stagger.sinceCore>macro&&stagger.sinceCore<=core&&validStagger(stagger,version,w.tick,core);
}
export function validGroupHumanPreparation257(value:unknown,w:World,g:PreparingGroup,version:number,referencesOnly=false):boolean {
 if(value===undefined)return !g.admission;
 if(!supportsGroupAdmission257(version)||!g.admission||!record(value)||!fields(value,['revision','releaseIds','passengers',...Object.hasOwn(value,'undraftIds261')?['undraftIds261']:[]])||value.revision!==1||!dense(value.releaseIds)||!dense(value.passengers))return false;
 const undraft=Object.hasOwn(value,'undraftIds261')?value.undraftIds261:undefined;
 if(Object.hasOwn(value,'undraftIds261')&&((version!==261&&(Number(version)!==262&&!isSchema263OrLater(Number(version))))||!dense(undraft)||!undraft.length||undraft.some(id=>!Number.isSafeInteger(id)||!g.memberIds.includes(id as number))||new Set(undraft).size!==undraft.length))return false;
 const ids=new Set(g.memberIds),pawns=new Map(w.pawns.map(p=>[p.id,p])),released=new Set<number>(),patients=new Set<number>(),carrying=new Set<number>();
 const members=g.memberIds.map(id=>pawns.get(id));if(!referencesOnly&&(members.some(p=>!p||!!groupHumanAdmissionReasonCore257(w,p,Array.isArray(undraft)&&undraft.includes(p.id),savedStaggerInCurrentFineWindow297(w,p,version)))||!members.some(p=>groupFreeHuman257(p!)&&groupHumanMobile257(p!))))return false;
 for(const id of value.releaseIds){if(!Number.isSafeInteger(id)||!ids.has(id as number)||released.has(id as number))return false;released.add(id as number);}
 if(released.size&&g.phase!=='gathering')return false;
 if(!referencesOnly&&Array.isArray(undraft)&&undraft.some(id=>!pawns.get(id as number)?.draft))return false;
 const animalCarriers=new Set(Array.isArray(g.animalPreparation?.lines)?g.animalPreparation.lines.filter(row=>row?.mode==='carry').map(row=>row.handlerId):[]);
 for(const row of value.passengers){
  if(!record(row)||!fields(row,['pawnId','carrierId','phase',...Object.hasOwn(row,'captureOnPickup259')?['captureOnPickup259']:[]])||Object.hasOwn(row,'captureOnPickup259')&&(version<259||g.admission.revision!==2||row.captureOnPickup259!==true)||!Number.isSafeInteger(row.pawnId)||!Number.isSafeInteger(row.carrierId)||row.pawnId===row.carrierId||!ids.has(row.pawnId as number)||!ids.has(row.carrierId as number)||patients.has(row.pawnId as number)||!['approach','carry','waiting'].includes(String(row.phase)))return false;
  const patientId=row.pawnId as number,carrierId=row.carrierId as number;if(animalCarriers.has(carrierId)||row.phase==='waiting'&&g.phase!=='leaving')return false;patients.add(patientId);
  if(row.phase==='carry'){if(g.phase!=='leaving'||released.size||carrying.has(carrierId))return false;carrying.add(carrierId);}
  if(row.captureOnPickup259){if(!actualReform259(w))return false;if(referencesOnly){if(!projectedCapturePatient259(w,g,patientId))return false;}else{const patient=pawns.get(patientId);if(!patient||(row.phase==='approach'?!autoCapturePatient259(w,patient):!hostedCaptive259(w,patient)||patient.prisoner!.capturedAt>w.tick))return false;}}
  if(referencesOnly)continue;
  const p=pawns.get(patientId),carrier=pawns.get(carrierId);if(!p||!carrier||!groupHumanHandler257(carrier))return false;
  if(row.phase==='carry'){const expected=carrier.motion?{...carrier.motion}:null;if(expected)delete expected.snowEntryPending;if(p.need!==null||p.path.length||p.medicalSleep||scoutActiveTask(p)||!same(p,carrier)||p.moveCooldown!==carrier.moveCooldown||JSON.stringify(p.motion??null)!==JSON.stringify(expected))return false;}
  if(row.phase==='waiting'){const exit=g.exits.find(e=>e.pawnId===p.id)?.cell;if(!exit||!same(p,exit)||!settled(w,p))return false;}
 }
 if(value.passengers.some(row=>patients.has((row as {carrierId:number}).carrierId)))return false;
 return referencesOnly||members.every(p=>(p!.state!=='downed'||patients.has(p!.id))&&(released.has(p!.id)||!scoutActiveTask(p!)&&!p!.deepWork&&!p!.openCasket&&!p!.medicalSleep));
}
