import { breakThresholds,globalLearningFactor,type TraitBearer } from '../sim/traits';
import { loreTextsRevision, traitLabel, traitTooltip } from '../lore/lore-text';
type Person={name?:string;appearance?:{sex:'male'|'female'}};
import { setTooltip } from './tooltip';
import { MENTAL_CRISIS_CATALOG } from '../sim/mental-catalog';

export function traitSummary(pawn:TraitBearer&Person):string {
  return pawn.traits?.map(id=>traitLabel(id,pawn.appearance?.sex)).join(' · ')??'Aucun trait attribué';
}
export function createTraitsInspection(parent:HTMLElement):void {
  const heading=document.createElement('h3');heading.textContent='Traits';
  const list=document.createElement('ul');list.dataset.traits='';
  const stats=document.createElement('details');stats.className='trait-stat-entry';
  const statsSummary=document.createElement('summary');statsSummary.textContent='Effets du profil';
  const statsText=document.createElement('p');statsText.dataset.traitStats='';statsText.className='muted';stats.append(statsSummary,statsText);
  parent.append(heading,list,stats);
}
export function updateTraitsInspection(panel:HTMLElement,pawn:TraitBearer&Person):void {
  const list=panel.querySelector<HTMLElement>('[data-traits]');if(!list)return;
  const signature=JSON.stringify([pawn.traits??[],pawn.name,pawn.appearance?.sex,loreTextsRevision()]);
  if(list.dataset.signature!==signature){
    list.dataset.signature=signature;
    list.replaceChildren(...(pawn.traits?.map(id=>{const li=document.createElement('li');li.dataset.trait=id;li.tabIndex=0;const person={name:pawn.name??'',sex:pawn.appearance?.sex},label=traitLabel(id,person.sex);li.textContent=label;setTooltip(li,{title:label,body:traitTooltip(id,person)});return li;})??[Object.assign(document.createElement('li'),{textContent:'Aucun trait'})]));
  }
  const crises=Object.values(MENTAL_CRISIS_CATALOG).map(crisis=>crisis.label.toLowerCase()).join(', ');
  panel.querySelector('[data-trait-stats]')!.textContent=`Apprentissage général ${Math.round(globalLearningFactor(pawn)*100)} %. Risque de crise sous ${breakThresholds(pawn).map(n=>Number(n.toFixed(2))).join(' / ')} % d’humeur (mineur / majeur / extrême). Le risque ne déclenche pas une crise immédiatement. Crises disponibles : ${crises}.`;
  const stats=panel.querySelector<HTMLElement>('.trait-stat-entry')!;
  setTooltip(stats,{title:'Effets du profil',body:panel.querySelector('[data-trait-stats]')!.textContent??''});
}
