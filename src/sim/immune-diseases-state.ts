import { HP_UNIT } from './injury-rules.ts';
import { immuneDiseaseTendCore,IMMUNE_DISEASE_DEFINITIONS,IMMUNE_DISEASE_INITIAL,IMMUNE_DISEASE_TEND_OVERLAP_CORE,IMMUNE_DISEASE_UNIT } from './immune-diseases-rules.ts';
import { IMMUNE_DISEASE_KINDS,type ImmuneDiseaseKind,type ImmuneDiseaseState } from './immune-diseases-types.ts';
import type { MedicalRecord } from './injury-types.ts';

/** The incident supplies its stable luck and owns the admission chance. */
export function acquireImmuneDisease(record:MedicalRecord,kind:ImmuneDiseaseKind,luck:number):boolean {
  if(!IMMUNE_DISEASE_KINDS.includes(kind)||!Number.isSafeInteger(luck)||luck<800_000||luck>1_200_000)throw new Error('Invalid immune disease acquisition');
  const previous=record.immuneDiseases?.[kind];
  if(record.death||record.body||previous?.severity||previous?.vomit||(previous?.immunity??0)>=600_000_000)return false;
  const state:ImmuneDiseaseState={bornAt:record.tick,severity:IMMUNE_DISEASE_INITIAL,immunity:previous?.immunity??0,luck};
  (record.immuneDiseases??={})[kind]=state;return true;
}
/** Renewal is strictly after the 7500-Core remaining boundary. */
export function immuneDiseaseNextTendCore(state:ImmuneDiseaseState):number {
  return state.tend?state.tend.expiresAtCore-IMMUNE_DISEASE_TEND_OVERLAP_CORE+1:state.bornAt*10;
}
export function immuneDiseaseTendable(record:MedicalRecord,kind:ImmuneDiseaseKind):boolean {
  const state=record.immuneDiseases?.[kind];
  return !record.death&&!record.body&&!!state&&state.severity>0&&state.immunity<IMMUNE_DISEASE_UNIT&&record.tick*10>=immuneDiseaseNextTendCore(state);
}
export function tendImmuneDisease(record:MedicalRecord,kind:ImmuneDiseaseKind,quality:number):boolean {
  if(!Number.isSafeInteger(quality)||quality<0||quality>1300)throw new Error('Invalid immune disease tending quality');
  const state=record.immuneDiseases?.[kind];if(!state||!immuneDiseaseTendable(record,kind))return false;
  const expiresAtCore=Math.max(record.tick*10,state.tend?.expiresAtCore??0)+immuneDiseaseTendCore(kind);
  if(!Number.isSafeInteger(expiresAtCore))throw new Error('Immune disease treatment clock exhausted');
  state.tend={quality,expiresAtCore};return true;
}
export function immuneDiseaseTargets(record:MedicalRecord):{disease:ImmuneDiseaseKind;priority:number;severity:number}[] {
  const targets:{disease:ImmuneDiseaseKind;priority:number;severity:number}[]=[];
  for(const kind of IMMUNE_DISEASE_KINDS)if(immuneDiseaseTendable(record,kind)){
    const severity=record.immuneDiseases![kind]!.severity;
    targets.push({disease:kind,priority:severity>=IMMUNE_DISEASE_DEFINITIONS[kind].lifeThreateningAt?1:.025,severity:severity/IMMUNE_DISEASE_UNIT*HP_UNIT});
  }
  return targets;
}
export function immuneDiseasesNeedRest(record:MedicalRecord):boolean {
  return !record.death&&!record.body&&IMMUNE_DISEASE_KINDS.some(kind=>{
    const state=record.immuneDiseases?.[kind];return !!state?.severity&&state.immunity<IMMUNE_DISEASE_UNIT;
  });
}
