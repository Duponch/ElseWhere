import type { MedicalRecord } from './injury-types.ts';
import { FLU_INITIAL,FLU_TEND_DURATION_CORE,FLU_TEND_OVERLAP_CORE,FLU_TEND_DURATION_CORE317,FLU_TEND_OVERLAP_CORE317,FLU_UNIT } from './flu-rules.ts';
import type { FluState } from './flu-types.ts';

/** The incident owns the one-time roll and supplies its persisted resistance.
 * No global medical RNG is consumed by admission or subsequent evolution. */
export function acquireFlu(record:MedicalRecord,luck:number):boolean {
  if(!Number.isSafeInteger(luck)||luck<800_000||luck>1_200_000)throw new Error('Invalid flu resistance');
  if(record.death||record.body||record.flu?.severity||record.flu?.vomit||record.flu&&record.flu.immunity>=600_000_000)return false;
  const immunity=record.flu?.immunity??0;
  record.flu={bornAt:record.tick,severity:FLU_INITIAL,immunity,luck};
  return true;
}

export function fluNextTendCore(flu:FluState):number {
  // A tend given from schema 317 carries its Core overlap with it.
  return flu.tend?flu.tend.expiresAtCore-(flu.tend.core317?FLU_TEND_OVERLAP_CORE317:FLU_TEND_OVERLAP_CORE)+1:flu.bornAt*10;
}
export function fluTendable(record:MedicalRecord):boolean {
  const flu=record.flu;
  return !record.death&&!!flu&&flu.severity>0&&flu.immunity<FLU_UNIT&&record.tick*10>=fluNextTendCore(flu);
}
export function tendFlu(record:MedicalRecord,quality:number,version:number):boolean {
  if(!Number.isSafeInteger(quality)||quality<0||quality>1300)throw new Error('Invalid flu tending quality');
  const flu=record.flu;
  if(!flu||!fluTendable(record))return false;
  const core317=version>=317,expiresAtCore=Math.max(record.tick*10,flu.tend?.expiresAtCore??0)+(core317?FLU_TEND_DURATION_CORE317:FLU_TEND_DURATION_CORE);
  if(!Number.isSafeInteger(expiresAtCore))throw new Error('Flu treatment clock exhausted');
  flu.tend={quality,expiresAtCore,...core317?{core317:true as const}:{}};return true;
}
export function fluNeedsRest(record:MedicalRecord):boolean {
  return !record.death&&!!record.flu?.severity&&record.flu.immunity<FLU_UNIT;
}
