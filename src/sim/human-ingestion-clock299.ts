import {effectiveCore297} from './core-phase-297.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import type {MaterialPile,Pawn,World} from './types.ts';

/** Missing history stays unknown. Prepare before removal; commit only after
 * real consumption. Neither operation changes nutrition, quantities or PRNG. */
function checkedCore(pawn:Pawn,atCore:number):number {
 const prior=pawn.lastIngestAtCore299;
 if(!Number.isSafeInteger(atCore)||atCore<0||prior!==undefined&&(!Number.isSafeInteger(prior)||prior<0||prior>atCore))throw Error('Invalid human ingestion frontier299');
 return atCore;
}
export function localIngestionCore299(world:World,pawn:Pawn):number|undefined {
 if(Number(world.schemaVersion)!==299)return;
 if(!world.pawns.includes(pawn))throw Error('Ingestion requires its actual local person299');
 return checkedCore(pawn,effectiveCore297(world));
}
export function offMapIngestionCore299(world:World,pawn:Pawn):number|undefined {
 if(Number(world.schemaVersion)!==299)return;
 if(!(world.scout&&'pawn'in world.scout&&world.scout.pawn===pawn)&&!(world.commercialTrip&&'pawn'in world.commercialTrip&&world.commercialTrip.pawn===pawn))throw Error('Ingestion requires its actual traveller299');
 return checkedCore(pawn,effectiveCore297(world));
}
export function groupIngestionCore299(group:{members:readonly Pawn[];lastPersonalTick:number},pawn:Pawn,version:number,tick:number,core:number|undefined):number|undefined {
 if(Number(version)!==299)return;
 // A fine caravan interval has a CEIL civil envelope. Only its actual supplied
 // endpoint is recorded; the selected Map never lends its frontier.
 if(!group.members.includes(pawn)||group.lastPersonalTick!==tick||!Number.isSafeInteger(tick)||tick<0||typeof core!=='number'||!Number.isSafeInteger(core)||core<0||Math.ceil(core/10)!==tick)throw Error('Ingestion requires its actual group frontier299');
 return checkedCore(pawn,core);
}
export function commitHumanIngestion299(pawn:Pawn,preparedCore:number|undefined):void {
 if(preparedCore!==undefined)pawn.lastIngestAtCore299=preparedCore;
}
/** This gates the compulsive provider, never ordinary hunger/current chewing. */
export function foodBingeDue299(world:World,pawn:Pawn):boolean {
 if(Number(world.schemaVersion)!==299||pawn.mental?.crisis?.kind!=='food-binge')return true;
 const now=checkedCore(pawn,effectiveCore297(world));
 return pawn.lastIngestAtCore299===undefined||now-pawn.lastIngestAtCore299>1100;
}
/** Provider resolves this option once; task retains it. No schema/crisis read
 * per pile. Existing social/prison/access guards remain at their call sites. */
export function selfFoodPermission299(pile:MaterialPile,ignoreForbidden=false):boolean {
 return ignoreForbidden||eggAllowedForPlayer256(pile);
}
