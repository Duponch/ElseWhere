import {orderedHumanCandidates379} from './human-roster-379.ts';
import type { CookingTask } from './cooking-types.ts';
import type { HaulTask,Pawn } from './types.ts';

export interface CookingOrder { cooking: CookingTask }
export type QueuedOrder = number | HaulTask | CookingOrder;
export const isCookingOrder=(order:QueuedOrder):order is CookingOrder=>typeof order!=='number'&&'cooking' in order;
export const isHaulOrder=(order:QueuedOrder):order is HaulTask=>typeof order!=='number'&&!isCookingOrder(order);

/** Ordinary direct orders cannot interrupt an already committed recovery.
 * The menu and command dispatcher must expose the same eligibility. A future
 * intent may instead wait for this physical owner to finish. */
export function orderRecoveryReason(pawn:Pick<Pawn,'melee'|'shooting'>|undefined):string|undefined {
 return pawn?.melee?.strike?'Le colon récupère après sa frappe.':pawn?.shooting?.stance?.phase==='cooldown'?'Le colon récupère après son tir.':undefined;
}

/** Schema 378: a future personal command, with no execution progress or path.
 * The old queue remains a reserved prefix when loading or extending old work. */
export type OrderedCommand378 =
 | {type:'order-job';pawnId:number;jobId:number;queue:false}
 | {type:'order-haul';pawnId:number;target:import('./player-hauling.ts').HaulOrderTarget;queue:false}
 | {type:'order-cook';pawnId:number;structureId:number;queue:false}
 | {type:'order-equipment';pawnId:number;itemId:number;action:import('./equipment-rules.ts').EquipmentAction;queue:false}
 | {type:'order-consume';pawnId:number;pileId:number;queue:false}
 | {type:'order-capture'|'order-arrest'|'order-feed'|'order-tend'|'order-drafted-tend'|'order-rescue';pawnId:number;patientId:number;queue:false}
 | {type:'order-strip';pawnId:number;targetId:number}
 | {type:'order-open-casket';pawnId:number;casketId:number}
 | {type:'order-animal-378';pawnId:number;animalId:number;action:'hunt'|'tame'|'slaughter';queue:false}
 | {type:'order-animal-rescue';pawnId:number;animalId:number}
 | {type:'order-bury';pawnId:number;bodyPawnId:number;graveId?:number;queue:false}
 | {type:'clean-room';pawnId:number;x:number;z:number}
 | {type:'order-extinguish';pawnId:number;fireId:number}
 | {type:'read-book-295';pawnId:number;bookId:number}
 | Extract<import('./cryptosleep-state-271.ts').CryptosleepCommand271,{pawnId:number}>
 | Extract<import('./ship-casket-state-277.ts').ShipCasketCommand277,{pawnId:number}>
 | Extract<import('./firefoam-manual-290.ts').FirefoamTriggerCommand290,{pawnId:number}>
 | Extract<import('./faction-comms-state-298.ts').FactionCommsCommand298,{type:'order-faction-comms'}>
 | {type:'order-trade';pawnId:number;traderId:number}
 | {type:'order-orbital-trade';pawnId:number;shipId:number;consoleId:number}
 | {type:'draft-move';pawnIds:number[];target:import('./types.ts').Cell;queue:false}
 | {type:'shoot';pawnIds:number[];targetId:number}
 | {type:'melee';pawnIds:number[];targetId:number;structure?:true};
export type QueueOrderCommand378={type:'queue-order-378';order:OrderedCommand378};
export const queuedOrderCount378=(p:Pick<import('./types.ts').Pawn,'orders'|'draft'|'orderedQueue378'>):number=>p.orders.queue.length+(p.draft?.queue.length??0)+(p.orderedQueue378?.length??0);

export type OrderedTargetKind378='pawn'|'animal'|'pile'|'structure'|'job'|'orbital-ship';
export function orderedTarget378(c:OrderedCommand378):{kind:OrderedTargetKind378;id:number}|undefined {
 if(c.type==='shoot'||c.type==='melee'||c.type==='draft-move'||c.type==='clean-room'||c.type==='order-extinguish')return;
 if('patientId' in c)return {kind:'pawn',id:c.patientId};
 if('bodyPawnId' in c)return {kind:'pawn',id:c.bodyPawnId};
 if('traderId' in c)return {kind:'pawn',id:c.traderId};
 if(c.type==='order-strip')return {kind:'pawn',id:c.targetId};
 if('animalId' in c)return {kind:'animal',id:c.animalId};
 if('pileId' in c)return {kind:'pile',id:c.pileId};
 if('bookId' in c)return {kind:'pile',id:c.bookId};
 if('itemId' in c)return {kind:'pile',id:c.itemId};
 if('jobId' in c)return {kind:'job',id:c.jobId};
 if(c.type==='order-haul'){const t=c.target;return t.type==='pile'?{kind:'pile',id:t.pileId}:t.type==='job'||t.type==='clear'||t.type==='clear-sow'?{kind:'job',id:t.jobId}:{kind:'structure',id:t.structureId};}
 if('casketId' in c)return {kind:'structure',id:c.casketId};
 if('structureId' in c)return {kind:'structure',id:c.structureId};
 if('consoleId' in c)return {kind:'structure',id:c.consoleId};
}
export function orderedTargets378(c:OrderedCommand378):{kind:OrderedTargetKind378;id:number}[] {
 const primary=orderedTarget378(c),result=primary?[primary]:[];
 if(c.type==='order-carry-cryptosleep')result.push({kind:'structure',id:c.casketId});
 if(c.type==='order-carry-ship-casket'&&c.patient.kind!=='mechanical')result.push({kind:c.patient.kind==='human'?'pawn':'animal',id:c.patient.id});
 if(c.type==='order-bury'&&c.graveId!==undefined)result.push({kind:'structure',id:c.graveId});
 if(c.type==='order-orbital-trade')result.push({kind:'orbital-ship',id:c.shipId});
 return result;
}
export function orderedTargetMatches378(c:OrderedCommand378,kind:OrderedTargetKind378,id:number):boolean {
 if(kind==='pawn')return 'patientId' in c&&c.patientId===id||'bodyPawnId' in c&&c.bodyPawnId===id||'traderId' in c&&c.traderId===id||c.type==='order-strip'&&c.targetId===id||c.type==='order-carry-ship-casket'&&c.patient.kind==='human'&&c.patient.id===id;
 if(kind==='animal')return 'animalId' in c&&c.animalId===id||c.type==='order-carry-ship-casket'&&c.patient.kind==='animal'&&c.patient.id===id;
 if(kind==='pile')return 'pileId' in c&&c.pileId===id||'itemId' in c&&c.itemId===id||'bookId' in c&&c.bookId===id||c.type==='order-haul'&&c.target.type==='pile'&&c.target.pileId===id;
 if(kind==='job')return 'jobId' in c&&c.jobId===id||c.type==='order-haul'&&'jobId' in c.target&&c.target.jobId===id;
 if(kind==='orbital-ship')return c.type==='order-orbital-trade'&&c.shipId===id;
 return 'casketId' in c&&c.casketId===id||'structureId' in c&&c.structureId===id||'consoleId' in c&&c.consoleId===id||c.type==='order-bury'&&c.graveId===id||c.type==='order-haul'&&'structureId' in c.target&&c.target.structureId===id;
}
/** Canonical future claims, available to automatic and forced providers alike. */
export function orderedTargetClaimant378(w:Pick<import('./types.ts').World,'schemaVersion'|'pawns'>,kind:OrderedTargetKind378,id:number,exceptPawnId?:number):import('./types.ts').Pawn|undefined {
 return Number(w.schemaVersion)>=378?orderedHumanCandidates379(w.pawns).find(p=>p.id!==exceptPawnId&&p.orderedQueue378?.some(c=>orderedTargetMatches378(c,kind,id))):undefined;
}
export const orderedTargetClaimed378=(w:Pick<import('./types.ts').World,'schemaVersion'|'pawns'>,kind:OrderedTargetKind378,id:number,exceptPawnId?:number):boolean=>!!orderedTargetClaimant378(w,kind,id,exceptPawnId);
