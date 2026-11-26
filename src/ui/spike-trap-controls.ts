import type {Command,Structure} from '../sim/types';
import {constructionCostText} from './construction-material-presentation';
/** Installed state is authoritative; a packed trap has no spawned contact. */
export function spikeTrapControls(trap:Structure,send:(command:Command)=>void):HTMLElement {
 const section=document.createElement('section');section.className='cell-facts';section.dataset.spikeTrap=String(trap.id);
 const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=!!trap.spikeTrap?.autoRebuild;
 input.id='spike-trap-auto-rebuild';input.onchange=()=>send({type:'spike-trap-auto-rebuild',structureId:trap.id,on:input.checked});
 label.append(input,document.createTextNode(' Reconstruire automatiquement'));
 const note=document.createElement('p');note.textContent=`Après déclenchement : nouveau plan, livraison de ${constructionCostText(trap)} et construction complète. Les alliés conservent un risque d’accident.`;
 section.append(label,note);return section;
}
