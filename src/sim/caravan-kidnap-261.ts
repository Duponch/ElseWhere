import {shiftActorPath297} from './actor-path-source-297.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {raidGroup261,raidKidnapSource261} from './temp-map-raids-261.ts';
import {carrierOf,rescueClaim,markHumanCarrierCandidatesDirty,humanCarrierCandidates} from './rescue-state.ts';
import {patientClaimed} from './care-access.ts';
import {pawnBody,medicalWorkRefusal} from './health-rules.ts';
import {isStunned} from './stun.ts';
import {atMapEdge} from './raid-space.ts';
import {sameRescueEdge} from './rescue-save.ts';
import {planPawnDrops,releaseWork} from './work-release.ts';
import {updatePawnHealth} from './health.ts';
import {meleeContact,captureMeleePlaces,meleeRoute} from './melee-space.ts';
import {blockedCells,canStep} from './pathfinding.ts';
import {startTravel} from './movement.ts';
import {cancelMelee} from './melee-state.ts';
import {cancelShooting} from './shooting-state.ts';
import {groupHumanPassenger257,groupHumanCarrying257} from './group-human-admission-257.ts';
import type {Cell,Pawn,World} from './types.ts';
import type {NavigationGrid,SearchBudget} from './work-planner.ts';
import type {LightReader} from './light-environment.ts';

/** Approved261 reference only; never an owner, copied Pawn, bed or prisoner. */
export interface RaiderKidnap261 {patientId:number;phase:'approach'|'carry'}
type PhysicalRaider261=Pawn&{raid:NonNullable<Pawn['raid']>&{kidnap261?:RaiderKidnap261}};
const task=(p:Pawn):RaiderKidnap261|undefined=>(p as PhysicalRaider261).raid?.kidnap261;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const settled=(w:World,p:Pawn)=>p.moveCooldown===0&&(p.motion?.end??0)<=w.tick;
const EMPTY:ReadonlySet<number>=new Set();
function actualKidnapAssault261(w:World,p:Pawn):boolean {
 const a=raidGroup261(w,p.raid?.group),source=raidKidnapSource261(a);
 return !!a&&a.phase==='assault'&&!!source&&a.members.includes(p.id)&&p.worldAffiliation259?.factionId===source.factionId;
}
export const kidnapping261=(p:Pawn):RaiderKidnap261|undefined=>task(p);
export const kidnapCarrying261=(p:Pawn):boolean=>task(p)?.phase==='carry';
/** Core4871 JobDriver_Kidnap fails only after recovery AND Awake. The existing
 * current producer represents actual sleep by state/medicalSleep/Need sleep;
 * no clinical reconstruction or unconditional state!=downed drop is added. */
export const kidnapRecoveredAwake261=(p:Pawn):boolean=>p.state!=='downed'&&p.state!=='sleeping'&&!p.medicalSleep&&!(p.need?.kind==='sleep'&&p.need.phase==='sleep');
export const kidnapCarrierOf261=(w:World,id:number):Pawn|undefined=>humanCarrierCandidates(w.pawns).find(p=>task(p)?.phase==='carry'&&task(p)?.patientId===id);
export function kidnapCarryPairs261(w:World):readonly {carrierId:number;patientId:number}[] {
 return w.pawns.flatMap(p=>task(p)?.phase==='carry'?[{carrierId:p.id,patientId:task(p)!.patientId}]:[]);
}
/** Deep physical edge value only. The patient performs no terrain entry/trap
 * or independent snow transaction and receives no shared mutable edge arrays. */
export function kidnapBodyProjection261(carrier:Pawn):Pick<Pawn,'x'|'z'|'motion'|'moveCooldown'> {
 const motion=carrier.motion?structuredClone(carrier.motion):null;if(motion)delete motion.snowEntryPending;
 return {x:carrier.x,z:carrier.z,motion,moveCooldown:carrier.moveCooldown};
}
export function syncKidnappedPatient261(w:World,carrier:Pawn):void {
 const t=task(carrier);if(t?.phase!=='carry')return;
 const p=w.pawns.find(p=>p.id===t.patientId);if(!p)return;
 Object.assign(p,kidnapBodyProjection261(carrier));p.path=[];
}
/** Releasing the link never clears the captured edge, kills, clones or exports
 * the patient. Existing health/body notifiers retain their normal ownership. */
export function releaseKidnap261(w:World,carrier:Pawn):void {
 const t=task(carrier);if(!t)return;
 const patient=w.pawns.find(p=>p.id===t.patientId),r=(carrier as PhysicalRaider261).raid;
 if(t.phase==='carry'&&patient?.health&&!patient.health.death&&patient.health.tick<w.tick)updatePawnHealth(w,patient);
 syncKidnappedPatient261(w,carrier);
 delete r.kidnap261;r.goal=null;r.exiting=false;carrier.path=[];carrier.planCooldown=0;
 if(patient){patient.planCooldown=0;patient.needCooldown=0;}
}
/** The true controller/faction/target eligibility is supplied by the shared
 * native admission owner. These physical checks neither invent trigger policy
 * nor reinterpret a player's captive as a member of the captor's faction. */
export function physicalKidnapReason261(w:World,carrier:Pawn,patient:Pawn,continuing=false):string|undefined {
 if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||carrier===patient||!w.pawns.includes(carrier)||!w.pawns.includes(patient)||!carrier.raid||!actualKidnapAssault261(w,carrier))return 'Les deux personnes originales ne possèdent plus ce vrai mandat d’assaut.';
 if(carrier.state==='dead'||carrier.state==='downed'||carrier.state==='sleeping'||carrier.need||carrier.health?.death||carrier.prisoner||carrier.visitor||carrier.mental?.crisis||carrier.burning||carrier.flee||carrier.collapsePending||medicalWorkRefusal(carrier)||pawnBody(carrier).capacities.moving<=0)return 'Le ravisseur ne peut plus porter cette personne.';
 if(carrierOf(w,carrier.id)||kidnapCarrierOf261(w,carrier.id)||groupHumanPassenger257(w,carrier.id)||groupHumanCarrying257(w,carrier.id)||carrier.rescue||carrier.animalRescue||carrier.surgery||carrier.interruptedCargo||carrier.equipmentDropPending)return 'Le ravisseur possède un autre engagement physique.';
 if(patient.state==='dead'||patient.health?.death||!continuing&&patient.state!=='downed')return 'La victime ne relève plus de la prise à terre.';
 if(patient.worldAffiliation259?.factionId!==w.worldFactions?.playerFactionId)return 'La victime ne possède pas la faction joueuse originale.';
 const own=task(carrier),other=kidnapCarrierOf261(w,patient.id),ordinary=carrierOf(w,patient.id);
 if(other&&other!==carrier||ordinary&&ordinary!==carrier||rescueClaim(w,patient.id,carrier.id)||patientClaimed(w,patient.id,carrier)||w.pawns.some(p=>p!==carrier&&task(p)?.patientId===patient.id))return 'Une autre personne détient la réservation physique de la victime.';
 if(own&&own.patientId!==patient.id||groupHumanPassenger257(w,patient.id)||groupHumanCarrying257(w,patient.id)||patient.rescue||patient.animalRescue||patient.surgery||patient.interruptedCargo||patient.equipmentDropPending)return 'La victime doit terminer son autre engagement physique.';
}
/** ClosestTouch reuses the existing real local contact/diagonal-corner reader.
 * Both captured edges must finish
 * before the original is picked up; a destination-cell coordinate is not an
 * already established contact while its movement interpolation is unfinished. */
export function kidnapPickupReady261(w:World,carrier:Pawn,patient:Pawn):boolean {
 return !physicalKidnapReason261(w,carrier,patient)&&settled(w,carrier)&&settled(w,patient)&&!isStunned(carrier,w.tick*10)&&meleeContact(w,carrier,patient,blockedCells(w,true));
}
/** Caller has selected the actual victim through the native trigger/selection
 * authority. This function adds no target score, random policy or timer. */
export function startPhysicalKidnap261(w:World,carrier:Pawn,patient:Pawn):boolean {
 if(task(carrier)||carrier.raid?.exiting||physicalKidnapReason261(w,carrier,patient)||!settled(w,carrier)||carrier.melee?.strike||carrier.shooting?.stance||isStunned(carrier,w.tick*10))return false;
 cancelMelee(carrier);cancelShooting(carrier);delete carrier.tactics;carrier.path=[];carrier.planCooldown=0;
 (carrier as PhysicalRaider261).raid.goal=null;(carrier as PhysicalRaider261).raid.kidnap261={patientId:patient.id,phase:'approach'};markHumanCarrierCandidatesDirty();return true;
}
/** Call immediately after each real health update, before actor-order dispatch
 * or corpse materialization. Downing/death of a carrier drops the SAME body's
 * preserved edge; patient death releases the link for ordinary corpse ownership. */
export function reconcileKidnapParticipant261(w:World,p:Pawn):void {
 const own=task(p);if(own){const patient=w.pawns.find(q=>q.id===own.patientId);if(!patient||physicalKidnapReason261(w,p,patient,own.phase==='carry')||kidnapRecoveredAwake261(patient))releaseKidnap261(w,p);}
 const carrier=kidnapCarrierOf261(w,p.id);if(carrier&&(p.state==='dead'||p.health?.death||kidnapRecoveredAwake261(p)))releaseKidnap261(w,carrier);
}
/** Existing admitted mandate only. Actual current() revalidates the native
 * controller/target authority; recovery follows JobDriver_Kidnap directly. */
export function processPhysicalKidnap261(w:World,carrier:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader):'none'|'handled'|'exit' {
 const t=task(carrier);if(!t)return 'none';const patient=w.pawns.find(p=>p.id===t.patientId);
 if(!patient||physicalKidnapReason261(w,carrier,patient,t.phase==='carry')||kidnapRecoveredAwake261(patient)){releaseKidnap261(w,carrier);return 'handled';}
 if(t.phase==='carry'){syncKidnappedPatient261(w,carrier);return 'exit';}
 if(patient.health&&patient.health.tick<w.tick)updatePawnHealth(w,patient);
 if(kidnapRecoveredAwake261(patient)||physicalKidnapReason261(w,carrier,patient)){releaseKidnap261(w,carrier);return 'handled';}
 if(!kidnapPickupReady261(w,carrier,patient)){
  if(!settled(w,carrier)||!settled(w,patient))return 'handled';
  if(!carrier.path.length){if(!budget.remaining||carrier.planCooldown)return 'handled';budget.remaining--;carrier.planCooldown=20;
   const route=meleeRoute(w,carrier,captureMeleePlaces(w,carrier)(patient),getBlocked());if(!route)return 'handled';carrier.path=route;carrier.raid!.goal=route.at(-1)??null;}
  const next=carrier.path[0];if(!next)return 'handled';
  if(!canStep(w,carrier,next,getBlocked(),EMPTY)){carrier.path=[];carrier.raid!.goal=null;carrier.planCooldown=0;return 'handled';}
  carrier.state='moving';if(startTravel(w,carrier,next,getLight))shiftActorPath297(carrier.path);return 'handled';
 }
 const drops=planPawnDrops(w,new Set([patient.id]));if(!drops||!releaseWork(w,patient,drops))return 'handled';
 patient.need=null;delete patient.medicalSleep;patient.path=[];carrier.path=[];carrier.raid!.exiting=true;carrier.raid!.goal=null;t.phase='carry';syncKidnappedPatient261(w,carrier);
 return 'exit';
}
/** Final physical half only. ROOT must also admit the two actual terminal
 * WorldPawn rows and possessions in ONE staged transaction before removal. */
export function kidnapExitPhysicalReason261(w:World,carrier:Pawn,patient:Pawn):string|undefined {
 const t=task(carrier);if(t?.phase!=='carry'||t.patientId!==patient.id||!carrier.raid?.exiting||physicalKidnapReason261(w,carrier,patient,true)||kidnapRecoveredAwake261(patient))return 'Le portage original ne possède plus son mandat.';
 if(!atMapEdge(w,carrier)||!same(carrier,patient)||!settled(w,carrier)||!settled(w,patient)||!sameRescueEdge(carrier.motion,patient.motion)||carrier.moveCooldown!==patient.moveCooldown)return 'La sortie physique commune n’est pas encore atteinte.';
 if(isStunned(carrier,w.tick*10)||carrier.melee?.strike||carrier.shooting?.stance||carrier.need||carrier.state==='sleeping')return 'Le ravisseur doit terminer son action avant la sortie.';
}
