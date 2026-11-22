import type { BillSettings, CookingBill } from '../sim/cooking-types';
import type { BillWorkerPolicy283 } from '../sim/bill-worker-state-283';
import type { BillReservePausePolicy289 } from '../sim/bill-pause-state-289';
import type { Command, Structure, World } from '../sim/types';
import { PRODUCTION_RECIPES, stationAccepts, type ProductionRecipe } from '../sim/production-recipes';
import { productionResearchUnlocked } from '../sim/machining';

/* Copy and paste of a production bill, as BillUtility.Clipboard in Core 1.6.
 *
 * Core keeps one copied bill in a static field (Bill.Clone): recipe,
 * suspended, ingredient filter, ingredient radius, allowed skill range, pawn
 * restriction, repeat mode and counts, store mode, pause when satisfied and
 * its threshold, apparel counting (equipped, hit points, quality), and the
 * acquired pause. ITab_Bills pastes a fresh clone (new identity) on a bench
 * whose recipes include the copied one, only while that bench has fewer than
 * BillStack.MaxCount bills. The field is cleared with the maps and the world
 * (MemoryUtility.ClearAllMapsAndWorld), so a map change keeps it.
 *
 * Here the clipboard lives in the interface only, never in the World or a
 * save: it survives a change of map inside one game, is dropped when another
 * game is created or loaded (a different session epoch), and is lost when the
 * page is reloaded. The paste sends existing commands in order (add, then the
 * settings, the reserve pause and the worker policy); any refusal after the
 * add removes the added bill again, so a paste is complete or absent. No
 * command sets the acquired pause: the pasted bill re-reads it from the real
 * stock, as every reserve-pause setting does. */

/** BillStack.MaxCount: Core greys the paste button and hides « Add bill » from
 * this many bills on one bench. The simulation keeps its own hard limit. */
export const BILL_STACK_MAX_COUNT = 15;

export interface BillClipboard {
  readonly epoch: number | undefined;
  readonly recipe: ProductionRecipe;
  readonly settings: BillSettings;
  readonly worker?: BillWorkerPolicy283;
  readonly pause?: BillReservePausePolicy289;
}
export interface BillPasteHost {
  /** Sends one command and throws when it is refused. */
  send(command: Command): Promise<unknown>;
  /** The confirmed World after the last acknowledged command. */
  readWorld(): World | undefined;
}

let clipboard: BillClipboard | undefined;

/** The copied bill of this game, if any. A copy from another game is dropped. */
export function billClipboard(epoch: number | undefined): BillClipboard | undefined {
  if (clipboard && clipboard.epoch !== epoch) clipboard = undefined;
  return clipboard;
}
export function clearBillClipboard(): void { clipboard = undefined; }

/** Bill.Clone of a confirmed bill (never an unapplied draft). */
export function copyBillToClipboard(bill: CookingBill, epoch: number | undefined): BillClipboard {
  const { id: _id, recipe, worker, reservePause, ...settings } = bill;
  clipboard = {
    epoch, recipe, settings: structuredClone(settings),
    ...(worker ? { worker: { pawnId: worker.pawnId, skillMin: worker.skillMin, skillMax: worker.skillMax } } : {}),
    ...(reservePause ? { pause: { enabled: reservePause.enabled, resumeAt: reservePause.resumeAt } } : {}),
  };
  return clipboard;
}

/** ITab_Bills: the copied recipe must be one of this bench's recipes and
 * available (research), and the bench must hold fewer than 15 bills. */
export function billPasteRefusal(world: Pick<World, 'schemaVersion' | 'research'>, station: Pick<Structure, 'kind' | 'bills'>, copy: Pick<BillClipboard, 'recipe'>): string | undefined {
  if (!stationAccepts(station, copy.recipe)) return 'Ce poste ne fait pas cette recette.';
  if (!productionResearchUnlocked(world, copy.recipe)) return 'La recherche préalable de cette recette n’est pas terminée.';
  if ((station.bills?.length ?? 0) >= BILL_STACK_MAX_COUNT) return `Ce poste a déjà ${BILL_STACK_MAX_COUNT} factures, le maximum par poste.`;
  return undefined;
}

const reason = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

/** Pastes the copied bill on one bench and returns the message to show. */
export async function pasteBillFromClipboard(host: BillPasteHost, structureId: number, epoch: number | undefined): Promise<string> {
  const copy = billClipboard(epoch);
  if (!copy) throw Error('Aucune facture copiée dans cette partie.');
  const world = host.readWorld(), station = world?.structures.find(s => s.id === structureId);
  if (!world || !station?.bills) throw Error('Poste de production introuvable.');
  const refusal = billPasteRefusal(world, station, copy);
  if (refusal) throw Error(refusal);
  const before = new Set(station.bills.map(bill => bill.id));
  await host.send({ type: 'bill-add', structureId, recipe: copy.recipe });
  // The add appends one bill; its identity is read from the confirmed World.
  const added = host.readWorld()?.structures.find(s => s.id === structureId)?.bills?.filter(bill => !before.has(bill.id) && bill.recipe === copy.recipe).at(-1);
  if (!added) throw Error('La facture ajoutée n’est pas encore visible : vérifiez ce poste avant de coller à nouveau.');
  const billId = added.id;
  let note = '';
  try {
    await host.send({ type: 'bill-update', structureId, billId, settings: structuredClone(copy.settings) });
    if (copy.pause) await host.send({ type: 'bill-pause-policy', structureId, billId, policy: { enabled: copy.pause.enabled, resumeAt: copy.pause.resumeAt } });
    if (copy.worker) {
      const policy = { pawnId: copy.worker.pawnId, skillMin: copy.worker.skillMin, skillMax: copy.worker.skillMax };
      try { await host.send({ type: 'bill-worker-policy', structureId, billId, policy }); }
      catch (cause) {
        if (policy.pawnId === null) throw cause;
        // Bill.ValidateSettings also clears an unavailable person from the
        // clipboard itself; the skill range is kept.
        clipboard = { ...copy, worker: { ...policy, pawnId: null } };
        await host.send({ type: 'bill-worker-policy', structureId, billId, policy: { ...policy, pawnId: null } });
        note = ' La personne désignée n’est plus disponible : la facture collée accepte quiconque, la plage de compétence est conservée.';
      }
    }
  } catch (cause) {
    let removed = true;
    try { await host.send({ type: 'bill-remove', structureId, billId }); } catch { removed = false; }
    throw Error(removed ? `Collage refusé, la facture ajoutée a été retirée : ${reason(cause)}` : `Collage incomplet : ${reason(cause)} Supprimez la facture ${billId} de ce poste.`);
  }
  return `Facture collée : ${PRODUCTION_RECIPES[copy.recipe].label}.${note}`;
}
