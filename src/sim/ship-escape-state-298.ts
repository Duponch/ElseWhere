import {isSchema298OrLater} from './schema-compatibility-257.ts';
import type {Structure} from './types.ts';
import type {CampaignState,WorldGroupRecord} from './world-map-state.ts';

export const SHIP_ESCAPE_SCHEMA_298=298 as const;
export const SHIP_ESCAPE_HISTORY_LIMIT_298=1024;
export type ShipEscapeAliasKey298='bedId'|'bedSlot'|'mapBed'|'allowedAreaId'|'allowedAreaReturn'|'penMarkerId';
/** Historic data-only presence/value provenance, never another live bed/area claim. */
export interface ShipEscapeAlias298 {actorId:number;target:'actor'|'domestic';key:ShipEscapeAliasKey298;present:boolean;value?:unknown}
export interface EscapedShip298 {
 id:number;mapId:number;computerId:number;departedAt:number;departedAtCore298:number;
 /** Captured from the original map, never inferred from a later selected map.
  * Only explicit monomap provenance permits an absent historical registry. */
 originKind298:'registered-map'|'monomap';originTile298:number|null;
 /** This is historical output provenance, never a Native authority flag. */
 finalRoot298:'network'|'known-destroyed';
 /** Present exactly when real parts departed; empty result owns no clinical context. */
 context?:WorldGroupRecord['context'];
 /** These exact originals have ONE frozen physical owner, outside active maps. */
 parts:Structure[];aliases:ShipEscapeAlias298[];
}
export interface ShipEscapeReceipt298 {id:number;mapId:number;computerId:number;at:number;atCore298:number;outcome:'departed'}
export interface EscapedShips298 {
 /** Born only with the first actual departure. No attempted launch or timer is saved. */
 revision:1;nextId:number;
 departures:EscapedShip298[];receipts:ShipEscapeReceipt298[];
 /** An actual successful departure owns this credit screen, until continued. */
 credits:number|null;
}
export type EscapeCampaign298=CampaignState&{escapedShips298?:EscapedShips298};
export type ShipEscapeCommand298={type:'ship-launch-298';computerId:number}|{type:'ship-credits-continue-298';departureId:number};
export type ShipEscapeResult298={ok:true;resumeNormal?:true}|{ok:false;reason:string};
export const shipEscapeSchema298=(version:unknown):version is 298|299|300|301|302|303|304|305|306|307|308|309|310|311|312|313|314=>isSchema298OrLater(version);
