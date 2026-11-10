import {assignPileOwner} from './pile-index.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { MEDICINES,isMedicine,medicineAllowed,type TendMedicine } from './medicine-rules.ts';
import { treatmentTargets,medicineCount,type TendTask } from './care-rules.ts';
import { reservedSource } from './materials.ts';
import { copyPileCondition } from './pile-condition.ts';
import { adjacent,routeToJob,type Reachability } from './pathfinding.ts';
import { interruptWork } from './interrupted-cargo.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,Pawn,World } from './types.ts';

export const medicineClaims=(world:World,id:number):number=>world.pawns.reduce((n,p)=>n+Number(p.tend?.phase==='pickup'&&p.tend.medicine?.sourcePileId===id)+Number(p.animalCare?.phase==='pickup'&&p.animalCare.medicine?.sourcePileId===id)+Number(p.surgery?.phase==='pickup'&&p.surgery.medicine?.sourcePileId===id)+Number(!!p.surgery?.ingredients?.some(i=>i.stage==='source'&&i.pileId===id&&isMedicine(i.item))),0);
type MedicalMedicineTask={patientId:number;spot:Cell;phase:string;medicine?:TendMedicine};

/** Best allowed potency, then distance to patient, with a real route from the
 * doctor. Exhausting one inaccessible candidate must not hide the next one. */
export function reserveMedicine(world:World,doctor:Pawn,patient:Pawn,task:TendTask,reach:Reachability):Cell[]|undefined {
  const path=reserveMedicalMedicine(world,doctor,patient,task,reach,medicineCount(treatmentTargets(patient)));
  if(path)task.useMedicine=true;
  return path;
}
export function reserveMedicalMedicine(world:World,doctor:Pawn,patient:Pawn,task:MedicalMedicineTask,reach:Reachability,needed:number):Cell[]|undefined {
  if(world.schemaVersion<51)return;
  if(!needed)return;
  const sources=world.piles.filter(p=>materialAllowedForPlayer256(p)&&p.owner.type==='ground'&&allowedAreaAllows(world,doctor,p.owner)&&isMedicine(p.item)&&medicineAllowed(patient,p.item)&&p.quantity>reservedSource(world,p.id)&&medicineClaims(world,p.id)<10);
  const distance=(p:typeof sources[number])=>p.owner.type==='ground'?(p.owner.x-patient.x)**2+(p.owner.z-patient.z)**2:Infinity;
  sources.sort((a,b)=>MEDICINES[b.item as keyof typeof MEDICINES].potency-MEDICINES[a.item as keyof typeof MEDICINES].potency||distance(a)-distance(b)||a.id-b.id);
  for(const pile of sources){
    if(pile.owner.type!=='ground'||!isMedicine(pile.item))continue;
    const path=routeToJob(world,pile.owner,reach,true);if(!path)continue;
    task.medicine={item:pile.item,sourcePileId:pile.id,carryPileId:null,quantity:Math.min(needed,pile.quantity-reservedSource(world,pile.id),25)};
    task.phase='pickup';return path;
  }
}
export function medicineTaskValid(world:World,doctor:Pawn,patient:Pawn,task:MedicalMedicineTask):boolean {
  const m=task.medicine;if(!m)return task.phase!=='pickup';
  if(!medicineAllowed(patient,m.item))return false;
  const pile=world.piles.find(p=>p.id===(task.phase==='pickup'?m.sourcePileId:m.carryPileId));
  return !!pile&&materialAllowedForPlayer256(pile)&&pile.item===m.item&&(task.phase==='pickup'?pile.owner.type==='ground'&&reservedSource(world,pile.id)<=pile.quantity&&medicineClaims(world,pile.id)<=10:
    pile.owner.type==='pawn'&&pile.owner.pawnId===doctor.id&&pile.quantity===m.quantity);
}
export function pickupMedicine(world:World,doctor:Pawn,context:NeedContext):void {
  pickupMedicalMedicine(world,doctor,doctor.tend!,context);
}
export function pickupMedicalMedicine(world:World,doctor:Pawn,task:MedicalMedicineTask,context:NeedContext):void {
  const m=task.medicine!,pile=world.piles.find(p=>p.id===m.sourcePileId);
  if(!pile||!materialAllowedForPlayer256(pile)||pile.owner.type!=='ground'||!allowedAreaAllows(world,doctor,pile.owner)||reservedSource(world,pile.id)>pile.quantity){interruptWork(world,doctor);return;}
  if((doctor.x!==pile.owner.x||doctor.z!==pile.owner.z)&&!adjacent(doctor,pile.owner)){context.move(pile.owner,false);return;}
  if(pile.quantity===m.quantity){assignPileOwner(pile,{type:'pawn',pawnId:doctor.id});m.carryPileId=pile.id;}
  else {
    if(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1)){interruptWork(world,doctor);return;}
    pile.quantity-=m.quantity;m.carryPileId=world.nextId++;
    world.piles.push({id:m.carryPileId,kind:'medicine',item:m.item,quantity:m.quantity,owner:{type:'pawn',pawnId:doctor.id},...copyPileCondition(pile)});
  }
  // A self-tending patient travels with the doctor. Treat at the pickup position,
  // never walk back to an obsolete personal position captured before collection.
  if(task.patientId===doctor.id)task.spot={x:doctor.x,z:doctor.z};
  task.phase='approach';doctor.path=[];doctor.state='moving';
}
export function consumeMedicine(world:World,task:{medicine?:TendMedicine}):void {
  const m=task.medicine;if(!m)return;
  const pile=world.piles.find(p=>p.id===m.carryPileId)!;
  pile.quantity--;m.quantity--;
  if(!pile.quantity){world.piles.splice(world.piles.indexOf(pile),1);delete task.medicine;}
}
