import type {HumanConditionWander256} from './human-condition-mind-256.ts';
import type { Cell,Pawn,World } from './types.ts';
import { mentalCrisisLabel } from './mental-catalog.ts';
import { cancelMelee } from './melee-state.ts';
import { torturedArtistRecovery362 } from './tortured-artist-362.ts';

interface CrisisBase { age:number;target:Cell|null;waitUntil:number;
  /** Schema 362: not caused by mood (a trait's random state, an addiction's
   * binge): no catharsis and no trait inspiration at its end (Core causedByMood). */
  notMood362?:true }
export type AggressiveCrisisKind='tantrum'|'berserk'|'murderous-rage';
export type AggressiveCrisis=
  | (CrisisBase&{kind:'tantrum';targetId:number|null;targetSinceCore:number;attempted:boolean;nextTargetCore:number})
  | (CrisisBase&{kind:'berserk';targetId:number|null;jobUntilCore:number|null})
  | (CrisisBase&{kind:'murderous-rage';targetId:number;nextCheckCore:number});
/** Schema 350 (mental-breaks-350): psychotic wander, hiding in one's room
 * around its bed's cell, and the two insulting sprees. */
export type MoodPoolCrisis350=
  | (CrisisBase&{kind:'psychotic-wander'})
  | (CrisisBase&{kind:'wander-own-room';root:Cell})
  | (CrisisBase&{kind:'insulting-spree';insultTargetId:number|null;insulted:boolean;lastInsultCore:number|null;foundCore:number|null})
  | (CrisisBase&{kind:'targeted-insulting-spree';insultTargetId:number;insulted:boolean;lastInsultCore:number|null});
/** Schema 368 (fire-spree-368): the fire-starting spree with its current
 * job. An Ignite job holds `igniteId` (the thing to set on fire): the walk to
 * touch it, then the warmup and cooldown stances, each ending at `stanceCore`
 * (`cast` once the ignition was attempted). `waitNext` is Core's
 * mindState.nextMoveOrderIsWait: the next job is a short wait. */
export type FireSpreeCrisis368=CrisisBase&{kind:'fire-starting-spree';igniteId:number|null;stanceCore:number|null;cast:boolean;waitNext:boolean};
export type MentalCrisis=(CrisisBase&{kind:'confused-wander'})|(CrisisBase&{kind:'sad-wander'})|(CrisisBase&{kind:'food-binge'})|(CrisisBase&{kind:'drug-binge'})|AggressiveCrisis|MoodPoolCrisis350|FireSpreeCrisis368;
/** Tantrum, berserk and murderous rage: the crises that target by violence. */
export const isAggressiveMentalCrisis=(c:MentalCrisis):c is AggressiveCrisis=>c.kind==='tantrum'||c.kind==='berserk'||c.kind==='murderous-rage';

export interface MentalState {
  wander?:HumanConditionWander256;
  /** Sampled exposure in Core ticks, saturated once eligible. */
  below:[number,number,number];
  /** Local ticks awake until another mood break is allowed. */
  cooldown:number;
  catharsis:number[];
  crisis?:MentalCrisis;
}
export const BREAK_MTB_DAYS=[4,.8,.5] as const;
export const CATHARSIS_DURATION=18000;
export const hasMentalBreak=(pawn:Pawn):boolean=>!!pawn.mental?.crisis;
/** Passive expiry only; no crisis decision or RNG. */
export function expireMentalCatharsisAt(pawn:Pawn,tick:number):void {if((pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined))return;if(pawn.mental)pawn.mental.catharsis=pawn.mental.catharsis.filter(t=>t>tick);}
export function mentalState(pawn:Pawn):MentalState {
  return pawn.mental??={below:[0,0,0],cooldown:0,catharsis:[]};
}
/** ClearMind/MentalBreaker.Reset at arrest: no Recover catharsis and no new
 * cooldown. Completed physical edges/strikes retain their existing owners. */
export function resetMentalBreakForArrest(pawn:Pawn):void {
  const m=pawn.mental;if(!m)return;
  if(pawn.melee?.order?.auto==='mental')cancelMelee(pawn);
  delete m.crisis;m.below=[0,0,0];pawn.path=[];pawn.planCooldown=0;pawn.needCooldown=0;
  if(!pawn.need&&pawn.state!=='downed'&&pawn.state!=='dead')pawn.state='idle';
}
export function finishMentalBreak(world:World,pawn:Pawn,reward=true):void {
  const m=pawn.mental;if(!m?.crisis)return;
  const kind=m.crisis.kind;
  if(kind==='confused-wander'){delete m.crisis;pawn.path=[];pawn.planCooldown=0;pawn.needCooldown=0;if(!['dead','downed','sleeping'].includes(pawn.state))pawn.state=pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick?'moving':'idle';return;}
  if(pawn.melee?.order?.auto==='mental')cancelMelee(pawn);
  const moodCaused=!m.crisis.notMood362;
  delete m.crisis;pawn.path=[];if(!pawn.need&&pawn.state!=='downed'&&pawn.state!=='dead')pawn.state='idle';pawn.planCooldown=0;pawn.needCooldown=0;
  m.cooldown=1500;
  if(reward) {
    // Core RecoverFromState: the recovery thought, then the traits' notice,
    // both for a mood-caused state only (every crisis before 362).
    if(moodCaused){
      m.catharsis=m.catharsis.filter(t=>t>world.tick);
      if(m.catharsis.length===5)m.catharsis.shift();
      m.catharsis.push(world.tick+CATHARSIS_DURATION);
      torturedArtistRecovery362(world,pawn);
    }
    world.events.push({tick:world.tick,type:'need',message:kind==='food-binge'?`${pawn.name} cesse sa frénésie alimentaire.`:kind==='sad-wander'?`${pawn.name} sort de son errance triste.`:`${pawn.name} retrouve son calme (${mentalCrisisLabel(kind).toLowerCase()}).`});
    if(world.events.length>80)world.events.splice(0,world.events.length-80);
  }
}
