import { immunityGainSpeed } from './infection-rules.ts';
import type { MedicalContext,MedicalRecord } from './injury-types.ts';
import type { FluState } from './flu-types.ts';

export const FLU_UNIT=1_000_000_000;
export const FLU_INITIAL=1_000_000;
export const FLU_INTERVAL=20; // 200 Core ticks.
export const FLU_TEND_DURATION_CORE=30_000; // 12 Core hours.
export const FLU_TEND_OVERLAP_CORE=6_000;
/** Schema 317: TendTicksFull (12 + 3 h) x 2500 and TendTicksOverlap 3 h. */
export const FLU_TEND_DURATION_CORE317=37_500;
export const FLU_TEND_OVERLAP_CORE317=7_500;
const MAJOR_VOMIT_CHANCE=1-Math.exp(-600/(1.5*60_000));
const EXTREME_VOMIT_CHANCE=1-Math.exp(-600/(.75*60_000));

export function fluStage(severity:number):'none'|'minor'|'major'|'extreme' {
  return severity<=0?'none':severity>=833_000_000?'extreme':severity>=666_000_000?'major':'minor';
}

export function fluModifiers(flu:FluState|undefined):{pain:number;consciousnessOffset:number;manipulationOffset:number;breathingOffset:number} {
  const stage=fluStage(flu?.severity??0);
  return stage==='extreme'?{pain:.05,consciousnessOffset:-.15,manipulationOffset:-.2,breathingOffset:-.2}:
    stage==='major'?{pain:0,consciousnessOffset:-.1,manipulationOffset:-.1,breathingOffset:-.15}:
    stage==='minor'?{pain:0,consciousnessOffset:-.05,manipulationOffset:-.05,breathingOffset:-.1}:
    {pain:0,consciousnessOffset:0,manipulationOffset:0,breathingOffset:0};
}

/** Core stages use vomiting MTB 1.5/0.75 days. One trial every 600 Core
 * ticks, never each local tick. */
export function fluVomitChance(flu:FluState|undefined):number {
  const stage=fluStage(flu?.severity??0);
  return stage==='major'?MAJOR_VOMIT_CHANCE:stage==='extreme'?EXTREME_VOMIT_CHANCE:0;
}

export function fluSeverityPerDay(flu:FluState,tick:number):number {
  const tending=flu.tend&&flu.tend.expiresAtCore>tick*10?.0773*flu.tend.quality/1000:0;
  return (flu.immunity>=FLU_UNIT?-.4947:.2488)-tending;
}

export function fluImmunityPerDay(record:MedicalRecord,context:MedicalContext,filtration=1):number {
  const flu=record.flu;
  return flu?.severity? .2388*immunityGainSpeed(record,context,filtration)*flu.luck/1_000_000 : -.06;
}
