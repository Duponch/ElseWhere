import {schemaAtLeast} from './schema-range.ts';

/** Schema 368: the Pyromaniac trait, its Firefighting disable and its
 * fire-starting spree (fire-spree-368, pyromaniac-thought-368). A light
 * module: the save readers need only the gate and the bounds. */
export const PYROMANIAC_SCHEMA_368=368;
export const isPyromaniac368=schemaAtLeast(PYROMANIAC_SCHEMA_368);
/** The Ignite native verb (VerbDefsHardcodedNative): warmup 3 s, default
 * cooldown 1.3 s (GenTicks.SecondsToTicks), fire size 0.3 (Verb_Ignite). */
export const IGNITE_WARMUP_CORE_368=180,IGNITE_COOLDOWN_CORE_368=78,IGNITE_FIRE_SIZE_368=.3;
/** The longest Ignite stance: the warmup of a careful shooter (x1.25). */
export const IGNITE_STANCE_MAX_CORE_368=225;
/** Pawn_JobTracker.EndCurrentJob(ErroredPather): a Wait job of 250 ticks. */
export const ERRORED_PATHER_WAIT_LOCAL_368=25;
