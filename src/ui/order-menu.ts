import {appendFirefoamOptions290} from './firefoam-controls-290';
import {appendShipCasketOptions277} from './ship-casket-controls-277';
import {appendCryptosleepOptions271} from './cryptosleep-controls-271';
import {footprintContains} from '../sim/definitions';
import {isAncientCasket256} from '../sim/ancient-casket-state-256';
import { firePosition } from '../sim/fire-rules';
import type { SimulationClient } from '../bridge/SimulationClient';
import type { Cell, Pawn, World } from '../sim/types';
import { isColonist } from '../sim/affiliation';
import { combatTarget, isAnimalTarget,isMechanoidTarget,hostileTarget } from '../sim/combat-target';
import { animalSpecies } from '../sim/animal-species';
import { mechanoidDefinition } from '../sim/mechanoid-definition';
import { shotPlan, shootingQueries } from '../sim/shooting';
import { meleeTools } from '../sim/melee-statistics';
import { meleePlaces, meleeRoute } from '../sim/melee-space';
import { blockedCells, reachableCells } from '../sim/pathfinding';
import { draftedTendingReason, draftedTendingProposal } from '../sim/drafted-tending';
import { rescueReason,rescueProposal,wantsRescue } from '../sim/rescue';
import { draftablePawns } from './drafting-controls';
import { FOOD_ITEMS } from '../sim/food-policy';
import { groundPilesAt } from '../sim/ground-placement';
import { setTooltip } from './tooltip';

export interface TacticalAttackOption {
  kind: 'shoot' | 'melee';
  label: string;
  pawnIds: number[];
  enabled: boolean;
  reason?: string;
}
export interface TacticalAttackPolicy {
  target: string;
  selected: number;
  drafted: number;
  reason?: string;
  options: TacticalAttackOption[];
}

/** Uses the same eligibility and route/line kernels as the committed commands.
 * The worker still rechecks every order against its current world. */
export function tacticalPawns(world: World, ids: ReadonlySet<number>): Pawn[] {
  const carried = new Set(world.pawns.filter(pawn => pawn.rescue?.phase === 'carry').map(pawn => pawn.rescue!.patientId));
  return draftablePawns(world.pawns.filter(pawn => ids.has(pawn.id)&&!pawn.prisoner)).filter(pawn => !!pawn.draft && pawn.state !== 'sleeping' && !pawn.need && !pawn.collapsePending && !carried.has(pawn.id)).sort((a, b) => a.id - b.id);
}

export function tacticalAttackPolicy(world: World, ids: ReadonlySet<number>, targetId: number, queue: boolean): TacticalAttackPolicy {
  const pawns = tacticalPawns(world, ids), target = combatTarget(world, targetId);
  const base = { selected: ids.size, drafted: pawns.length, target: target ? isAnimalTarget(target) ? `${animalSpecies(target.species).label} ${target.id}` : isMechanoidTarget(target)?`${mechanoidDefinition(target.mechKind).label} ${target.id}`:target.name : `cible ${targetId}` };
  if(target&&isAnimalTarget(target)&&target.domestic)return {...base,reason:'Cet animal appartient à la colonie.',options:[]};
  if (!pawns.length) return { ...base, reason: 'Mobilisez un colon libre et capable de combattre.', options: [] };
  if (!target || target.state === 'dead') return { ...base, reason: 'Cible vivante indisponible.', options: [] };
  // The ordinary context action must not turn a selected friend or neutral human
  // into a target. Explicit attack targeting elsewhere has its own controls.
  if (!isAnimalTarget(target) && !pawns.some(pawn => hostileTarget(pawn, target))) return { ...base, reason: 'Aucune attaque contextuelle sur un allié ou une personne neutre.', options: [] };
  if (queue) return { ...base, options: (['shoot', 'melee'] as const).map(kind => ({
    kind, label: `${kind === 'shoot' ? 'Tirer sur' : 'Attaquer au contact'} ${base.target}`,
    pawnIds: [], enabled: false, reason: 'La file d’attaques n’est pas disponible ; relâchez Maj.',
  })) };
  const shotQueries = shootingQueries(world), shootIds: number[] = [], meleeIds: number[] = [];
  let shootReason = '', meleeReason = '';
  const blocked = blockedCells(world), claimed = new Set<number>();
  for (const pawn of pawns) {
    const shot = shotPlan(world, pawn, targetId, shotQueries);
    if ('reason' in shot) shootReason ||= shot.reason ?? 'Tir indisponible.';
    else shootIds.push(pawn.id);
    if (!meleeTools(world, pawn).length) { meleeReason ||= 'Aucune attaque de mêlée disponible.'; continue; }
    const path = meleeRoute(world, pawn, meleePlaces(world, pawn, target, claimed), blocked);
    if (!path) { meleeReason ||= 'Aucune place de mêlée accessible et libre.'; continue; }
    const end = path.at(-1) ?? pawn;
    claimed.add(end.z * world.width + end.x);
    meleeIds.push(pawn.id);
  }
  const option = (kind: TacticalAttackOption['kind'], pawnIds: number[], reason: string): TacticalAttackOption => ({
    kind,
    label: `${kind === 'shoot' ? 'Tirer sur' : 'Attaquer au contact'} ${base.target}${pawns.length > 1 ? ` · ${pawnIds.length}/${pawns.length} colon(s)` : ''}`,
    pawnIds,
    enabled: pawnIds.length > 0,
    ...!pawnIds.length ? { reason } : {},
  });
  return { ...base, options: [option('shoot', shootIds, shootReason), option('melee', meleeIds, meleeReason)] };
}

export interface TacticalTendingOption {
  patientId:number; pawnId?:number; label:string; enabled:boolean; reason?:string;
}
/** Clinical eligibility is independent of the ability to attack. */
export function tacticalTendingPolicy(world:World,ids:ReadonlySet<number>,targetId:number,queue:boolean):TacticalTendingOption|undefined {
  const patient=world.pawns.find(p=>p.id===targetId);if(!patient)return;
  const doctor=ids.size===1?world.pawns.find(p=>ids.has(p.id)):undefined;
  const reason=queue?'Les soins mobilisés ne peuvent pas être mis en file ; relâchez Maj.'
    :ids.size!==1?'Sélectionnez un seul colon pour les soins mobilisés.'
    :!doctor?'Ce colon est indisponible.'
    :draftedTendingReason(world,doctor,patient)
      ??(!draftedTendingProposal(world,doctor,patient,reachableCells(world,doctor,blockedCells(world),new Set()))?'Aucune place de soin accessible et libre.':undefined);
  return {patientId:patient.id,...doctor?{pawnId:doctor.id}:{},label:`Soigner ${patient.name} (sans médicament)`,enabled:!reason,...reason?{reason}:{}};
}

/** Explicit bed rescue is distinct from dry field tending. Availability uses
 * the worker's real patient/claim/path kernels and is read only on opening a menu. */
export function tacticalRescuePolicy(world:World,ids:ReadonlySet<number>,targetId:number,queue:boolean):TacticalTendingOption|undefined {
  const patient=world.pawns.find(p=>p.id===targetId);
  if(world.schemaVersion<237||!patient||!wantsRescue(patient,true))return;
  const actor=ids.size===1?world.pawns.find(p=>ids.has(p.id)):undefined;
  const reason=queue?'Le secours direct ne peut pas être mis en file ; relâchez Maj.'
    :ids.size!==1?'Sélectionnez un seul colon pour le secours.'
    :!actor?.draft||!isColonist(actor)||actor.prisoner?'Mobilisez un colon libre pour ce secours tactique.'
    :rescueReason(world,actor,patient,true)
      ??(!rescueProposal(world,actor,patient,reachableCells(world,actor,blockedCells(world),new Set()),true)?'Aucun couchage accessible et disponible.':undefined);
  return {patientId:patient.id,...actor?{pawnId:actor.id}:{},label:`Secourir ${patient.name}`,enabled:!reason,...reason?{reason}:{}};
}

/** One selected actor must choose food or beer explicitly, rather than accidentally
 * walking to it. Distinct piles in an ordinary reserve or shelf stay distinct. */
export function contextConsumesFood(world:World,ids:ReadonlySet<number>,cell:Cell,targetId?:number):boolean {
  return targetId===undefined&&ids.size===1&&groundPilesAt(world,cell).some(p=>p.kind==='food'&&FOOD_ITEMS.includes(p.item as typeof FOOD_ITEMS[number])||world.schemaVersion>=265&&p.item==='beer');
}

export class OrderMenu {
  private readonly menu=document.createElement('div');
  private revision=0;
  constructor(private readonly client:Pick<SimulationClient,'command'|'orderOptions'>,private readonly report:(message:string,error?:boolean)=>void) {
    this.menu.className='order-menu panel';this.menu.id='order-menu';this.menu.hidden=true;
    this.menu.setAttribute('role','menu');this.menu.setAttribute('aria-label','Ordres du colon');this.menu.tabIndex=-1;
    document.body.append(this.menu);
    document.addEventListener('pointerdown',event=>{if(!this.menu.contains(event.target as Node))this.close();},true);
    window.addEventListener('blur',()=>this.close());window.addEventListener('resize',()=>this.close());
    this.menu.addEventListener('keydown',event=>{
      const buttons=[...this.menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if(event.key==='Escape'){this.close();document.querySelector<HTMLCanvasElement>('[data-testid="world-canvas"]')?.focus();}
      else if(event.key==='ArrowDown'||event.key==='ArrowUp') {
        const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index+(event.key==='ArrowDown'?1:buttons.length-1)+buttons.length)%buttons.length]?.focus();
      } else if(event.key==='Tab'){this.close();return;} else return;
      event.stopPropagation();event.preventDefault();
    });
  }
  close():boolean {this.revision++;const open=!this.menu.hidden;this.menu.hidden=true;return open;}
  /** A ground click can move immediately. A pawn or animal click always opens
   * explicit attack choices and never becomes a movement order. */
  async openTactical(world:World,ids:ReadonlySet<number>,cell:Cell,x:number,y:number,queue:boolean,targetId?:number):Promise<void> {
    // A turret service is a personal haul order, including while mobilized.
    // Ask the worker for its real eligibility instead of treating the building
    // as a ground movement or a living attack target.
    if(world.structures.some(s=>(isAncientCasket256(s)||s.kind==='cryptosleep-casket'||s.kind==='ship-cryptosleep-casket'||[290,291,292,293,294,295,296,297,298,299,300,301].includes(world.schemaVersion)&&s.kind==='firefoam-popper')&&footprintContains(s,cell)&&(targetId===undefined||targetId===s.id))||contextConsumesFood(world,ids,cell,targetId)||targetId===undefined&&world.structures.some(s=>s.kind==='mini-turret'&&s.x===cell.x&&s.z===cell.z)){
      await this.open(world,ids,cell,x,y,queue);return;
    }
    this.close();
    if(targetId===undefined) {
      const pawns=tacticalPawns(world,ids);
      if(!pawns.length) {this.tacticalMessage('Ordre tactique', 'Mobilisez un colon libre et capable de se déplacer.', x, y);return;}
      try {
        await this.client.command({type:'draft-move',pawnIds:pawns.map(p=>p.id),target:cell,queue});
        this.report(`${queue?'Déplacement en file':'Déplacement'} demandé vers ${cell.x}, ${cell.z}.`);
      } catch(error) {this.report(String(error instanceof Error?error.message:error),true);}
      return;
    }
    const policy=tacticalAttackPolicy(world,ids,targetId,queue);
    const tending=tacticalTendingPolicy(world,ids,targetId,queue);
    const rescue=tacticalRescuePolicy(world,ids,targetId,queue);
    this.menu.replaceChildren();this.menu.hidden=false;
    const header=document.createElement('strong');header.textContent=`${policy.target} · case ${cell.x}, ${cell.z}`;
    const content=document.createElement('div');
    if(policy.reason&&!tending&&!rescue)content.textContent=policy.reason;
    if(ids.size===1)appendShipCasketOptions277(content,world,[...ids][0]!,cell,queue,{close:()=>this.close(),send:c=>this.client.command(c),report:(m,e)=>this.report(m,e)},targetId);
    if(rescue){
      const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.dataset.orderRescue=String(rescue.patientId);
      button.textContent=rescue.enabled?rescue.label:`${rescue.label} — ${rescue.reason}`;button.disabled=!rescue.enabled;
      button.onclick=()=>{
        if(!rescue.enabled||rescue.pawnId===undefined)return;
        this.close();void this.client.command({type:'order-rescue',pawnId:rescue.pawnId,patientId:rescue.patientId,queue:false})
          .then(()=>this.report(`Secours demandé pour ${policy.target}.`)).catch(error=>this.report(String(error instanceof Error?error.message:error),true));
      };
      content.append(button);
    }
    if(tending){
      const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.dataset.orderDraftedTend=String(tending.patientId);
      button.textContent=tending.enabled?tending.label:`${tending.label} — ${tending.reason}`;button.disabled=!tending.enabled;
      button.onclick=()=>{
        if(!tending.enabled||tending.pawnId===undefined)return;
        this.close();void this.client.command({type:'order-drafted-tend',pawnId:tending.pawnId,patientId:tending.patientId,queue:false})
          .then(()=>this.report(`Soins sans médicament demandés pour ${policy.target}.`)).catch(error=>this.report(String(error instanceof Error?error.message:error),true));
      };
      content.append(button);
    }
    if(!policy.reason) {
      if(policy.drafted<policy.selected){const note=document.createElement('p');note.className='muted';note.textContent=`${policy.selected-policy.drafted} membre(s) non mobilisé(s) ou indisponible(s) exclus.`;content.append(note);}
      for(const option of policy.options) {
        const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.dataset.tacticalAttack=option.kind;
        button.textContent=option.enabled?option.label:`${option.label} — ${option.reason ?? 'Indisponible'}`;
        button.disabled=!option.enabled;
        button.onclick=()=>{
          this.close();
          const command=option.kind==='shoot'
            ? {type:'shoot' as const,pawnIds:option.pawnIds,targetId}
            : {type:'melee' as const,pawnIds:option.pawnIds,targetId};
          void this.client.command(command).then(()=>this.report(`${option.kind==='shoot'?'Tir':'Mêlée'} demandé sur ${policy.target}.`)).catch(error=>this.report(String(error instanceof Error?error.message:error),true));
        };
        content.append(button);
      }
      if(queue){const hint=document.createElement('p');hint.className='muted';hint.textContent='Seuls les déplacements ont une file d’ordres tactiques.';content.append(hint);}
    }
    this.menu.append(header,content);this.position(x,y);this.menu.focus();
    content.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }
  private tacticalMessage(title:string,message:string,x:number,y:number):void {
    this.menu.replaceChildren();this.menu.hidden=false;
    const header=document.createElement('strong');header.textContent=title;
    const body=document.createElement('div');body.textContent=message;
    this.menu.append(header,body);this.position(x,y);this.menu.focus();
  }
  async open(world:World,ids:ReadonlySet<number>,cell:Cell,x:number,y:number,queue:boolean):Promise<void> {
    this.close();const revision=this.revision;this.menu.replaceChildren();this.menu.hidden=false;
    const header=document.createElement('strong'),content=document.createElement('div');
    const pawn=ids.size===1?world.pawns.find(p=>ids.has(p.id)):undefined;
    header.textContent=pawn?`${pawn.name} · case ${cell.x}, ${cell.z}`:'Ordres de travail';
    content.textContent=pawn?'Vérification des accès…':'Sélectionnez un seul colon pour lui donner un travail.';
    this.menu.append(header,content);this.position(x,y);this.menu.focus();
    if(!pawn)return;
    if(!isColonist(pawn)||pawn.prisoner){content.textContent=pawn.prisoner?'Les prisonniers se gèrent dans leur inspection. Ils ne reçoivent pas d’ordres de colon.':'Cette personne ne fait pas partie de la colonie.';this.position(x,y);return;}
    try {
      const options=await this.client.orderOptions(pawn.id,cell.x,cell.z,queue);
      if(revision!==this.revision)return;
      content.replaceChildren();
      const firefoamCount=appendFirefoamOptions290(content,world,pawn.id,cell,queue,{close:()=>this.close(),send:c=>this.client.command(c),report:(m,e)=>this.report(m,e)});
      const shipCasketCount=appendShipCasketOptions277(content,world,pawn.id,cell,queue,{close:()=>this.close(),send:c=>this.client.command(c),report:(m,e)=>this.report(m,e)});
      const cryptosleepCount=appendCryptosleepOptions271(content,world,pawn.id,cell,queue,{close:()=>this.close(),send:command=>this.client.command(command),report:(message,error)=>this.report(message,error)});
      for(const option of options) {
        const button=document.createElement('button');button.setAttribute('role','menuitem');button.dataset.orderJob=String(option.jobId);
        if(option.haulTarget)button.dataset.orderHaul=option.haulTarget.type;
        if(option.haulTarget?.type==='pile')button.dataset.orderHaulPile=String(option.haulTarget.pileId);
        if(option.cookStationId!==undefined)button.dataset.orderCook=String(option.cookStationId);
        if(option.equipmentItemId!==undefined)button.dataset.orderEquipment=String(option.equipmentItemId);
        if(option.consumePileId!==undefined)button.dataset.orderConsume=String(option.consumePileId);
        if(option.openCasketId!==undefined)button.dataset.orderOpenCasket=String(option.openCasketId);
        button.textContent=option.enabled?(option.openCasketId!==undefined||option.consumePileId!==undefined?option.label:`${queue?'Mettre en file :':'Prioriser :'} ${option.label}`):`${option.label} — ${option.reason}`;
        if(option.warnings?.length)setTooltip(button,{title:option.label,body:option.warnings.join(' · ')});
        button.disabled=!option.enabled;
        if(option.feedPatientId!==undefined)button.dataset.orderFeed=String(option.feedPatientId);
        if(option.tendPatientId!==undefined)button.dataset.orderTend=String(option.tendPatientId);
        if(option.rescuePatientId!==undefined)button.dataset.orderRescue=String(option.rescuePatientId);
        if(option.capturePatientId!==undefined)button.dataset.orderCapture=String(option.capturePatientId);
        if(option.arrestPatientId!==undefined)button.dataset.orderArrest=String(option.arrestPatientId);
        button.onclick=event=>{
          if(option.openCasketId!==undefined&&(queue||event.shiftKey)){this.report('Ouvrir est un ordre direct ; relâchez Maj.',true);return;}
          if(option.consumePileId!==undefined&&(queue||event.shiftKey)){this.report('Consommer est un ordre direct ; relâchez Maj.',true);return;}
          this.close();void this.client.command(option.openCasketId!==undefined
            ? {type:'order-open-casket',pawnId:pawn.id,casketId:option.openCasketId}
            : option.consumePileId!==undefined
            ? {type:'order-consume',pawnId:pawn.id,pileId:option.consumePileId,queue:false}
            : option.arrestPatientId!==undefined
            ? {type:'order-arrest',pawnId:pawn.id,patientId:option.arrestPatientId,queue:false}
            : option.capturePatientId!==undefined
            ? {type:'order-capture',pawnId:pawn.id,patientId:option.capturePatientId,queue:queue||event.shiftKey}
            : option.equipmentItemId!==undefined
            ? {type:'order-equipment',pawnId:pawn.id,itemId:option.equipmentItemId,action:option.equipmentAction!,queue:queue||event.shiftKey}
            : option.feedPatientId!==undefined
            ? {type:'order-feed',pawnId:pawn.id,patientId:option.feedPatientId,queue:queue||event.shiftKey}
            : option.tendPatientId!==undefined
            ? {type:'order-tend',pawnId:pawn.id,patientId:option.tendPatientId,queue:queue||event.shiftKey}
            : option.rescuePatientId!==undefined
            ? {type:'order-rescue',pawnId:pawn.id,patientId:option.rescuePatientId,queue:queue||event.shiftKey}
            : option.cookStationId!==undefined
            ? {type:'order-cook',pawnId:pawn.id,structureId:option.cookStationId,queue:queue||event.shiftKey}
            : option.haulTarget
            ? {type:'order-haul',pawnId:pawn.id,target:option.haulTarget,queue:queue||event.shiftKey}
            : {type:'order-job',pawnId:pawn.id,jobId:option.jobId,queue:queue||event.shiftKey})
            .then(()=>this.report(option.arrestPatientId!==undefined?'Tentative d’arrestation demandée ; l’acceptation sera vérifiée au contact.':'Ordre accepté.')).catch(error=>this.report(String(error instanceof Error?error.message:error),true));
        };
        content.append(button);
        if(option.consumePileId!==undefined&&option.warnings?.length){const note=document.createElement('p');note.className='muted';note.textContent=option.warnings.join(' · ');content.append(note);}
      }
      const fire=world.fires?.items.find(f=>{const at=firePosition(world,f);return at?.x===cell.x&&at?.z===cell.z;});
      if(fire){const button=document.createElement('button');button.setAttribute('role','menuitem');button.dataset.orderFire=String(fire.id);button.textContent='Prioriser : éteindre le feu';button.onclick=()=>{this.close();void this.client.command({type:'order-extinguish',pawnId:pawn.id,fireId:fire.id}).then(()=>this.report('Extinction prioritaire demandée.')).catch(error=>this.report(String(error instanceof Error?error.message:error),true));};content.append(button);}
      if(!options.length&&!fire&&!cryptosleepCount&&!shipCasketCount&&!firefoamCount)content.textContent='Aucun travail ni pile à transporter ici. Utilisez les ordres d’Architecte.';
      const hint=document.createElement('p');hint.className='muted';hint.textContent=firefoamCount?'Déclenchement direct : le colon rejoint l’appareil puis travaille au contact. Toute interruption avant la fin empêche l’armement.':shipCasketCount?'Le caisson spatial se ferme au contact et son occupant peut ensuite être éjecté directement, sans autre colon ni électricité.':cryptosleepCount?'Le cryptosommeil se prépare au contact. Un autre colon devra ouvrir le caisson sur place.':options.some(option=>option.openCasketId!==undefined)?'Le colon rejoint la capsule et l’ouvre sur place. Ordre direct, sans mise en file.':options.some(option=>option.consumePileId!==undefined)?'Consommer remplace l’activité en cours, sans mise en file. Un colon mobilisé reste mobilisé. La nourriture se mange et la bière se boit au contact de la pile.':options.some(option=>option.arrestPatientId!==undefined)?'Arrestation directe par un colon démobilisé, avec lit de prison accessible. La chance affichée dépend de l’état actuel ; un refus peut provoquer une fureur violente.':fire?'L’extinction est un ordre direct, sans mise en file.':options.some(option=>option.capturePatientId!==undefined)?'La capture est un ordre direct. Préparez un lit de prison dans une pièce fermée.':'Maj : ajouter à la file. Construction et cuisine peuvent se poursuivre sur cette case.';content.append(hint);
      this.position(x,y);content.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    } catch(error) {if(revision===this.revision){content.textContent=String(error instanceof Error?error.message:error);this.position(x,y);}}
  }
  private position(x:number,y:number):void {
    this.menu.style.left=`${Math.max(8,Math.min(x,window.innerWidth-this.menu.offsetWidth-8))}px`;
    this.menu.style.top=`${Math.max(8,Math.min(y,window.innerHeight-this.menu.offsetHeight-8))}px`;
  }
}
