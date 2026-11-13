import { immunityGainSpeed } from './infection-rules.ts';
import { IMMUNE_DISEASE_KINDS,type ImmuneDiseaseKind,type ImmuneDiseaseState } from './immune-diseases-types.ts';
import type { MedicalContext,MedicalRecord } from './injury-types.ts';

export const IMMUNE_DISEASE_UNIT=1_000_000_000;
export const IMMUNE_DISEASE_INITIAL=1_000_000;
export const IMMUNE_DISEASE_INTERVAL=20; // 200 Core ticks.
export const IMMUNE_DISEASE_TEND_DURATION_CORE=37_500;
export const IMMUNE_DISEASE_TEND_OVERLAP_CORE=7_500;
export const IMMUNE_DISEASE_DEFINITIONS=Object.freeze({
  malaria:Object.freeze({severityPerDay:.3702,severityPerDayImmune:-.7297,immunityPerDay:.3145,immunityPerDayNotSick:-.03,tendedPerDay:.232,lifeThreateningAt:910_000_000}),
  plague:Object.freeze({severityPerDay:.666,severityPerDayImmune:-.333,immunityPerDay:.5224,immunityPerDayNotSick:-.02,tendedPerDay:.3628,lifeThreateningAt:900_000_000}),
  // Core SleepingSickness: slow, long tends (32 h + 3 h overlap).
  'sleeping-sickness':Object.freeze({severityPerDay:.12,severityPerDayImmune:-.176,immunityPerDay:.1,immunityPerDayNotSick:-.02,tendedPerDay:.07,lifeThreateningAt:875_000_000}),
});
/** Core TendTicksFull per disease: (base + 3 h overlap) x 2500. */
export const immuneDiseaseTendCore=(kind:ImmuneDiseaseKind):number=>kind==='sleeping-sickness'?87_500:IMMUNE_DISEASE_TEND_DURATION_CORE;
export interface ImmuneDiseaseModifiers {
  pain:number;consciousnessOffset:number;consciousnessMax:number;
  manipulationOffset:number;breathingOffset:number;bloodFiltrationOffset:number;
}
const NONE:ImmuneDiseaseModifiers=Object.freeze({pain:0,consciousnessOffset:0,consciousnessMax:Infinity,manipulationOffset:0,breathingOffset:0,bloodFiltrationOffset:0});
export function immuneDiseaseStage(kind:ImmuneDiseaseKind,severity:number):'none'|'minor'|'major'|'extreme'|'critical' {
  if(severity<=0)return 'none';
  if(kind==='sleeping-sickness')return severity>=875_000_000?'critical':severity>=625_000_000?'extreme':severity>=437_500_000?'major':'minor';
  return kind==='malaria'?(severity>=910_000_000?'critical':severity>=780_000_000?'major':'minor'):
    severity>=900_000_000?'critical':severity>=800_000_000?'extreme':severity>=600_000_000?'major':'minor';
}
/** A stage replaces the preceding stage. Coexisting diseases add offsets. */
export function immuneDiseaseModifiers(record:MedicalRecord):ImmuneDiseaseModifiers {
  if(!record.immuneDiseases)return NONE;
  let pain=0,consciousnessOffset=0,consciousnessMax=Infinity,manipulationOffset=0,breathingOffset=0,bloodFiltrationOffset=0;
  for(const kind of IMMUNE_DISEASE_KINDS){
    const stage=immuneDiseaseStage(kind,record.immuneDiseases[kind]?.severity??0);if(stage==='none')continue;
    if(kind==='sleeping-sickness'){
      const s=record.immuneDiseases[kind]!.severity;
      if(s>=937_500_000){pain+=.15;consciousnessMax=Math.min(consciousnessMax,.1);manipulationOffset-=.2;}
      else if(s>=875_000_000){pain+=.1;consciousnessOffset-=.2;manipulationOffset-=.2;}
      else if(s>=625_000_000){pain+=.05;consciousnessOffset-=.15;manipulationOffset-=.06;}
      else if(s>=437_500_000){pain+=.03;consciousnessOffset-=.04;manipulationOffset-=.04;}
      else{pain+=.02;consciousnessOffset-=.02;manipulationOffset-=.02;}
    }else if(kind==='malaria'){
      bloodFiltrationOffset-=stage==='critical'?.22:stage==='major'?.2:.1;
      if(stage==='critical'){consciousnessMax=.1;manipulationOffset-=.1;pain+=.3;}
      else if(stage==='major'){consciousnessOffset-=.12;manipulationOffset-=.08;pain+=.3;}
      else consciousnessOffset-=.05;
    }else{
      pain+=stage==='critical'?.85:stage==='extreme'?.6:stage==='major'?.35:.2;
      const offset=stage==='minor'?.05:stage==='major'?.2:.3;
      consciousnessOffset-=offset;manipulationOffset-=offset;
      if(stage==='critical')breathingOffset-=.15;
    }
  }
  return {pain,consciousnessOffset,consciousnessMax,manipulationOffset,breathingOffset,bloodFiltrationOffset};
}
/** Malaria caller only. Core MTB trial at each 600-Core physical probe. */
export function immuneDiseaseVomitChance(state:ImmuneDiseaseState|undefined):number {
  const severity=state?.severity??0;
  return severity>=910_000_000?1/75:severity>=780_000_000?1/150:0;
}
export function immuneDiseaseSeverityPerDay(kind:ImmuneDiseaseKind,state:ImmuneDiseaseState,tick:number):number {
  const rule=IMMUNE_DISEASE_DEFINITIONS[kind];
  const tending=state.tend&&state.tend.expiresAtCore>tick*10?rule.tendedPerDay*state.tend.quality/1000:0;
  return (state.immunity>=IMMUNE_DISEASE_UNIT?rule.severityPerDayImmune:rule.severityPerDay)-tending;
}
export function immuneDiseaseImmunityPerDay(record:MedicalRecord,kind:ImmuneDiseaseKind,context:MedicalContext,filtration=1):number {
  const state=record.immuneDiseases?.[kind],rule=IMMUNE_DISEASE_DEFINITIONS[kind];
  return state?.severity?rule.immunityPerDay*immunityGainSpeed(record,context,filtration)*state.luck/1_000_000:rule.immunityPerDayNotSick;
}
