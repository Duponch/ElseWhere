import { IMMUNE_DISEASE_UNIT,immuneDiseaseStage } from '../sim/immune-diseases-rules';
import { immuneDiseaseNextTendCore,immuneDiseaseTendable } from '../sim/immune-diseases-state';
import { IMMUNE_DISEASE_KINDS,type ImmuneDiseaseKind } from '../sim/immune-diseases-types';
import type { MedicalRecord } from '../sim/injury-types';

export const IMMUNE_DISEASE_LABELS={malaria:'Paludisme',plague:'Peste','sleeping-sickness':'Maladie du sommeil'} as const;
const stages={minor:'léger',major:'majeur',extreme:'extrême',critical:'critique'} as const;
const hours=(core:number):string=>core<250?'< 0,1 h':`${(core/2500).toFixed(1)} h`;
const percent=(value:number):string=>`${(value>=IMMUNE_DISEASE_UNIT?100:Math.min(99.9,value*100/IMMUNE_DISEASE_UNIT)).toFixed(1)} %`;
export const activeImmuneDisease=(record:MedicalRecord|undefined):boolean=>!!record?.immuneDiseases&&(IMMUNE_DISEASE_KINDS.some(kind=>(record.immuneDiseases![kind]?.severity??0)>0));

/** The actual clinical state, without predicting recovery from rounded bars. */
export function immuneDiseaseInspection(record:MedicalRecord|undefined,kind:ImmuneDiseaseKind):{stage:string;summary:string;care:string;guidance:string}|null {
  const state=record?.immuneDiseases?.[kind];if(!state)return null;
  const label=IMMUNE_DISEASE_LABELS[kind],stage=immuneDiseaseStage(kind,state.severity);
  if(stage==='none')return {stage,summary:`${label} résolu · immunité résiduelle ${percent(state.immunity)}.`,care:'',guidance:'La protection résiduelle diminue avec le temps.'};
  const remaining=Math.max(0,(state.tend?.expiresAtCore??0)-record!.tick*10);
  const care=remaining>0?`Soin actif · qualité ${((state.tend?.quality??0)/10).toFixed(1)} % · effet restant ${hours(remaining)}.`:'Aucun soin actif.';
  const guidance=record!.death?'Dossier arrêté au décès.':state.immunity>=IMMUNE_DISEASE_UNIT?'Immunité acquise · convalescence en cours.':immuneDiseaseTendable(record!,kind)?'Nouveau soin possible maintenant.':`Renouvellement dans ${hours(Math.max(1,immuneDiseaseNextTendCore(state)-record!.tick*10))}.`;
  return {stage,summary:`${label} · stade ${stages[stage]} · gravité ${percent(state.severity)} · immunité ${percent(state.immunity)}${state.vomit?' · vomissements':''}.`,care,guidance};
}
export function createImmuneDiseasesInspection(parent:HTMLElement):void {
  for(const kind of IMMUNE_DISEASE_KINDS){
    const section=document.createElement('div');section.dataset.health=kind;section.hidden=true;
    for(const field of ['summary','care','guidance'] as const){const p=document.createElement('p');p.dataset.disease=field;section.append(p);}
    parent.append(section);
  }
}
export function updateImmuneDiseasesInspection(parent:Element,record:MedicalRecord|undefined):void {
  for(const kind of IMMUNE_DISEASE_KINDS){
    const section=parent.querySelector<HTMLElement>(`[data-health="${kind}"]`);if(!section)continue;
    const view=immuneDiseaseInspection(record,kind);section.hidden=!view;if(!view)continue;
    section.dataset.stage=view.stage;
    for(const field of ['summary','care','guidance'] as const)section.querySelector<HTMLElement>(`[data-disease="${field}"]`)!.textContent=view[field];
  }
}
