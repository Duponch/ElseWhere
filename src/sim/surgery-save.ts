import {isDoubleBedKind} from './bed-kinds.ts';
import {isSchema273OrLater,isSchema280OrLater} from './schema-compatibility-257.ts';
import {anestheticCivilBornAt271} from './anesthetic.ts';
import { isColonist } from './affiliation.ts';
import { isBedKind } from './bed-kinds.ts';
import { lyingPatient,bedServicePlace339 } from './care-access.ts';
import { canStandAt } from './furniture-travel.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { rescueBedAvailable } from './medical-beds.ts';
import { isMedicine,medicineAllowed } from './medicine-rules.ts';
import { medicineClaims,medicineTaskValid } from './medicine-logistics.ts';
import { reservedSource } from './materials.ts';
import { serviceCell } from './service-reservations.ts';
import { isSurgicalLimb } from './surgery-anatomy.ts';
import { surgeryRequestReason,SURGERY_WORK } from './surgery-rules.ts';
import {ARTIFICIAL_PARTS,artificialPartAvailable273,artificialPartIngredient273,isArtificialPartKind,isArtificialPartSite} from './artificial-parts-rules.ts';
import {isProstheticItem273} from './prosthetic-content-273.ts';
import { validImplantTaskRelations } from './surgery-ingredients.ts';
import type { Pawn,World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
type Bounds=Pick<World,'tick'|'width'|'height'|'nextId'>;
const validChoice=(v:Record<string,unknown>,version:number):boolean=>{
 if(Object.hasOwn(v,'removeArtificial273'))return isSchema273OrLater(version)&&!Object.hasOwn(v,'implant')&&isArtificialPartKind(v.removeArtificial273)&&isArtificialPartSite(v.part)&&ARTIFICIAL_PARTS[v.removeArtificial273].sites.includes(v.part);
 return Object.hasOwn(v,'implant')?artificialPartAvailable273(v.implant,version)&&isArtificialPartSite(v.part)&&ARTIFICIAL_PARTS[v.implant].sites.includes(v.part):isSurgicalLimb(v.part);
};
export function validSurgeryRequestShape(value:unknown,version:number,tick:number):boolean {
 return value===undefined||version>=179&&object(value)&&keys(value,['part','requestedAt'],[...version>=210?['implant']:[],...isSchema273OrLater(version)?['removeArtificial273']:[]])&&validChoice(value,version)&&int(value.requestedAt,0,tick);
}
export function validSurgeryTaskShape(value:unknown,version:number,w:Bounds):boolean {
 if(value===undefined)return true;
 if(version<179||!object(value)||!keys(value,['patientId','part','bedId','spot','phase','progress','workCore'],['medicine','consumedMedicine',...version>=210?['implant','ingredients']:[],...isSchema273OrLater(version)?['removeArtificial273']:[]])
  ||!int(value.patientId,1,w.nextId-1)||!int(value.bedId,1,w.nextId-1)||!validChoice(value,version)
  ||!object(value.spot)||!keys(value.spot,['x','z'])||!int(value.spot.x,0,w.width-1)||!int(value.spot.z,0,w.height-1)
  ||!['pickup','approach','work'].includes(String(value.phase))||typeof value.progress!=='number'||!Number.isFinite(value.progress)||value.progress<0
  ||!int(value.workCore)||value.workCore%10!==0)return false;
 const implant=isArtificialPartKind(value.implant)?value.implant:undefined,work=implant?ARTIFICIAL_PARTS[implant].work:SURGERY_WORK;
 if(value.progress>=work||value.workCore>work*10-10)return false;
 const worked=()=>Number(value.workCore)>=10&&isMedicine(value.consumedMedicine as never)&&Number(value.progress)+1e-7>=Number(value.workCore)*.1&&Number(value.progress)<=Number(value.workCore)*1.6+1e-7;
 if(implant){
  if(Object.hasOwn(value,'medicine'))return false;
  const retained=value.phase==='work'&&isProstheticItem273(implant);
  if(value.phase==='work'&&!retained)return !Object.hasOwn(value,'ingredients')&&worked();
  if(retained?!worked():Object.hasOwn(value,'consumedMedicine')||value.progress!==0||value.workCore!==0)return false;
  if(!Array.isArray(value.ingredients)||value.ingredients.length<2||value.ingredients.length>3||Object.keys(value.ingredients).length!==value.ingredients.length)return false;
  let component=0,doses=0,held=0,source=false,allPlaced=true,medicine:string|undefined;const ids=new Set<number>(),cells=new Set<number>(),required=artificialPartIngredient273(implant);
  for(const i of value.ingredients){
   if(!object(i)||!keys(i,['pileId','item','quantity','stage','cell'])||!int(i.pileId,1,w.nextId-1)||ids.has(i.pileId)
    ||i.item!==required&&!isMedicine(i.item as never)||!int(i.quantity,1,2)||!['source','held','placed'].includes(String(i.stage))
    ||!object(i.cell)||!keys(i.cell,['x','z'])||!int(i.cell.x,0,w.width-1)||!int(i.cell.z,0,w.height-1)
    ||Math.abs(i.cell.x-value.spot.x)+Math.abs(i.cell.z-value.spot.z)>2||i.cell.x===value.spot.x&&i.cell.z===value.spot.z)return false;
   const cell=i.cell.z*w.width+i.cell.x;if(cells.has(cell))return false;cells.add(cell);ids.add(i.pileId);
   if(i.stage==='held')held++;if(i.stage==='source')source=true;if(i.stage!=='placed')allPlaced=false;
   if(i.item===required)component+=i.quantity;else{if(medicine!==undefined&&medicine!==i.item)return false;medicine=String(i.item);doses+=i.quantity;}
  }
  return component===1&&doses===(retained?1:2)&&(retained?allPlaced&&held===0&&medicine===value.consumedMedicine:value.phase==='approach'?held===1||allPlaced:held===0&&source);
 }
 if(Object.hasOwn(value,'ingredients'))return false;
 const m=value.medicine;
 if(value.phase==='work')return worked()&&m===undefined;
 return value.progress===0&&value.workCore===0&&value.consumedMedicine===undefined&&object(m)&&keys(m,['item','sourcePileId','carryPileId','quantity'])
  &&isMedicine(m.item as never)&&int(m.sourcePileId,1,w.nextId-1)&&m.quantity===1
  &&(value.phase==='pickup'?m.carryPileId===null:int(m.carryPileId,1,w.nextId-1));
}
/** Shape-only bridge guard. Clinical clocks and World ownership are checked by
 * the common save validator, never replaced by a second human schema here. */
export function validPawnSurgeryShape(p:Pick<Pawn,'surgeryRequest'|'surgery'>|Record<string,unknown>,version:number,w:Bounds):boolean {
  return validSurgeryRequestShape(p.surgeryRequest,version,w.tick)&&validSurgeryTaskShape(p.surgery,version,w);
}
/** Full relations, after ordinary Pawn/item/clinical shapes. Request is not a
 * second work task: it survives patient's anesthetic incapacity. */
export function validateSurgeries(w:World,version:number,onlyBedIds?:ReadonlySet<number>):string[] {
  const errors:string[]=[],patients=new Set<number>(),byId=new Map(w.pawns.map(p=>[p.id,p]));
  const work=new Map<number,Pawn>();
  for(const d of w.pawns)if(d.surgery?.phase==='work')work.set(d.surgery.patientId,d);
  const offMap=w.scout&&'pawn' in w.scout?w.scout.pawn.id:w.commercialTrip&&'pawn' in w.commercialTrip?w.commercialTrip.pawn.id:undefined;
  const serviceKey=(cell:{x:number;z:number})=>cell.z*w.width+cell.x;
  for(const p of w.pawns){
    if(onlyBedIds&&!(p.surgery&&onlyBedIds.has(p.surgery.bedId))
      &&!(p.need?.kind==='sleep'&&onlyBedIds.has(p.need.bedId??0)))continue;
    if(!validPawnSurgeryShape(p,version,w)){errors.push('Invalid or future surgery state.');continue;}
    if(p.surgeryRequest){
      const active=work.get(p.id),anesthetic=p.health?.anesthetic;
      if(p.id===offMap||p.visitor||surgeryRequestReason(p,p.surgeryRequest.part,{version,...(active?{allowAnesthetic:true as const}:{}),...(p.surgeryRequest.implant?{implant:p.surgeryRequest.implant}:{}),...(p.surgeryRequest.removeArtificial273?{removeArtificial273:p.surgeryRequest.removeArtificial273}:{})})
        ||anesthetic&&(!active||anestheticCivilBornAt271(p.health!)!<p.surgeryRequest.requestedAt))errors.push('Invalid surgical patient request.');
    }
    const t=p.surgery;if(!t)continue;
    const patient=byId.get(t.patientId),bed=w.structures.find(b=>b.id===t.bedId&&isBedKind(b.kind));
    if(!isColonist(p)||p.prisoner||p.visitor||p.podRescue||p.id===offMap||medicalWorkRefusal(p)||p.priorities.doctor===0||p.orders.active!==null
      ||p.draft||p.mental?.crisis||p.melee?.order||p.shooting?.order||t.implant&&p.skills.medicine.level<ARTIFICIAL_PARTS[t.implant].medicineSkill)errors.push('Invalid surgical doctor.');
    if(!patient||patient===p||patient.id===offMap||!patient.surgeryRequest||patient.surgeryRequest.part!==t.part
      ||patient.surgeryRequest.implant!==t.implant||patient.surgeryRequest.removeArtificial273!==t.removeArtificial273||surgeryRequestReason(patient,t.part,{version,...(t.phase==='work'?{allowAnesthetic:true as const}:{}),...(t.implant?{implant:t.implant}:{}),...(t.removeArtificial273?{removeArtificial273:t.removeArtificial273}:{})}))errors.push('Surgical task lacks an eligible matching patient.');
    if(patients.has(t.patientId))errors.push('Duplicate surgical patient reservation.');patients.add(t.patientId);
    if(!bed||isDoubleBedKind(bed.kind)||bed.prisoner&&(!isSchema280OrLater(version)||!patient?.prisoner)||!patient||!rescueBedAvailable(w,bed,patient,p.id)||!lyingPatient(patient)||patient.need?.kind!=='sleep'||patient.need.bedId!==bed.id||patient.x!==bed.x||patient.z!==bed.z
      ||!(bedServicePlace339(w,patient,t.spot)||(Math.abs(t.spot.x-bed.x)+Math.abs(t.spot.z-bed.z)===1&&canStandAt(w,t.spot))))errors.push('Surgical patient or bedside is not physically installed.');
    if(w.pawns.some(other=>other!==p&&(other.tend?.patientId===t.patientId||other.feed?.patientId===t.patientId||other.ward?.patientId===t.patientId||other.rescue?.patientId===t.patientId
      ||serviceCell(other,w)&&serviceKey(serviceCell(other,w)!)===serviceKey(t.spot))))errors.push('Surgery conflicts with a patient or bedside reservation.');
    // A queued sustaining command retains its independent priority intent.
    // The engine suspends that provider while this physical service is active.
    if(p.jobId!==null||p.haul||p.cooking||p.need||p.recreation.task||p.tend||p.feed||p.rescue||p.ward||p.research||p.animalCare||p.animalHandling||p.equipmentTask||p.hunting||p.burial||p.cleaning||p.firefighting||p.interruptedCargo)errors.push('Surgery conflicts with another doctor activity.');
    if(t.phase==='work'){
      if(t.implant&&isProstheticItem273(t.implant)&&(!patient||!validImplantTaskRelations(w,p,patient,t)))errors.push('Invalid retained industrial surgery inputs.');
      if(!patient?.health?.anesthetic||t.workCore>(patient.health.tick-patient.health.anesthetic.bornAt+1)*10||!medicineAllowed(patient,t.consumedMedicine!)||p.state!=='working'||p.moveCooldown!==0||p.motion&&p.motion.end>w.tick||p.path.length||p.x!==t.spot.x||p.z!==t.spot.z
        ||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))errors.push('Invalid administered surgery phase or cargo.');
    }else if(t.implant){
      if(p.state!=='moving'||!patient||!validImplantTaskRelations(w,p,patient,t))errors.push('Invalid wooden surgery ingredient ownership or staging.');
    }else{
      if(p.state!=='moving'||!patient||!medicineTaskValid(w,p,patient,t))errors.push('Invalid surgery medicine permission or phase.');
      const m=t.medicine!,pile=w.piles.find(i=>i.id===(t.phase==='pickup'?m.sourcePileId:m.carryPileId));
      if(!patient||!medicineAllowed(patient,m.item)||!pile||pile.kind!=='medicine'||pile.item!==m.item||
        (t.phase==='pickup'?pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity||medicineClaims(w,pile.id)>10:
          pile.owner.type!=='pawn'||pile.owner.pawnId!==p.id||pile.quantity!==1))errors.push('Invalid surgical dose ownership or shared reservation.');
    }
  }
  return errors;
}
