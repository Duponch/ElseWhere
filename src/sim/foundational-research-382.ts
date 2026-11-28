import type {ResearchState} from './research.ts';
import type {World} from './types.ts';

/** Core ResearchProjectDefs, electricity (Industrial, ClassicStart) and
 * passive cooler (Neolithic, ClassicStart and TribalStart). Point amounts
 * use the simulation's existing millionth-of-a-research-point precision. */
export const ELECTRICITY_COST382=1_600_000_000;
export const PASSIVE_COOLER_COST382=400_000_000;
export type FoundationalProject382='electricity'|'passive-cooler';
export const isFoundationalProject382=(value:unknown):value is FoundationalProject382=>value==='electricity'||value==='passive-cooler';

/** These two projects used to be always unlocked. Historical owners keep
 * that ability when migrated. A cold RWS import never uses this grant. */
export function grantFoundationalResearch382(state:ResearchState|undefined):void {
 if(!state)return;
 state.electricity??={points:ELECTRICITY_COST382,completedAt:0};
 state.passiveCooler??={points:PASSIVE_COOLER_COST382,completedAt:0};
}
// Local historical sandboxes with no research owner retain their old gates.
// Actual imported records distinguish a zero-point project from an unlocked
// one; research-bearing historical saves receive explicit grants on migration.
type ResearchOwner=Pick<World,'schemaVersion'|'research'>;
export const electricityUnlocked382=(w:ResearchOwner):boolean=>w.schemaVersion<382||w.research?.electricity===undefined&&w.research?.passiveCooler===undefined||w.research?.electricity?.completedAt!==undefined;
export const passiveCoolerUnlocked382=(w:ResearchOwner):boolean=>w.schemaVersion<382||w.research?.electricity===undefined&&w.research?.passiveCooler===undefined||w.research?.passiveCooler?.completedAt!==undefined;

/** Actual buildable definitions with direct Electricity/PassiveCooler
 * requirements, including LampBase and PowerConduit inheritance. These are
 * independent from the prerequisites of other research projects. Existing
 * finished/recovered Things keep their use and reinstall rights. */
export function foundationalBuildProject382(kind:unknown):FoundationalProject382|undefined {
 switch(kind){
  case 'passive-cooler':return 'passive-cooler';
  case 'power-conduit':case 'hidden-conduit':case 'power-switch':case 'wood-generator':case 'chemfuel-generator':case 'wind-turbine':
  case 'standing-lamp':case 'sun-lamp':case 'wall-lamp':case 'heater':case 'electric-tailor-bench':case 'electric-smithy':case 'electric-stove':case 'electric-smelter':case 'electric-crematorium':return 'electricity';
  default:return undefined;
 }
}
