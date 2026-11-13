import type {ToxicBuildup256} from './toxic-buildup-256.ts';
import type { BodyPartId } from './body-definition.ts';
import type { InjuryKind,ScarPain } from './injury-rules.ts';
import type { InfectionRisk,InfectionState } from './infection-types.ts';

/** Local medical kernel. World ownership and clocks are checked by health-save. */
export interface Injury {
  id:number; part:BodyPartId; kind:InjuryKind;
  /** Milli-HP; no global health bar. */
  severity:number; bornAt:number;
  /** Chosen when wounded; becomes permanent when healing crosses this threshold. */
  scar?:{threshold:number; pain?:ScarPain};
  /** One physical tending result, quality in thousandths. No doctor action here. */
  tended?:number;
  /** Present only if a post-V80 wound passed its initial exposure roll. */
  infection?:InfectionRisk;
}
export interface MissingPart {part:BodyPartId;bornAt:number;tended?:true;nonFresh?:true}
export interface MedicalRecord {
  /** Only a real V290 Extinguish victim acquires this active-time component. */
  coveredInFirefoam290?:import('./firefoam-actor-state-290.ts').CoveredInFirefoam290;
  /** Schema271: actual civil frontier. tick and condition deadlines remain
   * clinical active time. Absent retains the historical identity clock. */
  civilTick271?:number;
  /** Prospective only, created by an actually ingested beer in schema265. */
  alcohol?:import('./alcohol-state-265.ts').AlcoholState265;
  scaria261?:import('./animal-scaria-261.ts').AnimalScaria261;
  /** Prospective nativeHuman current scale, parent checked against actual biological age. */
  humanHealthScale?:number;
  toxicBuildup?:ToxicBuildup256;
  /** V210 actual installed wooden substitutes, independent of natural anatomy. */
  artificialParts?:import('./artificial-parts-types.ts').ArtificialPart[];
  /** V192 human anesthesia; absent in historical records and animals. */
  anesthetic?:import('./anesthetic.ts').AnestheticState;
  /** Actual prospective native-animal conditions; absent in historical records. */
  animalAgeConditions?:import("./animal-age-condition-state-256.ts").AnimalAgeConditions256;
  ageAilments?:import('./human-age.ts').HumanAgeAilment[];
  /** Prospective flesh condition; absence never acquires a retroactive roll. */
  cryptosleepSickness?:import('./cryptosleep-sickness-256.ts').CryptosleepSickness256;
  foodPoisoning?:import('./food-poisoning.ts').FoodPoisoningState;
  /** A human systemic illness; absent for historical records and animals. */
  flu?:import('./flu-types.ts').FluState;
  /** V207 human malaria/plague; independent immunity and residual episodes. */
  immuneDiseases?:Partial<Record<import('./immune-diseases-types.ts').ImmuneDiseaseKind,import('./immune-diseases-types.ts').ImmuneDiseaseState>>;
  /** Schema 306: gut worms and muscle parasites. */
  parasites306?:import('./parasites-306.ts').Parasites306;
  /** Schema 307: fibrous and sensory mechanites. */
  mechanites307?:import('./mechanites-307.ts').Mechanites307;
  /** Absent is the historical human profile. Animal ownership is validated. */
  body?:import('./animal-species.ts').AnimalSpeciesId|import('./mechanoid-definition.ts').MechanoidKind;
  /** Only new animal species256: immutable owner birth anchor on the clinical clock. */
  animalBirthTick?:number;
  /** Current true animal owner growth; no second clock/tracker. */
  animalGrowth?:number;
  tick:number; nextInjuryId:number;
  injuries:Injury[]; missing:MissingPart[];
  /** BLOOD_UNIT = all blood lost; integral, not a percent. */
  bloodLoss:number;
  /** Whole-body heat exposure, billionths of severity; absent means none. */
  heatstroke?:number;
  hypothermia?:number;
  /** V84: hunger damage independent of wounds, billionths of severity. */
  malnutrition?:number;
  infections?:InfectionState;
  death?:{tick:number;cause:'execution'|'blood-loss'|'vital-failure'|'trauma'|'heatstroke'|'hypothermia'|'downed'|'infection'|'malnutrition'|'flu'|'malaria'|'plague'|'sleeping-sickness'|'heart-artery-blockage'|'heart-attack'|'toxic-buildup'|'scaria'};
}
export interface MedicalContext {
  /** Civil endpoint of this unsuspended interval; never includes a held gap. */
  civilTick?:number;
  alcoholOwner?:import('./alcohol-clinical-265.ts').AlcoholOwner265;
  /** Actual owner witness when cryptosleep sickness exists; never a fake map. */
  cryptosleepSicknessSpawned?:boolean;
  /** Actual owner id/spawn/awake witness, required only for prospective toxicity. */
  toxicOwner?:{id:number;spawned:boolean;awake:boolean};
  /** Positive outdoor dose, captured only on actual global fallout boundaries. */
  toxicFallout294?:import('./toxic-fallout-dose-294.ts').ToxicFalloutExposure294;
  /** Stable phase in [0,59], supplied by the owning actor. */
  phase:number;
  posture:'standing'|'ground'|'bed';
  starving:boolean;
  /** Omitted by old isolated medical callers: no hunger condition invented. */
  malnutritionRate?:number;
  hunger?:number; rest?:number;
  /** Actual rest, not merely incapacitated on the ground or travelling to bed. */
  restingBonus?:boolean;
  infectionSeed?:number;
  /** Difficulty applies to the owning player faction at acquisition time. */
  infectionChanceFactor?:number;
  /** Core StatPart_Age for immunity, supplied by the human owner. */
  ageImmunityFactor?:number;
  /** Actual human bed definition; absence preserves the historical bed rate. */
  bedHealPerDay?:0|4|10;
  bedImmunityFactor?:1|1.05|1.07|1.11|1.13;
}
/** Caller owns and persists its deterministic PRNG; never Math.random. */
export type MedicalRandom=()=>number;
