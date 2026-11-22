import { STRUCTURE_DEFINITIONS } from '../sim/definitions';
import { furnitureObject } from '../sim/furniture-rules';
import type { Job, World } from '../sim/types';
import { ConstructionPreviewLayer } from './ConstructionPreviewLayer';
import { constructionGhostParts, GHOST_CONTEXT_REACH, type ConstructionPreviewParts, type ConstructionPreviewPlacement, type ConstructionPreviewSpec } from './construction-preview-parts';

/** The ghost spec of a construction job: its future building (or the packed
 * one being installed), floor or bridge, at its anchor and orientation. Orders
 * that build nothing (mining, cutting, removal, repair, roofs) have none. */
export function constructionGhostSpec(job: Job, world: World): ConstructionPreviewSpec | undefined {
  if (job.kind === 'lay-floor') return job.floor ? { key: job.id, kind: 'lay-floor', floor: job.floor, x: job.x, z: job.z } : undefined;
  if (job.kind === 'build-bridge') return { key: job.id, kind: 'build-bridge', x: job.x, z: job.z };
  if (job.kind === 'install') {
    const target = job.furniture; if (!target || !Object.hasOwn(STRUCTURE_DEFINITIONS, target.kind)) return undefined;
    const furniture = furnitureObject(world, target.structureId);
    return { key: job.id, kind: target.kind, x: job.x, z: job.z, orientation: job.orientation,
      ...(furniture && furniture.kind === target.kind ? { furniture } : {}) };
  }
  if (!Object.hasOwn(STRUCTURE_DEFINITIONS, job.kind)) return undefined;
  return { key: job.id, kind: job.kind as ConstructionPreviewSpec['kind'], x: job.x, z: job.z, orientation: job.orientation,
    footprint: job.footprint, ...(job.material ? { material: job.material } : {}) };
}

const specKey = (spec: ConstructionPreviewSpec): string =>
  `${spec.key}:${spec.kind}:${spec.x}:${spec.z}:${spec.orientation ?? ''}:${spec.material ?? ''}:${spec.floor ?? ''}:${spec.footprint ?? ''}:${spec.furniture ? `${spec.furniture.id}:${spec.furniture.material ?? ''}` : ''}`;

type GhostEntry = { signature: string; x: number; z: number; parts: ConstructionPreviewParts };
const emptyParts = (): ConstructionPreviewParts => ({ boxes: [], timberWalls: [], timberEaves: [], rotatedBoxes: [] });
/** Models link to what touches them (walls, fences, conduits, door axes:
 * within 2 cells) and a footprint reaches 6 cells from its anchor: a change
 * can alter the model of the ghosts anchored this close to it, which are drawn
 * again (the context they read reaches GHOST_CONTEXT_REACH cells). */
const GHOST_CHANGE_REACH = 8;

/** Resident ghosts of the placed constructions (blueprints and frames), drawn
 * with the placement cursor's models, tint and opacity. Construction progress
 * never rebuilds them; a change of the placed set draws again only the ghosts
 * near the change (one furniture capture), the others keep their parts. */
export class ConstructionGhosts {
  readonly layer = new ConstructionPreviewLayer(true);
  private signature = '';
  private entries = new Map<number, GhostEntry>();
  private cutaway: boolean | undefined;
  private mapKey = '';
  /** The parts last written (tests and benches read them). */
  parts: ConstructionPreviewParts = emptyParts();
  /** Ghosts drawn again by the last change (tests and benches read it). */
  redrawn = 0;
  get group() { return this.layer.group; }

  present(world: World | undefined, specs: readonly ConstructionPreviewSpec[], outline: readonly ConstructionPreviewPlacement[], cutaway: boolean): void {
    const keys = specs.map(specKey), signature = `${cutaway}|${keys.join('|')}|${outline.map(p => `${p.key}:${p.x}:${p.z}:${p.y}:${p.sx}:${p.sy}:${p.sz}`).join('|')}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const mapKey = world ? `${world.width}:${world.height}:${world.seed}` : '';
    const unique = specs.every(spec => spec.key !== undefined) && new Set(specs.map(spec => spec.key)).size === specs.length;
    if (!world || !unique || cutaway !== this.cutaway || mapKey !== this.mapKey) this.entries.clear();
    this.cutaway = cutaway; this.mapKey = mapKey;
    const next = new Map<number, GhostEntry>(), changed: { x: number; z: number }[] = [];
    if (world && unique) {
      specs.forEach((spec, i) => {
        const before = this.entries.get(spec.key!);
        if (before?.signature === keys[i]) next.set(spec.key!, before);
        else { changed.push(spec); if (before) changed.push(before); }
      });
      const placed = new Set(specs.map(spec => spec.key));
      for (const [key, entry] of this.entries) if (!placed.has(key)) changed.push(entry);
      const dirty = specs.filter(spec => !next.has(spec.key!) || changed.some(c => Math.max(Math.abs(c.x - spec.x), Math.abs(c.z - spec.z)) <= GHOST_CHANGE_REACH));
      const drawn = dirty.length ? constructionGhostParts(world, dirty, cutaway, GHOST_CONTEXT_REACH, specs) : emptyParts();
      const byKey = new Map<number, ConstructionPreviewParts>(dirty.map(spec => [spec.key!, emptyParts()]));
      for (const field of ['boxes', 'timberWalls', 'timberEaves', 'rotatedBoxes'] as const)
        for (const part of drawn[field]) byKey.get(part.key as number)?.[field].push(part);
      dirty.forEach(spec => next.set(spec.key!, { signature: specKey(spec), x: spec.x, z: spec.z, parts: byKey.get(spec.key!)! }));
      this.redrawn = dirty.length;
    } else this.redrawn = world ? specs.length : 0;
    this.entries = next;
    const parts = world && !unique && specs.length ? constructionGhostParts(world, specs, cutaway) : emptyParts();
    for (const spec of unique ? specs : []) {
      const own = next.get(spec.key!)!.parts;
      parts.boxes.push(...own.boxes); parts.timberWalls.push(...own.timberWalls); parts.timberEaves.push(...own.timberEaves); parts.rotatedBoxes.push(...own.rotatedBoxes);
    }
    if (outline.length) parts.boxes.push(...outline);
    this.parts = parts;
    this.layer.presentPlaced(parts);
  }

  clear(): void { this.signature = ''; this.entries.clear(); this.cutaway = undefined; this.mapKey = ''; this.parts = emptyParts(); this.layer.hide(); }
  /** Every part of every ghost, all geometries together. */
  allParts(): ConstructionPreviewPlacement[] { const p = this.parts; return [...p.boxes, ...p.timberWalls, ...p.timberEaves, ...p.rotatedBoxes]; }
  setTargetPreview(ids: ReadonlySet<number>): void { this.layer.setTargetPreview(ids); }
  clearTargetPreview(): void { this.layer.clearTargetPreview(); }
  prepareForCompile(): () => void { return this.layer.prepareForCompile(); }
  dispose(): void { this.layer.dispose(); }
}
