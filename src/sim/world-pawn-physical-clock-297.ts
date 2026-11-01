import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import type {CampaignState} from './world-map-state.ts';
import type {WorldPawnsState256,WorldPawnOwner256} from './world-pawn-state-256.ts';
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function ownedPhysical(value:object,version:number,civilCore:number):number {
 if(!integer(version,1,301)||!integer(civilCore)||civilCore%10)return NaN;
 if(!('physicalClockCore297'in value))return civilCore;
 const d=Object.getOwnPropertyDescriptor(value,'physicalClockCore297');
 return isCorePhysicalSchema297(version)&&!!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&integer(d.value,civilCore,civilCore+9)?d.value:NaN;
}
/** Registry physical frontier; not a second clinical/macro advance. */
export function worldPawnsPhysicalCore297(state:WorldPawnsState256,version:number):number {return ownedPhysical(state,version,state.atCore);}
/** A frozen/away owner supplies its OWN captured phase, never the root's. */
export function worldPawnPhysicalCore297(row:WorldPawnOwner256,version:number):number {return ownedPhysical(row,version,row.clockCore);}
/** Root core transaction only. Invoke after setting the next actual phase,
 * BEFORE a boundary's global macro prefix. A boundary header is transiently
 * +10 above old atCore until the prefix commits; never publish/save there. */
export function syncWorldPawnsPhysicalCore297(root:CampaignState):void {
 if(!isCorePhysicalSchema297(Number(root.schemaVersion)))return;
 const state=root.worldPawns;if(!state)return;const target=effectiveCore297(root),prior=worldPawnsPhysicalCore297(state,297);
 if(!integer(prior)||target!==prior+1||Math.floor(target/10)*10!==state.atCore&&target!==state.atCore+10)throw Error('WorldPawns physical frontier skipped or duplicated');
 state.physicalClockCore297=target;
}