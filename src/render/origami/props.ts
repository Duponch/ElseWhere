import type { Structure, World } from '../../sim/types';
import { footprintCells } from '../../sim/definitions';
import { isPowerActive } from '../../sim/power-rules';
import { WORLD_SCALE } from '../../world/scale';
import { buildingMaterialColor } from '../building-material-color';
import { SHELF_LEVELS } from '../shelf-presentation';
import type { Placement } from '../primitives';

/** These furniture subjects are absent from the supplied atelier reference.
 * They extend its cut-card construction using existing physical definitions.
 * All parts enter the existing resident furniture batch, never one mesh/object.
 */
export const ORIGAMI_FURNITURE_KINDS: ReadonlySet<Structure['kind']> = new Set([
  'bed', 'solar-generator', 'wood-generator', 'heater', 'table', 'stool',
  'table-square', 'table-long', 'shelf', 'small-shelf',
]);

const edge = 0x796044, wood = 0xa78154, cream = 0xe9dcc0;
const metal = 0x798d89, darkMetal = 0x465b56, paperMetal = 0xa1b2a3;

function centre(s: Structure): { x: number; z: number } {
  const cells = footprintCells(s);
  return { x: cells.reduce((sum, c) => sum + c.x, 0) / cells.length,
    z: cells.reduce((sum, c) => sum + c.z, 0) / cells.length };
}

export function origamiFurnitureParts(world: World): Placement[] {
  const parts: Placement[] = [];
  for (const s of world.structures) {
    if (!ORIGAMI_FURNITURE_KINDS.has(s.kind)) continue;
    const { x, z } = centre(s), ry = s.orientation * Math.PI / 2;
    const cosine = Math.cos(ry), sine = Math.sin(ry);
    const body = buildingMaterialColor(s.material, wood) ?? wood;
    const trim = s.material && s.material !== 'wood' ? buildingMaterialColor(s.material) ?? edge : edge;
    const add = (dx: number, y: number, dz: number, sx: number, sy: number, sz: number, color: number): void => {
      parts.push({ key: s.id, targetId: s.id, x: x + dx * cosine + dz * sine, y,
        z: z + dz * cosine - dx * sine, sx, sy, sz, ry, color });
    };
    if (s.kind === 'bed') {
      const width = WORLD_SCALE.bedWidth;
      const length = s.footprint === 'legacy-single' ? .93 : WORLD_SCALE.bedLength;
      // Preserve the real sleeping surface and existing single/legacy footprint.
      add(0, .18, 0, width, .28, length, body);
      add(0, .325, 0, width + .025, .035, length + .025, trim);
      add(0, WORLD_SCALE.bedSurfaceHeight - .045, 0, width - .06, .14, length - .1, cream);
      add(0, WORLD_SCALE.bedSurfaceHeight + .031, length * .12,
        width - .055, .018, length * .60, s.medical ? 0x91c2d2 : 0x9c5e4b);
      add(0, WORLD_SCALE.bedSurfaceHeight + .047, length * .33,
        width - .05, .02, length * .10, s.medical ? 0xc2d8d4 : 0xc39367);
      add(0, WORLD_SCALE.bedSurfaceHeight + .07, -length * .33, .6, .12, .27, cream);
      for (const sign of [-1, 1]) {
        add(0, sign < 0 ? .35 : .24, sign * (length / 2 - .05), width, sign < 0 ? .63 : .40, .08, body);
        add(0, sign < 0 ? .675 : .45, sign * (length / 2 - .05), width + .045, .035, .10, trim);
      }
    } else if (s.kind === 'shelf' || s.kind === 'small-shelf') {
      const width = s.kind === 'shelf' ? 1.9 : .9;
      // Three saved item supports stay exactly at the shared storage heights.
      for (const y of SHELF_LEVELS) {
        add(0, y - .035, 0, width, .07, .84, body);
        add(0, y - .012, .43, width, .045, .025, trim);
      }
      for (const dx of [-width / 2 + .045, width / 2 - .045]) {
        add(dx, .74, 0, .07, 1.48, .84, body);
        add(dx, .74, .43, .085, 1.48, .025, trim);
      }
      add(0, .74, -.405, width, 1.48, .035, trim);
    } else if (s.kind === 'table' || s.kind === 'stool' || s.kind === 'table-square' || s.kind === 'table-long') {
      const stool = s.kind === 'stool';
      const width = stool ? WORLD_SCALE.stoolWidth : s.kind === 'table-square' ? 1.70 : s.kind === 'table-long' ? 1.92 : WORLD_SCALE.tableWidth;
      const length = stool ? WORLD_SCALE.stoolWidth : s.kind === 'table-square' ? 1.70 : s.kind === 'table-long' ? 3.92 : WORLD_SCALE.tableLength;
      const height = stool ? WORLD_SCALE.stoolHeight : WORLD_SCALE.tableHeight;
      add(0, height - .045, 0, width, .09, length, body);
      add(0, height - .1, 0, width + .025, .028, length + .025, trim);
      for (const dx of [-1, 1]) for (const dz of [-1, 1])
        add(dx * (width / 2 - .085), (height - .09) / 2, dz * (length / 2 - .085), .09, height - .09, .09, body);
      if (!stool) for (const dx of [-width * .30, width * .30])
        add(dx, height + .003, 0, .018, .008, length - .045, trim);
    } else if (s.kind === 'heater') {
      const on = isPowerActive(s);
      add(0, .10, 0, .87, .20, .72, darkMetal);
      add(0, .56, 0, .84, .76, .54, paperMetal);
      add(0, .955, 0, .89, .035, .59, metal);
      add(0, .55, -.279, .73, .62, .025, darkMetal);
      for (const dx of [-.30, -.20, -.10, 0, .10, .20, .30])
        add(dx, .56, -.30, .037, .60, .055, metal);
      add(.31, .66, .30, .12, .22, .07, on ? 0xd8a05c : 0x58665c);
    } else if (s.kind === 'wood-generator') {
      const on = isPowerActive(s);
      add(0, .13, 0, 1.85, .26, 1.85, darkMetal);
      add(-.37, WORLD_SCALE.generatorHeight / 2 + .12, 0, .9, WORLD_SCALE.generatorHeight, 1.42, paperMetal);
      add(-.37, WORLD_SCALE.generatorHeight + .15, 0, .96, .06, 1.49, metal);
      add(.45, .63, .15, .54, .76, .96, metal);
      add(-.37, .57, .73, .59, .43, .05, darkMetal);
      add(-.37, .57, .763, .45, .28, .022, on ? 0xd98c43 : 0x514e42);
      add(-.37, WORLD_SCALE.generatorHeight + .35, -.54, .23, .70, .23, darkMetal);
      add(-.37, WORLD_SCALE.generatorHeight + .71, -.54, .32, .035, .32, metal);
      for (const dz of [-.25, .05, .35]) add(.45, 1.06, dz, .48, .055, .095, paperMetal);
    } else if (s.kind === 'solar-generator') {
      // The existing 4x4 footprint stays horizontal; no fictitious sun tracking.
      for (const dz of [-1.42, -.47, .47, 1.42]) {
        add(0, .44, dz, 3.83, .12, .85, metal);
        add(0, .505, dz, 3.68, .025, .73, 0x284a67);
        for (const dx of [-1.22, 0, 1.22]) add(dx, .20, dz, .09, .40, .64, darkMetal);
        for (const dx of [-.92, 0, .92]) add(dx, .523, dz, .025, .012, .73, 0x9dbfc4);
        add(0, .523, dz, 3.68, .012, .018, 0x7395aa);
      }
    }
  }
  return parts;
}

/** Replace only completed, currently authored subjects. Unknown definitions and
 * packed buildings remain on their ordinary rendering path. Consumer leads are
 * generated by electricalParts from real saved parentId; keep those placements.
 */
export function replaceOrigamiFurnitureParts(world: World, original: readonly Placement[]): Placement[] {
  const replaced = new Set(world.structures.filter(s => ORIGAMI_FURNITURE_KINDS.has(s.kind)).map(s => s.id));
  return [...original.filter(p => p.targetId === undefined || !replaced.has(p.targetId)
    || p.y === .065 && p.sx === .025 && p.sy === .025), ...origamiFurnitureParts(world)];
}
