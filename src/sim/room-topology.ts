import {roomBarrierValue,roomBarrierCells} from './room-barriers.ts';
import type { World } from './types.ts';
import {peekStructureMembershipToken} from './structure-navigation.ts';
import { terrainWriteCount, verifyTerrainWriteCaches } from './terrain-mutation-journal.ts';

export interface RoomSpace {
  readonly kind: 'space';
  /** Derived from the first cell, valid only within this topology snapshot. */
  readonly id: number;
  readonly cellCount: number;
  readonly touchesMapEdge: boolean;
}
const SOLID = Object.freeze({ kind: 'solid' as const });
const DOORWAY = Object.freeze({ kind: 'doorway' as const });
export type RoomCell = RoomSpace | typeof SOLID | typeof DOORWAY;

/** Enclosures only: neither pathfinding nor an indoor/thermal/roof verdict. */
export class RoomTopology {
  readonly width: number;
  readonly height: number;
  private readonly labels: Int32Array;
  private readonly spaces: ReadonlyMap<number, RoomSpace>;
  constructor(
    width: number, height: number, labels: Int32Array, spaces: ReadonlyMap<number, RoomSpace>,
  ) { this.width = width; this.height = height; this.labels = labels; this.spaces = spaces; }

  allSpaces():Iterable<RoomSpace> { return this.spaces.values(); }

  at(x: number, z: number): RoomCell | undefined {
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= this.width || z >= this.height) return;
    const id = this.labels[z * this.width + x]!;
    return id === -1 ? SOLID : id === -2 ? DOORWAY : this.spaces.get(id);
  }
}

/** Caller-owned derived cache. Every read checks current barriers, including
 * in-place changes; never use tick or array identity as a topology revision.
 * Old returned snapshots remain valid after a rebuild. No per-frame work. */
export class RoomTopologyCache {
  private previous = new Uint8Array(0);
  private scratch = new Uint8Array(0);
  private queue = new Int32Array(0);
  private rocks = new Uint8Array(0);
  private barriers: number[] = [];
  private topology: RoomTopology | undefined;
  private barrierToken: object | undefined;
  private tileRefs: (World['tiles'][number] | undefined)[] = [];
  private scannedTiles?: World['tiles'];
  private scannedWrites = -1;

  read(world: Pick<World, 'width' | 'height' | 'tiles' | 'structures'>): RoomTopology {
    const { width, height } = world, size = width * height;
    const resized = this.topology?.width !== width || this.topology?.height !== height;
    if (this.scratch.length !== size) {
      this.previous = new Uint8Array(size);
      this.scratch = new Uint8Array(size);
      this.queue = new Int32Array(size);
      this.rocks = new Uint8Array(size);
      this.scannedTiles = undefined;
    }
    // Detect in-place edits without rebuilding/writing the full combined mask
    // at each read. Barrier order is captured because later objects win.
    let inputChanged = resized, count = 0;
    // Barrier codes depend only on structure kind/position/orientation, which
    // are immutable; an unchanged shared membership token (same array, same
    // members in the same order) therefore proves the codes are unchanged.
    // Only an existing index is used: building one just for the token costs
    // more than the barrier scan it would skip.
    const token = world.width === width && Array.isArray(world.structures) ? peekStructureMembershipToken(world as World) : undefined;
    if (!token || token !== this.barrierToken || resized) {
      for (const building of world.structures) {
        const value = roomBarrierValue(building.kind);
        if (!value) continue;
        for(const cell of roomBarrierCells(building)){
          const code = (cell.z * width + cell.x) * 3 + value;
          if (this.barriers[count] !== code) { this.barriers[count] = code; inputChanged = true; }
          count++;
        }
      }
      if (this.barriers.length !== count) { this.barriers.length = count; inputChanged = true; }
      this.barrierToken = token;
    }
    // Tile objects never change `terrain` in place (terrain edits replace the
    // Tile), so only replaced tiles need their rock bit re-read.
    if (this.tileRefs.length !== size) { this.tileRefs = new Array(size); this.scannedTiles = undefined; }
    const tiles = world.tiles, refs = this.tileRefs, writes = terrainWriteCount(tiles);
    // Same Tile[] and write count: no tile was replaced since the last scan.
    const unchanged = tiles === this.scannedTiles && writes === this.scannedWrites && tiles.length === size;
    if (!unchanged || verifyTerrainWriteCaches) {
      for (let i = 0; i < size; i++) {
        const tile = tiles[i]!;
        if (refs[i] === tile) continue;
        if (unchanged) throw Error('Unmarked terrain write under an unchanged Tile[] count');
        refs[i] = tile;
        const value = tile.terrain === 'rock' ? 1 : 0;
        if (this.rocks[i] !== value) { this.rocks[i] = value; inputChanged = true; }
      }
      this.scannedTiles = tiles; this.scannedWrites = writes;
    }
    if (!inputChanged) return this.topology!;
    const mask = this.scratch;
    mask.set(this.rocks);
    for (const code of this.barriers) mask[Math.floor(code / 3)] = code % 3;
    // Different inputs may still produce exactly the same enclosure.
    let changed = resized;
    for (let i = 0; !changed && i < size; i++) changed = mask[i] !== this.previous[i];
    if (!changed) return this.topology!;

    const labels = new Int32Array(size), spaces = new Map<number, RoomSpace>();
    for (let i = 0; i < size; i++) if (mask[i]) labels[i] = -mask[i]!;
    const queue = this.queue;
    for (let root = 0; root < size; root++) {
      if (labels[root]) continue;
      const id = root + 1;
      let head = 0, tail = 1, touchesMapEdge = false;
      queue[0] = root; labels[root] = id;
      while (head < tail) {
        const index = queue[head++]!, x = index % width, z = Math.floor(index / width);
        if (x === 0 || z === 0 || x === width - 1 || z === height - 1) touchesMapEdge = true;
        if (x > 0 && !labels[index - 1]) { labels[index - 1] = id; queue[tail++] = index - 1; }
        if (x + 1 < width && !labels[index + 1]) { labels[index + 1] = id; queue[tail++] = index + 1; }
        if (z > 0 && !labels[index - width]) { labels[index - width] = id; queue[tail++] = index - width; }
        if (z + 1 < height && !labels[index + width]) { labels[index + width] = id; queue[tail++] = index + width; }
      }
      spaces.set(id, Object.freeze({ kind: 'space', id, cellCount: tail, touchesMapEdge }));
    }
    this.scratch = this.previous; this.previous = mask;
    return this.topology = new RoomTopology(width, height, labels, spaces);
  }
}
