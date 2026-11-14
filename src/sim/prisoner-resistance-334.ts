import type {RaidRole} from './raid-state.ts';

/** Schema 334: Core `initialResistanceRange` of every raid pawn kind Elsewhere
 * generates (PawnKindDefs_Humanlikes, inherited values resolved). The
 * resistance of a captured raider is drawn in its kind's range, then rounded
 * at random (Pawn_GuestTracker.SetGuestStatus, GenMath.RoundRandom). */
export const RAID_KIND_RESISTANCE_334:Readonly<Record<RaidRole,readonly [number,number]>>=Object.freeze({
  drifter:[7,12],thrasher:[14,23],scavenger:[17,26],pirate:[7,12],
  'tribal-penitent':[10,17],'tribal-warrior':[5,9],'tribal-archer':[17,27],'tribal-hunter':[10,16],'tribal-heavy-archer':[14,22],
  'tribal-berserker':[13,20],'tribal-chief-ranged':[16,26],'tribal-chief-melee':[38,58],
  villager:[10,17],'town-guard':[15,24],'mercenary-gunner':[6,10],'town-councilman':[7,11],
});
export const isResistanceKind334=(value:unknown):value is RaidRole=>typeof value==='string'&&Object.hasOwn(RAID_KIND_RESISTANCE_334,value);
/** Without a recorded kind, the historical Drifter range. */
export const DEFAULT_RESISTANCE_334:readonly [number,number]=Object.freeze([7,12] as const);
/** The integer bounds of a drawn initial resistance. */
export const resistanceBounds334=(kind:unknown):readonly [number,number]=>isResistanceKind334(kind)?RAID_KIND_RESISTANCE_334[kind]:DEFAULT_RESISTANCE_334;
