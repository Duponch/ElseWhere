import {assignPileOwner} from './pile-index.ts';
import {isBurialContainer256} from './ancient-monument-runtime-256.ts';
import { storageAt,storageCellAccepts } from './shelf-storage.ts';
import { workPriority } from './work-types.ts';
import { allowedAreaAllows,allowedAreaReason,allowedAreaWorkAllowed,captureAllowedArea } from './allowed-area-state.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { isColonist } from './affiliation.ts';
import { footprintCells } from './definitions.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { humanCorpse,pawnBodyLocation,pickUpRetainedHumanCorpse,updateHumanCorpseTemperatures } from './human-corpses.ts';
import { groundCapacity,nearbyGround } from './ground-placement.ts';
import { reservedSource } from './materials.ts';
import { adjacent,blockedCells,reachableCells,routeToJob,type Reachability } from './pathfinding.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import { interruptWork } from './interrupted-cargo.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,CommandResult,Pawn,Structure,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface GraveState {corpseId?:number;assignedPawnId?:number;colonists:boolean;strangers:boolean}
export interface BurialTask {bodyPawnId:number;graveId:number;corpseId?:number;phase:'pickup'|'carry'|'bury';progress:number}
export type BurialCommand={type:'order-bury';pawnId:number;bodyPawnId:number;graveId?:number;queue?:boolean}
  |{type:'grave-policy';graveId:number;colonists:boolean;strangers:boolean}
  |{type:'assign-grave';graveId:number;pawnId:number|null};
export const BURIAL_TICKS=50;
export const initialGrave=():GraveState=>({colonists:true,strangers:true});
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const touch=(a:Cell,b:Cell)=>same(a,b)||adjacent(a,b);
const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const bodyPile=(w:World,p:Pawn)=>w.piles.find(i=>i.id===p.body?.pileId);

export function burialClaim(w:World,bodyPawnId:number,exceptPawn?:number):Pawn|undefined {
  return w.pawns.find(p=>p.id!==exceptPawn&&p.burial?.bodyPawnId===bodyPawnId);
}
export function graveAccepts(w:World,grave:Structure,body:Pawn,exceptPawn?:number):boolean {
  return isBurialContainer256(grave.kind,w.schemaVersion)&&!!grave.grave&&grave.grave.corpseId===undefined
    &&!w.jobs.some(j=>j.deconstruction?.structureId===grave.id)
    &&!w.pawns.some(p=>p.id!==exceptPawn&&p.burial?.graveId===grave.id)
    &&(grave.grave.assignedPawnId!==undefined?grave.grave.assignedPawnId===body.id:isColonist(body)?grave.grave.colonists:grave.grave.strangers);
}
export function burialReason(w:World,actor:Pawn,body:Pawn|undefined,continuing=false):string|undefined {
  const pile=body?bodyPile(w,body):undefined;
  const cell=pile?.owner.type==='ground'?pile.owner:!pile?body:undefined,areaReason=cell?allowedAreaReason(w,actor,cell):undefined;if(areaReason)return areaReason;
  return !isColonist(actor)||actor.prisoner||actor.visitor?'Seul un colon peut être chargé de cette inhumation.'
    :backgroundWorkRefusal(actor,'haul')??medicalWorkRefusal(actor)??(actor.mental?.crisis||actor.burning||actor.draft?'Ce colon est indisponible pour transporter un corps.'
    :!continuing&&workPriority(actor,'haul')===0?'Transport est désactivé dans le tableau Travail.'
    :actor.interruptedCargo?'La cargaison doit être déposée avant l’inhumation.'
    :!body||body.state!=='dead'||!body.health?.death||body.body?.lostAt!==undefined?'Cette personne ne possède pas de dépouille disponible.'
    :pile&&pile.owner.type!=='ground'&&!(continuing&&pile.owner.type==='pawn'&&pile.owner.pawnId===actor.id)?'Cette dépouille est déjà transportée ou inhumée.'
    :burialClaim(w,body.id,actor.id)||pile&&reservedSource(w,pile.id,actor.id)>0?'Cette dépouille est déjà réservée.'
    :!pile&&w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===body.id)?'La cargaison du défunt doit d’abord être déposée.'
    :undefined);
}
interface BurialProposal {bodyPawnId:number;graveId:number;corpseId?:number;path:Cell[]}
export function burialProposal(w:World,actor:Pawn,body:Pawn,reach:Reachability,graveId?:number):BurialProposal|undefined {
  if(burialReason(w,actor,body))return;
  const location=pawnBodyLocation(w,body);if(!location)return;
  const path=routeToJob(w,location,reach,true);if(!path)return;
  const policy=captureAllowedArea(w,actor),graves=w.structures.filter(s=>(!policy||allowedAreaAllows(w,actor,s,policy))&&(graveId===undefined||s.id===graveId)&&graveAccepts(w,s,body,actor.id))
    .sort((a,b)=>(a.grave?.assignedPawnId===body.id?0:1)-(b.grave?.assignedPawnId===body.id?0:1)
      ||((a.x-location.x)**2+(a.z-location.z)**2)-((b.x-location.x)**2+(b.z-location.z)**2)||a.id-b.id);
  for(const grave of graves)if(routeToJob(w,grave,reach,true))return {bodyPawnId:body.id,graveId:grave.id,...body.body?.pileId!==undefined?{corpseId:body.body.pileId}:{},path};
}
function begin(actor:Pawn,p:BurialProposal,forced:boolean):void {
  actor.burial={bodyPawnId:p.bodyPawnId,graveId:p.graveId,...p.corpseId!==undefined?{corpseId:p.corpseId}:{},phase:'pickup',progress:0};
  actor.path=p.path;actor.state='moving';actor.planCooldown=0;if(forced)actor.orders.active='bury';
}
/** Called at the ordinary Transport priority, after needs and accepted orders. */
export function assignBurial(w:World,actor:Pawn,search:()=>Reachability|null):boolean {
  if(workPriority(actor,'haul')===0||actor.burial||actor.orders.active!==null||actor.orders.queue.length||actor.interruptedCargo||!w.structures.some(s=>isBurialContainer256(s.kind,w.schemaVersion)&&s.grave?.corpseId===undefined))return false;
  const bodies=w.pawns.filter(p=>!burialReason(w,actor,p)).filter(p=>{
    const pile=bodyPile(w,p);if(pile?.owner.type!=='ground')return true;
    // Important grave priority (3) must not silently pull from equal/better storage.
    const o=pile.owner,cell=storageAt(w,o);return !cell||!storageCellAccepts(w,cell,pile)||cell.priority<3;
  }).sort((a,b)=>(a.x-actor.x)**2+(a.z-actor.z)**2-(b.x-actor.x)**2-(b.z-actor.z)**2||a.id-b.id);
  if(!bodies.length)return false;const reach=search();if(!reach)return false;
  for(const body of bodies){const proposal=burialProposal(w,actor,body,reach);if(proposal){begin(actor,proposal,false);return true;}}
  return false;
}
export function applyBurial(w:World,c:BurialCommand):CommandResult {
  if(c.type!=='order-bury'){
    const grave=w.structures.find(s=>s.id===c.graveId&&isBurialContainer256(s.kind,w.schemaVersion));if(!grave?.grave)return fail('Tombe introuvable.');
    if(grave.grave.corpseId!==undefined)return fail('Cette tombe est occupée.');
    if(c.type==='grave-policy'){
      if(typeof c.colonists!=='boolean'||typeof c.strangers!=='boolean')return fail('Filtres funéraires invalides.');
      if(grave.grave.assignedPawnId!==undefined)return fail('Retirer l’affectation nominative avant de modifier ces filtres.');
      grave.grave.colonists=c.colonists;grave.grave.strangers=c.strangers;
    } else {
      const p=c.pawnId===null?null:w.pawns.find(p=>p.id===c.pawnId);
      if(c.pawnId!==null&&(!p||!isColonist(p)||p.body?.lostAt!==undefined))return fail('Affectation funéraire invalide.');
      if(p){
        if(w.structures.some(s=>s!==grave&&s.grave?.assignedPawnId===p.id&&s.grave.corpseId!==undefined))return fail('Cette personne est déjà inhumée dans sa tombe.');
        for(const s of w.structures)if(s.grave?.assignedPawnId===p.id)delete s.grave.assignedPawnId;
        grave.grave.assignedPawnId=p.id;
      } else delete grave.grave.assignedPawnId;
    }
    reconcileBurials(w);return {ok:true};
  }
  if(c.queue!==undefined&&c.queue!==false)return fail('L’inhumation directe ne peut pas encore être ajoutée à une file.');
  const actor=w.pawns.find(p=>p.id===c.pawnId),body=w.pawns.find(p=>p.id===c.bodyPawnId);if(!actor)return fail('Colon introuvable.');
  const reason=burialReason(w,actor,body);if(reason)return fail(reason);
  const proposal=burialProposal(w,actor,body!,reachableCells(w,actor,blockedCells(w),new Set()),c.graveId);
  if(!proposal)return fail('Aucune dépouille et tombe admissible reliées par un accès praticable.');
  const drops=planCommandDrops(w,{type:'clear-orders',pawnId:actor.id});
  if(!drops||!releaseWork(w,actor,drops))return fail('Pas de place pour déposer la cargaison avant l’inhumation.');
  clearQueuedOrders(w,actor);delete actor.priorityWork;begin(actor,proposal,true);return {ok:true};
}
/** Ownership is released by the shared conservative cargo path, not here. */
export function releaseBurial(p:Pawn):void {delete p.burial;if(p.orders.active==='bury')p.orders.active=null;}
export function reconcileBurials(w:World):void {
  for(const actor of w.pawns)if(actor.burial){
    const t=actor.burial,body=w.pawns.find(p=>p.id===t.bodyPawnId),grave=structureById(w,t.graveId);
    if(!allowedAreaWorkAllowed(w,actor)||burialReason(w,actor,body,true)||!grave||!body||!graveAccepts(w,grave,body,actor.id))interruptWork(w,actor);
  }
}
export function processBurial(w:World,actor:Pawn,context:NeedContext):void {
  const t=actor.burial;if(!t)return;
  const body=w.pawns.find(p=>p.id===t.bodyPawnId),grave=structureById(w,t.graveId);
  if(!allowedAreaWorkAllowed(w,actor)||!body||!grave||burialReason(w,actor,body,true)||!graveAccepts(w,grave,body,actor.id)){interruptWork(w,actor);return;}
  let pile=bodyPile(w,body);
  if(t.phase==='pickup'){
    const cell=pawnBodyLocation(w,body);if(!cell){interruptWork(w,actor);return;}
    if(!touch(actor,cell)){context.move(cell,false);return;}
    if((body.motion?.end??0)>w.tick||body.moveCooldown>0)return;
    if(w.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===actor.id)||w.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===actor.id)){interruptWork(w,actor);return;}
    if(pile){if(pile.owner.type!=='ground'){interruptWork(w,actor);return;}assignPileOwner(pile,{type:'pawn',pawnId:actor.id});}
    else pile=pickUpRetainedHumanCorpse(w,actor,body.id)??undefined;
    if(!pile)return;
    t.corpseId=pile.id;t.phase='carry';actor.path=[];actor.planCooldown=0;updateHumanCorpseTemperatures(w);
    context.event(`${actor.name} transporte la dépouille de ${body.name} vers une tombe.`);
  }
  if(!pile||pile.owner.type!=='pawn'||pile.owner.pawnId!==actor.id){interruptWork(w,actor);return;}
  if(!footprintCells(grave).some(cell=>touch(actor,cell))){context.move(grave,false);return;}
  t.phase='bury';actor.path=[];actor.state='working';t.progress++;
  if(t.progress<BURIAL_TICKS)return;
  assignPileOwner(pile,{type:'grave',graveId:grave.id});grave.grave!.corpseId=pile.id;
  updateHumanCorpseTemperatures(w);releaseBurial(actor);actor.state='idle';actor.path=[];actor.planCooldown=0;
  context.event(`${actor.name} a inhumé ${body.name}.`);
}
export interface GraveReleasePlan {corpseId:number|null;cell?:Cell}
/** Call against the same shadow world as the other deconstruction drops. */
export function planGraveRelease(w:World,grave:Structure):GraveReleasePlan|null {
  if(!isBurialContainer256(grave.kind,w.schemaVersion)||grave.grave?.corpseId===undefined)return {corpseId:null};
  const pile=w.piles.find(p=>p.id===grave.grave!.corpseId);if(!pile||!humanCorpse(pile)||pile.owner.type!=='grave'||pile.owner.graveId!==grave.id)return null;
  const view={...w,structures:w.structures.filter(s=>s.id!==grave.id)};
  const cell=nearbyGround(view,grave).find(c=>groundCapacity(view,c,'human-corpse')>=1);
  return cell?{corpseId:pile.id,cell}:null;
}
/** Commit before the grave is removed, using exactly the reserved free cell. */
export function commitGraveRelease(w:World,grave:Structure,plan:GraveReleasePlan):boolean {
  if(plan.corpseId===null)return grave.grave?.corpseId===undefined;
  const pile=w.piles.find(p=>p.id===plan.corpseId);
  if(!pile||!plan.cell||grave.grave?.corpseId!==pile.id||pile.owner.type!=='grave'||pile.owner.graveId!==grave.id)return false;
  assignPileOwner(pile,{type:'ground',...plan.cell});delete grave.grave.corpseId;updateHumanCorpseTemperatures(w);return true;
}
