import { PARASITE_CURE_TOTAL306,PARASITE_KINDS306,PARASITE_LABELS306,parasiteTendable306 } from '../sim/parasites-306';
import type { MedicalRecord } from '../sim/injury-types';

const EFFECTS={'gut-worms':'douleur +20 % · la faim augmente deux fois plus vite','muscle-parasites':'douleur +20 % · manipulation et déplacement −30 % · la fatigue augmente deux fois plus vite'} as const;
const hours=(core:number):string=>core<250?'< 0,1 h':`${(core/2500).toFixed(1)} h`;

/** Schema 306 parasites: actual tend state, without inventing a severity. */
export function parasiteInspection306(record:MedicalRecord|undefined,kind:typeof PARASITE_KINDS306[number]):{summary:string;care:string;guidance:string}|null {
  const state=record?.parasites306?.[kind];if(!state)return null;
  const remaining=Math.max(0,(state.tend?.expiresAtCore??0)-record!.tick*10);
  const progress=Math.min(99.9,state.totalTend*100/PARASITE_CURE_TOTAL306).toFixed(1);
  return {summary:`${PARASITE_LABELS306[kind]} · ${EFFECTS[kind]}.`,
    care:remaining>0?`Soin actif · qualité ${((state.tend?.quality??0)/10).toFixed(1)} % · effet restant ${hours(remaining)} · guérison ${progress} %.`:`Aucun soin actif · guérison ${progress} %.`,
    guidance:record!.death?'Dossier arrêté au décès.':parasiteTendable306(record!,kind)?'Nouveau soin possible maintenant ; la maladie disparaît quand les soins reçus totalisent 300 % de qualité.':'Le prochain soin sera possible à la fin de l’effet du soin actuel.'};
}
export function createParasitesInspection306(parent:HTMLElement):void {
  for(const kind of PARASITE_KINDS306){
    const section=document.createElement('div');section.dataset.health=kind;section.hidden=true;
    for(const field of ['summary','care','guidance'] as const){const p=document.createElement('p');p.dataset.parasite=field;section.append(p);}
    parent.append(section);
  }
}
export function updateParasitesInspection306(parent:Element,record:MedicalRecord|undefined):void {
  for(const kind of PARASITE_KINDS306){
    const section=parent.querySelector<HTMLElement>(`[data-health="${kind}"]`);if(!section)continue;
    const view=parasiteInspection306(record,kind);section.hidden=!view;if(!view)continue;
    for(const field of ['summary','care','guidance'] as const)section.querySelector<HTMLElement>(`[data-parasite="${field}"]`)!.textContent=view[field];
  }
}
