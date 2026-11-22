import { footprintCells } from '../sim/definitions';
import type { Structure, World } from '../sim/types';
import { buildingMaterialColor } from './building-material-color';
import type { Placement } from './primitives';
import { WORLD_SCALE } from '../world/scale';
import {shelfParts} from './shelf-presentation';

/**
 * Static habitat furniture for the resident furniture batch.  These are only
 * expanded when that batch is rebuilt; the render loop never creates a mesh
 * or a material per chair, table, or pot.
 */
export function habitatParts(world: World): Placement[] {
  const parts: Placement[] = [];
  for (const structure of world.structures) {
    const kind = structure.kind as string;
    if (!HABITAT_KINDS.has(kind)) continue;
    const { x, z } = footprintCenter(structure);
    const ry = structure.orientation * Math.PI / 2;
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const body = buildingMaterialColor(structure.material, 0xa38559) ?? 0xa38559;
    const trim = structure.material === 'steel' ? 0x64747a : shade(body, 0.72);
    const add = (localX: number, y: number, localZ: number, sx: number, sy: number, sz: number, color = body): void => {
      parts.push({targetId:structure.id,
        key: structure.id,
        x: x + localX * cos + localZ * sin,
        y,
        z: z + localZ * cos - localX * sin,
        sx,
        sy,
        sz,
        ry,
        color,
      });
    };
    switch (kind) {
      case 'shelf':case 'small-shelf': parts.push(...shelfParts(structure,body,trim));break;
      case 'dining-chair': {
        const seat = WORLD_SCALE.stoolHeight + 0.03;
        add(0, seat, 0, 0.62, 0.10, 0.62);
        for (const dx of [-0.23, 0.23]) for (const dz of [-0.23, 0.23]) add(dx, seat / 2, dz, 0.08, seat, 0.08, trim);
        // Orientation zero faces +z; the backrest belongs behind that face.
        add(0, 0.66, -0.25, 0.58, 0.42, 0.08, trim);
        break;
      }
      case 'armchair': {
        const seat = 0.37;
        add(0, seat, 0.03, 0.78, 0.14, 0.78, trim);
        for (const dx of [-0.31, 0.31]) add(dx, 0.53, 0.04, 0.15, 0.36, 0.72);
        for (const dx of [-0.29, 0.29]) for (const dz of [-0.28, 0.28]) add(dx, seat / 2, dz, 0.10, seat, 0.10, trim);
        add(0, 0.69, -0.31, 0.76, 0.50, 0.12, trim);
        break;
      }
      case 'couch': {
        // Schema 365: the two-seat couch, two cushions on one frame (local X is its long side).
        const seat = 0.37;
        add(0, seat, 0.03, 1.78, 0.14, 0.78, trim);
        for (const dx of [-0.45, 0.45]) add(dx, 0.47, 0.06, 0.84, 0.08, 0.66);
        for (const dx of [-0.91, 0.91]) add(dx, 0.53, 0.04, 0.15, 0.36, 0.72);
        for (const dx of [-0.82, 0.82]) for (const dz of [-0.28, 0.28]) add(dx, seat / 2, dz, 0.10, seat, 0.10, trim);
        add(0, 0.69, -0.31, 1.76, 0.50, 0.12, trim);
        break;
      }
      case 'end-table': {
        const height = WORLD_SCALE.tableHeight - 0.05;
        add(0, height, 0, 0.76, 0.10, 0.76);
        for (const dx of [-0.29, 0.29]) for (const dz of [-0.29, 0.29]) add(dx, height / 2, dz, 0.09, height, 0.09, trim);
        add(0, height * 0.53, 0.29, 0.49, 0.13, 0.05, trim);
        break;
      }
      case 'dresser': {
        const width = 1, depth = 2;
        const cabinetWidth = Math.max(0.80, width - 0.13);
        const cabinetDepth = Math.max(0.54, depth - 0.17);
        add(0, 0.46, 0, cabinetWidth, 0.92, cabinetDepth, trim);
        add(0, 0.95, 0, cabinetWidth + 0.07, 0.09, cabinetDepth + 0.07);
        // The 1×2 cabinet opens along its long side, not its narrow end.
        for (const y of [0.27, 0.52, 0.76]) add(cabinetWidth / 2 + 0.004, y, 0, 0.04, 0.025, cabinetDepth - 0.12, body);
        for (const y of [0.27, 0.52, 0.76]) for (const dz of [-0.36, 0.36]) add(cabinetWidth / 2 + 0.035, y, dz, 0.045, 0.045, 0.045, 0xc4b794);
        break;
      }
      case 'table-square': {
        table(parts, structure, x, z, ry, 1.70, 1.70, body, trim);
        break;
      }
      case 'table-long': {
        table(parts, structure, x, z, ry, 1.92, 3.92, body, trim);
        break;
      }
      case 'table-large': {
        // Schema 363: the 3×3 table, a square top with a fifth central leg.
        table(parts, structure, x, z, ry, 2.90, 2.90, body, trim);
        add(0, (WORLD_SCALE.tableHeight - 0.09) / 2, 0, 0.16, WORLD_SCALE.tableHeight - 0.09, 0.16, trim);
        break;
      }
      case 'flower-pot': {
        add(0, 0.20, 0, 0.48, 0.40, 0.48, body);
        add(0, 0.43, 0, 0.42, 0.10, 0.42, 0x3b3023);
        const plant=structure.flower?.plant;
        if(plant){
          const height=.16+.24*Math.floor(plant.growth*4)/4;
          for (const [dx, dz] of [[0, 0], [-0.16, 0.08], [0.16, 0.08], [0, -0.16]]) add(dx, .43+height/2, dz, .17, height, .17, plant.hitPoints>0?0x54733d:0x796641);
        }
        break;
      }
    }
  }
  return parts;
}

const HABITAT_KINDS = new Set([
  'shelf','small-shelf',
  'dining-chair', 'armchair', 'couch', 'end-table', 'dresser', 'table-square', 'table-long', 'table-large', 'flower-pot',
]);

function footprintCenter(structure: Structure): { x: number; z: number } {
  const { minX, maxX, minZ, maxZ } = footprintBounds(structure);
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}

function footprintBounds(structure: Structure): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const cells = footprintCells(structure);
  let minX = cells[0]!.x, maxX = minX, minZ = cells[0]!.z, maxZ = minZ;
  for (let index = 1; index < cells.length; index++) {
    const cell = cells[index]!;
    minX = Math.min(minX, cell.x); maxX = Math.max(maxX, cell.x);
    minZ = Math.min(minZ, cell.z); maxZ = Math.max(maxZ, cell.z);
  }
  return { minX, maxX, minZ, maxZ };
}

function table(parts: Placement[], structure: Structure, x: number, z: number, ry: number, width: number, depth: number, body: number, trim: number): void {
  const cos = Math.cos(ry), sin = Math.sin(ry), height = WORLD_SCALE.tableHeight;
  const add = (localX: number, y: number, localZ: number, sx: number, sy: number, sz: number, color = body): void => {
    parts.push({targetId:structure.id, key: structure.id, x: x + localX * cos + localZ * sin, y, z: z + localZ * cos - localX * sin, sx, sy, sz, ry, color });
  };
  add(0, height - 0.045, 0, width, 0.09, depth);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) add(dx * (width / 2 - 0.10), (height - 0.09) / 2, dz * (depth / 2 - 0.10), 0.10, height - 0.09, 0.10, trim);
}

function shade(color: number, factor: number): number {
  const red = Math.round(((color >> 16) & 0xff) * factor);
  const green = Math.round(((color >> 8) & 0xff) * factor);
  const blue = Math.round((color & 0xff) * factor);
  return (red << 16) | (green << 8) | blue;
}


/** Same authored iteration and FP order; no World or resident state. */
export function habitatPartsForStructure(structure: Structure): Placement[] {
  const parts: Placement[] = [];
  const kind = structure.kind as string;
  if (!HABITAT_KINDS.has(kind)) return parts;
  const { x, z } = footprintCenter(structure);
  const ry = structure.orientation * Math.PI / 2;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const body = buildingMaterialColor(structure.material, 0xa38559) ?? 0xa38559;
  const trim = structure.material === 'steel' ? 0x64747a : shade(body, 0.72);
  const add = (localX: number, y: number, localZ: number, sx: number, sy: number, sz: number, color = body): void => {
    parts.push({targetId:structure.id,
      key: structure.id,
      x: x + localX * cos + localZ * sin,
      y,
      z: z + localZ * cos - localX * sin,
      sx,
      sy,
      sz,
      ry,
      color,
    });
  };
  switch (kind) {
    case 'shelf':case 'small-shelf': parts.push(...shelfParts(structure,body,trim));break;
    case 'dining-chair': {
      const seat = WORLD_SCALE.stoolHeight + 0.03;
      add(0, seat, 0, 0.62, 0.10, 0.62);
      for (const dx of [-0.23, 0.23]) for (const dz of [-0.23, 0.23]) add(dx, seat / 2, dz, 0.08, seat, 0.08, trim);
      // Orientation zero faces +z; the backrest belongs behind that face.
      add(0, 0.66, -0.25, 0.58, 0.42, 0.08, trim);
      break;
    }
    case 'armchair': {
      const seat = 0.37;
      add(0, seat, 0.03, 0.78, 0.14, 0.78, trim);
      for (const dx of [-0.31, 0.31]) add(dx, 0.53, 0.04, 0.15, 0.36, 0.72);
      for (const dx of [-0.29, 0.29]) for (const dz of [-0.28, 0.28]) add(dx, seat / 2, dz, 0.10, seat, 0.10, trim);
      add(0, 0.69, -0.31, 0.76, 0.50, 0.12, trim);
      break;
    }
    case 'couch': {
      const seat = 0.37;
      add(0, seat, 0.03, 1.78, 0.14, 0.78, trim);
      for (const dx of [-0.45, 0.45]) add(dx, 0.47, 0.06, 0.84, 0.08, 0.66);
      for (const dx of [-0.91, 0.91]) add(dx, 0.53, 0.04, 0.15, 0.36, 0.72);
      for (const dx of [-0.82, 0.82]) for (const dz of [-0.28, 0.28]) add(dx, seat / 2, dz, 0.10, seat, 0.10, trim);
      add(0, 0.69, -0.31, 1.76, 0.50, 0.12, trim);
      break;
    }
    case 'end-table': {
      const height = WORLD_SCALE.tableHeight - 0.05;
      add(0, height, 0, 0.76, 0.10, 0.76);
      for (const dx of [-0.29, 0.29]) for (const dz of [-0.29, 0.29]) add(dx, height / 2, dz, 0.09, height, 0.09, trim);
      add(0, height * 0.53, 0.29, 0.49, 0.13, 0.05, trim);
      break;
    }
    case 'dresser': {
      const width = 1, depth = 2;
      const cabinetWidth = Math.max(0.80, width - 0.13);
      const cabinetDepth = Math.max(0.54, depth - 0.17);
      add(0, 0.46, 0, cabinetWidth, 0.92, cabinetDepth, trim);
      add(0, 0.95, 0, cabinetWidth + 0.07, 0.09, cabinetDepth + 0.07);
      // The 1×2 cabinet opens along its long side, not its narrow end.
      for (const y of [0.27, 0.52, 0.76]) add(cabinetWidth / 2 + 0.004, y, 0, 0.04, 0.025, cabinetDepth - 0.12, body);
      for (const y of [0.27, 0.52, 0.76]) for (const dz of [-0.36, 0.36]) add(cabinetWidth / 2 + 0.035, y, dz, 0.045, 0.045, 0.045, 0xc4b794);
      break;
    }
    case 'table-square': {
      table(parts, structure, x, z, ry, 1.70, 1.70, body, trim);
      break;
    }
    case 'table-long': {
      table(parts, structure, x, z, ry, 1.92, 3.92, body, trim);
      break;
    }
    case 'table-large': {
      table(parts, structure, x, z, ry, 2.90, 2.90, body, trim);
      add(0, (WORLD_SCALE.tableHeight - 0.09) / 2, 0, 0.16, WORLD_SCALE.tableHeight - 0.09, 0.16, trim);
      break;
    }
    case 'flower-pot': {
      add(0, 0.20, 0, 0.48, 0.40, 0.48, body);
      add(0, 0.43, 0, 0.42, 0.10, 0.42, 0x3b3023);
      const plant=structure.flower?.plant;
      if(plant){
        const height=.16+.24*Math.floor(plant.growth*4)/4;
        for (const [dx, dz] of [[0, 0], [-0.16, 0.08], [0.16, 0.08], [0, -0.16]]) add(dx, .43+height/2, dz, .17, height, .17, plant.hitPoints>0?0x54733d:0x796641);
      }
      break;
    }
  }
  return parts;
}
