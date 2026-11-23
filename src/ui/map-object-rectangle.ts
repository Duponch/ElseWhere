import { footprintCells, STRUCTURE_DEFINITIONS } from '../sim/definitions';
import { isConstruction } from '../sim/construction-rules';
import { geyserCells256 } from '../sim/local-geyser-state-256';
import { stockpileZoneId } from '../sim/stockpile-zones';
import type { Cell, MaterialPile, StructureKind, World } from '../sim/types';
import { knownPosition256 } from './exploration-readers-256';
import type { MapObjectSelection } from './map-object-selection';

/** Core Selector.MaxNumSelected. */
const MAX_SELECTED = 200;
import { selectableMapJobs296 } from './wall-door-selection-296';

/** Core ThingDef.neverMultiSelect among Elsewhere's buildings: Wall, Fence,
 * PowerConduit, Sandbags, Barricade and Hopper (natural rock RockBase and the
 * plants PlantBaseNonEdible are never offered by the box either). */
export const NEVER_MULTI_SELECT_STRUCTURES: ReadonlySet<string> = new Set<StructureKind | string>(['wall', 'fence', 'power-conduit', 'sandbags', 'barricade', 'hopper']);

/** Core ThingDef.CountAsResource (resourceReadoutPriority set): the stock
 * items of the resource readout, not corpses, chunks, weapons, apparel,
 * unfinished things, books or prostheses. */
export function pileCountsAsResource(pile: MaterialPile): boolean {
  return !['corpse', 'mech-corpse', 'chunk', 'weapon', 'apparel', 'unfinished', 'book', 'prosthesis'].includes(pile.kind) && !pile.innerResource;
}

export interface MapObjectsInRect { resources: MapObjectSelection[]; things: MapObjectSelection[]; zones: MapObjectSelection[]; plans: MapObjectSelection[] }

/** An actor proxy inside the box: 0 player colonist, 1 other humanlike,
 * 2 other pawn (animal, mechanoid), 3 body. */
export interface BoxActor { id: number; category?: number }
export type BoxSelection = { pawns: number[] } | { objects: MapObjectSelection[] } | undefined;

/**
 * Core Selector.SelectInsideDragBox, its predicates in order; the first that
 * finds something wins: IsColonist (colonist bar order), IsHumanlike,
 * IsResource, IsPawn, then any other multi-selectable thing (here the
 * buildings, blueprints, frames and items, then the bodies); then the zones,
 * or the plans when the box holds some (selecting a plan clears the zones).
 * Undefined: nothing, the release selects under the mouse instead.
 */
export function boxSelection(actors: readonly BoxActor[], objects: MapObjectsInRect | undefined): BoxSelection {
  const of = (category: number) => actors.filter(actor => (actor.category ?? 0) === category).map(actor => actor.id).slice(0, MAX_SELECTED);
  const colonists = of(0).sort((a, b) => a - b);
  if (colonists.length) return { pawns: colonists };
  const humans = of(1); if (humans.length) return { pawns: humans };
  if (objects?.resources.length) return { objects: objects.resources };
  const pawns = of(2); if (pawns.length) return { pawns };
  if (objects?.things.length) return { objects: objects.things };
  const bodies = of(3); if (bodies.length) return { pawns: bodies };
  const areas = objects?.plans.length ? objects.plans : objects?.zones;
  return areas?.length ? { objects: areas } : undefined;
}

/**
 * The map objects of Core ThingSelectionUtility.MultiSelectableThingsInScreenRectDistinct,
 * MultiSelectableZonesInScreenRectDistinct and MultiSelectablePlansInScreenRectDistinct:
 * selectable, not neverMultiSelect, discovered, with a cell inside the box
 * (`inside` tests a cell centre against the screen rectangle). Items counted
 * in the resource readout are kept apart for the IsResource pass.
 */
export function mapObjectsInRect(world: World, inside: (cell: Cell) => boolean): MapObjectsInRect {
  const result: MapObjectsInRect = { resources: [], things: [], zones: [], plans: [] };
  const seen = (cell: Cell) => knownPosition256(world, cell) && inside(cell);
  const any = (cells: Iterable<Cell>) => { for (const cell of cells) if (seen(cell)) return true; return false; };
  for (const structure of world.structures) {
    if (NEVER_MULTI_SELECT_STRUCTURES.has(structure.kind)) continue;
    const definition = STRUCTURE_DEFINITIONS[structure.kind];
    if (definition && (definition.width > 1 || definition.depth > 1) ? any(footprintCells(structure)) : seen(structure)) result.things.push({ kind: 'structure', id: structure.id });
  }
  for (const geyser of world.geysers?.items ?? []) {
    const cells = geyserCells256(world.width, geyser).map(index => ({ x: index % world.width, z: Math.floor(index / world.width) }));
    if (any(cells)) result.things.push({ kind: 'geyser', id: geyser.id });
  }
  for (const packed of world.packed) if (packed.owner.type === 'ground' && seen(packed.owner)) result.things.push({ kind: 'packed', id: packed.building.id });
  for (const pile of world.piles) {
    if (pile.owner.type !== 'ground' || pile.kind === 'book' || !seen(pile.owner)) continue;
    (pileCountsAsResource(pile) ? result.resources : result.things).push({ kind: 'pile', id: pile.id });
  }
  // Blueprints and frames are Things; designations are not.
  for (const job of selectableMapJobs296(world)) if (isConstruction(job) && any(footprintCells(job))) result.things.push({ kind: 'job', id: job.id });
  for (const zone of world.growingZones) if (any(zone.cells.map(index => ({ x: index % world.width, z: Math.floor(index / world.width) })))) result.zones.push({ kind: 'growing', id: zone.id });
  const stockpiles = new Set<number>();
  for (const cell of world.stockpiles) { const zone = stockpileZoneId(cell); if (!stockpiles.has(zone) && seen(cell)) { stockpiles.add(zone); result.zones.push({ kind: 'stockpile', id: cell.id }); } }
  for (const plan of world.plans369?.plans ?? []) if (any(plan.cells.map(index => ({ x: index % world.width, z: Math.floor(index / world.width) })))) result.plans.push({ kind: 'plan', id: plan.id });
  for (const list of [result.resources, result.things, result.zones, result.plans]) list.length = Math.min(list.length, MAX_SELECTED);
  return result;
}
