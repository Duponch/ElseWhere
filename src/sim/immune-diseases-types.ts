import type { VomitState } from './food-poisoning.ts';

/** Schema 309 adds sleeping sickness (Core SleepingSickness). */
export const IMMUNE_DISEASE_KINDS=['malaria','plague','sleeping-sickness'] as const;
export type ImmuneDiseaseKind=typeof IMMUNE_DISEASE_KINDS[number];
/** V207 human systemic episode; severity and immunity are billionths. */
export interface ImmuneDiseaseState {
  bornAt:number;
  severity:number;
  immunity:number;
  /** Stable per-episode immunity speed, in millionths. */
  luck:number;
  tend?:{quality:number;expiresAtCore:number};
  /** Malaria only; an admitted physical episode may outlive the disease. */
  vomit?:VomitState;
}
