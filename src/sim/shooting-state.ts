import { isColonist } from './affiliation.ts';
import { workPriority } from './work-types.ts';
import type { Cell,Pawn,World } from './types.ts';

export interface ShootingClock {lastAdvancedAtCore:number;pausedCore:number}
export type ShootingStance=({phase:'aim';startedAtCore:number;endsAtCore:number;targetStartedDowned:boolean;lean?:Cell}
  |{phase:'cooldown';startedAtCore:number;endsAtCore:number})&{weaponItem?:'bolt-action-rifle'|'emp-launcher'|'short-bow'|'pump-shotgun';clock?:ShootingClock};
export type ShootingClockStep='duplicate'|'paused'|'active';

/** The order can be cancelled/replaced without erasing post-shot recovery. */
export interface ShootingState {
  order:{targetId:number;weaponId:number;startedDowned:boolean;hunt?:true;auto?:import('./automatic-combat-state.ts').AutomaticAttack}|null;
  stance:ShootingStance|null;
}
export type ShootingCommand={type:'shoot';pawnIds:number[];targetId:number};

/** Permission belongs to the shooter/mandate, independently of its target. */
export function shootingOrderAuthority(world:World,pawn:Pawn,order:ShootingState['order']=pawn.shooting?.order??null):boolean {
  if(!order)return true;
  if(order.hunt)return !!pawn.hunting&&pawn.hunting.animalId===order.targetId&&pawn.hunting.phase==='stalk'
    &&!pawn.draft&&workPriority(pawn,'hunt')>0&&!!world.hunting?.targets.includes(order.targetId);
  const auto=order.auto;
  if(auto)return isColonist(pawn)&&(auto.kind==='draft'?!!pawn.draft&&!pawn.draft.holdFire
    :!pawn.draft&&pawn.hostilityResponse==='attack'&&world.tick<auto.until);
  return isColonist(pawn)?!!pawn.draft:!pawn.prisoner||pawn.mental?.crisis?.kind==='berserk';
}

/** Only the common Core owner calls this; revalidation never pays elapsed time. */
export function advanceShootingClock(stance:ShootingStance,core:number,stunned:boolean):ShootingClockStep {
  const clock=stance.clock;
  if(!clock||!Number.isSafeInteger(core))throw new Error('Missing shooting Core clock');
  if(core===clock.lastAdvancedAtCore)return 'duplicate';
  if(core!==clock.lastAdvancedAtCore+1)throw new Error('Stale shooting Core clock');
  const pausedCore=clock.pausedCore+Number(stunned),endsAtCore=stance.endsAtCore+Number(stunned);
  if(!Number.isSafeInteger(pausedCore)||!Number.isSafeInteger(endsAtCore))throw new RangeError('Shooting clock overflow');
  clock.lastAdvancedAtCore=core;clock.pausedCore=pausedCore;stance.endsAtCore=endsAtCore;
  return stunned?'paused':'active';
}

export function cancelShooting(pawn:{shooting?:ShootingState}):void {
  if(pawn.shooting?.stance?.phase==='cooldown')pawn.shooting.order=null;
  else delete pawn.shooting;
}
