import {markPileWrite} from './pile-index.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaReason } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { surgeryRequestReason,medicalSurgerySpeed,surgerySuccessChance,surgeryBaseXp } from './surgery-rules.ts';
import { ARTIFICIAL_PARTS,installArtificialPart } from './artificial-parts.ts';
import {artificialPartAvailable273} from './artificial-parts-rules.ts';
import {isProstheticItem273} from './prosthetic-content-273.ts';
import {isFreeSurgeryDoctor280} from './prisoner-surgery-rules-280.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {isWithinPart} from './injury-rules.ts';
import {groundCapacity,groundPile,nearbyGround} from './ground-placement.ts';
import {addMaterial,refreshStock} from './materials.ts';
import { resolveSurgeryOutcome } from './surgery-outcomes.ts';
import { administerAnesthetic,canAdministerAnesthetic } from './anesthetic.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { lyingPatient,patientClaimed,bedsideAccess } from './care-access.ts';
import { rescueBedAvailable } from './medical-beds.ts';
import { carrierOf } from './rescue-state.ts';
import { currentMedicalBed,bedSurgeryFactor } from './hospital-medical-stats.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { canStandAt } from './furniture-travel.ts';
import { medicineAllowed } from './medicine-rules.ts';
import { updatePawnHealth,reconcilePawnHealth,healthRandom } from './health.ts';
import { learnSkill } from './skills.ts';
import { captureCleanliness } from './filth-room.ts';
import { surgeryOutdoors } from './surgery-room.ts';
import { releaseWork } from './work-release.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { planImplantIngredients,validImplantTaskRelations,gatherImplantIngredient,implantIngredientsReady,consumeImplantIngredients,consumeImplantAnestheticDose273 } from './surgery-ingredients.ts';
import type { SurgeryTask } from './surgery-state.ts';
import type { Reachability } from './pathfinding.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,Pawn,World,MaterialPile } from './types.ts';
import { structureById } from './structure-navigation.ts';

const release=(w:World,d:Pawn):void=>{if(!releaseWork(w,d))interruptWork(w,d);};
export function implantSurgeryReason(w:World,d:Pawn,p:Pawn|undefined,accepted=false):string|undefined {
  if(!isFreeSurgeryDoctor280(d))return 'Seul un colon libre peut opérer.';
  if(!accepted&&p){const reason=allowedAreaReason(w,d,p);if(reason)return reason;}
  const task=accepted?d.surgery:undefined,request=p?.surgeryRequest;
  const refusal=backgroundWorkRefusal(d,'doctor')??medicalWorkRefusal(d);if(refusal)return refusal;
  if(workPriority(d,'doctor')===0)return 'Médecin est désactivé.';
  if(d.interruptedCargo)return 'Déposer la cargaison avant l’opération.';
  if(w.schemaVersion<210||!p||p===d||!request?.implant)return 'Aucune demande de prothèse valide.';
  if(!artificialPartAvailable273(request.implant,w.schemaVersion))return 'Cette prothèse est indisponible dans ce schéma.';
  if(d.skills.medicine.level<ARTIFICIAL_PARTS[request.implant].medicineSkill)return `Médecine ${ARTIFICIAL_PARTS[request.implant].medicineSkill} est requise pour poser cette prothèse.`;
  const reason=surgeryRequestReason(p,request.part,{version:w.schemaVersion,implant:request.implant,...task?.consumedMedicine?{allowAnesthetic:true as const}:{}});if(reason)return reason;
  if(task&&(task.implant!==request.implant||task.part!==request.part))return 'La prothèse demandée a changé.';
  if(task?.consumedMedicine&&!medicineAllowed(p,task.consumedMedicine))return 'Le plafond médical du patient interdit ce médicament.';
  if(!lyingPatient(p)||carrierOf(w,p.id))return 'Le patient doit être installé dans un lit.';
  const bed=currentMedicalBed(w,p,false);
  if(bed?.kind==='double-bed')return 'L’opération exige un lit simple : le lit double reste un couchage civil.';
  if(!bed||!rescueBedAvailable(w,bed,p,d.id)||p.x!==bed.x||p.z!==bed.z||task&&task.bedId!==bed.id)return 'Le lit du patient n’est plus disponible.';
  if(patientClaimed(w,p.id,d))return 'Le patient est déjà pris en charge.';
  if(task&&(Math.abs(task.spot.x-bed.x)+Math.abs(task.spot.z-bed.z)!==1||!canStandAt(w,task.spot)||reservedServiceCells(w,d.id).has(task.spot.z*w.width+task.spot.x)))return 'Le chevet n’est plus disponible.';
  return undefined;
}
export function implantSurgeryProposal(w:World,d:Pawn,p:Pawn,reach:Reachability):{task:SurgeryTask;path:Cell[]}|undefined {
  if(implantSurgeryReason(w,d,p))return;
  const access=bedsideAccess(w,d,p,reach);if(!access)return;
  const planned=planImplantIngredients(w,d,p,access.spot,reach);if(!planned)return;
  return {path:planned.path,task:{patientId:p.id,part:p.surgeryRequest!.part,implant:p.surgeryRequest!.implant,bedId:currentMedicalBed(w,p,false)!.id,spot:access.spot,ingredients:planned.ingredients,phase:'pickup',progress:0,workCore:0}};
}
export function processImplantSurgery(w:World,d:Pawn,context:NeedContext,doctorGlow:()=>number,patientGlow:(cell:Cell)=>number):void {
  if(!allowedAreaServicesAllowed(w,d)){release(w,d);return;}
  const task=d.surgery;if(!task?.implant)return;
  const p=w.pawns.find(p=>p.id===task.patientId);
  if(d.health&&medicalCivilTick271(d.health)<w.tick)updatePawnHealth(w,d);
  if(p?.health&&medicalCivilTick271(p.health)<w.tick)updatePawnHealth(w,p);
  if(d.surgery!==task)return;
  if(!p||implantSurgeryReason(w,d,p,true)||!validImplantTaskRelations(w,d,p,task)){release(w,d);return;}
  if(task.ingredients?.some(i=>i.stage!=='placed')){if(!gatherImplantIngredient(w,d,task,context))release(w,d);return;}
  if(d.moveCooldown>0)return;
  if(d.x!==task.spot.x||d.z!==task.spot.z){context.move(task.spot,true);return;}
  if(!task.consumedMedicine){
    const item=implantIngredientsReady(w,d,p,task);
    if(!item||!canAdministerAnesthetic(p.health!)){release(w,d);return;}
    if(isProstheticItem273(task.implant)&&!planArtificialRestitution273(w,p,task.part,task.ingredients)){reportRestitutionBlocked273(w,p,context);release(w,d);return;}
    // Clinical, ownership and capacity guards precede the anesthesia draw.
    // Historical wood consumes its full ledger here; industrial inputs retain
    // the actual piece and second dose until the final recipe toil.
    if(!administerAnesthetic(p.health!,()=>healthRandom(w))){release(w,d);return;}
    if(isProstheticItem273(task.implant))consumeImplantAnestheticDose273(w,task);else consumeImplantIngredients(w,task);
    task.consumedMedicine=item;task.phase='work';
    reconcilePawnHealth(w,p);
    context.event(`${d.name} anesthésie ${p.name} et commence la pose de la prothèse.`);
  }
  const gained=10*medicalSurgerySpeed(d,doctorGlow()),finishing=task.progress+gained>=ARTIFICIAL_PARTS[task.implant].work;
  const restitution=isProstheticItem273(task.implant)&&finishing?planArtificialRestitution273(w,p,task.part,task.ingredients):[];
  // Local transactional adaptation: prove every return before final dose/piece
  // consumption, outcome RNG or anatomy. A blocked finish retains valid work.
  if(!restitution){reportRestitutionBlocked273(w,p,context);return;}
  d.state='working';d.path=[];task.workCore+=10;task.progress+=gained;
  if(!finishing)return;
  learnSkill(d.skills.medicine,surgeryBaseXp(task.workCore),d);
  if(isProstheticItem273(task.implant))consumeImplantIngredients(w,task);
  const bed=structureById(w,task.bedId)!;
  const capture=captureCleanliness(w),room=capture.room(bed);
  const chance=surgerySuccessChance({doctor:d,medicine:task.consumedMedicine,bedQuality:bed.quality,bedSurgeryFactor:bedSurgeryFactor(bed,w),recipeFactor:1,patientGlow:patientGlow(bed),roomCleanliness:room?.cleanliness??null,outdoors:surgeryOutdoors(w,bed,capture)});
  const outcome=resolveSurgeryOutcome(p.health!,task.part,chance,()=>healthRandom(w),{allowMissingPart:true});
  p.health=outcome.record;
  const success=outcome.kind==='success'&&installArtificialPart(p.health,task.part,task.implant);
  if(success)commitArtificialRestitution273(w,restitution);
  delete p.surgeryRequest;reconcilePawnHealth(w,p);
  context.event(success?`${d.name} a posé la prothèse « ${ARTIFICIAL_PARTS[task.implant].label} » à ${p.name}.`:`La pose de la prothèse de ${p.name} a échoué (${outcome.kind}) ; les matériaux ont été utilisés et des soins peuvent être nécessaires.`);
  release(w,d);
}

/** Preflight every displaced added root together, before any random/physical
 * commit. Each returned root becomes a fresh Thing, never the old input ID.
 * Existing connected Near placement is retained; no teleport through walls. */
export function planArtificialRestitution273(w:World,p:Pawn,part:import('./body-definition.ts').BodyPartId,ingredients:readonly import('./surgery-state.ts').SurgicalIngredient[]=[]):MaterialPile[]|null {
 const removed=p.health?.artificialParts?.filter(old=>isWithinPart(old.part,part))??[];
 if(!removed.length)return [];
 if(!isSchema273OrLater(w.schemaVersion)||!Number.isSafeInteger(w.nextId+removed.length))return null;
 const consumed=new Map<number,number>();
 for(const i of ingredients){const q=w.piles.find(q=>q.id===i.pileId);if(i.stage!=='placed'||!q||q.item!==i.item||q.owner.type!=='ground'||q.owner.x!==i.cell.x||q.owner.z!==i.cell.z||!Number.isSafeInteger(i.quantity)||i.quantity<1)return null;consumed.set(q.id,(consumed.get(q.id)??0)+i.quantity);if(consumed.get(q.id)!>q.quantity)return null;}
 const shadow={...w,piles:w.piles.flatMap(q=>{const used=consumed.get(q.id)??0;return used===q.quantity?[]:used?[{...q,quantity:q.quantity-used}]:[q];})},result:MaterialPile[]=[],cells=nearbyGround(w,p);
 for(const old of removed){
  const item=isProstheticItem273(old.kind)?old.kind:'wood',cell=cells.find(c=>{const occupied=groundPile(shadow,c);return (!occupied||item==='wood'&&occupied.item==='wood')&&groundCapacity(shadow,c,item)>=1;});
  if(!cell)return null;
  const pile:MaterialPile={id:w.nextId+result.length,item,kind:item==='wood'?'wood':'prosthesis',quantity:1,owner:{type:'ground',...cell}};
  result.push(pile);const target=groundPile(shadow,cell);
  if(target){const index=shadow.piles.indexOf(target);shadow.piles[index]={...target,quantity:target.quantity+1};markPileWrite();}else shadow.piles.push(pile);
  if(shadow.piles.length>32768)return null;
 }
 return result;
}
export function commitArtificialRestitution273(w:World,returns:readonly MaterialPile[]):void {
 if(!returns.length)return;
 // A fresh Thing identity is allocated for every removed added root, even
 // when its new wood unit is immediately absorbed by an accessible stack.
 w.nextId+=returns.length;
 for(const pile of returns){const target=pile.owner.type==='ground'?groundPile(w,pile.owner):undefined;if(pile.item==='wood'&&target)addMaterial(w,'wood',1,pile.owner,'wood');else w.piles.push(pile);}
 refreshStock(w);
}
export function reportRestitutionBlocked273(w:World,p:Pawn,context:Pick<NeedContext,'event'>):void {
 const message=`La récupération de la prothèse de ${p.name} attend une place libre au sol. L’opération est en attente.`;
 if(!w.events.some(e=>e.message===message))context.event(message);
}
