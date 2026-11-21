import {toughDamage361} from './traits.ts';
import { apparelProtection } from './apparel-protection.ts';
import { resolveUnarmoredBullet,validateUnarmoredBullet,type UnarmoredBullet,type BulletImpactResult } from './bullet-impact.ts';
import { createMedicalRecord } from './injury-state.ts';
import { healthRandom,reconcilePawnHealth,updatePawnHealth } from './health.ts';
import type { Pawn,World } from './types.ts';

/** Damage producer only. No command, projectile emission or target acquisition.
 * Call on the impact tick. Apparel protection is transactional; implants and incoming
 * damage modifiers remain outside the implemented scope. */
export function damageUnarmoredPawnWithBullet(world:World,pawn:Pawn,hit:UnarmoredBullet,penetration=0):BulletImpactResult|null {
  validateUnarmoredBullet(hit);
  if(world.schemaVersion<54)throw new Error('Bullet impact requires schema 54');
  if(!world.pawns.includes(pawn))throw new Error('Impact target is not in this world');
  if(pawn.state==='dead'||!hit.damage)return null;
  if(!pawn.health||pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
  if(pawn.health?.death)return null;
  const randomState={rng:world.rng};
  // The local PRNG is committed with the record; a failed resolver cannot
  // consume the world's random stream or leave half an anatomical impact.
  const protection=apparelProtection(world,pawn,'sharp',penetration,()=>healthRandom(randomState));
  // Schema 361: Tough (IncomingDamageFactor 0.5) scales the damage, never the armor draws.
  const tough=toughDamage361(pawn,hit.damage);
  const impact=resolveUnarmoredBullet(pawn.health??createMedicalRecord(world.tick),tough===hit.damage?hit:{...hit,damage:tough},()=>healthRandom(randomState),protection.protect);
  if(!impact.selected)return impact;
  protection.commit();world.rng=randomState.rng;pawn.health=impact.record;reconcilePawnHealth(world,pawn,undefined,true);
  return impact;
}
