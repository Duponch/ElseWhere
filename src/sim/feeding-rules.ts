import { allowedAreaReason } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { isCarePatient } from './affiliation.ts';
import { lyingPatient,patientClaimed,bedServicePlace339 } from './care-access.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { freshMissing } from './injury-state.ts';
import { carrierOf } from './rescue-state.ts';
import { canStandAt } from './furniture-travel.ts';
import type { Cell,Pawn,World } from './types.ts';
import type { PasteRequest } from './nutrient-paste.ts';

export interface FeedTask { patientId:number;spot:Cell;sourcePileId:number|null;carryPileId:number|null;quantity:number;phase:'pickup'|'collect'|'deliver'|'feed';progress:number;paste?:PasteRequest }
// Mirrored adult threshold: .3 × .8 + .02 = .26 (wiki lists hunger at .25).
// Base ingest time 50 local ticks × 1.5, independent of Medicine and EatingSpeed.
export const FEED_HUNGER=26,FEED_TICKS=75;
export const feedingWork=(patient:Pawn|undefined):'warden'|'doctor'=>patient?.prisoner?'warden':'doctor';
export function needsAssistedFeeding(p:Pawn):boolean {
  if(prisonBreakActive(p))return false;
  if(p.prisoner?.mode==='release'&&p.state!=='downed')return false;
  return lyingPatient(p)&&(p.state==='downed'||!!p.health&&(!!p.health.infections?.cases.length||p.health.injuries.some(i=>i.scar?.pain===undefined)||p.health.missing.some(m=>freshMissing(p.health!,m))));
}
export function feedingReason(world:World,doctor:Pawn,patient:Pawn|undefined,accepted=false):string|undefined {
  return (!accepted&&patient?allowedAreaReason(world,doctor,patient):undefined)??backgroundWorkRefusal(doctor,feedingWork(patient))??medicalWorkRefusal(doctor)??(!accepted&&workPriority(doctor,feedingWork(patient))===0?`${patient?.prisoner?'Geôlier':'Médecin'} est désactivé.`
    :doctor.interruptedCargo?'La cargaison doit être déposée avant de nourrir un patient.'
    :!accepted&&(doctor.collapsePending||world.restRules==='legacy'&&doctor.rest===0)?'Ce colon doit récupérer de son épuisement.'
    :!patient||!isCarePatient(patient)||patient===doctor?'Choisissez un autre patient.'
    :!needsAssistedFeeding(patient)||carrierOf(world,patient.id)?'Le patient doit avoir besoin de repos médical et être installé au lit.'
    :!accepted&&(patient.prisoner?patient.hunger>=FEED_HUNGER:patient.hunger>FEED_HUNGER)?'Ce patient n’a pas encore faim.'
    :patientClaimed(world,patient.id,doctor)?'Ce patient est déjà réservé par un médecin.':undefined);
}
export function feedingPlaceValid(world:World,task:FeedTask,patient:Pawn):boolean {
  return bedServicePlace339(world,patient,task.spot)||Math.abs(task.spot.x-patient.x)+Math.abs(task.spot.z-patient.z)===1&&canStandAt(world,task.spot);
}
