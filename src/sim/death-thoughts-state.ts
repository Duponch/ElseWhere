/** Human identity references survive burial, destruction and departure. */
export type DeathThoughtKind='witnessed-ally-death'|'witnessed-outsider-death'|'witnessed-family-death'|'witnessed-bloodlust-death'|'colonist-died'|'observed-corpse'|'observed-rotting-corpse'|'guest-executed'|'killed-humanlike-bloodlust';
export interface DeathThoughtMemory {kind:DeathThoughtKind;otherId:number;at:number;suspendedTicks?:number}
