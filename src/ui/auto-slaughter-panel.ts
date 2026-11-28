import {animalSpecies} from '../sim/animal-species';
import {visibleAutoSlaughterSpecies,defaultAutoSlaughterConfig,type AutoSlaughterConfig} from '../sim/auto-slaughter-state';
import {autoSlaughterCounts} from '../sim/auto-slaughter';
import type {World} from '../sim/types';
import './auto-slaughter-panel.css';

export type AutoSlaughterSend=(config:AutoSlaughterConfig)=>Promise<void>;
export const AUTO_SLAUGHTER_FIELDS=['maxTotal','maxMales','maxFemales','maxMalesYoung','maxFemalesYoung'] as const;
const labels=['Total','Adultes ♂','Adultes ♀','Jeunes ♂','Jeunes ♀'];
const countFields=['total','males','females','malesYoung','femalesYoung'] as const;
interface Controls {update:(world:World,send?:AutoSlaughterSend)=>void}
const controls=new WeakMap<HTMLElement,Controls>();

export function autoSlaughterScaffold():string {
  return '<details class="auto-slaughter-controls" data-auto-slaughter><summary>Réguler le troupeau</summary><p>Les maxima concernent les animaux admissibles à l’abattage automatique. Les gestantes protégées restent dans la population. Petits et juvéniles comptent comme jeunes. ∞ conserve tous les animaux de ce groupe.</p><div class="auto-slaughter-table-wrap" data-auto-slaughter-table></div><p data-auto-slaughter-feedback role="status"></p></details>';
}

/** Controls keep their DOM and draft while snapshots update confirmed counts.
 * A changed field sends the complete policy and waits for its acknowledgement. */
export function updateAutoSlaughterPanel(root:HTMLElement,world:World,send?:AutoSlaughterSend):void {
  let component=controls.get(root);
  if(!component){
    let current=world,dispatch=send,pending=false,pendingDraft:AutoSlaughterConfig|undefined;
    const host=root.querySelector<HTMLElement>('[data-auto-slaughter]')!;
    const feedback=host.querySelector<HTMLElement>('[data-auto-slaughter-feedback]')!;
    const table=document.createElement('table');table.className='auto-slaughter-table';
    table.innerHTML=`<thead><tr><th scope="col">Espèce</th><th scope="col">Population</th>${labels.map(label=>`<th scope="col">${label}<small>Actuel / max.</small></th>`).join('')}<th scope="col">Gestantes<small>Abattage autorisé</small></th>${current.schemaVersion>=382?'<th scope="col">Liés<small>Abattage autorisé</small></th>':''}<th scope="col">Réinitialiser</th></tr></thead><tbody></tbody>`;
    const body=table.querySelector('tbody')!;
    const config=(species:AutoSlaughterConfig['species'])=>pendingDraft?.species===species?pendingDraft:current.autoSlaughter?.find(c=>c.species===species)??defaultAutoSlaughterConfig(species);
    const commit=async(next:AutoSlaughterConfig)=>{
      if(pending||!dispatch)return;pending=true;pendingDraft={...next};host.setAttribute('aria-busy','true');feedback.textContent='';refresh();
      try{await dispatch(next);feedback.textContent='Réglage enregistré.';}
      catch(error){feedback.textContent=error instanceof Error?error.message:String(error);}
      finally{pending=false;pendingDraft=undefined;host.removeAttribute('aria-busy');refresh();}
    };
    const rows=visibleAutoSlaughterSpecies(current).map(species=>{
      const row=document.createElement('tr');row.dataset.autoSlaughterSpecies=species;
      const name=document.createElement('th');name.scope='row';name.textContent=animalSpecies(species).label;
      const population=document.createElement('td');population.dataset.autoSlaughterPopulation='';
      row.append(name,population);
      const fields=AUTO_SLAUGHTER_FIELDS.map((field,index)=>{
        const cell=document.createElement('td'),count=document.createElement('span'),input=document.createElement('input'),infinity=document.createElement('button');
        count.dataset.autoSlaughterCount=countFields[index]!;input.type='number';input.min='0';input.step='1';input.max=String(Number.MAX_SAFE_INTEGER);input.dataset.autoSlaughterField=field;
        input.setAttribute('aria-label',`${animalSpecies(species).label} · maximum ${labels[index]}`);
        infinity.type='button';infinity.dataset.autoSlaughterInfinity=field;infinity.textContent='∞';
        input.onchange=()=>{const value=Number(input.value);if(input.value.trim()===''||!Number.isSafeInteger(value)||value<0){feedback.textContent='Le maximum doit être un entier positif ou nul.';refresh();return;}void commit({...config(species),[field]:value});};
        infinity.onclick=()=>void commit({...config(species),[field]:config(species)[field]===-1?autoSlaughterCounts(current,species)[countFields[index]!]:-1});
        cell.append(count,input,infinity);row.append(cell);return {field,count,input,infinity};
      });
      const pregnantCell=document.createElement('td'),pregnantCount=document.createElement('span'),pregnant=document.createElement('input');pregnant.type='checkbox';pregnant.dataset.autoSlaughterPregnant='';pregnant.setAttribute('aria-label',`${animalSpecies(species).label} · autoriser l’abattage des gestantes`);pregnant.onchange=()=>void commit({...config(species),allowPregnant:pregnant.checked});pregnantCell.append(pregnantCount,pregnant);
      const bondedCell=document.createElement('td'),bonded=document.createElement('input');bonded.type='checkbox';bonded.dataset.autoSlaughterBonded='';bonded.setAttribute('aria-label',animalSpecies(species).label+" : autoriser l'abattage des animaux liés");bonded.onchange=()=>{const next={...config(species)};if(bonded.checked)next.allowBonded382=true;else delete next.allowBonded382;void commit(next);};bondedCell.append(bonded);
      const resetCell=document.createElement('td'),reset=document.createElement('button');reset.type='button';reset.textContent='Réinitialiser';reset.dataset.autoSlaughterReset='';reset.onclick=()=>void commit(defaultAutoSlaughterConfig(species));resetCell.append(reset);row.append(pregnantCell,...current.schemaVersion>=382?[bondedCell]:[],resetCell);body.append(row);
      return {species,population,fields,pregnantCount,pregnant,bonded,reset};
    });
    host.querySelector('[data-auto-slaughter-table]')!.replaceChildren(table);
    function refresh(){
      for(const row of rows){
        const policy=config(row.species),counts=autoSlaughterCounts(current,row.species);
        row.population.textContent=String(current.wildlife?.animals.filter(a=>a.domestic&&a.state!=='dead'&&!a.health?.death&&a.species===row.species).length??0);
        for(let index=0;index<row.fields.length;index++){
          const {field,count,input,infinity}=row.fields[index]!,limit=policy[field],value=counts[countFields[index]!];
          count.textContent=String(value);count.classList.toggle('quota-exceeded',limit!==-1&&value>limit);
          input.hidden=limit===-1;if(document.activeElement!==input)input.value=limit===-1?'':String(limit);
          input.disabled=pending||!dispatch;infinity.disabled=pending||!dispatch;infinity.setAttribute('aria-label',`${animalSpecies(row.species).label} · ${labels[index]} : ${limit===-1?'fixer le maximum à l’effectif actuel':'retirer la limite'}`);
          infinity.setAttribute('aria-pressed',String(limit===-1));
        }
        row.pregnantCount.textContent=String(counts.pregnant);row.pregnant.checked=policy.allowPregnant;row.pregnant.disabled=pending||!dispatch;row.reset.disabled=pending||!dispatch;row.bonded.checked=policy.allowBonded382===true;row.bonded.disabled=pending||!dispatch;
      }
    }
    component={update:(next,nextSend)=>{const species=visibleAutoSlaughterSpecies(next);if(!pending&&(species.length!==rows.length||species.some((id,index)=>id!==rows[index]?.species))){controls.delete(root);updateAutoSlaughterPanel(root,next,nextSend);return;}current=next;dispatch=nextSend;refresh();}};controls.set(root,component);
  }
  component.update(world,send);
}
