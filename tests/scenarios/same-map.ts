import type { World } from '../../src/sim/types.ts';

/** A campaign root and the view of its loaded map are distinct objects that
 * share the same map data (tiles, piles, pawns...). The simulation may hand a
 * probe either one. A fork, a copy or a reloaded world always has its own
 * tiles, so the tiles array identifies the map. */
export const sameMapWorld=(a:World|null|undefined,b:World|null|undefined):boolean=>
  !!a&&!!b&&(a===b||Array.isArray(a.tiles)&&a.tiles===b.tiles);
