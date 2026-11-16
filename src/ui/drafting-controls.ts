import type { Command,Pawn } from '../sim/types';
import { isLocallyControllableColonist } from './colonist-availability';
import { mentalCrisisLabel,mentalCrisisRefusal } from '../sim/mental-presentation';
import { setTooltip } from './tooltip';

export const draftLabel=(p:Pawn):string=>p.need?.kind==='eat'&&p.need.forced?(p.need.alcoholReason?(p.need.phase==='ingest'?'Mobilisé · boit une bière':'Mobilisé · rejoint la bière'):(p.need.phase==='ingest'?'Mobilisé · mange':'Mobilisé · rejoint l’aliment')):p.tend?.drafted?(p.tend.phase==='tend'?'Mobilisé · soins sans médicament':'Mobilisé · rejoint le patient'):p.rescue&&p.orders.active==='rescue'?(p.rescue.phase==='carry'?'Mobilisé · porte le patient':'Mobilisé · rejoint le patient pour le secourir'):p.shooting?.stance?.phase==='aim'?'Mobilisé · vise':p.shooting?.stance?.phase==='cooldown'?'Mobilisé · récupération après tir':p.shooting?.order?'Mobilisé · rejoint sa position de tir':p.need?.kind==='sleep'?'Mobilisé · effondré de fatigue':p.draft?.target&& (p.x!==p.draft.target.x||p.z!==p.draft.target.z||p.moveCooldown>0)?`Mobilisé · vers ${p.draft.target.x}, ${p.draft.target.z}`:'Mobilisé · attend les ordres';
/** UI selection policy. The worker remains the authority when health changes. */
export const draftablePawns=(pawns:readonly Pawn[]):Pawn[]=>pawns.filter(isLocallyControllableColonist);
export const draftedPawns=(pawns:readonly Pawn[]):Pawn[]=>draftablePawns(pawns).filter(p=>!!p.draft);
/** Core merges the Draft gizmos of a selection (Command_Toggle,
 * groupKeyIgnoreContent). GizmoGridDrawer shows a non-disabled gizmo, and
 * with activateIfAmbiguous (the default) an inactive one when there is one; a
 * click also toggles every grouped gizmo in that same state
 * (InheritInteractionsFrom). So a mixed selection is drafted entirely and
 * only a fully drafted one is undrafted. Downed pawns keep a disabled gizmo
 * and are left out; a pawn in a mental state has none. */
export function selectionDraftCommand(pawns:readonly Pawn[]):Command|undefined {
  const eligible=draftablePawns(pawns);
  return eligible.length?{type:'draft',pawnIds:eligible.map(p=>p.id),enabled:!eligible.every(p=>p.draft)}:undefined;
}
/** Same merge for Fire at will (shown on drafted pawns only): any pawn
 * holding fire makes the click turn fire at will on. */
export function selectionFireAtWillCommand(pawns:readonly Pawn[]):Command|undefined {
  const drafted=draftedPawns(pawns);
  return drafted.length?{type:'fire-at-will',pawnIds:drafted.map(p=>p.id),enabled:drafted.some(p=>p.draft!.holdFire)}:undefined;
}
/** Stop every drafted pawn of the selection. */
export function selectionStopCommand(pawns:readonly Pawn[]):Command|undefined {
  const drafted=draftedPawns(pawns);
  return drafted.length?{type:'draft-stop',pawnIds:drafted.map(p=>p.id)}:undefined;
}
export function toggleDraft(pawns:Pawn[],send:(c:Command)=>void):void {
  const command=selectionDraftCommand(pawns);
  if(command)send(command);
}
export function createDraftControls(parent:HTMLElement,current:()=>Pawn[],send:(c:Command)=>void):void {
  const box=document.createElement('div');box.id='draft-controls';
  box.innerHTML='<button id="toggle-draft" class="secondary-action">Mobiliser · R</button><button id="stop-draft" class="secondary-action" hidden>Arrêter l’ordre</button><button id="fire-at-will" class="secondary-action" hidden>Tirer à volonté</button><label id="inspector-hostility-label" hidden>Réaction hostile <select id="inspector-hostility"><option value="flee">Fuir</option><option value="attack">Attaquer</option><option value="ignore">Ignorer</option></select></label><p id="draft-help" class="muted"></p>';
  box.querySelector<HTMLButtonElement>('#toggle-draft')!.onclick=()=>toggleDraft(current(),send);
  box.querySelector<HTMLButtonElement>('#stop-draft')!.onclick=()=>{const command=selectionStopCommand(current());if(command)send(command);};
  box.querySelector<HTMLButtonElement>('#fire-at-will')!.onclick=()=>{const command=selectionFireAtWillCommand(current());if(command)send(command);};
  box.querySelector<HTMLSelectElement>('#inspector-hostility')!.onchange=e=>{const selected=draftablePawns(current()),p=selected.length===1?selected[0]:undefined;if(p)send({type:'hostility-response',pawnId:p.id,response:(e.target as HTMLSelectElement).value as 'flee'|'attack'|'ignore'});};
  parent.prepend(box);
}
export function updateDraftControls(parent:HTMLElement,pawns:Pawn[]):void {
  const toggle=parent.querySelector<HTMLButtonElement>('#toggle-draft');if(!toggle)return;
  const eligible=draftablePawns(pawns),drafted=eligible.filter(p=>!!p.draft),all=eligible.length>0&&drafted.length===eligible.length;
  parent.querySelector<HTMLElement>('#inspector-hostility-label')!.hidden=eligible.length!==1||!!eligible[0]?.draft;
  if(eligible.length===1)parent.querySelector<HTMLSelectElement>('#inspector-hostility')!.value=eligible[0]!.hostilityResponse??'flee';
  toggle.textContent=all?'Démobiliser · R':'Mobiliser · R';toggle.setAttribute('aria-pressed',String(all));toggle.disabled=!eligible.length;
  const stop=parent.querySelector<HTMLButtonElement>('#stop-draft')!;stop.hidden=!drafted.length;stop.disabled=!drafted.length;
  const fire=parent.querySelector<HTMLButtonElement>('#fire-at-will')!;fire.hidden=!drafted.length;fire.disabled=!drafted.length;fire.setAttribute('aria-pressed',String(drafted.length>0&&drafted.every(p=>!p.draft!.holdFire)));fire.textContent=drafted.some(p=>p.draft?.holdFire)?'Tirer à volonté : désactivé / mixte':'Tirer à volonté : activé';
  const excluded=pawns.length-eligible.length,crises=pawns.filter(p=>p.mental?.crisis);
  const scope=excluded?`${excluded} membre(s) indisponible(s) ou hors colonie exclus. `:'';
  const refused=crises.length===1?`${mentalCrisisRefusal(crises[0]!)} `:crises.length?`${crises.length} colons en crise (${[...new Set(crises.map(p=>mentalCrisisLabel(p.mental!.crisis!.kind)))].join(', ')}) refusent les ordres. `:'';
  const help=parent.querySelector<HTMLElement>('#draft-help')!;
  help.textContent=refused+scope+(all?`Clic droit sur le sol : déplacement. Sur un aliment : Consommer. Sur une cible : attaque, ou soins sans médicament sur un patient à terre ou couché. Maj : file de déplacements. ${drafted.reduce((n,p)=>n+p.draft!.queue.length,0)} déplacement(s) en attente.`:drafted.length?'Sélection mixte : R mobilise les autres colons disponibles. Les ordres tactiques concernent seulement les mobilisés.':!eligible.length?'Aucun colon libre capable d’être mobilisé.':'R mobilise les colons disponibles.');
  help.tabIndex=crises.length?0:-1;
  setTooltip(help,{title:'Contrôle du colon',body:help.textContent});
  setTooltip(toggle,{title:all?'Démobiliser':'Mobiliser',body:parent.querySelector('#draft-help')!.textContent??'',rows:[{label:'Raccourci',value:'R'}]});
  setTooltip(stop,{title:'Arrêter l’ordre',body:'Arrêter les déplacements, attaques, repas et soins mobilisés en cours. Les colons restent mobilisés.'});
  setTooltip(fire,{title:'Tirer à volonté',body:'Autoriser ou suspendre les tirs automatiques des colons mobilisés.'});
  setTooltip(parent.querySelector<HTMLElement>('#inspector-hostility-label')!,{title:'Réaction hostile',body:'Comportement autonome face à une menace lorsque le colon n’est pas mobilisé : fuir, attaquer ou ignorer.'});
}
