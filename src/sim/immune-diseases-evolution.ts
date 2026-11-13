import { assessMedical,reconcileMedicalDeath } from './injury-state.ts';
import { IMMUNE_DISEASE_INTERVAL,IMMUNE_DISEASE_UNIT,immuneDiseaseImmunityPerDay,immuneDiseaseSeverityPerDay } from './immune-diseases-rules.ts';
import { IMMUNE_DISEASE_KINDS } from './immune-diseases-types.ts';
import type { MedicalContext,MedicalRecord } from './injury-types.ts';

/** All severity changes and lethal thresholds precede immunity gains. */
export function advanceImmuneDiseases(record:MedicalRecord,context:MedicalContext):void {
  const states=record.immuneDiseases;if(!states||record.death||record.body)return;
  for(const kind of IMMUNE_DISEASE_KINDS){
    const state=states[kind];if(!state)continue;
    if(state.severity&&record.tick>state.bornAt&&record.tick%IMMUNE_DISEASE_INTERVAL===context.phase%IMMUNE_DISEASE_INTERVAL){
      state.severity=Math.max(0,Math.min(IMMUNE_DISEASE_UNIT,state.severity+Math.round(immuneDiseaseSeverityPerDay(kind,state,record.tick)*IMMUNE_DISEASE_UNIT/300)));
      if(!state.severity)delete state.tend;
      reconcileMedicalDeath(record);if(record.death)return;
    }
  }
  const filtration=IMMUNE_DISEASE_KINDS.some(kind=>!!states[kind]?.severity)?assessMedical(record).capacities.bloodFiltration:1;
  for(const kind of IMMUNE_DISEASE_KINDS){
    const state=states[kind];if(!state)continue;
    state.immunity=Math.max(0,Math.min(IMMUNE_DISEASE_UNIT,state.immunity+Math.round(immuneDiseaseImmunityPerDay(record,kind,context,filtration)*IMMUNE_DISEASE_UNIT/6000)));
    if(!state.severity&&!state.immunity&&!state.vomit)delete states[kind];
  }
  if(!IMMUNE_DISEASE_KINDS.some(kind=>states[kind]))delete record.immuneDiseases;
}
