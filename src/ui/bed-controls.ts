import {isDoubleBedKind,isGroundSleepingSpotKind} from '../sim/bed-kinds';
import { isColonist } from '../sim/affiliation';
import { isBedKind } from '../sim/bed-kinds.ts';
import { footprintCells } from '../sim/definitions.ts';
import type { Cell,Command,Structure,World } from '../sim/types.ts';

export function bedControls(panel:HTMLElement,world:()=>World|undefined,cell:()=>Cell|undefined,send:(c:Command)=>void):void {
  const root=document.createElement('div');root.id='cell-bed';root.hidden=true;
  const ownerLabel=document.createElement('label');ownerLabel.textContent='Propriétaire du lit ';
  const owner=document.createElement('select');owner.id='bed-owner';owner.setAttribute('aria-label','Propriétaire du lit');owner.append(new Option('Non attribué',''));
  for(const p of world()?.pawns??[])if(isColonist(p)&&p.state!=='dead')owner.append(new Option(p.name,String(p.id)));
  const bed=()=>world()?.structures.find(s=>isBedKind(s.kind)&&footprintCells(s).some(c=>c.x===cell()?.x&&c.z===cell()?.z));
  owner.onchange=()=>{const b=bed();if(b)send({type:'assign-bed',bedId:b.id,pawnId:owner.value?Number(owner.value):null,...isDoubleBedKind(b.kind)?{slot:0 as const}:{}});};
  ownerLabel.append(owner);
  const secondLabel=document.createElement('label');secondLabel.textContent='Place 2 ';
  const second=document.createElement('select');second.id='bed-owner-second';second.setAttribute('aria-label','Propriétaire de la place 2');
  second.onchange=()=>{const b=bed();if(isDoubleBedKind(b?.kind))send({type:'assign-bed',bedId:b.id,slot:1,pawnId:second.value?Number(second.value):null});};secondLabel.append(second);secondLabel.hidden=true;
  const label=document.createElement('label');const medical=document.createElement('input');medical.type='checkbox';medical.id='bed-medical';medical.setAttribute('aria-label','Usage médical');
  medical.onchange=()=>{const b=bed();if(b)send({type:'medical-bed',bedId:b.id,enabled:medical.checked});};
  const prisonLabel=document.createElement('label'),prison=document.createElement('input');prison.type='checkbox';prison.id='bed-prisoner';prison.setAttribute('aria-label','Pour prisonniers');
  prison.onchange=()=>{const b=bed();if(b)send({type:'prison-bed',bedId:b.id,enabled:prison.checked});};
  prisonLabel.append(prison,' Pour prisonniers');
  const hint=document.createElement('p');hint.id='bed-prisoner-description';hint.className='muted';
  label.append(medical,' Usage médical');root.append(prisonLabel,label,ownerLabel,secondLabel,hint);panel.append(root);
}
export function updateBedControls(panel:HTMLElement,world:World,structure:Structure|undefined):void {
  const root=panel.querySelector<HTMLElement>('#cell-bed');if(!root)return;
  root.hidden=!structure||!isBedKind(structure.kind);if(!structure||!isBedKind(structure.kind))return;
  const owner=root.querySelector<HTMLSelectElement>('#bed-owner')!;
  const double=isDoubleBedKind(structure.kind),second=root.querySelector<HTMLSelectElement>('#bed-owner-second')!;
  const ground=isGroundSleepingSpotKind(structure.kind);
  owner.parentElement!.firstChild!.textContent=double?'Place 1 ':ground?'Propriétaire de l’emplacement ':'Propriétaire du lit ';
  owner.setAttribute('aria-label',double?'Propriétaire de la place 1':ground?'Propriétaire de l’emplacement':'Propriétaire du lit');second.parentElement!.hidden=!double;
  owner.disabled=!!structure.medical||!!structure.prisoner;
  owner.parentElement!.hidden=!!structure.prisoner;
  const currentOptions=[...owner.options].map(o=>o.value).join(',');
  const candidates=world.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&(!double||!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&!p.health?.death));
  if(currentOptions!==['',...candidates.map(p=>String(p.id))].join(','))owner.replaceChildren(new Option('Non attribué',''),...candidates.map(p=>new Option(p.name,String(p.id))));
  if(document.activeElement!==owner)owner.value=String(world.pawns.find(p=>p.bedId===structure.id&&(!double||p.bedSlot===0))?.id??'');
  if(double){
    if([...second.options].map(o=>o.value).join(',')!==['',...candidates.map(p=>String(p.id))].join(','))second.replaceChildren(new Option('Non attribué',''),...candidates.map(p=>new Option(p.name,String(p.id))));
    if(document.activeElement!==second)second.value=String(world.pawns.find(p=>p.bedId===structure.id&&p.bedSlot===1)?.id??'');
  }
  root.querySelector<HTMLInputElement>('#bed-medical')!.checked=!!structure.medical;
  root.querySelector<HTMLInputElement>('#bed-prisoner')!.checked=!!structure.prisoner;
  root.querySelector<HTMLInputElement>('#bed-medical')!.parentElement!.hidden=double;
  root.querySelector<HTMLInputElement>('#bed-prisoner')!.parentElement!.hidden=double;
  const prisoner=world.pawns.find(p=>p.prisoner&&(p.bedId===structure.id||p.need?.kind==='sleep'&&p.need.bedId===structure.id));
  const role=double?'Deux places civiles indépendantes. Affectez deux colons ; une place automatique dans le lit d’un autre colon est réservée à son partenaire. Usage médical et prisonniers indisponibles pour ce modèle.':structure.prisoner?`Réservé aux captifs. Une pièce fermée et accessible est nécessaire à la capture.${prisoner?` Occupant : ${prisoner.name}.`:''}`:'';
  root.querySelector('#bed-prisoner-description')!.textContent=`${ground?'Emplacement gratuit pour une personne, posé et retiré immédiatement. Le corps reste au sol ; aucun matelas, matériau ou chantier. Vérifiez le toit, la température et l’accès. ':''}${role}`.trim();
}
