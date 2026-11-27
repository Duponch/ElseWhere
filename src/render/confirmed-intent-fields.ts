import type { Cell, Job, Pawn, World } from '../sim/types';
import type {MapObjectSelection} from '../ui/map-object-selection';
import {knownCell256} from '../sim/exploration-visibility-256';
import {stockpileZoneCells} from '../sim/stockpile-zones';

/** Exact authored edge primitives, without JSON work at admission. */
export function confirmedRouteEdgeSignature(m:Pawn['motion']):string {
  if(!m)return '';
  const spans=(items:typeof m.stagger)=>[items?.length??0,...(items??[]).flatMap(s=>[s.start,s.end])].join(',');
  return [m.from.x,m.from.z,m.to.x,m.to.z,m.start,m.end,m.terrainDelay??'',m.speedFactor??'',
    m.animalFlight?1:0,m.snowEntryPending?1:0,spans(m.stagger),spans(m.stuns)].join('|');
}

export interface ConfirmedIntentRoute {
  readonly pawnId:number;
  readonly origin:Readonly<Cell>;
  readonly edgeSignature:string;
  readonly cells:readonly Readonly<Cell>[];
}
/** References belong to snapshots already admitted by the closed MAIN client.
 * No World is reconstructed. Consumers accept intention fields separately from
 * the executed surface/poses. Physical Job fields are never consulted by the
 * intention producer, even though records share immutable snapshot storage. */
export interface ConfirmedIntentFields {
  readonly jobs:readonly Job[];
  readonly growingZones:World['growingZones'];
  readonly stockpiles:World['stockpiles'];
  readonly home:World['home'];
  readonly snowClearArea:World['snowClearArea'];
  readonly allowedAreas:World['allowedAreas'];
  readonly plans369:World['plans369'];
  readonly roofBuild:readonly number[];
  readonly roofRemove:readonly number[];
  readonly routes:readonly ConfirmedIntentRoute[];
}

export const isIntentZoneSelection=(selected:MapObjectSelection):boolean=>selected.kind==='stockpile'||selected.kind==='growing'||selected.kind==='plan';

/** Zone fill and selected contour share the same confirmed membership. A
 * physical World can still be playing an earlier tick; it supplies terrain
 * and exploration, never the newer shape of the player's designations. Return
 * undefined only when this selection is not an intention zone. */
export function confirmedZoneSelectionCells(world:World,intents:ConfirmedIntentFields|undefined,selected:MapObjectSelection):Cell[]|undefined {
  if(!intents||!isIntentZoneSelection(selected))return;
  if(selected.kind==='stockpile')return stockpileZoneCells({stockpiles:intents.stockpiles},selected.id).filter(cell=>knownCell256(world,cell.z*world.width+cell.x));
  const indices=selected.kind==='growing'?intents.growingZones.find(zone=>zone.id===selected.id)?.cells:intents.plans369?.plans.find(plan=>plan.id===selected.id)?.cells;
  // Plans can be drawn through fog by design; retain the original selection
  // rule (at least one known cell). Other overlays expose only played knowledge.
  const cells=indices??[];
  if(selected.kind==='plan'&&!cells.some(cell=>knownCell256(world,cell)))return [];
  return cells.filter(cell=>selected.kind==='plan'||knownCell256(world,cell)).map(cell=>({x:cell%world.width,z:Math.floor(cell/world.width)}));
}
