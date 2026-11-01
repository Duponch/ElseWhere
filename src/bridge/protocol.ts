import type {SettlementLimit,CampaignSummary} from '../sim/world-map-state';
import type { ThreatPauseMode, ThreatSpeedOptions } from './urgent-threats';
import type { Command } from '../sim/types';
import type { SnapshotMessage } from './snapshots';
import type {ShipRuntimeRequest298,ShipRuntimeResponse298,ShipOwnerReplyMetadata298} from './ship-countdown-wire-298.ts';

export interface CampEntryProgressMessage256 {type:'camp-entry-progress';id:number;groupId:number;progress:import('../sim/camp-map-assembly-256').CampMapProgress256}
export interface WorldDraftPreviewMessage256 {
 type:'world-draft-preview';id:number;generation:number;key:string;
 request:import('../ui/world-creation-contract').WorldCreationRequest256;
 geography:import('../sim/world-geography-owner-256').GeographyPacket256;
 factions:readonly import('../ui/world-creation-contract').WorldCreationFaction256[];
 settlements:readonly import('../ui/world-creation-contract').WorldCreationSettlement256[];
}
export type Request =
  | import('./actual-view-wire-301.ts').ActualViewRequest301
  | ShipRuntimeRequest298
  | {id:number;type:'world-draft-generate';generation:number;request:import('../ui/world-creation-contract').WorldCreationRequest256}
  | {id:number;type:'world-draft-cancel';generation:number;operationId?:number}
  | {id:number;type:'world-draft-confirm';request:import('../ui/world-creation-contract').WorldCreationSiteRequest256;geographyId:number}
  | {id:number;type:'world-draft-start';ticket:import('../ui/world-creation-contract').WorldCreationTicket256;startingParty:import('../sim/starting-original-request-256').StartingOriginalRequest256;maxSettlements:SettlementLimit;threatPauseMode:ThreatPauseMode}
  | {id:number;type:'camp-entry-cancel';operationId:number;groupId:number}
  | { id: number; type: 'init'; maxSettlements?:SettlementLimit; threatPauseMode?: ThreatPauseMode; seed: number; size: number; scenario?:import('../sim/scenario-definitions').ScenarioId; paused?:boolean; site?:import('../sim/site').SiteOptions; startingParty?:import('../sim/starting-candidates').StartingParty; startingWorld?:import('../sim/starting-world').StartingWorld;surface?:'snow-phased-v1' }
  | { id: number; type: 'command'; command: Command }
  | { id: number; type: 'order-options'; pawnId: number; x: number; z: number; queue: boolean }
  | { id: number; type: 'bill-worker-options'; structureId:number; billId:number }
  | { id: number; type: 'speed'; speed: number; options?: ThreatSpeedOptions; pauseIntent?: {origin:number;at:number} }
  | { id: number; type: 'threat-pause-mode'; mode: ThreatPauseMode }
  | { id: number; type:'settlement-limit';maxSettlements:SettlementLimit }
  | { id: number; type: 'save' }
  | { id: number; type: 'resync' }
  | { id: number; type: 'load'; maxSettlements?:SettlementLimit; data: string; threatPauseMode?: ThreatPauseMode };

export interface CaravanEncounterProgressMessage261 {type:'caravan-encounter-progress';groupId:number;phase:string;reason?:string}
export interface CaravanTradeArrivalMessage261 {type:'caravan-trade-arrival';groupId:number;settlementId:number;factionId:number;postId:number;checkpoint:{epoch:number;revision:number}}
export type Response = (
  | import('./core-phase-projection-297').CorePhaseEnvelope297
  | CaravanTradeArrivalMessage261
  | CaravanEncounterProgressMessage261
  | WorldDraftPreviewMessage256
  | {type:'world-draft-progress';id:number;generation:number;progress:import('../ui/world-creation-contract').WorldCreationProgress256}
  | CampEntryProgressMessage256
  | SnapshotMessage<true>
  | CampaignOnlyMessage
  | { type: 'reply'; id: number; ok: boolean; data?: string; reason?: string; outcome?: 'refused' | 'unknown'; checkpoint?: { epoch: number; revision: number } }
  | SimulationFault) & ShipOwnerReplyMetadata298 | ShipRuntimeResponse298;

/** A fatal stop does not promise that the last tick was rolled back. */
export interface SimulationFault {
  type: 'fault';
  reason: string;
  speed: 0;
  tick?: number;
  transport?: true;
}

export interface SimulationRequestStatus {
  id: number;
  type: Extract<Request,{id:number}>['type'];
  state: 'waiting' | 'settled';
  message?: string;
}

export class SimulationRequestError extends Error {
  constructor(message: string, readonly outcome: 'refused' | 'unknown', readonly stopped = false) {
    super(message);
    this.name = 'SimulationRequestError';
  }
}

export interface CampaignOnlyMessage {geography?:import('./planet-geography-transport-256').PlanetGeographyTransport256;type:'campaign-only';epoch:number;revision:number;stepMs:number;speed:number;summary:CampaignSummary;urgentThreats:import('./urgent-threats').UrgentThreatSnapshot}
