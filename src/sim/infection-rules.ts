import type { BodyPartId } from './body-definition.ts';
import { HP_UNIT,medicalPartInjuryRule } from './injury-rules.ts';
import type { Injury,MedicalContext,MedicalRecord } from './injury-types.ts';
import type { Infection } from './infection-types.ts';

export const INFECTION_UNIT=1_000_000_000;
export const INFECTION_INTERVAL=20; // 200 Core, independent of wound healing.
export const INFECTION_DELAY_MIN_CORE=15000;
export const INFECTION_DELAY_MAX_CORE=45000;
export const INFECTION_TEND_DURATION_CORE=37500;
export const INFECTION_TEND_OVERLAP_CORE=7500;
export const INFECTION_INITIAL=1_000_000;
/** The last two XML stages share the label extreme but different physiology. */
export function infectionStage(severity:number):'minor'|'major'|'extreme'|'critical' {
  return severity>=870_000_000?'critical':severity>=780_000_000?'extreme':severity>=330_000_000?'major':'minor';
}
interface InfectionModifiers {pain:number;consciousnessOffset:number;consciousnessMax:number;breathingOffset:number}
const NONE:InfectionModifiers=Object.freeze({pain:0,consciousnessOffset:0,consciousnessMax:Infinity,breathingOffset:0});
export function infectionModifiers(record:MedicalRecord):InfectionModifiers {
  if(!record.infections?.cases.length)return NONE;
  let pain=0,consciousnessOffset=0,consciousnessMax=Infinity,breathingOffset=0;
  for(const condition of record.infections.cases) {
    const stage=infectionStage(condition.severity);
    pain+=stage==='minor'?.05:stage==='major'?.08:stage==='extreme'?.12:.85;
    if(stage==='extreme')consciousnessOffset-=.05;
    if(stage==='critical'){consciousnessMax=.1;breathingOffset-=.05;}
  }
  return {pain,consciousnessOffset,consciousnessMax,breathingOffset};
}
export function injuryInfectionChance(record:MedicalRecord,injury:Pick<Injury,'kind'|'part'|'scar'>):number {
  if(injury.scar?.pain!==undefined||medicalPartInjuryRule(record,injury.part).solid)return 0;
  const chance=injury.kind==='shredded'?.2:(injury.kind==='bite'||injury.kind==='burn')?.3:['stab','cut','crush','gunshot'].includes(injury.kind)?.15:0;
  return chance*(record.body?.1:1);
}
export function infectionContractAllowed(record:MedicalRecord,part:BodyPartId):boolean {
  // Core checks Lerp(1,0,immunity/.6) <= .001, not a continuous multiplier.
  return !record.death&&(record.infections?.immunity??0)<599_400_000&&!record.infections?.cases.some(c=>c.part===part);
}
export function infectionAcquisitionFactor(injury:Injury):number {
  const hp=injury.severity/HP_UNIT;
  const severity=hp<=1?.1:hp>=12?1:.1+(hp-1)*.9/11;
  return severity*(injury.tended===undefined?1:(injury.infection?.roomFactor??1000)/1000*(.7-.3*Math.min(1,injury.tended/1000)));
}
export function infectionSeverityPerDay(record:MedicalRecord,condition:Infection):number {
  return ((record.infections?.immunity??0)>=INFECTION_UNIT?-.7:.84)-
    (condition.tend&&condition.tend.expiresAtCore>record.tick*10?.53*condition.tend.quality/1000:0);
}
/** Adult baseline. A bed/posture bonus requires an actual use supplied by World.
 * Missing needs are neutral for existing physiological callers and fixtures. */
export function immunityGainSpeed(record:MedicalRecord,context:MedicalContext,filtration=1):number {
  const hunger=context.hunger??(context.starving?0:100),rest=context.rest??100;
  const urgentHunger=record.body?18:12; // FoodLevelPercentageWantEat × .4.
  return (.5+.5*filtration)*(hunger<=0?.7:hunger<urgentHunger?.9:1)*(rest<1?.8:rest<14?.92:rest<28?.96:1)*
    (context.posture==='bed'?(context.bedImmunityFactor??1.07):1)*(context.restingBonus?1.1:1)*(context.ageImmunityFactor??1)*(context.traitImmunityFactor361??1);
}
export function infectionImmunityPerDay(record:MedicalRecord,context:MedicalContext,filtration=1):number {
  const first=record.infections?.cases[0];
  return first ? .6441*immunityGainSpeed(record,context,filtration)*first.luck/1_000_000 : -.4;
}
/** Local deterministic hash replaces Core's temporarily reseeded Rand. Persist
 * the result per identity so neither save/load nor treatment rerolls it. */
export function infectionLuck(seed:number,id:number):number {
  let n=(seed^Math.imul(id,0x9e3779b1)^156482735)>>>0;
  n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);n=(n^(n>>>15))>>>0;
  return 800000+Math.floor(n/0x100000000*400001);
}
