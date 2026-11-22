import type { Command, Pawn, WorkType, World } from '../sim/types';
import { backgroundWorkRefusal } from '../sim/colonist-backgrounds';
import { shownWorkPriority344 } from '../sim/work-tab-344';
import { storedPriority } from '../sim/work-types';

/* Copy and paste of a colonist's work priorities, as the Work tab column
 * PawnColumnWorker_CopyPasteWorkPriorities of Core 1.6.
 *
 * Copy reads, for every work type, the priority the tab shows
 * (Pawn_WorkSettings.GetPriority: 3 for any enabled work while the tab is
 * simple), and 0 for a work type the source cannot do. Paste sets each value
 * on the target, skipping the work types the target cannot do: they keep
 * their stored priority. Core keeps the copy in a static field that no game
 * change clears; here it lives in the interface only (never in the World or a
 * save), survives a change of map or of game, and is lost when the page is
 * reloaded. The paste sends the existing 'priority' command once per value
 * that differs from the stored one: setting a priority to its own value
 * changes nothing. */

let clipboard: ReadonlyMap<WorkType, number> | undefined;

export const hasWorkPriorityClipboard = (): boolean => clipboard !== undefined;
export function clearWorkPriorityClipboard(): void { clipboard = undefined; }
/** The copied value of one work type (undefined without a copy). */
export const workPriorityClipboardValue = (work: WorkType): number | undefined => clipboard?.get(work);

/** Smithing and Tailoring have their own priority (and command) from schema 302;
 * before, they follow Crafting. */
const settable = (world: Pick<World, 'schemaVersion'>, work: WorkType): boolean => Number(world.schemaVersion) >= 302 || (work !== 'smith' && work !== 'tailor');

export function copyWorkPriorities(pawn: Pick<Pawn, 'priorities' | 'background'>, works: readonly WorkType[], simple: boolean): void {
  clipboard = new Map(works.map(work => [work, backgroundWorkRefusal(pawn, work) ? 0 : shownWorkPriority344(pawn, work, simple)]));
}

export interface WorkPriorityChange { work: WorkType; value: number; previous: number }
/** The 'priority' commands a paste on this pawn sends, in work type order. */
export function workPriorityPastePlan(world: Pick<World, 'schemaVersion'>, pawn: Pick<Pawn, 'priorities' | 'background'>, works: readonly WorkType[]): WorkPriorityChange[] {
  const copy = clipboard; if (!copy) return [];
  const changes: WorkPriorityChange[] = [];
  for (const work of works) {
    const value = copy.get(work);
    if (value === undefined || !settable(world, work) || backgroundWorkRefusal(pawn, work)) continue;
    const previous = storedPriority(pawn, work);
    if (previous !== value) changes.push({ work, value, previous });
  }
  return changes;
}

/** Sends the plan in order. On a refusal, the values already changed are set
 * back (best effort, reverse order) and the refusal is thrown. */
export async function pasteWorkPriorities(send: (command: Command) => Promise<unknown>, pawnId: number, changes: readonly WorkPriorityChange[]): Promise<number> {
  const done: WorkPriorityChange[] = [];
  try {
    for (const change of changes) { await send({ type: 'priority', pawnId, work: change.work, value: change.value }); done.push(change); }
  } catch (cause) {
    for (const change of done.reverse()) { try { await send({ type: 'priority', pawnId, work: change.work, value: change.previous }); } catch { /* the refusal below is reported */ } }
    throw Error(`Collage des priorités refusé : ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  return changes.length;
}
