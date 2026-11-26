import type { MedicalCare, TendMedicine } from './medicine-rules.ts';
import type { Cell } from './types.ts';
import type {AnimalTrainingSkill282} from './animal-training-state-282.ts';

/** V106 covers the obtainable hare only. No historical animal changes faction. */
export interface DomesticAnimal {
  /** Normal sleeping-place assignment, independent from current occupation. */
  bedId?:number;
  /** V309 prospective, explicit player intent; absence preserves the herd. */
  slaughter?:true;
  /** Schema 364: ReleaseAnimalToWild designation, never with slaughter. */
  release364?:true;
  since:number;
  care:MedicalCare;
  tameness:number;
  nextDecay:number;
  lastTraining?:number;
  /** Marker identity, never a cached set of cells. Roamers alone use pens. */
  penMarkerId?:number;
  /** V120 body product fullness, 0..1. Only milkable/shearable adults carry it. */
  productFullness?:number;
}
export interface TamingDesignation { designated:boolean; lastAttempt?:number }
export interface AnimalHandlingTask {
  animalId:number;
  /** Schema 378: a direct Prioritise order, on this actual service only. */
  forced378?:true;
  kind:'tame'|'maintain'|'train'|'lead'|'milk'|'shear'|'slaughter'|'release';
  sourcePileId:number;
  carryPileId:number|null;
  quantity:number;
  phase:'pickup'|'approach'|'interact'|'lead'|'gather'|'carry';
  step:number;
  progress:number;
  /** V282 only: the two admitted physical feed portions and actual skill. */
  trainable?:AnimalTrainingSkill282;
  feedUnits?:number;
  /** The actual feed duration captured before its first worked tick. */
  feedDuration?:number;
  /** Attempt/XP already committed at the beginning of the final delay. */
  finalStartedCore?:number;
  markerId?:number;
  /** V135: IDs already on the handler's ropes, in attachment order. The
   * original animalId remains the stable job identity. */
  ropees?:number[];
  /** A second animal reserved while the handler physically walks to it. */
  gatherId?:number;
  /** Schema 377 (Core Toils_Rope.RopePawn): Core tick at which the 30-tick
   * roping of the last attached animal ends; the next search runs once then. */
  ropeUntil377?:number;
  /** Schema 377 (Core Pawn_PathFollower): Core tick until which the handler
   * waits because a rope is stretched beyond its length. */
  ropeWait377?:number;
  /** Schema 377: the handler's last cells on its current path, oldest first
   * (at most 5), read for the followers' marching order. */
  trail377?:Cell[];
  /** Schema 364 release: the outside cell the animal is carried to. */
  drop364?:Cell;
}
export interface AnimalCareTask {
  animalId:number;
  spot:Cell;
  phase:'pickup'|'approach'|'treat';
  progress:number;
  duration?:number;
  medicine?:TendMedicine;
}
export type DomesticCommand =
  | {type:'animal-training';animalId:number;skill:'obedience'|'haul';wanted:boolean}
  | {type:'order-animal-rescue';pawnId:number;animalId:number}
  | {type:'animal-spot-medical';spotId:number;enabled:boolean}
  | {type:'slaughter';animalId:number;enabled:boolean}
  | {type:'release-wild';animalId:number;enabled:boolean}
  | {type:'tame';animalId:number;enabled:boolean}
  | {type:'animal-care-policy';animalId:number;care:MedicalCare};
