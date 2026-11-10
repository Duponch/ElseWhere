import type {AudioCue} from './audio-cues';
import type {Pawn,Cell,World,Job} from '../sim/types';
import type {PawnTrack} from './motion-tracks';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import type {PresentationSegment} from '../sim/travel-timing';

/** Shape only. None of these values grants native admission, World ownership
 * or a renderer capability. The first private trusted-Worker listener alone
 * may redeem one event/source receipt and publish a branded renderer input. */
export const CORE_HUMAN_REQUIRED297=['x','z','state','moveCooldown','planCooldown','path'] as const;
export const CORE_HUMAN_OPTIONAL297=['motion','draft','shooting','melee','stun','stagger','arrivalRotation','transitExit','lastAttack'] as const;
export const CORE_ANIMAL_REQUIRED297=['x','z','state','path','nextDecision'] as const;
export const CORE_ANIMAL_OPTIONAL297=['motion','stun','stagger','strike','threat','retaliation','predation','flee','arrivalRotation','manhunter','sleepUntilCore'] as const;
export const CORE_MECH_REQUIRED297=['x','z','state','path','heading','moveCooldown','planCooldown'] as const;
export const CORE_MECH_OPTIONAL297=['motion','melee','ranged','stun','stagger','emp','meleeThreat'] as const;

type Fields<A,R extends readonly(keyof A)[],O extends readonly(keyof A)[]>=Pick<A,R[number]|O[number]>;
export type CoreHumanFields297=Fields<Pawn,typeof CORE_HUMAN_REQUIRED297,typeof CORE_HUMAN_OPTIONAL297>;
export type CoreAnimalFields297=Fields<WildAnimal,typeof CORE_ANIMAL_REQUIRED297,typeof CORE_ANIMAL_OPTIONAL297>;
export type CoreMechFields297=Fields<Mechanoid,typeof CORE_MECH_REQUIRED297,typeof CORE_MECH_OPTIONAL297>;
/** index is the frozen anchor's population slot, never an insertion request. */
export type CoreActorProjection297=
 |{readonly kind:'human';readonly id:number;readonly index:number;readonly fields:CoreHumanFields297}
 |{readonly kind:'animal';readonly id:number;readonly index:number;readonly fields:CoreAnimalFields297}
 |{readonly kind:'mechanical';readonly id:number;readonly index:number;readonly fields:CoreMechFields297};

/** Presentation-only records. The World alongside this scene remains the
 * authentic Full; these arrays are never a Raw/save/simulation owner. */
export type CoreActorMode297='same-civil'|'frontier';
export type CoreActorSceneRecord297=
 |{readonly kind:'human';readonly index:number;readonly actor:Readonly<Pawn>}
 |{readonly kind:'animal';readonly index:number;readonly actor:Readonly<WildAnimal>}
 |{readonly kind:'mechanical';readonly index:number;readonly actor:Readonly<Mechanoid>};
export interface CoreActorScene297 {
 readonly core:number;
 readonly humans:readonly Readonly<Pawn>[];
 readonly animals:readonly Readonly<WildAnimal>[];
 readonly mechanical:readonly Readonly<Mechanoid>[];
 readonly byId:Readonly<Record<number,CoreActorSceneRecord297>>;
}

/** Derived on actual birth/arrival only. No per-Core flight/relations payload.
 * Exact current ProjectileLayer formulas, expressed in Core units; conversion
 * to local units occurs once at rendering. from/to are world shot coordinates. */
export interface CoreProjectileTrace297 {
 readonly id:number;
 readonly emittedAtCore:number;
 readonly endCore:number;
 readonly durationCore:number;
 readonly delayCore:number;
 readonly from:Readonly<Cell>;
 readonly to:Readonly<Cell>;
 readonly emp:boolean;
}
export interface CoreProjectileEvents297 {
 readonly upserted:readonly CoreProjectileTrace297[];
 readonly removed:readonly number[];
}
/** Frontier pose patch of one human whose dependency row changed only in its
 * work contact / animation pose (poseOnlyDependencyChanges297). It carries the
 * complete current record, the job it references and the contact computed by
 * the Worker on the live World (work pose, reach, and the facing toward the
 * work target, or null when no work target sets it). Presentation only. */
export interface CoreHumanPose297 {
 readonly id:number;
 readonly index:number;
 readonly actor:Readonly<Pawn>;
 readonly job:Readonly<Job>|null;
 readonly workPose:number;
 readonly reach:Readonly<{x:number;z:number}>;
 readonly yaw:number|null;
}
/** Frontier door patch: the presentation state of a door that opened or closed
 * since the anchored Full (the renderer animates open/from/changedAt). */
export interface CoreDoorPatch297 {
 readonly id:number;
 readonly door:Readonly<NonNullable<World['structures'][number]['door']>>;
}
/** Frontier pile patch: the current record of a material pile that changed
 * since the presented state (null: the pile no longer exists). */
export interface CorePilePatch297 {
 readonly id:number;
 readonly pile:Readonly<World['piles'][number]>|null;
}
export interface CorePhaseEnvelopeFields297 {
 readonly audioCues:readonly AudioCue[];
 readonly epoch:number;
 readonly mapId:number;
 readonly baseRevision:number;
 readonly phaseSeq:number;
 readonly nextId:number;
 readonly fromCore:number;
 readonly toCore:number;
 readonly speed:0|1|3|6;
 readonly actors:readonly CoreActorProjection297[];
 readonly tracks:readonly CoreMotionPatch297[];
 readonly projectiles:CoreProjectileEvents297;
 /** Frontier only, present only when non-empty. */
 readonly poses297?:readonly CoreHumanPose297[];
 /** Frontier only, present only when non-empty. */
 readonly doors297?:readonly CoreDoorPatch297[];
 /** Frontier only, present only when non-empty; ascending ids. */
 readonly piles297?:readonly CorePilePatch297[];
 /** Frontier only, present only when non-empty; ascending ids. */
 readonly paths297?:readonly CorePathKeep297[];
}
/** Frontier path patch. The row of this actor in the same packet carries an
 * empty `path`: its real path is the last `keep` cells of the path the renderer
 * already holds for that actor (from its previous row in this anchor). An actor
 * that walks along its route sends a count instead of every remaining cell. */
export interface CorePathKeep297 {readonly id:number;readonly keep:number}
/** A real discriminated union preserves reply narrowing in SimulationClient. */
export type CorePhaseEnvelope297=
 |(CorePhaseEnvelopeFields297&{readonly type:'actor-phase-297'})
 |(CorePhaseEnvelopeFields297&{readonly type:'actor-frontier-297'});
export interface CoreMotionPatch297 {readonly id:number;readonly drop:number;readonly keep:number;readonly append:readonly PresentationSegment[]}
/** Frozen membership/layout captured only at an admitted complete World. */
export interface CorePhaseLayout297 {
 readonly human:readonly number[];
 readonly animal:readonly number[];
 readonly mechanical:readonly number[];
}
export interface CorePhaseAnchor297 {
 readonly epoch:number;
 readonly mapId:number;
 readonly revision:number;
 readonly core:number;
 readonly width:number;
 readonly height:number;
 readonly nextId:number;
 readonly layout:CorePhaseLayout297;
}
/** Renderer-read value derived from a committed native receipt. Returning this
 * interface from a public shape validator confers NO capability. The concrete
 * renderer entry checks the private native-lane token, owner and anchor. */
export interface CorePhaseTypedProjection297 {
 readonly kind:'full'|'phase';
 readonly audioCues:readonly AudioCue[];
 readonly anchor:CorePhaseAnchor297;
 readonly phaseSeq:number;
 readonly nextId:number;
 readonly fromCore:number;
 readonly core:number;
 readonly speed:0|1|3|6;
 readonly world:World;
 readonly actorScene:CoreActorScene297;
 readonly actors:readonly CoreActorProjection297[];
 readonly tracks:PawnTrack[];
 readonly projectiles:CoreProjectileEvents297;
 /** Pose patches of this phase (already applied to actorScene.humans). */
 readonly poses297?:readonly CoreHumanPose297[];
 /** Door patches of this phase. */
 readonly doors297?:readonly CoreDoorPatch297[];
 /** Pile patches of this phase. */
 readonly piles297?:readonly CorePilePatch297[];
}
/** Header transport only. Never stored in the saved World. */
export interface CoreFullPhaseMetadata297 {
 /** Shape metadata only; the private Native Full receipt alone attests it. */
 readonly actorMode297?:'frontier';
 readonly mapId:number;
 readonly core:number;
 readonly projectilesRetained:readonly CoreProjectileTrace297[];
}
