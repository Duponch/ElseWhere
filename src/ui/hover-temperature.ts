import { footprintContains, STRUCTURE_DEFINITIONS } from '../sim/definitions';
import { outdoorTemperature } from '../sim/temperature';
import type { Cell, World } from '../sim/types';
import { knownPosition256 } from './exploration-readers-256';

/** Core GenAdj.AdjacentCellsAndInside order. */
const AROUND: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1], [0, 0]];

/** A cell without a Core room: a natural rock or an impassable edifice (wall,
 * door). Elsewhere's thermal regions are the indoor rooms; every other
 * passable cell belongs to the outdoors. */
function roomless(world: World, cell: Cell): boolean {
  if (world.tiles[cell.z * world.width + cell.x]?.terrain === 'rock') return true;
  for (const structure of world.structures) {
    if (!footprintContains(structure, cell)) continue;
    const definition = STRUCTURE_DEFINITIONS[structure.kind];
    if (definition?.blocksMovement || structure.door) return true;
  }
  return false;
}

/**
 * Core GlobalControls.TemperatureString for the cell under the mouse: the
 * room of the cell, or for a wall the last indoor room among the adjacent
 * cells (else the first outdoor one), « Intérieur » or « Extérieur » and the
 * room's air temperature rounded to the degree. Fogged or no cell: outdoors.
 * Read on hover updates only (one pass over the indoor regions).
 */
export function hoverTemperatureText(world: World, cell: Cell | null | undefined): string {
  const outside = outdoorTemperature(world);
  const outdoors = `Extérieur ${Math.round(outside)} °C`;
  if (!cell || cell.x < 0 || cell.z < 0 || cell.x >= world.width || cell.z >= world.height || !knownPosition256(world, cell)) return outdoors;
  const wanted = new Map<number, number>();
  const self = roomless(world, cell);
  AROUND.forEach(([dx, dz], slot) => {
    if (!self && slot !== 8) return;
    const x = cell.x + dx, z = cell.z + dz;
    if (x >= 0 && z >= 0 && x < world.width && z < world.height) wanted.set(z * world.width + x, slot);
  });
  const found: (number | undefined)[] = [];
  for (const region of world.thermal?.regions ?? []) for (const index of region.cells) {
    const slot = wanted.get(index); if (slot !== undefined) found[slot] = region.temperature;
  }
  let temperature: number | undefined;
  for (let slot = 0; slot < 9; slot++) if (found[slot] !== undefined) temperature = found[slot];
  return temperature === undefined ? outdoors : `Intérieur ${Math.round(temperature)} °C`;
}
