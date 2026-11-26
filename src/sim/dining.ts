import { allowedAreaAllows } from './allowed-area-state.ts';
import { targetBuildingPlayerUse263 } from './world-target-building-263.ts';
import { deconstructionReserved } from './deconstruction-rules.ts';
import { capturePrisonTopology,prisonerAllowedCell } from './prison-space.ts';
import { canStandAt } from './furniture-travel.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { captureStructureNavigation, filteredStructures } from './structure-navigation.ts';
import { terrainJournalReadOwner } from './terrain-read-scope.ts';
import { footprintCells, MATERIAL_DEFINITIONS } from './definitions.ts';
import { adjacent, inBounds, routeToCell } from './pathfinding.ts';
import type { NeedContext } from './needs.ts';
import type { Cell, DiningPlace, Pawn, Structure, World } from './types.ts';
import {couchCells365,couchContains365} from './straw-couch-365.ts';

const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.z === b.z;
const distance = (a: Cell, b: Cell): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const neighbors = (cell: Cell): Cell[] => [
  { x: cell.x, z: cell.z - 1 }, { x: cell.x + 1, z: cell.z },
  { x: cell.x, z: cell.z + 1 }, { x: cell.x - 1, z: cell.z },
];
export const isDiningTable=(kind:unknown):boolean=>kind==='table'||kind==='table-square'||kind==='table-long'||kind==='table-large';
export const isDiningSeat=(kind:unknown):boolean=>kind==='stool'||kind==='dining-chair'||kind==='armchair'||kind==='couch';
/** Schema 365: the couch (Core multiSittable) is a seat on each of its two
 * cells; every older seat is its anchor cell only. */
export const seatAt=(seat:Cell&{kind:string;orientation?:number},cell:Cell):boolean=>seat.kind==='couch'?couchContains365(seat,cell):seat.x===cell.x&&seat.z===cell.z;
export const seatCells=(seat:Cell&{kind:string;orientation?:number}):readonly Cell[]=>seat.kind==='couch'?couchCells365(seat):[seat];

const diningSeat = (item:Structure):boolean => isDiningSeat(item.kind);
const usableTable = (world:World,item:Structure):boolean => isDiningTable(item.kind) && targetBuildingPlayerUse263(world,item);

/** Any cardinal eating surface works; a stool's orientation is not a rule. */
export function adjacentTable(world: World, cell: Cell): { id: number; cell: Cell } | null {
  const geometry = terrainJournalReadOwner() ? captureStructureNavigation(world) : undefined;
  for (const neighbor of neighbors(cell)) {
    const table = geometry ? geometry.at(neighbor).find(item => usableTable(world,item))
      : world.structures.find(item => usableTable(world,item) && footprintCells(item).some(part => same(part, neighbor)));
    if (table) return { id: table.id, cell: neighbor };
  }
  return null;
}

export function validDiningPlace(world: World, place: DiningPlace): boolean {
  const geometry = terrainJournalReadOwner() ? captureStructureNavigation(world) : undefined;
  if(world.schemaVersion>=22&&!canStandAt(world,place.target,geometry))return false;
  if (geometry) {
    if (place.seatId !== null && !geometry.at(place.target).some(item =>
      item.id === place.seatId && diningSeat(item) && targetBuildingPlayerUse263(world,item) && seatAt(item,place.target))) return false;
    return place.tableId === null || neighbors(place.target).some(cell => geometry.at(cell).some(item =>
      item.id === place.tableId && usableTable(world,item)));
  }
  if (place.seatId !== null && !world.structures.some(item => isDiningSeat(item.kind) && targetBuildingPlayerUse263(world,item) && item.id === place.seatId && seatAt(item, place.target))) return false;
  return place.tableId === null || world.structures.some(item => item.id === place.tableId && isDiningTable(item.kind) && targetBuildingPlayerUse263(world,item) && footprintCells(item).some(cell => adjacent(cell, place.target)));
}

/** Runs only after pickup, not at the original hunger decision. Candidate radius
 * is geometric; reachability still follows the real obstacles. A single shared
 * search is deferred until there is a candidate requiring a route.
 */
/** `standingOnly`: Core chairSearchRadius 0 (pills), chewed standing nearby. */
export function chooseDiningPlace(world: World, pawn: Pawn, context: NeedContext,beer=false,standingOnly=false): { place: DiningPlace; path: Cell[] } | null {
  const key = (cell: Cell): number => cell.z * world.width + cell.x;
  const reserved = reservedServiceCells(world,pawn.id);
  // The simulation owns footprint membership at each decision. Faction and
  // reservation facts can change between decisions, so read them from the
  // original objects. Public callers can still freely edit their structures.
  const geometry = terrainJournalReadOwner() ? captureStructureNavigation(world) : undefined;
  const publicSurfaces = new Map<number, number>();
  const fixed = new Set<number>();
  if (!geometry) for (const item of world.structures) for (const cell of footprintCells(item)) {
    if (usableTable(world,item)) publicSurfaces.set(key(cell),item.id);
    if (!diningSeat(item)) fixed.add(key(cell));
  }
  for (const item of world.jobs) if (item.kind === 'wall' || isDiningTable(item.kind)) for (const cell of footprintCells(item)) fixed.add(key(cell));
  const surfaceAt = (cell: Cell): number | undefined => {
    if (!geometry) return publicSurfaces.get(key(cell));
    // Placement takes the last eligible table at this cell. The post-meal
    // adjacentTable lookup instead takes the first, in source order.
    const items = geometry.at(cell);
    for (let i=items.length-1;i>=0;i--) if (usableTable(world,items[i]!)) return items[i]!.id;
    return undefined;
  };
  const candidates: DiningPlace[] = [];
  const topology=pawn.prisoner?capturePrisonTopology(world):undefined;
  // Each seat cell is a candidate: a couch (schema 365) offers its two cells.
  const consider=(seat:typeof world.structures[number],at:Cell)=>{
    if (!isDiningSeat(seat.kind) || distance(pawn, at) > (beer?25:MATERIAL_DEFINITIONS.food.chairSearchRadius) ** 2) return;
    if(!allowedAreaAllows(world,pawn,at))return;
    if(!prisonerAllowedCell(world,pawn,at,topology))return;
    if (!targetBuildingPlayerUse263(world,seat) || deconstructionReserved(world,seat.id,pawn.id) || world.schemaVersion>=22&&!canStandAt(world,at,geometry) || reserved.has(key(at))) return;
    let tableId:number|null=null;
    for (const neighbor of neighbors(at)) {
      if (!inBounds(world,neighbor.x,neighbor.z)) continue;
      const id=surfaceAt(neighbor);
      if (id!==undefined) {tableId=id;break;}
    }
    if (tableId!==null||beer) candidates.push({ target: { x: at.x, z: at.z }, seatId: seat.id, tableId });
  };
  if(!standingOnly)for (const seat of geometry ? filteredStructures(world,'dining-seats',diningSeat) : world.structures) {
    if(seat.kind==='couch'){for(const cell of couchCells365(seat))consider(seat,cell);}else consider(seat,seat);
  }
  candidates.sort((a, b) => distance(pawn, a.target) - distance(pawn, b.target) || a.seatId! - b.seatId!);
  let reach: ReturnType<NeedContext['search']> | undefined;
  for (const place of candidates) {
    reach ??= context.search( new Set([key(candidates[0]!.target)]));
    if (!reach) return null; // Search budget is not proof that seats are unreachable.
    const path = routeToCell(world, place.target, reach);
    if (path) return { place, path };
  }
  // With no available seat, chew standing nearby. Current cell first; deterministic
  // local fallback replaces the reference region/random tie-break (documented).
  const standing: Cell[] = [];
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const cell = { x: pawn.x + dx, z: pawn.z + dz };
    if(!allowedAreaAllows(world,pawn,cell))continue;
    if(!prisonerAllowedCell(world,pawn,cell,topology))continue;
    if (dx * dx + dz * dz > 16 || !inBounds(world, cell.x, cell.z) || reserved.has(key(cell)) || fixed.has(key(cell)) || geometry?.at(cell).some(item=>!diningSeat(item)) || world.schemaVersion>=22&&!canStandAt(world,cell,geometry) || ['water', 'rock'].includes(world.tiles[key(cell)]!.terrain)) continue;
    standing.push(cell);
  }
  standing.sort((a, b) => distance(pawn, a) - distance(pawn, b) || key(a) - key(b));
  for (const target of standing) {
    if (!same(pawn, target)) { reach ??= context.search(); if (!reach) return null; }
    const path = same(pawn, target) ? [] : routeToCell(world, target, reach!);
    if (path) return { place: { target, seatId: null, tableId: adjacentTable(world, target)?.id ?? null }, path };
  }
  return null;
}
