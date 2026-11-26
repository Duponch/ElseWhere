/** Physical component fields, in canonical publication order. The source
 * owner and the public representation reader share this single declaration. */
export const CORE_HUMAN_REQUIRED297=['x','z','state','moveCooldown','planCooldown','path'] as const;
export const CORE_HUMAN_OPTIONAL297=['motion','draft','shooting','melee','stun','stagger','arrivalRotation','transitExit','lastAttack'] as const;
export const CORE_ANIMAL_REQUIRED297=['x','z','state','path','nextDecision'] as const;
export const CORE_ANIMAL_OPTIONAL297=['motion','stun','stagger','strike','threat','retaliation','predation','flee','arrivalRotation','manhunter','sleepUntilCore'] as const;
export const CORE_MECH_REQUIRED297=['x','z','state','path','heading','moveCooldown','planCooldown'] as const;
export const CORE_MECH_OPTIONAL297=['motion','melee','ranged','stun','stagger','emp','meleeThreat'] as const;
