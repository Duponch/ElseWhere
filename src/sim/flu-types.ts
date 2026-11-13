/** One human flu episode. Severity and immunity use billionths. */
import type { VomitState } from './food-poisoning.ts';
export interface FluState {
  bornAt:number;
  severity:number;
  immunity:number;
  /** Stable per-episode immunity speed, in millionths. */
  luck:number;
  tend?:{quality:number;expiresAtCore:number;core317?:true};
  /** A physical vomiting episode can finish after the disease has resolved. */
  vomit?:VomitState;
}
