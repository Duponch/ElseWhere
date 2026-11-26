import {markOrderedHuman379} from './human-roster-379.ts';
import {isColonist} from './affiliation.ts';
import {medicalWorkRefusal} from './health-rules.ts';
import {carrierOf} from './rescue-state.ts';
import {groupOnMapMember} from './group-state.ts';
import {scoutOnMapId} from './caravan-trip.ts';
import {commercialOnMapId} from './commercial-trip.ts';
import {factionCommsTask298} from './faction-comms-state-298.ts';
import {playerOrderCommandReason378,MAX_QUEUED_ORDERS} from './player-orders.ts';
import {orderedTargets378,orderedTargetClaimed378,queuedOrderCount378,type OrderedCommand378,type QueueOrderCommand378} from './order-types.ts';
import {draftedTendingReason,draftedTendingProposal} from './drafted-tending.ts';
import {blockedCells,reachableCells} from './pathfinding.ts';
import {cryptosleepIntent271} from './cryptosleep-intent-271.ts';
import {shipCasketIntent277} from './ship-casket-intent-277.ts';
import {firefoamUseIntent290} from './firefoam-manual-290.ts';
import {factionCommsReason298} from './faction-comms-298.ts';
import {readingRefusal295} from './reading-runtime-295.ts';
import {readingPickupCandidates295} from './reading-space-295.ts';
import {burialReason,burialProposal} from './burial.ts';
import {applyCleanRoom} from './cleaning.ts';
import {applyExtinguish} from './firefighting.ts';
import {applyMeleeCommand} from './melee.ts';
import {applyShootingCommand} from './shooting.ts';
import {applyDraftCommand} from './drafting.ts';
import {animalRescueOrderReason378} from './animal-rescue.ts';
import {personalAnimalOrderReason378} from './personal-animal-orders-378.ts';
import {orderTrade} from './trade-contact.ts';
import {orderOrbitalTrade} from './orbital.ts';
import type {Command,CommandResult,Pawn,World} from './types.ts';

export type {OrderedCommand378,QueueOrderCommand378} from './order-types.ts';
const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const id=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype
 &&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const cell=(v:unknown)=>plain(v)&&keys(v,['x','z'])&&Number.isSafeInteger(v.x)&&Number(v.x)>=0&&Number.isSafeInteger(v.z)&&Number(v.z)>=0;
const dense=(v:unknown):v is unknown[]=>Array.isArray(v)&&v.length<=MAX_QUEUED_ORDERS&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1
 &&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&Object.hasOwn(d,'value'));
export function isOrderedCommand378(v:unknown):v is OrderedCommand378 {
 if(!plain(v)||typeof v.type!=='string')return false;
 const c=v,type=v.type as string;
 if(c.type==='draft-move'||c.type==='shoot'||c.type==='melee')return dense(c.pawnIds)&&c.pawnIds.length===1&&id(c.pawnIds[0])
  &&(c.type==='draft-move'?keys(c,['type','pawnIds','target','queue'])&&c.queue===false&&cell(c.target):keys(c,['type','pawnIds','targetId'],c.type==='melee'?['structure']:[])&&id(c.targetId)&&(c.structure===undefined||c.structure===true));
 if(!id(c.pawnId))return false;
 const simple:Record<string,string>={'order-job':'jobId','order-cook':'structureId','order-consume':'pileId','order-capture':'patientId','order-arrest':'patientId','order-feed':'patientId','order-tend':'patientId','order-drafted-tend':'patientId','order-rescue':'patientId'};
 if(simple[type])return keys(c,['type','pawnId',simple[type]!,'queue'])&&c.queue===false&&id(c[simple[type]!]);
 if(c.type==='order-haul'){
  const t=c.target;if(!keys(c,['type','pawnId','target','queue'])||c.queue!==false||!plain(t))return false;
  const field=t.type==='pile'?'pileId':['job','clear','clear-sow'].includes(String(t.type))?'jobId':['fuel','turret','furniture'].includes(String(t.type))?'structureId':undefined;
  return !!field&&keys(t,['type',field])&&id(t[field]);
 }
 if(c.type==='order-equipment')return keys(c,['type','pawnId','itemId','action','queue'])&&id(c.itemId)&&c.queue===false&&['equip','drop','wear','remove'].includes(String(c.action));
 if(c.type==='order-animal-378')return keys(c,['type','pawnId','animalId','action','queue'])&&id(c.animalId)&&c.queue===false&&['hunt','tame','slaughter'].includes(String(c.action));
 if(c.type==='order-bury')return keys(c,['type','pawnId','bodyPawnId','queue'],['graveId'])&&id(c.bodyPawnId)&&c.queue===false&&(!Object.hasOwn(c,'graveId')||id(c.graveId));
 if(c.type==='clean-room')return keys(c,['type','pawnId','x','z'])&&Number.isSafeInteger(c.x)&&Number(c.x)>=0&&Number.isSafeInteger(c.z)&&Number(c.z)>=0;
 const direct:Record<string,string>={'order-strip':'targetId','order-open-casket':'casketId','order-animal-rescue':'animalId','order-extinguish':'fireId','read-book-295':'bookId','order-open-cryptosleep':'casketId','order-enter-ship-casket':'casketId','firefoam-trigger':'structureId','order-trade':'traderId'};
 if(direct[type])return keys(c,['type','pawnId',direct[type]!])&&id(c[direct[type]!]);
 if(c.type==='order-enter-cryptosleep')return keys(c,['type','pawnId','casketId'],['confirmLastColonist'])&&id(c.casketId)&&(!Object.hasOwn(c,'confirmLastColonist')||c.confirmLastColonist===true);
 if(c.type==='order-carry-cryptosleep')return keys(c,['type','pawnId','patientId','casketId'])&&id(c.patientId)&&id(c.casketId);
 if(c.type==='order-carry-ship-casket')return keys(c,['type','pawnId','patient','casketId'])&&id(c.casketId)&&plain(c.patient)&&keys(c.patient,['kind','id'])&&['human','animal','mechanical'].includes(String(c.patient.kind))&&id(c.patient.id);
 if(c.type==='order-faction-comms')return keys(c,['type','pawnId','factionId','consoleId'])&&id(c.factionId)&&id(c.consoleId);
 if(c.type==='order-orbital-trade')return keys(c,['type','pawnId','shipId','consoleId'])&&id(c.shipId)&&id(c.consoleId);
 return false;
}
export const orderedCommandPawnId378=(c:OrderedCommand378):number=>'pawnId' in c?c.pawnId:c.pawnIds[0]!;
export function validOrderedQueuePawn378(raw:unknown,version:number):boolean {
 if(!raw||typeof raw!=='object')return false;
 const p=raw as Pawn;
 const descriptor=Object.getOwnPropertyDescriptor(p,'orderedQueue378');
 if(!descriptor)return !('orderedQueue378' in p);
 if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return false;
 if(version<378||!dense(descriptor.value)||!p.orderedQueue378!.length||p.orderedQueue378!.length+(p.orders?.queue?.length??0)+(p.draft?.queue?.length??0)>MAX_QUEUED_ORDERS)return false;
 if(!isColonist(p)||p.prisoner||['dead','downed'].includes(p.state)||p.health?.death||p.cryptosleepHeldAt271!==undefined||p.shipCryptosleepHeldAt277!==undefined)return false;
 return p.orderedQueue378!.every(c=>isOrderedCommand378(c)&&orderedCommandPawnId378(c)===p.id);
}
export function validateOrderedQueues378(w:World,version:number):string[] {
 const errors:string[]=[];
 for(const p of w.pawns){
  if(!validOrderedQueuePawn378(p,version)){errors.push('Invalid generalized ordered queue.');continue;}
  for(const c of p.orderedQueue378??[]){
   if(c.type==='draft-move'&&(c.target.x>=w.width||c.target.z>=w.height)||c.type==='clean-room'&&(c.x>=w.width||c.z>=w.height))errors.push('Queued destination outside map.');
   if(orderedTargets378(c).some(t=>orderedTargetClaimed378(w,t.kind,t.id,p.id)))errors.push('Duplicate generalized order reservation.');
  }
 }
 return errors;
}
/** A held draft destination is idle on arrival; committed travel still finishes. */
export function orderedQueueBusy378(w:World,p:Pawn):boolean {
 return p.jobId!==null||p.orders.active!==null||p.orders.queue.length>0||p.moveCooldown>0||(p.motion?.end??0)>w.tick
 ||!!(p.shipCasketTask277||p.cryptosleepTask||p.openCasket||p.strip351||p.firefoamTask290||p.hunting||p.heatRefuge||p.bombRefuge||p.research||p.equipmentTask||p.ward||p.feed||p.tend||p.surgery||p.rescue||p.haul||p.cooking||p.need||p.recreation.task||p.animalHandling||p.animalCare||p.animalFeed||p.animalRescue||p.burial||p.cleaning||p.firefighting||p.orbitalTrade||p.deepWork||p.trade||p.allowedAreaReturn||p.flee||p.tactics||factionCommsTask298(p)||p.shooting?.order&&!p.shooting.order.auto||p.shooting?.stance?.phase==='cooldown'||p.melee?.order&&!p.melee.order.auto||p.melee?.strike)
 ||!!p.draft&&(p.draft.queue.length>0||!!p.draft.target&&(p.x!==p.draft.target.x||p.z!==p.draft.target.z));
}
function actorReason(w:World,p:Pawn|undefined,c:OrderedCommand378):string|undefined {
 if(!p||!isColonist(p)||p.prisoner||!w.pawns.includes(p))return 'Seul un colon libre présent sur cette carte peut recevoir un ordre.';
 if(p.mental?.crisis||p.burning||p.state==='dead'||p.state==='downed'||p.health?.death||p.cryptosleepHeldAt271!==undefined||p.shipCryptosleepHeldAt277!==undefined)return 'Ce colon ne peut pas suivre cet ordre maintenant.';
 const refusal=medicalWorkRefusal(p);if(refusal)return refusal;
 if(carrierOf(w,p.id)||p.interruptedCargo||p.collapsePending)return 'Ce colon doit terminer son transport ou récupérer avant cet ordre.';
 if(groupOnMapMember(w,p.id)||p.id===(scoutOnMapId(w)??commercialOnMapId(w)))return 'Terminez ou annulez le voyage avant de donner un autre ordre.';
 const h=p.health;if(h?.foodPoisoning?.vomit||h?.cryptosleepSickness?.vomit||h?.toxicBuildup?.vomit||h?.toxicBuildup?.vomitRequestedAt!==undefined||h?.flu?.vomit||h?.immuneDiseases?.malaria?.vomit)return 'Ce colon vomit et ne peut pas suivre cet ordre.';
 if(p.draft&&['order-job','order-cook','order-haul','order-arrest','order-feed','order-tend','order-animal-rescue','order-animal-378'].includes(c.type)&&!(c.type==='order-haul'&&c.target.type==='turret'))return 'Démobilisez ce colon avant un ordre civil.';
}
/** Command-specific admission remains owned by the real order providers. */
export function orderedCommandReason378(w:World,c:OrderedCommand378):string|undefined {
 const p=w.pawns.find(p=>p.id===orderedCommandPawnId378(c)),a=actorReason(w,p,c);if(a||!p)return a;
 if(orderedTargets378(c).some(t=>orderedTargetClaimed378(w,t.kind,t.id,p.id)))return 'Cette cible est réservée par un ordre en file.';
 if(c.type==='order-animal-378')return personalAnimalOrderReason378(w,c);
 if(c.type==='order-animal-rescue')return animalRescueOrderReason378(w,p,c.animalId);
 if(c.type==='order-drafted-tend'){const patient=w.pawns.find(q=>q.id===c.patientId);return draftedTendingReason(w,p,patient)??(!patient||!draftedTendingProposal(w,p,patient,reachableCells(w,p,blockedCells(w),new Set()))?'Aucune place accessible au contact du patient.':undefined);}
 if(c.type==='draft-move'){const r=applyDraftCommand(w,c,true);return r.ok?undefined:r.reason;}
 if(c.type==='shoot'){const r=applyShootingCommand(w,c,true);return r.ok?undefined:r.reason;}
 if(c.type==='melee'){const r=applyMeleeCommand(w,c,true);return r.ok?undefined:r.reason;}
 if(c.type==='clean-room')return applyCleanRoom(w,c,true)??undefined;
 if(c.type==='order-extinguish')return applyExtinguish(w,c,true)??undefined;
 if(c.type==='read-book-295'){const pile=w.piles.find(i=>i.id===c.bookId);return !pile?'Livre indisponible.':readingRefusal295(w,p,pile,true)??(!readingPickupCandidates295(w,p,c.bookId).length?'Livre inaccessible.':undefined);}
 if(c.type==='order-bury'){const body=w.pawns.find(q=>q.id===c.bodyPawnId);return burialReason(w,p,body)??(!body||!burialProposal(w,p,body,reachableCells(w,p,blockedCells(w),new Set()),c.graveId)?'Aucune tombe accessible et disponible.':undefined);}
 if(c.type==='order-enter-cryptosleep'||c.type==='order-carry-cryptosleep'||c.type==='order-open-cryptosleep'){const i=cryptosleepIntent271(w,c);return i.ok?undefined:i.reason;}
 if(c.type==='order-enter-ship-casket'||c.type==='order-carry-ship-casket'){const i=shipCasketIntent277(w,c);return i.ok?undefined:i.reason;}
 if(c.type==='firefoam-trigger'){const i=firefoamUseIntent290(w,c);return i.ok?undefined:i.reason;}
 if(c.type==='order-faction-comms')return factionCommsReason298(w,p,c.factionId,c.consoleId);
 if(c.type==='order-trade'){const r=orderTrade(w,c.pawnId,c.traderId,true);return r.ok?undefined:r.reason;}
 if(c.type==='order-orbital-trade'){const r=orderOrbitalTrade(w,c.pawnId,c.shipId,c.consoleId,true);return r.ok?undefined:r.reason;}
 return playerOrderCommandReason378(w,c);
}
export const orderedIntentReason378=orderedCommandReason378;
type Direct=(command:Command)=>CommandResult;
/** Ordinary tactical travel owns its established reserved-prefix queue.
 * A real personal task or attack requires the generalized FIFO tail. */
function generalDraftOwner378(p:Pawn):boolean {
 return !!p.orderedQueue378?.length||p.jobId!==null||p.orders.active!==null||p.orders.queue.length>0
  ||!!(p.equipmentTask||p.tend||p.rescue||p.need||p.haul||p.cooking||p.strip351||p.shipCasketTask277||p.cryptosleepTask||p.openCasket||p.firefoamTask290||p.hunting||p.research||p.ward||p.feed||p.surgery||p.recreation.task||p.animalHandling||p.animalCare||p.animalFeed||p.animalRescue||p.burial||p.cleaning||p.firefighting||p.orbitalTrade||p.deepWork||p.trade||factionCommsTask298(p)||p.shooting?.order&&!p.shooting.order.auto||p.melee?.order&&!p.melee.order.auto);
}
/** Undefined means ordinary dispatch owns the command. */
export function applyGeneralQueue378(w:World,command:Command,applyDirect:Direct):CommandResult|undefined {
 const wrapper=command?.type==='queue-order-378';
 if(Number(w.schemaVersion)<378)return wrapper?fail('La file générale n’existe pas dans cette partie historique.'):undefined;
 if(command?.type==='draft-move'&&command.queue===true&&Array.isArray(command.pawnIds)){
  const pawns=command.pawnIds.map(id=>w.pawns.find(p=>p.id===id));
  // Preserve the established group formation allocator for an ordinary draft
  // queue. A personal task or generalized tail must never be jumped over.
  if(!pawns.some(p=>p&&generalDraftOwner378(p)))return undefined;
  if(command.pawnIds.length>1){
  const preflight=applyDraftCommand(w,command,true);if(!preflight.ok)return preflight;
  const entries=pawns.map(p=>({p:p!,c:{type:'draft-move' as const,pawnIds:[p!.id],target:{...command.target},queue:false as const}}));
  for(const {p,c} of entries){const reason=orderedCommandReason378(w,c);if(reason)return fail(reason);if(queuedOrderCount378(p)>=MAX_QUEUED_ORDERS)return fail(`File limitée à ${MAX_QUEUED_ORDERS} travaux.`);}
  for(const {p,c} of entries){(p.orderedQueue378??=[]).push(c);markOrderedHuman379(w.pawns,p);p.planCooldown=0;}
  return {ok:true};
  }
 }
 let c:unknown;
 if(wrapper){if(!plain(command)||!keys(command,['type','order']))return fail('Ordre en file invalide.');c=command.order;}
 else if(command&&typeof command==='object'&&'queue' in command&&command.queue===true){
  if(command.type==='draft-move'&&(!Array.isArray(command.pawnIds)||command.pawnIds.length!==1))return undefined;
  c={...command,queue:false};
 }else return undefined;
 if(!isOrderedCommand378(c))return fail('Ordre en file invalide.');
 const p=w.pawns.find(p=>p.id===orderedCommandPawnId378(c));
 const reason=orderedCommandReason378(w,c);if(reason||!p)return fail(reason??'Colon introuvable.');
 // Legacy physical work stays as a reserved prefix. Every newer command goes
 // behind a generalized tail, including old order-job/haul/cook command types.
 const legacyOwner=p.jobId!==null||!!p.haul||!!p.cooking||p.orders.queue.length>0||!!p.need&&p.orders.active!=='consume'||!orderedQueueBusy378(w,p);
 if(!p.orderedQueue378?.length&&!wrapper&&legacyOwner&&['order-job','order-haul','order-cook'].includes(c.type))return undefined;
 if(!orderedQueueBusy378(w,p)&&!p.orderedQueue378?.length)return applyDirect(c);
 if(queuedOrderCount378(p)>=MAX_QUEUED_ORDERS)return fail(`File limitée à ${MAX_QUEUED_ORDERS} travaux.`);
 (p.orderedQueue378??=[]).push(structuredClone(c));
 markOrderedHuman379(w.pawns,p);
 p.planCooldown=0;
 return {ok:true};
}
/** One intent per tick. Its actual command rechecks all physical ownership. */
export function advanceGeneralQueue378(w:World,p:Pawn,applyDirect:Direct):boolean {
 if(Number(w.schemaVersion)<378||!p.orderedQueue378?.length)return false;
 if(!isColonist(p)||p.prisoner||['dead','downed'].includes(p.state)||p.health?.death||p.cryptosleepHeldAt271!==undefined||p.shipCryptosleepHeldAt277!==undefined){delete p.orderedQueue378;return false;}
 if(orderedQueueBusy378(w,p))return false;
 const [c,...tail]=p.orderedQueue378;delete p.orderedQueue378;
 let result:CommandResult;
 try {result=isOrderedCommand378(c)&&orderedCommandPawnId378(c)===p.id?applyDirect(c):fail('Ordre en file invalide.');}
 finally {if(tail.length&&w.pawns.includes(p)&&isColonist(p)&&!p.prisoner&&!['dead','downed'].includes(p.state)&&!p.health?.death&&p.cryptosleepHeldAt271===undefined&&p.shipCryptosleepHeldAt277===undefined){p.orderedQueue378=tail;markOrderedHuman379(w.pawns,p);}}
 if(!result.ok){w.events.push({tick:w.tick,type:'command',message:`${p.name} : ordre abandonné. ${result.reason??'Cible indisponible.'}`});if(w.events.length>80)w.events.shift();}
 return true;
}
