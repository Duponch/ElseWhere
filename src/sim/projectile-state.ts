import type { BulletArrival,BulletFlight } from './bullet-flight.ts';
import type { WeaponQuality } from './equipment-rules.ts';
import type { LivingTargetKey } from './combat-target.ts';

/** Launch-time relation roster, until a real faction system supplies live
 * relations. IDs may outlive their actors; they are not ownership references. */
export interface ProjectileRelations { friendlyPawnIds:number[]; friendlyFireFactor:number;friendlyTargetKeys?:LivingTargetKey[] }
export interface WorldProjectile {
  /** Absent is the historical revolver. Independent of the current equipment. */
  weaponItem?:'bolt-action-rifle'|'emp-launcher'|'short-bow'|'mini-turret-gun'|'lancer-gun'|'pikeman-gun';
  id:number;
  quality:WeaponQuality;
  emittedAtCore:number;
  advancedAtCore:number;
  flight:BulletFlight;
  relations:ProjectileRelations;
  /** Kept through the impact's local tick for snapshots/save continuation.
   * The record is inert after arrival, including unsupported object impacts. */
  arrival:(BulletArrival & {effect:'starting-pod'|'animal'|'mech'|'barrier'|'pawn'|'structure'|'pile'|'resource'|'packed'|'ground'|'exit'|'unsupported-object'})|null;
}
