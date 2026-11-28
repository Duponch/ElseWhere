import type { Cell } from './types.ts';

export const LINE_BUILD_KINDS = ['wall', 'fence', 'power-conduit', 'hidden-conduit'] as const;
export type LineBuildKind = typeof LINE_BUILD_KINDS[number];
export const isLineBuildKind = (kind: unknown): kind is LineBuildKind =>
  LINE_BUILD_KINDS.includes(kind as LineBuildKind);

/** Core-style straight stroke: the longer pointer axis decides the line. */
export function constructionLineCells(from: Cell, to: Cell): Cell[] {
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.z - from.z);
  const length = horizontal ? Math.abs(to.x - from.x) : Math.abs(to.z - from.z);
  const step = Math.sign(horizontal ? to.x - from.x : to.z - from.z);
  return Array.from({ length: length + 1 }, (_, index) => horizontal
    ? { x: from.x + index * step, z: from.z }
    : { x: from.x, z: from.z + index * step });
}
