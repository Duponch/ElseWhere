import { footprintCells } from '../sim/definitions';
import type { Structure, World } from '../sim/types';
import type { Placement } from './primitives';

/** Side of a furniture zone, in cells. The resident furniture batch is laid out
 * zone by zone; a structure change rewrites only the zones it can affect. */
export const FURNITURE_ZONE_SIZE = 32;
/** Neighbour reach of the furniture producers. Doors, pens and power conduits
 * read their direct neighbours (1 cell); every other producer reads only its
 * own structure. A changed structure dirties every zone within this reach, and
 * a zone is produced with the structures within this reach as subjects. */
export const FURNITURE_ZONE_REACH = 2;

export const furnitureZoneKey = (zx: number, zz: number): string => `${zx}:${zz}`;
const zoneIndex = (cell: number) => Math.floor(cell / FURNITURE_ZONE_SIZE);

/** Owner zone of a placement: the anchor of its target structure, else its
 * rounded position (packed furniture parcels target their packed building). */
export function furniturePlacementZone(p: Placement, byId: ReadonlyMap<number, Structure>): string {
  const s = p.targetId === undefined ? undefined : byId.get(p.targetId);
  return s ? furnitureZoneKey(zoneIndex(s.x), zoneIndex(s.z)) : furnitureZoneKey(zoneIndex(Math.floor(p.x + .5)), zoneIndex(Math.floor(p.z + .5)));
}

/** Reserved slot of a zone segment: a 0.1 mm box one metre below the ground at
 * the zone centre. It draws nothing and carries no target. */
export function hiddenFurnitureSlot(key: string): Placement {
  const [zx, zz] = key.split(':').map(Number) as [number, number];
  return { x: (zx + .5) * FURNITURE_ZONE_SIZE, y: -1, z: (zz + .5) * FURNITURE_ZONE_SIZE, sx: 1e-4, sy: 1e-4, sz: 1e-4, color: 0 };
}

/** Reserved slots after the live placements of a zone segment. */
export const furnitureZoneSlack = (count: number): number => Math.max(8, Math.ceil(count / 8));

/** Every structure field a furniture producer reads (the structure presentation
 * signature fields, plus breakdown presence read by power activity). A
 * structure whose values are unchanged produces unchanged parts given the
 * same neighbours; undefined refuses incremental work (unsupported values). */
export function furnitureStructureValues(s: Structure): readonly unknown[] | undefined {
  const plant = s.flower?.plant, fuel = s.fuel, hitPoints = plant?.hitPoints, growth = plant?.growth, ticks = fuel?.ticks;
  for (const v of [hitPoints, growth, ticks]) if (v !== undefined && v !== null && typeof v !== 'number') return undefined;
  return [s.id, s.kind, s.material, s.x, s.z, s.orientation, s.footprint, s.medical, s.grave?.corpseId,
    !!plant, plant ? plant.hitPoints > 0 : undefined, plant ? Math.floor(plant.growth * 4) : undefined,
    s.power?.on, s.power?.parentId, s.power?.switchOn, !!s.breakdown, s.breakdown?.brokenAt ?? '', fuel ? fuel.ticks > 0 : '', s.vent?.open,
    s.kind === 'cryptosleep-casket' ? !!s.cryptosleep?.human : s.kind === 'ship-cryptosleep-casket' ? !!s.shipCryptosleep277?.occupant : undefined,
    s.kind === 'ship-reactor' ? (s.shipReactor275?.state ?? 'hibernating') : undefined];
}
export function sameFurnitureValues(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
export const structureCells = (s: Structure): readonly { x: number; z: number }[] => footprintCells(s);

/** Zones within reach of these cells. */
export function zonesNear(cells: readonly { x: number; z: number }[], into: Set<string>): void {
  for (const c of cells) {
    const x0 = zoneIndex(c.x - FURNITURE_ZONE_REACH), x1 = zoneIndex(c.x + FURNITURE_ZONE_REACH);
    const z0 = zoneIndex(c.z - FURNITURE_ZONE_REACH), z1 = zoneIndex(c.z + FURNITURE_ZONE_REACH);
    for (let zz = z0; zz <= z1; zz++) for (let zx = x0; zx <= x1; zx++) into.add(furnitureZoneKey(zx, zz));
  }
}

/** Structures and packed parcels whose cells lie within reach of these zones:
 * the subjects of a partial furniture production. */
export function zoneSubjects(world: World, zones: ReadonlySet<string>, cells: (s: Structure) => readonly { x: number; z: number }[]): Pick<World, 'structures' | 'packed'> {
  const near = (x: number, z: number) => {
    for (let zz = zoneIndex(z - FURNITURE_ZONE_REACH); zz <= zoneIndex(z + FURNITURE_ZONE_REACH); zz++)
      for (let zx = zoneIndex(x - FURNITURE_ZONE_REACH); zx <= zoneIndex(x + FURNITURE_ZONE_REACH); zx++) if (zones.has(furnitureZoneKey(zx, zz))) return true;
    return false;
  };
  return {
    structures: world.structures.filter(s => cells(s).some(c => near(c.x, c.z))),
    packed: (world.packed ?? []).filter(p => p.owner.type !== 'ground' || near(p.owner.x, p.owner.z)),
  };
}

/** Same placement (every own field, same presence). */
export function samePlacement(a: Placement, b: Placement): boolean {
  if (a === b) return true;
  let n = 0;
  for (const k in a) { if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false; n++; }
  for (const k in b) { n--; if (!(k in a)) return false; }
  return n === 0;
}
