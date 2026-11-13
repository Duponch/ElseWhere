import {meleeStunCore318} from '../../src/sim/stun.ts';
import { applyCommand,stepWorld } from '../../src/sim/engine.ts';
import { equippedWeapon } from '../../src/sim/equipment-rules.ts';
import { pawnBody } from '../../src/sim/health-rules.ts';
import { meleeContact } from '../../src/sim/melee-space.ts';
import type { MeleeState } from '../../src/sim/melee-state.ts';
import type { Pawn,World } from '../../src/sim/types.ts';
import { firingCamp } from './shooting.ts';

export type ShootingStunPhase='aim'|'cooldown';
export interface ShootingStunFixture {
  world:World;initialSeed:number;phase:ShootingStunPhase;
  shooterId:number;targetId:number;attackerId:number;weaponId:number;
  fireAtCore:number;beforeImpactCore:number;
  before:{phase:ShootingStunPhase;startedAtCore:number;endsAtCore:number};
}
export interface ShootingStunEvidence {
  eligible:boolean;strike:NonNullable<MeleeState['strike']>|null;
  stun:Pawn['stun']|null;state:Pawn['state'];moving:number;manipulation:number;
  armed:boolean;targetMobile:boolean;
  injuries:{part:string;kind:string;severity:number}[];
}

/** The seed is selected before combat. No draw, injury, stun or phase is forced.
 * Root can search a bounded initial seed range using a fresh fixture per seed. */
export function prepareShootingStun(initialSeed:number,phase:ShootingStunPhase):ShootingStunFixture {
  if(!Number.isInteger(initialSeed)||initialSeed<1||initialSeed>0xffffffff)throw Error('Invalid initial combat seed');
  const world=firingCamp(),[shooter,target,attacker]=world.pawns;
  // Initial placement only: the attacker has real natural fists and is already
  // adjacent, so its command needs neither a teleport nor an artificial strike.
  Object.assign(attacker,{x:4,z:11});
  if(!meleeContact(world,attacker,shooter))throw Error('Missing prepared melee contact');
  const weapon=equippedWeapon(world,shooter);
  if(!weapon||equippedWeapon(world,attacker))throw Error('Invalid real weapon ownership');
  world.rng=initialSeed;
  const fireAtCore=world.tick*10;
  const fire=applyCommand(world,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  if(!fire.ok)throw Error(`Prepared shot refused: ${fire.reason}`);
  // Revolver: aim18/cooldown96 Core. The cooldown fixture places the genuine
  // next melee attempt before its expiry, rather than shortening its duration.
  stepWorld(world,phase==='aim'?1:8);
  const stance=shooter.shooting?.stance;
  if(stance?.phase!==phase)throw Error(`Missing prepared ${phase} phase`);
  const before={phase,startedAtCore:stance.startedAtCore,endsAtCore:stance.endsAtCore};
  const melee=applyCommand(world,{type:'melee',pawnIds:[attacker.id],targetId:shooter.id});
  if(!melee.ok)throw Error(`Prepared melee refused: ${melee.reason}`);
  return {world,initialSeed,phase,shooterId:shooter.id,targetId:target.id,attackerId:attacker.id,weaponId:weapon.id,fireAtCore,beforeImpactCore:world.tick*10,before};
}

/** One real producer pass, then a command cancels only future melee attempts.
 * A miss/non-stun is reported to the seed probe, never retried or corrected. */
export function produceShootingStunImpact(fixture:ShootingStunFixture):ShootingStunEvidence {
  const {world,shooterId,targetId,attackerId,weaponId,beforeImpactCore,before}=fixture;
  if(world.tick*10!==beforeImpactCore)throw Error('Prepared impact was already advanced');
  stepWorld(world);
  const shooter=world.pawns.find(p=>p.id===shooterId)!,attacker=world.pawns.find(p=>p.id===attackerId)!,target=world.pawns.find(p=>p.id===targetId)!;
  const strike=attacker.melee?.strike?{...attacker.melee.strike}:null;
  const stop=applyCommand(world,{type:'draft-stop',pawnIds:[attackerId]});
  if(!stop.ok)throw Error(`Attacker stop refused: ${stop.reason}`);
  const capacities=pawnBody(shooter).capacities,stun=shooter.stun?{...shooter.stun}:null;
  const moving=capacities.moving,manipulation=capacities.manipulation;
  const armed=equippedWeapon(world,shooter)?.id===weaponId;
  const targetMobile=!['dead','downed','sleeping'].includes(target.state)&&pawnBody(target).capacities.moving>0;
  const injuries=(shooter.health?.injuries??[]).map(i=>({part:i.part,kind:i.kind,severity:i.severity}));
  const eligible=!!strike&&strike.outcome==='hit'&&['left-fist','right-fist'].includes(strike.tool)
    &&strike.atCore===beforeImpactCore+1&&!!stun&&stun.sinceCore===strike.atCore&&stun.untilCore===strike.atCore+meleeStunCore318(world.schemaVersion)
    &&!['dead','downed','sleeping'].includes(shooter.state)&&moving>0&&manipulation>0&&armed&&targetMobile&&injuries.length>0
    &&before.endsAtCore>strike.atCore&&before.endsAtCore<stun.untilCore;
  return {eligible,strike,stun,state:shooter.state,moving,manipulation,armed,targetMobile,injuries};
}
