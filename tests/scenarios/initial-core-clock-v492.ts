import {isCorePhysicalSchema297} from '../../src/sim/physical-schema-297';
import {validCoreMoveHistoricalTransport297} from '../../src/sim/core-move-save-297';
import {newCorePathBudget297} from '../../src/sim/core-path-budget-297';
import type {World} from '../../src/sim/types';

/** Declared fixture initialization only, before commands, ticking or ownership capture.
 * Never use this on a saved/live World or to reset credits after playing phase1..9. */
function assertUnplayedFixture(w:World,continuedPhysical=false):void {
 const b=w.corePathBudget297;
 if((continuedPhysical?!isCorePhysicalSchema297(Number(w.schemaVersion)):Number(w.schemaVersion)!==297)||w.tick!==0||w.phaseCore297!==0||!b||b.tick!==0||b.remaining!==8||b.pairs!==32768)
  throw Error('Expected an unplayed phase-zero fixture with untouched owned budget');
 if(w.pawns.some(p=>p.motion!==undefined||p.draft!==undefined||p.shooting!==undefined||p.melee!==undefined))
  throw Error('A commanded or captured actor is not an initial fixture');
}
/** Existing fixtures deliberately begin at civil3000; initialize their new local
 * owner at the same instant. No clock catch-up, played time, RNG or clinical repair. */
export function initializeDeclaredFixtureTick297(w:World,tick:number):void {
 assertUnplayedFixture(w,true);
 if(!Number.isSafeInteger(tick)||tick<0)throw Error('Invalid declared initial tick');
 w.tick=tick;w.corePathBudget297=newCorePathBudget297(tick);
}
/** Only the initial generated prototype is declared legacy, before its first
 * command or edge. A played/migrated297 World is never downgraded. All other
 * prospective metadata is refused rather than recursively erased. */
export function declareUnplayedFixture296(w:World):void {
 assertUnplayedFixture(w);
 const staged={...w};delete staged.phaseCore297;delete staged.corePathBudget297;
 if(!validCoreMoveHistoricalTransport297(staged,296))throw Error('Unexpected prospective metadata in declared296 fixture');
 delete w.phaseCore297;delete w.corePathBudget297;
 (w as unknown as {schemaVersion:number}).schemaVersion=296;
}
