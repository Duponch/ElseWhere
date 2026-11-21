import {workSpeedGlobal361} from './traits.ts';
import { isColonist } from './affiliation.ts';
import type { WeaponQuality } from './equipment-rules.ts';
import { pawnBody } from './health-rules.ts';
import { biologicalYears } from './human-age.ts';
import { partMissing } from './injury-state.ts';
import { curve } from './melee-statistics.ts';
import { SURGERY_INSPIRATION_FACTOR_360,workSpeedInspirationFactor360 } from './inspirations-360.ts';
import { MEDICINES,type MedicineItem } from './medicine-rules.ts';
import { XP_SCALE } from './skills.ts';
import { SURGICAL_LIMBS,isSurgicalLimb } from './surgery-anatomy.ts';
import type { Pawn } from './types.ts';
import { artificialPartInstallReason,artificialPartRemovalReason273 } from './artificial-parts.ts';
import type { ArtificialPartKind } from './artificial-parts-types.ts';
import { isWithinPart } from './injury-rules.ts';
import {SCHEMA_VERSION} from './types.ts';
import {isTherapeuticCaptiveSurgery280} from './prisoner-surgery-rules-280.ts';

/** Core 1.6.4871 RemoveBodyPart. Request/physical contacts belong to surgery.ts. */
export const SURGERY_PARTS=SURGICAL_LIMBS;
export const SURGERY_WORK=2000;
export const surgeryBaseXp=(workedCoreTicks:number):number=>Math.round(workedCoreTicks*.1*16*XP_SCALE);
export interface SurgeryPatientOptions {version?:number;allowAnesthetic?:true;implant?:ArtificialPartKind;removeArtificial273?:ArtificialPartKind}
export function surgeryRequestReason(patient:Pawn,part:unknown,options:SurgeryPatientOptions={}):string|undefined {
  if(options.removeArtificial273!==undefined)return surgeryRemoveRequestReason273(patient,part,options.removeArtificial273,options);
  if(options.implant!==undefined)return surgeryInstallRequestReason(patient,part,options.implant,options);
  if(patient.prisoner){if(!isTherapeuticCaptiveSurgery280(patient,part,{version:options.version??SCHEMA_VERSION}))return 'Ce captif adulte doit être détenu et présenter une infection directement sur ce membre pour cette opération thérapeutique.';}
  else if(!isColonist(patient)||patient.visitor||patient.raid||patient.podRescue)return 'Cette opération est réservée aux colons adultes libres.';
  if(patient.age&&biologicalYears(patient.age)<18)return 'Cette opération est réservée aux adultes.';
  if(patient.state==='dead'||patient.health?.death)return 'Ce colon est décédé.';
  if(!isSurgicalLimb(part))return 'Seuls les bras et jambes infectés peuvent être opérés.';
  const h=patient.health;
  if(!h)return 'Aucune infection présente directement sur ce membre.';
  if(h.body!==undefined||partMissing(h,part))return 'Ce membre est absent ou ne peut pas être opéré.';
  if(h.artificialParts?.some(p=>isWithinPart(p.part,part)))return 'Ce membre contient une prothèse ; son retrait chirurgical n’est pas encore disponible.';
  if(!h.infections?.cases.some(c=>c.part===part))return 'Aucune infection présente directement sur ce membre.';
  if(h.anesthetic&&!options.allowAnesthetic)return 'Attendre la disparition de l’anesthésie avant une nouvelle demande.';
  return undefined;
}

export function surgeryInstallRequestReason(patient:Pawn,part:unknown,implant:unknown,options:Pick<SurgeryPatientOptions,'version'|'allowAnesthetic'>={}):string|undefined {
  if(patient.prisoner){if(!isTherapeuticCaptiveSurgery280(patient,part,{version:options.version??SCHEMA_VERSION,implant}))return 'Ce captif adulte doit être détenu et la partie sélectionnée doit être réellement manquante pour cette pose thérapeutique.';}
  else if(!isColonist(patient)||patient.visitor||patient.raid||patient.podRescue)return 'Cette opération est réservée aux colons adultes libres.';
  if(patient.age&&biologicalYears(patient.age)<18)return 'Cette opération est réservée aux adultes.';
  if(patient.state==='dead'||patient.health?.death)return 'Ce colon est décédé.';
  if(patient.health?.anesthetic&&!options.allowAnesthetic)return 'Attendre la disparition de l’anesthésie avant une nouvelle demande.';
  return artificialPartInstallReason(patient.health,part,implant);
}
export function surgeryRemoveRequestReason273(patient:Pawn,part:unknown,kind:unknown,options:Pick<SurgeryPatientOptions,'version'|'allowAnesthetic'>={}):string|undefined {
  if(!isColonist(patient)||patient.prisoner||patient.visitor||patient.raid||patient.podRescue||patient.age&&biologicalYears(patient.age)<18)return 'Cette opération est réservée aux colons adultes libres.';
  if(patient.health?.anesthetic&&!options.allowAnesthetic)return 'Attendre la disparition de l’anesthésie avant une nouvelle demande.';
  return artificialPartRemovalReason273(patient.health,part,kind);
}

/** Actual Glow, not the already transformed tending-light factor. */
export function medicalSurgerySpeed(doctor:Pawn,glow:number):number {
  const c=pawnBody(doctor).capacities;
  return Math.max(.1,(.4+.06*doctor.skills.medicine.level)*c.manipulation*(.3+.7*Math.min(1,c.sight))*curve(glow,[[0,.8],[.3,1]])*workSpeedInspirationFactor360(doctor)*workSpeedGlobal361(doctor));
}
const DOCTOR_CHANCE=[.1,.2,.3,.4,.5,.6,.7,.75,.8,.85,.9,.92,.94,.96,.98,1,1.02,1.04,1.06,1.08,1.1] as const;
export function medicalSurgeryDoctorChance(doctor:Pawn):number {
  const c=pawnBody(doctor).capacities;
  return Math.max(.01,DOCTOR_CHANCE[doctor.skills.medicine.level]!*c.manipulation*(.6+.4*Math.min(1,c.sight)));
}
const BED_QUALITY:Readonly<Record<WeaponQuality,number>>={awful:.9,poor:.95,normal:1,good:1.05,excellent:1.1,masterwork:1.15,legendary:1.3};
export interface SurgeryChanceInput {
  doctor:Pawn;medicine:MedicineItem;bedQuality?:WeaponQuality;
  patientGlow:number;roomCleanliness:number|null;outdoors:boolean;
  /** Definition of the physically used bed, before quality and environment. */
  bedSurgeryFactor?:number;
  /** RemoveBodyPart has 1.2; wooden implantation keeps the Core base 1. */
  recipeFactor?:1|1.2;
  /** Schema 360: the surgeon spends an Inspired_Surgery on this operation. */
  inspired?:boolean;
}
/** Caller supplies the physically used bed and current captures. No topology
 * search, ownership mutation, chance draw or XP in this statistic. */
export function surgerySuccessChance(input:SurgeryChanceInput):number {
  const bed=(input.bedSurgeryFactor??1)*BED_QUALITY[input.bedQuality??'normal']*curve(input.patientGlow,[[0,.75],[.5,1]])*(input.outdoors?.85:1);
  const room=input.roomCleanliness===null?.6:curve(input.roomCleanliness,[[-5,.6],[0,1],[1,1.1],[5,1.15]]);
  const medicine=curve(MEDICINES[input.medicine].potency,[[0,.7],[1,1],[2,1.3]]);
  return Math.max(0,Math.min(.98,medicalSurgeryDoctorChance(input.doctor)*bed*room*medicine*(input.recipeFactor??1.2)*(input.inspired?SURGERY_INSPIRATION_FACTOR_360:1)));
}
