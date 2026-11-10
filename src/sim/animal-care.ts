import {assignPileOwner} from './pile-index.ts';
import {releaseAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {animalConditionCareTargets256,animalConditionTreatmentBatch256,animalConditionMedicineCount256,type ActualAnimalTreatment256} from './animal-condition-care-256.ts';
import {tendAnimalAgeCondition256} from './animal-age-condition-runtime-256.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { isColonist } from './affiliation.ts';
import { animalClaimed,animalCarrier } from './animal-rest-state.ts';
import { medicalTendQuality,medicalTendSpeed } from './care-rules.ts';
import { medicalModel,modelHasPart } from './body-model.ts';
import { infectionTargets,tendInfection,captureInfectionTendRoom } from './infection-state.ts';
import { infectionRoomFactor } from './infection-room.ts';
import { freshMissing,injuryBleed,tendInjury,tendMissingPart } from './injury-state.ts';
import { HP_UNIT,injuryPartRules } from './injury-rules.ts';
import { healthRandom } from './health.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { reservedSource } from './materials.ts';
import { medicineClaims } from './medicine-logistics.ts';
import { veterinaryCareSpeciesAllowed } from './veterinary-rules.ts';
import { animalSpecies } from './animal-species.ts';
import { MEDICAL_CARE,MEDICINES,isMedicine,tendQuality,tendXp,type MedicalCare,type MedicineItem } from './medicine-rules.ts';
import { copyPileCondition } from './pile-condition.ts';
import { adjacent,routeCost,routeToCell,routeToJob,workNeighbours,type Reachability } from './pathfinding.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { canStandAt } from './furniture-travel.ts';
import { learnSkill } from './skills.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { releaseWork } from './work-release.ts';
import { advanceAnimalHealth,reconcileAnimalHealth } from './wildlife-health.ts';
import type { WildAnimal } from './wildlife-state.ts';
import type { AnimalCareTask } from './domestic-state.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,CommandResult,Pawn,World } from './types.ts';

export interface AnimalCareProposal {task:AnimalCareTask;path:Cell[];target:WildAnimal}
export type AnimalCareContext=NeedContext&{candidates:()=>Reachability|null;blocked:()=>Uint8Array};

/** The ordinary patient must belong to the colony and stay physically down.
 * The anatomy comes from the animal record, never a surrogate human Pawn. */
function patientReady(w:World,a:WildAnimal,doctor?:Pawn):boolean {
  return (!doctor||allowedAreaAllows(w,doctor,a))&&!a.manhunter&&veterinaryCareSpeciesAllowed(a.species,w.schemaVersion,a)&&!!a.domestic&&a.domestic.care!=='none'&&
    (a.state==='downed'||a.state==='sleeping')&&(!a.motion||a.motion.end<=w.tick)&&
    (w.schemaVersion<212||!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!a.stun&&!(a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined))&&
    !!a.health&&!a.health.death&&animalCareTargets(a).length>0&&
    !animalCarrier(w,a.id)&&!animalClaimed(w,a.id,doctor?.id);
}
function doctorReady(p:Pawn):boolean {
  return isColonist(p)&&!p.prisoner&&!p.visitor&&!p.draft&&!p.burning&&!p.mental?.crisis&&
    !p.interruptedCargo&&workPriority(p,'doctor')>0&&!medicalWorkRefusal(p);
}
export function animalCareTargets(a:WildAnimal):ActualAnimalTreatment256[] {
  const h=a.health;if(a.manhunter||!h||h.death||h.body!==a.species||!a.domestic||a.domestic.care==='none')return [];
  const model=medicalModel(h),rules=injuryPartRules(model),list:ActualAnimalTreatment256[]=[];
  for(const i of h.injuries)if(i.tended===undefined&&i.scar?.pain===undefined&&modelHasPart(model,i.part))
    list.push({injuryId:i.id,priority:injuryBleed(h,i)*1.5,severity:i.severity});
  for(const m of h.missing)if(modelHasPart(model,m.part)&&freshMissing(h,m))
    list.push({part:m.part,priority:model.byId[m.part].hp*.12*rules[m.part].bleed*1.5,severity:HP_UNIT});
  for(const i of infectionTargets(h))list.push({infectionId:i.infectionId,priority:i.priority,severity:i.severity});
  list.push(...animalConditionCareTargets256(h));
  return list.sort((x,y)=>y.priority-x.priority||y.severity-x.severity);
}
export function animalCareWanted(w:World,doctor:Pawn):boolean {
  return doctorReady(doctor)&&!!w.wildlife?.animals.some(a=>patientReady(w,a,doctor));
}
function medicineAllowed(care:MedicalCare,item:MedicineItem):boolean {
  return care==='best'||care==='industrial'&&MEDICINES[item].potency<=1||care==='herbal'&&MEDICINES[item].potency<=.6;
}
/** A reservation changes only the proposed task. Source stock stays physical. */
function reserveMedicine(w:World,doctor:Pawn,a:WildAnimal,task:AnimalCareTask,reach:Reachability):Cell[]|undefined {
  const needed=animalConditionMedicineCount256(a.health!,animalCareTargets(a));if(!needed)return;
  const care=a.domestic!.care;
  const sources=w.piles.filter(p=>materialAllowedForPlayer256(p)&&p.owner.type==='ground'&&allowedAreaAllows(w,doctor,p.owner)&&isMedicine(p.item)&&medicineAllowed(care,p.item)
    &&p.quantity>reservedSource(w,p.id)&&medicineClaims(w,p.id)<10);
  sources.sort((x,y)=>MEDICINES[y.item as MedicineItem].potency-MEDICINES[x.item as MedicineItem].potency||
    (x.owner.type==='ground'?(x.owner.x-a.x)**2+(x.owner.z-a.z)**2:Infinity)-
    (y.owner.type==='ground'?(y.owner.x-a.x)**2+(y.owner.z-a.z)**2:Infinity)||x.id-y.id);
  for(const pile of sources){
    if(pile.owner.type!=='ground'||!isMedicine(pile.item))continue;
    const path=routeToJob(w,pile.owner,reach,true);if(!path)continue;
    task.medicine={item:pile.item,sourcePileId:pile.id,carryPileId:null,quantity:Math.min(needed,pile.quantity-reservedSource(w,pile.id),25)};
    task.phase='pickup';return path;
  }
}
export function animalCareProposal(w:World,doctor:Pawn,reach:Reachability):AnimalCareProposal|undefined {
  if(!animalCareWanted(w,doctor))return;
  const reserved=reservedServiceCells(w,doctor.id);
  let best:{target:WildAnimal;spot:Cell;path:Cell[];cost:number}|undefined;
  for(const target of w.wildlife!.animals)if(patientReady(w,target,doctor))
    for(const spot of workNeighbours(target))if(canStandAt(w,spot)&&!reserved.has(spot.z*w.width+spot.x)){
      const path=routeToCell(w,spot,reach);if(!path)continue;
      const cost=routeCost(w,path,reach);
      if(!best||cost<best.cost||cost===best.cost&&target.id<best.target.id)best={target,spot,path,cost};
    }
  if(!best)return;
  const task:AnimalCareTask={animalId:best.target.id,spot:best.spot,phase:'approach',progress:0};
  return {task,path:reserveMedicine(w,doctor,best.target,task,reach)??best.path,target:best.target};
}
export function startAnimalCare(doctor:Pawn,proposal:AnimalCareProposal):void {
  doctor.animalCare=proposal.task;doctor.path=proposal.path;doctor.state='moving';doctor.planCooldown=0;
}
export function animalCareInProgress(w:World,a:WildAnimal):boolean {
  if(a.manhunter||!veterinaryCareSpeciesAllowed(a.species,w.schemaVersion,a)||!a.domestic||a.state!=='downed'&&a.state!=='sleeping'||a.burning||a.flee||a.threat||a.retaliation)return false;
  if(w.schemaVersion>=212&&(a.strike||a.stun||(a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined)||a.health?.death||a.domestic.care==='none'||a.motion&&a.motion.end>w.tick))return false;
  return w.pawns.some(p=>p.animalCare?.animalId===a.id&&p.animalCare.phase==='treat'&&doctorReady(p)&&
    p.moveCooldown===0&&(!p.motion||p.motion.end<=w.tick)&&!p.path.length&&
    p.x===p.animalCare.spot.x&&p.z===p.animalCare.spot.z&&adjacent(p,a));
}
function taskValid(w:World,doctor:Pawn,a:WildAnimal,task:AnimalCareTask):boolean {
  if(!doctorReady(doctor)||!patientReady(w,a,doctor)||!canStandAt(w,task.spot)||!adjacent(task.spot,a))return false;
  const m=task.medicine;if(!m)return task.phase!=='pickup';
  if(!medicineAllowed(a.domestic!.care,m.item))return false;
  const pile=w.piles.find(p=>p.id===(task.phase==='pickup'?m.sourcePileId:m.carryPileId));
  return !!pile&&materialAllowedForPlayer256(pile)&&pile.item===m.item&&(task.phase==='pickup'?pile.owner.type==='ground'&&reservedSource(w,pile.id)<=pile.quantity&&medicineClaims(w,pile.id)<=10:
    pile.owner.type==='pawn'&&pile.owner.pawnId===doctor.id&&pile.quantity===m.quantity);
}
function releaseCare(w:World,doctor:Pawn):void {if(!releaseWork(w,doctor))interruptWork(w,doctor);}
function pickup(w:World,doctor:Pawn,task:AnimalCareTask,ctx:NeedContext):void {
  const m=task.medicine!,pile=w.piles.find(p=>p.id===m.sourcePileId);
  if(!pile||!materialAllowedForPlayer256(pile)||pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity){interruptWork(w,doctor);return;}
  if(!adjacent(doctor,pile.owner)&&(doctor.x!==pile.owner.x||doctor.z!==pile.owner.z)){ctx.move(pile.owner,false);return;}
  if(pile.quantity===m.quantity){assignPileOwner(pile,{type:'pawn',pawnId:doctor.id});m.carryPileId=pile.id;}
  else {
    if(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1)){interruptWork(w,doctor);return;}
    pile.quantity-=m.quantity;m.carryPileId=w.nextId++;
    w.piles.push({id:m.carryPileId,kind:'medicine',item:m.item,quantity:m.quantity,owner:{type:'pawn',pawnId:doctor.id},...copyPileCondition(pile)});
  }
  task.phase='approach';doctor.path=[];doctor.state='moving';
}
function consumeMedicine(w:World,task:AnimalCareTask):void {
  const m=task.medicine;if(!m)return;
  const pile=w.piles.find(p=>p.id===m.carryPileId)!;
  pile.quantity--;m.quantity--;
  if(!pile.quantity){w.piles.splice(w.piles.indexOf(pile),1);delete task.medicine;}
}
export function processAnimalCare(w:World,doctor:Pawn,ctx:AnimalCareContext,light:()=>number):void {
  if(!allowedAreaServicesAllowed(w,doctor)){releaseCare(w,doctor);return;}
  const task=doctor.animalCare;if(!task)return;
  const patient=w.wildlife?.animals.find(a=>a.id===task.animalId);
  if(patient?.health&&patient.health.tick<w.tick&&!patient.health.death)advanceAnimalHealth(w,patient);
  if(!patient||!taskValid(w,doctor,patient,task)){releaseCare(w,doctor);return;}
  if(task.phase==='pickup'){pickup(w,doctor,task,ctx);return;}
  if(doctor.x!==task.spot.x||doctor.z!==task.spot.z){ctx.move(task.spot,true);return;}
  task.duration??=Math.max(1,Math.floor(600/medicalTendSpeed(doctor,light())));
  releaseAnimalThermalRefuge288(w,patient);task.phase='treat';doctor.state='working';doctor.path=[];task.progress+=10;
  if(task.progress<task.duration)return;
  const batch=animalConditionTreatmentBatch256(patient.health!,animalCareTargets(patient),!!task.medicine);
  if(!batch.length){releaseCare(w,doctor);return;}
  const item=task.medicine?.item;
  learnSkill(doctor.skills.medicine,tendXp(item),doctor);
  const quality=medicalTendQuality(doctor),record=patient.health!;
  let roomFactor:number|undefined;
  for(const target of batch){
    if('animalConditionId'in target){
      const rule=item?MEDICINES[item]:{potency:.3,maxQuality:.7},f=Math.fround;
      const base=f(Math.max(0,Math.min(f(rule.maxQuality),f(f(quality)*f(rule.potency)))));
      const random={value:()=>healthRandom(w),integer:(a:number,b:number)=>a+Math.floor(healthRandom(w)*(b-a)),float:(a:number,b:number)=>b<=a?a:f(f(f(healthRandom(w))*f(b-a))+a)};
      tendAnimalAgeCondition256(record,target.animalConditionId,base,rule.maxQuality,random);
    }else if(target.injuryId!==undefined){
      tendInjury(record,target.injuryId,tendQuality(quality,healthRandom(w),false,item));
      if(record.injuries.some(i=>i.id===target.injuryId&&i.infection)){
        roomFactor??=infectionRoomFactor(w,patient);captureInfectionTendRoom(record,target.injuryId,roomFactor);
      }
    }else if(target.infectionId!==undefined)tendInfection(record,target.infectionId,tendQuality(quality,healthRandom(w),false,item));
    else if(target.part!==undefined)tendMissingPart(record,target.part);
  }
  consumeMedicine(w,task);reconcileAnimalHealth(w,patient);
  ctx.event(`${doctor.name} a soigné ${patient.species==='hare'?'le lièvre':animalSpecies(patient.species).label} ${patient.id} ${item?`avec ${ITEM_DEFINITIONS[item].label}`:'sans médicament'}.`);
  task.progress=0;delete task.duration;
  if(!animalCareTargets(patient).length||item&&!task.medicine){releaseCare(w,doctor);return;}
  task.phase='approach';doctor.state='moving';
}
export function applyAnimalCarePolicy(w:World,command:{animalId:number;care:MedicalCare}):CommandResult {
  const animal=w.wildlife?.animals.find(a=>a.id===command.animalId);
  if(!animal||!veterinaryCareSpeciesAllowed(animal.species,w.schemaVersion,animal)||!animal.domestic||!Object.hasOwn(MEDICAL_CARE,command.care))
    return {ok:false,code:'invalid-command',reason:w.schemaVersion>=212?'Animal possédé admissible ou politique médicale introuvable.':'Lièvre possédé ou politique médicale introuvable.'};
  if(animal.domestic.care===command.care)return {ok:true};
  animal.domestic.care=command.care;
  for(const doctor of w.pawns)if(doctor.animalCare?.animalId===animal.id)interruptWork(w,doctor);
  return {ok:true};
}
